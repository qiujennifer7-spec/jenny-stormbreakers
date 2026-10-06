export type Mode = "battle" | "storm" | "treasure";
export type Difficulty = "easy" | "normal" | "hard";
export type Input = {
  throttle: number;
  turn: number;
  target?: { x: number; z: number };
  left?: boolean;
  right?: boolean;
  boost?: boolean;
  repair?: boolean;
  supply?: boolean;
  seq?: number;
};
export type Ship = {
  id: string;
  name: string;
  bot: boolean;
  x: number;
  z: number;
  a: number;
  hp: number;
  score: number;
  kills: number;
  speed: number;
  left: number;
  right: number;
  boost: number;
  repair: number;
  supply: number;
  boostTime: number;
  dead: number;
  shield: number;
  input: Input;
  ack: number;
};
export type Shot = {
  id: number;
  owner: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
};
export type Loot = {
  id: number;
  x: number;
  z: number;
  kind: "treasure" | "supply";
};
export type Event = {
  id: number;
  type: "fire" | "hit" | "sink" | "loot" | "storm";
  x: number;
  z: number;
  ship?: string;
};
export type World = {
  mode: Mode;
  difficulty: Difficulty;
  time: number;
  elapsed: number;
  ships: Ship[];
  shots: Shot[];
  loot: Loot[];
  events: Event[];
  serial: number;
  ended: boolean;
  stormRadius: number;
};
export const ARENA = 180;
export const ISLANDS = [
  { x: -68, z: -45, r: 19 },
  { x: 75, z: 58, r: 23 },
  { x: 85, z: -90, r: 16 },
  { x: -94, z: 90, r: 18 },
  { x: 0, z: 140, r: 12 },
];
export const emptyInput = (): Input => ({ throttle: 0, turn: 0 });
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const angle = (n: number) => Math.atan2(Math.sin(n), Math.cos(n));
export function safeSpawn(index: number) {
  const points = [
    { x: 0, z: 102 },
    { x: 122, z: 10 },
    { x: 45, z: -124 },
    { x: -40, z: -117 },
    { x: -125, z: 0 },
    { x: -47, z: 113 },
  ];
  const p = points[index % 6];
  return { ...p, a: Math.atan2(-p.x, p.z) };
}
export function makeShip(i: number): Ship {
  return {
    id: `ship-${i}`,
    name: ["Jenny", "Marlin", "Coral", "Atlas", "Pearl", "Finn"][i],
    bot: i !== 0,
    ...safeSpawn(i),
    hp: 100,
    score: 0,
    kills: 0,
    speed: 0,
    left: 0,
    right: 0,
    boost: 0,
    repair: 0,
    supply: 0,
    boostTime: 0,
    dead: 0,
    shield: 2,
    input: emptyInput(),
    ack: 0,
  };
}
export function createWorld(
  mode: Mode = "battle",
  difficulty: Difficulty = "normal",
): World {
  const w: World = {
    mode,
    difficulty,
    time: 180,
    elapsed: 0,
    ships: Array.from({ length: 6 }, (_, i) => makeShip(i)),
    shots: [],
    loot: [],
    events: [],
    serial: 0,
    ended: false,
    stormRadius: 180,
  };
  for (let i = 0; i < (mode === "treasure" ? 18 : 9); i++)
    addLoot(w, i % 4 === 0 ? "supply" : "treasure");
  return w;
}
function randomPoint() {
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() - 0.5) * 290,
      z = (Math.random() - 0.5) * 290;
    if (
      Math.hypot(x, z) < 155 &&
      ISLANDS.every((t) => Math.hypot(x - t.x, z - t.z) > t.r + 10)
    )
      return { x, z };
  }
  return { x: 0, z: 0 };
}
function addLoot(w: World, kind: Loot["kind"]) {
  w.loot.push({ id: ++w.serial, ...randomPoint(), kind });
}
export function emit(
  w: World,
  type: Event["type"],
  x: number,
  z: number,
  ship?: string,
) {
  w.events.push({ id: ++w.serial, type, x, z, ship });
  w.events = w.events.slice(-60);
}
export function moveShip(
  s: Ship,
  input: Input,
  dt: number,
  ships: Ship[] = [],
) {
  if (s.dead > 0) return;
  const maxSpeed = s.boostTime > 0 ? 42 : 24;
  let distance = Infinity;
  if (input.target) {
    const dx = input.target.x - s.x,
      dz = input.target.z - s.z;
    distance = Math.hypot(dx, dz);
    if (distance > 0.3) s.a = Math.atan2(dx, -dz);
    s.speed = distance > 0.3 ? Math.min(maxSpeed, distance / dt) : 0;
  } else {
    s.a += input.turn * 1.45 * dt;
    s.speed = clamp(input.throttle, -0.45, 1) * maxSpeed;
  }
  let x = s.x + Math.sin(s.a) * s.speed * dt,
    z = s.z - Math.cos(s.a) * s.speed * dt;
  for (const island of ISLANDS) {
    const d = Math.hypot(x - island.x, z - island.z),
      r = island.r + 5;
    if (d < r) {
      x = island.x + ((x - island.x) / (d || 1)) * r;
      z = island.z + ((z - island.z) / (d || 1)) * r;
    }
  }
  for (const other of ships) {
    if (other.id === s.id || other.dead > 0) continue;
    const d = Math.hypot(x - other.x, z - other.z);
    if (d < 9) {
      x = other.x + ((x - other.x) / (d || 1)) * 9;
      z = other.z + ((z - other.z) / (d || 1)) * 9;
    }
  }
  const r = Math.hypot(x, z);
  if (r > ARENA - 5) {
    x *= (ARENA - 5) / r;
    z *= (ARENA - 5) / r;
  }
  s.x = x;
  s.z = z;
}
export function fire(w: World, s: Ship, side: "left" | "right") {
  if (s.dead > 0 || s[side] > 0 || w.ended) return;
  s[side] = 3;
  const a = s.a + (side === "left" ? -Math.PI / 2 : Math.PI / 2);
  for (let i = -1; i <= 1; i++) {
    const spread = a + i * 0.08;
    w.shots.push({
      id: ++w.serial,
      owner: s.id,
      x: s.x + Math.sin(a) * 5 + Math.sin(s.a) * i * 3,
      z: s.z - Math.cos(a) * 5 - Math.cos(s.a) * i * 3,
      vx: Math.sin(spread) * 78,
      vz: -Math.cos(spread) * 78,
      life: 1.35,
    });
  }
  emit(w, "fire", s.x + Math.sin(a) * 5, s.z - Math.cos(a) * 5, s.id);
}
export function damage(
  w: World,
  s: Ship,
  amount: number,
  owner?: string,
  effects = true,
) {
  if (s.dead > 0 || s.shield > 0 || w.ended) return;
  s.hp = Math.max(0, s.hp - amount);
  if (effects) emit(w, "hit", s.x, s.z, s.id);
  if (s.hp === 0) {
    s.dead = 5;
    s.speed = 0;
    s.input = emptyInput();
    emit(w, "sink", s.x, s.z, s.id);
    const killer = w.ships.find((t) => t.id === owner);
    if (killer && killer !== s) {
      killer.score += 100;
      killer.kills++;
    }
  }
}
function botInput(w: World, s: Ship): Input {
  const enemies = w.ships
    .filter((t) => t.id !== s.id && t.dead <= 0)
    .sort(
      (a, b) =>
        Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z),
    );
  const enemy = enemies[0];
  const loot = [...w.loot].sort(
    (a, b) =>
      Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z),
  )[0];
  let target: Ship | Loot = enemy || loot;
  const dist = enemy ? Math.hypot(enemy.x - s.x, enemy.z - s.z) : 999;
  if (loot && (w.mode === "treasure" || dist > 90)) target = loot;
  if (!target) return emptyInput();
  let desired = Math.atan2(target.x - s.x, -(target.z - s.z));
  if (target === enemy && dist < 78) desired += Math.PI / 2;
  let turn = clamp(angle(desired - s.a) * 2, -1, 1);
  for (const island of ISLANDS) {
    const px = s.x + Math.sin(s.a) * 22,
      pz = s.z - Math.cos(s.a) * 22;
    if (Math.hypot(px - island.x, pz - island.z) < island.r + 10) turn = 1;
  }
  if (w.mode === "storm" && Math.hypot(s.x, s.z) > w.stormRadius - 12)
    turn = clamp(angle(Math.atan2(-s.x, s.z) - s.a) * 2, -1, 1);
  const aim = enemy
    ? angle(Math.atan2(enemy.x - s.x, -(enemy.z - s.z)) - s.a)
    : 0;
  const tolerance =
    w.difficulty === "easy" ? 0.12 : w.difficulty === "hard" ? 0.35 : 0.24;
  return {
    throttle: dist < 45 ? 0.55 : 1,
    turn,
    left: dist < 100 && Math.abs(aim + Math.PI / 2) < tolerance,
    right: dist < 100 && Math.abs(aim - Math.PI / 2) < tolerance,
    repair: s.hp < 55,
    supply: s.hp < 32,
    boost: dist > 100,
  };
}
export function stepWorld(w: World, dt: number) {
  if (w.ended) return;
  dt = clamp(dt, 0, 0.1);
  w.elapsed += dt;
  w.time = Math.max(0, 180 - w.elapsed);
  w.stormRadius =
    w.mode === "storm" ? Math.max(52, 180 - w.elapsed * 0.7) : 180;
  for (const s of w.ships) {
    for (const key of [
      "left",
      "right",
      "boost",
      "repair",
      "supply",
      "boostTime",
      "shield",
    ] as const)
      s[key] = Math.max(0, s[key] - dt);
    if (s.dead > 0) {
      s.dead = Math.max(0, s.dead - dt);
      if (s.dead === 0) {
        Object.assign(s, safeSpawn(w.ships.indexOf(s)), {
          hp: 100,
          shield: 3,
          left: 0,
          right: 0,
          input: emptyInput(),
        });
      }
      continue;
    }
    if (s.bot) s.input = botInput(w, s);
    const input = s.input;
    if (input.boost && s.boost === 0) {
      s.boost = 12;
      s.boostTime = 2;
    }
    if (input.repair && s.repair === 0 && s.hp < 100) {
      s.hp = Math.min(100, s.hp + 35);
      s.repair = 18;
    }
    if (input.supply && s.supply === 0) {
      s.hp = Math.min(100, s.hp + 20);
      s.left = 0;
      s.right = 0;
      s.supply = 25;
      emit(w, "loot", s.x, s.z, s.id);
    }
    moveShip(s, input, dt, w.ships);
    s.ack = input.seq || 0;
    if (input.left) fire(w, s, "left");
    if (input.right) fire(w, s, "right");
    if (w.mode === "storm" && Math.hypot(s.x, s.z) > w.stormRadius)
      damage(
        w,
        s,
        10 * dt,
        undefined,
        Math.floor(w.elapsed) !== Math.floor(w.elapsed - dt),
      );
    for (const item of [...w.loot]) {
      if (Math.hypot(s.x - item.x, s.z - item.z) < 9) {
        if (item.kind === "treasure") s.score += 35;
        else {
          s.hp = Math.min(100, s.hp + 25);
          s.left = s.right = 0;
        }
        emit(w, "loot", item.x, item.z, s.id);
        w.loot = w.loot.filter((t) => t.id !== item.id);
        addLoot(w, item.kind);
      }
    }
  }
  for (const b of w.shots) {
    const ox = b.x,
      oz = b.z;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if (ISLANDS.some((i) => Math.hypot(b.x - i.x, b.z - i.z) < i.r)) b.life = 0;
    for (const s of w.ships) {
      if (s.id === b.owner || s.dead > 0 || b.life <= 0) continue;
      const dx = b.x - ox,
        dz = b.z - oz,
        t = clamp(
          ((s.x - ox) * dx + (s.z - oz) * dz) / (dx * dx + dz * dz || 1),
          0,
          1,
        );
      if (Math.hypot(s.x - (ox + t * dx), s.z - (oz + t * dz)) < 5.5) {
        damage(w, s, 28, b.owner);
        b.life = 0;
        break;
      }
    }
  }
  w.shots = w.shots.filter((b) => b.life > 0);
  if (w.time === 0) {
    w.ended = true;
    w.shots = [];
    for (const s of w.ships) s.speed = 0;
  }
}
export function standings(w: World) {
  return [...w.ships].sort(
    (a, b) =>
      b.score - a.score || b.kills - a.kills || a.name.localeCompare(b.name),
  );
}
export function sanitizeInput(raw: unknown): Input {
  if (!raw || typeof raw !== "object") return emptyInput();
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : 0;
  const input: Input = {
    throttle: num(r.throttle, -1, 1),
    turn: num(r.turn, -1, 1),
    seq: Math.floor(num(r.seq, 0, 1e9)),
  };
  for (const key of ["left", "right", "boost", "repair", "supply"] as const)
    input[key] = r[key] === true;
  if (r.target && typeof r.target === "object") {
    const p = r.target as Record<string, unknown>;
    if (
      typeof p.x === "number" &&
      Number.isFinite(p.x) &&
      typeof p.z === "number" &&
      Number.isFinite(p.z)
    )
      input.target = { x: clamp(p.x, -180, 180), z: clamp(p.z, -180, 180) };
  }
  return input;
}
