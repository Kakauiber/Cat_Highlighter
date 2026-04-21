// Management page script for the highlighter extension. Presents an
// aggregated view of all page data stored in chrome.storage.local.
// A page may contain highlights, a page note, or both. Supports
// searching, deleting highlights/notes, copying content, exporting
// Markdown, and preserving expanded state across renders.

document.addEventListener('DOMContentLoaded', () => {
  const HIGHLIGHT_PREFIX = 'page_highlights_';
  const NOTE_PREFIX = (window.PageNotes && window.PageNotes.NOTE_PREFIX) || 'page_notes_';

  const pagesList = document.getElementById('pages-list');
  const listEndMarker = document.getElementById('list-end-marker');
  const searchInput = document.getElementById('search-input');
  const selectModeBtn = document.getElementById('select-mode-btn');
  const batchHeader = document.getElementById('batch-header');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectCount = document.getElementById('select-count');
  const cancelSelectBtn = document.getElementById('cancel-select-btn');
  const batchActionBar = document.getElementById('batch-action-bar');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const batchCopyBtn = document.getElementById('batch-copy-btn');
  const exportMenu = document.getElementById('export-menu');
  const exportMenuTrigger = document.getElementById('export-menu-trigger');
  const exportMenuOptions = Array.from(document.querySelectorAll('.export-menu-option'));
  const mowenConfigToggle = document.getElementById('mowen-config-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const sortSelect = document.getElementById('sort-select');
  const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
  const mowenPanel = document.getElementById('mowen-panel');
  const mowenSummaryMeta = document.getElementById('mowen-summary-meta');
  const configSummaryToggleText = document.getElementById('config-summary-toggle-text');
  const mowenTargetCard = document.getElementById('mowen-target-card');
  const mowenTargetDot = document.getElementById('mowen-target-dot');
  const mowenTargetStatus = document.getElementById('mowen-target-status');
  const mowenConfigEditBtn = document.getElementById('mowen-config-edit-btn');
  const mowenFormCard = document.getElementById('mowen-form-card');
  const mowenApiKeyInput = document.getElementById('mowen-api-key');
  const mowenTagsInput = document.getElementById('mowen-tags');
  const mowenSaveBtn = document.getElementById('mowen-save-btn');
  const mowenTestBtn = document.getElementById('mowen-test-btn');
  const mowenStatus = document.getElementById('mowen-status');
  const overviewPages = document.getElementById('overview-pages');
  const overviewHighlights = document.getElementById('overview-highlights');
  const overviewNotes = document.getElementById('overview-notes');

  const MOWEN_API_KEY_KEY = 'mowen_api_key';
  const MOWEN_TAGS_KEY = 'mowen_default_tags';
  const MOWEN_TESTED_KEY = 'mowen_last_tested_key';

  // Cache of page data: { key, url, title, highlights: [...], note: record|null }
  let pagesData = [];
  const openedPageKeys = new Set();

  const colorMap = {
    yellow: '#FFEA8A',
    blue: '#B9DDF4',
    red: '#FF8A8A',
    mint: '#B9DDF4',
    coral: '#FF8A8A'
  };

  let isSelectionMode = false;
  let selectedIds = new Set();
  let selectionMap = new Map(); // id -> pageKey
  let activeFilter = 'all';
  let activeSort = 'updated-desc';
  let mowenIsBusy = false;
  let mowenFormExpanded = false;

  function getMowenApiKey() {
    return String(mowenApiKeyInput && mowenApiKeyInput.value || '').trim();
  }

  function getMowenTagsInput() {
    return String(mowenTagsInput && mowenTagsInput.value || '').trim();
  }

  function closeExportMenu() {
    if (!exportMenu) return;
    exportMenu.classList.remove('open');
    if (exportMenuTrigger) {
      exportMenuTrigger.setAttribute('aria-expanded', 'false');
    }
  }

  function openExportMenu() {
    if (!exportMenu) return;
    exportMenu.classList.add('open');
    if (exportMenuTrigger) {
      exportMenuTrigger.setAttribute('aria-expanded', 'true');
    }
  }

  function setMowenFormVisible(visible) {
    if (!mowenFormCard) return;
    mowenFormExpanded = !!visible;
    mowenFormCard.classList.toggle('hidden', !visible);
  }

  function syncSettingsPanelState() {
    if (!mowenConfigToggle || !settingsPanel) return;
    const expanded = !settingsPanel.classList.contains('hidden');
    mowenConfigToggle.classList.toggle('active', expanded);
    mowenConfigToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function syncMowenPanelState() {
    if (!mowenPanel) return;
    const expanded = !!mowenPanel.open;
    if (configSummaryToggleText) {
      configSummaryToggleText.textContent = expanded ? '收起' : '展开';
    }
  }

  function setSettingsPanelVisible(visible) {
    if (!settingsPanel) return;
    settingsPanel.classList.toggle('hidden', !visible);
    syncSettingsPanelState();
  }

  function openMowenPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (!mowenPanel) return;
    mowenPanel.open = true;
    closeExportMenu();
    syncMowenPanelState();
  }

  function setMowenStatus(message, tone) {
    if (!mowenStatus) return;
    mowenStatus.textContent = message || '';
    mowenStatus.classList.remove('is-success', 'is-error');
    if (tone === 'success') {
      mowenStatus.classList.add('is-success');
    } else if (tone === 'error') {
      mowenStatus.classList.add('is-error');
    }
  }

  function updateMowenSummary(settings) {
    const apiKey = String(settings && settings.apiKey || '').trim();
    const tags = String(settings && settings.tags || '').trim();
    const lastTestedKey = String(settings && settings.lastTestedKey || '').trim();
    const testedForCurrentKey = apiKey && lastTestedKey === apiKey;

    const parts = [];
    parts.push(apiKey ? '已配置 API Key' : '未配置 API Key');
    parts.push(testedForCurrentKey ? '测试已通过' : '需先测试');
    if (tags) {
      parts.push(`标签：${tags}`);
    }

    if (mowenSummaryMeta) {
      mowenSummaryMeta.textContent = parts.join(' · ');
    }

    if (mowenTargetStatus) {
      mowenTargetStatus.textContent = apiKey
        ? (testedForCurrentKey ? 'API 已配置 · 测试已通过' : 'API 已配置 · 待测试')
        : '未配置';
      mowenTargetStatus.classList.toggle('export-target-status-success', !!apiKey);
      mowenTargetStatus.classList.toggle('export-target-status-muted', !apiKey);
    }

    if (mowenTargetDot) {
      mowenTargetDot.classList.toggle('export-status-dot-success', !!apiKey);
      mowenTargetDot.classList.toggle('export-status-dot-muted', !apiKey);
    }

    if (mowenTargetCard) {
      mowenTargetCard.classList.toggle('export-target-card-active', true);
    }

    if (mowenConfigEditBtn) {
      mowenConfigEditBtn.textContent = apiKey ? '重新配置' : '去配置';
    }

    if (!apiKey) {
      setMowenFormVisible(true);
    } else if (!mowenFormExpanded) {
      setMowenFormVisible(false);
    }
  }

  async function getMowenSettings() {
    const result = await chrome.storage.local.get([
      MOWEN_API_KEY_KEY,
      MOWEN_TAGS_KEY,
      MOWEN_TESTED_KEY
    ]);
    return {
      apiKey: String(result[MOWEN_API_KEY_KEY] || ''),
      tags: String(result[MOWEN_TAGS_KEY] || ''),
      lastTestedKey: String(result[MOWEN_TESTED_KEY] || '')
    };
  }

  function syncMowenActionState(lastTestedKey) {
    const apiKey = getMowenApiKey();
    const hasKey = !!apiKey;
    const testedForCurrentKey = hasKey && lastTestedKey === apiKey;

    if (mowenSaveBtn) {
      mowenSaveBtn.disabled = mowenIsBusy || !hasKey;
    }
    if (mowenTestBtn) {
      mowenTestBtn.disabled = mowenIsBusy || !hasKey;
    }
  }

  async function loadMowenSettings() {
    const settings = await getMowenSettings();
    if (mowenApiKeyInput) mowenApiKeyInput.value = settings.apiKey;
    if (mowenTagsInput) mowenTagsInput.value = settings.tags;
    updateMowenSummary(settings);
    syncMowenActionState(settings.lastTestedKey);
  }

  async function saveMowenSettings() {
    const apiKey = getMowenApiKey();
    const tags = getMowenTagsInput();
    const settings = await getMowenSettings();
    const next = {
      [MOWEN_API_KEY_KEY]: apiKey,
      [MOWEN_TAGS_KEY]: tags
    };

    if (settings.lastTestedKey && settings.lastTestedKey !== apiKey) {
      next[MOWEN_TESTED_KEY] = '';
    }

    await chrome.storage.local.set(next);
    const nextTestedKey = apiKey === settings.lastTestedKey ? settings.lastTestedKey : '';
    updateMowenSummary({ apiKey, tags, lastTestedKey: nextTestedKey });
    syncMowenActionState(nextTestedKey);
    setMowenStatus('设置已保存。若 API Key 有变化，请先重新测试导出。', 'success');
    if (apiKey) {
      setMowenFormVisible(false);
    }
  }

  async function withMowenBusy(task) {
    if (mowenIsBusy) return;
    mowenIsBusy = true;
    const settings = await getMowenSettings();
    updateMowenSummary(settings);
    syncMowenActionState(settings.lastTestedKey);
    try {
      await task();
    } finally {
      mowenIsBusy = false;
      const latest = await getMowenSettings();
      updateMowenSummary(latest);
      syncMowenActionState(latest.lastTestedKey);
    }
  }

  async function testMowenExport() {
    const apiKey = getMowenApiKey();
    const tags = getMowenTagsInput();
    if (!apiKey) {
      setMowenStatus('请先填写墨问 API Key。', 'error');
      return;
    }

    await withMowenBusy(async () => {
      setMowenStatus('正在测试导出到墨问...', '');
      try {
        const result = await window.HighlightMowenExporter.testMowenConnection(apiKey, { tags });
        if (!result.ok) {
          setMowenStatus(result.message || '测试导出失败，请检查 API Key 或网络状态。', 'error');
          return;
        }

        await chrome.storage.local.set({ [MOWEN_TESTED_KEY]: apiKey });
        updateMowenSummary({ apiKey, tags, lastTestedKey: apiKey });
        setMowenStatus(`测试成功，已创建测试私密笔记${result.noteId ? `（${result.noteId}）` : ''}。`, 'success');
      } catch (err) {
        console.warn('墨问测试导出失败', err);
        setMowenStatus('测试导出失败，请检查 API Key、配额或网络状态。', 'error');
      }
    });
  }

  async function exportAllToMowen() {
    const apiKey = getMowenApiKey();
    const tags = getMowenTagsInput();
    if (!apiKey) {
      setMowenStatus('请先填写墨问 API Key。', 'error');
      return;
    }
    if (pagesData.length === 0) {
      setMowenStatus('当前没有可导出的页面记录。', 'error');
      return;
    }

    const settings = await getMowenSettings();
    if (settings.lastTestedKey !== apiKey) {
      setMowenStatus('请先完成一次测试导出，再执行正式导出。', 'error');
      syncMowenActionState(settings.lastTestedKey);
      return;
    }

    await withMowenBusy(async () => {
      setMowenStatus('正在导出全部记录到墨问...', '');
      try {
        const bundle = window.HighlightExport.buildExportBundle(pagesData, { source: 'options' });
        const result = await window.HighlightMowenExporter.exportBundleToMowen(bundle, { apiKey, tags });
        if (!result.ok) {
          setMowenStatus(result.message || '导出到墨问失败。', 'error');
          return;
        }
        setMowenStatus(`导出成功，已创建私密笔记${result.noteId ? `（${result.noteId}）` : ''}。`, 'success');
      } catch (err) {
        console.warn('导出到墨问失败', err);
        setMowenStatus('导出到墨问失败，请检查网络、配额或 API Key。', 'error');
      }
    });
  }

  function getPageLastUpdated(page) {
    const highlightTs = page.highlights.reduce((max, item) => Math.max(max, item.timestamp || 0), 0);
    const noteTs = page.note && page.note.updatedAt ? page.note.updatedAt : 0;
    return Math.max(highlightTs, noteTs);
  }

  function renderOverviewStats() {
    if (overviewPages) {
      overviewPages.textContent = String(pagesData.length);
    }

    if (overviewHighlights) {
      const totalHighlights = pagesData.reduce((sum, page) => sum + page.highlights.length, 0);
      overviewHighlights.textContent = String(totalHighlights);
    }

    if (overviewNotes) {
      const totalNotes = pagesData.reduce((sum, page) => sum + (page.note && page.note.content ? 1 : 0), 0);
      overviewNotes.textContent = String(totalNotes);
    }
  }

  function getPageDomain(url) {
    try {
      const hostname = new URL(url).hostname || url;
      return hostname.replace(/^www\./, '');
    } catch (err) {
      return url || '';
    }
  }

  function formatUpdatedTime(timestamp) {
    if (!timestamp) return '更新时间未知';

    const diff = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return '刚刚更新';
    if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前更新`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前更新`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前更新`;

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth} 更新`;
  }

  function getPageTimeBucket(page) {
    const timestamp = getPageLastUpdated(page);
    if (!timestamp) return '更早';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    if (timestamp >= startOfToday) return '今天';
    if (timestamp >= startOfYesterday) return '昨天';
    return '更早';
  }

  function getNoteWordCount(page) {
    if (!page || !page.note || !page.note.content) return 0;
    if (typeof page.note.wordCount === 'number') return page.note.wordCount;
    return window.PageNotes.countWords(page.note.content);
  }

  function getPageSearchText(page) {
    const noteText = page.note && page.note.content ? page.note.content : '';
    const noteTitle = page.note && page.note.pageTitle ? page.note.pageTitle : '';
    const highlightText = page.highlights
      .map(h => `${h.text || ''} ${h.annotation || ''}`)
      .join(' ');

    return `${page.title} ${page.url} ${noteTitle} ${noteText} ${highlightText}`.toLowerCase();
  }

  function matchesViewFilter(page) {
    const hasHighlights = page.highlights.length > 0;
    const hasNote = !!(page.note && page.note.content);

    switch (activeFilter) {
      case 'with-notes':
        return hasNote;
      case 'notes-only':
        return hasNote && !hasHighlights;
      case 'highlights-only':
        return hasHighlights && !hasNote;
      case 'all':
      default:
        return true;
    }
  }

  function getVisiblePages() {
    const keyword = searchInput.value.trim().toLowerCase();
    const visiblePages = pagesData.filter(page => {
      if (!matchesViewFilter(page)) return false;
      if (!keyword) return true;
      return getPageSearchText(page).includes(keyword);
    });

    visiblePages.sort((a, b) => {
      const aUpdated = getPageLastUpdated(a);
      const bUpdated = getPageLastUpdated(b);

      if (activeSort === 'updated-asc') {
        return aUpdated - bUpdated || a.title.localeCompare(b.title);
      }

      return bUpdated - aUpdated || a.title.localeCompare(b.title);
    });

    return visiblePages;
  }

  function normalizeClipboardText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function formatHighlightForClipboard(highlight) {
    const text = normalizeClipboardText((highlight && highlight.text) || '');
    if (!text) return '';
    const annotation = normalizeClipboardText((highlight && highlight.annotation) || '');
    return annotation ? `${text}\n批注：${annotation}` : text;
  }

  function formatPageForClipboard(page) {
    const sections = [];
    const note = page && page.note && page.note.content
      ? normalizeClipboardText(page.note.content)
      : '';
    const highlights = Array.isArray(page && page.highlights)
      ? page.highlights.map(formatHighlightForClipboard).filter(Boolean)
      : [];

    if (note) {
      sections.push(`页面笔记\n${note}`);
    }

    if (highlights.length > 0) {
      sections.push(`高亮内容\n${highlights.join('\n\n')}`);
    }

    return sections.join('\n\n').trim();
  }

  function updateFilterChips() {
    filterChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === activeFilter);
    });
  }

  function loadData() {
    chrome.storage.local.get(null, (all) => {
      const pagesByUrl = new Map();

      function ensurePage(url, title) {
        if (!url) return null;

        let page = pagesByUrl.get(url);
        if (!page) {
          page = {
            key: HIGHLIGHT_PREFIX + url,
            url,
            title: title || url,
            highlights: [],
            note: null
          };
          pagesByUrl.set(url, page);
        } else if ((!page.title || page.title === page.url) && title) {
          page.title = title;
        }

        return page;
      }

      Object.keys(all).forEach((key) => {
        if (key.startsWith(HIGHLIGHT_PREFIX)) {
          const arr = Array.isArray(all[key]) ? all[key] : [];
          const url = key.substring(HIGHLIGHT_PREFIX.length);
          if (!url) return;

          const title = (arr[0] && arr[0].pageTitle) || url;
          const page = ensurePage(url, title);
          if (page) {
            page.key = key;
            page.highlights = arr;
          }
        } else if (key.startsWith(NOTE_PREFIX)) {
          const record = all[key];
          const url = (record && record.pageUrl) || key.substring(NOTE_PREFIX.length);
          if (!record || typeof record !== 'object' || !url) return;

          const page = ensurePage(url, record.pageTitle || url);
          if (page) {
            page.note = record;
          }
        }
      });

      pagesData = Array.from(pagesByUrl.values())
        .filter(page => page.highlights.length > 0 || (page.note && page.note.content))
        .sort((a, b) => getPageLastUpdated(b) - getPageLastUpdated(a) || a.title.localeCompare(b.title));

      renderOverviewStats();
      updateFilterChips();
      renderList();
      getMowenSettings().then(settings => syncMowenActionState(settings.lastTestedKey));
      getMowenSettings().then(settings => updateMowenSummary(settings));
    });
  }

  async function ensureContentScript(tab) {
    if (!tab || !tab.id || !tab.url || !/^https?:/.test(tab.url)) {
      return false;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { command: 'ping' }, { frameId: 0 });
      if (response && response.ok) {
        return false;
      }
    } catch (err) {
      // Content script missing, try reinjecting below.
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
      return true;
    } catch (err) {
      console.warn('管理页注入 content.js 失败', err);
      return false;
    }
  }

  async function warmOpenTabsHighlights() {
    try {
      const tabs = await chrome.tabs.query({});
      const webTabs = tabs.filter(tab => tab.id && tab.url && /^https?:/.test(tab.url));

      await Promise.all(webTabs.map(async (tab) => {
        try {
          const reinjected = await ensureContentScript(tab);
          if (reinjected) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
          await chrome.tabs.sendMessage(tab.id, { command: 'getHighlights' }, { frameId: 0 });
        } catch (err) {
          // Ignore tabs we still can't reach; the management page will
          // continue using whatever is already in storage.
        }
      }));
    } catch (err) {
      console.warn('管理页预热已打开标签页失败', err);
    }
  }

  async function notifyTabsForPage(url, message) {
    const tabs = await chrome.tabs.query({});
    const matchedTabs = tabs.filter(tab => tab.id && tab.url === url);
    await Promise.all(matchedTabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => { })
    ));
  }

  async function removeIdsFromSyncIndex(ids) {
    if (!ids || ids.length === 0) return;

    try {
      const result = await chrome.storage.sync.get(['highlight_index']);
      const index = Array.isArray(result.highlight_index) ? result.highlight_index : [];
      const nextIndex = index.filter(item => !ids.includes(item.id));
      await chrome.storage.sync.set({ highlight_index: nextIndex });
    } catch (e) {
      console.warn('删除同步索引失败', e);
    }
  }

  async function deletePageHighlights(page) {
    const ids = page.highlights.map(h => h.id).filter(Boolean);

    if (page.highlights.length > 0) {
      await chrome.storage.local.remove(page.key);
      await removeIdsFromSyncIndex(ids);
      await notifyTabsForPage(page.url, { command: 'clearHighlights' });
    }

    if (!(page.note && page.note.content)) {
      openedPageKeys.delete(page.key);
    }
    loadData();
  }

  async function deletePageRecord(page) {
    if (!page) return;

    const removeKeys = [];
    const ids = page.highlights.map(h => h.id).filter(Boolean);

    if (page.highlights.length > 0) {
      removeKeys.push(page.key);
    }

    if (page.note && page.note.content) {
      removeKeys.push(NOTE_PREFIX + ((page.note.pageUrl || page.url)));
    }

    if (removeKeys.length > 0) {
      await chrome.storage.local.remove(removeKeys);
    }

    if (ids.length > 0) {
      await removeIdsFromSyncIndex(ids);
      await notifyTabsForPage(page.url, { command: 'clearHighlights' });
    }

    openedPageKeys.delete(page.key);
    loadData();
  }

  async function deletePageNote(page) {
    if (!page.note || !page.note.content) return;

    await window.PageNotes.deletePageNote(page.url);
    if (page.highlights.length === 0) {
      openedPageKeys.delete(page.key);
    }
    loadData();
  }

  function renderBlacklist() {
    chrome.storage.local.get(['disabled_domains'], (res) => {
      const list = res.disabled_domains || [];
      const container = document.getElementById('blacklist-container');
      container.innerHTML = '';

      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'blacklist-empty';
        empty.textContent = '暂无禁用网站';
        container.appendChild(empty);
        return;
      }

      list.forEach(domain => {
        const tag = document.createElement('div');
        tag.className = 'blacklist-tag';

        const text = document.createElement('span');
        text.textContent = domain;
        tag.appendChild(text);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'blacklist-remove';
        removeBtn.textContent = '×';
        removeBtn.title = '移除';

        removeBtn.addEventListener('click', () => {
          const newList = list.filter(d => d !== domain);
          chrome.storage.local.set({ disabled_domains: newList }, () => {
            renderBlacklist();
          });
        });

        tag.appendChild(removeBtn);
        container.appendChild(tag);
      });
    });
  }

  function renderList() {
    const visiblePages = getVisiblePages();
    pagesList.innerHTML = '';

    if (listEndMarker) {
      listEndMarker.classList.toggle('hidden', visiblePages.length === 0);
    }

    if (visiblePages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '没有匹配的记录';
      pagesList.appendChild(empty);
      return;
    }

    let currentGroup = null;
    let currentGroupList = null;

    visiblePages.forEach(page => {
      const bucket = getPageTimeBucket(page);
      if (bucket !== currentGroup) {
        currentGroup = bucket;
        const group = document.createElement('section');
        group.className = 'page-group';

        const title = document.createElement('h2');
        title.className = 'page-group-title';
        title.textContent = bucket;
        group.appendChild(title);

        currentGroupList = document.createElement('div');
        currentGroupList.className = 'page-group-list';
        group.appendChild(currentGroupList);
        pagesList.appendChild(group);
      }

      const details = document.createElement('details');
      details.dataset.pageKey = page.key;
      if (openedPageKeys.has(page.key)) details.open = true;

      const summary = document.createElement('summary');

      const summaryMain = document.createElement('div');
      summaryMain.className = 'summary-main';

      if (isSelectionMode) {
        const pageCheckbox = document.createElement('input');
        pageCheckbox.type = 'checkbox';
        pageCheckbox.className = 'page-select-checkbox';

        const selectedCount = page.highlights.filter(h => selectedIds.has(h.id)).length;
        pageCheckbox.checked = page.highlights.length > 0 && selectedCount === page.highlights.length;
        pageCheckbox.indeterminate = selectedCount > 0 && selectedCount < page.highlights.length;
        pageCheckbox.disabled = page.highlights.length === 0;
        pageCheckbox.addEventListener('click', (e) => {
          e.stopPropagation();
          setPageSelection(details, page, pageCheckbox.checked);
        });

        summaryMain.appendChild(pageCheckbox);
      }

      const accent = document.createElement('span');
      accent.className = 'page-accent';
      summaryMain.appendChild(accent);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'page-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'page-title-row';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'page-title';
      titleSpan.textContent = page.title;
      titleRow.appendChild(titleSpan);

      if (page.highlights.length > 0) {
        const highlightBadge = document.createElement('span');
        highlightBadge.className = 'summary-badge summary-badge-highlight';
        highlightBadge.textContent = `${page.highlights.length} 条`;
        titleRow.appendChild(highlightBadge);
      }

      if (page.note && page.note.content) {
        const noteBadge = document.createElement('span');
        noteBadge.className = 'summary-badge summary-badge-note';
        noteBadge.textContent = `${getNoteWordCount(page)} 字笔记`;
        titleRow.appendChild(noteBadge);
      }

      infoDiv.appendChild(titleRow);

      const metaLine = document.createElement('div');
      metaLine.className = 'page-meta-line';

      const urlSpan = document.createElement('span');
      urlSpan.className = 'page-url';
      urlSpan.textContent = getPageDomain(page.url);
      urlSpan.title = page.url;
      metaLine.appendChild(urlSpan);

      const separator = document.createElement('span');
      separator.className = 'page-meta-separator';
      separator.textContent = '•';
      metaLine.appendChild(separator);

      const updatedSpan = document.createElement('span');
      updatedSpan.className = 'page-updated';
      const updatedAt = getPageLastUpdated(page);
      updatedSpan.textContent = formatUpdatedTime(updatedAt);
      if (updatedAt) {
        updatedSpan.title = new Date(updatedAt).toLocaleString('zh-CN');
      }
      metaLine.appendChild(updatedSpan);

      infoDiv.appendChild(metaLine);
      summaryMain.appendChild(infoDiv);
      summary.appendChild(summaryMain);

      if (!isSelectionMode) {
        const actionWrap = document.createElement('div');
        actionWrap.className = 'page-summary-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'summary-action-btn';
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const content = formatPageForClipboard(page);
          if (!content) return;
          navigator.clipboard.writeText(content).catch(err => console.warn('复制失败', err));
        });
        actionWrap.appendChild(copyBtn);

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'summary-action-btn';
        exportBtn.textContent = '导出';
        exportBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          exportPages([page]);
        });
        actionWrap.appendChild(exportBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'summary-action-btn danger';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm(`确定删除“${page.title}”的整页记录吗？这会删除该页的高亮和页面笔记。`)) {
            await deletePageRecord(page);
          }
        });
        actionWrap.appendChild(deleteBtn);

        summary.appendChild(actionWrap);
      }

      details.appendChild(summary);

      if (page.note && page.note.content) {
        const notePanel = document.createElement('div');
        notePanel.className = 'page-note-panel';

        const noteLabel = document.createElement('div');
        noteLabel.className = 'page-note-label';
        noteLabel.textContent = '页面笔记';
        notePanel.appendChild(noteLabel);

        const noteContent = document.createElement('div');
        noteContent.className = 'page-note-content';
        noteContent.textContent = page.note.content;
        notePanel.appendChild(noteContent);

        details.appendChild(notePanel);
      }

      if (page.highlights.length > 0) {
        const container = document.createElement('div');
        container.className = 'highlights';

        page.highlights.forEach(h => {
          const row = document.createElement('div');
          row.className = 'highlight-row';
          row.dataset.id = h.id;
          row.dataset.pageKey = page.key;

          if (isSelectionMode) {
            row.classList.add('selectable');
            if (selectedIds.has(h.id)) {
              row.classList.add('selected');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.checked = selectedIds.has(h.id);
            checkbox.addEventListener('click', (e) => {
              e.stopPropagation();
              toggleSelection(h.id, page.key, checkbox.checked);
              row.classList.toggle('selected', checkbox.checked);
            });
            row.appendChild(checkbox);

            row.addEventListener('click', () => {
              checkbox.checked = !checkbox.checked;
              toggleSelection(h.id, page.key, checkbox.checked);
              row.classList.toggle('selected', checkbox.checked);
            });
          }

          const indicator = document.createElement('div');
          indicator.className = 'color-indicator';
          indicator.style.backgroundColor = colorMap[h.color] || '#ddd';
          row.appendChild(indicator);

          const textSpan = document.createElement('span');
          textSpan.className = 'text';
          let display = String(h.text || '').trim().replace(/\s+/g, ' ');
          if (display.length > 120) display = display.slice(0, 120) + '…';
          if (h.annotation) display += ' · 含批注';
          textSpan.textContent = display;
          row.appendChild(textSpan);

          if (!isSelectionMode) {
            const copyHighlightBtn = document.createElement('button');
            copyHighlightBtn.type = 'button';
            copyHighlightBtn.textContent = '复制';
            copyHighlightBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(formatHighlightForClipboard(h)).catch(err => {
                console.warn('复制失败', err);
              });
            });
            row.appendChild(copyHighlightBtn);

            const deleteHighlightBtn = document.createElement('button');
            deleteHighlightBtn.type = 'button';
            deleteHighlightBtn.textContent = '删除';
            deleteHighlightBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm('删除此高亮吗？')) {
                deleteHighlight(page.key, h.id);
              }
            });
            row.appendChild(deleteHighlightBtn);
          }

          container.appendChild(row);
        });

        details.appendChild(container);
      }

      if (!isSelectionMode) {
        const detailActions = document.createElement('div');
        detailActions.className = 'detail-actions';

        if (page.highlights.length > 0) {
          const deletePageBtn = document.createElement('button');
          deletePageBtn.type = 'button';
          deletePageBtn.className = 'danger';
          deletePageBtn.textContent = '删除高亮';
          deletePageBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定删除此页面的全部高亮吗？')) {
              await deletePageHighlights(page);
            }
          });
          detailActions.appendChild(deletePageBtn);

          const copyHighlightsBtn = document.createElement('button');
          copyHighlightsBtn.type = 'button';
          copyHighlightsBtn.textContent = '复制高亮';
          copyHighlightsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const texts = page.highlights
              .map(formatHighlightForClipboard)
              .filter(Boolean)
              .join('\n\n');
            if (texts) {
              navigator.clipboard.writeText(texts).catch(err => console.warn('复制失败', err));
            }
          });
          detailActions.appendChild(copyHighlightsBtn);
        }

        if (page.note && page.note.content) {
          const copyNoteBtn = document.createElement('button');
          copyNoteBtn.type = 'button';
          copyNoteBtn.textContent = '复制笔记';
          copyNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(page.note.content).catch(err => console.warn('复制失败', err));
          });
          detailActions.appendChild(copyNoteBtn);

          const deleteNoteBtn = document.createElement('button');
          deleteNoteBtn.type = 'button';
          deleteNoteBtn.className = 'danger';
          deleteNoteBtn.textContent = '删除笔记';
          deleteNoteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定删除此页面笔记吗？')) {
              await deletePageNote(page);
            }
          });
          detailActions.appendChild(deleteNoteBtn);
        }

        if (detailActions.children.length > 0) {
          details.appendChild(detailActions);
        }
      }

      details.addEventListener('toggle', () => {
        if (details.open) openedPageKeys.add(page.key);
        else openedPageKeys.delete(page.key);
      });

      currentGroupList.appendChild(details);
    });
  }

  async function deleteHighlight(key, id) {
    const result = await chrome.storage.local.get([key]);
    const arr = Array.isArray(result[key]) ? result[key] : [];
    const newArr = arr.filter(item => item.id !== id);
    await chrome.storage.local.set({ [key]: newArr });
    await removeIdsFromSyncIndex([id]);

    const pageUrl = key.startsWith(HIGHLIGHT_PREFIX) ? key.substring(HIGHLIGHT_PREFIX.length) : '';
    if (pageUrl) {
      await notifyTabsForPage(pageUrl, { command: 'removeHighlight', id });
    }

    loadData();
  }

  function exportPages(pages, format) {
    if (!pages || pages.length === 0) {
      alert('没有可导出的内容');
      return;
    }

    const bundle = window.HighlightExport.buildExportBundle(pages, { source: 'options' });
    const targetFormat = format || 'markdown';
    const ok = targetFormat === 'html'
      ? window.HighlightExport.downloadBundleAsHtml(bundle, 'catlines')
      : window.HighlightExport.downloadBundleAsMarkdown(bundle, 'catlines');
    if (!ok) {
      alert('没有可导出的内容');
    }
  }

  searchInput.addEventListener('input', () => {
    renderList();
  });

  if (sortSelect) {
    sortSelect.value = activeSort;
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value || 'updated-desc';
      renderList();
    });
  }

  if (exportMenuTrigger) {
    exportMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (exportMenu && exportMenu.classList.contains('open')) {
        closeExportMenu();
      } else {
        openExportMenu();
      }
    });
  }

  if (exportMenuOptions.length > 0) {
    exportMenuOptions.forEach(option => {
      option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const format = option.dataset.format;
        closeExportMenu();
        if (!format) return;

        if (format === 'markdown' || format === 'html') {
          exportPages(pagesData, format);
          return;
        }

        if (format === 'mowen') {
          const settings = await getMowenSettings();
          const hasApiKey = !!String(settings.apiKey || '').trim();
          const isTested = hasApiKey && settings.lastTestedKey === settings.apiKey;

          if (!hasApiKey) {
            openMowenPanel();
            setMowenStatus('请先完成墨问配置，再执行导出。', 'error');
            setMowenFormVisible(true);
            return;
          }

          if (!isTested) {
            openMowenPanel();
            setMowenStatus('请先测试墨问导出，确认配置可用后再导出。', 'error');
            return;
          }

          exportAllToMowen();
        }
      });
    });
  }

  if (mowenConfigToggle) {
    mowenConfigToggle.addEventListener('click', () => {
      if (!settingsPanel) return;
      const willOpen = settingsPanel.classList.contains('hidden');
      setSettingsPanelVisible(willOpen);
      if (willOpen) {
        closeExportMenu();
      }
    });
  }

  if (mowenConfigEditBtn) {
    mowenConfigEditBtn.addEventListener('click', () => {
      openMowenPanel();
      setMowenFormVisible(true);
      if (mowenApiKeyInput) {
        mowenApiKeyInput.focus();
      }
    });
  }

  if (mowenPanel) {
    mowenPanel.addEventListener('toggle', () => {
      syncMowenPanelState();
    });
  }

  document.addEventListener('click', () => {
    closeExportMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeExportMenu();
    }
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter || 'all';
      updateFilterChips();

      if (isSelectionMode) {
        selectedIds.clear();
        selectionMap.clear();
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = false;
        }
        updateSelectCount();
      }

      renderList();
    });
  });

  if (mowenSaveBtn) {
    mowenSaveBtn.addEventListener('click', () => {
      saveMowenSettings().catch(err => {
        console.warn('保存墨问设置失败', err);
        setMowenStatus('保存设置失败，请稍后重试。', 'error');
      });
    });
  }

  if (mowenTestBtn) {
    mowenTestBtn.addEventListener('click', () => {
      setMowenFormVisible(true);
      testMowenExport();
    });
  }

  if (mowenApiKeyInput) {
    mowenApiKeyInput.addEventListener('input', async () => {
      const settings = await getMowenSettings();
      updateMowenSummary({
        apiKey: getMowenApiKey(),
        tags: getMowenTagsInput(),
        lastTestedKey: settings.lastTestedKey
      });
      syncMowenActionState(settings.lastTestedKey);
    });
  }

  if (mowenTagsInput) {
    mowenTagsInput.addEventListener('input', async () => {
      const settings = await getMowenSettings();
      updateMowenSummary({
        apiKey: getMowenApiKey(),
        tags: getMowenTagsInput(),
        lastTestedKey: settings.lastTestedKey
      });
    });
  }

  loadData();
  warmOpenTabsHighlights();
  renderBlacklist();
  loadMowenSettings().catch(err => {
    console.warn('加载墨问设置失败', err);
    setMowenStatus('加载墨问设置失败。', 'error');
  });
  syncSettingsPanelState();
  syncMowenPanelState();

  function toggleSelection(id, pageKey, isSelected) {
    if (isSelected) {
      selectedIds.add(id);
      selectionMap.set(id, pageKey);
    } else {
      selectedIds.delete(id);
      selectionMap.delete(id);
    }
    updateSelectCount();
    updatePageCheckboxStates();
  }

  function setPageSelection(detailsEl, page, isSelected) {
    page.highlights.forEach(h => {
      if (isSelected) {
        selectedIds.add(h.id);
        selectionMap.set(h.id, page.key);
      } else {
        selectedIds.delete(h.id);
        selectionMap.delete(h.id);
      }
    });

    detailsEl.querySelectorAll('.highlight-row').forEach(row => {
      const rowId = row.dataset.id;
      const checked = selectedIds.has(rowId);
      row.classList.toggle('selected', checked);

      const checkbox = row.querySelector('.item-checkbox');
      if (checkbox) {
        checkbox.checked = checked;
      }
    });

    updateSelectCount();
    updatePageCheckboxStates();
  }

  function updatePageCheckboxStates() {
    if (!isSelectionMode) return;

    document.querySelectorAll('#pages-list details').forEach(details => {
      const pageCheckbox = details.querySelector('.page-select-checkbox');
      if (!pageCheckbox) return;

      const itemCheckboxes = Array.from(details.querySelectorAll('.item-checkbox'));
      const checkedCount = itemCheckboxes.filter(checkbox => checkbox.checked).length;
      const totalCount = itemCheckboxes.length;

      pageCheckbox.checked = totalCount > 0 && checkedCount === totalCount;
      pageCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
      pageCheckbox.disabled = totalCount === 0;
    });
  }

  function enterSelectionMode() {
    isSelectionMode = true;
    selectedIds.clear();
    selectionMap.clear();

    if (selectModeBtn) selectModeBtn.classList.add('active');
    if (batchHeader) batchHeader.classList.remove('hidden');
    if (batchActionBar) batchActionBar.classList.remove('hidden');
    document.getElementById('options-container').classList.add('selection-mode');

    updateSelectCount();
    renderList();
  }

  function exitSelectionMode() {
    isSelectionMode = false;
    selectedIds.clear();
    selectionMap.clear();

    if (selectModeBtn) selectModeBtn.classList.remove('active');
    if (batchHeader) batchHeader.classList.add('hidden');
    if (batchActionBar) batchActionBar.classList.add('hidden');
    document.getElementById('options-container').classList.remove('selection-mode');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    renderList();
  }

  function toggleSelectAll(selectAll) {
    selectedIds.clear();
    selectionMap.clear();

    if (selectAll) {
      getVisiblePages().forEach(page => {
        page.highlights.forEach(h => {
          selectedIds.add(h.id);
          selectionMap.set(h.id, page.key);
        });
      });
    }

    updateSelectCount();
    renderList();
  }

  function getTotalHighlightCount() {
    return getVisiblePages().reduce((sum, page) => sum + page.highlights.length, 0);
  }

  function updateSelectCount() {
    const count = selectedIds.size;
    if (selectCount) selectCount.textContent = `已选 ${count} 条（勾选前框可全选）`;

    const totalCount = getTotalHighlightCount();
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = count > 0 && count === totalCount;
      selectAllCheckbox.indeterminate = count > 0 && count < totalCount;
    }
  }

  async function batchDeleteSelected() {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的高亮');
      return;
    }

    if (!confirm(`确定删除选中的 ${selectedIds.size} 条高亮吗？`)) {
      return;
    }

    const byPage = new Map();
    for (const [id, pageKey] of selectionMap) {
      if (!byPage.has(pageKey)) {
        byPage.set(pageKey, []);
      }
      byPage.get(pageKey).push(id);
    }

    for (const [pageKey, ids] of byPage) {
      const result = await chrome.storage.local.get([pageKey]);
      const arr = Array.isArray(result[pageKey]) ? result[pageKey] : [];
      const newArr = arr.filter(item => !ids.includes(item.id));
      await chrome.storage.local.set({ [pageKey]: newArr });
      await removeIdsFromSyncIndex(ids);

      const pageUrl = pageKey.startsWith(HIGHLIGHT_PREFIX) ? pageKey.substring(HIGHLIGHT_PREFIX.length) : '';
      if (pageUrl) {
        await Promise.all(ids.map(id =>
          notifyTabsForPage(pageUrl, { command: 'removeHighlight', id })
        ));
      }
    }

    exitSelectionMode();
    loadData();
  }

  function mergeCopySelected() {
    if (selectedIds.size === 0) {
      alert('请先选择要复制的高亮');
      return;
    }

    const texts = [];
    pagesData.forEach(page => {
      page.highlights.forEach(h => {
        if (selectedIds.has(h.id)) {
          const content = formatHighlightForClipboard(h);
          if (content) {
            texts.push(content);
          }
        }
      });
    });

    const mergedText = texts.join('\n\n');

    navigator.clipboard.writeText(mergedText).then(() => {
      const originalText = batchCopyBtn.textContent;
      batchCopyBtn.textContent = '✅ 已复制!';
      setTimeout(() => {
        batchCopyBtn.textContent = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('复制失败');
    });
  }

  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', () => {
      if (isSelectionMode) {
        exitSelectionMode();
      } else {
        enterSelectionMode();
      }
    });
  }

  if (cancelSelectBtn) {
    cancelSelectBtn.addEventListener('click', () => {
      exitSelectionMode();
    });
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      toggleSelectAll(selectAllCheckbox.checked);
    });
  }

  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', () => {
      batchDeleteSelected();
    });
  }

  if (batchCopyBtn) {
    batchCopyBtn.addEventListener('click', () => {
      mergeCopySelected();
    });
  }

  let storageReloadTimer = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const changedKeys = Object.keys(changes);
    if (changedKeys.length === 0) return;

    if (changedKeys.some(key => key === 'disabled_domains')) {
      renderBlacklist();
    }

    if (changedKeys.some(key =>
      key === MOWEN_API_KEY_KEY || key === MOWEN_TAGS_KEY || key === MOWEN_TESTED_KEY
    )) {
      loadMowenSettings().catch(() => { });
    }

    const shouldReloadPages = changedKeys.some(key =>
      key.startsWith(HIGHLIGHT_PREFIX) || key.startsWith(NOTE_PREFIX)
    );

    if (!shouldReloadPages) return;

    if (storageReloadTimer) {
      clearTimeout(storageReloadTimer);
    }

    storageReloadTimer = setTimeout(() => {
      loadData();
    }, 100);
  });
});
