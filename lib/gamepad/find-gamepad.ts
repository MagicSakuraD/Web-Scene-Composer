/** 返回第一个已连接的手柄（Gamepad API 槽位可能不连续） */
export function findActiveGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  const pads = navigator.getGamepads()
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i]
    if (gp?.connected) return gp
  }
  return null
}

export function isGamepadApiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
}
