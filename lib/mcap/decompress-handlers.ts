import type { McapTypes } from '@mcap/core'

function unwrapDefaultExport<T extends object>(mod: T & { default?: T }): T {
  return mod.default ?? mod
}

type Lz4Api = {
  isLoaded: Promise<unknown>
  (src: Uint8Array, destSize: number): Uint8Array
}

type ZstdApi = {
  isLoaded: Promise<unknown>
  decompress: (src: Uint8Array, destSize: number) => Uint8Array
}

/**
 * 浏览器端 MCAP 解压器（仅 lz4 + zstd）。
 * 不引入 @mcap/support / wasm-bz2，避免 Next.js Webpack 无法解析 emscripten `env` 模块。
 * nuScenes MCAP 使用 lz4 压缩。
 */
export async function loadBrowserDecompressHandlers(): Promise<
  McapTypes.DecompressHandlers | undefined
> {
  if (typeof window === 'undefined') return undefined

  try {
    const [lz4Mod, zstdMod] = await Promise.all([
      import('@foxglove/wasm-lz4'),
      import('@foxglove/wasm-zstd'),
    ])

    const lz4Api = unwrapDefaultExport(lz4Mod as unknown as Lz4Api & { default?: Lz4Api }) as Lz4Api
    const zstdApi = unwrapDefaultExport(zstdMod as unknown as ZstdApi & { default?: ZstdApi }) as ZstdApi

    await lz4Api.isLoaded
    await zstdApi.isLoaded

    return {
      lz4: (buffer, decompressedSize) =>
        new Uint8Array(lz4Api(buffer, Number(decompressedSize))),
      zstd: (buffer, decompressedSize) =>
        new Uint8Array(zstdApi.decompress(buffer, Number(decompressedSize))),
    }
  } catch (err) {
    console.warn('[MCAP] lz4/zstd 解压器加载失败，仅支持未压缩 MCAP', err)
    return undefined
  }
}
