declare module 'expo-firebase-recaptcha' {
  import { Component, ComponentType } from 'react';
  import { ViewProps } from 'react-native';

  export interface FirebaseRecaptchaVerifierModalProps extends ViewProps {
    firebaseConfig: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    };
  }

  export interface FirebaseRecaptchaVerifierModalRef {
    verify: (recaptchaToken: string) => Promise<string>;
  }

  export const FirebaseRecaptchaVerifierModal: ComponentType<FirebaseRecaptchaVerifierModalProps & {
    ref?: React.RefObject<FirebaseRecaptchaVerifierModalRef>;
  }>;

  export default FirebaseRecaptchaVerifierModal;
} 