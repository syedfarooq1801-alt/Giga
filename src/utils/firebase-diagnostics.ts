import { Platform } from 'react-native';
import { getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from './firebase-app';

/**
 * Utility function to diagnose common Firebase issues
 * Call this function from your app to get detailed diagnostics in the console
 */
export const runFirebaseDiagnostics = async () => {
  console.log('=== FIREBASE DIAGNOSTICS ===');
  
  // Check if Firebase is initialized
  try {
    const apps = getApps();
    console.log(`Firebase initialization status: ${apps.length > 0 ? 'Initialized' : 'Not initialized'}`);
    
    if (apps.length > 0) {
      const app = getApp();
      console.log('Firebase app name:', app.name);
      console.log('Firebase options:', app.options);
    } else {
      console.error('Firebase is not initialized. Make sure initFirebase() is called before any Firebase services.');
    }
  } catch (error) {
    console.error('Error checking Firebase initialization:', error);
  }
  
  // Check Auth status
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    console.log('Auth instance created successfully.');
    
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('User is signed in:');
      console.log('- UID:', currentUser.uid);
      console.log('- Email:', currentUser.email);
      console.log('- Phone:', currentUser.phoneNumber);
      console.log('- Provider ID:', currentUser.providerData[0]?.providerId);
      
      // Generate profileId using the same logic as in AuthContext
      const providerId = currentUser.providerData[0]?.providerId || 'unknown_provider';
      const profileId = `${currentUser.uid}_${providerId}`;
      console.log('- Generated profileId:', profileId);
    } else {
      console.log('No user is currently signed in.');
    }
  } catch (error) {
    console.error('Error checking Auth status:', error);
  }
  
  // Check Firestore access
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    console.log('Firestore instance created successfully.');
    
    // Try to access a collection
    try {
      const userProfilesSnapshot = await getDocs(collection(db, 'user_profiles'));
      console.log(`Successfully accessed 'user_profiles' collection. Documents count: ${userProfilesSnapshot.size}`);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        console.error('Firestore permission denied. This is likely due to your security rules.');
        console.log('Please update your Firestore security rules to allow access to the necessary collections.');
      } else {
        console.error('Error accessing Firestore collection:', error);
      }
    }
  } catch (error) {
    console.error('Error checking Firestore access:', error);
  }
  
  console.log('=== END DIAGNOSTICS ===');
};

/**
 * Call this function to test your Firestore security rules
 * @param collection The collection to test access to
 * @param operation The operation to test (read, write)
 */
export const testFirestoreRules = async (collectionPath: string, operation: 'read' | 'write') => {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    
    if (operation === 'read') {
      try {
        const snapshot = await getDocs(collection(db, collectionPath));
        console.log(`Successfully read from '${collectionPath}'. Documents count: ${snapshot.size}`);
        return true;
      } catch (error: any) {
        console.error(`Error reading from '${collectionPath}':`, error.message);
        return false;
      }
    } else {
      // Write operation would go here
      console.log('Write operation test not implemented yet');
      return false;
    }
  } catch (error) {
    console.error('Error testing Firestore rules:', error);
    return false;
  }
};
