# ZeroSpam — Brand Vibe v1

> **Status:** approved direction (2026-05-02). Drives all subsequent frontend-design work.

## The one-line vibe

A private members' broadsheet for your inbox. Hairline rules, italic display serif, mono technical footnotes — a single acid-coral accent that only fires on signal moments (allow, trust, approve). Confident and quiet. Reading-room calm with newspaper sharpness.

## Why this vibe

ZeroSpam is whitelist-first. The product position is *the inbox is yours; the rest expires*. That is closer to a curated reading list than a real-time feed. The aesthetic answers it directly:

- **Editorial** — the inbox is read, not consumed. Serif display, generous negative space, hairlines, mono notations like a typeset footnote.
- **Brutalist** — restraint with visible structure. Type does work; layout doesn't decorate. A hairline rule is a real boundary, not a stylistic shrug.
- **Members' club** — calm, terse, slightly dry. No SaaS exclamation points. Welcomes you in; doesn't sell at you.

What we are explicitly not:

- Generic indie SaaS gradient soup.
- Purple-on-white "AI productivity" aesthetic.
- Bauhaus primary colors.
- Cute illustrations of envelopes.
- Glassmorphism. Neumorphism.
- Comic Sans-of-the-month variable display fonts (Fraunces, DM Serif Display, Space Grotesk).

## Palette

### Core

| Token | Hex | Notes |
|---|---|---|
| `--ink` | `#0E0F12` | Near-black with a hint of indigo. Body text, headlines, hairlines on light. |
| `--bone` | `#F2EDE4` | Warm off-white. Default page surface. NOT pure white. |
| `--paper` | `#FAF7F1` | Marginally lighter bone for cards / elevated surfaces. |
| `--quiet` | `#5C5A57` | Warm charcoal. Body copy at relaxed weight, secondary text. |
| `--rule` | `#E2DCD0` | Hairline rule color on light surfaces. |
| `--rule-dark` | `#1F2026` | Hairline on dark surfaces. |

### Signal (use sparingly)

| Token | Hex | Reserved for |
|---|---|---|
| `--signal` | `#FF4D2E` | The one warm, confident accent. **Only** on allow / trust / approve / "yes" actions, primary CTAs, and active-state markers. Earn this color. |
| `--signal-ink` | `#7A1F0E` | Signal text on bone background where pure `--signal` would be too loud. |

### Dark variant

| Token | Hex | Notes |
|---|---|---|
| `--ink-dark` | `#0A0B0E` | Page surface. |
| `--paper-dark` | `#15171C` | Elevated surfaces. |
| `--bone-dark` | `#E8E2D5` | Warm-bone foreground (NOT `#fff`). |
| `--quiet-dark` | `#807C75` | Secondary text. |

### Strict rules

1. The signal coral never sits next to itself. One `--signal` per visual region; if you need two, you're using it wrong.
2. Pure black (`#000`) and pure white (`#fff`) are forbidden — they look cheap. Always `--ink` and `--bone`.
3. No gradients on UI surfaces. A subtle paper texture / grain overlay is allowed (and encouraged) for atmosphere; gradients are not.
4. The accent is reserved for verbs the user owns ("allow", "trust", "approve") and for the wordmark — never decoration.

## Typography

### Stack

| Role | Family | Source | Why |
|---|---|---|---|
| Display | **Instrument Serif** | Google Fonts | High-contrast classical serif with personality. Italic carries the wordmark. |
| Body | **Geist** | Google Fonts | Clean, characterful neo-grotesque. Distinct from Inter without being eccentric. |
| Mono | **JetBrains Mono** | Google Fonts | Mono labels, technical metadata, address strings. |

CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
--font-body: 'Geist', 'Helvetica Neue', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

### Scale

```
Display XL   72/0.95   Instrument Serif italic    -- hero headlines, one per page
Display L    52/1.00   Instrument Serif italic    -- section openings
Display M    36/1.05   Instrument Serif           -- subhead, no italic
Body L       18/1.55   Geist 400                  -- lede paragraphs
Body         16/1.6    Geist 400                  -- default
Body S       14/1.5    Geist 400                  -- meta, captions
Mono S       12/1.4    JetBrains Mono 500, 0.05em -- technical labels, IDs
Mono XS      11/1.3    JetBrains Mono 500, 0.08em -- footnote markers
```

### Rules

- Wordmark **always uses italic Instrument Serif**: *ZeroSpam*. Never set the wordmark in Geist.
- Italic is assertive — used for emphasis, the wordmark, and most display headlines. Don't be precious.
- Mono labels are SMALL CAPS in spirit (real `text-transform: uppercase` + `letter-spacing: 0.08em`).
- Body copy never goes below 14px. Mono captions can.
- Numerals: tabular for any UI showing counts or times.

## Layout vocabulary

- **Asymmetric, broadsheet-derived grids.** 12-col with deliberate empty columns. Hero copy doesn't have to start at col 1.
- **Hairlines do real work.** Not decoration — boundaries. `1px solid var(--rule)`. No 3px borders. No box-shadows pretending to be borders.
- **Marginalia.** Mono technical labels live in the margin of headings: `// 01 — invitation only`. They look like printer's notes.
- **One bold image moment per section, max.** No gallery walls.
- **Tight hairline cards** beat soft drop-shadow cards. If a card needs elevation, use a darker rule on two sides, not a blur.
- **Diagonal flow allowed.** Hero copy can hard-left, with a mono caption hard-right. The negative space between is the design.

## Motion

Restraint. Motion punctuates; it doesn't perform.

- **Page load:** one staggered reveal of the hero block, ~120ms cascade across 4–5 elements. Easing: `cubic-bezier(0.2, 0.7, 0.1, 1)` (gentle out). Total: under 600ms.
- **Hover on interactive elements:** 150ms color transition, no transform.
- **Signal moments only:** the coral accent can briefly grow (≤4% scale, 180ms) on click — that is the only "celebration" in the system.
- **Forbidden:** floating cards, parallax, looping marquees, page-load curtains, any motion longer than 600ms outside a deliberate animated illustration.
- **Reduced motion:** all of the above is gated on `prefers-reduced-motion: no-preference`. Reduced motion = instant.

## Voice

- **Short. Declarative.** "Default-deny." not "We default-deny so that...".
- **Quiet wit.** Footnote-style asides in mono. ("// you can always say no.")
- **No exclamation points.** Ever.
- **No "powerful", "seamless", "revolutionary".** Ever.
- **Address the reader directly.** "You", not "users".
- **Numbers earn their keep.** Specific over hand-wavy. "168h TTL" not "auto-expires".

### Sample voice

> ZeroSpam is whitelist-first email.  
> *Your inbox is by invitation.*  
> Everything else expires.

> // 02 — the screener  
> A new sender shows up. Yes or no?  
> Yes lets them through. No mutes them for 30 days.  
> That's the entire interaction model.

## Iconography

- Hairline icons only. 1.5px stroke at 24px. Use [Lucide](https://lucide.dev/) (already a dependency) — but **never filled, never two-tone**.
- One symbol the brand reuses: a thin solid square `▪` for list bullets and footnote markers — typewriter-style, not Unicode bullet `•`.

## Imagery

- No stock photography. No generated images of "happy team members".
- Type-as-image is preferred — oversized italic display set as the visual centerpiece.
- If photography is used: black & white, high grain, editorial. Treat like a cover photo, not decoration.

## What "good" looks like

A landing hero where:

1. The wordmark *ZeroSpam* sits italic, large, top-left. A mono caption (`// est. 2026 — by invitation only`) hard-right.
2. A 90-character italic display headline takes the next line, breaking across the grid.
3. A single 16px Geist paragraph below at column 5–9 (deliberate indent — the marginalia is the structure).
4. One CTA button — flat, hairline border, mono label `[ Get an invite ▸ ]`. Hover fills with `--signal`.
5. A single hairline rule beneath, edge to edge. Below it, three lines of mono metadata: `01 — default-deny inbox` / `02 — quarantine that expires` / `03 — you own the guest list`.
6. Bone background, ink type, signal coral only on the wordmark dot and the CTA hover state.

Reference implementation lives at [hero-mockup.html](hero-mockup.html). Open it in any browser; it is self-contained.

## Component sketches (to be expanded by /frontend-design)

These are seeded — final versions emerge from the next /frontend-design pass.

- **Button (primary):** `1px solid var(--ink)`, transparent fill, mono label. Hover: fill `--signal`, ink stays. Active: ≤4% scale + 180ms.
- **Button (ghost):** mono label, no border, underline-on-hover offset 4px.
- **Input:** no border, only an ink hairline below. Focus thickens the hairline to 2px and pushes the label up in mono.
- **Card:** hairline rule on top + bottom only. No box-shadow. Padding generous (32px / 48px).
- **Tag/pill:** mono small caps, 1px ink rule, no fill.
- **Toast:** bone surface, ink hairline, mono label, signal coral only if it's an "allow" / approve confirmation.

## Anti-patterns (do not ship)

- Drop shadows on cards.
- Pill buttons with rounded corners > 8px.
- Centered hero copy on every section.
- "Trusted by" logo strips.
- Animated counters.
- Loading spinners (use a hairline shimmer instead).
- Multi-color illustrations.
- Light-purple accent ("Linear lite").

## Versioning

This is v1, dated 2026-05-02. The next /frontend-design pass extends the component library and refines tokens — but does not change the editorial brutalism direction. If a future change needs a different vibe, that is a new file, not a rewrite of this one.
