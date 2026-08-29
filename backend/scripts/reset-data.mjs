import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { ListObjectsV2Command, DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, '../uploads');

async function clearMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collections = await db.listCollections().toArray();

  const dropped = [];
  for (const { name } of collections) {
    await db.collection(name).drop();
    dropped.push(name);
  }

  await client.close();
  return { database: db.databaseName, dropped };
}

async function clearS3Prefix(client, bucket, prefix) {
  let token;
  let deleted = 0;

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );

    const keys = (list.Contents ?? []).map((item) => ({ Key: item.Key })).filter((item) => item.Key);
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys },
        }),
      );
      deleted += keys.length;
    }

    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);

  return deleted;
}

async function clearS3() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return { skipped: true, reason: 'S3_BUCKET not set' };
  }

  const client = new S3Client({
    region: process.env.AWS_REGION || 'ap-southeast-2',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  // Wipe the whole media bucket (covers events/, materials/, and any other prefixes).
  const deleted = await clearS3Prefix(client, bucket, '');
  return { bucket, deleted: { total: deleted } };
}

async function clearLocalUploads() {
  let removed = 0;

  for (const folder of ['events', 'materials']) {
    const dir = path.join(uploadsRoot, folder);
    let entries;
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry === '.gitkeep') continue;
      await unlink(path.join(dir, entry));
      removed += 1;
    }
  }

  return { removed };
}

async function main() {
  console.log('Resetting database and media storage...\n');

  const mongo = await clearMongo();
  console.log('MongoDB:', mongo);

  const s3 = await clearS3();
  console.log('S3:', s3);

  const local = await clearLocalUploads();
  console.log('Local uploads:', local);

  console.log('\nDone. Restart the API to recreate indexes and demo seed data.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
