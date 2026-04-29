import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Shield } from 'lucide-react';

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
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
      if (e?.status === 401) setErr('Invalid credentials');
      else if (e?.status === 429) setErr('Too many attempts. Try again later.');
      else setErr(e?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-700">
          <Shield className="w-5 h-5" />
          <h1 className="text-lg font-semibold">ZeroSpam</h1>
        </div>
        <label className="block">
          <span className="text-sm text-zinc-600">Email</span>
          <input type="email" required autoFocus
            className="mt-1 w-full border border-zinc-300 rounded px-3 py-2"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={needsTotp || busy} />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-600">Password</span>
          <input type="password" required
            className="mt-1 w-full border border-zinc-300 rounded px-3 py-2"
            value={password} onChange={(e) => setPassword(e.target.value)} disabled={needsTotp || busy} />
        </label>
        {needsTotp && (
          <label className="block">
            <span className="text-sm text-zinc-600">Authenticator code</span>
            <input ref={totpRef} inputMode="numeric" pattern="\d{6}" required
              className="mt-1 w-full border border-zinc-300 rounded px-3 py-2 font-mono tracking-widest"
              value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={busy} />
          </label>
        )}
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-zinc-900 text-white rounded py-2 hover:bg-zinc-800 disabled:opacity-50">
          {busy ? 'Signing in…' : needsTotp ? 'Verify' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
