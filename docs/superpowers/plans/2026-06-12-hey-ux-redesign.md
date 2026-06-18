# Hey-style Webmail Redesign (Ink & Signal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the ZeroSpam webmail in the **Ink & Signal** editorial style and adopt the highest-impact Hey patterns — top nav (`Inbox · Screener · Sent`), sender-grouped message list, single-column focus reading, and a **one-at-a-time Screener** — keeping the name "Inbox" and changing **no backend**.

**Architecture:** Pure frontend change in `web/`. Make the existing "Reading Room" CSS-variable tokens (`--paper`, `--ink`, `--signal`, …) **theme-aware** (light "paper" default + dark "Ink" variant) via the existing `data-theme` switch, then restyle/rework four components. The Screener reuses the existing `api.screenerList/screenerAllow/screenerReject`. No API or schema changes.

**Tech Stack:** React + TypeScript (Vite), Tailwind (CSS-variable colors), Vitest + Testing Library, lucide-react icons.

**Conventions:** Web tests run with `npm test --workspace=web` (Vitest). Run a single file with `npx vitest run web/src/<path>`. Theme is a `data-theme` attribute on `<html>` driven by `web/src/hooks/useTheme.ts`. Spec: `docs/superpowers/specs/2026-06-12-hey-ux-redesign-design.md`.

---

## File Structure

**Modify:**
- `web/src/styles.css` — make Reading-Room tokens theme-aware; add dark "Ink" values
- `web/index.html` — default `data-theme` to `light` (paper)
- `web/src/hooks/useTheme.ts` — default theme `light`
- `web/src/components/Sidebar.tsx` — becomes the horizontal editorial **TopNav**
- `web/src/App.tsx` — use TopNav (horizontal) instead of left aside; wire labels
- `web/src/components/MessageList.tsx` — Ink & Signal rows + sender grouping
- `web/src/components/ReadingPane.tsx` — single-column focus read
- `web/src/components/Screener.tsx` — one-at-a-time focus flow

**Create:**
- `web/src/utils/groupBySender.ts` — pure grouping helper (+ test)
- `web/src/utils/__tests__/groupBySender.test.ts`

**Touch (tests):**
- `web/src/components/__tests__/Sidebar.test.tsx`, `Screener.test.tsx`, and `web/src/__tests__/App.test.tsx` as noted per task.

> Note: `Sidebar.tsx` keeps its filename (to minimize churn and keep imports stable) but is restructured into a top nav. If the team prefers, it can be renamed `TopNav.tsx` later; this plan keeps the filename.

---

## Task 1: Make the Ink & Signal tokens theme-aware (paper default + dark Ink)

Today `--paper/--ink/--signal/...` are defined only in `:root` (always light) and the app default theme is `dark`. Move them into both theme blocks and default to light.

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/index.html`
- Modify: `web/src/hooks/useTheme.ts`
- Test: `web/src/hooks/__tests__/useTheme.test.ts` (create)

- [ ] **Step 1: Write the failing test for the default theme**

Create `web/src/hooks/__tests__/useTheme.test.ts`:
```ts
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
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run web/src/hooks/__tests__/useTheme.test.ts`
Expected: FAIL — current default is `'dark'`.

- [ ] **Step 3: Flip the default in `useTheme.ts`**

In `web/src/hooks/useTheme.ts`, change the fallback in `readTheme`:
```ts
  return 'dark';
```
to:
```ts
  return 'light';
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run web/src/hooks/__tests__/useTheme.test.ts`
Expected: PASS.

- [ ] **Step 5: Default the pre-paint script in `index.html` to light**

In `web/index.html`, the inline script resolves the theme before paint. Find the block (around lines 11–24) and make the fallback `light`. Replace the resolution so an unset preference yields `light`:
```html
    <script>
      (function () {
        try {
          var saved = localStorage.getItem('zs-theme');
          var theme = saved === 'dark' || saved === 'light' ? saved : 'light';
          document.documentElement.dataset.theme = theme;
        } catch (e) {
          document.documentElement.dataset.theme = 'light';
        }
      })();
    </script>
```
(Match the existing script's exact variable names if they differ; the only behavioral change is the fallback `'light'`.)

- [ ] **Step 6: Make the Reading-Room tokens theme-aware in `styles.css`**

In `web/src/styles.css`, **remove** the Reading-Room block from `:root` (the lines from `/* Reading Room v2 ... */` through `--font-mono: ...;`) and instead define the **semantic** tokens inside each theme block. Add to the existing `:root[data-theme='light']` block:
```css
  /* Ink & Signal — light "paper" */
  --paper: #FBF8F1;
  --paper-deep: #F5EFE3;
  --ink: #0A0A0A;
  --ink-soft: #2A2A2A;
  --quiet: #6B6863;
  --rule: #E8E1D2;
  --rule-strong: #1F1F1F;
  --signal: #FFD52E;
  --signal-ink: #7A5C00;
```
Add a new dark block right after it:
```css
:root[data-theme='dark'] {
  /* Ink & Signal — dark "ink" */
  --paper: #0E0E0C;
  --paper-deep: #16160F;
  --ink: #F3EFE4;
  --ink-soft: #CFC9BC;
  --quiet: #9A958A;
  --rule: #2A2A26;
  --rule-strong: #F3EFE4;
  --signal: #FFD52E;
  --signal-ink: #0E0E0C;
}
```
Keep the font-family custom properties in `:root` (they don't change per theme):
```css
:root {
  --font-display: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
  --font-body: 'Geist', 'Helvetica Neue', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```

- [ ] **Step 7: Verify build + full web suite**

Run: `npm run build --workspace=web` (expect: builds clean)
Run: `npm test --workspace=web` (expect: existing suite + the new useTheme test pass)

- [ ] **Step 8: Commit**

```bash
git add web/src/styles.css web/index.html web/src/hooks/useTheme.ts web/src/hooks/__tests__/useTheme.test.ts
git commit -m "feat(web): theme-aware Ink & Signal tokens; default to paper (light)"
```

---

## Task 2: Sender-grouping helper (pure, tested)

A small pure function the message list uses to group the already-fetched messages by sender (most-recent first). Logic first, UI in Task 4.

**Files:**
- Create: `web/src/utils/groupBySender.ts`
- Test: `web/src/utils/__tests__/groupBySender.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/utils/__tests__/groupBySender.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { groupBySender, type GroupableMessage } from '../groupBySender';

const m = (id: string, from: string, at: number, name?: string): GroupableMessage =>
  ({ id, from_address: from, from_name: name ?? null, received_at: at } as GroupableMessage);

describe('groupBySender', () => {
  it('groups messages by from_address, newest message first within a group', () => {
    const groups = groupBySender([
      m('1', 'a@x.com', 100),
      m('2', 'b@y.com', 300),
      m('3', 'a@x.com', 500, 'Alpha'),
    ]);
    expect(groups.map((g) => g.address)).toEqual(['a@x.com', 'b@y.com']); // a’s latest (500) is newest
    expect(groups[0].messages.map((x) => x.id)).toEqual(['3', '1']);      // newest-first within group
    expect(groups[0].name).toBe('Alpha');                                  // prefers a non-null name
    expect(groups[0].latestReceivedAt).toBe(500);
  });

  it('is case-insensitive on the address', () => {
    const groups = groupBySender([m('1', 'A@X.com', 1), m('2', 'a@x.com', 2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].messages).toHaveLength(2);
  });

  it('returns [] for no messages', () => {
    expect(groupBySender([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run web/src/utils/__tests__/groupBySender.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `groupBySender.ts`**

Create `web/src/utils/groupBySender.ts`:
```ts
export type GroupableMessage = {
  id: string;
  from_address: string;
  from_name: string | null;
  received_at: number;
};

export type SenderGroup<T extends GroupableMessage> = {
  address: string;        // lowercased key
  name: string | null;    // first non-null from_name seen
  messages: T[];          // newest-first
  latestReceivedAt: number;
};

/** Group messages by lowercased from_address. Groups and the messages inside
 *  them are both ordered newest-first. Pure; does not mutate the input. */
export function groupBySender<T extends GroupableMessage>(messages: T[]): SenderGroup<T>[] {
  const byAddr = new Map<string, SenderGroup<T>>();
  for (const msg of messages) {
    const key = msg.from_address.toLowerCase();
    let g = byAddr.get(key);
    if (!g) {
      g = { address: key, name: msg.from_name, messages: [], latestReceivedAt: 0 };
      byAddr.set(key, g);
    }
    if (!g.name && msg.from_name) g.name = msg.from_name;
    g.messages.push(msg);
    if (msg.received_at > g.latestReceivedAt) g.latestReceivedAt = msg.received_at;
  }
  for (const g of byAddr.values()) {
    g.messages.sort((a, b) => b.received_at - a.received_at);
  }
  return [...byAddr.values()].sort((a, b) => b.latestReceivedAt - a.latestReceivedAt);
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run web/src/utils/__tests__/groupBySender.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/utils/groupBySender.ts web/src/utils/__tests__/groupBySender.test.ts
git commit -m "feat(web): groupBySender helper for the message list"
```

---

## Task 3: Top nav (restyle `Sidebar` → horizontal editorial nav)

Convert the left `<aside>` into a horizontal top nav showing the primary destinations `Inbox · Screener · Sent`, with the existing secondary actions (Compose, Whitelist, Inject, Purge, DKIM, Aliases) moved into an overflow menu. Ink & Signal styling.

**Files:**
- Modify: `web/src/components/Sidebar.tsx`
- Modify: `web/src/App.tsx` (layout: render nav across the top, content below)
- Test: `web/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Update the test to assert the new nav contract**

Open `web/src/components/__tests__/Sidebar.test.tsx`. Ensure it asserts: the three primary items render and clicking calls `onFolder` with the right key. Replace the body with:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

const noop = () => {};
const baseProps = {
  counts: {
    screener: { total: 2, unread: 0 }, inbox: { total: 0, unread: 0 },
    quarantine: { total: 0, unread: 0 }, sent: { total: 0, unread: 0 },
    drafts: { total: 0, unread: 0 }, trash: { total: 0, unread: 0 },
  } as any,
  folder: 'inbox' as const,
  onFolder: vi.fn(),
  onCompose: noop, onWhitelist: noop, onInject: noop, onPurge: noop, onDkim: noop, onAliases: noop,
};

describe('Sidebar (top nav)', () => {
  it('renders Inbox, Screener, Sent as primary nav', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByRole('button', { name: /inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /screener/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sent/i })).toBeInTheDocument();
  });

  it('calls onFolder when a primary item is clicked', () => {
    const onFolder = vi.fn();
    render(<Sidebar {...baseProps} onFolder={onFolder} />);
    fireEvent.click(screen.getByRole('button', { name: /screener/i }));
    expect(onFolder).toHaveBeenCalledWith('screener');
  });

  it('shows the Screener count badge', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run web/src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL (old markup / roles differ).

- [ ] **Step 3: Restructure `Sidebar.tsx` into a top nav**

Rewrite `web/src/components/Sidebar.tsx`. Keep the same `Props`. Render a horizontal bar: Wordmark on the left, primary nav (`Inbox · Screener · Sent`) center/left, secondary actions in a "More" overflow on the right. Use Ink & Signal tokens (`bg-paper text-ink`, `border-rule-strong`, mono labels, `bg-signal` badge). Primary items are `<button>`s calling `onFolder`. Skeleton:
```tsx
import { useState } from 'react';
import { ChevronDown, PenLine } from 'lucide-react';
import type { Counts, SidebarFolder } from '../types';

const PRIMARY: { key: SidebarFolder; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'screener', label: 'Screener' },
  { key: 'sent', label: 'Sent' },
];

type Props = {
  counts: Counts | null;
  folder: SidebarFolder;
  onFolder: (f: SidebarFolder) => void;
  onCompose: () => void;
  onWhitelist: () => void;
  onInject: () => void;
  onPurge: () => void;
  onDkim: () => void;
  onAliases: () => void;
};

export default function Sidebar(p: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const screenerCount = p.counts?.screener?.total ?? 0; // Counts.screener is { total, unread }
  return (
    <nav className="flex items-center gap-6 px-6 h-14 bg-paper border-b-2 border-rule-strong text-ink">
      <span className="font-display font-bold tracking-tight select-none">Zero·Spam</span>
      <div className="flex items-center gap-5 font-mono text-[11px] tracking-[0.12em] uppercase">
        {PRIMARY.map(({ key, label }) => {
          const active = p.folder === key;
          return (
            <button
              key={key}
              onClick={() => p.onFolder(key)}
              aria-current={active ? 'page' : undefined}
              className={active ? 'text-ink border-b-2 border-ink pb-0.5' : 'text-quiet hover:text-ink'}
            >
              {label}
              {key === 'screener' && screenerCount > 0 && (
                <span className="ml-1.5 bg-signal text-signal-ink rounded-full px-1.5 py-px text-[10px] align-middle">
                  {screenerCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <button onClick={p.onCompose} className="font-mono text-[11px] tracking-[0.1em] uppercase bg-signal text-signal-ink border-2 border-rule-strong px-3 py-1.5 inline-flex items-center gap-1">
        <PenLine className="w-3.5 h-3.5" /> Compose
      </button>
      <div className="relative">
        <button onClick={() => setMoreOpen((v) => !v)} className="font-mono text-[11px] tracking-[0.1em] uppercase text-quiet hover:text-ink inline-flex items-center gap-1">
          More <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moreOpen && (
          <div className="absolute right-0 top-full mt-1 bg-paper border-2 border-rule-strong min-w-[180px] z-30 text-sm">
            {[
              ['Quarantine', () => p.onFolder('quarantine')],
              ['Drafts', () => p.onFolder('drafts')],
              ['Trash', () => p.onFolder('trash')],
              ['Whitelist', p.onWhitelist],
              ['Aliases', p.onAliases],
              ['DKIM / DNS', p.onDkim],
              ['Test injector', p.onInject],
              ['Purge', p.onPurge],
            ].map(([label, fn]) => (
              <button key={label as string} onClick={() => { setMoreOpen(false); (fn as () => void)(); }}
                className="block w-full text-left px-3 py-2 hover:bg-paper-deep text-ink">
                {label as string}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Update `App.tsx` layout to render the nav on top**

In `web/src/App.tsx`, the root currently places `<Sidebar />` as a left column in a horizontal flex. Change the outer layout to a vertical stack: nav on top, the existing content row below. Find the JSX where `<Sidebar ... />` is rendered inside a `flex` row and move it so the structure is:
```tsx
<div className="h-screen flex flex-col bg-paper text-ink">
  <Sidebar counts={counts} folder={folder} onFolder={setFolder}
    onCompose={...} onWhitelist={...} onInject={...} onPurge={...} onDkim={...} onAliases={...} />
  <div className="flex-1 min-h-0 flex">
    {/* existing MessageList + right panel row stays here */}
  </div>
</div>
```
Keep all existing handlers/props exactly as they are wired today — only the DOM nesting changes (Sidebar moves from a left column to a full-width top row). Remove the old `w-56` left-column wrapper if present.

- [ ] **Step 5: Run nav test + full suite**

Run: `npx vitest run web/src/components/__tests__/Sidebar.test.tsx` (expect PASS)
Run: `npm test --workspace=web` (expect: App test still passes; if `App.test` asserted the old left-aside structure, update those assertions to match the top-nav layout — keep behavioral assertions, drop layout-coupled ones.)

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Sidebar.tsx web/src/App.tsx web/src/components/__tests__/Sidebar.test.tsx web/src/__tests__/App.test.tsx
git commit -m "feat(web): horizontal editorial top nav (Inbox · Screener · Sent)"
```

---

## Task 4: MessageList — Ink & Signal rows + sender grouping

Restyle the message list to Ink & Signal and group rows by sender using `groupBySender`.

**Files:**
- Modify: `web/src/components/MessageList.tsx`

- [ ] **Step 1: Wire grouping**

At the top of the list render in `MessageList.tsx`, import and apply the helper to the messages it already receives:
```tsx
import { groupBySender } from '../utils/groupBySender';
// ...inside the component, where `messages` is the array it maps today:
const groups = groupBySender(messages);
```
Render one block per group: a serif sender name header + that sender's messages as rows. Preserve the existing selection behavior (`onSelect(message.id)` / `selectedId`) and unread state per message — do not change the data flow, only the markup/grouping.

- [ ] **Step 2: Apply Ink & Signal row markup**

Each row: a `font-mono` index or unread `bg-signal` dot, a serif (`font-display`) sender name (at the group header), sans `text-quiet` subject/preview, `border-t border-rule` dividers, `bg-paper` surface, hover `bg-paper-deep`. Selected row: `border-l-2 border-rule-strong`. Use the existing message fields (`from_name`, `from_address`, `subject`, `preview`, `received_at`, `read`). Keep it a single scroll column.

- [ ] **Step 3: Acceptance check (run the app)**

Run the web dev server and the API (see project run instructions) and confirm: the Inbox shows messages grouped under serif sender names; unread rows show the yellow dot; clicking a row still opens it in the reading pane; light + dark both legible (toggle theme).
Run: `npm test --workspace=web` — existing MessageList/App tests pass (update any markup-coupled assertions to the new structure; keep behavioral ones like "clicking a row calls onSelect").

- [ ] **Step 4: Commit**

```bash
git add web/src/components/MessageList.tsx
git commit -m "feat(web): Ink & Signal message rows grouped by sender"
```

---

## Task 5: ReadingPane — single-column focus read

Restyle the reading pane into a centered single-column read: serif headline (subject), sans body with a comfortable measure, mono meta line, and a `TRUSTED`/signal chip when the sender is whitelisted.

**Files:**
- Modify: `web/src/components/ReadingPane.tsx`

- [ ] **Step 1: Restyle to single column**

Wrap the message body in a centered column: `max-w-[68ch] mx-auto px-6`. Subject as `font-display text-2xl`. A meta row under a `border-b-2 border-rule-strong`: yellow dot, sender name (serif), `font-mono text-[10px] text-quiet` address + time, and a right-aligned `bg-signal text-signal-ink font-mono` chip reading `TRUSTED` when `msg.whitelist_match` is truthy (the component already computes `const isTrust = !!msg.whitelist_match`). Body: `font-body text-[15px] leading-7 text-ink-soft`. Keep all existing actions (reply, trust-sender, attachments, etc.) — only restyle; do not remove behavior.

- [ ] **Step 2: Acceptance check**

In the running app, open a message: confirm the centered single-column read, serif subject, comfortable line length, and that reply / trust-sender / attachment actions still work in both themes.
Run: `npm test --workspace=web` — keep behavioral tests green; update markup-coupled assertions.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ReadingPane.tsx
git commit -m "feat(web): single-column focus reading view"
```

---

## Task 6: Screener — one-at-a-time focus flow

Rework the Screener from a list into a **one-at-a-time** focus flow, reusing the existing APIs (`api.screenerList`, `api.screenerAllow`, `api.screenerReject`) and the `ScreenerSender` type. Show one pending sender with its preview; **Yes** allows + advances, **No** rejects + advances; show progress and an empty state.

**Files:**
- Modify: `web/src/components/Screener.tsx`
- Test: `web/src/components/__tests__/Screener.test.tsx`

- [ ] **Step 1: Rewrite the Screener test for the one-at-a-time contract**

Replace `web/src/components/__tests__/Screener.test.tsx` with:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Screener from '../Screener';
import { api } from '../../api';

vi.mock('../../api', () => ({
  api: {
    screenerList: vi.fn(),
    screenerAllow: vi.fn().mockResolvedValue({}),
    screenerReject: vi.fn().mockResolvedValue({}),
  },
}));

const sender = (address: string, subject: string) => ({
  address, name: null, message_count: 1, latest_received_at: Date.now(),
  latest_subject: subject, latest_preview: 'preview', messages: [],
});

beforeEach(() => vi.clearAllMocks());

describe('Screener (one-at-a-time)', () => {
  it('shows one sender at a time with progress', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    expect(await screen.findByText('a@x.com')).toBeInTheDocument();
    expect(screen.queryByText('b@y.com')).not.toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it('Yes allows the sender and advances to the next', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    await screen.findByText('a@x.com');
    fireEvent.click(screen.getByRole('button', { name: /yes/i }));
    await waitFor(() => expect(api.screenerAllow).toHaveBeenCalledWith(1, 'a@x.com'));
    expect(await screen.findByText('b@y.com')).toBeInTheDocument();
  });

  it('No rejects the sender and advances', async () => {
    (api.screenerList as any).mockResolvedValue([sender('a@x.com', 'First'), sender('b@y.com', 'Second')]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    await screen.findByText('a@x.com');
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    await waitFor(() => expect(api.screenerReject).toHaveBeenCalledWith(1, 'a@x.com'));
    expect(await screen.findByText('b@y.com')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to screen', async () => {
    (api.screenerList as any).mockResolvedValue([]);
    render(<Screener mailboxId={1} onDoneForNow={() => {}} onChanged={() => {}} onSuggestDomainExpand={() => {}} />);
    expect(await screen.findByText(/all clear|nothing to screen|inbox zero/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run web/src/components/__tests__/Screener.test.tsx`
Expected: FAIL — current Screener renders all rows at once and has no progress indicator.

- [ ] **Step 3: Rewrite `Screener.tsx` as a one-at-a-time flow**

Replace `web/src/components/Screener.tsx` with (reuses the same Props, APIs, and `ScreenerSender` type):
```tsx
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../api';
import type { ScreenerSender } from '../types';

type Props = {
  mailboxId: number;
  onDoneForNow: () => void;
  onChanged: () => void;
  onSuggestDomainExpand: (payload: { mailboxId: number; domain: string }) => void;
};

export default function Screener({ mailboxId, onDoneForNow, onChanged, onSuggestDomainExpand }: Props) {
  const [queue, setQueue] = useState<ScreenerSender[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    api.screenerList(mailboxId).then((rows) => {
      if (!alive) return;
      setQueue(rows);
      setIdx(0);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [mailboxId]);

  const current = queue[idx];
  const advance = () => setIdx((i) => i + 1);

  const decide = async (kind: 'allow' | 'reject') => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (kind === 'allow') {
        const r = await api.screenerAllow(mailboxId, current.address);
        if (r?.suggest_domain_expand && r.domain) onSuggestDomainExpand({ mailboxId, domain: r.domain });
      } else {
        await api.screenerReject(mailboxId, current.address);
      }
      onChanged();
      advance();
    } catch {
      // leave the card in place on error
    } finally {
      setBusy(false);
    }
  };

  const total = queue.length;
  const done = loaded && (total === 0 || idx >= total);

  return (
    <section className="flex-1 min-w-0 bg-paper text-ink flex flex-col">
      <div className="h-14 px-6 border-b-2 border-rule-strong flex items-center">
        <span className="font-display text-xl font-semibold">The Screener</span>
        {total > 0 && !done && (
          <span className="ml-3 font-mono text-[11px] tracking-[0.1em] text-quiet">{idx + 1} / {total}</span>
        )}
        <div className="flex-1" />
        <button onClick={onDoneForNow} className="font-mono text-[11px] tracking-[0.1em] uppercase text-quiet hover:text-ink">
          Done for now
        </button>
      </div>

      <div className="flex-1 grid place-items-center p-8">
        {!loaded ? null : done ? (
          <div className="text-center">
            <div className="font-display text-2xl mb-1">All clear.</div>
            <div className="font-mono text-[11px] tracking-[0.1em] text-quiet uppercase">Nothing to screen</div>
          </div>
        ) : (
          <div className="w-full max-w-[560px]">
            <div className="font-mono text-[11px] tracking-[0.1em] text-quiet uppercase mb-2">Wants into your Inbox</div>
            <div className="font-display text-3xl leading-tight">{current.name || current.address}</div>
            <div className="font-mono text-[11px] text-quiet mt-1">{current.address} · {current.message_count} message{current.message_count === 1 ? '' : 's'} waiting</div>
            <div className="border-t-2 border-rule-strong mt-5 pt-5">
              <div className="font-display text-lg">{current.latest_subject || '(no subject)'}</div>
              <div className="font-body text-[14px] leading-7 text-ink-soft mt-2">{current.latest_preview || '(no preview)'}</div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button
                disabled={busy}
                onClick={() => decide('allow')}
                className="font-mono text-[11px] tracking-[0.12em] uppercase bg-signal text-signal-ink border-2 border-rule-strong px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Check className="w-4 h-4" /> Yes → Inbox
              </button>
              <button
                disabled={busy}
                onClick={() => decide('reject')}
                className="font-mono text-[11px] tracking-[0.12em] uppercase border-2 border-rule-strong px-5 py-2.5 inline-flex items-center gap-2 hover:bg-paper-deep disabled:opacity-60"
              >
                <X className="w-4 h-4" /> No
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the Screener test — expect PASS**

Run: `npx vitest run web/src/components/__tests__/Screener.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Full suite + typecheck + build**

Run: `npm test --workspace=web` (all pass)
Run: `npm run build --workspace=web` (clean)

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Screener.tsx web/src/components/__tests__/Screener.test.tsx
git commit -m "feat(web): one-at-a-time Screener focus flow"
```

---

## Task 7: Final visual pass + verification

**Files:** none required; small polish only if needed (`LoginForm`, `Landing` already lean editorial).

- [ ] **Step 1: Run the app end-to-end**

Start the API + web dev server (project run instructions). Walk the flow in **both themes** (toggle): Inbox (grouped rows) → open a message (single-column read) → Screener (Yes one, No one, reach "All clear"). Confirm legibility, the yellow signal usage, and that the top nav reflects the active destination.

- [ ] **Step 2: Screenshot both themes** (Inbox + Screener) and eyeball contrast — verify yellow chips keep readable ink-colored text in dark mode.

- [ ] **Step 3: Full gate**

Run: `npm test --workspace=web` (all pass)
Run: `npm run build --workspace=web` (clean)

- [ ] **Step 4: Commit any polish**

```bash
git add -A web/
git commit -m "polish(web): Ink & Signal redesign final pass"
```

---

## Final verification (whole plan)

- [ ] `npm test --workspace=web` — all green (new: useTheme, groupBySender, Sidebar nav, Screener one-at-a-time).
- [ ] `npm run build --workspace=web` — builds clean.
- [ ] Manual: Inbox grouped, single-column read, one-at-a-time Screener, both themes legible.
- [ ] Spec coverage: tokens/dark variant (Task 1) · sender grouping (Tasks 2,4) · top nav + Inbox label (Task 3) · single-column read (Task 5) · one-at-a-time Screener reusing existing APIs (Task 6) · backend untouched (no server files modified in any task).
