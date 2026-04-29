import { useEffect, useState } from 'react';
import { api } from '../api';
import { ShieldCheck, Check } from 'lucide-react';

export default function TotpSetupModal({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.totpSetup().then((r) => { setSecret(r.secret); setOtpauth(r.otpauth_url); }).catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.totpConfirm({ code }); setDone(true); }
    catch (e: any) { setErr(e?.status === 401 ? 'Wrong code, try again.' : 'Could not verify. Try again.'); }
    finally { setBusy(false); }
  }

  async function copySecret() {
    if (!secret) return;
    try { await navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    catch { /* clipboard blocked — leave the visible code as the fallback */ }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/60 backdrop-blur-md fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="totp-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-zspanel/95 ring-1 ring-zsborder/60 rounded-2xl p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
      >
        <div className="flex flex-col items-center text-center mb-6 select-none">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-zsaccent/30 to-zsaccent/10 ring-1 ring-zsaccent/30 flex items-center justify-center mb-4">
            {done ? (
              <Check className="w-5 h-5 text-zsok" strokeWidth={2.5} />
            ) : (
              <ShieldCheck className="w-5 h-5 text-zsaccent" strokeWidth={2.25} />
            )}
          </div>
          <h2 id="totp-title" className="text-[20px] font-semibold text-zstext tracking-tight">
            {done ? 'Two-factor enabled' : 'Two-factor authentication'}
          </h2>
          {!done && (
            <p className="mt-1.5 text-[13.5px] text-zsmuted leading-relaxed">
              Scan the code with your authenticator app, then enter the 6-digit code it shows.
            </p>
          )}
        </div>

        {!secret && !done && (
          <div className="text-center text-[13px] text-zsmuted py-6">Loading…</div>
        )}

        {secret && !done && (
          <>
            <div className="rounded-xl bg-zsbg/60 ring-1 ring-zsborder/60 p-3 mb-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-zsmuted/80 font-medium mb-1">
                otpauth URL
              </div>
              <pre className="text-[11.5px] text-zstext/80 leading-snug break-all whitespace-pre-wrap font-mono">
                {otpauth}
              </pre>
            </div>

            <div className="rounded-xl bg-zsbg/60 ring-1 ring-zsborder/60 p-3 mb-5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.08em] text-zsmuted/80 font-medium mb-0.5">
                  Or enter the secret manually
                </div>
                <code className="block text-[12.5px] font-mono text-zstext break-all">{secret}</code>
              </div>
              <button
                type="button"
                onClick={copySecret}
                className="text-[12px] text-zsaccent hover:brightness-110 active:brightness-90 px-2 py-1 rounded-md transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <form onSubmit={confirm} className="space-y-3">
              <label className="block rounded-xl bg-zsbg/60 ring-1 ring-zsborder/60 px-4 pt-2.5 pb-2.5
                                focus-within:ring-2 focus-within:ring-zsaccent/40 focus-within:bg-zsbg/80
                                transition-shadow duration-150">
                <div className="text-[11px] uppercase tracking-[0.08em] text-zsmuted/80 font-medium mb-1">
                  Authenticator code
                </div>
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-transparent text-[17px] text-zstext placeholder-zsmuted/40 focus:outline-none font-mono tracking-[0.4em]"
                  placeholder="000000"
                />
              </label>

              {err && (
                <div role="alert"
                  className="text-[13px] text-zsdanger bg-zsdanger/10 ring-1 ring-zsdanger/30 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-[14px] text-zsmuted hover:text-zstext transition-colors rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-zsaccent text-zsbg text-[14px] font-semibold
                             hover:brightness-110 active:brightness-95 active:scale-[0.99]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-[transform,filter] duration-150 ease-out
                             shadow-[0_8px_24px_-12px_rgba(92,200,255,0.6)]"
                >
                  {busy ? 'Verifying…' : 'Verify & enable'}
                </button>
              </div>
            </form>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-[14px] text-zsmuted text-center">
              You'll be prompted for a code each time you sign in.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-zsaccent text-zsbg text-[14px] font-semibold
                         hover:brightness-110 active:brightness-95 transition
                         shadow-[0_8px_24px_-12px_rgba(92,200,255,0.6)]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
