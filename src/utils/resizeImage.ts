import { Platform } from 'react-native';

const MAX_SIDE = 1280;

/**
 * Shrinks a picked photo before it is sent. expo-image-picker ignores its
 * `quality` option on web and returns the file as-is, so an ordinary phone
 * photo, base64-encoded, exceeds Vercel's 4.5MB request body limit and the
 * request is rejected before it reaches the backend. Native already honours
 * `quality`, so it is passed through unchanged.
 */
export async function resizeImageDataUrl(dataUrl: string): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      // JPEG has no alpha: without a fill, transparent PNG areas turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Unsupported image format'));
    img.src = dataUrl;
  });
}
