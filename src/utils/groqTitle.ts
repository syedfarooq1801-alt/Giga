import { API_URL } from '../constants';

/**
 * Sends the first 5 texts of a conversation to the Groq backend to get a 2-word title.
 * @param messages Array of ChatMessage objects
 * @returns Promise<string> Title string
 */
export async function getConversationTitleFromGroq(messages: { text: string }[]): Promise<string> {
  // Prepare prompt from first 5 messages
  const prompt = messages.slice(0, 5).map(m => m.text).join('\n');
  try {
    // Send as { messages: [string, ...] }
    const response = await fetch(`${API_URL}/api/groq-heading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: messages.slice(0, 5).map(m => m.text) }),
    });
    if (!response.ok) throw new Error('Failed to get title from Groq');
    const data = await response.json();
    // Expecting { heading: "..." }
    return data.heading || '';
  } catch (err) {
    console.error('Groq title fetch error:', err);
    return '';
  }
}
