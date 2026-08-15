import type { Request, Response } from 'express';
import { BadRequestError } from '../../core/errors/app-error.js';
import { sendSuccess } from '../../core/http/response.js';
import type { MediaStorageService } from './media-storage.service.js';

export class UploadController {
  constructor(private readonly mediaStorage: MediaStorageService) {}

  uploadImage = async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError('Image file is required');
    }

    const filename =
      file.filename ||
      `${cryptoRandom()}${extFromMime(file.mimetype, file.originalname)}`;

    const stored = file.buffer
      ? await this.mediaStorage.saveBuffer({
          folder: 'events',
          filename,
          body: file.buffer,
          contentType: file.mimetype,
        })
      : await this.mediaStorage.promoteDiskFile({
          folder: 'events',
          filename,
          diskPath: file.path,
          contentType: file.mimetype,
        });

    sendSuccess(
      res,
      {
        url: stored.url,
        key: stored.key,
        storage: stored.storage,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      201,
    );
  };

  uploadMaterial = async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      throw new BadRequestError('Material file is required');
    }

    const filename =
      file.filename ||
      `${cryptoRandom()}${extFromMime(file.mimetype, file.originalname)}`;

    const stored = file.buffer
      ? await this.mediaStorage.saveBuffer({
          folder: 'materials',
          filename,
          body: file.buffer,
          contentType: file.mimetype,
        })
      : await this.mediaStorage.promoteDiskFile({
          folder: 'materials',
          filename,
          diskPath: file.path,
          contentType: file.mimetype,
        });

    sendSuccess(
      res,
      {
        url: stored.url,
        key: stored.key,
        storage: stored.storage,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      201,
    );
  };
}

function cryptoRandom(): string {
  return globalThis.crypto.randomUUID();
}

function extFromMime(mime: string, originalName: string): string {
  const fromName = originalName.includes('.')
    ? `.${originalName.split('.').pop()!.toLowerCase()}`
    : '';
  if (fromName && fromName.length <= 8) return fromName;
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/jpeg':
      return '.jpg';
    case 'application/pdf':
      return '.pdf';
    default:
      return '.bin';
  }
}
