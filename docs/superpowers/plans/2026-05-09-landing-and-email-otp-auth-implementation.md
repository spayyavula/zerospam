# Landing Page + Email-OTP Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current SaaS-toned `Landing.tsx` with a Reading Room v2 editorial page, and ship passwordless email-OTP login with invite-gated signup, 30-day trusted-device cookies, and password+TOTP preserved as opt-in additional factors.

**Architecture:** Six phases — brand foundations, backend OTP, backend invites, backend trusted devices, backend password integration, frontend screens. Backend uses Fastify route plugins, `node:sqlite` via `db.prepare`, Zod validation, and `recordAudit` (matching existing patterns in `server/src/routes/auth.ts`). Frontend uses React + Tailwind + Vite, with brand primitives in `web/src/components/brand/` consumed by `Landing.tsx` and the auth screens.

**Tech Stack:** TypeScript, Fastify, node:sqlite, argon2, Zod, vitest, React, Tailwind, lucide-react, Source Serif 4 / Geist / JetBrains Mono.

**Reference:** [Design spec](../specs/2026-05-09-landing-and-email-otp-auth-design.md).

---

## File Structure

### Created
- `web/src/components/brand/PaperGrain.tsx`
- `web/src/components/brand/Wordmark.tsx`
- `web/src/components/brand/MonoLabel.tsx`
- `web/src/components/brand/YellowDot.tsx`
- `web/src/components/brand/Hairline.tsx`
- `web/src/components/brand/HardRule.tsx`
- `web/src/components/brand/EditorialButton.tsx`
- `web/src/components/brand/EditorialInput.tsx`
- `web/src/components/brand/OtpGrid.tsx`
- `web/src/components/brand/index.ts`
- `web/src/components/EmailEntry.tsx`
- `web/src/components/OtpEntry.tsx`
- `web/src/components/PasswordEntry.tsx`
- `web/src/components/TotpEntry.tsx`
- `web/src/components/__tests__/EmailEntry.test.tsx`
- `web/src/components/__tests__/OtpEntry.test.tsx`
- `web/src/components/__tests__/PasswordEntry.test.tsx`
- `web/src/components/__tests__/TotpEntry.test.tsx`
- `web/src/components/__tests__/Landing.test.tsx`
- `web/src/components/__tests__/Signup.test.tsx`
- `web/src/components/__tests__/brand-primitives.test.tsx`
- `server/src/auth/otp.ts`
- `server/src/auth/invite.ts`
- `server/src/auth/trusted-devices.ts`
- `server/src/auth/emails.ts`
- `server/src/cli/invite-create.ts`
- `server/test/auth-otp.test.ts`
- `server/test/auth-invite.test.ts`
- `server/test/auth-trusted-devices.test.ts`
- `server/test/auth-otp-rate-limit.test.ts`

### Modified
- `web/index.html` — Google Fonts links.
- `web/src/styles.css` — Reading Room CSS tokens.
- `web/tailwind.config.js` — extend colors and fonts.
- `web/src/components/Landing.tsx` — full rewrite.
- `web/src/components/Signup.tsx` — full rewrite (invite-gated).
- `web/src/api.ts` — add new auth methods.
- `web/src/App.tsx` — route wiring for new auth screens.
- `server/src/db.ts` — schema migration adding three tables.
- `server/src/routes/auth.ts` — new endpoints + extend existing login/password.
- `package.json` — add `invite:create` script.

### Deleted
- `web/src/components/LoginForm.tsx` — replaced by composition of `EmailEntry` + `OtpEntry` + `PasswordEntry` + `TotpEntry`.

---

## Phase A — Brand Foundations

### Task A1: Reading Room CSS tokens + Google Fonts

**Files:**
- Modify: `web/index.html`
- Modify: `web/src/styles.css`
- Modify: `web/tailwind.config.js`

- [ ] **Step 1: Add Google Fonts to `web/index.html`** — inside `<head>`, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,700;1,8..60,400;1,8..60,500&family=Geist:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Add Reading Room tokens to `web/src/styles.css`** — at the top of the `:root` block, append:

```css
:root {
  /* Reading Room v2 — see docs/brand/zerospam-vibe.md */
  --paper: #FBF8F1;
  --paper-deep: #F5EFE3;
  --ink: #0A0A0A;
  --ink-soft: #2A2A2A;
  --quiet: #6B6863;
  --rule: #E8E1D2;
  --rule-strong: #1F1F1F;
  --signal: #FFD52E;
  --signal-ink: #7A5C00;
  --danger: #B53C2F;
  --font-display: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
  --font-body: 'Geist', 'Helvetica Neue', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```

- [ ] **Step 3: Extend `web/tailwind.config.js`** — under `theme.extend`:

```js
extend: {
  colors: {
    paper: 'var(--paper)',
    'paper-deep': 'var(--paper-deep)',
    ink: 'var(--ink)',
    'ink-soft': 'var(--ink-soft)',
    quiet: 'var(--quiet)',
    rule: 'var(--rule)',
    'rule-strong': 'var(--rule-strong)',
    signal: 'var(--signal)',
    'signal-ink': 'var(--signal-ink)',
    // existing zs* tokens kept intact
  },
  fontFamily: {
    display: ['Source Serif 4', 'Iowan Old Style', 'Georgia', 'serif'],
    body: ['Geist', 'Helvetica Neue', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
  },
}
```

- [ ] **Step 4: Verify build** — `npm run build --workspace=web`. Expected: build succeeds, no Tailwind errors.

- [ ] **Step 5: Commit** —

```bash
git add web/index.html web/src/styles.css web/tailwind.config.js
git commit -m "feat(web): add Reading Room v2 design tokens and fonts"
```

---

### Task A2: PaperGrain overlay

**Files:**
- Create: `web/src/components/brand/PaperGrain.tsx`
- Create: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Write failing test** — append to `brand-primitives.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test, expect FAIL** —

```bash
npm test --workspace=web -- brand-primitives.test.tsx
```

Expected: fail with `Cannot find module '../brand/PaperGrain'`.

- [ ] **Step 3: Create `web/src/components/brand/PaperGrain.tsx`** —

```tsx
const SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter>
    <rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/>
  </svg>`,
)}`;

export function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ backgroundImage: `url("${SVG}")`, opacity: 0.06, mixBlendMode: 'multiply' }}
    />
  );
}
```

- [ ] **Step 4: Re-run test, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/brand/PaperGrain.tsx web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add PaperGrain overlay primitive"
```

---

### Task A3: Wordmark, MonoLabel, YellowDot, Hairline primitives

**Files:**
- Create: `web/src/components/brand/Wordmark.tsx`
- Create: `web/src/components/brand/MonoLabel.tsx`
- Create: `web/src/components/brand/YellowDot.tsx`
- Create: `web/src/components/brand/Hairline.tsx`
- Modify: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Add failing tests** to `brand-primitives.test.tsx`:

```tsx
import { Wordmark } from '../brand/Wordmark';
import { MonoLabel } from '../brand/MonoLabel';
import { YellowDot } from '../brand/YellowDot';
import { Hairline } from '../brand/Hairline';
import { screen } from '@testing-library/react';

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
```

- [ ] **Step 2: Run tests, expect FAIL** (modules missing).

- [ ] **Step 3: Create `Wordmark.tsx`** —

```tsx
type Size = 'sm' | 'md' | 'lg';
const sizeMap: Record<Size, string> = {
  sm: 'text-[20px]',
  md: 'text-[28px]',
  lg: 'text-[38px]',
};
export function Wordmark({ size = 'md' }: { size?: Size }) {
  return (
    <span className={`font-display italic ${sizeMap[size]} text-ink select-none tracking-tight`}>
      Zero<span data-testid="wordmark-dot" className="text-signal not-italic">·</span>Spam
    </span>
  );
}
```

- [ ] **Step 4: Create `MonoLabel.tsx`** —

```tsx
import type { ReactNode } from 'react';
export function MonoLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono uppercase tracking-[0.06em] text-quiet text-[12px] ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Create `YellowDot.tsx`** —

```tsx
export function YellowDot({ className = '' }: { className?: string }) {
  return (
    <span
      data-testid="yellow-dot"
      aria-hidden="true"
      className={`inline-block w-[6px] h-[6px] bg-signal align-middle ${className}`}
      style={{ borderRadius: 1 }}
    />
  );
}
```

- [ ] **Step 6: Create `Hairline.tsx`** —

```tsx
export function Hairline({ className = '' }: { className?: string }) {
  return <div className={`border-t border-rule ${className}`} />;
}
```

- [ ] **Step 7: Re-run tests, expect PASS**.

- [ ] **Step 8: Commit** —

```bash
git add web/src/components/brand/ web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add Wordmark, MonoLabel, YellowDot, Hairline primitives"
```

---

### Task A4: HardRule primitive

**Files:**
- Create: `web/src/components/brand/HardRule.tsx`
- Modify: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Add failing test** —

```tsx
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
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `HardRule.tsx`** —

```tsx
export function HardRule({ label }: { label?: string }) {
  return (
    <div className="relative my-12">
      <div data-rule className="border-t border-rule-strong" />
      {label && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-[7px] bg-paper px-3 font-mono uppercase tracking-[0.1em] text-[11px] text-ink">
          {label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/brand/HardRule.tsx web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add HardRule primitive"
```

---

### Task A5: EditorialButton primitive

**Files:**
- Create: `web/src/components/brand/EditorialButton.tsx`
- Modify: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Add failing test** —

```tsx
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
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `EditorialButton.tsx`** —

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  children: ReactNode;
};

export function EditorialButton({ variant = 'primary', className = '', children, ...rest }: Props) {
  const base =
    'font-mono uppercase tracking-[0.08em] text-[13px] px-5 py-3 transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'border border-ink text-ink hover:bg-signal hover:text-ink'
      : 'text-quiet underline-offset-4 hover:underline';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/brand/EditorialButton.tsx web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add EditorialButton primitive"
```

---

### Task A6: EditorialInput primitive

**Files:**
- Create: `web/src/components/brand/EditorialInput.tsx`
- Modify: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Add failing test** —

```tsx
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
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `EditorialInput.tsx`** —

```tsx
import { useId, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function EditorialInput({ label, className = '', id, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={`space-y-2 ${className}`}>
      <label
        htmlFor={inputId}
        className="block font-mono uppercase tracking-[0.08em] text-[11px] text-quiet"
      >
        {label}
      </label>
      <input
        id={inputId}
        className="w-full bg-transparent text-ink text-[18px] font-body focus:outline-none border-b border-rule-strong focus:border-b-2 pb-2"
        {...rest}
      />
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/brand/EditorialInput.tsx web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add EditorialInput primitive"
```

---

### Task A7: OtpGrid primitive

**Files:**
- Create: `web/src/components/brand/OtpGrid.tsx`
- Modify: `web/src/components/__tests__/brand-primitives.test.tsx`

- [ ] **Step 1: Add failing tests** —

```tsx
import { OtpGrid } from '../brand/OtpGrid';
import userEvent from '@testing-library/user-event';

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
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `OtpGrid.tsx`** —

```tsx
import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function OtpGrid({ value, onChange, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const setAt = (i: number, ch: string) => {
    const arr = digits.slice();
    arr[i] = ch.replace(/\D/, '').slice(0, 1);
    onChange(arr.join('').slice(0, 6));
  };

  const handleChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) {
      setAt(i, '');
      return;
    }
    setAt(i, v.slice(-1));
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 0) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          role="textbox"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={d}
          onChange={handleChange(i)}
          onKeyDown={handleKey(i)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-12 h-14 text-center font-mono text-[28px] text-ink bg-transparent border-b border-rule-strong focus:border-b-2 focus:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS** (all 3 OtpGrid tests).

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/brand/OtpGrid.tsx web/src/components/__tests__/brand-primitives.test.tsx
git commit -m "feat(web): add OtpGrid primitive with paste and auto-advance"
```

---

### Task A8: Brand barrel export

**Files:**
- Create: `web/src/components/brand/index.ts`

- [ ] **Step 1: Create the barrel** —

```ts
export { PaperGrain } from './PaperGrain';
export { Wordmark } from './Wordmark';
export { MonoLabel } from './MonoLabel';
export { YellowDot } from './YellowDot';
export { Hairline } from './Hairline';
export { HardRule } from './HardRule';
export { EditorialButton } from './EditorialButton';
export { EditorialInput } from './EditorialInput';
export { OtpGrid } from './OtpGrid';
```

- [ ] **Step 2: Run all brand tests** —

```bash
npm test --workspace=web -- brand-primitives.test.tsx
```

Expected: all pass.

- [ ] **Step 3: Commit** —

```bash
git add web/src/components/brand/index.ts
git commit -m "feat(web): brand primitives barrel export"
```

---

## Phase B — Backend OTP Infrastructure

### Task B1: Add `otp_codes` table migration

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: Find the schema-init block** in `server/src/db.ts` (the `db.exec(...)` that runs `CREATE TABLE IF NOT EXISTS users (...)` and friends).

- [ ] **Step 2: Append the new table creation** alongside the existing tables:

```sql
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','signup','password_set','sensitive_op')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  signup_payload TEXT
);
CREATE INDEX IF NOT EXISTS idx_otp_email_active ON otp_codes(email, consumed_at);
```

- [ ] **Step 3: Add `otp_codes` to the `setup.ts` truncation list** in `server/test/setup.ts`:

```ts
DELETE FROM otp_codes;
```

(Insert after the existing `DELETE FROM digest_tokens_used;`.)

- [ ] **Step 4: Run schema sanity test** —

```bash
npm test --workspace=server -- db-schema.test.ts
```

Expected: pass. If a snapshot exists for the schema, update it.

- [ ] **Step 5: Commit** —

```bash
git add server/src/db.ts server/test/setup.ts
git commit -m "feat(server): add otp_codes table"
```

---

### Task B2: `server/src/auth/otp.ts` module

**Files:**
- Create: `server/src/auth/otp.ts`
- Create: `server/test/auth-otp.test.ts`

- [ ] **Step 1: Write failing test** at `server/test/auth-otp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { issueCode, verifyCode } from '../src/auth/otp.js';
import { db } from '../src/db.js';

describe('otp.issueCode', () => {
  it('inserts a row, hashes the code, returns plaintext code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    expect(code).toMatch(/^\d{6}$/);
    const row = db.prepare('SELECT * FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.code_hash).not.toBe(code);
    expect(row.purpose).toBe('login');
    expect(row.expires_at).toBeGreaterThan(row.created_at);
  });
  it('invalidates a previous active code for same (email, purpose)', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    const active = db
      .prepare("SELECT COUNT(*) c FROM otp_codes WHERE email=? AND purpose='login' AND consumed_at IS NULL")
      .get('a@b.com') as { c: number };
    expect(active.c).toBe(1);
  });
});

describe('otp.verifyCode', () => {
  it('returns ok and consumes the row on the right code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code });
    expect(r.ok).toBe(true);
    const row = db.prepare('SELECT consumed_at FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.consumed_at).toBeTruthy();
  });
  it('rejects wrong code and increments attempt_count', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('bad-code');
    const row = db.prepare('SELECT attempt_count FROM otp_codes WHERE email=?').get('a@b.com') as any;
    expect(row.attempt_count).toBe(1);
  });
  it('invalidates code after 5 failed attempts', async () => {
    await issueCode({ email: 'a@b.com', purpose: 'login' });
    for (let i = 0; i < 5; i++) await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code: '000000' });
    expect(r.reason).toBe('exhausted');
  });
  it('rejects expired code', async () => {
    const { code } = await issueCode({ email: 'a@b.com', purpose: 'login' });
    db.prepare('UPDATE otp_codes SET expires_at=? WHERE email=?').run(Date.now() - 1, 'a@b.com');
    const r = await verifyCode({ email: 'a@b.com', purpose: 'login', code });
    expect(r.reason).toBe('expired');
  });
  it('rejects unknown email', async () => {
    const r = await verifyCode({ email: 'nobody@x.com', purpose: 'login', code: '111111' });
    expect(r.reason).toBe('not-found');
  });
});
```

- [ ] **Step 2: Run, expect FAIL** —

```bash
npm test --workspace=server -- auth-otp.test.ts
```

- [ ] **Step 3: Create `server/src/auth/otp.ts`** —

```ts
import argon2 from 'argon2';
import { db } from '../db.js';

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const PURPOSES = ['login', 'signup', 'password_set', 'sensitive_op'] as const;
export type OtpPurpose = (typeof PURPOSES)[number];

function generate6(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, '0');
}

export async function issueCode(opts: {
  email: string;
  purpose: OtpPurpose;
  signupPayload?: unknown;
}): Promise<{ code: string; expiresAt: number }> {
  const code = generate6();
  const codeHash = await argon2.hash(code);
  const now = Date.now();
  const expiresAt = now + TTL_MS;
  db.prepare(
    `UPDATE otp_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
  ).run(now, opts.email.toLowerCase(), opts.purpose);
  db.prepare(
    `INSERT INTO otp_codes (email, code_hash, purpose, created_at, expires_at, signup_payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    opts.email.toLowerCase(),
    codeHash,
    opts.purpose,
    now,
    expiresAt,
    opts.signupPayload ? JSON.stringify(opts.signupPayload) : null,
  );
  return { code, expiresAt };
}

type VerifyResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: 'not-found' | 'expired' | 'bad-code' | 'exhausted' };

export async function verifyCode(opts: {
  email: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyResult> {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(opts.email.toLowerCase(), opts.purpose) as
    | { id: number; code_hash: string; expires_at: number; attempt_count: number; signup_payload: string | null }
    | undefined;
  if (!row) return { ok: false, reason: 'not-found' };
  if (row.expires_at < Date.now()) {
    db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
    return { ok: false, reason: 'expired' };
  }
  if (row.attempt_count >= MAX_ATTEMPTS) {
    db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
    return { ok: false, reason: 'exhausted' };
  }
  const ok = await argon2.verify(row.code_hash, opts.code);
  if (!ok) {
    db.prepare('UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id=?').run(row.id);
    const next = row.attempt_count + 1;
    if (next >= MAX_ATTEMPTS) {
      db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
      return { ok: false, reason: 'exhausted' };
    }
    return { ok: false, reason: 'bad-code' };
  }
  db.prepare('UPDATE otp_codes SET consumed_at=? WHERE id=?').run(Date.now(), row.id);
  return { ok: true, payload: row.signup_payload ? JSON.parse(row.signup_payload) : null };
}
```

- [ ] **Step 4: Re-run tests, expect PASS** (all 7).

- [ ] **Step 5: Commit** —

```bash
git add server/src/auth/otp.ts server/test/auth-otp.test.ts
git commit -m "feat(server): add OTP issue/verify module"
```

---

### Task B3: OTP email templates

**Files:**
- Create: `server/src/auth/emails.ts`

- [ ] **Step 1: Create `server/src/auth/emails.ts`** —

```ts
import { sendMessage } from '../sender.js';
import { getOrCreateSystemMailboxId } from '../system-mailbox.js';
import type { OtpPurpose } from './otp.js';

const SUBJECTS: Record<OtpPurpose, string> = {
  login: 'Your ZeroSpam sign-in code',
  signup: 'Claim your ZeroSpam inbox',
  password_set: 'Confirm your ZeroSpam password change',
  sensitive_op: 'Confirm your ZeroSpam request',
};

function bodyText(code: string, purpose: OtpPurpose): string {
  const head = purpose === 'signup' ? 'Welcome to ZeroSpam.' : 'Welcome back.';
  return [
    head,
    '',
    'Your six-digit code:',
    '',
    `   ${code}`,
    '',
    'It expires in 10 minutes.',
    '// you can always say no.',
    '',
    'If you did not request this, ignore this message.',
    '',
    '— Zero·Spam',
  ].join('\n');
}

export async function sendOtpEmail(opts: { to: string; code: string; purpose: OtpPurpose }): Promise<void> {
  const mailboxId = getOrCreateSystemMailboxId();
  await sendMessage({
    mailboxId,
    to: [opts.to],
    subject: SUBJECTS[opts.purpose],
    text: bodyText(opts.code, opts.purpose),
  });
}
```

- [ ] **Step 2: Confirm it compiles** —

```bash
npm run build --workspace=server
```

Expected: build succeeds.

- [ ] **Step 3: Commit** —

```bash
git add server/src/auth/emails.ts
git commit -m "feat(server): add OTP email templates"
```

---

### Task B4: `POST /api/auth/otp/request` endpoint

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Write failing test** — append to `server/test/auth-otp.test.ts`:

```ts
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import * as sender from '../src/sender.js';
import { vi, beforeEach, afterEach } from 'vitest';
import { seedOwner } from './fixtures/owner.js';
import { seedMailbox } from './helpers.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/otp/request', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    seedMailbox('system@zero-spam.email');
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'm', envelopeFrom: 'noreply@zero-spam.email', recipients: [], signed: true, whitelistAdded: 0,
    });
  });
  afterEach(() => sendSpy.mockRestore());

  it('returns 200 + sends email for known user', async () => {
    const { email } = await seedOwner();
    const app = await buildApp();
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { email } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ next_step: 'otp' });
    expect(sendSpy).toHaveBeenCalledOnce();
  });
  it('returns identical 200 + does NOT send email for unknown user', async () => {
    const app = await buildApp();
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { email: 'nobody@x.com' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ next_step: 'otp' });
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (route 404).

- [ ] **Step 3: Add the route** to `server/src/routes/auth.ts`. Inside `authRoutes`, after the `app.post('/api/auth/login', ...)` block, add:

```ts
import { issueCode } from '../auth/otp.js';
import { sendOtpEmail } from '../auth/emails.js';

const otpRequestSchema = z.object({ email: z.string().min(3).regex(/.+@.+/) });

app.post('/api/auth/otp/request', {
  config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
}, async (req, reply) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    reply.code(400).send({ error: 'invalid-body' });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
  const ua = (req.headers['user-agent'] as string | undefined) ?? null;
  const user = getOwnerByEmail(email);
  if (user) {
    const { code } = await issueCode({ email, purpose: 'login' });
    try {
      await sendOtpEmail({ to: email, code, purpose: 'login' });
      recordAudit({ event: 'otp.request', userId: user.id, detail: { purpose: 'login' }, ip, userAgent: ua });
    } catch (e) {
      recordAudit({ event: 'otp.request.fail', userId: user.id, detail: { reason: 'email-failed' }, ip, userAgent: ua });
      reply.code(503).send({ error: 'email_failed', retry_after: 30 });
      return;
    }
  } else {
    recordAudit({ event: 'otp.request.unknown', detail: { email }, ip, userAgent: ua });
  }
  // Constant-padded timing — 200ms minimum to prevent enumeration
  await new Promise((r) => setTimeout(r, 200));
  reply.code(200).send({ next_step: 'otp' });
});
```

(The `'password' next_step` branch is added in Task D5.)

- [ ] **Step 4: Re-run tests, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-otp.test.ts
git commit -m "feat(server): add POST /api/auth/otp/request"
```

---

### Task B5: `POST /api/auth/otp/verify` endpoint (login purpose)

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-otp.test.ts`

- [ ] **Step 1: Write failing test** — append to `auth-otp.test.ts`:

```ts
describe('POST /api/auth/otp/verify (login)', () => {
  it('verifies the code and issues a session cookie', async () => {
    const { email } = await seedOwner();
    const { code } = await issueCode({ email, purpose: 'login' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { email, purpose: 'login', code },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(r.headers['set-cookie']).toBeTruthy();
  });
  it('returns 401 on bad code', async () => {
    const { email } = await seedOwner();
    await issueCode({ email, purpose: 'login' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/otp/verify',
      payload: { email, purpose: 'login', code: '000000' },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toBe('invalid-code');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Add the route** to `server/src/routes/auth.ts`:

```ts
import { verifyCode } from '../auth/otp.js';

const otpVerifySchema = z.object({
  email: z.string().min(3).regex(/.+@.+/),
  purpose: z.enum(['login', 'signup', 'password_set', 'sensitive_op']),
  code: z.string().regex(/^\d{6}$/),
  trust_device: z.boolean().optional(),
});

app.post('/api/auth/otp/verify', async (req, reply) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    reply.code(400).send({ error: 'invalid-body' });
    return;
  }
  const { email, purpose, code } = parsed.data;
  const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
  const ua = (req.headers['user-agent'] as string | undefined) ?? null;
  const r = await verifyCode({ email: email.toLowerCase(), purpose, code });
  if (!r.ok) {
    recordAudit({ event: 'otp.verify.fail', detail: { reason: r.reason, email }, ip, userAgent: ua });
    reply.code(401).send({ error: 'invalid-code', reason: r.reason });
    return;
  }
  if (purpose === 'login') {
    const user = getOwnerByEmail(email);
    if (!user) {
      reply.code(401).send({ error: 'invalid-code' });
      return;
    }
    const { cookieValue } = createSession(user.id, config.sessionSecret);
    reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/',
    });
    recordAudit({ event: 'otp.verify.ok', userId: user.id, detail: { purpose }, ip, userAgent: ua });
    reply.code(200).send({ ok: true });
    return;
  }
  // signup, password_set, sensitive_op handled in later tasks (C4, E1)
  reply.code(200).send({ ok: true, payload: r.payload });
});
```

(Add `import { createSession, SESSION_COOKIE_NAME } from '../sessions.js';` if not already present — it is, per file head.)

- [ ] **Step 4: Re-run tests, expect PASS** (both verify tests).

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-otp.test.ts
git commit -m "feat(server): add POST /api/auth/otp/verify (login)"
```

---

### Task B6: OTP rate-limit test

**Files:**
- Create: `server/test/auth-otp-rate-limit.test.ts`

- [ ] **Step 1: Write the test** —

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner } from './fixtures/owner.js';
import { seedMailbox } from './helpers.js';
import * as sender from '../src/sender.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(authRoutes);
  return app;
}

describe('rate limits', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    seedMailbox('system@zero-spam.email');
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'm', envelopeFrom: '', recipients: [], signed: true, whitelistAdded: 0,
    });
  });
  afterEach(() => sendSpy.mockRestore());

  it('blocks the 6th OTP request in the same window', async () => {
    const { email } = await seedOwner();
    const app = await buildApp();
    let last;
    for (let i = 0; i < 6; i++) {
      last = await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { email } });
    }
    expect(last!.statusCode).toBe(429);
  });
});
```

- [ ] **Step 2: Run, expect PASS** —

```bash
npm test --workspace=server -- auth-otp-rate-limit.test.ts
```

(If the global Fastify app already registers `@fastify/rate-limit` per `server/src/index.ts`, the route-level `rateLimit` config will fire. If the test app needs registration, the snippet above does it.)

- [ ] **Step 3: Commit** —

```bash
git add server/test/auth-otp-rate-limit.test.ts
git commit -m "test(server): OTP request rate limit"
```

---

## Phase C — Backend Invites

### Task C1: Add `invite_codes` table migration

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`

- [ ] **Step 1: Append to `db.ts` schema-init block** —

```sql
CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
```

- [ ] **Step 2: Add `DELETE FROM invite_codes;`** to the `setup.ts` truncation block.

- [ ] **Step 3: Run schema test** —

```bash
npm test --workspace=server -- db-schema.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit** —

```bash
git add server/src/db.ts server/test/setup.ts
git commit -m "feat(server): add invite_codes table"
```

---

### Task C2: `server/src/auth/invite.ts` module

**Files:**
- Create: `server/src/auth/invite.ts`
- Create: `server/test/auth-invite.test.ts`

- [ ] **Step 1: Write failing tests** at `server/test/auth-invite.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateInvite, redeemInvite } from '../src/auth/invite.js';
import { db } from '../src/db.js';

describe('invite.generateInvite', () => {
  it('creates a 12-char unambiguous code and stores it', () => {
    const { code } = generateInvite({});
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    const row = db.prepare('SELECT * FROM invite_codes WHERE code=?').get(code) as any;
    expect(row).toBeTruthy();
    expect(row.max_uses).toBe(1);
    expect(row.used_count).toBe(0);
  });
});

describe('invite.redeemInvite', () => {
  it('increments used_count and returns ok for valid code', () => {
    const { code } = generateInvite({});
    const r = redeemInvite(code);
    expect(r.ok).toBe(true);
    const row = db.prepare('SELECT used_count FROM invite_codes WHERE code=?').get(code) as any;
    expect(row.used_count).toBe(1);
  });
  it('rejects already-used single-use invite', () => {
    const { code } = generateInvite({});
    redeemInvite(code);
    const r = redeemInvite(code);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('used');
  });
  it('rejects expired invite', () => {
    const { code } = generateInvite({ expiresAt: Date.now() - 1 });
    const r = redeemInvite(code);
    expect(r.reason).toBe('expired');
  });
  it('rejects unknown invite', () => {
    expect(redeemInvite('UNKNOWN12345').reason).toBe('not-found');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `server/src/auth/invite.ts`** —

```ts
import { db } from '../db.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

function gen(): string {
  let s = '';
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 12; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function generateInvite(opts: {
  maxUses?: number;
  expiresAt?: number | null;
  note?: string;
  createdBy?: number;
}): { code: string } {
  // Retry on UNIQUE collision (extremely unlikely with 32^12)
  for (let i = 0; i < 5; i++) {
    const code = gen();
    try {
      db.prepare(
        `INSERT INTO invite_codes (code, created_by, created_at, expires_at, max_uses, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(code, opts.createdBy ?? null, Date.now(), opts.expiresAt ?? null, opts.maxUses ?? 1, opts.note ?? null);
      return { code };
    } catch (e: any) {
      if (!String(e?.message ?? '').includes('UNIQUE')) throw e;
    }
  }
  throw new Error('invite-gen-collision');
}

type RedeemResult =
  | { ok: true; inviteId: number }
  | { ok: false; reason: 'not-found' | 'expired' | 'used' };

export function redeemInvite(code: string): RedeemResult {
  // Atomic: only the row whose used_count < max_uses gets incremented.
  const txn = db.transaction((c: string): RedeemResult => {
    const row = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(c) as
      | { id: number; expires_at: number | null; max_uses: number; used_count: number }
      | undefined;
    if (!row) return { ok: false, reason: 'not-found' };
    if (row.expires_at && row.expires_at < Date.now()) return { ok: false, reason: 'expired' };
    if (row.used_count >= row.max_uses) return { ok: false, reason: 'used' };
    db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?').run(row.id);
    return { ok: true, inviteId: row.id };
  });
  return txn(code);
}
```

- [ ] **Step 4: Re-run, expect PASS** (all 5 tests).

- [ ] **Step 5: Commit** —

```bash
git add server/src/auth/invite.ts server/test/auth-invite.test.ts
git commit -m "feat(server): add invite generate/redeem module"
```

---

### Task C3: `POST /api/auth/invite/redeem` endpoint

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-invite.test.ts`

- [ ] **Step 1: Write failing test** — append to `auth-invite.test.ts`:

```ts
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import * as sender from '../src/sender.js';
import { vi, beforeEach, afterEach } from 'vitest';
import { seedMailbox } from './helpers.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('POST /api/auth/invite/redeem', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    seedMailbox('system@zero-spam.email');
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'm', envelopeFrom: '', recipients: [], signed: true, whitelistAdded: 0,
    });
  });
  afterEach(() => sendSpy.mockRestore());

  it('redeems a valid invite and emails an OTP with signup payload', async () => {
    const { code } = generateInvite({});
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/invite/redeem',
      payload: { invite: code, username: 'alice', email: 'alice@test.com' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ next_step: 'otp' });
    expect(sendSpy).toHaveBeenCalledOnce();
    const otpRow = db.prepare("SELECT * FROM otp_codes WHERE email=? AND purpose='signup'").get('alice@test.com') as any;
    expect(otpRow.signup_payload).toContain('alice');
  });
  it('rejects invalid invite', async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/invite/redeem',
      payload: { invite: 'XXXXXXXXXXXX', username: 'alice', email: 'alice@test.com' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('invalid-invite');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Add the route** to `server/src/routes/auth.ts`:

```ts
import { redeemInvite } from '../auth/invite.js';

const inviteRedeemSchema = z.object({
  invite: z.string().min(8).max(20),
  username: z.string().regex(/^[a-z0-9._-]+$/).min(3).max(32),
  email: z.string().min(3).regex(/.+@.+/),
  name: z.string().max(80).optional(),
});

app.post('/api/auth/invite/redeem', {
  config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
}, async (req, reply) => {
  const parsed = inviteRedeemSchema.safeParse(req.body);
  if (!parsed.success) {
    reply.code(400).send({ error: 'invalid-body' });
    return;
  }
  const { invite, username, email, name } = parsed.data;
  const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
  const ua = (req.headers['user-agent'] as string | undefined) ?? null;

  // Username uniqueness check (live preview; finalized at OTP-verify)
  const taken = db.prepare(
    `SELECT 1 FROM mailboxes WHERE address = ? UNION
     SELECT 1 FROM otp_codes WHERE purpose='signup' AND consumed_at IS NULL AND signup_payload LIKE ?`,
  ).get(`${username}@${config.signupDomain}`, `%"username":"${username}"%`);
  if (taken) {
    reply.code(409).send({ error: 'username-taken' });
    return;
  }

  const r = redeemInvite(invite);
  if (!r.ok) {
    recordAudit({ event: 'invite.redeem.fail', detail: { reason: r.reason }, ip, userAgent: ua });
    reply.code(400).send({ error: 'invalid-invite', reason: r.reason });
    return;
  }
  const { code } = await issueCode({
    email: email.toLowerCase(),
    purpose: 'signup',
    signupPayload: { username, email: email.toLowerCase(), name: name ?? null, inviteId: r.inviteId },
  });
  await sendOtpEmail({ to: email, code, purpose: 'signup' });
  recordAudit({ event: 'invite.redeem.ok', detail: { username, email, inviteId: r.inviteId }, ip, userAgent: ua });
  reply.code(200).send({ next_step: 'otp' });
});
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-invite.test.ts
git commit -m "feat(server): add POST /api/auth/invite/redeem"
```

---

### Task C4: Extend OTP verify with `signup` purpose

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-invite.test.ts`

- [ ] **Step 1: Write failing test** — append to `auth-invite.test.ts`:

```ts
import { issueCode, verifyCode } from '../src/auth/otp.js';

describe('POST /api/auth/otp/verify (signup)', () => {
  it('creates user + mailbox + sets session on signup verify', async () => {
    const { code: invite } = generateInvite({});
    const { code } = await issueCode({
      email: 'alice@test.com',
      purpose: 'signup',
      signupPayload: { username: 'alice', email: 'alice@test.com', name: null, inviteId: 1 },
    });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/otp/verify',
      payload: { email: 'alice@test.com', purpose: 'signup', code },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get('alice@test.com') as any;
    expect(user).toBeTruthy();
    const mb = db.prepare('SELECT * FROM mailboxes WHERE address=?').get('alice@zero-spam.email') as any;
    expect(mb).toBeTruthy();
    expect(r.headers['set-cookie']).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Extend the verify route's `purpose === 'signup'` branch** in `server/src/routes/auth.ts`:

```ts
if (purpose === 'signup') {
  const payload = r.payload as { username: string; email: string; name: string | null; inviteId: number } | null;
  if (!payload) {
    reply.code(400).send({ error: 'invalid-payload' });
    return;
  }
  // Atomic: create user + mailbox + finalize. (No need to bump invite — that happened at redeem.)
  const finalize = db.transaction(() => {
    const userId = db.prepare(
      `INSERT INTO users (email, password_hash, created_at, account_id, email_verified_at)
       VALUES (?, '', ?, 1, ?) RETURNING id`,
    ).get(payload.email, Date.now(), Date.now()) as { id: number };
    const domainId = db.prepare(`SELECT id FROM domains WHERE name = ?`).get(config.signupDomain) as { id: number } | undefined;
    if (!domainId) throw new Error('signup-domain-missing');
    db.prepare(
      `INSERT INTO mailboxes (address, domain_id, display_name, quarantine_ttl_hours, created_at,
                              digest_enabled, digest_hour, digest_recipient_mode, owner_email)
       VALUES (?, ?, ?, 168, ?, 0, 8, 'external', ?)`,
    ).run(`${payload.username}@${config.signupDomain}`, domainId.id, payload.name, Date.now(), payload.email);
    return userId.id;
  });
  const userId = finalize();
  const { cookieValue } = createSession(userId, config.sessionSecret);
  reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/',
  });
  recordAudit({ event: 'otp.verify.ok', userId, detail: { purpose: 'signup' }, ip, userAgent: ua });
  reply.code(200).send({ ok: true });
  return;
}
```

(Replaces the placeholder branch added in Task B5.)

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-invite.test.ts
git commit -m "feat(server): finalize signup on OTP verify"
```

---

### Task C5: `npm run invite:create` CLI

**Files:**
- Create: `server/src/cli/invite-create.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `server/src/cli/invite-create.ts`** —

```ts
#!/usr/bin/env tsx
import { generateInvite } from '../auth/invite.js';
import { config } from '../config.js';

function parseArgs(): { maxUses: number; expiresAt: number | null; note: string | null } {
  const args = process.argv.slice(2);
  let maxUses = 1;
  let expiresAt: number | null = null;
  let note: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--max-uses') maxUses = Number(args[++i]);
    else if (a === '--expires-in') {
      const m = /^(\d+)([dhm])$/.exec(args[++i]);
      if (!m) throw new Error('expires-in must look like 30d, 12h, or 60m');
      const n = Number(m[1]);
      const unit = m[2];
      const ms = unit === 'd' ? n * 86400_000 : unit === 'h' ? n * 3600_000 : n * 60_000;
      expiresAt = Date.now() + ms;
    } else if (a === '--note') note = args[++i];
  }
  return { maxUses, expiresAt, note };
}

const opts = parseArgs();
const { code } = generateInvite(opts);
const url = `${config.publicBaseUrl}/signup?invite=${code}`;
console.log(`code: ${code}`);
console.log(`url:  ${url}`);
```

- [ ] **Step 2: Add script to root `package.json`** —

```json
{
  "scripts": {
    "invite:create": "tsx server/src/cli/invite-create.ts"
  }
}
```

(Insert under existing `"inject"` line.)

- [ ] **Step 3: Smoke run** —

```bash
npm run invite:create -- --max-uses 1 --expires-in 30d --note "test"
```

Expected: prints `code: ...` and `url: http://localhost:8025/signup?invite=...`.

- [ ] **Step 4: Commit** —

```bash
git add server/src/cli/invite-create.ts package.json
git commit -m "feat(server): add invite:create CLI"
```

---

## Phase D — Backend Trusted Devices

### Task D1: Add `trusted_devices` table migration

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/test/setup.ts`

- [ ] **Step 1: Append to db.ts schema-init block** —

```sql
CREATE TABLE IF NOT EXISTS trusted_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  ua TEXT,
  ip_first TEXT,
  ip_last TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_trusted_user_active ON trusted_devices(user_id, revoked_at);
```

- [ ] **Step 2: Add `DELETE FROM trusted_devices;`** to `setup.ts`.

- [ ] **Step 3: Run schema test, expect PASS**.

- [ ] **Step 4: Commit** —

```bash
git add server/src/db.ts server/test/setup.ts
git commit -m "feat(server): add trusted_devices table"
```

---

### Task D2: `server/src/auth/trusted-devices.ts` module

**Files:**
- Create: `server/src/auth/trusted-devices.ts`
- Create: `server/test/auth-trusted-devices.test.ts`

- [ ] **Step 1: Write failing tests** at `server/test/auth-trusted-devices.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { issueTrustCookie, validateTrustCookie, revokeAllForUser } from '../src/auth/trusted-devices.js';
import { config } from '../src/config.js';
import { seedOwner } from './fixtures/owner.js';
import { db } from '../src/db.js';

describe('trusted devices', () => {
  it('issueTrustCookie returns a signed cookie and creates a row', async () => {
    const { userId } = await seedOwner();
    const { cookieValue } = issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    expect(cookieValue).toContain('|');
    const rows = db.prepare('SELECT * FROM trusted_devices WHERE user_id=?').all(userId);
    expect(rows.length).toBe(1);
  });
  it('validateTrustCookie accepts a fresh cookie and bumps last_seen_at', async () => {
    const { userId } = await seedOwner();
    const { cookieValue } = issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    const v = validateTrustCookie(cookieValue, '5.6.7.8');
    expect(v.ok).toBe(true);
    expect(v.userId).toBe(userId);
  });
  it('rejects revoked cookie', async () => {
    const { userId } = await seedOwner();
    const { cookieValue } = issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    revokeAllForUser(userId);
    expect(validateTrustCookie(cookieValue, '1.2.3.4').ok).toBe(false);
  });
  it('rejects tampered cookie', async () => {
    const { userId } = await seedOwner();
    const { cookieValue } = issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    expect(validateTrustCookie(cookieValue.replace(/.$/, 'x'), '1.2.3.4').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `server/src/auth/trusted-devices.ts`** —

```ts
import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');
}

export function issueTrustCookie(opts: {
  userId: number;
  ua: string | null;
  ip: string | null;
}): { cookieValue: string; deviceId: string } {
  const deviceId = crypto.randomBytes(16).toString('hex');
  const exp = Date.now() + TTL_MS;
  const now = Date.now();
  db.prepare(
    `INSERT INTO trusted_devices (user_id, device_id, ua, ip_first, ip_last, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(opts.userId, deviceId, opts.ua, opts.ip, opts.ip, now, now);
  const payload = `${deviceId}.${opts.userId}.${exp}`;
  return { cookieValue: `${payload}|${sign(payload)}`, deviceId };
}

type ValidateResult = { ok: false } | { ok: true; userId: number; deviceId: string };

export function validateTrustCookie(cookieValue: string | undefined, ip: string | null): ValidateResult {
  if (!cookieValue) return { ok: false };
  const [payload, mac] = cookieValue.split('|');
  if (!payload || !mac) return { ok: false };
  if (sign(payload) !== mac) return { ok: false };
  const [deviceId, userIdStr, expStr] = payload.split('.');
  const userId = Number(userIdStr);
  const exp = Number(expStr);
  if (!Number.isFinite(userId) || !Number.isFinite(exp)) return { ok: false };
  if (exp < Date.now()) return { ok: false };
  const row = db.prepare(
    `SELECT id FROM trusted_devices WHERE device_id=? AND user_id=? AND revoked_at IS NULL`,
  ).get(deviceId, userId) as { id: number } | undefined;
  if (!row) return { ok: false };
  db.prepare(`UPDATE trusted_devices SET last_seen_at=?, ip_last=? WHERE id=?`).run(Date.now(), ip, row.id);
  return { ok: true, userId, deviceId };
}

export function revokeAllForUser(userId: number): void {
  db.prepare(`UPDATE trusted_devices SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).run(Date.now(), userId);
}

export function listForUser(userId: number) {
  return db.prepare(
    `SELECT id, device_id, ua, ip_last, created_at, last_seen_at FROM trusted_devices
     WHERE user_id=? AND revoked_at IS NULL ORDER BY last_seen_at DESC`,
  ).all(userId);
}

export function revokeOne(userId: number, id: number): boolean {
  const r = db.prepare(
    `UPDATE trusted_devices SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL`,
  ).run(Date.now(), id, userId);
  return r.changes > 0;
}

export const TRUST_COOKIE_NAME = 'zs_trust';
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/auth/trusted-devices.ts server/test/auth-trusted-devices.test.ts
git commit -m "feat(server): add trusted-device cookie module"
```

---

### Task D3: GET/DELETE `/api/auth/devices` endpoints

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-trusted-devices.test.ts`

- [ ] **Step 1: Write failing tests** — append:

```ts
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { makeSessionCookie } from './fixtures/owner.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('GET /api/auth/devices', () => {
  it('lists active devices for the calling user', async () => {
    const { userId } = await seedOwner();
    issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'GET', url: '/api/auth/devices',
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().devices.length).toBe(1);
  });
});

describe('DELETE /api/auth/devices/:id', () => {
  it('revokes a device', async () => {
    const { userId } = await seedOwner();
    issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    const row = db.prepare('SELECT id FROM trusted_devices WHERE user_id=?').get(userId) as any;
    const app = await buildApp();
    const r = await app.inject({
      method: 'DELETE', url: `/api/auth/devices/${row.id}`,
      headers: { cookie: makeSessionCookie(userId) },
    });
    expect(r.statusCode).toBe(200);
    const after = db.prepare('SELECT revoked_at FROM trusted_devices WHERE id=?').get(row.id) as any;
    expect(after.revoked_at).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Add the routes** to `server/src/routes/auth.ts`:

```ts
import { listForUser, revokeOne } from '../auth/trusted-devices.js';

app.get('/api/auth/devices', { preHandler: requireAuth }, async (req, reply) => {
  const userId = (req as any).userId as number;
  reply.send({ devices: listForUser(userId) });
});

app.delete<{ Params: { id: string } }>('/api/auth/devices/:id', {
  preHandler: requireAuth,
}, async (req, reply) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    reply.code(400).send({ error: 'invalid-id' });
    return;
  }
  const ok = revokeOne(userId, id);
  reply.code(ok ? 200 : 404).send({ ok });
});
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-trusted-devices.test.ts
git commit -m "feat(server): add /api/auth/devices endpoints"
```

---

### Task D4: Wire trust-cookie issuance into OTP verify

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-trusted-devices.test.ts`

- [ ] **Step 1: Write failing test** — append:

```ts
import { TRUST_COOKIE_NAME } from '../src/auth/trusted-devices.js';
import { issueCode } from '../src/auth/otp.js';

describe('OTP verify issues trust cookie when trust_device=true', () => {
  it('sets the trust cookie and records the device', async () => {
    const { email, userId } = await seedOwner();
    const { code } = await issueCode({ email, purpose: 'login' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/otp/verify',
      payload: { email, purpose: 'login', code, trust_device: true },
    });
    expect(r.statusCode).toBe(200);
    const cookies = ([] as string[]).concat(r.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith(`${TRUST_COOKIE_NAME}=`))).toBe(true);
    const rows = db.prepare('SELECT * FROM trusted_devices WHERE user_id=?').all(userId);
    expect(rows.length).toBe(1);
  });
  it('does NOT set trust cookie when trust_device=false', async () => {
    const { email } = await seedOwner();
    const { code } = await issueCode({ email, purpose: 'login' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/otp/verify',
      payload: { email, purpose: 'login', code, trust_device: false },
    });
    const cookies = ([] as string[]).concat(r.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith(`${TRUST_COOKIE_NAME}=`))).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Extend the verify route's `purpose === 'login'` branch** to issue a trust cookie when `trust_device: true`. Replace the existing block with:

```ts
if (purpose === 'login') {
  const user = getOwnerByEmail(email);
  if (!user) {
    reply.code(401).send({ error: 'invalid-code' });
    return;
  }
  const { cookieValue } = createSession(user.id, config.sessionSecret);
  reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/',
  });
  if (parsed.data.trust_device) {
    const { cookieValue: trust } = issueTrustCookie({ userId: user.id, ua, ip: ip ?? null });
    reply.setCookie(TRUST_COOKIE_NAME, trust, {
      httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  recordAudit({ event: 'otp.verify.ok', userId: user.id, detail: { purpose, trusted: !!parsed.data.trust_device }, ip, userAgent: ua });
  reply.code(200).send({ ok: true });
  return;
}
```

(Add `import { issueTrustCookie, TRUST_COOKIE_NAME } from '../auth/trusted-devices.js';` to the file head.)

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-trusted-devices.test.ts
git commit -m "feat(server): issue trust cookie on OTP verify"
```

---

### Task D5: Extend `/api/auth/otp/request` to return `next_step`

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-otp.test.ts`

- [ ] **Step 1: Write failing test** — append to `auth-otp.test.ts`:

```ts
import { issueTrustCookie, TRUST_COOKIE_NAME } from '../src/auth/trusted-devices.js';

describe('POST /api/auth/otp/request returns next_step=password when device trusted + password set', () => {
  it('returns next_step=password and does NOT send OTP', async () => {
    seedMailbox('system@zero-spam.email');
    // seedOwner() always seeds a real argon2 password by default, which trips
    // the `password_hash.startsWith('$argon2')` check in the request route.
    const { userId, email } = await seedOwner();
    const { cookieValue } = issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/otp/request', payload: { email },
      headers: { cookie: `${TRUST_COOKIE_NAME}=${cookieValue}` },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ next_step: 'password' });
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Modify the request route** in `server/src/routes/auth.ts`. Insert before the `if (user) { ... }` issueCode block:

```ts
if (user) {
  const trust = validateTrustCookie(req.cookies[TRUST_COOKIE_NAME], ip ?? null);
  const userHasPassword = !!user.password_hash && user.password_hash.startsWith('$argon2');
  if (trust.ok && trust.userId === user.id && userHasPassword) {
    reply.code(200).send({ next_step: 'password' });
    return;
  }
  // ... existing issueCode + sendOtpEmail block
}
```

(Add `import { validateTrustCookie } from '../auth/trusted-devices.js';` if not already.)

Note: the existing seeded `users` rows with non-argon2 placeholder hashes (`'hash'`, `'h'`, `'xxxxxxx...'`) correctly don't trigger the password path because they fail the `$argon2` prefix check. `setOwnerPassword` (an existing helper in `server/src/users.ts`) writes argon2id hashes and is what real users go through.

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-otp.test.ts
git commit -m "feat(server): otp/request returns next_step=password on trusted device"
```

---

## Phase E — Backend Password & TOTP Integration

### Task E1: Revoke trusted devices on password change

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/test/auth-trusted-devices.test.ts`

- [ ] **Step 1: Find the password-change handler** in `server/src/routes/auth.ts` (the route registered around `app.post('/api/auth/password', ...)`).

- [ ] **Step 2: Write failing test** — append:

```ts
describe('password change revokes trusted devices', () => {
  it('clears all trusted_devices for the user', async () => {
    // seedOwner already creates a real argon2 password; no setup needed.
    const { userId, email, password } = await seedOwner();
    issueTrustCookie({ userId, ua: 'test', ip: '1.2.3.4' });
    const app = await buildApp();
    await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { currentPassword: password, newPassword: 'a-very-good-password-2026' },
    });
    const active = db.prepare(
      'SELECT COUNT(*) c FROM trusted_devices WHERE user_id=? AND revoked_at IS NULL',
    ).get(userId) as { c: number };
    expect(active.c).toBe(0);
  });
});
```

- [ ] **Step 3: Run, expect FAIL**.

- [ ] **Step 4: In the password-change handler**, after the call that updates the password hash, add:

```ts
revokeAllForUser(userId);
```

(Add `import { revokeAllForUser } from '../auth/trusted-devices.js';` to the file head if needed.)

- [ ] **Step 5: Re-run, expect PASS**. Commit:

```bash
git add server/src/routes/auth.ts server/test/auth-trusted-devices.test.ts
git commit -m "feat(server): revoke trusted devices on password change"
```

---

### Task E2: First-time-set / change / remove password with OTP token

**Files:**
- Modify: `server/src/routes/auth.ts`
- Create: `server/test/auth-password-otp.test.ts`

The existing `POST /api/auth/password` requires `currentPassword` + `newPassword`. The spec calls for two new shapes: first-time set (no current password, requires OTP) and remove (DELETE, requires OTP). Both must consume a fresh OTP code with `purpose: 'password_set'`.

- [ ] **Step 1: Write failing tests** at `server/test/auth-password-otp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../src/routes/auth.js';
import { seedOwner, makeSessionCookie } from './fixtures/owner.js';
import { issueCode } from '../src/auth/otp.js';
import { db } from '../src/db.js';
import { seedMailbox } from './helpers.js';
import * as sender from '../src/sender.js';

async function buildApp() {
  const app = Fastify();
  await app.register(cookie);
  await app.register(authRoutes);
  return app;
}

describe('first-time password set (POST /api/auth/password without currentPassword)', () => {
  let sendSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    seedMailbox('system@zero-spam.email');
    sendSpy = vi.spyOn(sender, 'sendMessage').mockResolvedValue({
      messageId: 'm', envelopeFrom: '', recipients: [], signed: true, whitelistAdded: 0,
    });
  });
  afterEach(() => sendSpy.mockRestore());

  it('sets a password for an OTP-only user when given a fresh OTP code', async () => {
    const { userId, email } = await seedOwner();
    // Wipe the password to simulate an OTP-only signup user.
    db.prepare("UPDATE users SET password_hash='' WHERE id=?").run(userId);
    const { code } = await issueCode({ email, purpose: 'password_set' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { newPassword: 'a-very-good-password-2026', otpCode: code },
    });
    expect(r.statusCode).toBe(200);
    const after = db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId) as any;
    expect(after.password_hash).toMatch(/^\$argon2/);
  });

  it('rejects first-time set with a stale OTP', async () => {
    const { userId, email } = await seedOwner();
    db.prepare("UPDATE users SET password_hash='' WHERE id=?").run(userId);
    const app = await buildApp();
    const r = await app.inject({
      method: 'POST', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { newPassword: 'a-very-good-password-2026', otpCode: '000000' },
    });
    expect(r.statusCode).toBe(401);
  });
});

describe('DELETE /api/auth/password (remove password)', () => {
  it('removes the password when given a fresh OTP', async () => {
    const { userId, email } = await seedOwner();
    seedMailbox('system@zero-spam.email');
    const { code } = await issueCode({ email, purpose: 'password_set' });
    const app = await buildApp();
    const r = await app.inject({
      method: 'DELETE', url: '/api/auth/password',
      headers: { cookie: makeSessionCookie(userId), 'content-type': 'application/json' },
      payload: { otpCode: code },
    });
    expect(r.statusCode).toBe(200);
    const after = db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId) as any;
    expect(after.password_hash).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Modify the existing `POST /api/auth/password` handler** in `server/src/routes/auth.ts`. Change the schema to make `currentPassword` optional but require `otpCode` when it is omitted:

```ts
const passwordSchema = z.union([
  z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12, 'password must be >=12 chars'),
  }),
  z.object({
    otpCode: z.string().regex(/^\d{6}$/),
    newPassword: z.string().min(12, 'password must be >=12 chars'),
  }),
]);
```

In the handler, branch on which shape was sent:

```ts
import { verifyCode } from '../auth/otp.js';

// inside the handler, after parsed.success:
const userId = (req as any).userId as number;
const me = getOwnerById(userId);
if (!me) { reply.code(401).send({ error: 'unauthenticated' }); return; }

if ('currentPassword' in parsed.data) {
  const ok = await verifyPassword(me.password_hash, parsed.data.currentPassword);
  if (!ok) { reply.code(401).send({ error: 'invalid-credentials' }); return; }
} else {
  const r = await verifyCode({ email: me.email, purpose: 'password_set', code: parsed.data.otpCode });
  if (!r.ok) { reply.code(401).send({ error: 'invalid-code', reason: r.reason }); return; }
}
await updateOwnerPassword(userId, parsed.data.newPassword);
revokeAllForUser(userId);
recordAudit({ event: 'password.change', userId, ip, userAgent: ua });
reply.code(200).send({ ok: true });
```

- [ ] **Step 4: Add the DELETE handler**:

```ts
const passwordRemoveSchema = z.object({ otpCode: z.string().regex(/^\d{6}$/) });

app.delete('/api/auth/password', { preHandler: requireAuth }, async (req, reply) => {
  const parsed = passwordRemoveSchema.safeParse(req.body);
  if (!parsed.success) { reply.code(400).send({ error: 'invalid-body' }); return; }
  const userId = (req as any).userId as number;
  const me = getOwnerById(userId);
  if (!me) { reply.code(401).send({ error: 'unauthenticated' }); return; }
  const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
  const ua = (req.headers['user-agent'] as string | undefined) ?? null;
  const r = await verifyCode({ email: me.email, purpose: 'password_set', code: parsed.data.otpCode });
  if (!r.ok) { reply.code(401).send({ error: 'invalid-code', reason: r.reason }); return; }
  db.prepare("UPDATE users SET password_hash='' WHERE id=?").run(userId);
  revokeAllForUser(userId);
  recordAudit({ event: 'password.remove', userId, ip, userAgent: ua });
  reply.code(200).send({ ok: true });
});
```

- [ ] **Step 5: Run all server auth tests**:

```bash
npm test --workspace=server -- auth-
```

Expected: all pass.

- [ ] **Step 6: Commit** —

```bash
git add server/src/routes/auth.ts server/test/auth-password-otp.test.ts
git commit -m "feat(server): password set/change/remove with OTP token"
```

---

### Task E3: Logout with `?revoke_trust=1`

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Locate the existing `POST /api/auth/logout` handler**.

- [ ] **Step 2: Extend it** to optionally revoke the trust cookie:

```ts
import { revokeAllForUser, TRUST_COOKIE_NAME } from '../auth/trusted-devices.js';

app.post('/api/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
  const userId = (req as any).userId as number;
  // existing session-destroy
  destroySession(req.cookies[SESSION_COOKIE_NAME]);
  reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  // new: optional trust revocation
  const url = new URL(req.url, 'http://x');
  if (url.searchParams.get('revoke_trust') === '1') {
    revokeAllForUser(userId);
    reply.clearCookie(TRUST_COOKIE_NAME, { path: '/' });
  }
  reply.code(200).send({ ok: true });
});
```

(The exact existing logout code may differ; merge the new lines into whatever shape it has. Keep existing audit calls.)

- [ ] **Step 3: Build, expect PASS**:

```bash
npm run build --workspace=server
```

- [ ] **Step 4: Commit** —

```bash
git add server/src/routes/auth.ts
git commit -m "feat(server): logout supports ?revoke_trust=1"
```

---

## Phase F — Frontend

### Task F1: API client methods

**Files:**
- Modify: `web/src/api.ts`

- [ ] **Step 1: Append new methods to the `api` export** in `web/src/api.ts`:

```ts
otpRequest(email: string): Promise<{ next_step: 'otp' | 'password' }> {
  return fetchJson('/api/auth/otp/request', { method: 'POST', body: JSON.stringify({ email }) });
},
otpVerify(args: { email: string; code: string; purpose: 'login' | 'signup' | 'password_set'; trust_device?: boolean }): Promise<{ ok: true }> {
  return fetchJson('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify(args) });
},
inviteRedeem(args: { invite: string; username: string; email: string; name?: string }): Promise<{ next_step: 'otp' }> {
  return fetchJson('/api/auth/invite/redeem', { method: 'POST', body: JSON.stringify(args) });
},
listDevices(): Promise<{ devices: Array<{ id: number; device_id: string; ua: string | null; ip_last: string | null; created_at: number; last_seen_at: number }> }> {
  return fetchJson('/api/auth/devices');
},
revokeDevice(id: number): Promise<{ ok: boolean }> {
  return fetchJson(`/api/auth/devices/${id}`, { method: 'DELETE' });
},
```

(Match the existing `fetchJson` helper signature from the file head; verify the JSON-body convention by reading the existing methods.)

- [ ] **Step 2: Build to verify types** — `npm run build:shared-api && npm run build --workspace=web`. Expected: pass.

- [ ] **Step 3: Commit** —

```bash
git add web/src/api.ts
git commit -m "feat(web): add OTP/invite/device API methods"
```

---

### Task F2: EmailEntry screen

**Files:**
- Create: `web/src/components/EmailEntry.tsx`
- Create: `web/src/components/__tests__/EmailEntry.test.tsx`

- [ ] **Step 1: Write failing test** at `EmailEntry.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmailEntry from '../EmailEntry';

vi.mock('../../api', () => ({
  api: { otpRequest: vi.fn().mockResolvedValue({ next_step: 'otp' }) },
}));

describe('EmailEntry', () => {
  it('submits and calls onNext with email and next_step', async () => {
    const onNext = vi.fn();
    render(<EmailEntry onNext={onNext} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('EMAIL'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /CONTINUE/i }));
    expect(onNext).toHaveBeenCalledWith({ email: 'a@b.com', next_step: 'otp' });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `web/src/components/EmailEntry.tsx`** —

```tsx
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EditorialButton, EditorialInput, MonoLabel, Wordmark } from './brand';

type Props = { onNext: (next: { email: string; next_step: 'otp' | 'password' }) => void };

export default function EmailEntry({ onNext }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.otpRequest(email.trim().toLowerCase());
      onNext({ email: email.trim().toLowerCase(), next_step: r.next_step });
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="md" />
        <MonoLabel>EST · MMXXVI · BY INVITATION ONLY</MonoLabel>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={submit} className="w-full max-w-[420px] space-y-8">
          <h1 className="font-display italic text-[40px] leading-[1.1]">Sign in.</h1>
          <EditorialInput
            label="EMAIL"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          {err && <p className="font-mono text-[12px] text-[var(--danger)]">{err}</p>}
          <EditorialButton type="submit" disabled={busy}>
            [ CONTINUE ↗ ]
          </EditorialButton>
          <p className="font-mono text-[12px] text-quiet">
            // got an invite? <a href="/signup" className="underline">redeem here →</a>
          </p>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/EmailEntry.tsx web/src/components/__tests__/EmailEntry.test.tsx
git commit -m "feat(web): add EmailEntry screen"
```

---

### Task F3: OtpEntry screen

**Files:**
- Create: `web/src/components/OtpEntry.tsx`
- Create: `web/src/components/__tests__/OtpEntry.test.tsx`

- [ ] **Step 1: Write failing test** at `OtpEntry.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OtpEntry from '../OtpEntry';

vi.mock('../../api', () => ({
  api: { otpVerify: vi.fn().mockResolvedValue({ ok: true }) },
}));

describe('OtpEntry', () => {
  it('shows masked email', () => {
    render(<OtpEntry email="alice@example.com" purpose="login" onSuccess={vi.fn()} />);
    expect(screen.getByText(/a…e@example.com/)).toBeInTheDocument();
  });
  it('verifies and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<OtpEntry email="a@b" purpose="login" onSuccess={onSuccess} />);
    const user = userEvent.setup();
    const inputs = screen.getAllByRole('textbox');
    inputs[0].focus();
    await user.paste('123456');
    await user.click(screen.getByRole('button', { name: /VERIFY/i }));
    expect(onSuccess).toHaveBeenCalled();
  });
  it('trust-device checkbox defaults on', () => {
    render(<OtpEntry email="a@b" purpose="login" onSuccess={vi.fn()} />);
    const cb = screen.getByLabelText(/trust this device/i) as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `web/src/components/OtpEntry.tsx`** —

```tsx
import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../api';
import { EditorialButton, MonoLabel, OtpGrid, Wordmark } from './brand';

type Props = {
  email: string;
  purpose: 'login' | 'signup' | 'password_set';
  onSuccess: () => void;
};

function maskEmail(e: string): string {
  const [local, domain] = e.split('@');
  if (!domain) return e;
  if (local.length <= 2) return `${local}@${domain}`;
  return `${local[0]}…${local[local.length - 1]}@${domain}`;
}

export default function OtpEntry({ email, purpose, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trust, setTrust] = useState(true);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.otpVerify({ email, code, purpose, trust_device: trust });
      onSuccess();
    } catch (e: any) {
      setErr("That code didn't match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0) return;
    await api.otpRequest(email);
    setResendIn(30);
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="md" />
        <MonoLabel>EST · MMXXVI · BY INVITATION ONLY</MonoLabel>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={submit} className="w-full max-w-[480px] space-y-8">
          <div>
            <h1 className="font-display italic text-[40px] leading-[1.1]">Check your email.</h1>
            <p className="mt-3 font-display text-[18px] leading-[1.5] text-ink-soft">
              We sent a six-digit code to <span className="font-mono text-[14px]">{maskEmail(email)}</span>.
              It expires in 10 minutes.
            </p>
          </div>
          <OtpGrid value={code} onChange={setCode} disabled={busy} />
          {err && <p className="font-mono text-[12px] text-[var(--danger)]">{err}</p>}
          <label className="flex items-center gap-2 font-mono text-[12px] text-quiet">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
            trust this device for 30 days
          </label>
          <div className="flex items-center gap-6">
            <EditorialButton type="submit" disabled={busy || code.length !== 6}>
              [ VERIFY ↗ ]
            </EditorialButton>
            <button
              type="button"
              onClick={resend}
              disabled={resendIn > 0}
              className="font-mono text-[12px] text-quiet underline-offset-4 hover:underline disabled:opacity-50"
            >
              // {resendIn > 0 ? `resend in ${resendIn}s` : 'resend code'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/OtpEntry.tsx web/src/components/__tests__/OtpEntry.test.tsx
git commit -m "feat(web): add OtpEntry screen"
```

---

### Task F4: PasswordEntry screen

**Files:**
- Create: `web/src/components/PasswordEntry.tsx`
- Create: `web/src/components/__tests__/PasswordEntry.test.tsx`

- [ ] **Step 1: Write failing test** at `PasswordEntry.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordEntry from '../PasswordEntry';

vi.mock('../../api', () => ({
  api: { authLogin: vi.fn().mockResolvedValue({ ok: true }) },
}));

describe('PasswordEntry', () => {
  it('submits email + password and calls onSuccess on ok', async () => {
    const onSuccess = vi.fn();
    render(<PasswordEntry email="alice@x" onSuccess={onSuccess} onNeedTotp={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('PASSWORD'), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: /SIGN IN/i }));
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `web/src/components/PasswordEntry.tsx`** —

```tsx
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EditorialButton, EditorialInput, MonoLabel, Wordmark } from './brand';

type Props = {
  email: string;
  onSuccess: () => void;
  onNeedTotp: () => void;
};

export default function PasswordEntry({ email, onSuccess, onNeedTotp }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.authLogin({ email, password });
      if ('needs_totp' in r) onNeedTotp();
      else onSuccess();
    } catch (e: any) {
      setErr(e?.status === 401 ? 'Wrong password.' : (e?.message ?? 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="md" />
        <MonoLabel>EST · MMXXVI</MonoLabel>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={submit} className="w-full max-w-[420px] space-y-8">
          <h1 className="font-display italic text-[40px] leading-[1.1]">Welcome back.</h1>
          <p className="font-mono text-[12px] text-quiet">{email}</p>
          <EditorialInput
            label="PASSWORD"
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          {err && <p className="font-mono text-[12px] text-[var(--danger)]">{err}</p>}
          <EditorialButton type="submit" disabled={busy}>[ SIGN IN ↗ ]</EditorialButton>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/PasswordEntry.tsx web/src/components/__tests__/PasswordEntry.test.tsx
git commit -m "feat(web): add PasswordEntry screen"
```

---

### Task F5: TotpEntry screen

**Files:**
- Create: `web/src/components/TotpEntry.tsx`
- Create: `web/src/components/__tests__/TotpEntry.test.tsx`

- [ ] **Step 1: Write failing test** —

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TotpEntry from '../TotpEntry';

vi.mock('../../api', () => ({
  api: { authLogin: vi.fn().mockResolvedValue({ ok: true }) },
}));

describe('TotpEntry', () => {
  it('verifies a 6-digit code and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<TotpEntry email="a@b" password="p" onSuccess={onSuccess} />);
    const user = userEvent.setup();
    const inputs = screen.getAllByRole('textbox');
    inputs[0].focus();
    await user.paste('123456');
    await user.click(screen.getByRole('button', { name: /VERIFY/i }));
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Create `web/src/components/TotpEntry.tsx`** —

```tsx
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EditorialButton, MonoLabel, OtpGrid, Wordmark } from './brand';

type Props = { email: string; password: string; onSuccess: () => void };

export default function TotpEntry({ email, password, onSuccess }: Props) {
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.authLogin({ email, password, totp });
      onSuccess();
    } catch (e: any) {
      setErr('Wrong code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="md" />
        <MonoLabel>EST · MMXXVI</MonoLabel>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={submit} className="w-full max-w-[480px] space-y-8">
          <h1 className="font-display italic text-[40px] leading-[1.1]">One more thing.</h1>
          <p className="font-mono text-[12px] text-quiet uppercase tracking-[0.08em]">authenticator code</p>
          <OtpGrid value={totp} onChange={setTotp} disabled={busy} />
          {err && <p className="font-mono text-[12px] text-[var(--danger)]">{err}</p>}
          <EditorialButton type="submit" disabled={busy || totp.length !== 6}>[ VERIFY ↗ ]</EditorialButton>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/TotpEntry.tsx web/src/components/__tests__/TotpEntry.test.tsx
git commit -m "feat(web): add TotpEntry screen"
```

---

### Task F6: Signup rewrite (invite-gated)

**Files:**
- Modify: `web/src/components/Signup.tsx` (full rewrite)
- Create: `web/src/components/__tests__/Signup.test.tsx`

- [ ] **Step 1: Write failing tests** —

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Signup from '../Signup';

vi.mock('../../api', () => ({
  api: { inviteRedeem: vi.fn().mockResolvedValue({ next_step: 'otp' }) },
}));

describe('Signup', () => {
  it('shows manifesto when no invite param', () => {
    delete (window as any).location;
    (window as any).location = { search: '' };
    render(<Signup onNext={vi.fn()} />);
    expect(screen.getByText(/by invitation/i)).toBeInTheDocument();
  });
  it('shows the form when invite param is present', () => {
    delete (window as any).location;
    (window as any).location = { search: '?invite=ABCD12345678' };
    render(<Signup onNext={vi.fn()} />);
    expect(screen.getByLabelText('USERNAME')).toBeInTheDocument();
  });
  it('submits and calls onNext', async () => {
    delete (window as any).location;
    (window as any).location = { search: '?invite=ABCD12345678' };
    const onNext = vi.fn();
    render(<Signup onNext={onNext} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('USERNAME'), 'alice');
    await user.type(screen.getByLabelText('EMAIL'), 'alice@x.com');
    await user.click(screen.getByRole('button', { name: /CLAIM/i }));
    expect(onNext).toHaveBeenCalledWith({ email: 'alice@x.com' });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Rewrite `web/src/components/Signup.tsx`** —

```tsx
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { EditorialButton, EditorialInput, MonoLabel, Wordmark } from './brand';

type Props = { onNext: (next: { email: string }) => void };

function getInvite(): string {
  const m = /[?&]invite=([A-HJ-NP-Z2-9]{8,20})/.exec(window.location.search);
  return m ? m[1] : '';
}

export default function Signup({ onNext }: Props) {
  const [invite] = useState(getInvite);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!invite) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
          <Wordmark size="md" />
          <MonoLabel>EST · MMXXVI · BY INVITATION ONLY</MonoLabel>
        </header>
        <main className="flex-1 flex items-center justify-center px-8 text-center">
          <div className="max-w-[520px]">
            <h1 className="font-display italic text-[64px] leading-[1.05]">By invitation.</h1>
            <p className="mt-6 font-display text-[20px] leading-[1.5] text-ink-soft">
              ZeroSpam is an invitation-only inbox. If you have one, the link will include it. If not,{' '}
              <a href="/" className="underline">return home</a>.
            </p>
          </div>
        </main>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.inviteRedeem({ invite, username: username.toLowerCase(), email: email.toLowerCase(), name: name || undefined });
      onNext({ email: email.toLowerCase() });
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="md" />
        <MonoLabel>EST · MMXXVI · BY INVITATION ONLY</MonoLabel>
      </header>
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={submit} className="w-full max-w-[460px] space-y-8">
          <h1 className="font-display italic text-[40px] leading-[1.1]">Claim your inbox.</h1>
          <EditorialInput
            label="USERNAME"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[a-z0-9._-]+"
            minLength={3}
            maxLength={32}
            required
            autoFocus
            disabled={busy}
          />
          <p className="font-mono text-[12px] text-quiet -mt-6">
            {(username || 'you')}@zero-spam.email
          </p>
          <EditorialInput
            label="EMAIL"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
          <EditorialInput
            label="NAME (OPTIONAL)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          {err && <p className="font-mono text-[12px] text-[var(--danger)]">{err}</p>}
          <EditorialButton type="submit" disabled={busy}>[ CLAIM YOUR INBOX ↗ ]</EditorialButton>
        </form>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/Signup.tsx web/src/components/__tests__/Signup.test.tsx
git commit -m "feat(web): rewrite Signup as invite-gated Reading Room screen"
```

---

### Task F7: Landing page rewrite

**Files:**
- Modify: `web/src/components/Landing.tsx` (full rewrite)
- Create: `web/src/components/__tests__/Landing.test.tsx`

- [ ] **Step 1: Write failing test** —

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Landing from '../Landing';

describe('Landing', () => {
  it('renders all six section labels and the manifesto headline', () => {
    render(<Landing onSignIn={vi.fn()} />);
    expect(screen.getByText(/by invitation/i)).toBeInTheDocument();
    for (const label of ['DEFAULT-DENY INBOX', 'THE FLOW', 'THE MANUAL', 'WHO', 'THE QUESTIONS', 'THE CLOSER']) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
  });
  it('hero CTA calls onSignIn', async () => {
    const onSignIn = vi.fn();
    render(<Landing onSignIn={onSignIn} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: /SIGN IN/i })[0]);
    expect(onSignIn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**.

- [ ] **Step 3: Rewrite `web/src/components/Landing.tsx`** —

```tsx
import { EditorialButton, HardRule, Hairline, MonoLabel, PaperGrain, Wordmark, YellowDot } from './brand';

type Props = { onSignIn: () => void };

const principles = [
  {
    id: '01.',
    heading: 'By invitation.',
    body: "Default-deny inbox. ZeroSpam doesn't filter, score, or guess. It asks. You answer.",
  },
  {
    id: '02.',
    heading: 'Quarantine that expires.',
    body: 'Anything not whitelisted lands in quarantine and auto-expires on a schedule you set — 168 hours by default. No backlog. No inbox debt.',
  },
  {
    id: '03.',
    heading: 'Trust as a graph.',
    body: "Reply to someone, they're trusted. Approve a sender once, they stay approved. Your network compounds.",
  },
];

const faqs = [
  {
    q: 'Why no password by default?',
    a: 'A password is a thing to remember and a thing to lose. Email control is the proof we need; the code arrives in the place you already check.',
  },
  {
    q: 'What does "expire" actually mean?',
    a: 'Quarantined messages auto-delete after 168 hours by default. You can lower the TTL. Nothing builds up to triage.',
  },
  {
    q: 'Can I keep my old address?',
    a: 'Yes. Forward your existing inbox to your new ZeroSpam handle and let unknown senders pass through the screener.',
  },
  {
    q: 'Why invitation-only?',
    a: 'Because the manifesto only works when the people on it agree to it. Invitations keep the room small, and the screener less noisy.',
  },
];

export default function Landing({ onSignIn }: Props) {
  return (
    <div className="relative min-h-screen bg-paper text-ink font-body">
      <PaperGrain />
      {/* Header */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-rule">
        <Wordmark size="lg" />
        <div className="flex items-center gap-6">
          <MonoLabel>EST · MMXXVI · BY INVITATION ONLY · vol. 01 / no. 01</MonoLabel>
          <button onClick={onSignIn} className="font-mono uppercase tracking-[0.08em] text-[12px] text-quiet hover:underline">
            [ SIGN IN ]
          </button>
        </div>
      </header>

      {/* 01 — HERO */}
      <section className="relative z-10 px-8 pt-24 pb-32">
        <div className="max-w-[1100px] mx-auto">
          <p className="font-mono uppercase tracking-[0.1em] text-[11px] text-quiet mb-8">
            <span className="inline-block w-6 border-t border-rule-strong align-middle mr-3" />
            01 — DEFAULT-DENY INBOX
          </p>
          <h1 className="font-display italic text-[clamp(56px,9vw,96px)] leading-[1.0] tracking-tight">
            Your inbox is{' '}
            <span className="relative inline-block">
              by invitation
              <span aria-hidden="true" className="absolute left-0 right-0 -bottom-2 h-[3px] bg-signal" />
            </span>.
            <br />
            Everything else expires.
          </h1>
          <p className="mt-12 font-display text-[22px] leading-[1.45] text-ink-soft max-w-[640px] ml-[8%]">
            ZeroSpam is whitelist-first email. We don't filter, score, or guess. We ask. You answer. Anything that doesn't earn its way in expires on a schedule you set.
          </p>
          <div className="mt-12 flex items-center gap-8">
            <EditorialButton onClick={onSignIn}>[ SIGN IN ↗ ]</EditorialButton>
            <a href="/signup" className="font-mono text-[12px] text-quiet underline-offset-4 hover:underline">
              // got an invite? redeem here →
            </a>
          </div>
        </div>
      </section>

      {/* 02 — THE FLOW */}
      <section className="relative z-10 px-8 pb-24">
        <HardRule label="THE FLOW — A 30-SECOND TOUR" />
        <div className="max-w-[1100px] mx-auto mt-12">
          <div className="bg-paper-deep border border-rule p-8 aspect-[16/9] flex items-center justify-center">
            <MonoLabel>screener screenshot — placeholder</MonoLabel>
          </div>
          <p className="mt-12 font-display italic text-[24px] leading-[1.4] text-ink-soft max-w-[680px]">
            A new sender shows up. You decide.
          </p>
          <p className="mt-3 font-body text-[16px] leading-[1.6] text-ink-soft max-w-[680px]">
            Yes lets them through. No mutes them for thirty days. <span className="font-mono text-[13px] text-quiet">// that's it.</span>
          </p>
        </div>
      </section>

      {/* 03 — THE MANUAL */}
      <section className="relative z-10 px-8 pb-24">
        <HardRule label="THE MANUAL — 03 PRINCIPLES" />
        <div className="max-w-[1100px] mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-0">
          {principles.map((p, i) => (
            <div key={p.id} className={`p-8 ${i > 0 ? 'md:border-l border-rule' : ''}`}>
              <p className="font-mono text-[12px] text-quiet">{p.id}</p>
              <h3 className="mt-4 font-display italic text-[24px] leading-[1.2]">
                <YellowDot className="mr-2" />
                {p.heading}
              </h3>
              <p className="mt-4 font-body text-[15px] leading-[1.6] text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 04 — WHO */}
      <section className="relative z-10 px-8 pb-24">
        <HardRule label="WHO" />
        <p className="mt-12 max-w-[720px] mx-auto text-center font-display italic text-[22px] leading-[1.45] text-ink-soft">
          ZeroSpam is for people whose attention is a working tool — founders, makers, and anyone whose calendar is an output, not an input. If your inbox is also your todo list, this isn't for you.
        </p>
      </section>

      {/* 05 — THE QUESTIONS */}
      <section className="relative z-10 px-8 pb-24">
        <HardRule label="THE QUESTIONS" />
        <div className="max-w-[760px] mx-auto mt-12">
          {faqs.map((f, i) => (
            <div key={f.q} className={`py-8 ${i > 0 ? 'border-t border-rule' : ''}`}>
              <p className="font-mono uppercase tracking-[0.08em] text-[11px] text-quiet">Q.</p>
              <h4 className="mt-2 font-display italic text-[22px] leading-[1.3]">{f.q}</h4>
              <p className="mt-3 font-body text-[16px] leading-[1.6] text-ink-soft">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 06 — CLOSER */}
      <section className="relative z-10 px-8 pb-32">
        <HardRule label="THE CLOSER" />
        <div className="max-w-[760px] mx-auto mt-16 text-center">
          <h2 className="font-display italic text-[clamp(40px,7vw,64px)] leading-[1.05]">
            Your inbox is by invitation.
          </h2>
          <div className="mt-12 flex items-center justify-center gap-8">
            <EditorialButton onClick={onSignIn}>[ SIGN IN ↗ ]</EditorialButton>
            <a href="/signup" className="font-mono text-[12px] text-quiet underline-offset-4 hover:underline">
              // got an invite? →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-8 border-t border-rule">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <MonoLabel>vol. 01 / no. 01 · est mmxxvi</MonoLabel>
          <div className="flex items-center gap-6">
            <a href="#" className="font-mono text-[12px] text-quiet hover:underline">privacy</a>
            <a href="#" className="font-mono text-[12px] text-quiet hover:underline">terms</a>
            <a href="https://github.com" className="font-mono text-[12px] text-quiet hover:underline">github</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Re-run, expect PASS**.

- [ ] **Step 5: Commit** —

```bash
git add web/src/components/Landing.tsx web/src/components/__tests__/Landing.test.tsx
git commit -m "feat(web): rewrite Landing in Reading Room v2"
```

---

### Task F8: App.tsx route wiring + delete LoginForm.tsx

**Files:**
- Modify: `web/src/App.tsx`
- Delete: `web/src/components/LoginForm.tsx`

- [ ] **Step 1: Read** `web/src/App.tsx` to find the existing auth-gate structure (where `LoginForm`, `Signup`, and `Landing` are conditionally rendered).

- [ ] **Step 2: Replace the auth-gate region** with a small state machine:

```tsx
type AuthScreen =
  | { kind: 'landing' }
  | { kind: 'email' }
  | { kind: 'otp'; email: string; purpose: 'login' | 'signup' }
  | { kind: 'password'; email: string }
  | { kind: 'totp'; email: string; password: string }
  | { kind: 'signup' };

const [authScreen, setAuthScreen] = useState<AuthScreen>(() => {
  if (window.location.pathname === '/signup') return { kind: 'signup' };
  if (window.location.pathname === '/login') return { kind: 'email' };
  return { kind: 'landing' };
});

if (!signedIn) {
  if (authScreen.kind === 'landing')
    return <Landing onSignIn={() => setAuthScreen({ kind: 'email' })} />;
  if (authScreen.kind === 'email')
    return (
      <EmailEntry
        onNext={({ email, next_step }) =>
          setAuthScreen(next_step === 'password' ? { kind: 'password', email } : { kind: 'otp', email, purpose: 'login' })
        }
      />
    );
  if (authScreen.kind === 'otp')
    return <OtpEntry email={authScreen.email} purpose={authScreen.purpose} onSuccess={() => refetchAuth()} />;
  if (authScreen.kind === 'password')
    return (
      <PasswordEntry
        email={authScreen.email}
        onSuccess={() => refetchAuth()}
        onNeedTotp={() => setAuthScreen({ kind: 'totp', email: authScreen.email, password: '' })}
      />
    );
  if (authScreen.kind === 'totp')
    return <TotpEntry email={authScreen.email} password={authScreen.password} onSuccess={() => refetchAuth()} />;
  if (authScreen.kind === 'signup')
    return <Signup onNext={({ email }) => setAuthScreen({ kind: 'otp', email, purpose: 'signup' })} />;
}
```

(Keep the existing `signedIn`, `refetchAuth` handles. Replace the import of `LoginForm` with the new components. Adjust the logout handler to reset `authScreen` to `{ kind: 'landing' }`.)

- [ ] **Step 3: Delete `LoginForm.tsx`** —

```bash
rm web/src/components/LoginForm.tsx
```

(Keep `LoginForm.test.tsx` or delete if it exists — verify with `ls web/src/components/__tests__/`.)

- [ ] **Step 4: Run all web tests** —

```bash
npm test --workspace=web
```

Expected: all pass. Fix any broken imports left behind.

- [ ] **Step 5: Smoke-run the dev stack and walk through:**
  - Open `http://localhost:5173/` → Landing renders, hero CTA goes to email entry.
  - `http://localhost:5173/login` → email entry directly.
  - Type a known email → OTP screen → enter wrong code → error → enter right code (read from `npm run dev` server log capture or local SMTP loopback) → signed in.
  - `http://localhost:5173/signup` (no invite) → manifesto.
  - `http://localhost:5173/signup?invite=...` (from `npm run invite:create`) → form → submit → OTP → claimed.

- [ ] **Step 6: Commit** —

```bash
git add web/src/App.tsx
git rm web/src/components/LoginForm.tsx
git commit -m "feat(web): wire new auth state machine, retire LoginForm"
```

---

## Self-Review

After completing all tasks, run the full test suite:

```bash
npm test --workspace=server && npm test --workspace=web
```

Expected: all green. If any test fails because a Phase F test mocked a method that earlier tasks renamed, update the mock to match the final API surface.

Manual smoke checklist:
- [ ] Landing renders all six sections with cream paper, italic Source Serif headlines, and a yellow-underlined "by invitation" phrase.
- [ ] CTA "[ SIGN IN ↗ ]" navigates to `/login` and shows the editorial email-entry screen.
- [ ] Submitting a known email triggers an OTP email (visible in `npm run dev` server log; in loopback mode, the email arrives in your own ZeroSpam inbox).
- [ ] Entering the right code with "trust this device" checked sets both `zs_session` and `zs_trust` cookies (DevTools → Application → Cookies).
- [ ] Subsequent visits to `/login` with a password set on the account skip the OTP screen and go straight to password entry.
- [ ] `/signup` without `?invite=` shows the manifesto. With a valid invite, the form is unlocked.
- [ ] `npm run invite:create -- --max-uses 1` prints a usable URL.
- [ ] The webmail (`/`, post-login) is unchanged — old `zs*` tokens still work and the three-pane layout renders.
