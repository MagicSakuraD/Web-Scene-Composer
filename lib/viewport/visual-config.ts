/**
 * 视口渲染调参中心
 *
 * ★ Sun 按钮（IBL 环境光）→ ROOM_IBL_CONFIG
 * ★ Canvas 默认（Sun 关）→ CANVAS_GL_CONFIG
 * ★ 后处理 / HDRI 预设（暂注释，恢复时用）→ VISUAL_QUALITY_PRESETS
 */
export type ViewportRenderQuality = 'performance' | 'balanced'

export interface N8aoConfig {
  aoRadius: number
  intensity: number
  distanceFalloff: number
  halfRes: boolean
  quality: 'performance' | 'low' | 'medium' | 'high' | 'ultra'
  aoSamples: number
  denoiseSamples: number
}

export interface BloomConfig {
  luminanceThreshold: number
  luminanceSmoothing: number
  intensity: number
  mipmapBlur: boolean
}

export interface ComposerConfig {
  /** WebGL2 MSAA；0 = 关闭以省带宽 */
  multisampling: number
  /** 后处理内部分辨率缩放 */
  resolutionScale: number
  /** N8AO 自带深度，关闭 NormalPass 可省一整条渲染通道 */
  enableNormalPass: boolean
}

export interface KeyLightConfig {
  position: [number, number, number]
  target: [number, number, number]
  intensity: number
  color: string
  shadowMapSize: number
  shadowBias: number
  shadowNormalBias: number
  shadowCameraSize: number
  shadowCameraFar: number
}

export interface VisualQualityPreset {
  environmentIntensity: number
  keyLight: KeyLightConfig
  contactShadow: {
    resolution: number
    blur: number
    opacity: number
    scale: number
  }
  n8ao: N8aoConfig | null
  bloom: BloomConfig
  composer: ComposerConfig
}

export const VISUAL_QUALITY_PRESETS: Record<ViewportRenderQuality, VisualQualityPreset> = {
  balanced: {
    environmentIntensity: 1.0,
    keyLight: {
      position: [10, 18, 8],
      target: [0, 0, 0],
      intensity: 1.15,
      color: '#fff5eb',
      shadowMapSize: 2048,
      shadowBias: -0.00015,
      shadowNormalBias: 0.025,
      shadowCameraSize: 28,
      shadowCameraFar: 60,
    },
    contactShadow: { resolution: 512, blur: 2.5, opacity: 0.55, scale: 50 },
    n8ao: {
      // 仓库尺度 ~ 米级；0.5 偏细节，1.0 兼顾货架缝隙
      aoRadius: 1.0,
      intensity: 2.0,
      distanceFalloff: 1.0,
      halfRes: true,
      quality: 'medium',
      aoSamples: 12,
      denoiseSamples: 3,
    },
    bloom: {
      // threshold=1 只让 HDR 高光（雷达点云 uEmissiveBoost、自发光材质）泛光
      // 全场景 intensity 不宜像教程那样 1.2，否则整屏发糊
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.4,
      intensity: 0.72,
      mipmapBlur: true,
    },
    composer: {
      multisampling: 4,
      resolutionScale: 0.9,
      enableNormalPass: false,
    },
  },
  performance: {
    environmentIntensity: 0.85,
    keyLight: {
      position: [10, 16, 8],
      target: [0, 0, 0],
      intensity: 0.85,
      color: '#fff5eb',
      shadowMapSize: 1024,
      shadowBias: -0.00015,
      shadowNormalBias: 0.025,
      shadowCameraSize: 24,
      shadowCameraFar: 50,
    },
    contactShadow: { resolution: 384, blur: 2, opacity: 0.42, scale: 42 },
    n8ao: {
      aoRadius: 0.8,
      intensity: 1.6,
      distanceFalloff: 1.0,
      halfRes: true,
      quality: 'low',
      aoSamples: 8,
      denoiseSamples: 2,
    },
    bloom: {
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.35,
      intensity: 0.45,
      mipmapBlur: true,
    },
    composer: {
      multisampling: 0,
      resolutionScale: 0.75,
      enableNormalPass: false,
    },
  },
}

/** Canvas 级渲染默认值（Sun 关闭时：ACES + 此曝光） */
export const CANVAS_GL_CONFIG = {
  antialias: true,
  toneMappingExposure: 0.95,
  /** false = 优先 WebGPU；不支持时 Three 自动降级 WebGL */
  forceWebGL: false,
} as const

/** WebGPU 功能开关 */
export const VIEWPORT_WEBGPU_FEATURES = {
  /** TSL + THREE.Points（WebGPU 固定 1px 点径） */
  lidarPointCloud: true,
  /** TSL 材质节点图面板 */
  materialGraph: true,
  /** drei Environment IBL（PMREM）；若异常可关 */
  environmentIbl: true,
} as const

/** WebGPU 下点云为规范限制的 1 物理像素；面板 pointSize 暂不影响渲染 */
export const LIDAR_WEBGPU_FIXED_POINT_PX = 1 as const

// ─── Sun 按钮 · IBL 环境光调参（改这里）────────────────────────────────────
// 使用方：viewport-effects.tsx → <Environment preset={...} />
// drei 可用 preset：apartment, city, dawn, forest, lobby, night, park, studio, sunset, warehouse
// （无 "room"；coffeemat 的 RoomEnvironment 需手写 PMREM，此处用 HDRI preset 等效）

export type DreiEnvironmentPreset =
  | 'apartment'
  | 'city'
  | 'dawn'
  | 'forest'
  | 'lobby'
  | 'night'
  | 'park'
  | 'studio'
  | 'sunset'
  | 'warehouse'

export const ROOM_IBL_CONFIG = {
  /** studio≈产品棚拍；仓库场景可改 warehouse */
  preset: 'sunset' satisfies DreiEnvironmentPreset as DreiEnvironmentPreset,
  background: false,
  environmentIntensity: 0.8,
  toneMappingExposure: 0.8,
} as const

// ─── 旧方案：Physical Lights / Reinhard（暂不用，保留参考）──────────────────
export const PHYSICAL_LIGHTS_CONFIG = {
  toneMappingExposure: Math.pow(0.68, 5.0),
  hemisphere: {
    skyColor: '#ddeeff',
    groundColor: '#0f0e0d',
    intensity: 0.02,
  },
  distantLight: {
    color: '#ffffff',
    intensity: 1.15,
    position: [10, 18, 8] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    shadowMapSize: 2048,
    shadowBias: -0.00015,
    shadowNormalBias: 0.025,
    shadowCameraSize: 28,
    shadowCameraFar: 60,
  },
} as const

// ─── 以下为后处理 / HDRI 预设（当前未启用，恢复 EffectComposer / Environment 时用）──

/** 雷达点云 Bloom 倍增（后处理开启时用） */
export const LIDAR_BLOOM_EMISSIVE_BOOST = 2.5

/** 数字孪生视口帧率目标（用于质量档位取舍，非运行时 enforcement） */
export const VIEWPORT_FPS_TARGETS = {
  /** 集显 / 轻薄本底线 */
  minimum: 30,
  /** 独显 / 工作站期望 */
  preferred: 60,
} as const
