import { useParams } from 'react-router-dom';
import { useNotice, useAckNotice } from '../../api/parent';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Card, Badge, Button, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';

export function NoticeDetailPage() {
  const { id } = useParams();
  const noticeId = Number(id);
  const { data, isLoading } = useNotice(noticeId);
  const ack = useAckNotice();

  if (isLoading || !data) {
    return (
      <div>
        <ScreenHeader title="Notice" />
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <ScreenHeader title="Notice" />
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          {data.pinned && <Badge tone="gold">Pinned</Badge>}
          <Badge>{data.category}</Badge>
        </div>
        <h1 className="font-serif text-[26px] leading-tight">{data.title}</h1>
        <p className="text-[12px] text-muted mt-1">
          {new Date(data.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <p className="text-[15px] leading-relaxed text-ink/90 mt-4 whitespace-pre-wrap">{data.body}</p>

        <Card className="p-4 mt-6 flex items-center gap-3 bg-mist border-none">
          <div className="flex-1">
            <p className="font-semibold text-[14px]">Acknowledgement</p>
            <p className="text-[12px] text-muted">{data.ackCount} of {data.totalParents} parents</p>
          </div>
          {data.acked ? (
            <span className="flex items-center gap-1.5 text-success font-semibold text-[13px]">
              <Icon.check size={18} stroke={2.6} /> Acknowledged
            </span>
          ) : null}
        </Card>

        {!data.acked && (
          <div className="mt-4">
            <Button onClick={() => ack.mutate(noticeId)} disabled={ack.isPending}>
              {ack.isPending ? 'Saving…' : 'Acknowledge this notice'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
