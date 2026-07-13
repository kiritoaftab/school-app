import { StaffLayout } from '../../components/StaffLayout';

export function AdminLayout() {
  return (
    <StaffLayout
      title="Admin"
      tabs={[
        { to: '/admin', label: 'Students' },
        { to: '/admin/users', label: 'Users' },
        { to: '/admin/classes', label: 'Classes' },
        { to: '/admin/broadcast', label: 'Notices' },
      ]}
    />
  );
}
