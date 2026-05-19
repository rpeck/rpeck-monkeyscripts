// ==UserScript==
// @name         Claude Usage Sustainable Rate
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.2.1
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

  function textOf(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Row discovery ----------
  //
  // claude.ai/settings/usage lays each usage limit out as a single row
  // containing a label (e.g. "Current session", "All models"), a sub-label
  // (e.g. "Resets in 3 hr 42 min", "Resets Mon 1:00 PM"), a progress bar,
  // and a "NN% used" cell.  We anchor on the "Resets" text node and walk
  // up to the smallest ancestor that also contains a "%" elsewhere in the
  // row — that ancestor is the row container.

  function findUsageRows() {
    const out = [];
    if (!document.body) return out;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue || '';
      if (!/Resets?\b/i.test(v)) continue;
      let cur = n.parentElement;
      for (let i = 0; i < 12 && cur && cur !== document.body; i++) {
        const t = textOf(cur);
        if (/Resets?/i.test(t) && /\d+\s*%/.test(t)) {
          out.push(cur);
          break;
        }
        cur = cur.parentElement;
      }
    }
    // Dedup, then keep only the smallest matching ancestor (drop any row
    // that contains another row already in the list).
    const uniq = Array.from(new Set(out));
    return uniq.filter((r) => !uniq.some((o) => o !== r && r.contains(o)));
  }

  function classifyRow(row) {
    const t = textOf(row).toLowerCase();
    if (/current session|5[\s-]?hour|\bhourly\b|\b5\s*h\b/.test(t)) return 'hourly';
    if (/weekly|\bweek\b|\ball models\b|\bsonnet only\b|\bopus only\b/.test(t)) return 'weekly';
    // Heuristic fallback: short reset interval implies hourly.
    const reset = parseResetMs(row);
    if (reset == null) return null;
    const hoursOut = (reset - Date.now()) / 3600 / 1000;
    if (hoursOut <= 6) return 'hourly';
    return 'weekly';
  }

  function rowLabel(row) {
    // First short text line is usually the row's heading (e.g. "Current
    // session", "All models").  Pull a heading-like descendant if present,
    // else the first text node that isn't the "Resets ..." line.
    const heading = row.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
    if (heading) {
      const t = textOf(heading);
      if (t) return t;
    }
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null, false);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.nodeValue || '').trim();
      if (!t) continue;
      if (/^Resets?\b/i.test(t)) continue;
      if (/^\d+\s*%/.test(t)) continue;
      if (/^used$/i.test(t)) continue;
      if (t.length > 60) continue;
      return t;
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
    // Strategy A: <time datetime="..."> — most stable when present.
    const time = card.querySelector('time[datetime]');
    if (time) {
      const dt = new Date(time.getAttribute('datetime'));
      if (!isNaN(dt.getTime())) return dt.getTime();
    }

    const t = textOf(card);

    // Strategy B: any "Resets in ..." duration.  claude.ai uses
    // "Resets in 3 hr 42 min"; allow common variants.
    let m = t.match(/Resets?\s+in\s+([^\n.;]+?)(?:\.|;|\s{2}|$)/i);
    if (m) {
      const part = m[1];
      const hrM = part.match(/(\d+)\s*(?:hours?|hrs?|h\b)/i);
      const minM = part.match(/(\d+)\s*(?:minutes?|mins?|m\b)/i);
      const secM = part.match(/(\d+)\s*(?:seconds?|secs?|s\b)/i);
      const h = hrM ? parseInt(hrM[1], 10) : 0;
      const mm = minM ? parseInt(minM[1], 10) : 0;
      const s = secM ? parseInt(secM[1], 10) : 0;
      if (h > 0 || mm > 0 || s > 0) {
        return Date.now() + ((h * 3600 + mm * 60 + s) * 1000);
      }
    }

    // Strategy C: "Resets <Weekday> [at] H:MM AM/PM" — e.g.
    // "Resets Mon 1:00 PM" (no "at").
    m = t.match(/Resets?\s+(?:on\s+)?([A-Za-z]+)\s+(?:at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
    if (m) {
      const wd = parseWeekdayTime(m[1], m[2]);
      if (wd) return wd;
    }

    // Strategy D: "Resets at H:MM AM/PM" or "Resets at 18:30".
    m = t.match(/Resets?\s+(?:at|on)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
    if (m) {
      const parsed = parseClockTime(m[1]);
      if (parsed) return parsed;
    }

    // Strategy E: ISO-ish date string anywhere in the row.
    m = t.match(/(\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+)/);
    if (m) {
      const dt = new Date(m[1]);
      if (!isNaN(dt.getTime())) return dt.getTime();
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
    const days = {
      sun: 0, sunday: 0,
      mon: 1, monday: 1,
      tue: 2, tues: 2, tuesday: 2,
      wed: 3, weds: 3, wednesday: 3,
      thu: 4, thur: 4, thurs: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6,
    };
    const idx = days[weekday.toLowerCase()];
    if (idx == null) return null;
    const clockM = clock.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if (!clockM) return null;
    let hr = parseInt(clockM[1], 10);
    const min = parseInt(clockM[2], 10);
    const ampm = (clockM[3] || '').toLowerCase();
    if (ampm === 'pm' && hr < 12) hr += 12;
    if (ampm === 'am' && hr === 12) hr = 0;
    const d = new Date();
    d.setHours(hr, min, 0, 0);
    let guard = 0;
    while ((d.getDay() !== idx || d.getTime() <= Date.now()) && guard < 14) {
      d.setDate(d.getDate() + 1);
      guard++;
    }
    if (guard >= 14) return null;
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

  function formatLocalWhen(date) {
    const now = new Date();
    const target = new Date(date);
    const diffMs = target.getTime() - now.getTime();
    if (!Number.isFinite(diffMs)) return '—';
    if (diffMs <= 0) return 'now';

    const timeStr = target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = target.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = target.toDateString() === tomorrow.toDateString();

    if (sameDay) return `today ${timeStr}`;
    if (isTomorrow) return `tomorrow ${timeStr}`;
    const oneWeekMs = 7 * 24 * 3600 * 1000;
    if (diffMs < oneWeekMs) {
      const dow = target.toLocaleDateString([], { weekday: 'short' });
      return `${dow} ${timeStr}`;
    }
    const md = target.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${md} ${timeStr}`;
  }

  function formatDuration(hours) {
    if (!Number.isFinite(hours) || hours < 0) return '—';
    if (hours < 1) {
      const m = Math.round(hours * 60);
      return `${m}m`;
    }
    if (hours < 24) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(hours / 24);
    const h = Math.round(hours - d * 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }

  function ensurePanel(row, suffix) {
    const id = `${PANEL_ID_PREFIX}-${suffix}`;
    let panel = document.getElementById(id);
    if (panel && panel.previousElementSibling === row) return panel;
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = id;
    panel.setAttribute('data-rpeck-burn-rate', suffix);
    panel.style.cssText = [
      'margin: 6px 0 16px',
      'padding: 10px 12px',
      'border: 1px solid rgba(0,0,0,0.12)',
      'border-radius: 8px',
      'background: rgba(0,0,0,0.04)',
      'font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif',
      'color: inherit',
    ].join(';');

    const parent = row.parentElement;
    if (!parent) return null;
    if (row.nextSibling) {
      parent.insertBefore(panel, row.nextSibling);
    } else {
      parent.appendChild(panel);
    }
    return panel;
  }

  function renderPanel(panel, label, calc, kind) {
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

    const usedNum = calc.usedPct;
    if (kind === 'weekly') {
      const ratePerDay = calc.currentRate * 24;
      const targetPerDay = calc.sustainablePctPerHr * 24;
      const elapsedDays = calc.elapsedHours / 24;
      const remainingDays = calc.remainingHours / 24;
      sub.textContent =
        `${calc.usedPctText} used in ${elapsedDays.toFixed(2)}d ` +
        `\u2192 ${ratePerDay.toFixed(2)}%/day ` +
        `(target ${targetPerDay.toFixed(2)}%/day, ` +
        `${remainingDays.toFixed(2)}d until reset)`;
    } else {
      sub.textContent =
        `${calc.usedPctText} used in ${calc.elapsedHours.toFixed(2)}h ` +
        `\u2192 ${calc.currentRate.toFixed(2)}%/hr ` +
        `(target ${calc.sustainablePctPerHr.toFixed(2)}%/hr, ` +
        `${calc.remainingHours.toFixed(2)}h until reset)`;
    }

    // Projected run-out: assumes current burn rate holds.  For the
    // weekly window this is effectively the average daily rate (already
    // amortized over sleep/idle time since the rate is derived from
    // wall-clock elapsed hours).
    if (calc.currentRate > 0 && Number.isFinite(usedNum)) {
      const hoursToFull = (100 - usedNum) / calc.currentRate;
      if (hoursToFull > 0 && Number.isFinite(hoursToFull)) {
        const runOutDate = new Date(Date.now() + hoursToFull * 3600 * 1000);
        const runOutLine = document.createElement('div');
        runOutLine.style.cssText = 'margin-top:2px;font-size:12px;opacity:0.85;';
        const beforeReset = hoursToFull <= calc.remainingHours;
        const when = formatLocalWhen(runOutDate);
        const dur = formatDuration(hoursToFull);
        if (beforeReset) {
          runOutLine.textContent = `At the current usage rate, runs out: ${when} (in ${dur})`;
          runOutLine.style.color = '#991b1b';
          runOutLine.style.fontWeight = '600';
        } else {
          runOutLine.textContent = `At the current usage rate, would hit 100% on ${when} (in ${dur}) \u2014 but window resets first`;
        }
        panel.appendChild(runOutLine);
      }
    }
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

    const rows = findUsageRows();
    if (rows.length === 0) return false;

    let hourlyOk = false;
    const seenIds = new Set();
    let hourlyCount = 0;
    let weeklyCount = 0;

    for (const row of rows) {
      const kind = classifyRow(row);
      if (!kind) continue;
      const usedPct = parseUsedPct(row);
      const resetMs = parseResetMs(row);
      if (usedPct == null || resetMs == null) {
        console.warn(LOG_PREFIX, 'partial row extraction', {
          label: rowLabel(row), usedPct, resetMs, kind,
        });
        continue;
      }
      const msUntilReset = Math.max(0, resetMs - Date.now());
      const windowMs = kind === 'hourly' ? FIVE_HOUR_MS : WEEK_MS;
      const calc = computeRate(usedPct, msUntilReset, windowMs);
      calc.usedPct = usedPct;
      calc.usedPctText = `${usedPct}%`;
      if (calc.currentRate == null) calc.currentRate = 0;

      let suffix;
      if (kind === 'hourly') {
        suffix = `hourly-${hourlyCount++}`;
      } else {
        suffix = `weekly-${weeklyCount++}`;
      }
      seenIds.add(`${PANEL_ID_PREFIX}-${suffix}`);

      const label = rowLabel(row) || (kind === 'hourly' ? '5-hour window' : 'Weekly window');
      const windowText = kind === 'hourly' ? '5-hour' : 'weekly';
      const panel = ensurePanel(row, suffix);
      if (panel) {
        renderPanel(panel, `${label} \u00b7 ${windowText}`, calc, kind);
        if (kind === 'hourly') hourlyOk = true;
      }
    }

    // Remove any stale panels we didn't refresh this tick.
    document.querySelectorAll(`[id^="${PANEL_ID_PREFIX}-"]`).forEach((el) => {
      if (!seenIds.has(el.id)) el.remove();
    });

    if (!hourlyOk) return false;
    dismissError();
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
        if (!isUsagePage()) return;
        const rows = findUsageRows();
        if (rows.length === 0) {
          showSelectorError(['any usage row (label + "Resets" + "%") on the page']);
        } else if (!rows.some((r) => classifyRow(r) === 'hourly')) {
          showSelectorError(['the 5-hour / Current session usage row']);
        } else {
          showSelectorError(['the usage percentage or reset time inside the 5-hour row']);
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
