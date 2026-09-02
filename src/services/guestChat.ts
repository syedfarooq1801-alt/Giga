import { API_URL } from '../constants';

type StreamResult = { fullText: string } | null;

/**
 * Guest-mode counterpart to sendMessageToBackendStream (chatStream.ts) --
 * no Authorization header (there's no Firebase session), no
 * conversation_id round-trip (guest conversations only ever live in
 * AsyncStorage, see guestSession.ts). The caller passes its own recent
 * message history since the backend has nothing persisted to fetch it
 * from.
 */
export async function sendGuestMessageStream(
  text: string,
  personalityId: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunk: string) => void
): Promise<StreamResult> {
  const response = await fetch(`${API_URL}/api/guest/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      personality: personalityId,
      history,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    const events = buffered.split('\n\n');
    buffered = events.pop() ?? '';

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith('data: ')) continue;
      let payload: { text?: string; done?: boolean };
      try {
        payload = JSON.parse(line.slice('data: '.length));
      } catch {
        continue;
      }
      if (payload.text) {
        fullText += payload.text;
        onChunk(payload.text);
      }
    }
  }

  return { fullText: fullText.trim() };
}

/** Uploads everything a guest built up so far into the now-real signed-in
 * account, then the caller (FirebaseAuthContext) is responsible for
 * clearing local guest data via guestSession.clearGuestData(). */
export async function migrateGuestConversations(
  idToken: string,
  payload: { conversations: { title: string; personality: string; messages: { text: string; sender: string }[] }[] }
): Promise<{ migrated: number } | null> {
  if (payload.conversations.length === 0) return { migrated: 0 };
  try {
    const res = await fetch(`${API_URL}/api/guest/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[guestChat] Migration request failed:', e);
    return null;
  }
}
