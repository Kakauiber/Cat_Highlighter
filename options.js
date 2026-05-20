// Management page script for the highlighter extension. Presents an
// aggregated view of all page data stored in chrome.storage.local.
// A page may contain highlights, a page note, or both. Supports
// searching, deleting highlights/notes, copying content, exporting
// Markdown, and preserving expanded state across renders.

document.addEventListener('DOMContentLoaded', () => {
  const HIGHLIGHT_PREFIX = 'page_highlights_';
  const NOTE_PREFIX = (window.PageNotes && window.PageNotes.NOTE_PREFIX) || 'page_notes_';
  const META_PREFIX = 'page_meta_';
  const TAG_FILTER_UNTAGGED = '__cat_highlighter_untagged__';

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
  const languageSelect = document.getElementById('language-select');
  const settingsPanel = document.getElementById('settings-panel');
  const keyboardShortcutsToggle = document.getElementById('keyboard-shortcuts-toggle');
  const keyboardShortcutsDesc = document.getElementById('keyboard-shortcuts-desc');
  const sortSelect = document.getElementById('sort-select');
  const tagFilterSelect = document.getElementById('tag-filter-select');
  const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
  const tagManagementList = document.getElementById('tag-management-list');
  const mowenPanel = document.getElementById('mowen-panel');
  const updateHistoryPanel = document.getElementById('update-history-panel');
  const updateHistoryList = document.getElementById('update-history-list');
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
  const notionTargetCard = document.getElementById('notion-target-card');
  const notionTargetDot = document.getElementById('notion-target-dot');
  const notionTargetStatus = document.getElementById('notion-target-status');
  const notionConfigEditBtn = document.getElementById('notion-config-edit-btn');
  const notionFormCard = document.getElementById('notion-form-card');
  const notionTokenInput = document.getElementById('notion-token');
  const notionParentPageInput = document.getElementById('notion-parent-page');
  const notionSaveBtn = document.getElementById('notion-save-btn');
  const notionTestBtn = document.getElementById('notion-test-btn');
  const notionStatus = document.getElementById('notion-status');
  const obsidianTargetCard = document.getElementById('obsidian-target-card');
  const obsidianTargetDot = document.getElementById('obsidian-target-dot');
  const obsidianTargetStatus = document.getElementById('obsidian-target-status');
  const obsidianConfigEditBtn = document.getElementById('obsidian-config-edit-btn');
  const obsidianFormCard = document.getElementById('obsidian-form-card');
  const obsidianVaultInput = document.getElementById('obsidian-vault');
  const obsidianFolderInput = document.getElementById('obsidian-folder');
  const obsidianSaveBtn = document.getElementById('obsidian-save-btn');
  const obsidianTestBtn = document.getElementById('obsidian-test-btn');
  const obsidianStatus = document.getElementById('obsidian-status');
  const siyuanTargetCard = document.getElementById('siyuan-target-card');
  const siyuanTargetDot = document.getElementById('siyuan-target-dot');
  const siyuanTargetStatus = document.getElementById('siyuan-target-status');
  const siyuanConfigEditBtn = document.getElementById('siyuan-config-edit-btn');
  const siyuanFormCard = document.getElementById('siyuan-form-card');
  const siyuanEndpointInput = document.getElementById('siyuan-endpoint');
  const siyuanTokenInput = document.getElementById('siyuan-token');
  const siyuanNotebookSelect = document.getElementById('siyuan-notebook');
  const siyuanRefreshBtn = document.getElementById('siyuan-refresh-btn');
  const siyuanFolderInput = document.getElementById('siyuan-folder');
  const siyuanSaveBtn = document.getElementById('siyuan-save-btn');
  const siyuanTestBtn = document.getElementById('siyuan-test-btn');
  const siyuanStatus = document.getElementById('siyuan-status');
  const overviewPages = document.getElementById('overview-pages');
  const overviewHighlights = document.getElementById('overview-highlights');
  const overviewNotes = document.getElementById('overview-notes');

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

  function countNoun(count, type, fallbackKey) {
    const label = formatCount(count, type).replace(/^\d+\s*/, '');
    return label || t(fallbackKey, null, '');
  }

  function formatExportDateStamp(timestamp) {
    const date = new Date(timestamp || Date.now());
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
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

  function tagsEqual(a, b) {
    const left = normalizeTags(a);
    const right = normalizeTags(b);
    return left.length === right.length && left.every((tag, index) => tag === right[index]);
  }

  function sortTags(tags) {
    return normalizeTags(tags).sort((a, b) => a.localeCompare(b));
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

    page.tags = normalized;
    page.meta = normalized.length > 0 ? {
      pageUrl: page.url,
      pageTitle: page.title || page.url,
      tags: normalized,
      updatedAt: Date.now()
    } : null;
  }

  function getTagPromptValue() {
    const input = prompt(t('addTagPrompt', null, '输入标签，多个标签可用逗号分隔：'));
    return input === null ? null : normalizeTags(input);
  }

  async function addTagsToPage(page) {
    const tags = getTagPromptValue();
    if (tags === null || tags.length === 0) return;
    const nextTags = normalizeTags([...(page.tags || []), ...tags]);
    if (tagsEqual(page.tags, nextTags)) return;
    await savePageTags(page, nextTags);
    loadData();
  }

  async function removeTagFromPage(page, tag) {
    const key = String(tag || '').toLowerCase();
    const nextTags = normalizeTags(page.tags || []).filter(item => item.toLowerCase() !== key);
    await savePageTags(page, nextTags);
    loadData();
  }

  function getFullExportNoteTitle(timestamp) {
    return `${t('fullExportTitle', null, '划线猫全部导出')}_${formatExportDateStamp(timestamp)}`;
  }

  function labelSeparator() {
    return window.CatI18n && typeof window.CatI18n.getLanguage === 'function' && window.CatI18n.getLanguage() === 'en'
      ? ': '
      : '：';
  }

  function isMacKeyboardPlatform() {
    const platform = String(
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ''
    );
    return /mac/i.test(platform);
  }

  function updateKeyboardShortcutsDescription() {
    if (!keyboardShortcutsDesc) return;
    const key = isMacKeyboardPlatform() ? 'keyboardShortcutsDescMac' : 'keyboardShortcutsDescDefault';
    keyboardShortcutsDesc.textContent = t(key, null, keyboardShortcutsDesc.textContent);
  }

  function applyLocalizedChrome() {
    if (window.CatI18n && typeof window.CatI18n.applyToDocument === 'function') {
      window.CatI18n.applyToDocument(document);
      window.CatI18n.updateDocumentTitle('optionsTitle');
    }
    updateKeyboardShortcutsDescription();
    if (languageSelect && window.CatI18n && typeof window.CatI18n.getPreference === 'function') {
      languageSelect.value = window.CatI18n.getPreference();
    }
    syncMowenPanelState();
    updateConfigSummaryMeta();
    updateMowenSummary(lastMowenSettings);
    updateNotionSummary(lastNotionSettings);
    updateObsidianSummary(lastObsidianSettings);
    updateSiyuanSummary(lastSiyuanSettings);
    updateSelectCount();
    renderOverviewStats();
    renderUpdateHistory();
    renderTagFilterOptions();
    renderTagManagement();
    renderList();
  }

  const MOWEN_API_KEY_KEY = 'mowen_api_key';
  const MOWEN_TAGS_KEY = 'mowen_default_tags';
  const MOWEN_TESTED_KEY = 'mowen_last_tested_key';
  const NOTION_TOKEN_KEY = (window.HighlightNotionExporter && window.HighlightNotionExporter.NOTION_TOKEN_KEY) || 'notion_token';
  const NOTION_PARENT_PAGE_ID_KEY = (window.HighlightNotionExporter && window.HighlightNotionExporter.NOTION_PARENT_PAGE_ID_KEY) || 'notion_parent_page_id';
  const NOTION_LAST_TESTED_AT_KEY = (window.HighlightNotionExporter && window.HighlightNotionExporter.NOTION_LAST_TESTED_AT_KEY) || 'notion_last_tested_at';
  const NOTION_LAST_TESTED_SIGNATURE_KEY = (window.HighlightNotionExporter && window.HighlightNotionExporter.NOTION_LAST_TESTED_SIGNATURE_KEY) || 'notion_last_tested_signature';
  const OBSIDIAN_VAULT_KEY = (window.HighlightObsidianExporter && window.HighlightObsidianExporter.OBSIDIAN_VAULT_KEY) || 'obsidian_vault';
  const OBSIDIAN_FOLDER_KEY = (window.HighlightObsidianExporter && window.HighlightObsidianExporter.OBSIDIAN_FOLDER_KEY) || 'obsidian_folder';
  const OBSIDIAN_LAST_TESTED_AT_KEY = (window.HighlightObsidianExporter && window.HighlightObsidianExporter.OBSIDIAN_LAST_TESTED_AT_KEY) || 'obsidian_last_tested_at';
  const OBSIDIAN_LAST_TESTED_SIGNATURE_KEY = (window.HighlightObsidianExporter && window.HighlightObsidianExporter.OBSIDIAN_LAST_TESTED_SIGNATURE_KEY) || 'obsidian_last_tested_signature';
  const SIYUAN_DEFAULT_ENDPOINT = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.DEFAULT_ENDPOINT) || 'http://127.0.0.1:6806';
  const SIYUAN_ENDPOINT_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_ENDPOINT_KEY) || 'siyuan_endpoint';
  const SIYUAN_TOKEN_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_TOKEN_KEY) || 'siyuan_token';
  const SIYUAN_NOTEBOOK_ID_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_NOTEBOOK_ID_KEY) || 'siyuan_notebook_id';
  const SIYUAN_NOTEBOOK_NAME_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_NOTEBOOK_NAME_KEY) || 'siyuan_notebook_name';
  const SIYUAN_FOLDER_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_FOLDER_KEY) || 'siyuan_folder';
  const SIYUAN_LAST_TESTED_AT_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_LAST_TESTED_AT_KEY) || 'siyuan_last_tested_at';
  const SIYUAN_LAST_TESTED_SIGNATURE_KEY = (window.HighlightSiyuanExporter && window.HighlightSiyuanExporter.SIYUAN_LAST_TESTED_SIGNATURE_KEY) || 'siyuan_last_tested_signature';
  const KEYBOARD_SHORTCUTS_ENABLED_KEY = 'keyboard_shortcuts_enabled';

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
  let activeTagFilter = '';
  let activeSort = 'updated-desc';
  let mowenIsBusy = false;
  let mowenFormExpanded = false;
  let notionIsBusy = false;
  let notionFormExpanded = false;
  let obsidianIsBusy = false;
  let obsidianFormExpanded = false;
  let siyuanIsBusy = false;
  let siyuanFormExpanded = false;
  let lastMowenSettings = { apiKey: '', tags: '', lastTestedKey: '' };
  let lastNotionSettings = { token: '', parentPageId: '', lastTestedAt: 0, lastTestedSignature: '' };
  let lastObsidianSettings = { vault: '', folder: '', lastTestedAt: 0, lastTestedSignature: '' };
  let lastSiyuanSettings = {
    endpoint: SIYUAN_DEFAULT_ENDPOINT,
    token: '',
    notebookId: '',
    notebookName: '',
    folder: '',
    lastTestedAt: 0,
    lastTestedSignature: ''
  };
  let siyuanNotebookOptions = [];

  function getMowenApiKey() {
    return String(mowenApiKeyInput && mowenApiKeyInput.value || '').trim();
  }

  function getMowenTagsInput() {
    return String(mowenTagsInput && mowenTagsInput.value || '').trim();
  }

  function getNotionTokenInput() {
    return String(notionTokenInput && notionTokenInput.value || '').trim();
  }

  function getNotionParentPageInput() {
    const raw = String(notionParentPageInput && notionParentPageInput.value || '').trim();
    if (window.HighlightNotionExporter && typeof window.HighlightNotionExporter.normalizeParentPageId === 'function') {
      return window.HighlightNotionExporter.normalizeParentPageId(raw);
    }
    return raw;
  }

  function getObsidianVaultInput() {
    return String(obsidianVaultInput && obsidianVaultInput.value || '').trim();
  }

  function getObsidianFolderInput() {
    return String(obsidianFolderInput && obsidianFolderInput.value || '').trim();
  }

  function getSiyuanEndpointInput() {
    const raw = String(siyuanEndpointInput && siyuanEndpointInput.value || '').trim();
    if (window.HighlightSiyuanExporter && typeof window.HighlightSiyuanExporter.normalizeEndpoint === 'function') {
      return window.HighlightSiyuanExporter.normalizeEndpoint(raw || SIYUAN_DEFAULT_ENDPOINT);
    }
    return raw || SIYUAN_DEFAULT_ENDPOINT;
  }

  function getSiyuanTokenInput() {
    return String(siyuanTokenInput && siyuanTokenInput.value || '').trim();
  }

  function getSiyuanNotebookIdInput() {
    return String(siyuanNotebookSelect && siyuanNotebookSelect.value || '').trim();
  }

  function getSiyuanNotebookNameInput() {
    const selected = siyuanNotebookSelect && siyuanNotebookSelect.selectedOptions && siyuanNotebookSelect.selectedOptions[0];
    if (!selected) return '';
    return String(selected.dataset.notebookName || selected.textContent || '').trim();
  }

  function getSiyuanFolderInput() {
    return String(siyuanFolderInput && siyuanFolderInput.value || '').trim();
  }

  function setKeyboardShortcutsToggle(enabled) {
    if (keyboardShortcutsToggle) {
      keyboardShortcutsToggle.checked = enabled !== false;
    }
  }

  async function loadKeyboardShortcutSettings() {
    const result = await chrome.storage.local.get([KEYBOARD_SHORTCUTS_ENABLED_KEY]);
    setKeyboardShortcutsToggle(result[KEYBOARD_SHORTCUTS_ENABLED_KEY] !== false);
  }

  async function saveKeyboardShortcutSettings() {
    if (!keyboardShortcutsToggle) return;
    await chrome.storage.local.set({
      [KEYBOARD_SHORTCUTS_ENABLED_KEY]: keyboardShortcutsToggle.checked !== false
    });
  }

  function getObsidianSettingsSignature(settings) {
    if (window.HighlightObsidianExporter && typeof window.HighlightObsidianExporter.buildSettingsSignature === 'function') {
      return window.HighlightObsidianExporter.buildSettingsSignature(settings || {});
    }

    const vault = String(settings && settings.vault || '').trim();
    const folder = String(settings && settings.folder || '').trim();
    return `${vault}::${folder}`;
  }

  function getNotionSettingsSignature(settings) {
    if (window.HighlightNotionExporter && typeof window.HighlightNotionExporter.buildSettingsSignature === 'function') {
      return window.HighlightNotionExporter.buildSettingsSignature(settings || {});
    }

    const token = String(settings && settings.token || '').trim();
    const parentPageId = String(settings && settings.parentPageId || '').trim();
    return `${token}::${parentPageId}`;
  }

  function getSiyuanSettingsSignature(settings) {
    if (window.HighlightSiyuanExporter && typeof window.HighlightSiyuanExporter.buildSettingsSignature === 'function') {
      return window.HighlightSiyuanExporter.buildSettingsSignature(settings || {});
    }

    const endpoint = String(settings && settings.endpoint || '').trim();
    const token = String(settings && settings.token || '').trim();
    const notebookId = String(settings && settings.notebookId || '').trim();
    const folder = String(settings && settings.folder || '').trim();
    return `${endpoint}::${token}::${notebookId}::${folder}`;
  }

  function isCurrentObsidianTest(settings) {
    if (!settings || !settings.vault || !settings.lastTestedAt) return false;
    return String(settings.lastTestedSignature || '') === getObsidianSettingsSignature(settings);
  }

  function isCurrentNotionTest(settings) {
    if (!settings || !settings.token || !settings.parentPageId || !settings.lastTestedAt) return false;
    return String(settings.lastTestedSignature || '') === getNotionSettingsSignature(settings);
  }

  function isCurrentSiyuanTest(settings) {
    if (!settings || !settings.token || !settings.notebookId || !settings.lastTestedAt) return false;
    return String(settings.lastTestedSignature || '') === getSiyuanSettingsSignature(settings);
  }

  function updateConfigSummaryMeta() {
    if (!mowenSummaryMeta) return;

    const hasMowenKey = !!String(lastMowenSettings.apiKey || '').trim();
    const mowenTested = hasMowenKey && String(lastMowenSettings.lastTestedKey || '') === String(lastMowenSettings.apiKey || '').trim();
    const hasNotionParent = !!String(lastNotionSettings.parentPageId || '').trim();
    const notionTested = isCurrentNotionTest(lastNotionSettings);
    const hasObsidianVault = !!String(lastObsidianSettings.vault || '').trim();
    const obsidianTested = isCurrentObsidianTest(lastObsidianSettings);
    const hasSiyuanNotebook = !!String(lastSiyuanSettings.notebookId || '').trim();
    const siyuanTested = isCurrentSiyuanTest(lastSiyuanSettings);

    const parts = [
      `${t('mowen', null, '墨问')}${labelSeparator()}${hasMowenKey ? (mowenTested ? t('configuredAndTested', null, '已配置并测试') : t('configured', null, '已配置')) : t('notConfigured', null, '未配置')}`,
      `Notion${labelSeparator()}${hasNotionParent ? (notionTested ? t('configuredAndTested', null, '已配置并测试') : t('configured', null, '已配置')) : t('notConfigured', null, '未配置')}`,
      `Obsidian${labelSeparator()}${hasObsidianVault ? (obsidianTested ? t('configuredAndTested', null, '已配置并测试') : t('configured', null, '已配置')) : t('notConfigured', null, '未配置')}`,
      `${t('siyuan', null, '思源')}${labelSeparator()}${hasSiyuanNotebook ? (siyuanTested ? t('configuredAndTested', null, '已配置并测试') : t('configured', null, '已配置')) : t('notConfigured', null, '未配置')}`
    ];

    mowenSummaryMeta.textContent = parts.join(' · ');
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
    closePageExportMenus();
    exportMenu.classList.add('open');
    if (exportMenuTrigger) {
      exportMenuTrigger.setAttribute('aria-expanded', 'true');
    }
  }

  function getExportTargetOptions() {
    return [
      { value: 'mowen', label: t('mowen', null, '墨问') },
      { value: 'notion', label: 'Notion' },
      { value: 'obsidian', label: 'Obsidian' },
      { value: 'siyuan', label: t('siyuan', null, '思源笔记') },
      { value: 'markdown', label: 'Markdown' },
      { value: 'html', label: 'HTML' }
    ];
  }

  function closePageExportMenus(exceptMenu) {
    document.querySelectorAll('.page-action-export-menu.open').forEach(menu => {
      if (menu === exceptMenu) return;
      menu.classList.remove('open');
      const pageCard = menu.closest('details');
      if (pageCard) {
        pageCard.classList.remove('export-menu-open');
      }
      const trigger = menu.querySelector('.page-action-export-trigger');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function setMowenFormVisible(visible) {
    if (!mowenFormCard) return;
    mowenFormExpanded = !!visible;
    mowenFormCard.classList.toggle('hidden', !visible);
    if (mowenConfigEditBtn) {
      const hasApiKey = !!String(lastMowenSettings && lastMowenSettings.apiKey || '').trim();
      mowenConfigEditBtn.textContent = visible
        ? t('collapseConfig', null, '收起配置')
        : (hasApiKey ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置'));
    }
  }

  function setNotionFormVisible(visible) {
    if (!notionFormCard) return;
    notionFormExpanded = !!visible;
    notionFormCard.classList.toggle('hidden', !visible);
    if (notionConfigEditBtn) {
      const hasParent = !!String(lastNotionSettings && lastNotionSettings.parentPageId || '').trim();
      notionConfigEditBtn.textContent = visible
        ? t('collapseConfig', null, '收起配置')
        : (hasParent ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置'));
    }
  }

  function setObsidianFormVisible(visible) {
    if (!obsidianFormCard) return;
    obsidianFormExpanded = !!visible;
    obsidianFormCard.classList.toggle('hidden', !visible);
    if (obsidianConfigEditBtn) {
      const hasVault = !!String(lastObsidianSettings && lastObsidianSettings.vault || '').trim();
      obsidianConfigEditBtn.textContent = visible
        ? t('collapseConfig', null, '收起配置')
        : (hasVault ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置'));
    }
  }

  function setSiyuanFormVisible(visible) {
    if (!siyuanFormCard) return;
    siyuanFormExpanded = !!visible;
    siyuanFormCard.classList.toggle('hidden', !visible);
    if (siyuanConfigEditBtn) {
      const hasNotebook = !!String(lastSiyuanSettings && lastSiyuanSettings.notebookId || '').trim();
      siyuanConfigEditBtn.textContent = visible
        ? t('collapseConfig', null, '收起配置')
        : (hasNotebook ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置'));
    }
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
      configSummaryToggleText.textContent = expanded ? t('collapse', null, '收起') : t('expand', null, '展开');
    }
  }

  function setSettingsPanelVisible(visible) {
    if (!settingsPanel) return;
    settingsPanel.classList.toggle('hidden', !visible);
    setMowenFormVisible(false);
    setNotionFormVisible(false);
    setObsidianFormVisible(false);
    setSiyuanFormVisible(false);
    if (visible && mowenPanel) {
      mowenPanel.open = false;
    }
    syncMowenPanelState();
    syncSettingsPanelState();
  }

  function renderUpdateHistory() {
    if (!updateHistoryList || !window.CatReleaseNotes) {
      return;
    }

    const language = window.CatI18n && typeof window.CatI18n.getLanguage === 'function'
      ? window.CatI18n.getLanguage()
      : 'zh_CN';
    const notes = window.CatReleaseNotes.getAllNotes(language);
    updateHistoryList.innerHTML = '';

    if (!notes.length) {
      const empty = document.createElement('div');
      empty.className = 'update-history-empty';
      empty.textContent = t('noUpdateHistory', null, '暂无更新记录');
      updateHistoryList.appendChild(empty);
      return;
    }

    notes.forEach((note, index) => {
      const item = document.createElement('details');
      item.className = 'update-history-item';
      item.open = index === 0;

      const summary = document.createElement('summary');
      summary.className = 'update-history-item-summary';

      const title = document.createElement('span');
      title.className = 'update-history-item-title';
      title.textContent = note.title || `v${note.version}`;
      summary.appendChild(title);

      const chevron = document.createElement('span');
      chevron.className = 'update-history-item-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      summary.appendChild(chevron);
      item.appendChild(summary);

      const list = document.createElement('ul');
      list.className = 'update-history-item-list';
      (note.items || []).forEach(text => {
        const listItem = document.createElement('li');
        listItem.textContent = text;
        list.appendChild(listItem);
      });
      item.appendChild(list);
      updateHistoryList.appendChild(item);
    });
  }

  function openUpdateHistoryFromHash() {
    if (window.location.hash !== '#updates' || !updateHistoryPanel) {
      return;
    }

    setSettingsPanelVisible(true);
    updateHistoryPanel.open = true;
    window.setTimeout(() => {
      updateHistoryPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);
  }

  function openMowenPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (!mowenPanel) return;
    mowenPanel.open = true;
    setNotionFormVisible(false);
    setObsidianFormVisible(false);
    setSiyuanFormVisible(false);
    closeExportMenu();
    syncMowenPanelState();
  }

  function openNotionPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (mowenPanel) {
      mowenPanel.open = true;
      syncMowenPanelState();
    }
    setMowenFormVisible(false);
    setNotionFormVisible(true);
    setObsidianFormVisible(false);
    setSiyuanFormVisible(false);
    closeExportMenu();
  }

  function openObsidianPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (mowenPanel) {
      mowenPanel.open = true;
      syncMowenPanelState();
    }
    setMowenFormVisible(false);
    setNotionFormVisible(false);
    setObsidianFormVisible(true);
    setSiyuanFormVisible(false);
    closeExportMenu();
  }

  function openSiyuanPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (mowenPanel) {
      mowenPanel.open = true;
      syncMowenPanelState();
    }
    setMowenFormVisible(false);
    setNotionFormVisible(false);
    setObsidianFormVisible(false);
    setSiyuanFormVisible(true);
    closeExportMenu();
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

  function setNotionStatus(message, tone) {
    if (!notionStatus) return;
    notionStatus.textContent = message || '';
    notionStatus.classList.remove('is-success', 'is-error');
    if (tone === 'success') {
      notionStatus.classList.add('is-success');
    } else if (tone === 'error') {
      notionStatus.classList.add('is-error');
    }
  }

  function setObsidianStatus(message, tone) {
    if (!obsidianStatus) return;
    obsidianStatus.textContent = message || '';
    obsidianStatus.classList.remove('is-success', 'is-error');
    if (tone === 'success') {
      obsidianStatus.classList.add('is-success');
    } else if (tone === 'error') {
      obsidianStatus.classList.add('is-error');
    }
  }

  function setSiyuanStatus(message, tone) {
    if (!siyuanStatus) return;
    siyuanStatus.textContent = message || '';
    siyuanStatus.classList.remove('is-success', 'is-error');
    if (tone === 'success') {
      siyuanStatus.classList.add('is-success');
    } else if (tone === 'error') {
      siyuanStatus.classList.add('is-error');
    }
  }

  function updateMowenSummary(settings) {
    lastMowenSettings = {
      apiKey: String(settings && settings.apiKey || '').trim(),
      tags: String(settings && settings.tags || '').trim(),
      lastTestedKey: String(settings && settings.lastTestedKey || '').trim()
    };

    const apiKey = String(settings && settings.apiKey || '').trim();
    const tags = String(settings && settings.tags || '').trim();
    const lastTestedKey = String(settings && settings.lastTestedKey || '').trim();
    const testedForCurrentKey = apiKey && lastTestedKey === apiKey;
    updateConfigSummaryMeta();

    if (mowenTargetStatus) {
      mowenTargetStatus.textContent = apiKey
        ? (testedForCurrentKey ? t('apiConfiguredTested', null, 'API 已配置 · 测试已通过') : t('apiConfiguredPendingTest', null, 'API 已配置 · 待测试'))
        : t('notConfigured', null, '未配置');
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
      mowenConfigEditBtn.textContent = apiKey ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置');
    }

    if (!apiKey) {
      setMowenFormVisible(true);
    } else if (!mowenFormExpanded) {
      setMowenFormVisible(false);
    }
  }

  function updateNotionSummary(settings) {
    lastNotionSettings = {
      token: String(settings && settings.token || '').trim(),
      parentPageId: String(settings && settings.parentPageId || '').trim(),
      lastTestedAt: Number(settings && settings.lastTestedAt || 0),
      lastTestedSignature: String(settings && settings.lastTestedSignature || '').trim()
    };

    const hasToken = !!lastNotionSettings.token;
    const hasParent = !!lastNotionSettings.parentPageId;
    const tested = isCurrentNotionTest(lastNotionSettings);
    updateConfigSummaryMeta();

    if (notionTargetStatus) {
      if (hasToken && hasParent) {
        notionTargetStatus.textContent = tested ? t('pageConfiguredTested', null, '页面已配置 · 已测试') : t('pageConfiguredPendingTest', null, '页面已配置 · 待测试');
      } else if (hasToken) {
        notionTargetStatus.textContent = t('tokenConfiguredNeedsPage', null, '密钥已配置 · 待填写页面');
      } else if (hasParent) {
        notionTargetStatus.textContent = t('pageConfiguredNeedsToken', null, '页面已配置 · 待填写密钥');
      } else {
        notionTargetStatus.textContent = t('notConfigured', null, '未配置');
      }
      notionTargetStatus.classList.toggle('export-target-status-success', hasToken && hasParent);
      notionTargetStatus.classList.toggle('export-target-status-muted', !(hasToken && hasParent));
    }

    if (notionTargetDot) {
      notionTargetDot.classList.toggle('export-status-dot-success', hasToken && hasParent);
      notionTargetDot.classList.toggle('export-status-dot-muted', !(hasToken && hasParent));
    }

    if (notionTargetCard) {
      notionTargetCard.classList.toggle('export-target-card-active', hasToken && hasParent);
    }

    if (notionConfigEditBtn) {
      notionConfigEditBtn.textContent = hasToken && hasParent ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置');
    }

    if (!hasToken || !hasParent) {
      setNotionFormVisible(true);
    } else if (!notionFormExpanded) {
      setNotionFormVisible(false);
    }
  }

  function updateObsidianSummary(settings) {
    lastObsidianSettings = {
      vault: String(settings && settings.vault || '').trim(),
      folder: String(settings && settings.folder || '').trim(),
      lastTestedAt: Number(settings && settings.lastTestedAt || 0),
      lastTestedSignature: String(settings && settings.lastTestedSignature || '').trim()
    };

    const hasVault = !!lastObsidianSettings.vault;
    const tested = isCurrentObsidianTest(lastObsidianSettings);
    updateConfigSummaryMeta();

    if (obsidianTargetStatus) {
      obsidianTargetStatus.textContent = hasVault
        ? (tested ? t('vaultConfiguredTested', null, '仓库已配置 · 已测试') : t('vaultConfigured', null, '仓库已配置'))
        : t('notConfigured', null, '未配置');
      obsidianTargetStatus.classList.toggle('export-target-status-success', hasVault);
      obsidianTargetStatus.classList.toggle('export-target-status-muted', !hasVault);
    }

    if (obsidianTargetDot) {
      obsidianTargetDot.classList.toggle('export-status-dot-success', hasVault);
      obsidianTargetDot.classList.toggle('export-status-dot-muted', !hasVault);
    }

    if (obsidianTargetCard) {
      obsidianTargetCard.classList.toggle('export-target-card-active', hasVault);
    }

    if (obsidianConfigEditBtn) {
      obsidianConfigEditBtn.textContent = hasVault ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置');
    }

    if (!hasVault) {
      setObsidianFormVisible(true);
    } else if (!obsidianFormExpanded) {
      setObsidianFormVisible(false);
    }
  }

  function setSiyuanNotebookOptions(notebooks, selectedId, selectedName) {
    if (!siyuanNotebookSelect) return;

    const preferredId = String(selectedId || '').trim();
    const preferredName = String(selectedName || '').trim();
    const items = Array.isArray(notebooks) ? notebooks : [];
    siyuanNotebookOptions = items;

    siyuanNotebookSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = items.length > 0
      ? t('chooseTargetNotebook', null, '请选择目标笔记本')
      : t('refreshNotebooksFirst', null, '请先刷新笔记本列表');
    siyuanNotebookSelect.appendChild(placeholder);

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.closed ? t('notebookClosed', { name: item.name }, `${item.name}（已关闭）`) : item.name;
      option.dataset.notebookName = item.name;
      siyuanNotebookSelect.appendChild(option);
    });

    if (preferredId && items.some(item => item.id === preferredId)) {
      siyuanNotebookSelect.value = preferredId;
      return;
    }

    if (preferredId && preferredName) {
      const fallback = document.createElement('option');
      fallback.value = preferredId;
      fallback.textContent = t('notebookSaved', { name: preferredName }, `${preferredName}（已保存）`);
      fallback.dataset.notebookName = preferredName;
      siyuanNotebookSelect.appendChild(fallback);
      siyuanNotebookSelect.value = preferredId;
      return;
    }

    const firstOpen = items.find(item => !item.closed) || items[0] || null;
    siyuanNotebookSelect.value = firstOpen ? firstOpen.id : '';
  }

  function updateSiyuanSummary(settings) {
    lastSiyuanSettings = {
      endpoint: String(settings && settings.endpoint || SIYUAN_DEFAULT_ENDPOINT).trim() || SIYUAN_DEFAULT_ENDPOINT,
      token: String(settings && settings.token || '').trim(),
      notebookId: String(settings && settings.notebookId || '').trim(),
      notebookName: String(settings && settings.notebookName || '').trim(),
      folder: String(settings && settings.folder || '').trim(),
      lastTestedAt: Number(settings && settings.lastTestedAt || 0),
      lastTestedSignature: String(settings && settings.lastTestedSignature || '').trim()
    };

    const hasToken = !!lastSiyuanSettings.token;
    const hasNotebook = !!lastSiyuanSettings.notebookId;
    const tested = isCurrentSiyuanTest(lastSiyuanSettings);
    updateConfigSummaryMeta();

    if (siyuanTargetStatus) {
      if (hasNotebook) {
        siyuanTargetStatus.textContent = tested ? t('notebookConfiguredTested', null, '笔记本已配置 · 已测试') : t('notebookConfiguredPendingTest', null, '笔记本已配置 · 待测试');
      } else if (hasToken) {
        siyuanTargetStatus.textContent = t('tokenConfiguredNeedsNotebook', null, 'Token 已配置 · 待选择笔记本');
      } else {
        siyuanTargetStatus.textContent = t('notConfigured', null, '未配置');
      }
      siyuanTargetStatus.classList.toggle('export-target-status-success', hasNotebook);
      siyuanTargetStatus.classList.toggle('export-target-status-muted', !hasNotebook);
    }

    if (siyuanTargetDot) {
      siyuanTargetDot.classList.toggle('export-status-dot-success', hasNotebook);
      siyuanTargetDot.classList.toggle('export-status-dot-muted', !hasNotebook);
    }

    if (siyuanTargetCard) {
      siyuanTargetCard.classList.toggle('export-target-card-active', hasNotebook);
    }

    if (siyuanConfigEditBtn) {
      siyuanConfigEditBtn.textContent = hasNotebook ? t('reconfigure', null, '重新配置') : t('configure', null, '请配置');
    }

    if (!hasToken || !hasNotebook) {
      setSiyuanFormVisible(true);
    } else if (!siyuanFormExpanded) {
      setSiyuanFormVisible(false);
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

  async function getNotionSettings() {
    if (window.HighlightNotionExporter && typeof window.HighlightNotionExporter.getSettings === 'function') {
      return window.HighlightNotionExporter.getSettings();
    }

    const result = await chrome.storage.local.get([
      NOTION_TOKEN_KEY,
      NOTION_PARENT_PAGE_ID_KEY,
      NOTION_LAST_TESTED_AT_KEY,
      NOTION_LAST_TESTED_SIGNATURE_KEY
    ]);

    return {
      token: String(result[NOTION_TOKEN_KEY] || '').trim(),
      parentPageId: String(result[NOTION_PARENT_PAGE_ID_KEY] || '').trim(),
      lastTestedAt: Number(result[NOTION_LAST_TESTED_AT_KEY] || 0),
      lastTestedSignature: String(result[NOTION_LAST_TESTED_SIGNATURE_KEY] || '').trim()
    };
  }

  async function getObsidianSettings() {
    if (window.HighlightObsidianExporter && typeof window.HighlightObsidianExporter.getSettings === 'function') {
      return window.HighlightObsidianExporter.getSettings();
    }

    const result = await chrome.storage.local.get([
      OBSIDIAN_VAULT_KEY,
      OBSIDIAN_FOLDER_KEY,
      OBSIDIAN_LAST_TESTED_AT_KEY,
      OBSIDIAN_LAST_TESTED_SIGNATURE_KEY
    ]);

    return {
      vault: String(result[OBSIDIAN_VAULT_KEY] || '').trim(),
      folder: String(result[OBSIDIAN_FOLDER_KEY] || '').trim(),
      lastTestedAt: Number(result[OBSIDIAN_LAST_TESTED_AT_KEY] || 0),
      lastTestedSignature: String(result[OBSIDIAN_LAST_TESTED_SIGNATURE_KEY] || '').trim()
    };
  }

  async function getSiyuanSettings() {
    if (window.HighlightSiyuanExporter && typeof window.HighlightSiyuanExporter.getSettings === 'function') {
      return window.HighlightSiyuanExporter.getSettings();
    }

    const result = await chrome.storage.local.get([
      SIYUAN_ENDPOINT_KEY,
      SIYUAN_TOKEN_KEY,
      SIYUAN_NOTEBOOK_ID_KEY,
      SIYUAN_NOTEBOOK_NAME_KEY,
      SIYUAN_FOLDER_KEY,
      SIYUAN_LAST_TESTED_AT_KEY,
      SIYUAN_LAST_TESTED_SIGNATURE_KEY
    ]);

    return {
      endpoint: String(result[SIYUAN_ENDPOINT_KEY] || SIYUAN_DEFAULT_ENDPOINT).trim() || SIYUAN_DEFAULT_ENDPOINT,
      token: String(result[SIYUAN_TOKEN_KEY] || '').trim(),
      notebookId: String(result[SIYUAN_NOTEBOOK_ID_KEY] || '').trim(),
      notebookName: String(result[SIYUAN_NOTEBOOK_NAME_KEY] || '').trim(),
      folder: String(result[SIYUAN_FOLDER_KEY] || '').trim(),
      lastTestedAt: Number(result[SIYUAN_LAST_TESTED_AT_KEY] || 0),
      lastTestedSignature: String(result[SIYUAN_LAST_TESTED_SIGNATURE_KEY] || '').trim()
    };
  }

  function syncMowenActionState(lastTestedKey) {
    const apiKey = getMowenApiKey();
    const hasKey = !!apiKey;

    if (mowenSaveBtn) {
      mowenSaveBtn.disabled = mowenIsBusy || !hasKey;
    }
    if (mowenTestBtn) {
      mowenTestBtn.disabled = mowenIsBusy || !hasKey;
    }
  }

  function syncNotionActionState() {
    const hasToken = !!getNotionTokenInput();
    const hasParent = !!getNotionParentPageInput();

    if (notionSaveBtn) {
      notionSaveBtn.disabled = notionIsBusy || !hasToken || !hasParent;
    }
    if (notionTestBtn) {
      notionTestBtn.disabled = notionIsBusy || !hasToken || !hasParent;
    }
  }

  function syncObsidianActionState() {
    const hasVault = !!getObsidianVaultInput();

    if (obsidianSaveBtn) {
      obsidianSaveBtn.disabled = obsidianIsBusy || !hasVault;
    }
    if (obsidianTestBtn) {
      obsidianTestBtn.disabled = obsidianIsBusy || !hasVault;
    }
  }

  function syncSiyuanActionState() {
    const hasToken = !!getSiyuanTokenInput();
    const hasNotebook = !!getSiyuanNotebookIdInput();

    if (siyuanSaveBtn) {
      siyuanSaveBtn.disabled = siyuanIsBusy || !hasToken || !hasNotebook;
    }
    if (siyuanTestBtn) {
      siyuanTestBtn.disabled = siyuanIsBusy || !hasToken || !hasNotebook;
    }
    if (siyuanRefreshBtn) {
      siyuanRefreshBtn.disabled = siyuanIsBusy || !hasToken;
    }
  }

  async function loadMowenSettings() {
    const settings = await getMowenSettings();
    if (mowenApiKeyInput) mowenApiKeyInput.value = settings.apiKey;
    if (mowenTagsInput) mowenTagsInput.value = settings.tags;
    updateMowenSummary(settings);
    syncMowenActionState(settings.lastTestedKey);
  }

  async function loadNotionSettings() {
    const settings = await getNotionSettings();
    if (notionTokenInput) notionTokenInput.value = settings.token;
    if (notionParentPageInput) notionParentPageInput.value = settings.parentPageId;
    updateNotionSummary(settings);
    syncNotionActionState();
  }

  async function loadObsidianSettings() {
    const settings = await getObsidianSettings();
    if (obsidianVaultInput) obsidianVaultInput.value = settings.vault;
    if (obsidianFolderInput) obsidianFolderInput.value = settings.folder;
    updateObsidianSummary(settings);
    syncObsidianActionState();
  }

  async function loadSiyuanSettings() {
    const settings = await getSiyuanSettings();
    if (siyuanEndpointInput) siyuanEndpointInput.value = settings.endpoint || SIYUAN_DEFAULT_ENDPOINT;
    if (siyuanTokenInput) siyuanTokenInput.value = settings.token;
    if (siyuanFolderInput) siyuanFolderInput.value = settings.folder;
    setSiyuanNotebookOptions([], settings.notebookId, settings.notebookName);
    updateSiyuanSummary(settings);
    syncSiyuanActionState();

    if (settings.token) {
      await refreshSiyuanNotebookList({
        silent: true,
        preferredNotebookId: settings.notebookId,
        preferredNotebookName: settings.notebookName
      });
    }
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
    setMowenStatus(t('settingsSavedRetestMowen', null, '设置已保存。若 API Key 有变化，请先重新测试导出。'), 'success');
    if (apiKey) {
      setMowenFormVisible(false);
    }
  }

  async function saveObsidianSettings() {
    const vault = getObsidianVaultInput();
    const folder = getObsidianFolderInput();
    const nextSettings = window.HighlightObsidianExporter && typeof window.HighlightObsidianExporter.saveSettings === 'function'
      ? await window.HighlightObsidianExporter.saveSettings({ vault, folder })
      : await (async () => {
        await chrome.storage.local.set({
          [OBSIDIAN_VAULT_KEY]: vault,
          [OBSIDIAN_FOLDER_KEY]: folder
        });
        return getObsidianSettings();
      })();

    updateObsidianSummary(nextSettings);
    syncObsidianActionState();
    setObsidianStatus(t('settingsSavedTestObsidian', null, '设置已保存。建议先点“测试”，确认可以正常写入 Obsidian。'), 'success');
    if (vault) {
      setObsidianFormVisible(false);
    }
  }

  async function saveNotionSettings(options) {
    const token = getNotionTokenInput();
    const parentPageId = getNotionParentPageInput();

    if (!token) {
      if (!(options && options.silent)) {
        setNotionStatus(t('fillNotionToken', null, '请先填写 Notion API 集成密钥（Integration Token）。'), 'error');
      }
      return null;
    }

    if (!parentPageId) {
      if (!(options && options.silent)) {
        setNotionStatus(t('fillNotionParent', null, '请粘贴有效的 Notion 目标父页面链接，或填写页面 ID（Page ID）。'), 'error');
      }
      return null;
    }

    const nextSettings = window.HighlightNotionExporter && typeof window.HighlightNotionExporter.saveSettings === 'function'
      ? await window.HighlightNotionExporter.saveSettings({ token, parentPageId })
      : await (async () => {
        await chrome.storage.local.set({
          [NOTION_TOKEN_KEY]: token,
          [NOTION_PARENT_PAGE_ID_KEY]: parentPageId
        });
        return getNotionSettings();
      })();

    updateNotionSummary(nextSettings);
    syncNotionActionState();
    if (!(options && options.suppressSuccess)) {
      setNotionStatus(t('settingsSavedTestNotion', null, '设置已保存。建议先点“测试”，确认可以正常写入 Notion。'), 'success');
    }
    if (!(options && options.keepOpen) && token && parentPageId) {
      setNotionFormVisible(false);
    }
    return nextSettings;
  }

  async function saveSiyuanSettings(options) {
    const endpoint = getSiyuanEndpointInput();
    const token = getSiyuanTokenInput();
    const notebookId = getSiyuanNotebookIdInput();
    const notebookName = getSiyuanNotebookNameInput();
    const folder = getSiyuanFolderInput();

    if (!token) {
      if (!(options && options.silent)) {
        setSiyuanStatus(t('fillSiyuanToken', null, '请先填写思源 API Token。'), 'error');
      }
      return null;
    }

    if (!notebookId) {
      if (!(options && options.silent)) {
        setSiyuanStatus(t('refreshAndChooseSiyuanNotebook', null, '请先刷新并选择目标笔记本。'), 'error');
      }
      return null;
    }

    const nextSettings = window.HighlightSiyuanExporter && typeof window.HighlightSiyuanExporter.saveSettings === 'function'
      ? await window.HighlightSiyuanExporter.saveSettings({ endpoint, token, notebookId, notebookName, folder })
      : await (async () => {
        await chrome.storage.local.set({
          [SIYUAN_ENDPOINT_KEY]: endpoint,
          [SIYUAN_TOKEN_KEY]: token,
          [SIYUAN_NOTEBOOK_ID_KEY]: notebookId,
          [SIYUAN_NOTEBOOK_NAME_KEY]: notebookName,
          [SIYUAN_FOLDER_KEY]: folder
        });
        return getSiyuanSettings();
      })();

    updateSiyuanSummary(nextSettings);
    syncSiyuanActionState();
    if (!(options && options.silent) && !(options && options.suppressSuccess)) {
      setSiyuanStatus(t('settingsSavedTestSiyuan', null, '设置已保存。建议先点“测试”，确认可以正常写入思源。'), 'success');
    }
    if (!(options && options.keepOpen) && notebookId) {
      setSiyuanFormVisible(false);
    }
    return nextSettings;
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

  async function withObsidianBusy(task) {
    if (obsidianIsBusy) return;
    obsidianIsBusy = true;
    syncObsidianActionState();
    try {
      await task();
    } finally {
      obsidianIsBusy = false;
      const latest = await getObsidianSettings();
      updateObsidianSummary(latest);
      syncObsidianActionState();
    }
  }

  async function withNotionBusy(task) {
    if (notionIsBusy) return;
    notionIsBusy = true;
    syncNotionActionState();
    try {
      await task();
    } finally {
      notionIsBusy = false;
      const latest = await getNotionSettings();
      updateNotionSummary(latest);
      syncNotionActionState();
    }
  }

  async function withSiyuanBusy(task, options) {
    if (siyuanIsBusy) return;
    siyuanIsBusy = true;
    syncSiyuanActionState();
    try {
      await task();
    } finally {
      siyuanIsBusy = false;
      const latest = await getSiyuanSettings();
      if (options && typeof options.after === 'function') {
        await options.after(latest);
      } else {
        updateSiyuanSummary(latest);
        syncSiyuanActionState();
      }
    }
  }

  async function testMowenExport() {
    const apiKey = getMowenApiKey();
    const tags = getMowenTagsInput();
    if (!apiKey) {
      setMowenStatus(t('fillMowenApiKey', null, '请先填写墨问 API Key。'), 'error');
      return;
    }

    await withMowenBusy(async () => {
      setMowenStatus(t('testingMowen', null, '正在测试导出到墨问...'), '');
      try {
        const result = await window.HighlightMowenExporter.testMowenConnection(apiKey, { tags });
        if (!result.ok) {
          setMowenStatus(result.message || t('testExportFailedMowen', null, '测试导出失败，请检查 API Key 或网络状态。'), 'error');
          return;
        }

        await chrome.storage.local.set({ [MOWEN_TESTED_KEY]: apiKey });
        updateMowenSummary({ apiKey, tags, lastTestedKey: apiKey });
        setMowenStatus(t('mowenTestSucceeded', { noteId: result.noteId ? `（${result.noteId}）` : '' }, `测试成功，已创建测试私密笔记${result.noteId ? `（${result.noteId}）` : ''}。`), 'success');
      } catch (err) {
        console.warn('墨问测试导出失败', err);
        setMowenStatus(t('mowenExportFailed', null, '测试导出失败，请检查 API Key、配额或网络状态。'), 'error');
      }
    });
  }

  async function exportAllToMowen() {
    const apiKey = getMowenApiKey();
    const tags = getMowenTagsInput();
    if (!apiKey) {
      setMowenStatus(t('fillMowenApiKey', null, '请先填写墨问 API Key。'), 'error');
      return;
    }
    if (pagesData.length === 0) {
      setMowenStatus(t('exportNoPages', null, '当前没有可导出的页面记录。'), 'error');
      return;
    }

    const settings = await getMowenSettings();
    if (settings.lastTestedKey !== apiKey) {
      setMowenStatus(t('completeTestBeforeExport', null, '请先完成一次测试导出，再执行正式导出。'), 'error');
      syncMowenActionState(settings.lastTestedKey);
      return;
    }

    await withMowenBusy(async () => {
      setMowenStatus(t('exportingAllMowen', null, '正在导出全部记录到墨问...'), '');
      try {
        const bundle = window.HighlightExport.buildExportBundle(pagesData, { source: 'options' });
        const result = await window.HighlightMowenExporter.exportBundleToMowen(bundle, {
          apiKey,
          tags,
          noteTitle: getFullExportNoteTitle(bundle.exportedAt)
        });
        if (!result.ok) {
          setMowenStatus(result.message || t('mowenExportFailedShort', null, '导出到墨问失败。'), 'error');
          return;
        }
        const message = t('mowenExportSucceeded', { noteId: result.noteId ? `（${result.noteId}）` : '' }, `导出成功，已创建私密笔记${result.noteId ? `（${result.noteId}）` : ''}。`);
        setMowenStatus(message, 'success');
        alert(message);
      } catch (err) {
        console.warn('导出到墨问失败', err);
        setMowenStatus(t('mowenExportFailed', null, '导出到墨问失败，请检查网络、配额或 API Key。'), 'error');
      }
    });
  }

  async function testNotionExport() {
    const savedSettings = await saveNotionSettings({ keepOpen: true, suppressSuccess: true });
    if (!savedSettings) return;

    if (!window.HighlightNotionExporter || typeof window.HighlightNotionExporter.testNotionConnection !== 'function') {
      setNotionStatus(t('notionExportFeatureUnavailable', null, 'Notion 导出功能当前不可用。'), 'error');
      return;
    }

    await withNotionBusy(async () => {
      setNotionStatus(t('testingNotion', null, '正在向 Notion 创建测试页面...'), '');
      try {
        const result = await window.HighlightNotionExporter.testNotionConnection(savedSettings);
        if (!result.ok) {
          setNotionStatus(result.message || t('testFailedRetry', null, '测试失败，请检查配置后重试。'), 'error');
          return;
        }

        const latest = result.settings || await getNotionSettings();
        updateNotionSummary(latest);
        setNotionStatus(
          result.url
            ? t('notionTestSucceededWithUrl', { url: result.url }, `测试成功，已创建测试页面：${result.url}`)
            : (result.message || t('notionTestSucceeded', null, '测试成功，已在 Notion 中创建测试页面。')),
          'success'
        );
      } catch (err) {
        console.warn('Notion 测试失败', err);
        setNotionStatus(t('notionTestFailed', null, '测试失败，请检查 Token、页面共享权限或网络状态。'), 'error');
      }
    });
  }

  async function exportAllToNotion() {
    if (pagesData.length === 0) {
      setNotionStatus(t('exportNoPages', null, '当前没有可导出的页面记录。'), 'error');
      return;
    }

    const settings = await getNotionSettings();
    if (!settings.token) {
      openNotionPanel();
      setNotionStatus(t('fillNotionTokenForExport', null, '请先填写 Notion API 集成密钥（Integration Token）。'), 'error');
      return;
    }
    if (!settings.parentPageId) {
      openNotionPanel();
      setNotionStatus(t('fillNotionParentForExport', null, '请先填写 Notion 目标父页面链接或页面 ID（Page ID）。'), 'error');
      return;
    }
    if (!isCurrentNotionTest(settings)) {
      openNotionPanel();
      setNotionStatus(t('testNotionBeforeExport', null, '请先测试 Notion 导出，确认配置可用后再导出。'), 'error');
      return;
    }

    await withNotionBusy(async () => {
      setNotionStatus(t('exportingAllNotion', null, '正在导出全部记录到 Notion...'), '');
      try {
        const bundle = window.HighlightExport.buildExportBundle(pagesData, { source: 'options' });
        const result = await window.HighlightNotionExporter.exportBundleToNotion(bundle, {
          settings,
          noteTitle: getFullExportNoteTitle(bundle.exportedAt)
        });
        if (!result || !result.ok) {
          setNotionStatus((result && result.message) || t('notionExportFailedShort', null, '导出到 Notion 失败。'), 'error');
          return;
        }

        updateNotionSummary(result.settings || await getNotionSettings());
        const message = result.url
          ? t('notionExportSucceededWithUrl', { url: result.url }, `导出成功，已创建 Notion 页面：${result.url}`)
          : t('notionExportSucceeded', null, '导出成功，已创建 Notion 页面。');
        setNotionStatus(message, 'success');
        alert(message);
      } catch (err) {
        console.warn('导出到 Notion 失败', err);
        setNotionStatus(t('notionExportFailed', null, '导出到 Notion 失败，请检查 Token、页面共享权限或网络状态。'), 'error');
      }
    });
  }

  async function testObsidianExport() {
    const vault = getObsidianVaultInput();
    const folder = getObsidianFolderInput();

    if (!vault) {
      setObsidianStatus(t('fillObsidianVault', null, '请先填写 Obsidian Vault ID 或名称。'), 'error');
      return;
    }

    if (!window.HighlightObsidianExporter || typeof window.HighlightObsidianExporter.testObsidianConnection !== 'function') {
      setObsidianStatus(t('obsidianFeatureUnavailable', null, 'Obsidian 导出功能当前不可用。'), 'error');
      return;
    }

    await withObsidianBusy(async () => {
      setObsidianStatus(t('testingObsidian', null, '正在向 Obsidian 发送测试笔记...'), '');
      try {
        const result = await window.HighlightObsidianExporter.testObsidianConnection({ vault, folder });
        if (!result.ok) {
          setObsidianStatus(result.message || t('testFailedRetry', null, '测试失败，请检查配置后重试。'), 'error');
          return;
        }

        const latest = result.settings || await getObsidianSettings();
        updateObsidianSummary(latest);
        setObsidianStatus(result.message || t('obsidianTestSent', null, '已发送测试请求，请切换到 Obsidian 确认。'), 'success');
      } catch (err) {
        console.warn('Obsidian 测试失败', err);
        setObsidianStatus(t('obsidianTestFailed', null, '测试失败，请检查 Obsidian 是否已安装并已允许处理 obsidian:// 链接。'), 'error');
      }
    });
  }

  async function refreshSiyuanNotebookList(options) {
    const endpoint = getSiyuanEndpointInput();
    const token = getSiyuanTokenInput();
    const preferredNotebookId = String(options && options.preferredNotebookId || getSiyuanNotebookIdInput()).trim();
    const preferredNotebookName = String(options && options.preferredNotebookName || getSiyuanNotebookNameInput() || lastSiyuanSettings.notebookName || '').trim();

    if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.listNotebooks !== 'function') {
      setSiyuanStatus(t('siyuanFeatureUnavailable', null, '思源导出功能当前不可用。'), 'error');
      return null;
    }

    if (!token) {
      setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
      if (!(options && options.silent)) {
        setSiyuanStatus(t('fillSiyuanTokenBeforeRefresh', null, '请先填写思源 API Token，再刷新笔记本列表。'), 'error');
      }
      syncSiyuanActionState();
      return null;
    }

    let notebooksResult = null;
    await withSiyuanBusy(async () => {
      if (!(options && options.silent)) {
        setSiyuanStatus(t('loadingSiyuanNotebooks', null, '正在读取思源笔记本列表...'), '');
      }

      try {
        notebooksResult = await window.HighlightSiyuanExporter.listNotebooks({ endpoint, token });
        if (!notebooksResult || !notebooksResult.ok) {
          setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
          if (!(options && options.silent)) {
            setSiyuanStatus((notebooksResult && notebooksResult.message) || t('loadSiyuanNotebooksFailed', null, '读取思源笔记本失败。'), 'error');
          }
          return;
        }

        const notebooks = Array.isArray(notebooksResult.notebooks) ? notebooksResult.notebooks : [];
        setSiyuanNotebookOptions(notebooks, preferredNotebookId, preferredNotebookName);
        const selectedId = getSiyuanNotebookIdInput();
        const selectedName = getSiyuanNotebookNameInput();
        updateSiyuanSummary({
          endpoint,
          token,
          notebookId: selectedId,
          notebookName: selectedName,
          folder: getSiyuanFolderInput(),
          lastTestedAt: lastSiyuanSettings.lastTestedAt,
          lastTestedSignature: lastSiyuanSettings.lastTestedSignature
        });
        if (!(options && options.silent)) {
          setSiyuanStatus(
            notebooks.length > 0
              ? t('siyuanNotebooksLoaded', countParams(notebooks.length, 'notebook'), `已获取 ${notebooks.length} 个笔记本，请确认导出目标。`)
              : t('noSiyuanNotebooks', null, '未获取到可用笔记本。'),
            notebooks.length > 0 ? 'success' : 'error'
          );
        }
      } catch (err) {
        console.warn('读取思源笔记本失败', err);
        setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
        if (!(options && options.silent)) {
          setSiyuanStatus(t('loadSiyuanNotebooksFailedLong', null, '读取思源笔记本失败，请检查服务地址、Token 或思源是否已启动。'), 'error');
        }
      }
    }, {
      after: async (latest) => {
        updateSiyuanSummary({
          endpoint,
          token,
          notebookId: getSiyuanNotebookIdInput(),
          notebookName: getSiyuanNotebookNameInput() || preferredNotebookName,
          folder: getSiyuanFolderInput(),
          lastTestedAt: latest.lastTestedAt,
          lastTestedSignature: latest.lastTestedSignature
        });
        syncSiyuanActionState();
      }
    });

    return notebooksResult;
  }

  async function testSiyuanExport() {
    const savedSettings = await saveSiyuanSettings({ keepOpen: true, suppressSuccess: true });
    if (!savedSettings) return;

    if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.testSiyuanConnection !== 'function') {
      setSiyuanStatus(t('siyuanFeatureUnavailable', null, '思源导出功能当前不可用。'), 'error');
      return;
    }

    await withSiyuanBusy(async () => {
      setSiyuanStatus(t('testingSiyuan', null, '正在向思源写入测试文档...'), '');
      try {
        const result = await window.HighlightSiyuanExporter.testSiyuanConnection(savedSettings);
        if (!result.ok) {
          setSiyuanStatus(result.message || t('testFailedRetry', null, '测试失败，请检查配置后重试。'), 'error');
          return;
        }

        const latest = result.settings || await getSiyuanSettings();
        updateSiyuanSummary(latest);
        setSiyuanStatus(result.message || t('siyuanTestSucceeded', null, '测试成功，已在思源中创建测试文档。'), 'success');
      } catch (err) {
        console.warn('思源测试失败', err);
        setSiyuanStatus(t('siyuanTestFailed', null, '测试失败，请检查思源服务地址、Token 或桌面版运行状态。'), 'error');
      }
    });
  }

  async function exportAllToSiyuan() {
    if (pagesData.length === 0) {
      setSiyuanStatus(t('exportNoPages', null, '当前没有可导出的页面记录。'), 'error');
      return;
    }

    const settings = await getSiyuanSettings();
    if (!settings.token) {
      openSiyuanPanel();
      setSiyuanStatus(t('fillSiyuanToken', null, '请先填写思源 API Token。'), 'error');
      return;
    }
    if (!settings.notebookId) {
      openSiyuanPanel();
      setSiyuanStatus(t('fillSiyuanNotebook', null, '请先选择目标笔记本。'), 'error');
      return;
    }

    await withSiyuanBusy(async () => {
      setSiyuanStatus(t('exportingAllSiyuan', null, '正在导出全部记录到思源...'), '');
      try {
        const bundle = window.HighlightExport.buildExportBundle(pagesData, { source: 'options' });
        const result = await window.HighlightSiyuanExporter.exportBundleToSiyuan(bundle, {
          settings,
          noteTitle: getFullExportNoteTitle(bundle.exportedAt)
        });
        if (!result || !result.ok) {
          setSiyuanStatus((result && result.message) || t('siyuanExportFailedShort', null, '导出到思源失败。'), 'error');
          return;
        }

        updateSiyuanSummary(result.settings || await getSiyuanSettings());
        const message = t('siyuanExportSucceeded', { path: result.docPath || '' }, `导出成功，已创建文档：${result.docPath}`);
        setSiyuanStatus(message, 'success');
        alert(message);
      } catch (err) {
        console.warn('导出到思源失败', err);
        setSiyuanStatus(t('siyuanExportFailed', null, '导出到思源失败，请检查服务地址、Token 或思源运行状态。'), 'error');
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
      if (overviewPages.nextElementSibling) {
        overviewPages.nextElementSibling.textContent = countNoun(pagesData.length, 'page', 'pages');
      }
    }

    if (overviewHighlights) {
      const totalHighlights = pagesData.reduce((sum, page) => sum + page.highlights.length, 0);
      overviewHighlights.textContent = String(totalHighlights);
      if (overviewHighlights.nextElementSibling) {
        overviewHighlights.nextElementSibling.textContent = countNoun(totalHighlights, 'highlight', 'highlights');
      }
    }

    if (overviewNotes) {
      const totalNotes = pagesData.reduce((sum, page) => sum + (page.note && page.note.content ? 1 : 0), 0);
      overviewNotes.textContent = String(totalNotes);
      if (overviewNotes.nextElementSibling) {
        overviewNotes.nextElementSibling.textContent = countNoun(totalNotes, 'note', 'notes');
      }
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
    if (!timestamp) return t('earlier', null, '更早');

    const diff = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return t('justNowUpdated', null, '刚刚更新');
    if (diff < hour) {
      const count = Math.max(1, Math.floor(diff / minute));
      return t('updatedAgo', { time: formatCount(count, 'minute') }, `${count} 分钟前更新`);
    }
    if (diff < day) {
      const count = Math.floor(diff / hour);
      return t('updatedAgo', { time: formatCount(count, 'hour') }, `${count} 小时前更新`);
    }
    if (diff < 7 * day) {
      const count = Math.floor(diff / day);
      return t('updatedAgo', { time: formatCount(count, 'day') }, `${count} 天前更新`);
    }

    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(date.getDate()).padStart(2, '0');
    return t('dateUpdated', { date: `${year}-${month}-${dayOfMonth}` }, `${year}-${month}-${dayOfMonth} 更新`);
  }

  function getPageTimeBucket(page) {
    const timestamp = getPageLastUpdated(page);
    if (!timestamp) return t('earlier', null, '更早');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

    if (timestamp >= startOfToday) return t('today', null, '今天');
    if (timestamp >= startOfYesterday) return t('yesterday', null, '昨天');
    return t('earlier', null, '更早');
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

    const tagText = normalizeTags(page.tags || []).join(' ');
    return `${page.title} ${page.url} ${tagText} ${noteTitle} ${noteText} ${highlightText}`.toLowerCase();
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
      const pageTags = normalizeTags(page.tags || []);
      if (activeTagFilter === TAG_FILTER_UNTAGGED && pageTags.length > 0) return false;
      if (activeTagFilter && activeTagFilter !== TAG_FILTER_UNTAGGED && !pageTags.some(tag => tag === activeTagFilter)) return false;
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
    return annotation ? `${text}\n${t('annotationPrefix', null, '批注：')}${annotation}` : text;
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
      sections.push(`${t('pageNote', null, '页面笔记')}\n${note}`);
    }

    if (highlights.length > 0) {
      sections.push(`${t('highlightContent', null, '高亮内容')}\n${highlights.join('\n\n')}`);
    }

    return sections.join('\n\n').trim();
  }

  function updateFilterChips() {
    filterChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === activeFilter);
    });
  }

  function getAllTags() {
    return sortTags(pagesData.flatMap(page => page.tags || []));
  }

  function getTagUsage() {
    const usage = new Map();
    pagesData.forEach(page => {
      normalizeTags(page.tags || []).forEach(tag => {
        usage.set(tag, (usage.get(tag) || 0) + 1);
      });
    });
    return usage;
  }

  function renderTagFilterOptions() {
    if (!tagFilterSelect) return;

    const tags = getAllTags();
    const previous = activeTagFilter;
    tagFilterSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = t('allTags', null, '全部标签');
    tagFilterSelect.appendChild(allOption);

    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilterSelect.appendChild(option);
    });

    const untaggedOption = document.createElement('option');
    untaggedOption.value = TAG_FILTER_UNTAGGED;
    untaggedOption.textContent = t('untaggedPages', null, '无标签');
    tagFilterSelect.appendChild(untaggedOption);

    activeTagFilter = previous === TAG_FILTER_UNTAGGED || tags.includes(previous) ? previous : '';
    tagFilterSelect.value = activeTagFilter;
    tagFilterSelect.classList.toggle('has-value', Boolean(activeTagFilter));
  }

  function renderPageTagsLine(page) {
    const wrap = document.createElement('div');
    wrap.className = 'page-tags-line';
    wrap.addEventListener('click', (e) => e.stopPropagation());

    normalizeTags(page.tags || []).forEach(tag => {
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
        removeTagFromPage(page, tag).catch(err => console.warn('移除标签失败', err));
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
      addTagsToPage(page).catch(err => console.warn('添加标签失败', err));
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderTagManagement() {
    if (!tagManagementList) return;

    tagManagementList.innerHTML = '';
    const usage = getTagUsage();
    const tags = Array.from(usage.keys()).sort((a, b) => a.localeCompare(b));

    if (tags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tag-management-empty';
      empty.textContent = t('noTags', null, '暂无标签');
      tagManagementList.appendChild(empty);
      return;
    }

    tags.forEach(tag => {
      const row = document.createElement('div');
      row.className = 'tag-management-row';

      const main = document.createElement('div');
      main.className = 'tag-management-main';

      const name = document.createElement('span');
      name.className = 'tag-management-name';
      name.textContent = tag;
      main.appendChild(name);

      const count = document.createElement('span');
      count.className = 'tag-management-count';
      count.textContent = t('tagPageCount', countParams(usage.get(tag) || 0, 'page'), formatCount(usage.get(tag) || 0, 'page'));
      main.appendChild(count);
      row.appendChild(main);

      const actions = document.createElement('div');
      actions.className = 'tag-management-actions';

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'tag-management-btn';
      renameBtn.textContent = t('renameTag', null, '重命名');
      renameBtn.addEventListener('click', () => {
        renameTagAcrossPages(tag).catch(err => console.warn('重命名标签失败', err));
      });
      actions.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'tag-management-btn danger';
      deleteBtn.textContent = t('deleteTag', null, '删除');
      deleteBtn.addEventListener('click', () => {
        deleteTagAcrossPages(tag).catch(err => console.warn('删除标签失败', err));
      });
      actions.appendChild(deleteBtn);

      row.appendChild(actions);
      tagManagementList.appendChild(row);
    });
  }

  async function updateTagAcrossPages(oldTag, mapper) {
    const all = await chrome.storage.local.get(null);
    const updates = {};
    const removeKeys = [];
    const oldKey = String(oldTag || '').toLowerCase();

    Object.keys(all).forEach(key => {
      if (!key.startsWith(META_PREFIX)) return;

      const record = all[key];
      const tags = normalizeTags(record && record.tags);
      if (!tags.some(tag => tag.toLowerCase() === oldKey)) return;

      const nextTags = normalizeTags(mapper(tags));
      if (nextTags.length === 0) {
        removeKeys.push(key);
      } else {
        updates[key] = {
          ...(record && typeof record === 'object' ? record : {}),
          pageUrl: (record && record.pageUrl) || key.substring(META_PREFIX.length),
          tags: nextTags,
          updatedAt: Date.now()
        };
      }
    });

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
    if (removeKeys.length > 0) {
      await chrome.storage.local.remove(removeKeys);
    }
  }

  async function renameTagAcrossPages(oldTag) {
    const nextTag = normalizeTagName(prompt(t('renameTagPrompt', { tag: oldTag }, `将“${oldTag}”重命名为：`), oldTag));
    if (!nextTag || nextTag === oldTag) return;

    await updateTagAcrossPages(oldTag, tags => tags.map(tag => tag.toLowerCase() === oldTag.toLowerCase() ? nextTag : tag));
    if (activeTagFilter && activeTagFilter.toLowerCase() === oldTag.toLowerCase()) {
      activeTagFilter = nextTag;
    }
    loadData();
  }

  async function deleteTagAcrossPages(tag) {
    if (!confirm(t('deleteTagConfirm', { tag }, `确定从所有页面中删除“${tag}”标签吗？\n\n这只会移除标签，不会删除页面、高亮或笔记。`))) return;

    await updateTagAcrossPages(tag, tags => tags.filter(item => item.toLowerCase() !== tag.toLowerCase()));
    if (activeTagFilter && activeTagFilter.toLowerCase() === tag.toLowerCase()) {
      activeTagFilter = '';
    }
    loadData();
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
            note: null,
            meta: null,
            tags: []
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
        } else if (key.startsWith(META_PREFIX)) {
          const record = all[key];
          const url = (record && record.pageUrl) || key.substring(META_PREFIX.length);
          if (!record || typeof record !== 'object' || !url) return;

          const page = ensurePage(url, record.pageTitle || url);
          if (page) {
            page.meta = record;
            page.tags = normalizeTags(record.tags);
            if ((!page.title || page.title === page.url) && record.pageTitle) {
              page.title = record.pageTitle;
            }
          }
        }
      });

      pagesData = Array.from(pagesByUrl.values())
        .filter(page => page.highlights.length > 0 || (page.note && page.note.content))
        .sort((a, b) => getPageLastUpdated(b) - getPageLastUpdated(a) || a.title.localeCompare(b.title));

      renderOverviewStats();
      updateFilterChips();
      renderTagFilterOptions();
      renderTagManagement();
      renderList();
      getMowenSettings().then(settings => syncMowenActionState(settings.lastTestedKey));
      getMowenSettings().then(settings => updateMowenSummary(settings));
      getObsidianSettings().then(settings => {
        updateObsidianSummary(settings);
        syncObsidianActionState();
      });
      getSiyuanSettings().then(settings => {
        updateSiyuanSummary(settings);
        syncSiyuanActionState();
      });
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

  function isOpenablePageUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'file:'].includes(parsed.protocol);
    } catch (err) {
      return false;
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function focusTab(tab) {
    if (!tab || !tab.id) return null;
    try {
      if (chrome.windows && tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (err) {
      // Focusing the window is best-effort; activating the tab is enough.
    }
    return chrome.tabs.update(tab.id, { active: true });
  }

  async function waitForTabReady(tabId, timeoutMs = 8000) {
    if (!tabId || !(chrome.tabs && chrome.tabs.get)) return;

    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === 'complete') return;
    } catch (err) {
      return;
    }

    await new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(done, timeoutMs);

      function done() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }

      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          done();
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async function getOrCreateSourceTab(url) {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(tab => tab && tab.id && tab.url === url);
    if (existing) {
      return focusTab(existing);
    }
    return chrome.tabs.create({ url, active: true });
  }

  async function locateHighlightInTab(tab, highlightId) {
    if (!tab || !tab.id || !highlightId) return;

    await waitForTabReady(tab.id);
    let readyTab = tab;
    try {
      readyTab = await chrome.tabs.get(tab.id);
    } catch (err) {
      readyTab = tab;
    }
    const reinjected = await ensureContentScript(readyTab);
    if (reinjected) {
      await wait(300);
    }

    const delays = [0, 300, 700, 1200, 1800, 2500, 3500];
    let delivered = false;
    let forwardedToFrame = false;
    for (const delay of delays) {
      if (delay) await wait(delay);
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { command: 'scrollToHighlight', id: highlightId }, { frameId: 0 });
        if (response && response.found) {
          delivered = true;
          break;
        }
        if (response && response.forwarded) {
          forwardedToFrame = true;
        }
      } catch (err) {
        // The target page may still be restoring content; retry below.
      }
    }

    if (!delivered && !forwardedToFrame) {
      alert(t('locateHighlightFailed', null, '已打开原文，但未能定位到该条高亮。'));
    }
  }

  async function openSourcePage(page, highlightId) {
    if (!page || !isOpenablePageUrl(page.url)) {
      alert(t('openOriginalFailed', null, '无法打开原文页面'));
      return;
    }

    try {
      const tab = await getOrCreateSourceTab(page.url);
      if (highlightId) {
        await locateHighlightInTab(tab, highlightId);
      }
    } catch (err) {
      console.warn('打开原文失败', err);
      alert(t('openOriginalFailed', null, '无法打开原文页面'));
    }
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

    removeKeys.push(getMetaKey(page.url));

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

  function queryInjectableTabs() {
    return new Promise(resolve => {
      if (!(chrome.tabs && chrome.tabs.query)) {
        resolve([]);
        return;
      }
      chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] }, tabs => {
        resolve(Array.isArray(tabs) ? tabs : []);
      });
    });
  }

  function injectContentScriptIntoTab(tabId) {
    return new Promise(resolve => {
      if (!(chrome.scripting && chrome.scripting.executeScript) || !tabId) {
        resolve(false);
        return;
      }
      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          files: ['content.js']
        },
        () => {
          resolve(!chrome.runtime.lastError);
        }
      );
    });
  }

  async function wakeOpenPagesAfterGlobalRestore() {
    const tabs = await queryInjectableTabs();
    const results = await Promise.allSettled(
      tabs.map(tab => injectContentScriptIntoTab(tab.id))
    );
    return results.filter(result => result.status === 'fulfilled' && result.value).length;
  }

  function renderGlobalDisableStatus() {
    chrome.storage.local.get(['global_disabled'], (res) => {
      const card = document.getElementById('global-disable-card');
      if (!card) return;

      const isDisabled = !!res.global_disabled;
      card.className = `global-disable-card${isDisabled ? ' is-disabled' : ''}`;
      card.innerHTML = '';

      const copy = document.createElement('div');
      copy.className = 'global-disable-copy';

      const title = document.createElement('div');
      title.className = 'global-disable-title';
      title.textContent = isDisabled
        ? t('globalDisabledTitle', null, '划线猫已全局禁用')
        : t('globalEnabledTitle', null, '划线猫全局功能已启用');

      const desc = document.createElement('div');
      desc.className = 'global-disable-desc';
      desc.textContent = isDisabled
        ? t('globalDisabledDesc', null, '当前所有网站都不会弹出工具条。点击右侧按钮可重新启用。')
        : t('globalEnabledDesc', null, '如需恢复某个被禁用的网站，请在下方移除对应网站。');

      copy.appendChild(title);
      copy.appendChild(desc);
      card.appendChild(copy);

      if (!isDisabled) return;

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'global-disable-restore';
      restoreBtn.textContent = t('restoreGlobalHighlighting', null, '重新启用');
      restoreBtn.addEventListener('click', () => {
        restoreBtn.disabled = true;
        chrome.storage.local.remove('global_disabled', async () => {
          await wakeOpenPagesAfterGlobalRestore().catch(() => 0);
          renderGlobalDisableStatus();
          alert(t('globalRestoredAlert', null, '已重新启用划线猫，并已尝试唤起已打开网页。若某个页面仍未出现工具条，请刷新该页面一次。'));
        });
      });
      card.appendChild(restoreBtn);
    });
  }

  function renderBlacklist() {
    chrome.storage.local.get(['disabled_domains'], (res) => {
      const list = res.disabled_domains || [];
      const container = document.getElementById('blacklist-container');
      container.innerHTML = '';

      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'blacklist-empty';
        empty.textContent = t('noBlacklistedSites', null, '暂无禁用网站');
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
        removeBtn.title = t('remove', null, '移除');

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
      empty.textContent = t('noMatchingRecords', null, '没有匹配的记录');
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

      const titleLink = document.createElement('button');
      titleLink.type = 'button';
      titleLink.className = 'page-title page-source-link';
      titleLink.textContent = page.title;
      titleLink.title = t('openOriginalTitle', null, '打开原文');
      titleLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSelectionMode) {
          openSourcePage(page);
        }
      });
      titleRow.appendChild(titleLink);

      if (page.highlights.length > 0) {
        const highlightBadge = document.createElement('span');
        highlightBadge.className = 'summary-badge summary-badge-highlight';
        highlightBadge.textContent = t('highlightCountShort', countParams(page.highlights.length, 'highlight'), `${page.highlights.length} 条`);
        titleRow.appendChild(highlightBadge);
      }

      if (page.note && page.note.content) {
        const noteBadge = document.createElement('span');
        noteBadge.className = 'summary-badge summary-badge-note';
        noteBadge.textContent = formatCount(1, 'note');
        titleRow.appendChild(noteBadge);
      }

      infoDiv.appendChild(titleRow);

      const metaLine = document.createElement('div');
      metaLine.className = 'page-meta-line';

      const urlLink = document.createElement('button');
      urlLink.type = 'button';
      urlLink.className = 'page-url page-source-link';
      urlLink.textContent = getPageDomain(page.url);
      urlLink.title = page.url;
      urlLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSelectionMode) {
          openSourcePage(page);
        }
      });
      metaLine.appendChild(urlLink);

      const separator = document.createElement('span');
      separator.className = 'page-meta-separator';
      separator.textContent = '•';
      metaLine.appendChild(separator);

      const updatedSpan = document.createElement('span');
      updatedSpan.className = 'page-updated';
      const updatedAt = getPageLastUpdated(page);
      updatedSpan.textContent = formatUpdatedTime(updatedAt);
      if (updatedAt) {
        updatedSpan.title = new Date(updatedAt).toLocaleString(window.CatI18n && window.CatI18n.getLanguage && window.CatI18n.getLanguage() === 'en' ? 'en-US' : 'zh-CN');
      }
      metaLine.appendChild(updatedSpan);

      infoDiv.appendChild(metaLine);
      infoDiv.appendChild(renderPageTagsLine(page));
      summaryMain.appendChild(infoDiv);
      summary.appendChild(summaryMain);

      if (!isSelectionMode) {
        const actionWrap = document.createElement('div');
        actionWrap.className = 'page-summary-actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'summary-action-btn';
        copyBtn.textContent = t('copy', null, '复制');
        copyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const content = formatPageForClipboard(page);
          if (!content) return;
          navigator.clipboard.writeText(content).catch(err => console.warn('Copy failed', err));
        });
        actionWrap.appendChild(copyBtn);

        const exportMenu = document.createElement('div');
        exportMenu.className = 'page-action-export-menu';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'summary-action-btn page-action-export-trigger';
        exportBtn.setAttribute('aria-expanded', 'false');
        exportBtn.setAttribute('aria-haspopup', 'menu');
        exportBtn.innerHTML = `<span>${t('exportPage', null, '导出本页')}</span><span class="top-action-chevron" aria-hidden="true"></span>`;
        exportBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const nextOpen = !exportMenu.classList.contains('open');
          closeExportMenu();
          closePageExportMenus(nextOpen ? exportMenu : null);
          exportMenu.classList.toggle('open', nextOpen);
          details.classList.toggle('export-menu-open', nextOpen);
          exportBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        });
        exportMenu.appendChild(exportBtn);

        const exportDropdown = document.createElement('div');
        exportDropdown.className = 'page-action-export-popover';
        exportDropdown.setAttribute('role', 'menu');
        exportDropdown.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        getExportTargetOptions().forEach(option => {
          const optionBtn = document.createElement('button');
          optionBtn.type = 'button';
          optionBtn.className = 'page-action-export-option';
          optionBtn.setAttribute('role', 'menuitem');
          optionBtn.textContent = option.label;
          optionBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            exportMenu.classList.remove('open');
            details.classList.remove('export-menu-open');
            exportBtn.setAttribute('aria-expanded', 'false');
            await exportPages([page], option.value);
          });
          exportDropdown.appendChild(optionBtn);
        });

        exportMenu.appendChild(exportDropdown);
        actionWrap.appendChild(exportMenu);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'summary-action-btn danger';
        deleteBtn.textContent = t('delete', null, '删除');
        deleteBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm(t('deletePageRecordConfirm', { title: page.title }, `确定删除“${page.title}”的整页记录吗？这会删除该页的高亮和页面笔记。`))) {
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
        noteLabel.textContent = t('pageNote', null, '页面笔记');
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
          } else {
            row.classList.add('jumpable');
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.title = t('openHighlightTitle', null, '打开原文并定位此高亮');
            row.addEventListener('click', (e) => {
              if (e.target.closest('button, input, a')) return;
              openSourcePage(page, h.id);
            });
            row.addEventListener('keydown', (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              if (e.target.closest('button, input, a')) return;
              e.preventDefault();
              openSourcePage(page, h.id);
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
          if (h.annotation) display += ` · ${t('containsAnnotation', null, '含批注')}`;
          textSpan.textContent = display;
          row.appendChild(textSpan);

          if (!isSelectionMode) {
            const copyHighlightBtn = document.createElement('button');
            copyHighlightBtn.type = 'button';
            copyHighlightBtn.textContent = t('copy', null, '复制');
            copyHighlightBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(formatHighlightForClipboard(h)).catch(err => {
                console.warn('Copy failed', err);
              });
            });
            row.appendChild(copyHighlightBtn);

            const deleteHighlightBtn = document.createElement('button');
            deleteHighlightBtn.type = 'button';
            deleteHighlightBtn.textContent = t('delete', null, '删除');
            deleteHighlightBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm(t('deleteHighlightConfirm', null, '删除此高亮吗？'))) {
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
          deletePageBtn.textContent = t('deleteSelectedHighlights', null, '删除高亮');
          deletePageBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(t('deleteAllHighlightsConfirm', null, '确定删除此页面的全部高亮吗？'))) {
              await deletePageHighlights(page);
            }
          });
          detailActions.appendChild(deletePageBtn);

          const copyHighlightsBtn = document.createElement('button');
          copyHighlightsBtn.type = 'button';
          copyHighlightsBtn.textContent = t('copyHighlights', null, '复制高亮');
          copyHighlightsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const texts = page.highlights
              .map(formatHighlightForClipboard)
              .filter(Boolean)
              .join('\n\n');
            if (texts) {
              navigator.clipboard.writeText(texts).catch(err => console.warn('Copy failed', err));
            }
          });
          detailActions.appendChild(copyHighlightsBtn);
        }

        if (page.note && page.note.content) {
          const copyNoteBtn = document.createElement('button');
          copyNoteBtn.type = 'button';
          copyNoteBtn.textContent = t('copyNote', null, '复制笔记');
          copyNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(page.note.content).catch(err => console.warn('Copy failed', err));
          });
          detailActions.appendChild(copyNoteBtn);

          const deleteNoteBtn = document.createElement('button');
          deleteNoteBtn.type = 'button';
          deleteNoteBtn.className = 'danger';
          deleteNoteBtn.textContent = t('deleteNote', null, '删除笔记');
          deleteNoteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(t('deleteNoteConfirm', null, '确定删除此页面笔记吗？'))) {
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

  async function exportPages(pages, format, options) {
    if (!pages || pages.length === 0) {
      alert(t('noExportContent', null, '没有可导出的内容'));
      return;
    }

    const bundle = window.HighlightExport.buildExportBundle(pages, { source: 'options' });
    const noteTitle = options && options.fullExport ? getFullExportNoteTitle(bundle.exportedAt) : (options && options.noteTitle);
    const targetFormat = format || 'markdown';
    let ok = false;

    if (targetFormat === 'mowen') {
      if (!window.HighlightMowenExporter || typeof window.HighlightMowenExporter.exportBundleToMowen !== 'function') {
        alert(t('mowenUnavailable', null, '墨问导出当前不可用'));
        return;
      }

      const settings = await getMowenSettings();
      const apiKey = String(settings.apiKey || '').trim();
      if (!apiKey) {
        openMowenPanel();
        setMowenStatus(t('completeMowenConfigBeforeExport', null, '请先完成墨问配置，再执行导出。'), 'error');
        setMowenFormVisible(true);
        return;
      }

      if (String(settings.lastTestedKey || '').trim() !== apiKey) {
        openMowenPanel();
        setMowenStatus(t('testMowenBeforeExport', null, '请先测试墨问导出，确认配置可用后再导出。'), 'error');
        return;
      }

      const result = await window.HighlightMowenExporter.exportBundleToMowen(bundle, {
        apiKey,
        tags: String(settings.tags || '').trim(),
        noteTitle
      });
      if (!result || !result.ok) {
        openMowenPanel();
        setMowenStatus((result && result.message) || t('mowenExportFailedShort', null, '发送到墨问失败。'), 'error');
        return;
      }

      updateMowenSummary(settings);
      const message = t('mowenExportSucceeded', { noteId: result.noteId ? `（${result.noteId}）` : '' }, `导出成功，已创建私密笔记${result.noteId ? `（${result.noteId}）` : ''}。`);
      setMowenStatus(message, 'success');
      alert(message);
      return;
    }

    if (targetFormat === 'notion') {
      if (!window.HighlightNotionExporter || typeof window.HighlightNotionExporter.exportBundleToNotion !== 'function') {
        alert(t('notionExportFeatureUnavailable', null, 'Notion 导出功能暂不可用'));
        return;
      }

      const settings = await getNotionSettings();
      if (!settings.token || !settings.parentPageId) {
        openNotionPanel();
        setNotionStatus(t('completeNotionConfigBeforeExport', null, '请先完成 Notion 配置，再执行导出。'), 'error');
        return;
      }
      if (!isCurrentNotionTest(settings)) {
        openNotionPanel();
        setNotionStatus(t('testNotionBeforeExport', null, '请先测试 Notion 导出，确认配置可用后再导出。'), 'error');
        return;
      }

      const result = await window.HighlightNotionExporter.exportBundleToNotion(bundle, { settings, noteTitle });
      if (!result.ok) {
        openNotionPanel();
        setNotionStatus(result.message || t('notionExportFailedShort', null, '发送到 Notion 失败。'), 'error');
        return;
      }

      updateNotionSummary(result.settings || await getNotionSettings());
      const message = result.url
        ? t('notionExportSucceededWithUrl', { url: result.url }, `导出成功，已创建 Notion 页面：${result.url}`)
        : t('notionExportSucceeded', null, '导出成功，已创建 Notion 页面。');
      setNotionStatus(message, 'success');
      alert(message);
      return;
    }

    if (targetFormat === 'obsidian') {
      if (!window.HighlightObsidianExporter || typeof window.HighlightObsidianExporter.exportBundleToObsidian !== 'function') {
        alert(t('obsidianFeatureUnavailable', null, 'Obsidian 导出功能暂不可用'));
        return;
      }

      const settings = await getObsidianSettings();
      if (!settings.vault) {
        openObsidianPanel();
        setObsidianStatus(t('completeObsidianConfigBeforeExport', null, '请先完成 Obsidian 配置，再执行导出。'), 'error');
        return;
      }

      const result = await window.HighlightObsidianExporter.exportBundleToObsidian(bundle, { settings, noteTitle });
      if (!result.ok) {
        openObsidianPanel();
        setObsidianStatus(result.message || t('obsidianExportFailed', null, '发送到 Obsidian 失败。'), 'error');
        return;
      }

      updateObsidianSummary(await getObsidianSettings());
      setObsidianStatus(t('sentToObsidian', { path: result.filePath || '' }, `已发送到 Obsidian：${result.filePath}`), 'success');
      return;
    }

    if (targetFormat === 'siyuan') {
      if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.exportBundleToSiyuan !== 'function') {
        alert(t('siyuanFeatureUnavailable', null, '思源导出功能暂不可用'));
        return;
      }

      const settings = await getSiyuanSettings();
      if (!settings.token) {
        openSiyuanPanel();
        setSiyuanStatus(t('completeSiyuanConfigBeforeExport', null, '请先完成思源配置，再执行导出。'), 'error');
        return;
      }
      if (!settings.notebookId) {
        openSiyuanPanel();
        setSiyuanStatus(t('chooseSiyuanNotebookBeforeExport', null, '请先选择思源目标笔记本，再执行导出。'), 'error');
        return;
      }

      const result = await window.HighlightSiyuanExporter.exportBundleToSiyuan(bundle, { settings, noteTitle });
      if (!result.ok) {
        openSiyuanPanel();
        setSiyuanStatus(result.message || t('siyuanExportFailedShort', null, '发送到思源失败。'), 'error');
        return;
      }

      updateSiyuanSummary(result.settings || await getSiyuanSettings());
      const message = t('siyuanExportSucceeded', { path: result.docPath || '' }, `导出成功，已创建文档：${result.docPath}`);
      setSiyuanStatus(message, 'success');
      alert(message);
      return;
    }

    ok = targetFormat === 'html'
      ? window.HighlightExport.downloadBundleAsHtml(bundle, 'catlines')
      : window.HighlightExport.downloadBundleAsMarkdown(bundle, 'catlines');
    if (!ok) {
      alert(t('noExportContent', null, '没有可导出的内容'));
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
          await exportPages(pagesData, format);
          return;
        }

        if (format === 'obsidian') {
          await exportPages(pagesData, format, { fullExport: true });
          return;
        }

        if (format === 'mowen') {
          const settings = await getMowenSettings();
          const hasApiKey = !!String(settings.apiKey || '').trim();
          const isTested = hasApiKey && settings.lastTestedKey === settings.apiKey;

          if (!hasApiKey) {
            openMowenPanel();
            setMowenStatus(t('completeMowenConfigBeforeExport', null, '请先完成墨问配置，再执行导出。'), 'error');
            setMowenFormVisible(true);
            return;
          }

          if (!isTested) {
            openMowenPanel();
            setMowenStatus(t('testMowenBeforeExport', null, '请先测试墨问导出，确认配置可用后再导出。'), 'error');
            return;
          }

          exportAllToMowen();
          return;
        }

        if (format === 'notion') {
          exportAllToNotion();
          return;
        }

        if (format === 'siyuan') {
          exportAllToSiyuan();
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
      if (settingsPanel && !settingsPanel.classList.contains('hidden') && mowenFormCard && !mowenFormCard.classList.contains('hidden')) {
        setMowenFormVisible(false);
        return;
      }
      openMowenPanel();
      setMowenFormVisible(true);
      setNotionFormVisible(false);
      setObsidianFormVisible(false);
      if (mowenApiKeyInput) {
        mowenApiKeyInput.focus();
      }
    });
  }

  if (notionConfigEditBtn) {
    notionConfigEditBtn.addEventListener('click', () => {
      if (settingsPanel && !settingsPanel.classList.contains('hidden') && notionFormCard && !notionFormCard.classList.contains('hidden')) {
        setNotionFormVisible(false);
        return;
      }
      openNotionPanel();
      if (notionTokenInput) {
        notionTokenInput.focus();
      }
    });
  }

  if (obsidianConfigEditBtn) {
    obsidianConfigEditBtn.addEventListener('click', () => {
      if (settingsPanel && !settingsPanel.classList.contains('hidden') && obsidianFormCard && !obsidianFormCard.classList.contains('hidden')) {
        setObsidianFormVisible(false);
        return;
      }
      openObsidianPanel();
      if (obsidianVaultInput) {
        obsidianVaultInput.focus();
      }
    });
  }

  if (siyuanConfigEditBtn) {
    siyuanConfigEditBtn.addEventListener('click', () => {
      if (settingsPanel && !settingsPanel.classList.contains('hidden') && siyuanFormCard && !siyuanFormCard.classList.contains('hidden')) {
        setSiyuanFormVisible(false);
        return;
      }
      openSiyuanPanel();
      if (siyuanTokenInput) {
        siyuanTokenInput.focus();
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
    closePageExportMenus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeExportMenu();
      closePageExportMenus();
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
        setMowenStatus(t('saveSettingsFailed', null, '保存设置失败，请稍后重试。'), 'error');
      });
    });
  }

  if (mowenTestBtn) {
    mowenTestBtn.addEventListener('click', () => {
      setMowenFormVisible(true);
      setNotionFormVisible(false);
      setObsidianFormVisible(false);
      setSiyuanFormVisible(false);
      testMowenExport();
    });
  }

  if (notionSaveBtn) {
    notionSaveBtn.addEventListener('click', () => {
      saveNotionSettings().catch(err => {
        console.warn('保存 Notion 设置失败', err);
        setNotionStatus(t('saveSettingsFailed', null, '保存设置失败，请稍后重试。'), 'error');
      });
    });
  }

  if (notionTestBtn) {
    notionTestBtn.addEventListener('click', () => {
      openNotionPanel();
      testNotionExport();
    });
  }

  if (obsidianSaveBtn) {
    obsidianSaveBtn.addEventListener('click', () => {
      saveObsidianSettings().catch(err => {
        console.warn('保存 Obsidian 设置失败', err);
        setObsidianStatus(t('saveSettingsFailed', null, '保存设置失败，请稍后重试。'), 'error');
      });
    });
  }

  if (obsidianTestBtn) {
    obsidianTestBtn.addEventListener('click', () => {
      openObsidianPanel();
      testObsidianExport();
    });
  }

  if (siyuanRefreshBtn) {
    siyuanRefreshBtn.addEventListener('click', () => {
      openSiyuanPanel();
      refreshSiyuanNotebookList();
    });
  }

  if (siyuanSaveBtn) {
    siyuanSaveBtn.addEventListener('click', () => {
      saveSiyuanSettings().catch(err => {
        console.warn('保存思源设置失败', err);
        setSiyuanStatus(t('saveSettingsFailed', null, '保存设置失败，请稍后重试。'), 'error');
      });
    });
  }

  if (siyuanTestBtn) {
    siyuanTestBtn.addEventListener('click', () => {
      openSiyuanPanel();
      testSiyuanExport();
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

  if (notionTokenInput) {
    notionTokenInput.addEventListener('input', async () => {
      const settings = await getNotionSettings();
      updateNotionSummary({
        token: getNotionTokenInput(),
        parentPageId: getNotionParentPageInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncNotionActionState();
    });
  }

  if (notionParentPageInput) {
    notionParentPageInput.addEventListener('input', async () => {
      const settings = await getNotionSettings();
      updateNotionSummary({
        token: getNotionTokenInput(),
        parentPageId: getNotionParentPageInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncNotionActionState();
    });
  }

  if (obsidianVaultInput) {
    obsidianVaultInput.addEventListener('input', async () => {
      const settings = await getObsidianSettings();
      updateObsidianSummary({
        vault: getObsidianVaultInput(),
        folder: getObsidianFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncObsidianActionState();
    });
  }

  if (obsidianFolderInput) {
    obsidianFolderInput.addEventListener('input', async () => {
      const settings = await getObsidianSettings();
      updateObsidianSummary({
        vault: getObsidianVaultInput(),
        folder: getObsidianFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncObsidianActionState();
    });
  }

  if (siyuanEndpointInput) {
    siyuanEndpointInput.addEventListener('input', async () => {
      const settings = await getSiyuanSettings();
      setSiyuanNotebookOptions([], '', '');
      updateSiyuanSummary({
        endpoint: getSiyuanEndpointInput(),
        token: getSiyuanTokenInput(),
        notebookId: '',
        notebookName: '',
        folder: getSiyuanFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncSiyuanActionState();
    });
  }

  if (siyuanTokenInput) {
    siyuanTokenInput.addEventListener('input', async () => {
      const settings = await getSiyuanSettings();
      setSiyuanNotebookOptions([], '', '');
      updateSiyuanSummary({
        endpoint: getSiyuanEndpointInput(),
        token: getSiyuanTokenInput(),
        notebookId: '',
        notebookName: '',
        folder: getSiyuanFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncSiyuanActionState();
    });
  }

  if (siyuanNotebookSelect) {
    siyuanNotebookSelect.addEventListener('change', async () => {
      const settings = await getSiyuanSettings();
      updateSiyuanSummary({
        endpoint: getSiyuanEndpointInput(),
        token: getSiyuanTokenInput(),
        notebookId: getSiyuanNotebookIdInput(),
        notebookName: getSiyuanNotebookNameInput(),
        folder: getSiyuanFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncSiyuanActionState();
    });
  }

  if (siyuanFolderInput) {
    siyuanFolderInput.addEventListener('input', async () => {
      const settings = await getSiyuanSettings();
      updateSiyuanSummary({
        endpoint: getSiyuanEndpointInput(),
        token: getSiyuanTokenInput(),
        notebookId: getSiyuanNotebookIdInput(),
        notebookName: getSiyuanNotebookNameInput() || settings.notebookName,
        folder: getSiyuanFolderInput(),
        lastTestedAt: settings.lastTestedAt,
        lastTestedSignature: settings.lastTestedSignature
      });
      syncSiyuanActionState();
    });
  }

  loadData();
  warmOpenTabsHighlights();
  renderGlobalDisableStatus();
  renderBlacklist();
  loadKeyboardShortcutSettings().catch(err => {
    console.warn('加载键盘快捷键设置失败', err);
  });
  loadMowenSettings().catch(err => {
    console.warn('加载墨问设置失败', err);
    setMowenStatus(t('loadMowenSettingsFailed', null, '加载墨问设置失败。'), 'error');
  });
  loadNotionSettings().catch(err => {
    console.warn('加载 Notion 设置失败', err);
    setNotionStatus(t('loadNotionSettingsFailed', null, '加载 Notion 设置失败。'), 'error');
  });
  loadObsidianSettings().catch(err => {
    console.warn('加载 Obsidian 设置失败', err);
    setObsidianStatus(t('loadObsidianSettingsFailed', null, '加载 Obsidian 设置失败。'), 'error');
  });
  loadSiyuanSettings().catch(err => {
    console.warn('加载思源设置失败', err);
    setSiyuanStatus(t('loadSiyuanSettingsFailed', null, '加载思源设置失败。'), 'error');
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
    if (selectCount) selectCount.textContent = t('selectedCount', countParams(count, 'highlight'), `已选 ${count} 条（勾选前框可全选）`);

    const totalCount = getTotalHighlightCount();
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = count > 0 && count === totalCount;
      selectAllCheckbox.indeterminate = count > 0 && count < totalCount;
    }
  }

  async function batchDeleteSelected() {
    if (selectedIds.size === 0) {
      alert(t('chooseHighlightsToDelete', null, '请先选择要删除的高亮'));
      return;
    }

    if (!confirm(t('deleteSelectedConfirm', countParams(selectedIds.size, 'highlight'), `确定删除选中的 ${selectedIds.size} 条高亮吗？`))) {
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
      alert(t('chooseHighlightsToCopy', null, '请先选择要复制的高亮'));
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
      batchCopyBtn.textContent = t('copiedWithIcon', null, '✅ 已复制!');
      setTimeout(() => {
        batchCopyBtn.textContent = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Copy failed:', err);
      alert(t('copyFailed', null, '复制失败'));
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

  if (languageSelect) {
    if (window.CatI18n && typeof window.CatI18n.getPreference === 'function') {
      languageSelect.value = window.CatI18n.getPreference();
    }

    languageSelect.addEventListener('change', () => {
      if (window.CatI18n && typeof window.CatI18n.setLanguage === 'function') {
        window.CatI18n.setLanguage(languageSelect.value || 'auto');
        applyLocalizedChrome();
      }
    });
  }

  if (keyboardShortcutsToggle) {
    keyboardShortcutsToggle.addEventListener('change', () => {
      saveKeyboardShortcutSettings().catch(err => {
        console.warn('保存键盘快捷键设置失败', err);
      });
    });
  }

  if (tagFilterSelect) {
    tagFilterSelect.addEventListener('change', () => {
      activeTagFilter = tagFilterSelect.value || '';
      tagFilterSelect.classList.toggle('has-value', Boolean(activeTagFilter));
      renderList();
    });
  }

  window.addEventListener('cat:i18n-ready', applyLocalizedChrome);
  window.addEventListener('hashchange', openUpdateHistoryFromHash);
  if (window.CatI18n && window.CatI18n.ready && typeof window.CatI18n.ready.then === 'function') {
    window.CatI18n.ready.then(() => {
      applyLocalizedChrome();
      openUpdateHistoryFromHash();
    }).catch(() => { });
  }

  let storageReloadTimer = null;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const changedKeys = Object.keys(changes);
    if (changedKeys.length === 0) return;

    const i18nStorageKey = window.CatI18n && window.CatI18n.STORAGE_KEY;
    if (i18nStorageKey && changedKeys.includes(i18nStorageKey)) {
      const nextPreference = changes[i18nStorageKey].newValue || 'auto';
      if (
        window.CatI18n &&
        typeof window.CatI18n.applyLanguagePreference === 'function' &&
        (!window.CatI18n.getPreference || window.CatI18n.getPreference() !== nextPreference)
      ) {
        window.CatI18n.applyLanguagePreference(nextPreference);
      } else {
        applyLocalizedChrome();
      }
      renderGlobalDisableStatus();
      renderBlacklist();
    }

    if (changedKeys.some(key => key === 'disabled_domains')) {
      renderBlacklist();
    }

    if (changedKeys.some(key => key === 'global_disabled')) {
      renderGlobalDisableStatus();
    }

    if (changedKeys.some(key => key === KEYBOARD_SHORTCUTS_ENABLED_KEY)) {
      setKeyboardShortcutsToggle(changes[KEYBOARD_SHORTCUTS_ENABLED_KEY].newValue !== false);
    }

    if (changedKeys.some(key =>
      key === MOWEN_API_KEY_KEY || key === MOWEN_TAGS_KEY || key === MOWEN_TESTED_KEY
    )) {
      loadMowenSettings().catch(() => { });
    }

    const shouldReloadPages = changedKeys.some(key =>
      key.startsWith(HIGHLIGHT_PREFIX) || key.startsWith(NOTE_PREFIX) || key.startsWith(META_PREFIX)
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
