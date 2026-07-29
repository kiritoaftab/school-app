import type { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireSchoolId } from '../middleware/auth.js';
import { dayKey, parseDay } from '../lib/day.js';
import { audit, actorFrom } from '../lib/audit.js';
import { plural } from '../lib/usage.js';
import {
  presignGalleryUpload,
  deleteObjectByUrl,
  isS3Configured,
  EXT_BY_TYPE,
} from '../lib/s3.js';

// Photo albums. Admins and teachers manage the same school-wide gallery, so the
// routes are defined once and mounted on both routers; parents read it through
// their own read-only endpoints.

interface AlbumRow {
  id: number;
  title: string;
  date: Date;
  coverUrl: string | null;
  klassId: number | null;
}

/** List shape: enough to draw a cover tile. */
function albumView(a: AlbumRow & { photos: { url: string }[]; _count: { photos: number } }) {
  return {
    id: a.id,
    title: a.title,
    date: dayKey(a.date),
    // Falls back to the first photo so a new album gets a cover for free.
    coverUrl: a.coverUrl ?? a.photos[0]?.url ?? null,
    klassId: a.klassId,
    count: a._count.photos,
  };
}

/** Detail shape: the album plus every photo, in upload order. */
function albumDetailView(
  a: AlbumRow & { photos: { id: number; url: string; caption: string | null }[] },
) {
  return {
    id: a.id,
    title: a.title,
    date: dayKey(a.date),
    coverUrl: a.coverUrl ?? a.photos[0]?.url ?? null,
    klassId: a.klassId,
    count: a.photos.length,
    photos: a.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
  };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

const presignSchema = z.object({
  contentType: z.string().refine((t) => t in EXT_BY_TYPE, 'Unsupported image type'),
});

const albumSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string(),
  // Optional: tags the album to one class (e.g. "Grade 5-B · Field Trip").
  klassId: z.number().int().positive().nullable().optional(),
});

const photosSchema = z.object({
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        caption: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Mount the album routes on a router that already requires auth and a role.
 * Everything is scoped to the caller's school.
 */
export function mountGalleryRoutes(router: Router) {
  // --- Uploads: hand the browser a presigned PUT into school-gallery/ ---
  router.post('/uploads/gallery', ah(async (req, res) => {
    if (!isS3Configured) throw new HttpError(503, 'Photo uploads are not configured on the server');
    requireSchoolId(req);
    const { contentType } = presignSchema.parse(req.body);
    res.json(await presignGalleryUpload(contentType));
  }));

  // --- Albums ---
  router.get('/albums', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const albums = await prisma.photoAlbum.findMany({
      where: { schoolId },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include: {
        _count: { select: { photos: true } },
        photos: { take: 1, orderBy: { id: 'asc' }, select: { url: true } },
      },
    });
    res.json(albums.map(albumView));
  }));

  router.get('/albums/:id', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const album = await prisma.photoAlbum.findFirst({
      where: { id: parseId(req.params.id), schoolId },
      include: { photos: { orderBy: { id: 'asc' } } },
    });
    if (!album) throw new HttpError(404, 'Album not found');
    res.json(albumDetailView(album));
  }));

  router.post('/albums', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const data = albumSchema.parse(req.body);
    if (data.klassId != null) {
      const klass = await prisma.klass.findFirst({ where: { id: data.klassId, schoolId } });
      if (!klass) throw new HttpError(404, 'Class not found');
    }
    const album = await prisma.photoAlbum.create({
      data: {
        schoolId,
        title: data.title.trim(),
        date: parseDay(data.date),
        klassId: data.klassId ?? null,
      },
    });
    res.status(201).json({ ...albumDetailView({ ...album, photos: [] }) });
  }));

  router.put('/albums/:id', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const id = parseId(req.params.id);
    const data = albumSchema.partial().parse(req.body);
    const existing = await prisma.photoAlbum.findFirst({ where: { id, schoolId } });
    if (!existing) throw new HttpError(404, 'Album not found');
    const album = await prisma.photoAlbum.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.date !== undefined ? { date: parseDay(data.date) } : {}),
        ...(data.klassId !== undefined ? { klassId: data.klassId } : {}),
      },
      include: { photos: { orderBy: { id: 'asc' } } },
    });
    res.json(albumDetailView(album));
  }));

  // Deleting an album takes its photos with it (DB cascade), so clean up S3 too.
  router.delete('/albums/:id', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const id = parseId(req.params.id);
    const album = await prisma.photoAlbum.findFirst({
      where: { id, schoolId },
      include: { photos: { select: { url: true } } },
    });
    if (!album) throw new HttpError(404, 'Album not found');
    await prisma.$transaction(async (tx) => {
      await tx.photoAlbum.delete({ where: { id } });
      // Logged before the S3 objects go, because that part cannot be undone
      // and `deleteObjectByUrl` swallows its own failures.
      await audit(tx, actorFrom(req), {
        action: 'DELETE',
        entity: 'PhotoAlbum',
        entityId: id,
        label: album.title,
        summary: `${plural(album.photos.length, 'photo')} deleted from storage.`,
        before: { title: album.title, klassId: album.klassId, photoUrls: album.photos.map((p) => p.url) },
      });
    });
    await Promise.all(album.photos.map((p) => deleteObjectByUrl(p.url)));
    res.status(204).end();
  }));

  // --- Photos ---
  // The browser has already PUT the files to S3; this records the URLs.
  router.post('/albums/:id/photos', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const id = parseId(req.params.id);
    const { photos } = photosSchema.parse(req.body);
    const album = await prisma.photoAlbum.findFirst({ where: { id, schoolId } });
    if (!album) throw new HttpError(404, 'Album not found');
    await prisma.photo.createMany({
      data: photos.map((p) => ({
        albumId: id,
        url: p.url,
        caption: p.caption?.trim() || null,
      })),
    });
    const updated = await prisma.photoAlbum.findUniqueOrThrow({
      where: { id },
      include: { photos: { orderBy: { id: 'asc' } } },
    });
    res.status(201).json(albumDetailView(updated));
  }));

  router.delete('/albums/:id/photos/:photoId', ah(async (req, res) => {
    const schoolId = requireSchoolId(req);
    const albumId = parseId(req.params.id);
    const photoId = parseId(req.params.photoId);
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, albumId, album: { schoolId } },
    });
    if (!photo) throw new HttpError(404, 'Photo not found');
    await prisma.$transaction(async (tx) => {
      await tx.photo.delete({ where: { id: photoId } });
      await audit(tx, actorFrom(req), {
        action: 'DELETE',
        entity: 'Photo',
        entityId: photoId,
        label: photo.caption ?? `Photo ${photoId}`,
        summary: 'Deleted from storage.',
        before: { albumId, url: photo.url, caption: photo.caption },
      });
    });
    await deleteObjectByUrl(photo.url);
    res.status(204).end();
  }));
}
