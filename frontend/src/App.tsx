import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequireRole, RedirectIfAuthed } from './auth/guards';
import { LoginPage } from './pages/LoginPage';
import { ParentApp } from './app/ParentApp';
import { TeacherApp } from './app/TeacherApp';
import { AdminApp } from './app/AdminApp';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
        {/* Splat routes: each role app owns everything below its prefix and
            stays mounted across screens, so its data caches survive. The path
            is parsed by parseParent/parseTeacher/parseAdmin in app/routes.ts. */}
        <Route path="/app/*" element={<RequireRole role="PARENT"><ParentApp /></RequireRole>} />
        <Route path="/teacher/*" element={<RequireRole role="TEACHER"><TeacherApp /></RequireRole>} />
        <Route path="/admin/*" element={<RequireRole role="ADMIN"><AdminApp /></RequireRole>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
