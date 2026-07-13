import { useTLeaves, useReviewLeave } from '../../api/teacher';
import { Card, Badge, Button, Spinner, EmptyState } from '../../components/ui';

const statusTone = { SUBMITTED: 'gold', APPROVED: 'success', DECLINED: 'danger' } as const;

export function TeacherLeavePage() {
  const { data, isLoading } = useTLeaves();
  const review = useReviewLeave();

  return (
    <div className="px-4 py-4">
      <h1 className="font-serif text-[26px] leading-tight mb-3">Leave Requests</h1>
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="space-y-2.5">
          {data.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <Badge tone="neutral">{l.type}</Badge>
                <Badge tone={statusTone[l.status]}>{l.status}</Badge>
              </div>
              <p className="font-medium text-[14px]">{l.studentName}</p>
              <p className="text-[12px] text-muted">{l.fromDate} → {l.toDate}</p>
              <p className="text-[13px] mt-1.5 text-ink/80">{l.reason}</p>
              {l.status === 'SUBMITTED' && (
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" onClick={() => review.mutate({ id: l.id, status: 'APPROVED' })}>
                    Approve
                  </Button>
                  <Button variant="danger" onClick={() => review.mutate({ id: l.id, status: 'DECLINED' })}>
                    Decline
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>No leave requests from your classes.</EmptyState>
      )}
    </div>
  );
}
