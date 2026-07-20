/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@mcap/core',
    '@mcap/browser',
    '@foxglove/wasm-lz4',
    '@foxglove/wasm-zstd',
  ],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Emscripten 打包的 foxglove wasm 需作为静态资源输出，否则 Webpack 会解析 wasm 内的 `import "a"` 报错
    config.module.rules.unshift({
      test: /\.wasm$/,
      include: /node_modules[\\/]@foxglove/,
      type: 'asset/resource',
    })

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    return config
  },
}

export default nextConfig
