import { Platform } from 'react-native';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';

// We'll use dynamic imports for native Firebase to avoid bundling issues
const getFirestoreNative = async () => {
  if (Platform.OS !== 'web') {
    try {
      // Dynamic import for native platforms
      const firestoreModule = await import('@react-native-firebase/firestore');
      return firestoreModule.default;
    } catch (error) {
      console.error('Error importing @react-native-firebase/firestore:', error);
      return null;
    }
  }
  // Return null for web platform
  return null;
};

// Import the Firebase app initialization function from the dedicated utility file
import { getFirebaseApp } from '../utils/firebase-app';

// Define conversation types
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  personality?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: string;
  personality: string;
  username?: string; // Username of the conversation owner
}

/**
 * Creates or updates a user profile in Firestore
 * @param uid Firebase user ID
 * @param profileId Custom profile ID (uid + provider)
 * @param userData User data to store
 */
export const saveUserProfile = async (
  uid: string,
  profileId: string,
  userData: {
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    username: string;
    loginProviderId: string;
    createdAt: number;
    updatedAt: number;
  }
): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      // Web implementation
      const app = getFirebaseApp();
      // Ensure app is not undefined before getting Firestore
      if (!app) {
        throw new Error('Firebase app is not initialized');
      }
      const db = getFirestore(app);
      
      // Save to user_profiles collection
      const userProfileRef = doc(db, 'user_profiles', profileId);
      await setDoc(userProfileRef, userData);
      
      // Save username to usernames collection for uniqueness check
      const usernameRef = doc(db, 'usernames', userData.username.toLowerCase());
      await setDoc(usernameRef, {
        uid,
        profileId,
        username: userData.username,
        createdAt: userData.createdAt
      });
      
      console.log('User profile saved successfully (web)');
    } else {
      // Native implementation
      const firestoreNative = await getFirestoreNative();
      if (firestoreNative === null) {
        throw new Error('Firestore native module not available');
      }
      
      // Save to user_profiles collection
      await firestoreNative()
        .collection('user_profiles')
        .doc(profileId)
        .set(userData);
      
      // Save username to usernames collection for uniqueness check
      await firestoreNative()
        .collection('usernames')
        .doc(userData.username.toLowerCase())
        .set({
          uid,
          profileId,
          username: userData.username,
          createdAt: userData.createdAt
        });
      
      console.log('User profile saved successfully (native)');
    }
  } catch (error: unknown) {
    // Check if this is a permission error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPermissionError = errorMessage.includes('permission') || errorMessage.includes('insufficient');
    
    if (isPermissionError) {
      console.warn('Firestore permission error when saving user profile:', errorMessage);
      console.log('This is likely due to Firestore security rules. The user was created in Firebase Auth but profile data could not be saved to Firestore.');
      // Don't throw an error for permission issues - this allows the sign-up to succeed
      // even if Firestore writes fail due to security rules
      return;
    }
    
    // For other errors, log and throw
    console.error('Error saving user profile:', error);
    throw new Error('Failed to save user profile');
  }
};

/**
 * Checks if a username is available and saves it if it is
 * @param profileId The profile ID to associate with the username
 * @param username The username to check and save
 */
export const saveUsername = async (profileId: string, username: string): Promise<void> => {
  try {
    // First check if username is already taken
    const isAvailable = await isUsernameAvailable(username);
    
    if (!isAvailable) {
      throw new Error(`Username "${username}" is already taken`);
    }
    
    // Username is available, save it
    if (Platform.OS === 'web') {
      const app = getFirebaseApp();
      // Ensure app is not undefined
      if (!app) {
        throw new Error('Firebase app is not initialized');
      }
      const db = getFirestore(app);
      
      // Save to usernames collection
      await setDoc(doc(db, 'usernames', username.toLowerCase()), {
        profileId,
        username,
        createdAt: Date.now(),
      });
    } else {
      const firestoreNative = await getFirestoreNative();
      if (firestoreNative === null) {
        throw new Error('Firestore native module not available');
      }
      
      await firestoreNative()
        .collection('usernames')
        .doc(username.toLowerCase())
        .set({
          profileId,
          username,
          createdAt: Date.now(),
        });
    }
    
    console.log(`Username '${username}' saved successfully`);
  } catch (error) {
    console.error('Error saving username:', error);
    throw new Error('Failed to save username');
  }
};

/**
 * Checks if a username is available
 * @param username The username to check
 * @returns True if the username is available, false otherwise
 */
export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  return !(await checkUsernameExists(username));
};

export const checkUsernameExists = async (username: string): Promise<boolean> => {
  if (!username) return false;
  
  try {
    if (Platform.OS === 'web') {
      // Web implementation
      const app = getFirebaseApp();
      // Ensure app is not undefined before getting Firestore
      if (!app) {
        throw new Error('Firebase app is not initialized');
      }
      const db = getFirestore(app);
      
      const usernameRef = doc(db, 'usernames', username.toLowerCase());
      const usernameDoc = await getDoc(usernameRef);
      
      return usernameDoc.exists();
    } else {
      // Check if username exists in usernames collection
      const firestoreNative = await getFirestoreNative();
      if (firestoreNative === null) {
        throw new Error('Firestore native module not available');
      }
      
      const usernameDoc = await firestoreNative()
        .collection('usernames')
        .doc(username.toLowerCase())
        .get();
      
      // In native Firebase, exists is a boolean property, not a function
      return Boolean(usernameDoc.exists);
    }
  } catch (error) {
    console.error('Error checking if username exists:', error);
    // In case of error, return false to allow the user to proceed
    // This is a fail-open approach for username checking
    return false;
  }
};

/**
 * Gets a user profile by profileId
 * @param profileId The profile ID to get
 * @returns The user profile data or null if not found
 */
export const getUserProfile = async (profileId: string): Promise<any | null> => {
  try {
    if (Platform.OS === 'web') {
      const firestore = getFirestore(getFirebaseApp());
      const docRef = doc(firestore, 'user_profiles', profileId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        console.log('No user profile found with ID:', profileId);
        return null;
      }
    } else {
      // For native platforms
      const firestore = await getFirestoreNative();
      if (!firestore) {
        throw new Error('Firestore not available on this platform');
      }
      
      const docSnap = await firestore()
        .collection('user_profiles')
        .doc(profileId)
        .get();
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        console.log('No user profile found with ID:', profileId);
        return null;
      }
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Save a conversation to Firestore
 * @param conversation The conversation to save
 * @param username The username of the conversation owner
 */
export const saveConversationToFirestore = async (conversation: Conversation, username: string) => {
  try {
    // Ensure the conversation has the username
    const conversationWithUsername = {
      ...conversation,
      username
    };
    
    if (Platform.OS === 'web') {
      const firestore = getFirestore(getFirebaseApp());
      
      // Check if conversation already exists
      if (conversation.id && conversation.id !== 'new') {
        // Update existing conversation
        const conversationRef = doc(firestore, 'conversations', conversation.id);
        await updateDoc(conversationRef, conversationWithUsername);
        return conversation.id;
      } else {
        // Create new conversation
        const conversationsCollection = collection(firestore, 'conversations');
        const docRef = await addDoc(conversationsCollection, conversationWithUsername);
        return docRef.id;
      }
    } else {
      // For native platforms
      const firestore = await getFirestoreNative();
      if (!firestore) {
        throw new Error('Firestore not available on this platform');
      }
      
      // Check if conversation already exists
      if (conversation.id && conversation.id !== 'new') {
        // Update existing conversation
        await firestore().collection('conversations').doc(conversation.id).update(conversationWithUsername);
        return conversation.id;
      } else {
        // Create new conversation
        const docRef = await firestore().collection('conversations').add(conversationWithUsername);
        return docRef.id;
      }
    }
  } catch (error: any) {
    // Check if this is a permission error
    const errorMessage = error?.message || String(error);
    const isPermissionError = errorMessage.includes('permission-denied') || 
                             errorMessage.includes('Permission denied');
    
    if (isPermissionError) {
      console.warn('Firestore permission error when saving conversation. This is likely due to Firestore security rules:', errorMessage);
      console.log('The conversation will be saved locally but not synced to the cloud.');
      // Return the original ID so the app can continue with local storage
      return conversation.id;
    } else {
      console.error('Error saving conversation to Firestore:', error);
      throw error;
    }
  }
};

/**
 * Get all conversations for a specific username
 * @param username The username to get conversations for
 */
export const getConversationsForUser = async (username: string) => {
  try {
    if (Platform.OS === 'web') {
      const firestore = getFirestore(getFirebaseApp());
      const conversationsCollection = collection(firestore, 'conversations');
      const q = query(
        conversationsCollection,
        where('username', '==', username),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const conversations: Conversation[] = [];
      
      querySnapshot.forEach((doc) => {
        conversations.push({
          id: doc.id,
          ...doc.data() as Omit<Conversation, 'id'>
        });
      });
      
      return conversations;
    } else {
      // For native platforms
      const firestore = await getFirestoreNative();
      if (!firestore) {
        throw new Error('Firestore not available on this platform');
      }
      
      const querySnapshot = await firestore()
        .collection('conversations')
        .where('username', '==', username)
        .orderBy('timestamp', 'desc')
        .get();
      
      const conversations: Conversation[] = [];
      
      querySnapshot.forEach((doc) => {
        conversations.push({
          id: doc.id,
          ...doc.data() as Omit<Conversation, 'id'>
        });
      });
      
      return conversations;
    }
  } catch (error: any) {
    // Check if this is a permission error
    const errorMessage = error?.message || String(error);
    const isPermissionError = errorMessage.includes('permission-denied') || 
                             errorMessage.includes('Permission denied');
    
    if (isPermissionError) {
      console.warn('Firestore permission error when getting conversations. This is likely due to Firestore security rules:', errorMessage);
      console.log('Falling back to local storage for conversations.');
      // Return an empty array to allow the app to continue with local storage
      return [];
    } else {
      console.error('Error getting conversations for user:', error);
      throw error;
    }
  }
};

/**
 * Update specific fields in a conversation in Firestore
 * @param conversationId The ID of the conversation to update
 * @param updates The fields to update
 */
export const updateConversationInFirestore = async (conversationId: string, updates: Partial<Conversation>) => {
  try {
    // Get the Firebase app
    const app = getFirebaseApp();
    if (!app) {
      console.error('Firebase app not initialized');
      return;
    }

    if (Platform.OS === 'web') {
      // Web implementation
      const db = getFirestore(app);
      const conversationRef = doc(db, 'conversations', conversationId);
      
      // Get the current conversation to ensure it exists
      const conversationDoc = await getDoc(conversationRef);
      if (!conversationDoc.exists()) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Update only the specified fields
      await updateDoc(conversationRef, updates);
      console.log(`Conversation ${conversationId} updated successfully in Firestore`);
    } else {
      // Native implementation
      const firestore = await getFirestoreNative();
      if (!firestore) {
        console.error('Native Firestore not available');
        return;
      }
      
      // Get the current conversation to ensure it exists
      const conversationDoc = await firestore().collection('conversations').doc(conversationId).get();
      if (!conversationDoc.exists) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Update only the specified fields
      await firestore().collection('conversations').doc(conversationId).update(updates);
      console.log(`Conversation ${conversationId} updated successfully in Firestore`);
    }
  } catch (error) {
    console.error('Error updating conversation in Firestore:', error);
    throw error;
  }
};

/**
 * Delete a conversation from Firestore
 * @param conversationId The ID of the conversation to delete
 */
export const deleteConversationFromFirestore = async (conversationId: string) => {
  try {
    if (Platform.OS === 'web') {
      const firestore = getFirestore(getFirebaseApp());
      const conversationRef = doc(firestore, 'conversations', conversationId);
      await deleteDoc(conversationRef);
    } else {
      // For native platforms
      const firestore = await getFirestoreNative();
      if (!firestore) {
        throw new Error('Firestore not available on this platform');
      }
      
      await firestore().collection('conversations').doc(conversationId).delete();
    }
  } catch (error: any) {
    // Check if this is a permission error
    const errorMessage = error?.message || String(error);
    const isPermissionError = errorMessage.includes('permission-denied') || 
                             errorMessage.includes('Permission denied');
    
    if (isPermissionError) {
      console.warn('Firestore permission error when deleting conversation. This is likely due to Firestore security rules:', errorMessage);
      console.log('The conversation will be deleted locally but may remain in the cloud.');
      // Don't throw the error so the app can continue with local storage operations
      return;
    } else {
      console.error('Error deleting conversation from Firestore:', error);
      throw error;
    }
  }
};
