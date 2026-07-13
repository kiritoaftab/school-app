import { useEffect, useState } from 'react';
import { useTClasses, useRoster, useMarkAttendance } from '../../api/teacher';
import { Card, Button, Spinner, EmptyState, cx } from '../../components/ui';

type Status = 'PRESENT' | 'ABSENT' | 'LATE';
const options: { value: Status; label: string; active: string }[] = [
  { value: 'PRESENT', label: 'P', active: 'bg-success text-white' },
  { value: 'ABSENT', label: 'A', active: 'bg-danger text-white' },
  { value: 'LATE', label: 'L', active: 'bg-gold text-green-deep' },
];

export function MarkAttendancePage() {
  const classes = useTClasses();
  const [classId, setClassId] = useState<number>();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const roster = useRoster(classId, date);
  const mark = useMarkAttendance();
  const [marks, setMarks] = useState<Record<number, Status>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (classes.data && !classId && classes.data[0]) setClassId(classes.data[0].id);
  }, [classes.data, classId]);

  useEffect(() => {
    if (roster.data) {
      const initial: Record<number, Status> = {};
      roster.data.students.forEach((s) => {
        initial[s.id] = (s.status as Status) ?? 'PRESENT';
      });
      setMarks(initial);
    }
  }, [roster.data]);

  async function save() {
    if (!roster.data) return;
    await mark.mutateAsync({
      date,
      marks: roster.data.students.map((s) => ({ studentId: s.id, status: marks[s.id] ?? 'PRESENT' })),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (classes.isLoading) return <Spinner />;
  if (!classes.data || classes.data.length === 0)
    return <EmptyState>You are not assigned as class teacher to any class.</EmptyState>;

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 space-y-3">
        <h1 className="font-serif text-[26px] leading-tight">Mark Attendance</h1>
        <div className="flex gap-2">
          {classes.data.map((c) => (
            <button
              key={c.id}
              onClick={() => setClassId(c.id)}
              className={cx(
                'px-3.5 py-2 rounded-full text-[13px] font-semibold border',
                c.id === classId ? 'bg-green text-white border-green' : 'bg-white text-muted border-line',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-[14px]"
        />
      </div>

      {roster.isLoading ? (
        <Spinner />
      ) : (
        <div className="px-4 mt-3">
          <Card className="divide-y divide-line">
            {roster.data?.students.map((s) => (
              <div key={s.id} className="p-3.5 flex items-center gap-3">
                <p className="flex-1 text-[14px] font-medium">{s.name}</p>
                <div className="flex gap-1.5">
                  {options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: o.value }))}
                      className={cx(
                        'w-9 h-9 rounded-lg text-[13px] font-bold grid place-items-center border',
                        marks[s.id] === o.value ? o.active + ' border-transparent' : 'bg-cloud text-muted border-line',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <div className="mt-4">
            <Button onClick={save} disabled={mark.isPending}>
              {saved ? '✓ Saved' : mark.isPending ? 'Saving…' : 'Save attendance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
