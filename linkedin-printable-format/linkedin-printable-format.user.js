// ==UserScript==
// @name         LinkedIn Printable Format
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.6.0
// @description  Toggle clean, print-friendly views for LinkedIn profile detail pages and export Markdown
// @author       Raymond Peck
// @match        https://www.linkedin.com/in/*/details/*
// @match        https://www.linkedin.com/in/*/details/*/*
// @match        https://*.linkedin.com/in/*/details/*
// @include      /^https:\/\/(www\.)?linkedin\.com\/in\/[^/]+\/details\/.+/
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

  function expandSeeMoreButtons() {
    const buttons = [...document.querySelectorAll('button')];

    for (const button of buttons) {
      const text = (
        button.innerText ||
        button.getAttribute('aria-label') ||
        ''
      ).toLowerCase();

      if (
        text.includes('see more') ||
        text.includes('show more') ||
        text.includes('show all') ||
        text.includes('more experiences') ||
        text.includes('more education') ||
        text.includes('more licenses') ||
        text.includes('more certifications') ||
        text.includes('more projects') ||
        text.includes('more skills')
      ) {
        button.click();
      }
    }
  }

  /**
   * Find every scrollable element in the page (overflow:auto/scroll
   * with non-trivial scrollable height).  LinkedIn sometimes nests
   * the actual scroll container inside main, so window.scrollTo alone
   * doesn't trigger lazy-load.
   */
  function findScrollables() {
    const out = [];
    const all = document.querySelectorAll('main, [role="main"], div, section');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 100) {
        out.push(el);
      }
    }
    return out;
  }

  /**
   * LinkedIn lazy-loads detail entries via IntersectionObserver as the
   * user scrolls.  We trigger that loading by repeatedly bringing the
   * last visible entry into view (works regardless of which element
   * is the actual scroll container), waiting for new entries to
   * render, and stopping when the entry count + heights stabilise.
   */
  async function autoScrollToLoadAll() {
    const originalY = window.scrollY;
    const stepDelay = 350;
    const maxIterations = 60;
    const stableThreshold = 4;

    let lastFingerprint = '';
    let stableCount = 0;
    let iterations = 0;

    console.log('[LinkedIn Printable Format] autoScrollToLoadAll: starting');

    while (stableCount < stableThreshold && iterations < maxIterations) {
      // Strategy 1: scroll the last entity item into view.  This
      // delegates to whichever element is actually scrollable and is
      // the most reliable trigger for LinkedIn's IntersectionObservers.
      const items = document.querySelectorAll('[componentkey^="entity-collection-item"]');
      const lastItem = items[items.length - 1];
      if (lastItem) {
        lastItem.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
      }

      // Strategy 2: belt-and-suspenders — scroll window and any
      // discovered inner scrollable container to its max.
      window.scrollTo(0, document.documentElement.scrollHeight);
      for (const el of findScrollables()) {
        el.scrollTop = el.scrollHeight;
      }

      // Strategy 3: click any "see more" buttons that became visible
      expandSeeMoreButtons();

      await new Promise(r => setTimeout(r, stepDelay));

      const newCount = document.querySelectorAll('[componentkey^="entity-collection-item"]').length;
      const docH = document.documentElement.scrollHeight;
      const bodyH = document.body.scrollHeight;
      const fingerprint = `${newCount}:${docH}:${bodyH}`;

      if (fingerprint === lastFingerprint) {
        stableCount++;
      } else {
        stableCount = 0;
        lastFingerprint = fingerprint;
      }

      iterations++;

      // Update the busy pill so the user can see progress.
      setBusy(true, `Loading entries\u2026 (${newCount} so far)`);
    }

    console.log('[LinkedIn Printable Format] autoScrollToLoadAll: done after', iterations, 'iterations,', lastFingerprint);

    // Restore the user's scroll position.
    window.scrollTo({ top: originalY, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 150));
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
      expandSeeMoreButtons();

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
      expandSeeMoreButtons();
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
