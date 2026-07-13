import { useState } from 'react';
import { useAClasses, useAUsers, useCreateClass } from '../../api/admin';
import { Card, Button, Badge, Spinner, EmptyState } from '../../components/ui';
import { Field, TextInput, Select, Note } from '../../components/form';

export function AdminClassesPage() {
  const classes = useAClasses();
  const teachers = useAUsers('TEACHER');
  const create = useCreateClass();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    await create.mutateAsync({
      grade,
      section,
      classTeacherId: teacherId ? Number(teacherId) : null,
    });
    setGrade('');
    setSection('');
    setMsg('Class created.');
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <h1 className="font-serif text-[26px] leading-tight">Classes</h1>

      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Create class</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade"><TextInput value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 4" /></Field>
          <Field label="Section"><TextInput value={section} onChange={(e) => setSection(e.target.value)} placeholder="B" /></Field>
        </div>
        <Field label="Class teacher">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— none —</option>
            {teachers.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        {msg && <Note>{msg}</Note>}
        <Button onClick={add} disabled={!grade.trim() || !section.trim() || create.isPending}>Create class</Button>
      </Card>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">All classes</p>
        {classes.isLoading ? (
          <Spinner />
        ) : classes.data && classes.data.length > 0 ? (
          <div className="space-y-2">
            {classes.data.map((c) => (
              <Card key={c.id} className="p-3.5 flex items-center gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-[14px]">{c.label}</p>
                  <p className="text-[12px] text-muted">{c.teacher ?? 'No class teacher'}</p>
                </div>
                <Badge tone="neutral">{c.students} students</Badge>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState>No classes yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
