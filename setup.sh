#!/bin/bash

# Install dependencies
npm install @react-native-async-storage/async-storage @react-native-picker/picker @react-navigation/bottom-tabs @react-navigation/native expo expo-av expo-file-system expo-image-picker expo-status-bar firebase react react-native react-native-gesture-handler react-native-safe-area-context react-native-screens react-native-vector-icons

# Install dev dependencies
npm install --save-dev @babel/core @types/react typescript

# Create necessary directories
mkdir -p src/components src/screens src/navigation src/types src/constants

echo "Setup complete! You can now run 'npm start' to start the development server." 