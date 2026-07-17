export type MessageReactions = { thumbsUp: boolean; thumbsDown: boolean };

export type ChatMessage = {
  id: string;
  messageDocId?: string; // backend's per-turn Firestore doc ID; undefined for optimistic/local-only entries
  userId: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'assistant';
  conversationId?: string;
  personalityId: string;
  profileId: string; // Added for profile-based data isolation
  isOptimistic?: boolean; // Flag for optimistic updates
  tempId?: string; // Temporary ID for optimistic updates before server confirmation
  reactions?: MessageReactions | null;
  // Client-side only, not persisted -- the backend stores the vision
  // model's text response, not the image itself, so this only survives
  // for the current session's render, not a reload.
  imageUri?: string;
};

export type BackendMessage = {
  id: string;
  message_doc_id: string;
  text: string;
  sender: 'user' | 'assistant';
  personality?: string;
  timestamp?: string;
  reactions?: MessageReactions | null;
};

export function mapBackendMessageToChatMessage(
  m: BackendMessage,
  userId: string,
  profileId: string,
  conversationId: string
): ChatMessage {
  return {
    id: m.id,
    messageDocId: m.message_doc_id,
    userId: m.sender === 'user' ? userId : 'ai',
    text: m.text,
    timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    sender: m.sender,
    conversationId,
    personalityId: m.personality || 'default',
    profileId,
    reactions: m.reactions ?? null,
  };
}
