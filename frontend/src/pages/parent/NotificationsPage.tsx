import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead } from '../../api/parent';
import { Card, IconTile, Spinner, EmptyState } from '../../components/ui';
import { Icon } from '../../components/icons';

const iconFor: Record<string, (p: { size?: number }) => React.ReactNode> = {
  ATTENDANCE: Icon.check,
  NOTICE: Icon.megaphone,
  LEAVE: Icon.clipboard,
  RESULT: Icon.award,
  DIARY: Icon.book,
};

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <h1 className="font-serif text-[30px] leading-tight">Notifications</h1>
      </div>
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="px-4 mt-3 space-y-2">
          {data.map((n) => {
            const I = iconFor[n.type] ?? Icon.bell;
            return (
              <Card
                key={n.id}
                className={`p-3.5 flex items-start gap-3 ${n.readAt ? '' : 'bg-mist border-none'}`}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  if (n.deeplink) navigate(n.deeplink);
                }}
              >
                <IconTile className={n.readAt ? 'bg-mist' : 'bg-white'}>
                  <span className="text-green">{I({ size: 20 })}</span>
                </IconTile>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] leading-snug">{n.title}</p>
                  {n.body && <p className="text-[12px] text-muted mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-muted mt-1">
                    {new Date(n.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.readAt && <span className="w-2 h-2 rounded-full bg-danger flex-none mt-1.5" />}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState>You're all caught up.</EmptyState>
      )}
    </div>
  );
}
