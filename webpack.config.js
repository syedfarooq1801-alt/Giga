const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Configure module resolution
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,

    },
    fallback: {
      ...config.resolve.fallback,
      'crypto': require.resolve('crypto-browserify'),
      'stream': require.resolve('stream-browserify'),
      'buffer': require.resolve('buffer/'),
      'util': require.resolve('util/'),
      'process': require.resolve('process/browser'),
    },
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
  };

  // Add plugins for polyfills
  const webpack = require('webpack');
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );

  // Configure module rules
  config.module.rules.push(
    {
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    }
  );

  return config;
};
