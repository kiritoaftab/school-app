import { useNavigate } from 'react-router-dom';
import { Icon } from './icons';
import type { ReactNode } from 'react';

/** Sub-page header with a back button. */
export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 text-green" aria-label="Back">
        <Icon.chevronLeft size={24} />
      </button>
      <h1 className="font-serif text-[26px] leading-none flex-1">{title}</h1>
      {action}
    </div>
  );
}
