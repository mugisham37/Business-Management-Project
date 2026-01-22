import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features
  experimental: {
    // Enable server components
    serverComponentsExternalPackages: ['@apollo/client'],
    // Enable optimized package imports
    optimizePackageImports: ['@apollo/client', 'graphql', 'zustand'],
    // Enable turbo mode for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // TypeScript configuration
  typescript: {
    // Enable strict type checking
    ignoreBuildErrors: false,
  },

  // Image optimization
  images: {
    // Enable image optimization
    formats: ['image/webp', 'image/avif'],
    // Add domains for external images if needed
    domains: [],
    // Enable responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable lazy loading by default
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  
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
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },

  // Webpack configuration for advanced code splitting
  webpack: (config, { dev, isServer, webpack }) => {
    // Optimize bundle in production
    if (!dev && !isServer) {
      // Advanced code splitting configuration
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          // Framework chunk (React, Next.js)
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            priority: 40,
            enforce: true,
          },
          
          // Apollo GraphQL chunk
          apollo: {
            test: /[\\/]node_modules[\\/]@apollo[\\/]/,
            name: 'apollo',
            chunks: 'all',
            priority: 30,
            enforce: true,
          },
          
          // GraphQL chunk
          graphql: {
            test: /[\\/]node_modules[\\/](graphql|graphql-ws)[\\/]/,
            name: 'graphql',
            chunks: 'all',
            priority: 25,
            enforce: true,
          },
          
          // State management chunk
          state: {
            test: /[\\/]node_modules[\\/](zustand|immer)[\\/]/,
            name: 'state',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          
          // Utilities chunk
          utils: {
            test: /[\\/]node_modules[\\/](clsx|class-variance-authority|zod|jose)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 15,
            enforce: true,
          },
          
          // Default vendor chunk for remaining node_modules
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            enforce: false,
          },
          
          // Common chunk for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            enforce: false,
          },
        },
      };

      // Module concatenation for better tree shaking
      config.optimization.concatenateModules = true;
      
      // Enable module ids optimization
      config.optimization.moduleIds = 'deterministic';
      config.optimization.chunkIds = 'deterministic';
    }

    // Bundle analyzer in development
    if (dev && process.env.ANALYZE === 'true') {
      const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          analyzerPort: 8888,
          openAnalyzer: true,
        })
      );
    }

    // Optimize imports
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize lodash imports
      'lodash': 'lodash-es',
    };

    return config;
  },

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Redirects for better UX
  async redirects() {
    return [
      // Redirect root to dashboard for authenticated users
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: 'auth-token',
          },
        ],
      },
    ];
  },

  // Rewrites for API proxying if needed
  async rewrites() {
    return [
      // Add rewrites as needed for API proxying
    ];
  },
};

export default nextConfig;
