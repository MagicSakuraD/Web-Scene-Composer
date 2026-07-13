# carter_web_nav_bridge

ROS 2 桥接节点：把 **Web Scene Composer** 的导航指令转成 Nav2 Action，**不**转发 feedback（Web 直连 Nav2 action 话题）。

## 在整体架构中的位置

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Web Scene Composer (浏览器)                                              │
│  · Nav Goal 面板：Waypoint Gizmo → map 坐标                              │
│  · Foxglove WebSocket：callService + subscribe                          │
└───────────────┬───────────────────────────────┬─────────────────────────┘
                │ callService                   │ subscribe
                ▼                               ▼
┌───────────────────────────┐     ┌─────────────────────────────────────────┐
│ foxglove_bridge :8765    │     │ Nav2 action 话题（hidden，需 include_hidden）│
│  · services capability   │     │  /navigate_to_pose/_action/feedback     │
│  · topic relay           │     │  /navigate_to_pose/_action/status        │
└───────────────┬───────────┘     └───────────────────▲─────────────────────┘
                │ callService                         │ publish
                ▼                                     │
┌───────────────────────────────────────────────────┴─────────────────────┐
│ web_nav_bridge_node.py  ← 本包                                           │
│  输入：Web Service   输出：Nav2 Action Goal（异步）                         │
│  不输出：feedback / status（由 Web 直接从 Nav2 话题读取）                  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ ActionClient send_goal_async
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Nav2  /navigate_to_pose  (server: /bt_navigator)                         │
│  → /plan /cmd_vel → Isaac Sim Nova Carter                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## `web_nav_bridge_node.py` 的输入与输出

本节点是 **单向命令桥**：只负责「接单 → 发 Action」，进度与结果 **不由本节点回传 Web**。

### 输入（Input）

| 来源 | 接口 | 类型 | 内容 |
|------|------|------|------|
| Web（经 Foxglove） | `/web_scene_composer/navigate_to_pose` | `carter_web_nav_bridge/srv/NavigateToPose` | `geometry_msgs/PoseStamped pose`（`frame_id` 通常为 `map`） |
| Web（经 Foxglove） | `/web_scene_composer/cancel_navigation` | `std_srvs/srv/Trigger` | 空请求，请求取消当前 goal |

Web 侧构造 pose 的流程：

1. 场景中拖动 **Nav Waypoint**（Gizmo 位置 + 旋转）
2. Three.js 世界坐标 → ROS `map` 坐标（`lib/ros/ros-three-coords.ts`）
3. Foxglove `callService` 编码 CDR 发往桥接 service

### 输出（Output）

| 目标 | 接口 | 类型 | 时机 |
|------|------|------|------|
| Nav2 | `/navigate_to_pose` | `nav2_msgs/action/NavigateToPose` | service 回调内 `send_goal_async()`，**非阻塞** |
| Web（同步应答） | service response | `bool success` + `string message` | 仅表示 goal 是否已提交 / 是否被拒绝，**不**表示导航已结束 |
| 终端日志 | — | — | `feedback_callback` 打印剩余距离（节流 2s）；`result` 打印 SUCCEEDED/CANCELED/ABORTED |

### 本节点**不**输出（由 Web 直连 Nav2）

| 数据 | 话题 | 消费者 |
|------|------|--------|
| 实时反馈（剩余距离、当前位姿） | `/navigate_to_pose/_action/feedback` | Web `client-manager` 订阅 → Nav Goal 面板 |
| 导航状态（执行中/成功/取消） | `/navigate_to_pose/_action/status` | 同上 |

这样避免在桥接里重复转发 feedback，也与 RViz / ActionGraph 直接读 Nav2 action 话题的方式一致。

### 实现要点（方案 B）

- 使用 **`rclpy.action.ActionClient`**，单 Node + 单 executor（`rclpy.spin`）
- **不用** `BasicNavigator`（避免双 Node / 线程 / `Executor is already spinning`）
- `send_goal_async` + `feedback_callback` + `get_result_async`：service 立即返回，导航在后台由 executor 驱动
- `cancel_goal_async()` 通过保存的 `goal_handle` 取消

## 包结构

```text
jazzy_ws/src/navigation/carter_web_nav_bridge/
├── CMakeLists.txt
├── package.xml
├── srv/NavigateToPose.srv
├── scripts/web_nav_bridge_node.py   ← 桥接节点
└── launch/web_nav_bridge.launch.py
```

## 编译与运行

```powershell
cd C:\IsaacSim-ros_workspaces\jazzy_ws

# 先停掉正在运行的 web_nav_bridge，否则 Windows 可能锁 dll
# Ctrl+C 或 Stop-Process ...

colcon build --packages-select carter_web_nav_bridge --merge-install
. .\install\setup.ps1

# 1) Nav2
ros2 launch carter_navigation carter_navigation.launch.py use_rviz:=False

# 2) Foxglove Bridge（必须 include_hidden，Web 才能订 feedback/status）
ros2 run foxglove_bridge foxglove_bridge --ros-args -p include_hidden:=true

# 3) 本桥接节点
ros2 launch carter_web_nav_bridge web_nav_bridge.launch.py
```

Windows launch 通过 `python web_nav_bridge_node.py` 启动（见 `web_nav_bridge.launch.py`），避免 `WinError 193`。

## Service 一览

| Service | 类型 | 说明 |
|---------|------|------|
| `/web_scene_composer/navigate_to_pose` | `carter_web_nav_bridge/srv/NavigateToPose` | 提交 `PoseStamped` → 异步发送 Nav2 Action |
| `/web_scene_composer/cancel_navigation` | `std_srvs/srv/Trigger` | 取消当前 goal（`cancel_goal_async`） |

## 故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| `ros2 action info /navigate_to_pose` → **Action servers: 0** | Nav2 已崩溃或未启动 | 重启 `carter_navigation` launch |
| `controller_server IS DOWN` / `map_server IS DOWN` | lifecycle 心跳丢失（仿真暂停、CPU、Zenoh 等） | 重启 Nav2；确认 Isaac **Play** |
| Web `服务调用超时` | Nav2 挂掉后 bridge/foxglove 卡住，或 bridge 未运行 | 先 `ros2 action info` 确认 server≥1 |
| `/local_plan` 无数据 | Nav2 未在导航 | 同上 |
| TF 只有 `odom→base_link` 无 `map→odom` | `map_server`/AMCL 未工作 | 重启 Nav2 |

**桥接节点只转发 goal，不能修复 Nav2 崩溃。** Nav2 正常时应看到 `Action servers: 1 (/bt_navigator)`。

## 与旧版（BasicNavigator + 线程）的区别

| | 旧版 | 方案 B（当前） |
|--|------|----------------|
| 发 goal | `BasicNavigator.goToPose()` 阻塞线程 | `ActionClient.send_goal_async()` |
| cancel | 与 `goToPose` 抢锁，易失效 | `goal_handle.cancel_goal_async()` |
| feedback 给 Web | 无（靠 Foxglove 订话题） | 仍无；日志里节流打印 |
| executor | 双 Node / 线程 spin 风险 | 单 Node 单 spin |
