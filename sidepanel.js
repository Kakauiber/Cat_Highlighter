// Side Panel script for 划线猫 extension
// Provides a persistent sidebar for viewing and managing highlights

document.addEventListener('DOMContentLoaded', () => {
    // Color mapping
    const colorMap = {
        yellow: '#FFEA8A',
        blue: '#7CC7FF',
        red: '#FF8A8A',
        mint: '#7CC7FF',
        coral: '#FF8A8A'
    };

    // DOM elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const currentTabMeta = document.getElementById('current-tab-meta');
    const notesTabMeta = document.getElementById('notes-tab-meta');
    const currentTab = document.getElementById('current-tab');
    const notesTab = document.getElementById('notes-tab');
    const currentPageInfo = document.getElementById('current-page-info');
    const currentHighlights = document.getElementById('current-highlights');
    const manageBtn = document.getElementById('manage-btn');
    // Batch Selection Elements
    const selectModeBtn = document.getElementById('select-mode-btn');
    const batchHeader = document.getElementById('batch-header');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const selectCount = document.getElementById('select-count');
    const cancelSelectBtn = document.getElementById('cancel-select-btn');
    const batchActionBar = document.getElementById('batch-action-bar');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const batchCopyBtn = document.getElementById('batch-copy-btn');
    const highlightSectionSummary = document.getElementById('highlight-section-summary');
    // Page Notes Elements
    const noteSection = document.getElementById('note-section');
    const noteSummary = document.getElementById('note-summary');
    const noteTextarea = document.getElementById('note-textarea');
    const noteSaveStatus = document.getElementById('note-save-status');
    const noteUpdateTime = document.getElementById('note-update-time');
    const noteWordCount = document.getElementById('note-word-count');

    // --- Manage Button ---
    manageBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // State
    let allPagesData = [];
    let currentPageData = null;
    let activeTab = 'current';
    // Batch selection state
    let isSelectionMode = false;
    let selectedIds = new Set();

    // --- Page Notes State ---
    let currentNoteRecord = null;   // Current page note data from storage
    let currentNoteUrl = null;      // Full URL the note belongs to
    let noteSaveTimer = null;       // Debounce timer for auto-save
    let noteIsDirty = false;        // Whether textarea has unsaved changes
    let isNoteSaving = false;       // Guard against concurrent saves
    let noteLoadRequestToken = 0;   // Prevent stale async note loads from overwriting newer pages
    const supportsHoverInteractions = typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const MOWEN_API_KEY_KEY = 'mowen_api_key';
    const MOWEN_TAGS_KEY = 'mowen_default_tags';
    const MOWEN_TESTED_KEY = 'mowen_last_tested_key';

    function syncTabChrome() {
        currentTab.classList.toggle('active', activeTab === 'current');
        notesTab.classList.toggle('active', activeTab === 'notes');
        selectModeBtn.classList.toggle('hidden', activeTab !== 'current');
    }

    function updateTabMeta() {
        if (currentTabMeta) {
            const highlightCount = currentPageData && Array.isArray(currentPageData.highlights)
                ? currentPageData.highlights.length
                : 0;
            currentTabMeta.textContent = highlightCount > 0 ? `${highlightCount} 条高亮` : '暂无高亮';
        }

        if (notesTabMeta) {
            const noteWordTotal = currentNoteRecord && currentNoteRecord.content
                ? (currentNoteRecord.wordCount || window.PageNotes.countWords(currentNoteRecord.content))
                : 0;
            notesTabMeta.textContent = noteWordTotal > 0 ? `${noteWordTotal} 字笔记` : '暂未记录';
        }
    }

    function formatHighlightForClipboard(highlight) {
        if (window.HighlightExport && typeof window.HighlightExport.buildHighlightExportItem === 'function') {
            const exportItem = window.HighlightExport.buildHighlightExportItem(highlight);
            if (typeof window.HighlightExport.renderHighlightMarkdownLines === 'function') {
                return window.HighlightExport.renderHighlightMarkdownLines(exportItem).join('\n');
            }
            return `${window.HighlightExport.getHighlightStyleLabel(exportItem)} ${exportItem.text}`;
        }

        const text = String((highlight && highlight.text) || '').trim();
        if (!text) return '';
        const annotation = String((highlight && highlight.annotation) || '').trim();
        return annotation ? `${text}\n批注：${annotation}` : text;
    }

    function switchTab(nextTab) {
        if (nextTab === activeTab) return;
        activeTab = nextTab;
        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === nextTab));

        if (nextTab !== 'current' && isSelectionMode) {
            exitSelectionMode(true);
        }

        syncTabChrome();
        renderCurrentView();
    }

    function closeOpenExportMenus(exceptMenu = null) {
        document.querySelectorAll('.page-export-menu.open').forEach(menu => {
            if (menu !== exceptMenu) {
                menu.classList.remove('open');
            }
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    document.addEventListener('click', () => {
        closeOpenExportMenus();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeOpenExportMenus();
        }
    });

    // Get the active web tab. Side panel runs in an extension context, so
    // currentWindow can resolve to the panel window instead of the page window.
    async function getActiveTab() {
        try {
            // Prefer the last focused browser window, which is usually the page
            // window that the user opened the side panel from.
            let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            let webTab = tabs.find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
            if (webTab) {
                console.log('[SidePanel] Found active web tab in last focused window:', webTab.url);
                return webTab;
            }

            // Fallback to currentWindow for browsers that do not expose the
            // expected window as lastFocusedWindow in side panel context.
            tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            webTab = tabs.find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
            if (webTab) {
                console.log('[SidePanel] Found active web tab in current window:', webTab.url);
                return webTab;
            }

            // Final fallback: scan windows for an active web tab.
            const allWindows = await chrome.windows.getAll({ populate: true });
            for (const win of allWindows) {
                const activeTab = win.tabs?.find(t => t.active && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
                if (activeTab) {
                    console.log('[SidePanel] Found active web tab while scanning windows:', activeTab.url);
                    return activeTab;
                }
            }

            console.log('[SidePanel] No valid web tab found');
            return null;
        } catch (err) {
            console.error('[SidePanel] Error getting active tab:', err);
            return null;
        }
    }

    async function ensureContentScript(tab) {
        if (!tab || !tab.id || !tab.url || !tab.url.startsWith('http')) {
            return false;
        }

        try {
            const response = await chrome.tabs.sendMessage(tab.id, { command: 'ping' });
            if (response && response.ok) {
                return false;
            }
        } catch (err) {
            console.log('[SidePanel] Content script missing, reinjecting:', err);
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            return true;
        } catch (err) {
            console.error('[SidePanel] Failed to inject content script:', err);
            return false;
        }
    }

    async function loadStoredPagesData(prefix) {
        const all = await chrome.storage.local.get(null);
        const pages = [];

        console.log('[SidePanel] Loading all data, keys:', Object.keys(all).filter(k => k.startsWith(prefix)));

        Object.keys(all).forEach(key => {
            if (key && key.startsWith(prefix)) {
                const arr = all[key];
                if (Array.isArray(arr) && arr.length > 0) {
                    const url = key.substring(prefix.length);
                    const title = arr[0].pageTitle || url;
                    pages.push({ key, url, title, highlights: arr });
                    console.log('[SidePanel] Found page:', { key, url, highlightCount: arr.length });
                }
            }
        });

        pages.sort((a, b) => a.title.localeCompare(b.title));
        return pages;
    }

    async function reconcileStoredHighlights(prefix) {
        const [all, syncResult] = await Promise.all([
            chrome.storage.local.get(null),
            chrome.storage.sync.get(['highlight_index'])
        ]);

        const keys = Object.keys(all).filter(key => key.startsWith(prefix));
        if (keys.length === 0) {
            return;
        }

        const syncIndex = Array.isArray(syncResult.highlight_index) ? syncResult.highlight_index : [];
        const syncUrlById = new Map(syncIndex.filter(item => item && item.id && item.url).map(item => [item.id, item.url]));
        const regrouped = new Map();
        let changed = false;

        keys.forEach(key => {
            const arr = Array.isArray(all[key]) ? all[key] : [];
            arr.forEach(item => {
                if (!item || !item.id) return;

                const sourceUrl = key.substring(prefix.length);
                const targetUrl = item.pageUrl || syncUrlById.get(item.id) || sourceUrl;
                const targetKey = prefix + targetUrl;
                if (targetKey !== key) {
                    changed = true;
                }

                const list = regrouped.get(targetKey) || [];
                if (!list.some(existing => existing.id === item.id)) {
                    list.push({ ...item, pageUrl: targetUrl });
                }
                regrouped.set(targetKey, list);
            });
        });

        if (!changed) {
            return;
        }

        const updates = {};
        keys.forEach(key => {
            updates[key] = regrouped.get(key) || [];
        });
        regrouped.forEach((arr, key) => {
            updates[key] = arr;
        });

        await chrome.storage.local.set(updates);
        console.log('[SidePanel] Reconciled highlight storage keys');
    }

    async function getCurrentPageDataFromTab(tab, prefix) {
        if (!tab || !tab.id || !tab.url) {
            return null;
        }

        try {
            const response = await chrome.tabs.sendMessage(tab.id, { command: 'getHighlights' });
            const highlights = Array.isArray(response?.highlights) ? response.highlights : [];
            const title = getBestPageTitle(
                [response?.pageTitle].concat(highlights.map(item => item && item.pageTitle)),
                tab.title || tab.url
            );
            return {
                key: prefix + tab.url,
                url: tab.url,
                title,
                highlights
            };
        } catch (err) {
            console.warn('[SidePanel] Failed to get highlights from active tab:', err);
            return null;
        }
    }

    // Load all highlight data
    async function loadAllData() {
        // Show loading state
        try {
            currentPageData = null;
            const prefix = 'page_highlights_';
            await reconcileStoredHighlights(prefix);
            allPagesData = await loadStoredPagesData(prefix);

            // Get current page data
            const tab = await getActiveTab();
            console.log('[SidePanel] Active tab:', tab ? { id: tab.id, url: tab.url } : 'none');

            if (tab && tab.url) {
                const reinjected = await ensureContentScript(tab);
                if (reinjected) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                    allPagesData = await loadStoredPagesData(prefix);
                }

                const currentKey = prefix + tab.url;
                console.log('[SidePanel] Looking for key:', currentKey);

                currentPageData = await getCurrentPageDataFromTab(tab, prefix);
                console.log('[SidePanel] Tab data match:', currentPageData ? currentPageData.highlights.length : 'no response');

                if ((!currentPageData || currentPageData.highlights.length === 0) && allPagesData.length > 0) {
                    currentPageData = allPagesData.find(p => p.key === currentKey) || allPagesData.find(p => p.url === tab.url) || currentPageData;
                    console.log('[SidePanel] Storage fallback:', currentPageData ? 'found' : 'not found');
                }

                // Fallback: Create empty entry for current page
                if (!currentPageData) {
                    console.log('[SidePanel] No match found, creating empty entry');
                    currentPageData = {
                        key: currentKey,
                        url: tab.url,
                        title: tab.title || tab.url,
                        highlights: []
                    };
                }
            }

            // Update sync status
            console.log('[SidePanel] Current page highlights:', currentPageData?.highlights?.length || 0);

            // Keep the current note UI stable while only highlight data changes
            // on the same page. Dedicated note storage listeners handle note refreshes.
            if (tab && tab.url) {
                if (currentNoteUrl !== tab.url || currentNoteRecord === null) {
                    await loadCurrentPageNote(tab.url, tab.title || tab.url);
                } else {
                    updatePageInfoNoteStatus();
                }
            } else {
                clearNoteUI();
            }

            // Render after both highlight and note state are refreshed.
            renderCurrentView();
        } catch (err) {
            console.error('Failed to load data:', err);
        }
    }

    // Render based on active tab
    function renderCurrentView() {
        renderCurrentPage();
    }

    // Render current page highlights
    function renderCurrentPage() {
        currentPageInfo.innerHTML = '';
        currentHighlights.innerHTML = '';

        if (!currentPageData) {
            updateTabMeta();
            showEmptyState(currentHighlights, '无法获取当前页面信息');
            return;
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'page-title';
        titleEl.textContent = currentPageData.title;
        currentPageInfo.appendChild(titleEl);

        const urlEl = document.createElement('div');
        urlEl.className = 'page-url';
        urlEl.textContent = currentPageData.url;
        currentPageInfo.appendChild(urlEl);

        // Meta row: highlight count + note status on one line
        const metaRow = document.createElement('div');
        metaRow.className = 'page-meta-row';

        const countEl = document.createElement('span');
        countEl.className = 'highlight-count';
        countEl.textContent = `${currentPageData.highlights.length} 条高亮`;
        metaRow.appendChild(countEl);

        const noteStatusLine = document.createElement('span');
        noteStatusLine.className = 'note-status-line';
        const noteIcon = document.createElement('span');
        noteIcon.className = 'note-status-icon';
        noteIcon.textContent = '📝';
        noteStatusLine.appendChild(noteIcon);
        const noteStatusText = document.createElement('span');
        if (currentNoteRecord && currentNoteRecord.content) {
            noteStatusText.textContent = `已记录 ${currentNoteRecord.wordCount || 0} 字`;
        } else {
            noteStatusText.textContent = '暂无笔记';
        }
        noteStatusLine.appendChild(noteStatusText);
        metaRow.appendChild(noteStatusLine);

        currentPageInfo.appendChild(metaRow);

        // Update highlight section summary for collapsed state
        highlightSectionSummary.textContent = `${currentPageData.highlights.length} 条`;
        updateTabMeta();

        if (!isSelectionMode) {
            currentPageInfo.appendChild(createPageActions(currentPageData, 'card'));
        }

        if (!currentPageData.highlights || currentPageData.highlights.length === 0) {
            showEmptyState(currentHighlights, '当前页面暂无高亮');
            return;
        }

        // Render highlights
        currentPageData.highlights.forEach(h => {
            const item = createHighlightItem(h, currentPageData);
            currentHighlights.appendChild(item);
        });
    }

    function hideVisibleHighlightActions(exceptItem = null) {
        document.querySelectorAll('.highlight-item.actions-visible').forEach(item => {
            if (item !== exceptItem) {
                item.classList.remove('actions-visible');
            }
        });
    }

    // Create highlight item element
    function createHighlightItem(h, page) {
        const item = document.createElement('div');
        item.className = 'highlight-item';
        item.dataset.id = h.id;
        item.dataset.pageKey = page.key;

        // In selection mode, add checkbox
        if (isSelectionMode) {
            item.classList.add('selectable');
            if (selectedIds.has(h.id)) {
                item.classList.add('selected');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.checked = selectedIds.has(h.id);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelection(h.id, page.key, checkbox.checked);
                item.classList.toggle('selected', checkbox.checked);
            });
            item.appendChild(checkbox);

            // Click on entire item toggles selection
            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    toggleSelection(h.id, page.key, checkbox.checked);
                    item.classList.toggle('selected', checkbox.checked);
                }
            });
        }

        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.backgroundColor = colorMap[h.color] || '#ddd';
        item.appendChild(dot);

        const content = document.createElement('div');
        content.className = 'highlight-content';

        const text = document.createElement('div');
        text.className = 'highlight-text';
        text.textContent = h.text || '';
        content.appendChild(text);

        if (h.annotation) {
            const annotation = document.createElement('div');
            annotation.className = 'highlight-annotation';
            annotation.textContent = h.annotation;
            content.appendChild(annotation);
        }

        item.appendChild(content);

        // Actions (only in normal mode)
        if (!isSelectionMode) {
            item.tabIndex = 0;

            const actions = document.createElement('div');
            actions.className = 'highlight-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn';
            // Line-style copy icon matching the toolbar
            copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            copyBtn.title = '复制';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(formatHighlightForClipboard(h)).catch(console.warn);
            });
            actions.appendChild(copyBtn);

            // Annotation button
            const annotateBtn = document.createElement('button');
            annotateBtn.className = 'action-btn';
            // Line-style annotation/edit icon
            annotateBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
            annotateBtn.title = '批注';
            annotateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const note = prompt('添加批注:', h.annotation || '');
                if (note !== null) {
                    updateHighlightAnnotation(page.key, h.id, note);
                }
            });
            actions.appendChild(annotateBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            // Line-style delete/trash icon matching the toolbar
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            deleteBtn.title = '删除';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('删除此高亮吗？')) {
                    deleteHighlight(page.key, h.id);
                }
            });
            actions.appendChild(deleteBtn);

            item.appendChild(actions);

            item.addEventListener('focusin', () => {
                if (!supportsHoverInteractions) {
                    hideVisibleHighlightActions(item);
                    item.classList.add('actions-visible');
                }
            });

            item.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') {
                    return;
                }

                if (!supportsHoverInteractions && !item.classList.contains('actions-visible')) {
                    e.preventDefault();
                    hideVisibleHighlightActions(item);
                    item.classList.add('actions-visible');
                    return;
                }

                e.preventDefault();
                item.click();
            });

            item.addEventListener('click', async (e) => {
                // If clicked on an action button, it will stopPropagation — won't reach here.
                if (!supportsHoverInteractions && !item.classList.contains('actions-visible')) {
                    // First interaction without hover — show actions, don't scroll.
                    hideVisibleHighlightActions(item);
                    item.classList.add('actions-visible');
                    return;
                }

                if (!supportsHoverInteractions) {
                    hideVisibleHighlightActions();
                }

                const tab = await getActiveTab();
                if (tab && page.url === tab.url) {
                    chrome.tabs.sendMessage(tab.id, { command: 'scrollToHighlight', id: h.id });
                } else {
                    chrome.tabs.create({ url: page.url }, (newTab) => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(newTab.id, { command: 'scrollToHighlight', id: h.id });
                        }, 2000);
                    });
                }
            });
        }

        return item;
    }

    function createPageActions(page, variant = 'card') {
        const actions = document.createElement('div');
        actions.className = variant === 'group' ? 'page-group-actions' : 'page-card-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'page-meta-btn';
        copyBtn.textContent = '复制本页';
        copyBtn.disabled = page.highlights.length === 0;
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await copyPageHighlights(page, copyBtn);
        });
        actions.appendChild(copyBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'page-meta-btn danger';
        deleteBtn.textContent = '删除本页';
        deleteBtn.disabled = page.highlights.length === 0;
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`确定删除“${page.title}”的全部高亮吗？`)) {
                await deletePageHighlights(page);
            }
        });
        actions.appendChild(deleteBtn);

        const exportMenu = document.createElement('div');
        exportMenu.className = 'page-export-menu';

        const exportTrigger = document.createElement('button');
        exportTrigger.type = 'button';
        exportTrigger.className = 'page-meta-btn page-export-trigger';
        exportTrigger.disabled = page.highlights.length === 0 && !(page.note && page.note.content);
        exportTrigger.innerHTML = `
            <span class="page-export-trigger-label">导出本页</span>
            <span class="page-export-trigger-chevron" aria-hidden="true"></span>
        `;
        exportTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (exportTrigger.disabled) return;
            const nextOpen = !exportMenu.classList.contains('open');
            closeOpenExportMenus(nextOpen ? exportMenu : null);
            exportMenu.classList.toggle('open', nextOpen);
        });
        exportMenu.appendChild(exportTrigger);

        const exportDropdown = document.createElement('div');
        exportDropdown.className = 'page-export-dropdown';
        exportDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        [
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' },
            { value: 'mowen', label: '墨问' }
        ].forEach(option => {
            const optionBtn = document.createElement('button');
            optionBtn.type = 'button';
            optionBtn.className = 'page-export-option';
            optionBtn.textContent = option.label;
            optionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.classList.remove('open');
                exportCurrentPage(page, option.value, exportTrigger);
            });
            exportDropdown.appendChild(optionBtn);
        });

        exportMenu.appendChild(exportDropdown);
        actions.appendChild(exportMenu);

        return actions;
    }

    async function getMowenSettings() {
        const result = await chrome.storage.local.get([MOWEN_API_KEY_KEY, MOWEN_TAGS_KEY, MOWEN_TESTED_KEY]);
        return {
            apiKey: String(result[MOWEN_API_KEY_KEY] || '').trim(),
            tags: String(result[MOWEN_TAGS_KEY] || '').trim(),
            lastTestedKey: String(result[MOWEN_TESTED_KEY] || '').trim()
        };
    }

    function flashExportSuccess(triggerControl) {
        if (!triggerControl) return;
        const originalDisabled = triggerControl.disabled;
        triggerControl.disabled = true;
        triggerControl.classList.add('export-success');
        setTimeout(() => {
            triggerControl.disabled = originalDisabled;
            triggerControl.classList.remove('export-success');
        }, 1200);
    }

    async function exportCurrentPage(page, format, triggerControl) {
        if (!page || (page.highlights.length === 0 && !(page.note && page.note.content))) {
            alert('当前页面没有可导出的内容');
            return;
        }

        if (!window.HighlightExport || typeof window.HighlightExport.buildExportBundle !== 'function') {
            alert('导出功能暂不可用');
            return;
        }

        const bundle = window.HighlightExport.buildExportBundle([page], { source: 'sidepanel' });
        const targetFormat = format || 'markdown';
        let ok = false;

        if (targetFormat === 'mowen') {
            if (!window.HighlightMowenExporter || typeof window.HighlightMowenExporter.exportBundleToMowen !== 'function') {
                alert('墨问导出当前不可用');
                return;
            }

            const settings = await getMowenSettings();
            if (!settings.apiKey) {
                alert('请先在管理页配置墨问 API Key。');
                return;
            }

            if (settings.lastTestedKey !== settings.apiKey) {
                alert('请先在管理页完成一次墨问测试导出，再执行当前页导出。');
                return;
            }

            if (triggerControl) {
                triggerControl.disabled = true;
            }

            try {
                const result = await window.HighlightMowenExporter.exportBundleToMowen(bundle, {
                    apiKey: settings.apiKey,
                    tags: settings.tags
                });
                if (!result || !result.ok) {
                    alert((result && result.message) || '导出到墨问失败，请检查 API Key、配额或网络状态。');
                    return;
                }
                alert(`已生成墨问笔记${result.noteId ? `（${result.noteId}）` : ''}。`);
                ok = true;
            } catch (err) {
                console.error('[SidePanel] Export to Mowen failed:', err);
                alert('导出到墨问失败，请检查网络、配额或 API Key。');
                return;
            } finally {
                if (triggerControl) {
                    triggerControl.disabled = false;
                }
            }
        } else {
            ok = targetFormat === 'html'
                ? window.HighlightExport.downloadBundleAsHtml(bundle, 'catlines')
                : window.HighlightExport.downloadBundleAsMarkdown(bundle, 'catlines');
        }

        if (!ok) {
            alert('当前页面没有可导出的内容');
            return;
        }

        flashExportSuccess(triggerControl);
    }

    // Delete highlight
    async function deleteHighlight(key, id) {
        const result = await chrome.storage.local.get([key]);
        const arr = Array.isArray(result[key]) ? result[key] : [];
        const newArr = arr.filter(item => item.id !== id);
        await chrome.storage.local.set({ [key]: newArr });
        await removeIdsFromSyncIndex([id]);

        const pageUrl = key.startsWith('page_highlights_')
            ? key.substring('page_highlights_'.length)
            : '';
        await notifyTabsForPage(pageUrl, { command: 'removeHighlight', id });

        // Reload data
        loadAllData();
    }

    async function notifyTabsForPage(url, message) {
        if (!url) return;

        const tabs = await chrome.tabs.query({});
        const matchedTabs = tabs.filter(tab => tab.id && tab.url === url);
        await Promise.all(matchedTabs.map(tab =>
            chrome.tabs.sendMessage(tab.id, message).catch(() => { })
        ));
    }

    async function removeIdsFromSyncIndex(ids) {
        if (!ids || ids.length === 0) return;

        try {
            const syncResult = await chrome.storage.sync.get(['highlight_index']);
            const index = Array.isArray(syncResult.highlight_index) ? syncResult.highlight_index : [];
            await chrome.storage.sync.set({
                highlight_index: index.filter(item => !ids.includes(item.id))
            });
        } catch (e) {
            console.warn('Failed to delete from sync:', e);
        }
    }

    async function deletePageHighlights(page) {
        const ids = page.highlights.map(h => h.id).filter(Boolean);
        await chrome.storage.local.remove(page.key);
        await removeIdsFromSyncIndex(ids);
        await notifyTabsForPage(page.url, { command: 'clearHighlights' });
        loadAllData();
    }

    async function copyPageHighlights(page, triggerBtn) {
        const texts = page.highlights
            .map(formatHighlightForClipboard)
            .filter(Boolean);

        if (texts.length === 0) {
            alert('当前页面没有可复制的高亮');
            return;
        }

        try {
            await navigator.clipboard.writeText(texts.join('\n\n'));
            if (triggerBtn) {
                const originalText = triggerBtn.textContent;
                triggerBtn.textContent = '已复制';
                setTimeout(() => {
                    triggerBtn.textContent = originalText;
                }, 1200);
            }
        } catch (err) {
            console.warn('Copy failed:', err);
            alert('复制失败');
        }
    }

    // Update annotation for a highlight
    async function updateHighlightAnnotation(key, id, note) {
        const result = await chrome.storage.local.get([key]);
        const arr = Array.isArray(result[key]) ? result[key] : [];
        const idx = arr.findIndex(item => item.id === id);
        if (idx >= 0) {
            arr[idx].annotation = note;
            await chrome.storage.local.set({ [key]: arr });
        }

        // Notify content script to update DOM
        const tab = await getActiveTab();
        if (tab && tab.url) {
            chrome.tabs.sendMessage(tab.id, { command: 'updateAnnotation', id, note }).catch(() => { });
        }

        // Reload data
        loadAllData();
    }

    // Show empty state
    function showEmptyState(container, message) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">${escapeHtml(message)}</div>
      </div>
    `;
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function normalizePageTitle(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function isUrlLikeTitle(value) {
        return /^https?:\/\//i.test(normalizePageTitle(value));
    }

    function isGenericAssistantTitle(value) {
        const normalized = normalizePageTitle(value).toLowerCase();
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

    function shouldPreferTitle(nextTitle, currentTitle) {
        const next = normalizePageTitle(nextTitle);
        const current = normalizePageTitle(currentTitle);

        if (!next || next === current) return false;
        if (!current || isUrlLikeTitle(current)) return true;
        if (isGenericAssistantTitle(current) && !isGenericAssistantTitle(next)) return true;
        return false;
    }

    function getBestPageTitle(candidates, fallback) {
        let best = normalizePageTitle(fallback);
        (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
            if (shouldPreferTitle(candidate, best)) {
                best = normalizePageTitle(candidate);
            }
        });
        return best || normalizePageTitle(fallback);
    }

    // =============================================
    // === Page Notes Logic ===
    // =============================================

    /**
     * Load the page note for the given URL and populate the UI.
     */
    async function loadCurrentPageNote(url, title) {
        // Guard: never operate on undefined/empty URL
        if (!url) {
            clearNoteUI();
            return;
        }

        const isSameUrlReload = currentNoteUrl === url;
        if (currentNoteUrl && currentNoteUrl !== url) {
            await flushPendingNoteSave();
        }

        const requestToken = ++noteLoadRequestToken;
        currentNoteUrl = url;
        if (!isSameUrlReload) {
            currentNoteRecord = null;
            noteIsDirty = false;
            noteTextarea.value = '';
            noteSummary.textContent = '暂无笔记';
            noteWordCount.textContent = '0 字';
            noteUpdateTime.textContent = '';
            setSaveStatusUI('idle');
            updatePageInfoNoteStatus();
            updateTabMeta();
        }

        try {
            currentNoteRecord = await window.PageNotes.getPageNote(url);
        } catch (err) {
            console.error('[PageNotes] Failed to load note:', err);
            currentNoteRecord = null;
        }

        if (requestToken !== noteLoadRequestToken || currentNoteUrl !== url) {
            return;
        }

        // Populate textarea only if user isn't actively editing
        if (document.activeElement !== noteTextarea) {
            noteTextarea.value = (currentNoteRecord && currentNoteRecord.content) || '';
        }

        updateNoteSummary();
        updateNoteWordCount();
        updateNoteUpdateTime();
        setSaveStatusUI('idle');
        noteIsDirty = false;

        if (currentPageData && currentPageData.url === url && currentNoteRecord && shouldPreferTitle(currentNoteRecord.pageTitle, currentPageData.title)) {
            currentPageData.title = normalizePageTitle(currentNoteRecord.pageTitle);
            const titleEl = currentPageInfo.querySelector('.page-title');
            if (titleEl) {
                titleEl.textContent = currentPageData.title;
            }
        }

        // Sync the page info card note status (may have rendered before note loaded)
        updatePageInfoNoteStatus();
        updateTabMeta();
    }

    /** Clear all note UI when there's no valid page. */
    function clearNoteUI() {
        noteLoadRequestToken += 1;
        if (noteSaveTimer) {
            clearTimeout(noteSaveTimer);
            noteSaveTimer = null;
        }
        currentNoteRecord = null;
        currentNoteUrl = null;
        noteIsDirty = false;
        noteTextarea.value = '';
        noteSummary.textContent = '暂无笔记';
        noteWordCount.textContent = '0 字';
        noteUpdateTime.textContent = '';
        setSaveStatusUI('idle');
        updateTabMeta();
    }

    /** Update the note status text inside the page info card. */
    function updatePageInfoNoteStatus() {
        const statusLine = currentPageInfo.querySelector('.note-status-line');
        if (!statusLine) return;
        // Find or ensure the text span (second child after icon)
        let textSpan = statusLine.querySelector('span:not(.note-status-icon)');
        if (!textSpan) {
            textSpan = statusLine;
        }
        if (currentNoteRecord && currentNoteRecord.content) {
            textSpan.textContent = `已记录 ${currentNoteRecord.wordCount || 0} 字`;
        } else {
            textSpan.textContent = '暂无笔记';
        }
    }

    /** Update the collapsed summary text. */
    function updateNoteSummary() {
        if (currentNoteRecord && currentNoteRecord.content) {
            const wc = currentNoteRecord.wordCount || window.PageNotes.countWords(currentNoteRecord.content);
            noteSummary.textContent = `已记录 ${wc} 字`;
        } else {
            noteSummary.textContent = '暂无笔记';
        }
        updateTabMeta();
    }

    /** Update the word count display. */
    function updateNoteWordCount() {
        const content = noteTextarea.value;
        const wc = window.PageNotes.countWords(content);
        noteWordCount.textContent = `${wc} 字`;
    }

    /** Update the last-updated time display. */
    function updateNoteUpdateTime() {
        if (!currentNoteRecord || !currentNoteRecord.updatedAt) {
            noteUpdateTime.textContent = '';
            return;
        }
        const diff = Date.now() - currentNoteRecord.updatedAt;
        if (diff < 60000) {
            noteUpdateTime.textContent = '最后更新：刚刚';
        } else if (diff < 3600000) {
            noteUpdateTime.textContent = `最后更新：${Math.floor(diff / 60000)} 分钟前`;
        } else if (diff < 86400000) {
            noteUpdateTime.textContent = `最后更新：${Math.floor(diff / 3600000)} 小时前`;
        } else {
            const d = new Date(currentNoteRecord.updatedAt);
            noteUpdateTime.textContent = `最后更新：${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    }

    /** Set the save status indicator. */
    function setSaveStatusUI(status) {
        noteSaveStatus.className = 'note-save-status';
        // Remove any existing retry link
        const existingRetry = noteSaveStatus.parentElement && noteSaveStatus.parentElement.querySelector('.note-retry-link');
        if (existingRetry) existingRetry.remove();

        switch (status) {
            case 'saving':
                noteSaveStatus.textContent = '保存中...';
                noteSaveStatus.classList.add('saving');
                break;
            case 'saved':
                noteSaveStatus.textContent = '已保存';
                noteSaveStatus.classList.add('saved');
                break;
            case 'error':
                noteSaveStatus.textContent = '保存失败';
                noteSaveStatus.classList.add('error');
                // Insert retry link after the status text
                const retryLink = document.createElement('button');
                retryLink.className = 'note-retry-link';
                retryLink.textContent = '重试保存';
                retryLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    saveCurrentNote();
                });
                noteSaveStatus.insertAdjacentElement('afterend', retryLink);
                break;
            default:
                noteSaveStatus.textContent = '';
                break;
        }
    }

    async function flushPendingNoteSave() {
        if (noteSaveTimer) {
            clearTimeout(noteSaveTimer);
            noteSaveTimer = null;
        }

        if (noteIsDirty && currentNoteUrl && !isNoteSaving) {
            await saveCurrentNote();
        }
    }

    /** Perform the actual save. */
    async function saveCurrentNote() {
        if (!currentNoteUrl) return;
        if (isNoteSaving) return;

        const content = noteTextarea.value;
        // Don't save if content is empty and there's no existing record
        if (!content.trim() && !currentNoteRecord) {
            noteIsDirty = false;
            return;
        }

        isNoteSaving = true;
        setSaveStatusUI('saving');

        try {
            // If content cleared and a record exists, delete instead of saving empty
            if (!content.trim() && currentNoteRecord) {
                await window.PageNotes.deletePageNote(currentNoteUrl);
                currentNoteRecord = null;
                noteIsDirty = false;
                setSaveStatusUI('saved');
                updateNoteSummary();
                updateNoteUpdateTime();
                updatePageInfoNoteStatus();
                return;
            }

            const pageTitle = (currentPageData && currentPageData.title) || currentNoteUrl;
            const draft = window.PageNotes.createNoteDraft(
                currentNoteUrl, pageTitle, content, currentNoteRecord
            );
            await window.PageNotes.savePageNote(currentNoteUrl, draft);

            currentNoteRecord = draft;
            noteIsDirty = false;
            setSaveStatusUI('saved');
            updateNoteSummary();
            updateNoteUpdateTime();

            // Also update the page info card note status if visible
            updatePageInfoNoteStatus();
        } catch (err) {
            console.error('[PageNotes] Save failed:', err);
            setSaveStatusUI('error');
        } finally {
            isNoteSaving = false;
        }
    }

    /** Schedule a debounced save. */
    function scheduleNoteSave() {
        if (noteSaveTimer) clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(() => {
            noteSaveTimer = null;
            saveCurrentNote();
        }, 600);
    }

    // --- Note Textarea: Input & Blur ---
    noteTextarea.addEventListener('input', () => {
        noteIsDirty = true;
        updateNoteWordCount();
        scheduleNoteSave();
    });

    noteTextarea.addEventListener('blur', () => {
        if (noteIsDirty) {
            if (noteSaveTimer) {
                clearTimeout(noteSaveTimer);
                noteSaveTimer = null;
            }
            saveCurrentNote();
        }
    });

    // --- Cmd/Ctrl + S immediate save ---
    noteTextarea.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (noteSaveTimer) {
                clearTimeout(noteSaveTimer);
                noteSaveTimer = null;
            }
            saveCurrentNote();
        }
    });

    // --- Batch Selection Mode Functions ---

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
    }

    function setPageSelection(groupEl, page, highlights, isSelected) {
        highlights.forEach(h => {
            if (isSelected) {
                selectedIds.add(h.id);
                selectionMap.set(h.id, page.key);
            } else {
                selectedIds.delete(h.id);
                selectionMap.delete(h.id);
            }
        });

        groupEl.querySelectorAll('.highlight-item').forEach(item => {
            const itemId = item.dataset.id;
            const checked = selectedIds.has(itemId);
            item.classList.toggle('selected', checked);

            const checkbox = item.querySelector('.item-checkbox');
            if (checkbox) {
                checkbox.checked = checked;
            }
        });

        updateSelectCount();
    }

    // Update the select count display
    function updateSelectCount() {
        const count = selectedIds.size;
        selectCount.textContent = `已选 ${count} 条（勾选前框可全选）`;

        // Update select all checkbox state
        const totalCount = getTotalHighlightCount();
        selectAllCheckbox.checked = count > 0 && count === totalCount;
        selectAllCheckbox.indeterminate = count > 0 && count < totalCount;
        updateBatchActionVisibility();
    }

    // Get total highlight count for current view
    function getTotalHighlightCount() {
        return currentPageData ? currentPageData.highlights.length : 0;
    }

    // Enter selection mode
    function enterSelectionMode() {
        isSelectionMode = true;
        selectedIds.clear();
        selectionMap.clear();

        // Update UI
        selectModeBtn.classList.add('active');
        batchHeader.classList.remove('hidden');
        batchActionBar.classList.remove('hidden');
        document.getElementById('sidepanel-container').classList.add('selection-mode');

        updateSelectCount();
        renderCurrentView();
    }

    // Exit selection mode
    function exitSelectionMode(skipRender = false) {
        isSelectionMode = false;
        selectedIds.clear();
        selectionMap.clear();

        // Update UI
        selectModeBtn.classList.remove('active');
        batchHeader.classList.add('hidden');
        batchActionBar.classList.add('hidden');
        document.getElementById('sidepanel-container').classList.remove('selection-mode');
        selectAllCheckbox.checked = false;
        updateBatchActionVisibility();

        if (!skipRender) {
            renderCurrentView();
        }
    }

    function updateBatchActionVisibility() {
        batchCopyBtn.disabled = selectedIds.size === 0;
        batchDeleteBtn.disabled = selectedIds.size === 0;
    }

    // Select/deselect all
    function toggleSelectAll(selectAll) {
        selectedIds.clear();
        selectionMap.clear();

        if (selectAll && currentPageData) {
            currentPageData.highlights.forEach(h => {
                selectedIds.add(h.id);
                selectionMap.set(h.id, currentPageData.key);
            });
        }

        updateSelectCount();
        renderCurrentView();
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

            const pageUrl = pageKey.startsWith('page_highlights_')
                ? pageKey.substring('page_highlights_'.length)
                : '';
            await Promise.all(ids.map(id =>
                notifyTabsForPage(pageUrl, { command: 'removeHighlight', id })
            ));
        }

        exitSelectionMode();
        loadAllData();
    }

    // Merge copy selected highlights
    function mergeCopySelected() {
        if (selectedIds.size === 0) {
            alert('请先选择要复制的高亮');
            return;
        }

        // Collect texts in display order
        const texts = [];

        if (currentPageData) {
            currentPageData.highlights.forEach(h => {
                if (selectedIds.has(h.id)) {
                    const content = formatHighlightForClipboard(h);
                    if (content) {
                        texts.push(content);
                    }
                }
            });
        }

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

    // --- Event Listeners for Batch Selection ---

    // Toggle selection mode
    selectModeBtn.addEventListener('click', () => {
        if (isSelectionMode) {
            exitSelectionMode();
        } else {
            enterSelectionMode();
        }
    });

    // Cancel selection
    cancelSelectBtn.addEventListener('click', () => {
        exitSelectionMode();
    });

    // Select all checkbox
    selectAllCheckbox.addEventListener('change', () => {
        toggleSelectAll(selectAllCheckbox.checked);
    });

    // Batch delete button
    batchDeleteBtn.addEventListener('click', () => {
        batchDeleteSelected();
    });

    // Batch copy button
    batchCopyBtn.addEventListener('click', () => {
        mergeCopySelected();
    });

    // Listen for storage changes to update in real-time
    // Use debounce to ensure data is fully written before reloading
    let storageUpdateTimeout = null;
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            const changedKeys = Object.keys(changes);
            const hasHighlightChanges = changedKeys.some(k => !k.startsWith('page_notes_'));
            const hasNoteChanges = changedKeys.some(k => k.startsWith('page_notes_'));

            // If only page_notes_ keys changed, skip full highlight reload
            // but still refresh note state if the change wasn't from our own save
            if (hasNoteChanges && !hasHighlightChanges) {
                // Re-read note data if the changed key matches current page
                if (currentNoteUrl && changedKeys.includes(window.PageNotes.getNoteStorageKey(currentNoteUrl))) {
                    // Only reload if we're not the ones saving right now
                    if (!isNoteSaving) {
                        loadCurrentPageNote(currentNoteUrl, (currentPageData && currentPageData.title) || currentNoteUrl);
                    }
                }
                return;
            }

            // Highlight data changed — reload everything
            if (storageUpdateTimeout) {
                clearTimeout(storageUpdateTimeout);
            }
            storageUpdateTimeout = setTimeout(() => {
                loadAllData();
            }, 100);
        }
    });

    // Listen for tab activation (user switches tabs)
    chrome.tabs.onActivated.addListener(() => {
        console.log('[SidePanel] Tab activated, reloading data');
        loadAllData();
    });

    // Listen for tab URL changes (navigation within same tab)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.active) {
            console.log('[SidePanel] Tab updated, reloading data');
            loadAllData();
        }
    });

    document.addEventListener('click', (e) => {
        if (supportsHoverInteractions) {
            return;
        }

        if (!e.target.closest('.highlight-item')) {
            hideVisibleHighlightActions();
        }
    });

    // Initial load
    syncTabChrome();
    updateBatchActionVisibility();
    loadAllData();
});
