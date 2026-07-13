import { useDiary, useToggleDiary } from '../../api/parent';
import { useStudent } from '../../parent/StudentContext';
import { ChildSwitcher } from '../../parent/ChildSwitcher';
import { Card, Spinner, EmptyState } from '../../components/ui';
import { Icon } from '../../components/icons';

export function DiaryPage() {
  const { selected } = useStudent();
  const { data, isLoading } = useDiary(selected?.id);
  const toggle = useToggleDiary();

  // group by date
  const groups = new Map<string, typeof data>();
  (data ?? []).forEach((d) => {
    const arr = groups.get(d.date) ?? [];
    arr.push(d);
    groups.set(d.date, arr);
  });

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <h1 className="font-serif text-[30px] leading-tight">Digital Diary</h1>
      </div>
      <ChildSwitcher />

      {isLoading ? (
        <Spinner />
      ) : groups.size === 0 ? (
        <EmptyState>No homework logged yet.</EmptyState>
      ) : (
        <div className="px-4 mt-3 space-y-5">
          {[...groups.entries()].map(([date, items]) => (
            <div key={date}>
              <p className="text-[12px] font-bold text-muted uppercase tracking-wide mb-2">
                {new Date(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <Card className="divide-y divide-line">
                {items!.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggle.mutate({ entryId: d.id, studentId: selected!.id, done: !d.done })}
                    className="w-full text-left p-3.5 flex items-start gap-3"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border grid place-items-center flex-none mt-0.5 ${
                        d.done ? 'bg-green border-green text-white' : 'border-line'
                      }`}
                    >
                      {d.done && <Icon.check size={13} stroke={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-gold uppercase tracking-wide">{d.subject}</p>
                      <p className={`text-[14px] leading-snug ${d.done ? 'line-through text-muted' : ''}`}>{d.task}</p>
                      {d.note && <p className="text-[12px] text-muted mt-1 italic">Note: {d.note}</p>}
                    </div>
                  </button>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
