# Voxel Creative

一个使用原生 HTML、CSS、JavaScript 与 WebGL 2 编写的原创网页体素沙盒。本版加入局域网多人联机、主机权威世界和体素玩家模型。

## 启动方式

### 推荐：完整服务（单人和联机都能用）

联机需要 Node.js 18 或更高版本，不需要安装任何 npm 包。

- Windows：双击 `start_lan.bat`，也可双击兼容入口 `start_server.bat`
- macOS / Linux：运行 `./start_lan.sh`，也可运行 `./start_server.sh`

这些脚本会启动 `lan-server.js`，同时提供网页、`/_lan/info` 和 WebSocket `/ws`，并尝试打开 `http://localhost:8080`。

主机在网页中点击“局域网联机 → 创建主机房间”，再把服务窗口中显示的 `http://192.168.x.x:8080` 地址发给同一局域网内的朋友。朋友必须直接用浏览器打开这个地址，再点击“加入主机房间”。Windows 防火墙首次询问时，请允许 Node.js 访问“专用网络”。

### 仅单人静态服务

`start_singleplayer.bat` / `start_singleplayer.sh` 使用 Python 在 `http://localhost:8000` 提供静态网页。它没有 WebSocket，因此不能创建或加入局域网房间。

直接执行 `python -m http.server 8080` 后出现以下日志是误用了静态服务：

- `GET /_lan/info 404`
- `GET /ws 404`

遇到这种情况，请关闭 Python 窗口，再运行 `start_lan.bat` 或 `start_lan.sh`。

## 联机架构

浏览器安全模型不允许网页、SharedWorker 或 Service Worker 直接监听局域网 TCP 端口，因此纯浏览器不能充当真正的 WebSocket Server。本项目采用接近“浏览器内嵌服务器”体验的混合方案：

- **主机浏览器**：世界权威、种子、脏区块存档、方块操作校验、玩家列表
- **本机轻量 Node 中继**：只监听 WebSocket 和转发消息，不保存世界、不生成地形
- **客户端浏览器**：用主机种子本地生成自然地形，只请求视距内区块的修改差异

主机关闭网页或服务后，房间立即结束。客户端不会把联机世界写进自己的本地单人存档。

## 多人功能

- 主机浏览器权威存储世界状态
- 玩家加入、离开和断线广播
- 玩家位置、朝向、飞行、移动速度和手持方块约每秒同步 20 次
- 远端位置插值，降低局域网抖动
- 体素人物模型：头、身体、双臂、双腿、头发、眼睛、衣服与手持方块
- 行走摆臂摆腿，飞行姿态与昵称标签
- 客户端按主机种子生成无限自然地形
- 只同步当前视距区块的修改差异，不传输完整地图
- 客户端放置/破坏先提交主机
- 主机校验距离、基岩、目标占用以及玩家碰撞后广播最终结果
- 方块修改使用区块修订号，保持客户端顺序一致
- 只有主机写入脏区块存档
- 无第三方依赖的纯 Node WebSocket/HTTP 服务

## 原有功能

- 无限横向 16×16 区块世界，柏林噪声 / FBM 地形，无水
- 玩家重力、跑跳、0.6×1.8 AABB 碰撞体
- 双击跳跃键切换飞行；飞行时跳跃键上升、下蹲键下降
- 附近区块逐帧生成，远处 GPU 网格卸载
- 世界修改按脏区块增量保存，兼容前一版存档
- 34 种方块、40 张原创 32×32 材质
- 雪地区域与地下煤、铁、金、钻石矿脉
- 初始 9 格快捷栏为空，默认按 `E` 打开创造模式背包
- 主菜单设置页：鼠标灵敏度、FOV、视角反转、声音和键位绑定
- 原创程序化音效：材质脚步、破坏、放置、落地、飞行和环境声

## 默认操作

| 操作 | 键位 |
|---|---|
| 移动 | W / A / S / D |
| 跳跃 | Space |
| 疾跑 | 左 Ctrl |
| 创造背包 | E |
| 破坏 / 放置 | 鼠标左键 / 右键 |
| 选择快捷栏 | 1–9 / 滚轮 |
| 切换飞行 | 双击 Space |
| 飞行上升 / 下降 | Space / 左 Shift |
| 飞行速度档 | F |
| 暂停 | Esc |

## 常见故障

### `/_lan/info` 和 `/ws` 返回 404

这不是地图或浏览器脚本损坏，而是网页由 Python 静态服务器提供。Python `http.server` 不支持 WebSocket Upgrade。关闭显示 `Serving HTTP on ...` 的 Python 窗口，改用 Node 启动脚本。

### 端口 8080 被占用

关闭旧的 Python/Node 服务窗口，或运行 `node lan-server.js 9000`，然后使用终端显示的新地址。

### 其他设备打不开地址

确保设备处于同一 Wi‑Fi/有线网络；使用 `192.168.x.x` 或 `10.x.x.x` 地址而不是 `localhost`；允许 Node.js 通过系统防火墙的专用网络。

## 端口

默认端口为 `8080`。可通过以下方式改端口：

```bash
node lan-server.js 9000
```

或：

```bash
PORT=9000 node lan-server.js
```

## 材质

所有材质均由 `generate_textures.py` 离线生成，单张尺寸为 32×32。运行脚本需要 Python 3 和 Pillow：

```bash
python3 generate_textures.py
```

## 说明

本项目不包含 Minecraft 原版代码、材质、声音、模型或商标资源；所有视觉、模型与音频均为原创程序化素材。

## 生存模式系统

本版本新增数据驱动的生存玩法，并保留创造模式切换：

- 20 点生命、20 点饥饿、饱和度、活动消耗、自然回血、饥饿伤害与摔落伤害。
- 所有方块拥有硬度、推荐工具和最低采集等级；基岩不可破坏，黑曜石需要钻石镐。
- 木、石、铁、金、钻石五个等级的镐、斧、锹、锄、剑，包含速度、攻击力和耐久。
- 猪、牛、羊会在玩家附近生成、游荡、受伤和死亡；掉落生肉、皮革或羊毛。
- 生肉可以直接食用，但熟食恢复更多饥饿值。
- 工作台右键交互，提供手工与工作台配方；熔炉右键交互，支持燃料、10 秒熔炼及离线存档。
- 局域网主机可开关 PVP；攻击距离和伤害由主机校验，动物状态由主机同步。

### 生存操作

- 长按左键：挖掘方块；面向动物或玩家时攻击。
- 右键：放置方块、进食，或打开工作台/熔炉。
- E：打开生存物品栏。
- 数字键或滚轮：选择快捷栏。

## Survival startup reliability fix
The survival module and game engine are bundled into `js/app.js` so their load order cannot diverge. The HTML uses a new cache version query.


## V6 startup fix

Fixed the wooden sword registry mismatch (`wooden_sword` vs `wood_sword`) that caused `Cannot read properties of undefined (reading 'name')` before initialization. Existing saves are migrated automatically.


## V8 物品栏、合成与物品材质

- E 背包包含独立 2×2 随身合成栏与产物槽，可制作木板、木棍和工作台。
- 右键工作台打开独立 3×3 合成栏，配方按真实摆放矩阵匹配，不再只统计材料数量。
- 左键整组拿取/放下/合并/交换；右键拿半组或逐个放置。
- 工具、武器、食物、矿物和材料使用程序化 32×32 像素图标。
- 非方块物品在快捷栏、背包、鼠标光标及第一人称手持位置显示同一材质。

## V9 矿透作弊

游戏中按 `X` 切换矿透。开启后只渲染煤矿石、铁矿石、金矿石和钻石矿石；再次按 `X` 恢复正常世界。右上角会显示“矿透 X”。
