import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectionsPanel from '../ConnectionsPanel';

vi.mock('../../api', () => ({
  api: {
    connections: vi.fn(),
    disconnect: vi.fn(),
    gmailConnectUrl: () => '/api/oauth/gmail/start',
    outlookConnectUrl: () => '/api/oauth/outlook/start',
  },
}));
import { api } from '../../api';

describe('ConnectionsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists connections returned by the API', async () => {
    vi.mocked(api.connections).mockResolvedValue([
      { id: 1, provider: 'gmail', email: 'alice@gmail.com', status: 'active', lastPolledAt: null, lastError: null, createdAt: 1 },
    ]);
    render(<ConnectionsPanel />);
    expect(await screen.findByText('alice@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it('shows a Connect Gmail button when empty', async () => {
    vi.mocked(api.connections).mockResolvedValue([]);
    render(<ConnectionsPanel />);
    expect(await screen.findByRole('link', { name: /connect gmail/i })).toBeInTheDocument();
  });

  it('shows a Connect Outlook button when empty', async () => {
    vi.mocked(api.connections).mockResolvedValue([]);
    render(<ConnectionsPanel />);
    expect(await screen.findByRole('link', { name: /connect outlook/i })).toBeInTheDocument();
  });

  it('disconnects a connection after confirm', async () => {
    vi.mocked(api.connections)
      .mockResolvedValueOnce([
        { id: 7, provider: 'gmail', email: 'bob@gmail.com', status: 'active', lastPolledAt: null, lastError: null, createdAt: 1 },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(api.disconnect).mockResolvedValue({ ok: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ConnectionsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /disconnect/i }));
    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(7));
  });
});
