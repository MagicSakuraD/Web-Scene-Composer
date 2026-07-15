import * as THREE from 'three'

const cache = new Map<string, THREE.Texture>()
const loader = new THREE.TextureLoader()

function configureTexture(tex: THREE.Texture) {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

/** 上传/选择贴图后预加载，保证 compile 时 cache 已就绪 */
export function preloadMaterialGraphTexture(url: string): Promise<THREE.Texture> {
  const cached = cache.get(url)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        configureTexture(tex)
        cache.set(url, tex)
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}

/** compile 阶段同步取已加载贴图；未加载则返回 null（走 fallback 色） */
export function getMaterialGraphTexture(url: string): THREE.Texture | null {
  if (!url) return null
  return cache.get(url) ?? null
}

export function releaseMaterialGraphTexture(url: string) {
  const tex = cache.get(url)
  if (tex) {
    tex.dispose()
    cache.delete(url)
  }
}

export function revokeMaterialGraphBlobUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
