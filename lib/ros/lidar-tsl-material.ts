/**
 * 雷达点云 TSL 材质（WebGPU）
 *
 * WebGPU 规范下 `THREE.Points` 点径固定 1px（无 gl_PointSize）。
 * 本材质配合 `<points>` 使用：保留 Turbo 渐变色 + 透明度，放弃可调点径。
 * 若需 >1px 点精灵，再迁 Instanced Sprite（见文件头注释）。
 */
import { Color } from 'three'
import { PointsNodeMaterial } from 'three/webgpu'
import {
  Fn,
  clamp,
  dot,
  float,
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
  uUseGradient: ReturnType<typeof uniform<number>>
  uSolidColor: ReturnType<typeof uniform<ReturnType<typeof vec3>>>
  uEmissiveBoost: ReturnType<typeof uniform<number>>
}

/** Google Turbo colormap — 与 GLSL 版多项式一致 */
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

const _defaultSolid = new Color('#00ffcc')

export function createLidarTslMaterial() {
  const uOpacity = uniform(0.85)
  const uMinY = uniform(-0.5)
  const uMaxY = uniform(2.5)
  const uUseGradient = uniform(1)
  const uSolidColor = uniform(vec3(_defaultSolid.r, _defaultSolid.g, _defaultSolid.b))
  const uEmissiveBoost = uniform(1)

  const range = max(uMaxY.sub(uMinY), float(0.05))
  const heightT = clamp(positionLocal.y.sub(uMinY).div(range), float(0), float(1))
  const gradientColor = turboColormap(heightT)
  const pointColor = mix(uSolidColor, gradientColor, uUseGradient).mul(uEmissiveBoost)

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
    uUseGradient,
    uSolidColor,
    uEmissiveBoost,
  }

  return { material, uniforms }
}

export type LidarTslMaterial = PointsNodeMaterial

/** 运行时更新 solid color uniform（vec3） */
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
