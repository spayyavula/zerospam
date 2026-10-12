import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Paywall from '../Paywall';
import TrialBanner from '../TrialBanner';
import PlanPicker, { navigate } from '../PlanPicker';
import type { BillingSummary } from '../../../types';

vi.mock('../../../api', () => ({ api: { billingCheckout: vi.fn() } }));
import { api } from '../../../api';

const base: BillingSummary = {
  enabled: true, entitled: true, exempt: false, subscribed: false, status: null, plan: null,
  trialEndsAt: Date.now() + 5 * 86_400_000, trialDaysLeft: 5, currentPeriodEnd: null,
  cancelAtPeriodEnd: false, hasBillingAccount: false,
};

describe('billing UI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('paywall reassures that mail is safe and offers both plans', () => {
    const onSignOut = vi.fn();
    render(<Paywall email="pat@example.com" onSignOut={onSignOut} />);
    expect(screen.getByRole('heading', { name: /free trial has ended/i })).toBeInTheDocument();
    expect(screen.getByText(/still arriving and nothing has been deleted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monthly plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /annual plan/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('choosing a plan opens Stripe Checkout', async () => {
    vi.mocked(api.billingCheckout).mockResolvedValue({ url: 'https://checkout.stripe.test/s/1' });
    const go = vi.spyOn(navigate, 'to').mockImplementation(() => {});
    render(<PlanPicker trialDaysLeft={40} />);
    expect(screen.getByText(/won’t be charged until your free trial ends, in 40 days/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /annual plan/i }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://checkout.stripe.test/s/1'));
    expect(api.billingCheckout).toHaveBeenCalledWith('annual');
  });

  it('shows a checkout error and lets the person retry', async () => {
    vi.mocked(api.billingCheckout).mockRejectedValue(new Error('Stripe is unavailable'));
    render(<PlanPicker trialDaysLeft={null} />);
    fireEvent.click(screen.getByRole('button', { name: /monthly plan/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stripe is unavailable');
    expect(screen.getByRole('button', { name: /monthly plan/i })).not.toBeDisabled();
  });

  it('trial banner appears only in the last two weeks, and never for subscribers or exempt accounts', () => {
    const { rerender } = render(<TrialBanner billing={base} onChoosePlan={() => {}} />);
    expect(screen.getByText('5 days left in your free trial.')).toBeInTheDocument();
    rerender(<TrialBanner billing={{ ...base, trialDaysLeft: 30 }} onChoosePlan={() => {}} />);
    expect(screen.queryByText(/left in your free trial/)).toBeNull();
    rerender(<TrialBanner billing={{ ...base, subscribed: true }} onChoosePlan={() => {}} />);
    expect(screen.queryByText(/free trial/)).toBeNull();
    rerender(<TrialBanner billing={{ ...base, exempt: true }} onChoosePlan={() => {}} />);
    expect(screen.queryByText(/free trial/)).toBeNull();
    rerender(<TrialBanner billing={{ ...base, enabled: false }} onChoosePlan={() => {}} />);
    expect(screen.queryByText(/free trial/)).toBeNull();
  });
});
