// ==UserScript==
// @name         Gmail Enhancements
// @namespace    https://github.com/rpeck/rpeck-monkeyscripts
// @version      1.4.3
// @description  Gmail enhancements: Important Inbox button, task-email integration with highlighting
// @author       rpeck
// @match        https://mail.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  const IMPORTANT_SEARCH = 'is:important in:inbox';
  const IMPORTANT_SEARCHES = ['is:important', 'is:important in:inbox'];
  const BUTTON_ICON = '🎯';
  const HIGHLIGHT_COLOR = '#d93025'; // Gmail red

  // ============================================================
  // Debug logging
  // ============================================================

  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log('[Gmail Enhancements]', ...args);
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  /**
   * Wait for an element to appear in the DOM
   */
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  /**
   * Get current search query from URL hash
   */
  function getCurrentSearch() {
    const hash = window.location.hash;
    // Gmail search URLs look like #search/is%3Aimportant+in%3Ainbox
    const searchMatch = hash.match(/#search\/(.+)/);
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1].replace(/\+/g, ' '));
    }
    return null;
  }

  /**
   * Check if current search should trigger task sidebar
   */
  function shouldOpenTaskSidebar() {
    const search = getCurrentSearch();
    if (!search) return false;
    const normalized = search.toLowerCase().trim();
    return IMPORTANT_SEARCHES.some(s => normalized === s || normalized.startsWith(s + ' '));
  }

  // ============================================================
  // Feature 1: Important Inbox Button
  // ============================================================

  let buttonAdded = false;

  function addImportantInboxButton() {
    // Check if button already exists in DOM
    if (document.getElementById('important-inbox-btn')) {
      buttonAdded = true;
      return;
    }

    // Reset flag if button was removed
    buttonAdded = false;

    // Strategy: Add button to Gmail's left sidebar, right after the Compose button
    // This area is stable and won't be manipulated by Gmail's framework
    const composeBtn = document.querySelector('[gh="cm"]') || // Compose button
                       document.querySelector('[data-tooltip="Compose"]');

    if (!composeBtn) {
      log('Compose button not found yet');
      return;
    }

    // Find the compose button's container
    const composeContainer = composeBtn.closest('div[style*="padding"]') ||
                             composeBtn.parentElement?.parentElement;

    if (!composeContainer) {
      log('Compose container not found');
      return;
    }

    log('Found compose container:', composeContainer);

    // Create our button container
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'important-inbox-btn-wrapper';
    buttonWrapper.style.cssText = `
      padding: 0 16px;
      margin-top: 8px;
      margin-bottom: 8px;
    `;

    // Create our button - styled to match Gmail sidebar items
    const button = document.createElement('div');
    button.id = 'important-inbox-btn';
    button.textContent = `${BUTTON_ICON} Important Inbox`;
    button.title = 'Search: is:important in:inbox';
    button.style.cssText = `
      display: flex;
      align-items: center;
      padding: 6px 24px 6px 26px;
      border-radius: 0 16px 16px 0;
      font-size: 14px;
      font-family: Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
      cursor: pointer;
      color: white;
      background: #1a73e8;
      font-weight: 400;
      letter-spacing: 0.25px;
      transition: background 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#1557b0';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#1a73e8';
    });

    button.addEventListener('click', (e) => {
      log('Button clicked!');
      e.preventDefault();
      e.stopPropagation();
      executeImportantSearch();
    });

    buttonWrapper.appendChild(button);

    // Insert after the compose button container
    composeContainer.insertAdjacentElement('afterend', buttonWrapper);
    buttonAdded = true;
    log('Button added successfully after Compose button');
  }

  function executeImportantSearch() {
    log('Executing important search...');
    const searchInput = document.querySelector('input[aria-label="Search mail"]') ||
                        document.querySelector('input[aria-label="Ask Gmail"]') ||
                        document.querySelector('input[name="q"][type="text"]');
    if (!searchInput) {
      log('Search input not found for execution');
      return;
    }

    log('Setting search value to:', IMPORTANT_SEARCH);
    // Set the search value
    searchInput.value = IMPORTANT_SEARCH;
    searchInput.focus();

    // Trigger input event
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Trigger Enter key to execute search
    setTimeout(() => {
      log('Dispatching Enter key...');
      searchInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    }, 100);
  }

  // ============================================================
  // Feature 2: Tasks Sidebar Integration
  // ============================================================

  let cachedTasks = [];
  let tasksObserver = null;

  /**
   * Find the Tasks sidebar panel
   */
  function findTasksPanel() {
    // Gmail's Tasks panel is in an iframe or a specific panel structure
    // Look for multiple complementary regions and find the one with Tasks
    const complementaryRegions = document.querySelectorAll('[role="complementary"]');
    log('Found', complementaryRegions.length, 'complementary regions');

    for (const region of complementaryRegions) {
      const text = region.textContent || '';
      if (text.includes('TASKS') || text.includes('Add a task') || text.includes("'s list")) {
        log('Found Tasks panel in complementary region');
        return region;
      }
    }

    // Try finding by looking for the Tasks header directly
    const tasksHeaders = document.querySelectorAll('div, span, h2');
    for (const el of tasksHeaders) {
      if (el.textContent?.trim() === 'TASKS' || el.textContent?.trim() === 'Tasks') {
        // Found the header, get its container panel
        const panel = el.closest('[role="complementary"]') ||
                      el.closest('[data-panel-id]') ||
                      el.closest('aside') ||
                      el.parentElement?.parentElement?.parentElement;
        if (panel) {
          log('Found Tasks panel via header');
          return panel;
        }
      }
    }

    // Try finding the right-side panel area
    const rightPanels = document.querySelectorAll('.bq9, .brC-brG');
    for (const panel of rightPanels) {
      const text = panel.textContent || '';
      if (text.includes('TASKS') || text.includes('Add a task')) {
        log('Found Tasks panel via class selector');
        return panel;
      }
    }

    log('Tasks panel not found');
    return null;
  }

  /**
   * Check if Tasks sidebar is currently open
   */
  function isTasksSidebarOpen() {
    const panel = findTasksPanel();
    const isOpen = !!panel;
    log('Tasks sidebar check:', isOpen);
    return isOpen;
  }

  /**
   * Find and click the Tasks sidebar toggle button
   */
  function openTasksSidebar() {
    if (isTasksSidebarOpen()) return true;

    // Look for the Tasks icon button in the right sidebar
    // It's typically in the sidebar icon strip
    const sidebarButtons = document.querySelectorAll('[aria-label*="Tasks"], [data-tooltip*="Tasks"]');

    for (const btn of sidebarButtons) {
      if (btn.tagName === 'IMG' || btn.closest('div[role="button"]')) {
        const clickTarget = btn.closest('div[role="button"]') || btn;
        clickTarget.click();
        return true;
      }
    }

    // Alternative: look for the icon by image source or specific attributes
    const taskIcons = document.querySelectorAll('img[src*="tasks"], img[aria-label*="Tasks"]');
    for (const icon of taskIcons) {
      const clickable = icon.closest('div[role="button"]') || icon.closest('a') || icon;
      clickable.click();
      return true;
    }

    return false;
  }

  /**
   * Extract task titles from the Tasks sidebar
   */
  function extractTaskTitles() {
    const tasks = [];

    // Find the Tasks panel
    const tasksPanel = findTasksPanel();
    if (!tasksPanel) {
      log('extractTaskTitles: No Tasks panel found');
      return tasks;
    }

    log('extractTaskTitles: Found Tasks panel');

    // Look for task items - they're typically in a list structure
    // Task titles are usually in contenteditable divs or specific spans
    const taskElements = tasksPanel.querySelectorAll(
      '[role="listitem"], [data-id], .taskItem, [contenteditable="true"]'
    );

    log('extractTaskTitles: Found', taskElements.length, 'potential task elements');

    taskElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text !== 'Add a task') {
        tasks.push(text);
      }
    });

    // Alternative: find all text content that looks like task titles
    // Tasks panel has specific structure - look for the task list container
    if (tasks.length === 0) {
      log('extractTaskTitles: Trying fallback text extraction');

      // First, log ALL leaf text nodes to understand the structure
      const allElements = tasksPanel.querySelectorAll('*');
      const leafTexts = [];
      allElements.forEach(el => {
        if (el.children.length === 0) {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            leafTexts.push(text);
          }
        }
      });
      log('extractTaskTitles: All leaf texts in panel:', leafTexts);

      // Now extract tasks - filter out known UI elements
      const seenTexts = new Set();
      const uiPatterns = ['TASKS', 'Tasks', 'Add a task', 'Raymond', 'list', 'Details', 'Delete', 'More actions', 'Loading', 'Loading...'];

      allElements.forEach(el => {
        if (el.children.length === 0) {
          const text = el.textContent?.trim();
          if (text &&
              text.length > 5 &&
              text.length < 300 &&
              !seenTexts.has(text) &&
              !uiPatterns.some(p => text === p || text.startsWith(p + "'s"))) {
            seenTexts.add(text);
            tasks.push(text);
          }
        }
      });
    }

    log('extractTaskTitles: Extracted tasks:', tasks);
    return tasks;
  }

  /**
   * Extract email subjects from the email list
   */
  function getEmailRows() {
    // Gmail email rows are in a table or div structure
    // The subject is typically in a span with specific attributes
    const rows = [];

    // Find email rows - they're typically tr elements
    const emailRows = document.querySelectorAll('tr.zA, tr[role="row"]');
    log('getEmailRows: Found', emailRows.length, 'email rows');

    emailRows.forEach(row => {
      // Gmail subjects are typically in span elements within the row
      // Look for the subject span - it's often the element with the email subject text
      const subjectSpan = row.querySelector('span[data-thread-id]') ||
                          row.querySelector('.bog') ||
                          row.querySelector('span.bqe') ||
                          row.querySelector('span[id]');

      // Also try bold elements
      const boldElements = row.querySelectorAll('b, strong');

      let found = false;
      for (const bold of boldElements) {
        const text = bold.textContent?.trim();
        // Subject should be substantial text, not just a label
        if (text && text.length > 2 && !text.match(/^(Inbox|Sent|Draft|Spam|Trash|Starred|Important)$/i)) {
          rows.push({
            row: row,
            subjectElement: bold,
            subject: text
          });
          found = true;
          break;
        }
      }

      // If no bold element found, try other approaches
      if (!found && subjectSpan) {
        const text = subjectSpan.textContent?.trim();
        if (text && text.length > 2) {
          rows.push({
            row: row,
            subjectElement: subjectSpan,
            subject: text
          });
        }
      }
    });

    log('getEmailRows: Extracted', rows.length, 'subjects:', rows.map(r => r.subject.substring(0, 30)));
    return rows;
  }

  /**
   * Apply red highlighting to emails that match tasks
   */
  function highlightMatchingEmails(retryCount = 0) {
    log('highlightMatchingEmails: Starting... (retry:', retryCount, ')');

    const sidebarOpen = isTasksSidebarOpen();
    log('highlightMatchingEmails: Sidebar open?', sidebarOpen);
    if (!sidebarOpen) return;

    // Extract tasks (use cache if available and fresh)
    const tasks = extractTaskTitles();
    log('highlightMatchingEmails: Got', tasks.length, 'tasks');

    // If tasks are still loading, retry after a delay (max 5 retries)
    if (tasks.length === 0 || (tasks.length === 1 && tasks[0] === 'Loading...')) {
      if (retryCount < 5) {
        log('highlightMatchingEmails: Tasks still loading, retrying in 500ms...');
        setTimeout(() => highlightMatchingEmails(retryCount + 1), 500);
      }
      return;
    }

    cachedTasks = tasks;

    // Get email rows
    const emailRows = getEmailRows();
    log('highlightMatchingEmails: Got', emailRows.length, 'email rows');

    let matchCount = 0;
    emailRows.forEach(({ row, subjectElement, subject }) => {
      // Check if any task starts with this email subject (prefix match)
      const hasMatch = tasks.some(task =>
        task.toLowerCase().startsWith(subject.toLowerCase())
      );

      if (hasMatch) {
        log('highlightMatchingEmails: MATCH found for:', subject);
        subjectElement.style.color = HIGHLIGHT_COLOR;
        subjectElement.style.setProperty('color', HIGHLIGHT_COLOR, 'important');
        subjectElement.dataset.taskMatched = 'true';
        matchCount++;
      } else if (subjectElement.dataset.taskMatched === 'true') {
        // Remove highlighting if previously matched but no longer
        subjectElement.style.color = '';
        delete subjectElement.dataset.taskMatched;
      }
    });

    log('highlightMatchingEmails: Total matches:', matchCount);
  }

  // ============================================================
  // Observers and Event Handlers
  // ============================================================

  let mainObserver = null;
  let emailListObserver = null;

  /**
   * Handle search/navigation changes
   */
  function onSearchChange() {
    // Check if we should open tasks sidebar
    if (shouldOpenTaskSidebar()) {
      // Give Gmail time to render, then open sidebar
      setTimeout(() => {
        openTasksSidebar();
        // Wait for sidebar to open, then highlight
        setTimeout(highlightMatchingEmails, 500);
      }, 300);
    } else {
      // Just highlight if sidebar is already open
      setTimeout(highlightMatchingEmails, 500);
    }
  }

  /**
   * Set up observer for email list changes
   */
  function setupEmailListObserver() {
    if (emailListObserver) {
      emailListObserver.disconnect();
    }

    // Find the email list container
    const emailList = document.querySelector('[role="main"]') ||
                      document.querySelector('.AO') ||
                      document.querySelector('[aria-label*="mail"]');

    if (!emailList) return;

    emailListObserver = new MutationObserver((mutations) => {
      // Debounce: only process after DOM settles
      clearTimeout(emailListObserver.debounceTimer);
      emailListObserver.debounceTimer = setTimeout(() => {
        highlightMatchingEmails();
      }, 200);
    });

    emailListObserver.observe(emailList, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Main initialization
   */
  function init() {
    log('Initializing Gmail Enhancements...');

    // Set up main observer to watch for Gmail UI elements
    mainObserver = new MutationObserver((mutations) => {
      addImportantInboxButton();

      // Re-setup email list observer if needed
      if (!emailListObserver) {
        setupEmailListObserver();
      }
    });

    mainObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial setup
    log('Running initial setup...');
    addImportantInboxButton();
    setupEmailListObserver();

    // Listen for hash changes (navigation/search)
    window.addEventListener('hashchange', onSearchChange);

    // Initial check
    setTimeout(onSearchChange, 1000);
    log('Initialization complete');
  }

  // ============================================================
  // Start
  // ============================================================

  log('Script loaded, readyState:', document.readyState);

  // Wait for Gmail to load
  if (document.readyState === 'loading') {
    log('Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    log('DOM ready, starting init in 1 second...');
    setTimeout(init, 1000);
  }
})();
