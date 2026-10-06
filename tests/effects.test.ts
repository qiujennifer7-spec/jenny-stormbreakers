import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { OceanEffects } from "../src/effects";
test("sustained cannon fire and wakes reuse bounded GPU storage on mobile", () => {
  const scene = new THREE.Scene(),
    pool = new OceanEffects(scene);
  pool.setQuality(true, 1);
  const geometry = pool.geometry,
    material = pool.material;
  for (let i = 0; i < 10000; i++) {
    pool.burst({ id: i, type: i % 2 ? "hit" : "fire", x: 0, z: 0 }, true);
    pool.wake(0, 0, 0, 24);
  }
  assert.ok(pool.active <= 180);
  assert.equal(pool.geometry, geometry);
  assert.equal(pool.material, material);
  assert.equal(scene.children.length, 1);
  pool.update(3);
  assert.equal(pool.active, 0);
  pool.destroy();
  assert.equal(scene.children.length, 0);
});
