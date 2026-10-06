import { test, before, after } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
let url = process.env.TEST_WS_URL || "";
let child: ChildProcess | undefined;
before(async () => {
  if (url) return;
  await new Promise<void>((resolve, reject) => {
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env: { ...process.env, PORT: "0", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(
      () => reject(Error("Test server startup timeout")),
      10000,
    );
    child.stdout!.on("data", (b) => {
      const match = String(b).match(/listening on (\d+)/);
      if (match) {
        url = `ws://127.0.0.1:${match[1]}/ws`;
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!url) reject(Error(`Server exited ${code}`));
    });
  });
});
after(() => child?.kill("SIGTERM"));

function connect(
  join: Record<string, unknown>,
): Promise<{ ws: WebSocket; msg: any; states: any[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const states: any[] = [];
    const timeout = setTimeout(() => {
      ws.close();
      reject(Error("join timeout"));
    }, 5000);
    ws.on("open", () =>
      ws.send(JSON.stringify({ type: "join", name: "Network test", ...join })),
    );
    ws.on("error", reject);
    ws.on("message", (b) => {
      const m = JSON.parse(String(b));
      if (m.type === "welcome" || m.type === "error") {
        clearTimeout(timeout);
        resolve({ ws, msg: m, states });
      } else if (m.type === "state") states.push(m.world);
    });
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
test("real sockets share authoritative room, fill six slots, reject seventh, restore AI", async () => {
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  try {
    const a = await connect({ kind: "create", mode: "battle" });
    clients.push(a);
    assert.equal(a.msg.type, "welcome");
    const room = a.msg.room;
    const b = await connect({ kind: "join", room, name: "Second captain" });
    clients.push(b);
    assert.notEqual(a.msg.playerId, b.msg.playerId);
    await wait(180);
    assert.equal(a.states.at(-1).ships.filter((s: any) => !s.bot).length, 2);
    const before = a.states
      .at(-1)
      .ships.find((s: any) => s.id === a.msg.playerId);
    a.ws.send(
      JSON.stringify({
        type: "input",
        input: { seq: 1, throttle: 1, turn: 0, x: 9999, hp: 9999, score: 9999 },
      }),
    );
    await wait(230);
    const after = b.states
      .at(-1)
      .ships.find((s: any) => s.id === a.msg.playerId);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 10);
    assert.ok(after.hp <= 100);
    assert.ok(after.score < 9999);
    for (let i = 0; i < 4; i++)
      clients.push(await connect({ kind: "join", room }));
    const full = await connect({ kind: "join", room });
    clients.push(full);
    assert.equal(full.msg.error, "full");
    b.ws.close();
    await wait(200);
    assert.equal(a.states.at(-1).ships.filter((s: any) => !s.bot).length, 5);
    const c = await connect({ kind: "join", room });
    clients.push(c);
    assert.equal(c.msg.playerId, b.msg.playerId);
    const t = a.states.at(-1).time;
    await wait(250);
    assert.ok(a.states.at(-1).time < t);
  } finally {
    clients.forEach((c) => c.ws.close());
  }
});
test("match pairs players, invalid code fails clearly", async () => {
  const a = await connect({
      kind: "match",
      mode: "treasure",
      difficulty: "hard",
    }),
    b = await connect({ kind: "match", mode: "treasure", difficulty: "hard" }),
    bad = await connect({ kind: "join", room: "XXXXX" });
  try {
    assert.equal(a.msg.room, b.msg.room);
    assert.equal(bad.msg.error, "not_found");
  } finally {
    a.ws.close();
    b.ws.close();
    bad.ws.close();
  }
});

test("quick taps survive an input release before the next server tick, and idle ACK stays monotonic", async () => {
  const a = await connect({ kind: "create", mode: "battle" });
  try {
    a.ws.send(
      JSON.stringify({
        type: "input",
        input: { seq: 1, throttle: 0, turn: 0, right: true },
      }),
    );
    a.ws.send(
      JSON.stringify({
        type: "input",
        input: { seq: 2, throttle: 0, turn: 0, right: false },
      }),
    );
    await wait(150);
    const ship = a.states
      .at(-1)
      .ships.find((s: any) => s.id === a.msg.playerId);
    assert.ok(ship.right > 2.5, "quick tap must have fired exactly once");
    await wait(450);
    const idle = a.states
      .at(-1)
      .ships.find((s: any) => s.id === a.msg.playerId);
    assert.equal(idle.ack, 2, "timeout must not rewind input acknowledgement");
    assert.equal(idle.speed, 0);
  } finally {
    a.ws.close();
  }
});

test("automatic matchmaking fills exactly six slots and sends the seventh to a new room", async () => {
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  try {
    for (let i = 0; i < 7; i++)
      clients.push(
        await connect({
          kind: "match",
          mode: "storm",
          difficulty: "easy",
          name: `Fleet ${i + 1}`,
        }),
      );
    const first = clients[0].msg.room;
    assert.ok(clients.slice(0, 6).every((c) => c.msg.room === first));
    assert.notEqual(clients[6].msg.room, first);
    await wait(250);
    assert.ok(
      clients
        .slice(0, 6)
        .every(
          (c) => c.states.at(-1).ships.filter((s: any) => !s.bot).length === 6,
        ),
    );
    const sample = clients[0].states.at(-2);
    for (const c of clients.slice(1, 6)) {
      const same = c.states.find((w: any) => w.elapsed === sample.elapsed);
      assert.ok(same);
      assert.deepEqual(
        same.ships.map((s: any) => [s.id, s.hp, s.score, s.kills]),
        sample.ships.map((s: any) => [s.id, s.hp, s.score, s.kills]),
      );
    }
  } finally {
    clients.forEach((c) => c.ws.close());
  }
});
