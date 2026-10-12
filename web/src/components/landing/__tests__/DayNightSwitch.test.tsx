import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DayNightSwitch from '../DayNightSwitch';

describe('DayNightSwitch', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'light';
  });

  it('switches the whole page between day and night and remembers the choice', () => {
    render(<DayNightSwitch />);
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Night' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('zs-theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Night' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('zs-theme')).toBe('light');
  });

  it('does not save anything until the person chooses, so it keeps following the device', () => {
    document.documentElement.dataset.theme = 'dark'; // set before paint from prefers-color-scheme
    render(<DayNightSwitch />);
    expect(screen.getByRole('radio', { name: 'Night' })).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('zs-theme')).toBeNull();
  });
});
