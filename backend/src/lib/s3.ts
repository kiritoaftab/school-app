import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

/** The base every public object URL is built from, without a trailing slash. */
function publicBase(): string {
  const base =
    config.s3.publicBaseUrl ||
    `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com`;
  return base.replace(/\/+$/, '');
}

/** Public URL an uploaded object will be reachable at once it's stored. */
function publicUrlFor(key: string): string {
  return `${publicBase()}/${key}`;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
};

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Create a short-lived presigned PUT URL the browser can upload straight to,
 * plus the public URL the object will live at afterwards.
 */
async function presignUpload(contentType: string, prefix: string): Promise<PresignedUpload> {
  const ext = EXT_BY_TYPE[contentType] ?? 'bin';
  const key = `${prefix.replace(/\/+$/, '')}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: 300 });
  return { uploadUrl, publicUrl: publicUrlFor(key), key };
}

/** Presign a school logo upload (school-logos/…). */
export function presignLogoUpload(contentType: string): Promise<PresignedUpload> {
  return presignUpload(contentType, config.s3.prefix);
}

/** Presign an album photo upload (school-gallery/…). */
export function presignGalleryUpload(contentType: string): Promise<PresignedUpload> {
  return presignUpload(contentType, config.s3.galleryPrefix);
}

/**
 * The object key behind one of our public URLs, or null if the URL points
 * somewhere else (a seeded picsum image, an older bucket, a CDN we've moved off).
 */
function keyFromPublicUrl(url: string): string | null {
  const prefix = `${publicBase()}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split('?')[0];
  return key || null;
}

/**
 * Best-effort delete of an object we uploaded. Failures are swallowed: the row
 * is already gone from the DB and a stranded object must not fail the request.
 */
export async function deleteObjectByUrl(url: string): Promise<void> {
  if (!isS3Configured) return;
  const key = keyFromPublicUrl(url);
  if (!key) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
  } catch (err) {
    console.warn('[s3] could not delete %s:', key, (err as Error).message);
  }
}

export { isS3Configured, EXT_BY_TYPE };
