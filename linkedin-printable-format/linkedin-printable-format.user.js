// ==UserScript==
// @name         LinkedIn Printable Format
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.2.0
// @description  Toggle clean, print-friendly views for LinkedIn profile detail pages and export Markdown
// @author       Raymond Peck
// @match        https://www.linkedin.com/in/*/details/*
// @icon         https://www.linkedin.com/favicon.ico
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/rpeck/rpeck-monkeyscripts/main/linkedin-printable-format/linkedin-printable-format.user.js
// @updateURL    https://raw.githubusercontent.com/rpeck/rpeck-monkeyscripts/main/linkedin-printable-format/linkedin-printable-format.user.js
// @homepageURL  https://github.com/rpeck/rpeck-monkeyscripts/tree/main/linkedin-printable-format
// @supportURL   https://github.com/rpeck/rpeck-monkeyscripts/issues
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'linkedin-printable-format-style';
  const FORMAT_BUTTON_ID = 'linkedin-printable-format-button';
  const RESET_BUTTON_ID = 'linkedin-printable-reset-button';
  const MARKDOWN_BUTTON_ID = 'linkedin-printable-markdown-button';
  const BODY_CLASS = 'linkedin-printable-format-mode';

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      body.${BODY_CLASS} {
        background: #fff !important;
        overflow: visible !important;
      }

      body.${BODY_CLASS} header,
      body.${BODY_CLASS} aside,
      body.${BODY_CLASS} footer,
      body.${BODY_CLASS} nav,
      body.${BODY_CLASS} .global-nav,
      body.${BODY_CLASS} .msg-overlay-container,
      body.${BODY_CLASS} .msg-overlay-list-bubble,
      body.${BODY_CLASS} .msg-overlay-bubble-header,
      body.${BODY_CLASS} .msg-overlay-conversation-bubble,
      body.${BODY_CLASS} .scaffold-layout__aside,
      body.${BODY_CLASS} .scaffold-layout__sidebar,
      body.${BODY_CLASS} .scaffold-layout-toolbar,
      body.${BODY_CLASS} .artdeco-toast-item,
      body.${BODY_CLASS} .pvs-navigation,
      body.${BODY_CLASS} .pv-profile-sticky-header,
      body.${BODY_CLASS} .profile-language,
      body.${BODY_CLASS} [aria-label="Profile language"],
      body.${BODY_CLASS} [data-view-name="profile-card"],
      body.${BODY_CLASS} .ad-banner-container,
      body.${BODY_CLASS} .premium-upsell-link,
      body.${BODY_CLASS} .right-rail,
      body.${BODY_CLASS} .authentication-outlet > div > div:not(.scaffold-layout) {
        display: none !important;
      }

      body.${BODY_CLASS} .scaffold-layout,
      body.${BODY_CLASS} .scaffold-layout__inner,
      body.${BODY_CLASS} .scaffold-layout__row,
      body.${BODY_CLASS} .scaffold-layout__content,
      body.${BODY_CLASS} .scaffold-layout__main,
      body.${BODY_CLASS} main {
        display: block !important;
        grid-template-columns: 1fr !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
      }

      body.${BODY_CLASS} .scaffold-layout__main,
      body.${BODY_CLASS} main > section,
      body.${BODY_CLASS} main .artdeco-card {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: 850px !important;
      }

      body.${BODY_CLASS} .scaffold-layout__main {
        padding: 24px !important;
      }

      body.${BODY_CLASS} section,
      body.${BODY_CLASS} .pvs-list__container,
      body.${BODY_CLASS} .pvs-list,
      body.${BODY_CLASS} .pvs-list__paged-list-item,
      body.${BODY_CLASS} .artdeco-card {
        box-shadow: none !important;
        border: none !important;
        background: #fff !important;
      }

      body.${BODY_CLASS} .artdeco-card {
        border-radius: 0 !important;
      }

      body.${BODY_CLASS} .pvs-entity__action-container,
      body.${BODY_CLASS} .pvs-list__footer-wrapper,
      body.${BODY_CLASS} .social-details-social-counts,
      body.${BODY_CLASS} .update-components-actor__sub-description,
      body.${BODY_CLASS} button[aria-label^="Edit"],
      body.${BODY_CLASS} button[aria-label*="add" i],
      body.${BODY_CLASS} button[aria-label*="Add"],
      body.${BODY_CLASS} button[aria-label*="reorder" i],
      body.${BODY_CLASS} .pvs-list__item--with-top-padding > div > div:first-child:not(:only-child) {
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

        body.${BODY_CLASS} .scaffold-layout__main {
          max-width: none !important;
          padding: 0 !important;
        }

        body.${BODY_CLASS} li,
        body.${BODY_CLASS} .pvs-list__paged-list-item,
        body.${BODY_CLASS} .pvs-entity {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        #${FORMAT_BUTTON_ID},
        #${RESET_BUTTON_ID},
        #${MARKDOWN_BUTTON_ID} {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

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

  function enablePrintableMode() {
    addStyles();
    expandSeeMoreButtons();
    document.body.classList.add(BODY_CLASS);
  }

  function disablePrintableMode() {
    document.body.classList.remove(BODY_CLASS);
  }

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
    const explicitHeading = document.querySelector('.scaffold-layout__main h1, main h1');
    const headingText = cleanText(explicitHeading?.innerText);
    if (headingText) return headingText;

    const section = getSectionName()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return section || 'LinkedIn Details';
  }

  function isHidden(el) {
    const style = window.getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  }

  function shouldSkipElement(el) {
    return Boolean(
      el.closest(`#${FORMAT_BUTTON_ID}`) ||
      el.closest(`#${RESET_BUTTON_ID}`) ||
      el.closest(`#${MARKDOWN_BUTTON_ID}`) ||
      el.matches('script, style, noscript, svg, img, nav, aside, footer, header, button') ||
      el.matches('.global-nav, .msg-overlay-container, .msg-overlay-list-bubble, .msg-overlay-bubble-header') ||
      el.matches('.pvs-entity__action-container, .pvs-list__footer-wrapper') ||
      isHidden(el)
    );
  }

  function textFromSelectors(root, selectors) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      const text = cleanText(el?.innerText);
      if (text) return text;
    }
    return '';
  }

  function directTexts(el) {
    return [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => cleanText(node.textContent))
      .filter(Boolean);
  }

  function visibleTextLines(el) {
    return cleanText(el?.innerText)
      .split('\n')
      .map(cleanText)
      .filter(Boolean);
  }

  function getDetailItems() {
    const main = document.querySelector('.scaffold-layout__main') || document.querySelector('main') || document.body;

    // LinkedIn detail pages usually render each record as one of these list items.
    const candidates = [
      ...main.querySelectorAll('li.pvs-list__paged-list-item'),
      ...main.querySelectorAll('.pvs-list > li'),
    ];

    const unique = [];
    const seen = new Set();

    for (const item of candidates) {
      if (shouldSkipElement(item)) continue;

      const text = cleanText(item.innerText);
      if (!text || seen.has(text)) continue;
      if (text.length < 8) continue;

      seen.add(text);
      unique.push(item);
    }

    return unique;
  }

  function roleMarkdownFromItem(item) {
    const lines = visibleTextLines(item);

    // Remove obvious LinkedIn UI/accessibility noise.
    const filtered = lines.filter((line) => {
      const lower = line.toLowerCase();
      return !(
        lower === 'edit' ||
        lower.startsWith('edit ') ||
        lower === 'show all' ||
        lower === 'see more' ||
        lower === 'show more'
      );
    });

    if (!filtered.length) return '';

    const title = filtered[0];
    const company = filtered[1] || '';
    const dates = filtered[2] || '';
    const location = filtered[3] || '';

    const bodyLines = filtered.slice(4).filter((line) => {
      const lower = line.toLowerCase();
      return !lower.includes('skill') && !lower.includes('skills');
    });

    const skillLine = filtered.find((line) => /\bskill(s)?\b/i.test(line));

    const out = [];
    out.push(`## ${title}`);

    const meta = [company, dates, location].filter(Boolean).join('  \n');
    if (meta) {
      out.push('');
      out.push(meta);
    }

    if (bodyLines.length) {
      out.push('');

      // Treat separate LinkedIn description lines as prose paragraphs, not list items.
      out.push(bodyLines.join('\n\n'));
    }

    if (skillLine) {
      out.push('');
      out.push(`**Skills:** ${skillLine.replace(/^.*?skills?\s*/i, '').trim() || skillLine}`);
    }

    return out.join('\n');
  }

  function fallbackDomToMarkdown(root) {
    const lines = [];
    const seenBlocks = new Set();

    function addBlock(text) {
      const cleaned = cleanText(text);
      if (!cleaned || seenBlocks.has(cleaned)) return;
      seenBlocks.add(cleaned);
      lines.push(cleaned, '');
    }

    function walk(node) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        addBlock(node.textContent);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node;
      const tag = el.tagName.toLowerCase();

      if (shouldSkipElement(el)) return;

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        const text = cleanText(el.innerText);
        if (text) lines.push(`${'#'.repeat(level)} ${text}`, '');
        return;
      }

      if (tag === 'li') {
        const text = cleanText(el.innerText);
        if (text && !seenBlocks.has(text)) {
          seenBlocks.add(text);
          lines.push(`- ${text.replace(/\n+/g, '\n  ')}`, '');
        }
        return;
      }

      for (const child of el.childNodes) walk(child);
    }

    walk(root);
    return lines.join('\n');
  }

  function normalizeMarkdown(markdown) {
    return markdown
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n';
  }

  function pageToMarkdown() {
    const main = document.querySelector('.scaffold-layout__main') || document.querySelector('main') || document.body;
    const sectionHeading = headingFromPage();
    const items = getDetailItems();

    const parts = [`# ${sectionHeading}`];

    if (items.length) {
      for (const item of items) {
        const itemMd = roleMarkdownFromItem(item);
        if (itemMd) parts.push(itemMd);
      }

      return normalizeMarkdown(parts.join('\n\n'));
    }

    parts.push(fallbackDomToMarkdown(main));
    return normalizeMarkdown(parts.join('\n\n'));
  }

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

  function downloadMarkdown() {
    expandSeeMoreButtons();

    window.setTimeout(() => {
      const markdown = pageToMarkdown();

      downloadTextFile({
        fileName: markdownFileNameFromPage(),
        text: markdown,
        mimeType: 'text/markdown;charset=utf-8',
      });
    }, 750);
  }

  function createButton({ id, text, right, background, onClick }) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = text;
    button.type = 'button';

    button.style.cssText = `
      position: fixed;
      top: 16px;
      right: ${right}px;
      z-index: 999999;
      padding: 10px 14px;
      background: ${background};
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    `;

    button.addEventListener('click', onClick);
    return button;
  }

  function addButtons() {
    if (document.getElementById(FORMAT_BUTTON_ID)) return;

    const formatButton = createButton({
      id: FORMAT_BUTTON_ID,
      text: 'Format for Print',
      right: 16,
      background: '#0a66c2',
      onClick: enablePrintableMode,
    });

    const resetButton = createButton({
      id: RESET_BUTTON_ID,
      text: 'Reset View',
      right: 170,
      background: '#555',
      onClick: disablePrintableMode,
    });

    const markdownButton = createButton({
      id: MARKDOWN_BUTTON_ID,
      text: 'Download Markdown',
      right: 290,
      background: '#333',
      onClick: downloadMarkdown,
    });

    document.body.appendChild(formatButton);
    document.body.appendChild(resetButton);
    document.body.appendChild(markdownButton);
  }

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
      document.body.classList.remove(BODY_CLASS);
      window.setTimeout(addButtons, 1000);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
