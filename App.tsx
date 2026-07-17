import React, { useEffect } from 'react';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/contexts/FirebaseAuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { ConversationProvider } from './src/contexts/ConversationContext';
import Toast from 'react-native-toast-message';
import { initFirebase } from './src/utils/initFirebase';

// Enable screens for better performance
import { enableScreens } from 'react-native-screens';
enableScreens();

// Initialize Firebase once at app startup
initFirebase();

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
