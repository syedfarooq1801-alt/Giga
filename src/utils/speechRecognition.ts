// Web-compatible speech recognition utility

// Extend the Window interface to include Web Speech API types
declare global {
  interface Window {
    webkitSpeechRecognition: new () => any;
    SpeechRecognition: new () => any;
  }
}

interface SpeechRecognitionResult {
  [index: number]: {
    transcript: string;
  };
  transcript: string;
  isFinal: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: SpeechRecognitionResult;
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onaudiostart: () => void;
  onsoundstart: () => void;
  onsoundend: () => void;
  onspeechend: () => void;
  onstart: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

let recognitionInstance: SpeechRecognition | null = null;
let isListening = false;
let finalTranscript = '';
let resolveCallback: ((value: string | null) => void) | null = null;

/**
 * Check if the browser supports the Web Speech API
 */
const isSpeechRecognitionSupported = (): boolean => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

/**
 * Initialize speech recognition
 */
const initRecognition = (): SpeechRecognition | null => {
  if (!isSpeechRecognitionSupported()) {
    console.error('Web Speech API is not supported in this browser');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Update the input field with interim results
    const inputElement = document.querySelector('textarea');
    if (inputElement) {
      inputElement.value = finalTranscript + interimTranscript;
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error, event.message);
    if (resolveCallback) {
      resolveCallback(null);
      resolveCallback = null;
    }
    cleanup();
  };

  recognition.onend = () => {
    if (isListening) {
      // If we're still supposed to be listening, restart recognition
      recognition.start();
    } else if (resolveCallback) {
      // If we have a callback, resolve with the final transcript
      resolveCallback(finalTranscript.trim() || null);
      resolveCallback = null;
    }
    cleanup();
  };

  return recognition;
};

/**
 * Clean up resources
 */
const cleanup = () => {
  if (recognitionInstance) {
    // Properly clean up event handlers
    recognitionInstance.onresult = () => {};
    recognitionInstance.onerror = () => {};
    recognitionInstance.onend = () => {};
    recognitionInstance.stop();
    recognitionInstance = null;
  }
  finalTranscript = '';
};

/**
 * Start or stop speech recognition
 * @param {boolean} start - Whether to start or stop recognition
 * @returns {Promise<string | null>} - The final transcript when stopped, or null if there was an error
 */
export const toggleSpeechRecognition = async (start: boolean): Promise<string | null> => {
  if (start) {
    // Start recording
    if (isListening) return null;
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize recognition if needed
      if (!recognitionInstance) {
        recognitionInstance = initRecognition();
        if (!recognitionInstance) return null;
      }
      
      // Reset state
      finalTranscript = '';
      isListening = true;
      
      // Start recognition
      recognitionInstance.start();
      
      return new Promise((resolve) => {
        // Store the resolve callback to be called when stopping
        resolveCallback = resolve;
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      return null;
    }
  } else {
    // Stop recording
    if (!isListening || !recognitionInstance) return null;
    
    isListening = false;
    recognitionInstance.stop();
    
    // If we have a callback, return the promise that will resolve when recognition ends
    if (resolveCallback) {
      return new Promise((resolve) => {
        const originalResolve = resolveCallback;
        resolveCallback = (value) => {
          if (originalResolve) originalResolve(value);
          resolve(value);
        };
      });
    }
    
    return Promise.resolve(finalTranscript.trim() || null);
  }
};

/**
 * Check if speech recognition is currently active
 */
export const isRecognitionActive = (): boolean => {
  return isListening;
};

// For backward compatibility
export const startSpeechRecognition = toggleSpeechRecognition.bind(null, true);
export const stopSpeechRecognition = toggleSpeechRecognition.bind(null, false);

export const speechToText = startSpeechRecognition;
