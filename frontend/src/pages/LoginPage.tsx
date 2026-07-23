import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth, type Role } from '../auth/AuthContext';
import { Glyph } from '../app/kit';
import { GLYPH, maskPhone } from '../app/data';

const homeFor: Record<Role, string> = {
  PARENT: '/app',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

const roleLabel: Record<Role, string> = {
  PARENT: 'Parent',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
};

interface Account {
  token: string;
  id: number;
  name: string;
  role: Role;
  school: { id: number; name: string; logo?: string | null } | null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'pick'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const digits = phone.replace(/\D/g, '');

  async function enterAccount(account: Account) {
    setError(null);
    setBusy(true);
    try {
      const user = await loginWithToken(account.token);
      navigate(homeFor[user.role]);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Could not sign in');
      setBusy(false);
    }
  }

  async function requestOtp() {
    if (digits.length < 10) {
      setError('Enter a 10-digit mobile number');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/request-otp', { phone: digits });
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
    if (otp.length < 4) {
      setError('Enter the code');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: digits, otp });
      const list: Account[] = data.accounts ?? [];
      if (list.length === 1) {
        const user = await loginWithToken(list[0].token);
        navigate(homeFor[user.role]);
        return;
      }
      // Multiple profiles on this number — let the user choose which to enter.
      setAccounts(list);
      setStep('pick');
      setBusy(false);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Invalid code');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-[#f6f7f3] flex flex-col px-7 md:my-6 md:min-h-[calc(100vh-3rem)] md:rounded-[32px] md:shadow-[0_20px_60px_-25px_rgba(20,40,30,0.35)]">
        {step === 'phone' && (
          <div className="flex-1 flex flex-col pt-16 pb-8">
            <div className="w-[52px] h-[52px] rounded-full bg-green grid place-items-center mb-[22px] shadow-[0_0_0_1.5px_#c2a04e,0_0_0_4px_#f6f7f3,0_0_0_5px_#efe6cf]">
              <span className="font-serif text-white text-[27px]">G</span>
            </div>
            <h2 className="font-serif text-[29px] leading-[1.05] mb-2">Welcome to Greenwood</h2>
            <p className="text-[13px] text-muted leading-[1.55]">
              Sign in with the mobile number your school has on record. No password to remember.
            </p>

            <div className="mt-[30px]">
              <label className="block text-[11px] tracking-[0.1em] uppercase font-semibold text-muted mb-2">
                Mobile number
              </label>
              <div className="flex items-center bg-white border-[1.5px] border-line rounded-[14px] overflow-hidden">
                <span className="px-3 text-[14px] font-semibold border-r border-line h-12 flex items-center">+91</span>
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError(null);
                  }}
                  inputMode="numeric"
                  autoFocus
                  placeholder="00000 00000"
                  className="flex-1 min-w-0 border-none px-3.5 h-12 text-[15px] font-semibold tracking-[0.04em] bg-transparent"
                />
              </div>
              {error && <div className="text-[11.5px] text-danger font-semibold mt-2">{error}</div>}
            </div>

            <button
              onClick={requestOtp}
              disabled={busy}
              className="mt-[18px] w-full py-[15px] rounded-[14px] bg-green text-white font-bold text-[14.5px] disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>

            <div className="flex-1" />
            <div className="flex gap-[9px] items-start bg-[#eef3ee] border border-[#e0e7e0] rounded-[14px] px-[13px] py-3">
              <span className="flex-none mt-0.5 text-green">
                <Glyph d={GLYPH.info} size={15} stroke={1.9} />
              </span>
              <div className="text-[11px] text-[#3a4a41] leading-[1.5]">
                There's nothing to sign up for. Your school registers your number — parents are added by the class
                teacher, staff by the admin.
              </div>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="flex-1 flex flex-col pt-[52px] pb-8">
            <button
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError(null);
              }}
              className="w-9 h-9 rounded-[11px] bg-white border border-line grid place-items-center mb-5 text-green"
              aria-label="Back"
            >
              <Glyph d={GLYPH.chevronLeft} size={18} stroke={2} />
            </button>
            <h2 className="font-serif text-[28px] leading-[1.05] mb-2">Enter the code</h2>
            <p className="text-[13px] text-muted leading-[1.55]">
              We sent a 6-digit code to <b className="text-ink">{maskPhone(digits)}</b>.
            </p>

            <div className="mt-7">
              <input
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="••••••"
                className="w-full box-border text-center border-[1.5px] border-line rounded-[14px] p-4 text-[26px] font-bold tracking-[0.5em] bg-white"
              />
              {error && <div className="text-[11.5px] text-danger font-semibold mt-2 text-center">{error}</div>}
            </div>

            <div className="flex justify-between items-center mt-3.5">
              <span className="text-[12px] text-muted">
                Didn't get it? <b className="text-green">Resend</b>
              </span>
              {devCode && (
                <button
                  onClick={() => setOtp(devCode)}
                  className="text-[12px] font-bold text-green bg-mist border border-[#dbe5db] rounded-[9px] px-[11px] py-1.5"
                >
                  Autofill (dev)
                </button>
              )}
            </div>

            <button
              onClick={verifyOtp}
              disabled={busy}
              className="mt-5 w-full py-[15px] rounded-[14px] bg-green text-white font-bold text-[14.5px] disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
          </div>
        )}

        {step === 'pick' && (
          <div className="flex-1 flex flex-col pt-[52px] pb-8">
            <h2 className="font-serif text-[28px] leading-[1.05] mb-2">Choose a profile</h2>
            <p className="text-[13px] text-muted leading-[1.55]">
              This number is registered for more than one profile. Pick the one you'd like to open.
            </p>
            {error && <div className="text-[11.5px] text-danger font-semibold mt-3">{error}</div>}

            <div className="mt-7 flex flex-col gap-2.5">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => enterAccount(account)}
                  disabled={busy}
                  className="flex items-center gap-3 bg-white border-[1.5px] border-line rounded-[14px] px-4 py-3.5 text-left disabled:opacity-60"
                >
                  <span className="flex-none w-11 h-11 rounded-full bg-green grid place-items-center text-white font-serif text-[19px]">
                    {account.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold text-ink truncate">{account.name}</span>
                    <span className="block text-[12px] text-muted truncate">
                      {roleLabel[account.role]}
                      {account.school ? ` · ${account.school.name}` : ''}
                    </span>
                  </span>
                  <span className="flex-none text-muted">
                    <Glyph d={GLYPH.chevronRight} size={18} stroke={2} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
