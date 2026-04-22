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

  const MOWEN_API_KEY_KEY = 'mowen_api_key';
  const MOWEN_TAGS_KEY = 'mowen_default_tags';
  const MOWEN_TESTED_KEY = 'mowen_last_tested_key';
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
  let obsidianIsBusy = false;
  let obsidianFormExpanded = false;
  let siyuanIsBusy = false;
  let siyuanFormExpanded = false;
  let lastMowenSettings = { apiKey: '', tags: '', lastTestedKey: '' };
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

  function getObsidianSettingsSignature(settings) {
    if (window.HighlightObsidianExporter && typeof window.HighlightObsidianExporter.buildSettingsSignature === 'function') {
      return window.HighlightObsidianExporter.buildSettingsSignature(settings || {});
    }

    const vault = String(settings && settings.vault || '').trim();
    const folder = String(settings && settings.folder || '').trim();
    return `${vault}::${folder}`;
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

  function isCurrentSiyuanTest(settings) {
    if (!settings || !settings.token || !settings.notebookId || !settings.lastTestedAt) return false;
    return String(settings.lastTestedSignature || '') === getSiyuanSettingsSignature(settings);
  }

  function updateConfigSummaryMeta() {
    if (!mowenSummaryMeta) return;

    const hasMowenKey = !!String(lastMowenSettings.apiKey || '').trim();
    const mowenTested = hasMowenKey && String(lastMowenSettings.lastTestedKey || '') === String(lastMowenSettings.apiKey || '').trim();
    const hasObsidianVault = !!String(lastObsidianSettings.vault || '').trim();
    const obsidianTested = isCurrentObsidianTest(lastObsidianSettings);
    const hasSiyuanNotebook = !!String(lastSiyuanSettings.notebookId || '').trim();
    const siyuanTested = isCurrentSiyuanTest(lastSiyuanSettings);

    const parts = [
      `墨问：${hasMowenKey ? (mowenTested ? '已配置并测试' : '已配置') : '未配置'}`,
      `Obsidian：${hasObsidianVault ? (obsidianTested ? '已配置并测试' : '已配置') : '未配置'}`,
      `思源：${hasSiyuanNotebook ? (siyuanTested ? '已配置并测试' : '已配置') : '未配置'}`
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

  function setObsidianFormVisible(visible) {
    if (!obsidianFormCard) return;
    obsidianFormExpanded = !!visible;
    obsidianFormCard.classList.toggle('hidden', !visible);
  }

  function setSiyuanFormVisible(visible) {
    if (!siyuanFormCard) return;
    siyuanFormExpanded = !!visible;
    siyuanFormCard.classList.toggle('hidden', !visible);
    if (siyuanConfigEditBtn) {
      const hasNotebook = !!String(lastSiyuanSettings && lastSiyuanSettings.notebookId || '').trim();
      siyuanConfigEditBtn.textContent = visible ? '收起配置' : (hasNotebook ? '重新配置' : '去配置');
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
      configSummaryToggleText.textContent = expanded ? '收起' : '展开';
    }
  }

  function setSettingsPanelVisible(visible) {
    if (!settingsPanel) return;
    settingsPanel.classList.toggle('hidden', !visible);
    if (!visible) {
      setMowenFormVisible(false);
      setObsidianFormVisible(false);
      setSiyuanFormVisible(false);
    }
    syncSettingsPanelState();
  }

  function openMowenPanel() {
    if (settingsPanel) {
      setSettingsPanelVisible(true);
    }
    if (!mowenPanel) return;
    mowenPanel.open = true;
    setObsidianFormVisible(false);
    setSiyuanFormVisible(false);
    closeExportMenu();
    syncMowenPanelState();
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
        ? (tested ? '仓库已配置 · 已测试' : '仓库已配置')
        : '未配置';
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
      obsidianConfigEditBtn.textContent = hasVault ? '重新配置' : '去配置';
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
    placeholder.textContent = items.length > 0 ? '请选择目标笔记本' : '请先刷新笔记本列表';
    siyuanNotebookSelect.appendChild(placeholder);

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.closed ? `${item.name}（已关闭）` : item.name;
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
      fallback.textContent = `${preferredName}（已保存）`;
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
        siyuanTargetStatus.textContent = tested ? '笔记本已配置 · 已测试' : '笔记本已配置 · 待测试';
      } else if (hasToken) {
        siyuanTargetStatus.textContent = 'Token 已配置 · 待选择笔记本';
      } else {
        siyuanTargetStatus.textContent = '未配置';
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
      siyuanConfigEditBtn.textContent = hasNotebook ? '重新配置' : '去配置';
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
    setMowenStatus('设置已保存。若 API Key 有变化，请先重新测试导出。', 'success');
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
    setObsidianStatus('设置已保存。建议先点“测试”，确认可以正常写入 Obsidian。', 'success');
    if (vault) {
      setObsidianFormVisible(false);
    }
  }

  async function saveSiyuanSettings(options) {
    const endpoint = getSiyuanEndpointInput();
    const token = getSiyuanTokenInput();
    const notebookId = getSiyuanNotebookIdInput();
    const notebookName = getSiyuanNotebookNameInput();
    const folder = getSiyuanFolderInput();

    if (!token) {
      if (!(options && options.silent)) {
        setSiyuanStatus('请先填写思源 API Token。', 'error');
      }
      return null;
    }

    if (!notebookId) {
      if (!(options && options.silent)) {
        setSiyuanStatus('请先刷新并选择目标笔记本。', 'error');
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
      setSiyuanStatus('设置已保存。建议先点“测试”，确认可以正常写入思源。', 'success');
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

  async function testObsidianExport() {
    const vault = getObsidianVaultInput();
    const folder = getObsidianFolderInput();

    if (!vault) {
      setObsidianStatus('请先填写 Obsidian Vault ID 或名称。', 'error');
      return;
    }

    if (!window.HighlightObsidianExporter || typeof window.HighlightObsidianExporter.testObsidianConnection !== 'function') {
      setObsidianStatus('Obsidian 导出功能当前不可用。', 'error');
      return;
    }

    await withObsidianBusy(async () => {
      setObsidianStatus('正在向 Obsidian 发送测试笔记...', '');
      try {
        const result = await window.HighlightObsidianExporter.testObsidianConnection({ vault, folder });
        if (!result.ok) {
          setObsidianStatus(result.message || '测试失败，请检查配置后重试。', 'error');
          return;
        }

        const latest = result.settings || await getObsidianSettings();
        updateObsidianSummary(latest);
        setObsidianStatus(result.message || '已发送测试请求，请切换到 Obsidian 确认。', 'success');
      } catch (err) {
        console.warn('Obsidian 测试失败', err);
        setObsidianStatus('测试失败，请检查 Obsidian 是否已安装并已允许处理 obsidian:// 链接。', 'error');
      }
    });
  }

  async function refreshSiyuanNotebookList(options) {
    const endpoint = getSiyuanEndpointInput();
    const token = getSiyuanTokenInput();
    const preferredNotebookId = String(options && options.preferredNotebookId || getSiyuanNotebookIdInput()).trim();
    const preferredNotebookName = String(options && options.preferredNotebookName || getSiyuanNotebookNameInput() || lastSiyuanSettings.notebookName || '').trim();

    if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.listNotebooks !== 'function') {
      setSiyuanStatus('思源导出功能当前不可用。', 'error');
      return null;
    }

    if (!token) {
      setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
      if (!(options && options.silent)) {
        setSiyuanStatus('请先填写思源 API Token，再刷新笔记本列表。', 'error');
      }
      syncSiyuanActionState();
      return null;
    }

    let notebooksResult = null;
    await withSiyuanBusy(async () => {
      if (!(options && options.silent)) {
        setSiyuanStatus('正在读取思源笔记本列表...', '');
      }

      try {
        notebooksResult = await window.HighlightSiyuanExporter.listNotebooks({ endpoint, token });
        if (!notebooksResult || !notebooksResult.ok) {
          setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
          if (!(options && options.silent)) {
            setSiyuanStatus((notebooksResult && notebooksResult.message) || '读取思源笔记本失败。', 'error');
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
          setSiyuanStatus(notebooks.length > 0 ? `已获取 ${notebooks.length} 个笔记本，请确认导出目标。` : '未获取到可用笔记本。', notebooks.length > 0 ? 'success' : 'error');
        }
      } catch (err) {
        console.warn('读取思源笔记本失败', err);
        setSiyuanNotebookOptions([], preferredNotebookId, preferredNotebookName);
        if (!(options && options.silent)) {
          setSiyuanStatus('读取思源笔记本失败，请检查服务地址、Token 或思源是否已启动。', 'error');
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
      setSiyuanStatus('思源导出功能当前不可用。', 'error');
      return;
    }

    await withSiyuanBusy(async () => {
      setSiyuanStatus('正在向思源写入测试文档...', '');
      try {
        const result = await window.HighlightSiyuanExporter.testSiyuanConnection(savedSettings);
        if (!result.ok) {
          setSiyuanStatus(result.message || '测试失败，请检查配置后重试。', 'error');
          return;
        }

        const latest = result.settings || await getSiyuanSettings();
        updateSiyuanSummary(latest);
        setSiyuanStatus(result.message || '测试成功，已在思源中创建测试文档。', 'success');
      } catch (err) {
        console.warn('思源测试失败', err);
        setSiyuanStatus('测试失败，请检查思源服务地址、Token 或桌面版运行状态。', 'error');
      }
    });
  }

  async function exportAllToSiyuan() {
    if (pagesData.length === 0) {
      setSiyuanStatus('当前没有可导出的页面记录。', 'error');
      return;
    }

    const settings = await getSiyuanSettings();
    if (!settings.token) {
      openSiyuanPanel();
      setSiyuanStatus('请先填写思源 API Token。', 'error');
      return;
    }
    if (!settings.notebookId) {
      openSiyuanPanel();
      setSiyuanStatus('请先选择目标笔记本。', 'error');
      return;
    }

    await withSiyuanBusy(async () => {
      setSiyuanStatus('正在导出全部记录到思源...', '');
      try {
        const bundle = window.HighlightExport.buildExportBundle(pagesData, { source: 'options' });
        const result = await window.HighlightSiyuanExporter.exportBundleToSiyuan(bundle, { settings });
        if (!result || !result.ok) {
          setSiyuanStatus((result && result.message) || '导出到思源失败。', 'error');
          return;
        }

        updateSiyuanSummary(result.settings || await getSiyuanSettings());
        setSiyuanStatus(`导出成功，已创建文档：${result.docPath}`, 'success');
      } catch (err) {
        console.warn('导出到思源失败', err);
        setSiyuanStatus('导出到思源失败，请检查服务地址、Token 或思源运行状态。', 'error');
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

  async function exportPages(pages, format) {
    if (!pages || pages.length === 0) {
      alert('没有可导出的内容');
      return;
    }

    const bundle = window.HighlightExport.buildExportBundle(pages, { source: 'options' });
    const targetFormat = format || 'markdown';
    let ok = false;

    if (targetFormat === 'obsidian') {
      if (!window.HighlightObsidianExporter || typeof window.HighlightObsidianExporter.exportBundleToObsidian !== 'function') {
        alert('Obsidian 导出功能暂不可用');
        return;
      }

      const settings = await getObsidianSettings();
      if (!settings.vault) {
        openObsidianPanel();
        setObsidianStatus('请先完成 Obsidian 配置，再执行导出。', 'error');
        return;
      }

      const result = await window.HighlightObsidianExporter.exportBundleToObsidian(bundle, { settings });
      if (!result.ok) {
        openObsidianPanel();
        setObsidianStatus(result.message || '发送到 Obsidian 失败。', 'error');
        return;
      }

      updateObsidianSummary(await getObsidianSettings());
      setObsidianStatus(`已发送到 Obsidian：${result.filePath}`, 'success');
      return;
    }

    if (targetFormat === 'siyuan') {
      if (!window.HighlightSiyuanExporter || typeof window.HighlightSiyuanExporter.exportBundleToSiyuan !== 'function') {
        alert('思源导出功能暂不可用');
        return;
      }

      const settings = await getSiyuanSettings();
      if (!settings.token) {
        openSiyuanPanel();
        setSiyuanStatus('请先完成思源配置，再执行导出。', 'error');
        return;
      }
      if (!settings.notebookId) {
        openSiyuanPanel();
        setSiyuanStatus('请先选择思源目标笔记本，再执行导出。', 'error');
        return;
      }

      const result = await window.HighlightSiyuanExporter.exportBundleToSiyuan(bundle, { settings });
      if (!result.ok) {
        openSiyuanPanel();
        setSiyuanStatus(result.message || '发送到思源失败。', 'error');
        return;
      }

      updateSiyuanSummary(result.settings || await getSiyuanSettings());
      setSiyuanStatus(`已发送到思源：${result.docPath}`, 'success');
      return;
    }

    ok = targetFormat === 'html'
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

        if (format === 'markdown' || format === 'html' || format === 'obsidian') {
          await exportPages(pagesData, format);
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
      openMowenPanel();
      setMowenFormVisible(true);
      setObsidianFormVisible(false);
      if (mowenApiKeyInput) {
        mowenApiKeyInput.focus();
      }
    });
  }

  if (obsidianConfigEditBtn) {
    obsidianConfigEditBtn.addEventListener('click', () => {
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
      setObsidianFormVisible(false);
      setSiyuanFormVisible(false);
      testMowenExport();
    });
  }

  if (obsidianSaveBtn) {
    obsidianSaveBtn.addEventListener('click', () => {
      saveObsidianSettings().catch(err => {
        console.warn('保存 Obsidian 设置失败', err);
        setObsidianStatus('保存设置失败，请稍后重试。', 'error');
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
        setSiyuanStatus('保存设置失败，请稍后重试。', 'error');
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
  renderBlacklist();
  loadMowenSettings().catch(err => {
    console.warn('加载墨问设置失败', err);
    setMowenStatus('加载墨问设置失败。', 'error');
  });
  loadObsidianSettings().catch(err => {
    console.warn('加载 Obsidian 设置失败', err);
    setObsidianStatus('加载 Obsidian 设置失败。', 'error');
  });
  loadSiyuanSettings().catch(err => {
    console.warn('加载思源设置失败', err);
    setSiyuanStatus('加载思源设置失败。', 'error');
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
