/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  async rewrites() {
    return [
      {
        // Proxy API requests through the same origin to avoid CORS issues,
        // especially when the frontend is accessed via https tunnels.
        source: "/api/:path*",
        destination:
          "https://zeruva-backend-production.up.railway.app/api/:path*",
      },
    ];
  },

  webpack: (config) => {
    // Some walletconnect deps pull in pino tooling that expects optional deps.
    // We don't need pretty logging in the Next bundles.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
