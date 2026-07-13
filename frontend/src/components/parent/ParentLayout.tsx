import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { Icon } from '../icons';
import { cx } from '../ui';
import { useAuth } from '../../auth/AuthContext';

const tabs = [
  { to: '/app/home', label: 'Home', icon: Icon.home },
  { to: '/app/attendance', label: 'Attendance', icon: Icon.calendar },
  { to: '/app/notices', label: 'Notices', icon: Icon.megaphone },
  { to: '/app/diary', label: 'Diary', icon: Icon.book },
  { to: '/app/notifications', label: 'Alerts', icon: Icon.bell },
];

export function ParentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell>
      {/* header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 bg-white border-b border-line z-10">
        <div className="w-10 h-10 rounded-xl bg-green grid place-items-center flex-none">
          <span className="font-serif text-white text-xl leading-none">G</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted leading-tight">{user?.school?.name ?? 'Greenwood'}</p>
          <p className="font-semibold text-[15px] truncate">Hi, {user?.name?.split(' ')[0]}</p>
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
      </header>

      {/* scroll area */}
      <main className="gw-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>

      {/* bottom nav */}
      <nav className="flex items-stretch bg-white border-t border-line px-2 pt-1.5 pb-2">
        {tabs.map((t) => {
          const I = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cx(
                  'flex-1 flex flex-col items-center gap-1 py-1 rounded-xl',
                  isActive ? 'text-green' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <I size={22} stroke={isActive ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </AppShell>
  );
}
