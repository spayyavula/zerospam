import { useEffect, useState } from 'react';
import { api } from '../api';

export default function TotpSetupModal({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.totpSetup().then((r) => { setSecret(r.secret); setOtpauth(r.otpauth_url); }).catch(() => {});
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.totpConfirm({ code }); setDone(true); }
    catch (e: any) { setErr(e?.status === 401 ? 'Wrong code, try again' : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="font-semibold">Two-factor authentication</h2>
        {!secret && <div>Loading…</div>}
        {secret && !done && (
          <>
            <p className="text-sm text-zinc-600">
              Scan this in your authenticator app, then enter the code below.
            </p>
            <pre className="bg-zinc-100 p-2 rounded text-xs break-all">{otpauth}</pre>
            <details className="text-sm">
              <summary className="cursor-pointer text-zinc-600">Or enter the secret manually</summary>
              <code className="block mt-1 font-mono text-sm">{secret}</code>
            </details>
            <form onSubmit={confirm} className="space-y-2">
              <input inputMode="numeric" pattern="\d{6}" required
                className="w-full border border-zinc-300 rounded px-3 py-2 font-mono tracking-widest"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" />
              {err && <div className="text-sm text-red-600">{err}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="px-3 py-1 text-zinc-600">Cancel</button>
                <button type="submit" disabled={busy} className="bg-zinc-900 text-white px-3 py-1 rounded">
                  {busy ? 'Verifying…' : 'Verify & enable'}
                </button>
              </div>
            </form>
          </>
        )}
        {done && (
          <div className="space-y-3">
            <div className="text-green-700">Two-factor enabled.</div>
            <button onClick={onClose} className="bg-zinc-900 text-white px-3 py-1 rounded">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
