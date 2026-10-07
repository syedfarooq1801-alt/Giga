import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getAuth } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { API_URL } from '../constants';
import {
  isGuestModeEnabled,
  getOrCreateGuestId,
  getGuestDocuments,
  addGuestDocument,
  removeGuestDocument,
} from './guestSession';

/**
 * Documents work identically signed-in or as a guest -- the vectors go to
 * the same Qdrant collection either way, partitioned by whichever id the
 * backend resolves. The only difference is which identity header goes up:
 * a Firebase bearer token, or X-Guest-Id. The backend's
 * get_current_user_or_guest dependency accepts either.
 */
async function authHeaders(): Promise<Record<string, string>> {
  if (await isGuestModeEnabled()) {
    return { 'X-Guest-Id': await getOrCreateGuestId() };
  }
  const idToken = await getAuth().currentUser?.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

export type UploadedDocument = { doc_id: string; filename: string; chunk_count: number };
export type DocumentMeta = { doc_id: string; filename: string; chunk_count: number };

/**
 * Opens the native/web document picker, uploads the chosen file, and
 * returns the result. Returns null if the user canceled or the upload
 * failed (a Toast is shown for failures; canceling is silent, same as any
 * other picker dismissal). Shared between SettingsScreen's Documents modal
 * and ChatScreen's inline upload button -- both need identical picker +
 * multipart-upload logic, just triggered from different places in the UI.
 */
export async function pickAndUploadDocument(): Promise<UploadedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];

  try {
    const form = new FormData();
    // expo-document-picker returns a real web File on web (asset.file),
    // but only a cache-directory uri on native -- these need different
    // FormData shapes for React Native's fetch/XHR polyfill to send them
    // correctly as multipart.
    if (Platform.OS === 'web' && (asset as any).file) {
      form.append('file', (asset as any).file, asset.name);
    } else {
      form.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      } as any);
    }

    const res = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      headers: await authHeaders(),
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Upload failed');

    // Guests have no Firestore metadata mirror, so the "my documents"
    // list is kept locally instead (the backend returns [] for them).
    if (await isGuestModeEnabled()) {
      await addGuestDocument({ doc_id: data.doc_id, filename: data.filename, chunk_count: data.chunk_count });
    }

    Toast.show({
      type: 'success',
      text1: 'Document uploaded',
      text2: `${data.chunk_count} chunk${data.chunk_count === 1 ? '' : 's'} indexed`,
      position: 'bottom',
    });
    return { doc_id: data.doc_id, filename: data.filename, chunk_count: data.chunk_count };
  } catch (error) {
    Toast.show({
      type: 'error',
      text1: 'Upload failed',
      text2: error instanceof Error ? error.message : String(error),
      position: 'bottom',
    });
    return null;
  }
}

export async function fetchDocumentsList(): Promise<DocumentMeta[]> {
  try {
    if (await isGuestModeEnabled()) return await getGuestDocuments();
    const res = await fetch(`${API_URL}/api/documents`, {
      headers: await authHeaders(),
    });
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function deleteDocumentById(docId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (res.ok && (await isGuestModeEnabled())) await removeGuestDocument(docId);
    return res.ok;
  } catch {
    return false;
  }
}
