import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  createWorld,
  emptyInput,
  sanitizeInput,
  stepWorld,
  type World,
  type Mode,
  type Difficulty,
  type Input,
} from "../shared/game";
type Room = {
  code: string;
  world: World;
  public: boolean;
  clients: Map<WebSocket, string>;
  emptySince: number;
  endedAt: number;
  pulses: Map<string, Set<string>>;
};
const rooms = new Map<string, Room>();
const app = express();
app.disable("x-powered-by");
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "Jenny Stormbreakers",
    rooms: rooms.size,
    players: [...rooms.values()].reduce((n, r) => n + r.clients.size, 0),
  }),
);
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
app.use(
  express.static(root, {
    maxAge: "1h",
    setHeaders: (res, p) => {
      if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (_req, res) => res.sendFile(path.join(root, "index.html")));
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 2048,
  perMessageDeflate: false,
});
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function code() {
  let c = "";
  do {
    c = Array.from(
      { length: 5 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
  } while (rooms.has(c));
  return c;
}
const send = (ws: WebSocket, data: unknown) => {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256000)
    ws.send(JSON.stringify(data));
};
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (
        new URL(origin).host !== req.headers.host &&
        process.env.NODE_ENV === "production"
      ) {
        ws.close(1008, "origin");
        return;
      }
    } catch {
      ws.close(1008, "origin");
      return;
    }
  }
  let room: Room | undefined,
    id = "",
    lastInput = Date.now(),
    lastSeq = -1,
    messageCount = 0,
    windowAt = Date.now(),
    alive = true;
  const pulses = new Set<string>();
  const joinTimeout = setTimeout(() => {
    if (!room) ws.close(1008, "join timeout");
  }, 15000);
  ws.on("pong", () => {
    alive = true;
  });
  const heartbeat = setInterval(() => {
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    ws.ping();
  }, 15000);
  ws.on("message", (raw) => {
    const now = Date.now();
    if (now - windowAt > 1000) {
      windowAt = now;
      messageCount = 0;
    }
    if (++messageCount > 100) {
      ws.close(1008, "rate");
      return;
    }
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!m || typeof m !== "object") return;
    if (m.type === "join" && !room) {
      if (!["match", "create", "join"].includes(m.kind)) {
        send(ws, { type: "error", error: "invalid" });
        return;
      }
      const mode: Mode = ["battle", "storm", "treasure"].includes(m.mode)
        ? m.mode
        : "battle";
      const difficulty: Difficulty = ["easy", "normal", "hard"].includes(
        m.difficulty,
      )
        ? m.difficulty
        : "normal";
      if (m.kind === "join") {
        room = rooms.get(String(m.room).toUpperCase());
        if (!room || room.world.ended) {
          room = undefined;
          send(ws, { type: "error", error: "not_found" });
          return;
        }
      } else if (m.kind === "match") {
        room = [...rooms.values()].find(
          (r) =>
            r.public &&
            r.world.mode === mode &&
            r.world.difficulty === difficulty &&
            !r.world.ended &&
            r.world.time > 25 &&
            r.clients.size < 6,
        );
      }
      if (!room) {
        if (rooms.size >= 100) {
          send(ws, { type: "error", error: "full" });
          return;
        }
        room = {
          code: code(),
          world: createWorld(mode, difficulty),
          public: m.kind === "match",
          clients: new Map(),
          emptySince: 0,
          endedAt: 0,
          pulses: new Map(),
        };
        room.world.ships.forEach((s) => (s.bot = true));
        rooms.set(room.code, room);
      }
      const slot = room.world.ships.find((s) => s.bot);
      if (!slot) {
        room = undefined;
        send(ws, { type: "error", error: "full" });
        return;
      }
      slot.bot = false;
      slot.name =
        typeof m.name === "string"
          ? m.name
              .replace(/[\u0000-\u001f\u007f<>]/g, "")
              .trim()
              .slice(0, 18) || "Captain"
          : "Captain";
      slot.input = emptyInput();
      id = slot.id;
      room.clients.set(ws, id);
      room.pulses.set(id, pulses);
      room.emptySince = 0;
      clearTimeout(joinTimeout);
      send(ws, {
        type: "welcome",
        room: room.code,
        playerId: id,
        world: room.world,
      });
      return;
    }
    if (m.type === "input" && room && !room.world.ended) {
      const s = room.world.ships.find((s) => s.id === id)!;
      const input = sanitizeInput(m.input);
      if ((input.seq || 0) <= lastSeq) return;
      lastSeq = input.seq || 0;
      lastInput = now;
      for (const key of ["left", "right", "boost", "repair", "supply"] as const)
        if (input[key]) pulses.add(key);
      s.input = input;
    }
  });
  const stale = setInterval(() => {
    if (!room) return;
    const s = room.world.ships.find((s) => s.id === id);
    if (s) {
      if (Date.now() - lastInput > 350)
        s.input = { ...emptyInput(), seq: lastSeq };
    }
  }, 25);
  ws.on("close", () => {
    clearTimeout(joinTimeout);
    clearInterval(heartbeat);
    clearInterval(stale);
    if (room) {
      room.clients.delete(ws);
      room.pulses.delete(id);
      const s = room.world.ships.find((s) => s.id === id);
      if (s) {
        s.bot = true;
        s.name = ["Jenny", "Marlin", "Coral", "Atlas", "Pearl", "Finn"][
          room.world.ships.indexOf(s)
        ];
        s.input = emptyInput();
      }
      if (!room.clients.size) room.emptySince = Date.now();
    }
  });
  ws.on("error", () => ws.close());
});
let previous = performance.now(),
  accumulator = 0;
setInterval(() => {
  const now = performance.now();
  accumulator += Math.min((now - previous) / 1000, 0.25);
  previous = now;
  while (accumulator >= 0.05) {
    accumulator -= 0.05;
    for (const room of rooms.values()) {
      if (room.clients.size) {
        for (const ship of room.world.ships) {
          const actions = room.pulses.get(ship.id);
          if (actions)
            for (const key of actions)
              (ship.input as unknown as Record<string, unknown>)[key] = true;
        }
        stepWorld(room.world, 0.05);
        for (const ship of room.world.ships) {
          const actions = room.pulses.get(ship.id);
          if (actions) {
            for (const key of actions)
              (ship.input as unknown as Record<string, unknown>)[key] = false;
            actions.clear();
          }
        }
      }
    }
  }
  for (const room of rooms.values()) {
    if (room.world.ended && !room.endedAt) room.endedAt = Date.now();
    if (
      (room.emptySince && Date.now() - room.emptySince > 30000) ||
      (room.endedAt && Date.now() - room.endedAt > 120000)
    ) {
      for (const ws of room.clients.keys()) ws.close(1000, "round ended");
      rooms.delete(room.code);
      continue;
    }
    const data = JSON.stringify({ type: "state", world: room.world });
    for (const ws of room.clients.keys())
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256000)
        ws.send(data);
  }
}, 50);
const port = Number(process.env.PORT || 3417);
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Jenny Stormbreakers listening on ${(server.address() as { port: number }).port}`,
  ),
);
process.on("SIGTERM", () => {
  for (const ws of wss.clients) ws.close(1012, "server restarting");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
