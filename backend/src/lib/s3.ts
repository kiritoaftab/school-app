import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, isS3Configured } from '../config.js';

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return client;
}

/** Public URL an uploaded object will be reachable at once it's stored. */
function publicUrlFor(key: string): string {
  const base =
    config.s3.publicBaseUrl ||
    `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com`;
  return `${base.replace(/\/+$/, '')}/${key}`;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

/**
 * Create a short-lived presigned PUT URL the browser can upload a logo to,
 * plus the public URL the object will live at afterwards.
 */
export async function presignLogoUpload(contentType: string): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
}> {
  const ext = EXT_BY_TYPE[contentType] ?? 'bin';
  const key = `${config.s3.prefix.replace(/\/+$/, '')}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: 300 });
  return { uploadUrl, publicUrl: publicUrlFor(key), key };
}

export { isS3Configured, EXT_BY_TYPE };
