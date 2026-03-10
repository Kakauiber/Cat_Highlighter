// Management page script for the highlighter extension.  Presents an
// aggregated view of all highlights stored in chrome.storage.local.
// Supports searching, deleting individual or all highlights for a page,
// copying individual highlights, exporting data as Markdown, and
// preserving expanded state of pages after operations.

document.addEventListener('DOMContentLoaded', () => {
  const pagesList = document.getElementById('pages-list');
  const searchInput = document.getElementById('search-input');

  // Cache of page data: { key, url, title, highlights: [...] }
  let pagesData = [];
  // Track expanded pages by storage key
  const openedPageKeys = new Set();
  // Colour mapping consistent with the content script
  const colorMap = {
    yellow: '#FFEA8A',
    mint: '#86EFAC',
    coral: '#FDA4AF'
  };

  // Batch selection state
  let isSelectionMode = false;
  let selectedIds = new Set();
  let selectionMap = new Map(); // id -> pageKey

  // Batch selection DOM elements
  const selectModeBtn = document.getElementById('select-mode-btn');
  const batchHeader = document.getElementById('batch-header');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectCount = document.getElementById('select-count');
  const cancelSelectBtn = document.getElementById('cancel-select-btn');
  const batchActionBar = document.getElementById('batch-action-bar');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const batchCopyBtn = document.getElementById('batch-copy-btn');

  /**
   * Load all stored highlights from chrome.storage.local.  Keys prefixed
   * with 'page_highlights_' represent highlight arrays for a given URL.
   */
  function loadData() {
    chrome.storage.local.get(null, (all) => {
      pagesData = [];
      const prefix = 'page_highlights_';
      // Use Object.keys to iterate explicit own properties only
      Object.keys(all).forEach((key) => {
        if (key && key.startsWith(prefix)) {
          const arr = all[key];
          if (Array.isArray(arr) && arr.length > 0) {
            const url = key.substring(prefix.length);
            const title = arr[0].pageTitle || url;
            pagesData.push({ key, url, title, highlights: arr });
          }
        }
      });
      // Sort pages alphabetically by title
      pagesData.sort((a, b) => a.title.localeCompare(b.title));
      renderList();
    });
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

    await chrome.storage.local.remove(page.key);
    await removeIdsFromSyncIndex(ids);
    await notifyTabsForPage(page.url, { command: 'clearHighlights' });

    openedPageKeys.delete(page.key);
    loadData();
  }

  /**
   * Render the blacklist of disabled domains.
   */
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

  /**
   * Render the pages and their highlights based on the search filter and
   * open state.  Maintains `openedPageKeys` across renders.
   */
  function renderList() {
    const filter = searchInput.value.trim().toLowerCase();
    pagesList.innerHTML = '';
    let any = false;
    pagesData.forEach(page => {
      // Determine if page or any highlight matches the filter
      const matches = page.title.toLowerCase().includes(filter) ||
        page.url.toLowerCase().includes(filter) ||
        page.highlights.some(h => String(h.text || '').toLowerCase().includes(filter));
      if (!matches) return;
      any = true;
      const details = document.createElement('details');
      details.dataset.pageKey = page.key;
      // Preserve expanded state
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
      const countSpan = document.createElement('span');
      countSpan.className = 'count';
      countSpan.textContent = `${page.highlights.length} 条`;
      summary.appendChild(countSpan);
      details.appendChild(summary);
      // Highlight rows container
      const container = document.createElement('div');
      container.className = 'highlights';
      page.highlights.forEach(h => {
        const row = document.createElement('div');
        row.className = 'highlight-row';
        row.dataset.id = h.id;
        row.dataset.pageKey = page.key;

        // In selection mode, add checkbox
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

          // Click on entire row toggles selection
          row.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            toggleSelection(h.id, page.key, checkbox.checked);
            row.classList.toggle('selected', checkbox.checked);
          });
        }

        // Colour indicator
        const indicator = document.createElement('div');
        indicator.className = 'color-indicator';
        indicator.style.backgroundColor = colorMap[h.color] || '#ddd';
        row.appendChild(indicator);
        // Text
        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        let display = String(h.text || '').trim().replace(/\s+/g, ' ');
        if (display.length > 80) display = display.slice(0, 80) + '…';
        if (h.annotation) display += ' 📝';
        textSpan.textContent = display;
        row.appendChild(textSpan);

        // Action buttons (only in normal mode)
        if (!isSelectionMode) {
          // Copy button
          const copyBtn = document.createElement('button');
          copyBtn.textContent = '复制';
          copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(h.text).catch(err => {
              console.warn('复制失败', err);
            });
          });
          row.appendChild(copyBtn);
          // Delete button
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
      if (!isSelectionMode) {
        const actions = document.createElement('div');
        actions.className = 'page-actions';
        // Delete all highlights on page
        const deletePageBtn = document.createElement('button');
        deletePageBtn.textContent = '删除本页';
        deletePageBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('确定删除此站点的所有高亮吗？')) {
            await deletePageHighlights(page);
          }
        });
        actions.appendChild(deletePageBtn);
        // Copy all highlights from this page to clipboard
        const copyPageBtn = document.createElement('button');
        copyPageBtn.textContent = '复制本页';
        copyPageBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const texts = page.highlights.map(h => String(h.text || '').replace(/\r?\n/g, ' ').trim()).join('\n');
          if (texts) {
            navigator.clipboard.writeText(texts).catch(err => console.warn('复制失败', err));
          }
        });
        actions.appendChild(copyPageBtn);
        // Export this page only
        const exportPageBtn = document.createElement('button');
        exportPageBtn.textContent = '导出本页';
        exportPageBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          exportPages([page]);
        });
        actions.appendChild(exportPageBtn);
        details.appendChild(actions);
      }
      pagesList.appendChild(details);
      // Track open/close
      details.addEventListener('toggle', () => {
        if (details.open) openedPageKeys.add(page.key);
        else openedPageKeys.delete(page.key);
      });
    });
    if (!any) {
      const empty = document.createElement('p');
      empty.textContent = '没有匹配的高亮记录';
      empty.style.color = '#666';
      empty.style.fontSize = '14px';
      pagesList.appendChild(empty);
    }
  }

  /**
   * Delete a specific highlight within a page and reload data (retaining
   * expanded pages).
   *
   * @param {string} key
   * @param {string} id
   */
  async function deleteHighlight(key, id) {
    const result = await chrome.storage.local.get([key]);
    const arr = Array.isArray(result[key]) ? result[key] : [];
    const newArr = arr.filter(item => item.id !== id);
    await chrome.storage.local.set({ [key]: newArr });
    await removeIdsFromSyncIndex([id]);

    const pageUrl = key.startsWith('page_highlights_') ? key.substring('page_highlights_'.length) : '';
    if (pageUrl) {
      await notifyTabsForPage(pageUrl, { command: 'removeHighlight', id });
    }

    loadData();
  }

  /**
   * Export the given pages as a Markdown file.  Each page becomes a
   * section headed by its title; each highlight is formatted as a list
   * item with colour and annotation info.  The file name starts with
   * 'catlines_' followed by the date (YYYYMMDD).
   *
   * @param {Array} pages
   */
  function exportPages(pages) {
    if (!pages || pages.length === 0) {
      alert('没有可导出的高亮');
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const content = exportToMarkdownFormat(pages);
    downloadFile(content, `catlines_${dateStr}.md`, 'text/markdown;charset=utf-8');
  }

  /**
   * Generate Markdown format content.
   */
  function exportToMarkdownFormat(pages) {
    let md = '';
    pages.forEach((page, index) => {
      md += `## ${page.title}\n`;
      md += `链接：${page.url}\n`;
      page.highlights.forEach(h => {
        const ann = h.annotation ? `，批注：${h.annotation}` : '';
        const text = String(h.text).replace(/\r?\n/g, ' ');
        md += `- [ ] ${text}（颜色：${h.color}${ann}）\n`;
      });
      if (index < pages.length - 1) md += '\n';
    });
    return md;
  }

  /**
   * Download file helper.
   */
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Event listeners
  searchInput.addEventListener('input', () => {
    renderList();
  });

  // Export dropdown handling
  const exportDropdown = document.getElementById('export-dropdown');
  if (exportDropdown) {
    exportDropdown.addEventListener('change', (e) => {
      const format = e.target.value;
      if (format === 'markdown') {
        exportPages(pagesData);
        e.target.value = ''; // Reset dropdown
      }
    });
  }

  loadData();
  renderBlacklist();

  // --- Batch Selection Functions ---

  // Toggle selection of a single highlight
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

  // Enter selection mode
  function enterSelectionMode() {
    isSelectionMode = true;
    selectedIds.clear();
    selectionMap.clear();

    // Update UI
    if (selectModeBtn) selectModeBtn.classList.add('active');
    if (batchHeader) batchHeader.classList.remove('hidden');
    if (batchActionBar) batchActionBar.classList.remove('hidden');
    document.getElementById('options-container').classList.add('selection-mode');

    updateSelectCount();
    renderList();
  }

  // Exit selection mode
  function exitSelectionMode() {
    isSelectionMode = false;
    selectedIds.clear();
    selectionMap.clear();

    // Update UI
    if (selectModeBtn) selectModeBtn.classList.remove('active');
    if (batchHeader) batchHeader.classList.add('hidden');
    if (batchActionBar) batchActionBar.classList.add('hidden');
    document.getElementById('options-container').classList.remove('selection-mode');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    renderList();
  }

  // Select/deselect all
  function toggleSelectAll(selectAll) {
    selectedIds.clear();
    selectionMap.clear();

    if (selectAll) {
      pagesData.forEach(page => {
        page.highlights.forEach(h => {
          selectedIds.add(h.id);
          selectionMap.set(h.id, page.key);
        });
      });
    }

    updateSelectCount();
    renderList();
  }

  // Get total highlight count
  function getTotalHighlightCount() {
    return pagesData.reduce((sum, page) => sum + page.highlights.length, 0);
  }

  // Update the select count display
  function updateSelectCount() {
    const count = selectedIds.size;
    if (selectCount) selectCount.textContent = `已选 ${count} 条（勾选前框可全选）`;

    // Update select all checkbox state
    const totalCount = getTotalHighlightCount();
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = count > 0 && count === totalCount;
      selectAllCheckbox.indeterminate = count > 0 && count < totalCount;
    }
  }

  // Batch delete selected highlights
  async function batchDeleteSelected() {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的高亮');
      return;
    }

    if (!confirm(`确定删除选中的 ${selectedIds.size} 条高亮吗？`)) {
      return;
    }

    // Group by pageKey for efficient deletion
    const byPage = new Map();
    for (const [id, pageKey] of selectionMap) {
      if (!byPage.has(pageKey)) {
        byPage.set(pageKey, []);
      }
      byPage.get(pageKey).push(id);
    }

    // Delete from each page
    for (const [pageKey, ids] of byPage) {
      const result = await chrome.storage.local.get([pageKey]);
      const arr = Array.isArray(result[pageKey]) ? result[pageKey] : [];
      const newArr = arr.filter(item => !ids.includes(item.id));
      await chrome.storage.local.set({ [pageKey]: newArr });
      await removeIdsFromSyncIndex(ids);
    }

    exitSelectionMode();
    loadData();
  }

  // Merge copy selected highlights
  function mergeCopySelected() {
    if (selectedIds.size === 0) {
      alert('请先选择要复制的高亮');
      return;
    }

    // Collect texts in order
    const texts = [];
    pagesData.forEach(page => {
      page.highlights.forEach(h => {
        if (selectedIds.has(h.id)) {
          texts.push(h.text);
        }
      });
    });

    // Join with double newline
    const mergedText = texts.join('\n\n');

    navigator.clipboard.writeText(mergedText).then(() => {
      // Show brief feedback
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

  // --- Batch Selection Event Listeners ---

  // Toggle selection mode
  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', () => {
      if (isSelectionMode) {
        exitSelectionMode();
      } else {
        enterSelectionMode();
      }
    });
  }

  // Cancel selection
  if (cancelSelectBtn) {
    cancelSelectBtn.addEventListener('click', () => {
      exitSelectionMode();
    });
  }

  // Select all checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      toggleSelectAll(selectAllCheckbox.checked);
    });
  }

  // Batch delete button
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', () => {
      batchDeleteSelected();
    });
  }

  // Batch copy button
  if (batchCopyBtn) {
    batchCopyBtn.addEventListener('click', () => {
      mergeCopySelected();
    });
  }
});
