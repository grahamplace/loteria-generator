/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
    localPatterns: [
      { pathname: '/api/**' },
      { pathname: '/**' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
