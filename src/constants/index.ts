import { Platform } from 'react-native';

// Web build (Vercel): same-origin relative path, avoids CORS entirely.
// Native build (iOS/Android): backend lives on its own domain.
export const API_URL = Platform.OS === 'web' ? '' : 'https://api.gigabhai.com';
