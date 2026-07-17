import { 
  PhoneAuthProvider, 
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
  UserCredential,
  AuthError,
  RecaptchaVerifier
} from 'firebase/auth';
import { getFirebaseAuth } from '../utils/initFirebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Use a singleton auth instance
const auth = getFirebaseAuth();

export const signInWithPhone = async (phoneNumber: string) => {
  try {
    const phoneProvider = new PhoneAuthProvider(auth);
    // For React Native, we'll use the web version with a mock container
    // In a real app, you'd use the native Firebase reCAPTCHA verifier
    const appVerifier = {
      type: 'recaptcha',
      verify: () => Promise.resolve('mock-verification-id')
    } as any;
    
    const verificationId = await phoneProvider.verifyPhoneNumber(
      phoneNumber, 
      appVerifier
    );
    
    return verificationId;
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
};

export const verifyPhoneNumber = async (verificationId: string, code: string) => {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, code);
    const userCredential = await signInWithCredential(auth, credential);
    return userCredential.user;
  } catch (error) {
    console.error('Error verifying code:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Email/Password Authentication
export const signInWithEmail = async (
  email: string, password: string
): Promise<{ user: User | null; profileId: string | null; error: any }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const providerId = user.providerData[0]?.providerId || 'password';
    const profileId = `${user.uid}_${providerId}`;
    return { user, profileId, error: null };
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    return { user: null, profileId: null, error };
  }
};

export const signUpWithEmail = async (
  email: string, 
  password: string, 
  displayName: string,
  username: string
): Promise<{ user: User | null; profileId: string | null; error: any }> => {
  try {
    // 1. Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;
    // 2. Update profile with display name
    if (displayName) {
      await firebaseUpdateProfile(user, { displayName });
    }
    // 3. Create user profile in Firestore
    const providerId = user.providerData[0]?.providerId || 'password';
    const profileId = `${user.uid}_${providerId}`;
    const profileData = {
      uid: user.uid,
      email: user.email,
      displayName,
      username,
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
      providerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'user_profiles', profileId), profileData);
    return { user, profileId, error: null };
  } catch (error: any) {
    console.error('Error signing up with email:', error);
    return { user: null, profileId: null, error };
  }
};

export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  try {
    await firebaseSendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

export const updateEmail = async (user: User, newEmail: string): Promise<void> => {
  try {
    await firebaseUpdateEmail(user, newEmail);
  } catch (error) {
    console.error('Error updating email:', error);
    throw error;
  }
};

export const updatePassword = async (user: User, newPassword: string): Promise<void> => {
  try {
    await firebaseUpdatePassword(user, newPassword);
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

export const reauthenticate = async (user: User, password: string): Promise<void> => {
  try {
    if (!user.email) {
      throw new Error('User email is not available');
    }
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    console.error('Error reauthenticating user:', error);
    throw error;
  }
};

export const updateProfile = async (updates: { displayName?: string; photoURL?: string }) => {
  try {
    if (!auth.currentUser) {
      throw new Error('No user is signed in');
    }
    await firebaseUpdateProfile(auth.currentUser, updates);
    return auth.currentUser;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Re-export types for convenience
export type { User, UserCredential, AuthError };
export { EmailAuthProvider };
