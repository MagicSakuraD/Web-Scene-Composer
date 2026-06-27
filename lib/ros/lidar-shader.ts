import * as THREE from 'three'

/** Google Turbo colormap — 顶点着色器内多项式拟合，零 CPU 逐点设色 */
const LIDAR_VERTEX_SHADER = /* glsl */ `
uniform float uPointSize;
uniform float uMinY;
uniform float uMaxY;
uniform float uSizeAttenuation;
uniform float uUseGradient;
uniform vec3 uSolidColor;

varying vec3 vColor;

vec3 turbo(float x) {
  const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
  const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
  const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
  const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
  const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
  const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);
  vec4 v4 = vec4(1.0, x, x * x, x * x * x);
  vec2 v2 = v4.zw * v4.z;
  return vec3(
    dot(v4, kRedVec4) + dot(v2, kRedVec2),
    dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
    dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
  );
}

void main() {
  float range = max(uMaxY - uMinY, 0.05);
  float t = clamp((position.y - uMinY) / range, 0.0, 1.0);
  vColor = mix(uSolidColor, turbo(t), uUseGradient);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float size = uPointSize;
  if (uSizeAttenuation > 0.5) {
    size *= (300.0 / max(-mvPosition.z, 0.001));
  }
  gl_PointSize = size;
}
`

const LIDAR_FRAGMENT_SHADER = /* glsl */ `
uniform float uOpacity;
uniform float uEmissiveBoost;
varying vec3 vColor;

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(vColor * uEmissiveBoost, uOpacity);
}
`

export interface LidarShaderUniforms {
  uPointSize: { value: number }
  uOpacity: { value: number }
  uMinY: { value: number }
  uMaxY: { value: number }
  uSizeAttenuation: { value: number }
  uUseGradient: { value: number }
  uSolidColor: { value: THREE.Color }
  uEmissiveBoost: { value: number }
}

export function createLidarShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPointSize: { value: 0.04 },
      uOpacity: { value: 0.85 },
      uMinY: { value: -0.5 },
      uMaxY: { value: 2.5 },
      uSizeAttenuation: { value: 1 },
      uUseGradient: { value: 1 },
      uSolidColor: { value: new THREE.Color('#00ffcc') },
      uEmissiveBoost: { value: 1 },
    },
    vertexShader: LIDAR_VERTEX_SHADER,
    fragmentShader: LIDAR_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}

export type LidarShaderMaterial = THREE.ShaderMaterial & { uniforms: LidarShaderUniforms }
