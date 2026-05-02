// web/src/components/__tests__/WelcomeTour.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WelcomeTour from '../WelcomeTour';

vi.mock('../../api', () => ({
  api: {
    tourComplete: vi.fn(),
  },
}));

import { api } from '../../api';

describe('WelcomeTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.tourComplete).mockResolvedValue({ ok: true } as any);
  });

  it('renders step 1/4 on mount', () => {
    render(<WelcomeTour onClose={() => {}} />);
    expect(screen.getByText(/Welcome tour 1\/4/)).toBeInTheDocument();
    expect(screen.getByText(/Daily 30-second triage/)).toBeInTheDocument();
  });

  it('"Next" advances forward and "Back" returns', async () => {
    const user = userEvent.setup();
    render(<WelcomeTour onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText(/Welcome tour 2\/4/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing gets lost/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByText(/Welcome tour 1\/4/)).toBeInTheDocument();
  });

  it('"Skip tour" calls api.tourComplete and onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeTour onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /Skip tour/ }));
    await waitFor(() => expect(api.tourComplete).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('reaching the last step shows "Done", which finishes the tour', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeTour onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 2/4
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 3/4
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 4/4
    expect(screen.getByText(/Welcome tour 4\/4/)).toBeInTheDocument();
    const done = screen.getByRole('button', { name: /^Done$/ });
    await user.click(done);
    await waitFor(() => expect(api.tourComplete).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
