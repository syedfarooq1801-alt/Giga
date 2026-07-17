import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseFirestore } from '../utils/initFirebase';

const db = getFirebaseFirestore();

// Chat Operations
export const saveChat = async (chatData: any, profileId: string) => {
  const chatRef = doc(collection(db, 'users', profileId, 'chats'));
  await setDoc(chatRef, {
    ...chatData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...chatData, id: chatRef.id };
};

export const getChat = async (chatId: string, profileId: string) => {
  const chatRef = doc(db, 'users', profileId, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  return chatSnap.exists() ? { id: chatSnap.id, ...chatSnap.data() } : null;
};

// Conversation Operations
export const saveConversation = async (conversation: any, profileId: string) => {
  const conversationRef = doc(collection(db, 'users', profileId, 'conversations'));
  await setDoc(conversationRef, {
    ...conversation,
    updatedAt: serverTimestamp(),
    createdAt: conversation.createdAt || serverTimestamp()
  });
  return { ...conversation, id: conversationRef.id };
};

export const getConversation = async (conversationId: string, profileId: string) => {
  const conversationRef = doc(db, 'users', profileId, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);
  return conversationSnap.exists() ? { id: conversationSnap.id, ...conversationSnap.data() } : null;
};

export const getConversations = async (profileId: string, lastVisible: QueryDocumentSnapshot<DocumentData> | null = null, pageSize = 10) => {
  let q = query(
    collection(db, 'users', profileId, 'conversations'),
    orderBy('updatedAt', 'desc'),
    limit(pageSize)
  );

  if (lastVisible) {
    q = query(q, startAfter(lastVisible));
  }

  const querySnapshot = await getDocs(q);
  const conversations = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return {
    conversations,
    lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1] || null
  };
};

export const updateConversation = async (conversationId: string, updates: any, profileId: string) => {
  const conversationRef = doc(db, 'users', profileId, 'conversations', conversationId);
  await updateDoc(conversationRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
  return { id: conversationId, ...updates };
};

export const deleteConversation = async (conversationId: string, profileId: string) => {
  const conversationRef = doc(db, 'users', profileId, 'conversations', conversationId);
  await deleteDoc(conversationRef);
  return { id: conversationId };
};
