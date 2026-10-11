import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Monorepo: trace from repo root (was working until Docker experiments)
  outputFileTracingRoot: path.resolve(__dirname, '../'),
  eslint: {
    // Do not block production image on lint warnings
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
