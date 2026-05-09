import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaperGrain } from '../brand/PaperGrain';
import { Wordmark } from '../brand/Wordmark';
import { MonoLabel } from '../brand/MonoLabel';
import { YellowDot } from '../brand/YellowDot';
import { Hairline } from '../brand/Hairline';

describe('PaperGrain', () => {
  it('renders a fixed pointer-events-none overlay', () => {
    const { container } = render(<PaperGrain />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('fixed');
    expect(div.className).toContain('pointer-events-none');
    expect(div.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Wordmark', () => {
  it('renders Zero·Spam in italic display font with a yellow dot', () => {
    render(<Wordmark />);
    expect(screen.getByText(/Zero/)).toBeInTheDocument();
    expect(screen.getByText(/Spam/)).toBeInTheDocument();
    const dot = screen.getByTestId('wordmark-dot');
    expect(dot.className).toContain('text-signal');
  });
});

describe('MonoLabel', () => {
  it('renders uppercase mono text', () => {
    render(<MonoLabel>est mmxxvi</MonoLabel>);
    const el = screen.getByText(/est mmxxvi/i);
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('font-mono');
  });
});

describe('YellowDot', () => {
  it('renders a 6x6 yellow square (typewriter dot)', () => {
    render(<YellowDot />);
    const el = screen.getByTestId('yellow-dot');
    expect(el.className).toContain('bg-signal');
  });
});

describe('Hairline', () => {
  it('renders a 1px rule line', () => {
    const { container } = render(<Hairline />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-rule');
  });
});

import { HardRule } from '../brand/HardRule';

describe('HardRule', () => {
  it('renders a 1px ink line with mono drop-label punching through', () => {
    render(<HardRule label="THE MANUAL" />);
    expect(screen.getByText('THE MANUAL').className).toContain('font-mono');
    expect(screen.getByText('THE MANUAL').className).toContain('bg-paper');
  });
  it('renders a plain rule when no label', () => {
    const { container } = render(<HardRule />);
    expect(container.querySelector('[data-rule]')).not.toBeNull();
  });
});
