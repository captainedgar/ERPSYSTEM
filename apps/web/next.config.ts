import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  transpilePackages: ['@comercia/ui'],
};

export default nextConfig;
