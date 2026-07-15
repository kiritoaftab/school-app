import { useState } from 'react';
import {
  CAL_EVENTS, MONTHS, MONTH_ORDER, NOTIFS, GLYPH,
  type CalEvent, type Notice,
} from './data';
import { Card, Chip, Glyph, InfoNote, PrimaryButton, SectionLabel, cx } from './kit';

// ============ NOTIFICATIONS ============
export function NotificationsScreen() {
  return (
    <div className="px-[15px] py-4 pb-6">
      {NOTIFS.map((n, i) => (
        <div key={i} className="flex gap-[11px] py-[13px] border-b border-line">
          <div className="w-9 h-9 rounded-[11px] bg-mist grid place-items-center flex-none text-green">
            <Glyph d={n.path} size={18} stroke={1.8} />
          </div>
          <div className="flex-1">
            <b className="text-[13px] font-semibold block mb-0.5">{n.title}</b>
            <small className="text-[11.5px] text-muted leading-[1.4]">{n.sub}</small>
          </div>
          <span className="text-[10px] text-muted font-semibold flex-none">{n.tm}</span>
        </div>
      ))}
    </div>
  );
}

// ============ PHOTOS ============
export function PhotosScreen({ canUpload }: { canUpload?: boolean }) {
  return (
    <div className="px-[15px] py-4 pb-6">
      {canUpload && (
        <button className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]">
          <Glyph d={GLYPH.upload} size={17} stroke={2} />
          Upload photos to this album
        </button>
      )}
      <div className="font-serif text-[22px] mb-[3px]">Annual Sports Day</div>
      <div className="text-[11.5px] text-muted mb-3.5">25 June · 142 photos · shared by the school</div>
      <div className="grid grid-cols-2 gap-[7px]">
        <Tile span cover="linear-gradient(150deg,#3d6b4e,#7fae8c)" caption="100m Finals" />
        <Tile cover="linear-gradient(150deg,#caa24f,#e7cd8e)" />
        <Tile cover="linear-gradient(150deg,#8a5a3c,#caa07c)" />
        <Tile cover="linear-gradient(150deg,#36505f,#7a98a6)" />
        <Tile cover="linear-gradient(150deg,#4a6b4f,#9cbfa0)" />
        <Tile span cover="linear-gradient(150deg,#8a5a3c,#caa07c)" caption="Prize Distribution" />
        <Tile cover="linear-gradient(150deg,#caa24f,#e7cd8e)" />
        <Tile cover="linear-gradient(150deg,#3d6b4e,#7fae8c)" />
      </div>
    </div>
  );
}

function Tile({ cover, caption, span }: { cover: string; caption?: string; span?: boolean }) {
  return (
    <div
      className={cx('rounded-[14px] relative overflow-hidden', span ? 'col-span-2 aspect-[2.1]' : 'aspect-square')}
      style={{ background: cover }}
    >
      {caption && (
        <>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 55%,rgba(0,0,0,.3))' }} />
          <div className="absolute left-[11px] bottom-[9px] text-white text-[11px] font-semibold z-[2]">{caption}</div>
        </>
      )}
    </div>
  );
}

// ============ CALENDAR ============
export function CalendarScreen({ admin }: { admin?: boolean }) {
  const [events, setEvents] = useState<CalEvent[]>(CAL_EVENTS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ m: 'JUL', d: '', title: '', sub: '' });

  const sorted = [...events].sort(
    (a, b) => MONTH_ORDER[a.m] - MONTH_ORDER[b.m] || parseInt(a.d) - parseInt(b.d),
  );

  function addEvent() {
    if (!form.title.trim() || !form.d.trim()) return;
    setEvents((e) => [
      ...e,
      {
        m: (form.m || 'JUL').toUpperCase().slice(0, 3),
        d: ('0' + form.d.trim()).slice(-2),
        title: form.title.trim(),
        sub: form.sub.trim() || 'School event',
        accent: '#c2a04e',
      },
    ]);
    setAdding(false);
    setForm({ m: 'JUL', d: '', title: '', sub: '' });
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {admin && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
        >
          <Glyph d={GLYPH.plus} size={17} stroke={2} />
          Add an event
        </button>
      )}
      {admin && adding && (
        <Card className="p-3.5 mb-4">
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">New event</div>
          <div className="flex gap-2 mb-2.5">
            <select
              value={form.m}
              onChange={(e) => setForm({ ...form, m: e.target.value })}
              className="w-[78px] flex-none p-2.5 border-[1.5px] border-line rounded-[11px] text-[13px] bg-white"
            >
              {MONTHS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              value={form.d}
              onChange={(e) => setForm({ ...form, d: e.target.value })}
              placeholder="Day"
              className="flex-1 min-w-0 px-3 py-2.5 border-[1.5px] border-line rounded-[11px] text-[13px] bg-white"
            />
          </div>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event title"
            className="w-full box-border px-3 py-2.5 border-[1.5px] border-line rounded-[11px] text-[13px] bg-white mb-2.5"
          />
          <input
            value={form.sub}
            onChange={(e) => setForm({ ...form, sub: e.target.value })}
            placeholder="Time / venue"
            className="w-full box-border px-3 py-2.5 border-[1.5px] border-line rounded-[11px] text-[13px] bg-white mb-3"
          />
          <div className="flex gap-[9px]">
            <button
              onClick={() => setAdding(false)}
              className="flex-1 py-3 rounded-xl bg-white text-green font-semibold text-[13px] border-[1.5px] border-[#d3ddd4]"
            >
              Cancel
            </button>
            <button onClick={addEvent} className="flex-1 py-3 rounded-xl bg-green text-white font-semibold text-[13px]">
              Add to calendar
            </button>
          </div>
        </Card>
      )}

      <div className="text-[11.5px] text-muted mb-3.5">Upcoming at Greenwood</div>
      {sorted.map((ev, i) => (
        <div key={i} className="flex gap-3 mb-[11px] items-stretch">
          <div className="w-[50px] flex-none rounded-[14px] bg-white border border-line text-center py-2 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-gold tracking-[0.06em]">{ev.m}</span>
            <span className="font-serif text-[22px] leading-none">{ev.d}</span>
          </div>
          <div
            className="flex-1 bg-white border border-line rounded-[14px] px-3 py-[11px] flex items-center gap-2.5"
            style={{ borderLeft: `3px solid ${ev.accent}` }}
          >
            <div className="flex-1 min-w-0">
              <h4 className="text-[13.5px] font-semibold">{ev.title}</h4>
              <small className="text-[11px] text-muted">{ev.sub}</small>
            </div>
            {admin && (
              <button
                onClick={() => setEvents((e) => e.filter((x) => x !== ev))}
                className="flex-none w-[30px] h-[30px] rounded-[9px] bg-[#faeeee] grid place-items-center text-danger"
                aria-label="Remove"
              >
                <Glyph d={GLYPH.trash} size={15} stroke={2} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ NOTICE BOARD ============
export function NoticeBoardScreen({
  role,
  notices,
  acked,
  onOpen,
  onCompose,
}: {
  role: 'parent' | 'teacher' | 'admin';
  notices: Notice[];
  acked: Record<string, boolean>;
  onOpen: (id: string) => void;
  onCompose?: () => void;
}) {
  const isParent = role === 'parent';
  const unread = notices.filter((n) => !acked[n.id]).length;
  return (
    <div className="px-[15px] py-4 pb-6">
      {role === 'admin' ? (
        <button
          onClick={onCompose}
          className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
        >
          <Glyph d={GLYPH.plus} size={17} stroke={2} />
          Post a new notice
        </button>
      ) : (
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[11.5px] text-muted">All notices from the school</div>
          <div className="text-[11px] font-bold text-green bg-mist px-2.5 py-1 rounded-full">{unread} unread</div>
        </div>
      )}
      {notices.map((n) => (
        <Card key={n.id} onClick={() => onOpen(n.id)} className="p-3.5 mb-2.5 flex gap-3 items-start">
          <div className="w-[38px] h-[38px] rounded-xl bg-gold-soft grid place-items-center flex-none text-[#8a6d1f]">
            <Glyph d={n.icon} size={19} stroke={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[7px] mb-1">
              <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-green bg-mist px-[7px] py-[3px] rounded-md">
                {n.category}
              </span>
              {n.pinned && <span className="text-[9.5px] font-bold tracking-[0.05em] text-[#8a6d1f]">PINNED</span>}
              <span className="ml-auto text-[10px] text-muted font-semibold">{n.date}</span>
            </div>
            <h4 className="font-serif text-[17px] leading-[1.15] mb-[3px]">{n.title}</h4>
            <p className="text-[12px] text-muted leading-[1.45] line-clamp-1">{n.preview}</p>
          </div>
          {isParent && (
            <div
              className={cx('w-2 h-2 rounded-full flex-none mt-1', acked[n.id] ? 'bg-success' : 'bg-gold')}
            />
          )}
        </Card>
      ))}
    </div>
  );
}

// ============ NOTICE DETAIL ============
export function NoticeDetailScreen({
  notice,
  acked,
  showAck,
  onAcknowledge,
}: {
  notice: Notice;
  acked: boolean;
  showAck: boolean;
  onAcknowledge: () => void;
}) {
  const statLine = notice.ackStat.replace(/^(\d+)/, (_m, d: string) =>
    acked ? String(parseInt(d) + 1) : d,
  );
  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-3.5 mb-3">
        <div className="flex items-center gap-2 mb-[11px]">
          <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-green bg-mist px-2 py-[3px] rounded-md">
            {notice.category}
          </span>
          {notice.pinned && <span className="text-[9.5px] font-bold tracking-[0.05em] text-[#8a6d1f]">PINNED</span>}
          <span className="ml-auto text-[10.5px] text-muted font-semibold">{notice.date}</span>
        </div>
        <h3 className="font-serif text-[24px] leading-[1.1] mb-1">{notice.title}</h3>
        <div className="text-[11px] text-muted font-semibold mb-3">{notice.from}</div>
        <p className="text-[13.5px] leading-[1.6] whitespace-pre-line">{notice.body}</p>
      </Card>
      {showAck &&
        (acked ? (
          <button className="w-full py-3.5 rounded-[14px] bg-mist text-green font-semibold text-[14px]">
            ✓ Acknowledged · just now
          </button>
        ) : (
          <PrimaryButton onClick={onAcknowledge}>Acknowledge you've read this</PrimaryButton>
        ))}
      <div className="text-center text-[11.5px] text-muted font-semibold mt-3">{statLine}</div>
    </div>
  );
}

// small shared compose form pieces are declared where used; kept minimal here.
export { InfoNote, Chip, SectionLabel };
