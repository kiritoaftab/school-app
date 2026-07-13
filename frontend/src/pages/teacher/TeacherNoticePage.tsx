import { useState } from 'react';
import { usePostNotice, useTClasses } from '../../api/teacher';
import { Button } from '../../components/ui';
import { Field, TextInput, TextArea, Select, Note } from '../../components/form';

export function TeacherNoticePage() {
  const classes = useTClasses();
  const post = usePostNotice();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');
  const [pinned, setPinned] = useState(false);
  const [classId, setClassId] = useState<string>('');
  const [done, setDone] = useState(false);

  async function submit() {
    await post.mutateAsync({
      title,
      body,
      category,
      pinned,
      audienceClassId: classId ? Number(classId) : null,
    });
    setTitle('');
    setBody('');
    setPinned(false);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="font-serif text-[26px] leading-tight">Post a Notice</h1>
      <Field label="Title">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" />
      </Field>
      <Field label="Message">
        <TextArea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the notice…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {['General', 'Academic', 'Event', 'Urgent'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Audience">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Whole school</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        Pin this notice
      </label>
      {done && <Note>Notice posted.</Note>}
      <Button onClick={submit} disabled={!title.trim() || !body.trim() || post.isPending}>
        {post.isPending ? 'Posting…' : 'Post notice'}
      </Button>
    </div>
  );
}
