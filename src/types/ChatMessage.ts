export type ChatMessage = {
  id: string;
  userId: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'bot';
  conversationId?: string;
  personalityId: string;
  profileId: string; // Added for profile-based data isolation
  isOptimistic?: boolean; // Flag for optimistic updates
  tempId?: string; // Temporary ID for optimistic updates before server confirmation
};
