import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  addAlbumPhotos,
  createAlbum,
  deleteAlbum,
  deleteAlbumPhoto,
  getAlbum,
  listAlbums,
  uploadPhotoFile,
  type GalleryAlbum,
  type GalleryAlbumDetail,
  type GalleryBase,
  type GalleryPhoto,
} from '../api/gallery';
import { ALBUM_TONES, GLYPH } from './data';
import { Card, ConfirmIconButton, EmptyState, Glyph, SectionLabel, Spinner, cx } from './kit';
import { useRevalidate } from '../lib/useResource';

// Photo albums, shared by the admin, teacher and parent apps. Admins and
// teachers get the full CRUD; parents pass `readOnly` for the same views.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-01-26" → "26 Jan". Day keys are plain dates, so read them as UTC. */
export function dayLabel(key: string) {
  const d = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

/** "5 photos" / "1 photo". */
export function photoCount(n: number) {
  return `${n} ${n === 1 ? 'photo' : 'photos'}`;
}

const inputCls =
  'w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white';

/** Pull a readable message out of an axios error. */
function msgOf(e: unknown, fallback: string) {
  return (
    (e as { response?: { data?: { error?: string } } }).response?.data?.error ??
    (e as Error).message ??
    fallback
  );
}

export type Gallery = ReturnType<typeof useAlbums>;

/** The album catalogue, the open album, and every mutation. One per app. */
export function useAlbums(base: GalleryBase) {
  const [albums, setAlbums] = useState<GalleryAlbum[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GalleryAlbumDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  /** Index of the photo open in the full-screen viewer; null when it's closed. */
  const [viewerAt, setViewerAt] = useState<number | null>(null);

  // Mutation state, shared by both screens.
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Upload progress while files are going to S3, e.g. { done: 2, total: 5 }. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlbums(await listAlbums(base));
    } catch (e) {
      setError(msgOf(e, "Couldn't load albums."));
    } finally {
      setLoading(false);
    }
  }, [base]);

  const reloadDetail = useCallback(async () => {
    if (openId === null) return;
    setDetailError(null);
    try {
      setDetail(await getAlbum(base, openId));
    } catch (e) {
      setDetailError(msgOf(e, "Couldn't load this album."));
    }
  }, [base, openId]);

  // Clear the previous album so its photos never flash under the new title.
  useEffect(() => {
    setViewerAt(null);
    setDetail(null);
    setDetailError(null);
  }, [base, openId]);

  useRevalidate(reloadDetail, {
    active: openId !== null,
    revalidateOn: [reloadDetail],
  });

  /** Run a mutation, surfacing its error and refreshing the list afterwards. */
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setActionError(null);
      try {
        await fn();
        return true;
      } catch (e) {
        setActionError(msgOf(e, "That didn't save. Please try again."));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const create = useCallback(
    (title: string, date: string) =>
      run(async () => {
        await createAlbum(base, { title, date });
        setAlbums(await listAlbums(base));
      }),
    [base, run],
  );

  const remove = useCallback(
    (id: number) =>
      run(async () => {
        await deleteAlbum(base, id);
        setAlbums(await listAlbums(base));
      }),
    [base, run],
  );

  /** Upload picked files to S3, then record them against the open album. */
  const upload = useCallback(
    (albumId: number, files: File[]) =>
      run(async () => {
        setProgress({ done: 0, total: files.length });
        try {
          const urls: string[] = [];
          for (const f of files) {
            urls.push(await uploadPhotoFile(base, f));
            setProgress({ done: urls.length, total: files.length });
          }
          setDetail(await addAlbumPhotos(base, albumId, urls.map((url) => ({ url }))));
          setAlbums(await listAlbums(base));
        } finally {
          setProgress(null);
        }
      }),
    [base, run],
  );

  const removePhoto = useCallback(
    (albumId: number, photoId: number) =>
      run(async () => {
        await deleteAlbumPhoto(base, albumId, photoId);
        setDetail(await getAlbum(base, albumId));
        setAlbums(await listAlbums(base));
      }),
    [base, run],
  );

  const openViewer = useCallback((i: number) => setViewerAt(i), []);
  const closeViewer = useCallback(() => setViewerAt(null), []);

  /** The open album's list row — drives the header while the detail loads. */
  const openSummary = albums?.find((a) => a.id === openId) ?? null;

  return {
    albums,
    loading,
    error,
    reload,
    openId,
    setOpenId,
    detail,
    detailError,
    reloadDetail,
    openSummary,
    viewerAt,
    openViewer,
    closeViewer,
    busy,
    actionError,
    progress,
    create,
    remove,
    upload,
    removePhoto,
  };
}

/** An album's cover: its newest photo, falling back to a palette tone. */
function toneFor(i: number) {
  return ALBUM_TONES[i % ALBUM_TONES.length];
}

/** The small dark × that removes an album or a photo. Arms on first tap. */
function RemoveButton({
  label,
  disabled,
  onRemove,
}: {
  label: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <ConfirmIconButton
      label={label}
      disabled={disabled}
      onConfirm={onRemove}
      className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-lg text-white text-[15px] z-[3] bg-black/45"
    />
  );
}

/** Retryable inline error, matching the load-failure cards elsewhere. */
function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-5 text-center">
      <div className="text-[12.5px] text-danger mb-3">{message}</div>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
      >
        Retry
      </button>
    </Card>
  );
}

/** Page 1: every album, with create and delete. */
export function AlbumsScreen({
  gallery,
  readOnly,
  onOpen,
}: {
  gallery: Gallery;
  readOnly?: boolean;
  onOpen: (id: number) => void;
}) {
  const { albums, loading, error, reload, busy, actionError } = gallery;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', date: '' });
  const ready = form.title.trim().length > 0 && form.date.length === 10 && !busy;

  // This screen mounts when the Photos tab is opened, so loading on mount is
  // loading on entry. Also refreshes when the app is resumed — the school
  // posting an album is exactly what someone reopening this expects to see.
  useRevalidate(reload, { revalidateOn: [reload] });

  async function save() {
    if (!ready) return;
    if (await gallery.create(form.title.trim(), form.date)) {
      setForm({ title: '', date: '' });
      setAdding(false);
    }
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {!readOnly && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
        >
          <Glyph d={GLYPH.plus} size={17} stroke={2} />
          Create an album
        </button>
      )}

      {adding && (
        <Card className="p-3.5 mb-4">
          <div className="flex items-center mb-2.5">
            <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">
              New album
            </div>
            <button
              onClick={() => setAdding(false)}
              aria-label="Cancel"
              className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none"
            >
              ×
            </button>
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Album name — e.g. Annual Sports Day"
            className={cx(inputCls, 'mb-2.25')}
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={cx(inputCls, 'mb-3')}
          />
          <button
            onClick={save}
            disabled={!ready}
            className={cx(
              'w-full py-3 rounded-xl font-bold text-[13.5px]',
              ready ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]',
            )}
          >
            {busy ? 'Creating…' : 'Create album'}
          </button>
        </Card>
      )}

      {actionError && (
        <Card className="p-3.5 mb-3 text-[12.5px] text-danger">{actionError}</Card>
      )}

      {loading && albums === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && albums === null && !loading && <ErrorCard message={error} onRetry={reload} />}

      {albums !== null &&
        (albums.length === 0 ? (
          <EmptyState icon={GLYPH.photos} title="No albums yet">
            {readOnly
              ? 'The school has not shared any photos yet.'
              : 'Create an album, then upload photos — parents see them on their Moments tab.'}
          </EmptyState>
        ) : (
          <>
            <SectionLabel>
              {albums.length} {albums.length === 1 ? 'album' : 'albums'}
            </SectionLabel>
            <div className="grid grid-cols-2 gap-[9px]">
              {albums.map((a, i) => (
                <div
                  key={a.id}
                  onClick={() => onOpen(a.id)}
                  className="rounded-[14px] relative overflow-hidden aspect-square cursor-pointer"
                  style={{ background: toneFor(i) }}
                >
                  {a.coverUrl && (
                    <img
                      src={a.coverUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.15) 20%,rgba(0,0,0,.55))' }}
                  />
                  {!readOnly && (
                    <RemoveButton
                      label={a.title}
                      disabled={busy}
                      onRemove={() => gallery.remove(a.id)}
                    />
                  )}
                  <div className="absolute left-[11px] right-[11px] bottom-[9px] z-[2] text-white">
                    <div className="text-[13px] font-semibold leading-[1.2]">{a.title}</div>
                    <div className="text-[10.5px] opacity-85 mt-0.5">
                      {dayLabel(a.date)} · {photoCount(a.count)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ))}
    </div>
  );
}

/** Page 2: one album's photos, with upload and delete. */
export function AlbumScreen({ gallery, readOnly }: { gallery: Gallery; readOnly?: boolean }) {
  const { detail, detailError, reloadDetail, openId, openSummary, busy, actionError, progress } =
    gallery;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const title = detail?.title ?? openSummary?.title ?? '';
  const date = detail?.date ?? openSummary?.date ?? '';
  const count = detail?.photos.length ?? openSummary?.count ?? 0;

  if (openId === null) {
    return (
      <div className="px-[15px] py-4">
        <EmptyState icon={GLYPH.photos} title="No album open">
          Go back to Photos and pick an album.
        </EmptyState>
      </div>
    );
  }

  function pick(files: FileList | null) {
    if (!files || files.length === 0 || openId === null) return;
    gallery.upload(openId, Array.from(files));
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {!readOnly && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full mb-4 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px] disabled:opacity-70"
          >
            <Glyph d={GLYPH.upload} size={17} stroke={2} />
            {progress
              ? `Uploading ${progress.done} of ${progress.total}…`
              : busy
                ? 'Working…'
                : 'Upload photos'}
          </button>
        </>
      )}

      <div className="font-serif text-[22px] mb-[3px]">{title}</div>
      <div className="text-[11.5px] text-muted mb-3.5">
        {date && `${dayLabel(date)} · `}
        {photoCount(count)}
      </div>

      {actionError && (
        <Card className="p-3.5 mb-3 text-[12.5px] text-danger">{actionError}</Card>
      )}

      {detail === null && detailError === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {detailError && detail === null && <ErrorCard message={detailError} onRetry={reloadDetail} />}

      {detail !== null &&
        (detail.photos.length === 0 ? (
          <EmptyState icon={GLYPH.upload} title="No photos yet">
            {readOnly
              ? 'Photos from this album have not been shared yet.'
              : "Upload the first few — they appear on every parent's Moments tab."}
          </EmptyState>
        ) : readOnly ? (
          <BentoGrid photos={detail.photos} onOpen={gallery.openViewer} />
        ) : (
          <div className="grid grid-cols-3 gap-[7px]">
            {detail.photos.map((p, i) => (
              // A div, not a button — the remove × is a button and can't nest.
              <div
                key={p.id}
                onClick={() => gallery.openViewer(i)}
                className="rounded-[12px] relative overflow-hidden aspect-square cursor-pointer"
                style={{ background: toneFor(i) }}
              >
                <img
                  src={p.url}
                  alt={p.caption ?? ''}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <RemoveButton
                  label={p.caption ?? 'photo'}
                  disabled={busy}
                  onRemove={() => gallery.removePhoto(detail.id, p.id)}
                />
                {p.caption && (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45))' }}
                    />
                    <div className="absolute left-2 right-2 bottom-1.5 z-[2] text-white text-[10px] font-semibold leading-[1.2]">
                      {p.caption}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

// ---------- BENTO GRID (parent view) ----------

/**
 * A repeating bento rhythm. Every row holds exactly two photos; the wider tile
 * alternates sides and the row height varies, so the album reads as a mosaic
 * rather than a uniform checkerboard. A lone trailing photo takes a full row.
 */
const BENTO_ROWS = [
  { split: [1.55, 1], h: 148 },
  { split: [1, 1.7], h: 188 },
  { split: [1.25, 1], h: 156 },
  { split: [1, 1.4], h: 174 },
];

/** Split a flat photo list into the pairs each bento row draws. */
function inPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

function BentoGrid({
  photos,
  onOpen,
}: {
  photos: GalleryPhoto[];
  onOpen: (index: number) => void;
}) {
  return (
    <div>
      {inPairs(photos).map((pair, r) => {
        const spec = BENTO_ROWS[r % BENTO_ROWS.length];
        return (
          <div key={r} className="flex gap-[7px] mb-[7px]" style={{ height: spec.h }}>
            {pair.map((p, i) => {
              // The flat index the viewer opens at.
              const at = r * 2 + i;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpen(at)}
                  aria-label={p.caption ?? `Photo ${at + 1}`}
                  className="relative overflow-hidden rounded-[14px] min-w-0 h-full"
                  style={{ flex: spec.split[i] ?? 1, background: toneFor(at) }}
                >
                  <img
                    src={p.url}
                    alt={p.caption ?? ''}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {p.caption && (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45))' }}
                      />
                      <div className="absolute left-2.5 right-2.5 bottom-2 z-[2] text-white text-[11px] font-semibold leading-[1.2] text-left">
                        {p.caption}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------- FULL-SCREEN VIEWER ----------

/**
 * The expanded photo view: one photo per screen in a scroll-snapped track, so
 * swiping left/right is native touch scrolling rather than a gesture library.
 * Render it in the Shell's `overlays` slot so it fills the phone frame.
 */
export function AlbumViewer({ gallery }: { gallery: Gallery }) {
  const { detail, viewerAt, closeViewer } = gallery;
  const photos = detail?.photos ?? [];
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(viewerAt ?? 0);
  const open = viewerAt !== null && photos.length > 0;

  // Jump to the tapped photo before the first paint, so it never flashes
  // photo 1 first. The overlay unmounts when closed, so this runs per opening.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!open || !el || viewerAt === null) return;
    el.scrollLeft = el.clientWidth * viewerAt;
    setAt(viewerAt);
  }, [open, viewerAt]);

  const go = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  }, []);

  // Arrow keys and Escape, for the desktop view.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') go(Math.min(at + 1, photos.length - 1));
      if (e.key === 'ArrowLeft') go(Math.max(at - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, at, photos.length, go, closeViewer]);

  if (!open) return null;
  const current = photos[at];

  return (
    <div className="absolute inset-0 z-50 bg-[#0b0f0c] flex flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 flex-none">
        <span className="text-white/70 text-[12px] font-semibold tabular-nums">
          {at + 1} / {photos.length}
        </span>
        <button
          onClick={closeViewer}
          aria-label="Close"
          className="ml-auto w-9 h-9 rounded-full bg-white/12 text-white grid place-items-center"
        >
          <Glyph d={GLYPH.close} size={18} stroke={2.2} />
        </button>
      </div>

      {/* swipeable track */}
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="gw-scroll flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-contain"
      >
        {photos.map((p) => (
          <div key={p.id} className="w-full flex-none snap-center grid place-items-center px-3">
            <img
              src={p.url}
              alt={p.caption ?? ''}
              className="max-w-full max-h-full object-contain rounded-[10px]"
            />
          </div>
        ))}
      </div>

      {/* caption + paging */}
      <div className="flex-none px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {current?.caption && (
          <div className="text-white text-[13px] font-medium leading-[1.35] text-center mb-2.5">
            {current.caption}
          </div>
        )}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => go(Math.max(at - 1, 0))}
            disabled={at === 0}
            aria-label="Previous photo"
            className="w-9 h-9 rounded-full bg-white/12 text-white grid place-items-center disabled:opacity-30"
          >
            <Glyph d={GLYPH.chevronLeft} size={18} stroke={2.2} />
          </button>
          {/* Dots stay readable for small albums; bigger ones lean on the counter. */}
          {photos.length <= 12 && (
            <div className="flex items-center gap-1.5">
              {photos.map((p, i) => (
                <span
                  key={p.id}
                  className={cx(
                    'rounded-full transition-all',
                    i === at ? 'w-[7px] h-[7px] bg-white' : 'w-[5px] h-[5px] bg-white/35',
                  )}
                />
              ))}
            </div>
          )}
          <button
            onClick={() => go(Math.min(at + 1, photos.length - 1))}
            disabled={at >= photos.length - 1}
            aria-label="Next photo"
            className="w-9 h-9 rounded-full bg-white/12 text-white grid place-items-center disabled:opacity-30"
          >
            <Glyph d={GLYPH.chevronRight} size={18} stroke={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
