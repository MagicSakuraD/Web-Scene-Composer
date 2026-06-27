export const locales = ['zh', 'en'] as const
export type Locale = (typeof locales)[number]

export const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
}

const zh = {
  'titleBar.toggleLeft': '切换场景层级面板',
  'titleBar.toggleRight': '切换检视器面板',
  'titleBar.edited': 'Edited',
  'titleBar.simulating': 'Simulating',
  'titleBar.simulate': 'Simulate',
  'titleBar.stop': 'Stop',
  'titleBar.connectHint': '连接 {url} · 订阅 /chassis/odom',
  'titleBar.disconnectHint': '断开 Foxglove Bridge',
  'titleBar.status.ready': 'Ready',
  'titleBar.status.connecting': 'Connecting…',
  'titleBar.status.connected': 'Simulating',
  'titleBar.status.error': 'Error',
  'titleBar.grid': '网格',
  'titleBar.gridOn': '隐藏视口网格',
  'titleBar.gridOff': '显示视口网格',
  'titleBar.lighting': '环境光',
  'titleBar.lightingOn': '关闭 IBL 环境光',
  'titleBar.lightingOff': '开启 IBL 环境光',
  'titleBar.locale': '切换语言',
  'theme.toggleLight': '切换到浅色模式',
  'theme.toggleDark': '切换到深色模式',
  'theme.toggle': '切换主题',
  'panels.addComponent': '添加组件',
  'panels.projectBrowser.name': '项目浏览器',
  'panels.console.name': '控制台',
  'panels.diffDrive.name': '差速驱动控制器',
  'panels.diffDrive.description': 'Xbox 手柄 · advertise & 发布 /cmd_vel',
  'panels.cameraViewer.name': '摄像头画面',
  'panels.cameraViewer.description': '订阅 CompressedImage (JPEG) · 多路可缩放预览',
  'panels.lidarViewer.name': '雷达点云',
  'panels.lidarViewer.description': 'PointCloud2 · 3D 视口实时点云',
} as const

const en: Record<keyof typeof zh, string> = {
  'titleBar.toggleLeft': 'Toggle scene hierarchy',
  'titleBar.toggleRight': 'Toggle inspector',
  'titleBar.edited': 'Edited',
  'titleBar.simulating': 'Simulating',
  'titleBar.simulate': 'Simulate',
  'titleBar.stop': 'Stop',
  'titleBar.connectHint': 'Connect to {url} · subscribe /chassis/odom',
  'titleBar.disconnectHint': 'Disconnect Foxglove Bridge',
  'titleBar.status.ready': 'Ready',
  'titleBar.status.connecting': 'Connecting…',
  'titleBar.status.connected': 'Simulating',
  'titleBar.status.error': 'Error',
  'titleBar.grid': 'Grid',
  'titleBar.gridOn': 'Hide viewport grid',
  'titleBar.gridOff': 'Show viewport grid',
  'titleBar.lighting': 'IBL',
  'titleBar.lightingOn': 'Turn off IBL',
  'titleBar.lightingOff': 'Turn on IBL',
  'titleBar.locale': 'Switch language',
  'theme.toggleLight': 'Switch to light mode',
  'theme.toggleDark': 'Switch to dark mode',
  'theme.toggle': 'Toggle theme',
  'panels.addComponent': 'Add Component',
  'panels.projectBrowser.name': 'Project Browser',
  'panels.console.name': 'Console',
  'panels.diffDrive.name': 'Diff Drive Controller',
  'panels.diffDrive.description': 'Xbox gamepad · advertise & publish /cmd_vel',
  'panels.cameraViewer.name': 'Camera Viewer',
  'panels.cameraViewer.description': 'Subscribe CompressedImage (JPEG) · resizable multi-view',
  'panels.lidarViewer.name': 'LiDAR Point Cloud',
  'panels.lidarViewer.description': 'PointCloud2 · live 3D viewport overlay',
}

export type MessageKey = keyof typeof zh

export const messages: Record<Locale, Record<MessageKey, string>> = { zh, en }

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string>,
): string {
  let text = messages[locale][key] ?? messages.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v)
    }
  }
  return text
}
