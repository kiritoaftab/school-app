import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { storage } from '../lib/storage';
import { homeFor } from '../app/routes';

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

/**
 * Another account on the same mobile number — a second school, or a different
 * role at one. Reachable without signing out: the number is already proven.
 */
export interface Profile {
  id: number;
  name: string;
  role: Role;
  schoolId: number | null;
  school: { id: number; name: string; logo?: string | null } | null;
  current: boolean;
}

/** Roles this app can render. A SUPER_ADMIN row belongs to the other console. */
const APP_ROLES: Role[] = ['PARENT', 'TEACHER', 'ADMIN'];

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  /** Every profile on this phone, including the active one. Empty until loaded. */
  profiles: Profile[];
  loginWithToken: (token: string) => Promise<AuthUser>;
  switchProfile: (userId: number) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function fetchMe(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>('/auth/me');
    setUser(data);
    return data;
  }

  /** Never fatal: a failed lookup only costs the switcher, not the session. */
  async function fetchProfiles() {
    try {
      const { data } = await api.get<{ profiles: Profile[] }>('/auth/profiles');
      setProfiles(data.profiles.filter((p) => APP_ROLES.includes(p.role)));
    } catch {
      setProfiles([]);
    }
  }

  useEffect(() => {
    if (!storage.getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(fetchProfiles)
      .catch(() => storage.clear())
      .finally(() => setLoading(false));
  }, []);

  async function loginWithToken(token: string) {
    storage.setToken(token);
    const me = await fetchMe();
    void fetchProfiles();
    return me;
  }

  /**
   * Swap the active profile in place of a sign-out/sign-in round trip.
   *
   * Reloads rather than re-rendering: every screen below this holds data for
   * the old school — children, notices, the diary — and a switch that left any
   * of it on screen would be showing one school's data under another's name.
   */
  async function switchProfile(userId: number) {
    const { data } = await api.post<{ token: string; role: Role }>('/auth/switch', { userId });
    storage.setToken(data.token);
    location.hash = `#${homeFor[data.role] ?? '/app'}`;
    location.reload();
  }

  function logout() {
    storage.clear();
    setUser(null);
    setProfiles([]);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, profiles, loginWithToken, switchProfile, logout }}
    >
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
