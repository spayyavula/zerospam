import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Screener from '../Screener';

vi.mock('../../api', () => ({
  api: {
    screenerList: vi.fn(),
    screenerAllow: vi.fn().mockResolvedValue({}),
    screenerReject: vi.fn().mockResolvedValue({}),
  },
}));

import { api } from '../../api';

const sender = (address: string, subject: string) => ({
  address,
  name: null,
  message_count: 1,
  latest_received_at: Date.now(),
  latest_subject: subject,
  latest_preview: 'preview',
  messages: [],
});

beforeEach(() => vi.clearAllMocks());

describe('Screener (one-at-a-time)', () => {
  it('shows one sender at a time with progress', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    expect(await screen.findByText('a@x.com')).toBeInTheDocument();
    expect(screen.queryByText('b@y.com')).not.toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it('Yes allows the sender and advances to the next', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    await screen.findByText('a@x.com');
    fireEvent.click(screen.getByRole('button', { name: /yes/i }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalledWith(1, 'a@x.com'));
    expect(await screen.findByText('b@y.com')).toBeInTheDocument();
  });

  it('No rejects the sender and advances', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    await screen.findByText('a@x.com');
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    await waitFor(() => expect(api.screenerReject).toHaveBeenCalledWith(1, 'a@x.com'));
    expect(await screen.findByText('b@y.com')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to screen', async () => {
    (api.screenerList as any).mockResolvedValue([]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    expect(await screen.findByText(/all clear/i)).toBeInTheDocument();
  });
});
