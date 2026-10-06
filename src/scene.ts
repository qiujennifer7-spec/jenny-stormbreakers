import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { OceanEffects } from "./effects";
import { ISLANDS, type World, type Ship, type Event } from "../shared/game";
const gold = 0xdcb777,
  cream = 0xf3e6c7;
const mat = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
function mesh(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function beam(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  m: THREE.Material,
) {
  const d = b.clone().sub(a);
  const o = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), m, parent);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
function canvasTexture(
  draw: (x: CanvasRenderingContext2D) => void,
  size = 512,
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function sailTexture() {
  return canvasTexture((x) => {
    x.fillStyle = "#f2e8cb";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 3) {
      x.strokeStyle = i % 6 ? "rgba(114,91,54,.05)" : "rgba(255,255,255,.2)";
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 512);
      x.stroke();
      x.beginPath();
      x.moveTo(0, i);
      x.lineTo(512, i);
      x.stroke();
    }
    x.strokeStyle = "#b4a078";
    x.lineWidth = 2;
    x.strokeRect(15, 15, 482, 482);
    for (let i = 0; i < 512; i += 12) {
      x.fillStyle = "#ab977344";
      x.fillRect(23, i, 2, 5);
      x.fillRect(487, i, 2, 5);
    }
    // Tiny nautical seal: sail, wave and elegant wordmark.
    x.save();
    x.translate(256, 292);
    x.strokeStyle = x.fillStyle = "#264b51";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, -20, 47, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.moveTo(-3, -52);
    x.lineTo(-3, -8);
    x.lineTo(-31, -8);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(3, -48);
    x.lineTo(27, -11);
    x.lineTo(3, -11);
    x.closePath();
    x.stroke();
    x.beginPath();
    x.moveTo(-31, -3);
    x.quadraticCurveTo(0, 17, 31, -3);
    x.stroke();
    x.fillStyle = "#f2e8cb";
    x.fillRect(-56, 30, 112, 30);
    x.fillStyle = "#264b51";
    x.font = "italic 33px Georgia";
    x.textAlign = "center";
    x.fillText("Jenny", 0, 55);
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(-25, 66);
    x.quadraticCurveTo(0, 77, 25, 66);
    x.stroke();
    x.restore();
  });
}
function woodTexture() {
  const texture = canvasTexture((x) => {
    x.fillStyle = "#896044";
    x.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      x.fillStyle = row % 2 ? "#80573e" : "#946a49";
      x.fillRect(0, row * 64, 512, 62);
      for (let i = 0; i < 15; i++) {
        x.strokeStyle = "rgba(39,25,17,.16)";
        x.beginPath();
        x.moveTo(0, row * 64 + i * 4);
        for (let n = 0; n <= 8; n++)
          x.lineTo(n * 64, row * 64 + i * 4 + Math.sin(n * 1.8 + i) * 1.7);
        x.stroke();
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
/** Bake stationary parts by material; six ships require ~36 draws rather than hundreds. */
function batchMeshes(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
      const g = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      g.applyMatrix4(
        new THREE.Matrix4()
          .copy(root.matrixWorld)
          .invert()
          .multiply(o.matrixWorld),
      );
      let geometries = batches.get(o.material);
      if (!geometries) {
        geometries = [];
        batches.set(o.material, geometries);
      }
      geometries.push(g);
      sources.push(o);
    }
  });
  for (const o of sources) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const [m, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    if (geometry) mesh(geometry, m, root);
    geometries.forEach((g) => g.dispose());
  }
}
const colors = [0xe0b66a, 0x789caf, 0xc26a56, 0x799989, 0xba95b6, 0x8ba6cc];
export function buildShip(index = 0) {
  const root = new THREE.Group();
  const wood = mat(0x664432),
    dark = mat(0x302b26),
    deck = mat(0xb38a58),
    trim = mat(colors[index % 6]);
  wood.map = woodTexture();
  wood.color.set(0xffffff);
  const shape = new THREE.Shape();
  shape.moveTo(0, -10);
  shape.bezierCurveTo(3, -8, 4.2, -3, 4, 3);
  shape.lineTo(3, 7);
  shape.quadraticCurveTo(0, 8, -3, 7);
  shape.lineTo(-4, 3);
  shape.bezierCurveTo(-4.2, -3, -3, -8, 0, -10);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 0.7,
    bevelSize: 0.55,
    bevelSegments: 2,
    steps: 1,
  });
  geom.rotateX(Math.PI / 2);
  mesh(geom, wood, root, 0, 3.6, 0);
  const dg = new THREE.ShapeGeometry(shape);
  dg.rotateX(Math.PI / 2);
  mesh(dg, deck, root, 0, 3.67, 0);
  for (let z = -7; z < 7; z += 1.3)
    mesh(
      new THREE.BoxGeometry(z < -5 ? 4 : 6.5, 0.04, 0.05),
      dark,
      root,
      0,
      3.73,
      z,
    );
  for (const side of [-1, 1]) {
    for (let z = -5; z <= 5; z += 2.5) {
      const cannon = mesh(
        new THREE.CylinderGeometry(0.42, 0.53, 2.2, 8),
        dark,
        root,
        side * 3.7,
        3,
        z,
      );
      cannon.rotation.z = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.15, 0.4, 1), trim, root, side * 4.1, 1.8, z);
    }
    beam(
      root,
      new THREE.Vector3(side * 3, 4.6, 6),
      new THREE.Vector3(side * 3.1, 4.6, -5),
      0.13,
      trim,
    );
  }
  mesh(new THREE.BoxGeometry(5.5, 1.7, 3.2), wood, root, 0, 4.3, 5);
  mesh(new THREE.BoxGeometry(5.8, 0.25, 3.5), deck, root, 0, 5.25, 5);
  mesh(new THREE.BoxGeometry(3.5, 0.15, 0.7), trim, root, 0, 4.5, 6.65);
  const sailMat = new THREE.MeshStandardMaterial({
    map: sailTexture(),
    side: THREE.DoubleSide,
    roughness: 1,
  });
  for (const [j, z] of [-5, 0, 5].entries()) {
    const h = j === 1 ? 20 : 17;
    mesh(
      new THREE.CylinderGeometry(0.18, 0.38, h, 8),
      wood,
      root,
      0,
      h / 2 + 3,
      z,
    );
    for (let k = 0; k < 2; k++) {
      const sy = 8 + k * 6;
      const width = k === 0 ? 9 : 7;
      beam(
        root,
        new THREE.Vector3(-width / 2, sy + 4, z),
        new THREE.Vector3(width / 2, sy + 4, z),
        0.14,
        wood,
      );
      const g = new THREE.PlaneGeometry(width, 5, 10, 8);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setZ(i, Math.sin((p.getX(i) / width + 0.5) * Math.PI) * 1.3);
      g.computeVertexNormals();
      mesh(g, sailMat, root, 0, sy + 1.5, z);
    }
    beam(
      root,
      new THREE.Vector3(0, h + 2, z),
      new THREE.Vector3(-3.4, 3.7, z + 2),
      0.045,
      dark,
    );
    beam(
      root,
      new THREE.Vector3(0, h + 2, z),
      new THREE.Vector3(3.4, 3.7, z + 2),
      0.045,
      dark,
    );
    const flag = mesh(
      new THREE.PlaneGeometry(2.6, 1.1),
      trim,
      root,
      1.3,
      h + 2.5,
      z,
    );
    flag.rotation.y = 0.2;
  }
  beam(
    root,
    new THREE.Vector3(0, 4, -7),
    new THREE.Vector3(0, 6, -14),
    0.18,
    wood,
  );
  batchMeshes(root);
  return root;
}
export class SeaScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, 0.5, 1800);
  ships = new Map<string, THREE.Group>();
  loot = new Map<number, THREE.Group>();
  shots = new Map<number, THREE.Mesh>();
  effects: OceanEffects;
  wakeTimers = new Map<string, number>();
  frameMs = 16.7;
  slowFrames = 0;
  adaptiveScale = 1;
  performanceClock = 0;
  lastPerformanceTime = performance.now();
  renderCount = 0;
  cloudTime = { value: 0 };
  water: THREE.Mesh;
  ring: THREE.Mesh;
  focus = new THREE.Vector3();
  home = true;
  lastEvent = 0;
  lastTime = 0;
  quality = "high";
  resizeObserver: ResizeObserver;
  ray = new THREE.Raycaster();
  plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  onEvent?: (event: Event, distance: number, pan: number) => void;
  constructor(public container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "3D ocean battlefield");
    this.scene.background = new THREE.Color(0x8bacae);
    this.scene.fog = new THREE.FogExp2(0x8bacae, 0.0019);
    this.scene.add(new THREE.HemisphereLight(0xd6e8e1, 0x18343a, 2.5));
    const sun = new THREE.DirectionalLight(0xffe5b1, 3);
    sun.position.set(-100, 180, -120);
    this.scene.add(sun);
    this.effects = new OceanEffects(this.scene);
    const uniforms = { time: { value: 0 }, storm: { value: 0 } };
    const waterMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float time;uniform float storm;varying vec3 wp;varying vec3 norm;
        void main(){vec3 p=position;float a=p.x*.065+p.z*.025+time*.9;float b=p.z*.082-p.x*.018+time*.65;float amp=1.+storm*.65;
        p.y=(sin(a)*.7+cos(b)*.42)*amp;norm=normalize(vec3((-cos(a)*.0455-sin(b)*.00756)*amp,1.,(-cos(a)*.0175+sin(b)*.03444)*amp));
        wp=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `
        uniform float time;uniform float storm;varying vec3 wp;varying vec3 norm;
        void main(){vec3 view=normalize(cameraPosition-wp);vec3 n=normalize(norm+vec3(sin(wp.z*.65+wp.x*.27+time)*.032,0.,cos(wp.x*.54-wp.z*.37-time)*.028));
        float fres=pow(1.-max(dot(n,view),0.),3.);vec3 reflected=reflect(-view,n);
        float cloud=smoothstep(.55,.83,sin(reflected.x*18.+time*.013)*.2+cos(reflected.z*13.)*.25+.5);
        vec3 sky=mix(vec3(.30,.53,.58),vec3(.77,.83,.79),cloud);
        float sun=pow(max(dot(reflect(-normalize(vec3(-.4,1.,-.7)),n),view),0.),110.);
        float swell=sin(wp.x*.065+wp.z*.025+time*.9);vec3 col=mix(vec3(.013,.13,.18),vec3(.045,.30,.32),.5+swell*.2);
        col=mix(col,sky,fres*.62);col+=sun*vec3(.95,.78,.48);
        float lace=.5+.5*sin(wp.x*.42-wp.z*.31+time*.55);
        float foam=smoothstep(.96,1.,swell)*lace;col+=vec3(.04,.075,.07)*foam;
        col*=1.-storm*.2;gl_FragColor=vec4(col,1.);}`,
    });
    const waterGeo = new THREE.PlaneGeometry(2200, 2200, 160, 160);
    waterGeo.rotateX(-Math.PI / 2);
    this.water = mesh(waterGeo, waterMat, this.scene);
    const detailGeo = new THREE.PlaneGeometry(400, 400, 100, 100);
    detailGeo.rotateX(-Math.PI / 2);
    mesh(detailGeo, waterMat, this.scene, 0, 0.025, 0);
    for (const island of ISLANDS) {
      const group = new THREE.Group();
      group.position.set(island.x, -0.6, island.z);
      this.scene.add(group);
      const sand = mesh(
        new THREE.CylinderGeometry(island.r * 0.87, island.r, 3, 12),
        mat(0xc6b68a),
        group,
        0,
        0,
        0,
      );
      sand.rotation.y = 0.3;
      mesh(
        new THREE.ConeGeometry(island.r * 0.83, 18, 7),
        mat(0x496c5b),
        group,
        0,
        8,
        0,
      );
      mesh(
        new THREE.DodecahedronGeometry(island.r * 0.45, 0),
        mat(0x68756c),
        group,
        -3,
        7,
        2,
      );
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4,
          x = Math.sin(a) * island.r * 0.65,
          z = Math.cos(a) * island.r * 0.65;
        const trunk = mat(0x726045);
        beam(
          group,
          new THREE.Vector3(x, 1, z),
          new THREE.Vector3(x + 1, 11, z),
          0.5,
          trunk,
        );
        for (let k = 0; k < 5; k++) {
          const leaf = mesh(
            new THREE.ConeGeometry(2, 7, 3),
            mat(0x315b4a),
            group,
            x + Math.sin(k * 1.25) * 2,
            10,
            z + Math.cos(k * 1.25) * 2,
          );
          leaf.rotation.z = Math.sin(k * 1.25) * 1.1;
          leaf.rotation.x = Math.cos(k * 1.25) * 1.1;
        }
      }
      const materials = new Map<string, THREE.Material>();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshStandardMaterial;
          const key = m.color.getHexString();
          if (materials.has(key)) {
            m.dispose();
            o.material = materials.get(key)!;
          } else materials.set(key, m);
        }
      });
      batchMeshes(group);
    }
    const sky = mesh(
      new THREE.SphereGeometry(1200, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: `varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec3 direction;void main(){float height=max(0.,direction.y);vec3 c=mix(vec3(.59,.72,.71),vec3(.13,.35,.46),pow(height,.6));float sun=pow(max(dot(direction,normalize(vec3(-.4,.8,-.6))),0.),220.);gl_FragColor=vec4(c+sun*vec3(.55,.4,.16),1.);}`,
      }),
      this.scene,
    );
    sky.frustumCulled = false;
    const clouds = new THREE.Group();
    this.scene.add(clouds);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xe5e6d6,
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      g.position.set(
        Math.sin(i * 2.4) * 450,
        45 + (i % 3) * 13,
        Math.cos(i * 2.4) * 450,
      );
      for (let k = 0; k < 4; k++) {
        const c = mesh(
          new THREE.IcosahedronGeometry(16, 1),
          cloudMat,
          g,
          k * 18,
          (k % 2) * 4,
          0,
        );
        c.scale.set(1.7, 0.55, 1);
      }
      clouds.add(g);
    }
    batchMeshes(clouds);
    const rgeo = new THREE.RingGeometry(179, 180, 128);
    rgeo.rotateX(-Math.PI / 2);
    mesh(
      rgeo,
      new THREE.MeshBasicMaterial({
        color: 0xc5b989,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
      this.scene,
      0,
      0.7,
      0,
    );
    const ringGeo = new THREE.RingGeometry(1, 1.025, 100);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x8aace4,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
      this.scene,
      0,
      1,
      0,
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  setQuality(q: string) {
    this.quality = q;
    this.adaptiveScale = 1;
    this.slowFrames = 0;
    this.applyResolution();
  }
  applyResolution() {
    const max =
      this.quality === "low"
        ? 1
        : matchMedia("(pointer:coarse)").matches
          ? 1.35
          : 1.8;
    const ratio = Math.min(devicePixelRatio, max) * this.adaptiveScale;
    this.renderer.setPixelRatio(ratio);
    this.effects.setQuality(this.quality === "low", ratio);
  }
  observeFrame(ms: number) {
    if (ms <= 0 || ms > 120) return;
    this.frameMs = this.frameMs * 0.95 + ms * 0.05;
    if (this.frameMs > 25) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 150 && this.adaptiveScale > 0.7) {
      this.adaptiveScale = Math.max(0.7, this.adaptiveScale - 0.15);
      this.slowFrames = 0;
      this.applyResolution();
    }
  }
  project(s: { x: number; z: number }, y = 2) {
    const v = new THREE.Vector3(s.x, y, s.z).project(this.camera);
    return {
      x: ((v.x + 1) * this.container.clientWidth) / 2,
      y: ((1 - v.y) * this.container.clientHeight) / 2,
    };
  }
  ground(x: number, y: number) {
    const rect = this.container.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        (-(y - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.plane, p)
      ? { x: p.x, z: p.z }
      : null;
  }
  render(
    w: World,
    playerId: string,
    time: number,
    home = false,
    predicted?: Ship,
  ) {
    const dt = Math.min(0.05, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.home = home;
    const player =
      predicted || w.ships.find((s) => s.id === playerId) || w.ships[0];
    const t = home ? time : w.elapsed;
    (this.water.material as THREE.ShaderMaterial).uniforms.time.value = t;
    (this.water.material as THREE.ShaderMaterial).uniforms.storm.value =
      w.mode === "storm" ? 1 : 0;
    for (const s0 of w.ships) {
      const s = s0.id === playerId ? player : s0;
      let group = this.ships.get(s.id);
      if (!group) {
        group = buildShip(w.ships.indexOf(s0));
        this.scene.add(group);
        this.ships.set(s.id, group);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(6.3, 6.55, 48),
          new THREE.MeshBasicMaterial({
            color: s.id === playerId ? gold : colors[w.ships.indexOf(s)],
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.name = "selection";
        group.add(ring);
      }
      group.visible = !home || s.id === playerId;
      if (home) {
        group.position.set(0, Math.sin(t) * 0.5, 0);
        group.rotation.set(
          Math.sin(t * 0.7) * 0.025,
          -0.4 + Math.sin(t * 0.12) * 0.12,
          Math.cos(t * 0.8) * 0.025,
        );
      } else {
        group.position.set(
          s.x,
          s.dead > 0
            ? -((5 - s.dead) * 3)
            : Math.sin(t * 1.2 + s.x * 0.08) * 0.48,
          s.z,
        );
        group.rotation.set(
          Math.sin(t + s.z * 0.06) * 0.028,
          -s.a,
          Math.cos(t * 0.8 + s.x * 0.06) * 0.025 +
            (s.dead > 0 ? (5 - s.dead) * 0.12 : 0),
        );
        group.visible = s.dead === 0 || s.dead > 1.5;
      }
      const ring = group.getObjectByName("selection")!;
      ring.position.y = home ? -1 : -group.position.y + 0.7;
      ring.visible = !home;
      (ring as THREE.Mesh).material instanceof THREE.MeshBasicMaterial &&
        (
          ring as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        ).material.color.set(
          s.id === playerId ? gold : colors[w.ships.indexOf(s)],
        );
      const wakeTime = (this.wakeTimers.get(s.id) || 0) + dt;
      if (
        !home &&
        Math.abs(s.speed) > 1 &&
        s.dead === 0 &&
        dt > 0 &&
        wakeTime > (this.quality === "low" ? 0.15 : 0.08)
      ) {
        this.effects.wake(s.x, s.z, s.a, s.speed);
        this.wakeTimers.set(s.id, 0);
      } else this.wakeTimers.set(s.id, wakeTime);
    }
    for (const item of w.loot) {
      let g = this.loot.get(item.id);
      if (!g) {
        g = new THREE.Group();
        this.scene.add(g);
        this.loot.set(item.id, g);
        mesh(
          new THREE.BoxGeometry(3.2, 2.5, 2.4),
          mat(item.kind === "treasure" ? 0x8b5b32 : 0xc0ded0),
          g,
          0,
          1.5,
          0,
        );
        for (const x of [-1, 1])
          mesh(new THREE.BoxGeometry(0.28, 2.6, 2.5), mat(gold), g, x, 1.5, 0);
        const halo = mesh(
          new THREE.RingGeometry(3.1, 3.4, 24),
          new THREE.MeshBasicMaterial({
            color: item.kind === "treasure" ? gold : 0xa2d8c3,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
          }),
          g,
          0,
          0.8,
          0,
        );
        halo.rotation.x = -Math.PI / 2;
      }
      g.visible = !home;
      g.position.set(item.x, Math.sin(t * 2 + item.id) * 0.4, item.z);
      g.rotation.y = t * 0.3;
    }
    for (const [id, g] of this.loot)
      if (!w.loot.some((l) => l.id === id)) {
        this.disposeObject(g);
        this.loot.delete(id);
      }
    for (const shot of w.shots) {
      let m = this.shots.get(shot.id);
      if (!m) {
        m = mesh(
          new THREE.SphereGeometry(0.7, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffd18c }),
          this.scene,
        );
        this.shots.set(shot.id, m);
      }
      m.position.set(shot.x, 3, shot.z);
    }
    for (const [id, m] of this.shots)
      if (!w.shots.some((b) => b.id === id)) {
        this.disposeObject(m);
        this.shots.delete(id);
      }
    if (!home)
      for (const e of w.events)
        if (e.id > this.lastEvent) {
          const distance = Math.hypot(e.x - player.x, e.z - player.z);
          if (distance < 180) {
            this.effects.burst(e, this.quality === "low");
            this.onEvent?.(e, distance, (e.x - player.x) / 90);
          }
        }
    this.lastEvent = w.events.at(-1)?.id || 0;
    this.effects.points.visible = !home;
    this.effects.update(dt);
    this.ring.visible = !home && w.mode === "storm";
    this.ring.scale.setScalar(w.stormRadius);
    if (home) {
      this.camera.position.set(42, 27, 48);
      this.camera.lookAt(-6, 9, 0);
    } else {
      const portrait = this.camera.aspect < 0.8;
      this.focus.set(player.x, 0, player.z);
      this.camera.position.set(
        player.x,
        portrait ? 120 : 94,
        player.z + (portrait ? 94 : 76),
      );
      this.camera.lookAt(player.x, 0, player.z - 9);
    }
    this.renderer.render(this.scene, this.camera);
    const performanceTime = performance.now();
    this.performanceClock +=
      (performanceTime - this.lastPerformanceTime) / 1000;
    this.lastPerformanceTime = performanceTime;
    this.renderCount++;
    if (this.performanceClock > 1) {
      const canvas = this.renderer.domElement;
      canvas.dataset.renderStats = JSON.stringify({
        fps: Math.round(this.renderCount / this.performanceClock),
        frameMs: Math.round(this.frameMs * 10) / 10,
        drawCalls: this.renderer.info.render.calls,
        geometries: this.renderer.info.memory.geometries,
        particles: this.effects.active,
        particleLimit: this.effects.limit,
        pixelRatio: this.renderer.getPixelRatio(),
        adaptiveScale: this.adaptiveScale,
      });
      this.performanceClock = 0;
      this.renderCount = 0;
    }
  }
  disposeObject(obj: THREE.Object3D) {
    obj.removeFromParent();
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.effects.destroy();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
