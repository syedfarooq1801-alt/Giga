import { User } from 'firebase/auth';
import { 
  disableNetwork,
  enableNetwork,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { FirebaseStorage, StorageReference } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage, initFirebase } from '../utils/initFirebase';

// Ensure Firebase is initialized
initFirebase();

// Get Firebase service instances from the singleton pattern
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();
const storage = getFirebaseStorage();

// Persistence and offline capabilities are now handled by initFirebase.ts

// Configure Firestore to handle network errors gracefully
const configureFirestoreNetwork = async () => {
  // Wait a short delay to ensure Firebase is fully initialized
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    console.log('Configuring Firestore network...');
    
    // First try to disable network to reset any existing connections
    try {
      await disableNetwork(db);
      console.log('Successfully disabled Firestore network temporarily');
    } catch (disableErr) {
      // Non-critical error, can continue
      console.warn('Initial network disable failed (non-critical):', disableErr);
    }
    
    // Then re-enable network with proper error handling
    try {
      await enableNetwork(db);
      console.log('✅ Firestore network operations enabled successfully');
    } catch (enableErr: any) {
      // This is expected in some browsers/environments
      console.warn('⚠️ Firestore network setup error:', enableErr);
      
      // Detailed error logging to help diagnose issues
      if (enableErr.code) {
        console.warn(`Error code: ${enableErr.code}`);
      }
      
      if (enableErr.message) {
        console.warn(`Error message: ${enableErr.message}`);
      }
      
      // If we get a 400 Bad Request error when trying to connect, stay in offline mode
      if (
        enableErr.code === 'failed-precondition' || 
        (enableErr.message && (
          enableErr.message.includes('400') || 
          enableErr.message.includes('Bad Request') ||
          enableErr.message.includes('fetch')
        )) ||
        (enableErr.name && enableErr.name === 'FirebaseError')
      ) {
        console.log('🔄 Staying in offline-only mode due to connection issues');
        console.log('💡 This is normal when using Firestore in certain environments.');
        console.log('📱 Your app will still work with local data and will sync when possible.');
      }
    }
  } catch (error) {
    console.warn('❌ Could not configure Firestore network:', error);
  }
};

// Execute the network configuration
configureFirestoreNetwork();

// Helper functions for offline data handling
export const saveToLocalStorage = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
};

export const loadFromLocalStorage = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    
    // Parse the data
    const parsedData = JSON.parse(data);
    
    // Convert timestamp objects back to Firestore Timestamp objects
    const convertTimestamps = (obj: any): any => {
      if (!obj) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => convertTimestamps(item));
      }
      
      if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          // Check if the object looks like a Firestore timestamp
          if (obj[key] && 
              typeof obj[key] === 'object' && 
              obj[key].seconds !== undefined && 
              obj[key].nanoseconds !== undefined) {
            // Convert to Firestore Timestamp
            obj[key] = new Timestamp(obj[key].seconds, obj[key].nanoseconds);
          } else if (typeof obj[key] === 'object') {
            // Recursively process nested objects
            obj[key] = convertTimestamps(obj[key]);
          }
        });
      }
      
      return obj;
    };
    
    return convertTimestamps(parsedData) as T;
  } catch (error) {
    console.error('Error loading from local storage:', error);
    return null;
  }
};

// Helper function for safely adding documents to Firestore with local fallback
export const safeAddDoc = async <T extends { id: string }>(collectionName: string, data: T): Promise<string> => {
  // Set a timeout for Firestore operations to prevent hanging
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Firestore operation timed out')), 5000);
  });
  
  try {
    console.log(`Attempting to add document to ${collectionName}...`);
    
    // Try to add to Firestore first with a timeout
    const collectionRef = collection(db, collectionName);
    
    // Use Promise.race to implement timeout
    const docRef = await Promise.race([
      addDoc(collectionRef, data),
      timeoutPromise
    ]) as any;
    
    console.log(`✅ Document successfully added to ${collectionName} with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    // Log detailed error information
    console.warn(`⚠️ Failed to add document to ${collectionName}, using local fallback:`);
    console.warn(`Error code: ${error.code || 'unknown'}`);
    console.warn(`Error message: ${error.message || 'No message'}`);
    
    // If we get a 400 Bad Request error, log additional information
    if (error.message && (error.message.includes('400') || error.message.includes('Bad Request'))) {
      console.warn('This is likely due to network configuration issues with Firestore.');
    }
    
    // Save to local storage as fallback
    const localKey = `${collectionName}_${data.id}`;
    await saveToLocalStorage(localKey, data);
    console.log(`💾 Document saved to local storage with key: ${localKey}`);
    
    // Also save to a list of pending uploads to sync later when connection is restored
    const pendingUploadsKey = `pending_uploads_${collectionName}`;
    const pendingUploads = await loadFromLocalStorage<string[]>(pendingUploadsKey) || [];
    pendingUploads.push(data.id);
    await saveToLocalStorage(pendingUploadsKey, pendingUploads);
    console.log(`📋 Added to pending uploads list for future sync`);
    
    return data.id;
  }
};

// Export all Firebase services
export { auth, db, storage };
