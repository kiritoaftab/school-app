import { useState } from 'react';
import { useResults, useTerms } from '../../api/parent';
import { useStudent } from '../../parent/StudentContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChildSwitcher } from '../../parent/ChildSwitcher';
import { Card, Spinner, EmptyState, cx } from '../../components/ui';

export function ResultsPage() {
  const { selected } = useStudent();
  const terms = useTerms();
  const [termId, setTermId] = useState<number | undefined>();
  const { data, isLoading } = useResults(selected?.id, termId);

  return (
    <div className="pb-6">
      <ScreenHeader title="Report Card" />
      <ChildSwitcher />

      {/* term picker */}
      {terms.data && terms.data.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto gw-scroll">
          {terms.data.map((t) => {
            const active = (termId ?? data?.term?.id) === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTermId(t.id)}
                className={cx(
                  'flex-none px-3.5 py-2 rounded-full text-[13px] font-semibold border',
                  active ? 'bg-green text-white border-green' : 'bg-white text-muted border-line',
                )}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : !data || data.subjects.length === 0 ? (
        <EmptyState>No results published yet.</EmptyState>
      ) : (
        <div className="px-4 mt-4">
          {/* headline */}
          <Card className="p-4 bg-green text-white border-none">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-white/70 text-[12px]">Overall</p>
                <p className="font-serif text-[34px] leading-none">{data.overallPct ?? '—'}%</p>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-[12px]">Rank</p>
                <p className="font-serif text-[26px] leading-none">{data.rank ?? '—'}</p>
              </div>
            </div>
          </Card>

          {/* subject bars */}
          <div className="mt-4 space-y-3">
            {data.subjects.map((s) => {
              const pct = Math.round((s.score / s.maxScore) * 100);
              return (
                <div key={s.subject}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-medium">{s.subject}</span>
                    <span className="text-muted">
                      {s.score}/{s.maxScore} · <span className="font-semibold text-green">{s.grade}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-line overflow-hidden">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {data.teacherComment && (
            <Card className="p-4 mt-5 bg-mist border-none">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">Teacher's Comment</p>
              <p className="text-[14px] leading-snug italic">"{data.teacherComment}"</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
