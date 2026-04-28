// Obsidian exporter.
// Sends notes into an Obsidian vault via obsidian://new and clipboard.

(function () {
  'use strict';

  const OBSIDIAN_VAULT_KEY = 'obsidian_vault';
  const OBSIDIAN_FOLDER_KEY = 'obsidian_folder';
  const OBSIDIAN_LAST_TESTED_AT_KEY = 'obsidian_last_tested_at';
  const OBSIDIAN_LAST_TESTED_SIGNATURE_KEY = 'obsidian_last_tested_signature';

  function t(key, params, fallback) {
    return window.CatI18n && typeof window.CatI18n.t === 'function'
      ? window.CatI18n.t(key, params, fallback)
      : (fallback || key);
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatDateStamp(timestamp) {
    const date = new Date(timestamp || Date.now());
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTimeStamp(timestamp) {
    const date = new Date(timestamp || Date.now());
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}.${minute}`;
  }

  function sanitizePathSegment(value, fallback) {
    const cleaned = String(value || '')
      .replace(/[\\/:*?"<>|#^\[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/g, '');

    return cleaned || (fallback || t('unnamedPage', null, '未命名笔记'));
  }

  function normalizeFolder(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .split('/')
      .map(part => sanitizePathSegment(part, ''))
      .filter(Boolean)
      .join('/');
  }

  function buildSettingsSignature(settings) {
    const vault = String(settings && settings.vault || '').trim();
    const folder = normalizeFolder(settings && settings.folder || '');
    return `${vault}::${folder}`;
  }

  function buildDefaultNoteTitle(bundle, explicitTitle) {
    if (explicitTitle) {
      return sanitizePathSegment(explicitTitle, t('exportTitle', null, '划线猫导出'));
    }

    if (bundle && Array.isArray(bundle.pages) && bundle.pages.length === 1) {
      const page = bundle.pages[0];
      return sanitizePathSegment(page && (page.title || page.url), t('exportTitle', null, '划线猫导出'));
    }

    const stamp = `${formatDateStamp(bundle && bundle.exportedAt)} ${formatTimeStamp(bundle && bundle.exportedAt)}`;
    return sanitizePathSegment(`${t('exportTitle', null, '划线猫导出')} ${stamp}`, t('exportTitle', null, '划线猫导出'));
  }

  function buildTargetFilePath(settings, noteTitle) {
    const folder = normalizeFolder(settings && settings.folder || '');
    const filename = `${sanitizePathSegment(noteTitle, t('exportTitle', null, '划线猫导出'))}.md`;
    return folder ? `${folder}/${filename}` : filename;
  }

  function buildObsidianUri(params) {
    const url = new URL('obsidian://new');
    url.searchParams.set('vault', String(params.vault || '').trim());
    url.searchParams.set('file', params.file || `${t('exportTitle', null, '划线猫导出')}.md`);

    if (params.clipboard) {
      url.searchParams.set('clipboard', 'true');
    }
    if (params.silent) {
      url.searchParams.set('silent', 'true');
    }
    if (params.append) {
      url.searchParams.set('append', 'true');
    }
    if (params.overwrite) {
      url.searchParams.set('overwrite', 'true');
    }
    if (params.content) {
      url.searchParams.set('content', params.content);
    }

    return url.toString();
  }

  async function writeClipboardText(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return { ok: false, message: t('noClipboardContent', null, '没有可写入剪贴板的内容。') };
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(normalized);
        return { ok: true, method: 'navigator.clipboard' };
      } catch (err) {
        // Fallback below.
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = normalized;
      textarea.setAttribute('readonly', 'readonly');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copied) {
        return { ok: true, method: 'execCommand' };
      }
    } catch (err) {
      // Fall through to unified error below.
    }

    return {
      ok: false,
      message: t('copyFailed', null, '写入剪贴板失败。请检查浏览器权限，或稍后重试。')
    };
  }

  function openObsidianUri(uri) {
    const anchor = document.createElement('a');
    anchor.href = uri;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  async function getSettings() {
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
      lastTestedSignature: String(result[OBSIDIAN_LAST_TESTED_SIGNATURE_KEY] || '')
    };
  }

  async function saveSettings(settings) {
    const vault = String(settings && settings.vault || '').trim();
    const folder = normalizeFolder(settings && settings.folder || '');
    const nextValues = {
      [OBSIDIAN_VAULT_KEY]: vault,
      [OBSIDIAN_FOLDER_KEY]: folder
    };

    const current = await getSettings();
    const currentSignature = buildSettingsSignature(current);
    const nextSignature = buildSettingsSignature({ vault, folder });
    if (current.lastTestedSignature && currentSignature !== nextSignature) {
      nextValues[OBSIDIAN_LAST_TESTED_AT_KEY] = 0;
      nextValues[OBSIDIAN_LAST_TESTED_SIGNATURE_KEY] = '';
    }

    await chrome.storage.local.set(nextValues);
    return getSettings();
  }

  async function markSettingsTested(settings) {
    const signature = buildSettingsSignature(settings);
    const timestamp = Date.now();
    await chrome.storage.local.set({
      [OBSIDIAN_LAST_TESTED_AT_KEY]: timestamp,
      [OBSIDIAN_LAST_TESTED_SIGNATURE_KEY]: signature
    });
    return getSettings();
  }

  async function exportBundleToObsidian(bundle, options) {
    if (!window.HighlightExport || typeof window.HighlightExport.exportBundleToObsidian !== 'function') {
      return { ok: false, message: t('obsidianFeatureUnavailable', null, 'Obsidian 导出能力尚未准备好。') };
    }

    const settings = options && options.settings ? options.settings : await getSettings();
    if (!settings.vault) {
      return { ok: false, message: t('fillObsidianVault', null, '请先配置 Obsidian Vault ID 或名称。'), code: 'missing_vault' };
    }

    const content = window.HighlightExport.exportBundleToObsidian(bundle);
    if (!content) {
      return { ok: false, message: t('noExportContent', null, '没有可导出的内容。'), code: 'empty_bundle' };
    }

    const noteTitle = buildDefaultNoteTitle(bundle, options && options.noteTitle);
    const filePath = buildTargetFilePath(settings, noteTitle);
    const clipboardResult = await writeClipboardText(content);
    if (!clipboardResult.ok) {
      return clipboardResult;
    }

    const uri = buildObsidianUri({
      vault: settings.vault,
      file: filePath,
      clipboard: true,
      silent: !!(options && options.silent)
    });

    openObsidianUri(uri);
    return {
      ok: true,
      noteTitle,
      filePath,
      uri,
      usedClipboard: true
    };
  }

  async function testObsidianConnection(settings) {
    const bundle = {
      exportedAt: Date.now(),
      pageCount: 1,
      pages: [
        {
          title: t('obsidianTestTitle', null, '划线猫 Obsidian 测试'),
          url: '',
          note: t('obsidianTestNote', null, '这是一条测试笔记，用于确认划线猫可以把内容直接发送到 Obsidian 仓库。'),
          noteWordCount: 0,
          highlights: [
            {
              id: 'obsidian-test-highlight',
              text: t('exportTestHighlight', { target: 'Obsidian' }, '如果你在 Obsidian 中看到了这条内容，说明发送链路已经打通。'),
              type: 'highlight',
              color: 'yellow',
              annotation: t('exportTestAnnotation', null, '测试完成后可直接删除此笔记。'),
              timestamp: Date.now()
            }
          ]
        }
      ]
    };

    const result = await exportBundleToObsidian(bundle, {
      settings,
      noteTitle: `${t('obsidianTestTitle', null, '划线猫 Obsidian 测试')} ${formatDateStamp(Date.now())} ${formatTimeStamp(Date.now())}`
    });

    if (!result.ok) {
      return result;
    }

    const latestSettings = await markSettingsTested(settings);
    return {
      ok: true,
      noteTitle: result.noteTitle,
      filePath: result.filePath,
      settings: latestSettings,
      message: t('obsidianTestSent', null, '已发出测试创建请求，请切换到 Obsidian 确认是否生成测试笔记。')
    };
  }

  window.HighlightObsidianExporter = window.HighlightObsidianExporter || {};
  window.HighlightObsidianExporter.OBSIDIAN_VAULT_KEY = OBSIDIAN_VAULT_KEY;
  window.HighlightObsidianExporter.OBSIDIAN_FOLDER_KEY = OBSIDIAN_FOLDER_KEY;
  window.HighlightObsidianExporter.OBSIDIAN_LAST_TESTED_AT_KEY = OBSIDIAN_LAST_TESTED_AT_KEY;
  window.HighlightObsidianExporter.OBSIDIAN_LAST_TESTED_SIGNATURE_KEY = OBSIDIAN_LAST_TESTED_SIGNATURE_KEY;
  window.HighlightObsidianExporter.getSettings = getSettings;
  window.HighlightObsidianExporter.saveSettings = saveSettings;
  window.HighlightObsidianExporter.markSettingsTested = markSettingsTested;
  window.HighlightObsidianExporter.buildSettingsSignature = buildSettingsSignature;
  window.HighlightObsidianExporter.buildDefaultNoteTitle = buildDefaultNoteTitle;
  window.HighlightObsidianExporter.exportBundleToObsidian = exportBundleToObsidian;
  window.HighlightObsidianExporter.testObsidianConnection = testObsidianConnection;
})();
