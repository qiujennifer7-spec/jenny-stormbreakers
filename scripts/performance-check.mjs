import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const session = "jenny-performance";
const run = (...args) =>
  execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
  }).trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const position = () =>
  run("get", "attr", '.map svg path[fill="#ffe0a0"]', "transform");
try {
  run("open", (process.env.TEST_URL || "http://127.0.0.1:3417") + "/?verify=1");
  run("set", "viewport", "1440", "900");
  run("wait", "canvas");
  await wait(700);
  run("screenshot", process.cwd() + "/artifacts/polished-home.png");
  run("click", ".form-bottom button");
  run("select", ".settings-fields label:nth-child(1) select", "easy");
  run("select", ".settings-fields label:nth-child(2) select", "low");
  run("click", "button.close");
  run("click", ".sail-button");
  run("wait", ".map");
  const before = position();
  run("keydown", "w");
  await wait(500);
  run("keyup", "w");
  const forward = position();
  assert.notEqual(before, forward);
  run("keydown", "s");
  await wait(400);
  run("keyup", "s");
  assert.notEqual(position(), forward);
  const beforeTurn = position();
  run("keydown", "a");
  await wait(400);
  run("keyup", "a");
  assert.notEqual(position(), beforeTurn);
  run("press", "q");
  await wait(150);
  assert.match(
    run("get", "text", 'button[aria-label="左舷齐射"]'),
    /[23]\.\ds/,
  );
  run("press", "e");
  await wait(150);
  assert.match(
    run("get", "text", 'button[aria-label="右舷齐射"]'),
    /[23]\.\ds/,
  );
  run("press", "Space");
  await wait(150);
  assert.match(
    run("get", "text", 'button[aria-label="破风冲刺"]'),
    /1[012]\.\ds/,
  );
  run("press", "Escape");
  const paused = run("get", "text", "[data-testid=timer]"),
    pausedPosition = position();
  await wait(1100);
  assert.equal(run("get", "text", "[data-testid=timer]"), paused);
  assert.equal(position(), pausedPosition);
  assert.equal(
    JSON.parse(run("get", "attr", "canvas", "data-audio-stats")).state,
    "suspended",
  );
  run("press", "Escape");
  run("set", "viewport", "390", "844");
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await wait(2000);
    samples.push(JSON.parse(run("get", "attr", "canvas", "data-render-stats")));
    console.log(JSON.stringify({ sample: i, stats: samples.at(-1) }));
    assert.ok(samples.at(-1).particles <= 180);
    assert.equal(samples.at(-1).particleLimit, 180);
    assert.ok(samples.at(-1).pixelRatio <= 1);
    if (i % 3 === 0) {
      run("press", "q");
      run("press", "e");
    }
  }
  assert.ok(
    Math.max(...samples.map((s) => s.geometries)) < 120,
    "live geometry count stays bounded",
  );
  assert.equal(run("errors"), "");
  run("screenshot", process.cwd() + "/artifacts/polished-battle.png");
  const report = {
    passed: true,
    method:
      "Desktop Chromium emulating 390x844; no claim about physical phone GPU",
    keyboard: true,
    soloPause: true,
    mutingPause: true,
    quality: "low",
    samples,
  };
  writeFileSync(
    "artifacts/performance-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  run("close");
}
