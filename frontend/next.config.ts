import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // In Docker (context = frontend/) tracing root is this app dir.
  // In monorepo local builds, parent still works if present.
  outputFileTracingRoot: path.join(__dirname),
  // Lint noise must not block Liara production image builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Typecheck runs in CI; don't fail docker image on pre-existing strict noise.
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
