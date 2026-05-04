import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';

type Props = {
  onClose: () => void;
};

type TourStep = {
  target: string;
  title: string;
  copy: string;
};

const STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-screener"]',
    title: 'Daily 30-second triage',
    copy: 'New senders show up here. Yes trusts them, No mutes them for 30 days.',
  },
  {
    target: '[data-tour="sidebar-quarantine"]',
    title: 'Nothing gets lost',
    copy: 'Anything not whitelisted lands here. It auto-expires after TTL, so there is no inbox debt.',
  },
  {
    target: '[data-tour="tool-whitelist"]',
    title: 'You own the guest list',
    copy: 'One row = one rule. Address, domain, or regex.',
  },
  {
    target: '[data-tour="header-help"]',
    title: 'Keyboard shortcuts everywhere',
    copy: 'Press ? anytime. j/k to navigate, e to allow, # to trash.',
  },
];

export default function WelcomeTour({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  const isLast = step === STEPS.length - 1;

  const current = useMemo(() => STEPS[step] ?? STEPS[0], [step]);

  const complete = async () => {
    try {
      await api.tourComplete();
    } finally {
      onClose();
    }
  };

  useLayoutEffect(() => {
    const update = () => {
      const el = document.querySelector(current.target) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [current.target]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void complete();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
      setStep((s) => (s >= STEPS.length - 1 ? s : s + 1));
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    const compact = vw < 760;

    card.style.position = 'fixed';
    card.style.transform = '';
    if (rect && !compact) {
      const cardW = card.offsetWidth || 320;
      const cardH = card.offsetHeight || 220;
      const placeBelow = vh - rect.bottom >= cardH + 20;
      const top = placeBelow
        ? Math.min(vh - cardH - margin, rect.bottom + 14)
        : Math.max(margin, rect.top - cardH - 14);
      const left = Math.min(vw - cardW - margin, Math.max(margin, rect.left));
      const arrowX = Math.min(cardW - 18, Math.max(18, rect.left + rect.width / 2 - left));

      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      card.style.setProperty('--tour-arrow-x', `${arrowX}px`);
      card.dataset.arrow = placeBelow ? 'top' : 'bottom';
    } else {
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      card.dataset.arrow = 'none';
    }
  }, [rect, step]);

  useLayoutEffect(() => {
    const spot = spotlightRef.current;
    if (!spot) return;
    const compact = window.innerWidth < 760;
    if (!rect || compact) {
      spot.style.display = 'none';
      return;
    }
    spot.style.display = 'block';
    spot.style.left = `${rect.left - 6}px`;
    spot.style.top = `${rect.top - 6}px`;
    spot.style.width = `${rect.width + 12}px`;
    spot.style.height = `${rect.height + 12}px`;
  }, [rect, step]);

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div className="absolute inset-0 bg-black/50" />

      <div
        ref={spotlightRef}
        className="absolute rounded-lg ring-2 ring-zsaccent/80 pointer-events-none tour-spotlight"
      />

      <div
        ref={cardRef}
        className="pointer-events-auto w-[min(94vw,320px)] rounded-xl border border-zsborder bg-zspanel p-3.5 sm:p-4 shadow-2xl tour-card"
      >
        <div className="tour-card-arrow" />
        <div className="text-[11px] uppercase tracking-wider text-zsmuted">Welcome tour {step + 1}/{STEPS.length}</div>
        <h3 className="mt-1 text-[15px] sm:text-base font-semibold leading-tight">{current.title}</h3>
        <p className="mt-2 text-[13px] sm:text-sm text-zsmuted leading-relaxed">{current.copy}</p>
        <p className="mt-2 text-[11px] text-zsmuted/80">Tap anywhere outside this card to continue.</p>

        <div className="mt-4 flex items-center gap-2 justify-between flex-wrap">
          <button onClick={() => void complete()} className="text-xs text-zsmuted hover:text-zstext">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="px-2.5 py-1.5 rounded border border-zsborder text-xs hover:bg-zsborder/30"
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-zsaccent text-zsbg hover:opacity-90"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => void complete()}
                className="px-2.5 py-1.5 rounded text-xs font-medium bg-zsaccent text-zsbg hover:opacity-90"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
