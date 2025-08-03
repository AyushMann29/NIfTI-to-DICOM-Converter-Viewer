/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enables React's Strict Mode, which helps identify potential problems in your app.
  reactStrictMode: true,

  // Configures the Next.js Image component to allow images from your deployed backend.
  // Replace 'your-service-name.onrender.com' with your actual backend hostname.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'your-service-name.onrender.com',
        port: '',
        pathname: '/uploads/**',
      },
    ],
  },

  // Custom Webpack configuration to solve build errors with server-side modules.
  webpack: (config) => {
    // This resolves the "Module not found: Can't resolve 'fs'" error.
    // It tells Webpack to provide empty modules for these Node.js built-ins
    // when building for the browser.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
};

module.exports = nextConfig;
