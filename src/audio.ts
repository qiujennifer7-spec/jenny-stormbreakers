import type { Event } from "../shared/game";

/** Synthesized, cached audio; bounded voices keep battle noise inexpensive on phones. */
export class OceanAudio {
  context?: AudioContext;
  master?: GainNode;
  ambient?: GainNode;
  volume = 0.35;
  muted = false;
  paused = false;
  voices = 0;
  noise?: AudioBuffer;
  counts: Record<string, number> = {};
  private ambientNodes: AudioNode[] = [];
  private lastEffect = new Map<string, number>();
  start() {
    if (!this.context) {
      const AudioConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioConstructor) return;
      try {
        this.context = new AudioConstructor();
      } catch {
        return;
      }
      const c = this.context;
      this.master = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 8;
      this.master.connect(limiter).connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = c.createBufferSource();
      noise.buffer = this.noise;
      noise.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 550;
      this.ambient = c.createGain();
      this.ambient.gain.value = 0.13;
      const swell = c.createOscillator();
      swell.frequency.value = 0.18;
      const modulation = c.createGain();
      modulation.gain.value = 0.06;
      swell.connect(modulation).connect(this.ambient.gain);
      noise.connect(filter).connect(this.ambient).connect(this.master);
      noise.start();
      swell.start();
      this.ambientNodes = [noise, filter, swell, modulation, limiter];
    }
    void this.context.resume().catch(() => {});
    this.setVolume(this.volume, this.muted);
    this.pause(this.paused);
  }
  setVolume(v: number, muted = false) {
    this.volume = v;
    this.muted = muted;
    const c = this.context;
    if (this.master && c)
      this.master.gain.setTargetAtTime(muted ? 0 : v, c.currentTime, 0.06);
  }
  pause(paused: boolean) {
    this.paused = paused;
    const c = this.context;
    if (c) {
      if (paused) void c.suspend().catch(() => {});
      else void c.resume().catch(() => {});
    }
    if (this.ambient && c)
      this.ambient.gain.setTargetAtTime(paused ? 0 : 0.13, c.currentTime, 0.08);
  }
  private tone(
    bus: AudioNode,
    frequency: number,
    end: number,
    duration: number,
    level: number,
    delay = 0,
    wave: OscillatorType = "sine",
  ) {
    const c = this.context!,
      now = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(frequency, now);
    o.frequency.exponentialRampToValueAtTime(end, now + duration);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.connect(g).connect(bus);
    o.start(now);
    o.stop(now + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private hiss(
    bus: AudioNode,
    duration: number,
    frequency: number,
    level: number,
    delay = 0,
    filterType: BiquadFilterType = "lowpass",
  ) {
    const c = this.context!,
      now = c.currentTime + delay,
      n = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    n.buffer = this.noise!;
    f.type = filterType;
    f.frequency.value = frequency;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(level, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    n.connect(f).connect(g).connect(bus);
    n.start(now, Math.random(), duration);
    n.onended = () => {
      n.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  effect(type: Event["type"], distance = 0, pan = 0) {
    const c = this.context;
    if (
      !c ||
      !this.master ||
      !this.noise ||
      this.muted ||
      this.paused ||
      c.state !== "running" ||
      this.voices >= 10
    )
      return;
    const now = c.currentTime;
    if (
      now - (this.lastEffect.get(type) ?? -1) <
      (type === "sink" ? 0.08 : 0.055)
    )
      return;
    this.lastEffect.set(type, now);
    this.voices++;
    this.counts[type] = (this.counts[type] || 0) + 1;
    const bus = c.createGain();
    bus.gain.value = Math.max(0.08, 1 - distance / 160) * 0.65;
    const stereo = c.createStereoPanner();
    stereo.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    bus.connect(stereo).connect(this.master);
    let duration = 1;
    if (type === "fire") {
      this.tone(bus, 115, 32, 0.6, 0.85);
      this.hiss(bus, 0.24, 1500, 0.65);
      this.hiss(bus, 0.65, 350, 0.15, 0.08);
    } else if (type === "hit") {
      this.tone(bus, 165, 42, 0.45, 0.65);
      this.hiss(bus, 0.5, 2400, 0.85);
      this.tone(bus, 420, 150, 0.12, 0.1, 0.02, "triangle");
    } else if (type === "sink") {
      duration = 2.6;
      this.tone(bus, 82, 21, 1.7, 0.6);
      for (let i = 0; i < 3; i++) {
        this.hiss(bus, 0.4, 850 - i * 150, 0.3, i * 0.25);
        this.tone(bus, 200 + i * 55, 50, 0.18, 0.1, i * 0.2, "sawtooth");
      }
      this.hiss(bus, 1.8, 1100, 0.6, 0.5);
    } else if (type === "loot") {
      duration = 0.65;
      this.tone(bus, 620, 620, 0.18, 0.24);
      this.tone(bus, 930, 930, 0.25, 0.18, 0.12);
    } else if (type === "splash") {
      duration = 0.7;
      this.hiss(bus, 0.6, 1800, 0.45);
      this.tone(bus, 75, 40, 0.18, 0.12);
    } else {
      duration = 0.8;
      this.hiss(bus, 0.7, 600, 0.22);
    }
    setTimeout(
      () => {
        bus.disconnect();
        stereo.disconnect();
        this.voices = Math.max(0, this.voices - 1);
      },
      (duration + 0.1) * 1000,
    );
  }
  destroy() {
    this.ambientNodes.forEach((n) => n.disconnect());
    this.master?.disconnect();
    void this.context?.close();
  }
}
