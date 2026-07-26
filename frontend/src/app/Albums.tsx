import { useCallback, useRef, useState } from 'react';
import { ALBUMS, ALBUM_TONES, GLYPH, type Album, type AlbumPhoto } from './data';
import { Card, EmptyState, Glyph, SectionLabel, cx } from './kit';

// Photo albums, shared by the admin and teacher apps. Still local mock state —
// the photos API lands later, at which point `useAlbums` is the only piece that
// has to change.

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

/** The album catalogue plus its mutations. One hook per app instance. */
export function useAlbums() {
  const [albums, setAlbums] = useState<Album[]>(ALBUMS);
  const [openId, setOpenId] = useState<string | null>(null);

  const create = useCallback((title: string, date: string) => {
    setAlbums((list) => [{ id: `a${Date.now()}`, title, date, photos: [] }, ...list]);
  }, []);
  const remove = useCallback((id: string) => {
    setAlbums((list) => list.filter((a) => a.id !== id));
  }, []);
  const addPhotos = useCallback((id: string, photos: AlbumPhoto[]) => {
    setAlbums((list) => list.map((a) => (a.id === id ? { ...a, photos: [...a.photos, ...photos] } : a)));
  }, []);
  const removePhoto = useCallback((id: string, photoId: string) => {
    setAlbums((list) =>
      list.map((a) => (a.id === id ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) } : a)),
    );
  }, []);

  const open = albums.find((a) => a.id === openId) ?? null;
  return { albums, open, openId, setOpenId, create, remove, addPhotos, removePhoto };
}

/** An album's cover: its first photo, falling back to a palette tone. */
function coverOf(album: Album, i: number) {
  const first = album.photos[0];
  return first?.url ? undefined : (first?.tone ?? ALBUM_TONES[i % ALBUM_TONES.length]);
}

/** The small dark × that removes an album or a photo. Arms on first tap. */
function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      aria-label={armed ? `Tap again to remove ${label}` : `Remove ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) onRemove();
        else setArmed(true);
      }}
      className={cx(
        'absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-lg grid place-items-center text-white text-[15px] font-bold leading-none z-[3]',
        armed ? 'bg-danger' : 'bg-black/45',
      )}
    >
      ×
    </button>
  );
}

/** Page 1: every album, with create and delete. */
export function AlbumsScreen({
  albums,
  onCreate,
  onDelete,
  onOpen,
}: {
  albums: Album[];
  onCreate: (title: string, date: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', date: '' });
  const ready = form.title.trim().length > 0 && form.date.length === 10;

  function save() {
    if (!ready) return;
    onCreate(form.title.trim(), form.date);
    setForm({ title: '', date: '' });
    setAdding(false);
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {!adding && (
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
            Create album
          </button>
        </Card>
      )}

      {albums.length === 0 ? (
        <EmptyState icon={GLYPH.photos} title="No albums yet">
          Create an album, then upload photos — parents see them on their Moments tab.
        </EmptyState>
      ) : (
        <>
          <SectionLabel>
            {albums.length} {albums.length === 1 ? 'album' : 'albums'}
          </SectionLabel>
          <div className="grid grid-cols-2 gap-[9px]">
            {albums.map((a, i) => {
              const tone = coverOf(a, i);
              return (
                <div
                  key={a.id}
                  onClick={() => onOpen(a.id)}
                  className="rounded-[14px] relative overflow-hidden aspect-square cursor-pointer bg-mist"
                  style={tone ? { background: tone } : undefined}
                >
                  {a.photos[0]?.url && (
                    <img src={a.photos[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.15) 20%,rgba(0,0,0,.55))' }}
                  />
                  <RemoveButton label={a.title} onRemove={() => onDelete(a.id)} />
                  <div className="absolute left-[11px] right-[11px] bottom-[9px] z-[2] text-white">
                    <div className="text-[13px] font-semibold leading-[1.2]">{a.title}</div>
                    <div className="text-[10.5px] opacity-85 mt-0.5">
                      {dayLabel(a.date)} · {photoCount(a.photos.length)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Page 2: one album's photos, with upload and delete. */
export function AlbumScreen({
  album,
  onAddPhotos,
  onDeletePhoto,
}: {
  album: Album | null;
  onAddPhotos: (photos: AlbumPhoto[]) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!album) {
    return (
      <div className="px-[15px] py-4">
        <EmptyState icon={GLYPH.photos} title="Album not found">
          Go back to Photos and pick an album.
        </EmptyState>
      </div>
    );
  }

  // Picked files are previewed straight from object URLs — nothing is uploaded
  // until the photos API exists.
  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const now = Date.now();
    onAddPhotos(
      Array.from(files).map((f, i) => ({
        id: `${album.id}-u${now}-${i}`,
        url: URL.createObjectURL(f),
        tone: ALBUM_TONES[i % ALBUM_TONES.length],
      })),
    );
  }

  return (
    <div className="px-[15px] py-4 pb-6">
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
        className="w-full mb-4 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
      >
        <Glyph d={GLYPH.upload} size={17} stroke={2} />
        Upload photos
      </button>

      <div className="font-serif text-[22px] mb-[3px]">{album.title}</div>
      <div className="text-[11.5px] text-muted mb-3.5">
        {dayLabel(album.date)} · {photoCount(album.photos.length)}
      </div>

      {album.photos.length === 0 ? (
        <EmptyState icon={GLYPH.upload} title="No photos yet">
          Upload the first few — they appear on every parent's Moments tab.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-[7px]">
          {album.photos.map((p) => (
            <div
              key={p.id}
              className="rounded-[12px] relative overflow-hidden aspect-square bg-mist"
              style={p.url ? undefined : { background: p.tone }}
            >
              {p.url && (
                <img src={p.url} alt={p.caption ?? ''} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <RemoveButton label={p.caption ?? 'photo'} onRemove={() => onDeletePhoto(p.id)} />
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
      )}
    </div>
  );
}
