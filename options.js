// Management page script for the highlighter extension. Presents an
// aggregated view of all page data stored in chrome.storage.local.
// A page may contain highlights, a page note, or both. Supports
// searching, deleting highlights/notes, copying content, exporting
// Markdown, and preserving expanded state across renders.

document.addEventListener('DOMContentLoaded', () => {
  const HIGHLIGHT_PREFIX = 'page_highlights_';
  const NOTE_PREFIX = (window.PageNotes && window.PageNotes.NOTE_PREFIX) || 'page_notes_';

  const pagesList = document.getElementById('pages-list');
  const searchInput = document.getElementById('search-input');
  const selectModeBtn = document.getElementById('select-mode-btn');
  const batchHeader = document.getElementById('batch-header');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectCount = document.getElementById('select-count');
  const cancelSelectBtn = document.getElementById('cancel-select-btn');
  const batchActionBar = document.getElementById('batch-action-bar');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const batchCopyBtn = document.getElementById('batch-copy-btn');
  const exportDropdown = document.getElementById('export-dropdown');
  const mowenConfigToggle = document.getElementById('mowen-config-toggle');
  const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
  const mowenPanel = document.getElementById('mowen-panel');
  const mowenSummaryMeta = document.getElementById('mowen-summary-meta');
  const mowenApiKeyInput = document.getElementById('mowen-api-key');
  const mowenTagsInput = document.getElementById('mowen-tags');
  const mowenSaveBtn = document.getElementById('mowen-save-btn');
  const mowenTestBtn = document.getElementById('mowen-test-btn');
  const mowenStatus = document.getElementById('mowen-status');

  const MOWEN_API_KEY_KEY = 'mowen_api_key';
  const MOWEN_TAGS_KEY = 'mowen_default_tags';
  const MOWEN_TESTED_KEY = 'mowen_last_tested_key';

  // Cache of page data: { key, url, title, highlights: [...], note: record|null }
  let pagesData = [];
  const openedPageKeys = new Set();

  const colorMap = {
    yellow: '#FFEA8A',
    blue: '#7CC7FF',
    red: '#FF8A8A',
    mint: '#7CC7FF',
    coral: '#FF8A8A'
  };

  let isSelectionMode = false;
  let selectedIds = new Set();
  let selectionMap = new Map(); // id -> pageKey
  let activeFilter = 'all';
  let mowenIsBusy = false;

  function getMowenApiKey() {
    return String(mowenApiKeyInput && mowenApiKeyInput.value || '').trim();
  }

  function getMowenTagsInput() {
    return String(mowenTagsInput && mowenTagsInput.value || '').trim();
  }

  function syncMowenToggleState() {
    if (!mowenConfigToggle || !mowenPanel) return;
    const expanded = !!mowenPanel.open;
    mowenConfigToggle.classList.toggle('active', expanded);
    mowenConfigToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function openMowenPanel() {
    if (!mowenPanel) return;
    mowenPanel.open = true;
    syncMowenToggleState();
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
    if (!mowenSummaryMeta) return;

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

    mowenSummaryMeta.textContent = parts.join(' · ');

    if (mowenPanel && !apiKey && !mowenPanel.open) {
      openMowenPanel();
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
    return pagesData.filter(page => {
      if (!matchesViewFilter(page)) return false;
      if (!keyword) return true;
      return getPageSearchText(page).includes(keyword);
    });
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
      const response = await chrome.tabs.sendMessage(tab.id, { command: 'ping' });
      if (response && response.ok) {
        return false;
      }
    } catch (err) {
      // Content script missing, try reinjecting below.
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
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
          await chrome.tabs.sendMessage(tab.id, { command: 'getHighlights' });
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
      chrome.tabs.sendMessage(tab.id, message).catch(() => { })
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
        container.textContent = '暂无禁用网站';
        container.style.color = '#999';
        return;
      }

      list.forEach(domain => {
        const tag = document.createElement('div');
        tag.className = 'blacklist-tag';
        tag.style.display = 'inline-flex';
        tag.style.alignItems = 'center';
        tag.style.background = '#eee';
        tag.style.padding = '4px 10px';
        tag.style.borderRadius = '16px';
        tag.style.margin = '0 8px 8px 0';
        tag.style.fontSize = '14px';

        const text = document.createElement('span');
        text.textContent = domain;
        tag.appendChild(text);

        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.style.marginLeft = '8px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontWeight = 'bold';
        removeBtn.style.color = '#888';
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

    visiblePages.forEach(page => {
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

      const infoDiv = document.createElement('div');
      infoDiv.className = 'page-info';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'page-title';
      titleSpan.textContent = page.title;
      infoDiv.appendChild(titleSpan);

      const urlSpan = document.createElement('span');
      urlSpan.className = 'page-url';
      urlSpan.textContent = page.url;
      infoDiv.appendChild(urlSpan);
      summaryMain.appendChild(infoDiv);
      summary.appendChild(summaryMain);

      const statWrap = document.createElement('div');
      statWrap.className = 'summary-stats';

      const countSpan = document.createElement('span');
      countSpan.className = 'count';
      countSpan.textContent = `${page.highlights.length} 条高亮`;
      statWrap.appendChild(countSpan);

      const noteCount = document.createElement('span');
      noteCount.className = 'count note-count';
      if (page.note && page.note.content) {
        noteCount.textContent = `已记录 ${getNoteWordCount(page)} 字`;
        noteCount.classList.add('has-note');
      } else {
        noteCount.textContent = '暂无笔记';
      }
      statWrap.appendChild(noteCount);

      summary.appendChild(statWrap);
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
          if (display.length > 80) display = display.slice(0, 80) + '…';
          if (h.annotation) display += ' 📝';
          textSpan.textContent = display;
          row.appendChild(textSpan);

          if (!isSelectionMode) {
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '复制';
            copyBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(formatHighlightForClipboard(h)).catch(err => {
                console.warn('复制失败', err);
              });
            });
            row.appendChild(copyBtn);

            const delBtn = document.createElement('button');
            delBtn.textContent = '删除';
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm('删除此高亮吗？')) {
                deleteHighlight(page.key, h.id);
              }
            });
            row.appendChild(delBtn);
          }

          container.appendChild(row);
        });

        details.appendChild(container);
      }

      if (!isSelectionMode) {
        const actions = document.createElement('div');
        actions.className = 'page-actions';

        if (page.highlights.length > 0) {
          const deletePageBtn = document.createElement('button');
          deletePageBtn.textContent = '删除高亮';
          deletePageBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定删除此页面的全部高亮吗？')) {
              await deletePageHighlights(page);
            }
          });
          actions.appendChild(deletePageBtn);

          const copyPageBtn = document.createElement('button');
          copyPageBtn.textContent = '复制高亮';
          copyPageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const texts = page.highlights
              .map(formatHighlightForClipboard)
              .filter(Boolean)
              .join('\n\n');
            if (texts) {
              navigator.clipboard.writeText(texts).catch(err => console.warn('复制失败', err));
            }
          });
          actions.appendChild(copyPageBtn);
        }

        if (page.note && page.note.content) {
          const copyNoteBtn = document.createElement('button');
          copyNoteBtn.textContent = '复制笔记';
          copyNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(page.note.content).catch(err => console.warn('复制失败', err));
          });
          actions.appendChild(copyNoteBtn);

          const deleteNoteBtn = document.createElement('button');
          deleteNoteBtn.textContent = '删除笔记';
          deleteNoteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('确定删除此页面笔记吗？')) {
              await deletePageNote(page);
            }
          });
          actions.appendChild(deleteNoteBtn);
        }

        const exportPageBtn = document.createElement('button');
        exportPageBtn.textContent = '导出本页';
        exportPageBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          exportPages([page]);
        });
        actions.appendChild(exportPageBtn);

        details.appendChild(actions);
      }

      details.addEventListener('toggle', () => {
        if (details.open) openedPageKeys.add(page.key);
        else openedPageKeys.delete(page.key);
      });

      pagesList.appendChild(details);
    });

    if (visiblePages.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = '没有匹配的记录';
      empty.style.color = '#666';
      empty.style.fontSize = '14px';
      pagesList.appendChild(empty);
    }
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

  if (exportDropdown) {
    exportDropdown.addEventListener('change', async (e) => {
      const format = e.target.value;
      if (!format) return;

      if (format === 'markdown' || format === 'html') {
        exportPages(pagesData, format);
        e.target.value = '';
        return;
      }

      if (format === 'mowen') {
        const settings = await getMowenSettings();
        const hasApiKey = !!String(settings.apiKey || '').trim();
        const isTested = hasApiKey && settings.lastTestedKey === settings.apiKey;

        if (!hasApiKey) {
          openMowenPanel();
          setMowenStatus('请先完成墨问配置，再执行导出。', 'error');
          e.target.value = '';
          return;
        }

        if (!isTested) {
          openMowenPanel();
          setMowenStatus('请先测试墨问导出，确认配置可用后再导出。', 'error');
          e.target.value = '';
          return;
        }

        exportAllToMowen();
        e.target.value = '';
      }
    });
  }

  if (mowenConfigToggle) {
    mowenConfigToggle.addEventListener('click', () => {
      if (!mowenPanel) return;
      mowenPanel.open = !mowenPanel.open;
      syncMowenToggleState();
    });
  }

  if (mowenPanel) {
    mowenPanel.addEventListener('toggle', () => {
      syncMowenToggleState();
    });
  }

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
  syncMowenToggleState();

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
