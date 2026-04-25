// ==UserScript==
// @name         LinkedIn Post Titles
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.1.0
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

  // Cache the computed title so we can cheaply re-apply it when a
  // sleeping/discarded tab is restored by the browser or a tab manager.
  let cachedTitle = null;

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
    // Try JSON-LD first
    const jsonLd = getJsonLd();
    if (jsonLd?.author?.name) {
      return jsonLd.author.name;
    }

    // Try the post author element in the DOM
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
        // Clean up the name (remove "View X's profile" etc.)
        const text = el.textContent.trim();
        const cleaned = text.replace(/View .+'s profile/i, '').trim();
        if (cleaned) {
          return cleaned.split('\n')[0].trim();
        }
      }
    }

    // Try meta tags
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
    const bodySelectors = [
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
        // Skip if it's just "see more" or similar
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