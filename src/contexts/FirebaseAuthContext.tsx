import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';
import { getFirebaseAuth, getFirebaseFirestore, getFirebaseStorage, isFirebaseInitialized } from '../utils/initFirebase';

import {
  User,
  PhoneAuthProvider,
  ConfirmationResult,
  RecaptchaVerifier,
  reauthenticateWithCredential as firebaseReauthenticateWithCredential,
  getAuth,
  signInWithPhoneNumber,
  signInWithEmailAndPassword as firebaseSignInWithEmail,
  signOut as firebaseSignOut,
  ApplicationVerifier,
  UserCredential,
  EmailAuthProvider,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateEmail as firebaseUpdateEmail,
  createUserWithEmailAndPassword as firebaseSignUpWithEmail,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  DocumentData,
  enableIndexedDbPersistence,
  Timestamp
} from 'firebase/firestore';

import { getStorage } from 'firebase/storage';

// Get Firebase services using our improved initialization functions
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();
const storage = getFirebaseStorage();

// Check if Firebase is properly initialized
if (!isFirebaseInitialized()) {
  console.warn('Firebase may not be properly initialized. Some features may not work correctly.');
}

// Types
interface UserProfile extends DocumentData {
  id: string;
  email: string;
  displayName: string;
  username: string;
  photoURL?: string;
  phoneNumber?: string;
  createdAt: any; // Using any for Timestamp to avoid type conflicts
  updatedAt: any; // Using any for Timestamp to avoid type conflicts
}

interface AuthContextState {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: Error | null;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthContextType extends AuthContextState {
  signInWithPhone: (phoneNumber: string, applicationVerifier: ApplicationVerifier) => Promise<ConfirmationResult>;
  verifyCode: (confirmationResult: ConfirmationResult, code: string) => Promise<UserCredential>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Omit<UserProfile, 'createdAt' | 'updatedAt' | 'id'>>) => Promise<void>;
  updateEmail: (newEmail: string, password: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  reauthenticateWithCredential: (credential: any) => Promise<void>;
  isProfileComplete: () => boolean;
  getProfileId: (user: User) => string;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to create profile ID with provider isolation
const createProfileId = (user: User): string => {
  // Get the provider ID to isolate profiles by login method (email, phone, etc.)
  const providerId = user.providerData && user.providerData.length > 0 
    ? user.providerData[0].providerId 
    : 'default';
  
  // Create a profile ID that combines user ID and provider ID
  return `${user.uid}_${providerId}`;
};

// AuthProvider component
export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthContextState>({
    user: null,
    userProfile: null,
    loading: true,
    error: null
  });

  // Handle auth state changes
  // Helper function to save profile to local storage
  const saveProfileToLocalStorage = (userId: string, profile: UserProfile) => {
    try {
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile to local storage:', e);
    }
  };

  // Helper function to get profile from local storage
  const getProfileFromLocalStorage = (userId: string): UserProfile | null => {
    try {
      const storedProfile = localStorage.getItem(`user_profile_${userId}`);
      return storedProfile ? JSON.parse(storedProfile) as UserProfile : null;
    } catch (e) {
      console.warn('Failed to get profile from local storage:', e);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          // Create profile ID with better error handling
          const profileId = createProfileId(user);
          
          // First check if we have a cached profile in localStorage
          let userProfile = getProfileFromLocalStorage(profileId);
          
          // If we have a cached profile, use it immediately to improve UX
          if (userProfile) {
            console.log('Using cached profile from local storage');
            setState({
              user,
              userProfile,
              loading: false,
              error: null
            });
          } else {
            // Set loading state while we try to fetch from Firestore
            setState(prev => ({ ...prev, loading: true }));
          }
          
          // Try to get the profile from Firestore in the background
          let firestoreProfile: UserProfile | null = null;
          try {
            // Use a longer timeout for background fetch
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Firestore operation timed out')), 10000);
            });
            
            // Race between Firestore operation and timeout
            const profileDoc = await Promise.race([
              getDoc(doc(db, 'profiles', profileId)),
              timeoutPromise
            ]);
            
            firestoreProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;
            
            // If we got a profile from Firestore, update local storage and state
            if (firestoreProfile) {
              saveProfileToLocalStorage(profileId, firestoreProfile);
              
              // Only update state if it's different from what we already have
              if (!userProfile || JSON.stringify(userProfile) !== JSON.stringify(firestoreProfile)) {
                setState(prev => ({
                  ...prev,
                  userProfile: firestoreProfile,
                  loading: false
                }));
              }
            }
          } catch (firestoreError) {
            console.warn('Failed to fetch profile from Firestore:', firestoreError);
            // We already have a profile from localStorage or will create one below, so no need to handle this error
          }
          
          // If we don't have a profile from either source, create a minimal one
          if (!userProfile && !firestoreProfile) {
            console.warn('Creating minimal profile as fallback');
            const minimalProfile = {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              phoneNumber: user.phoneNumber || '',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            } as UserProfile;
            
            // Save to localStorage for future use
            saveProfileToLocalStorage(profileId, minimalProfile);
            
            // Update state with the minimal profile
            setState(prev => ({
              ...prev,
              userProfile: minimalProfile,
              loading: false
            }));
            
            // Try to save this minimal profile to Firestore in the background
            try {
              setDoc(doc(db, 'profiles', profileId), minimalProfile, { merge: true })
                .then(() => console.log('Minimal profile saved to Firestore'))
                .catch(e => console.warn('Failed to save minimal profile to Firestore:', e));
            } catch (e) {
              console.warn('Failed to initiate Firestore save operation:', e);
            }
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          // Still set the user even if profile loading failed
          setState({
            user,
            userProfile: null,
            loading: false,
            error: error as Error
          });
        }
      } else {
        setState({
          user: null,
          userProfile: null,
          loading: false,
          error: null
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Sign in with phone number
  const signInWithPhone = async (phoneNumber: string, applicationVerifier: ApplicationVerifier): Promise<ConfirmationResult> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      // Use the signInWithPhoneNumber method from firebase/auth directly
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, applicationVerifier);
      setState(prev => ({ ...prev, loading: false }));
      return confirmationResult;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error signing in with phone')
      }));
      throw error;
    }
  };

  // Verify phone authentication code
  const verifyCode = async (confirmationResult: ConfirmationResult, code: string): Promise<UserCredential> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const result = await confirmationResult.confirm(code);
      // After phone verification, create Firestore profile if missing
      const { user } = result;
      const profileId = createProfileId(user);
      const profileDoc = await getDoc(doc(db, 'profiles', profileId));
      if (!profileDoc.exists()) {
        await setDoc(doc(db, 'profiles', profileId), {
          id: profileId,
          email: user.email || '',
          displayName: user.displayName || '',
          username: '',
          photoURL: user.photoURL || '',
          phoneNumber: user.phoneNumber || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      // Fetch and set the profile
      const userProfile = (await getDoc(doc(db, 'profiles', profileId))).data() as UserProfile;
      setState(prev => ({ ...prev, loading: false, userProfile }));
      return result;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error : new Error('Error verifying code')
      }));
      throw error;
    }
  };

  // Sign in with email and password
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const userCredential = await firebaseSignInWithEmail(auth, email, password);
      const { user } = userCredential;
      // Fetch and set the profile from Firestore
      const profileId = createProfileId(user);
      const profileDoc = await getDoc(doc(db, 'profiles', profileId));
      const userProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;
      setState(prev => ({ ...prev, loading: false, userProfile }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error : new Error('Error signing in with email')
      }));
      throw error;
    }
  };

  // Sign up with email and password
  const signUpWithEmail = async (email: string, password: string, name: string, username: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const userCredential = await firebaseSignUpWithEmail(auth, email, password);
      const { user } = userCredential;

      // Set Firebase Auth displayName
      await firebaseUpdateProfile(user, { displayName: name });

      const profileId = createProfileId(user);
      await setDoc(doc(db, 'profiles', profileId), {
        id: profileId,
        email: user.email,
        displayName: name,
        username: username,
        photoURL: user.photoURL || '',
        phoneNumber: user.phoneNumber || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Fetch and set the profile from Firestore
      const profileDoc = await getDoc(doc(db, 'profiles', profileId));
      const userProfile = profileDoc.exists() ? profileDoc.data() as UserProfile : null;
      setState(prev => ({ ...prev, loading: false, userProfile }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error : new Error('Error signing up with email')
      }));
      throw error;
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await firebaseSignOut(auth);
      setState({
        user: null,
        userProfile: null,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error signing out')
      }));
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (data: Partial<Omit<UserProfile, 'createdAt' | 'updatedAt' | 'id'>>) => {
    if (!state.user || !state.userProfile) {
      throw new Error('No authenticated user');
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const profileId = createProfileId(state.user);
      await setDoc(doc(db, 'profiles', profileId), {
        ...state.userProfile,
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setState(prev => ({
        ...prev,
        userProfile: { ...prev.userProfile!, ...data },
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error updating profile')
      }));
      throw error;
    }
  };

  // Update user's email
  const updateEmail = async (newEmail: string, password: string): Promise<void> => {
    if (!state.user) throw new Error('Not authenticated');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const credential = EmailAuthProvider.credential(state.user.email!, password);
      await firebaseReauthenticateWithCredential(state.user, credential);
      await firebaseUpdateEmail(state.user, newEmail);
      
      await updateProfile({ email: newEmail });
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error updating email')
      }));
      throw error;
    }
  };

  // Update user's password
  const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!state.user) throw new Error('Not authenticated');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const credential = EmailAuthProvider.credential(state.user.email!, currentPassword);
      await firebaseReauthenticateWithCredential(state.user, credential);
      await firebaseUpdatePassword(state.user, newPassword);
      
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error updating password')
      }));
      throw error;
    }
  };

  // Send password reset email
  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await firebaseSendPasswordResetEmail(auth, email);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error sending password reset email')
      }));
      throw error;
    }
  };

  // Delete user account
  const deleteAccount = async (): Promise<void> => {
    if (!state.user) throw new Error('Not authenticated');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const profileId = createProfileId(state.user);
      const profileRef = doc(db, 'profiles', profileId);
      
      await setDoc(profileRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true });
      
      await state.user.delete();
      
      setState({
        user: null,
        userProfile: null,
        loading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error deleting account')
      }));
      throw error;
    }
  };

  // Reauthenticate with credential
  const reauthenticateWithCredential = async (credential: any): Promise<void> => {
    if (!state.user) throw new Error('Not authenticated');
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await firebaseReauthenticateWithCredential(state.user, credential);
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Error reauthenticating')
      }));
      throw error;
    }
  };

  // Check if profile is complete
  const isProfileComplete = (): boolean => {
    return !!(state.userProfile?.displayName);
  };

  // Get profile ID
  const getProfileId = (user: User): string => {
    return createProfileId(user);
  };

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    signInWithPhone,
    verifyCode,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword,
    sendPasswordResetEmail,
    deleteAccount,
    reauthenticateWithCredential,
    isProfileComplete,
    getProfileId
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};