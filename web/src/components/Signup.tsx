import { useState } from 'react';
import { api } from '../api';

type Props = { onSwitchToLogin: () => void };

export default function Signup({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.signup({ email: email.trim(), password, username: username.trim().toLowerCase() });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'sign-up failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-sm mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-4">Check your inbox.</h1>
        <p className="text-sm text-zsmuted">
          We sent a verification link to <strong>{email}</strong>. Click it to finish setting up your inbox at{' '}
          <code>{username}@zero-spam.email</code>.
        </p>
        <button onClick={onSwitchToLogin} className="mt-6 text-sm text-zsaccent">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto p-8 space-y-3">
      <h1 className="text-xl font-semibold">Create your ZeroSpam inbox</h1>
      <label className="block text-xs text-zsmuted">
        Username
        <input
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9._-]+"
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          placeholder="alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <span className="text-[11px] text-zsmuted">{username || 'alice'}@zero-spam.email</span>
      </label>
      <label className="block text-xs text-zsmuted">
        Email (where verification + recovery messages go)
        <input
          required
          type="email"
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-xs text-zsmuted">
        Password (12+ chars)
        <input
          required
          type="password"
          minLength={12}
          className="mt-1 w-full bg-zsbg border border-zsborder rounded px-2 py-1.5 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="text-xs text-zsdanger">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-zsaccent text-zsbg rounded px-2 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
      <button type="button" onClick={onSwitchToLogin} className="w-full text-xs text-zsmuted">
        Already have an account? Sign in
      </button>
    </form>
  );
}
