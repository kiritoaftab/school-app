import { useState } from 'react';
import { useAUsers, useCreateUser } from '../../api/admin';
import { Card, Button, Badge, Spinner, EmptyState } from '../../components/ui';
import { Field, TextInput, Select, Note } from '../../components/form';

const roleTone = { PARENT: 'neutral', TEACHER: 'green', ADMIN: 'gold' } as const;

export function AdminUsersPage() {
  const users = useAUsers();
  const create = useCreateUser();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('PARENT');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    try {
      await create.mutateAsync({ name, phone, role });
      setName('');
      setPhone('');
      setMsg('User created.');
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Could not create user');
    }
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <h1 className="font-serif text-[26px] leading-tight">Users</h1>

      <Card className="p-4 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Create user</p>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))} />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {['PARENT', 'TEACHER', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
        {err && <Note tone="err">{err}</Note>}
        {msg && <Note>{msg}</Note>}
        <Button onClick={add} disabled={!name.trim() || phone.length < 6 || create.isPending}>
          Create user
        </Button>
      </Card>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">All users</p>
        {users.isLoading ? (
          <Spinner />
        ) : users.data && users.data.length > 0 ? (
          <div className="space-y-2">
            {users.data.map((u) => (
              <Card key={`${u.id}-${u.role}`} className="p-3.5 flex items-center gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-[14px]">{u.name}</p>
                  <p className="text-[12px] text-muted">{u.phone}</p>
                </div>
                <Badge tone={roleTone[u.role as keyof typeof roleTone]}>{u.role}</Badge>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState>No users.</EmptyState>
        )}
      </div>
    </div>
  );
}
