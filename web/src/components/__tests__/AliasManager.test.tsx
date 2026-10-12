// web/src/components/__tests__/AliasManager.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AliasManager from '../AliasManager';
import type { Alias, ForwardTarget, Mailbox } from '../../types';

vi.mock('../../api', () => ({
  api: {
    listAliases: vi.fn(),
    aliasUsage: vi.fn(),
    createAlias: vi.fn(),
    patchAlias: vi.fn(),
    abuseAlias: vi.fn(),
    restoreAlias: vi.fn(),
    deleteAlias: vi.fn(),
    forwardTargets: vi.fn(),
    addForwardTarget: vi.fn(),
    resendForwardTarget: vi.fn(),
    deleteForwardTarget: vi.fn(),
  },
}));

import { api } from '../../api';

const mailbox = { id: 1, address: 'me@zero-spam.email' } as Mailbox;

function fakeAlias(over: Partial<Alias> = {}): Alias {
  return {
    id: 10,
    mailbox_id: 1,
    address: 'quiet-otter-x7k2@zero-spam.email',
    label: 'shop',
    expires_at: null,
    abused: 0,
    received_count: 4,
    last_seen: null,
    created_at: 0,
    mode: 'store',
    forward_target_id: null,
    forward_target_email: null,
    forward_target_verified_at: null,
    forwarded_count: 0,
    replied_count: 0,
    ...over,
  };
}

function fakeTarget(over: Partial<ForwardTarget> = {}): ForwardTarget {
  return {
    id: 5,
    account_id: 1,
    email: 'me@gmail.com',
    verified_at: 1,
    verify_expires_at: null,
    created_at: 0,
    ...over,
  };
}

function renderIt() {
  return render(<AliasManager mailboxes={[mailbox]} defaultMailboxId={1} onClose={() => {}} />);
}

describe('AliasManager forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listAliases).mockResolvedValue([fakeAlias()]);
    vi.mocked(api.aliasUsage).mockResolvedValue({ count: 1, max: 50 });
    vi.mocked(api.forwardTargets).mockResolvedValue([fakeTarget()]);
    vi.mocked(api.createAlias).mockResolvedValue({
      id: 11,
      address: 'x@zero-spam.email',
      expires_at: null,
      mode: 'forward',
      forward_target_id: 5,
    });
    vi.mocked(api.patchAlias).mockResolvedValue(fakeAlias({ mode: 'both', forward_target_id: 5 }));
    vi.mocked(api.addForwardTarget).mockResolvedValue({ id: 6, email: 'new@outlook.com', verified: false });
    vi.mocked(api.resendForwardTarget).mockResolvedValue({ ok: true });
  });

  it('shows usage and forwarding addresses with their verification state', async () => {
    vi.mocked(api.forwardTargets).mockResolvedValue([
      fakeTarget(),
      fakeTarget({ id: 6, email: 'work@corp.com', verified_at: null }),
    ]);
    renderIt();
    expect(await screen.findByTestId('alias-usage')).toHaveTextContent('1 / 50');
    expect(await screen.findByText('me@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /resend link/i }));
    expect(api.resendForwardTarget).toHaveBeenCalledWith(6);
  });

  it('creates a forwarding alias pointed at the first verified address', async () => {
    renderIt();
    await screen.findByText('me@gmail.com');
    await userEvent.selectOptions(screen.getByLabelText('Delivery'), 'forward');
    expect(screen.getByLabelText('Forward to')).toHaveValue('5');
    await userEvent.click(screen.getByRole('button', { name: /generate alias/i }));
    await waitFor(() =>
      expect(api.createAlias).toHaveBeenCalledWith(
        expect.objectContaining({ mailboxId: 1, mode: 'forward', forwardTargetId: 5 }),
      ),
    );
  });

  it('changes an existing alias delivery mode', async () => {
    renderIt();
    const select = await screen.findByLabelText('Delivery for quiet-otter-x7k2@zero-spam.email');
    await userEvent.selectOptions(select, 'both');
    await waitFor(() => expect(api.patchAlias).toHaveBeenCalledWith(10, { mode: 'both', forwardTargetId: 5 }));
  });

  it('blocks forwarding modes until an address is verified', async () => {
    vi.mocked(api.forwardTargets).mockResolvedValue([]);
    renderIt();
    await screen.findByText('quiet-otter-x7k2@zero-spam.email');
    await userEvent.selectOptions(screen.getByLabelText('Delivery'), 'forward');
    expect(screen.getByText(/add and confirm a forwarding address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate alias/i })).toBeDisabled();
  });

  it('adds a forwarding address and tells the user to confirm it', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText('New forwarding address'), 'new@outlook.com');
    await userEvent.click(screen.getByRole('button', { name: /add address/i }));
    expect(api.addForwardTarget).toHaveBeenCalledWith('new@outlook.com');
    expect(await screen.findByText(/check new@outlook.com for a confirmation link/i)).toBeInTheDocument();
  });

  it('disables Generate at the alias limit', async () => {
    vi.mocked(api.aliasUsage).mockResolvedValue({ count: 50, max: 50 });
    renderIt();
    expect(await screen.findByText(/reached the alias limit/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate alias/i })).toBeDisabled();
  });
});
