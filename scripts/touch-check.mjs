import { execFileSync } from "node:child_process";
import { WebSocket } from "ws";
import assert from "node:assert/strict";
const session = "jenny-touch";
const run = (...args) =>
  execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
  }).trim();
const read = (code) => JSON.parse(run("eval", code));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
run("open", process.env.TEST_URL || "http://127.0.0.1:3417");
run("set", "viewport", "390", "844");
if (process.env.TEST_ONLINE) run("select", ".connection-row select", "create");
run("click", ".sail-button");
await wait(800);
const getPos = () =>
  read(
    'document.querySelector(\'.map svg path[fill="#ffe0a0"]\').getAttribute("transform")',
  );
const initial = getPos();
const label = read(
  '(()=>{const r=document.querySelector(".ship-label.mine").getBoundingClientRect();return{x:r.x+r.width/2,y:r.bottom+100}})()',
);
const stream = JSON.parse(run("stream", "status", "--json"));
const ws = new WebSocket(`ws://127.0.0.1:${stream.data.port}`);
await new Promise((r) => ws.on("open", r));
ws.send(JSON.stringify({ type: "config", maxFps: 1 }));
const touch = (eventType, touchPoints) =>
  ws.send(JSON.stringify({ type: "input_touch", eventType, touchPoints }));
touch("touchCancel", []);
await wait(80);
const first = { x: label.x, y: label.y, id: 1 };
touch("touchStart", [first]);
await wait(70);
const moving = { ...first, x: first.x + 65, y: first.y - 65 };
touch("touchMove", [moving]);
await wait(process.env.TEST_ONLINE ? 600 : 200);
const after = getPos();
assert.notEqual(initial, after, "touch must move ship");
const button = read(
  '(()=>{const r=document.querySelectorAll(".skill.cannon")[1];const b=r.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()',
);
touch("touchStart", [moving, { ...button, id: 2 }]);
await wait(process.env.TEST_ONLINE ? 600 : 200);
const cooldown = read(
  'document.querySelectorAll(".skill.cannon")[1].innerText',
);
assert.match(cooldown, /[12]\.\ds/, "second finger must fire");
touch("touchEnd", [moving]);
await wait(100);
touch("touchEnd", []);
await wait(process.env.TEST_ONLINE ? 350 : 100);
const stopped = getPos();
await wait(450);
assert.equal(getPos(), stopped, "release must stop immediately");
assert.equal(read("window.scrollY"), 0, "drag must not scroll");
run("screenshot", process.cwd() + "/artifacts/touch-verified.png");
run("click", ".battle-actions button:last-child");
const timer = run("get", "text", "[data-testid=timer]");
await wait(1100);
if (process.env.TEST_ONLINE)
  assert.notEqual(
    run("get", "text", "[data-testid=timer]"),
    timer,
    "online menu continues",
  );
else
  assert.equal(
    run("get", "text", "[data-testid=timer]"),
    timer,
    "solo menu freezes timer",
  );
run("click", "button.close");
run("set", "viewport", "844", "390");
assert.equal(read("document.documentElement.scrollWidth>innerWidth"), false);
run("screenshot", process.cwd() + "/artifacts/touch-landscape.png");
run("set", "viewport", "768", "1024");
assert.equal(read("document.documentElement.scrollWidth>innerWidth"), false);
run("screenshot", process.cwd() + "/artifacts/ipad-portrait.png");
console.log(
  JSON.stringify(
    {
      passed: true,
      initial,
      after,
      stopped,
      cooldown,
      pause: timer,
      viewports: ["390x844", "844x390", "768x1024"],
    },
    null,
    2,
  ),
);
ws.close();
