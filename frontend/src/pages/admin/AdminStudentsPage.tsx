import { useState } from 'react';
import { useAStudents, useAClasses, useAUsers, useCreateStudent, useLinkParent } from '../../api/admin';
import { Card, Button, Badge, Spinner, EmptyState } from '../../components/ui';
import { Field, TextInput, Select, Note } from '../../components/form';

export function AdminStudentsPage() {
  const students = useAStudents();
  const classes = useAClasses();
  const parents = useAUsers('PARENT');
  const createStudent = useCreateStudent();
  const linkParent = useLinkParent();

  const [name, setName] = useState('');
  const [admissionNo, setAdmissionNo] = useState('');
  const [klassId, setKlassId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // link form
  const [linkStudent, setLinkStudent] = useState('');
  const [linkParentId, setLinkParentId] = useState('');

  async function addStudent() {
    await createStudent.mutateAsync({
      name,
      admissionNo,
      klassId: klassId ? Number(klassId) : undefined,
    });
    setName('');
    setAdmissionNo('');
    setMsg('Student added.');
    setTimeout(() => setMsg(null), 2500);
  }

  async function link() {
    await linkParent.mutateAsync({
      parentUserId: Number(linkParentId),
      studentId: Number(linkStudent),
      relation: 'Parent',
    });
    setMsg('Parent linked.');
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <h1 className="font-serif text-[26px] leading-tight">Students</h1>

      {/* add student */}
      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Add student</p>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Admission No.">
            <TextInput value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
          </Field>
          <Field label="Class">
            <Select value={klassId} onChange={(e) => setKlassId(e.target.value)}>
              <option value="">— none —</option>
              {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
        </div>
        <Button onClick={addStudent} disabled={!name.trim() || !admissionNo.trim() || createStudent.isPending}>
          Add student
        </Button>
      </Card>

      {/* link parent */}
      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Link parent to student</p>
        <Field label="Student">
          <Select value={linkStudent} onChange={(e) => setLinkStudent(e.target.value)}>
            <option value="">— select —</option>
            {students.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Parent">
          <Select value={linkParentId} onChange={(e) => setLinkParentId(e.target.value)}>
            <option value="">— select —</option>
            {parents.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
          </Select>
        </Field>
        <Button variant="gold" onClick={link} disabled={!linkStudent || !linkParentId || linkParent.isPending}>
          Link parent
        </Button>
      </Card>

      {msg && <Note>{msg}</Note>}

      {/* list */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">All students</p>
        {students.isLoading ? (
          <Spinner />
        ) : students.data && students.data.length > 0 ? (
          <div className="space-y-2">
            {students.data.map((s) => (
              <Card key={s.id} className="p-3.5">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[14px] flex-1">{s.name}</p>
                  {s.klass && <Badge tone="green">{s.klass}</Badge>}
                </div>
                <p className="text-[12px] text-muted">{s.admissionNo}</p>
                {s.parents.length > 0 && (
                  <p className="text-[12px] text-muted mt-1">
                    Parents: {s.parents.map((p) => p.name).join(', ')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState>No students yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
