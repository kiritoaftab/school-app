import { useState } from 'react';
import { BottomSheet } from './kit';
import { initialsOf, maskPhone } from './data';
import { ProfileList } from './ProfileList';
import { useAuth } from '../auth/AuthContext';

export function AccountSheet({
  open,
  onClose,
  name,
  phone,
  roleLabel,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const { profiles, switchProfile } = useAuth();
  const [error, setError] = useState('');

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-green text-white font-bold text-[15px] grid place-items-center flex-none">
          {initialsOf(name)}
        </div>
        <div className="flex-1 min-w-0">
          <b className="text-[15px] font-bold block">{name}</b>
          <small className="text-[11.5px] text-muted">
            {roleLabel} · {maskPhone(phone)}
          </small>
        </div>
      </div>

      {/* Only worth the space when there is somewhere else to go. */}
      {profiles.length > 1 && (
        <div className="mb-4">
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
            Your profiles
          </div>
          <ProfileList
            profiles={profiles}
            onSwitch={switchProfile}
            onError={setError}
          />
          {error && (
            <div className="text-[11.5px] text-danger font-semibold mt-1">{error}</div>
          )}
        </div>
      )}

      <button
        onClick={onSignOut}
        className="w-full mt-2 py-3 rounded-[14px] bg-[#f6ecec] text-danger font-bold text-[13.5px]"
      >
        Sign out
      </button>
    </BottomSheet>
  );
}
