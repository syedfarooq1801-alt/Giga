import { DefaultTheme } from '@react-navigation/native';

export const theme = {
  isDark: true,
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    // Primary colors
    primary: '#1E3A8A',      // Dark blue
    primaryLight: '#3B82F6',  // Lighter blue
    primaryDark: '#0F172A',   // Darker blue
    
    // Background colors
    background: '#0F172A',   // Main background
    backgroundSecondary: '#1E293B', // Cards, inputs
    backgroundTertiary: '#334155',  // Hover states
    
    // Text colors
    text: '#F8FAFC',        // Primary text
    textSecondary: '#94A3B8', // Secondary text
    textTertiary: '#64748B',  // Tertiary text
    textInverted: '#0F172A', // Text on colored backgrounds
    
    // UI Colors
    border: '#334155',       // Borders and dividers
    borderLight: '#475569',  // Lighter borders
    inputBg: '#1E293B',      // Input backgrounds
    inputBorder: '#475569',  // Input borders
    card: '#1E293B',         // Card backgrounds
    notification: '#3B82F6', // Notification dots
    
    // Message bubbles
    userMessage: '#3B82F6',  // User message bubble
    botMessage: '#1E293B',   // Bot message bubble
    
    // Status colors
    success: '#10B981',      // Success green
    error: '#EF4444',        // Error red
    warning: '#F59E0B',      // Warning yellow
    info: '#3B82F6',         // Info blue
    
    // Personality colors
    personalitySwag: '#3B82F6',
    personalityRoast: '#EF4444',
    personalityMotivational: '#10B981',
    personalityFriendly: '#F59E0B',
    personalityProfessional: '#8B5CF6',
    personalityJugadu: '#F97316',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
  },
  textVariants: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#F8FAFC',
    },
    h2: {
      fontSize: 24,
      fontWeight: '600',
      color: '#F8FAFC',
    },
    body: {
      fontSize: 16,
      color: '#E2E8F0',
    },
    caption: {
      fontSize: 12,
      color: '#94A3B8',
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  },
};

export type Theme = typeof theme;

export const useTheme = () => theme;

declare module '@react-navigation/native' {
  export function useTheme(): Theme;
}
