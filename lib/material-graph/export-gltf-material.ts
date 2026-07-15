import type { MaterialGraph, MaterialGraphNode } from './types'

export type GltfExportErrorCode =
  | 'noPrincipled'
  | 'unsupportedBaseColor'
  | 'unsupportedFloat'
  | 'embedFailed'

export class GltfExportError extends Error {
  constructor(
    public readonly code: GltfExportErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'GltfExportError'
  }
}

type Rgba = [number, number, number, number]
type Rgb = [number, number, number]

function getInputNode(
  graph: MaterialGraph,
  nodeId: string,
  portId: string,
): MaterialGraphNode | null {
  const edge = graph.edges.find((e) => e.to.nodeId === nodeId && e.to.port === portId)
  if (!edge) return null
  return graph.nodes.find((n) => n.id === edge.from.nodeId) ?? null
}

function parseHexRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0').slice(0, 6)
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return [1, 1, 1]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function mulRgb(a: Rgb, b: Rgb): Rgb {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]
}

function isTextureNode(n: MaterialGraphNode): boolean {
  return n.type === 'texture'
}

function isColorNode(n: MaterialGraphNode): boolean {
  return n.type === 'color'
}

interface BakedBaseColor {
  factor: Rgba
  /** 已有 imageUrl 时异步嵌入 */
  textureUrl?: string
  textureFileName?: string
}

/** 仅支持：color | texture | texture×color（及可交换端口）| 两色 multiply */
function bakeBaseColor(node: MaterialGraphNode, graph: MaterialGraph): BakedBaseColor {
  if (isColorNode(node)) {
    const [r, g, b] = parseHexRgb(String(node.data.hex ?? '#ffffff'))
    return { factor: [r, g, b, 1] }
  }

  if (isTextureNode(node)) {
    const imageUrl = String(node.data.imageUrl ?? '')
    const [r, g, b] = parseHexRgb(String(node.data.fallbackHex ?? '#ffffff'))
    if (imageUrl) {
      return {
        factor: [1, 1, 1, 1],
        textureUrl: imageUrl,
        textureFileName: String(node.data.fileName ?? 'albedo'),
      }
    }
    return { factor: [r, g, b, 1] }
  }

  if (node.type === 'multiply') {
    const a = getInputNode(graph, node.id, 'a')
    const b = getInputNode(graph, node.id, 'b')
    if (!a || !b) {
      if (a) return bakeBaseColor(a, graph)
      if (b) return bakeBaseColor(b, graph)
      return { factor: [1, 1, 1, 1] }
    }

    const tex = isTextureNode(a) ? a : isTextureNode(b) ? b : null
    const col = isColorNode(a) ? a : isColorNode(b) ? b : null
    if (tex && col) {
      const tint = parseHexRgb(String(col.data.hex ?? '#ffffff'))
      const imageUrl = String(tex.data.imageUrl ?? '')
      if (imageUrl) {
        return {
          factor: [tint[0], tint[1], tint[2], 1],
          textureUrl: imageUrl,
          textureFileName: String(tex.data.fileName ?? 'albedo'),
        }
      }
      const fallback = parseHexRgb(String(tex.data.fallbackHex ?? '#ffffff'))
      const mixed = mulRgb(fallback, tint)
      return { factor: [mixed[0], mixed[1], mixed[2], 1] }
    }

    if (isColorNode(a) && isColorNode(b)) {
      const mixed = mulRgb(
        parseHexRgb(String(a.data.hex ?? '#ffffff')),
        parseHexRgb(String(b.data.hex ?? '#ffffff')),
      )
      return { factor: [mixed[0], mixed[1], mixed[2], 1] }
    }

    throw new GltfExportError('unsupportedBaseColor')
  }

  throw new GltfExportError('unsupportedBaseColor')
}

function resolveScalar(
  graph: MaterialGraph,
  principledId: string,
  portId: string,
  fallback: number,
): number {
  const input = getInputNode(graph, principledId, portId)
  if (!input) return fallback
  if (input.type === 'float') return Number(input.data.value ?? fallback)
  throw new GltfExportError('unsupportedFloat')
}

async function urlToDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const res = await fetch(url)
  if (!res.ok) throw new GltfExportError('embedFailed')
  const blob = await res.blob()
  const mime = blob.type || guessMimeFromName(url) || 'image/png'
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,${btoa(binary)}`
}

function guessMimeFromName(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.png')) return 'image/png'
  return null
}

/** 单位平面（XZ），便于 Blender 导入后可见 */
function buildUnitPlaneBuffers(): {
  bufferUri: string
  byteLength: number
  positionByteOffset: number
  positionByteLength: number
  normalByteOffset: number
  normalByteLength: number
  uvByteOffset: number
  uvByteLength: number
  indexByteOffset: number
  indexByteLength: number
} {
  const positions = new Float32Array([-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5])
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])

  const positionBytes = new Uint8Array(positions.buffer)
  const normalBytes = new Uint8Array(normals.buffer)
  const uvBytes = new Uint8Array(uvs.buffer)
  const indexBytes = new Uint8Array(indices.buffer)

  const parts = [positionBytes, normalBytes, uvBytes, indexBytes]
  let total = 0
  for (const p of parts) total += p.byteLength
  // pad to 4-byte alignment between sections
  const align = (n: number) => (4 - (n % 4)) % 4
  const padPos = align(positionBytes.byteLength)
  const padNor = align(normalBytes.byteLength)
  const padUv = align(uvBytes.byteLength)

  const positionByteOffset = 0
  const positionByteLength = positionBytes.byteLength
  const normalByteOffset = positionByteOffset + positionByteLength + padPos
  const normalByteLength = normalBytes.byteLength
  const uvByteOffset = normalByteOffset + normalByteLength + padNor
  const uvByteLength = uvBytes.byteLength
  const indexByteOffset = uvByteOffset + uvByteLength + padUv
  const indexByteLength = indexBytes.byteLength
  const byteLength = indexByteOffset + indexByteLength

  const bin = new Uint8Array(byteLength)
  bin.set(positionBytes, positionByteOffset)
  bin.set(normalBytes, normalByteOffset)
  bin.set(uvBytes, uvByteOffset)
  bin.set(indexBytes, indexByteOffset)

  let binary = ''
  for (let i = 0; i < bin.length; i += 0x8000) {
    binary += String.fromCharCode(...bin.subarray(i, i + 0x8000))
  }

  return {
    bufferUri: `data:application/octet-stream;base64,${btoa(binary)}`,
    byteLength,
    positionByteOffset,
    positionByteLength,
    normalByteOffset,
    normalByteLength,
    uvByteOffset,
    uvByteLength,
    indexByteOffset,
    indexByteLength,
  }
}

/**
 * MaterialGraph → 可导入 Blender 的最小 glTF 2.0（平面 + 烘焙 PBR 材质）。
 * 支持：color / texture / texture×color；metalness / roughness / opacity 标量。
 */
export async function buildGltfFromMaterialGraph(graph: MaterialGraph): Promise<object> {
  const principled = graph.nodes.find((n) => n.type === 'principled')
  if (!principled) throw new GltfExportError('noPrincipled')

  const data = principled.data
  let base: BakedBaseColor = { factor: [1, 1, 1, 1] }
  const baseInput = getInputNode(graph, principled.id, 'baseColor')
  if (baseInput) base = bakeBaseColor(baseInput, graph)

  const metallicFactor = resolveScalar(
    graph,
    principled.id,
    'metalness',
    Number(data.metalness ?? 0),
  )
  const roughnessFactor = resolveScalar(
    graph,
    principled.id,
    'roughness',
    Number(data.roughness ?? 0.5),
  )
  let opacity = 1
  try {
    opacity = resolveScalar(graph, principled.id, 'opacity', 1)
  } catch {
    opacity = 1
  }

  let emissiveFactor: Rgb = [0, 0, 0]
  const emissiveIn = getInputNode(graph, principled.id, 'emissive')
  if (emissiveIn?.type === 'color') {
    emissiveFactor = parseHexRgb(String(emissiveIn.data.hex ?? '#000000'))
  }

  const images: Array<{ uri: string; name?: string }> = []
  const textures: Array<{ sampler: number; source: number }> = []
  let baseColorTexture: { index: number; texCoord: number } | undefined

  if (base.textureUrl) {
    try {
      const uri = await urlToDataUri(base.textureUrl)
      images.push({ uri, name: base.textureFileName })
      textures.push({ sampler: 0, source: 0 })
      baseColorTexture = { index: 0, texCoord: 0 }
    } catch {
      throw new GltfExportError('embedFailed')
    }
  }

  const alpha = Math.min(1, Math.max(0, opacity))
  base.factor[3] = alpha

  const plane = buildUnitPlaneBuffers()
  const name = graph.name || 'Material'

  return {
    asset: {
      version: '2.0',
      generator: 'Web-Scene-Composer Material Graph',
    },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: `${name}_Preview`, mesh: 0 }],
    meshes: [
      {
        name: 'PreviewPlane',
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              TEXCOORD_0: 2,
            },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name,
        pbrMetallicRoughness: {
          baseColorFactor: base.factor,
          metallicFactor,
          roughnessFactor,
          ...(baseColorTexture ? { baseColorTexture } : {}),
        },
        emissiveFactor,
        alphaMode: alpha < 0.999 ? 'BLEND' : 'OPAQUE',
        doubleSided: true,
      },
    ],
    ...(textures.length
      ? {
          textures,
          images,
          samplers: [
            {
              magFilter: 9729,
              minFilter: 9987,
              wrapS: 10497,
              wrapT: 10497,
            },
          ],
        }
      : {}),
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        max: [0.5, 0, 0.5],
        min: [-0.5, 0, -0.5],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 4,
        type: 'VEC2',
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: 6,
        type: 'SCALAR',
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: plane.positionByteOffset,
        byteLength: plane.positionByteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: plane.normalByteOffset,
        byteLength: plane.normalByteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: plane.uvByteOffset,
        byteLength: plane.uvByteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: plane.indexByteOffset,
        byteLength: plane.indexByteLength,
        target: 34963,
      },
    ],
    buffers: [
      {
        byteLength: plane.byteLength,
        uri: plane.bufferUri,
      },
    ],
  }
}

export async function downloadMaterialGraphGltf(graph: MaterialGraph, filename?: string) {
  const gltf = await buildGltfFromMaterialGraph(graph)
  const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'model/gltf+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename ?? `${graph.name.replace(/[^\w.-]+/g, '_') || 'material'}.gltf`
  a.click()
  URL.revokeObjectURL(url)
}
