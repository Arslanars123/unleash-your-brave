import { apiClient } from '@/shared/api/client';
import type { SuccessEnvelope } from '@/shared/types/api';

export interface UploadedImage {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export type UploadedMaterial = UploadedImage;

export const uploadsApi = {
  async uploadImage(file: File): Promise<UploadedImage> {
    const body = new FormData();
    body.append('file', file);

    const { data } = await apiClient.post<SuccessEnvelope<UploadedImage>>('/uploads/images', body, {
      headers: { 'Content-Type': undefined },
      timeout: 60_000,
    });

    return data.data;
  },

  async uploadMaterial(file: File): Promise<UploadedMaterial> {
    const body = new FormData();
    body.append('file', file);

    const { data } = await apiClient.post<SuccessEnvelope<UploadedMaterial>>(
      '/uploads/materials',
      body,
      {
        headers: { 'Content-Type': undefined },
        timeout: 120_000,
      },
    );

    return data.data;
  },
};
