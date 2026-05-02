# ZeroSpam — Brand Vibe v2: The Reading Room

> **Status:** approved direction (2026-05-02). Replaces v1 (Editorial Brutalism). Drives all subsequent frontend-design work.
>
> **Reference points:** Hey (37signals) for warmth + opinionated voice + sunshine yellow. Apple for typographic polish + spacious restraint + product moments. NYT for editorial serif authority + column-based hierarchy + byline-style metadata.

## The one-line vibe

A warm Sunday-paper reading room. Cream-paper background, deep-ink type, NYT-style italic serif headlines, Apple-spacious composition, and a single sunshine-yellow accent that lights up only on welcoming verbs (allow, trust, approve, invite). Confident and warm — never austere, never SaaS-cheery.

## Why this vibe

ZeroSpam's product position — *your inbox is by invitation; everything else expires* — wants three things at once:

1. **Authority** (you can trust this with your email) — NYT contributes here. Italic display serif, hard editorial rules, byline mono labels.
2. **Warmth** (this isn't another austere productivity tool) — Hey contributes here. Cream paper instead of pure white, sunshine yellow accent, opinionated friendly voice.
3. **Polish** (every detail decided) — Apple contributes here. Spacious margins, restrained CTAs, refined typographic hierarchy, one product moment per surface.

The synthesis is *editorial warmth* — a publication you'd subscribe to, run by people who clearly care.

What we are explicitly not:

- Generic indie-SaaS gradient soup (no purple, no glassmorphism).
- Bright-white pure-`#fff` Linear-clone.
- Brutalist hairline-on-stark-bone (that was v1, too cold).
- Cute envelope illustrations / 3D email mascots.
- "Trusted by" logo strips.

## Palette

### Core

| Token | Hex | Notes |
|---|---|---|
| `--paper` | `#FBF8F1` | Hey's warm cream — default page surface. NEVER pure white. |
| `--paper-deep` | `#F5EFE3` | Slightly darker cream for elevated surfaces / cards. |
| `--ink` | `#0A0A0A` | Apple-deep near-black for headlines. |
| `--ink-soft` | `#2A2A2A` | Body copy. Slightly softer than `--ink` for reading comfort. |
| `--quiet` | `#6B6863` | Warm gray for captions, secondary text. |
| `--rule` | `#E8E1D2` | Warm hairline rule on `--paper` surfaces. |
| `--rule-strong` | `#1F1F1F` | NYT-style hard ink rule — section dividers only. |

### Signal

| Token | Hex | Reserved for |
|---|---|---|
| `--signal` | `#FFD52E` | Hey-style sunshine yellow. The welcome color. **Only** on allow / trust / approve / invite verbs, primary CTA fills, active-state markers, and the wordmark dot. Yellow says *welcome*; never use it for warnings. |
| `--signal-ink` | `#7A5C00` | Yellow text on cream — where pure `--signal` would lose contrast against text-sized type. |
| `--danger` | `#B53C2F` | Crimson, used ONLY for destructive confirmations (delete, purge). Never decorative. |

### Dark mode (deferred — design once light is locked)

Reserved tokens:
- `--paper-dark`: `#161310` (warm-ink, never `#000`)
- `--ink-dark`: `#F0EBDF` (cream-on-dark, never `#fff`)

### Strict rules

1. **Pure `#fff` and `#000` are forbidden.** Always `--paper` and `--ink`. Pure white looks clinical; cream feels read.
2. **Yellow earns its keep.** One `--signal` element per visual region. If you have two yellow things, one is wrong.
3. **No gradients on UI surfaces.** A subtle paper grain overlay (~6% opacity) is encouraged for atmosphere. Gradients are not.
4. **Hard ink rules (`--rule-strong`) divide sections; hairlines (`--rule`) live within sections.** Never mix on the same boundary.

## Typography

### Stack

| Role | Family | Source | Why |
|---|---|---|---|
| Display | **Source Serif 4** | Google Fonts (variable) | Hey-signature serif. Editorial, characterful, italic carries the wordmark. |
| Body | **Geist** | Google Fonts | Apple-grade neo-grotesque. Distinguishable from Inter without eccentricity. |
| Mono | **JetBrains Mono** | Google Fonts | Byline-style technical labels, IDs, metadata. |

CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,700;1,8..60,400;1,8..60,500&family=Geist:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');

--font-display: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
--font-body:    'Geist', 'Helvetica Neue', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

### Scale

```
Display XL    96/0.95   Source Serif italic        -- hero headlines, one per page
Display L     64/1.00   Source Serif italic        -- section openings
Display M     40/1.05   Source Serif (no italic)   -- subhead
Lede          22/1.45   Source Serif 400           -- opening paragraph after a headline
Body L        18/1.6    Geist 400                  -- standard reading paragraph
Body          16/1.6    Geist 400                  -- UI / dense content
Body S        14/1.5    Geist 400                  -- captions, helpers
Mono S        12/1.4    JetBrains Mono 500, 0.06em -- byline labels, technical metadata
Mono XS       11/1.3    JetBrains Mono 500, 0.10em -- footnote markers, section IDs
```

### Rules

- Wordmark always italic Source Serif: *ZeroSpam*. The yellow dot punctuation lives between the words: *Zero·Spam* with a yellow `·`.
- Italics are assertive. Use them on the wordmark, key headlines, and emphasized phrases. Don't be precious.
- The lede paragraph (first paragraph after a hero headline) is set in Source Serif at 22/1.45 — Hey/NYT do this; it lets the type personality breathe before you switch to Geist for body.
- Mono labels are uppercase with letter-spacing (`text-transform: uppercase; letter-spacing: 0.06em`). They look like printer's notes.
- Numerals: tabular figures everywhere counts/times appear (`font-variant-numeric: tabular-nums`).
- Body copy never goes below 14px. Mono captions can.

## Layout vocabulary

- **Editorial 12-column grid.** Asymmetric placement is the rule, not the exception. Content rarely starts at column 1 unless it's a hero.
- **Generous Apple margins.** `clamp(40px, 6vw, 120px)` left/right at desktop. Verticals are even more generous — hero blocks get `clamp(80px, 12vw, 160px)` of breathing room.
- **NYT-style hard rules at section boundaries.** A 1px `--rule-strong` line between major sections, with a small mono label dropped over the rule (`SECTION 02 / WHAT YOU CONTROL`).
- **Hairlines within sections.** `1px solid var(--rule)`. Used as quiet dividers between cards or list rows.
- **Marginalia in mono.** Section IDs, bylines, dates, footnote numbers. They sit in the margin or hard against rules — they look like a typesetter's annotations, not labels.
- **One product moment per surface, max.** A stylized inbox screenshot, a magnified UI detail, a pull-quote block — pick one. Apple's pages don't have galleries; they have *the* shot.
- **Tight cards, no shadows.** Cards are bounded by hairlines on top and bottom (or all four), never by `box-shadow`. If you need elevation, switch to `--paper-deep`.

## Motion

Apple-restrained. Motion is service, not performance.

- **Page load:** one staggered reveal — wordmark, headline, lede, CTA, footer rule. ~120ms cascade. Total: under 700ms. Easing: `cubic-bezier(0.2, 0.7, 0.1, 1)` (gentle out).
- **Signal moments:** the yellow accent gets one short underline-wipe on hero headlines (300ms, `cubic-bezier(0.85, 0, 0.15, 1)`). Buttons wash to yellow on hover (200ms color transition). That's the entire animation budget.
- **Hover on interactive elements:** 180ms color transition; no transform unless on direct interaction.
- **Click feedback:** ≤2% scale-down, 150ms. Apple's restraint applies.
- **Forbidden:** parallax, looping marquees, scroll-triggered cinematic reveals, page-load curtains, any motion longer than 800ms.
- **Reduced motion:** all animations gated on `prefers-reduced-motion: no-preference`. Reduced motion = instant.

## Voice

The Hey × Apple × NYT blend, in order of priority:

1. **Hey first** — opinionated, confident, casual. Direct address. Mild humor in mono asides.
2. **Apple's restraint** — short sentences. Specific verbs. No "powerful", "seamless", "revolutionary", "experience".
3. **NYT's authority** — when stating product principles, write them like a manifesto. Declarative. No hedging.

### Strict rules

- **No exclamation points.** Ever. (Hey rule.)
- **No emoji in product copy.** (Apple rule. Hey rule.)
- **Address the reader directly.** "You", not "users".
- **Numbers are specific.** "168h TTL" not "auto-expires after a while".
- **Mono asides for the wit.** `// you can always say no.` Wit lives in the margins, not in headlines.
- **Manifesto tone in section openers.** "ZeroSpam is whitelist-first email." — period, full stop, line break, next thought.

### Sample voice

> *Your inbox is by invitation.*  
> Everything else expires.

> 01 — THE SCREENER  
> A new sender shows up. You decide.  
> Yes lets them through. No mutes them for thirty days.  
> *That's it.*

> 02 — QUARANTINE THAT EXPIRES  
> Anything not whitelisted lands in quarantine. It auto-expires on a schedule you set —  
> 168 hours by default. No backlog. No inbox debt.  
> // you set the TTL. you can always lower it.

> // 03 — by invitation only  
> ZeroSpam doesn't filter, score, or guess. It asks. You answer.

## Iconography

- Hairline icons only. 1.5px stroke at 24px. Use [Lucide](https://lucide.dev/) (already a dependency) — never filled, never two-tone.
- One brand symbol: **the yellow dot**. It punctuates the wordmark (*Zero·Spam*), sits between sentence-clauses in mono captions, and marks active items in lists. The dot is the brand.
- Bullet style: solid square `▪` (typewriter), never Unicode bullet `•`.

## Imagery

- **No stock photography.** No "happy team" shots. No abstract tech-blob illustrations.
- **Type-as-image is preferred.** Oversized italic Source Serif as the centerpiece of any section.
- **One product moment per page.** A styled inbox screenshot — actual UI, sharp pixels, no perspective tilt. Treat it like Apple treats product photography: dead-center, full-bleed, pristine.
- **If photography is used:** black and white, high grain, editorial portraiture. Not decoration.

## What "good" looks like — landing hero

1. Cream paper background (`#FBF8F1`). Subtle paper grain overlay at 6% opacity for atmosphere.
2. Top bar: wordmark *Zero·Spam* italic Source Serif 38px, the dot is the yellow accent. Mono caption hard-right: `EST · MMXXVI · BY INVITATION ONLY · vol. 01 / no. 01`. Both sit on a single hairline rule.
3. Marginalia label above the headline: `01 — DEFAULT-DENY INBOX` in mono small caps with a hairline tick.
4. Hero headline: italic Source Serif at 96px, two lines. The phrase "by invitation" carries a yellow underline that wipes in 700ms after page load.
5. Lede paragraph in Source Serif at 22/1.45, indented to columns 5–10. The lede uses serif for warmth — it's the bridge to body copy.
6. Below the lede, two sentences in Geist body. Then a primary CTA: hairline border, mono label `[ GET AN INVITE ↗ ]`. On hover, the button fills yellow and the arrow nudges 4px right.
7. A hard ink `--rule-strong` line spanning edge-to-edge, with a tiny mono label dropped over it: `THE MANUAL — 03 PRINCIPLES`.
8. Three columns under the rule, separated by hairlines. Each is a "footnote": small mono ID, italic Source Serif heading, body copy in Geist, a yellow square bullet leading the heading.
9. Footer mono colophon at the bottom — site URL, links, version.

Reference implementation lives at [hero-mockup.html](hero-mockup.html). Open it in any browser; it is self-contained.

## Component sketches (to be expanded by /frontend-design)

- **Button (primary):** `1px solid var(--ink)`, transparent fill, mono label uppercase. Hover: fill `--signal` (yellow), ink stays. Active: scale 0.98 + 150ms. Padding `14px 22px`.
- **Button (ghost / link):** mono label, no border, underline appears on hover with `text-underline-offset: 4px`.
- **Input:** no full border. Hairline below only. Focus thickens hairline to 2px and highlights the floating mono label above.
- **Card:** hairline rule on top + bottom only, generous padding (`28px 32px`). For elevation, switch to `--paper-deep` instead of adding shadow.
- **Tag/pill:** mono small caps, 1px ink rule, no fill. Active state fills `--signal` background, ink text.
- **Toast:** `--paper-deep` surface, hairline border, mono label on the left, body in Geist on the right, yellow square bullet for "allow" / approve confirmations.
- **Section divider:** `--rule-strong` 1px line, edge-to-edge, with a mono label dropped over it (label gets a `--paper` background to "punch through" the rule visually). Tone is NYT section-front.

## Anti-patterns (do not ship)

- Drop shadows on cards.
- Pill buttons with rounded corners > 8px (this is not Slack).
- Centered hero copy on every section.
- "Trusted by" logo strips.
- Animated counters / spinning numbers.
- Loading spinners. Use a hairline shimmer, paper-toned.
- Multi-color illustrations.
- Light-purple accents (this is not Linear).
- Bright pure-white backgrounds (this is not Notion).
- Yellow used for warning/danger. Yellow is welcome here.

## Versioning

This is **v2**, dated 2026-05-02. Replaces v1's editorial-brutalism direction (cream-on-coral was too austere; the user pushed toward Hey/Apple/NYT warmth). The next /frontend-design pass extends the component library — but does not change the Reading Room direction. If a future change needs a different vibe entirely, that is a new file with `-v3` suffix, not a rewrite of this one.
