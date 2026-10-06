import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as THREE from "three";
const execute = promisify(execFile),
  base = process.env.TEST_URL || "http://127.0.0.1:3417";
const run = async (session, ...args) =>
  (
    await execute("agent-browser", ["--session", session, ...args], {
      maxBuffer: 4e6,
    })
  ).stdout.trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clients = [
  { id: "jenny-six-pc", name: "PC Captain", w: 1280, h: 800 },
  { id: "jenny-six-phone", name: "Phone Captain", w: 390, h: 844 },
  { id: "jenny-six-ipad", name: "iPad Captain", w: 768, h: 1024 },
  { id: "jenny-six-phone-land", name: "Phone Landscape", w: 844, h: 390 },
  { id: "jenny-six-ipad-land", name: "iPad Landscape", w: 1024, h: 768 },
  { id: "jenny-six-pc2", name: "PC Captain 2", w: 1440, h: 900 },
];
const history = async (c) =>
  JSON.parse(await run(c.id, "get", "attr", "canvas", "data-sync-snapshots"));
const latest = async (c) => (await history(c)).at(-1);
async function assertSynchronized(label) {
  const histories = await Promise.all(clients.map(history));
  const sample = histories[0].findLast((s) =>
    histories.every((h) => h.some((t) => t.elapsed === s.elapsed)),
  );
  assert.ok(sample, "all six clients must have a common server tick");
  for (const h of histories)
    assert.deepEqual(
      h.find((t) => t.elapsed === sample.elapsed).ships,
      sample.ships,
    );
  console.log(
    JSON.stringify({
      stage: label,
      elapsed: sample.elapsed,
      players: sample.ships.filter((s) => !s.bot).length,
      hp: sample.ships.map((s) => s.hp),
      scores: sample.ships.map((s) => s.score),
    }),
  );
  return sample;
}
function cameraFor(c, s) {
  const camera = new THREE.PerspectiveCamera(43, c.w / c.h, 0.5, 1800),
    portrait = c.w / c.h < 0.8;
  camera.position.set(s.x, portrait ? 120 : 94, s.z + (portrait ? 94 : 76));
  camera.lookAt(s.x, 0, s.z - 9);
  camera.updateMatrixWorld();
  return camera;
}
function project(camera, c, p) {
  const v = new THREE.Vector3(p.x, p.y ?? 0, p.z).project(camera);
  return { x: ((v.x + 1) * c.w) / 2, y: ((1 - v.y) * c.h) / 2 };
}
async function dragTo(c, target) {
  const index = clients.indexOf(c);
  let s = (await latest(c)).ships[index];
  const camera = cameraFor(c, s);
  const down = project(camera, c, { ...s, y: 5 });
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2((down.x / c.w) * 2 - 1, 1 - (down.y / c.h) * 2),
    camera,
  );
  const ground = new THREE.Vector3();
  ray.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    ground,
  );
  const move = project(camera, c, {
    x: target.x - (s.x - ground.x),
    z: target.z - (s.z - ground.z),
  });
  await run(
    c.id,
    "mouse",
    "move",
    String(Math.round(down.x)),
    String(Math.round(down.y)),
  );
  await run(c.id, "mouse", "down", "left");
  await run(
    c.id,
    "mouse",
    "move",
    String(Math.round(move.x)),
    String(Math.round(move.y)),
  );
  for (let i = 0; i < 180; i++) {
    await wait(100);
    s = (await latest(c)).ships[index];
    if (Math.hypot(s.x - target.x, s.z - target.z) < 2) break;
  }
  await run(c.id, "mouse", "up", "left");
  assert.ok(
    Math.hypot(s.x - target.x, s.z - target.z) < 3,
    `drag target not reached: ${JSON.stringify(s)}`,
  );
}
try {
  for (const c of clients) {
    await run(c.id, "open", base + "/?verify=1");
    await run(c.id, "set", "viewport", String(c.w), String(c.h));
    await run(c.id, "wait", "canvas");
    await run(c.id, "click", ".form-bottom button");
    await run(
      c.id,
      "select",
      ".settings-fields label:nth-child(2) select",
      c.w <= 1024 ? "low" : "high",
    );
    await run(c.id, "click", "button.close");
    await run(c.id, "fill", "#captain", c.name);
    await run(c.id, "select", ".connection-row select", "match");
  }
  for (const c of clients) {
    await run(c.id, "click", ".sail-button");
    await wait(150);
  }
  await wait(600);
  const codes = await Promise.all(
    clients.map((c) => run(c.id, "get", "text", ".invite")),
  );
  const code = codes[0].match(/[A-Z2-9]{5}/)[0];
  assert.ok(codes.every((t) => t.includes(code)));
  await assertSynchronized("six_matched");
  const seventh = "jenny-six-seventh";
  await run(seventh, "open", base);
  await run(seventh, "select", ".connection-row select", "match");
  await run(seventh, "click", ".sail-button");
  await wait(600);
  const nextCode = (await run(seventh, "get", "text", ".invite")).match(
    /[A-Z2-9]{5}/,
  )[0];
  assert.notEqual(nextCode, code);
  await run(seventh, "close");
  const rejected = "jenny-six-rejected";
  await run(rejected, "open", base + "/?room=" + code);
  await wait(400);
  await run(rejected, "click", ".sail-button");
  await run(rejected, "wait", ".error");
  assert.match(await run(rejected, "get", "text", ".error"), /房间已满/);
  await run(rejected, "close");
  console.log(
    "Seventh auto-match routed to new room; explicit join rejected at capacity.",
  );
  if ((await latest(clients[1])).ships[1].hp < 100)
    await run(clients[1].id, "click", 'button[aria-label="船体修复"]');
  await run(clients[1].id, "click", 'button[aria-label="紧急补给"]');
  const recoveryAt = Date.now();
  await dragTo(clients[1], { x: 122, z: 10 });
  // Move only through the real browser controls. Traverse an unobstructed route east of the centre.
  await dragTo(clients[0], { x: 36, z: 90 });
  await dragTo(clients[0], { x: 36, z: 10 });
  await dragTo(clients[0], { x: 102, z: 10 });
  await wait(Math.max(0, 19000 - (Date.now() - recoveryAt)));
  if ((await latest(clients[1])).ships[1].hp < 100)
    await run(clients[1].id, "click", 'button[aria-label="船体修复"]');
  await wait(250);
  console.log(
    "Positions before firing " +
      JSON.stringify(
        (await latest(clients[0])).ships.map((s) => ({ x: s.x, z: s.z })),
      ),
  );
  const target = await run(
    clients[0].id,
    "get",
    "attr",
    '.map svg path[fill="#ffe0a0"]',
    "transform",
  );
  const heading = (Number(target.match(/rotate\(([^)]+)/)[1]) * Math.PI) / 180;
  const delta = Math.atan2(Math.sin(-heading), Math.cos(-heading));
  const key = delta < 0 ? "a" : "d";
  await run(clients[0].id, "keydown", key);
  await wait((Math.abs(delta) / 1.45) * 1000);
  await run(clients[0].id, "keyup", key);
  await wait(200);
  await run(clients[0].id, "click", 'button[aria-label="右舷齐射"]');
  await wait(900);
  let snapshot = await assertSynchronized("authoritative_hit");
  assert.ok(
    snapshot.ships[1].hp < 100,
    "target must take server-calculated damage",
  );
  await wait(2400);
  await run(clients[0].id, "click", 'button[aria-label="右舷齐射"]');
  await wait(900);
  snapshot = await assertSynchronized("authoritative_sink_and_score");
  assert.equal(snapshot.ships[1].hp, 0);
  assert.ok(snapshot.ships[0].score >= 100);
  await wait(5500);
  snapshot = await assertSynchronized("respawn");
  assert.equal(snapshot.ships[1].hp, 100);
  const performance = [];
  for (const c of clients) {
    await run(
      c.id,
      "screenshot",
      process.cwd() + `/artifacts/six-${c.id.replace("jenny-six-", "")}.png`,
    );
    performance.push({
      client: c.name,
      viewport: `${c.w}x${c.h}`,
      stats: JSON.parse(
        await run(c.id, "get", "attr", "canvas", "data-render-stats"),
      ),
    });
    assert.equal(await run(c.id, "errors"), "");
  }
  // Verify AI takes over a vacated slot, then a room-code join restores six humans.
  await run(clients[5].id, "click", ".battle-actions button:last-child");
  await run(clients[5].id, "click", "button.text-button");
  for (let i = 0; i < 20; i++) {
    await wait(100);
    if ((await latest(clients[0])).ships.filter((s) => !s.bot).length === 5)
      break;
  }
  assert.equal(
    (await latest(clients[0])).ships.filter((s) => !s.bot).length,
    5,
  );
  await run(clients[5].id, "select", ".connection-row select", "join");
  await run(clients[5].id, "fill", ".room-input", code);
  await run(clients[5].id, "click", ".sail-button");
  await wait(600);
  await assertSynchronized("rejoin");
  console.log("Waiting for natural 180-second settlement.");
  for (let i = 0; i < 110; i++) {
    await wait(2000);
    if (
      JSON.parse(
        await run(
          clients[0].id,
          "eval",
          'Boolean(document.querySelector(".results"))',
        ),
      )
    )
      break;
    if (i % 15 === 0)
      console.log(
        "Time " +
          (await run(clients[0].id, "get", "text", "[data-testid=timer]")),
      );
  }
  const results = await Promise.all(
    clients.map((c) => run(c.id, "get", "text", ".result-table")),
  );
  assert.ok(results.every((t) => t === results[0]));
  await run(
    clients[0].id,
    "screenshot",
    process.cwd() + "/artifacts/six-player-results.png",
  );
  const report = {
    passed: true,
    code,
    devices:
      "Six independent Chromium browser processes; viewport emulation (not physical-device certification)",
    seventhRouted: true,
    explicitSeventhRejected: true,
    hitSync: true,
    scoreSync: true,
    respawnSync: true,
    AIReplacement: true,
    result: results[0],
    performance,
  };
  writeFileSync(
    "artifacts/six-player-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await Promise.all(clients.map((c) => run(c.id, "close").catch(() => {})));
}
