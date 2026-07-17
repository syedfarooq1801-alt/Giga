import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
  getMetadata,
  listAll,
  StorageReference,
  UploadTaskSnapshot,
  StorageError,
  ListResult,
  UploadMetadata
} from 'firebase/storage';
import { getFirebaseAuth } from '../utils/initFirebase';
import { getAuth } from 'firebase/auth';

// Initialize Firebase Storage instance
const storage = getStorage(getFirebaseAuth().app);

// Types
export interface FileMetadata extends UploadMetadata {
  contentType?: string;
  customMetadata?: Record<string, string>;
  size?: number;
  name?: string;
  fullPath?: string;
}

export interface UploadResult {
  downloadURL: string;
  metadata: FileMetadata;
  ref: StorageReference;
}

export interface FileWithMetadata extends FileMetadata {
  downloadURL: string;
  path: string;
  ref: StorageReference;
}

// Helper to get user's storage path
const getUserStoragePath = (path = '') => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  
  // Use the profileId pattern from our security model
  const profileId = `${user.uid}_${user.providerData[0]?.providerId || 'local'}`;
  return `users/${profileId}/${path}`.replace(/\/+/g, '/').replace(/\/+$/, '');
};

/**
 * Upload a file to Firebase Storage
 * @param fileUri - Local URI of the file to upload
 * @param path - Path relative to user's storage directory
 * @param metadata - Optional file metadata
 * @param onProgress - Optional progress callback
 */
export const uploadFile = async (
  fileUri: string, 
  path: string, 
  metadata: FileMetadata = {},
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
  try {
    // In React Native, we need to use the fetch API to get the blob
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Add file size to metadata if not provided
    const fileMetadata: FileMetadata = {
      ...metadata,
      contentType: metadata.contentType || 'application/octet-stream',
      customMetadata: {
        ...(metadata.customMetadata || {}),
        originalName: metadata.name || fileUri.split('/').pop() || 'file',
        uploadedAt: new Date().toISOString(),
      }
    };
    
    // Use the full path including user directory
    const fullPath = getUserStoragePath(path);
    const storageRef = ref(storage, fullPath);
    
    const uploadTask = uploadBytesResumable(storageRef, blob, fileMetadata);
    
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error: StorageError) => {
          console.error('Upload error:', error);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const metadata = await getMetadata(uploadTask.snapshot.ref);
            
            resolve({
              downloadURL,
              metadata: metadata as FileMetadata,
              ref: uploadTask.snapshot.ref
            });
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(new Error('Failed to get download URL'));
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw new Error('File upload failed');
  }
};

/**
 * Delete a file from storage
 * @param path - Path to the file relative to user's storage directory
 */
export const deleteFile = async (path: string): Promise<boolean> => {
  try {
    const fullPath = getUserStoragePath(path);
    const fileRef = ref(storage, fullPath);
    await deleteObject(fileRef);
    return true;
  } catch (error) {
    // If file doesn't exist, it's already deleted
    if ((error as any).code === 'storage/object-not-found') {
      return true;
    }
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
};

/**
 * Get a file's download URL
 * @param path - Path to the file relative to user's storage directory
 */
export const getFileURL = async (path: string): Promise<string> => {
  try {
    const fullPath = getUserStoragePath(path);
    const fileRef = ref(storage, fullPath);
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw new Error('File not found');
  }
};

/**
 * Get file metadata
 * @param path - Path to the file relative to user's storage directory
 */
export const getFileMetadata = async (path: string): Promise<FileMetadata> => {
  try {
    const fullPath = getUserStoragePath(path);
    const fileRef = ref(storage, fullPath);
    return await getMetadata(fileRef) as FileMetadata;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw new Error('Failed to get file metadata');
  }
};

/**
 * List files in a directory
 * @param path - Directory path relative to user's storage directory
 */
export const listFiles = async (path = ''): Promise<FileWithMetadata[]> => {
  try {
    const fullPath = getUserStoragePath(path);
    const dirRef = ref(storage, fullPath);
    const result: ListResult = await listAll(dirRef);
    
    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        const metadata = await getMetadata(itemRef);
        
        return {
          ...metadata,
          downloadURL: url,
          path: itemRef.fullPath,
          ref: itemRef,
        } as FileWithMetadata;
      })
    );
    
    return files;
  } catch (error) {
    console.error('Error listing files:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Upload a profile picture
 * @param fileUri - Local URI of the image
 * @param metadata - Optional metadata
 */
export const uploadProfilePicture = async (
  fileUri: string,
  metadata: FileMetadata = {}
): Promise<UploadResult> => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  // Generate a unique filename
  const fileExt = fileUri.split('.').pop() || 'jpg';
  const fileName = `profile.${fileExt}`;
  
  return uploadFile(fileUri, `profile_pictures/${fileName}`, {
    ...metadata,
    contentType: `image/${fileExt}`,
    cacheControl: 'public, max-age=31536000', // Cache for 1 year
    customMetadata: {
      ...(metadata.customMetadata || {}),
      uploadedBy: userId,
      type: 'profile_picture',
    },
  });
};

/**
 * Upload a meme (gig)
 * @param fileUri - Local URI of the meme image
 * @param metadata - Optional metadata
 */
export const uploadMeme = async (
  fileUri: string,
  metadata: FileMetadata = {}
): Promise<UploadResult> => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error('User not authenticated');
  
  // Generate a unique filename
  const fileExt = fileUri.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}.${fileExt}`;
  
  return uploadFile(fileUri, `memes/${fileName}`, {
    ...metadata,
    contentType: `image/${fileExt}`,
    customMetadata: {
      ...(metadata.customMetadata || {}),
      uploadedBy: userId,
      type: 'meme',
    },
  });
};

/**
 * Get the public URL for a user's profile picture
 * @param userId - User ID
 * @param size - Optional size variant (e.g., 'small', 'medium', 'large')
 */
export const getProfilePictureURL = async (
  userId: string,
  size: 'small' | 'medium' | 'large' | 'original' = 'medium'
): Promise<string | null> => {
  try {
    // Try different file extensions
    const extensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    for (const ext of extensions) {
      try {
        const path = `profile_pictures/users/${userId}/${size}.${ext}`;
        const url = await getDownloadURL(ref(storage, path));
        return url;
      } catch (error) {
        // Continue to next extension
      }
    }
    
    // Return default avatar if no profile picture found
    return null;
  } catch (error) {
    console.error('Error getting profile picture URL:', error);
    return null;
  }
};
