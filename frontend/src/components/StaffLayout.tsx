import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { Icon } from './icons';
import { cx } from './ui';
import { useAuth } from '../auth/AuthContext';

export interface StaffTab {
  to: string;
  label: string;
}

/** Shared top-tab layout for the basic Teacher and Admin surfaces. */
export function StaffLayout({ title, tabs }: { title: string; tabs: StaffTab[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell>
      <header className="px-4 pt-4 pb-3 bg-white border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green grid place-items-center flex-none">
            <span className="font-serif text-white text-xl leading-none">G</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted leading-tight">{title}</p>
            <p className="font-semibold text-[15px] truncate">{user?.name}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="text-muted p-2 -mr-2"
            aria-label="Log out"
          >
            <Icon.logout size={20} />
          </button>
        </div>

        <nav className="flex gap-1 mt-3 overflow-x-auto gw-scroll -mx-1 px-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              className={({ isActive }) =>
                cx(
                  'flex-none px-3.5 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap',
                  isActive ? 'bg-green text-white' : 'bg-mist text-muted',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="gw-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </AppShell>
  );
}
