import { useEffect, useState } from 'react';
import { useTClasses, useTTerms, useRoster, usePostResults } from '../../api/teacher';
import { Button, Spinner, cx } from '../../components/ui';
import { Field, Select, TextArea, Note } from '../../components/form';

const SUBJECTS = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'];

export function TeacherResultsPage() {
  const classes = useTClasses();
  const terms = useTTerms();
  const post = usePostResults();

  const [classId, setClassId] = useState<number>();
  const roster = useRoster(classId);
  const [studentId, setStudentId] = useState<number>();
  const [termId, setTermId] = useState<number>();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (classes.data && !classId && classes.data[0]) setClassId(classes.data[0].id);
  }, [classes.data, classId]);
  useEffect(() => {
    if (terms.data && !termId && terms.data[0]) setTermId(terms.data[0].id);
  }, [terms.data, termId]);
  useEffect(() => {
    if (roster.data && !roster.data.students.find((s) => s.id === studentId)) {
      setStudentId(roster.data.students[0]?.id);
    }
  }, [roster.data, studentId]);

  const filled = SUBJECTS.filter((s) => scores[s] !== undefined && scores[s] !== '');

  function grade(pct: number) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
  }

  async function submit() {
    if (!studentId || !termId || filled.length === 0) return;
    const subjects = filled.map((s) => {
      const score = Number(scores[s]);
      return { subject: s, score, maxScore: 100, grade: grade(score) };
    });
    const overallPct = Math.round((subjects.reduce((a, s) => a + s.score, 0) / subjects.length) * 10) / 10;
    await post.mutateAsync({ studentId, termId, subjects, overallPct, teacherComment: comment || undefined });
    setScores({});
    setComment('');
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  if (classes.isLoading) return <Spinner />;

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="font-serif text-[26px] leading-tight">Enter Results</h1>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <Select value={classId ?? ''} onChange={(e) => setClassId(Number(e.target.value))}>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Term">
          <Select value={termId ?? ''} onChange={(e) => setTermId(Number(e.target.value))}>
            {terms.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Student">
        <Select value={studentId ?? ''} onChange={(e) => setStudentId(Number(e.target.value))}>
          {roster.data?.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>

      <div className="space-y-2">
        {SUBJECTS.map((s) => (
          <div key={s} className="flex items-center gap-3">
            <span className="flex-1 text-[14px]">{s}</span>
            <input
              inputMode="numeric"
              value={scores[s] ?? ''}
              onChange={(e) => setScores((m) => ({ ...m, [s]: e.target.value.replace(/[^\d]/g, '').slice(0, 3) }))}
              placeholder="—"
              className={cx('w-20 rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-center')}
            />
            <span className="text-[12px] text-muted w-8">/100</span>
          </div>
        ))}
      </div>

      <Field label="Teacher's comment">
        <TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional remark…" />
      </Field>

      {done && <Note>Results saved.</Note>}
      <Button onClick={submit} disabled={filled.length === 0 || post.isPending}>
        {post.isPending ? 'Saving…' : `Save results (${filled.length} subjects)`}
      </Button>
    </div>
  );
}
