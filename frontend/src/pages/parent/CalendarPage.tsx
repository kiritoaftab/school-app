import { useEvents } from '../../api/parent';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Card, IconTile, Spinner, EmptyState } from '../../components/ui';
import { Icon } from '../../components/icons';

export function CalendarPage() {
  const { data, isLoading } = useEvents();
  return (
    <div className="pb-6">
      <ScreenHeader title="Calendar" />
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="px-4 mt-2 space-y-2.5">
          {data.map((e) => {
            const d = new Date(e.date);
            return (
              <Card key={e.id} className="p-3.5 flex items-center gap-3">
                <div className="w-12 flex-none text-center">
                  <p className="font-serif text-[24px] leading-none text-green">{d.getDate()}</p>
                  <p className="text-[10px] uppercase text-muted font-semibold">
                    {d.toLocaleDateString(undefined, { month: 'short' })}
                  </p>
                </div>
                <div className="w-px self-stretch bg-line" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]">{e.title}</p>
                  {e.description && <p className="text-[12px] text-muted">{e.description}</p>}
                </div>
                <IconTile className="bg-mist">
                  <span className="text-green"><Icon.calendar size={18} /></span>
                </IconTile>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState>No upcoming events.</EmptyState>
      )}
    </div>
  );
}
