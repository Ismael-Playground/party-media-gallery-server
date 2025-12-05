import { getStorage, getDownloadURL } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

/**
 * Storage Service - Firebase Storage Integration
 * B2-010: Firebase Storage integration
 */

interface UploadUrlResponse {
  uploadUrl: string;
  downloadUrl: string;
  filePath: string;
  expiresAt: Date;
}

interface MediaMetadata {
  contentType: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

const BUCKET_NAME = process.env['FIREBASE_STORAGE_BUCKET'] || 'party-gallery.appspot.com';
const UPLOAD_URL_EXPIRY = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a signed URL for uploading media to Firebase Storage
 */
export async function generateUploadUrl(
  userId: string,
  partyId: string,
  mediaType: 'PHOTO' | 'VIDEO' | 'AUDIO',
  contentType: string
): Promise<UploadUrlResponse> {
  const bucket = getStorage().bucket(BUCKET_NAME);
  const fileExtension = getExtensionFromMimeType(contentType);
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `parties/${partyId}/media/${mediaType.toLowerCase()}/${fileName}`;

  const file = bucket.file(filePath);
  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType,
  });

  // Generate download URL (will be valid after upload)
  const downloadUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;

  logger.info(`Generated upload URL for ${filePath}`, { userId, partyId, mediaType });

  return {
    uploadUrl,
    downloadUrl,
    filePath,
    expiresAt,
  };
}

/**
 * Confirms that a media file was successfully uploaded
 */
export async function confirmUpload(filePath: string): Promise<MediaMetadata | null> {
  try {
    const bucket = getStorage().bucket(BUCKET_NAME);
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`File not found: ${filePath}`);
      return null;
    }

    const [metadata] = await file.getMetadata();

    return {
      contentType: metadata.contentType || 'application/octet-stream',
      size: parseInt(metadata.size as string, 10) || undefined,
    };
  } catch (error) {
    logger.error('Error confirming upload', { filePath, error });
    return null;
  }
}

/**
 * Deletes a media file from storage
 */
export async function deleteMedia(filePath: string): Promise<boolean> {
  try {
    const bucket = getStorage().bucket(BUCKET_NAME);
    const file = bucket.file(filePath);

    await file.delete();
    logger.info(`Deleted file: ${filePath}`);
    return true;
  } catch (error) {
    logger.error('Error deleting file', { filePath, error });
    return false;
  }
}

/**
 * Generates a thumbnail URL for a media file
 */
export function getThumbnailPath(originalPath: string): string {
  const parts = originalPath.split('/');
  const fileName = parts.pop() || '';
  const nameWithoutExt = fileName.split('.')[0];
  return [...parts, 'thumbnails', `${nameWithoutExt}_thumb.jpg`].join('/');
}

/**
 * Gets file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };

  return mimeToExt[mimeType] || 'bin';
}

export const storageService = {
  generateUploadUrl,
  confirmUpload,
  deleteMedia,
  getThumbnailPath,
};
