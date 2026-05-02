// web/src/components/__tests__/Screener.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Screener from '../Screener';
import type { ScreenerSender } from '../../types';

vi.mock('../../api', () => ({
  api: {
    screenerList: vi.fn(),
    screenerAllow: vi.fn(),
    screenerReject: vi.fn(),
  },
}));

import { api } from '../../api';

function senderRow(over: Partial<ScreenerSender> = {}): ScreenerSender {
  return {
    address: 'sarah@work.dev',
    name: 'Sarah Q',
    message_count: 2,
    latest_subject: 'Hello',
    latest_preview: 'preview text',
    latest_received_at: Date.now(),
    messages: [
      { id: 'm1', received_at: Date.now(), read: 0, subject: 'Hello', preview: 'preview text' },
      { id: 'm2', received_at: Date.now() - 60000, read: 1, subject: 'Older', preview: 'older preview' },
    ],
    ...over,
  } as ScreenerSender;
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
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: true,
    } as any);
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
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: false,
    } as any);
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
    vi.mocked(api.screenerReject).mockResolvedValue({ trashed: 1 } as any);
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
});
