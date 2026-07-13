import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireRole, RedirectIfAuthed } from './auth/guards';
import { StudentProvider } from './parent/StudentContext';
import { LoginPage } from './pages/LoginPage';

// parent
import { ParentLayout } from './components/parent/ParentLayout';
import { HomePage } from './pages/parent/HomePage';
import { AttendancePage } from './pages/parent/AttendancePage';
import { NoticesPage } from './pages/parent/NoticesPage';
import { NoticeDetailPage } from './pages/parent/NoticeDetailPage';
import { DiaryPage } from './pages/parent/DiaryPage';
import { CalendarPage } from './pages/parent/CalendarPage';
import { ResultsPage } from './pages/parent/ResultsPage';
import { PhotosPage } from './pages/parent/PhotosPage';
import { AlbumPage } from './pages/parent/AlbumPage';
import { LeavePage } from './pages/parent/LeavePage';
import { LeaveNewPage } from './pages/parent/LeaveNewPage';
import { NotificationsPage } from './pages/parent/NotificationsPage';

// teacher
import { TeacherLayout } from './pages/teacher/TeacherLayout';
import { MarkAttendancePage } from './pages/teacher/MarkAttendancePage';
import { TeacherNoticePage } from './pages/teacher/TeacherNoticePage';
import { TeacherHomeworkPage } from './pages/teacher/TeacherHomeworkPage';
import { TeacherResultsPage } from './pages/teacher/TeacherResultsPage';
import { TeacherLeavePage } from './pages/teacher/TeacherLeavePage';

// admin
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminClassesPage } from './pages/admin/AdminClassesPage';
import { AdminBroadcastPage } from './pages/admin/AdminBroadcastPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />

        {/* Parent */}
        <Route
          path="/app"
          element={
            <RequireRole role="PARENT">
              <StudentProvider>
                <ParentLayout />
              </StudentProvider>
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="notices/:id" element={<NoticeDetailPage />} />
          <Route path="diary" element={<DiaryPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="photos/:id" element={<AlbumPage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="leave/new" element={<LeaveNewPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Teacher */}
        <Route path="/teacher" element={<RequireRole role="TEACHER"><TeacherLayout /></RequireRole>}>
          <Route index element={<MarkAttendancePage />} />
          <Route path="notice" element={<TeacherNoticePage />} />
          <Route path="homework" element={<TeacherHomeworkPage />} />
          <Route path="results" element={<TeacherResultsPage />} />
          <Route path="leave" element={<TeacherLeavePage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<RequireRole role="ADMIN"><AdminLayout /></RequireRole>}>
          <Route index element={<AdminStudentsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="classes" element={<AdminClassesPage />} />
          <Route path="broadcast" element={<AdminBroadcastPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
