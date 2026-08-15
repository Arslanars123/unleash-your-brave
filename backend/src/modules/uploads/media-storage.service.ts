import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../../config/env.js';
import { ensureUploadsDir, uploadsPublicPath } from './upload.paths.js';

export type MediaFolder = 'events' | 'materials';

export interface StoredMedia {
  /** Public path or absolute URL stored in Mongo / returned to clients */
  url: string;
  /** Object key in S3, or relative disk path under uploads/ */
  key: string;
  storage: 's3' | 'local';
}

function joinUrl(base: string, key: string): string {
  return `${base.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

/**
 * Persists uploaded files to S3 when configured; otherwise local disk.
 * App Runner disk is ephemeral — production must use object storage.
 */
export class MediaStorageService {
  private readonly client: S3Client | null;

  constructor() {
    this.client = env.s3.enabled
      ? new S3Client({
          region: env.s3.region,
          ...(env.s3.accessKeyId && env.s3.secretAccessKey
            ? {
                credentials: {
                  accessKeyId: env.s3.accessKeyId,
                  secretAccessKey: env.s3.secretAccessKey,
                },
              }
            : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return Boolean(this.client && env.s3.bucket);
  }

  async saveBuffer(input: {
    folder: MediaFolder;
    filename: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredMedia> {
    const key = `${input.folder}/${input.filename}`;

    if (this.client && env.s3.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      return {
        key,
        storage: 's3',
        url: joinUrl(env.s3.publicBaseUrl, key),
      };
    }

    const dir = ensureUploadsDir(input.folder);
    const diskPath = path.join(dir, input.filename);
    await pipeline(Readable.from(input.body), createWriteStream(diskPath));

    return {
      key,
      storage: 'local',
      url: `${uploadsPublicPath}/${key}`,
    };
  }

  /** Used when multer already wrote to disk (local fallback path). */
  async promoteDiskFile(input: {
    folder: MediaFolder;
    filename: string;
    diskPath: string;
    contentType: string;
  }): Promise<StoredMedia> {
    const key = `${input.folder}/${input.filename}`;

    if (this.client && env.s3.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
          Body: createReadStream(input.diskPath),
          ContentType: input.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await unlink(input.diskPath).catch(() => undefined);

      return {
        key,
        storage: 's3',
        url: joinUrl(env.s3.publicBaseUrl, key),
      };
    }

    return {
      key,
      storage: 'local',
      url: `${uploadsPublicPath}/${key}`,
    };
  }
}
