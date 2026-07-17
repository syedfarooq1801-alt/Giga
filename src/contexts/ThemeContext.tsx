import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS_LIGHT, COLORS_DARK, SPACING, RADIUS, TYPOGRAPHY } from '../theme/tokens';

// Color palettes, remapped onto the "Saaf Baat" token system.
// Every existing key name is kept so nothing else in the app breaks —
// new code should prefer the clean token-named keys added at the bottom
// of each palette (paper/surface/ink/sub/line/accent/...).
const lightColors = {
  background: COLORS_LIGHT.paper,
  backgroundSecondary: COLORS_LIGHT.surface,
  backgroundTertiary: COLORS_LIGHT.surface,
  text: COLORS_LIGHT.ink,
  textSecondary: COLORS_LIGHT.sub,
  textTertiary: COLORS_LIGHT.sub,
  textInverted: COLORS_LIGHT.paper,
  primary: COLORS_LIGHT.accent,
  primaryLight: COLORS_LIGHT.accent,
  primaryDark: COLORS_LIGHT.accent,
  botMessageBackground: COLORS_LIGHT.surface,
  userMessageBackground: COLORS_LIGHT.ink,
  botMessageText: COLORS_LIGHT.ink,
  userMessageText: COLORS_LIGHT.paper,
  timestamp: COLORS_LIGHT.sub,
  inputContainer: COLORS_LIGHT.surface,
  inputBorder: COLORS_LIGHT.line,
  input: COLORS_LIGHT.ink,
  card: COLORS_LIGHT.surface,
  border: COLORS_LIGHT.line,
  borderLight: COLORS_LIGHT.line,
  notification: COLORS_LIGHT.accent,
  success: COLORS_LIGHT.success,
  error: COLORS_LIGHT.danger,
  warning: COLORS_LIGHT.warning,
  info: COLORS_LIGHT.accent,
  dropdown: {
    background: COLORS_LIGHT.surface,
    border: COLORS_LIGHT.line,
    text: COLORS_LIGHT.ink,
  },
  disabled: COLORS_LIGHT.sub,
  // Deprecated — nothing reads these today, kept only to avoid breaking any future accidental use.
  personalitySwag: '#3B82F6',
  personalityRoast: '#EF4444',
  personalityMotivational: '#10B981',
  personalityFriendly: '#F59E0B',
  personalityProfessional: '#8B5CF6',
  personalityJugadu: '#F97316',
  // Clean token-named keys — prefer these in new code.
  paper: COLORS_LIGHT.paper,
  surface: COLORS_LIGHT.surface,
  ink: COLORS_LIGHT.ink,
  sub: COLORS_LIGHT.sub,
  line: COLORS_LIGHT.line,
  accent: COLORS_LIGHT.accent,
  accentContrast: COLORS_LIGHT.accentContrast,
  danger: COLORS_LIGHT.danger,
  dangerBg: COLORS_LIGHT.dangerBg,
};

const darkColors = {
  background: COLORS_DARK.paper,
  backgroundSecondary: COLORS_DARK.surface,
  backgroundTertiary: COLORS_DARK.surface,
  text: COLORS_DARK.ink,
  textSecondary: COLORS_DARK.sub,
  textTertiary: COLORS_DARK.sub,
  textInverted: COLORS_DARK.paper,
  primary: COLORS_DARK.accent,
  primaryLight: COLORS_DARK.accent,
  primaryDark: COLORS_DARK.accent,
  botMessageBackground: COLORS_DARK.surface,
  userMessageBackground: COLORS_DARK.accent,
  botMessageText: COLORS_DARK.ink,
  userMessageText: COLORS_DARK.paper,
  timestamp: COLORS_DARK.sub,
  inputContainer: COLORS_DARK.surface,
  inputBorder: COLORS_DARK.line,
  input: COLORS_DARK.ink,
  card: COLORS_DARK.surface,
  border: COLORS_DARK.line,
  borderLight: COLORS_DARK.line,
  notification: COLORS_DARK.accent,
  success: COLORS_DARK.success,
  error: COLORS_DARK.danger,
  warning: COLORS_DARK.warning,
  info: COLORS_DARK.accent,
  dropdown: {
    background: COLORS_DARK.surface,
    border: COLORS_DARK.line,
    text: COLORS_DARK.ink,
  },
  disabled: COLORS_DARK.sub,
  personalitySwag: '#3B82F6',
  personalityRoast: '#EF4444',
  personalityMotivational: '#10B981',
  personalityFriendly: '#F59E0B',
  personalityProfessional: '#8B5CF6',
  personalityJugadu: '#F97316',
  paper: COLORS_DARK.paper,
  surface: COLORS_DARK.surface,
  ink: COLORS_DARK.ink,
  sub: COLORS_DARK.sub,
  line: COLORS_DARK.line,
  accent: COLORS_DARK.accent,
  accentContrast: COLORS_DARK.accentContrast,
  danger: COLORS_DARK.danger,
  dangerBg: COLORS_DARK.dangerBg,
};

export type ColorPaletteType = typeof lightColors;

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  colors: ColorPaletteType;
  toggleTheme: () => void;
  isDark: boolean;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  typography: typeof TYPOGRAPHY;
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
    <ThemeContext.Provider
      value={{
        theme,
        colors: currentColors,
        toggleTheme,
        isDark: theme === 'dark',
        spacing: SPACING,
        radius: RADIUS,
        typography: TYPOGRAPHY,
      }}
    >
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
