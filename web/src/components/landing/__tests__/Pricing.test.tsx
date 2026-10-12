import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pricing, PRICING, annualSavingsPct } from '../Pricing';

describe('Pricing', () => {
  it('uses the agreed prices and derives the annual saving from them', () => {
    expect(PRICING).toEqual({ trialMonths: 3, monthly: 19.99, annual: 100 });
    // 1 - 100 / (19.99 * 12) = 58.3%
    expect(annualSavingsPct).toBe(58);
  });

  it('shows both plans with their prices, the saving, and the per-month equivalent', () => {
    render(<Pricing onStartTrial={() => {}} />);
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('Save 58%')).toBeInTheDocument();
    expect(screen.getByText(/\$8\.33 a month/)).toBeInTheDocument();
  });

  it('starts the free trial from either plan', () => {
    const onStartTrial = vi.fn();
    render(<Pricing onStartTrial={onStartTrial} />);
    fireEvent.click(screen.getByRole('button', { name: /monthly plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /annual plan/i }));
    expect(onStartTrial).toHaveBeenCalledTimes(2);
  });
});
