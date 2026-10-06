import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.TEST_URL || "http://127.0.0.1:3417";
const run = (session, ...args) =>
  execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
  }).trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const a = "jenny-final-a",
  b = "jenny-final-b";
run(a, "open", base);
run(a, "fill", "#captain", "Captain A");
run(a, "select", ".connection-row select", "create");
run(a, "click", ".sail-button");
await wait(700);
const code = run(a, "get", "text", ".invite").match(/[A-Z2-9]{5}/)[0];
run(b, "open", base + "/?room=" + code);
run(b, "fill", "#captain", "Captain B");
run(b, "click", ".sail-button");
await wait(700);
assert.match(run(a, "get", "text", ".leaderboard"), /Captain B/);
assert.match(run(b, "get", "text", ".leaderboard"), /Captain A/);
run(a, "keydown", "w");
await wait(700);
run(a, "keyup", "w");
await wait(350);
const readPlayer = (session) =>
  JSON.parse(
    run(
      session,
      "eval",
      'document.querySelector(".map svg path[transform]").getAttribute("transform")',
    ),
  );
assert.equal(
  readPlayer(a),
  readPlayer(b),
  "both clients observe identical authoritative player position",
);
run(a, "click", ".battle-actions button:last-child");
const before = run(a, "get", "text", "[data-testid=timer]");
await wait(1500);
const after = run(a, "get", "text", "[data-testid=timer]");
assert.notEqual(before, after, "online menu must not pause");
assert.match(run(a, "get", "text", "[role=dialog]"), /联机对局仍在继续/);
run(a, "click", "button.close");
run(a, "screenshot", process.cwd() + "/artifacts/multiplayer-final-a.png");
run(b, "screenshot", process.cwd() + "/artifacts/multiplayer-final-b.png");
console.log(
  JSON.stringify({
    stage: "joined_and_synced",
    code,
    onlineMenu: [before, after],
  }),
);
for (let i = 0; i < 100; i++) {
  await wait(2000);
  const ended = run(a, "eval", 'Boolean(document.querySelector(".results"))');
  if (JSON.parse(ended)) break;
  if (i % 15 === 0)
    console.log(
      "Round in progress: " + run(a, "get", "text", "[data-testid=timer]"),
    );
}
const resultA = run(a, "get", "text", ".result-table"),
  resultB = run(b, "get", "text", ".result-table");
assert.equal(
  resultA,
  resultB,
  "both clients must settle with identical scores",
);
assert.equal(run(a, "get", "text", "[data-testid=timer]"), "00:00");
run(a, "screenshot", process.cwd() + "/artifacts/multiplayer-results.png");
const report = {
  passed: true,
  code,
  results: resultA,
  consoleA: run(a, "errors"),
  consoleB: run(b, "errors"),
};
writeFileSync(
  "artifacts/multiplayer-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
