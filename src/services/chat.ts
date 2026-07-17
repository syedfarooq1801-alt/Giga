import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  serverTimestamp,
  onSnapshot 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const MESSAGES_LIMIT = 50;

export interface Message {
  id?: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: any; // Firestore timestamp
  conversationId: string;
  userId: string;
  personality?: string;
}

export interface Conversation {
  id?: string;
  title: string;
  userId: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
  personality?: string;
}

// Get current user ID
export const getCurrentUserId = (): string => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

// Create a new conversation
export const createConversation = async (title: string, personality: string = 'default'): Promise<Conversation> => {
  try {
    const userId = getCurrentUserId();
    const conversationData: Omit<Conversation, 'id'> = {
      title,
      userId,
      personality,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return { id: docRef.id, ...conversationData };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

// Get all conversations for the current user
export const getConversations = async (): Promise<Conversation[]> => {
  try {
    const userId = getCurrentUserId();
    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Conversation[];
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
};

// Update a conversation
export const updateConversation = async (
  conversationId: string,
  updates: Partial<Omit<Conversation, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
};

// Delete a conversation and its messages
export const deleteConversation = async (conversationId: string): Promise<void> => {
  try {
    // Delete the conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    await deleteDoc(conversationRef);

    // Delete all messages in the conversation
    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId)
    );
    
    const querySnapshot = await getDocs(messagesQuery);
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
};

// Send a new message
export const sendMessage = async (
  conversationId: string,
  text: string,
  sender: 'user' | 'bot',
  personality: string = 'default'
): Promise<Message> => {
  try {
    const userId = getCurrentUserId();
    const messageData: Omit<Message, 'id'> = {
      text,
      sender,
      conversationId,
      userId,
      personality,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'messages'), messageData);
    
    // Update the conversation's updatedAt timestamp
    await updateConversation(conversationId, { updatedAt: serverTimestamp() });

    return { id: docRef.id, ...messageData };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Get messages for a conversation
export const getMessages = async (conversationId: string): Promise<Message[]> => {
  try {
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc'),
      limit(MESSAGES_LIMIT)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
};

// Subscribe to conversation updates
export const subscribeToConversationUpdates = (
  conversationId: string,
  callback: (messages: Message[]) => void
) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
    
    callback(messages);
  });
};

// Subscribe to conversations list updates
export const subscribeToConversations = (
  callback: (conversations: Conversation[]) => void
) => {
  const userId = getCurrentUserId();
  const q = query(
    collection(db, 'conversations'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const conversations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Conversation[];
    
    callback(conversations);
  });
};
