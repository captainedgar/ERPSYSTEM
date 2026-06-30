import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  eslint: {
    // ESLint runs as a dedicated Turborepo task before delivery/deployment.
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  transpilePackages: ['@comercia/ui'],
};

export default nextConfig;
