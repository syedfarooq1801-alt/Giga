@echo off
echo Stopping any running Metro bundlers...
taskkill /f /im node.exe 2>nul

echo Clearing Metro cache...
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul

echo Setting environment variables...
set EXPO_PUBLIC_PLATFORM=web
set EXPO_NO_HERMES_WEB=1
set EXPO_CLEAR_CACHE=1

echo Starting Expo web server with clean cache...
npx expo start --web --clear
