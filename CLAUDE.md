# CLAUDE.md — Monkeyscript Repo Instructions

## Ground selectors in the actual DOM (REQUIRED, do this FIRST)

Before writing any selector or extraction code for a new script, you MUST
have a real sample of the target DOM in front of you.  Selectors written
from assumptions about UI copy, page layout, or "how this kind of page
usually looks" fail constantly and waste an iteration.

This bit us on `claude-usage-rate`: the first version assumed the row
would be labeled "5-hour window" (from product/marketing language).  The
actual on-page text was "Current session", and the reset format was
"Resets in 3 hr 42 min" / "Resets Mon 1:00 PM" — not the "3h 42m"
shorthand we'd assumed.  Every selector in v1.0.0 missed.  Pay the
round-trip cost up front instead.

### If you can't see the page directly, ASK

For any site you can't directly inspect (auth-walled like `claude.ai`,
private repos, internal tools, sites behind login), ASK the user for
one of these before writing code, in order of preference:

1. **A real DOM excerpt** from DevTools (Inspect the element → Edit as
   HTML → copy).  Shows exact tag names, attributes, parent structure.
2. **A screenshot** of the page.  Reveals exact on-page labels and
   approximate structure.  Often enough.
3. **Raw HTML** via `curl` / `WebFetch` (only for un-authenticated pages).

Sample ask:

> "I can't see the DOM at <url> directly.  Can you paste the relevant
> HTML from DevTools (Inspect → Edit as HTML → copy), or send a
> screenshot?  I'll write the selectors against that."

### Do NOT extrapolate selectors from

- **Product feature names** — "5-hour usage window" was rendered as
  "Current session" in the actual DOM.
- **Phrasing of the user's request** — the user describing the feature
  one way doesn't mean the page text matches that phrasing.
- **How a similar page used to look** — selectors rot; don't trust
  memory.
- **What "makes sense" structurally** — frameworks insert wrappers,
  flex/grid layouts collapse expectations.

## Defensive selector handling (REQUIRED)

Every userscript in this repo runs against third-party sites whose DOM,
URL params, and class names change without notice.  When a selector
silently fails the user sees no behavior at all and has no way to know
why.  This has burned us repeatedly.

**Every script in this repo MUST surface a clear, visible error when its
critical selectors stop matching.**  Apply this to every userscript you
add or modify here, no exceptions.

### Rules

1. **Identify each "critical selector"** — anything whose failure means
   the script's core feature does nothing.  This includes CSS selectors,
   URL parameter names, attribute lookups, and aria-label text patterns.

2. **Detect failure explicitly.**  Don't rely on silent `null` returns.
   After retries / observers settle, check whether the selector actually
   produced data, and branch on the failure case.

3. **Surface failures two ways:**
   - **A red dismissible banner** fixed top-right of the page (the
     `showSelectorError(missing)` pattern in this repo's existing
     scripts).  The banner names the script, lists the missing
     selectors / params, and tells the user the site DOM has likely
     changed.
   - **A structured `console.error`** with `{ url, missing, hint }` so
     the user can paste it into a bug report.

4. **Use stable selectors first.**  Prefer in this order:
   `data-testid` → `componentkey` → `aria-label` patterns →
   semantic tags (`<a href>`, `<p>`) → obfuscated class names (last
   resort, treat as known-fragile).

5. **Always include fallbacks.**  Keep the legacy class-based
   selectors alongside new ones — sites occasionally revert.  But put
   the most stable selector first.

6. **Cache successful extractions.**  If a script computes a result
   from the DOM (e.g. a tab title), cache it so it can be re-applied
   on `visibilitychange` / `pageshow` without re-querying the DOM.

7. **Bump the script version** (`@version`) on any change.  Without a
   version bump, Violentmonkey/Tampermonkey won't pull the update.

8. **Add `@updateURL` and `@downloadURL`** to every new script,
   pointing at the raw GitHub URL on `main`.  Without these, the
   script can't auto-update.

9. **Prefer text-anchor walk-up over heading or class matching.**
   When matching a row/card with no `data-testid`/`aria` hooks,
   anchor on a stable functional text token that appears in every
   target instance ("Resets", "Reply", "min ago", a unit like "%"
   or "$"), use a TreeWalker over `SHOW_TEXT` to find each text
   node, then walk *up* the DOM to find the smallest ancestor that
   also contains the other tokens you need.  This is more durable
   than "find the heading and walk up" because product copy changes
   more often than functional text — "5-hour window" became
   "Current session", but "Resets" stayed put.  Reference:
   `claude-usage-rate/claude-usage-rate.user.js` (`findUsageRows`).

### Reference implementations

The `showSelectorError(missing)` helper is inlined in each script.
See `linkedin-post-titles/linkedin-post-titles.user.js` for the
canonical version: red banner with close button, structured
`console.error`, and explicit failure detection after extraction
retries are exhausted.

## Git hygiene

- Never use `git add -A` or `git add .` blindly.  Add specific files.
- Never include self-attribution (no `Co-Authored-By: Claude`, etc.)
  in commit messages.
- Don't commit `.DS_Store` or other OS / editor artifacts.
