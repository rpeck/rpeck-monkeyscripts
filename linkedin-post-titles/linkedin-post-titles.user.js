// ==UserScript==
// @name         LinkedIn Post Titles
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.3.0
// @description  Replaces generic LinkedIn post tab titles with meaningful ones: "LinkedIn Post - Author - Topic"
// @author       rpeck
// @match        https://www.linkedin.com/posts/*
// @match        https://www.linkedin.com/feed/update/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/rpeck/rpeck-monkeyscripts/raw/main/linkedin-post-titles/linkedin-post-titles.user.js
// @downloadURL  https://github.com/rpeck/rpeck-monkeyscripts/raw/main/linkedin-post-titles/linkedin-post-titles.user.js
// ==/UserScript==

(function () {
  'use strict';

  const MAX_TOPIC_LENGTH = 80;
  const TITLE_PREFIX = 'LinkedIn Post';
  const SCRIPT_NAME = 'LinkedIn Post Titles';
  const ERROR_BANNER_ID = 'linkedin-post-titles-error-banner';
  const LOG_PREFIX = '[LinkedIn Post Titles]';

  // Cache the computed title so we can cheaply re-apply it when a
  // sleeping/discarded tab is restored by the browser or a tab manager.
  let cachedTitle = null;

  // Track which extractors found data on the most recent attempt.
  // Used to surface a clear error if LinkedIn changes its DOM again.
  let lastExtractionStatus = { author: false, topic: false };

  /**
   * Extract JSON-LD structured data from the page
   */
  function getJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'SocialMediaPosting' || data.mainEntity?.['@type'] === 'SocialMediaPosting') {
          return data['@type'] === 'SocialMediaPosting' ? data : data.mainEntity;
        }
      } catch (e) {
        // Continue to next script tag
      }
    }
    return null;
  }

  /**
   * Extract author name from the page
   */
  function getAuthorName() {
    // Most reliable: the control-menu button has aria-label "Open control menu for post by {Name}"
    const controlBtn = document.querySelector('button[aria-label^="Open control menu for post by "]');
    if (controlBtn) {
      const label = controlBtn.getAttribute('aria-label') || '';
      const m = label.match(/^Open control menu for post by\s+(.+?)\s*$/);
      if (m) return m[1].trim();
    }

    // Fallback: JSON-LD (older LinkedIn)
    const jsonLd = getJsonLd();
    if (jsonLd?.author?.name) {
      return jsonLd.author.name;
    }

    // Fallback: legacy class-based selectors (in case LinkedIn reverts)
    const authorSelectors = [
      '.update-components-actor__name .visually-hidden',
      '.update-components-actor__title .visually-hidden',
      '.feed-shared-actor__name',
      '.update-components-actor__name',
      'a[data-tracking-control-name="public_post_feed-actor-name"]',
      '.base-main-card__title',
    ];

    for (const selector of authorSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        const text = el.textContent.trim();
        const cleaned = text.replace(/View .+'s profile/i, '').trim();
        if (cleaned) {
          return cleaned.split('\n')[0].trim();
        }
      }
    }

    const authorMeta = document.querySelector('meta[name="author"]');
    if (authorMeta?.content) {
      return authorMeta.content;
    }

    return null;
  }

  /**
   * Extract topic/headline from JSON-LD
   */
  function getHeadlineFromJsonLd() {
    const jsonLd = getJsonLd();
    if (jsonLd?.headline) {
      return truncateText(jsonLd.headline, MAX_TOPIC_LENGTH);
    }
    if (jsonLd?.description) {
      return truncateText(jsonLd.description, MAX_TOPIC_LENGTH);
    }
    return null;
  }

  /**
   * Extract first N characters from post body
   */
  function getTopicFromPostBody() {
    // Current LinkedIn: post body is in [data-testid^="feed-commentary_"] or
    // [componentkey^="feed-commentary_"]
    const bodySelectors = [
      '[data-testid^="feed-commentary_"]',
      '[componentkey^="feed-commentary_"]',
      // Legacy fallbacks
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.feed-shared-text',
      '.break-words',
      '[data-test-id="main-feed-activity-card__commentary"]',
      '.attributed-text-segment-list__container',
    ];

    for (const selector of bodySelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        const text = el.textContent.trim();
        if (text.length > 10) {
          return truncateText(text, MAX_TOPIC_LENGTH);
        }
      }
    }

    return null;
  }

  /**
   * Extract hashtags from the post
   */
  function getHashtags() {
    const hashtags = [];
    const hashtagEls = document.querySelectorAll('a[href*="/feed/hashtag/"]');

    hashtagEls.forEach(el => {
      const tag = el.textContent?.trim();
      if (tag && tag.startsWith('#')) {
        hashtags.push(tag);
      }
    });

    if (hashtags.length > 0) {
      return hashtags.slice(0, 3).join(' ');
    }

    return null;
  }

  /**
   * Truncate text to max length, breaking at word boundary
   */
  function truncateText(text, maxLength) {
    // Normalize whitespace
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    // Find last space before maxLength
    const truncated = normalized.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.5) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Build and set the new page title
   */
  function updateTitle() {
    const author = getAuthorName();

    // Get topic using fallback chain
    const topic = getHeadlineFromJsonLd()
      || getTopicFromPostBody()
      || getHashtags();

    lastExtractionStatus = { author: !!author, topic: !!topic };

    // Build title
    let newTitle = TITLE_PREFIX;

    if (author) {
      newTitle += ` - ${author}`;
    }

    if (topic) {
      newTitle += ` - ${topic}`;
    }

    // Only update if we have meaningful content
    if (author || topic) {
      cachedTitle = newTitle;
      document.title = newTitle;
      return true;
    }

    return false;
  }

  /**
   * Show a visible error banner when extraction has failed entirely
   * (most likely cause: LinkedIn changed its DOM again).  Also logs
   * a structured diagnostic to the console so the user can paste it
   * into a bug report.
   */
  function showSelectorError({ author, topic }) {
    if (document.getElementById(ERROR_BANNER_ID)) return;

    const failed = [];
    if (!author) failed.push('author');
    if (!topic) failed.push('topic');

    const message = `${SCRIPT_NAME}: could not extract ${failed.join(' or ')} — LinkedIn's DOM has likely changed. Tab title was not updated.`;

    console.error(`${LOG_PREFIX} SELECTOR FAILURE`, {
      url: location.href,
      missing: failed,
      hint: 'Selectors used to extract data from LinkedIn posts no longer match. Update the script or report at https://github.com/rpeck/rpeck-monkeyscripts/issues',
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
    text.textContent = message;
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

  /**
   * Re-apply the cached title if the browser reset it (e.g. after tab
   * sleep/discard by Edge, Workona, or similar tab managers).
   */
  function reapplyTitle() {
    if (cachedTitle && document.title !== cachedTitle) {
      document.title = cachedTitle;
    }
  }

  /**
   * Wait for content to load, then update title
   */
  function init() {
    // Try immediately
    if (updateTitle()) {
      return;
    }

    // LinkedIn loads content dynamically; watch for changes
    let attempts = 0;
    const maxAttempts = 20;

    const observer = new MutationObserver(() => {
      attempts++;
      if (updateTitle() || attempts >= maxAttempts) {
        observer.disconnect();
        if (!cachedTitle) {
          showSelectorError(lastExtractionStatus);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Fallback: stop observing after 10 seconds
    setTimeout(() => {
      observer.disconnect();
      updateTitle(); // One final attempt
      if (!cachedTitle) {
        showSelectorError(lastExtractionStatus);
      }
    }, 10000);
  }

  // Re-apply title when a sleeping/discarded tab is restored.
  // "visibilitychange" fires when Edge or a tab manager (Workona, etc.)
  // wakes a backgrounded tab.  "pageshow" with persisted=true fires when
  // the page is restored from bfcache.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reapplyTitle();
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      reapplyTitle();
    }
  });

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();