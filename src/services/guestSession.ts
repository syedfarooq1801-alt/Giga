// Local-only persistence for guest mode -- no Firestore, no backend account.
// A guest's identity is just a random id generated once and kept in
// AsyncStorage (localStorage under the hood on web); their conversations
// and messages live entirely in the same storage, shaped identically to
// the Conversation/ChatMessage types ChatScreen already uses for signed-in
// users so the screen can render either with minimal branching.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from '../types/Conversation';
import { ChatMessage } from '../types/ChatMessage';

const GUEST_MODE_KEY = 'guestMode';
const GUEST_ID_KEY = 'guestId';
const GUEST_CONVERSATIONS_KEY = 'guestConversations';
const GUEST_MESSAGES_PREFIX = 'guestMessages_';

export async function isGuestModeEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_MODE_KEY)) === 'true';
}

export async function setGuestModeEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(GUEST_MODE_KEY);
  }
}

export async function getOrCreateGuestId(): Promise<string> {
  const existing = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = `guest_${uuidv4()}`;
  await AsyncStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export async function getGuestConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    // timestamps round-trip through JSON as strings -- rehydrate to Date so
    // callers can sort/format them the same way as the signed-in path.
    return parsed.map(c => ({ ...c, timestamp: new Date(c.timestamp) }));
  } catch (e) {
    console.warn('[guestSession] Failed to read guest conversations:', e);
    return [];
  }
}

export async function saveGuestConversations(conversations: Conversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.warn('[guestSession] Failed to save guest conversations:', e);
  }
}

export async function getGuestMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_MESSAGES_PREFIX + conversationId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch (e) {
    console.warn('[guestSession] Failed to read guest messages:', e);
    return [];
  }
}

export async function saveGuestMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_MESSAGES_PREFIX + conversationId, JSON.stringify(messages));
  } catch (e) {
    console.warn('[guestSession] Failed to save guest messages:', e);
  }
}

export async function deleteGuestConversation(conversationId: string): Promise<void> {
  const conversations = await getGuestConversations();
  await saveGuestConversations(conversations.filter(c => c.id !== conversationId));
  try {
    await AsyncStorage.removeItem(GUEST_MESSAGES_PREFIX + conversationId);
  } catch (e) {
    console.warn('[guestSession] Failed to delete guest messages:', e);
  }
}

/** Everything a guest built up, in the shape /api/guest/migrate expects. */
export async function collectGuestDataForMigration(): Promise<{
  conversations: { title: string; personality: string; messages: { text: string; sender: string }[] }[];
}> {
  const conversations = await getGuestConversations();
  const out = [];
  for (const conv of conversations) {
    const messages = await getGuestMessages(conv.id);
    if (messages.length === 0) continue;
    out.push({
      title: conv.title,
      personality: conv.personalityId,
      messages: messages.map(m => ({ text: m.text, sender: m.sender })),
    });
  }
  return { conversations: out };
}

/** Wipes all local guest data -- call after a successful migration, or if
 * the user explicitly wants to discard guest history without signing in. */
export async function clearGuestData(): Promise<void> {
  const conversations = await getGuestConversations();
  const keys = [
    GUEST_MODE_KEY,
    GUEST_ID_KEY,
    GUEST_CONVERSATIONS_KEY,
    ...conversations.map(c => GUEST_MESSAGES_PREFIX + c.id),
  ];
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    console.warn('[guestSession] Failed to clear guest data:', e);
  }
}
