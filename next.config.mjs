/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "read-excel-file", "@napi-rs/canvas"],
    // PDF.js loads its worker and optional native canvas at runtime.
    // Include them explicitly in the serverless bank function.
    outputFileTracingExcludes: { "*": ["./.data/**/*"] },
    outputFileTracingIncludes: {
      "/contadores/bank": [
        "./node_modules/pdfjs-dist/legacy/build/pdf*.mjs",
        "./node_modules/@napi-rs/canvas/**/*",
        "./node_modules/@napi-rs/canvas-*/**/*",
      ],
    },
  },
};

export default nextConfig;
