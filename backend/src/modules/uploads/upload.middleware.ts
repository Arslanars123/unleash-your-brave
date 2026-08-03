import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestError } from '../../core/errors/app-error.js';
import { ensureUploadsDir } from './upload.paths.js';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const MATERIAL_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  ...IMAGE_MIME,
]);

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'application/pdf':
      return '.pdf';
    case 'application/msword':
      return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.docx';
    case 'application/vnd.ms-powerpoint':
      return '.ppt';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return '.pptx';
    case 'text/plain':
      return '.txt';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/quicktime':
      return '.mov';
    default:
      return '.bin';
  }
}

function createUploader(folder: 'events' | 'materials', allowed: Set<string>, maxBytes: number) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureUploadsDir(folder));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || mimeToExt(file.mimetype);
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  });
}

export const imageUpload = createUploader('events', IMAGE_MIME, 5 * 1024 * 1024);
export const materialUpload = createUploader('materials', MATERIAL_MIME, 50 * 1024 * 1024);
