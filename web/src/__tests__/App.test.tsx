// web/src/__tests__/App.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

vi.mock('../api', () => ({
  api: {
    authMe: vi.fn(),
    mailboxes: vi.fn(),
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
