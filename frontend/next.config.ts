import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a minimal standalone server for the Docker runtime stage.
  output: 'standalone',
};

export default nextConfig;
