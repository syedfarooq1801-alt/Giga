import { Platform } from 'react-native';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { initFirebase } from '../config/initFirebase';

// Helper to get the Firebase app instance
export const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length) {
    return getApp();
  }
  return initFirebase(); // Use our initialization function
};
