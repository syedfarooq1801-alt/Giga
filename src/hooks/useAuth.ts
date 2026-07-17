import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, User, UserCredential, updateProfile } from 'firebase/auth';
import { getFirebaseAuth } from '../utils/initFirebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

export interface AuthSession {
  user: User | null;
  profileId: string | null;
}

export const useAuth = (): {
  session: AuthSession;
  signIn: (email: string, password: string) => Promise<{ user: User | null; profileId: string | null; error: any }>
  signUp: (email: string, password: string, userData: { name: string; username: string }) => Promise<{ user: User | null; profileId: string | null; error: any }>
  signOut: () => Promise<void>;
  clearLocalChats: () => Promise<void>;
  loading: boolean;
} => {
  const [session, setSession] = useState<AuthSession>({ user: null, profileId: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const providerId = user.providerData[0]?.providerId || 'local';
        const profileId = `${user.uid}_${providerId}`;
        setSession({ user, profileId });
        AsyncStorage.setItem('profileId', profileId);
      } else {
        setSession({ user: null, profileId: null });
        AsyncStorage.removeItem('profileId');
      }
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const user = userCredential.user;
      const providerId = user.providerData[0]?.providerId || 'local';
      const profileId = `${user.uid}_${providerId}`;
      await AsyncStorage.setItem('profileId', profileId);
      setSession({ user, profileId });
      return { user, profileId, error: null };
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || String(error)
      });
      setSession({ user: null, profileId: null });
      return { user: null, profileId: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: { name: string; username: string }) => {
    setLoading(true);
    try {
      const userCredential: UserCredential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      const user = userCredential.user;
      // Optionally update display name
      if (user && userData.name) {
        await updateProfile(user, { displayName: userData.name });
      }
      const providerId = user.providerData[0]?.providerId || 'local';
      const profileId = `${user.uid}_${providerId}`;
      await AsyncStorage.setItem('profileId', profileId);
      setSession({ user, profileId });
      return { user, profileId, error: null };
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || String(error)
      });
      setSession({ user: null, profileId: null });
      return { user: null, profileId: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem('profileId');
      await firebaseSignOut(getFirebaseAuth());
      setSession({ user: null, profileId: null });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const clearLocalChats = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem('localChats');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    signIn,
    signUp,
    signOut,
    clearLocalChats,
    loading
  };
};
