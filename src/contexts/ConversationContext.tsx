// @ts-nocheck
import * as React from 'react';
import { useAuth } from './FirebaseAuthContext';
import { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

type ReactNode = React.ReactNode;

// Use React namespace directly
const { 
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} = React as any; // Type assertion to bypass TypeScript errors

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  personality?: string;
  createdAt: number;
  updatedAt: number;
  profile_id?: string;
}

interface ConversationContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  createNewConversation: (title: string, personality?: string) => Promise<Conversation>;
  selectConversation: (conversation: Conversation) => void;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, newTitle: string, personality?: string) => Promise<void>;
  clearUserConversations: () => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | null>(null);

// Helper function to generate a UUID
const generateUUID = (context: string): string => {
  const id = uuidv4();
  console.log(`Generated UUID for ${context}: ${id}`);
  return id;
};

// Helper function to get profile ID from user object
const getProfileId = (user: User | null): string | null => {
  if (!user) return null;
  return `${user.uid}_${user.providerData[0]?.providerId || 'default'}`;
};

interface ConversationProviderProps {
  children: ReactNode;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  // Load conversations when user changes
  const loadUserConversations = React.useCallback(async () => {
    if (!user) {
      setConversations([]);
      setCurrentConversation(null);
      setLoading(false);
      return;
    }

    const profileId = getProfileId(user);
    if (!profileId) {
      setLoading(false);
      return;
    }

    try {
      const storedConversations = await AsyncStorage.getItem(`conversations_${profileId}`);
      if (storedConversations) {
        const parsedConversations = JSON.parse(storedConversations);
        setConversations(parsedConversations);
        console.log(`Loaded ${parsedConversations.length} conversations from AsyncStorage`);
      } else {
        setConversations([]);
        console.log('No conversations found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading conversations from AsyncStorage:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserConversations();
  }, [loadUserConversations]);

  // Create a new conversation
  const createNewConversation = React.useCallback(async (title: string, personality: string = 'default'): Promise<Conversation> => {
    if (!user) throw new Error('User not authenticated');

    const profileId = getProfileId(user);
    if (!profileId) throw new Error('Profile ID not available');

    const now = Date.now();
    const newConversation: Conversation = {
      id: generateUUID('conversation'),
      title: title || 'New Conversation',
      messages: [],
      personality,
      createdAt: now,
      updatedAt: now,
      profile_id: profileId
    };

    // Update state
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversation(newConversation);

    // Save to AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(`conversations_${profileId}`);
      const existing = stored ? JSON.parse(stored) : [];
      await AsyncStorage.setItem(
        `conversations_${profileId}`,
        JSON.stringify([newConversation, ...existing])
      );
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }

    return newConversation;
  }, [user]);

  // Add a message to the current conversation
  const addMessage = React.useCallback(async (message: Omit<Message, 'id' | 'timestamp'>): Promise<void> => {
    if (!user) return;
    
    const profileId = getProfileId(user);
    if (!profileId) return;

    const messageWithId: Message = {
      ...message,
      id: generateUUID('message'),
      timestamp: Date.now()
    };

    if (!currentConversation) {
      // Create a new conversation if none exists
      const newConversation: Conversation = {
        id: generateUUID('conversation'),
        title: message.content.substring(0, 30) + (message.content.length > 30 ? '...' : ''),
        messages: [messageWithId],
        personality: 'default',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        profile_id: profileId
      };

      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);

      try {
        const stored = await AsyncStorage.getItem(`conversations_${profileId}`);
        const existing = stored ? JSON.parse(stored) : [];
        await AsyncStorage.setItem(
          `conversations_${profileId}`,
          JSON.stringify([newConversation, ...existing])
        );
      } catch (error) {
        console.error('Error saving new conversation:', error);
      }
      return;
    }

    // Add message to existing conversation
    const updatedConversation = {
      ...currentConversation,
      messages: [...currentConversation.messages, messageWithId],
      updatedAt: Date.now()
    };

    setCurrentConversation(updatedConversation);
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );

    try {
      const stored = await AsyncStorage.getItem(`conversations_${profileId}`);
      if (stored) {
        const conversations = JSON.parse(stored);
        await AsyncStorage.setItem(
          `conversations_${profileId}`,
          JSON.stringify(
            conversations.map((c: Conversation) => 
              c.id === updatedConversation.id ? updatedConversation : c
            )
          )
        );
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  }, [user, currentConversation]);

  // Select a conversation
  const selectConversation = React.useCallback((conversation: Conversation): void => {
    setCurrentConversation(conversation);
    
    // Update the updatedAt timestamp
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversation.id 
          ? { ...conv, updatedAt: Date.now() } 
          : conv
      )
    );
  }, []);

  // Delete a conversation
  const deleteConversation = React.useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    
    const profileId = getProfileId(user);
    if (!profileId) return;
    
    setConversations(prev => prev.filter(conv => conv.id !== id));
    setCurrentConversation(prev => (prev?.id === id ? null : prev));
    
    try {
      const stored = await AsyncStorage.getItem(`conversations_${profileId}`);
      if (stored) {
        const conversations = JSON.parse(stored);
        await AsyncStorage.setItem(
          `conversations_${profileId}`,
          JSON.stringify(conversations.filter((c: Conversation) => c.id !== id))
        );
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }, [user]);

  // Update conversation title and/or personality
  const updateConversationTitle = React.useCallback(async (
    id: string, 
    newTitle: string, 
    personality: string = 'default'
  ): Promise<void> => {
    if (!user) return;

    const profileId = getProfileId(user);
    if (!profileId) return;

    setConversations(prev => 
      prev.map(conv => 
        conv.id === id 
          ? { 
              ...conv, 
              title: newTitle, 
              personality,
              updatedAt: Date.now() 
            } 
          : conv
      )
    );

    setCurrentConversation(prev => 
      prev?.id === id 
        ? { 
            ...prev, 
            title: newTitle, 
            personality,
            updatedAt: Date.now() 
          } 
        : prev
    );

    try {
      const stored = await AsyncStorage.getItem(`conversations_${profileId}`);
      if (stored) {
        const conversations = JSON.parse(stored);
        await AsyncStorage.setItem(
          `conversations_${profileId}`,
          JSON.stringify(
            conversations.map((c: Conversation) => 
              c.id === id 
                ? { 
                    ...c, 
                    title: newTitle, 
                    personality,
                    updatedAt: Date.now() 
                  } 
                : c
            )
          )
        );
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw error;
    }
  }, [user]);

  // Clear all conversations for the current user
  const clearUserConversations = React.useCallback(async (): Promise<void> => {
    if (!user) return;
    
    const profileId = getProfileId(user);
    if (!profileId) return;
    
    setConversations([]);
    setCurrentConversation(null);
    
    try {
      await AsyncStorage.removeItem(`conversations_${profileId}`);
    } catch (error) {
      console.error('Error clearing conversations:', error);
      throw error;
    }
  }, [user]);

  // Context value
  const contextValue = {
    conversations,
    currentConversation,
    loading,
    addMessage,
    createNewConversation,
    selectConversation,
    deleteConversation,
    updateConversationTitle,
    clearUserConversations,
  };

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
};

// Hook to use the conversation context
export const useConversation = (): ConversationContextType => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};

export default ConversationContext;
