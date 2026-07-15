/**
 * 雷达点云 TSL 材质（WebGPU）
 *
 * WebGPU 下点径固定 1px。着色：
 * - distance：到传感器距离彩虹（近红远青/紫，默认）
 * - turbo：高度 Turbo
 * - solid：单色
 */
import { Color } from 'three'
import { PointsNodeMaterial } from 'three/webgpu'
import {
  Fn,
  clamp,
  cos,
  dot,
  float,
  length,
  max,
  mix,
  positionLocal,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'

export interface LidarTslUniforms {
  uOpacity: ReturnType<typeof uniform<number>>
  uMinY: ReturnType<typeof uniform<number>>
  uMaxY: ReturnType<typeof uniform<number>>
  uMinDist: ReturnType<typeof uniform<number>>
  uMaxDist: ReturnType<typeof uniform<number>>
  /** 0 solid / 1 turbo / 2 distance */
  uGradientMode: ReturnType<typeof uniform<number>>
  uSolidColor: ReturnType<typeof uniform<ReturnType<typeof vec3>>>
  uEmissiveBoost: ReturnType<typeof uniform<number>>
}

/** Google Turbo colormap */
const turboColormap = Fn(([x]: [ReturnType<typeof float>]) => {
  const kRedVec4 = vec4(0.13572138, 4.6153926, -42.66032258, 132.13108234)
  const kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333)
  const kBlueVec4 = vec4(0.1066733, 12.64194608, -60.58204836, 110.36276771)
  const kRedVec2 = vec2(-152.94239396, 59.28637943)
  const kGreenVec2 = vec2(4.27729857, 2.82956604)
  const kBlueVec2 = vec2(-89.90310912, 27.34824973)

  const v4 = vec4(1.0, x, x.mul(x), x.mul(x).mul(x))
  const v2 = v4.zw.mul(v4.z)

  return vec3(
    dot(v4, kRedVec4).add(dot(v2, kRedVec2)),
    dot(v4, kGreenVec4).add(dot(v2, kGreenVec2)),
    dot(v4, kBlueVec4).add(dot(v2, kBlueVec2)),
  )
})

/**
 * 彩虹：t=0 近红 → 黄绿青蓝 → 品红（接近 Foxglove Distance + Rainbow）
 * color = 0.5 + 0.5 * cos(2π (t + offset))
 */
const rainbowColormap = Fn(([t]: [ReturnType<typeof float>]) => {
  const x = clamp(t, float(0), float(1))
  const tau = float(6.28318530718)
  const offset = vec3(0.0, 0.33, 0.67)
  return cos(tau.mul(x.add(offset))).mul(0.5).add(0.5)
})

const _defaultSolid = new Color('#00ffcc')

export function createLidarTslMaterial() {
  const uOpacity = uniform(0.85)
  const uMinY = uniform(-0.5)
  const uMaxY = uniform(2.5)
  const uMinDist = uniform(0)
  const uMaxDist = uniform(30)
  const uGradientMode = uniform(2)
  const uSolidColor = uniform(vec3(_defaultSolid.r, _defaultSolid.g, _defaultSolid.b))
  const uEmissiveBoost = uniform(1)

  const heightRange = max(uMaxY.sub(uMinY), float(0.05))
  const heightT = clamp(positionLocal.y.sub(uMinY).div(heightRange), float(0), float(1))
  const turboColor = turboColormap(heightT)

  const dist = length(positionLocal)
  const distRange = max(uMaxDist.sub(uMinDist), float(0.05))
  const distT = clamp(dist.sub(uMinDist).div(distRange), float(0), float(1))
  const rainbowColor = rainbowColormap(distT)

  // mode: 0 solid, 1 turbo, 2 distance — 用 float 阶跃避免 boolean mix
  const tTurbo = clamp(uGradientMode, float(0), float(1))
  const tDist = clamp(uGradientMode.sub(1), float(0), float(1))
  const pointColor = mix(mix(uSolidColor, turboColor, tTurbo), rainbowColor, tDist).mul(
    uEmissiveBoost,
  )

  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  })

  material.colorNode = pointColor
  material.opacityNode = uOpacity

  const uniforms: LidarTslUniforms = {
    uOpacity,
    uMinY,
    uMaxY,
    uMinDist,
    uMaxDist,
    uGradientMode,
    uSolidColor,
    uEmissiveBoost,
  }

  return { material, uniforms }
}

export type LidarTslMaterial = PointsNodeMaterial

export function setLidarSolidColor(
  uniforms: LidarTslUniforms,
  hex: string,
  scratch = _defaultSolid,
) {
  scratch.set(hex)
  const v = uniforms.uSolidColor.value as { x: number; y: number; z: number }
  v.x = scratch.r
  v.y = scratch.g
  v.z = scratch.b
}

export function colorModeToGradientMode(mode: 'distance' | 'turbo' | 'solid'): number {
  if (mode === 'turbo') return 1
  if (mode === 'distance') return 2
  return 0
}
