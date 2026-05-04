// ==UserScript==
// @name         LinkedIn Printable Format
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.8.1
// @description  Toggle clean, print-friendly views for LinkedIn profile detail pages and export Markdown
// @author       Raymond Peck
// @match        https://www.linkedin.com/in/*/details/*
// @match        https://www.linkedin.com/in/*/details/*/*
// @icon         https://www.linkedin.com/favicon.ico
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/rpeck/rpeck-monkeyscripts/main/linkedin-printable-format/linkedin-printable-format.user.js
// @updateURL    https://raw.githubusercontent.com/rpeck/rpeck-monkeyscripts/main/linkedin-printable-format/linkedin-printable-format.user.js
// @homepageURL  https://github.com/rpeck/rpeck-monkeyscripts/tree/main/linkedin-printable-format
// @supportURL   https://github.com/rpeck/rpeck-monkeyscripts/issues
// ==/UserScript==

(function () {
  'use strict';

  console.log('[LinkedIn Printable Format] Script loaded:', location.href, 'readyState=' + document.readyState);

  const STYLE_ID = 'linkedin-printable-format-style';
  const FORMAT_BUTTON_ID = 'linkedin-printable-format-button';
  const RESET_BUTTON_ID = 'linkedin-printable-reset-button';
  const MARKDOWN_BUTTON_ID = 'linkedin-printable-markdown-button';
  const ERROR_BANNER_ID = 'linkedin-printable-format-error-banner';
  const BODY_CLASS = 'linkedin-printable-format-mode';
  const SCRIPT_NAME = 'LinkedIn Printable Format';

  /**
   * Show a visible error banner when a critical selector fails.
   */
  function showSelectorError(missing) {
    if (document.getElementById(ERROR_BANNER_ID)) return;
    if (!document.body) return;

    console.error('[LinkedIn Printable Format] SELECTOR FAILURE', {
      url: location.href,
      missing,
      hint: 'Selectors used to locate LinkedIn detail-page content no longer match. Update the script or report at https://github.com/rpeck/rpeck-monkeyscripts/issues',
    });

    const banner = document.createElement('div');
    banner.id = ERROR_BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position: fixed', 'top: 12px', 'right: 12px', 'z-index: 2147483647',
      'max-width: 420px', 'padding: 12px 16px', 'background: #b91c1c',
      'color: #fff', 'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
      'border-radius: 6px', 'box-shadow: 0 4px 12px rgba(0,0,0,0.3)',
    ].join(';');

    const text = document.createElement('div');
    text.textContent = `${SCRIPT_NAME}: could not find ${missing.join(' or ')} \u2014 LinkedIn's DOM has likely changed.`;
    text.style.marginRight = '24px';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '\u00d7';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = 'position:absolute;top:4px;right:8px;background:transparent;border:none;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:4px';
    close.addEventListener('click', () => banner.remove());

    const hint = document.createElement('div');
    hint.textContent = 'See DevTools console for details.';
    hint.style.cssText = 'margin-top:6px;font-size:11px;opacity:0.85';

    banner.appendChild(close);
    banner.appendChild(text);
    banner.appendChild(hint);
    document.body.appendChild(banner);
  }

  // ============================================================
  // CSS Styles
  // ============================================================

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      body.${BODY_CLASS} {
        background: #fff !important;
        overflow: visible !important;
      }

      /* Hide known chrome by semantic tag */
      body.${BODY_CLASS} header,
      body.${BODY_CLASS} aside,
      body.${BODY_CLASS} footer,
      body.${BODY_CLASS} nav,
      body.${BODY_CLASS} .global-nav,
      body.${BODY_CLASS} .msg-overlay-container,
      body.${BODY_CLASS} .msg-overlay-list-bubble,
      body.${BODY_CLASS} .msg-overlay-bubble-header,
      body.${BODY_CLASS} .msg-overlay-conversation-bubble,
      body.${BODY_CLASS} .artdeco-toast-item {
        display: none !important;
      }

      /* Ancestors of the content container: full width, no styling */
      body.${BODY_CLASS} [data-lpf-ancestor] {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
      }

      /* The content container itself */
      body.${BODY_CLASS} [data-lpf-content] {
        display: block !important;
        width: 100% !important;
        max-width: 850px !important;
        margin: 24px auto !important;
        padding: 24px !important;
        background: #fff !important;
        overflow: visible !important;
      }

      /* Clean up cards */
      body.${BODY_CLASS} [data-lpf-content] section,
      body.${BODY_CLASS} [data-lpf-content] .artdeco-card {
        box-shadow: none !important;
        border: none !important;
        background: #fff !important;
        border-radius: 0 !important;
      }

      /* Hide edit/action controls inside content */
      body.${BODY_CLASS} a[aria-label^="Edit "],
      body.${BODY_CLASS} button[aria-label^="Edit "],
      body.${BODY_CLASS} a[aria-label*="Add a"],
      body.${BODY_CLASS} button[aria-label*="Add a"],
      body.${BODY_CLASS} a[aria-label*="Reorder"],
      body.${BODY_CLASS} button[aria-label*="Reorder"],
      body.${BODY_CLASS} a[aria-label*="reorder"],
      body.${BODY_CLASS} button[aria-label*="reorder"],
      body.${BODY_CLASS} a[aria-label="Navigate back to profile main screen"] {
        display: none !important;
      }

      @media print {
        @page {
          margin: 0.5in;
        }

        body.${BODY_CLASS} {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body.${BODY_CLASS} [data-lpf-content] {
          max-width: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        body.${BODY_CLASS} [componentkey^="entity-collection-item"],
        body.${BODY_CLASS} li {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        #${TOOLBAR_ID},
        #${BUSY_OVERLAY_ID} {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ============================================================
  // Print Mode
  // ============================================================

  // ============================================================
  // Auto-scroll: empirical scroll-container discovery (v1.8.0)
  // ============================================================
  //
  // ROOT CAUSE OF v1.5.0-v1.7.2 FAILURES (per LLM council Gemini-3-Pro
  // + GPT-5.2):
  //   LinkedIn detail pages do NOT scroll on `window`.  They use an
  //   "app-shell" layout where document.body has `overflow: hidden`
  //   and an inner element (typically `.scaffold-layout__main` or
  //   `<main>`) is the actual scroll container.
  //
  //   - window.scrollBy / window.scrollTo did nothing
  //   - maxDocScrollY() returned ~0
  //   - the at-bottom check fired on iteration 1
  //   - both stuck counters reached threshold in ~2 seconds
  //   - exit gate fired before any lazy-load could trigger
  //
  //   findScrollables() also missed the real container: its filter
  //   only matched overflow-y:auto|scroll, but LinkedIn uses overlay
  //   (Chromium) or sized-with-no-overflow-style elements that scroll
  //   programmatically anyway.
  //
  // FIX: stop guessing from CSS.  EMPIRICALLY discover the scroll
  // container by probing candidates: try to scroll each one, and
  // measure whether (a) scrollTop actually moves and (b) entity count
  // grows after the scroll.  Score and pick the best.
  //
  // Diagnostic logging is intentionally verbose for v1.8.0 - if this
  // still misbehaves the user can paste console output back and we
  // can see exactly which element is the scroll container, what its
  // metrics are, and where the loop terminated.
  // ============================================================

  const LPF_DEBUG = true;  // verbose logging while we stabilize this

  function lpfLog(...args) {
    if (LPF_DEBUG) console.log('[LinkedIn Printable Format]', ...args);
  }

  function lpfWarn(...args) {
    console.warn('[LinkedIn Printable Format]', ...args);
  }

  /** Render an element as a short selector chain for diagnostics. */
  function lpfElPath(el) {
    if (!el) return '<null>';
    if (el === window) return 'window';
    if (el === document) return 'document';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    const parts = [];
    let cur = el;
    for (let i = 0; cur && cur.nodeType === 1 && i < 5; i++) {
      let p = cur.tagName ? cur.tagName.toLowerCase() : 'node';
      if (cur.id) p += '#' + cur.id;
      const cls = (typeof cur.className === 'string' && cur.className.trim())
        ? cur.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      if (cls) p += '.' + cls;
      const role = cur.getAttribute && cur.getAttribute('role');
      if (role) p += `[role="${role}"]`;
      parts.push(p);
      cur = cur.parentElement;
    }
    return parts.join(' < ');
  }

  function lpfIsVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const s = window.getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
    return true;
  }

  function lpfSleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function lpfWaitForPaint(ms) {
    await new Promise(requestAnimationFrame);
    if (ms > 0) await lpfSleep(ms);
  }

  /**
   * Narrow the search for entity items + load-more buttons to the
   * detail-section root, so we don't pick up sidebar collections,
   * "People also viewed", or other off-section duplicates.  Falls back
   * to <main> / body so callers always get a non-null scope.
   */
  function findEntityScopeRoot() {
    return document.querySelector('[componentkey*="DetailsSection"]')
      || document.querySelector('[data-component-type="LazyColumn"]')
      || document.querySelector('.scaffold-layout__main')
      || document.querySelector('main')
      || document.body;
  }

  function getEntityItems(scopeEl) {
    const root = scopeEl || document;
    return root.querySelectorAll('[componentkey^="entity-collection-item"]');
  }

  /**
   * Uniform scroll-metric reader.  Treats `window` and Element
   * identically so the rest of the loop doesn't have to branch on
   * which scroller was discovered.
   */
  function getScrollMetrics(scroller) {
    if (scroller === window) {
      const doc = document.documentElement;
      const body = document.body;
      const scrollTop = window.scrollY;
      const clientHeight = window.innerHeight;
      const scrollHeight = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0);
      return {
        scrollTop,
        clientHeight,
        scrollHeight,
        maxScrollTop: Math.max(0, scrollHeight - clientHeight),
      };
    }
    return {
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      maxScrollTop: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
    };
  }

  function setScrollTop(scroller, top) {
    if (scroller === window) {
      window.scrollTo(0, top);
    } else {
      scroller.scrollTop = top;
    }
  }

  function scrollByChunk(scroller, dy) {
    if (scroller === window) {
      window.scrollBy(0, dy);
    } else {
      scroller.scrollTop = Math.min(scroller.scrollTop + dy, scroller.scrollHeight);
    }
  }

  function isAtBottom(scroller, tolerancePx = 12) {
    const m = getScrollMetrics(scroller);
    return m.scrollTop >= m.maxScrollTop - tolerancePx;
  }

  /**
   * BIDIRECTIONAL probe (per Gemini's edge-case warning): try to move
   * `scroller` and verify scrollTop actually changes.  We try down
   * first; if scrollTop doesn't change AND it's already at bottom,
   * we try up.  This avoids falsely rejecting a true scroll
   * container that happens to already be at its maximum.
   */
  async function probeMovement(scroller, label) {
    const before = getScrollMetrics(scroller);
    const startTop = before.scrollTop;

    // Try down.
    setScrollTop(scroller, startTop + 200);
    await lpfWaitForPaint(40);
    let mid = getScrollMetrics(scroller);
    let movedDown = Math.abs(mid.scrollTop - startTop) > 2;

    // If down failed and we're at/near max already, try up.
    let movedUp = false;
    if (!movedDown && before.maxScrollTop > 0 && startTop >= before.maxScrollTop - 4) {
      setScrollTop(scroller, Math.max(0, startTop - 200));
      await lpfWaitForPaint(40);
      mid = getScrollMetrics(scroller);
      movedUp = Math.abs(mid.scrollTop - startTop) > 2;
    }

    // Restore close to original position.
    setScrollTop(scroller, startTop);
    await lpfWaitForPaint(20);

    const moved = movedDown || movedUp;
    lpfLog(`probe-move[${label}]`, {
      scroller: lpfElPath(scroller),
      startTop,
      maxScrollTop: before.maxScrollTop,
      scrollHeight: before.scrollHeight,
      clientHeight: before.clientHeight,
      movedDown,
      movedUp,
      moved,
    });
    return moved;
  }

  /**
   * Stronger probe: scroll candidate to bottom, wait, see if either
   * scrollTop changed OR entity count grew.  Score result.
   */
  async function probeScrollerCandidate(scroller, scopeEl, label) {
    const before = getScrollMetrics(scroller);
    const beforeCount = getEntityItems(scopeEl).length;

    // Snapshot original position so we can restore.
    const origTop = before.scrollTop;

    // Try moving fully (scrollTop = MAX) — also triggers maximum
    // possible IntersectionObserver fires for lazy-load.
    setScrollTop(scroller, Number.MAX_SAFE_INTEGER);
    await lpfWaitForPaint(280);

    const after = getScrollMetrics(scroller);
    const afterCount = getEntityItems(scopeEl).length;

    // If MAX-jump didn't move it AND it wasn't already at bottom,
    // bidirectional probe to confirm whether it's truly stuck.
    let bidirectionalMoved = false;
    if (Math.abs(after.scrollTop - origTop) <= 2
        && origTop < before.maxScrollTop - 4) {
      bidirectionalMoved = await probeMovement(scroller, label + ':bi');
    }

    const moved = Math.abs(after.scrollTop - origTop) > 2 || bidirectionalMoved;
    const countGrew = afterCount > beforeCount;
    const heightGrew = after.scrollHeight > before.scrollHeight + 2;

    // Restore
    setScrollTop(scroller, origTop);
    await lpfWaitForPaint(20);

    const score = (moved ? 2 : 0) + (countGrew ? 3 : 0) + (heightGrew ? 1 : 0);

    lpfLog(`probe-cand[${label}]`, {
      scroller: lpfElPath(scroller),
      before,
      after,
      beforeCount,
      afterCount,
      moved,
      countGrew,
      heightGrew,
      score,
    });

    return { scroller, moved, countGrew, heightGrew, score };
  }

  /**
   * Walk up from the LAST entity item and find the nearest ancestor
   * whose scrollHeight > clientHeight AND whose scrollTop responds to
   * programmatic writes.  This is the most reliable signal: the
   * lazy-load IntersectionObserver is observing an ancestor of the
   * items, so the items' nearest scrollable ancestor IS the right
   * container.
   */
  async function findNearestScrollerFromLastItem(scopeEl) {
    const items = getEntityItems(scopeEl);
    const last = items[items.length - 1];
    if (!last) {
      lpfLog('walk-up: no entity items yet, skipping ancestor walk');
      return null;
    }

    let cur = last.parentElement;
    for (let depth = 0; cur && depth < 15 && cur !== document.documentElement; depth++) {
      const m = getScrollMetrics(cur);
      if (m.scrollHeight > m.clientHeight + 60) {
        const moved = await probeMovement(cur, `walk-up depth=${depth}`);
        if (moved) {
          lpfLog('walk-up: found scrollable ancestor', {
            depth,
            el: lpfElPath(cur),
            metrics: m,
          });
          return cur;
        }
      }
      cur = cur.parentElement;
    }

    lpfLog('walk-up: no scrollable ancestor found from last item');
    return null;
  }

  /**
   * Empirically pick the real scroll container.  Combines:
   *   1. nearest scrollable ancestor of the last entity item (highest
   *      signal)
   *   2. window
   *   3. structural guesses (.scaffold-layout__main, main, etc.)
   *
   * Each candidate gets probed for movement + correlation with entity
   * growth.  Highest score wins.
   */
  async function discoverScrollContainer(scopeEl) {
    const candidates = [];

    const nearest = await findNearestScrollerFromLastItem(scopeEl);
    if (nearest) candidates.push({ scroller: nearest, label: 'walk-up' });

    candidates.push({ scroller: window, label: 'window' });

    const selectors = [
      '.scaffold-layout__main',
      '.scaffold-layout__content',
      'main',
      '[role="main"]',
      '#main',
      '.application-outlet',
      '.authentication-outlet',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) candidates.push({ scroller: el, label: sel });
    }

    // De-duplicate by identity while preserving order.
    const seen = new Set();
    const uniq = [];
    for (const c of candidates) {
      const key = c.scroller === window ? 'window' : c.scroller;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(c);
    }

    const results = [];
    for (const c of uniq) {
      try {
        const r = await probeScrollerCandidate(c.scroller, scopeEl, c.label);
        results.push(r);
      } catch (e) {
        lpfWarn('probe failed for', c.label, lpfElPath(c.scroller), e);
      }
    }

    results.sort((a, b) => b.score - a.score);

    lpfLog('scroller discovery results',
      results.map(r => ({
        scroller: lpfElPath(r.scroller),
        score: r.score,
        moved: r.moved,
        countGrew: r.countGrew,
        heightGrew: r.heightGrew,
      })));

    if (!results.length || results[0].score === 0) {
      lpfWarn('no effective scroller found; falling back to window');
      return window;
    }
    return results[0].scroller;
  }

  // ============================================================
  // "Load more" / "Show all" pagination button detection
  // ============================================================
  //
  // The previous text-only matcher missed buttons that:
  //   - have icon-only labels
  //   - use localized strings
  //   - are <a role="button"> instead of <button>
  //   - have aria-label like "Show 25 more experiences"
  //
  // We now try BOTH structural detection (class name patterns,
  // aria-controls, role="button") AND the legacy text matching, so
  // either one alone is sufficient.

  function findLoadMoreButtons(scopeEl) {
    const root = scopeEl || document;
    const candidates = root.querySelectorAll(
      'button, a[role="button"], [role="button"]'
    );

    const out = [];
    for (const el of candidates) {
      if (!lpfIsVisible(el)) continue;
      if (el.id === FORMAT_BUTTON_ID || el.id === RESET_BUTTON_ID || el.id === MARKDOWN_BUTTON_ID) continue;
      if (el.getAttribute('aria-disabled') === 'true') continue;
      if (el.disabled) continue;

      const cls = (typeof el.className === 'string') ? el.className.toLowerCase() : '';
      const text = ((el.innerText || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();

      // Structural signals.
      const looksLinkedInLoadMore = cls.includes('scaffold-finite-scroll')
        || cls.includes('show-more-less')
        || cls.includes('inline-show-more-text');

      // Text signals (preserved from prior versions, broadened).
      const matchesText = (
        text.includes('see more') ||
        text.includes('show more') ||
        text.includes('show all') ||
        text.includes('load more') ||
        text.includes('more experiences') ||
        text.includes('more education') ||
        text.includes('more licenses') ||
        text.includes('more certifications') ||
        text.includes('more projects') ||
        text.includes('more skills') ||
        /show\s+\d+\s+more/i.test(text) ||
        /\bload\s+\d+\s+more/i.test(text)
      );

      if (looksLinkedInLoadMore || matchesText) {
        out.push(el);
      }
    }
    return out;
  }

  async function clickLoadMoreButtons(scopeEl) {
    const btns = findLoadMoreButtons(scopeEl);
    let clicked = 0;
    for (const b of btns) {
      try {
        b.click();
        clicked++;
        lpfLog('clicked load-more candidate', {
          el: lpfElPath(b),
          ariaLabel: b.getAttribute('aria-label') || null,
          text: (b.innerText || '').slice(0, 80),
        });
      } catch (e) {
        lpfWarn('click failed', lpfElPath(b), e);
      }
    }
    if (clicked) await lpfWaitForPaint(250);
    return clicked;
  }

  /**
   * Legacy text-only expansion (kept so callers outside the loop —
   * downloadMarkdown, enablePrintableMode — still hit known buttons).
   * Internally now delegates to clickLoadMoreButtons() which also
   * captures buttons that the legacy pass missed.
   */
  async function expandSeeMoreButtons() {
    return await clickLoadMoreButtons(findEntityScopeRoot());
  }

  // ============================================================
  // autoScrollToLoadAll: empirical scroller + structural buttons +
  // hard time cap
  // ============================================================

  async function autoScrollToLoadAll() {
    const scopeEl = findEntityScopeRoot();
    const originalWindowY = window.scrollY;

    lpfLog('autoScrollToLoadAll: starting', {
      url: location.href,
      readyState: document.readyState,
      scope: lpfElPath(scopeEl),
      initialItems: getEntityItems(scopeEl).length,
      initialWindow: getScrollMetrics(window),
    });

    // Pre-scroll a little to encourage the first lazy-load batch so
    // the entity-item walk-up has something to anchor on.
    try { window.scrollBy(0, 600); } catch (_) {}
    await lpfWaitForPaint(200);

    const scroller = await discoverScrollContainer(scopeEl);
    const originalScrollerTop = scroller === window ? window.scrollY : scroller.scrollTop;
    lpfLog('autoScrollToLoadAll: chosen scroller', {
      scroller: lpfElPath(scroller),
      initialMetrics: getScrollMetrics(scroller),
    });

    const chunkPx = Math.max(Math.round(window.innerHeight * 0.8), 400);
    const stepDelay = 250;

    // Tuning constants
    const maxMs = 30000;                  // hard cap (was 30s hang in v1.7.0)
    const bottomStableNeeded = 6;         // ~1.5s of stable bottom
    const growthStableNeeded = 6;         // ~1.5s of no growth
    const startT = performance.now();

    let iter = 0;
    let bottomStable = 0;
    let noGrowthStable = 0;
    let lastCount = getEntityItems(scopeEl).length;
    let lastScrollHeight = getScrollMetrics(scroller).scrollHeight;
    let lastMaxScrollTop = getScrollMetrics(scroller).maxScrollTop;
    let buttonsClickedTotal = 0;
    let exitReason = 'maxMs-cap';

    while ((performance.now() - startT) < maxMs) {
      iter++;

      // 1. Click any pagination / "show all N" buttons in scope.
      const clicked = await clickLoadMoreButtons(scopeEl);
      buttonsClickedTotal += clicked;

      // 2. Advance the chosen scroller.
      const before = getScrollMetrics(scroller);
      scrollByChunk(scroller, chunkPx);

      // 3. Belt-and-suspenders: also nudge window in case there's a
      //    secondary outer scroll that contributes to viewport-driven
      //    IntersectionObservers.
      if (scroller !== window) {
        try { window.scrollBy(0, chunkPx); } catch (_) {}
      }

      // 4. Final fallback: scrollIntoView the last item.  Only a
      //    nudge - the chosen scroller is doing the real work.
      const items = getEntityItems(scopeEl);
      const lastItem = items[items.length - 1];
      if (lastItem) {
        try {
          lastItem.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
        } catch (_) {}
      }

      await lpfWaitForPaint(stepDelay);

      const after = getScrollMetrics(scroller);
      const count = items.length;
      const atBottomNow = isAtBottom(scroller, 12);

      const grew = (count > lastCount)
        || (after.scrollHeight > lastScrollHeight + 2)
        || (after.maxScrollTop > lastMaxScrollTop + 2);

      if (atBottomNow) bottomStable++; else bottomStable = 0;
      if (grew) noGrowthStable = 0; else noGrowthStable++;

      lastCount = count;
      lastScrollHeight = after.scrollHeight;
      lastMaxScrollTop = after.maxScrollTop;

      // Verbose first 12 iters, then every 4th.  Always log when
      // material state changes (clicks, growth, hitting bottom).
      if (iter <= 12 || iter % 4 === 0 || clicked || grew) {
        lpfLog(`iter ${iter}`, {
          ms: Math.round(performance.now() - startT),
          scroller: lpfElPath(scroller),
          before,
          after,
          count,
          clickedThisIter: clicked,
          clickedTotal: buttonsClickedTotal,
          atBottomNow,
          bottomStable,
          noGrowthStable,
          grew,
        });
      }

      setBusy(true, `Loading entries\u2026 (${count} so far)`);

      // Exit condition (per GPT-5 council recommendation):
      //   bottom stable for N iters
      //   AND no growth for N iters
      //   AND no remaining load-more buttons visible
      // The third gate prevents premature exit when an unclicked
      // "Show all 25" button is still onscreen waiting to expand.
      if (bottomStable >= bottomStableNeeded && noGrowthStable >= growthStableNeeded) {
        const remainingBtns = findLoadMoreButtons(scopeEl).filter(lpfIsVisible);
        if (remainingBtns.length === 0) {
          exitReason = 'stable-bottom-no-buttons';
          lpfLog('exit: stable bottom, no growth, no remaining load-more buttons', {
            iter,
            count,
            ms: Math.round(performance.now() - startT),
          });
          break;
        } else {
          // Reset and try again - clicking the remaining button(s)
          // will likely produce more growth on the next iteration.
          lpfLog('stable-bottom but load-more buttons remain - resetting counters', {
            remaining: remainingBtns.slice(0, 5).map(lpfElPath),
            count: remainingBtns.length,
          });
          bottomStable = 0;
          noGrowthStable = 0;
        }
      }
    }

    if ((performance.now() - startT) >= maxMs) {
      lpfWarn('autoScrollToLoadAll: hit maxMs cap', { maxMs, iter });
    }

    const finalCount = getEntityItems(scopeEl).length;
    lpfLog('autoScrollToLoadAll: done', {
      exitReason,
      ms: Math.round(performance.now() - startT),
      iter,
      finalCount,
      finalScroller: lpfElPath(scroller),
      finalMetrics: getScrollMetrics(scroller),
      finalWindow: getScrollMetrics(window),
      buttonsClickedTotal,
    });

    // Restore both the inner scroller and window position - the
    // chosen scroller may not be window.
    try {
      if (scroller !== window) {
        scroller.scrollTop = originalScrollerTop;
      }
      window.scrollTo({ top: originalWindowY, behavior: 'instant' });
    } catch (e) {
      lpfWarn('scroll-restore failed', e);
    }
    await lpfSleep(150);
  }

  function findContentContainer() {
    // LinkedIn detail pages use componentkey attributes on stable structural elements.
    // Try the most specific first, then broaden.
    return document.querySelector('[componentkey*="DetailsSection"]')
      || document.querySelector('[data-component-type="LazyColumn"]')
      || document.querySelector('[componentkey^="entity-collection-item"]')?.parentElement
      || document.querySelector('.scaffold-layout__main')
      || document.querySelector('main');
  }

  function isolateForPrint(contentEl) {
    const keepIds = new Set([
      FORMAT_BUTTON_ID, RESET_BUTTON_ID, MARKDOWN_BUTTON_ID,
      STYLE_ID, TOOLBAR_ID, BUSY_OVERLAY_ID, ERROR_BANNER_ID,
    ]);
    contentEl.setAttribute('data-lpf-content', '');

    let el = contentEl;
    while (el.parentElement && el !== document.body && el !== document.documentElement) {
      const parent = el.parentElement;
      parent.setAttribute('data-lpf-ancestor', '');

      for (const sibling of parent.children) {
        if (sibling === el) continue;
        if (keepIds.has(sibling.id)) continue;
        if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE' || sibling.tagName === 'LINK') continue;
        sibling.setAttribute('data-lpf-hidden', '');
        sibling.style.setProperty('display', 'none', 'important');
      }

      el = parent;
    }
  }

  function restoreFromPrint() {
    document.querySelectorAll('[data-lpf-hidden]').forEach(el => {
      el.removeAttribute('data-lpf-hidden');
      el.style.removeProperty('display');
    });
    document.querySelectorAll('[data-lpf-content]').forEach(el => {
      el.removeAttribute('data-lpf-content');
    });
    document.querySelectorAll('[data-lpf-ancestor]').forEach(el => {
      el.removeAttribute('data-lpf-ancestor');
    });
  }

  async function enablePrintableMode() {
    addStyles();
    setBusy(true, 'Loading all entries\u2026');

    try {
      await autoScrollToLoadAll();
      await expandSeeMoreButtons();

      const content = findContentContainer();
      if (content) {
        isolateForPrint(content);
      } else {
        showSelectorError(['detail-page content container ([componentkey*="DetailsSection"], [data-component-type="LazyColumn"], [componentkey^="entity-collection-item"])']);
      }

      document.body.classList.add(BODY_CLASS);
      showResetButton(true);
    } finally {
      setBusy(false);
    }
  }

  function disablePrintableMode() {
    document.body.classList.remove(BODY_CLASS);
    restoreFromPrint();
    showResetButton(false);
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  function cleanText(text) {
    return (text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getSectionName() {
    const pathParts = location.pathname.split('/').filter(Boolean);
    return pathParts[3] || 'details';
  }

  function getProfileSlug() {
    const pathParts = location.pathname.split('/').filter(Boolean);
    return pathParts[1] || 'linkedin';
  }

  function markdownFileNameFromPage() {
    return `${getProfileSlug()}-${getSectionName()}.md`;
  }

  function headingFromPage() {
    // Try to find an explicit heading on the page
    const h1 = document.querySelector('h1');
    const h1Text = cleanText(h1?.innerText);
    if (h1Text) return h1Text;

    // Derive from URL path
    const section = getSectionName()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return section || 'LinkedIn Details';
  }

  // ============================================================
  // Markdown Extraction
  // ============================================================

  const DATE_PATTERN = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}\s+-\s+/i;

  /**
   * Extract metadata (title, company, dates, location) from the edit-form
   * link inside an entry.  LinkedIn wraps these <p> elements in
   * a[href*="/edit/forms/"] in document order:
   *   Single entry:  [title, company·type, dates, location]
   *   Grouped sub-role: [title, dates]
   */
  function extractMetadata(container) {
    const metaLink = container.querySelector('a[href*="/edit/forms/"]');
    if (!metaLink) return null;

    const paragraphs = metaLink.querySelectorAll('p');
    const texts = Array.from(paragraphs).map(p => cleanText(p.innerText)).filter(Boolean);

    if (texts.length === 0) return null;

    const result = { title: texts[0] };

    if (texts.length === 2) {
      // Grouped sub-role: [title, dates] or possibly [title, company]
      if (DATE_PATTERN.test(texts[1])) {
        result.dates = texts[1];
      } else {
        result.companyLine = texts[1];
      }
    } else if (texts.length >= 3) {
      // Single entry: [title, company, dates, location?]
      result.companyLine = texts[1];
      result.dates = texts[2];
      if (texts[3]) result.location = texts[3];
    }

    return result;
  }

  function extractDescription(container) {
    const descEls = container.querySelectorAll('[data-testid="expandable-text-box"]');
    return Array.from(descEls)
      .map(el => cleanText(el.innerText))
      .filter(Boolean)
      .join('\n\n');
  }

  function extractSkills(container) {
    const skillLink = container.querySelector('a[href*="skill-associations-details"]');
    if (!skillLink) return '';
    let text = cleanText(skillLink.innerText);
    // Strip "Skills:" prefix if present
    text = text.replace(/^skills:\s*/i, '').trim();
    return text;
  }

  /**
   * Extract company header for grouped entries (multiple roles at one company).
   * The company info is in a[href*="/company/"] that contains <p> elements.
   */
  function extractGroupHeader(item) {
    const companyLinks = item.querySelectorAll('a[href*="/company/"]');
    let companyTextLink = null;
    for (const link of companyLinks) {
      if (link.querySelector('p')) {
        companyTextLink = link;
        break;
      }
    }

    if (companyTextLink) {
      const ps = companyTextLink.querySelectorAll('p');
      const texts = Array.from(ps).map(p => cleanText(p.innerText)).filter(Boolean);
      return {
        company: texts[0] || '',
        duration: texts[1] || '',
        location: texts[2] || '',
      };
    }

    // Fallback: get text from the header area (before <ul>)
    const ul = item.querySelector('ul');
    const allPs = item.querySelectorAll('p');
    const headerTexts = [];
    for (const p of allPs) {
      if (ul && ul.contains(p)) break;
      const text = cleanText(p.innerText);
      if (text) headerTexts.push(text);
    }

    return {
      company: headerTexts[0] || '',
      duration: headerTexts[1] || '',
      location: headerTexts[2] || '',
    };
  }

  function formatCompanyLine(companyLine) {
    if (!companyLine) return '';
    const parts = companyLine.split('\u00b7').length > 1
      ? companyLine.split('\u00b7')  // Unicode middle dot
      : companyLine.split('·');      // Regular dot
    if (parts.length >= 2) {
      return `**${parts[0].trim()}** · ${parts.slice(1).join(' · ').trim()}`;
    }
    return `**${companyLine}**`;
  }

  function formatSingleEntry(item) {
    const meta = extractMetadata(item);
    if (!meta || !meta.title) return '';

    const desc = extractDescription(item);
    const skills = extractSkills(item);

    const lines = [];
    lines.push(`## ${meta.title}`);

    const metaLines = [];
    if (meta.companyLine) metaLines.push(formatCompanyLine(meta.companyLine));
    if (meta.dates) metaLines.push(meta.dates);
    if (meta.location) metaLines.push(meta.location);
    if (metaLines.length) {
      lines.push(metaLines.join('  \n'));
    }

    if (desc) {
      lines.push('');
      lines.push(desc);
    }

    if (skills) {
      lines.push('');
      lines.push(`**Skills:** ${skills}`);
    }

    return lines.join('\n');
  }

  function formatGroupedEntry(item) {
    const header = extractGroupHeader(item);
    if (!header.company) return '';

    const lines = [];
    lines.push(`## ${header.company}`);

    const headerMeta = [];
    if (header.duration) headerMeta.push(header.duration);
    if (header.location) headerMeta.push(header.location);
    if (headerMeta.length) {
      lines.push(`*${headerMeta.join(' · ')}*`);
    }

    const subRoles = item.querySelectorAll('ul > li');
    for (const li of subRoles) {
      const meta = extractMetadata(li);
      if (!meta || !meta.title) continue;

      const desc = extractDescription(li);
      const skills = extractSkills(li);

      lines.push('');
      lines.push(`### ${meta.title}`);

      const roleMeta = [];
      if (meta.companyLine) roleMeta.push(meta.companyLine);
      if (meta.dates) roleMeta.push(meta.dates);
      if (roleMeta.length) {
        lines.push(roleMeta.join('  \n'));
      }

      if (desc) {
        lines.push('');
        lines.push(desc);
      }

      if (skills) {
        lines.push('');
        lines.push(`**Skills:** ${skills}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Fallback: walk the DOM and produce best-effort markdown when no
   * componentkey structure is found.
   */
  function fallbackDomToMarkdown(root) {
    const lines = [];
    const seen = new Set();

    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = cleanText(node.textContent);
        if (text && !seen.has(text)) {
          seen.add(text);
          lines.push(text, '');
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node;
      const tag = el.tagName.toLowerCase();
      if (el.matches('script, style, noscript, svg, img, nav, button') ||
          el.id === FORMAT_BUTTON_ID || el.id === RESET_BUTTON_ID || el.id === MARKDOWN_BUTTON_ID) {
        return;
      }

      if (/^h[1-6]$/.test(tag)) {
        const text = cleanText(el.innerText);
        if (text) lines.push(`${'#'.repeat(Number(tag[1]))} ${text}`, '');
        return;
      }

      if (tag === 'li') {
        const text = cleanText(el.innerText);
        if (text && !seen.has(text)) {
          seen.add(text);
          lines.push(`- ${text.replace(/\n+/g, '\n  ')}`, '');
        }
        return;
      }

      for (const child of el.childNodes) walk(child);
    }

    walk(root);
    return lines.join('\n');
  }

  function pageToMarkdown() {
    const sectionHeading = headingFromPage();
    const items = document.querySelectorAll('[componentkey^="entity-collection-item"]');

    const parts = [`# ${sectionHeading}`];

    if (items.length === 0) {
      // No componentkey structure — fall back to DOM walk
      const main = document.querySelector('.scaffold-layout__main')
        || document.querySelector('main')
        || document.body;
      parts.push(fallbackDomToMarkdown(main));
    } else {
      for (const item of items) {
        const hasSubRoles = item.querySelector('ul > li') !== null;
        const md = hasSubRoles ? formatGroupedEntry(item) : formatSingleEntry(item);
        if (md) parts.push(md);
      }
    }

    return parts.join('\n\n---\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim() + '\n';
  }

  // ============================================================
  // Download
  // ============================================================

  function downloadTextFile({ fileName, text, mimeType }) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();

    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadMarkdown() {
    setBusy(true, 'Loading all entries\u2026');
    try {
      await autoScrollToLoadAll();
      await expandSeeMoreButtons();
      await new Promise(r => setTimeout(r, 250));

      const items = document.querySelectorAll('[componentkey^="entity-collection-item"]');
      if (items.length === 0) {
        showSelectorError(['detail entries ([componentkey^="entity-collection-item"])']);
      }

      const markdown = pageToMarkdown();

      downloadTextFile({
        fileName: markdownFileNameFromPage(),
        text: markdown,
        mimeType: 'text/markdown;charset=utf-8',
      });
    } finally {
      setBusy(false);
    }
  }

  // ============================================================
  // Toolbar (icon buttons in/near the LinkedIn header)
  // ============================================================

  const TOOLBAR_ID = 'linkedin-printable-format-toolbar';
  const BUSY_OVERLAY_ID = 'linkedin-printable-format-busy';

  /**
   * Try to find LinkedIn's top header so we can dock the toolbar inside
   * it.  Falls back to a fixed-position toolbar above the page content
   * if no header is found.
   */
  function findHeader() {
    return document.querySelector('header.global-nav')
      || document.querySelector('nav.global-nav')
      || document.querySelector('header[role="banner"]')
      || document.querySelector('#global-nav')
      || document.querySelector('header');
  }

  function createIconButton({ id, icon, tooltip, onClick }) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
    button.textContent = icon;

    button.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'width: 32px',
      'height: 32px',
      'padding: 0',
      'margin: 0 4px',
      'background: rgba(255,255,255,0.95)',
      'color: #0a66c2',
      'border: 1px solid rgba(0,0,0,0.12)',
      'border-radius: 6px',
      'font-size: 16px',
      'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'line-height: 1',
      'cursor: pointer',
      'box-shadow: 0 1px 2px rgba(0,0,0,0.08)',
    ].join(';');

    button.addEventListener('mouseenter', () => {
      button.style.background = '#f0f6fc';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255,255,255,0.95)';
    });

    button.addEventListener('click', onClick);
    return button;
  }

  function showResetButton(visible) {
    const btn = document.getElementById(RESET_BUTTON_ID);
    if (btn) btn.style.display = visible ? 'inline-flex' : 'none';
  }

  function setBusy(on, message) {
    let overlay = document.getElementById(BUSY_OVERLAY_ID);
    if (on) {
      const header = findHeader();
      const headerHeight = header ? Math.max(header.getBoundingClientRect().height, 48) : 52;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = BUSY_OVERLAY_ID;
        overlay.style.cssText = [
          'position: fixed',
          `top: ${Math.round(headerHeight + 12)}px`,
          'left: 50%',
          'transform: translateX(-50%)',
          'z-index: 2147483647',
          'padding: 8px 14px',
          'background: rgba(10,102,194,0.95)',
          'color: #fff',
          'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
          'border-radius: 6px',
          'box-shadow: 0 2px 8px rgba(0,0,0,0.25)',
          'pointer-events: none',
        ].join(';');
        document.body.appendChild(overlay);
      }
      overlay.textContent = message || 'Working\u2026';
    } else if (overlay) {
      overlay.remove();
    }
  }

  function addButtons() {
    if (document.getElementById(TOOLBAR_ID)) return;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;

    // Sit in a second row directly below LinkedIn's nav (the header
    // is ~52px tall) so we don't overlap LinkedIn's own icons.
    const header = findHeader();
    const headerHeight = header ? Math.max(header.getBoundingClientRect().height, 48) : 52;
    toolbar.style.cssText = [
      'position: fixed',
      `top: ${Math.round(headerHeight + 6)}px`,
      'right: 16px',
      'z-index: 9999',
      'display: inline-flex',
      'align-items: center',
      'padding: 4px 6px',
      'background: rgba(255,255,255,0.92)',
      'border: 1px solid rgba(0,0,0,0.08)',
      'border-radius: 8px',
      'box-shadow: 0 2px 6px rgba(0,0,0,0.08)',
      'pointer-events: auto',
    ].join(';');

    const formatButton = createIconButton({
      id: FORMAT_BUTTON_ID,
      icon: '\uD83D\uDDA8',         // 🖨 printer
      tooltip: 'Format for Print',
      onClick: enablePrintableMode,
    });

    const resetButton = createIconButton({
      id: RESET_BUTTON_ID,
      icon: '\u21BA',                // ↺ counterclockwise arrow
      tooltip: 'Reset View',
      onClick: disablePrintableMode,
    });
    resetButton.style.display = 'none';  // hidden until Format-for-Print runs

    const markdownButton = createIconButton({
      id: MARKDOWN_BUTTON_ID,
      icon: '\u2B07',                // ⬇ download
      tooltip: 'Download Markdown',
      onClick: downloadMarkdown,
    });

    toolbar.appendChild(formatButton);
    toolbar.appendChild(resetButton);
    toolbar.appendChild(markdownButton);

    document.body.appendChild(toolbar);
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    addStyles();
    addButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // LinkedIn is a single-page app, so retry after navigation/rendering changes.
  let lastUrl = location.href;

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      disablePrintableMode();
      const existing = document.getElementById(TOOLBAR_ID);
      if (existing) existing.remove();
      window.setTimeout(addButtons, 1000);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
