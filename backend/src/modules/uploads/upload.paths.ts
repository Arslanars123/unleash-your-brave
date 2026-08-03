import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the on-disk uploads directory (backend/uploads). */
export const uploadsRoot = path.resolve(moduleDir, '../../../uploads');

export const uploadsPublicPath = '/uploads';

export function ensureUploadsDir(...segments: string[]): string {
  const dir = path.join(uploadsRoot, ...segments);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

ensureUploadsDir('events');
ensureUploadsDir('materials');
