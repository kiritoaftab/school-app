import { StaffLayout } from '../../components/StaffLayout';

export function TeacherLayout() {
  return (
    <StaffLayout
      title="Teacher"
      tabs={[
        { to: '/teacher', label: 'Attendance' },
        { to: '/teacher/notice', label: 'Notice' },
        { to: '/teacher/homework', label: 'Homework' },
        { to: '/teacher/results', label: 'Results' },
        { to: '/teacher/leave', label: 'Leave' },
      ]}
    />
  );
}
