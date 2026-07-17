export type SenderType = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  text: string;
  sender: SenderType;
  timestamp: Date | string; // Allow string for Firestore timestamps
  conversationId: string;
  userId: string;
  profileId: string; // Added to support profile-based data isolation
  personalityId: string; // Make required for consistency with the app
  avatar?: string;
  isTyping?: boolean;
  error?: boolean;
  tempId?: string; // Changed to string to store the actual temporary ID
  isOptimistic?: boolean; // Flag to identify messages that are optimistically added
}

export interface ChatConversation {
  id: string;
  title: string;
  userId: string;
  personalityId?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived?: boolean;
  unreadCount?: number;
}

export interface PersonalityType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  emoji: string;
  prompt?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Type for Firestore response
export interface FirestoreResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  lastVisible?: any; // For pagination
}

// Type for message status
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

// Type for message reactions
export interface MessageReaction {
  emoji: string;
  userIds: string[];
}
