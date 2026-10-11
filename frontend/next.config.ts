import type { NextConfig } from 'next';
import path from 'path';

/**
 * DOCKER_STANDALONE=1 → trace only this package (Liara image).
 * Otherwise monorepo root (local/CI workspace).
 */
const tracingRoot =
  process.env.DOCKER_STANDALONE === '1'
    ? path.join(__dirname)
    : path.resolve(__dirname, '../');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: tracingRoot,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
