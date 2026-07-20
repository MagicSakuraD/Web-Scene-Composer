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

/**
 * 后处理预设（当前默认不挂载 EffectComposer；若恢复务必走 performance）。
 * 大仓库 + N8AO/Bloom/MSAA 极易触发 WebGPU Device Lost。
 */
export const VISUAL_QUALITY_PRESETS: Record<ViewportRenderQuality, VisualQualityPreset> = {
  balanced: {
    environmentIntensity: 1.0,
    keyLight: {
      position: [10, 18, 8],
      target: [0, 0, 0],
      intensity: 1.15,
      color: '#fff5eb',
      shadowMapSize: 1024,
      shadowBias: -0.00015,
      shadowNormalBias: 0.025,
      shadowCameraSize: 24,
      shadowCameraFar: 50,
    },
    contactShadow: { resolution: 256, blur: 1.5, opacity: 0.4, scale: 40 },
    n8ao: null, // 大场景默认关 AO（贵）
    bloom: {
      // 高阈值：只让自发光 / 高亮 HDR 轻微泛光
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.35,
      intensity: 0.28,
      mipmapBlur: true,
    },
    composer: {
      multisampling: 0,
      resolutionScale: 0.75,
      enableNormalPass: false,
    },
  },
  performance: {
    environmentIntensity: 0.95,
    keyLight: {
      position: [10, 16, 8],
      target: [0, 0, 0],
      intensity: 0.85,
      color: '#fff5eb',
      shadowMapSize: 512,
      shadowBias: -0.00015,
      shadowNormalBias: 0.025,
      shadowCameraSize: 20,
      shadowCameraFar: 40,
    },
    contactShadow: { resolution: 128, blur: 1, opacity: 0.3, scale: 30 },
    n8ao: null,
    bloom: {
      luminanceThreshold: 0.95,
      luminanceSmoothing: 0.3,
      intensity: 0.2,
      mipmapBlur: true,
    },
    composer: {
      multisampling: 0,
      resolutionScale: 0.6,
      enableNormalPass: false,
    },
  },
}

/** Canvas 级渲染默认值（Sun 关闭时：ACES + 此曝光） */
export const CANVAS_GL_CONFIG = {
  /** MSAA：观感明显，大仓库可改 false；默认开启抗锯齿 */
  antialias: true,
  toneMappingExposure: 0.95,
  /** false = 优先 WebGPU；不支持时 Three 自动降级 WebGL */
  forceWebGL: false,
} as const

/**
 * 实时阴影策略（大仓库性能关键）。
 * Soft PCF + 海量 castShadow mesh + 2048 shadow map → WebGPU TDR / Device Lost。
 */
export const VIEWPORT_SHADOW_CONFIG = {
  /** Canvas 是否启用阴影系统；false = 完全不跑 shadow pass */
  enabled: true,
  /** Basic 远轻于 PCFSoft；仓库够用 */
  type: 'basic' as 'basic' | 'pcfsoft',
  /**
   * 平行光是否生成 shadow map。
   * false：仅 IBL/直接光，无实时阴影（推荐仓库）。
   */
  lightCastShadow: false,
  shadowMapSize: 512,
  shadowBias: -0.0002,
  shadowNormalBias: 0.04,
  shadowCameraSize: 20,
  shadowCameraFar: 40,
} as const

/** WebGPU 功能开关 */
export const VIEWPORT_WEBGPU_FEATURES = {
  /** TSL + THREE.Points（WebGPU 固定 1px 点径） */
  lidarPointCloud: true,
  /** TSL 材质节点图面板 */
  materialGraph: true,
  /** drei Environment IBL（PMREM）；若异常可关 */
  environmentIbl: true,
  /**
   * WebGPU TSL Bloom（轻量）。选中高亮为 AABB 线框（SelectionBoundingBox）。
   * true 时由 RenderPipeline 接管渲染（R3F priority>0 会跳过默认 gl.render）。
   */
  postProcessing: true,
} as const

/** WebGPU 下点云为规范限制的 1 物理像素；面板 pointSize 暂不影响渲染 */
export const LIDAR_WEBGPU_FIXED_POINT_PX = 1 as const

// ─── Sun 按钮 · IBL 环境光调参（改这里）────────────────────────────────────
// 使用方：viewport-effects.tsx → <Environment files={...} />
// 性能优先：本地 HDR（勿联网拉 drei preset CDN），PMREM resolution 尽量低

export const ROOM_IBL_CONFIG = {
  /**
   * public/ 下的 RGBE HDR（相对 EXR 更轻；不必转 .env，除非要再压体积）
   * Next：URL 为 `/HDRI/...`
   */
  files: '/HDRI/sunset_meadow_path_1k.hdr',
  /**
   * PMREM 立方体贴图边长。仓库反射只要大致 IBL，256 足够；
   * 升到 512/1024 会明显吃显存与首次编译时间。
   */
  resolution: 256,
  background: false,
  environmentIntensity: 0.6,
  toneMappingExposure: 0.95,
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
    castShadow: VIEWPORT_SHADOW_CONFIG.lightCastShadow,
    shadowMapSize: VIEWPORT_SHADOW_CONFIG.shadowMapSize,
    shadowBias: VIEWPORT_SHADOW_CONFIG.shadowBias,
    shadowNormalBias: VIEWPORT_SHADOW_CONFIG.shadowNormalBias,
    shadowCameraSize: VIEWPORT_SHADOW_CONFIG.shadowCameraSize,
    shadowCameraFar: VIEWPORT_SHADOW_CONFIG.shadowCameraFar,
  },
} as const

// ─── 后处理预设见 VISUAL_QUALITY_PRESETS；挂载前检查 VIEWPORT_WEBGPU_FEATURES.postProcessing ──

/** 雷达点云 Bloom 倍增（后处理开启时用） */
export const LIDAR_BLOOM_EMISSIVE_BOOST = 2.5

/** 数字孪生视口帧率目标（用于质量档位取舍，非运行时 enforcement） */
export const VIEWPORT_FPS_TARGETS = {
  /** 集显 / 轻薄本底线 */
  minimum: 30,
  /** 独显 / 工作站期望 */
  preferred: 60,
} as const
