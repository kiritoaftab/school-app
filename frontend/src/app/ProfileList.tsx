import { useState } from 'react';
import { cx, Glyph } from './kit';
import { GLYPH } from './data';
import type { Profile, Role } from '../auth/AuthContext';

const ROLE_LABEL: Record<Role, string> = {
  PARENT: 'Parent',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
};

/**
 * The accounts sharing this mobile number, active one first-class and marked.
 *
 * Tapping another one swaps the session to it. Shared by the account sheet and
 * the parent's child switcher so a two-school parent finds it wherever they
 * look for it.
 */
export function ProfileList({
  profiles,
  onSwitch,
  onError,
}: {
  profiles: Profile[];
  onSwitch: (userId: number) => Promise<void>;
  onError?: (message: string) => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function pick(profile: Profile) {
    if (profile.current || busyId != null) return;
    onError?.('');
    setBusyId(profile.id);
    try {
      // Resolves into a reload, so there is no success path to clean up after.
      await onSwitch(profile.id);
    } catch {
      setBusyId(null);
      onError?.('Could not open that profile. Please try again.');
    }
  }

  return (
    <>
      {profiles.map((p) => {
        const on = p.current;
        return (
          <button
            key={p.id}
            onClick={() => pick(p)}
            disabled={on || busyId != null}
            className={cx(
              'w-full flex items-center gap-2.5 px-3.5 py-[13px] rounded-[15px] mb-2 border-[1.5px] text-left',
              on ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white',
              busyId != null && !on && 'opacity-60',
            )}
          >
            <div
              className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none overflow-hidden"
              style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}
            >
              {p.school?.logo ? (
                <img
                  src={p.school.logo}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                (p.school?.name ?? p.name)[0]?.toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <b
                className={cx(
                  'text-[14px] font-bold block truncate',
                  on ? 'text-green' : 'text-ink',
                )}
              >
                {p.school?.name ?? p.name}
              </b>
              <small className="text-[11.5px] text-muted block truncate">
                {ROLE_LABEL[p.role]} · {p.name}
              </small>
            </div>
            <span className="flex-none text-muted">
              {busyId === p.id ? (
                <small className="text-[11.5px] font-semibold">Opening…</small>
              ) : on ? (
                <span className="text-green">
                  <Glyph d={GLYPH.check} size={17} stroke={2.2} />
                </span>
              ) : (
                <Glyph d={GLYPH.chevronRight} size={17} stroke={2} />
              )}
            </span>
          </button>
        );
      })}
    </>
  );
}
