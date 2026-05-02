// web/src/components/__tests__/DomainExpandToast.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainExpandToast from '../DomainExpandToast';

vi.mock('../../api', () => ({
  api: {
    screenerAllowDomain: vi.fn(),
  },
}));

import { api } from '../../api';

describe('DomainExpandToast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the domain in the prompt', () => {
    render(
      <DomainExpandToast
        mailboxId={1}
        domain="work.dev"
        onClose={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/Trusted this sender\. Expand to everyone at @work\.dev/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trust everyone @work\.dev/ })).toBeInTheDocument();
  });

  it('clicking "Trust everyone" calls api.screenerAllowDomain and shows confirmation', async () => {
    vi.mocked(api.screenerAllowDomain).mockResolvedValue({ moved: 5, rule_id: 1 });
    const onChanged = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={() => {}} onChanged={onChanged} />,
    );

    await user.click(screen.getByRole('button', { name: /Trust everyone @work\.dev/ }));

    expect(api.screenerAllowDomain).toHaveBeenCalledWith(1, 'work.dev');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Moved 5 messages from @work.dev')).toBeInTheDocument();
  });

  it('"Dismiss" calls onClose without calling the api', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={onClose} onChanged={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.screenerAllowDomain).not.toHaveBeenCalled();
  });

  it('auto-closes after the 5s idle timeout', () => {
    const onClose = vi.fn();
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={onClose} onChanged={() => {}} />,
    );
    vi.advanceTimersByTime(4999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onClose).toHaveBeenCalled();
  });
});
