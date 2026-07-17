import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export interface ThemeColors {
  container: string;
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  error: string;
  success: string;
  inputBackground: string;
  buttonBackground: string;
  buttonText: string;
  placeholderText: string;
  borderColor: string;
}

const lightTheme: ThemeColors = {
  container: '#FFFFFF',
  background: '#F5F5F5',
  text: '#000000',
  primary: '#007AFF',
  secondary: '#5856D6',
  accent: '#FF2D55',
  error: '#FF3B30',
  success: '#34C759',
  inputBackground: '#FFFFFF',
  buttonBackground: '#007AFF',
  buttonText: '#FFFFFF',
  placeholderText: '#8E8E93',
  borderColor: '#C7C7CC',
};

const darkTheme: ThemeColors = {
  container: '#000000',
  background: '#1C1C1E',
  text: '#FFFFFF',
  primary: '#0A84FF',
  secondary: '#5E5CE6',
  accent: '#FF375F',
  error: '#FF453A',
  success: '#30D158',
  inputBackground: '#2C2C2E',
  buttonBackground: '#0A84FF',
  buttonText: '#FFFFFF',
  placeholderText: '#8E8E93',
  borderColor: '#3A3A3C',
};

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(colorScheme === 'dark');
  const [colors, setColors] = useState<ThemeColors>(isDark ? darkTheme : lightTheme);

  useEffect(() => {
    setIsDark(colorScheme === 'dark');
    setColors(colorScheme === 'dark' ? darkTheme : lightTheme);
  }, [colorScheme]);

  return { isDark, colors };
};
