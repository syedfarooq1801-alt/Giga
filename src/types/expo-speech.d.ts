declare module 'expo-speech' {
  export interface SpeakOptions {
    language?: string;
    pitch?: number;
    rate?: number;
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: Error) => void;
  }

  export function speak(text: string, options?: SpeakOptions): Promise<void>;
  export function stop(): Promise<void>;
  export function pause(): Promise<void>;
  export function resume(): Promise<void>;
  export function isSpeakingAsync(): Promise<boolean>;
  export function getAvailableVoicesAsync(): Promise<Array<{ id: string; name: string; language: string }>>;
} 