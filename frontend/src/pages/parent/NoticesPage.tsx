import { Link } from 'react-router-dom';
import { useNotices } from '../../api/parent';
import { Card, Badge, Spinner, EmptyState } from '../../components/ui';

export function NoticesPage() {
  const { data, isLoading } = useNotices();
  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <h1 className="font-serif text-[30px] leading-tight">Notice Board</h1>
      </div>
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="px-4 mt-3 space-y-2.5">
          {data.map((n) => (
            <Link key={n.id} to={`/app/notices/${n.id}`}>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  {n.pinned && <Badge tone="gold">Pinned</Badge>}
                  <Badge>{n.category}</Badge>
                  {!n.acked && <span className="w-2 h-2 rounded-full bg-danger ml-auto" title="Unread" />}
                </div>
                <p className="font-semibold text-[15px] leading-snug">{n.title}</p>
                <p className="text-[12px] text-muted mt-1.5">
                  {new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  {' · '}
                  {n.ackCount} of {n.totalParents} acknowledged
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState>No notices yet.</EmptyState>
      )}
    </div>
  );
}
