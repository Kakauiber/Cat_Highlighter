// SiYuan exporter.
// Writes notes directly into a SiYuan notebook via the local HTTP API.

(function () {
  'use strict';

  const DEFAULT_ENDPOINT = 'http://127.0.0.1:6806';
  const SIYUAN_ENDPOINT_KEY = 'siyuan_endpoint';
  const SIYUAN_TOKEN_KEY = 'siyuan_token';
  const SIYUAN_NOTEBOOK_ID_KEY = 'siyuan_notebook_id';
  const SIYUAN_NOTEBOOK_NAME_KEY = 'siyuan_notebook_name';
  const SIYUAN_FOLDER_KEY = 'siyuan_folder';
  const SIYUAN_LAST_TESTED_AT_KEY = 'siyuan_last_tested_at';
  const SIYUAN_LAST_TESTED_SIGNATURE_KEY = 'siyuan_last_tested_signature';

  function normalizeText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function normalizeEndpoint(value) {
    let input = String(value || '').trim();
    if (!input) return DEFAULT_ENDPOINT;

    if (!/^https?:\/\//i.test(input)) {
      input = `http://${input}`;
    }

    try {
      const url = new URL(input);
      const pathname = url.pathname.replace(/\/+$/, '');
      return `${url.origin}${pathname}`;
    } catch (err) {
      return DEFAULT_ENDPOINT;
    }
  }

  function sanitizePathSegment(value, fallback) {
    const cleaned = String(value || '')
      .replace(/[\\:*?"<>|#^\[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/g, '');

    return cleaned || (fallback || '未命名文档');
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
    const endpoint = normalizeEndpoint(settings && settings.endpoint);
    const token = String(settings && settings.token || '').trim();
    const notebookId = String(settings && settings.notebookId || '').trim();
    const folder = normalizeFolder(settings && settings.folder || '');
    return `${endpoint}::${token}::${notebookId}::${folder}`;
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
      return sanitizePathSegment(explicitTitle, '划线猫导出');
    }

    if (bundle && Array.isArray(bundle.pages) && bundle.pages.length === 1) {
      const page = bundle.pages[0];
      return sanitizePathSegment(page && (page.title || page.url), '划线猫导出');
    }

    return '划线猫导出';
  }

  function buildDocPath(settings, noteTitle, timestamp) {
    const folder = normalizeFolder(settings && settings.folder || '');
    const stamp = `${formatDateStamp(timestamp)} ${formatTimeStamp(timestamp)}`;
    const name = sanitizePathSegment(`${noteTitle} ${stamp}`, '划线猫导出');
    return folder ? `/${folder}/${name}` : `/${name}`;
  }

  function buildApiUrl(endpoint, apiPath) {
    return `${normalizeEndpoint(endpoint)}${apiPath}`;
  }

  async function request(endpoint, token, apiPath, body) {
    const apiToken = String(token || '').trim();
    if (!apiToken) {
      return { ok: false, message: '请先填写思源 API Token。', code: 'missing_token' };
    }

    let response;
    try {
      response = await fetch(buildApiUrl(endpoint, apiPath), {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
      });
    } catch (err) {
      return {
        ok: false,
        message: '无法连接到思源服务。请确认思源桌面版已启动，且服务地址可访问。',
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
        message: (data && (data.msg || data.message)) || `请求失败（HTTP ${response.status}）`,
        code: 'http_error',
        status: response.status,
        data
      };
    }

    if (data && typeof data.code === 'number' && data.code !== 0) {
      return {
        ok: false,
        message: data.msg || data.message || '思源接口返回失败',
        code: 'api_error',
        data
      };
    }

    return {
      ok: true,
      data
    };
  }

  function extractNotebookItems(payload) {
    if (!payload) return [];

    const source = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data && payload.data.notebooks)
        ? payload.data.notebooks
        : Array.isArray(payload.data && payload.data.boxes)
          ? payload.data.boxes
          : [];

    return source
      .map(item => ({
        id: String(item && (item.id || item.notebookId || item.box) || '').trim(),
        name: String(item && (item.name || item.notebookName || item.hPath || item.id) || '').trim(),
        closed: !!(item && item.closed)
      }))
      .filter(item => item.id && item.name);
  }

  async function listNotebooks(settings) {
    const result = await request(settings && settings.endpoint, settings && settings.token, '/api/notebook/lsNotebooks', {});
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      notebooks: extractNotebookItems(result.data)
    };
  }

  async function getSettings() {
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
      endpoint: normalizeEndpoint(result[SIYUAN_ENDPOINT_KEY] || DEFAULT_ENDPOINT),
      token: String(result[SIYUAN_TOKEN_KEY] || '').trim(),
      notebookId: String(result[SIYUAN_NOTEBOOK_ID_KEY] || '').trim(),
      notebookName: String(result[SIYUAN_NOTEBOOK_NAME_KEY] || '').trim(),
      folder: String(result[SIYUAN_FOLDER_KEY] || '').trim(),
      lastTestedAt: Number(result[SIYUAN_LAST_TESTED_AT_KEY] || 0),
      lastTestedSignature: String(result[SIYUAN_LAST_TESTED_SIGNATURE_KEY] || '').trim()
    };
  }

  async function saveSettings(settings) {
    const endpoint = normalizeEndpoint(settings && settings.endpoint || DEFAULT_ENDPOINT);
    const token = String(settings && settings.token || '').trim();
    const notebookId = String(settings && settings.notebookId || '').trim();
    const notebookName = String(settings && settings.notebookName || '').trim();
    const folder = normalizeFolder(settings && settings.folder || '');
    const nextValues = {
      [SIYUAN_ENDPOINT_KEY]: endpoint,
      [SIYUAN_TOKEN_KEY]: token,
      [SIYUAN_NOTEBOOK_ID_KEY]: notebookId,
      [SIYUAN_NOTEBOOK_NAME_KEY]: notebookName,
      [SIYUAN_FOLDER_KEY]: folder
    };

    const current = await getSettings();
    const currentSignature = buildSettingsSignature(current);
    const nextSignature = buildSettingsSignature({ endpoint, token, notebookId, folder });
    if (current.lastTestedSignature && currentSignature !== nextSignature) {
      nextValues[SIYUAN_LAST_TESTED_AT_KEY] = 0;
      nextValues[SIYUAN_LAST_TESTED_SIGNATURE_KEY] = '';
    }

    await chrome.storage.local.set(nextValues);
    return getSettings();
  }

  async function markSettingsTested(settings) {
    const signature = buildSettingsSignature(settings);
    const timestamp = Date.now();
    await chrome.storage.local.set({
      [SIYUAN_LAST_TESTED_AT_KEY]: timestamp,
      [SIYUAN_LAST_TESTED_SIGNATURE_KEY]: signature
    });
    return getSettings();
  }

  async function createDocWithMarkdown(settings, payload) {
    const notebookId = String(settings && settings.notebookId || '').trim();
    if (!notebookId) {
      return { ok: false, message: '请先选择目标笔记本。', code: 'missing_notebook' };
    }

    const markdown = normalizeText(payload && payload.markdown);
    if (!markdown) {
      return { ok: false, message: '没有可导出的内容。', code: 'empty_markdown' };
    }

    return request(settings && settings.endpoint, settings && settings.token, '/api/filetree/createDocWithMd', {
      notebook: notebookId,
      path: String(payload && payload.path || '').trim(),
      markdown
    });
  }

  async function exportBundleToSiyuan(bundle, options) {
    if (!window.HighlightExport || typeof window.HighlightExport.exportBundleToSiyuan !== 'function') {
      return { ok: false, message: '思源导出能力尚未准备好。' };
    }

    const settings = options && options.settings ? options.settings : await getSettings();
    if (!String(settings && settings.token || '').trim()) {
      return { ok: false, message: '请先配置思源 API Token。', code: 'missing_token' };
    }
    if (!String(settings && settings.notebookId || '').trim()) {
      return { ok: false, message: '请先选择目标笔记本。', code: 'missing_notebook' };
    }

    const content = window.HighlightExport.exportBundleToSiyuan(bundle);
    if (!content) {
      return { ok: false, message: '没有可导出的内容。', code: 'empty_bundle' };
    }

    const exportedAt = bundle && bundle.exportedAt ? bundle.exportedAt : Date.now();
    const noteTitle = buildDefaultNoteTitle(bundle, options && options.noteTitle);
    const docPath = buildDocPath(settings, noteTitle, exportedAt);
    const result = await createDocWithMarkdown(settings, {
      path: docPath,
      markdown: content
    });

    if (!result.ok) {
      return result;
    }

    const latestSettings = await markSettingsTested(settings);
    return {
      ok: true,
      docId: result.data && result.data.data ? result.data.data : '',
      docPath,
      noteTitle,
      settings: latestSettings
    };
  }

  async function testSiyuanConnection(settings) {
    const now = Date.now();
    const bundle = {
      exportedAt: now,
      pageCount: 1,
      pages: [
        {
          title: '划线猫 思源测试',
          url: '',
          note: '这是一条测试笔记，用于确认划线猫可以直接写入思源笔记。',
          noteWordCount: 0,
          highlights: [
            {
              id: 'siyuan-test-highlight',
              text: '如果你在思源中看到了这段内容，说明导出链路已经打通。',
              type: 'highlight',
              color: 'yellow',
              annotation: '测试成功后即可开始正式导出。',
              timestamp: now
            }
          ]
        }
      ]
    };

    const result = await exportBundleToSiyuan(bundle, {
      settings,
      noteTitle: `划线猫 思源测试 ${formatDateStamp(now)} ${formatTimeStamp(now)}`
    });

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      docId: result.docId,
      docPath: result.docPath,
      settings: result.settings,
      message: '测试成功，已在思源中创建测试文档。'
    };
  }

  window.HighlightSiyuanExporter = window.HighlightSiyuanExporter || {};
  window.HighlightSiyuanExporter.DEFAULT_ENDPOINT = DEFAULT_ENDPOINT;
  window.HighlightSiyuanExporter.SIYUAN_ENDPOINT_KEY = SIYUAN_ENDPOINT_KEY;
  window.HighlightSiyuanExporter.SIYUAN_TOKEN_KEY = SIYUAN_TOKEN_KEY;
  window.HighlightSiyuanExporter.SIYUAN_NOTEBOOK_ID_KEY = SIYUAN_NOTEBOOK_ID_KEY;
  window.HighlightSiyuanExporter.SIYUAN_NOTEBOOK_NAME_KEY = SIYUAN_NOTEBOOK_NAME_KEY;
  window.HighlightSiyuanExporter.SIYUAN_FOLDER_KEY = SIYUAN_FOLDER_KEY;
  window.HighlightSiyuanExporter.SIYUAN_LAST_TESTED_AT_KEY = SIYUAN_LAST_TESTED_AT_KEY;
  window.HighlightSiyuanExporter.SIYUAN_LAST_TESTED_SIGNATURE_KEY = SIYUAN_LAST_TESTED_SIGNATURE_KEY;
  window.HighlightSiyuanExporter.normalizeEndpoint = normalizeEndpoint;
  window.HighlightSiyuanExporter.normalizeFolder = normalizeFolder;
  window.HighlightSiyuanExporter.buildSettingsSignature = buildSettingsSignature;
  window.HighlightSiyuanExporter.buildDefaultNoteTitle = buildDefaultNoteTitle;
  window.HighlightSiyuanExporter.getSettings = getSettings;
  window.HighlightSiyuanExporter.saveSettings = saveSettings;
  window.HighlightSiyuanExporter.markSettingsTested = markSettingsTested;
  window.HighlightSiyuanExporter.listNotebooks = listNotebooks;
  window.HighlightSiyuanExporter.exportBundleToSiyuan = exportBundleToSiyuan;
  window.HighlightSiyuanExporter.testSiyuanConnection = testSiyuanConnection;
})();
