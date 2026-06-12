import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light (paper) when nothing is set', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('light');
  });
});
