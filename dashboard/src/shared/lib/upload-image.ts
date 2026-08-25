import { uploadsApi } from '@/features/uploads/api/uploads-api';
import {
  prepareImageForUpload,
  type PrepareImageOptions,
} from '@/shared/lib/compress-image';

/** Compress + upload an image file. Call from form submit, not on file select. */
export async function uploadImageFile(
  file: File,
  options?: PrepareImageOptions,
): Promise<string> {
  const prepared = await prepareImageForUpload(file, options);
  const uploaded = await uploadsApi.uploadImage(prepared);
  return uploaded.url;
}
