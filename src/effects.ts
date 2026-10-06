import * as THREE from "three";
import type { Event } from "../shared/game";
type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  kind: number;
};
/** One GPU draw call, fixed 480-slot pool. No per-particle geometry/material allocation. */
export class OceanEffects {
  readonly capacity = 480;
  limit = 480;
  particles: Particle[] = Array.from({ length: this.capacity }, () => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    max: 1,
    size: 0,
    kind: 0,
  }));
  cursor = 0;
  geometry = new THREE.BufferGeometry();
  position = new Float32Array(this.capacity * 3);
  data = new Float32Array(this.capacity * 3);
  material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
    attribute vec3 particleData; varying vec3 info; uniform float pixelRatio;
    void main(){info=particleData;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(particleData.x*pixelRatio*550./max(1.,-mv.z),1.,110.);}
  `,
    fragmentShader: `
    varying vec3 info;
    void main(){vec2 uv=gl_PointCoord-.5;float radius=length(uv)*2.;if(radius>1.||info.y<=0.)discard;
      float soft=pow(1.-radius,1.5);vec3 color=vec3(1.,.62,.17);float alpha=soft*info.y;
      if(info.z>.5&&info.z<1.5){color=vec3(.35,.40,.39);alpha=soft*info.y*.65;}
      else if(info.z>1.5&&info.z<2.5){color=vec3(.72,.88,.88);alpha=soft*info.y*.85;}
      else if(info.z>2.5&&info.z<3.5){color=vec3(.69,.88,.82);alpha=(smoothstep(.3,.65,radius)-smoothstep(.7,1.,radius))*info.y*.32;}
      else if(info.z>4.5){color=vec3(.69,.88,.82);alpha=soft*info.y*.34;}
      else if(info.z>3.5){color=vec3(1.,.80,.36);}
      gl_FragColor=vec4(color,alpha);
    }
  `,
  });
  points: THREE.Points;
  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.position, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "particleData",
      new THREE.BufferAttribute(this.data, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  setQuality(low: boolean, pixelRatio: number) {
    this.limit = low ? 180 : 480;
    this.material.uniforms.pixelRatio.value = pixelRatio;
    for (let i = this.limit; i < this.capacity; i++) {
      this.particles[i].life = 0;
      this.data[i * 3 + 1] = 0;
    }
  }
  add(
    x: number,
    y: number,
    z: number,
    kind: number,
    size: number,
    life: number,
    vx = 0,
    vy = 0,
    vz = 0,
  ) {
    const p = this.particles[this.cursor++ % this.limit];
    Object.assign(p, { x, y, z, kind, size, life, max: life, vx, vy, vz });
  }
  wake(x: number, z: number, a: number, speed: number) {
    this.add(
      x - Math.sin(a) * 9,
      0.6,
      z + Math.cos(a) * 9,
      5,
      3.5,
      1.5,
      -Math.sin(a) * speed * 0.05,
      0,
      Math.cos(a) * speed * 0.05,
    );
  }
  burst(e: Event, low: boolean) {
    const n = low ? 5 : 12;
    if (e.type === "fire") {
      this.add(e.x, 3, e.z, 0, 4, 0.13);
      for (let i = 0; i < n; i++)
        this.add(
          e.x,
          3,
          e.z,
          1,
          2,
          0.9,
          (Math.random() - 0.5) * 5,
          1 + Math.random() * 3,
          (Math.random() - 0.5) * 5,
        );
    } else if (e.type === "hit") {
      for (let i = 0; i < n; i++) {
        this.add(
          e.x,
          3,
          e.z,
          i < n / 3 ? 0 : 1,
          i < n / 3 ? 3 : 4,
          i < n / 3 ? 0.35 : 1.4,
          (Math.random() - 0.5) * 9,
          2 + Math.random() * 8,
          (Math.random() - 0.5) * 9,
        );
      }
      this.splash(e.x, e.z, n);
    } else if (e.type === "sink") {
      this.splash(e.x, e.z, n * 2);
      for (let i = 0; i < n; i++)
        this.add(
          e.x,
          2,
          e.z,
          1,
          5,
          2,
          (Math.random() - 0.5) * 8,
          1 + Math.random() * 4,
          (Math.random() - 0.5) * 8,
        );
    } else if (e.type === "splash") this.splash(e.x, e.z, n);
    else if (e.type === "loot") {
      for (let i = 0; i < n / 2; i++)
        this.add(
          e.x,
          2,
          e.z,
          4,
          1.5,
          0.8,
          (Math.random() - 0.5) * 4,
          4,
          (Math.random() - 0.5) * 4,
        );
    }
  }
  splash(x: number, z: number, n: number) {
    this.add(x, 0.5, z, 3, 8, 1.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add(
        x,
        1,
        z,
        2,
        1.4,
        1,
        Math.sin(a) * 7,
        5 + Math.random() * 8,
        Math.cos(a) * 7,
      );
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      p.life = Math.max(0, p.life - dt);
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.kind === 2) p.vy -= 20 * dt;
        const age = 1 - p.life / p.max;
        this.position.set([p.x, Math.max(0.4, p.y), p.z], i * 3);
        this.data.set(
          [
            p.size *
              (p.kind === 1 || p.kind === 3 || p.kind === 5 ? 1 + age * 2 : 1),
            p.life / p.max,
            p.kind,
          ],
          i * 3,
        );
      } else this.data[i * 3 + 1] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.particleData.needsUpdate = true;
  }
  clear() {
    this.particles.forEach((p) => (p.life = 0));
    this.data.fill(0);
  }
  get active() {
    return this.particles.filter((p) => p.life > 0).length;
  }
  destroy() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
