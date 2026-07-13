import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubmitLeave } from '../../api/parent';
import { useStudent } from '../../parent/StudentContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button, cx } from '../../components/ui';

const types = [
  { value: 'SICK', label: 'Sick' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function LeaveNewPage() {
  const { students, selected } = useStudent();
  const navigate = useNavigate();
  const submit = useSubmitLeave();

  const today = new Date().toISOString().slice(0, 10);
  const [studentId, setStudentId] = useState<number | undefined>(selected?.id);
  const [type, setType] = useState<'SICK' | 'CASUAL' | 'OTHER'>('SICK');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState('');

  const sid = studentId ?? selected?.id;
  const valid = sid && reason.trim() && fromDate && toDate && fromDate <= toDate;

  async function onSubmit() {
    if (!valid) return;
    await submit.mutateAsync({ studentId: sid!, type, fromDate, toDate, reason });
    navigate('/app/leave');
  }

  return (
    <div className="pb-8">
      <ScreenHeader title="Apply for Leave" />
      <div className="px-4 space-y-5">
        {/* child */}
        {students.length > 1 && (
          <Field label="Child">
            <div className="flex flex-wrap gap-2">
              {students.map((s) => (
                <Chip key={s.id} active={(sid) === s.id} onClick={() => setStudentId(s.id)}>
                  {s.name.split(' ')[0]}
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {/* type */}
        <Field label="Leave type">
          <div className="flex gap-2">
            {types.map((t) => (
              <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        {/* dates */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-3 text-[14px]"
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-white px-3 py-3 text-[14px]"
            />
          </Field>
        </div>

        {/* reason */}
        <Field label="Reason">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Briefly describe the reason…"
            className="w-full rounded-xl border border-line bg-white px-3 py-3 text-[14px] resize-none"
          />
        </Field>

        <Button onClick={onSubmit} disabled={!valid || submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted mb-2">{label}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'px-4 py-2 rounded-full text-[13px] font-semibold border',
        active ? 'bg-green text-white border-green' : 'bg-white text-muted border-line',
      )}
    >
      {children}
    </button>
  );
}
