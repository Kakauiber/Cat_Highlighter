// Content script for the highlighter extension.  Provides the core logic
// for highlighting and underlining selected text on web pages, attaching
// annotations, copying and deleting highlights, showing a floating
// toolbar, and restoring highlights on reload.  It stores data in both
// page-local storage and chrome.storage.local so that the management
// interface can aggregate highlights across all pages.

// Blacklist check: if current domain is disabled or globally disabled, do nothing
const hostname = window.location.hostname;
const EARLY_FRAME_DEBUG_ENABLED = /(^|\.)perplexity\.ai$/i.test(hostname) || /comet/i.test(hostname);

function logEarlyFrameDebug(eventName, extra = {}) {
  if (!EARLY_FRAME_DEBUG_ENABLED) return;
  console.info('[Highlight Cat][FrameDebug][Early]', eventName, {
    href: window.location.href,
    hostname,
    isTopWindow: (() => {
      try {
        return window.top === window;
      } catch (err) {
        return false;
      }
    })(),
    ...extra
  });
}

logEarlyFrameDebug('content-script-loaded');

chrome.storage.local.get(['disabled_domains', 'global_disabled'], (res) => {
  logEarlyFrameDebug('blacklist-check', {
    globalDisabled: !!res.global_disabled,
    disabledDomainsCount: Array.isArray(res.disabled_domains) ? res.disabled_domains.length : 0,
    hostDisabled: Array.isArray(res.disabled_domains) ? res.disabled_domains.includes(hostname) : false
  });
  if (res.global_disabled) {
    console.log('[Highlight Cat] Extension globally disabled');
    logEarlyFrameDebug('blocked-by-global-disabled');
    return; // Stop execution
  }
  const disabled = res.disabled_domains || [];
  if (disabled.includes(hostname)) {
    console.log('[Highlight Cat] Extension disabled on this domain:', hostname);
    logEarlyFrameDebug('blocked-by-disabled-domain');
    return; // Stop execution
  }
  // If not disabled, initialize the extension
  logEarlyFrameDebug('init-extension');
  initExtension();
});

function initExtension() {

  // Define available highlight colours.  Each entry defines the background
  // colour for a highlight.  Underlines always use the unified colour
  // defined by UNDERLINE_COLOR.
  const AVAILABLE_COLORS = {
    yellow: { background: '#FFEA8A' }, // Warm Sun
    blue: { background: 'rgba(132, 194, 235, 0.62)' }, // Soft Mist Blue
    red: { background: '#FF8A8A' },    // Soft Coral Red
    mint: { background: 'rgba(132, 194, 235, 0.62)' }, // Legacy alias
    coral: { background: '#FF8A8A' }   // Legacy alias
  };
  const TOOLBAR_COLOR_ORDER = ['yellow', 'blue', 'red'];
  // Unified colour for underline markings
  const UNDERLINE_COLOR = '#666666';
  const FRAME_DEBUG_ENABLED = /(^|\.)perplexity\.ai$/i.test(window.location.hostname) || /comet/i.test(window.location.hostname);

  function describeNode(node) {
    if (!node) return 'null';
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      return `#text(${parent ? parent.tagName.toLowerCase() : 'no-parent'})`;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return node.host ? `shadow-root(${node.host.tagName.toLowerCase()})` : 'document-fragment';
    }
    if (node.nodeType === Node.DOCUMENT_NODE) {
      return 'document';
    }
    return node.tagName ? node.tagName.toLowerCase() : String(node.nodeName || node);
  }

  function getSelectionDebugSnapshot() {
    const sel = window.getSelection();
    const snapshot = {
      hasSelection: !!sel,
      rangeCount: sel ? sel.rangeCount : 0,
      isCollapsed: sel ? sel.isCollapsed : true,
      textLength: 0,
      textSample: '',
      anchorNode: '',
      focusNode: '',
      commonAncestor: '',
      rootNode: ''
    };

    if (!sel) return snapshot;

    const text = sel.toString();
    snapshot.textLength = text.length;
    snapshot.textSample = text.slice(0, 120);
    snapshot.anchorNode = describeNode(sel.anchorNode);
    snapshot.focusNode = describeNode(sel.focusNode);

    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      snapshot.commonAncestor = describeNode(range.commonAncestorContainer);
      const root = range.commonAncestorContainer && typeof range.commonAncestorContainer.getRootNode === 'function'
        ? range.commonAncestorContainer.getRootNode()
        : null;
      snapshot.rootNode = describeNode(root);
    }

    return snapshot;
  }

  function getFrameDebugContext() {
    let isTopWindow = false;
    try {
      isTopWindow = window.top === window;
    } catch (err) {
      isTopWindow = false;
    }

    let frameElementTag = '';
    let frameElementSrc = '';
    try {
      frameElementTag = window.frameElement ? describeNode(window.frameElement) : '';
      frameElementSrc = window.frameElement && typeof window.frameElement.getAttribute === 'function'
        ? (window.frameElement.getAttribute('src') || '')
        : '';
    } catch (err) {
      frameElementTag = 'inaccessible';
    }

    const iframeCandidates = [];
    try {
      document.querySelectorAll('iframe').forEach((iframe, index) => {
        if (index >= 5) return;
        iframeCandidates.push({
          src: iframe.getAttribute('src') || '',
          id: iframe.id || '',
          className: iframe.className || ''
        });
      });
    } catch (err) {
      iframeCandidates.push({ error: String(err) });
    }

    return {
      href: window.location.href,
      isTopWindow,
      frameElementTag,
      frameElementSrc,
      iframeCount: iframeCandidates.length,
      iframeCandidates
    };
  }

  function logFrameDebug(eventName, extra = {}) {
    if (!FRAME_DEBUG_ENABLED) return;
    console.info('[Highlight Cat][FrameDebug]', eventName, {
      ...getFrameDebugContext(),
      ...extra
    });
  }

  /**
   * Determine whether the current selection originates in a contenteditable
   * element or textarea.  Selections in editors should use execCommand
   * methods rather than direct DOM manipulation.
   */
  function selectionInEditable() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.anchorNode;
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node) {
      if (node.isContentEditable) return true;
      if (node.nodeName === 'TEXTAREA') return true;
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Determine whether a given Range belongs to a contenteditable context.
   * Used when reapplying stored ranges after the selection has collapsed.
   */
  function rangeInEditable(range) {
    if (!range) return false;
    let node = range.startContainer;
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node) {
      if (node.isContentEditable) return true;
      if (node.nodeName === 'TEXTAREA') return true;
      node = node.parentElement;
    }
    return false;
  }

  // Track the last selected colour across toolbar interactions
  let lastSelectedColor = 'yellow';

  // Remember the most recent selection so that we can highlight even after
  // focus shifts away from the page (e.g. when the popup is opened)
  let lastSelection = {
    range: null,
    text: ''
  };

  let currentPageUrl = window.location.href;
  let pinnedAnnotationId = null;
  const NOTE_PREFIX = 'page_notes_';
  let highlightStorageQueue = Promise.resolve();

  function getCurrentPageUrl() {
    return window.location.href;
  }

  function getStorageKey(url = getCurrentPageUrl()) {
    return 'page_highlights_' + url;
  }

  function getNoteStorageKey(url = getCurrentPageUrl()) {
    return NOTE_PREFIX + url;
  }

  function queueHighlightStorageMutation(storageKey, mutator, onComplete) {
    highlightStorageQueue = highlightStorageQueue
      .catch(() => {})
      .then(() => new Promise(resolve => {
        try {
          chrome.storage && chrome.storage.local.get([storageKey], (result) => {
            const current = Array.isArray(result[storageKey]) ? result[storageKey] : [];
            const next = mutator(current.slice());

            if (!Array.isArray(next)) {
              if (typeof onComplete === 'function') onComplete(current);
              resolve();
              return;
            }

            chrome.storage.local.set({ [storageKey]: next }, () => {
              if (typeof onComplete === 'function') onComplete(next);
              resolve();
            });
          });
        } catch (err) {
          console.warn('[Highlight Cat] Failed to queue storage mutation:', err);
          resolve();
        }
      }));

    return highlightStorageQueue;
  }

  function normalizeTitleCandidate(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isUrlLikeTitle(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function isGenericSiteTitle(value) {
    const normalized = normalizeTitleCandidate(value).toLowerCase();
    return [
      'google gemini',
      'gemini',
      '对话',
      '新对话',
      'chat',
      'new chat',
      'chatgpt',
      'kimi',
      'deepseek',
      'claude',
      'perplexity',
      'google ai studio'
    ].includes(normalized);
  }

  function collectTitleFromMatchingLinks() {
    const path = window.location.pathname || '';
    const conversationId = path.split('/').filter(Boolean).pop();
    if (!conversationId) return '';

    const matches = [];
    document.querySelectorAll(
      'nav a[href], aside a[href], nav button, aside button, nav [aria-current="page"], aside [aria-current="page"], [role="navigation"] a[href], [role="navigation"] button'
    ).forEach(node => {
      const directHref = typeof node.getAttribute === 'function' ? (node.getAttribute('href') || '') : '';
      const nestedLink = typeof node.querySelector === 'function' ? node.querySelector('a[href]') : null;
      const href = directHref || (nestedLink && nestedLink.getAttribute('href')) || '';
      const ariaCurrent = typeof node.getAttribute === 'function' ? node.getAttribute('aria-current') : '';
      const text = normalizeTitleCandidate(
        typeof node.getAttribute === 'function'
          ? (node.getAttribute('aria-label') || node.textContent || '')
          : (node.textContent || '')
      );

      if (!text || text.length < 2 || isUrlLikeTitle(text) || isGenericSiteTitle(text)) {
        return;
      }

      if ((href && href.includes(conversationId)) || ariaCurrent === 'page') {
        matches.push(text);
      }
    });

    matches.sort((a, b) => b.length - a.length);
    return matches[0] || '';
  }

  function collectTitleFromSidebarCandidates() {
    const matches = [];
    document.querySelectorAll(
      'nav a[href], aside a[href], nav button, aside button, [role="navigation"] a[href], [role="navigation"] button'
    ).forEach(node => {
      const text = normalizeTitleCandidate(
        typeof node.getAttribute === 'function'
          ? (node.getAttribute('aria-label') || node.textContent || '')
          : (node.textContent || '')
      );

      if (!text || text.length < 4 || isUrlLikeTitle(text) || isGenericSiteTitle(text)) {
        return;
      }

      matches.push(text);
    });

    matches.sort((a, b) => b.length - a.length);
    return matches[0] || '';
  }

  function collectTitleFromSelectors(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = normalizeTitleCandidate(node && node.textContent);
      if (!text || text.length < 2 || isUrlLikeTitle(text) || isGenericSiteTitle(text)) {
        continue;
      }
      return text;
    }
    return '';
  }

  function getPreferredPageTitle() {
    const host = window.location.hostname;
    const domainSpecificSelectors = [];

    if (host.includes('gemini.google.com')) {
      domainSpecificSelectors.push(
        'nav [aria-current="page"]',
        'aside [aria-current="page"]',
        'main h1',
        'main h2'
      );
    } else if (host.includes('chatgpt.com')) {
      domainSpecificSelectors.push(
        'nav [aria-current="page"]',
        'main h1',
        'main h2'
      );
    } else if (host.includes('kimi.com') || host.includes('moonshot.cn')) {
      domainSpecificSelectors.push(
        'nav [aria-current="page"]',
        'aside [aria-current="page"]',
        'main h1',
        'main h2'
      );
    } else if (host.includes('deepseek.com')) {
      domainSpecificSelectors.push(
        'nav [aria-current="page"]',
        'aside [aria-current="page"]',
        'main h1',
        'main h2'
      );
    }

    const genericSelectors = [
      '[data-testid="conversation-title"]',
      '[data-test-id="conversation-title"]',
      'main h1',
      'main h2',
      'article h1',
      '[aria-current="page"]'
    ];

    const matchedLinkTitle = collectTitleFromMatchingLinks();
    if (matchedLinkTitle) return matchedLinkTitle;

    const selectorTitle = collectTitleFromSelectors(domainSpecificSelectors.concat(genericSelectors));
    if (selectorTitle) return selectorTitle;

    const sidebarTitle = collectTitleFromSidebarCandidates();
    if (sidebarTitle) return sidebarTitle;

    const metaTitle = normalizeTitleCandidate(
      document.querySelector('meta[property="og:title"]') &&
      document.querySelector('meta[property="og:title"]').getAttribute('content')
    );
    if (metaTitle && !isUrlLikeTitle(metaTitle)) {
      return metaTitle;
    }

    const documentTitle = normalizeTitleCandidate(document.title);
    if (documentTitle) {
      return documentTitle;
    }

    return getCurrentPageUrl();
  }

  function shouldUpgradePageTitle(currentTitle, nextTitle) {
    const current = normalizeTitleCandidate(currentTitle);
    const next = normalizeTitleCandidate(nextTitle);

    if (!next || current === next) return false;
    if (!current || isUrlLikeTitle(current)) return true;

    const currentGeneric = isGenericSiteTitle(current);
    const nextGeneric = isGenericSiteTitle(next);
    if (currentGeneric && !nextGeneric) return true;

    return false;
  }

  function syncCurrentPageTitleMetadata(callback) {
    const currentUrl = getCurrentPageUrl();
    const preferredTitle = getPreferredPageTitle();
    const storageKey = getStorageKey(currentUrl);
    const noteKey = getNoteStorageKey(currentUrl);

    chrome.storage.local.get([storageKey, noteKey], (result) => {
      const updates = {};
      let changed = false;

      const highlights = Array.isArray(result[storageKey]) ? result[storageKey] : [];
      if (highlights.length > 0) {
        const nextHighlights = highlights.map(item => {
          if (shouldUpgradePageTitle(item.pageTitle, preferredTitle)) {
            changed = true;
            return {
              ...item,
              pageTitle: preferredTitle,
              pageUrl: currentUrl
            };
          }
          return item;
        });

        if (changed) {
          updates[storageKey] = nextHighlights;
        }
      }

      const noteRecord = result[noteKey];
      if (noteRecord && typeof noteRecord === 'object' && shouldUpgradePageTitle(noteRecord.pageTitle, preferredTitle)) {
        updates[noteKey] = {
          ...noteRecord,
          pageTitle: preferredTitle,
          pageUrl: currentUrl
        };
        changed = true;
      }

      if (changed) {
        chrome.storage.local.set(updates, () => callback(preferredTitle));
        return;
      }

      callback(preferredTitle);
    });
  }

  function unwrapRenderedHighlights() {
    document.querySelectorAll('span[data-hl-id]').forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    document.querySelectorAll('.hl-control-overlay').forEach(el => el.remove());
    hideAnnotationTooltip();
    hideToolbar();
  }

  function handleUrlChange() {
    const nextUrl = getCurrentPageUrl();
    if (nextUrl === currentPageUrl) return false;

    currentPageUrl = nextUrl;
    lastSelection = { range: null, text: '' };
    unwrapRenderedHighlights();
    return true;
  }

  // Generate an id for a new highlight
  function generateId() {
    return 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Persist a highlight object to chrome.storage.local and chrome.storage.sync.
   * Each highlight has the shape:
   * { id, text, color, type, annotation?, pageTitle?, xpath?, context?, hash? }
   */
  function persistHighlight(hlObj) {
    const storageKey = getStorageKey();

    // Save the page title if not already present
    if (!hlObj.pageTitle) {
      hlObj.pageTitle = getPreferredPageTitle();
    }
    hlObj.pageUrl = getCurrentPageUrl();
    // Add timestamp for sync ordering
    if (!hlObj.timestamp) {
      hlObj.timestamp = Date.now();
    }
    // Generate text hash for quick comparison
    if (!hlObj.hash && hlObj.text) {
      hlObj.hash = simpleHash(hlObj.text);
    }

    // Persist to chrome.storage.local
    try {
      queueHighlightStorageMutation(storageKey, (arr) => {
        arr.push(hlObj);
        return arr;
      }, (arr) => {
        notifyPageHighlightsChanged(storageKey, arr);
      });
    } catch (e) { }

    // Sync to chrome.storage.sync (cloud sync) - only index data to save space
    try {
      syncToCloud(hlObj);
    } catch (e) { }
  }

  function notifyPageHighlightsChanged(storageKey, highlights) {
    try {
      if (!chrome.runtime || !chrome.runtime.sendMessage) return;
      const payload = {
        command: 'pageHighlightsChanged',
        pageUrl: getCurrentPageUrl(),
        storageKey: storageKey || getStorageKey(),
        pageTitle: getPreferredPageTitle(),
        highlights: Array.isArray(highlights) ? highlights : []
      };
      const maybePromise = chrome.runtime.sendMessage(payload);
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch (e) { }
  }

  function getCurrentPageHighlightsSnapshot() {
    const domHighlights = collectHighlightsFromDom();
    return Array.isArray(domHighlights) ? domHighlights : [];
  }

  function updateStoredHighlightRecords(mutator, callback) {
    try {
      chrome.storage && chrome.storage.local.get(null, (result) => {
        const all = result && typeof result === 'object' ? result : {};
        const updates = {};
        let changed = false;

        Object.keys(all).forEach(key => {
          if (!key.startsWith('page_highlights_')) return;
          const arr = Array.isArray(all[key]) ? all[key] : [];
          const nextArr = mutator(arr, key);
          if (nextArr && nextArr !== arr) {
            updates[key] = nextArr;
            changed = true;
          }
        });

        if (!changed) {
          if (typeof callback === 'function') callback(false);
          return;
        }

        chrome.storage.local.set(updates, () => {
          if (typeof callback === 'function') callback(true);
        });
      });
    } catch (e) {
      if (typeof callback === 'function') callback(false);
    }
  }

  /**
   * Sync highlight index to chrome.storage.sync for cross-device sync.
   * Only stores minimal data to fit within the 100KB quota.
   */
  function syncToCloud(hlObj) {
    if (!chrome.storage || !chrome.storage.sync) return;

    chrome.storage.sync.get(['highlight_index'], (result) => {
      let index = Array.isArray(result.highlight_index) ? result.highlight_index : [];

      // Create minimal index entry (to save sync storage space)
      const indexEntry = {
        id: hlObj.id,
        text: (hlObj.text || '').slice(0, 50), // First 50 chars only
        color: hlObj.color,
        type: hlObj.type,
        url: getCurrentPageUrl(),
        pageTitle: (hlObj.pageTitle || '').slice(0, 50),
        timestamp: hlObj.timestamp
      };

      index.push(indexEntry);

      // Keep only the most recent 500 entries to stay within quota
      if (index.length > 500) {
        index = index.slice(-500);
      }

      chrome.storage.sync.set({ highlight_index: index }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Highlight Cat] Sync failed:', chrome.runtime.lastError.message);
        }
      });
    });
  }

  /**
   * Simple hash function for quick text comparison.
   */
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  function collectHighlightsFromDom() {
    const byId = new Map();

    document.querySelectorAll('span[data-hl-id]').forEach(span => {
      const spanPageUrl = span.getAttribute('data-page-url');
      if (spanPageUrl && spanPageUrl !== getCurrentPageUrl()) return;

      const id = span.getAttribute('data-hl-id');
      if (!id) return;

      let item = byId.get(id);
      if (!item) {
        item = {
          id,
          text: '',
          color: span.getAttribute('data-hl-color') || 'yellow',
          type: span.getAttribute('data-hl-type') || 'highlight',
          annotation: span.getAttribute('data-annotation') || '',
          segments: [],
          pageTitle: getPreferredPageTitle(),
          pageUrl: getCurrentPageUrl(),
          timestamp: Date.now()
        };
        byId.set(id, item);
      }

      const segmentText = (span.textContent || '').trim();
      if (segmentText) {
        item.segments.push(segmentText);
        item.text += segmentText;
      }

      if (!item.annotation) {
        item.annotation = span.getAttribute('data-annotation') || '';
      }
    });

    return Array.from(byId.values())
      .map(item => {
        const text = item.text.trim();
        return {
          ...item,
          text,
          hash: text ? simpleHash(text) : ''
        };
      })
      .filter(item => item.text);
  }

  function syncDomHighlightsToStorage() {
    const storageKey = getStorageKey();

    try {
      chrome.storage.local.get([storageKey], (result) => {
        const stored = Array.isArray(result[storageKey]) ? result[storageKey] : [];
        if (stored.length > 0) return;

        const domHighlights = collectHighlightsFromDom();
        if (domHighlights.length === 0) return;

        chrome.storage.local.set({ [storageKey]: domHighlights }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Highlight Cat] Failed to backfill DOM highlights:', chrome.runtime.lastError.message);
          } else {
            console.log('[Highlight Cat] Backfilled highlights from existing DOM:', domHighlights.length);
          }
        });
      });
    } catch (e) {
      console.warn('[Highlight Cat] Failed to inspect DOM highlights:', e);
    }
  }

  function reconcileDomHighlightsWithStorage(existingData, callback) {
    const storageKey = getStorageKey();
    const stored = Array.isArray(existingData) ? existingData : [];
    const domHighlights = collectHighlightsFromDom();

    if (domHighlights.length === 0) {
      callback(stored);
      return;
    }

    const merged = [...stored];
    const indexById = new Map();
    merged.forEach((item, index) => {
      if (item && item.id) {
        indexById.set(item.id, index);
      }
    });

    let changed = false;

    domHighlights.forEach(domItem => {
      const existingIndex = indexById.get(domItem.id);
      if (existingIndex === undefined) {
        merged.push(domItem);
        indexById.set(domItem.id, merged.length - 1);
        changed = true;
        return;
      }

      const existingItem = merged[existingIndex];
      if (!existingItem || typeof existingItem !== 'object') {
        merged[existingIndex] = domItem;
        changed = true;
        return;
      }

      const nextItem = { ...existingItem };
      let itemChanged = false;

      if ((!nextItem.text || nextItem.text !== domItem.text) && domItem.text) {
        nextItem.text = domItem.text;
        itemChanged = true;
      }

      if ((!Array.isArray(nextItem.segments) || nextItem.segments.length === 0) && Array.isArray(domItem.segments) && domItem.segments.length > 0) {
        nextItem.segments = domItem.segments;
        itemChanged = true;
      }

      if (!nextItem.annotation && domItem.annotation) {
        nextItem.annotation = domItem.annotation;
        itemChanged = true;
      }

      if ((!nextItem.hash || nextItem.hash !== domItem.hash) && domItem.hash) {
        nextItem.hash = domItem.hash;
        itemChanged = true;
      }

      if ((!nextItem.pageUrl || nextItem.pageUrl !== domItem.pageUrl) && domItem.pageUrl) {
        nextItem.pageUrl = domItem.pageUrl;
        itemChanged = true;
      }

      if (shouldUpgradePageTitle(nextItem.pageTitle, domItem.pageTitle)) {
        nextItem.pageTitle = domItem.pageTitle;
        itemChanged = true;
      }

      if (itemChanged) {
        merged[existingIndex] = nextItem;
        changed = true;
      }
    });

    if (!changed) {
      callback(merged);
      return;
    }

    chrome.storage.local.set({ [storageKey]: merged }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Highlight Cat] Failed to reconcile DOM highlights:', chrome.runtime.lastError.message);
      } else {
        console.log('[Highlight Cat] Reconciled DOM highlights with storage:', merged.length);
      }
      callback(merged);
    });
  }

  function recoverCurrentPageHighlightsFromSync(callback) {
    const currentUrl = getCurrentPageUrl();
    const currentKey = getStorageKey(currentUrl);

    if (!chrome.storage || !chrome.storage.local || !chrome.storage.sync) {
      callback([]);
      return;
    }

    chrome.storage.sync.get(['highlight_index'], (syncResult) => {
      const index = Array.isArray(syncResult.highlight_index) ? syncResult.highlight_index : [];
      const targetIds = new Set(
        index
          .filter(item => item && item.url === currentUrl && item.id)
          .map(item => item.id)
      );

      if (targetIds.size === 0) {
        callback([]);
        return;
      }

      chrome.storage.local.get(null, (all) => {
        const updates = {};
        const currentArr = Array.isArray(all[currentKey]) ? [...all[currentKey]] : [];
        const existingIds = new Set(currentArr.map(item => item.id));
        let movedCount = 0;

        Object.keys(all).forEach(key => {
          if (!key.startsWith('page_highlights_') || key === currentKey) return;

          const arr = Array.isArray(all[key]) ? all[key] : [];
          if (arr.length === 0) return;

          const keep = [];
          let changed = false;

          arr.forEach(item => {
            if (item && targetIds.has(item.id)) {
              changed = true;
              movedCount++;
              if (!existingIds.has(item.id)) {
                currentArr.push({
                  ...item,
                  pageTitle: item.pageTitle || getPreferredPageTitle() || currentUrl,
                  pageUrl: currentUrl
                });
                existingIds.add(item.id);
              }
            } else {
              keep.push(item);
            }
          });

          if (changed) {
            updates[key] = keep;
          }
        });

        if (movedCount === 0) {
          callback(currentArr);
          return;
        }

        updates[currentKey] = currentArr;
        chrome.storage.local.set(updates, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Highlight Cat] Failed to recover misplaced highlights:', chrome.runtime.lastError.message);
          } else {
            console.log('[Highlight Cat] Recovered misplaced highlights for current page:', movedCount);
          }
          callback(currentArr);
        });
      });
    });
  }

  /**
   * Get XPath for a DOM element.
   */
  function getXPath(element) {
    if (!element) return '';
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';

    let ix = 0;
    const siblings = element.parentNode ? element.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        const parentPath = getXPath(element.parentNode);
        const tagName = element.tagName.toLowerCase();
        return `${parentPath}/${tagName}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return '';
  }

  /**
   * Get context around the selected text (before and after).
   */
  function getContext(range, contextLength = 30) {
    if (!range) return { before: '', after: '' };

    try {
      const container = range.commonAncestorContainer;
      const textContent = container.textContent || '';
      const selectedText = range.toString();
      const idx = textContent.indexOf(selectedText);

      if (idx === -1) return { before: '', after: '' };

      const before = textContent.slice(Math.max(0, idx - contextLength), idx);
      const afterStart = idx + selectedText.length;
      const after = textContent.slice(afterStart, afterStart + contextLength);

      return { before, after };
    } catch (e) {
      return { before: '', after: '' };
    }
  }

  /**
   * Remove a highlight with the given id from the DOM and storage.
   * Unwraps the span to preserve original text.
   */
  function removeIdsFromSyncIndex(ids) {
    if (!ids || ids.length === 0) return;

    try {
      chrome.storage && chrome.storage.sync.get(['highlight_index'], (result) => {
        const index = Array.isArray(result.highlight_index) ? result.highlight_index : [];
        chrome.storage.sync.set({
          highlight_index: index.filter(item => item && !ids.includes(item.id))
        });
      });
    } catch (e) { }
  }

  function removeHighlightsByIds(ids) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const storageKey = getStorageKey();

    uniqueIds.forEach(id => {
      document.querySelectorAll('span[data-hl-id="' + id + '"]').forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      });

      const overlay = document.getElementById('hl-overlay-' + id);
      if (overlay) overlay.remove();
    });

    updateStoredHighlightRecords((arr) => {
      const filtered = arr.filter(item => !uniqueIds.includes(item.id));
      return filtered.length !== arr.length ? filtered : arr;
    }, () => {
      notifyPageHighlightsChanged(storageKey, getCurrentPageHighlightsSnapshot());
    });

    removeIdsFromSyncIndex(uniqueIds);
  }

  function removeHighlight(id) {
    removeHighlightsByIds([id]);
  }

  /**
   * Update the annotation for a stored highlight by id.
   */
  function updateAnnotation(id, note) {
    const storageKey = getStorageKey();

    updateStoredHighlightRecords((arr) => {
      const i = arr.findIndex(item => item.id === id);
      if (i < 0) return arr;
      const nextArr = arr.slice();
      nextArr[i] = {
        ...nextArr[i],
        annotation: note
      };
      return nextArr;
    }, () => {
      notifyPageHighlightsChanged(storageKey, getCurrentPageHighlightsSnapshot());
    });
  }

  function applyAnnotationToHighlightSpans(id, note) {
    document.querySelectorAll('span[data-hl-id="' + id + '"]').forEach(span => {
      if (note) {
        span.setAttribute('data-annotation', note);
      } else {
        span.removeAttribute('data-annotation');
      }

      const color = span.getAttribute('data-hl-color');
      if (span.getAttribute('data-hl-type') === 'underline') {
        span.style.backgroundColor = 'transparent';
      } else if (color && AVAILABLE_COLORS[color]) {
        span.style.backgroundColor = AVAILABLE_COLORS[color].background;
      }
    });

    if (!note && pinnedAnnotationId === id) {
      hideAnnotationTooltip();
    }
  }

  /**
   * Copy text to clipboard using the Clipboard API when available.
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => { });
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      try { document.execCommand('copy'); } catch (e) { }
      temp.remove();
    }
  }

  /**
   * Show an annotation tooltip near a highlight span.
   */
  function showAnnotationTooltip(span, note, options) {
    const persistent = !!(options && options.persistent);
    hideAnnotationTooltip();
    const rect = span.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.id = 'hl-annotation-tooltip';
    tooltip.textContent = note;
    tooltip.dataset.persistent = persistent ? 'true' : 'false';
    tooltip.style.position = 'absolute';
    tooltip.style.maxWidth = '250px';
    tooltip.style.padding = '6px 8px';
    tooltip.style.fontSize = '12px';
    tooltip.style.background = '#fffdfa';
    tooltip.style.border = '1px solid #dcd5c5';
    tooltip.style.borderRadius = '4px';
    tooltip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    tooltip.style.zIndex = 2147483647;
    tooltip.style.top = `${window.scrollY + rect.top - 30}px`;
    tooltip.style.left = `${window.scrollX + rect.left}px`;
    document.body.appendChild(tooltip);
    let timeout = null;
    if (!persistent) {
      timeout = setTimeout(() => hideAnnotationTooltip(false), 3000);
    }
    const removeOnClick = (e) => {
      if (!tooltip.contains(e.target) && !span.contains(e.target)) {
        hideAnnotationTooltip();
        if (timeout) clearTimeout(timeout);
      }
    };
    setTimeout(() => document.addEventListener('click', removeOnClick, { once: true }), 0);
  }

  function hideAnnotationTooltip(resetPinned = true) {
    const existing = document.getElementById('hl-annotation-tooltip');
    if (existing) existing.remove();
    if (resetPinned) {
      pinnedAnnotationId = null;
    }
  }

  /**
   * Find the first occurrence of text in the DOM and wrap it in a span.
   * Uses multi-level strategy: XPath -> Context matching -> Pure text matching
   */
  function findAndApplyHighlight(text, color, id, annotation, xpath, context) {
    const trimmed = (text || '').trim();
    if (!trimmed) return false;

    // Strategy 1: Try XPath-based restoration first
    if (xpath) {
      const found = tryXPathRestore(trimmed, xpath, color, id, annotation);
      if (found) return true;
    }

    // Strategy 2: Try context-based fuzzy matching
    if (context && (context.before || context.after)) {
      const found = tryContextRestore(trimmed, context, color, id, annotation);
      if (found) return true;
    }

    // Strategy 3: Fall back to pure text matching
    return tryPureTextRestore(trimmed, color, id, annotation);
  }

  /**
   * Try to restore highlight using XPath location.
   */
  function tryXPathRestore(text, xpath, color, id, annotation) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue;
      if (!element) return false;

      const textContent = element.textContent || '';
      if (textContent.includes(text)) {
        // Found the text within the XPath element, apply highlight
        return applyHighlightInElement(element, text, color, id, annotation);
      }
    } catch (e) {
      // XPath failed, try other methods
    }
    return false;
  }

  /**
   * Try to restore highlight using context (surrounding text).
   */
  function tryContextRestore(text, context, color, id, annotation) {
    const segments = [];
    let globalText = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      const tag = parent ? parent.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }

    // Build search pattern with context
    const beforePattern = (context.before || '').slice(-15); // Last 15 chars of before
    const afterPattern = (context.after || '').slice(0, 15); // First 15 chars of after
    const searchPattern = beforePattern + text + afterPattern;

    let idx = globalText.indexOf(searchPattern);
    if (idx !== -1) {
      // Adjust idx to point to the actual text (skip the before context)
      idx += beforePattern.length;
    } else {
      // Try with just the text if pattern not found
      idx = globalText.indexOf(text);
    }

    if (idx === -1) return false;

    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }

    if (segmentsToWrap.length === 0) return false;

    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'highlight', annotation);
    }
    return true;
  }

  /**
   * Try to restore highlight using pure text matching (original method).
   */
  function tryPureTextRestore(text, color, id, annotation) {
    const segments = [];
    let globalText = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      const tag = parent ? parent.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }
    const idx = globalText.indexOf(text);
    if (idx === -1) return false;
    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }
    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'highlight', annotation);
    }
    return true;
  }

  /**
   * Apply highlight within a specific element.
   */
  function applyHighlightInElement(element, text, color, id, annotation) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const segments = [];
    let globalText = '';
    let node;

    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }

    const idx = globalText.indexOf(text);
    if (idx === -1) return false;

    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }

    if (segmentsToWrap.length === 0) return false;

    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'highlight', annotation);
    }
    return true;
  }

  /**
   * Highlight or underline the given range.  For highlights, applies a
   * background colour; for underlines, applies a border-bottom.  On
   * success, persists the highlight and returns its descriptor; on failure
   * returns null.
   */
  function getSegmentsForRange(range) {
    const segments = [];
    if (!range) return segments;
    const common = range.commonAncestorContainer;
    if (common && common.nodeType === Node.TEXT_NODE) {
      const parent = common.parentElement;
      const tag = parent ? parent.tagName : '';
      if ((!parent || !parent.closest('span[data-hl-id]')) && tag !== 'SCRIPT' && tag !== 'STYLE') {
        let start = 0;
        let end = common.data.length;
        if (common === range.startContainer) start = range.startOffset;
        if (common === range.endContainer) end = range.endOffset;
        if (start < end) {
          segments.push({ node: common, start, end });
        }
      }
      return segments;
    }
    const walker = document.createTreeWalker(common, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest('span[data-hl-id]')) continue;
      const tag = node.parentElement ? node.parentElement.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      try {
        if (!range.intersectsNode(node)) continue;
      } catch (e) {
        continue;
      }
      let start = 0;
      let end = node.data.length;
      if (node === range.startContainer) start = range.startOffset;
      if (node === range.endContainer) end = range.endOffset;
      if (start < end) {
        segments.push({ node, start, end });
      }
    }
    return segments;
  }

  function wrapTextNodePart(node, start, end, id, color, type, annotation) {
    const text = node.data;
    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);
    const span = document.createElement('span');
    span.setAttribute('data-hl-id', id);
    span.setAttribute('data-hl-color', color);
    span.setAttribute('data-hl-type', type);
    span.setAttribute('data-page-url', getCurrentPageUrl());
    if (annotation) span.setAttribute('data-annotation', annotation);
    if (type === 'underline') {
      span.style.borderBottom = `2px solid ${UNDERLINE_COLOR}`;
      span.style.backgroundColor = 'transparent';
    } else {
      span.style.backgroundColor = AVAILABLE_COLORS[color].background;
    }
    span.textContent = selected;
    const parent = node.parentNode;
    if (!parent) return;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(span, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
    attachHighlightEvents(span);
  }

  function applyRange(range, color, type) {
    handleUrlChange();
    if (!range) return null;
    const text = range.toString().trim();
    if (!text) return null;
    const segments = getSegmentsForRange(range);
    if (segments.length === 0) return null;
    const id = generateId();
    const segmentTexts = segments.map(seg => seg.node.data.slice(seg.start, seg.end));

    // Capture XPath for the first segment's parent element
    let xpath = '';
    if (segments[0] && segments[0].node.parentElement) {
      xpath = getXPath(segments[0].node.parentElement);
    }

    // Capture context (surrounding text)
    const context = getContext(range);

    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, type);
    }

    // Persist with enhanced location data
    persistHighlight({
      id,
      text,
      color,
      type,
      segments: segmentTexts,
      xpath,
      context
    });

    return { id, text, color, type };
  }

  /**
   * Highlight the current selection using the given colour.  Falls back to
   * execCommand in editable contexts.  Returns the highlight descriptor or null.
   */
  function highlightCurrentSelection(color) {
    handleUrlChange();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    if (selectionInEditable()) {
      try {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, AVAILABLE_COLORS[color].background);
      } catch (e) { }
      const id = generateId();
      persistHighlight({ id, text, color, type: 'highlight' });
      return { id, text, color, type: 'highlight' };
    }
    const range = sel.getRangeAt(0).cloneRange();
    return applyRange(range, color, 'highlight');
  }

  /**
   * Underline the current selection.  Uses execCommand for editable contexts.
   */
  function underlineCurrentSelection(color) {
    handleUrlChange();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    if (selectionInEditable()) {
      try { document.execCommand('underline', false, null); } catch (e) { }
      const id = generateId();
      persistHighlight({ id, text, color, type: 'underline' });
      return { id, text, color, type: 'underline' };
    }
    const range = sel.getRangeAt(0).cloneRange();
    return applyRange(range, color, 'underline');
  }

  /**
   * Apply range with annotation - creates highlight with annotation in one atomic operation
   */
  function applyRangeWithAnnotation(range, color, type, annotation) {
    handleUrlChange();
    if (!range) return null;
    const text = range.toString().trim();
    if (!text) return null;
    const segments = getSegmentsForRange(range);
    if (segments.length === 0) return null;
    const id = generateId();
    const segmentTexts = segments.map(seg => seg.node.data.slice(seg.start, seg.end));

    // Capture XPath for the first segment's parent element
    let xpath = '';
    if (segments[0] && segments[0].node.parentElement) {
      xpath = getXPath(segments[0].node.parentElement);
    }

    // Capture context (surrounding text)
    const context = getContext(range);

    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, type, annotation);
    }

    // Persist with annotation included from the start
    persistHighlight({
      id,
      text,
      color,
      type,
      annotation,
      segments: segmentTexts,
      xpath,
      context
    });

    return { id, text, color, type, annotation };
  }

  /**
   * Highlight the current selection with annotation in one atomic operation
   */
  function highlightCurrentSelectionWithAnnotation(color, annotation) {
    handleUrlChange();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text) return null;
    if (selectionInEditable()) {
      try {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, AVAILABLE_COLORS[color].background);
      } catch (e) { }
      const id = generateId();
      persistHighlight({ id, text, color, type: 'highlight', annotation });
      return { id, text, color, type: 'highlight', annotation };
    }
    const range = sel.getRangeAt(0).cloneRange();
    return applyRangeWithAnnotation(range, color, 'highlight', annotation);
  }

  /**
   * Highlight or underline a previously stored Range.  This is used when
   * the selection has collapsed (e.g. after interacting with the toolbar).
   */
  function highlightRange(range, color) { return applyRange(range, color, 'highlight'); }
  function underlineRange(range, color) { return applyRange(range, color, 'underline'); }

  /**
   * Attempt to highlight the first occurrence of a text string in the
   * document.  Returns the highlight descriptor or null.
   */
  function highlightText(text, color) {
    handleUrlChange();
    const trimmed = (text || '').trim();
    if (!trimmed) return null;
    const id = generateId();
    const success = findAndApplyHighlight(trimmed, color, id);
    if (success) {
      persistHighlight({ id, text: trimmed, color, type: 'highlight' });
      return { id, text: trimmed, color, type: 'highlight' };
    }
    return null;
  }

  function highlightTextWithAnnotation(text, color, annotation) {
    handleUrlChange();
    const trimmed = (text || '').trim();
    if (!trimmed) return null;
    const id = generateId();
    const success = findAndApplyHighlight(trimmed, color, id, annotation);
    if (success) {
      persistHighlight({ id, text: trimmed, color, type: 'highlight', annotation });
      return { id, text: trimmed, color, type: 'highlight', annotation };
    }
    return null;
  }

  /**
   * Attempt to underline the first occurrence of a text string in the
   * document.  Returns the underline descriptor or null.
   */
  function underlineText(text, color) {
    handleUrlChange();
    const trimmed = (text || '').trim();
    if (!trimmed) return null;
    const id = generateId();
    // Use tryPureTextRestoreUnderline which applies underline by text matching
    const result = tryPureTextRestoreUnderlineAndReturn(trimmed, color, id);
    if (result) {
      persistHighlight({ id, text: trimmed, color, type: 'underline' });
      return { id, text: trimmed, color, type: 'underline' };
    }
    return null;
  }

  /**
   * Same as tryPureTextRestoreUnderline but returns success status.
   */
  function tryPureTextRestoreUnderlineAndReturn(text, color, id, annotation) {
    const segments = [];
    let globalText = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      const tag = parent ? parent.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }
    const idx = globalText.indexOf(text);
    if (idx === -1) return false;
    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }
    if (segmentsToWrap.length === 0) return false;
    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'underline', annotation);
    }
    return true;
  }

  /**
   * Restore all highlights stored in chrome.storage.local on page load.
   */
  function restoreAllHighlights() {
    const pageChanged = handleUrlChange();
    const storageKey = getStorageKey();

    chrome.storage.local.get([storageKey], (result) => {
      const data = result[storageKey];
      if (Array.isArray(data) && data.length > 0) {
        applyHighlights(data);
      } else if (!pageChanged) {
        recoverCurrentPageHighlightsFromSync((recovered) => {
          if (Array.isArray(recovered) && recovered.length > 0) {
            applyHighlights(recovered);
          } else {
            syncDomHighlightsToStorage();
          }
        });
      }
    });
  }

  function hasHighlightInDom(id) {
    return !!(id && document.querySelector(`span[data-hl-id="${id}"]`));
  }

  function getRestoreText(item) {
    if (!item) return '';

    const primaryText = typeof item.text === 'string' ? item.text.trim() : '';
    if (primaryText) {
      return primaryText;
    }

    if (Array.isArray(item.segments) && item.segments.length > 0) {
      return item.segments
        .map(seg => String(seg || '').trim())
        .filter(Boolean)
        .join('');
    }

    return '';
  }

  function applyHighlights(data) {
    if (!Array.isArray(data)) return;
    data.forEach(item => {
      if (!item || !item.id || hasHighlightInDom(item.id)) {
        return;
      }

      const restoreText = getRestoreText(item);
      if (!restoreText) {
        return;
      }

      if (item.type === 'underline') {
        findAndApplyUnderline(restoreText, item.color, item.id, item.annotation, item.xpath, item.context);
      } else {
        findAndApplyHighlight(restoreText, item.color, item.id, item.annotation, item.xpath, item.context);
      }
    });
  }

  /**
   * Underline the first occurrence of a text in the document.
   * Uses multi-level strategy: XPath -> Context matching -> Pure text matching
   */
  function findAndApplyUnderline(text, color, id, annotation, xpath, context) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    // Strategy 1: Try XPath-based restoration first
    if (xpath) {
      const found = tryXPathRestoreUnderline(trimmed, xpath, color, id, annotation);
      if (found) return;
    }

    // Strategy 2: Try context-based fuzzy matching
    if (context && (context.before || context.after)) {
      const found = tryContextRestoreUnderline(trimmed, context, color, id, annotation);
      if (found) return;
    }

    // Strategy 3: Fall back to pure text matching
    tryPureTextRestoreUnderline(trimmed, color, id, annotation);
  }

  /**
   * Try to restore underline using XPath location.
   */
  function tryXPathRestoreUnderline(text, xpath, color, id, annotation) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue;
      if (!element) return false;

      const textContent = element.textContent || '';
      if (textContent.includes(text)) {
        return applyUnderlineInElement(element, text, color, id, annotation);
      }
    } catch (e) {
      // XPath failed
    }
    return false;
  }

  /**
   * Try to restore underline using context.
   */
  function tryContextRestoreUnderline(text, context, color, id, annotation) {
    const segments = [];
    let globalText = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      const tag = parent ? parent.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }

    const beforePattern = (context.before || '').slice(-15);
    const afterPattern = (context.after || '').slice(0, 15);
    const searchPattern = beforePattern + text + afterPattern;

    let idx = globalText.indexOf(searchPattern);
    if (idx !== -1) {
      idx += beforePattern.length;
    } else {
      idx = globalText.indexOf(text);
    }

    if (idx === -1) return false;

    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }

    if (segmentsToWrap.length === 0) return false;

    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'underline', annotation);
    }
    return true;
  }

  /**
   * Try to restore underline using pure text matching.
   */
  function tryPureTextRestoreUnderline(text, color, id, annotation) {
    const segments = [];
    let globalText = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      const tag = parent ? parent.tagName : '';
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }
    const idx = globalText.indexOf(text);
    if (idx === -1) return;
    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }
    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'underline', annotation);
    }
  }

  /**
   * Apply underline within a specific element.
   */
  function applyUnderlineInElement(element, text, color, id, annotation) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const segments = [];
    let globalText = '';
    let node;

    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && parent.closest('span[data-hl-id]')) continue;
      segments.push({ node, start: globalText.length, len: node.data.length });
      globalText += node.data;
    }

    const idx = globalText.indexOf(text);
    if (idx === -1) return false;

    const end = idx + text.length;
    const segmentsToWrap = [];
    for (const seg of segments) {
      const segStart = seg.start;
      const segEnd = seg.start + seg.len;
      if (end <= segStart || idx >= segEnd) continue;
      const partStart = Math.max(0, idx - segStart);
      const partEnd = Math.min(seg.len, end - segStart);
      segmentsToWrap.push({ node: seg.node, start: partStart, end: partEnd });
    }

    if (segmentsToWrap.length === 0) return false;

    for (let i = segmentsToWrap.length - 1; i >= 0; i--) {
      const seg = segmentsToWrap[i];
      wrapTextNodePart(seg.node, seg.start, seg.end, id, color, 'underline', annotation);
    }
    return true;
  }

  function getHighlightIdsInRange(range) {
    const ids = new Set();
    if (!range) return ids;

    document.querySelectorAll('span[data-hl-id]').forEach(span => {
      try {
        if (range.intersectsNode(span)) {
          const id = span.getAttribute('data-hl-id');
          if (id) ids.add(id);
        }
      } catch (e) { }
    });

    return ids;
  }

  /**
   * Remove highlights that intersect the current selection.  Used by the
   * delete button in the toolbar.
   */
  function removeHighlightsInSelection() {
    const sel = window.getSelection();
    let range = null;

    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      range = sel.getRangeAt(0);
    } else if (lastSelection && lastSelection.range) {
      range = lastSelection.range.cloneRange();
    }

    if (!range) return;

    const ids = Array.from(getHighlightIdsInRange(range));
    if (ids.length === 0) return;
    removeHighlightsByIds(ids);
  }

  /**
   * Attach events to a highlight span.  Clicking shows annotation tooltip.
   */
  function attachHighlightEvents(span) {
    span.addEventListener('mouseenter', () => {
      const note = span.getAttribute('data-annotation');
      const id = span.getAttribute('data-hl-id');
      if (note && pinnedAnnotationId !== id) {
        showAnnotationTooltip(span, note, { persistent: false });
      }
    });
    span.addEventListener('mouseleave', () => {
      const id = span.getAttribute('data-hl-id');
      if (pinnedAnnotationId !== id) {
        hideAnnotationTooltip(false);
      }
    });
    span.addEventListener('click', (e) => {
      const note = span.getAttribute('data-annotation');
      const id = span.getAttribute('data-hl-id');
      if (!note || !id) return;
      e.stopPropagation();
      if (pinnedAnnotationId === id) {
        hideAnnotationTooltip();
        return;
      }
      pinnedAnnotationId = id;
      showAnnotationTooltip(span, note, { persistent: true });
    });
  }

  /**
   * Create the floating toolbar element.  The toolbar allows the user
   * to select a colour to highlight with, underline, copy or annotate the
   * selection, and delete highlights.
   */
  function createToolbarElement() {
    const toolbar = document.createElement('div');
    toolbar.id = 'hl-cat-toolbar';
    toolbar.className = 'hl-cat-toolbar';
    // Colour options
    TOOLBAR_COLOR_ORDER.forEach(col => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'hl-color-option';
      swatch.dataset.color = col;
      swatch.title = ({
        yellow: '黄色高亮',
        blue: '蓝色高亮',
        red: '红色高亮'
      })[col] || '高亮颜色';
      swatch.setAttribute('aria-label', swatch.title);
      swatch.style.backgroundColor = AVAILABLE_COLORS[col].background;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        lastSelectedColor = col;
        toolbar.dataset.activeColor = col;
        toolbar.querySelectorAll('.hl-color-option').forEach(option => {
          option.classList.toggle('active', option.dataset.color === col);
        });
        setTimeout(() => {
          let result = null;
          if (lastSelection.range && rangeInEditable(lastSelection.range)) {
            result = highlightCurrentSelection(col);
          } else {
            if (lastSelection.range) {
              const clone = lastSelection.range.cloneRange();
              result = highlightRange(clone, col);
            }
            if (!result && lastSelection.text) {
              result = highlightText(lastSelection.text, col);
            }
            if (!result) {
              result = highlightCurrentSelection(col);
            }
          }
          hideToolbar();
          clearSelection();
        }, 0);
      });
      swatch.classList.toggle('active', col === lastSelectedColor);
      toolbar.appendChild(swatch);
    });
    // Underline button
    const underlineBtn = document.createElement('button');
    underlineBtn.className = 'hl-tool-btn';
    underlineBtn.title = '划线';
    underlineBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V5h-2v6c0 2.21-1.79 4-4 4s-4-1.79-4-4V5H6v6c0 3.31 2.69 6 6 6zM5 19v2h14v-2H5z"/></svg>';
    underlineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      let result = null;
      if (lastSelection.range && rangeInEditable(lastSelection.range)) {
        result = underlineCurrentSelection(lastSelectedColor);
      } else {
        if (lastSelection.range) {
          const clone = lastSelection.range.cloneRange();
          result = underlineRange(clone, lastSelectedColor);
        }
        // Text-based fallback when range operation fails
        if (!result && lastSelection.text) {
          result = underlineText(lastSelection.text, lastSelectedColor);
        }
        if (!result) {
          result = underlineCurrentSelection(lastSelectedColor);
        }
      }
      hideToolbar();
      clearSelection();
    });
    toolbar.appendChild(underlineBtn);
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'hl-tool-btn';
    copyBtn.title = '复制';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 17H8V7h11v15z"/></svg>';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = window.getSelection().toString();
      copyToClipboard(text);
      hideToolbar();
      clearSelection();
    });
    toolbar.appendChild(copyBtn);
    // Annotate button
    const annotateBtn = document.createElement('button');
    annotateBtn.className = 'hl-tool-btn';
    annotateBtn.title = '批注';
    annotateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 3h7l9 9-9 9-7-7V3zM5 5v6l6 6 7-7-6-6H5zM6.5 6.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>';
    annotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Prompt for annotation FIRST to avoid race conditions
      const note = prompt('添加批注:');
      const trimmedNote = typeof note === 'string' ? note.trim() : '';
      if (trimmedNote) {
        let hl = null;
        const selectedHighlightIds = lastSelection.range
          ? Array.from(getHighlightIdsInRange(lastSelection.range))
          : [];

        if (selectedHighlightIds.length > 0) {
          selectedHighlightIds.forEach(id => {
            updateAnnotation(id, trimmedNote);
            applyAnnotationToHighlightSpans(id, trimmedNote);
          });

          const firstAnnotatedSpan = document.querySelector(
            'span[data-hl-id="' + selectedHighlightIds[0] + '"][data-annotation]'
          );
          if (firstAnnotatedSpan) {
            pinnedAnnotationId = selectedHighlightIds[0];
            showAnnotationTooltip(firstAnnotatedSpan, trimmedNote, { persistent: true });
          }
        } else if (lastSelection.range && !rangeInEditable(lastSelection.range)) {
          const clone = lastSelection.range.cloneRange();
          hl = applyRangeWithAnnotation(clone, lastSelectedColor, 'highlight', trimmedNote);
        }
        if (!hl && selectedHighlightIds.length === 0 && lastSelection.text) {
          hl = highlightTextWithAnnotation(lastSelection.text, lastSelectedColor, trimmedNote);
        }
        if (!hl && selectedHighlightIds.length === 0) {
          hl = highlightCurrentSelectionWithAnnotation(lastSelectedColor, trimmedNote);
        }
      }
      hideToolbar();
      clearSelection();
    });
    toolbar.appendChild(annotateBtn);
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'hl-tool-btn';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3.5-9h1v8h-1V10zm5 0h1v8h-1V10zm1.5-6L14.5 3h-5l-1 1H5v2h14V4h-3.5z"/></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeHighlightsInSelection();
      hideToolbar();
      clearSelection();
    });
    toolbar.appendChild(deleteBtn);

    // Close/Disable button with dropdown
    const closeBtn = document.createElement('button');
    closeBtn.className = 'hl-tool-btn hl-close-btn';
    closeBtn.title = '关闭';
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

    // Create dropdown menu
    const closeDropdown = document.createElement('div');
    closeDropdown.className = 'hl-close-dropdown';
    closeDropdown.innerHTML = `
      <div class="hl-dropdown-item" data-action="hide-session">隐藏直到下次访问</div>
      <div class="hl-dropdown-item" data-action="disable-site">在此网站禁用</div>
      <div class="hl-dropdown-item" data-action="disable-global">全局禁用</div>
    `;
    closeDropdown.style.display = 'none';

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown.style.display = closeDropdown.style.display === 'none' ? 'block' : 'none';
    });

    closeDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.dataset.action;
      if (!action) return;

      if (action === 'hide-session') {
        // Hide toolbar for this session (until page refresh)
        window._hlCatHiddenSession = true;
        hideToolbar();
      } else if (action === 'disable-site') {
        // Add current domain to disabled list
        const hostname = window.location.hostname;
        chrome.storage.local.get(['disabled_domains'], (res) => {
          const disabled = res.disabled_domains || [];
          if (!disabled.includes(hostname)) {
            disabled.push(hostname);
            chrome.storage.local.set({ disabled_domains: disabled }, () => {
              hideToolbar();
              alert('已在此网站禁用划线猫，刷新页面后生效');
            });
          }
        });
      } else if (action === 'disable-global') {
        chrome.storage.local.set({ global_disabled: true }, () => {
          hideToolbar();
          alert('已全局禁用划线猫，可在管理页面重新启用');
        });
      }
      closeDropdown.style.display = 'none';
    });

    toolbar.appendChild(closeBtn);
    toolbar.appendChild(closeDropdown);

    // Make toolbar draggable using standard pattern to avoid leaks
    toolbar.addEventListener('mousedown', (e) => {
      // Only allow dragging if not clicking on a button
      if (e.target.closest('button')) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = toolbar.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;

      toolbar.style.cursor = 'grabbing';
      e.preventDefault(); // Prevent text selection
      e.stopPropagation();

      function onMouseMove(e) {
        e.preventDefault();

        // Calculate new position (viewport coordinates)
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Bounds checking (keep within viewport)
        const maxLeft = window.innerWidth - toolbar.offsetWidth;
        const maxTop = window.innerHeight - toolbar.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        // Apply position (convert to page coordinates for absolute positioning)
        toolbar.style.left = `${newLeft + window.scrollX}px`;
        toolbar.style.top = `${newTop + window.scrollY}px`;
      }

      function onMouseUp() {
        toolbar.style.cursor = 'move';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    return toolbar;
  }

  /**
   * Show the toolbar at a given coordinate.
   */
  function showToolbarAt(x, y) {
    // Check if hidden for this session
    if (window._hlCatHiddenSession) return;

    let toolbar = document.getElementById('hl-cat-toolbar');
    if (!toolbar) {
      toolbar = createToolbarElement();
      document.body.appendChild(toolbar);
    }
    toolbar.dataset.activeColor = lastSelectedColor;
    toolbar.querySelectorAll('.hl-color-option').forEach(option => {
      option.classList.toggle('active', option.dataset.color === lastSelectedColor);
    });
    toolbar.style.top = `${y}px`;
    toolbar.style.left = `${x}px`;
    toolbar.style.display = 'flex';
  }

  function hideToolbar() {
    const toolbar = document.getElementById('hl-cat-toolbar');
    if (toolbar) toolbar.remove();
  }

  function clearSelection() {
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  // Event listeners for selection and toolbar display
  document.addEventListener('mouseup', (e) => {
    // If clicking on the toolbar (e.g. finishing a drag), do not reset position
    const toolbar = document.getElementById('hl-cat-toolbar');
    if (toolbar && toolbar.contains(e.target)) return;

    const sel = window.getSelection();
    logFrameDebug('mouseup', {
      target: describeNode(e.target),
      selection: getSelectionDebugSnapshot()
    });
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideToolbar();
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    const text = sel.toString().trim();
    if (text) {
      lastSelection.range = range;
      lastSelection.text = text;
      const rect = range.getBoundingClientRect();
      const top = window.scrollY + rect.top - 40;
      const left = window.scrollX + rect.left;
      setTimeout(() => showToolbarAt(left, top), 0);
    }
  }, true);

  document.addEventListener('mousedown', (e) => {
    const toolbar = document.getElementById('hl-cat-toolbar');
    if (toolbar && !toolbar.contains(e.target)) hideToolbar();
  }, true);

  window.addEventListener('scroll', () => hideToolbar());

  // Update last selection on selectionchange and show toolbar for immediate feedback
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    logFrameDebug('selectionchange', {
      selection: getSelectionDebugSnapshot()
    });
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      hideToolbar();
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      hideToolbar();
      return;
    }
    const range = sel.getRangeAt(0).cloneRange();
    lastSelection.range = range;
    lastSelection.text = text;
    const rect = range.getBoundingClientRect();
    const top = window.scrollY + rect.top - 40;
    const left = window.scrollX + rect.left;
    showToolbarAt(left, top);
  }, true);

  // Message handler for interaction with popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === 'ping') {
      logFrameDebug('message:ping');
      sendResponse({ ok: true });
      return;
    }
    if (message.command === 'highlight') {
      logFrameDebug('message:highlight', {
        selection: getSelectionDebugSnapshot()
      });
      handleUrlChange();
      let result = highlightCurrentSelection(message.color);
      if (!result && lastSelection.range) {
        result = highlightRange(lastSelection.range, message.color);
      }
      sendResponse({ result });
    } else if (message.command === 'getHighlights') {
      logFrameDebug('message:getHighlights');
      handleUrlChange();
      const storageKey = getStorageKey();
      const currentPageUrl = getCurrentPageUrl();
      syncCurrentPageTitleMetadata(() => {
        chrome.storage.local.get([storageKey], (result) => {
          let data = Array.isArray(result[storageKey]) ? result[storageKey] : [];
          if (data.length === 0) {
            recoverCurrentPageHighlightsFromSync((recovered) => {
              let nextData = Array.isArray(recovered) ? recovered : [];
              reconcileDomHighlightsWithStorage(nextData, (reconciled) => {
                sendResponse({
                  highlights: reconciled,
                  pageTitle: getPreferredPageTitle(),
                  pageUrl: currentPageUrl,
                  storageKey
                });
              });
            });
            return;
          }
          reconcileDomHighlightsWithStorage(data, (reconciled) => {
            sendResponse({
              highlights: reconciled,
              pageTitle: getPreferredPageTitle(),
              pageUrl: currentPageUrl,
              storageKey
            });
          });
        });
      });
      return true; // Keep channel open for async response
    } else if (message.command === 'clearHighlights') {
      handleUrlChange();
      const storageKey = getStorageKey();
      // Remove highlight spans
      document.querySelectorAll('span[data-hl-id]').forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      });
      document.querySelectorAll('.hl-control-overlay').forEach(el => el.remove());
      try {
        chrome.storage && chrome.storage.local.remove(storageKey);
      } catch (e) { }
      sendResponse({ status: 'cleared' });
    } else if (message.command === 'scrollToHighlight') {
      const id = message.id;
      const elem = document.querySelector('span[data-hl-id="' + id + '"]');
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elem.classList.add('hl-flash');
        setTimeout(() => elem.classList.remove('hl-flash'), 1000);
      }
      sendResponse({});
    } else if (message.command === 'removeHighlight') {
      // Remove highlight from DOM (storage already updated by sidepanel)
      const id = message.id;
      removeHighlight(id);
      sendResponse({ status: 'removed' });
    } else if (message.command === 'updateAnnotation') {
      // Update annotation in DOM
      const { id, note } = message;
      applyAnnotationToHighlightSpans(id, note);
      sendResponse({ status: 'updated' });
    }
    return true;
  });

  // --- Robust Restoration Logic (Mutation Assured) ---

  // We use a debounce function to avoid re-scanning the DOM on every single pixel change.
  // This is critical for performance on heavy pages like Notion.
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // The actual restoration function, wrapped in debounce
  const debouncedRestore = debounce(() => {
    restoreAllHighlights();
  }, 1000); // 1-second delay allows page chunks to load before we highlight

  // Start observing the document for changes
  const observeDOM = () => {
    const observer = new MutationObserver((mutations) => {
      // Check if any interesting nodes were added
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
          break;
        }
        // Also check for characterData changes if needed, but usually addedNodes covers loading
      }
      if (shouldUpdate) {
        debouncedRestore();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // Initial trigger
  logFrameDebug('init');
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    restoreAllHighlights(); // Immediate attempt
    observeDOM();           // Start watching
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      restoreAllHighlights();
      observeDOM();
    });
  }

  // Double-check on window load (for images/frames)
  window.addEventListener('load', restoreAllHighlights);

  // Inject CSS for toolbar and highlight effects
  const style = document.createElement('style');
  style.textContent = `
.hl-flash { animation: hlFlashAnim 1s ease-out; }
@keyframes hlFlashAnim { 0% { outline: 2px solid red; } 100% { outline: none; } }
.hl-cat-toolbar {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 14px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16), 0 3px 10px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
  padding: 8px 10px;
  padding-right: 28px;
  z-index: 2147483647;
  cursor: move;
  user-select: none;
}
.hl-color-option {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.92);
  cursor: pointer;
  padding: 0;
  margin: 0;
  outline: none;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.5);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.hl-color-option:hover {
  transform: translateY(-1px) scale(1.06);
}
.hl-color-option.active {
  transform: scale(1.08);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), 0 0 0 4px rgba(255, 255, 255, 0.92);
}
.hl-tool-btn {
  background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
  border: 1px solid rgba(148, 163, 184, 0.24);
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.hl-tool-btn svg {
  width: 15px;
  height: 15px;
  fill: #475569;
}
.hl-tool-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(59, 130, 246, 0.28);
  background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.12);
}
.hl-tool-btn:hover svg { fill: #1f2937; }
.hl-close-btn {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  padding: 0;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 50%;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
  z-index: 1;
}
.hl-close-btn svg {
  width: 10px;
  height: 10px;
}
.hl-close-btn:hover {
  background: #f8fafc;
}
#hl-annotation-tooltip {
  position: absolute;
  background: #fffefa;
  border: 1px solid #dcd5c5;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.3;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  z-index: 2147483647;
}
.hl-close-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  overflow: hidden;
  min-width: 160px;
  z-index: 2147483647;
}
.hl-dropdown-item {
  padding: 8px 12px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
}
.hl-dropdown-item:hover {
  background: #f0f0f0;
}
.hl-dropdown-item:not(:last-child) {
  border-bottom: 1px solid #eee;
}
`;
  document.head.appendChild(style);
} // End initExtension
