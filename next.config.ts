import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['cheerio'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
