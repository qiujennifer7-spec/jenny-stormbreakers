import { test } from "node:test";
import assert from "node:assert/strict";
import { keyboardCode } from "../src/controls";
test("physical key code retains WASD layout-independent control", () => {
  assert.equal(keyboardCode({ code: "KeyW", key: "z" }), "KeyW");
  assert.equal(keyboardCode({ code: "Space", key: " " }), "Space");
});
test("browsers without KeyboardEvent.code use the key value", () => {
  assert.equal(keyboardCode({ code: "", key: "d" }), "KeyD");
  assert.equal(keyboardCode({ code: "Unidentified", key: "Q" }), "KeyQ");
  assert.equal(keyboardCode({ code: "", key: " " }), "Space");
  assert.equal(keyboardCode({ code: "", key: "Escape" }), "Escape");
  assert.equal(keyboardCode({ code: "", key: "Enter" }), "Enter");
});
