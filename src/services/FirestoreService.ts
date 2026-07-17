import { ChatMessage, ChatConversation, SenderType } from '../types/chat';

type FirestoreResponse<T> = {
  success: boolean;
  data?: T;
  error?: Error;
};

export class FirestoreService {
  private user: any = null;
  private profileId!: string; // Unique profile identifier for data isolation

  private maxRetries = 3;
  private retryDelay = 1000;

  /**
   * Set the current user and compute the profileId for data isolation.
   * profileId = user.uid + '_' + user.providerData[0].providerId
   */
  /**
   * Set the current user and compute the profileId for data isolation.
   * Throws an error if providerData or providerId is missing.
   */
  setUser(user: any) {
    this.user = user;
    if (user && user.uid && user.providerData && user.providerData.length > 0 && user.providerData[0].providerId) {
      this.profileId = `${user.uid}_${user.providerData[0].providerId}`;
    } else {
      throw new Error('Invalid user object: providerData[0].providerId is required for profileId');
    }
  }

  private async withRetry<T>(
    operation: () => Promise<FirestoreResponse<T>>,
    maxRetries = this.maxRetries,
    errorMessage = 'Operation failed',
    retryDelay = this.retryDelay
  ): Promise<FirestoreResponse<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        if (result.success) {
          return result;
        }
        lastError = result.error || new Error('Operation failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
    
    console.error(`${errorMessage} after ${maxRetries} attempts`, lastError);
    return { success: false, error: lastError! };
  }

  async sendMessage(
    conversationId: string,
    text: string,
    sender: SenderType,
    personalityId: string = 'default'
  ): Promise<FirestoreResponse<ChatMessage>> {
    return this.withRetry<ChatMessage>(async () => {
      if (!this.user) {
        throw new Error('User not authenticated');
      }
      if (!this.profileId) {
        throw new Error('Profile ID is not set. Call setUser() before using FirestoreService.');
      }

      const message: ChatMessage = {
        id: `msg_${Date.now()}`,
        text,
        sender,
        timestamp: new Date(),
        conversationId,
        userId: this.user.uid,
        profileId: this.profileId, // Use profileId for data isolation
        personalityId,
      };

      // In a real implementation, you would save to Firestore here
      // const docRef = await firestore()
      //   .collection('messages')
      //   .where('profileId', '==', this.profileId)
      //   .add(message); // Use profileId for all queries and writes
      
      return { success: true, data: message };
    });
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<ChatConversation>
  ): Promise<FirestoreResponse<ChatConversation>> {
    return this.withRetry<ChatConversation>(async () => {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      // In a real implementation, you would update in Firestore here
      // await firestore()
      //   .collection('conversations')
      //   .doc(conversationId)
      //   .update({
      //     ...updates,
      //     updatedAt: new Date(),
      //   });
      
      return { success: true, data: { id: conversationId, ...updates } as ChatConversation };
    });
  }

  subscribeToConversationUpdates(
    conversationId: string,
    onUpdate: (messages: ChatMessage[]) => void
  ): () => void {
    // In a real implementation, you would set up a Firestore listener
    // const unsubscribe = firestore()
    //   .collection('messages')
    //   .where('profileId', '==', this.profileId)
    //   .where('conversationId', '==', conversationId)
    //   .orderBy('timestamp', 'asc')
    //   .onSnapshot(snapshot => { // Use profileId for all queries
    //     const messages = snapshot.docs.map(doc => ({
    //       id: doc.id,
    //       ...doc.data(),
    //     })) as ChatMessage[];
    //     onUpdate(messages);
    //   });
    
    // Return a no-op function for now
    return () => {};
  }

  subscribeToConversations(
    onUpdate: (conversations: ChatConversation[]) => void
  ): () => void {
    // In a real implementation, you would set up a Firestore listener
    // const unsubscribe = firestore()
    //   .collection('conversations')
    //   .where('profileId', '==', this.profileId)
    //   .orderBy('updatedAt', 'desc')
    //   .onSnapshot(snapshot => { // Use profileId for all queries
    //     const conversations = snapshot.docs.map(doc => ({
    //       id: doc.id,
    //       ...doc.data(),
    //     })) as ChatConversation[];
    //     onUpdate(conversations);
    //   });
    
    // Return a no-op function for now
    return () => {};
  }

  async deleteConversation(conversationId: string): Promise<FirestoreResponse<void>> {
    return this.withRetry<void>(async () => {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      // In a real implementation, you would delete from Firestore here
      // await firestore().collection('conversations').doc(conversationId).delete();
      
      return { success: true };
    });
  }
}
