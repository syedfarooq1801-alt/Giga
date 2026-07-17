import React, { useEffect } from 'react';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/contexts/FirebaseAuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Platform } from 'react-native';
import { ConversationProvider } from './src/contexts/ConversationContext';
import Toast from 'react-native-toast-message';
import { initFirebase } from './src/utils/initFirebase';

// Enable screens for better performance
import { enableScreens } from 'react-native-screens';
enableScreens();

// Initialize Firebase once at app startup
initFirebase();

// The browser's default scrollbar (thick, square arrow buttons) looks
// broken against the app's minimal design -- react-native-web has no style
// prop for it, so it's styled once globally via injected CSS. Colors are
// neutral/low-opacity so they read fine on both light and dark paper.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    * { scrollbar-width: thin; scrollbar-color: rgba(128,128,128,0.35) transparent; }
    *::-webkit-scrollbar { width: 8px; height: 8px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background-color: rgba(128,128,128,0.35); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
    *::-webkit-scrollbar-thumb:hover { background-color: rgba(128,128,128,0.55); }
    *::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
  `;
  document.head.appendChild(style);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ConversationProvider>
            <View style={{ flex: 1, minHeight: 0, height: '100%' }}>
              <Navigation />
              <Toast />
            </View>
          </ConversationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
