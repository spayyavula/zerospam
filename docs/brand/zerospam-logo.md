# ZeroSpam — Logo System

> **Status:** v1, dated 2026-05-02. Pairs with [Reading Room brand vibe v2](zerospam-vibe.md).
> Every variant follows the same single idea — *italic typographic form + the yellow dot*. Don't add a fifth variant; refine these.

## The concept — "The Stamp"

ZeroSpam doesn't need a new mascot. The brand is already in the wordmark: italic Source Serif, yellow dot punctuation, deep ink on cream paper. The logo system is a tight family of stamps that all carry the same DNA — a piece of italic type, the yellow dot.

The dot is the brand. Every variant places it in service of the typography around it.

## The four variants

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. WORDMARK         Zero·Spam               primary, horizontal     │
│ 2. MONOGRAM         z.                      tight horizontal slots  │
│ 3. SEAL             [○ z·]                  app icon, brand stamp   │
│ 4. FAVICON          [▢ Z·]                  16-32px UI chrome       │
└─────────────────────────────────────────────────────────────────────┘
```

| Variant | File | Use |
|---|---|---|
| Wordmark | [logo-wordmark.svg](logo-wordmark.svg) | Marketing headers, footers, presentations, business cards, anywhere with horizontal real estate ≥ 120px. |
| Monogram | [logo-monogram.svg](logo-monogram.svg) | CLI splash, tight UI like a sidebar collapse state, condensed lockups, single-letter signatures. |
| Seal | [logo-seal.svg](logo-seal.svg) | App icon (iOS/Android wrapper adds 22% radius), brand stamp on collateral, social-card corner mark. Works at 96–1024px. |
| Favicon | [favicon.svg](favicon.svg) | Browser tab, mobile bookmark, 16–32px. Simplified for tiny sizes. |

See all four in context: [logo-showcase.html](logo-showcase.html).

## Construction — Wordmark

```
   Zero · Spam
   ─┬──   ─┬──
    │      │
    └──────┴── Source Serif 4 Italic, weight 500, letter-spacing -0.015em

         ·
         └─── Yellow dot (#FFD52E), diameter = 0.18em (cap height ÷ 4.5)
              Vertical position: optical center of x-height, ~0.32em below cap top
              Horizontal: 0.18em margin on each side (optical, not metric)
```

**Construction rules:**

1. The wordmark is set in **Source Serif 4 Italic, weight 500** at any size. Never roman, never weight ≠ 500 (the variable axis stays locked here even if other UI uses other weights).
2. Letter-spacing: `-0.015em`. Source Serif's italic is slightly loose at small sizes; this tightens it.
3. **The dot is a perfect circle**, not a typographic glyph. Diameter = `0.18em` of the cap height. Color `#FFD52E`. It replaces a U+00B7 middle dot — but rendered as `<circle>`, not text.
4. Dot vertical position: optical center of the x-height, NOT geometric center of the cap height. This usually lands about `0.32em` below cap top. If it looks too low, raise it `~1px` — trust the eye.
5. Dot horizontal margin: `0.18em` on each side from the adjacent letterforms. This is OPTICAL — measure to the apparent edge of the "o" and "S", not the bounding box.
6. Word-pair "Zero" and "Spam" both have ascenders/descenders (the "p" descends). Vertical centerline is the cap baseline; the descender is allowed to drop below the lockup baseline.

**Sizes (recommended):**

| Context | Pixel size (cap height) | Notes |
|---|---|---|
| Email header | 28–32px | Crisp at body resolutions |
| Marketing header | 36–48px | Standard web hero |
| Print masthead | 14pt minimum | Below this, the dot loses presence |
| Business card | 18–22pt | With monogram lockup as alternative |

**Minimum size:** 14pt print / 18px screen cap-height. Below this, switch to the monogram.

## Construction — Monogram

```
   z·
   ─┬─
    │
    └─── Source Serif 4 Italic, weight 500. Lowercase z chosen because
         italic lowercase z has a characteristic descender curl that reads
         distinctly even at small sizes.

   ·
   └─── Yellow dot, same construction as the wordmark dot.
        Position: baseline-right of the "z", with a 0.16em gap to the
        z's right-most curve. Acts as a period to the "z[ero]." abbreviation.
```

**Rules:**

- Always lowercase. Uppercase Z is reserved for the favicon (where it scales better at tiny sizes).
- Always italic. Roman z is forbidden — it loses the brand DNA.
- The dot sits on the baseline, not in the middle. This reinforces "z." as a sentence-end abbreviation.

**Minimum size:** 32px (the curl on the descender needs at least that much resolution to read).

## Construction — Seal

```
        ╭───────────╮
       ╱             ╲
      ╱     ___       ╲
     │     /  /         │      Solid ink disc (#0A0A0A)
     │    / Z          ●│      Cut-out italic Z in cream (#FBF8F1)
     │   /             ╲│      Yellow dot (#FFD52E) inside the disc
      ╲               ╱        at lower-right, optically anchored
       ╲             ╱
        ╰───────────╯
```

**Rules:**

- The disc is a perfect circle. No outline, no inner shadow, no gradient.
- The Z is **lowercase italic** Source Serif 4 — same as the monogram, but cut out of the disc (the cream paper shows through).
- The Z is sized at ~50% of the disc diameter. Optical centering — not geometric — accounts for the italic lean (shift 2-3% right of true center).
- The yellow dot lives **inside the disc**, at lower-right, sized at ~9% of the disc diameter. It's anchored ~70% from disc-center along a 30°-down-from-east radial.
- For app icons (iOS/Android), the disc is wrapped in a rounded square at 22% corner radius (Apple's icon grid). The disc inside still has its full circular form — don't crop.

**Variants:**

- **Default seal**: ink disc, cream Z cut-out, yellow dot. Use everywhere.
- **Reversed seal** (when placed on yellow surfaces): cream disc, ink Z, ink dot (yellow can't sit on yellow).
- **Monochrome seal** (single-color print, embossing, etching): ink disc, cream cut-out, NO yellow dot — replace with an embossed/scored circle of equal size in the same ink. This is the "no-yellow-available" fallback for print.

**Minimum size:** 24px. Below that, switch to the favicon.

## Construction — Favicon

```
   ┌───────────┐
   │           │
   │    Z   ●  │     Solid ink rounded square (8% corner radius — gentler than Apple's
   │           │     22% because the favicon canvas is much smaller and aggressive radius eats glyph space)
   └───────────┘     Italic Z in cream, weight 600 (heavier than monogram for legibility at tiny sizes)
                     Yellow dot at upper-right, sized for visibility at 16px
```

**Why uppercase Z, why bolder weight:**

At 16px, the lowercase italic z's descender curl turns into mush. Uppercase Z preserves the italic angle while keeping the strokes thick enough to render at favicon scale. We bump weight to 600 (Source Serif 4 italic) for the same reason — the italic axis at weight 500 is too thin at 16px.

**Rules:**

- Rounded square (corner radius 8% of width), not circle. Browsers and OS bookmarks handle squares better; circles get cropped to invisible nothing.
- Z is optically centered. Yellow dot lives upper-right inside the square, NOT outside.
- At sizes ≥ 64px, the favicon and the seal converge — use the seal.

## Color rules

The four variants follow the same color logic:

| Surface | Wordmark / Monogram type color | Dot color |
|---|---|---|
| Cream paper (`#FBF8F1`) | `--ink` (`#0A0A0A`) | `--signal` yellow (`#FFD52E`) |
| Paper-deep (`#F5EFE3`) | `--ink` | `--signal` yellow |
| Ink (`#0A0A0A`) | `--paper` cream | `--signal` yellow |
| Yellow (`#FFD52E`) | `--ink` | `--ink` (NEVER yellow on yellow) |
| Photography (use sparingly) | `--paper` cream with subtle drop-shadow | `--signal` yellow |

**Strict rules:**

1. **The dot is yellow.** Always. Except when the surface IS yellow, in which case the dot becomes ink. There is no third variant.
2. **The dot is never outlined.** No stroke. No glow. No drop shadow. It's a flat circle.
3. **The dot is never replaced.** Not with a heart. Not with a star. Not with a bullet. Not with an asterisk. The dot is the brand — keeping it pure is the entire point.
4. **The type is always italic Source Serif 4 weight 500** (or 600 for the favicon, where weight bumps for legibility). Roman is forbidden across all variants.

## Clear-space rules (Apple-style)

Around any logo variant, reserve clear space equal to **one dot diameter** on all four sides. Nothing else may enter that zone — no rules, no other type, no UI chrome.

```
  ┌─────────────────────────────┐
  │   ●                         │   ← top clear space = 1 dot
  │                             │
  │ ●  Zero · Spam            ● │   ← left/right clear space = 1 dot
  │                             │
  │                         ●   │   ← bottom clear space = 1 dot
  └─────────────────────────────┘
```

For the seal/favicon, the dot diameter is calculated from the dot inside the seal itself.

## Lockups

### Stacked (vertical)

For social cards, business cards, T-shirts, anywhere vertical breathing room is generous:

```
       ●
      ╱ ╲
     │ z │
      ╲ ╱
       ●
   Zero·Spam
   ─────────
   whitelist-first email
```

- Seal at the top.
- Wordmark below at 30% of seal diameter as cap height.
- A `--rule` 1px hairline below the wordmark, edge-to-edge with the wordmark width.
- Tagline in mono small caps below the rule, 50% of wordmark cap height: `WHITELIST-FIRST EMAIL`.
- Vertical spacing: clear-space dot between every element.

### Horizontal lockup

For navigation bars, document headers, email signatures:

```
     ●
    ╱ ╲
   │ z │   Zero·Spam
    ╲ ╱   ─────────
     ●    whitelist-first email
```

- Seal on the left, vertically centered.
- Wordmark on the right, with a hairline below and the mono tagline below the hairline.
- Seal diameter = wordmark cap height × 2.4.

## Minimum sizes (recap)

| Variant | Minimum size |
|---|---|
| Wordmark | 14pt print / 18px screen cap-height |
| Monogram | 32px |
| Seal | 24px (smaller → use favicon) |
| Favicon | 16px |

## Don'ts

These are the anti-patterns that would erode the brand:

- ✗ Replace the yellow dot with a heart, star, asterisk, or any other glyph.
- ✗ Outline the dot, add a stroke, drop-shadow, or gradient to it.
- ✗ Recolor the dot to anything other than yellow (or ink-on-yellow).
- ✗ Use a roman (non-italic) Z, z, "Zero", or "Spam".
- ✗ Use a different serif family for the wordmark — Source Serif 4 is the only family.
- ✗ Stretch, condense, or skew the wordmark. The italic angle is built in; don't double it.
- ✗ Place the seal on a busy photographic background without a paper-cream backdrop.
- ✗ Add a tagline beside the wordmark on the same line. Taglines go below, separated by a rule.
- ✗ Animate the wordmark or the dot, except as part of the brand-vibe page-load reveal (one yellow underline-wipe under "by invitation" — see [zerospam-vibe.md](zerospam-vibe.md)).
- ✗ Wrap the wordmark in a box, badge, or pill. It stands on its own.
- ✗ Use the seal as a decorative pattern (tiled background, repeating watermark).

## Production notes

The SVGs in this directory use `<text>` elements that depend on Source Serif 4 being loaded. For production deployment:

- **Web:** load Source Serif 4 via Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@1,8..60,500')`) before serving SVGs that contain `<text>`.
- **Static export (PNG, PDF, print):** the `<text>` glyphs need to be **outlined to paths** before export, otherwise the renderer falls back to the system serif. Use a designer tool (Figma, Affinity, Illustrator) to convert text → path on a final-asset pass. The shipped SVGs in this directory are *reference* assets; for hard production output, request outlined versions.
- **Email signatures and other contexts that don't render webfonts:** use the seal or favicon (raster PNG export at 2x) instead of the wordmark, since those tolerate font fallback gracefully.

## Versioning

This is **v1**, dated 2026-05-02. Pairs with [Reading Room brand vibe v2](zerospam-vibe.md). If the brand vibe departs from Reading Room (cream + Source Serif + yellow dot), the logo system is invalidated and a new file (`zerospam-logo-v2.md`) replaces this one.
