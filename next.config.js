/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for server-side rendering
  reactStrictMode: true,
  images: {
    domains: ['vercel.com'], // Add domains you need for external images
  },
  // Set rendering mode for pages
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // Disable static page optimization globally
  swcMinify: true,
}

module.exports = nextConfig;