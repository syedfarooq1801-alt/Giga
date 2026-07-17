import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Define the Firebase config type
type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  databaseURL?: string; // databaseURL is optional for v9 modular SDK unless using Realtime Database
};

// Firebase configuration values
const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBmzIi63vflLOYA1NQ_tY1FIiuE_Xz6iIA",
  authDomain: (process.env.NODE_ENV === 'production') ? 'www.gigabhai.com' : (process.env.FIREBASE_AUTH_DOMAIN || 'giga-bhai18.firebaseapp.com'),
  projectId: process.env.FIREBASE_PROJECT_ID || "giga-bhai18",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "giga-bhai18.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "283750414629",
  appId: process.env.FIREBASE_APP_ID || "1:283750414629:web:654e24eb768bb767f702cc",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-3KR03P8CJY",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://giga-bhai18-default-rtdb.asia-southeast1.firebasedatabase.app",
};

console.log("[Firebase Config]", firebaseConfig);

export { firebaseConfig }; 
