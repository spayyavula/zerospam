# SEO content plan — zero-spam.email

**Status:** draft, 2026-07-11. Derived from the first Search Console export (3 months).

## The situation (why this plan exists)

The GSC data shows a site with **no organic surface area**:

- ~39 impressions / 30 days, **0 clicks**, **0 non-brand impressions**.
- Every impression is a brand query: `zerospam` (21 imp @ pos **14.7**), `zero spam` (2 @ 9.5), `0spam` (1 @ 42).
- Ranking **#14 for our own brand name** — abnormal. Likely cause: the defunct **Zerospam** email-security company (Montréal, acquired by Vade Secure) still holds authority for that exact word. Corroborated by Canada being the #2 impression country despite zero marketing there.
- Only one page indexed (the homepage).

Technical SEO is already done (prerender, canonical, OG/Twitter, `@graph` JSON-LD, robots, sitemap). **The gap is content and authority, not tags.** This plan addresses content surface area. Authority (backlinks) is tracked separately below.

## Strategy

1. **Stop fighting for the bare word "zerospam."** Own **"ZeroSpam Email" / zero-spam.email** as the distinct entity (title, `alternateName`, and `sameAs` signals already/being added).
2. **Target problem- and alternative-intent keywords** where the incumbent is absent and intent-to-try is high.
3. **Publish real pages** so there is something to rank. One homepage cannot rank for a category.

## Page backlog (priority order)

Each page = one prerendered route (extend `Root.tsx` the same way `/privacy-policy` works) with its own `<title>`, meta description, `<h1>`, and — where noted — `Article` or `FAQPage` schema.

| # | Route | Primary query | Intent | Working title |
|---|-------|--------------|--------|---------------|
| 1 | `/whitelist-email` | whitelist email / email whitelist service | commercial | Whitelist Email: Only Approved Senders Reach Your Inbox |
| 2 | `/how-to-stop-spam-before-inbox` | stop spam before it reaches inbox | informational→trial | How to Stop Spam Before It Reaches Your Inbox (Whitelist Method) |
| 3 | `/boxbe-alternative` | Boxbe alternative | high commercial | The Boxbe Alternative for Screening Unknown Senders |
| 4 | `/sanebox-alternative` | SaneBox alternative | high commercial | A Whitelist-First SaneBox Alternative |
| 5 | `/email-screener` | email screener / the screener | informational | What an Email Screener Is (and How to Use One) |
| 6 | `/block-cold-emails` | block cold emails / stop cold outreach | commercial | Block Cold Emails Automatically With a Sender Screener |
| 7 | `/how-it-works` | (supports all above; internal-link hub) | navigational | How ZeroSpam Email Works |

**Rationale for the top 3:**

- **Boxbe alternative** is the single best target: Boxbe is the closest conceptual competitor (whitelist + "Guard" screener), its product has stagnated, and "alternative" queries carry ready-to-switch intent with low competition.
- **whitelist email** is the category term that most precisely matches the product and has no incumbent tied to our brand collision.
- **stop spam before inbox** matches the exact promise in the homepage `<h1>` and the FAQ schema already shipped — reinforces relevance.

## On-page rules for each new page

- Self-contained answer in the **first 1–2 sentences** (featured-snippet + AI-summary extraction).
- One `<h1>` matching the primary query; `<h2>`s for sub-questions.
- Add each new route to `sitemap.xml` and internal-link it from the homepage and `/how-it-works`.
- Alternative pages (#3, #4): fair, factual comparison table. No disparagement — comparison pages that read as hit pieces underperform and risk the incumbent's audience bouncing.
- Add `FAQPage` schema to #1, #2, #5; `Article` schema to #2, #5.

## Non-content levers (do not skip — these are ~25% of ranking)

- **Backlinks / authority:** currently ~zero. Cheapest early wins: Product Hunt launch, an accurate entry on alternativeTo (as a Boxbe/SaneBox alternative), a founder post on relevant communities, and getting listed in "best spam filter / email screener" roundups. Track referring domains monthly.
- **Entity disambiguation:** add real `sameAs` URLs (Twitter/X, LinkedIn, GitHub) to the `Organization` schema and fix the placeholder `https://github.com` footer link in `Landing.tsx`. Both tie "ZeroSpam Email" to a distinct entity from the old Zerospam.
- **Recrawl the HTTP straggler:** once traffic warrants, request indexing of `https://zero-spam.email/` in GSC to speed consolidation of the legacy `http://` URL.

## How to measure

Re-pull the GSC export in ~30 and ~60 days and watch for the leading indicators, in order:
1. **Non-brand impressions > 0** (currently 0) — the first proof content is being seen.
2. Impressions on the target queries above.
3. Brand position for `zerospam` trending toward the top 10.
4. First clicks.

Clicks are a lagging indicator; do not judge the plan on clicks before impressions move.
