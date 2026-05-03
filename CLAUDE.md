# CLAUDE.md — Monkeyscript Repo Instructions

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
