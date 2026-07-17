import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useCallback } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { getFirebaseAuth } from '../utils/initFirebase';

interface AuthContextType {
  user: FirebaseUser | null;
  profileId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profileId: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateProfile: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize auth state
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const providerId = firebaseUser.providerData[0]?.providerId || 'local';
        const pId = `${firebaseUser.uid}_${providerId}`;
        setProfileId(pId);
      } else {
        setUser(null);
        setProfileId(null);
      }
      
      if (!authInitialized) {
        setAuthInitialized(true);
      }
      
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [authInitialized]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Force update the user state
      setUser(userCredential.user);
      const providerId = userCredential.user.providerData[0]?.providerId || 'local';
      setProfileId(`${userCredential.user.uid}_${providerId}`);
      return userCredential;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const auth = getFirebaseAuth();
    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await firebaseUpdateProfile(auth.currentUser, { displayName });
      }
      return userCredential;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    try {
      setLoading(true);
      await firebaseSignOut(auth);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (displayName: string, photoURL?: string) => {
    const auth = getFirebaseAuth();
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      setLoading(true);
      const updateData: { displayName: string; photoURL?: string } = { displayName };
      if (photoURL) {
        updateData.photoURL = photoURL;
      }
      await firebaseUpdateProfile(auth.currentUser, updateData);
      // Force a refresh of the auth state
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profileId,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
