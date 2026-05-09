import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PaperGrain } from '../brand/PaperGrain';

describe('PaperGrain', () => {
  it('renders a fixed pointer-events-none overlay', () => {
    const { container } = render(<PaperGrain />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('fixed');
    expect(div.className).toContain('pointer-events-none');
    expect(div.getAttribute('aria-hidden')).toBe('true');
  });
});
