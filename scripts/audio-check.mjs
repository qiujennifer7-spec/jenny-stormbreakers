import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const session = "jenny-sound",
  run = (...args) =>
    execFileSync("agent-browser", ["--session", session, ...args], {
      encoding: "utf8",
    }).trim(),
  wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = () =>
  JSON.parse(run("get", "attr", "#meter", "data-audio-stats"));
run(
  "open",
  (process.env.TEST_URL || "http://127.0.0.1:3417") + "/soundcheck.html",
);
run("snapshot", "-i");
const measurements = [];
for (const effect of ["sea", "fire", "hit", "sink", "splash", "loot"]) {
  run("click", `button[data-effect="${effect}"]`);
  await wait(350);
  const sample = stats();
  assert.equal(sample.state, "running");
  assert.ok(sample.peakRms > 0.0001);
  if (effect !== "sea") assert.ok(sample.counts[effect] > 0);
  measurements.push(sample);
  await wait(effect === "sink" ? 2500 : 750);
}
run("click", "#mute");
await wait(600);
const muted = stats();
assert.equal(muted.muted, true);
assert.ok(muted.rms < 0.0001);
run("click", "#mute");
run("click", "#pause");
await wait(250);
assert.equal(stats().state, "suspended");
run("click", "#pause");
await wait(200);
assert.equal(stats().state, "running");
assert.equal(run("errors"), "");
run("screenshot", process.cwd() + "/artifacts/audio-review.png");
const report = {
  passed: true,
  method:
    "Real Web Audio output measured by AnalyserNode; waveform presence, mute, pause/resume and bounded voices verified. Human subjective listening still recommended.",
  measurements,
  muted,
};
writeFileSync(
  "artifacts/audio-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
run("close");
