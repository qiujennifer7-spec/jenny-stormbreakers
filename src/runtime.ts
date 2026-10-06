import {
  createWorld,
  emptyInput,
  moveShip,
  stepWorld,
  type World,
  type Ship,
  type Input,
  type Mode,
  type Difficulty,
} from "../shared/game";
import { SeaScene } from "./scene";
import { OceanAudio } from "./audio";
export class GameRuntime {
  world = createWorld();
  playerId = "ship-0";
  input: Input = emptyInput();
  scene: SeaScene;
  audio = new OceanAudio();
  home = true;
  paused = false;
  online = false;
  room = "";
  socket?: WebSocket;
  predicted?: Ship;
  status = "";
  seq = 0;
  lastSend = 0;
  animation = 0;
  last = 0;
  accumulator = 0;
  pending: { seq: number; input: Input; dt: number }[] = [];
  actions = new Set<"left" | "right" | "boost" | "repair" | "supply">();
  renderClock = 0;
  onChange?: () => void;
  onDisconnect?: () => void;
  disposed = false;
  constructor(el: HTMLElement) {
    this.scene = new SeaScene(el);
    this.scene.onEvent = (t) => this.audio.effect(t);
    this.animation = requestAnimationFrame(this.frame);
  }
  start(mode: Mode, difficulty: Difficulty, name: string) {
    this.disconnect();
    this.world = createWorld(mode, difficulty);
    this.world.ships[0].name = name || "Jenny";
    this.playerId = "ship-0";
    this.home = false;
    this.paused = false;
    this.input = emptyInput();
    this.scene.lastEvent = 0;
    this.audio.start();
    this.accumulator = 0;
    this.onChange?.();
  }
  connect(
    kind: string,
    mode: Mode,
    difficulty: Difficulty,
    name: string,
    room = "",
  ) {
    this.disconnect();
    this.status = "connecting";
    this.onChange?.();
    const socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    this.socket = socket;
    const timeout = setTimeout(() => {
      if (this.status === "connecting") {
        this.status = "timeout";
        socket.close();
        this.onChange?.();
      }
    }, 25000);
    socket.onopen = () =>
      socket.send(
        JSON.stringify({ type: "join", kind, mode, difficulty, name, room }),
      );
    socket.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "error") {
        clearTimeout(timeout);
        this.status = msg.error;
        this.onChange?.();
        socket.close();
        return;
      }
      if (msg.type === "welcome") {
        clearTimeout(timeout);
        this.playerId = msg.playerId;
        this.room = msg.room;
        this.world = msg.world;
        this.predicted = {
          ...this.world.ships.find((s) => s.id === this.playerId)!,
        };
        this.home = false;
        this.online = true;
        this.paused = false;
        this.status = "connected";
        this.input = emptyInput();
        this.pending = [];
        this.scene.lastEvent = this.world.events.at(-1)?.id || 0;
        this.audio.start();
        this.onChange?.();
      }
      if (msg.type === "state" && this.online) {
        this.world = msg.world;
        const auth = this.world.ships.find((s) => s.id === this.playerId);
        if (auth) {
          const next = { ...auth };
          this.pending = this.pending.filter((p) => p.seq > auth.ack);
          for (const p of this.pending)
            moveShip(next, p.input, p.dt, this.world.ships);
          this.predicted = next;
        }
      }
    };
    socket.onclose = () => {
      clearTimeout(timeout);
      if (this.socket !== socket) return;
      if (this.online) {
        this.status = "disconnected";
        this.input = emptyInput();
        this.online = false;
        this.paused = true;
        this.onDisconnect?.();
      } else if (this.status === "connecting") this.status = "unavailable";
      this.onChange?.();
    };
    socket.onerror = () => {
      if (this.status === "connecting") {
        this.status = "unavailable";
        this.onChange?.();
      }
    };
  }
  disconnect() {
    const old = this.socket;
    this.socket = undefined;
    old?.close();
    this.online = false;
    this.predicted = undefined;
    this.pending = [];
    this.status = "";
    this.room = "";
  }
  stopInput() {
    this.actions.clear();
    this.input = emptyInput();
    if (this.predicted) this.predicted.speed = 0;
    if (this.online && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(
        JSON.stringify({
          type: "input",
          input: { ...this.input, seq: ++this.seq },
        }),
      );
  }
  menu(open: boolean) {
    this.stopInput();
    this.paused = !this.online && open;
    this.audio.pause(this.paused);
  }
  returnHome() {
    this.disconnect();
    this.home = true;
    this.paused = false;
    this.stopInput();
    this.audio.pause(true);
    this.world = createWorld();
    this.scene.lastEvent = 0;
  }
  frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000 || 0, 0.1);
    this.last = now;
    if (!this.home && !this.paused && !this.world.ended) {
      this.accumulator += dt;
      while (this.accumulator >= 0.025) {
        this.accumulator -= 0.025;
        for (const action of this.actions) this.input[action] = true;
        if (this.online) {
          const input = { ...this.input, seq: ++this.seq };
          if (this.predicted) {
            moveShip(this.predicted, input, 0.025, this.world.ships);
            this.predicted.boostTime = Math.max(
              0,
              this.predicted.boostTime - 0.025,
            );
          }
          this.pending.push({ seq: this.seq, input, dt: 0.025 });
          this.pending = this.pending.slice(-80);
          if (this.socket?.readyState === WebSocket.OPEN)
            this.socket.send(JSON.stringify({ type: "input", input }));
        } else {
          const player = this.world.ships.find((s) => s.id === this.playerId)!;
          player.input = { ...this.input };
          stepWorld(this.world, 0.025);
        }
        for (const action of this.actions) this.input[action] = false;
        this.actions.clear();
      }
    }
    if (!this.paused) this.renderClock += dt;
    this.scene.render(
      this.world,
      this.playerId,
      this.renderClock,
      this.home,
      this.online ? this.predicted : undefined,
    );
    this.animation = requestAnimationFrame(this.frame);
  };
  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.animation);
    this.disconnect();
    this.scene.destroy();
    this.audio.context?.close();
  }
}
