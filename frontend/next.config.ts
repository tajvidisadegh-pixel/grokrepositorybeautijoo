import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // ESLint runs during `next build` (issue #37 item 10).
  // Do not set ignoreDuringBuilds: true — CI and production builds must surface lint errors.
  outputFileTracingRoot: path.resolve(__dirname, '../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
