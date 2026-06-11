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

import { EditorialButton } from '../brand/EditorialButton';

describe('EditorialButton', () => {
  it('renders mono uppercase label and primary border', () => {
    render(<EditorialButton>[ SIGN IN ↗ ]</EditorialButton>);
    const btn = screen.getByRole('button', { name: /SIGN IN/ });
    expect(btn.className).toContain('font-mono');
    expect(btn.className).toContain('uppercase');
    expect(btn.className).toContain('border-ink');
  });
  it('disables and dims when disabled', () => {
    render(<EditorialButton disabled>X</EditorialButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

import { EditorialInput } from '../brand/EditorialInput';

describe('EditorialInput', () => {
  it('renders a label and input bound by id', () => {
    render(<EditorialInput label="EMAIL" />);
    const input = screen.getByLabelText('EMAIL') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });
  it('passes through type and value', () => {
    render(<EditorialInput label="EMAIL" type="email" value="a@b" onChange={() => {}} />);
    const input = screen.getByLabelText('EMAIL') as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.value).toBe('a@b');
  });
});

import { OtpGrid } from '../brand/OtpGrid';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

describe('OtpGrid', () => {
  it('renders 6 single-digit boxes', () => {
    render(<OtpGrid value="" onChange={() => {}} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    inputs.forEach((i) => expect(i.getAttribute('maxlength')).toBe('1'));
  });
  it('auto-advances on type', async () => {
    const onChange = vi.fn();
    render(<OtpGrid value="" onChange={onChange} />);
    const user = userEvent.setup();
    const inputs = screen.getAllByRole('textbox');
    inputs[0].focus();
    await user.keyboard('1');
    expect(onChange).toHaveBeenCalledWith('1');
  });
  it('paste fills all 6 boxes', async () => {
    const onChange = vi.fn();
    render(<OtpGrid value="" onChange={onChange} />);
    const user = userEvent.setup();
    const inputs = screen.getAllByRole('textbox');
    inputs[0].focus();
    await user.paste('123456');
    expect(onChange).toHaveBeenCalledWith('123456');
  });
});
