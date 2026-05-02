// web/src/components/__tests__/Screener.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Screener from '../Screener';
import type { MessageSummary, ScreenerSender } from '../../types';

vi.mock('../../api', () => ({
  api: {
    screenerList: vi.fn(),
    screenerAllow: vi.fn(),
    screenerReject: vi.fn(),
  },
}));

import { api } from '../../api';

function fakeMessage(over: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id: 'm1',
    mailbox_id: 1,
    folder: 'quarantine',
    from_address: 'sarah@work.dev',
    from_name: 'Sarah Q',
    to_addresses: '["alice@example.com"]',
    subject: 'Hello',
    preview: 'preview text',
    received_at: Date.now(),
    expires_at: null,
    read: 0,
    starred: 0,
    spf_pass: null,
    dkim_pass: null,
    dmarc_pass: null,
    whitelist_match: null,
    size_bytes: 0,
    attachment_count: 0,
    ...over,
  };
}

function senderRow(over: Partial<ScreenerSender> = {}): ScreenerSender {
  const now = Date.now();
  return {
    address: 'sarah@work.dev',
    name: 'Sarah Q',
    message_count: 2,
    latest_subject: 'Hello',
    latest_preview: 'preview text',
    latest_received_at: now,
    first_received_at: now - 60_000,
    messages: [
      fakeMessage({ id: 'm1', received_at: now, read: 0, subject: 'Hello', preview: 'preview text' }),
      fakeMessage({ id: 'm2', received_at: now - 60_000, read: 1, subject: 'Older', preview: 'older preview' }),
    ],
    ...over,
  };
}

describe('Screener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when the screener queue is empty', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([]);
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    expect(await screen.findByText(/No new senders in your Screener queue\./)).toBeInTheDocument();
  });

  it('renders a sender row with name, subject, preview, and message count', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    const nameEl = await screen.findByText('Sarah Q');
    const article = nameEl.closest('article')!;
    expect(within(article).getByText('Hello')).toBeInTheDocument();
    expect(within(article).getByText(/preview text/)).toBeInTheDocument();
    expect(within(article).getByText(/2 messages/)).toBeInTheDocument();
  });

  it('clicking "Yes" calls api.screenerAllow + onChanged and triggers domain-expand suggestion when server says so', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerAllow).mockResolvedValue({
      moved: 2,
      rule_id: 1,
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: true,
    });
    const onChanged = vi.fn();
    const onSuggest = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={onChanged}
        onSuggestDomainExpand={onSuggest}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /Yes/ }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalledWith(1, 'sarah@work.dev'));
    expect(onChanged).toHaveBeenCalled();
    expect(onSuggest).toHaveBeenCalledWith({ mailboxId: 1, domain: 'work.dev' });
  });

  it('does NOT trigger onSuggestDomainExpand when server says suggest_domain_expand=false', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerAllow).mockResolvedValue({
      moved: 1,
      rule_id: 1,
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: false,
    });
    const onSuggest = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={onSuggest}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /Yes/ }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalled());
    expect(onSuggest).not.toHaveBeenCalled();
  });

  it('clicking "No" calls api.screenerReject and onChanged', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerReject).mockResolvedValue({ trashed: 1 });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={onChanged}
        onSuggestDomainExpand={() => {}}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /No/ }));
    await waitFor(() => expect(api.screenerReject).toHaveBeenCalledWith(1, 'sarah@work.dev'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('"Done for now" calls onDoneForNow', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([]);
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={onDone}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Done for now/ }));
    expect(onDone).toHaveBeenCalled();
  });

  it('expands a sender row to show individual messages', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    const senderButton = await screen.findByRole('button', { name: /Sarah Q/ });
    await user.click(senderButton);
    const article = senderButton.closest('article')!;
    expect(within(article).getByText('Older')).toBeInTheDocument();
  });

  it('reloads the screener list when api.screenerAllow rejects', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerAllow).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    await screen.findByText('Sarah Q');
    expect(api.screenerList).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Yes/ }));

    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalled());
    await waitFor(() => expect(api.screenerList).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Sarah Q')).toBeInTheDocument();
  });
});
