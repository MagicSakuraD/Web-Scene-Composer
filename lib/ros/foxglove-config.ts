import { FoxgloveClient } from '@foxglove/ws-protocol'

/** Windows 上 localhost 常解析为 IPv6 ::1，foxglove_bridge 可能只监听 IPv4 */
export const FOXGLOVE_WS_CANDIDATES = [
  'ws://127.0.0.1:8765',
  'ws://localhost:8765',
] as const

export const FOXGLOVE_WS_URL = FOXGLOVE_WS_CANDIDATES[0]

/**
 * foxglove_bridge 3.x (Foxglove SDK) 使用 foxglove.sdk.v1；
 * 旧版 bridge / @foxglove/ws-protocol 使用 foxglove.websocket.v1。
 * 握手时必须同时声明，否则 Chrome 会报 WebSocket 握手失败。
 */
export const FOXGLOVE_WS_SUBPROTOCOLS = [
  'foxglove.sdk.v1',
  FoxgloveClient.SUPPORTED_SUBPROTOCOL,
] as const
