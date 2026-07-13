import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, type Role } from './AuthContext';
import { Spinner } from '../components/ui';

const homeFor: Record<Role, string> = {
  PARENT: '/app/home',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor[user.role]} replace />;
  return <>{children}</>;
}

/** Redirect an already-authenticated user away from /login to their home. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to={homeFor[user.role]} replace />;
  return <>{children}</>;
}
