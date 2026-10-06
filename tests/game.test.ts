import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  stepWorld,
  fire,
  damage,
  moveShip,
  sanitizeInput,
  emptyInput,
  ISLANDS,
  safeSpawn,
} from "../shared/game";
function world() {
  const w = createWorld();
  w.ships.forEach((s, i) => {
    s.bot = false;
    s.shield = 0;
    s.x = 120 - i * 25;
    s.z = 0;
  });
  return w;
}
test("independent broadside reloads take exactly 3 seconds", () => {
  const w = world(),
    s = w.ships[0];
  fire(w, s, "left");
  fire(w, s, "left");
  fire(w, s, "right");
  assert.equal(w.shots.length, 6);
  assert.equal(s.left, 3);
  assert.equal(s.right, 3);
  for (let i = 0; i < 60; i++) stepWorld(w, 0.05);
  assert.ok(s.left < 0.00001);
});
test("server hit detection, score and five second respawn retain score", () => {
  const w = world(),
    a = w.ships[0],
    b = w.ships[1];
  a.x = 0;
  a.z = -20;
  a.a = 0;
  b.x = 24;
  b.z = -20;
  b.hp = 28;
  b.score = 35;
  fire(w, a, "right");
  for (let i = 0; i < 10; i++) stepWorld(w, 0.05);
  assert.ok(b.dead > 0);
  assert.equal(a.score, 100);
  assert.equal(b.score, 35);
  for (let i = 0; i < 101; i++) stepWorld(w, 0.05);
  assert.equal(b.dead, 0);
  assert.equal(b.hp, 100);
  assert.equal(b.score, 35);
  assert.ok(b.shield > 0);
});
test("treasure awards 35 and supplies restore hull", () => {
  const w = world(),
    s = w.ships[0];
  w.loot = [{ id: 999, x: s.x, z: s.z, kind: "treasure" }];
  stepWorld(w, 0.05);
  assert.equal(s.score, 35);
  s.hp = 30;
  w.loot = [{ id: 1000, x: s.x, z: s.z, kind: "supply" }];
  stepWorld(w, 0.05);
  assert.equal(s.hp, 55);
});
test("drag respects speed, release stops immediately, islands stay solid", () => {
  const w = world(),
    s = w.ships[0];
  s.x = 0;
  s.z = 0;
  moveShip(s, { throttle: 0, turn: 0, target: { x: 100, z: 0 } }, 0.05);
  assert.ok(s.x <= 1.2 + 0.0001);
  const x = s.x;
  moveShip(s, emptyInput(), 0.05);
  assert.equal(s.x, x);
  const island = ISLANDS[0];
  s.x = island.x - island.r - 5;
  s.z = island.z;
  for (let i = 0; i < 100; i++)
    moveShip(s, { throttle: 0, turn: 0, target: island }, 0.05);
  assert.ok(Math.hypot(s.x - island.x, s.z - island.z) >= island.r + 4.99);
});
test("three minute finish is immutable", () => {
  const w = world();
  for (let i = 0; i < 3601; i++) stepWorld(w, 0.05);
  assert.equal(w.time, 0);
  assert.equal(w.ended, true);
  const snapshot = JSON.stringify(w);
  stepWorld(w, 0.05);
  damage(w, w.ships[0], 100);
  assert.equal(JSON.stringify(w), snapshot);
});
test("storm shrinks safe area and damages exposed ships", () => {
  const w = world();
  w.mode = "storm";
  w.elapsed = 150;
  w.ships[0].x = 170;
  stepWorld(w, 0.1);
  assert.ok(w.stormRadius < 76);
  assert.ok(w.ships[0].hp < 100);
});
test("untrusted input cannot set position health score or infinite speed", () => {
  const input = sanitizeInput({
    throttle: 100,
    turn: Infinity,
    hp: 999,
    score: 999,
    target: { x: NaN, z: 30 },
    left: "true",
  });
  assert.deepEqual(input, {
    throttle: 1,
    turn: 0,
    seq: 0,
    left: false,
    right: false,
    boost: false,
    repair: false,
    supply: false,
  });
});
test("repair, sprint and resupply obey cooldowns", () => {
  const w = world(),
    s = w.ships[0];
  s.hp = 10;
  s.input = { throttle: 1, turn: 0, boost: true, repair: true, supply: true };
  stepWorld(w, 0.05);
  assert.equal(s.hp, 65);
  assert.equal(s.boost, 12);
  assert.equal(s.repair, 18);
  assert.equal(s.supply, 25);
  stepWorld(w, 0.05);
  assert.equal(s.hp, 65);
});

test("all six spawns are outside island colliders", () => {
  for (let i = 0; i < 6; i++) {
    const p = safeSpawn(i);
    for (const island of ISLANDS)
      assert.ok(Math.hypot(p.x - island.x, p.z - island.z) > island.r + 5);
  }
});

test("storm damage does not create audio and particle bursts every simulation tick", () => {
  const w = world();
  w.mode = "storm";
  w.elapsed = 150;
  w.ships[0].x = 170;
  for (let i = 0; i < 10; i++) stepWorld(w, 0.05);
  assert.ok(w.events.filter((e) => e.type === "hit").length < 3);
  assert.ok(w.ships[0].hp < 100);
});

test("missed cannonballs generate splash events once before being removed", () => {
  const w = world();
  w.ships.slice(1).forEach((s) => (s.z = 150));
  w.ships[0].x = 0;
  w.ships[0].z = 0;
  fire(w, w.ships[0], "left");
  for (let i = 0; i < 28; i++) stepWorld(w, 0.05);
  assert.equal(w.shots.length, 0);
  assert.equal(w.events.filter((e) => e.type === "splash").length, 3);
});
