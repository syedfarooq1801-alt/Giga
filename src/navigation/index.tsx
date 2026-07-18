import React, { useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { NavigationContainer, LinkingOptions, useIsFocused } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatScreen from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import { SharedConversationScreen } from '../screens/SharedConversationScreen';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Shared: { token?: string };
};

type MainTabParamList = {
  Chat: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    // Auth/Main are mutually exclusive based on login state and are never
    // both in the tree at once, so neither needs (or should have) an
    // explicit '' mapping here -- that created an ambiguous root path that
    // resolved to whichever screen happened to be declared first (Shared),
    // even when logged in. Only the one path that needs to be unambiguous
    // is mapped explicitly; everything else falls back to default
    // initial-route resolution from whichever screen is actually mounted.
    screens: {
      Shared: 'shared/:token',
      Main: {
        screens: {
          Chat: 'chat',
          Settings: 'settings',
        },
      },
    },
  },
};

// react-navigation/bottom-tabs v6 has no built-in cross-fade between tabs
// (screens just swap instantly) -- this wraps each tab's screen so
// switching Chat <-> Settings eases in instead of snapping. useIsFocused
// (not the mount lifecycle) drives it since both tab screens stay mounted
// simultaneously under the default tab navigator.
const FadeInScreen: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isFocused = useIsFocused();
  const opacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isFocused, opacity]);
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
};

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.sub,
      }}
    >
      <Tab.Screen
        name="Chat"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      >
        {(props) => (
          <FadeInScreen>
            <ChatScreen {...props} />
          </FadeInScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {(props) => (
          <FadeInScreen>
            <SettingsScreen {...props} />
          </FadeInScreen>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const LoadingScreen = ({ backgroundColor, accentColor }: { backgroundColor: string; accentColor: string }) => (
  <View style={[styles.loading, { backgroundColor }]}>
    <ActivityIndicator size="large" color={accentColor} />
  </View>
);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const Navigation = () => {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
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
    return <LoadingScreen backgroundColor={colors.paper} accentColor={colors.accent} />;
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.paper },
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
              cardStyle: { backgroundColor: colors.paper },
              // Prevent going back to main screen when logged out
              gestureEnabled: false,
            }}
          />
        )}
        {/* Reachable regardless of auth state -- a cold-load of /shared/:token
            must resolve here even when user is null, otherwise the linking
            config has nowhere to route an unauthenticated deep link.
            Declared after Main/Auth (not first) so root '/' with no
            explicit path match falls back to whichever of those is
            actually mounted, not to this screen by default-first-child. */}
        <Stack.Screen name="Shared" component={SharedConversationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
