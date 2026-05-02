// web/src/components/__tests__/Sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../Sidebar';
import type { Counts } from '../../types';

const noop = () => {};

const counts: Counts = {
  screener: { total: 3, unread: 0 },
  inbox: { total: 10, unread: 4 },
  quarantine: { total: 5, unread: 2 },
  sent: { total: 2, unread: 0 },
  drafts: { total: 1, unread: 0 },
  trash: { total: 0, unread: 0 },
} as Counts;

function renderSidebar(over: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <Sidebar
      counts={counts}
      folder="inbox"
      onFolder={over.onFolder ?? noop}
      onCompose={over.onCompose ?? noop}
      onWhitelist={over.onWhitelist ?? noop}
      onInject={over.onInject ?? noop}
      onPurge={over.onPurge ?? noop}
      onDkim={over.onDkim ?? noop}
      onAliases={over.onAliases ?? noop}
      {...over}
    />,
  );
}

describe('Sidebar', () => {
  it('renders all folder entries including Screener', () => {
    renderSidebar();
    for (const label of ['Screener', 'Inbox', 'Quarantine', 'Sent', 'Drafts', 'Trash']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}\\b`) })).toBeInTheDocument();
    }
  });

  it('shows the unread badge when a folder has unread items', () => {
    renderSidebar();
    const inboxBtn = screen.getByRole('button', { name: /Inbox/ });
    expect(inboxBtn).toHaveTextContent('4');
  });

  it('shows total when unread is zero but total > 0', () => {
    renderSidebar();
    const sentBtn = screen.getByRole('button', { name: /Sent/ });
    expect(sentBtn).toHaveTextContent('2');
  });

  it('clicking a folder calls onFolder with that key', async () => {
    const onFolder = vi.fn();
    renderSidebar({ onFolder });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Quarantine\b/ }));
    expect(onFolder).toHaveBeenCalledWith('quarantine');
  });

  it('clicking Compose calls onCompose', async () => {
    const onCompose = vi.fn();
    renderSidebar({ onCompose });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Compose/ }));
    expect(onCompose).toHaveBeenCalled();
  });

  it('Tools buttons each call their respective handler', async () => {
    const onWhitelist = vi.fn();
    const onAliases = vi.fn();
    const onInject = vi.fn();
    const onDkim = vi.fn();
    const onPurge = vi.fn();
    renderSidebar({ onWhitelist, onAliases, onInject, onDkim, onPurge });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Whitelist/ }));
    await user.click(screen.getByRole('button', { name: /Aliases/ }));
    await user.click(screen.getByRole('button', { name: /Test Injector/ }));
    await user.click(screen.getByRole('button', { name: /DKIM \/ DNS/ }));
    await user.click(screen.getByRole('button', { name: /Purge Quarantine/ }));
    expect(onWhitelist).toHaveBeenCalled();
    expect(onAliases).toHaveBeenCalled();
    expect(onInject).toHaveBeenCalled();
    expect(onDkim).toHaveBeenCalled();
    expect(onPurge).toHaveBeenCalled();
  });
});
