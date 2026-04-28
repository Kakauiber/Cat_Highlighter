// Notion exporter.
// Creates child pages in a target Notion parent page via the official API.

(function () {
  'use strict';

  const NOTION_CREATE_PAGE_URL = 'https://api.notion.com/v1/pages';
  const NOTION_VERSION = '2026-03-11';
  const NOTION_TOKEN_KEY = 'notion_token';
  const NOTION_PARENT_PAGE_ID_KEY = 'notion_parent_page_id';
  const NOTION_LAST_TESTED_AT_KEY = 'notion_last_tested_at';
  const NOTION_LAST_TESTED_SIGNATURE_KEY = 'notion_last_tested_signature';

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

  function hyphenatePageId(compactId) {
    const id = String(compactId || '').replace(/-/g, '').trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(id)) return '';
    return [
      id.slice(0, 8),
      id.slice(8, 12),
      id.slice(12, 16),
      id.slice(16, 20),
      id.slice(20)
    ].join('-');
  }

  function normalizeParentPageId(value) {
    let input = String(value || '').trim();
    if (!input) return '';

    try {
      const url = new URL(input);
      const segments = url.pathname.split('/').filter(Boolean);
      input = segments[segments.length - 1] || input;
    } catch (err) {
      // Plain IDs are expected and do not need URL parsing.
    }

    input = decodeURIComponent(input).replace(/[?#].*$/, '').trim();

    const hyphenatedMatch = input.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    if (hyphenatedMatch) {
      return hyphenatePageId(hyphenatedMatch[0]);
    }

    const compactMatch = input.match(/([0-9a-fA-F]{32})$/);
    return compactMatch ? hyphenatePageId(compactMatch[1]) : '';
  }

  function buildSettingsSignature(settings) {
    const token = String(settings && settings.token || '').trim();
    const parentPageId = normalizeParentPageId(settings && settings.parentPageId);
    return `${token}::${parentPageId}`;
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
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${hour}.${minute}.${second}`;
  }

  function buildDefaultNoteTitle(bundle, explicitTitle) {
    if (explicitTitle) {
      return normalizeText(explicitTitle).split('\n')[0] || t('exportTitle', null, '划线猫导出');
    }

    if (bundle && Array.isArray(bundle.pages) && bundle.pages.length === 1) {
      const page = bundle.pages[0];
      return normalizeText(page && (page.title || page.url)).split('\n')[0] || t('exportTitle', null, '划线猫导出');
    }

    return t('exportTitle', null, '划线猫导出');
  }

  async function getSettings() {
    const result = await chrome.storage.local.get([
      NOTION_TOKEN_KEY,
      NOTION_PARENT_PAGE_ID_KEY,
      NOTION_LAST_TESTED_AT_KEY,
      NOTION_LAST_TESTED_SIGNATURE_KEY
    ]);

    return {
      token: String(result[NOTION_TOKEN_KEY] || '').trim(),
      parentPageId: normalizeParentPageId(result[NOTION_PARENT_PAGE_ID_KEY] || ''),
      lastTestedAt: Number(result[NOTION_LAST_TESTED_AT_KEY] || 0),
      lastTestedSignature: String(result[NOTION_LAST_TESTED_SIGNATURE_KEY] || '').trim()
    };
  }

  async function saveSettings(settings) {
    const token = String(settings && settings.token || '').trim();
    const parentPageId = normalizeParentPageId(settings && settings.parentPageId);
    const nextValues = {
      [NOTION_TOKEN_KEY]: token,
      [NOTION_PARENT_PAGE_ID_KEY]: parentPageId
    };

    const current = await getSettings();
    const currentSignature = buildSettingsSignature(current);
    const nextSignature = buildSettingsSignature({ token, parentPageId });
    if (current.lastTestedSignature && currentSignature !== nextSignature) {
      nextValues[NOTION_LAST_TESTED_AT_KEY] = 0;
      nextValues[NOTION_LAST_TESTED_SIGNATURE_KEY] = '';
    }

    await chrome.storage.local.set(nextValues);
    return getSettings();
  }

  async function markSettingsTested(settings) {
    const signature = buildSettingsSignature(settings);
    const timestamp = Date.now();
    await chrome.storage.local.set({
      [NOTION_LAST_TESTED_AT_KEY]: timestamp,
      [NOTION_LAST_TESTED_SIGNATURE_KEY]: signature
    });
    return getSettings();
  }

  function formatApiError(response, data) {
    const status = response && response.status ? response.status : 0;
    const code = data && data.code ? data.code : 'request_failed';
    const message = data && data.message ? data.message : '';

    if (status === 401) {
      return t('notionTokenInvalid', null, 'Notion API 集成密钥（Integration Token）无效或已失效，请重新检查。');
    }
    if (status === 403) {
      return t('notionNoPermission', null, 'Notion 集成没有权限写入该页面，请检查安装范围（Installation scope）或页面权限。');
    }
    if (status === 404 || code === 'object_not_found') {
      return t('notionPageNotFound', null, '找不到目标 Notion 页面，或该页面尚未加入集成的安装范围（Installation scope）。');
    }
    if (status === 400 || code === 'validation_error') {
      return message || t('notionValidationFailed', null, 'Notion 参数校验失败，请检查目标父页面链接或页面 ID（Page ID）。');
    }

    return message || `Notion HTTP ${status || 'unknown'}`;
  }

  async function createPage(settings, payload) {
    const token = String(settings && settings.token || '').trim();
    const parentPageId = normalizeParentPageId(settings && settings.parentPageId);
    const markdown = normalizeText(payload && payload.markdown);

    if (!token) {
      return { ok: false, message: t('fillNotionToken', null, '请先填写 Notion API 集成密钥（Integration Token）。'), code: 'missing_token' };
    }
    if (!parentPageId) {
      return { ok: false, message: t('fillNotionParent', null, '请先填写有效的 Notion 目标父页面链接或页面 ID（Page ID）。'), code: 'missing_parent_page' };
    }
    if (!markdown) {
      return { ok: false, message: t('noExportContent', null, '没有可导出的内容。'), code: 'empty_markdown' };
    }

    let response;
    try {
      response = await fetch(NOTION_CREATE_PAGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION
        },
        body: JSON.stringify({
          parent: { page_id: parentPageId },
          markdown
        })
      });
    } catch (err) {
      return {
        ok: false,
        message: t('notionNetworkFailed', null, '无法连接 Notion API。请检查网络，或稍后重试。'),
        code: 'network_error',
        error: err
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        message: formatApiError(response, data),
        code: data && data.code ? data.code : 'http_error',
        status: response.status,
        data
      };
    }

    return {
      ok: true,
      pageId: data && data.id ? data.id : '',
      url: data && data.url ? data.url : '',
      data
    };
  }

  async function exportBundleToNotion(bundle, options) {
    if (!window.HighlightExport || typeof window.HighlightExport.exportBundleToNotion !== 'function') {
      return { ok: false, message: t('notionExportFeatureUnavailable', null, 'Notion 导出能力尚未准备好。') };
    }

    const settings = options && options.settings ? options.settings : await getSettings();
    const content = window.HighlightExport.exportBundleToNotion(bundle);
    if (!content) {
      return { ok: false, message: t('noExportContent', null, '没有可导出的内容。'), code: 'empty_bundle' };
    }

    const result = await createPage(settings, {
      markdown: content,
      title: buildDefaultNoteTitle(bundle, options && options.noteTitle)
    });

    if (!result.ok) {
      return result;
    }

    const latestSettings = await markSettingsTested(settings);
    return {
      ok: true,
      pageId: result.pageId,
      url: result.url,
      noteTitle: buildDefaultNoteTitle(bundle, options && options.noteTitle),
      settings: latestSettings
    };
  }

  async function testNotionConnection(settings) {
    const now = Date.now();
    const bundle = {
      exportedAt: now,
      pageCount: 1,
      pages: [
        {
          title: t('notionTestTitle', null, '划线猫 Notion 测试'),
          url: '',
          note: t('notionTestNote', null, '这是一条测试笔记，用于确认划线猫可以通过 Notion API 创建私密页面。'),
          noteWordCount: 0,
          highlights: [
            {
              id: 'notion-test-highlight',
              text: t('exportTestHighlight', { target: 'Notion' }, '如果你在 Notion 中看到了这段内容，说明导出链路已经打通。'),
              type: 'highlight',
              color: 'yellow',
              annotation: t('exportTestAnnotation', null, '测试成功后即可开始正式导出。'),
              timestamp: now
            }
          ]
        }
      ]
    };

    const result = await exportBundleToNotion(bundle, {
      settings,
      noteTitle: `${t('notionTestTitle', null, '划线猫 Notion 测试')} ${formatDateStamp(now)} ${formatTimeStamp(now)}`
    });

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      pageId: result.pageId,
      url: result.url,
      settings: result.settings,
      message: t('notionTestSucceeded', null, '测试成功，已在 Notion 中创建测试页面。')
    };
  }

  window.HighlightNotionExporter = window.HighlightNotionExporter || {};
  window.HighlightNotionExporter.NOTION_TOKEN_KEY = NOTION_TOKEN_KEY;
  window.HighlightNotionExporter.NOTION_PARENT_PAGE_ID_KEY = NOTION_PARENT_PAGE_ID_KEY;
  window.HighlightNotionExporter.NOTION_LAST_TESTED_AT_KEY = NOTION_LAST_TESTED_AT_KEY;
  window.HighlightNotionExporter.NOTION_LAST_TESTED_SIGNATURE_KEY = NOTION_LAST_TESTED_SIGNATURE_KEY;
  window.HighlightNotionExporter.NOTION_VERSION = NOTION_VERSION;
  window.HighlightNotionExporter.normalizeParentPageId = normalizeParentPageId;
  window.HighlightNotionExporter.buildSettingsSignature = buildSettingsSignature;
  window.HighlightNotionExporter.buildDefaultNoteTitle = buildDefaultNoteTitle;
  window.HighlightNotionExporter.getSettings = getSettings;
  window.HighlightNotionExporter.saveSettings = saveSettings;
  window.HighlightNotionExporter.markSettingsTested = markSettingsTested;
  window.HighlightNotionExporter.createPage = createPage;
  window.HighlightNotionExporter.exportBundleToNotion = exportBundleToNotion;
  window.HighlightNotionExporter.testNotionConnection = testNotionConnection;
})();
