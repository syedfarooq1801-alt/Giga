import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { API_URL } from '../constants';
import { speechToText, startSpeechRecognition, stopSpeechRecognition, isRecognitionActive } from '../utils/speechRecognition';
import type { FC } from 'react';
import { PERSONALITIES, DEFAULT_PERSONALITY_ID } from '../constants/personalities';
import { useTheme } from '../contexts/ThemeContext';
import {
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
  Image,
  useWindowDimensions
} from 'react-native';


import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, MaterialIcons as Icon } from '@expo/vector-icons';
import { MessageBubble } from '../components/MessageBubble';
import { TypingBubble } from '../components/TypingBubble';
import { ChatHeader } from '../components/chat/ChatHeader';
import { getPersonaAccent } from '../theme/tokens';
import { sendMessageToBackendStream } from '../services/chatStream';
import Toast from 'react-native-toast-message';
import { getAuth } from 'firebase/auth';
import { getConversationTitleFromGroq } from '../utils/groqTitle';
import { pickAndUploadDocument } from '../services/documents';
import * as ImagePicker from 'expo-image-picker';
import { PersonalityType } from '../types/chat';
import { Conversation } from '../types/Conversation';
import { ChatMessage, BackendMessage, mapBackendMessageToChatMessage } from '../types/ChatMessage';
import { RootStackParamList } from '../types/navigation';

import { consumePendingConversationId } from '../utils/pendingConversation';

const GigaLogo = require('../Giga-logo1.png');

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


const sendMessageToBackendAndGetResponse = async (
  text: string,
  personalityId: string,
  profileId: string,
  conversationId: string | null,
  userId: string,
  useDocuments = false,
  imageDataUrl?: string
): Promise<{ message: ChatMessage; conversationId: string } | null> => {
  if ((!text && !imageDataUrl) || !personalityId || !profileId || !userId) { // conversationId can be null for new chats
    throw new Error('Missing required parameters');
  }
  try {
    const netInfoState = await NetInfo.fetch();
    const isOnline = netInfoState.isConnected ?? false;
    if (!isOnline) {
      throw new Error('No internet connection');
    }
    // Note: the user's message is already written to Firestore by the caller
    // (handleSendMessage, under the conversation-scoped path) before this runs —
    // writing it again here to a flat, unread collection was dead weight.

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
      use_documents: useDocuments,
      image: imageDataUrl,
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
      messageDocId: data.message_id,
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

// Main ChatScreen component
const ChatScreen = () => {
  const { colors, isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Track processed message IDs to prevent duplicates
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [inputText, setInputText] = useState('');
  // "Use my docs" toggle -- per-session UI state, not persisted server-side
  // (see api/rag.py's rag_override: the request itself is the single
  // source of truth for whether RAG runs on a given turn, no extra
  // Firestore read needed).
  const [useDocuments, setUseDocuments] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string } | null>(null);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>(PERSONALITIES[DEFAULT_PERSONALITY_ID]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Wide web viewports get a persistent left sidebar (ChatGPT's structure);
  // narrower/native falls back to the hamburger + modal history pattern.
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && windowWidth >= 900;
  const { session, loading: authLoading } = useAuth();
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'Chat'>>();
  const flatListRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  // Tracks whether the user is scrolled near the bottom -- auto-scroll only
  // sticks when true, so streaming replies don't yank the view down if
  // they've scrolled up to read earlier history (matches ChatGPT behavior).
  const isNearBottomRef = useRef(true);

  // VirtualizedList's scrollToEnd() targets its own internally-tracked
  // content length (fed by onContentSizeChange), which doesn't update
  // reliably through react-native-web's FlatList -- it ends up scrolling to
  // a stale, too-short target. On web we bypass that entirely and drive the
  // real DOM scroll node directly; on native, RN's scrollToEnd is correct.
  const scrollToBottom = useCallback((animated: boolean) => {
    if (Platform.OS === 'web') {
      const node = flatListRef.current?.getScrollableNode?.();
      if (node) {
        node.scrollTop = node.scrollHeight;
        return;
      }
    }
    flatListRef.current?.scrollToEnd?.({ animated });
  }, []);

  // Set up network listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      handleNetworkChange(state);
    });
    return () => unsubscribe();
  }, []);

  // State to hold all conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Loads the user's conversations from the backend (single source of
  // truth -- the old direct-Firestore-write path here was disconnected
  // from what the backend actually persists) and sets the most recent as
  // current. Hoisted to a stable callback (not just inline in the session
  // effect below) so it can also be re-run on focus -- that's what picks up
  // a conversation just forked from a shared-chat link, since forking
  // happens on a different screen and only updates the backend's most-
  // recent-conversation ordering, not this screen's already-mounted state.
  const restoreLastConversation = useCallback(async (pid: string, selectId?: string) => {
    try {
      const authInstance = getAuth();
      const idToken = await authInstance.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const fetched: Conversation[] = (data.conversations || []).map((c: any) => ({
        id: c.id,
        title: c.title || 'Untitled',
        lastMessage: c.last_message || '',
        timestamp: c.last_message_time ? new Date(c.last_message_time) : new Date(),
        personalityId: c.personality || DEFAULT_PERSONALITY_ID,
      }));
      setConversations(fetched);
      if (fetched.length === 0) {
        console.log('[ChatScreen] No conversations found for profile. Will create new conversation on first message.');
        setCurrentConversation(null);
      } else if (selectId) {
        setCurrentConversation(fetched.find(c => c.id === selectId) || fetched[0]);
      } else {
        setCurrentConversation(fetched[0]); // Set most recent as current
      }
    } catch (error) {
      console.error('[ChatScreen] Error loading conversations:', error);
      setConversations([]);
      setCurrentConversation(null);
    }
  }, []);

  // Derive profileId and userId from session
  useEffect(() => {
    if (session?.user && session.profileId) {
      setProfileId(session.profileId);
      setUserId(session.user.uid);
      console.log('Profile ID set:', session.profileId, 'User ID set:', session.user.uid);
      restoreLastConversation(session.profileId);
    } else if (!authLoading && !session) {
      setProfileId(null);
      setUserId(null);
      setCurrentConversation(null);
    }
  }, [session, authLoading, restoreLastConversation]);

  // Only acts when a conversation was just forked elsewhere (shared-chat
  // "Continue this chat") -- an ordinary tab switch back to Chat is a no-op,
  // so the user's manually-selected conversation is never silently reset.
  useFocusEffect(
    useCallback(() => {
      const pendingId = consumePendingConversationId();
      if (pendingId && profileId) {
        restoreLastConversation(profileId, pendingId);
      }
    }, [profileId, restoreLastConversation])
  );

  const handleNetworkChange = (state: NetInfoState) => {
    setIsOnline(state.isConnected ?? false);
  };

  // Local-only: resets state to a fresh, not-yet-persisted conversation.
  // No Firestore write, no backend call -- the backend creates the real
  // chat doc lazily on the first /chat or /chat/stream call for it (both
  // already handle conversation_id being empty/undefined). id: '' is the
  // "not yet created server-side" sentinel; handleSendMessage passes
  // undefined instead of '' to the backend and adopts whatever id comes back.
  const createNewConversation = (): Conversation => {
    const conversation: Conversation = {
      id: '',
      title: `New ${selectedPersonality.name} Chat`,
      lastMessage: '',
      timestamp: new Date(),
      personalityId: selectedPersonality.id,
    };
    setMessages([]);
    setCurrentConversation(conversation);
    return conversation;
  };

  // Auto-titles a conversation from its first exchange (ChatGPT-style),
  // replacing the generic "Continuation of chat <timestamp>" default that
  // store_message() stamps on chat-doc creation. Fire-and-forget from the
  // caller -- this shouldn't block or fail the actual send.
  const generateAndSetConversationTitle = async (conversationId: string, userText: string, assistantText: string) => {
    try {
      const authInstance = getAuth();
      const idToken = await authInstance.currentUser?.getIdToken();
      const title = await getConversationTitleFromGroq([{ text: userText }, { text: assistantText }]);
      if (!title.trim()) return;

      const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;

      // This is the conversation's FIRST message -- it was only just
      // created server-side by this same send, so it's very likely not in
      // local `conversations` state yet (that list is only populated by a
      // fetch, and nothing re-fetches mid-send). A plain .map() would
      // silently no-op in that case, leaving the sidebar showing the stale
      // default title until the next reload/switch -- prepend a fresh
      // entry instead when there's nothing to update in place.
      setConversations(prev => {
        const exists = prev.some(c => c.id === conversationId);
        if (exists) return prev.map(c => (c.id === conversationId ? { ...c, title } : c));
        return [
          {
            id: conversationId,
            title,
            lastMessage: assistantText,
            timestamp: new Date(),
            personalityId: selectedPersonality.id,
          },
          ...prev,
        ];
      });
      setCurrentConversation(prev => (prev && prev.id === conversationId ? { ...prev, title } : prev));
    } catch (error) {
      console.error('[ChatScreen] Failed to auto-title conversation:', error);
    }
  };

  // Upload straight from the chat input (paperclip icon) instead of
  // requiring a detour through Settings -- auto-enables "use my docs" on a
  // successful upload, since uploading something is a clear signal the
  // user wants the next reply to use it.
  const handleAttachDocument = async () => {
    setIsUploadingDoc(true);
    const result = await pickAndUploadDocument();
    setIsUploadingDoc(false);
    if (result) setUseDocuments(true);
  };

  // Picks an image and stores it as a data URL for the NEXT send -- vision
  // is a one-shot per-message thing (see api/groq_handler.py's
  // get_groq_vision_response), not a persistent per-conversation toggle
  // like RAG, so there's no equivalent "enable" flag to flip here.
  const handleAttachImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Toast.show({ type: 'error', text1: 'Could not read that image', position: 'bottom' });
      return;
    }
    const mimeType = asset.mimeType || 'image/jpeg';
    setPendingImage({ dataUrl: `data:${mimeType};base64,${asset.base64}` });
  };

  const handleSendMessage = async (text: string) => {
    if (!profileId || !userId || (!text.trim() && !pendingImage)) return;

    console.log('Sending message:', { text, profileId, userId });

    // Captured immediately: clearing pendingImage right away (rather than
    // after the request resolves) makes the input bar's preview disappear
    // the instant you hit send, matching how inputText itself is cleared
    // below -- not left hanging until the network round-trip finishes.
    const imageToSend = pendingImage;
    setPendingImage(null);

    // Captured before any optimistic state mutation below -- this is the
    // one reliable way to know "was this conversation empty before this
    // turn", which is what should trigger auto-titling (once, on the first
    // exchange, not on every message after).
    const isFirstMessageInConversation = messages.length === 0;

    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Ensure we have a conversation (id may be '' -- not yet created server-side)
    let conversationToUse = currentConversation ?? createNewConversation();

    const convId = conversationToUse.id;
    console.log('Using conversation ID:', convId || '(new, not yet created)');

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
      isOptimistic: true,
      imageUri: imageToSend?.dataUrl,
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

    // Sending a message always jumps to the bottom, regardless of where the
    // user was scrolled -- onContentSizeChange picks this up on the next
    // content-size change (the new message / streaming reply arriving).
    isNearBottomRef.current = true;

    try {
      // The user's message is no longer written to Firestore directly from
      // here -- the backend persists both sides of the turn (via
      // store_message inside /chat and /chat/stream) as the single source
      // of truth. tempUserMessage IS userMessage; its messageDocId gets
      // filled in once the backend responds with the turn's doc id.
      const userMessage = tempUserMessage;

      // Send to backend and get AI response.
      // Web: stream the reply in sentence chunks. Native: wait for the full
      // response (RN's fetch doesn't reliably support ReadableStream yet).
      // Image turns always use the non-streaming path regardless of
      // platform -- vision is a one-shot Groq call (get_groq_vision_response
      // in api/groq_handler.py), there's no streaming vision endpoint.
      if (Platform.OS === 'web' && !imageToSend) {
        const streamId = `stream-${Date.now()}`;
        const userTs = userMessage.timestamp.getTime();
        const streamPlaceholder: ChatMessage = {
          id: streamId,
          text: '',
          userId: 'ai',
          sender: 'assistant',
          timestamp: new Date(userTs + 1),
          personalityId: selectedPersonality.id,
          profileId,
          conversationId: convId,
        };
        let firstChunkReceived = false;

        try {
          const streamResult = await sendMessageToBackendStream(
            userMessage.text,
            selectedPersonality.id,
            profileId,
            convId,
            userId,
            (chunk) => {
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                setIsTyping(false);
                setMessages(prev => [...prev, streamPlaceholder]);
              }
              setMessages(prev =>
                prev.map(msg => (msg.id === streamId ? { ...msg, text: msg.text + chunk } : msg))
              );
            },
            useDocuments
          );

          setIsTyping(false);

          if (streamResult) {
            const finalText = streamResult.fullText || 'Sorry, the AI could not generate a response.';
            const finalConvId = streamResult.conversationId || convId;
            setMessages(prev => {
              const withoutPlaceholder = prev.filter(msg => msg.id !== streamId);
              return withoutPlaceholder.map(msg =>
                msg.id === tempId
                  ? { ...msg, messageDocId: streamResult.messageId || undefined, conversationId: finalConvId }
                  : msg
              ).concat({
                ...streamPlaceholder,
                text: finalText,
                messageDocId: streamResult.messageId || undefined,
                conversationId: finalConvId,
              });
            });
            processedMessageIds.current.add(streamId);

            if (finalConvId !== convId) {
              conversationToUse = { ...conversationToUse, id: finalConvId };
            }
            setCurrentConversation({
              ...conversationToUse,
              lastMessage: finalText,
              timestamp: streamPlaceholder.timestamp,
              personalityId: selectedPersonality.id,
            });

            if (isFirstMessageInConversation) {
              void generateAndSetConversationTitle(finalConvId, userMessage.text, finalText);
            }
          }
        } catch (streamError) {
          console.error('Error streaming message:', streamError);
          setIsTyping(false);
          setMessages(prev => prev.filter(msg => msg.id !== streamId));
          Toast.show({ type: 'error', text1: 'Failed to send message', text2: 'Check your connection and try again.', position: 'bottom' });
        }

        return;
      }

      const backendResult = await sendMessageToBackendAndGetResponse(
        userMessage.text,
        selectedPersonality.id,
        profileId,
        convId,
        userId,
        useDocuments,
        imageToSend?.dataUrl
      );

      if (backendResult?.message && backendResult.conversationId) {
        const aiMessage = backendResult.message;
        const returnedConversationId = backendResult.conversationId;

        // Ensure AI message has a unique ID
        if (!aiMessage.id) {
          aiMessage.id = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Ensure bot timestamp is after user message
        const userTs = userMessage.timestamp.getTime();

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
          conversationToUse = { ...conversationToUse, id: returnedConversationId };
        }

        // Add the AI message, and attach the same messageDocId to the user's
        // message (both halves of one turn share a single backend doc id).
        setMessages(prev => {
          const filtered = prev.filter(msg => msg.id !== aiMessage.id);
          return filtered.map(msg =>
            msg.id === tempId
              ? { ...msg, messageDocId: aiMessage.messageDocId, conversationId: returnedConversationId }
              : msg
          ).concat(aiMessage);
        });

        // Mark AI message as processed
        processedMessageIds.current.add(aiMessage.id);

        setCurrentConversation({
          ...conversationToUse,
          lastMessage: aiMessage.text,
          timestamp: aiMessage.timestamp,
          personalityId: aiMessage.personalityId,
        });

        if (isFirstMessageInConversation) {
          void generateAndSetConversationTitle(returnedConversationId, userMessage.text, aiMessage.text);
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
      Toast.show({ type: 'error', text1: 'Failed to send message', text2: 'Check your connection and try again.', position: 'bottom' });
    }
  };

  // Regenerate/reactions only make sense on the most recent assistant reply.
  const lastAssistantId = useMemo(() => {
    const assistantMessages = messages.filter(m => m.sender === 'assistant');
    return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].id : null;
  }, [messages]);

  const handleReact = async (msg: ChatMessage, thumbsUp: boolean, thumbsDown: boolean) => {
    if (!currentConversation?.id || !msg.messageDocId) return;
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, reactions: { thumbsUp, thumbsDown } } : m)));
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      await fetch(`${API_URL}/api/conversations/${currentConversation.id}/messages/${msg.messageDocId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ thumbs_up: thumbsUp, thumbs_down: thumbsDown }),
      });
    } catch (error) {
      console.error('Error reacting to message:', error);
    }
  };

  const handleRegenerate = async (msg: ChatMessage) => {
    if (!currentConversation?.id || !msg.messageDocId) return;
    setRegeneratingId(msg.id);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/conversations/${currentConversation.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ message_id: msg.messageDocId }),
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, text: data.response } : m)));
      }
    } catch (error) {
      console.error('Error regenerating message:', error);
      Toast.show({ type: 'error', text1: 'Failed to regenerate response', text2: 'Please try again.', position: 'bottom' });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleShare = async () => {
    if (!currentConversation?.id) return;
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/conversations/${currentConversation.id}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const fullUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}${data.url}`
        : data.url;

      let copied = false;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(fullUrl);
          copied = true;
        } catch (clipboardError) {
          console.warn('Clipboard write failed, falling back to showing the link:', clipboardError);
        }
      }

      Toast.show({
        type: 'success',
        text1: copied ? 'Link copied' : 'Share link ready',
        text2: copied ? 'Share link copied to clipboard.' : fullUrl,
        position: 'bottom',
        visibilityTime: copied ? 3000 : 6000,
      });
    } catch (error) {
      console.error('Error sharing conversation:', error);
      Toast.show({ type: 'error', text1: 'Failed to create share link', text2: 'Please try again.', position: 'bottom' });
    }
  };

  const loadMessages = useCallback(async () => {
    if (!profileId || !currentConversation?.id) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    try {
      const authInstance = getAuth();
      const idToken = await authInstance.currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/conversations/${currentConversation.id}/messages`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Backend error: ${res.status}`);
      const data = await res.json();
      const fetched: ChatMessage[] = (data.messages || []).map((m: BackendMessage) =>
        mapBackendMessageToChatMessage(m, userId || '', profileId, currentConversation.id)
      );

      setMessages(prevMessagesInState => {
        if (!currentConversation?.id) return [];
        // Keep any still-in-flight optimistic messages for this conversation
        // that the backend fetch doesn't have yet (e.g. a send in progress).
        const optimisticForCurrentConv = prevMessagesInState.filter(
          msg => msg.conversationId === currentConversation.id && msg.isOptimistic &&
            !fetched.find(fm => fm.text === msg.text && fm.sender === msg.sender)
        );

        const newMessagesToShow = [...fetched, ...optimisticForCurrentConv];
        newMessagesToShow.sort((a, b) => {
          const tsA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const tsB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          if (tsA !== tsB) return tsA - tsB;
          if (a.sender === 'user' && b.sender === 'assistant') return -1;
          if (a.sender === 'assistant' && b.sender === 'user') return 1;
          return 0;
        });
        return newMessagesToShow;
      });
      console.log('Loaded messages from backend:', fetched.length);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [profileId, userId, currentConversation?.id]);

  // Effect to load messages when profileId or the ACTIVE conversation
  // changes. Deliberately depends on currentConversation?.id, not the
  // whole currentConversation object -- handleSendMessage calls
  // setCurrentConversation({...}) with a fresh object after every single
  // send (to bump lastMessage/timestamp), which doesn't change which
  // conversation is open. Depending on the object itself made this effect
  // (and the full-screen loading overlay it triggers via loadMessages)
  // refire on every message sent, not just on an actual conversation switch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, currentConversation?.id, loadMessages]);

  // Primary auto-scroll trigger. onContentSizeChange doesn't fire reliably
  // through react-native-web's FlatList, so this plain effect (which fires
  // on every messages-array identity change, including per-chunk updates
  // during streaming) is the real source of truth -- non-animated so rapid
  // streaming updates don't stack animated scrolls, and gated on
  // isNearBottomRef so it doesn't yank the view if the user scrolled up.
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  // Web: Enter sends, Shift+Enter inserts a newline. RN's multiline
  // TextInput maps to a plain <textarea> under react-native-web, and
  // onSubmitEditing never fires on it there -- Enter just does the
  // textarea's default (newline). Native keeps the existing
  // onSubmitEditing/returnKeyType="send" behavior (the soft-keyboard
  // return key), which already works correctly and doesn't need this.
  useEffect(() => {
    if (Platform.OS !== 'web' || !inputRef.current) return;
    const node = inputRef.current as unknown as HTMLTextAreaElement;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (inputText.trim() && !isLoadingMessages) {
          void handleSendMessage(inputText);
        }
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [inputText, currentConversation, isLoadingMessages]);

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
          userId,
          useDocuments
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

  // Handle personality selection — changes the persona for the *next* message
  // in the current/new conversation (doesn't start a new conversation).
  const handlePersonalitySelect = (personality: PersonalityType) => {
    setSelectedPersonality(personality);
  };

  const accentColor = getPersonaAccent(selectedPersonality.id, isDark);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    networkStatusBar: {
      backgroundColor: colors.dangerBg,
      padding: 8,
      alignItems: 'center',
    },
    networkStatusText: {
      color: colors.danger,
      fontSize: 13,
    },
    messageList: {
      flex: 1,
      paddingHorizontal: 24,
    },
    inputOuter: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 14,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 6,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 160,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: 'transparent',
      marginHorizontal: 2,
      color: colors.ink,
      fontSize: 15,
    },
    docsToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    pendingImageRow: {
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    pendingImageThumb: {
      width: 56,
      height: 56,
      borderRadius: 10,
    },
    pendingImageRemove: {
      position: 'absolute',
      top: -6,
      left: 46,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accentColor,
    },
    sendButtonDisabled: {
      backgroundColor: colors.line,
    },
    micButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 4,
      marginRight: 6,
    },
    micButtonActive: {
      backgroundColor: accentColor,
    },
    micButtonDisabled: {
      opacity: 0.5,
    },
    stopButton: {
      backgroundColor: colors.danger,
    },
    stopIcon: {
      width: 18,
      height: 18,
      backgroundColor: colors.paper,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 3,
    },
    stopIconInner: {
      width: 10,
      height: 10,
      backgroundColor: colors.danger,
      borderRadius: 2,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContent: {
      backgroundColor: colors.paper,
      padding: 20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      marginBottom: 16,
      textAlign: 'center',
    },
    personalityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 14,
      marginBottom: 8,
      backgroundColor: colors.surface,
    },
    personalityItemActive: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: accentColor,
    },
    personalityInfo: {
      flex: 1,
      marginLeft: 12,
    },
    personalityName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink,
      marginBottom: 2,
    },
    personalityDesc: {
      fontSize: 13,
      color: colors.sub,
    },
    emptyText: {
      color: colors.sub,
      textAlign: 'center',
      marginTop: 20,
      fontSize: 15,
    },
    loadingContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.1)',
    },
    sidebar: {
      width: 260,
      borderRightWidth: 1,
      paddingTop: 14,
      paddingHorizontal: 10,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      marginBottom: 14,
    },
    sidebarLogo: {
      width: 26,
      height: 26,
      borderRadius: 8,
      marginRight: 8,
    },
    sidebarAppName: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    newChatText: {
      fontSize: 14,
      fontWeight: '600',
    },
    sidebarList: {
      flex: 1,
    },
    sidebarItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 2,
    },
    sidebarItemText: {
      fontSize: 13.5,
    },
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
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.paper }}>
      {isWideScreen && (
        <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.line }]}>
          <View style={styles.sidebarHeader}>
            <Image source={GigaLogo} style={styles.sidebarLogo} resizeMode="contain" />
            <Text style={[styles.sidebarAppName, { color: colors.ink }]}>Giga BhAI</Text>
          </View>
          <TouchableOpacity
            style={[styles.newChatButton, { borderColor: colors.line, opacity: messages.length === 0 ? 0.5 : 1 }]}
            disabled={messages.length === 0}
            onPress={() => createNewConversation()}
          >
            <MaterialCommunityIcons name="plus" size={18} color={accentColor} />
            <Text style={[styles.newChatText, { color: colors.ink }]}>New chat</Text>
          </TouchableOpacity>
          <FlatList
            data={conversations}
            keyExtractor={(item: Conversation) => item.id}
            style={styles.sidebarList}
            renderItem={({ item }: { item: Conversation }) => (
              <TouchableOpacity
                style={[
                  styles.sidebarItem,
                  currentConversation?.id === item.id && { backgroundColor: colors.line },
                ]}
                onPress={() => setCurrentConversation(item)}
              >
                <Text style={[styles.sidebarItemText, { color: colors.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[styles.emptyText, { fontSize: 13 }]}>No conversations yet.</Text>}
          />
        </View>
      )}
    <Container
      style={[styles.container, { flex: 1 }]}
      {...(!isWeb ? {
        behavior: Platform.OS === 'ios' ? 'padding' : 'height',
        keyboardVerticalOffset,
        enabled: true,
      } : {})}
    >
      <ChatHeader
        onPressConversations={() => setShowHistoryModal(true)}
        personalities={Object.values(PERSONALITIES)}
        selectedPersonality={selectedPersonality}
        onSelectPersonality={handlePersonalitySelect}
        isDefaultPersonality={selectedPersonality.id === DEFAULT_PERSONALITY_ID}
        onShare={currentConversation?.id ? handleShare : undefined}
        hideMenuButton={isWideScreen}
      />
      {!isOnline && (
        <View style={styles.networkStatusBar}>
          <Text style={styles.networkStatusText}>You are offline. Some features may be limited.</Text>
        </View>
      )}
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
              accentColor={accentColor}
              reactions={item.reactions}
              onReact={item.sender === 'assistant' && item.messageDocId ? (up, down) => handleReact(item, up, down) : undefined}
              isLastAssistantMessage={item.sender === 'assistant' && item.id === lastAssistantId}
              onRegenerate={item.messageDocId ? () => handleRegenerate(item) : undefined}
              isRegenerating={regeneratingId === item.id}
              imageUri={item.imageUri}
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
          // Single source of truth for auto-scroll. Non-animated: during
          // streaming this fires on every chunk, and stacking animated
          // scrolls is exactly what caused the jank. Only sticks if the
          // user hasn't scrolled up to read history.
          if (isNearBottomRef.current) {
            scrollToBottom(false);
          }
        }}
        onScroll={({ nativeEvent }: any) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
          isNearBottomRef.current = distanceFromBottom < 120;
        }}
        scrollEventThrottle={16}
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
      <View style={[styles.inputOuter, { paddingBottom: Platform.OS === 'ios' ? 20 : Platform.OS === 'android' ? 16 : 14 }]}>
      {pendingImage && (
        <View style={styles.pendingImageRow}>
          <Image source={{ uri: pendingImage.dataUrl }} style={styles.pendingImageThumb} />
          <TouchableOpacity
            onPress={() => setPendingImage(null)}
            style={[styles.pendingImageRemove, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons name="close" size={14} color={colors.ink} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          onPress={handleAttachImage}
          style={styles.docsToggle}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialCommunityIcons name="image-outline" size={18} color={colors.sub} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAttachDocument}
          disabled={isUploadingDoc}
          style={styles.docsToggle}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isUploadingDoc ? (
            <ActivityIndicator size="small" color={colors.sub} />
          ) : (
            <MaterialCommunityIcons name="paperclip" size={18} color={colors.sub} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setUseDocuments(prev => !prev)}
          style={[styles.docsToggle, useDocuments && { backgroundColor: accentColor }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={18}
            color={useDocuments ? colors.accentContrast : colors.sub}
          />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${selectedPersonality.name}...`}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!isLoadingMessages}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={() => {
            // handleSendMessage lazily creates a conversation
            // (currentConversation ?? createNewConversation()) if none is
            // selected yet -- gating this on currentConversation already
            // existing left a brand-new account (zero conversations, so
            // currentConversation starts null) completely unable to type
            // or send its first-ever message.
            if (inputText.trim()) {
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
              size={20}
              color={isTyping ? colors.sub : isListening ? colors.accentContrast : colors.ink}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isTyping || isLoadingMessages) && styles.sendButtonDisabled]}
          onPress={() => {
            if (inputText.trim()) {
              void handleSendMessage(inputText);
            }
          }}
          disabled={!inputText.trim() || isTyping || isLoadingMessages}
        >
          <MaterialCommunityIcons name="send" size={20} color={colors.accentContrast} />
        </TouchableOpacity>
      </View>
      </View>

      <Modal
        visible={showHistoryModal && !isWideScreen}
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
              style={[styles.personalityItem, { opacity: messages.length === 0 ? 0.5 : 1 }]}
              disabled={messages.length === 0}
              onPress={() => {
                if (messages.length === 0) return;
                createNewConversation();
                setShowHistoryModal(false);
              }}
            >
              <MaterialCommunityIcons name="plus" size={22} color={messages.length === 0 ? colors.sub : accentColor} />
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
                  style={[styles.personalityItem, currentConversation?.id === item.id && styles.personalityItemActive]}
                  onPress={() => {
                    setCurrentConversation(item);
                    setShowHistoryModal(false);
                  }}
                >
                  <MaterialCommunityIcons name="message-text-outline" size={22} color={colors.sub} />
                  <View style={styles.personalityInfo}>
                    <Text style={styles.personalityName} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.personalityDesc} numberOfLines={1}>{item.lastMessage || 'No messages yet.'}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.sub, marginLeft: 'auto' }}>{formatTimestamp(item.timestamp)}</Text>
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
    </View>
  );
};

export default ChatScreen;
