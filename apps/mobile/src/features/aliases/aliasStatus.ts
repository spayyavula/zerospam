import type { Alias } from '@zerospam/shared-api';

export type AliasStatus = { label: string; tone: 'quiet' | 'ok' | 'danger' | 'signal'; off: boolean };

export function aliasStatus(a: Pick<Alias, 'abused' | 'expires_at' | 'mode' | 'forward_target_verified_at'>, now = Date.now()): AliasStatus {
  if (a.abused) return { label: 'Off', tone: 'danger', off: true };
  if (a.expires_at != null && a.expires_at < now) return { label: 'Expired', tone: 'quiet', off: true };
  if (a.mode !== 'store') {
    return a.forward_target_verified_at
      ? { label: a.mode === 'forward' ? 'Forwards' : 'Keeps + forwards', tone: 'ok', off: false }
      : { label: 'Not forwarding', tone: 'quiet', off: false };
  }
  return { label: 'Active', tone: 'ok', off: false };
}
