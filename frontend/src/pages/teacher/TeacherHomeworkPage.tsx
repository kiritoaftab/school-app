import { useEffect, useState } from 'react';
import { usePostHomework, useTClasses } from '../../api/teacher';
import { Button } from '../../components/ui';
import { Field, TextInput, TextArea, Select, Note } from '../../components/form';

export function TeacherHomeworkPage() {
  const classes = useTClasses();
  const post = usePostHomework();
  const [klassId, setKlassId] = useState<number>();
  const [subject, setSubject] = useState('Mathematics');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [task, setTask] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (classes.data && !klassId && classes.data[0]) setKlassId(classes.data[0].id);
  }, [classes.data, klassId]);

  async function submit() {
    if (!klassId) return;
    await post.mutateAsync({ klassId, subject, date, task, note: note || undefined });
    setTask('');
    setNote('');
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="font-serif text-[26px] leading-tight">Post Homework</h1>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class">
          <Select value={klassId ?? ''} onChange={(e) => setKlassId(Number(e.target.value))}>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Task">
        <TextArea rows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Homework details…" />
      </Field>
      <Field label="Note (optional)">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. show all steps" />
      </Field>
      {done && <Note>Homework posted.</Note>}
      <Button onClick={submit} disabled={!task.trim() || post.isPending}>
        {post.isPending ? 'Posting…' : 'Post homework'}
      </Button>
    </div>
  );
}
