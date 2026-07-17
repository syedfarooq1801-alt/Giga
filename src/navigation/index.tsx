import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatScreen from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// Add the spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

type MainTabParamList = {
  Chat: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  const { isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#000' : '#fff',
          borderTopColor: isDark ? '#404040' : '#ddd',
        },
        tabBarActiveTintColor: isDark ? '#0095f6' : '#1a237e',
        tabBarInactiveTintColor: isDark ? '#666' : '#9fa8da',
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const LoadingScreen = ({ isDark }: { isDark: boolean }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100%',
    backgroundColor: isDark ? '#000' : '#fff'
  }}>
    <div 
      style={{
        width: '40px',
        height: '40px',
        border: `3px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderTopColor: isDark ? '#fff' : '#000',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  </div>
);

export const Navigation = () => {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  // Reset initial loading after first render
  React.useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setIsInitialLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Show loading screen during initial load
  if (isInitialLoading) {
    return <LoadingScreen isDark={isDark} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          cardStyle: { backgroundColor: isDark ? '#000' : '#fff' },
          // This ensures smooth transitions between auth states
          animationEnabled: false,
        }}
      >
        {user ? (
          <Stack.Screen 
            name="Main" 
            component={MainTabs} 
            options={{
              // Prevent going back to auth screen
              gestureEnabled: false,
            }}
          />
        ) : (
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen} 
            options={{
              cardStyle: { backgroundColor: isDark ? '#000' : '#fff' },
              // Prevent going back to main screen when logged out
              gestureEnabled: false,
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};