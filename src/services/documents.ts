import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getAuth } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { API_URL } from '../constants';

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

    const idToken = await getAuth().currentUser?.getIdToken();
    const res = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Upload failed');

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
    const idToken = await getAuth().currentUser?.getIdToken();
    const res = await fetch(`${API_URL}/api/documents`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function deleteDocumentById(docId: string): Promise<boolean> {
  try {
    const idToken = await getAuth().currentUser?.getIdToken();
    const res = await fetch(`${API_URL}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
