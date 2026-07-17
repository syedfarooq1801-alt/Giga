import { getAuth } from 'firebase/auth';
import { API_URL } from '../constants';

type StreamResult = { fullText: string; conversationId: string; messageId: string | null } | null;

/**
 * Web-only streaming counterpart to sendMessageToBackendAndGetResponse.
 * Does NOT write the user's message to Firestore (that stays the caller's
 * responsibility, in ChatScreen's handleSendMessage) -- this function is
 * purely: send message, stream back sentence chunks via onChunk, return
 * the accumulated full text once the server signals completion.
 */
export async function sendMessageToBackendStream(
  text: string,
  personalityId: string,
  profileId: string,
  conversationId: string,
  userId: string,
  onChunk: (chunk: string) => void
): Promise<StreamResult> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');
  const idToken = await currentUser.getIdToken();

  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      message: text,
      personality: personalityId,
      conversation_id: conversationId || undefined,
      user_id: userId,
      profile_id: profileId,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let fullText = '';
  let finalConversationId = conversationId;
  let finalMessageId: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    const events = buffered.split('\n\n');
    buffered = events.pop() ?? '';

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith('data: ')) continue;
      let payload: { text?: string; done?: boolean; conversation_id?: string; message_id?: string };
      try {
        payload = JSON.parse(line.slice('data: '.length));
      } catch {
        continue;
      }
      if (payload.text) {
        fullText += payload.text;
        onChunk(payload.text);
      }
      if (payload.done) {
        finalConversationId = payload.conversation_id || finalConversationId;
        finalMessageId = payload.message_id || null;
      }
    }
  }

  return { fullText: fullText.trim(), conversationId: finalConversationId, messageId: finalMessageId };
}
