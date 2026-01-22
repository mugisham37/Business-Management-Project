import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features
  experimental: {
    // Enable server components
    serverComponentsExternalPackages: ['@apollo/client'],
    // Enable optimized package imports
    optimizePackageImports: ['@apollo/client', 'graphql'],
  },

  // TypeScript configuration
  typescript: {
    // Enable strict type checking
    ignoreBuildErrors: false,
  },

  // ESLint configuration - removed as it's not supported in Next.js config
  // Use eslint.config.mjs instead

  // Image optimization
  images: {
    // Enable image optimization
    formats: ['image/webp', 'image/avif'],
    // Add domains for external images if needed
    domains: [],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle in production
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          apollo: {
            test: /[\\/]node_modules[\\/]@apollo[\\/]/,
            name: 'apollo',
            chunks: 'all',
          },
          graphql: {
            test: /[\\/]node_modules[\\/]graphql[\\/]/,
            name: 'graphql',
            chunks: 'all',
          },
        },
      };
    }

    return config;
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Redirects for better UX
  async redirects() {
    return [
      // Add redirects as needed
    ];
  },

  // Rewrites for API proxying if needed
  async rewrites() {
    return [
      // Add rewrites as needed
    ];
  },
};

export default nextConfig;
