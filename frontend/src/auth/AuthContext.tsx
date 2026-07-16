import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { storage } from '../lib/storage';

export type Role = 'PARENT' | 'TEACHER' | 'ADMIN';

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  role: Role;
  schoolId: number;
  school?: { id: number; name: string; logo?: string | null };
  students?: { id: number; name: string; relation: string }[];
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMe(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>('/auth/me');
    setUser(data);
    return data;
  }

  useEffect(() => {
    if (!storage.getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .catch(() => storage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function loginWithToken(token: string) {
    storage.setToken(token);
    return fetchMe();
  }

  function logout() {
    storage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
