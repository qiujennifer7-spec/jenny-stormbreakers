import { OceanAudio } from "./audio";
import type { Event } from "../shared/game";
const audio = new OceanAudio();
let analyser: AnalyserNode | undefined;
let data: Float32Array<ArrayBuffer> | undefined;
let peak = 0;
let current = "sea";
function start() {
  audio.paused = false;
  audio.start();
  if (!analyser && audio.context) {
    analyser = audio.context.createAnalyser();
    analyser.fftSize = 2048;
    audio.master!.connect(analyser);
    data = new Float32Array(analyser.fftSize);
  }
  peak = 0;
}
const choices: [string, string][] = [
  ["sea", "海浪"],
  ["fire", "开炮"],
  ["hit", "命中爆炸"],
  ["sink", "船只沉没"],
  ["splash", "炮弹落水"],
  ["loot", "宝箱与补给"],
];
for (const [type, label] of choices) {
  const button = document.createElement("button");
  button.textContent = label;
  button.dataset.effect = type;
  button.onclick = () => {
    start();
    current = type;
    if (type !== "sea") audio.effect(type as Event["type"]);
  };
  document.querySelector("#controls")!.append(button);
}
(document.querySelector("#volume") as HTMLInputElement).oninput = (e) =>
  audio.setVolume(Number((e.target as HTMLInputElement).value), audio.muted);
document.querySelector<HTMLButtonElement>("#mute")!.onclick = (e) => {
  audio.setVolume(audio.volume, !audio.muted);
  (e.target as HTMLButtonElement).textContent = audio.muted
    ? "开启声音"
    : "静音";
};
document.querySelector<HTMLButtonElement>("#pause")!.onclick = (e) => {
  audio.pause(!audio.paused);
  (e.target as HTMLButtonElement).textContent = audio.paused
    ? "继续声音"
    : "暂停声音";
};
setInterval(() => {
  let rms = 0;
  if (analyser && data && audio.context?.state === "running") {
    analyser.getFloatTimeDomainData(data);
    for (const v of data) rms += v * v;
    rms = Math.sqrt(rms / data.length);
    peak = Math.max(peak, rms);
  }
  const stats = {
    effect: current,
    state: audio.context?.state || "not_started",
    muted: audio.muted,
    paused: audio.paused,
    rms: Number(rms.toFixed(5)),
    peakRms: Number(peak.toFixed(5)),
    voices: audio.voices,
    counts: audio.counts,
  };
  const meter = document.querySelector<HTMLOutputElement>("#meter")!;
  meter.dataset.audioStats = JSON.stringify(stats);
  meter.textContent = `音频状态：${stats.state}\n输出 RMS：${stats.rms}\n本次峰值 RMS：${stats.peakRms}\n同时播放：${stats.voices} / 10\n${JSON.stringify(stats.counts)}`;
}, 50);
window.addEventListener("pagehide", () => audio.destroy(), { once: true });
