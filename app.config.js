module.exports = {
  name: "GigaBhAI",
  slug: "gigabhai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: false,
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    }
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    // Disable Hermes for web - Hermes is not fully supported on web
    jsEngine: undefined,
    output: {
      filename: "app.bundle.js"
    },
    // Add MIME types for web
    build: {

    }
  },
  extra: {
    eas: {
      projectId: "your-project-id"
    }
  }
};
