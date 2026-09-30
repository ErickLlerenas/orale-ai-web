/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["pdfjs-dist", "read-excel-file"] },
};

export default nextConfig;
