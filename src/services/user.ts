import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, DocumentData } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import { Timestamp } from 'firebase/firestore';

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  defaultPersonality: string;
  saveChats: boolean;
  notificationEnabled: boolean;
  lastUpdated: Date | Timestamp | any; // Using any to handle serverTimestamp()
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'lastUpdated'> = {
  theme: 'system',
  defaultPersonality: 'swag',
  saveChats: true,
  notificationEnabled: true,
};

// Get current user ID
export const getCurrentUserId = (): string => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

// Get user settings
export const getUserSettings = async (): Promise<UserSettings> => {
  try {
    const userId = getCurrentUserId();
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      return userDoc.data() as UserSettings;
    } else {
      // Create default settings for new user
      const defaultSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
        lastUpdated: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', userId), defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

// Update user settings
export const updateUserSettings = async (updates: Partial<UserSettings>): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw error;
  }
};

// Subscribe to user settings changes
export const subscribeToUserSettings = (
  callback: (settings: UserSettings) => void
) => {
  const userId = getCurrentUserId();
  const userRef = doc(db, 'users', userId);

  return onSnapshot(userRef, (doc: DocumentData) => {
    if (doc.exists()) {
      callback(doc.data() as UserSettings);
    }
  });
};
