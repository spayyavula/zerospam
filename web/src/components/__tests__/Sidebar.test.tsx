import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';
import type { Counts } from '../../types';

const noop = () => {};
const counts: Counts = {
  screener: { total: 2, unread: 0 },
  inbox: { total: 0, unread: 0 },
  quarantine: { total: 0, unread: 0 },
  sent: { total: 0, unread: 0 },
  drafts: { total: 0, unread: 0 },
  trash: { total: 0, unread: 0 },
} as Counts;

const baseProps = {
  counts,
  folder: 'inbox' as const,
  onFolder: vi.fn(),
  onCompose: noop,
  onWhitelist: noop,
  onInject: noop,
  onPurge: noop,
  onDkim: noop,
  onAliases: noop,
};

describe('Sidebar (top nav)', () => {
  it('renders Inbox, Screener, Sent as primary nav', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /screener/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sent/i })).toBeInTheDocument();
  });

  it('calls onFolder when a primary item is clicked', () => {
    const onFolder = vi.fn();
    render(<Sidebar {...baseProps} onFolder={onFolder} />);
    fireEvent.click(screen.getByRole('button', { name: /screener/i }));
    expect(onFolder).toHaveBeenCalledWith('screener');
  });

  it('shows the Screener count badge', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
