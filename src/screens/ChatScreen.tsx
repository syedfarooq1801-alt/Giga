import React, { useEffect, useState, useRef, useCallback } from 'react';
import { API_URL } from '../constants';
import { speechToText, startSpeechRecognition, stopSpeechRecognition, isRecognitionActive } from '../utils/speechRecognition';
import type { FC } from 'react';
import { PERSONALITIES, DEFAULT_PERSONALITY_ID } from '../constants/personalities';
import { useTheme } from '../contexts/ThemeContext';
import {
  Animated,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Image
} from 'react-native';


// Import the logo image
const GigaLogo = require('../Giga-logo1.png');

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, MaterialIcons as Icon } from '@expo/vector-icons';
import { MessageBubble } from '../components/MessageBubble';
import { TypingBubble } from '../components/TypingBubble';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, orderBy, doc, serverTimestamp, setDoc, getDoc, onSnapshot, DocumentData, QueryDocumentSnapshot, limit } from 'firebase/firestore';

// Load messages from Firestore for the given conversation
// Loads ALL messages for a conversation, including both user and bot (AI) messages, sorted by timestamp ascending. No filtering on sender.
const loadMessagesFromFirestore = async (profileId: string, conversationId: string): Promise<ChatMessage[]> => {
  if (!profileId || !conversationId) {
    console.log('[loadMessagesFromFirestore] Missing profileId or conversationId');
    return [];
  }

  console.log(`[loadMessagesFromFirestore] Attempting to load messages for profile: ${profileId}, conversation: ${conversationId}`);

  try {
    const db = getFirestore();
    const messagesRef = collection(db, 'users', profileId, 'conversations', conversationId, 'messages');
    console.log(`[loadMessagesFromFirestore] Messages ref path: users/${profileId}/conversations/${conversationId}/messages`);
    
    // Query all messages, regardless of sender (user or bot), sorted by timestamp ascending
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc')
    );
    
    console.log('[loadMessagesFromFirestore] Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[loadMessagesFromFirestore] No messages found in this conversation');
      return [];
    }
    
    const messages: ChatMessage[] = [];
    const messageMap = new Map<string, ChatMessage>();
    
    querySnapshot.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) {
          console.warn(`[loadMessagesFromFirestore] Document ${doc.id} has no data`);
          return;
        }
        
        // Skip if we've already seen this message ID (shouldn't happen, but just in case)
        if (messageMap.has(doc.id)) {
          console.log(`[loadMessagesFromFirestore] Duplicate message ID ${doc.id} found, skipping`);
          return;
        }
        
        const message: ChatMessage = {
          id: doc.id,
          text: data.text || '',
          userId: data.userId || 'unknown',
          sender: data.sender || 'user',
          timestamp: data.timestamp?.toDate() || new Date(),
          conversationId: conversationId,
          personalityId: data.personalityId || 'default',
          profileId: data.profileId || profileId,
        };
        
        // Add to map to ensure no duplicates by ID
        messageMap.set(doc.id, message);
      } catch (docError) {
        console.error(`[loadMessagesFromFirestore] Error processing document ${doc.id}:`, docError);
      }
    });

    // Convert map values to array
    const uniqueMessages = Array.from(messageMap.values());
    
    // Sort by timestamp to ensure proper message order
    uniqueMessages.sort((a, b) => {
      const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return tsA - tsB;
    });

    console.log(`[loadMessagesFromFirestore] Successfully loaded ${uniqueMessages.length} messages for conversation ${conversationId}`);
    return uniqueMessages;
  } catch (error) {
    console.error('[loadMessagesFromFirestore] Error loading messages:', error);
    // Return empty array on error to prevent breaking the UI
    return [];
  }
};

import { getFirebaseAuth, getFirebaseFirestore } from '../utils/initFirebase';
import { getAuth } from 'firebase/auth';
import { getConversationTitleFromMistral } from '../utils/mistralTitle';
import { PersonalityType } from '../types/chat';
import { Conversation } from '../types/Conversation';
import { ChatMessage } from '../types/ChatMessage';
import { RootStackParamList } from '../types/navigation';

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

// MessageBubble component expects text and sender props

interface Styles extends Record<string, any> {
  container: any;
  networkStatusBar: any;
  networkStatusText: any;
  messageList: any;
  inputContainer: any;
  input: any;
  sendButton: any;
  sendButtonDisabled: any;
  personalityButton: any;
  modalContainer: any;
  modalOverlay: any;
  modalContent: any;
  modalTitle: any;
  personalityItem: any;
  personalityInfo: any;
  personalityName: any;
  personalityDesc: any;
  emptyText: any;
  loadingContainer: any;
  headerContainer: any;
  logo: any;
  headerTextContainer: any;
  appName: any;
  tagline: any;
}

// NO LONGER USED: All message persistence is now in Firestore only. AsyncStorage is not used for chat messages.
// const saveMessagesToLocalStorage = ... (removed)

const ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX = 'currentConversation_';

const saveCurrentConversationToStorage = async (profileId: string, conversation: Conversation | null) => {
  if (!profileId) return;
  const key = `${ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX}${profileId}`;
  try {
    if (conversation && conversation.id) {
      await AsyncStorage.setItem(key, JSON.stringify(conversation));
      console.log('Saved current conversation to AsyncStorage:', conversation.id);
    } else {
      await AsyncStorage.removeItem(key);
      console.log('Removed current conversation from AsyncStorage for profile:', profileId);
    }
  } catch (error) {
    console.error('Failed to save current conversation to AsyncStorage:', error);
  }
};

const loadCurrentConversationFromStorage = async (profileId: string): Promise<Conversation | null> => {
  if (!profileId) return null;
  const key = `${ASYNC_STORAGE_CURRENT_CONVERSATION_KEY_PREFIX}${profileId}`;
  try {
    const storedConversation = await AsyncStorage.getItem(key);
    if (storedConversation) {
      const conversation = JSON.parse(storedConversation) as Conversation;
      if (conversation && conversation.id) {
        console.log('Loaded current conversation from AsyncStorage:', conversation.id);
        return conversation;
      }
    }
  } catch (error) {
    console.error('Failed to load current conversation from AsyncStorage:', error);
  }
  return null;
};


const sendMessageToBackendAndGetResponse = async (
  text: string,
  personalityId: string,
  profileId: string,
  conversationId: string | null,
  userId: string
): Promise<{ message: ChatMessage; conversationId: string } | null> => {
  if (!text || !personalityId || !profileId || !userId) { // conversationId can be null for new chats
    throw new Error('Missing required parameters');
  }
  try {
    const netInfoState = await NetInfo.fetch();
    const isOnline = netInfoState.isConnected ?? false;
    if (!isOnline) {
      throw new Error('No internet connection');
    }
    // Save the user's message to Firestore
    const db = getFirestore();
    const messageData: Omit<ChatMessage, 'id'> = {
      userId,
      text,
      sender: 'user',
      timestamp: new Date(),
      personalityId,
      profileId,
      conversationId: conversationId === null ? undefined : conversationId
    };
    await addDoc(collection(db, 'users', profileId, 'messages'), messageData);

    // Make real API call to backend with Firebase ID token
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    const idToken = await currentUser.getIdToken();

    const requestBody = {
      message: text,
      personality: personalityId,
      conversation_id: conversationId || undefined,
      user_id: userId,
      profile_id: profileId,
    };
    
    console.log('Sending chat request:', requestBody);
    
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }
    const data = await response.json();
    // Generate a unique ID for the AI message (use uuid if available)
    const { v4: uuidv4 } = require('uuid'); // Consider if uuid is truly needed here or if backend can provide message IDs
    const backendConversationId = data.conversation_id;
    const aiMessage: ChatMessage = {
      id: data.message_id || uuidv4(), // Prefer backend message ID if available
      userId: 'ai',
      text: data.message,
      sender: 'assistant',
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(), // Use backend timestamp if available
      personalityId: data.personality || personalityId, // Prefer backend personality if available
      profileId: profileId,
      conversationId: backendConversationId, // CRITICAL: Use ID from backend response
    };
    return { message: aiMessage, conversationId: backendConversationId };
  } catch (error) {
    console.error('Error in sendMessageToBackendAndGetResponse:', error);
    return null;
  }
};

const formatTimestamp = (timestamp: string | Date): string => {
  return new Date(timestamp).toLocaleString();
};

const createProfileId = (userId: string, provider?: string): string => {
  if (!provider) {
    // Attempt to extract provider from user ID if it's in email format like user@provider.com
    // This is a fallback and might not be robust for all cases (e.g. phone auth)
    // Prefer explicit provider if available from session.user.app_metadata.provider or session.user.identities[0].provider
    const parts = userId.split('@');
    if (parts.length > 1) {
      const domainParts = parts[1].split('.');
      provider = domainParts[0]; // e.g., 'google' from 'google.com'
    } else {
      provider = 'unknown'; // Fallback if no provider info
    }
  }
  return `${userId}_${provider}`;
};

// --- Header Component ---
interface HeaderProps {
  onPressConversations: () => void;
}
const Header: React.FC<HeaderProps> = ({ onPressConversations }) => {
  const { isDark } = useTheme();
  return (
    <View style={[styles.headerContainer, { backgroundColor: isDark ? '#111' : '#fff', borderBottomColor: isDark ? '#222' : '#eee', flexDirection: 'row', alignItems: 'center' }]}
    >
      <TouchableOpacity onPress={onPressConversations} style={styles.conversationsButton}>
  {/* Hamburger icon: three lines */}
  <View style={styles.hamburgerIcon}>
    <View style={styles.hamburgerLine} />
    <View style={styles.hamburgerLine} />
    <View style={styles.hamburgerLine} />
  </View>
</TouchableOpacity>
      <Image source={GigaLogo} style={[styles.logo, { backgroundColor: isDark ? '#222' : '#f5f5f5' }]} resizeMode="contain" />
      <View style={styles.headerTextContainer}>
        <Text style={[styles.appName, { color: isDark ? '#fff' : '#222' }]}>Giga BhAI</Text>
        <Text style={[styles.tagline, { color: isDark ? '#aaa' : '#666' }]}>Desi dimaagGiga level swag</Text>
      </View>
    </View>
  );
};

// Main ChatScreen component
const ChatScreen = () => {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Track processed message IDs to prevent duplicates
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>(PERSONALITIES[DEFAULT_PERSONALITY_ID]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Chat'>>();
  const flatListRef = useRef<any>(null);
  // Drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-280)).current;

  // Drawer open/close
  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -280,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setDrawerVisible(false));
  };

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      handleNetworkChange(state);
    });
    return () => unsubscribe();
  }, []);

  // State to hold all conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Derive profileId and userId from session
  useEffect(() => {
    // Loads all conversations for the profile and sets the most recent as current
    const restoreLastConversation = async (profileId: string) => {
      try {
        const db = getFirestore();
        const convQuery = query(
          collection(db, 'users', profileId, 'conversations'),
          orderBy('last_message_timestamp', 'desc')
        );
        const snapshot = await getDocs(convQuery);
        if (snapshot.empty) {
          console.log('[ChatScreen] No conversations found for profile. Will create new conversation on first message.');
          setConversations([]);
          setCurrentConversation(null);
        } else {
          // Each conversation must have all required Conversation fields
          const conversations = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Untitled',
              lastMessage: data.lastMessage || '',
              timestamp: data.timestamp || data.last_message_timestamp || new Date().toISOString(),
              personalityId: data.personalityId || DEFAULT_PERSONALITY_ID,
              ...data // Keep other properties if present
            };
          });
          setConversations(conversations);
          console.log('[ChatScreen] Loaded conversations:', conversations);
          setCurrentConversation(conversations[0]); // Set most recent as current
        }
      } catch (error) {
        console.error('[ChatScreen] Error loading conversations:', error);
        setConversations([]);
        setCurrentConversation(null);
      }
    };
    if (session?.user && session.profileId) {
      setProfileId(session.profileId);
      setUserId(session.user.uid);
      console.log('Profile ID set:', session.profileId, 'User ID set:', session.user.uid);
      restoreLastConversation(session.profileId);
      // Debug: Print all messages for this profileId
      const debugPrintAllMessages = async (profileId: string) => {
        try {
          const db = getFirestore();
          const messagesSnapshot = await getDocs(collection(db, 'users', profileId, 'messages'));
          const allMessages = messagesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          console.log('[ChatScreen][DEBUG] All messages for profile', profileId, allMessages);
        } catch (err) {
          console.error('[ChatScreen][DEBUG] Error fetching all messages for profile:', profileId, err);
        }
      };
      debugPrintAllMessages(session.profileId);
    } else if (!authLoading && !session) {
      setProfileId(null);
      setUserId(null);
      setCurrentConversation(null);
    }
  }, [session, authLoading]);

  const handleNetworkChange = (state: NetInfoState) => {
    setIsOnline(state.isConnected ?? false);
  };

  const createNewConversation = async (initialMessage?: ChatMessage): Promise<Conversation | null> => {
    if (!profileId || !selectedPersonality) {
      console.error('Profile ID or selected personality missing for new conversation');
      return null;
    }
    setIsLoadingMessages(true);
    try {
      const db = getFirestore();
      // Prepare first 5 messages for title
      let firstMessages: { text: string }[] = [];
      if (initialMessage) {
        firstMessages = [initialMessage];
      }
      // Call Mistral for title if we have at least one message
      let title = initialMessage?.text ? initialMessage.text.substring(0, 30) : `New ${selectedPersonality.name} Chat`;
      if (firstMessages.length > 0) {
        const mistralTitle = await getConversationTitleFromMistral(firstMessages);
        if (mistralTitle && mistralTitle.trim().length > 0) {
          title = mistralTitle;
        }
      }
      const newConversationData = {
        profile_id: profileId,
        personality_id: selectedPersonality.id,
        last_message_timestamp: initialMessage?.timestamp || new Date().toISOString(),
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'users', profileId, 'conversations'), newConversationData);

      // Map to Conversation type
      const conversation: Conversation = {
        id: docRef.id,
        title: newConversationData.title,
        lastMessage: initialMessage?.text || '',
        timestamp: initialMessage?.timestamp
          ? (typeof initialMessage.timestamp === 'string' ? new Date(initialMessage.timestamp) : initialMessage.timestamp)
          : new Date(),
        personalityId: selectedPersonality.id,
        // Add other required fields if your Conversation type/interface expects them
      };
      setCurrentConversation(conversation);
      // saveCurrentConversationToStorage is handled by the useEffect watching currentConversation
      return conversation;
    } catch (error) {
      console.error('Error creating new conversation:', error);
      return null;
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!profileId || !userId || !text.trim()) return;

    console.log('Sending message:', { text, profileId, userId });

    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Ensure we have a conversation
    let conversationToUse = currentConversation;
    if (!conversationToUse) {
      console.log('No current conversation, creating a new one...');
      const newConv = await createNewConversation();
      if (!newConv) {
        console.error('Failed to create a new conversation');
        return;
      }
      conversationToUse = newConv;
      setCurrentConversation(newConv);
    }
    
    const convId = conversationToUse.id;
    console.log('Using conversation ID:', convId);

    // Create temporary user message for optimistic update
    const tempUserMessage: ChatMessage = {
      id: tempId,
      text: text.trim(),
      userId,
      sender: 'user',
      timestamp: now,
      personalityId: selectedPersonality.id,
      profileId,
      conversationId: convId,
      isOptimistic: true
    };

    // Add temporary message to state immediately for optimistic update
    setMessages(prev => {
      // Skip if we already have a message with this exact content from the same user in the last second
      const recentDuplicate = prev.some(
        msg =>
          msg.sender === 'user' &&
          msg.text === text.trim() &&
          Math.abs((msg.timestamp?.getTime() || 0) - now.getTime()) < 1000
      );

      if (recentDuplicate) {
        console.log('Skipping duplicate message');
        return prev;
      }

      console.log('Adding temporary message to UI');
      // Filter out any existing temporary messages from this user
      const filtered = prev.filter(msg => !(msg.sender === 'user' && 'isOptimistic' in msg));
      return [...filtered, tempUserMessage];
    });

    setInputText('');
    setIsTyping(true);
    
    // Scroll to bottom after adding the message
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);

    try {
      // Save the user message to Firestore
      const userMessageData: Omit<ChatMessage, 'id'> = {
        text: text.trim(),
        userId,
        sender: 'user',
        timestamp: now,
        personalityId: selectedPersonality.id,
        profileId,
        conversationId: convId
      };

      const db = getFirestore();
      const userMsgDoc = await addDoc(
        collection(db, 'users', profileId, 'conversations', convId, 'messages'),
        userMessageData
      );

      // Create the final user message with the Firestore ID
      const userMessage: ChatMessage = {
        ...userMessageData,
        id: userMsgDoc.id
      };

      // Update state with the real user message (replacing the temp one)
      setMessages(prev => {
        // Remove both the temporary message and any duplicate that might have come from Firestore
        const filtered = prev.filter(msg =>
          msg.id !== tempId &&
          !(msg.sender === 'user' && msg.text === userMessage.text && msg.id !== userMessage.id)
        );
        return [...filtered, userMessage];
      });

      // Mark this message as processed to prevent duplicates
      processedMessageIds.current.add(userMessage.id);

      // Send to backend and get AI response
      const backendResult = await sendMessageToBackendAndGetResponse(
        userMessage.text,
        selectedPersonality.id,
        profileId,
        convId,
        userId
      );

      if (backendResult?.message && backendResult.conversationId) {
        const aiMessage = backendResult.message;
        const returnedConversationId = backendResult.conversationId;

        // Ensure AI message has a unique ID
        if (!aiMessage.id) {
          aiMessage.id = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Ensure bot timestamp is after user message
        const userTs = userMessage.timestamp instanceof Date
          ? userMessage.timestamp.getTime()
          : new Date(userMessage.timestamp).getTime();

        let aiTs = aiMessage.timestamp instanceof Date
          ? aiMessage.timestamp.getTime()
          : new Date(aiMessage.timestamp).getTime();

        // Make sure AI message comes after user message
        if (aiTs <= userTs) {
          aiTs = userTs + 1; // Ensure AI message is at least 1ms after user message
          aiMessage.timestamp = new Date(aiTs);
        }

        // Update the conversation ID if it was changed (e.g., new conversation created)
        if (returnedConversationId !== convId) {
          console.log(`[handleSendMessage] Conversation ID updated from ${convId} to ${returnedConversationId}`);
          // Update the conversation ID for any subsequent messages
          conversationToUse = { ...conversationToUse, id: returnedConversationId };
          setCurrentConversation(conversationToUse);
        }

        // Add the AI message to the conversation
        setMessages(prev => {
          // Filter out any existing AI messages with the same ID
          const filtered = prev.filter(msg => msg.id !== aiMessage.id);
          return [...filtered, aiMessage];
        });

        // Mark AI message as processed
        processedMessageIds.current.add(aiMessage.id);

        // Update currentConversation state with the new message
        if (currentConversation) {
          const updatedConv: Conversation = {
            ...currentConversation,
            lastMessage: aiMessage.text,
            timestamp: aiMessage.timestamp,
            personalityId: aiMessage.personalityId,
          };
          setCurrentConversation(updatedConv);
        }
        
        // Stop the typing indicator as soon as we've processed the AI message
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      // Stop the typing indicator on error
      setIsTyping(false);

      // Show error to user
      Alert.alert(
        'Error',
        'Failed to send message. Please check your connection and try again.'
      );
    }
  };

  const loadMessages = useCallback(async () => {
    if (!profileId || !currentConversation?.id) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'users', profileId, 'messages'),
        where('conversation_id', '==', currentConversation.id),
        orderBy('timestamp', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const firebaseMessages: ChatMessage[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ChatMessage));

      setMessages(prevMessagesInState => {
        if (!currentConversation?.id) return [];
        // Identify optimistic messages in the current state that belong to the *current* conversation
        // and are not yet present in the messages fetched from Firestore.
        const optimisticMessagesForCurrentConv = prevMessagesInState.filter(
          msg => msg.conversationId === currentConversation.id &&
            !firebaseMessages.find(fm => fm.id === msg.id)
        );

        // Combine Firestore messages with these optimistic ones.
        const newMessagesToShow = [...firebaseMessages, ...optimisticMessagesForCurrentConv];

        // Sort all messages by timestamp to ensure correct order.
        newMessagesToShow.sort((a, b) => {
          const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          if (tsA !== tsB) return tsA - tsB;
          // If timestamps are equal, user comes before bot
          if (a.sender === 'user' && b.sender === 'assistant') return -1;
          if (a.sender === 'assistant' && b.sender === 'user') return 1;
          return 0;
        });
        return newMessagesToShow;
      });
      console.log('Loaded messages from Firestore:', firebaseMessages.length);
    } catch (error) {
      console.error('Error loading messages from Firestore:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [profileId, currentConversation]);

  // Effect to load messages when profileId or currentConversation changes
  useEffect(() => {
    if (profileId && currentConversation && currentConversation.id) {
      console.log(`[ChatScreen] useEffect: Valid profileId (${profileId}) and currentConversation.id (${currentConversation.id}). Calling loadMessages.`);
      loadMessages();
    } else if (!profileId) {
      // Only clear messages if the user is logged out or profileId is not yet available.
      console.log('[ChatScreen] useEffect: No profileId. Clearing messages.');
      setMessages([]);
    } else {
      // ProfileId is valid, but currentConversation is not (or has no id).
      // Do not clear messages here to prevent flicker during transitions.
      // Messages will update once currentConversation is properly set and loadMessages runs.
      console.log(`[ChatScreen] useEffect: Valid profileId (${profileId}) but currentConversation is not ready. Waiting for currentConversation to settle.`);
    }
  }, [profileId, currentConversation, loadMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // TODO: Implement loadConversations and integrate with History Modal
  const loadConversations = async () => {
    if (!profileId) return;
    console.log('Loading conversations for profile:', profileId);
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'users', profileId, 'conversations'),
        orderBy('last_message_timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const conversations: Conversation[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Conversation));
      // setConversations(conversations); // Uncomment if you have a conversations state
      if (conversations && conversations.length > 0 && !currentConversation) {
        setCurrentConversation(conversations[0]); // Auto-select the latest conversation
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Effect to load or create conversation when profileId is available
  useEffect(() => {
    const initializeConversation = async () => {
      if (profileId && !currentConversation) {
        console.log('Profile ID available, attempting to load or create conversation.');
        let loadedConversation = await loadCurrentConversationFromStorage(profileId);
        if (loadedConversation && loadedConversation.id) {
          // Validate with Firestore to ensure it's not stale/deleted
          const db = getFirestore();
          const convRef = doc(db, 'users', profileId, 'conversations', loadedConversation.id);
          const convSnap = await getDoc(convRef);
          if (convSnap.exists()) {
            console.log('Setting current conversation from AsyncStorage (validated):', loadedConversation.id);
            setCurrentConversation(loadedConversation);
          } else {
            console.log('Conversation from AsyncStorage not found in Firestore, creating new one.');
            loadedConversation = null; // Treat as not loaded
            await saveCurrentConversationToStorage(profileId, null); // Clear stale entry
          }
        }

        if (!loadedConversation) { // If not loaded or was stale
          console.log('No valid conversation in AsyncStorage or was stale, creating new one.');
          const newConv = await createNewConversation(); // createNewConversation should call setCurrentConversation & save
          if (!newConv) {
            console.log('Could not auto-create a conversation on load.');
          }
        }
      }
    };
    initializeConversation();
  }, [profileId, currentConversation]); // currentConversation is included to re-run if it gets nulled externally

  // Effect to save currentConversation to AsyncStorage whenever it changes
  useEffect(() => {
    if (profileId && currentConversation && currentConversation.id) {
      saveCurrentConversationToStorage(profileId, currentConversation);
    }
  }, [profileId, currentConversation]);

  // Helper function to remove emojis from text
  const removeEmojis = (text: string): string => {
    if (!text) return '';
    // Regex to match emojis and other symbols
    const emojiRegex = /[\p{Emoji}\p{Emoji_Modifier_Base}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\p{Extended_Pictographic}]+/gu;
    return text.replace(emojiRegex, '').trim();
  };

  // Check if iOS device
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  
  // Check if Chrome on iOS
  const isIOSChrome = isIOS && /CriOS/.test(navigator.userAgent);

  // Fallback to Web Speech API with Indian female voice preference
  const fallbackTts = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Web Speech API not available');
      setIsTtsPlaying(false);
      setCurrentAudio(null);
      return;
    }

    console.log('TTS - Falling back to Web Speech API');
    
    const speakWithVoice = () => {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find an Indian English female voice
      const voices = window.speechSynthesis.getVoices();
      let foundVoice = null;
      
      // For iOS Chrome, we'll let the system handle voice selection
      if (!isIOSChrome) {
        foundVoice = voices.find(voice => 
          voice.lang === 'en-IN' && voice.name.toLowerCase().includes('female')
        ) || 
        voices.find(voice => 
          voice.lang === 'en-IN' || voice.lang.startsWith('en-IN-')
        ) ||
        voices.find(voice => 
          voice.name.toLowerCase().includes('female')
        );
      }
      
      if (foundVoice) {
        utterance.voice = foundVoice;
        console.log('Using voice:', foundVoice.name, 'language:', foundVoice.lang);
      } else if (voices.length > 0) {
        // On iOS Chrome, just use the first available voice
        utterance.voice = voices[0];
        console.log('Using default voice:', voices[0].name);
      }
      
      // Set language to Indian English if available, otherwise default to en-US
      utterance.lang = voices.some(v => v.lang.startsWith('en-IN')) ? 'en-IN' : 'en-US';
      
      // Set a slower rate for better clarity
      utterance.rate = 0.9;
      
      // iOS Chrome requires these events to be set before calling speak()
      utterance.onend = () => {
        console.log('Web Speech - Playback finished');
        setIsTtsPlaying(false);
        setCurrentAudio(null);
      };
      
      utterance.onerror = (e) => {
        console.error('Web Speech Error:', e);
        setIsTtsPlaying(false);
        setCurrentAudio(null);
      };
      
      console.log('Starting speech synthesis...');
      try {
        // On iOS, we need to ensure the speech happens in response to a user gesture
        if (isIOS) {
          // Create a temporary button to trigger speech
          const tempButton = document.createElement('button');
          tempButton.style.position = 'absolute';
          tempButton.style.opacity = '0';
          tempButton.style.pointerEvents = 'none';
          document.body.appendChild(tempButton);
          
          tempButton.onclick = () => {
            window.speechSynthesis.speak(utterance);
            document.body.removeChild(tempButton);
          };
          
          // Trigger the click programmatically
          tempButton.click();
        } else {
          // For non-iOS devices, just speak directly
          window.speechSynthesis.speak(utterance);
        }
      } catch (e) {
        console.error('Error starting speech synthesis:', e);
        setIsTtsPlaying(false);
        setCurrentAudio(null);
      }
    };
    
    // For iOS Chrome, we need to handle voice loading differently
    if (isIOSChrome) {
      // On iOS Chrome, we need to wait for a user gesture to load voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speakWithVoice();
        } else {
          // If voices aren't loaded yet, try again after a short delay
          setTimeout(loadVoices, 100);
        }
      };
      
      // Start loading voices
      loadVoices();
    } else {
      // For other browsers, use the standard approach
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = speakWithVoice;
      }
      
      // Try to speak immediately if voices are already loaded
      if (window.speechSynthesis.getVoices().length > 0) {
        speakWithVoice();
      } else {
        // If voices aren't loaded yet, wait a moment and try again
        setTimeout(speakWithVoice, 1000);
      }
    }
  }, [isIOS, isIOSChrome]);

  // Play a single TTS chunk with improved mobile support and voice preference
  const playTtsChunk = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return Promise.resolve();
    
    // First, try Web Speech API as it's more reliable on mobile
    if ('speechSynthesis' in window && window.speechSynthesis) {
      return new Promise((resolve) => {
        console.log('TTS - Using Web Speech API');
        
        const speakWithVoice = () => {
          const utterance = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis.getVoices();
          
          // Try to find an Indian English female voice
          const indianVoice = voices.find(voice => 
            voice.lang === 'en-IN' && voice.name.toLowerCase().includes('female')
          );
          
          // Fallback to any Indian English voice
          const indianEnglishVoice = voices.find(voice => 
            voice.lang === 'en-IN' || voice.lang.startsWith('en-IN-')
          );
          
          // Fallback to any female voice
          const femaleVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('female')
          );
          
          if (indianVoice) {
            utterance.voice = indianVoice;
            console.log('Using Indian female voice:', indianVoice.name);
          } else if (indianEnglishVoice) {
            utterance.voice = indianEnglishVoice;
            console.log('Using Indian English voice:', indianEnglishVoice.name);
          } else if (femaleVoice) {
            utterance.voice = femaleVoice;
            console.log('Using female voice:', femaleVoice.name);
          } else if (voices.length > 0) {
            utterance.voice = voices[0];
            console.log('Using default voice:', voices[0].name);
          }
          
          // Set language to Indian English
          utterance.lang = 'en-IN';
          
          utterance.onend = () => {
            console.log('Web Speech - Playback finished');
            setIsTtsPlaying(false);
            setCurrentAudio(null);
            resolve();
          };
          
          utterance.onerror = (e) => {
            console.error('Web Speech Error:', e);
            setIsTtsPlaying(false);
            setCurrentAudio(null);
            resolve();
          };
          
          setIsTtsPlaying(true);
          window.speechSynthesis.speak(utterance);
        };
        
        // Load voices if not already loaded
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = speakWithVoice;
        }
        
        // Try to speak immediately if voices are already loaded
        if (window.speechSynthesis.getVoices().length > 0) {
          speakWithVoice();
        } else {
          // If voices aren't loaded yet, wait a moment and try again
          setTimeout(speakWithVoice, 1000);
        }
      });
    }
    
    // Fallback to our custom TTS service
    console.log('TTS - Using custom TTS service');
    
    const ttsRequest = {
      text: text,
      language: 'en-IN',  // Request Indian English
      voice: 'female',    // Request female voice
      rate: 1.0           // Normal speaking rate
    };
    
    console.log('TTS - Sending request:', { length: text.length, preview: text.substring(0, 50) + '...' });
    
    try {
      const ttsResponse = await fetch(`${API_URL}/api/speech/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav',
        },
        body: JSON.stringify(ttsRequest),
      });

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
      }

      const audioBlob = await ttsResponse.blob();
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Received empty audio data from TTS service');
      }

      return new Promise((resolve) => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Preload the audio for better mobile support
        audio.preload = 'auto';
        
        const cleanup = () => {
          audio.pause();
          audio.src = '';
          audio.load();
          setTimeout(() => {
            URL.revokeObjectURL(audioUrl);
          }, 1000);
        };
        
        const onEnd = () => {
          console.log('TTS - Chunk playback finished');
          cleanup();
          setIsTtsPlaying(false);
          setCurrentAudio(null);
          resolve();
        };
        
        const onError = (e: any) => {
          console.error('TTS - Playback error:', e);
          cleanup();
          setIsTtsPlaying(false);
          fallbackTts(text);
          resolve();
        };
        
        audio.addEventListener('ended', onEnd, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        // Mobile browsers require user interaction before playing audio
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('TTS - Play error:', error);
            // On mobile, we might need to handle autoplay restrictions
            if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
              console.log('TTS - Autoplay prevented, falling back to Web Speech API');
              fallbackTts(text);
            }
            cleanup();
            resolve();
          });
        }
        
        setCurrentAudio(audio);
        setIsTtsPlaying(true);
      });
    } catch (error) {
      console.error('TTS - Error in playTtsChunk:', error);
      fallbackTts(text);
      return Promise.resolve();
    }
  }, [fallbackTts]);

  // Stop any ongoing TTS playback
  const stopTtsPlayback = useCallback(() => {
    console.log('Stopping TTS playback...');
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        if (currentAudio.src) {
          URL.revokeObjectURL(currentAudio.src);
        }
      } catch (e) {
        console.error('Error stopping audio:', e);
      }
      setCurrentAudio(null);
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsTtsPlaying(false);
  }, [currentAudio]);

  // Handle microphone/stop button press
  const handleMicPress = async () => {
    // If TTS is playing, stop it and return
    if (isTtsPlaying) {
      stopTtsPlayback();
      return;
    }
    if (isLoadingMessages || !profileId || !currentConversation?.id) return;

    const isActive = isRecognitionActive();

    if (isActive) {
      // Stop recording and process the speech
      setIsTyping(true);
      setInputText('Transcribing...');

      try {
        const transcript = await stopSpeechRecognition();

        if (!transcript || !transcript.trim()) {
          setInputText('');
          return;
        }

        // Clear input field immediately
        setInputText('');
        
        // Create user message immediately for instant feedback
        const userMessage: ChatMessage = {
          id: `temp-${Date.now()}`,
          text: transcript,
          sender: 'user',
          timestamp: new Date(),
          conversationId: currentConversation?.id || '',
          userId: getAuth().currentUser?.uid || 'unknown',
          personalityId: selectedPersonality.id,
          profileId: profileId || ''
        };

        // Add user message to the conversation immediately
        setMessages(prev => [...prev, userMessage]);

        // Send to backend and get AI response
        const userId = getAuth().currentUser?.uid;
        if (!userId || !currentConversation?.id) {
          throw new Error('User not authenticated or no active conversation');
        }

        const response = await sendMessageToBackendAndGetResponse(
          transcript,
          selectedPersonality.id, // Use the ID of the selected personality
          profileId,
          currentConversation.id,
          userId
        );

        if (!response) {
          throw new Error('No response from server');
        }

        // Add the message to the conversation
        const { message: aiMessage } = response;

        // Update UI with the AI message first for immediate feedback
        setMessages(prev => [...prev, aiMessage]);

        // Start TTS in parallel
        const responseText = aiMessage.text;
        if (responseText) {
          const startTts = async () => {
            try {
              // Clean up the text for TTS
              const cleanText = responseText
                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                .replace(/\.{3,}/g, '.')
                .replace(/\s+/g, ' ')
                .trim();

              if (!cleanText) {
                console.log('No text to speak after cleaning');
                return;
              }
              
              console.log('TTS - Cleaned text:', cleanText);
              stopTtsPlayback();
              
              // Split text into chunks if it's too long (200 chars per chunk)
              const MAX_CHUNK_LENGTH = 200;
              for (let i = 0; i < cleanText.length; i += MAX_CHUNK_LENGTH) {
                const chunk = cleanText.substring(i, i + MAX_CHUNK_LENGTH);
                if (chunk.trim()) {
                  await playTtsChunk(chunk);
                }
              }
            } catch (ttsError) {
              console.error('Error with TTS service:', ttsError);
              fallbackTts(responseText);
            }
          };
          
          // Start TTS without awaiting it
          startTts();
        }
      } catch (error) {
        console.error('Error in speech recognition or message processing:', error);
        setInputText('');
        alert('Failed to process speech. Please try again.');
      } finally {
        setIsTyping(false);
      }
    } else {
      // Start recording
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Clear any previous input
        setInputText('Listening...');

        // Start speech recognition
        const started = await startSpeechRecognition();
        if (!started) {
          setInputText('');
          alert('Could not start speech recognition. Please try again.');
        }
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setInputText('');
        alert('Microphone access is required for speech recognition. Please allow microphone access and try again.');
      }
    }
  };

  // Handle personality selection
  const handlePersonalitySelect = (personality: PersonalityType) => {
    setSelectedPersonality(personality);
    setShowPersonalityModal(false);
    // Optionally, start a new conversation when personality changes, or clear messages
    // For now, it just changes the personality for the *next* message in current/new conversation
    // Consider if changing personality should imply a new conversation context:
    // setCurrentConversation(null); 
    // setMessages([]);
    // createNewConversation();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    conversationsButton: {
      padding: 8,
      marginRight: 8,
      marginLeft: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    networkStatusBar: {
      backgroundColor: colors.notification, // Or a specific color for offline
      padding: 8,
      alignItems: 'center'
    },
    networkStatusText: {
      color: colors.card // Or a contrasting color
    },
    messageList: {
      flex: 1,
      paddingHorizontal: 10
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120, // Allow multiline input up to a certain height
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.background, // Input field background
      borderRadius: 20,
      marginHorizontal: 8,
      color: colors.text,
      fontSize: 16
    },
    sendButton: {
      padding: 10,
      borderRadius: 20,
      backgroundColor: colors.background
    },
    sendButtonDisabled: {
      backgroundColor: colors.border // A more muted color for disabled state
    },
    micButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 5,
      marginRight: 8
    },
    stopButton: {
      backgroundColor: colors.primary,
    },
    stopIcon: {
      width: 20,
      height: 20,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 2,
    },
    stopIconInner: {
      width: 12,
      height: 12,
      backgroundColor: '#ff4d4f',
      borderRadius: 1,
    },
    personalityButton: {
      padding: 10
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end', // Aligns modal to bottom or 'center' for middle
      backgroundColor: 'rgba(0,0,0,0.5)' // Semi-transparent overlay
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%' // Limit height for personality/history list
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center'
    },
    personalityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background // Slightly different from modalContent for contrast
    },
    personalityInfo: {
      flex: 1,
      marginLeft: 12
    },
    personalityName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4
    },
    personalityDesc: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.8
    },
    emptyText: {
      color: colors.text,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 16,
      opacity: 0.7
    },
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.1)'
    }
  });

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading session...</Text>
      </View>
    );
  }

  if (!profileId && !authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, marginBottom: 20, textAlign: 'center' }}>
          Could not determine user profile. Please try logging in again.
        </Text>
      </View>
    );
  }
  // Use KeyboardAvoidingView on iOS and Android (not web) to handle keyboard pop-up without blank space.
  // On web, use regular View to avoid layout bugs. On Android, use behavior='height' for best results.
  // Platform-specific KeyboardAvoidingView for iOS/Android, View for web
  const isWeb = Platform.OS === 'web';
  const Container = !isWeb ? KeyboardAvoidingView : View;
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 64 : Platform.OS === 'android' ? 0 : 0;

  return (
    <Container
      style={[styles.container, { flex: 1 }]}
      {...(!isWeb ? {
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
        keyboardVerticalOffset,
        enabled: true,
      } : {})}
    >
      <Header onPressConversations={() => setShowHistoryModal(true)} />
      {!isOnline && (
        <View style={styles.networkStatusBar}>
          <Text style={styles.networkStatusText}>You are offline. Some features may be limited.</Text>
        </View>
      )}
      {console.log('Rendering messages:', messages.map(m => ({ id: m.id, sender: m.sender, ts: m.timestamp, text: m.text })))}
      <FlatList
        ref={flatListRef}
        data={isTyping ? [...messages, { id: 'typing-indicator', text: '', sender: 'assistant' as const, personalityId: selectedPersonality.id || 'default', userId: 'ai', timestamp: new Date(), conversationId: currentConversation?.id || '', profileId: profileId || '' }] : messages}
        keyExtractor={(item: ChatMessage, index) => {
          if (item.id === 'typing-indicator') return 'typing-indicator';
          if ('isOptimistic' in item && item.isOptimistic) {
            return `temp-${item.id}-${index}`;
          }
          const timestamp = item.timestamp instanceof Date ? item.timestamp.getTime() :
            typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() :
              Date.now();
          return `msg-${item.id}-${item.sender}-${timestamp}`;
        }}
        renderItem={({ item }: { item: ChatMessage }) => {
          if (item.id === 'typing-indicator') {
            return <TypingBubble />;
          }
          return (
            <MessageBubble
              key={`${item.id}-${item.timestamp}`}
              text={item.text}
              sender={item.sender}
              personalityEmoji={item.sender === 'assistant' && PERSONALITIES[item.personalityId || 'default']?.emoji ? PERSONALITIES[item.personalityId || 'default'].emoji : undefined}
            />
          );
        }}
        style={[styles.messageList, { flex: 1 }]}
        contentContainerStyle={{ 
          flexGrow: 1, 
          justifyContent: 'flex-end', 
          paddingBottom: 0, 
          paddingTop: 0 
        }}
        onContentSizeChange={() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
        onLayout={() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={() => (
          !isLoadingMessages && (
            <Text style={styles.emptyText}>
              {currentConversation ? 'No messages yet. Start typing!' : 'Select or start a new conversation.'}
            </Text>
          )
        )}
        removeClippedSubviews={false}
        initialNumToRender={50}
        maxToRenderPerBatch={10}
        windowSize={21}
      />
      <View style={[styles.inputContainer, { marginBottom: Platform.OS === 'ios' ? 8 : Platform.OS === 'android' ? 4 : 0 }]}>
        <TouchableOpacity
          style={styles.personalityButton}
          onPress={() => setShowPersonalityModal(true)}
        >
          <MaterialCommunityIcons
            name={selectedPersonality.icon as any} // Cast as any if icon names are not strictly typed
            size={24}
            color={selectedPersonality.color}
          />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { minHeight: 40, maxHeight: 120 }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${selectedPersonality.name}...`}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!isLoadingMessages && !!currentConversation}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={() => {
            if (inputText.trim() && currentConversation) {
              void handleSendMessage(inputText);
            }
          }}
        />
        <TouchableOpacity
          style={[
            styles.micButton,
            isListening && styles.micButtonActive,
            (isTyping || isTtsPlaying) && styles.micButtonDisabled,
            isTtsPlaying && styles.stopButton,
          ]}
          onPress={handleMicPress}
          disabled={isTyping}
        >
          {isTtsPlaying ? (
            <View style={styles.stopIcon}>
              <View style={styles.stopIconInner} />
            </View>
          ) : (
            <Icon
              name={isListening ? 'stop' : 'mic'}
              size={24}
              color={isTyping ? '#999' : (isListening ? '#fff' : colors.primary)}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isTyping || isLoadingMessages || !currentConversation) && styles.sendButtonDisabled]}
          onPress={() => {
            if (inputText.trim() && currentConversation) {
              void handleSendMessage(inputText);
            }
          }}
          disabled={!inputText.trim() || isTyping || isLoadingMessages || !currentConversation}
        >
          <MaterialCommunityIcons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPersonalityModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPersonalityModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPersonalityModal(false)} // Close when overlay is pressed
        >
          <Pressable style={styles.modalContent}> {/* Prevent closing when content is pressed */}
            <Text style={styles.modalTitle}>Choose Personality</Text>
            <FlatList<PersonalityType>
              data={Object.values(PERSONALITIES)}
              keyExtractor={(item: PersonalityType) => item.id}
              renderItem={({ item }: { item: PersonalityType }) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.personalityItem}
                  onPress={() => handlePersonalitySelect(item)}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                  <View style={styles.personalityInfo}>
                    <Text style={styles.personalityName}>{item.name}</Text>
                    <Text style={styles.personalityDesc}>{String(item.description || "")}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* History Modal - TODO: Implement fully */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowHistoryModal(false)}
        >
          <Pressable style={styles.modalContent}>
            <Text style={styles.modalTitle}>Conversation History</Text>
            <TouchableOpacity
              style={[
                styles.personalityItem,
                { backgroundColor: messages.length === 0 ? '#ccc' : '#e0e0e0', marginBottom: 8, opacity: messages.length === 0 ? 0.6 : 1 }
              ]}
              disabled={messages.length === 0}
              onPress={async () => {
                if (messages.length === 0) return;
                const newConvo = await createNewConversation();
                if (newConvo) {
                  setCurrentConversation(newConvo);
                  setShowHistoryModal(false);
                }
              }}
            >
              <MaterialCommunityIcons name="plus" size={24} color={messages.length === 0 ? '#aaa' : '#3a86ff'} />
              <View style={styles.personalityInfo}>
                <Text style={styles.personalityName}>
                  {messages.length === 0 ? 'Finish current conversation to start new' : 'Start New Conversation'}
                </Text>
              </View>
            </TouchableOpacity>
            <FlatList
              data={conversations.slice(0, 20)}
              keyExtractor={(item: Conversation) => item.id}
              renderItem={({ item }: { item: Conversation }) => (
                <TouchableOpacity
                  style={[styles.personalityItem, currentConversation?.id === item.id && { backgroundColor: '#d0ebff' }]}
                  onPress={() => {
                    setCurrentConversation(item);
                    setShowHistoryModal(false);
                  }}
                >
                  <MaterialCommunityIcons name="message-text" size={24} color="#888" />
                  <View style={styles.personalityInfo}>
                    <Text style={styles.personalityName} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.personalityDesc} numberOfLines={1}>{item.lastMessage || 'No messages yet.'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>{formatTimestamp(item.timestamp)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No conversations yet.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
      {isLoadingMessages &&
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      }
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: '#fff', // Ensure background is never transparent
  },
  networkStatusBar: {
    backgroundColor: '#f8d7da',
    padding: 6,
    alignItems: 'center',
  },
  networkStatusText: {
    color: '#721c24',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 8,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#3a86ff',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c4de',
  },
  micButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3a86ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginRight: 4,
  },
  stopButton: {
    backgroundColor: '#ff4d4f',
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  stopIconInner: {
    width: 12,
    height: 12,
    backgroundColor: '#ff4d4f',
    borderRadius: 1,
  },
  personalityButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  personalityItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  personalityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personalityName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  personalityDesc: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  emptyText: {
    color: '#aaa',
    fontStyle: 'italic',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Header styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  logo: {
    width: 64, // Increased size
    height: 64, // Increased size
    marginRight: 20,
    borderRadius: 16,
  },
  headerTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24, // Slightly bigger
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    marginTop: 2,
    fontStyle: 'italic',
  },
  conversationsButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
  hamburgerIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerLine: {
    width: 22,
    height: 3,
    backgroundColor: '#3a86ff',
    marginVertical: 2,
    borderRadius: 2,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  drawerContainer: {
    width: 280,
    height: '100%',
    backgroundColor: '#fff',
    paddingTop: 48,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
  drawerTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 16,
  },
  // Add any additional styles below this line if needed
});

export default ChatScreen;
