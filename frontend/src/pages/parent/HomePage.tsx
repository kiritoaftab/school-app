import { Link } from 'react-router-dom';
import { useToday, useNotices, useDiary, useAlbums } from '../../api/parent';
import { useStudent } from '../../parent/StudentContext';
import { ChildSwitcher } from '../../parent/ChildSwitcher';
import { Card, IconTile, SectionTitle, Spinner, Badge } from '../../components/ui';
import { Icon } from '../../components/icons';

const statusLabel: Record<string, { text: string; tone: 'success' | 'danger' | 'gold' | 'neutral' }> = {
  PRESENT: { text: 'Present', tone: 'success' },
  ABSENT: { text: 'Absent', tone: 'danger' },
  LATE: { text: 'Late', tone: 'gold' },
  HOLIDAY: { text: 'Holiday', tone: 'neutral' },
};

export function HomePage() {
  const { selected } = useStudent();
  const today = useToday();
  const notices = useNotices();
  const diary = useDiary(selected?.id);
  const albums = useAlbums();

  const myStatus = today.data?.find((t) => t.studentId === selected?.id);
  const pinnedNotice = notices.data?.find((n) => n.pinned) ?? notices.data?.[0];
  const todayDiary = diary.data?.slice(0, 3) ?? [];
  const latestAlbum = albums.data?.[0];

  const quickActions = [
    { to: '/app/leave/new', label: 'Apply Leave', icon: Icon.clipboard },
    { to: '/app/results', label: 'Results', icon: Icon.award },
    { to: '/app/photos', label: 'Photos', icon: Icon.image },
    { to: '/app/calendar', label: 'Calendar', icon: Icon.calendar },
  ];

  return (
    <div className="pb-6">
      <ChildSwitcher />

      <div className="px-4 pt-4">
        <p className="text-muted text-[13px]">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="font-serif text-[30px] leading-tight mt-0.5">
          {selected?.name ?? 'Your child'}
        </h1>
        <p className="text-muted text-[13px]">{selected?.klass ?? ''}</p>
      </div>

      {/* attendance status card */}
      <div className="px-4 mt-4">
        <Link to="/app/attendance">
          <div className="bg-green text-white rounded-[20px] p-4 flex items-center gap-3">
            <IconTile className="bg-white/15">
              <span className="text-white">
                <Icon.check size={22} stroke={2.4} />
              </span>
            </IconTile>
            <div className="flex-1">
              <p className="text-white/70 text-[12px]">Today's attendance</p>
              <p className="font-semibold text-[17px]">
                {myStatus?.status
                  ? `Marked ${statusLabel[myStatus.status].text}`
                  : 'Not marked yet'}
              </p>
            </div>
            <Icon.chevronRight size={20} className="text-white/60" />
          </div>
        </Link>
      </div>

      {/* quick actions */}
      <div className="px-4 mt-4 grid grid-cols-4 gap-2">
        {quickActions.map((a) => {
          const I = a.icon;
          return (
            <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1.5">
              <IconTile className="bg-white border border-line w-14 h-14 rounded-2xl">
                <span className="text-green">
                  <I size={22} />
                </span>
              </IconTile>
              <span className="text-[11px] text-muted font-medium text-center leading-tight">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* notice preview */}
      <div className="px-4 mt-6">
        <SectionTitle action={<Link to="/app/notices" className="text-[12px] font-semibold text-green">See all</Link>}>
          Notices
        </SectionTitle>
        {notices.isLoading ? (
          <Spinner />
        ) : pinnedNotice ? (
          <Link to={`/app/notices/${pinnedNotice.id}`}>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                {pinnedNotice.pinned && <Badge tone="gold">Pinned</Badge>}
                <Badge>{pinnedNotice.category}</Badge>
                {!pinnedNotice.acked && <span className="w-2 h-2 rounded-full bg-danger ml-auto" />}
              </div>
              <p className="font-semibold text-[15px] leading-snug">{pinnedNotice.title}</p>
            </Card>
          </Link>
        ) : null}
      </div>

      {/* diary preview */}
      <div className="px-4 mt-6">
        <SectionTitle action={<Link to="/app/diary" className="text-[12px] font-semibold text-green">Open diary</Link>}>
          Today's Diary
        </SectionTitle>
        <Card className="divide-y divide-line">
          {todayDiary.length === 0 ? (
            <p className="p-4 text-sm text-muted">No homework logged.</p>
          ) : (
            todayDiary.map((d) => (
              <div key={d.id} className="p-3.5 flex items-start gap-3">
                <span
                  className={`w-5 h-5 rounded-md border grid place-items-center flex-none mt-0.5 ${
                    d.done ? 'bg-green border-green text-white' : 'border-line'
                  }`}
                >
                  {d.done && <Icon.check size={13} stroke={3} />}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-gold uppercase tracking-wide">{d.subject}</p>
                  <p className="text-[13px] leading-snug">{d.task}</p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* latest album */}
      {latestAlbum && (
        <div className="px-4 mt-6">
          <SectionTitle action={<Link to="/app/photos" className="text-[12px] font-semibold text-green">Gallery</Link>}>
            Latest Album
          </SectionTitle>
          <Link to={`/app/photos/${latestAlbum.id}`}>
            <Card className="p-4 flex items-center gap-3">
              <IconTile className="bg-mist">
                <span className="text-green"><Icon.image size={22} /></span>
              </IconTile>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] truncate">{latestAlbum.title}</p>
                <p className="text-[12px] text-muted">{latestAlbum.count} photos</p>
              </div>
              <Icon.chevronRight size={20} className="text-muted" />
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
