// Force canonical domain (www.gigabhai.com) on web
if (typeof window !== 'undefined' && window.location.hostname === 'gigabhai.com') {
  window.location.href = window.location.href.replace('//gigabhai.com', '//www.gigabhai.com');
}

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Platform } from 'react-native';
import { firebaseConfig } from './firebase';

import { FirebaseApp } from 'firebase/app';

// Singleton instances to prevent multiple initializations
let initialized = false;
let firebaseApp: FirebaseApp | null = null;
let firestoreInstance: any = null;
let authInstance: any = null;
let storageInstance: any = null;

export const initFirebase = () => {
  // Only initialize once
  if (initialized && firebaseApp) {
    console.log('Firebase already initialized');
    return firebaseApp;
  }

  if (Platform.OS === 'web') {
    // Web initialization
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
      
      // Initialize Auth only if not already initialized
      if (!authInstance) {
        authInstance = getAuth(firebaseApp);
      }
      
      // Initialize Firestore only if not already initialized
      if (!firestoreInstance) {
        // Check if Firestore is already initialized
        try {
          firestoreInstance = getFirestore(firebaseApp);
          console.log('Using existing Firestore instance');
        } catch (e) {
          // If not, initialize with settings
          const firestoreSettings = {
            // Use persistent cache with multiple tab support
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            }),
            // Force REST transport instead of WebChannel to avoid 400 Bad Request errors
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: true,
            useFetchStreams: false,
            transport: 'rest'
          };
          
          console.log('Creating new Firestore instance with settings');
          firestoreInstance = initializeFirestore(firebaseApp, firestoreSettings);
          
          // Configure Firestore persistence only once
          try {
            // Only attempt to enable persistence if it hasn't been tried before
            console.log('Setting up Firestore persistence');
            enableIndexedDbPersistence(firestoreInstance)
              .then(() => {
                console.log('Firestore persistence enabled successfully');
              })
              .catch((err: Error) => {
                // This is expected in some browsers/environments
                console.warn('Firestore persistence setup error (non-critical):', err);
              });
          } catch (persistenceError) {
            console.warn('Could not configure Firestore persistence:', persistenceError);
          }
        }
      }
      
      // Initialize Storage only if not already initialized
      if (!storageInstance) {
        storageInstance = getStorage(firebaseApp);
      }
      
      // Connect to emulators if in development mode (only once)
      if (process.env.NODE_ENV === 'development' && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true' && !initialized) {
        try {
          connectFirestoreEmulator(firestoreInstance, 'localhost', 8080);
          connectAuthEmulator(authInstance, 'http://localhost:9099');
          connectStorageEmulator(storageInstance, 'localhost', 9199);
          console.log('Connected to Firebase emulators');
        } catch (emulatorError) {
          console.error('Failed to connect to Firebase emulators:', emulatorError);
        }
      }
      
      console.log('Firebase Web SDK initialized successfully');
      initialized = true;
      return firebaseApp;
    } catch (error) {
      console.error('Error initializing Firebase Web SDK:', error);
      // Continue without crashing the app
      console.warn('Application will continue with limited functionality');
      return null;
    }
  } else {
    // Native initialization
    try {
      // Dynamically import the native Firebase SDK to avoid bundling issues
      const nativeFirebaseModule = require('@react-native-firebase/app').default;
      
      // Check if Firebase is already initialized
      if (nativeFirebaseModule.apps.length === 0) {
        firebaseApp = nativeFirebaseModule.initializeApp(firebaseConfig);
        
        // Ensure Firestore is initialized with proper settings
        const firestore = require('@react-native-firebase/firestore').default();
        
        // Enable offline persistence for native with better error handling
        try {
          firestore.settings({
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            persistence: true
          });
          
          // Configure Firestore for native to use more reliable connection settings
          firestore.settings({
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
            persistence: true,
            // Use a longer timeout for operations
            host: 'firestore.googleapis.com',
            ssl: true,
            ignoreUndefinedProperties: true
          });
          console.log('Firestore native settings configured for reliability');
        } catch (persistenceError) {
          console.warn('Could not enable Firestore persistence:', persistenceError);
          // Continue without persistence but still try to disable network
          try {
            firestore.settings({
              persistence: false,
              // Use a longer timeout for operations
              host: 'firestore.googleapis.com',
              ssl: true,
              ignoreUndefinedProperties: true
            });
            console.log('Firestore native fallback settings configured');
          } catch (settingsError) {
            console.warn('Could not configure Firestore for native:', settingsError);
          }
        }
        // Store the instances to avoid re-initialization
        if (!firestoreInstance) {
          firestoreInstance = require('@react-native-firebase/firestore').default();
        }
        if (!authInstance) {
          authInstance = require('@react-native-firebase/auth').default();
        }
        if (!storageInstance) {
          storageInstance = require('@react-native-firebase/storage').default();
        }
        
        console.log('Firebase Native SDK initialized successfully');
        initialized = true;
        return firebaseApp;
      } else {
        console.log('Firebase Native SDK already initialized');
        firebaseApp = nativeFirebaseModule.app();
        
        // Get existing instances if already initialized
        if (!firestoreInstance) {
          firestoreInstance = require('@react-native-firebase/firestore').default();
        }
        if (!authInstance) {
          authInstance = require('@react-native-firebase/auth').default();
        }
        if (!storageInstance) {
          storageInstance = require('@react-native-firebase/storage').default();
        }
        
        initialized = true;
        return firebaseApp;
      }
    } catch (error) {
      console.error('Error initializing Firebase Native SDK:', error);
      console.warn('Application will continue with limited functionality');
      return null;
    }
  }
};

// Helper function to check if Firebase is properly initialized
export const isFirebaseInitialized = (): boolean => {
  return initialized && firebaseApp !== null;
};

// Export Firebase services for direct access
export const getFirebaseAuth = () => {
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
};

export const getFirebaseFirestore = () => {
  if (!isFirebaseInitialized()) {
    initFirebase();
  }
  // Return the singleton instance if available, otherwise create it
  if (firestoreInstance) {
    return firestoreInstance;
  }
  // Fallback to creating a new instance if needed
  try {
    firestoreInstance = getFirestore(firebaseApp!);
  } catch (e) {
    // If getFirestore fails, initialize with settings
    const firestoreSettings = {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false
    };
    firestoreInstance = initializeFirestore(firebaseApp!, firestoreSettings);
  }
  return firestoreInstance;
};

export const getFirebaseStorage = () => {
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
};
