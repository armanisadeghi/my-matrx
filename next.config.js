const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
  async rewrites() {
    return [
      // Rewrite for games directory - only for paths without extensions
      {
        source: '/games/:path((?!.*\\.).*)',
        destination: '/games/:path.html',
      },
      // Rewrite for iopbm directory
      {
        source: '/iopbm/:path((?!.*\\.).*)',
        destination: '/iopbm/:path.html',
      },
      // Rewrite for samples directory
      {
        source: '/samples/:path((?!.*\\.).*)',
        destination: '/samples/:path.html',
      },
    ]
  },
}

module.exports = nextConfig
