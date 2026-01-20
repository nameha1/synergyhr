/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  experimental: {
    serverComponentsExternalPackages: ['face-api.js'],
  },
};

export default nextConfig;
