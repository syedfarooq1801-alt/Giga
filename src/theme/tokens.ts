import { Platform } from 'react-native';

// "Saaf Baat" (clean talk) — minimal design system.
// One ink, one paper, one mustard accent; personas shift only the accent.

export const COLORS_LIGHT = {
  paper: '#faf8f5',
  surface: '#f1ede6',
  ink: '#1c1b18',
  sub: '#8a8377',
  line: 'rgba(28,27,24,0.08)',
  accent: '#b8790e',
  accentContrast: '#faf8f5',
  danger: '#c0392b',
  dangerBg: 'rgba(192,57,43,0.10)',
  success: '#10B981',
  warning: '#F59E0B',
};

export const COLORS_DARK = {
  paper: '#1a1815',
  surface: '#221f1a',
  ink: '#f5f1ea',
  sub: '#a39c8d',
  line: 'rgba(245,241,234,0.10)',
  accent: '#e0a13e',
  accentContrast: '#1a1815',
  danger: '#e0685a',
  dangerBg: 'rgba(224,104,90,0.16)',
  success: '#10B981',
  warning: '#F59E0B',
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const RADIUS = { sm: 8, md: 14, lg: 16, pill: 999 };

export const TYPOGRAPHY = {
  fontFamily: Platform.select({
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
  size: { xs: 12, sm: 14, base: 16, md: 18, lg: 20, xl: 24, xxl: 32 },
  letterSpacingTight: -0.5,
  monoFontFamily: Platform.select({
    web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    default: 'monospace',
  }) as string,
};

// Subtle, accent-only persona theming: the shell (paper/surface/ink) never
// changes — only this hue shifts, harmonized with the mustard base rather
// than reused raw from the backend's saturated flat-UI palette.
export const PERSONA_ACCENTS: Record<string, { light: string; dark: string }> = {
  swag_bhai: { light: '#b8790e', dark: '#e0a13e' }, // app's own base — default persona, no override
  ceo_bhai: { light: '#34586F', dark: '#6C97B4' }, // slate-blue
  roast_bhai: { light: '#B23A22', dark: '#E06B45' }, // fiery red-orange
  vidhyarthi_bhai: { light: '#6B5590', dark: '#9C82BE' }, // muted violet
  jugadu_bhai: { light: '#52702B', dark: '#83A758' }, // olive-sage
};

export function getPersonaAccent(personalityId: string, isDark: boolean): string {
  const entry = PERSONA_ACCENTS[personalityId];
  if (entry) return isDark ? entry.dark : entry.light;
  return isDark ? COLORS_DARK.accent : COLORS_LIGHT.accent;
}
