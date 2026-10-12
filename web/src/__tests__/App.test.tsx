// web/src/__tests__/App.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

vi.mock('../api', () => ({
  api: {
    authMe: vi.fn(),
    authLogin: vi.fn(),
    mailboxes: vi.fn(),
    // Read calls the shell makes once a mailbox is active.
    list: vi.fn(() => Promise.resolve([])),
    listDrafts: vi.fn(() => Promise.resolve([])),
    counts: vi.fn(() => Promise.resolve({})),
    search: vi.fn(() => Promise.resolve([])),
  },
  subscribeEvents: vi.fn(() => () => {}),
}));

import { api } from '../api';

describe('App (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.mailboxes).mockResolvedValue([]);
  });

  it('shows the landing page when authMe rejects (unauthenticated)', async () => {
    vi.mocked(api.authMe).mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    expect(
      (await screen.findAllByRole('button', { name: /create .*free account/i }))[0],
    ).toBeInTheDocument();
  });

  it('navigates from the landing page to the LoginForm', async () => {
    vi.mocked(api.authMe).mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    const getStarted = (
      await screen.findAllByRole('button', { name: /create .*free account/i })
    )[0];
    fireEvent.click(getStarted);
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('loads mailboxes after signing in from the login gate, without a refresh', async () => {
    const me = {
      user: { id: 1, email: 'a@x.com', totp_enabled: false, tour_completed_at: 1700000000000 },
    };
    vi.mocked(api.authMe).mockRejectedValueOnce(new Error('unauthorized')).mockResolvedValue(me as any);
    vi.mocked(api.authLogin).mockResolvedValue({ ok: true } as any);
    vi.mocked(api.mailboxes).mockResolvedValue([{ id: 7, address: 'me@zero-spam.email' }] as any);
    render(<App />);
    // Not signed in yet: nothing mailbox-scoped is fetched.
    fireEvent.click((await screen.findAllByRole('button', { name: /create .*free account/i }))[0]);
    expect(api.mailboxes).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('me@local'), { target: { value: 'a@x.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pw-123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    // Mailbox picker appears, so Aliases/Whitelist panels can open.
    expect(await screen.findByLabelText('Active mailbox')).toHaveValue('7');
    expect(api.mailboxes).toHaveBeenCalledTimes(1);
  });

  it('renders the main app shell when authMe resolves (authenticated)', async () => {
    vi.mocked(api.authMe).mockResolvedValue({
      user: {
        id: 1,
        email: 'a@x.com',
        totp_enabled: false,
        tour_completed_at: 1700000000000,
      },
    });
    render(<App />);
    expect(await screen.findByText('ZeroSpam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compose/ })).toBeInTheDocument();
  });
});
