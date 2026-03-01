import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/ai-insights',
        destination: '/adli-insights',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
