import { useState } from 'react';
import { useAttendance } from '../../api/parent';
import { useStudent } from '../../parent/StudentContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChildSwitcher } from '../../parent/ChildSwitcher';
import { Card, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';

const statusColor: Record<string, string> = {
  PRESENT: 'bg-success text-white',
  ABSENT: 'bg-danger text-white',
  LATE: 'bg-gold text-green-deep',
  HOLIDAY: 'bg-line text-muted',
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function AttendancePage() {
  const { selected } = useStudent();
  const [cursor, setCursor] = useState(() => new Date());
  const month = monthKey(cursor);
  const { data, isLoading } = useAttendance(selected?.id, month);

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const byDate = new Map((data?.days ?? []).map((d) => [d.date, d.status]));

  return (
    <div className="pb-6">
      <ScreenHeader title="Attendance" />
      <ChildSwitcher />

      {/* summary */}
      <div className="px-4 mt-3 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="font-serif text-[26px] text-green leading-none">{data?.percent ?? 0}%</p>
          <p className="text-[11px] text-muted mt-1">Present</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="font-serif text-[26px] text-success leading-none">{data?.present ?? 0}</p>
          <p className="text-[11px] text-muted mt-1">Days present</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="font-serif text-[26px] text-danger leading-none">{data?.absent ?? 0}</p>
          <p className="text-[11px] text-muted mt-1">Days absent</p>
        </Card>
      </div>

      {/* calendar */}
      <div className="px-4 mt-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1 text-green">
              <Icon.chevronLeft size={20} />
            </button>
            <p className="font-semibold text-[15px]">
              {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1 text-green">
              <Icon.chevronRight size={20} />
            </button>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] text-muted font-semibold py-1">{d}</div>
              ))}
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = `${month}-${String(day).padStart(2, '0')}`;
                const status = byDate.get(key);
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg grid place-items-center text-[12px] font-medium ${
                      status ? statusColor[status] : 'bg-cloud text-muted'
                    }`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          )}

          {/* legend */}
          <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-muted">
            <Legend className="bg-success" label="Present" />
            <Legend className="bg-danger" label="Absent" />
            <Legend className="bg-gold" label="Late" />
            <Legend className="bg-line" label="Holiday" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${className}`} />
      {label}
    </span>
  );
}
