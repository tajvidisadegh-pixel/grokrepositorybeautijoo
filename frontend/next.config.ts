import type { NextConfig } from 'next';
import path from 'path';

/**
 * DOCKER_STANDALONE=1 → package-local tracing (Liara Docker image).
 * Default → monorepo root (CI/local workspace) — product code unchanged.
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
