// Side Panel script for 划线猫 extension
// Provides a persistent sidebar for viewing and managing highlights

document.addEventListener('DOMContentLoaded', () => {
    const META_PREFIX = 'page_meta_';

    // Color mapping
    const colorMap = {
        yellow: '#FFEA8A',
        blue: '#B9DDF4',
        red: '#FF8A8A',
        mint: '#B9DDF4',
        coral: '#FF8A8A'
    };

    // DOM elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const currentTabMeta = document.getElementById('current-tab-meta');
    const notesTabMeta = document.getElementById('notes-tab-meta');
    const currentTab = document.getElementById('current-tab');
    const notesTab = document.getElementById('notes-tab');
    const onboardingCard = document.getElementById('onboarding-card');
    const onboardingDomain = document.getElementById('onboarding-domain');
    const onboardingAvailability = document.getElementById('onboarding-availability');
    const onboardingDismissBtn = document.getElementById('onboarding-dismiss-btn');
    const onboardingManageBtn = document.getElementById('onboarding-manage-btn');
    const updateNoticeCard = document.getElementById('update-notice-card');
    const updateNoticeTitle = document.getElementById('update-notice-title');
    const updateNoticeList = document.getElementById('update-notice-list');
    const updateNoticeDismissBtn = document.getElementById('update-notice-dismiss-btn');
    const updateNoticeConfirmBtn = document.getElementById('update-notice-confirm-btn');
    const updateNoticeHistoryBtn = document.getElementById('update-notice-history-btn');
    const currentPageInfo = document.getElementById('current-page-info');
    const currentHighlights = document.getElementById('current-highlights');
    const manageBtn = document.getElementById('manage-btn');
    const refreshPageBtn = document.getElementById('refresh-page-btn');
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
    const highlightSortSelect = document.getElementById('highlight-sort-select');
    // Page Notes Elements
    const noteSection = document.getElementById('note-section');
    const noteSummary = document.getElementById('note-summary');
    const noteTextarea = document.getElementById('note-textarea');
    const noteSaveStatus = document.getElementById('note-save-status');
    const noteUpdateTime = document.getElementById('note-update-time');
    const noteWordCount = document.getElementById('note-word-count');

    function t(key, params, fallback) {
        return window.CatI18n && typeof window.CatI18n.t === 'function'
            ? window.CatI18n.t(key, params, fallback)
            : (fallback || key);
    }

    function formatCount(count, type) {
        return window.CatI18n && typeof window.CatI18n.formatCount === 'function'
            ? window.CatI18n.formatCount(count, type)
            : String(count);
    }

    function countParams(count, type) {
        return {
            count,
            countLabel: formatCount(count, type)
        };
    }

    function getMetaKey(url) {
        return META_PREFIX + String(url || '');
    }

    function normalizeTagName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ');
    }

    function normalizeTags(tags) {
        const raw = Array.isArray(tags)
            ? tags
            : String(tags || '').split(/[,，]/);
        const seen = new Set();
        const normalized = [];

        raw.forEach(tag => {
            const name = normalizeTagName(tag);
            if (!name) return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            normalized.push(name);
        });

        return normalized;
    }

    async function loadPageTags(url) {
        if (!url) return [];

        try {
            const result = await chrome.storage.local.get([getMetaKey(url)]);
            const record = result[getMetaKey(url)];
            return normalizeTags(record && record.tags);
        } catch (err) {
            console.warn('[SidePanel] Failed to load page tags:', err);
            return [];
        }
    }

    async function savePageTags(page, tags) {
        if (!page || !page.url) return;

        const normalized = normalizeTags(tags);
        const key = getMetaKey(page.url);

        if (normalized.length === 0) {
            await chrome.storage.local.remove(key);
        } else {
            await chrome.storage.local.set({
                [key]: {
                    pageUrl: page.url,
                    pageTitle: page.title || page.url,
                    tags: normalized,
                    updatedAt: Date.now()
                }
            });
        }

        if (currentPageData && currentPageData.url === page.url) {
            currentPageData = {
                ...currentPageData,
                tags: normalized
            };
            renderCurrentView();
        }
    }

    function applyLocalizedChrome() {
        if (window.CatI18n && typeof window.CatI18n.applyToDocument === 'function') {
            window.CatI18n.applyToDocument(document);
            window.CatI18n.updateDocumentTitle('sidePanelTitle');
        }
        syncTabChrome();
        updateTabMeta();
        updateNoteSummary();
        updateNoteWordCount();
        updateNoteUpdateTime();
        updateOnboardingCard();
        updateUpdateNoticeCard();
        renderCurrentView();
    }

    function openManagePage() {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    }

    function getPageHostLabel(url) {
        if (!url) return t('hostUnavailable', null, '未定位到网页');
        try {
            return new URL(url).hostname.replace(/^www\./i, '') || t('currentWebsite', null, '当前网页');
        } catch (err) {
            return t('currentWebsite', null, '当前网页');
        }
    }

    function updateOnboardingCard() {
        if (!onboardingCard || !onboardingDomain || !onboardingAvailability) {
            return;
        }

        const hasActivePage = Boolean(currentActivePageUrl);
        onboardingDomain.textContent = getPageHostLabel(currentActivePageUrl);
        if (currentPageAccessState === 'restricted') {
            onboardingAvailability.textContent = t('restrictedPage', null, '当前页面运行在受限容器中');
            onboardingAvailability.classList.remove('is-muted');
        } else {
            onboardingAvailability.textContent = hasActivePage
                ? t('availableOnThisPage', null, '可直接划线记录')
                : t('switchToNormalPage', null, '请切换到普通网页后使用');
            onboardingAvailability.classList.toggle('is-muted', !hasActivePage);
        }
        onboardingCard.classList.toggle('hidden', onboardingDismissed || isSelectionMode);
    }

    async function loadOnboardingState() {
        try {
            const result = await chrome.storage.local.get([ONBOARDING_DISMISSED_KEY]);
            onboardingDismissed = Boolean(result[ONBOARDING_DISMISSED_KEY]);
        } catch (err) {
            console.warn('[SidePanel] Failed to load onboarding state:', err);
            onboardingDismissed = false;
        }
        updateOnboardingCard();
    }

    async function dismissOnboarding() {
        onboardingDismissed = true;
        updateOnboardingCard();

        try {
            await chrome.storage.local.set({ [ONBOARDING_DISMISSED_KEY]: true });
        } catch (err) {
            console.warn('[SidePanel] Failed to persist onboarding dismissal:', err);
        }
    }

    function getUpdateSeenKey(version) {
        const prefix = window.CatReleaseNotes && window.CatReleaseNotes.UPDATE_SEEN_PREFIX
            ? window.CatReleaseNotes.UPDATE_SEEN_PREFIX
            : 'cat_update_seen_';
        return prefix + String(version || '').trim();
    }

    function updateUpdateNoticeCard() {
        if (!updateNoticeCard || !window.CatReleaseNotes || !pendingUpdateNotice) {
            if (updateNoticeCard) {
                updateNoticeCard.classList.add('hidden');
            }
            return;
        }

        const version = String(pendingUpdateNotice.version || '').trim();
        const currentVersion = window.CatReleaseNotes.getCurrentVersion
            ? window.CatReleaseNotes.getCurrentVersion()
            : version;
        const shouldShow = Boolean(
            version &&
            (!currentVersion || version === currentVersion) &&
            !pendingUpdateNotice.seen &&
            !isSelectionMode
        );

        updateNoticeCard.classList.toggle('hidden', !shouldShow);
        if (!shouldShow) return;

        const notes = window.CatReleaseNotes.getNotes(version);
        updateNoticeTitle.textContent = notes.title || t('updateNoticeDefaultTitle', { version }, `划线猫已更新到 v${version}`);
        updateNoticeList.innerHTML = '';
        (notes.items || []).forEach(text => {
            const item = document.createElement('li');
            item.textContent = text;
            updateNoticeList.appendChild(item);
        });
    }

    async function loadUpdateNoticeState() {
        if (!window.CatReleaseNotes) {
            return;
        }

        try {
            const key = window.CatReleaseNotes.UPDATE_NOTICE_KEY || 'cat_pending_update_notice';
            const result = await chrome.storage.local.get([key]);
            const notice = result && result[key];
            if (!notice || !notice.version) {
                pendingUpdateNotice = null;
                updateUpdateNoticeCard();
                return;
            }

            const seenKey = getUpdateSeenKey(notice.version);
            const seenResult = await chrome.storage.local.get([seenKey]);
            pendingUpdateNotice = {
                ...notice,
                seen: Boolean(notice.seen || seenResult[seenKey])
            };
        } catch (err) {
            console.warn('[SidePanel] Failed to load update notice:', err);
            pendingUpdateNotice = null;
        }

        updateUpdateNoticeCard();
    }

    async function dismissUpdateNotice() {
        if (!pendingUpdateNotice || !pendingUpdateNotice.version) {
            return;
        }

        pendingUpdateNotice = {
            ...pendingUpdateNotice,
            seen: true
        };
        updateUpdateNoticeCard();

        try {
            const key = window.CatReleaseNotes && window.CatReleaseNotes.UPDATE_NOTICE_KEY
                ? window.CatReleaseNotes.UPDATE_NOTICE_KEY
                : 'cat_pending_update_notice';
            await chrome.storage.local.set({
                [getUpdateSeenKey(pendingUpdateNotice.version)]: true,
                [key]: pendingUpdateNotice
            });
        } catch (err) {
            console.warn('[SidePanel] Failed to persist update notice dismissal:', err);
        }
    }

    function openUpdateHistory() {
        const url = chrome.runtime.getURL('options.html#updates');
        if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url }).catch(() => openManagePage());
        } else {
            window.open(url);
        }
    }

    // --- Manage Button ---
    manageBtn.addEventListener('click', openManagePage);
    if (refreshPageBtn) {
        refreshPageBtn.addEventListener('click', () => {
            refreshPageBtn.classList.add('is-refreshing');
            scheduleLoadAllData(0);
            window.setTimeout(() => {
                refreshPageBtn.classList.remove('is-refreshing');
            }, 450);
        });
    }
    if (onboardingManageBtn) {
        onboardingManageBtn.addEventListener('click', openManagePage);
    }
    if (onboardingDismissBtn) {
        onboardingDismissBtn.addEventListener('click', () => {
            dismissOnboarding();
        });
    }
    if (updateNoticeDismissBtn) {
        updateNoticeDismissBtn.addEventListener('click', dismissUpdateNotice);
    }
    if (updateNoticeConfirmBtn) {
        updateNoticeConfirmBtn.addEventListener('click', dismissUpdateNotice);
    }
    if (updateNoticeHistoryBtn) {
        updateNoticeHistoryBtn.addEventListener('click', openUpdateHistory);
    }

    // State
    let allPagesData = [];
    let currentPageData = null;
    let currentPageTabId = null;
    let activeTab = 'current';
    let currentHighlightSortOrder = 'asc';
    let currentPageAccessState = 'unknown';
    let currentPageFallbackTitle = '';
    let preferredActiveTabId = null;
    let preferredWindowId = null;
    // Batch selection state
    let isSelectionMode = false;
    let selectedIds = new Set();
    const selectionMap = new Map();

    // --- Page Notes State ---
    let currentNoteRecord = null;   // Current page note data from storage
    let currentNoteUrl = null;      // Full URL the note belongs to
    let noteSaveTimer = null;       // Debounce timer for auto-save
    let noteIsDirty = false;        // Whether textarea has unsaved changes
    let isNoteSaving = false;       // Guard against concurrent saves
    let noteLoadRequestToken = 0;   // Prevent stale async note loads from overwriting newer pages
    let tabReloadTimer = null;      // Debounce SPA tab URL/status changes
    const supportsHoverInteractions = typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const MOWEN_API_KEY_KEY = 'mowen_api_key';
    const MOWEN_TAGS_KEY = 'mowen_default_tags';
    const MOWEN_TESTED_KEY = 'mowen_last_tested_key';
    const ONBOARDING_DISMISSED_KEY = 'sidepanel_onboarding_dismissed';
    let onboardingDismissed = false;
    let pendingUpdateNotice = null;
    let currentActivePageUrl = null;

    function syncTabChrome() {
        currentTab.classList.toggle('active', activeTab === 'current');
        notesTab.classList.toggle('active', activeTab === 'notes');
        selectModeBtn.classList.remove('hidden');
        selectModeBtn.disabled = activeTab !== 'current';
        selectModeBtn.title = activeTab === 'current'
            ? t('selectMode', null, '多选')
            : t('selectModeCurrentOnly', null, '多选（仅高亮页可用）');
        syncSelectionModeUI();
    }

    function syncSelectionModeUI() {
        const enabled = isSelectionMode && activeTab === 'current';
        const sidepanelContainer = document.getElementById('sidepanel-container');

        selectModeBtn.classList.toggle('active', enabled);
        batchHeader.classList.toggle('hidden', !enabled);
        batchActionBar.classList.toggle('hidden', !enabled);
        sidepanelContainer.classList.toggle('selection-mode', enabled);

        if (!enabled) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        updateBatchActionVisibility();
    }

    function updateTabMeta() {
        if (currentTabMeta) {
            const highlightCount = currentPageData && Array.isArray(currentPageData.highlights)
                ? currentPageData.highlights.length
                : 0;
            currentTabMeta.textContent = highlightCount > 0
                ? t('highlightCount', countParams(highlightCount, 'highlight'), `${highlightCount} 条高亮`)
                : t('noHighlights', null, '暂无高亮');
        }

        if (notesTabMeta) {
            const noteWordTotal = currentNoteRecord && currentNoteRecord.content
                ? (currentNoteRecord.wordCount || window.PageNotes.countWords(currentNoteRecord.content))
                : 0;
            notesTabMeta.textContent = noteWordTotal > 0
                ? t('noteWordCount', countParams(noteWordTotal, 'word'), `${noteWordTotal} 字笔记`)
                : t('noNotes', null, '暂无笔记');
        }
    }

    function normalizeClipboardText(value) {
        return String(value || '')
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim();
    }

    function normalizePageUrlForCompare(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            return new URL(raw).href;
        } catch (err) {
            return raw;
        }
    }

    function isSamePageUrl(left, right) {
        const a = normalizePageUrlForCompare(left);
        const b = normalizePageUrlForCompare(right);
        return !!a && !!b && a === b;
    }

    function formatHighlightForClipboard(highlight) {
        const text = normalizeClipboardText((highlight && highlight.text) || '');
        if (!text) return '';
        const annotation = normalizeClipboardText((highlight && highlight.annotation) || '');
        return annotation ? `${text}\n${t('annotationPrefix', null, '批注：')}${annotation}` : text;
    }

    function formatPageForClipboard(page) {
        const exportPage = getCurrentPageExportSource(page);
        if (!exportPage) return '';

        const sections = [];
        const note = exportPage.note && exportPage.note.content
            ? normalizeClipboardText(exportPage.note.content)
            : '';
        const highlightTexts = exportPage.highlights
            .map(formatHighlightForClipboard)
            .filter(Boolean);

        if (note) {
            sections.push(`${t('pageNote', null, '页面笔记')}\n${note}`);
        }

        if (highlightTexts.length > 0) {
            sections.push(`${t('annotations', null, '标注')}\n${highlightTexts.join('\n\n')}`);
        }

        return sections.join('\n\n').trim();
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

    function isWebTab(tab) {
        return Boolean(
            tab &&
            tab.url &&
            (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
        );
    }

    // Get the active web tab. Side panel runs in an extension context, so
    // currentWindow can resolve to the panel window instead of the page window.
    async function getActiveTab() {
        try {
            if (preferredActiveTabId) {
                try {
                    const preferredTab = await chrome.tabs.get(preferredActiveTabId);
                    if (isWebTab(preferredTab) && preferredTab.active) {
                        console.log('[SidePanel] Using preferred active tab:', preferredTab.url);
                        return preferredTab;
                    }
                    preferredActiveTabId = null;
                } catch (err) {
                    preferredActiveTabId = null;
                }
            }

            if (preferredWindowId) {
                try {
                    const tabsInPreferredWindow = await chrome.tabs.query({ active: true, windowId: preferredWindowId });
                    const preferredWindowTab = tabsInPreferredWindow.find(isWebTab);
                    if (preferredWindowTab) {
                        preferredActiveTabId = preferredWindowTab.id;
                        console.log('[SidePanel] Found active web tab in preferred window:', preferredWindowTab.url);
                        return preferredWindowTab;
                    }
                } catch (err) {
                    preferredWindowId = null;
                }
            }

            // Prefer the last focused browser window, which is usually the page
            // window that the user opened the side panel from.
            let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            let webTab = tabs.find(isWebTab);
            if (webTab) {
                preferredActiveTabId = webTab.id;
                preferredWindowId = webTab.windowId || null;
                console.log('[SidePanel] Found active web tab in last focused window:', webTab.url);
                return webTab;
            }

            // Fallback to currentWindow for browsers that do not expose the
            // expected window as lastFocusedWindow in side panel context.
            tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            webTab = tabs.find(isWebTab);
            if (webTab) {
                preferredActiveTabId = webTab.id;
                preferredWindowId = webTab.windowId || null;
                console.log('[SidePanel] Found active web tab in current window:', webTab.url);
                return webTab;
            }

            // Final fallback: scan all active tabs across browser windows and
            // pick the one most recently accessed by the user.
            tabs = await chrome.tabs.query({ active: true });
            webTab = tabs
                .filter(isWebTab)
                .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
            if (webTab) {
                preferredActiveTabId = webTab.id;
                preferredWindowId = webTab.windowId || null;
                console.log('[SidePanel] Found active web tab while scanning active tabs:', webTab.url);
                return webTab;
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
            const response = await chrome.tabs.sendMessage(tab.id, { command: 'ping' }, { frameId: 0 });
            if (response && response.ok) {
                return false;
            }
        } catch (err) {
            console.log('[SidePanel] Content script missing, reinjecting:', err);
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
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
            const response = await chrome.tabs.sendMessage(tab.id, { command: 'getHighlights' }, { frameId: 0 });
            const responseUrl = response?.pageUrl || '';
            const responseMatchesTab = !responseUrl || isSamePageUrl(responseUrl, tab.url);
            const highlights = responseMatchesTab && Array.isArray(response?.highlights) ? response.highlights : [];
            const resolvedUrl = responseMatchesTab ? (responseUrl || tab.url) : tab.url;
            const title = getBestPageTitle(
                [responseMatchesTab ? response?.pageTitle : ''].concat(highlights.map(item => item && item.pageTitle)),
                tab.title || resolvedUrl
            );
            return {
                tabId: tab.id,
                key: responseMatchesTab && response?.storageKey ? response.storageKey : (prefix + resolvedUrl),
                url: resolvedUrl,
                title,
                highlights,
                tags: []
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
            currentPageTabId = null;
            currentActivePageUrl = null;
            currentPageAccessState = 'unknown';
            currentPageFallbackTitle = '';
            const prefix = 'page_highlights_';
            await reconcileStoredHighlights(prefix);
            allPagesData = await loadStoredPagesData(prefix);

            // Get current page data
            const tab = await getActiveTab();
            currentActivePageUrl = (tab && tab.url) || null;
            updateOnboardingCard();
            console.log('[SidePanel] Active tab:', tab ? { id: tab.id, url: tab.url } : 'none');

            if (tab && tab.url) {
                currentPageTabId = tab.id;
                preferredActiveTabId = tab.id;
                preferredWindowId = tab.windowId || null;
                currentPageFallbackTitle = tab.title || tab.url;
                const reinjected = await ensureContentScript(tab);
                if (reinjected) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                    allPagesData = await loadStoredPagesData(prefix);
                }

                currentPageData = await getCurrentPageDataFromTab(tab, prefix);
                const resolvedCurrentUrl = (currentPageData && currentPageData.url) || tab.url;
                const currentKey = (currentPageData && currentPageData.key) || (prefix + resolvedCurrentUrl);
                console.log('[SidePanel] Looking for key:', currentKey);
                console.log('[SidePanel] Tab data match:', currentPageData ? currentPageData.highlights.length : 'no response');

                if ((!currentPageData || currentPageData.highlights.length === 0) && allPagesData.length > 0) {
                    currentPageData = allPagesData.find(p => p.key === currentKey) || allPagesData.find(p => p.url === resolvedCurrentUrl) || currentPageData;
                    console.log('[SidePanel] Storage fallback:', currentPageData ? 'found' : 'not found');
                }

                if (currentPageData && currentPageData.url) {
                    currentPageData = {
                        ...currentPageData,
                        tags: await loadPageTags(currentPageData.url)
                    };
                }

                currentPageAccessState = currentPageData ? 'ready' : 'restricted';
            } else {
                currentPageAccessState = 'unavailable';
            }

            // Update sync status
            console.log('[SidePanel] Current page highlights:', currentPageData?.highlights?.length || 0);

            // Keep the current note UI stable while only highlight data changes
            // on the same page. Dedicated note storage listeners handle note refreshes.
            const noteUrl = (currentPageData && currentPageData.url) || (tab && tab.url) || null;
            const noteTitle = (currentPageData && currentPageData.title) || (tab && (tab.title || tab.url)) || noteUrl;
            if (noteUrl) {
                if (currentNoteUrl !== noteUrl || currentNoteRecord === null) {
                    await loadCurrentPageNote(noteUrl, noteTitle);
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

    function scheduleLoadAllData(delay = 100) {
        if (tabReloadTimer) {
            clearTimeout(tabReloadTimer);
        }
        tabReloadTimer = setTimeout(() => {
            tabReloadTimer = null;
            loadAllData();
        }, delay);
    }

    function applyCurrentPageHighlightChange(change) {
        if (!currentPageData || !change) return false;

        const nextHighlights = Array.isArray(change.newValue) ? change.newValue : [];
        const nextTitle = getBestPageTitle(
            nextHighlights.map(item => item && item.pageTitle),
            currentPageData.title || currentPageData.url
        );

        currentPageData = {
            ...currentPageData,
            title: nextTitle,
            highlights: nextHighlights
        };

        if (activeTab === 'current') {
            renderCurrentView();
        } else {
            updateTabMeta();
        }

        return true;
    }

    // Render based on active tab
    function renderCurrentView() {
        syncSelectionModeUI();
        updateOnboardingCard();
        updateUpdateNoticeCard();
        renderCurrentPage();
    }

    // Render current page highlights
    function renderCurrentPage() {
        currentPageInfo.innerHTML = '';
        currentHighlights.innerHTML = '';
        currentPageInfo.classList.remove('page-info-hidden', 'compact');

        if (!currentPageData) {
            updateTabMeta();
            if (currentPageAccessState === 'restricted') {
                if (currentPageFallbackTitle) {
                    const titleEl = document.createElement('div');
                    titleEl.className = 'page-title';
                    titleEl.textContent = currentPageFallbackTitle;
                    currentPageInfo.appendChild(titleEl);
                    currentPageInfo.classList.add('compact');
                } else {
                    currentPageInfo.classList.add('page-info-hidden');
                }

                showEmptyState(
                    currentHighlights,
                    t('unsupportedPageTitle', null, '当前页面暂不支持划线'),
                    t('unsupportedPageDescription', null, '当前页面运行在受限容器中。请在标准浏览器标签页中打开原链接后使用。'),
                    '🧩'
                );
            } else {
                currentPageInfo.classList.add('page-info-hidden');
                showEmptyState(currentHighlights, t('unableToGetPage', null, '无法获取当前页面信息'));
            }
            return;
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'page-title';
        titleEl.textContent = currentPageData.title;
        currentPageInfo.appendChild(titleEl);

        // Update highlight section summary for collapsed state
        highlightSectionSummary.textContent = t('highlightCountShort', countParams(currentPageData.highlights.length, 'highlight'), `${currentPageData.highlights.length} 条`);
        updateTabMeta();

        if (!isSelectionMode) {
            currentPageInfo.appendChild(createPageActions(currentPageData, 'card'));
        }

        if (!currentPageData.highlights || currentPageData.highlights.length === 0) {
            showEmptyState(currentHighlights, t('currentPageNoHighlights', null, '当前页面暂无高亮'));
            return;
        }

        // Render highlights
        getSortedCurrentHighlights().forEach(h => {
            const item = createHighlightItem(h, currentPageData);
            currentHighlights.appendChild(item);
        });
    }

    function getSortedCurrentHighlights() {
        if (!currentPageData || !Array.isArray(currentPageData.highlights)) {
            return [];
        }

        return currentPageData.highlights
            .map((highlight, index) => ({
                highlight,
                index,
                sortValue: getHighlightSortValue(highlight, index)
            }))
            .sort((a, b) => {
                if (a.sortValue === b.sortValue) {
                    return currentHighlightSortOrder === 'desc'
                        ? b.index - a.index
                        : a.index - b.index;
                }

                return currentHighlightSortOrder === 'desc'
                    ? b.sortValue - a.sortValue
                    : a.sortValue - b.sortValue;
            })
            .map(item => item.highlight);
    }

    function getHighlightSortValue(highlight, fallbackIndex) {
        if (highlight && typeof highlight.timestamp === 'number') {
            return highlight.timestamp;
        }
        if (highlight && typeof highlight.createdAt === 'number') {
            return highlight.createdAt;
        }
        if (highlight && typeof highlight.updatedAt === 'number') {
            return highlight.updatedAt;
        }
        return fallbackIndex;
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
        if (h.type === 'underline') {
            dot.classList.add('is-underline');
        } else {
            dot.style.backgroundColor = colorMap[h.color] || '#ddd';
        }
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
            copyBtn.title = t('copy', null, '复制');
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
            annotateBtn.title = t('annotate', null, '批注');
            annotateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const note = prompt(t('addAnnotationPrompt', null, '添加批注:'), h.annotation || '');
                if (note !== null) {
                    updateHighlightAnnotation(page.key, h.id, note);
                }
            });
            actions.appendChild(annotateBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn';
            // Line-style delete/trash icon matching the toolbar
            deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            deleteBtn.title = t('delete', null, '删除');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHighlight(page.key, h.id);
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
                    chrome.tabs.sendMessage(tab.id, { command: 'scrollToHighlight', id: h.id }, { frameId: 0 });
                } else {
                    chrome.tabs.create({ url: page.url }, (newTab) => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(newTab.id, { command: 'scrollToHighlight', id: h.id }, { frameId: 0 });
                        }, 2000);
                    });
                }
            });
        }

        return item;
    }

    function createPageTagEditor(page) {
        const wrap = document.createElement('div');
        wrap.className = 'page-tags page-tags-inline';

        normalizeTags(page && page.tags).forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'page-tag-chip';

            const label = document.createElement('span');
            label.textContent = tag;
            chip.appendChild(label);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'page-tag-remove';
            removeBtn.textContent = '×';
            removeBtn.title = t('removeTag', { tag }, `移除标签：${tag}`);
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const nextTags = normalizeTags(page.tags || []).filter(item => item.toLowerCase() !== tag.toLowerCase());
                savePageTags(page, nextTags).catch(err => console.warn('[SidePanel] Failed to remove page tag:', err));
            });

            chip.appendChild(removeBtn);
            wrap.appendChild(chip);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'page-tag-add';
        addBtn.textContent = t('addTag', null, '+ 标签');
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = prompt(t('addTagPrompt', null, '输入标签，多个标签可用逗号分隔：'));
            if (input === null) return;
            const nextTags = normalizeTags([...(page.tags || []), ...normalizeTags(input)]);
            if (nextTags.length === normalizeTags(page.tags || []).length) return;
            savePageTags(page, nextTags).catch(err => console.warn('[SidePanel] Failed to add page tag:', err));
        });
        wrap.appendChild(addBtn);

        return wrap;
    }

    function createPageActions(page, variant = 'card') {
        const actions = document.createElement('div');
        actions.className = variant === 'group' ? 'page-group-actions' : 'page-card-actions';
        const exportPage = getCurrentPageExportSource(page);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'page-meta-btn';
        copyBtn.textContent = t('copyPage', null, '复制本页');
        copyBtn.disabled = page.highlights.length === 0;
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await copyPageHighlights(page, copyBtn);
        });
        actions.appendChild(copyBtn);

        const exportMenu = document.createElement('div');
        exportMenu.className = 'page-export-menu';

        const exportTrigger = document.createElement('button');
        exportTrigger.type = 'button';
        exportTrigger.className = 'page-meta-btn page-export-trigger';
        exportTrigger.disabled = !exportPage || (exportPage.highlights.length === 0 && !(exportPage.note && exportPage.note.content));
        exportTrigger.innerHTML = `
            <span class="page-export-trigger-label">${escapeHtml(t('exportPage', null, '导出本页'))}</span>
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
            { value: 'mowen', label: t('mowen', null, '墨问') },
            { value: 'notion', label: 'Notion' },
            { value: 'obsidian', label: 'Obsidian' },
            { value: 'siyuan', label: t('siyuan', null, '思源笔记') },
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' }
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
        actions.appendChild(createPageTagEditor(page));

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

    async function getNotionSettings() {
        if (window.HighlightNotionExporter && typeof window.HighlightNotionExporter.getSettings === 'function') {
            return window.HighlightNotionExporter.getSettings();
        }

        const result = await chrome.storage.local.get([
            'notion_token',
            'notion_parent_page_id',
            'notion_last_tested_at',
            'notion_last_tested_signature'
        ]);

        return {
            token: String(result.notion_token || '').trim(),
            parentPageId: String(result.notion_parent_page_id || '').trim(),
            lastTestedAt: Number(result.notion_last_tested_at || 0),
            lastTestedSignature: String(result.notion_last_tested_signature || '').trim()
        };
    }

    function isCurrentNotionTest(settings) {
        if (!settings || !settings.token || !settings.parentPageId || !settings.lastTestedAt) {
            return false;
        }

        if (window.HighlightNotionExporter && typeof window.HighlightNotionExporter.buildSettingsSignature === 'function') {
            return String(settings.lastTestedSignature || '') === window.HighlightNotionExporter.buildSettingsSignature(settings);
        }

        return String(settings.lastTestedSignature || '') === `${settings.token}::${settings.parentPageId}`;
    }

    async function getObsidianSettings() {
        if (window.HighlightObsidianExporter && typeof window.HighlightObsidianExporter.getSettings === 'function') {
            return window.HighlightObsidianExporter.getSettings();
        }

        const result = await chrome.storage.local.get(['obsidian_vault', 'obsidian_folder']);
        return {
            vault: String(result.obsidian_vault || '').trim(),
            folder: String(result.obsidian_folder || '').trim()
        };
    }

    async function getSiyuanSettings() {
        if (window.HighlightSiyuanExporter && typeof window.HighlightSiyuanExporter.getSettings === 'function') {
            return window.HighlightSiyuanExporter.getSettings();
        }

        const result = await chrome.storage.local.get([
            'siyuan_endpoint',
            'siyuan_token',
            'siyuan_notebook_id',
            'siyuan_notebook_name',
            'siyuan_folder'
        ]);
        return {
            endpoint: String(result.siyuan_endpoint || '').trim(),
            token: String(result.siyuan_token || '').trim(),
            notebookId: String(result.siyuan_notebook_id || '').trim(),
            notebookName: String(result.siyuan_notebook_name || '').trim(),
            folder: String(result.siyuan_folder || '').trim()
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

    function getCurrentPageExportSource(page) {
        if (!page) return null;

        const exportPage = {
            ...page,
            highlights: Array.isArray(page.highlights) ? page.highlights : [],
            note: page.note || null
        };

        if (currentNoteUrl && page.url === currentNoteUrl && currentNoteRecord && currentNoteRecord.content) {
            exportPage.note = currentNoteRecord;
        }

        return exportPage;
    }

    async function exportCurrentPage(page, format, triggerControl) {
        const exportPage = getCurrentPageExportSource(page);
        if (!exportPage || (exportPage.highlights.length === 0 && !(exportPage.note && exportPage.note.content))) {
            alert(t('noExportContent', null, '当前页面没有可导出的内容'));
            return;
        }

        if (!window.HighlightExport || typeof window.HighlightExport.buildExportBundle !== 'function') {
            alert(t('exportUnavailable', null, '导出功能暂不可用'));
            return;
        }

        const bundle = window.HighlightExport.buildExportBundle([exportPage], { source: 'sidepanel' });
        const targetFormat = format || 'markdown';
        let ok = false;

        if (targetFormat === 'mowen') {
            if (!window.HighlightMowenExporter || typeof window.HighlightMowenExporter.exportBundleToMowen !== 'function') {
                alert(t('mowenUnavailable', null, '墨问导出当前不可用'));
                return;
            }

            const settings = await getMowenSettings();
            if (!settings.apiKey) {
                alert(t('mowenConfigRequired', null, '请先在管理页配置墨问 API Key。'));
                return;
            }

            if (settings.lastTestedKey !== settings.apiKey) {
                alert(t('mowenTestRequired', null, '请先在管理页完成一次墨问测试导出，再执行当前页导出。'));
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
                    alert((result && result.message) || t('mowenExportFailed', null, '导出到墨问失败，请检查 API Key、配额或网络状态。'));
                    return;
                }
                alert(t('mowenExported', { noteId: result.noteId ? `（${result.noteId}）` : '' }, `已生成墨问笔记${result.noteId ? `（${result.noteId}）` : ''}。`));
                ok = true;
            } catch (err) {
                console.error('[SidePanel] Export to Mowen failed:', err);
                alert(t('mowenExportFailed', null, '导出到墨问失败，请检查网络、配额或 API Key。'));
                return;
            } finally {
                if (triggerControl) {
                    triggerControl.disabled = false;
                }
            }
        } else if (targetFormat === 'notion') {
            if (!window.HighlightNotionExporter || typeof window.HighlightNotionExporter.exportBundleToNotion !== 'function') {
                alert(t('notionUnavailable', null, 'Notion 导出当前不可用'));
                return;
            }

            const settings = await getNotionSettings();
            if (!settings.token || !settings.parentPageId) {
                alert(t('notionConfigRequired', null, '请先在管理页配置 Notion API 集成密钥和目标父页面。'));
                return;
            }
            if (!isCurrentNotionTest(settings)) {
                alert(t('notionTestRequired', null, '请先在管理页完成一次 Notion 测试导出，再执行当前页导出。'));
                return;
            }

            if (triggerControl) {
                triggerControl.disabled = true;
            }

            try {
                const result = await window.HighlightNotionExporter.exportBundleToNotion(bundle, { settings });
                if (!result || !result.ok) {
                    alert((result && result.message) || t('notionExportFailed', null, '导出到 Notion 失败，请检查 Token、页面权限或网络状态。'));
                    return;
                }
                alert(t('notionExported', { url: result.url ? `：${result.url}` : '' }, result.url ? `已创建 Notion 页面：${result.url}` : '已创建 Notion 页面。'));
                ok = true;
            } catch (err) {
                console.error('[SidePanel] Export to Notion failed:', err);
                alert(t('notionExportFailed', null, '导出到 Notion 失败，请检查 Token、页面权限或网络状态。'));
                return;
            } finally {
                if (triggerControl) {
                    triggerControl.disabled = false;
                }
            }
        } else if (targetFormat === 'obsidian') {
            if (!window.HighlightObsidianExporter || typeof window.HighlightObsidianExporter.exportBundleToObsidian !== 'function') {
                alert(t('obsidianUnavailable', null, 'Obsidian 导出当前不可用'));
                return;
            }

            const settings = await getObsidianSettings();
            if (!settings.vault) {
                alert(t('obsidianConfigRequired', null, '请先在管理页配置 Obsidian Vault。'));
                return;
            }

            const result = await window.HighlightObsidianExporter.exportBundleToObsidian(bundle, { settings });
            if (!result.ok) {
                alert(result.message || t('obsidianExportFailed', null, '发送到 Obsidian 失败，请检查配置或剪贴板权限。'));
                return;
            }

            ok = true;
        } else if (targetFormat === 'siyuan') {
            if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.exportBundleToSiyuan !== 'function') {
                alert(t('siyuanUnavailable', null, '思源导出当前不可用'));
                return;
            }

            const settings = await getSiyuanSettings();
            if (!settings.token) {
                alert(t('siyuanTokenRequired', null, '请先在管理页配置思源 API Token。'));
                return;
            }
            if (!settings.notebookId) {
                alert(t('siyuanNotebookRequired', null, '请先在管理页选择思源目标笔记本。'));
                return;
            }

            const result = await window.HighlightSiyuanExporter.exportBundleToSiyuan(bundle, { settings });
            if (!result.ok) {
                alert(result.message || t('siyuanExportFailed', null, '发送到思源失败，请检查配置或思源运行状态。'));
                return;
            }

            alert(t('siyuanExportSucceeded', { path: result.docPath || '' }, `导出成功，已创建文档：${result.docPath}`));
            ok = true;
        } else {
            ok = targetFormat === 'html'
                ? window.HighlightExport.downloadBundleAsHtml(bundle, 'catlines')
                : window.HighlightExport.downloadBundleAsMarkdown(bundle, 'catlines');
        }

        if (!ok) {
            alert(t('noExportContent', null, '当前页面没有可导出的内容'));
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
            chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }).catch(() => { })
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
        const text = formatPageForClipboard(page);

        if (!text) {
            alert(t('noCopyContent', null, '当前页面没有可复制的内容'));
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            if (triggerBtn) {
                const originalText = triggerBtn.textContent;
                triggerBtn.textContent = t('copied', null, '已复制');
                setTimeout(() => {
                    triggerBtn.textContent = originalText;
                }, 1200);
            }
        } catch (err) {
            console.warn('Copy failed:', err);
            alert(t('copyFailed', null, '复制失败'));
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
            chrome.tabs.sendMessage(tab.id, { command: 'updateAnnotation', id, note }, { frameId: 0 }).catch(() => { });
        }

        // Reload data
        loadAllData();
    }

    // Show empty state
    function showEmptyState(container, message, description = '', icon = '📭') {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${escapeHtml(icon)}</div>
        <div class="empty-text">${escapeHtml(message)}</div>
        ${description ? `<div class="empty-description">${escapeHtml(description)}</div>` : ''}
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
            noteSummary.textContent = t('noNotes', null, '暂无笔记');
            noteWordCount.textContent = formatCount(0, 'word');
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
        noteSummary.textContent = t('noNotes', null, '暂无笔记');
        noteWordCount.textContent = formatCount(0, 'word');
        noteUpdateTime.textContent = '';
        setSaveStatusUI('idle');
        updateTabMeta();
    }

    /** Update the note status text inside the page info card. */
    function updatePageInfoNoteStatus() {
        updateTabMeta();
    }

    /** Update the collapsed summary text. */
    function updateNoteSummary() {
        if (currentNoteRecord && currentNoteRecord.content) {
            const wc = currentNoteRecord.wordCount || window.PageNotes.countWords(currentNoteRecord.content);
            noteSummary.textContent = t('noteRecorded', countParams(wc, 'word'), `已记录 ${wc} 字`);
        } else {
            noteSummary.textContent = t('noNotes', null, '暂无笔记');
        }
        updateTabMeta();
    }

    /** Update the word count display. */
    function updateNoteWordCount() {
        const content = noteTextarea.value;
        const wc = window.PageNotes.countWords(content);
        noteWordCount.textContent = formatCount(wc, 'word');
    }

    /** Update the last-updated time display. */
    function updateNoteUpdateTime() {
        if (!currentNoteRecord || !currentNoteRecord.updatedAt) {
            noteUpdateTime.textContent = '';
            return;
        }
        const diff = Date.now() - currentNoteRecord.updatedAt;
        if (diff < 60000) {
            noteUpdateTime.textContent = t('lastUpdatedNow', null, '最后更新：刚刚');
        } else if (diff < 3600000) {
            const count = Math.floor(diff / 60000);
            noteUpdateTime.textContent = t('lastUpdatedMinutes', countParams(count, 'minute'), `最后更新：${count} 分钟前`);
        } else if (diff < 86400000) {
            const count = Math.floor(diff / 3600000);
            noteUpdateTime.textContent = t('lastUpdatedHours', countParams(count, 'hour'), `最后更新：${count} 小时前`);
        } else {
            const d = new Date(currentNoteRecord.updatedAt);
            noteUpdateTime.textContent = t(
                'lastUpdatedDate',
                { date: `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` },
                `最后更新：${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
            );
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
                noteSaveStatus.textContent = t('saving', null, '保存中...');
                noteSaveStatus.classList.add('saving');
                break;
            case 'saved':
                noteSaveStatus.textContent = t('saved', null, '已保存');
                noteSaveStatus.classList.add('saved');
                break;
            case 'error':
                noteSaveStatus.textContent = t('saveFailed', null, '保存失败');
                noteSaveStatus.classList.add('error');
                // Insert retry link after the status text
                const retryLink = document.createElement('button');
                retryLink.className = 'note-retry-link';
                retryLink.textContent = t('retrySave', null, '重试保存');
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
        selectCount.textContent = t('selectedCount', countParams(count, 'highlight'), `已选 ${count} 条（勾选前框可全选）`);

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

        syncSelectionModeUI();
        updateSelectCount();
        renderCurrentView();
    }

    // Exit selection mode
    function exitSelectionMode(skipRender = false) {
        isSelectionMode = false;
        selectedIds.clear();
        selectionMap.clear();

        syncSelectionModeUI();

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
            alert(t('chooseHighlightsToDelete', null, '请先选择要删除的高亮'));
            return;
        }

        if (!confirm(t('deleteSelectedConfirm', countParams(selectedIds.size, 'highlight'), `确定删除选中的 ${selectedIds.size} 条高亮吗？`))) {
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
            alert(t('chooseHighlightsToCopy', null, '请先选择要复制的高亮'));
            return;
        }

        // Collect texts in display order
        const texts = [];

        if (currentPageData) {
            getSortedCurrentHighlights().forEach(h => {
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
            batchCopyBtn.textContent = t('copiedWithIcon', null, '✅ 已复制!');
            setTimeout(() => {
                batchCopyBtn.textContent = originalText;
            }, 1500);
        }).catch(err => {
            console.error('Copy failed:', err);
            alert(t('copyFailed', null, '复制失败'));
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

    highlightSortSelect.addEventListener('change', () => {
        currentHighlightSortOrder = highlightSortSelect.value === 'desc' ? 'desc' : 'asc';
        if (activeTab === 'current') {
            renderCurrentView();
        }
    });

    // Listen for storage changes to update in real-time
    // Use debounce to ensure data is fully written before reloading
    let storageUpdateTimeout = null;
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            const changedKeys = Object.keys(changes);
            const i18nStorageKey = window.CatI18n && window.CatI18n.STORAGE_KEY;
            const updateNoticeKey = window.CatReleaseNotes && window.CatReleaseNotes.UPDATE_NOTICE_KEY;
            const updateSeenPrefix = window.CatReleaseNotes && window.CatReleaseNotes.UPDATE_SEEN_PREFIX;
            const hasLanguageChange = Boolean(i18nStorageKey && changedKeys.includes(i18nStorageKey));
            const hasOnboardingChanges = changedKeys.includes(ONBOARDING_DISMISSED_KEY);
            const hasUpdateNoticeChanges = changedKeys.some(k =>
                (updateNoticeKey && k === updateNoticeKey) ||
                (updateSeenPrefix && k.startsWith(updateSeenPrefix))
            );
            const hasHighlightChanges = changedKeys.some(k =>
                !k.startsWith('page_notes_') &&
                k !== ONBOARDING_DISMISSED_KEY &&
                k !== i18nStorageKey &&
                k !== updateNoticeKey &&
                !(updateSeenPrefix && k.startsWith(updateSeenPrefix))
            );
            const hasNoteChanges = changedKeys.some(k => k.startsWith('page_notes_'));

            if (hasLanguageChange) {
                const nextPreference = changes[i18nStorageKey].newValue || 'auto';
                if (window.CatI18n && typeof window.CatI18n.applyLanguagePreference === 'function') {
                    window.CatI18n.applyLanguagePreference(nextPreference);
                } else {
                    applyLocalizedChrome();
                }
            }

            if (hasOnboardingChanges) {
                onboardingDismissed = Boolean(changes[ONBOARDING_DISMISSED_KEY].newValue);
                updateOnboardingCard();
            }

            if (hasUpdateNoticeChanges) {
                loadUpdateNoticeState();
            }

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

            if (!hasHighlightChanges) {
                return;
            }

            if (hasHighlightChanges && currentPageData && changes[currentPageData.key]) {
                applyCurrentPageHighlightChange(changes[currentPageData.key]);
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

    chrome.runtime.onMessage.addListener((message, sender) => {
        if (!message || message.command !== 'pageHighlightsChanged') {
            return;
        }

        const senderTabId = sender && sender.tab && sender.tab.id;
        const senderTabUrl = sender && sender.tab && sender.tab.url;

        if (message.pageUrl && senderTabUrl && !isSamePageUrl(message.pageUrl, senderTabUrl)) {
            return;
        }

        if (!currentPageData) {
            if (!currentPageTabId || (senderTabId && currentPageTabId === senderTabId)) {
                scheduleLoadAllData(50);
            }
            return;
        }

        const matchesCurrentPage =
            (currentPageTabId && senderTabId && currentPageTabId === senderTabId) ||
            (message.storageKey && currentPageData.key === message.storageKey) ||
            (message.pageUrl && currentPageData.url === message.pageUrl);

        if (!matchesCurrentPage) {
            return;
        }

        const nextHighlights = Array.isArray(message.highlights) ? message.highlights : [];
        const nextUrl = message.pageUrl || currentPageData.url;
        const nextTitle = getBestPageTitle(
            [message.pageTitle].concat(nextHighlights.map(item => item && item.pageTitle)),
            currentPageData.title || currentPageData.url
        );
        const previousUrl = currentPageData.url;

        currentPageData = {
            ...currentPageData,
            tabId: senderTabId || currentPageData.tabId,
            key: message.storageKey || currentPageData.key,
            url: nextUrl,
            title: nextTitle,
            highlights: nextHighlights
        };

        if (nextUrl && nextUrl !== previousUrl) {
            currentActivePageUrl = nextUrl;
            currentPageAccessState = 'ready';
            loadCurrentPageNote(nextUrl, nextTitle).catch(() => { });
        }

        if (activeTab === 'current') {
            renderCurrentView();
        } else {
            updateTabMeta();
        }
    });

    // Listen for tab activation (user switches tabs)
    chrome.tabs.onActivated.addListener((activeInfo) => {
        preferredActiveTabId = activeInfo && activeInfo.tabId ? activeInfo.tabId : null;
        preferredWindowId = activeInfo && activeInfo.windowId ? activeInfo.windowId : null;
        console.log('[SidePanel] Tab activated, reloading data:', activeInfo);
        loadAllData();
    });

    // Listen for tab URL changes (navigation within same tab)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        const isRelevantTab =
            tab && tab.active &&
            (!currentPageTabId || currentPageTabId === tabId || preferredActiveTabId === tabId);
        const hasNavigationChange = Boolean(changeInfo.url || changeInfo.title || changeInfo.status === 'complete');

        if (isRelevantTab && hasNavigationChange) {
            preferredActiveTabId = tabId;
            preferredWindowId = tab && tab.windowId ? tab.windowId : preferredWindowId;
            console.log('[SidePanel] Tab updated, reloading data');
            scheduleLoadAllData(changeInfo.url ? 50 : 150);
        }
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
        if (!windowId || windowId === chrome.windows.WINDOW_ID_NONE) {
            return;
        }
        preferredWindowId = windowId;
        console.log('[SidePanel] Window focused, reloading data:', windowId);
        loadAllData();
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        if (preferredActiveTabId === tabId) {
            preferredActiveTabId = null;
        }
        if (currentPageTabId === tabId) {
            currentPageTabId = null;
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
    window.addEventListener('cat:i18n-ready', applyLocalizedChrome);
    if (window.CatI18n && window.CatI18n.ready && typeof window.CatI18n.ready.then === 'function') {
        window.CatI18n.ready.then(applyLocalizedChrome).catch(() => { });
    }
    syncTabChrome();
    updateBatchActionVisibility();
    loadOnboardingState();
    loadUpdateNoticeState();
    loadAllData();
});
