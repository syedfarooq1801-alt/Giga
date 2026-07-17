import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  enableIndexedDbPersistence, 
  initializeFirestore,
  FirestoreSettings
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '../config/firebase';
import { Platform } from 'react-native';

// Singleton instances to prevent multiple initializations
let initialized = false;
let firebaseApp: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

// Helper function to check if Firebase is properly initialized
export function isFirebaseInitialized(): boolean {
  return initialized && firebaseApp !== null;
}

// Export Firebase services for direct access
export function getFirebaseAuth(): Auth {
  if (!isFirebaseInitialized()) {
    initFirebase();
  }
  // Return the singleton instance if available, otherwise create it
  if (authInstance) {
    return authInstance;
  }
  // Fallback to creating a new instance if needed
  authInstance = getAuth(firebaseApp!);
  return authInstance;
}

export function getFirebaseFirestore(): Firestore {
  if (!isFirebaseInitialized()) {
    initFirebase();
  }
  // Return the singleton instance if available, otherwise create it
  if (firestoreInstance) {
    return firestoreInstance;
  }
  // Fallback to creating a new instance if needed
  firestoreInstance = getFirestore(firebaseApp!);
  return firestoreInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!isFirebaseInitialized()) {
    initFirebase();
  }
  // Return the singleton instance if available, otherwise create it
  if (storageInstance) {
    return storageInstance;
  }
  // Fallback to creating a new instance if needed
  storageInstance = getStorage(firebaseApp!);
  return storageInstance;
}

export function initFirebase() {
  // Only initialize once
  if (initialized && firebaseApp) {
    console.log('Firebase already initialized');
    return firebaseApp;
  }

  try {
    // Check if Firebase app is already initialized
    if (getApps().length) {
      console.log('Firebase Web SDK already initialized, getting existing app');
      firebaseApp = getApp();
    } else {
      console.log('Initializing Firebase Web SDK');
      // Initialize Firebase app
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    // Initialize Auth if not already initialized
    if (!authInstance) {
      authInstance = getAuth(firebaseApp);
    }
    
    // Initialize Firestore if not already initialized
    if (!firestoreInstance) {
      try {
        // Initialize Firestore with explicit settings to avoid 400 Bad Request errors
        // Create settings object with type assertion to avoid TypeScript errors
        // These settings are known to work with Firestore even if some aren't in the type definitions
        const firestoreSettings: FirestoreSettings = {
          // Force long polling instead of WebSockets to avoid 400 Bad Request errors
          experimentalForceLongPolling: true,
          // Disable auto-detection as we're explicitly using long polling
          experimentalAutoDetectLongPolling: false,
          // Ignore undefined properties to prevent serialization errors
          ignoreUndefinedProperties: true,
          // Add cache size configuration for better performance
          cacheSizeBytes: 50 * 1024 * 1024 // 50 MB
        };
        
        // Create enhanced settings with all necessary properties to fix 400 errors
        // These settings are known to work with Firestore even if some aren't in the TypeScript definitions
        const enhancedSettings = {
          ...firestoreSettings,
          // Critical settings to fix 400 Bad Request errors
          useFetchStreams: false,
          // Force REST API for all operations including Write
          experimentalForceRestTransport: true,
          // Disable WebSocket/WebChannel completely
          experimentalAutoDetectLongPolling: false,
          // Ensure we're using long polling for all operations
          experimentalForceLongPolling: true
        } as any;
        
        // Get existing Firestore instance with modified settings
        firestoreInstance = initializeFirestore(firebaseApp, enhancedSettings);
        console.log('Initialized Firestore with custom settings');
        
        // Do NOT enable IndexedDB persistence for Expo/React Native/Web
        // Only use memory cache for maximum compatibility
        // If you want to enable persistence for web, uncomment below and test carefully
        // if (typeof window !== 'undefined' && firestoreInstance) {
        //   enableIndexedDbPersistence(firestoreInstance)
        //     .then(() => {
        //       console.log('Firestore persistence enabled successfully');
        //     })
        //     .catch((err) => {
        //       console.warn('Firestore persistence setup error (non-critical):', err.message);
        //     });
        // }
      } catch (error) {
        console.error('Error configuring Firestore:', error);
        // Fallback to standard initialization if custom settings fail
        firestoreInstance = getFirestore(firebaseApp);
      }
    }
    
    // Initialize Storage if not already initialized
    if (!storageInstance) {
      storageInstance = getStorage(firebaseApp);
    }
    
    initialized = true;
    console.log('Firebase Web SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}