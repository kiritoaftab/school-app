import { api } from './client';

// Photo albums. Admins and teachers share one management surface, parents get a
// read-only view of the same data, so the paths differ only by their role base.
export type GalleryBase = '/admin' | '/teacher' | '/parent';

export interface GalleryPhoto {
  id: number;
  url: string;
  caption: string | null;
}

export interface GalleryAlbum {
  id: number;
  title: string;
  /** Plain day key, "2026-01-26" — the day the album is about. */
  date: string;
  coverUrl: string | null;
  klassId: number | null;
  count: number;
}

export interface GalleryAlbumDetail extends GalleryAlbum {
  photos: GalleryPhoto[];
}

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function listAlbums(base: GalleryBase): Promise<GalleryAlbum[]> {
  const { data } = await api.get<GalleryAlbum[]>(`${base}/albums`);
  return data;
}

export async function getAlbum(base: GalleryBase, id: number): Promise<GalleryAlbumDetail> {
  const { data } = await api.get<GalleryAlbumDetail>(`${base}/albums/${id}`);
  return data;
}

export async function createAlbum(
  base: GalleryBase,
  input: { title: string; date: string; klassId?: number | null },
): Promise<GalleryAlbumDetail> {
  const { data } = await api.post<GalleryAlbumDetail>(`${base}/albums`, input);
  return data;
}

export async function deleteAlbum(base: GalleryBase, id: number): Promise<void> {
  await api.delete(`${base}/albums/${id}`);
}

/**
 * Upload one file straight to S3: ask the API for a presigned PUT into the
 * school-gallery folder, send the bytes, and return the public URL to record.
 */
export async function uploadPhotoFile(base: GalleryBase, file: File): Promise<string> {
  const { data } = await api.post<PresignedUpload>(`${base}/uploads/gallery`, {
    contentType: file.type,
  });
  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return data.publicUrl;
}

/** Record already-uploaded photo URLs against an album. */
export async function addAlbumPhotos(
  base: GalleryBase,
  albumId: number,
  photos: { url: string; caption?: string | null }[],
): Promise<GalleryAlbumDetail> {
  const { data } = await api.post<GalleryAlbumDetail>(`${base}/albums/${albumId}/photos`, {
    photos,
  });
  return data;
}

export async function deleteAlbumPhoto(
  base: GalleryBase,
  albumId: number,
  photoId: number,
): Promise<void> {
  await api.delete(`${base}/albums/${albumId}/photos/${photoId}`);
}
