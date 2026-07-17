import { getFirebaseFirestore } from '../utils/initFirebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Store feedback as a document in Firestore under users/{profileId}/feedback/{autoId}
 * @param feedback The feedback text
 * @param userInfo Extra user info (email, name, username, profileId)
 * @returns The Firestore document reference
 */
export async function uploadFeedback(
  feedback: string,
  userInfo: { email: string; name: string; username: string; profileId: string }
) {
  if (!feedback.trim()) throw new Error('Feedback is empty');
  const db = getFirebaseFirestore();
  // Store feedback in a global 'feedbackindex' collection for aggregation
  const feedbackRef = collection(db, 'feedbackindex');
  console.log('[uploadFeedback] Attempting to write to: feedbackindex');
  console.log('[uploadFeedback] Data:', { feedback, ...userInfo });
  try {
    const docRef = await addDoc(feedbackRef, {
      feedback,
      email: userInfo.email || '',
      name: userInfo.name || '',
      username: userInfo.username || '',
      profileId: userInfo.profileId || '',
      submittedAt: serverTimestamp(),
    });
    console.log('[uploadFeedback] Success! DocRef:', docRef.path);
    return docRef;
  } catch (err) {
    console.error('[uploadFeedback] Firestore error:', err);
    throw err;
  }
}

