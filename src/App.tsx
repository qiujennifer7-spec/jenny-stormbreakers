import { useEffect, useRef, useState } from "react";
import { GameRuntime } from "./runtime";
import { keyboardCode } from "./controls";
import {
  ISLANDS,
  standings,
  type Mode,
  type Difficulty,
  type Ship,
} from "../shared/game";
const modes: Mode[] = ["battle", "storm", "treasure"];
const texts = {
  zh: {
    battle: "自由海战",
    storm: "风暴生存",
    treasure: "宝藏争夺",
    practice: "人机练习",
    match: "自动匹配",
    create: "创建房间",
    join: "房间码加入",
    sail: "扬帆出航",
    name: "船长昵称",
    settings: "航行设置",
    guide: "航海指南",
    back: "返回港湾",
    resume: "继续航行",
    pause: "已暂停航行",
    live: "联机对局仍在继续",
    health: "船体完整度",
    score: "积分",
    left: "左舷齐射",
    right: "右舷齐射",
    boost: "破风冲刺",
    repair: "船体修复",
    supply: "紧急补给",
    ready: "就绪",
    captain: "船长",
    difficulty: "电脑难度",
    quality: "画面质量",
    volume: "音量",
    easy: "见习",
    normal: "水手",
    hard: "船长",
    high: "精致",
    low: "流畅",
    room: "房间码",
    menu: "菜单",
    muted: "开启声音",
    sound: "静音",
    remaining: "航程倒计时",
    results: "本次航程已结束",
    again: "再航一局",
    winner: "本局优胜",
    kills: "击沉",
    respawn: "正在救援",
    seconds: "秒后重生",
    subtitle: "扬起风帆，把地平线留在身后。",
    choose: "选择你的航程",
    tag: "三分钟，一片海，无限可能。",
    copied: "已复制",
    copy: "复制邀请",
    connecting: "正在连接船队…",
    unavailable: "无法连接服务器，请稍后重试。",
    timeout: "服务器唤醒时间较长，请重试。",
    disconnected: "连接已断开，请返回港湾重新加入。",
    not_found: "房间不存在或已经结束。",
    full: "房间已满，最多 6 名真人。",
    invalid: "请求无效，请重试。",
  },
  en: {
    battle: "Open waters",
    storm: "Storm survival",
    treasure: "Treasure hunt",
    practice: "Solo practice",
    match: "Quick match",
    create: "Create room",
    join: "Join with code",
    sail: "Set sail",
    name: "Captain name",
    settings: "Voyage settings",
    guide: "Captain’s handbook",
    back: "Return to port",
    resume: "Resume voyage",
    pause: "Voyage paused",
    live: "Online battle is still running",
    health: "Hull integrity",
    score: "Score",
    left: "Port broadside",
    right: "Starboard",
    boost: "Wind rush",
    repair: "Repair hull",
    supply: "Resupply",
    ready: "Ready",
    captain: "Captain",
    difficulty: "AI difficulty",
    quality: "Graphics",
    volume: "Volume",
    easy: "Cadet",
    normal: "Sailor",
    hard: "Captain",
    high: "Detailed",
    low: "Performance",
    room: "Room code",
    menu: "Menu",
    muted: "Unmute",
    sound: "Mute",
    remaining: "Time remaining",
    results: "Voyage complete",
    again: "Sail again",
    winner: "Top captain",
    kills: "Sunk",
    respawn: "Rescue underway",
    seconds: "seconds to respawn",
    subtitle: "Raise your sails. Leave the horizon behind.",
    choose: "Choose your voyage",
    tag: "Three minutes. One ocean. Your story.",
    copied: "Copied",
    copy: "Copy invite",
    connecting: "Connecting to the fleet…",
    unavailable: "Server unavailable. Please try again.",
    timeout: "Server is waking up. Please try again.",
    disconnected: "Connection lost. Return to port and rejoin.",
    not_found: "Room does not exist or has ended.",
    full: "Room is full. Maximum 6 players.",
    invalid: "Invalid request. Please retry.",
  },
};
function Compass({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth=".7" />
      <circle cx="40" cy="40" r="25" stroke="currentColor" strokeWidth=".4" />
      <path
        d="M40 3L47 33L77 40L47 47L40 77L33 47L3 40L33 33Z"
        stroke="currentColor"
      />
      <path
        d="M40 13L40 40L33 33Z M67 40L40 40L47 33Z M40 67L40 40L47 47Z M13 40L40 40L33 47Z"
        fill="currentColor"
      />
      <circle cx="40" cy="40" r="3" fill="currentColor" />
    </svg>
  );
}
function readSettings() {
  try {
    return JSON.parse(localStorage.getItem("jenny-settings") || "{}");
  } catch {
    return {};
  }
}
export default function App() {
  const saved = useRef(readSettings()).current;
  const [lang, setLang] = useState<"zh" | "en">(saved.lang || "zh");
  const [name, setName] = useState(saved.name || "Jenny");
  const [mode, setMode] = useState<Mode>("battle");
  const [difficulty, setDifficulty] = useState<Difficulty>(
    saved.difficulty || "normal",
  );
  const [quality, setQuality] = useState(
    saved.quality || (matchMedia("(pointer:coarse)").matches ? "low" : "high"),
  );
  const [volume, setVolume] = useState(saved.volume ?? 0.35);
  const [muted, setMuted] = useState(saved.muted || false);
  const [kind, setKind] = useState(
    new URLSearchParams(location.search).has("room") ? "join" : "practice",
  );
  const [room, setRoom] = useState(
    new URLSearchParams(location.search).get("room") || "",
  );
  const [modal, setModal] = useState<"settings" | "guide" | "menu" | null>(
    null,
  );
  const [home, setHome] = useState(true);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [, refresh] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const drag = useRef<{ id: number; offsetX: number; offsetZ: number } | null>(
    null,
  );
  const keys = useRef(new Set<string>());
  const t = texts[lang];
  const L = (zh: string, en: string) => (lang === "zh" ? zh : en);
  useEffect(() => {
    let r: GameRuntime;
    try {
      r = new GameRuntime(container.current!);
    } catch (e) {
      setStatus("webgl");
      console.error(e);
      return;
    }
    runtime.current = r;
    setRuntimeReady(true);
    r.onChange = () => {
      setHome(r.home);
      setStatus(r.status);
      refresh((n) => n + 1);
    };
    r.onDisconnect = () => setModal("menu");
    const timer = setInterval(() => refresh((n) => n + 1), 100);
    const reset = () => {
      keys.current.clear();
      drag.current = null;
      r.stopInput();
    };
    const visibility = () => {
      reset();
      if (document.hidden && !r.home && !r.online) {
        r.menu(true);
        setModal("menu");
      }
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      r.destroy();
    };
  }, []);
  useEffect(() => {
    const r = runtime.current;
    if (r) {
      r.scene.setQuality(quality);
      r.audio.setVolume(volume, muted);
    }
    localStorage.setItem(
      "jenny-settings",
      JSON.stringify({ lang, name, difficulty, quality, volume, muted }),
    );
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang, name, difficulty, quality, volume, muted]);
  useEffect(() => {
    const actionKeys: Record<
      string,
      "left" | "right" | "boost" | "repair" | "supply"
    > = {
      KeyQ: "left",
      KeyE: "right",
      Space: "boost",
      KeyR: "repair",
      KeyF: "supply",
    };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const r = runtime.current;
      if (!r || r.home || e.target instanceof HTMLInputElement) return;
      const code = keyboardCode(e);
      if (code === "Escape" && down) {
        if (!e.repeat) {
          setModal((old) => {
            r.menu(!old);
            return old ? null : "menu";
          });
        }
        return;
      }
      if (modal) return;
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", ...Object.keys(actionKeys)].includes(
          code,
        )
      ) {
        e.preventDefault();
        if (down) {
          keys.current.add(code);
          // Queue a fresh tap so keyup before the simulation tick cannot lose it.
          if (!e.repeat && actionKeys[code]) r.actions.add(actionKeys[code]);
        } else keys.current.delete(code);
        delete r.input.target;
        r.input.throttle =
          Number(keys.current.has("KeyW")) - Number(keys.current.has("KeyS"));
        r.input.turn =
          Number(keys.current.has("KeyD")) - Number(keys.current.has("KeyA"));
        for (const [key, action] of Object.entries(actionKeys))
          r.input[action] = keys.current.has(key);
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true),
      ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [modal]);
  const r = runtime.current,
    w = r?.world,
    player = w?.ships.find((s) => s.id === r?.playerId),
    board = w ? standings(w) : [];
  const showModal = (value: typeof modal) => {
    keys.current.clear();
    r?.menu(!!value);
    setModal(value);
  };
  const start = () => {
    setModal(null);
    if (kind === "practice") r?.start(mode, difficulty, name.trim());
    else
      r?.connect(
        kind,
        mode,
        difficulty,
        name.trim(),
        room.trim().toUpperCase(),
      );
  };
  const leave = () => {
    r?.returnHome();
    setHome(true);
    setModal(null);
    setStatus("");
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!r || r.home || modal || w?.ended || player?.dead || drag.current)
      return;
    const p = r.predicted || player;
    if (!p) return;
    const screen = r.scene.project(p, 5);
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      Math.hypot(
        e.clientX - rect.left - screen.x,
        e.clientY - rect.top - screen.y,
      ) > 70
    )
      return;
    const ground = r.scene.ground(e.clientX, e.clientY);
    if (!ground) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      offsetX: p.x - ground.x,
      offsetZ: p.z - ground.z,
    };
    r.input.target = { x: p.x, z: p.z };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!r || drag.current?.id !== e.pointerId) return;
    e.preventDefault();
    const p = r.scene.ground(e.clientX, e.clientY);
    if (p)
      r.input.target = {
        x: p.x + drag.current.offsetX,
        z: p.z + drag.current.offsetZ,
      };
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      if (r) {
        delete r.input.target;
        r.input.throttle = 0;
        r.input.turn = 0;
        if (r.predicted) r.predicted.speed = 0;
      }
    }
  };
  const skill = (
    action: "left" | "right" | "boost" | "repair" | "supply",
    icon: string,
    key: string,
  ) => {
    const cd = player?.[action] || 0;
    return (
      <button
        className={`skill ${action === "left" || action === "right" ? "cannon" : ""}`}
        aria-label={t[action]}
        disabled={cd > 0 || !!player?.dead || w?.ended}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (r) {
            r.input[action] = true;
            r.actions.add(action);
          }
          r?.audio.start();
        }}
        onPointerUp={() => {
          if (r) r.input[action] = false;
        }}
        onPointerCancel={() => {
          if (r) r.input[action] = false;
        }}
        onLostPointerCapture={() => {
          if (r) r.input[action] = false;
        }}
      >
        <span className="skill-symbol">{icon}</span>
        <span>
          {t[action]}
          <small>{cd > 0 ? `${cd.toFixed(1)}s` : t.ready}</small>
        </span>
        <kbd>{key}</kbd>
      </button>
    );
  };
  const settings = (
    <div className="settings-fields">
      <label>
        {t.difficulty}
        <select
          value={difficulty}
          disabled={!home}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          {(["easy", "normal", "hard"] as const).map((d) => (
            <option key={d} value={d}>
              {t[d]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.quality}
        <select value={quality} onChange={(e) => setQuality(e.target.value)}>
          <option value="high">{t.high}</option>
          <option value="low">{t.low}</option>
        </select>
      </label>
      <label>
        {t.volume}
        <input
          aria-label={t.volume}
          type="range"
          min="0"
          max="1"
          step=".05"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <button className="outline" onClick={() => setMuted(!muted)}>
        {muted ? t.muted : t.sound}
      </button>
    </div>
  );
  return (
    <main className={home ? "app home" : "app battle"}>
      <div
        ref={container}
        className="sea"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      />
      {home ? (
        <>
          <div className="home-shade" />
          <header className="topbar">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <Compass />
              <span>
                JENNY<small>STORMBREAKERS</small>
              </span>
            </a>
            <nav>
              <button onClick={() => showModal("guide")}>{t.guide}</button>
              <span className="nav-divider" />
              <button
                className="language"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              >
                {lang === "zh" ? "EN / 中" : "中 / EN"}
              </button>
              <button
                className="sound-button"
                onClick={() => {
                  setMuted(!muted);
                  r?.audio.start();
                }}
                aria-label={muted ? t.muted : t.sound}
              >
                {muted ? "♫̸" : "♫"}
              </button>
            </nav>
          </header>
          <section className="port">
            <div className="eyebrow">
              <span /> {L("即刻启航 · 驶向未知", "THE OPEN SEA IS CALLING")}
            </div>
            <h1>
              Jenny<span>{L("破风者", "Stormbreakers")}</span>
            </h1>
            <p className="intro">
              {t.subtitle}
              <br />
              <span>{t.tag}</span>
            </p>
            <div className="voyage-form">
              <label className="field-label" htmlFor="captain">
                {t.name}
                <span>CAPTAIN</span>
              </label>
              <div className="name-field">
                <span>⚓</span>
                <input
                  id="captain"
                  value={name}
                  maxLength={18}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="field-label mode-label">
                {t.choose}
                <span>EXPEDITION</span>
              </div>
              <div className="mode-options">
                {modes.map((m, i) => (
                  <button
                    key={m}
                    className={mode === m ? "mode selected" : "mode"}
                    onClick={() => setMode(m)}
                  >
                    <span className="mode-icon">{["⚔", "ϟ", "◇"][i]}</span>
                    <strong>{t[m]}</strong>
                    <small>
                      {L(
                        ["扬帆 · 交锋", "风暴 · 突围", "探索 · 夺宝"][i],
                        [
                          "SAIL & BATTLE",
                          "BRAVE THE STORM",
                          "SEEK YOUR FORTUNE",
                        ][i],
                      )}
                    </small>
                    {mode === m && <i>✦</i>}
                  </button>
                ))}
              </div>
              <div className="connection-row">
                <select
                  aria-label={L("游戏方式", "Play type")}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {(["practice", "match", "create", "join"] as const).map(
                    (k) => (
                      <option key={k} value={k}>
                        {t[k]}
                      </option>
                    ),
                  )}
                </select>
                <span>
                  {kind === "practice"
                    ? L("你与 5 名电脑船长", "You + 5 AI captains")
                    : L(
                        "最多 6 人 · 电脑自动补位",
                        "Up to 6 players · AI fills empty seats",
                      )}
                </span>
              </div>
              {kind === "join" && (
                <input
                  className="room-input"
                  aria-label={t.room}
                  placeholder={L(
                    "输入 5 位房间码",
                    "Enter 5-character room code",
                  )}
                  value={room}
                  maxLength={5}
                  onChange={(e) => setRoom(e.target.value.toUpperCase())}
                />
              )}
              <button
                className="sail-button"
                onClick={start}
                disabled={
                  !runtimeReady ||
                  status === "connecting" ||
                  (kind === "join" && room.length !== 5)
                }
              >
                <span>⚓</span>
                {status === "connecting" ? t.connecting : t.sail}
                <span>→</span>
              </button>
              <div className="form-bottom">
                <span>◷ {L("3 分钟 / 航程", "3 MIN / VOYAGE")}</span>
                <button onClick={() => showModal("settings")}>
                  ⚙ {t.settings}
                </button>
              </div>
            </div>
            {status && status !== "connected" && (
              <p className="error" role="status">
                {status === "webgl"
                  ? L(
                      "无法启动 WebGL，请在浏览器中开启硬件加速。",
                      "WebGL unavailable. Enable browser hardware acceleration.",
                    )
                  : (t as Record<string, string>)[status] || status}
              </p>
            )}
          </section>
          <div className="ship-caption">
            <span>THE JENNY</span>
            <small>
              {L(
                "三桅护卫舰 · 为自由而航行",
                "THREE-MASTED FRIGATE · BUILT FOR FREEDOM",
              )}
            </small>
          </div>
          <div className="compass-decoration">
            <Compass />
            <span>N 24° · E 118°</span>
          </div>
          <footer className="home-footer">
            <span>
              EST. 2026 <i /> {L("风从这里开始", "WHERE THE WIND BEGINS")}
            </span>
            <span>
              {L(
                "WASD 航行 · Q / E 开炮 · 触屏拖船",
                "WASD to sail · Q / E to fire · Drag on touch",
              )}
            </span>
          </footer>
        </>
      ) : (
        <>
          <header className="battle-top">
            <div className="hull panel">
              <div>
                <span>⚓ {player?.name}</span>
                <strong>
                  {Math.ceil(player?.hp || 0)}
                  <small> / 100</small>
                </strong>
              </div>
              <div className="health-track">
                <i style={{ width: `${player?.hp || 0}%` }} />
              </div>
              <small>
                {t.health}{" "}
                <span>
                  {player?.shield
                    ? L("保护中", "Shielded")
                    : t[w?.mode || "battle"]}
                </span>
              </small>
            </div>
            <div className="clock panel">
              <small>{t.remaining}</small>
              <strong data-testid="timer">
                {Math.floor((w?.time || 0) / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor((w?.time || 0) % 60)
                  .toString()
                  .padStart(2, "0")}
              </strong>
              <span>{r?.online ? `● ${r.room}` : t.practice}</span>
            </div>
            <div className="battle-actions">
              <button
                className="icon-button"
                aria-label={muted ? t.muted : t.sound}
                onClick={() => setMuted(!muted)}
              >
                {muted ? "♫̸" : "♫"}
              </button>
              <button className="icon-button" onClick={() => showModal("menu")}>
                Ⅱ <span>{t.menu}</span>
              </button>
            </div>
          </header>
          <aside className="leaderboard panel">
            <div className="section-label">
              {L("海域排名", "FLEET RANKING")}
              <span>{t.score}</span>
            </div>
            {board.slice(0, 6).map((s, i) => (
              <div
                className={s.id === r?.playerId ? "rank own" : "rank"}
                key={s.id}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>
                  {s.name}
                  <small>
                    {s.bot ? "AI" : s.id === r?.playerId ? L("你", "YOU") : "●"}
                  </small>
                </b>
                <strong>{s.score}</strong>
              </div>
            ))}
          </aside>
          <aside className="map panel">
            <div className="section-label">
              {L("航海图", "SEA CHART")}
              <span>N ↑</span>
            </div>
            <svg
              viewBox="-190 -190 380 380"
              aria-label={L("小地图", "Minimap")}
            >
              <circle r="178" fill="#113c43" stroke="#8f9e8d" strokeWidth="2" />
              {[-90, 0, 90].map((v) => (
                <g key={v} stroke="#557570" opacity=".3">
                  <path d={`M${v} -160V160 M-160 ${v}H160`} />
                </g>
              ))}
              {ISLANDS.map((i, n) => (
                <circle key={n} cx={i.x} cy={i.z} r={i.r} fill="#a0ac80" />
              ))}
              {w?.loot.map((l) => (
                <rect
                  key={l.id}
                  x={l.x - 3}
                  y={l.z - 3}
                  width="6"
                  height="6"
                  fill={l.kind === "treasure" ? "#e8c782" : "#89d3c1"}
                />
              ))}
              {w?.mode === "storm" && (
                <circle
                  r={w.stormRadius}
                  fill="none"
                  stroke="#98afe2"
                  strokeWidth="3"
                />
              )}
              {w?.ships
                .filter((s) => !s.dead)
                .map((s) => (
                  <path
                    key={s.id}
                    d="M0 -8L5 6L0 3L-5 6Z"
                    transform={`translate(${s.x} ${s.z}) rotate(${(s.a * 180) / Math.PI})`}
                    fill={s.id === r?.playerId ? "#ffe0a0" : "#c37b65"}
                  />
                ))}
            </svg>
            <small>
              {L("金点：宝箱 · 绿点：补给", "Gold: treasure · Green: supplies")}
            </small>
          </aside>
          <div className="ship-labels" aria-hidden="true">
            {w?.ships
              .filter((s) => s.dead === 0)
              .map((s) => {
                const p = r?.scene.project(s, 25);
                return (
                  p && (
                    <div
                      className={`ship-label ${s.id === r?.playerId ? "mine" : ""}`}
                      key={s.id}
                      style={{ left: p.x, top: p.y }}
                    >
                      {s.name}
                      <i>
                        <b style={{ width: `${s.hp}%` }} />
                      </i>
                    </div>
                  )
                );
              })}
          </div>
          <div className="battle-hint">
            {drag.current
              ? L(
                  "松手即停 · 另一指可同时开炮",
                  "Release to stop · Fire with another finger",
                )
              : L(
                  "按住自己的船拖动航行 · 炮口朝左右两侧",
                  "Drag your ship to sail · Cannons fire to either side",
                )}
          </div>
          <div className="battle-controls">
            <div className="broadside">
              {skill("left", "↞", "Q")}
              {skill("right", "↠", "E")}
            </div>
            <div className="abilities">
              {skill("boost", "ϟ", "SPACE")}
              {skill("repair", "✚", "R")}
              {skill("supply", "▣", "F")}
            </div>
          </div>
          {!!player?.dead && (
            <div className="rescue panel">
              <span>⚓</span>
              <h2>{t.respawn}</h2>
              <strong>{Math.ceil(player.dead)}</strong>
              <p>
                {t.seconds} · {L("积分保留", "Score retained")}
              </p>
            </div>
          )}
          {r?.online && (
            <button
              className="invite"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}?room=${r.room}`,
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? t.copied : `${t.room} ${r.room} · ${t.copy}`}
            </button>
          )}
          {w?.ended && !modal && (
            <div className="modal-backdrop">
              <section className="modal results">
                <Compass />
                <div className="eyebrow">{t.results}</div>
                <h2>{t.winner}</h2>
                <h3>
                  {board
                    .filter((s) => s.score === board[0].score)
                    .map((s) => s.name)
                    .join(" · ")}
                </h3>
                <p>
                  {L(
                    "最高积分获胜 · 同分并列",
                    "Highest score wins · Equal scores share victory",
                  )}
                </p>
                <div className="result-table">
                  {board.map((s, i) => (
                    <div
                      key={s.id}
                      className={s.id === r?.playerId ? "own" : ""}
                    >
                      <span>
                        {i + 1}. {s.name}
                      </span>
                      <small>
                        {s.kills} {t.kills}
                      </small>
                      <strong>
                        {s.score} {t.score}
                      </strong>
                    </div>
                  ))}
                </div>
                <button
                  className="sail-button"
                  onClick={() => {
                    if (r?.online) {
                      leave();
                    } else start();
                  }}
                >
                  {r?.online ? t.back : t.again} →
                </button>
                <button className="text-button" onClick={leave}>
                  {t.back}
                </button>
              </section>
            </div>
          )}
        </>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className={`modal ${modal === "guide" ? "handbook" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "guide"
                ? t.guide
                : modal === "settings"
                  ? t.settings
                  : t.menu
            }
          >
            <button
              className="close"
              aria-label={L("关闭", "Close")}
              onClick={() => showModal(null)}
            >
              ×
            </button>
            <div className="eyebrow">CAPTAIN'S LOG</div>
            <h2>
              {modal === "guide"
                ? t.guide
                : modal === "settings"
                  ? t.settings
                  : r?.online
                    ? t.live
                    : t.pause}
            </h2>
            {status === "disconnected" && (
              <p className="error">{t.disconnected}</p>
            )}
            {modal === "guide" ? (
              <div className="guide-content">
                <article>
                  <span>01 / {L("掌舵", "HELM")}</span>
                  <h3>{L("先航行，再寻找侧翼", "Find the enemy’s flank")}</h3>
                  <p>
                    {L(
                      "W / S 前进与倒退，A / D 转向。手机和平板按住自己的船拖动，松手立即停止；另一根手指可同时点击火炮。船受航速、岛屿和船只碰撞限制。",
                      "W / S forward and reverse, A / D turn. On touch screens, hold and drag your ship; release to stop. Fire with another finger. Speed and collisions still apply.",
                    )}
                  </p>
                </article>
                <article>
                  <span>02 / {L("交锋", "BROADSIDE")}</span>
                  <h3>
                    {L("左右舷，独立火力", "Two sides. Twice the firepower.")}
                  </h3>
                  <p>
                    {L(
                      "Q 左舷、E 右舷，一次齐射三发炮弹，每发造成 28 点伤害。炮口朝船的两侧，并非船头；每侧独立装填 3 秒。驶到敌舰侧面约 100 米内再开炮。",
                      "Q fires port, E fires starboard: three cannonballs, 28 damage each. Cannons fire sideways, not ahead. Each side reloads in 3 seconds. Engage within 100 m.",
                    )}
                  </p>
                </article>
                <article>
                  <span>03 / {L("生存", "SURVIVAL")}</span>
                  <h3>{L("抓住下一阵风", "Catch the next wind")}</h3>
                  <p>
                    {L(
                      "空格冲刺 2 秒 / 冷却 12 秒；R 修复 35 点 / 冷却 18 秒；F 补给恢复 20 点并立即装填 / 冷却 25 秒。海上绿色补给恢复 25 点并装填。沉船后 5 秒重生，保留积分并获得 3 秒保护。",
                      "Space: 2s boost / 12s cooldown. R: repair 35 HP / 18s cooldown. F: 20 HP and instant reload / 25s cooldown. Green crates restore 25 HP and reload. Respawn in 5 seconds, keeping score with 3s protection.",
                    )}
                  </p>
                </article>
                <article>
                  <span>04 / {L("凯旋", "VICTORY")}</span>
                  <h3>
                    {L("三分钟，书写你的战绩", "Make three minutes count")}
                  </h3>
                  <p>
                    {L(
                      "每局 3 分钟，击沉敌舰 +100 分，拾取金色宝箱 +35 分；最高分获胜，同分并列。风暴模式的安全圈持续缩小，圈外每秒损失 10 点船体；宝藏模式有更多宝箱。",
                      "Rounds last 3 minutes. Sink a ship: +100. Collect gold treasure: +35. Highest score wins; ties share victory. Storm mode shrinks the safe zone (10 HP/s outside). Treasure mode doubles the treasure field.",
                    )}
                  </p>
                </article>
                <p className="guide-note">
                  {L(
                    "单机菜单与切后台会真正暂停。联机菜单不暂停世界；退出后电脑接管，重新加入会接替一个电脑席位。房间结束后返回港湾再匹配。",
                    "Solo menus and backgrounding pause the world. Online menus do not. AI takes over when you leave; rejoining replaces an AI slot. Return to port for a new round.",
                  )}
                </p>
              </div>
            ) : (
              <>
                {modal === "menu" && r?.online && (
                  <p className="online-warning">
                    ●{" "}
                    {L(
                      "其他船长仍在航行，你的船也可能受到攻击。",
                      "Other captains are still sailing. Your ship can still be hit.",
                    )}
                  </p>
                )}
                {settings}
                {modal === "menu" && (
                  <>
                    <button
                      className="sail-button"
                      disabled={status === "disconnected"}
                      onClick={() => showModal(null)}
                    >
                      {t.resume} →
                    </button>
                    <button
                      className="outline"
                      onClick={() => setModal("guide")}
                    >
                      {t.guide}
                    </button>
                    <button className="text-button" onClick={leave}>
                      {t.back}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
