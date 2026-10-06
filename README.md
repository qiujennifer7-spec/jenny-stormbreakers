# Jenny · 破风者 / Jenny Stormbreakers

可玩的中英文 3D 帆船海战游戏。React + TypeScript + Three.js，Node.js + WebSocket 服务器统一计算命中、血量、积分和胜负。所有模型、木纹、帆布、海水、云、特效和音效均通过代码生成，无大模型 API 或外部美术依赖。

## 启动

Node.js 22.12+：

```sh
npm ci
npm run build
npm start
```

访问 http://localhost:3417。开发另开终端运行 `npm run dev`，访问 http://localhost:5417。`npm test` 自行启动临时联机服务器；`npm run package` 使用 Python 3 标准库创建源码 ZIP。

## 操作

WASD 航行，Q / E 左右舷炮，空格冲刺，R 修复，F 补给，Esc 菜单。手机 / iPad 按住自己的船拖动、松手停船，另一根手指同时开炮。每局 3 分钟：击沉 +100，宝箱 +35，最高分获胜；沉船 5 秒重生并保留积分。左右舷独立装填 3 秒。

人机练习真正暂停；联机菜单继续运行。每房六个船位，真人加入替代电脑，离开后电脑接管。房间即建即开，晚加入继承电脑船当前状态与剩余时间。支持匹配、私人房间、邀请码加入，三种模式和三级电脑难度。

## 文档与证据

- [中文操作说明](docs/中文操作说明.md)：完整规则、电脑和触屏操作、设置和常见问题。
- [原始需求验收清单](docs/需求验收清单.md)：逐项核对及明确验收边界。
- [部署与维护](docs/部署与维护.md)：Render Free、测试复现与服务限制。
- [交付记录](docs/交付记录.md)：本次收尾测试和未完成的公网 / 实机验收。
- [阶段实现记录](docs/IMPLEMENTATION.md)：初始三个阶段。
- `artifacts/`：浏览器、音效和联机验收证据。
- `/soundcheck.html`：海浪、开炮、命中、沉船、落水和拾取试听。

Render Free 配置在 `render.yaml`：构建 `npm ci && npm run build`，启动 `npm start`，健康路径 `/health`。前端和 WSS 使用一个服务同一域名。账号银行卡预授权完成并通知后执行正式部署；当前尚未宣称公网已上线。

## 源码结构

| 文件 | 职责 |
| --- | --- |
| shared/game.ts | 游戏规则、AI、碰撞、伤害、积分和输入校验 |
| server/index.ts | 20Hz服务器、房间、匹配、托管、连接清理 |
| src/runtime.ts | 单机循环、网络生命周期、移动预测 |
| src/scene.ts | 程序化3D、海水、天空、帆布与木纹 |
| src/effects.ts | 固定容量粒子池 |
| src/audio.ts | 合成声音、限声部、静音与暂停 |
| src/App.tsx / style.css | 双语 UI、键盘与多指触控 |
| tests/ | 游戏、粒子池和真实 WebSocket 验证 |
| scripts/ | 浏览器验收与源码打包 |

免费实例空闲休眠，冷启动可能慢；房间在内存中，服务重启即丢失。无账号、持久排名或跨实例房间存储。字体可选 Google Fonts，失败时使用本地字体；图形声音不需要下载素材。需 WebGL 浏览器。移动端验证包含视口与触控模拟，真实设备性能仍需实机确认。
