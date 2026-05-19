// ==UserScript==
// @name         Claude Usage Sustainable Rate
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.0.0
// @description  On claude.ai/settings/usage, show current burn rate as % of the sustainable rate for the 5-hour window.
// @author       rpeck
// @match        https://claude.ai/settings/usage*
// @match        https://claude.ai/settings*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/rpeck/rpeck-monkeyscripts/raw/main/claude-usage-rate/claude-usage-rate.user.js
// @downloadURL  https://github.com/rpeck/rpeck-monkeyscripts/raw/main/claude-usage-rate/claude-usage-rate.user.js
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_NAME = 'Claude Usage Sustainable Rate';
  const LOG_PREFIX = '[claude-usage-rate]';
  const ERROR_BANNER_ID = 'claude-usage-rate-error-banner';
  const PANEL_ID_PREFIX = 'rpeck-claude-burn-rate-panel';
  const REFRESH_MS = 30 * 1000;
  const MOUNT_RETRY_MS = 500;
  const MOUNT_RETRY_MAX = 40; // 20s
  const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  let refreshTimer = null;
  let mountTimer = null;
  let urlObserver = null;
  let lastUrl = location.href;

  // ---------- URL gating ----------

  function isUsagePage() {
    return /\/settings\/usage(?:\/|$|\?|#)/.test(location.pathname + location.search + location.hash)
        || /\/settings\/usage/.test(location.href);
  }

  // ---------- DOM helpers ----------

  function ancestorCard(el) {
    // Walk up until we hit something that looks like a card (has padding,
    // border, or is a section/article).  Bounded to avoid running off the
    // body.
    let cur = el;
    for (let i = 0; i < 10 && cur && cur !== document.body; i++) {
      const tag = (cur.tagName || '').toLowerCase();
      if (tag === 'section' || tag === 'article') return cur;
      const cls = (cur.className && cur.className.toString) ? cur.className.toString() : '';
      if (/card|panel|tile|surface|box/i.test(cls)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function textOf(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Card discovery ----------

  function findHourlyCard() {
    // Strategy A: data-testid containing hourly/5-hour/usage.
    const testIdSelectors = [
      '[data-testid*="5-hour"]',
      '[data-testid*="five-hour"]',
      '[data-testid*="hourly"]',
      '[data-testid*="usage-window-5"]',
    ];
    for (const sel of testIdSelectors) {
      const el = document.querySelector(sel);
      if (el) return ancestorCard(el);
    }

    // Strategy B: any heading matching /5\s*[- ]?\s*hour/i.
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, div[role="heading"], [aria-level]');
    for (const h of headings) {
      const t = textOf(h);
      if (/5\s*[- ]?\s*hour/i.test(t) || /\bhourly\b/i.test(t)) {
        return ancestorCard(h);
      }
    }

    // Strategy C: any element whose direct text contains "5-hour usage" or "Current 5-hour".
    const all = document.querySelectorAll('div, section, article, p, span');
    for (const el of all) {
      const t = textOf(el);
      if (t.length > 400) continue; // skip huge containers
      if (/5[- ]?hour usage/i.test(t) || /current 5[- ]?hour/i.test(t)) {
        return ancestorCard(el);
      }
    }

    return null;
  }

  function findWeeklyCard() {
    const testIdSelectors = [
      '[data-testid*="weekly"]',
      '[data-testid*="week"]',
      '[data-testid*="7-day"]',
    ];
    for (const sel of testIdSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const card = ancestorCard(el);
        // Avoid colliding with the hourly card.
        if (card && !card.querySelector('[data-testid*="hourly"], [data-testid*="5-hour"]')) {
          return card;
        }
      }
    }

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, div[role="heading"], [aria-level]');
    for (const h of headings) {
      const t = textOf(h);
      if (/\b(weekly|week)\b/i.test(t) && !/5\s*[- ]?\s*hour/i.test(t)) {
        return ancestorCard(h);
      }
    }
    return null;
  }

  // ---------- Extraction ----------

  function parseUsedPct(card) {
    // Strategy A: role=progressbar with aria-valuenow.
    const pb = card.querySelector('[role="progressbar"][aria-valuenow]');
    if (pb) {
      const v = parseFloat(pb.getAttribute('aria-valuenow'));
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
    }

    // Strategy B: first "NN%" substring in card text.
    const t = textOf(card);
    const m = t.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      const v = parseFloat(m[1]);
      if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
    }
    return null;
  }

  function parseResetMs(card) {
    // Strategy A: <time datetime="..."> — most stable.
    const time = card.querySelector('time[datetime]');
    if (time) {
      const dt = new Date(time.getAttribute('datetime'));
      if (!isNaN(dt.getTime())) return dt.getTime();
    }

    const t = textOf(card);

    // Strategy B: "Resets in Xh Ym" / "Resets in 4h" / "Resets in 30m".
    let m = t.match(/Resets?\s+in\s+(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?(?:\s*(\d+)\s*s)?/i);
    if (m && (m[1] || m[2] || m[3])) {
      const h = parseInt(m[1] || '0', 10);
      const mm = parseInt(m[2] || '0', 10);
      const s = parseInt(m[3] || '0', 10);
      if (h > 0 || mm > 0 || s > 0) {
        return Date.now() + ((h * 3600 + mm * 60 + s) * 1000);
      }
    }

    // Strategy C: "Resets at 6:30 PM" or "Resets at 18:30" (today/tomorrow).
    m = t.match(/Resets?\s+(?:at|on)\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm)?)/);
    if (m) {
      const parsed = parseClockTime(m[1]);
      if (parsed) return parsed;
    }

    // Strategy D: any explicit ISO-ish date in the card text.
    m = t.match(/(\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+)/);
    if (m) {
      const dt = new Date(m[1]);
      if (!isNaN(dt.getTime())) return dt.getTime();
    }

    // Strategy E: "Resets <weekday> at HH:MM"
    m = t.match(/Resets?\s+(\w+)\s+at\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM|am|pm)?)/);
    if (m) {
      const wd = parseWeekdayTime(m[1], m[2]);
      if (wd) return wd;
    }

    return null;
  }

  function parseClockTime(clock) {
    const m = clock.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if (!m) return null;
    let hr = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = (m[3] || '').toLowerCase();
    if (ampm === 'pm' && hr < 12) hr += 12;
    if (ampm === 'am' && hr === 12) hr = 0;
    const d = new Date();
    d.setHours(hr, min, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  function parseWeekdayTime(weekday, clock) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const idx = days.indexOf(weekday.toLowerCase());
    if (idx < 0) return null;
    const base = parseClockTime(clock);
    if (!base) return null;
    const d = new Date(base);
    while (d.getDay() !== idx || d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
      if (d.getTime() - Date.now() > 14 * 24 * 3600 * 1000) return null; // safety
    }
    return d.getTime();
  }

  // ---------- Math ----------

  function computeRate(usedPct, msUntilReset, windowMs) {
    const remainingHours = msUntilReset / 3600 / 1000;
    const windowHours = windowMs / 3600 / 1000;
    const elapsedHours = windowHours - remainingHours;
    const sustainablePctPerHr = 100 / windowHours;

    if (remainingHours > windowHours + 0.05) {
      return { kind: 'odd', elapsedHours, remainingHours, windowHours, sustainablePctPerHr };
    }
    if (elapsedHours < 0.05) {
      return { kind: 'warming', elapsedHours, remainingHours, windowHours, sustainablePctPerHr };
    }
    const currentRate = usedPct / elapsedHours;
    const pctOfSustainable = (currentRate / sustainablePctPerHr) * 100;
    return {
      kind: 'ok',
      elapsedHours,
      remainingHours,
      windowHours,
      sustainablePctPerHr,
      currentRate,
      pctOfSustainable,
    };
  }

  // ---------- Render ----------

  function colorForPct(pct) {
    if (pct < 90) return { dot: '#16a34a', label: '#166534' };
    if (pct <= 110) return { dot: '#ca8a04', label: '#854d0e' };
    return { dot: '#dc2626', label: '#991b1b' };
  }

  function ensurePanel(card, suffix) {
    const id = `${PANEL_ID_PREFIX}-${suffix}`;
    let panel = document.getElementById(id);
    if (panel && panel.parentElement === card) return panel;
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = id;
    panel.setAttribute('data-rpeck-burn-rate', suffix);
    panel.style.cssText = [
      'margin: 8px 0 12px',
      'padding: 10px 12px',
      'border: 1px solid rgba(0,0,0,0.12)',
      'border-radius: 8px',
      'background: rgba(0,0,0,0.03)',
      'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
      'color: inherit',
    ].join(';');

    card.insertBefore(panel, card.firstChild);
    return panel;
  }

  function renderPanel(panel, label, calc) {
    panel.innerHTML = '';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:space-between;';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:8px;font-weight:600;';

    const dot = document.createElement('span');
    dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background:#9ca3af;';
    left.appendChild(dot);

    const title = document.createElement('span');
    left.appendChild(title);

    const right = document.createElement('span');
    right.style.cssText = 'font-size:11px;opacity:0.65;';
    right.textContent = label;

    row.appendChild(left);
    row.appendChild(right);
    panel.appendChild(row);

    const sub = document.createElement('div');
    sub.style.cssText = 'margin-top:4px;font-size:12px;opacity:0.85;';
    panel.appendChild(sub);

    if (calc.kind === 'warming') {
      title.textContent = 'Burn rate: warming up';
      sub.textContent = `Window just started (${calc.elapsedHours.toFixed(2)}h elapsed) — rate is unstable until ~3 min in.`;
      return;
    }
    if (calc.kind === 'odd') {
      title.textContent = 'Burn rate: —';
      sub.textContent = `Couldn't compute (remaining > window: ${calc.remainingHours.toFixed(2)}h of ${calc.windowHours.toFixed(1)}h).`;
      console.warn(LOG_PREFIX, 'odd state', calc);
      return;
    }

    const pct = calc.pctOfSustainable;
    const c = colorForPct(pct);
    dot.style.background = c.dot;
    title.style.color = c.label;
    title.textContent = `Burn rate: ${pct.toFixed(0)}% of sustainable`;
    sub.textContent =
      `${calc.usedPctText} used in ${calc.elapsedHours.toFixed(2)}h ` +
      `→ ${calc.currentRate.toFixed(2)}%/hr ` +
      `(target ${calc.sustainablePctPerHr.toFixed(2)}%/hr, ` +
      `${calc.remainingHours.toFixed(2)}h until reset)`;
  }

  // ---------- showSelectorError (canonical pattern) ----------

  function showSelectorError(missing) {
    if (document.getElementById(ERROR_BANNER_ID)) return;
    if (!document.body) return;

    const list = Array.isArray(missing) ? missing : [String(missing)];

    console.error(`${LOG_PREFIX} SELECTOR FAILURE`, {
      url: location.href,
      missing: list,
      hint: 'Selectors used to locate the 5-hour Claude usage card no longer match. claude.ai DOM has likely changed. Report at https://github.com/rpeck/rpeck-monkeyscripts/issues',
    });

    const banner = document.createElement('div');
    banner.id = ERROR_BANNER_ID;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position: fixed',
      'top: 12px',
      'right: 12px',
      'z-index: 2147483647',
      'max-width: 420px',
      'padding: 12px 16px',
      'background: #b91c1c',
      'color: #fff',
      'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
      'border-radius: 6px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3)',
      'cursor: default',
    ].join(';');

    const text = document.createElement('div');
    text.textContent = `${SCRIPT_NAME}: could not find ${list.join(' or ')} on the usage page — claude.ai's DOM has likely changed.`;
    text.style.marginRight = '24px';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '\u00d7';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = [
      'position: absolute',
      'top: 4px',
      'right: 8px',
      'background: transparent',
      'border: none',
      'color: #fff',
      'font-size: 18px',
      'line-height: 1',
      'cursor: pointer',
      'padding: 4px',
    ].join(';');
    close.addEventListener('click', () => banner.remove());

    const hint = document.createElement('div');
    hint.textContent = 'See DevTools console for details.';
    hint.style.cssText = 'margin-top: 6px; font-size: 11px; opacity: 0.85;';

    banner.appendChild(close);
    banner.appendChild(text);
    banner.appendChild(hint);
    document.body.appendChild(banner);
  }

  function dismissError() {
    const b = document.getElementById(ERROR_BANNER_ID);
    if (b) b.remove();
  }

  // ---------- Tick (extract + render) ----------

  function tick() {
    if (!isUsagePage()) {
      removePanels();
      return false;
    }

    const card = findHourlyCard();
    if (!card) return false;

    const usedPct = parseUsedPct(card);
    const resetMs = parseResetMs(card);

    if (usedPct == null || resetMs == null) {
      const missing = [];
      if (usedPct == null) missing.push('usage %');
      if (resetMs == null) missing.push('reset time');
      console.warn(LOG_PREFIX, 'partial extraction', { usedPct, resetMs, missing });
      return false;
    }

    const msUntilReset = Math.max(0, resetMs - Date.now());
    const calc = computeRate(usedPct, msUntilReset, FIVE_HOUR_MS);
    calc.usedPctText = `${usedPct}%`;
    calc.currentRate = (calc.currentRate || 0);

    const panel = ensurePanel(card, 'hourly');
    renderPanel(panel, '5-hour window', calc);

    // Weekly (best effort).
    const wcard = findWeeklyCard();
    if (wcard && wcard !== card) {
      const wUsed = parseUsedPct(wcard);
      const wReset = parseResetMs(wcard);
      if (wUsed != null && wReset != null) {
        const wMs = Math.max(0, wReset - Date.now());
        const wCalc = computeRate(wUsed, wMs, WEEK_MS);
        wCalc.usedPctText = `${wUsed}%`;
        wCalc.currentRate = (wCalc.currentRate || 0);
        const wPanel = ensurePanel(wcard, 'weekly');
        renderPanel(wPanel, 'Weekly window', wCalc);
      }
    }

    dismissError();
    console.log(LOG_PREFIX, 'rate', {
      usedPct,
      resetInMin: Math.round(msUntilReset / 60000),
      pctOfSustainable: calc.kind === 'ok' ? Math.round(calc.pctOfSustainable) : calc.kind,
    });
    return true;
  }

  function removePanels() {
    document.querySelectorAll(`[id^="${PANEL_ID_PREFIX}-"]`).forEach((el) => el.remove());
  }

  // ---------- Mount/retry/SPA ----------

  function startMountRetry() {
    stopMountRetry();
    let attempts = 0;
    mountTimer = setInterval(() => {
      attempts++;
      const ok = tick();
      if (ok) {
        stopMountRetry();
        startRefresh();
        return;
      }
      if (attempts >= MOUNT_RETRY_MAX) {
        stopMountRetry();
        if (isUsagePage() && !findHourlyCard()) {
          showSelectorError(['the 5-hour usage card']);
        } else if (isUsagePage()) {
          showSelectorError(['the usage percentage or reset time inside the 5-hour card']);
        }
      }
    }, MOUNT_RETRY_MS);
  }

  function stopMountRetry() {
    if (mountTimer) {
      clearInterval(mountTimer);
      mountTimer = null;
    }
  }

  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(() => {
      // If the panel was wiped (SPA re-render), tick() will recreate it.
      // If the card vanished, fall back to mount-retry.
      if (!tick()) {
        startMountRetry();
      }
    }, REFRESH_MS);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function onUrlChange() {
    removePanels();
    dismissError();
    stopRefresh();
    stopMountRetry();
    if (isUsagePage()) {
      startMountRetry();
    }
  }

  function installUrlObserver() {
    if (urlObserver) return;
    urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onUrlChange();
      }
    });
    urlObserver.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', onUrlChange);
  }

  // ---------- Tab sleep / restore ----------

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isUsagePage()) {
      tick();
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && isUsagePage()) {
      tick();
    }
  });

  // ---------- Boot ----------

  function boot() {
    installUrlObserver();
    if (isUsagePage()) {
      startMountRetry();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
