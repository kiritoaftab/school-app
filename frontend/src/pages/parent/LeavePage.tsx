import { Link } from 'react-router-dom';
import { useLeaves } from '../../api/parent';
import { Card, Badge, Button, Spinner, EmptyState } from '../../components/ui';

const statusTone = {
  SUBMITTED: 'gold',
  APPROVED: 'success',
  DECLINED: 'danger',
} as const;

export function LeavePage() {
  const { data, isLoading } = useLeaves();
  return (
    <div className="pb-6">
      <div className="px-4 pt-4 flex items-center justify-between">
        <h1 className="font-serif text-[30px] leading-tight">Leave</h1>
      </div>
      <div className="px-4 mt-3">
        <Link to="/app/leave/new">
          <Button variant="gold">+ Apply for leave</Button>
        </Link>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="px-4 mt-4 space-y-2.5">
          {data.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <Badge tone="neutral">{l.type}</Badge>
                <Badge tone={statusTone[l.status]}>{l.status}</Badge>
              </div>
              <p className="text-[14px] font-medium">{l.studentName}</p>
              <p className="text-[12px] text-muted">
                {l.fromDate} → {l.toDate}
              </p>
              <p className="text-[13px] mt-1.5 text-ink/80">{l.reason}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>No leave requests yet.</EmptyState>
      )}
    </div>
  );
}
