import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Shield } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

type LoginFormProps = {
  onSuccess: () => void;
  onSwitchToSignup?: () => void;
  onExit?: () => void;
};
export default function LoginForm({ onSuccess, onSwitchToSignup, onExit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (needsTotp) totpRef.current?.focus(); }, [needsTotp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.authLogin({ email, password, totp: needsTotp ? totp : undefined });
      if ('needs_totp' in r) { setNeedsTotp(true); return; }
      onSuccess();
    } catch (e: any) {
      if (e?.status === 401) setErr(needsTotp ? 'Wrong code, try again' : 'Invalid credentials');
      else if (e?.status === 429) setErr('Too many attempts. Try again later.');
      else setErr(e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zsbg px-6">
      <ThemeToggle variant="floating" />
      <div className="w-full max-w-[380px]">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="mb-5 text-xs tracking-[0.08em] text-zsmuted hover:text-zstext transition-colors"
            aria-label="Exit sign in"
          >
            Exit
          </button>
        )}
        <div className="flex flex-col items-center text-center mb-10 select-none">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-zsaccent/30 to-zsaccent/10 ring-1 ring-zsaccent/30 flex items-center justify-center mb-5 shadow-[0_8px_24px_-8px_rgba(92,200,255,0.5)]">
            <Shield className="w-6 h-6 text-zsaccent" strokeWidth={2.25} />
          </div>
          <h1 className="text-[26px] leading-tight font-semibold text-zstext tracking-tight">
            Sign in to ZeroSpam
          </h1>
          <p className="mt-2 text-[14px] text-zsmuted">
            {needsTotp ? 'Enter your authenticator code to continue.' : 'Enter your owner credentials.'}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-zspanel/90 backdrop-blur-sm ring-1 ring-zsborder/60 rounded-2xl p-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] space-y-4"
        >
          <Field
            label="Email"
            disabled={needsTotp || busy}
          >
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={needsTotp || busy}
              className="w-full bg-transparent text-[15px] text-zstext placeholder-zsmuted/60 focus:outline-none disabled:opacity-60"
              placeholder="me@local"
            />
          </Field>

          <Field
            label="Password"
            disabled={needsTotp || busy}
          >
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={needsTotp || busy}
              className="w-full bg-transparent text-[15px] text-zstext placeholder-zsmuted/60 focus:outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </Field>

          {needsTotp && (
            <Field label="Authenticator code" disabled={busy}>
              <input
                ref={totpRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                required
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
                className="w-full bg-transparent text-[17px] text-zstext placeholder-zsmuted/40 focus:outline-none font-mono tracking-[0.4em] disabled:opacity-60"
                placeholder="000000"
              />
            </Field>
          )}

          {err && (
            <div
              role="alert"
              className="text-[13px] text-zsdanger bg-zsdanger/10 ring-1 ring-zsdanger/30 rounded-lg px-3 py-2"
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 rounded-xl bg-zsaccent text-zsbg text-[15px] font-semibold py-3
                       hover:brightness-110 active:brightness-95 active:scale-[0.99]
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-[transform,filter] duration-150 ease-out
                       shadow-[0_8px_24px_-12px_rgba(92,200,255,0.6)]"
          >
            {busy ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign in'}
          </button>
          {onSwitchToSignup && (
            <button type="button" onClick={onSwitchToSignup} className="w-full text-xs text-zsmuted mt-2">
              Need an account? Sign up
            </button>
          )}
        </form>

        <p className="text-center text-[12px] text-zsmuted/70 mt-8 select-none">
          Whitelist-first email · default-deny inbox
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={[
        'block rounded-xl bg-zsbg/60 ring-1 ring-zsborder/60 px-4 pt-2.5 pb-2.5',
        'transition-shadow duration-150',
        'focus-within:ring-2 focus-within:ring-zsaccent/40 focus-within:bg-zsbg/80',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="text-[11px] uppercase tracking-[0.08em] text-zsmuted/80 font-medium mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}
