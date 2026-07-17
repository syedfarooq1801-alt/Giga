import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../contexts/FirebaseAuthContext';
import EmailAuthScreen from './EmailAuthScreen';

type AuthScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Auth'>;
};

const AuthScreen = ({ navigation }: AuthScreenProps) => {
  const { isDark } = useTheme();
  const { user, loading } = useAuth();

  // Simple redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  }, [user, navigation]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <EmailAuthScreen />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AuthScreen;
