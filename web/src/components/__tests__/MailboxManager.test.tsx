// web/src/components/__tests__/MailboxManager.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MailboxManager from '../MailboxManager';
import type { Mailbox } from '../../types';

vi.mock('../../api', () => ({
  api: {
    mailboxes: vi.fn(),
    createMailbox: vi.fn(),
    patchMailbox: vi.fn(),
    deleteMailbox: vi.fn(),
  },
}));

import { api } from '../../api';

function fakeMailbox(over: Partial<Mailbox> = {}): Mailbox {
  return {
    id: 1,
    address: 'alice@example.com',
    domain_id: 0,
    display_name: 'Alice',
    quarantine_ttl_hours: 168,
    screener_sla_hours: 48,
    digest_enabled: 0,
    digest_hour: 9,
    digest_recipient_mode: 'external',
    owner_email: null,
    digest_last_error: null,
    digest_consecutive_failures: 0,
    last_digest_sent_at: null,
    created_at: 0,
    ...over,
  } as Mailbox;
}

describe('MailboxManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.mailboxes).mockResolvedValue([fakeMailbox()]);
    vi.mocked(api.createMailbox).mockResolvedValue({ id: 2 });
    vi.mocked(api.patchMailbox).mockResolvedValue({ ok: true });
    vi.mocked(api.deleteMailbox).mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders existing mailboxes from api.mailboxes()', async () => {
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('creating a mailbox calls api.createMailbox with the form values and onChanged', async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={onChanged} />);
    await screen.findByText('alice@example.com');

    await user.type(screen.getByPlaceholderText(/alice@yourdomain\.co/), 'bob@example.com');
    await user.type(screen.getByPlaceholderText(/display name/), 'Bob');
    const ttlInput = screen.getByLabelText(/New mailbox quarantine TTL in hours/);
    fireEvent.change(ttlInput, { target: { value: '24' } });
    await user.click(screen.getByRole('button', { name: /Create mailbox/ }));

    await waitFor(() =>
      expect(api.createMailbox).toHaveBeenCalledWith({
        address: 'bob@example.com',
        displayName: 'Bob',
        quarantineTtlHours: 24,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('clicking Create with empty address does NOT call api', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByRole('button', { name: /Create mailbox/ }));
    expect(api.createMailbox).not.toHaveBeenCalled();
  });

  it('blurring the screener-SLA input PATCHes screenerSlaHours', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    const slaInput = screen.getByLabelText(/Screener SLA hours/);
    await user.clear(slaInput);
    await user.type(slaInput, '24');
    slaInput.blur();
    await waitFor(() =>
      expect(api.patchMailbox).toHaveBeenCalledWith(1, { screenerSlaHours: 24 }),
    );
  });

  it('blurring the quarantine-TTL input PATCHes quarantineTtlHours', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    const ttlInput = screen.getByLabelText(/Quarantine TTL hours/);
    await user.clear(ttlInput);
    await user.type(ttlInput, '72');
    ttlInput.blur();
    await waitFor(() =>
      expect(api.patchMailbox).toHaveBeenCalledWith(1, { quarantineTtlHours: 72 }),
    );
  });

  it('delete confirms and calls api.deleteMailbox + onChanged', async () => {
    const onChanged = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={onChanged} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle(/Delete mailbox \+ all mail/));
    await waitFor(() => expect(api.deleteMailbox).toHaveBeenCalledWith(1));
    expect(onChanged).toHaveBeenCalled();
  });

  it('delete cancellation does NOT call api', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle(/Delete mailbox \+ all mail/));
    expect(api.deleteMailbox).not.toHaveBeenCalled();
  });

  it('clicking the close button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MailboxManager onClose={onClose} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
