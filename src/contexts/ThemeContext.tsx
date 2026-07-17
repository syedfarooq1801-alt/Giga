import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define your color palettes
const lightColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F5F6FA',
  backgroundTertiary: '#E5E7EB',
  text: '#000000',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  textInverted: '#FFFFFF',
  primary: '#1a365d',
  primaryLight: '#3B82F6',
  primaryDark: '#0F172A',
  botMessageBackground: '#F0F0F0',
  userMessageBackground: '#1a365d',
  botMessageText: '#000000',
  userMessageText: '#FFFFFF',
  timestamp: '#666666',
  inputContainer: '#ECECEC',
  inputBorder: '#C0C0C0',
  input: '#000000',
  card: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#D1D5DB',
  notification: '#3B82F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  dropdown: {
    background: '#FFFFFF',
    border: '#CCCCCC',
    text: '#000000',
  },
  disabled: '#A0A0A0',
  personalitySwag: '#3B82F6',
  personalityRoast: '#EF4444',
  personalityMotivational: '#10B981',
  personalityFriendly: '#F59E0B',
  personalityProfessional: '#8B5CF6',
  personalityJugadu: '#F97316',
};

const darkColors = {
  background: '#121212',
  backgroundSecondary: '#1E293B',
  backgroundTertiary: '#334155',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverted: '#0F172A',
  primary: '#1a365d',
  primaryLight: '#3B82F6',
  primaryDark: '#0F172A',
  botMessageBackground: '#333333',
  userMessageBackground: '#1a365d',
  botMessageText: '#FFFFFF',
  userMessageText: '#FFFFFF',
  timestamp: '#AAAAAA',
  inputContainer: '#3C3C3C',
  inputBorder: '#505050',
  input: '#FFFFFF',
  card: '#1E293B',
  border: '#334155',
  borderLight: '#475569',
  notification: '#3B82F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  dropdown: {
    background: '#2C2C2C',
    border: '#555555',
    text: '#FFFFFF',
  },
  disabled: '#555555',
  personalitySwag: '#3B82F6',
  personalityRoast: '#EF4444',
  personalityMotivational: '#10B981',
  personalityFriendly: '#F59E0B',
  personalityProfessional: '#8B5CF6',
  personalityJugadu: '#F97316',
};

export type ColorPaletteType = typeof lightColors;

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  colors: ColorPaletteType;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(systemColorScheme || 'light');

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          setTheme(savedTheme as ThemeType);
        } else {
          // If no saved theme, use system preference
          setTheme(systemColorScheme || 'light');
          // Save the initial theme preference
          await AsyncStorage.setItem('theme', systemColorScheme || 'light');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        setTheme(systemColorScheme || 'light'); // Fallback to system or light
      }
    };
    loadTheme();
  }, [systemColorScheme]); // Rerun if systemColorScheme changes

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const currentColors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, colors: currentColors, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 