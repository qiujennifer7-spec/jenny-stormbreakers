# Jenny · 破风者 / Jenny Stormbreakers

A playable bilingual 3D sailing battle. React + TypeScript + Three.js, authoritative Node.js / WebSocket server. All ship geometry, islands, sail textures, water shaders, particles and sounds are generated in code. No LLM API or external art assets.

## Run

Node 22.12+ recommended.

```sh
npm ci
npm run build
npm start
```

Open http://localhost:3417 (PORT overrides the port). Development: run `npm start` and `npm run dev` in two terminals, then open http://localhost:5417. Vite proxies `/ws` to port 3417. `npm test` runs simulation and live socket integration tests; start the server first. `TEST_WS_URL` can target another server.

## Play

- WASD: forward/reverse/turn. Q/E: port/starboard broadside. Space: boost. R: repair. F: resupply. Esc: menu.
- Touch: hold your own ship and drag; release to stop. Another finger can operate cannons simultaneously. No orbit camera; pointer capture and touch-action prevent scroll interference.
- Three minute rounds; +100 per enemy sunk, +35 per treasure. Highest score wins; equal scores share victory. Respawn after 5 seconds with score retained and 3 seconds invulnerability.
- Both batteries reload independently in 3s. Three projectiles each, 28 damage each, about 105m range.
- Boost 2s / 12s cooldown. Repair +35HP / 18s cooldown. Emergency supply +20HP + reload / 25s cooldown. Floating supplies +25HP + reload.
- Battle, shrinking storm (10 HP/s outside), or extra treasure. Bots obey the same combat rules.
- Solo truly pauses in menus and when hidden. Online world continues during menus and backgrounding. Inactive movement input expires server-side after 350ms.

## Multiplayer

Quick match groups public rooms by mode and difficulty. Create room makes a private code-only room. Each room has six ship slots. Humans replace AI in those slots, retaining that slot's current ship state; AI takes over on disconnect. The room starts immediately, so late joiners share the remaining round time. Ended rooms cannot be joined. Share the invite link or type the five-character code.

Server advances simulation at 20Hz and publishes authoritative state. Browser predicts only movement using the same collision/speed rules and replays unacknowledged inputs after server snapshots. No client-supplied damage, score, HP or position is accepted. Inputs are sanitized, sequenced, rate-limited and payload-limited. Server validates same-origin production connections. Socket heartbeat, backpressure limits, idle/finished-room cleanup, and graceful shutdown are included. There is no account system, persistent ranking or cross-instance room storage.

## Render Free

Create a **Web Service**, connect this repo, choose **Node** and **Free**, build `npm ci && npm run build`, start `npm start`, health path `/health`. Both static React assets and WebSocket endpoint run on the same origin. Blueprint: `render.yaml`.

Free services sleep after inactivity; initial wake-up can be slow. Active WebSocket traffic keeps the instance active. Rooms live in memory and reset when the service restarts; the client shows connection loss and offers return to port. No paid database or add-on is required.

## Files

- `shared/game.ts`: simulation, AI, damage, movement, score and input validation
- `src/scene.ts`: generated 3D scene and effects
- `src/runtime.ts`: local game loop, prediction, connection lifecycle
- `src/App.tsx`, `src/style.css`: Chinese/English UI, touch and keyboard controls
- `src/audio.ts`: Web Audio synthesized ambience and effects
- `server/index.ts`: room matchmaking, authority and hosting
- `tests/`: simulation and real WebSocket integration tests

Fonts use optional Google Fonts CSS with local serif/sans fallback. Graphics and sounds do not depend on asset downloads. A WebGL-capable browser is required. Low quality caps pixel ratio and particle counts. Mobile checks use emulated viewport/touch; physical-device GPU and audio behavior can differ.

## Latest verification

2026-10-06: production build successful; 13 simulation/socket tests passed; two independent browsers completed the full round with identical results and no console errors. Native multi-touch injection passed in solo and online modes. See `docs/IMPLEMENTATION.md` and `artifacts/multiplayer-verification.json` for evidence.
