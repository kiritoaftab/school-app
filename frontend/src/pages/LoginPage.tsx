import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth, type Role } from '../auth/AuthContext';
import { Button, cx } from '../components/ui';
import { Icon } from '../components/icons';

const roles: { value: Role; label: string; desc: string }[] = [
  { value: 'PARENT', label: 'Parent', desc: 'Track your child' },
  { value: 'TEACHER', label: 'Teacher', desc: 'Manage your class' },
  { value: 'ADMIN', label: 'Admin', desc: 'Run the school' },
];

const homeFor: Record<Role, string> = {
  PARENT: '/app/home',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [step, setStep] = useState<'role' | 'phone' | 'otp'>('role');
  const [role, setRole] = useState<Role>('PARENT');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/request-otp', { phone, role });
      setDevCode(data.devCode ?? null);
      if (data.devCode) setOtp(data.devCode);
      setStep('otp');
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, role, otp });
      const user = await loginWithToken(data.token);
      navigate(homeFor[user.role]);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-[430px] mx-auto w-full">
      {/* brand */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-green grid place-items-center mx-auto mb-3">
          <span className="font-serif text-white text-4xl leading-none">G</span>
        </div>
        <h1 className="font-serif text-[32px] leading-none">Greenwood</h1>
        <p className="text-muted text-[13px] tracking-widest uppercase mt-1">School App</p>
      </div>

      {step === 'role' && (
        <div className="space-y-3">
          <p className="text-center text-[14px] text-muted mb-2">I am a…</p>
          {roles.map((r) => (
            <button
              key={r.value}
              onClick={() => {
                setRole(r.value);
                setStep('phone');
              }}
              className="w-full bg-white border border-line rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition"
            >
              <div className="w-11 h-11 rounded-xl bg-mist grid place-items-center text-green">
                {r.value === 'PARENT' ? <Icon.home size={22} /> : r.value === 'TEACHER' ? <Icon.book size={22} /> : <Icon.users size={22} />}
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-[15px]">{r.label}</p>
                <p className="text-[12px] text-muted">{r.desc}</p>
              </div>
              <Icon.chevronRight size={20} className="text-muted" />
            </button>
          ))}
        </div>
      )}

      {step === 'phone' && (
        <div className="space-y-4">
          <RoleTag role={role} onBack={() => setStep('role')} />
          <div>
            <p className="text-[12px] font-semibold text-muted mb-2">Phone number</p>
            <input
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Enter your registered number"
              className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-[15px]"
            />
          </div>
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <Button onClick={requestOtp} disabled={phone.length < 6 || busy}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <RoleTag role={role} onBack={() => setStep('phone')} />
          <div>
            <p className="text-[12px] font-semibold text-muted mb-2">Enter the 6-digit code</p>
            <input
              inputMode="numeric"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="••••••"
              className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-[22px] tracking-[0.4em] text-center font-semibold"
            />
            {devCode && (
              <p className="text-[12px] text-muted mt-2 text-center">
                Dev code auto-filled: <span className="font-semibold text-green">{devCode}</span>
              </p>
            )}
          </div>
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <Button onClick={verifyOtp} disabled={otp.length < 4 || busy}>
            {busy ? 'Verifying…' : 'Verify & continue'}
          </Button>
        </div>
      )}
    </div>
  );
}

function RoleTag({ role, onBack }: { role: Role; onBack: () => void }) {
  return (
    <button onClick={onBack} className={cx('flex items-center gap-2 text-[13px] font-semibold text-green')}>
      <Icon.chevronLeft size={18} />
      Logging in as {role.charAt(0) + role.slice(1).toLowerCase()}
    </button>
  );
}
