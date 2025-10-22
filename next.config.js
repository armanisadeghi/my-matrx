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
      // Rewrite for games directory
      {
        source: '/games/:path',
        destination: '/games/:path.html',
      },
      // Rewrite for iopbm directory
      {
        source: '/iopbm/:path',
        destination: '/iopbm/:path.html',
      },
      // Rewrite for samples directory
      {
        source: '/samples/:path',
        destination: '/samples/:path.html',
      },
      // Generic rewrite for any path in public that doesn't already have an extension
      {
        source: '/:path((?!.*\\.).*)',
        destination: '/:path.html',
      },
    ]
  },
}

module.exports = nextConfig
