# Web Vitest Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest + React Testing Library to the `web/` workspace and write tests covering every web file modified or added on the `feat/quarantine-digest` branch (the screener + welcome-tour work).

**Architecture:** Vitest with `jsdom` env + RTL, mirroring the server's Vitest setup. Component tests mock the `api` module wrapper; the only test that exercises real fetch is `api.test.ts`, which stubs `globalThis.fetch` (because `createApiClient` calls `globalThis.fetch.bind(globalThis)` when no override is given — see [packages/shared-api/src/client.ts:93](packages/shared-api/src/client.ts#L93)). Tests live in `__tests__/` folders next to the code.

**Tech Stack:** Vitest, `@vitest/coverage-v8`, jsdom, `@testing-library/react`, `@testing-library/user-event` v14, `@testing-library/jest-dom`.

**Spec:** [docs/superpowers/specs/2026-05-02-web-vitest-setup-design.md](docs/superpowers/specs/2026-05-02-web-vitest-setup-design.md)

---

## Reality-vs-spec notes (locked-in clarifications)

While reading the actual components, I found three places where the spec's test list referenced behavior that doesn't live in the component named:

1. **Screener does not have an "allow domain" button.** Domain expansion is suggested by the server (`suggest_domain_expand` in the allow response) and surfaced by the **`DomainExpandToast`** rendered by App. The Screener test instead asserts that allowing a sender calls `onSuggestDomainExpand` when the response says so.
2. **DomainExpandToast does not check free-mail domains itself.** The server already returns `suggest_domain_expand: false` for free-mail. The toast just renders + calls `screenerAllowDomain`. Test that.
3. **Sidebar always renders the Screener entry.** There is no SLA gate inside Sidebar. Test the click + counts behavior, not visibility-by-SLA.

These are clarifications, not scope changes — the spec's intent ("test branch-diff components") is preserved.

---

## File structure (final)

**Created:**
```
web/vitest.config.ts
web/src/test/setup.ts
web/src/__tests__/api.test.ts
web/src/__tests__/App.test.tsx
web/src/components/__tests__/DomainExpandToast.test.tsx
web/src/components/__tests__/Screener.test.tsx
web/src/components/__tests__/WelcomeTour.test.tsx
web/src/components/__tests__/Sidebar.test.tsx
web/src/components/__tests__/MailboxManager.test.tsx
```

**Modified:**
```
web/package.json    (devDeps + scripts)
.omc/project-memory.json    (test= line includes web)
```

---

## Task 1: Install Vitest toolchain in web/

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Add devDependencies and scripts to `web/package.json`**

Open [web/package.json](web/package.json) and update so it reads exactly:

```json
{
  "name": "@zerospam/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@zerospam/shared-api": "0.1.0",
    "@tiptap/extension-link": "^3.22.5",
    "@tiptap/extension-placeholder": "^3.22.5",
    "@tiptap/extension-underline": "^3.22.5",
    "@tiptap/react": "^3.22.5",
    "@tiptap/starter-kit": "^3.22.5",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "@vitest/coverage-v8": "^2.1.9",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm install
```

Expected: lockfile updates, no errors. Vitest pulls in compatible peer deps.

- [ ] **Step 3: Confirm install — verify Vitest binary is reachable**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npx --workspace=web vitest --version
```

Expected: prints a `2.x.y` version, exits 0.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/package.json package-lock.json && git commit -m "test(web): add vitest + RTL devDeps and scripts"
```

---

## Task 2: Vitest config + setup file (proven by an empty harness run)

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`

- [ ] **Step 1: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
```

- [ ] **Step 2: Create `web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Run the empty harness**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web
```

Expected: exits 0 with output similar to `No test files found`. (Vitest treats no-matches as success unless `--passWithNoTests` is false; if your version errors out, the next task adds a real test which will resolve it — proceed regardless.)

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/vitest.config.ts web/src/test/setup.ts && git commit -m "test(web): vitest config + RTL setup file"
```

---

## Task 3: Test `web/src/api.ts` (fetch wrapper)

**Files:**
- Create: `web/src/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/__tests__/api.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../api';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function lastCall(fetchMock: FetchMock) {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  const [url, init] = call as [string, RequestInit];
  return { url: String(url), init: init ?? {} };
}

describe('api wrapper', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mailboxes() GETs /api/mailboxes and returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, address: 'a@x' }]));
    const out = await api.mailboxes();
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes');
    expect(init.method).toBe('GET');
    expect(out).toEqual([{ id: 1, address: 'a@x' }]);
  });

  it('createMailbox() POSTs JSON body to /api/mailboxes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: 7 }));
    await api.createMailbox({ address: 'b@y', displayName: 'B', quarantineTtlHours: 24 });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      address: 'b@y',
      displayName: 'B',
      quarantineTtlHours: 24,
    });
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('patchMailbox() PATCHes /api/mailboxes/:id with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.patchMailbox(42, { screenerSlaHours: 48 });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes/42');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ screenerSlaHours: 48 });
  });

  it('deleteMailbox() DELETEs /api/mailboxes/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.deleteMailbox(42);
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes/42');
    expect(init.method).toBe('DELETE');
  });

  it('screenerList() GETs /api/screener?mailbox_id=:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await api.screenerList(7);
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener?mailbox_id=7');
    expect(init.method).toBe('GET');
  });

  it('screenerAllow() POSTs body { mailbox_id, sender_address }', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ moved: 2, sender_address: 's@x', domain: 'x', suggest_domain_expand: false }),
    );
    await api.screenerAllow(7, 's@x');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/allow');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, sender_address: 's@x' });
  });

  it('screenerAllowDomain() POSTs body { mailbox_id, domain }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ moved: 5 }));
    await api.screenerAllowDomain(7, 'work.dev');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/allow-domain');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, domain: 'work.dev' });
  });

  it('screenerReject() POSTs body { mailbox_id, sender_address }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ trashed: 1 }));
    await api.screenerReject(7, 's@x');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/reject');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, sender_address: 's@x' });
  });

  it('tourComplete() POSTs /api/users/me/tour-complete with no body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.tourComplete();
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/users/me/tour-complete');
    expect(init.method).toBe('POST');
    expect(init.body == null).toBe(true);
  });

  it('throws when response is non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(api.mailboxes()).rejects.toThrow();
  });

  it('translates 401 into an unauthorized error with status=401', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'no' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(api.mailboxes()).rejects.toMatchObject({
      message: 'unauthorized',
      status: 401,
    });
  });
});
```

- [ ] **Step 2: Run test to verify failures pre-anything (sanity)**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/__tests__/api.test.ts
```

Expected: PASS — there's no implementation work needed; we're testing existing code. If any test fails, that's the bug to investigate before continuing.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/__tests__/api.test.ts && git commit -m "test(web): cover api.ts wrapper (urls, methods, bodies, error mapping)"
```

---

## Task 4: Test `DomainExpandToast.tsx`

**Files:**
- Create: `web/src/components/__tests__/DomainExpandToast.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/components/__tests__/DomainExpandToast.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DomainExpandToast from '../DomainExpandToast';

vi.mock('../../api', () => ({
  api: {
    screenerAllowDomain: vi.fn(),
  },
}));

import { api } from '../../api';

describe('DomainExpandToast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the domain in the prompt', () => {
    render(
      <DomainExpandToast
        mailboxId={1}
        domain="work.dev"
        onClose={() => {}}
        onChanged={() => {}}
      />,
    );
    expect(screen.getByText(/Trusted this sender\. Expand to everyone at @work\.dev/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trust everyone @work\.dev/ })).toBeInTheDocument();
  });

  it('clicking "Trust everyone" calls api.screenerAllowDomain and shows confirmation', async () => {
    vi.mocked(api.screenerAllowDomain).mockResolvedValue({ moved: 5 } as any);
    const onChanged = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={() => {}} onChanged={onChanged} />,
    );

    await user.click(screen.getByRole('button', { name: /Trust everyone @work\.dev/ }));

    expect(api.screenerAllowDomain).toHaveBeenCalledWith(1, 'work.dev');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Moved 5 messages from @work.dev')).toBeInTheDocument();
  });

  it('"Dismiss" calls onClose without calling the api', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={onClose} onChanged={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.screenerAllowDomain).not.toHaveBeenCalled();
  });

  it('auto-closes after the 5s idle timeout', () => {
    const onClose = vi.fn();
    render(
      <DomainExpandToast mailboxId={1} domain="work.dev" onClose={onClose} onChanged={() => {}} />,
    );
    vi.advanceTimersByTime(4999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/components/__tests__/DomainExpandToast.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/components/__tests__/DomainExpandToast.test.tsx && git commit -m "test(web): cover DomainExpandToast (allow, dismiss, auto-close)"
```

---

## Task 5: Test `Screener.tsx`

**Files:**
- Create: `web/src/components/__tests__/Screener.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/components/__tests__/Screener.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Screener from '../Screener';
import type { ScreenerSender } from '../../types';

vi.mock('../../api', () => ({
  api: {
    screenerList: vi.fn(),
    screenerAllow: vi.fn(),
    screenerReject: vi.fn(),
  },
}));

import { api } from '../../api';

function senderRow(over: Partial<ScreenerSender> = {}): ScreenerSender {
  return {
    address: 'sarah@work.dev',
    name: 'Sarah Q',
    message_count: 2,
    latest_subject: 'Hello',
    latest_preview: 'preview text',
    latest_received_at: Date.now(),
    messages: [
      { id: 'm1', received_at: Date.now(), read: 0, subject: 'Hello', preview: 'preview text' },
      { id: 'm2', received_at: Date.now() - 60000, read: 1, subject: 'Older', preview: 'older preview' },
    ],
    ...over,
  } as ScreenerSender;
}

describe('Screener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when the screener queue is empty', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([]);
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    expect(await screen.findByText(/No new senders in your Screener queue\./)).toBeInTheDocument();
  });

  it('renders a sender row with name, subject, preview, and message count', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    expect(await screen.findByText('Sarah Q')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/preview text/)).toBeInTheDocument();
    expect(screen.getByText(/2 messages/)).toBeInTheDocument();
  });

  it('clicking "Yes" calls api.screenerAllow + onChanged and triggers domain-expand suggestion when server says so', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerAllow).mockResolvedValue({
      moved: 2,
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: true,
    } as any);
    const onChanged = vi.fn();
    const onSuggest = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={onChanged}
        onSuggestDomainExpand={onSuggest}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /Yes/ }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalledWith(1, 'sarah@work.dev'));
    expect(onChanged).toHaveBeenCalled();
    expect(onSuggest).toHaveBeenCalledWith({ mailboxId: 1, domain: 'work.dev' });
  });

  it('does NOT trigger onSuggestDomainExpand when server says suggest_domain_expand=false', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerAllow).mockResolvedValue({
      moved: 1,
      sender_address: 'sarah@work.dev',
      domain: 'work.dev',
      suggest_domain_expand: false,
    } as any);
    const onSuggest = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={onSuggest}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /Yes/ }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalled());
    expect(onSuggest).not.toHaveBeenCalled();
  });

  it('clicking "No" calls api.screenerReject and onChanged', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    vi.mocked(api.screenerReject).mockResolvedValue({ trashed: 1 } as any);
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={onChanged}
        onSuggestDomainExpand={() => {}}
      />,
    );
    await screen.findByText('Sarah Q');
    await user.click(screen.getByRole('button', { name: /No/ }));
    await waitFor(() => expect(api.screenerReject).toHaveBeenCalledWith(1, 'sarah@work.dev'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('"Done for now" calls onDoneForNow', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([]);
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={onDone}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Done for now/ }));
    expect(onDone).toHaveBeenCalled();
  });

  it('expands a sender row to show individual messages', async () => {
    vi.mocked(api.screenerList).mockResolvedValue([senderRow()]);
    const user = userEvent.setup();
    render(
      <Screener
        mailboxId={1}
        onDoneForNow={() => {}}
        onChanged={() => {}}
        onSuggestDomainExpand={() => {}}
      />,
    );
    const senderButton = await screen.findByRole('button', { name: /Sarah Q/ });
    await user.click(senderButton);
    const article = senderButton.closest('article')!;
    expect(within(article).getByText('Older')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/components/__tests__/Screener.test.tsx
```

Expected: PASS (7 tests).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/components/__tests__/Screener.test.tsx && git commit -m "test(web): cover Screener (empty, render, allow/reject, suggest, expand)"
```

---

## Task 6: Test `WelcomeTour.tsx`

**Files:**
- Create: `web/src/components/__tests__/WelcomeTour.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/components/__tests__/WelcomeTour.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WelcomeTour from '../WelcomeTour';

vi.mock('../../api', () => ({
  api: {
    tourComplete: vi.fn(),
  },
}));

import { api } from '../../api';

describe('WelcomeTour', () => {
  beforeEach(() => {
    vi.mocked(api.tourComplete).mockResolvedValue({ ok: true } as any);
    vi.clearAllMocks();
  });

  it('renders step 1/4 on mount', () => {
    render(<WelcomeTour onClose={() => {}} />);
    expect(screen.getByText(/Welcome tour 1\/4/)).toBeInTheDocument();
    expect(screen.getByText(/Daily 30-second triage/)).toBeInTheDocument();
  });

  it('"Next" advances forward and "Back" returns', async () => {
    const user = userEvent.setup();
    render(<WelcomeTour onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText(/Welcome tour 2\/4/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing gets lost/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(screen.getByText(/Welcome tour 1\/4/)).toBeInTheDocument();
  });

  it('"Skip tour" calls api.tourComplete and onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeTour onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /Skip tour/ }));
    await waitFor(() => expect(api.tourComplete).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('reaching the last step shows "Done", which finishes the tour', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WelcomeTour onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 2/4
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 3/4
    await user.click(screen.getByRole('button', { name: /^Next$/ })); // 4/4
    expect(screen.getByText(/Welcome tour 4\/4/)).toBeInTheDocument();
    const done = screen.getByRole('button', { name: /^Done$/ });
    await user.click(done);
    await waitFor(() => expect(api.tourComplete).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/components/__tests__/WelcomeTour.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/components/__tests__/WelcomeTour.test.tsx && git commit -m "test(web): cover WelcomeTour (steps, skip, done)"
```

---

## Task 7: Test `Sidebar.tsx`

**Files:**
- Create: `web/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/components/__tests__/Sidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../Sidebar';
import type { Counts } from '../../types';

const noop = () => {};

const counts: Counts = {
  screener: { total: 3, unread: 0 },
  inbox: { total: 10, unread: 4 },
  quarantine: { total: 5, unread: 2 },
  sent: { total: 2, unread: 0 },
  drafts: { total: 1, unread: 0 },
  trash: { total: 0, unread: 0 },
} as Counts;

function renderSidebar(over: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <Sidebar
      counts={counts}
      folder="inbox"
      onFolder={over.onFolder ?? noop}
      onCompose={over.onCompose ?? noop}
      onWhitelist={over.onWhitelist ?? noop}
      onInject={over.onInject ?? noop}
      onPurge={over.onPurge ?? noop}
      onDkim={over.onDkim ?? noop}
      onAliases={over.onAliases ?? noop}
      {...over}
    />,
  );
}

describe('Sidebar', () => {
  it('renders all folder entries including Screener', () => {
    renderSidebar();
    for (const label of ['Screener', 'Inbox', 'Quarantine', 'Sent', 'Drafts', 'Trash']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('shows the unread badge when a folder has unread items', () => {
    renderSidebar();
    const inboxBtn = screen.getByRole('button', { name: /Inbox/ });
    expect(inboxBtn).toHaveTextContent('4');
  });

  it('shows total when unread is zero but total > 0', () => {
    renderSidebar();
    const sentBtn = screen.getByRole('button', { name: /Sent/ });
    expect(sentBtn).toHaveTextContent('2');
  });

  it('clicking a folder calls onFolder with that key', async () => {
    const onFolder = vi.fn();
    renderSidebar({ onFolder });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Quarantine/ }));
    expect(onFolder).toHaveBeenCalledWith('quarantine');
  });

  it('clicking Compose calls onCompose', async () => {
    const onCompose = vi.fn();
    renderSidebar({ onCompose });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Compose/ }));
    expect(onCompose).toHaveBeenCalled();
  });

  it('Tools buttons each call their respective handler', async () => {
    const onWhitelist = vi.fn();
    const onAliases = vi.fn();
    const onInject = vi.fn();
    const onDkim = vi.fn();
    const onPurge = vi.fn();
    renderSidebar({ onWhitelist, onAliases, onInject, onDkim, onPurge });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Whitelist/ }));
    await user.click(screen.getByRole('button', { name: /Aliases/ }));
    await user.click(screen.getByRole('button', { name: /Test Injector/ }));
    await user.click(screen.getByRole('button', { name: /DKIM \/ DNS/ }));
    await user.click(screen.getByRole('button', { name: /Purge Quarantine/ }));
    expect(onWhitelist).toHaveBeenCalled();
    expect(onAliases).toHaveBeenCalled();
    expect(onInject).toHaveBeenCalled();
    expect(onDkim).toHaveBeenCalled();
    expect(onPurge).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/components/__tests__/Sidebar.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/components/__tests__/Sidebar.test.tsx && git commit -m "test(web): cover Sidebar (folders, counts, tools)"
```

---

## Task 8: Test `MailboxManager.tsx`

**Files:**
- Create: `web/src/components/__tests__/MailboxManager.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/components/__tests__/MailboxManager.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MailboxManager from '../MailboxManager';
import type { Mailbox } from '../../types';

vi.mock('../../api', () => ({
  api: {
    mailboxes: vi.fn(),
    createMailbox: vi.fn(),
    patchMailbox: vi.fn(),
    deleteMailbox: vi.fn(),
  },
}));

import { api } from '../../api';

function fakeMailbox(over: Partial<Mailbox> = {}): Mailbox {
  return {
    id: 1,
    address: 'alice@example.com',
    display_name: 'Alice',
    quarantine_ttl_hours: 168,
    screener_sla_hours: 48,
    digest_enabled: 0,
    digest_hour: 9,
    digest_recipient_mode: 'external',
    owner_email: null,
    digest_last_error: null,
    last_digest_sent_at: null,
    account_id: 1,
    created_at: 0,
  } as Mailbox;
}

describe('MailboxManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.mailboxes).mockResolvedValue([fakeMailbox()]);
    vi.mocked(api.createMailbox).mockResolvedValue({ ok: true, id: 2 } as any);
    vi.mocked(api.patchMailbox).mockResolvedValue({ ok: true } as any);
    vi.mocked(api.deleteMailbox).mockResolvedValue({ ok: true } as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders existing mailboxes from api.mailboxes()', async () => {
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('creating a mailbox calls api.createMailbox with the form values and onChanged', async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={onChanged} />);
    await screen.findByText('alice@example.com');

    await user.type(screen.getByPlaceholderText(/alice@yourdomain\.co/), 'bob@example.com');
    await user.type(screen.getByPlaceholderText(/display name/), 'Bob');
    const ttlInput = screen.getByLabelText(/New mailbox quarantine TTL in hours/);
    await user.clear(ttlInput);
    await user.type(ttlInput, '24');
    await user.click(screen.getByRole('button', { name: /Create mailbox/ }));

    await waitFor(() =>
      expect(api.createMailbox).toHaveBeenCalledWith({
        address: 'bob@example.com',
        displayName: 'Bob',
        quarantineTtlHours: 24,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('clicking Create with empty address does NOT call api', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByRole('button', { name: /Create mailbox/ }));
    expect(api.createMailbox).not.toHaveBeenCalled();
  });

  it('blurring the screener-SLA input PATCHes screenerSlaHours', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    const slaInput = screen.getByLabelText(/Screener SLA hours/);
    await user.clear(slaInput);
    await user.type(slaInput, '24');
    slaInput.blur();
    await waitFor(() =>
      expect(api.patchMailbox).toHaveBeenCalledWith(1, { screenerSlaHours: 24 }),
    );
  });

  it('blurring the quarantine-TTL input PATCHes quarantineTtlHours', async () => {
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    const ttlInput = screen.getByLabelText(/Quarantine TTL hours/);
    await user.clear(ttlInput);
    await user.type(ttlInput, '72');
    ttlInput.blur();
    await waitFor(() =>
      expect(api.patchMailbox).toHaveBeenCalledWith(1, { quarantineTtlHours: 72 }),
    );
  });

  it('delete confirms and calls api.deleteMailbox + onChanged', async () => {
    const onChanged = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={onChanged} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle(/Delete mailbox \+ all mail/));
    await waitFor(() => expect(api.deleteMailbox).toHaveBeenCalledWith(1));
    expect(onChanged).toHaveBeenCalled();
  });

  it('delete cancellation does NOT call api', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<MailboxManager onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle(/Delete mailbox \+ all mail/));
    expect(api.deleteMailbox).not.toHaveBeenCalled();
  });

  it('clicking the close button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MailboxManager onClose={onClose} onChanged={() => {}} />);
    await screen.findByText('alice@example.com');
    await user.click(screen.getByTitle('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/components/__tests__/MailboxManager.test.tsx
```

Expected: PASS (8 tests).

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/components/__tests__/MailboxManager.test.tsx && git commit -m "test(web): cover MailboxManager (list, create, patch, delete)"
```

---

## Task 9: Smoke test `App.tsx`

**Files:**
- Create: `web/src/__tests__/App.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// web/src/__tests__/App.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

vi.mock('../api', () => ({
  api: {
    authMe: vi.fn(),
    mailboxes: vi.fn(),
  },
  subscribeEvents: vi.fn(() => () => {}),
}));

import { api } from '../api';

describe('App (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.mailboxes).mockResolvedValue([]);
  });

  it('renders the LoginForm when authMe rejects (unauthenticated)', async () => {
    vi.mocked(api.authMe).mockRejectedValue(new Error('unauthorized'));
    render(<App />);
    // LoginForm has a Sign in button or similar — wait for it to appear.
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web -- src/__tests__/App.test.tsx
```

Expected: PASS (1 test). If the assertion text doesn't match LoginForm's actual button (case differences), open [web/src/components/LoginForm.tsx](web/src/components/LoginForm.tsx) and adjust the matcher to a unique label that actually exists — do NOT add new behavior to LoginForm to make the test pass.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add web/src/__tests__/App.test.tsx && git commit -m "test(web): smoke test App renders LoginForm when unauthenticated"
```

---

## Task 10: Full-suite green + project memory update

**Files:**
- Modify: `.omc/project-memory.json` (the `test=` line under Project Environment)

- [ ] **Step 1: Run the full web suite**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run test:run --workspace=web
```

Expected: all 8 test files pass (api + 7 component/App). Note the totals.

- [ ] **Step 2: Run the server suite to confirm we did not regress it**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm test --workspace=server 2>&1 | tail -10
```

Expected: 40 files / 202 tests still pass.

- [ ] **Step 3: Run the web build to confirm typecheck still passes**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm run build --workspace=web 2>&1 | tail -5
```

Expected: clean Vite build, no TypeScript errors.

- [ ] **Step 4: Update project memory `test=` line**

Open [.omc/project-memory.json](.omc/project-memory.json) and change the existing `test=` value from:
```
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm test --workspace=server 2>&1 | tail -25
```
to:
```
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && npm test --workspace=server 2>&1 | tail -25 && npm run test:run --workspace=web 2>&1 | tail -25
```

(Leave the `build=` line unchanged.)

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/sreek/myprojects/ZeroSpam Email" && git add .omc/project-memory.json && git commit -m "chore(memory): include web vitest in default test command"
```

---

## Self-review checklist (post-write)

- [x] **Spec coverage:** every modified/added web file has a test task (`api.ts` → Task 3, `Screener.tsx` → 5, `WelcomeTour.tsx` → 6, `DomainExpandToast.tsx` → 4, `Sidebar.tsx` → 7, `MailboxManager.tsx` → 8, `App.tsx` → 9). `styles.css` and `types.ts` are excluded by spec (CSS / types-only).
- [x] **No placeholders:** every step has concrete code or commands, no "fill in".
- [x] **Type consistency:** `api` mock shape (`{ api: { ... } }`) is identical across all component tests; `screenerList` / `screenerAllow` / `screenerReject` / `screenerAllowDomain` / `tourComplete` / `mailboxes` / `createMailbox` / `patchMailbox` / `deleteMailbox` / `authMe` match the real exports in [web/src/api.ts](web/src/api.ts).
- [x] **Spec drift acknowledged:** the three reality-vs-spec clarifications are stated up front, not silently absorbed.
