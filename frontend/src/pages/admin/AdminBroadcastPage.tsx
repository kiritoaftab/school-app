import { useState } from 'react';
import { useCreateNotice, useCreateEvent, useAEvents } from '../../api/admin';
import { Card, Button, Spinner } from '../../components/ui';
import { Field, TextInput, TextArea, Select, Note } from '../../components/form';

export function AdminBroadcastPage() {
  const createNotice = useCreateNotice();
  const createEvent = useCreateEvent();
  const events = useAEvents();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('General');
  const [pinned, setPinned] = useState(false);
  const [nMsg, setNMsg] = useState<string | null>(null);

  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState(new Date().toISOString().slice(0, 10));
  const [eDesc, setEDesc] = useState('');
  const [eMsg, setEMsg] = useState<string | null>(null);

  async function postNotice() {
    await createNotice.mutateAsync({ title, body, category, pinned });
    setTitle(''); setBody(''); setPinned(false);
    setNMsg('School notice posted.');
    setTimeout(() => setNMsg(null), 2500);
  }
  async function addEvent() {
    await createEvent.mutateAsync({ title: eTitle, date: eDate, description: eDesc || undefined });
    setETitle(''); setEDesc('');
    setEMsg('Event added.');
    setTimeout(() => setEMsg(null), 2500);
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <h1 className="font-serif text-[26px] leading-tight">Notices & Events</h1>

      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">School-wide notice</p>
        <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Message"><TextArea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {['General', 'Academic', 'Event', 'Urgent'].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin
        </label>
        {nMsg && <Note>{nMsg}</Note>}
        <Button onClick={postNotice} disabled={!title.trim() || !body.trim() || createNotice.isPending}>Post notice</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Calendar event</p>
        <Field label="Title"><TextInput value={eTitle} onChange={(e) => setETitle(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><TextInput type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} /></Field>
          <Field label="Description"><TextInput value={eDesc} onChange={(e) => setEDesc(e.target.value)} /></Field>
        </div>
        {eMsg && <Note>{eMsg}</Note>}
        <Button variant="gold" onClick={addEvent} disabled={!eTitle.trim() || createEvent.isPending}>Add event</Button>
      </Card>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">Upcoming events</p>
        {events.isLoading ? <Spinner /> : (
          <div className="space-y-2">
            {events.data?.map((e) => (
              <Card key={e.id} className="p-3.5">
                <p className="font-semibold text-[14px]">{e.title}</p>
                <p className="text-[12px] text-muted">{e.date}{e.description ? ` · ${e.description}` : ''}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
