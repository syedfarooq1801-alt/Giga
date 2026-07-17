@echo off
echo Stopping any running Metro bundlers...
taskkill /f /im node.exe 2>nul

echo Clearing Metro cache...
rd /s /q "%APPDATA%\Expo\metro-cache" 2>nul
rd /s /q "%TEMP%\metro-bundler-cache-*" 2>nul
rd /s /q "node_modules\.cache" 2>nul

echo Setting environment variables...
set EXPO_PUBLIC_PLATFORM=web
set EXPO_NO_HERMES_WEB=1
set EXPO_WEB_WEBPACK_CONFIG_PATH=webpack.config.js

echo Starting Expo web server with custom webpack config...
npx expo start --web --clear

echo Done!
