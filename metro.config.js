const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for all file extensions
config.resolver.sourceExts = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'cjs',
  'mjs',
  'json',
];

// Ensure proper MIME types for web
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url.includes('.bundle') || req.url.includes('AppEntry')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
      return middleware(req, res, next);
    };
  },
};

// Disable Hermes for web platform
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
      ...(process.env.EXPO_PUBLIC_PLATFORM === 'web' ? { engine: undefined } : {}),
    },
  }),
};



module.exports = config;