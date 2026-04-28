// Mowen exporter.
// Creates private notes via Mowen Open API using autoPublish=false.

(function () {
  'use strict';

  const CREATE_NOTE_URL = 'https://open.mowen.cn/api/open/api/v1/note/create';

  function t(key, params, fallback) {
    return window.CatI18n && typeof window.CatI18n.t === 'function'
      ? window.CatI18n.t(key, params, fallback)
      : (fallback || key);
  }

  function getAnnotationLabel() {
    return t('annotationPrefix', null, '批注：').replace(/[:：]\s*$/, '');
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  function normalizeTags(input) {
    if (Array.isArray(input)) {
      return input
        .map(tag => String(tag || '').trim())
        .filter(Boolean)
        .filter((tag, index, arr) => arr.indexOf(tag) === index);
    }

    return String(input || '')
      .split(/[,\n，]/)
      .map(tag => tag.trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index);
  }

  function buildTextNode(text, marks) {
    const content = normalizeText(text);
    if (!content) return null;
    const node = {
      type: 'text',
      text: content
    };
    if (Array.isArray(marks) && marks.length > 0) {
      node.marks = marks;
    }
    return node;
  }

  function buildParagraphNode(textOrContent) {
    if (Array.isArray(textOrContent)) {
      const content = textOrContent.filter(Boolean);
      return {
        type: 'paragraph',
        content
      };
    }

    const textNode = buildTextNode(textOrContent);
    if (!textNode) return null;
    return {
      type: 'paragraph',
      content: [textNode]
    };
  }

  function buildEmptyParagraphNode() {
    return {
      type: 'paragraph',
      content: []
    };
  }

  function buildLinkParagraphNode(label, url) {
    const href = normalizeText(url);
    if (!href) return null;

    return buildParagraphNode([
      buildTextNode(label || `【${t('originalLink', null, '原文链接')}】`, [
        {
          type: 'link',
          attrs: {
            href,
            target: '_blank'
          }
        }
      ])
    ]);
  }

  function buildDocFromContent(content) {
    const blocks = Array.isArray(content) ? content.filter(Boolean) : [];

    return {
      type: 'doc',
      content: blocks
    };
  }

  function getHighlightLabel(item) {
    if (window.HighlightExport && typeof window.HighlightExport.getHighlightStyleLabel === 'function') {
      return window.HighlightExport.getHighlightStyleLabel(item).replace(/^\[|\]$/g, '');
    }
    return item && item.type === 'underline'
      ? t('underlineLabel', null, '划线')
      : t('highlightYellowLabel', null, '高亮/黄');
  }

  function pushMultilineParagraphs(target, text, firstPrefix, restPrefix) {
    const normalized = normalizeText(text);
    if (!normalized) return;

    const lines = normalized.split('\n').filter(Boolean);
    lines.forEach((line, index) => {
      if (index === 0) {
        target.push(buildParagraphNode(`${firstPrefix || ''}${line}`));
      } else {
        target.push(buildParagraphNode(`${restPrefix || ''}${line}`));
      }
    });
  }

  function pushSectionTitle(target, text) {
    const title = normalizeText(text);
    if (!title) return;
    target.push(buildParagraphNode(title));
  }

  function buildBundleContent(bundle) {
    const content = [];
    if (!bundle || !Array.isArray(bundle.pages)) return content;

    bundle.pages.forEach((page, pageIndex) => {
      const title = normalizeText(page.title || page.url || t('unnamedPage', null, '未命名页面'));
      const url = normalizeText(page.url);
      const note = normalizeText(page.note);
      const highlights = Array.isArray(page.highlights) ? page.highlights : [];

      content.push(buildParagraphNode(title));
      if (url) {
        content.push(buildLinkParagraphNode(`【${t('originalLink', null, '原文链接')}】`, url));
      }

      if (note) {
        content.push(buildEmptyParagraphNode());
        pushSectionTitle(content, `【${t('pageNote', null, '页面笔记')}】`);
        pushMultilineParagraphs(content, note, '', '');
      }

      if (highlights.length > 0) {
        content.push(buildEmptyParagraphNode());
        pushSectionTitle(content, `【${t('annotations', null, '标注')}】`);
        highlights.forEach((item, itemIndex) => {
          if (itemIndex > 0) {
            content.push(buildEmptyParagraphNode());
          }
          const label = getHighlightLabel(item);
          pushMultilineParagraphs(content, item.text, `【${label}】 `, '');
          if (item.annotation) {
            pushMultilineParagraphs(content, item.annotation, `【${getAnnotationLabel()}】 `, '');
          }
        });
      }

      if (pageIndex < bundle.pages.length - 1) {
        content.push(buildEmptyParagraphNode());
        content.push(buildParagraphNode('────────'));
        content.push(buildEmptyParagraphNode());
      }
    });

    return content;
  }

  function buildMowenPayload(bundle, options) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return null;
    }

    const tags = normalizeTags(options && options.tags);
    const body = buildDocFromContent(buildBundleContent(bundle));

    if (!body.content || body.content.length === 0) {
      return null;
    }

    return {
      body,
      settings: {
        autoPublish: false,
        tags
      }
    };
  }

  function buildTestPayload(options) {
    const tags = normalizeTags(options && options.tags);
    const lines = [
      t('mowenApiTestTitle', null, '划线猫 API 测试'),
      t('mowenApiTestNote', null, '这是一篇用于验证墨问 API Key 是否可用的私密测试笔记。'),
      t('mowenApiTestSuccess', null, '如果你能在墨问中看到这篇笔记，说明连接成功。')
    ];

    return {
      body: buildDocFromContent(lines.map(buildParagraphNode)),
      settings: {
        autoPublish: false,
        tags: tags.length > 0 ? tags : [t('sourceName', null, '划线猫'), t('testExportTag', null, '测试导出')]
      }
    };
  }

  function canExportToMowen() {
    if (!window.FeatureGate || typeof window.FeatureGate.canUseFeature !== 'function') {
      return false;
    }
    return window.FeatureGate.canUseFeature('export.mowen');
  }

  async function createNoteRequest(apiKey, requestBody) {
    const key = String(apiKey || '').trim();
    if (!key) {
      return { ok: false, reason: 'missing_api_key', message: t('fillMowenApiKey', null, '请先填写墨问 API Key') };
    }

    const response = await fetch(CREATE_NOTE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      const message = (data && (data.message || data.msg || data.error)) || `HTTP ${response.status}`;
      return {
        ok: false,
        reason: 'request_failed',
        status: response.status,
        data,
        message
      };
    }

    return {
      ok: true,
      noteId: data && data.noteId ? data.noteId : '',
      data
    };
  }

  async function exportBundleToMowen(bundle, options) {
    if (!canExportToMowen()) {
      return { ok: false, reason: 'feature_locked', message: t('mowenUnavailable', null, '墨问导出当前不可用') };
    }

    const payload = buildMowenPayload(bundle, options);
    if (!payload) {
      return { ok: false, reason: 'invalid_bundle', message: t('noExportContent', null, '没有可导出的内容') };
    }

    return createNoteRequest(options && options.apiKey, payload);
  }

  async function testMowenConnection(apiKey, options) {
    if (!canExportToMowen()) {
      return { ok: false, reason: 'feature_locked', message: t('mowenUnavailable', null, '墨问导出当前不可用') };
    }

    const payload = buildTestPayload(options);
    return createNoteRequest(apiKey, payload);
  }

  window.HighlightMowenExporter = window.HighlightMowenExporter || {};
  window.HighlightMowenExporter.normalizeTags = normalizeTags;
  window.HighlightMowenExporter.buildMowenPayload = buildMowenPayload;
  window.HighlightMowenExporter.buildTestPayload = buildTestPayload;
  window.HighlightMowenExporter.canExportToMowen = canExportToMowen;
  window.HighlightMowenExporter.exportBundleToMowen = exportBundleToMowen;
  window.HighlightMowenExporter.testMowenConnection = testMowenConnection;
})();
