// Shared export service for the highlighter extension.
// Builds a unified export bundle from page records and renders Markdown.

(function () {
  'use strict';

  const TARGET_FEATURE_MAP = {
    markdown: 'export.markdown',
    mowen: 'export.mowen',
    notion: 'export.notion',
    obsidian: 'export.obsidian',
    siyuan: 'export.siyuan'
  };

  function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\r\n/g, '\n').trim();
  }

  function normalizeHighlightType(type) {
    return type === 'underline' ? 'underline' : 'highlight';
  }

  function normalizeHighlightColor(color) {
    switch (color) {
      case 'yellow':
        return 'yellow';
      case 'mint':
      case 'blue':
        return 'blue';
      case 'coral':
      case 'red':
        return 'red';
      default:
        return 'yellow';
    }
  }

  function getHighlightStyleLabel(item) {
    if (item.type === 'underline') {
      return '[划线]';
    }

    switch (item.color) {
      case 'blue':
        return '[高亮/蓝]';
      case 'red':
        return '[高亮/红]';
      case 'yellow':
      default:
        return '[高亮/黄]';
    }
  }

  function renderHighlightMarkdownLines(item) {
    const lines = [`- ${getHighlightStyleLabel(item)} ${item.text}`];
    if (item.annotation) {
      lines.push(`  批注：${item.annotation}`);
    }
    return lines;
  }

  function buildHighlightExportItem(item) {
    return {
      id: item && item.id ? item.id : '',
      text: normalizeText(item && item.text),
      type: normalizeHighlightType(item && item.type),
      color: normalizeHighlightColor(item && item.color),
      annotation: normalizeText(item && item.annotation),
      timestamp: item && item.timestamp ? item.timestamp : 0
    };
  }

  function buildPageExportItem(page) {
    const noteContent = normalizeText(page && page.note && page.note.content);
    const highlights = Array.isArray(page && page.highlights)
      ? page.highlights.map(buildHighlightExportItem).filter(item => item.text)
      : [];

    return {
      title: (page && page.title) || (page && page.url) || '',
      url: (page && page.url) || '',
      note: noteContent,
      noteWordCount: page && page.note && typeof page.note.wordCount === 'number'
        ? page.note.wordCount
        : 0,
      highlights
    };
  }

  function buildExportBundle(pages, meta) {
    const pageItems = Array.isArray(pages)
      ? pages.map(buildPageExportItem).filter(page => page.url || page.title)
      : [];

    return {
      exportedAt: Date.now(),
      source: meta && meta.source ? meta.source : 'unknown',
      pageCount: pageItems.length,
      pages: pageItems
    };
  }

  function renderPageMarkdown(page) {
    const lines = [];
    lines.push(`## ${page.title || page.url || '未命名页面'}`);
    if (page.url) {
      lines.push(`链接：${page.url}`);
    }

    if (page.note) {
      lines.push('');
      lines.push('### 页面笔记');
      lines.push(page.note);
    }

    if (page.highlights.length > 0) {
      lines.push('');
      lines.push('### 标注');
      page.highlights.forEach(item => {
        lines.push(...renderHighlightMarkdownLines(item));
      });
    }

    return lines.join('\n');
  }

  function exportBundleToMarkdown(bundle) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return '';
    }

    return bundle.pages.map(renderPageMarkdown).join('\n\n');
  }

  function formatDateStamp(timestamp) {
    const date = new Date(timestamp || Date.now());
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function downloadTextFile(content, filename, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadBundleAsMarkdown(bundle, filenamePrefix) {
    const content = exportBundleToMarkdown(bundle);
    if (!content) return false;

    const stamp = formatDateStamp(bundle && bundle.exportedAt);
    downloadTextFile(
      content,
      `${filenamePrefix || 'catlines'}_${stamp}.md`,
      'text/markdown;charset=utf-8'
    );
    return true;
  }

  function getExportTargetState(target) {
    const featureName = TARGET_FEATURE_MAP[target] || '';
    if (!window.FeatureGate || typeof window.FeatureGate.getFeatureState !== 'function') {
      return {
        target,
        enabled: target === 'markdown',
        tier: target === 'markdown' ? 'free' : 'unknown',
        reason: ''
      };
    }

    const state = featureName
      ? window.FeatureGate.getFeatureState(featureName)
      : { enabled: false, tier: 'unknown', reason: 'unknown_target' };

    return {
      target,
      enabled: !!state.enabled,
      tier: state.tier || 'unknown',
      reason: state.reason || ''
    };
  }

  window.HighlightExport = window.HighlightExport || {};
  window.HighlightExport.buildHighlightExportItem = buildHighlightExportItem;
  window.HighlightExport.buildPageExportItem = buildPageExportItem;
  window.HighlightExport.buildExportBundle = buildExportBundle;
  window.HighlightExport.exportBundleToMarkdown = exportBundleToMarkdown;
  window.HighlightExport.downloadBundleAsMarkdown = downloadBundleAsMarkdown;
  window.HighlightExport.getExportTargetState = getExportTargetState;
  window.HighlightExport.normalizeHighlightColor = normalizeHighlightColor;
  window.HighlightExport.getHighlightStyleLabel = getHighlightStyleLabel;
  window.HighlightExport.renderHighlightMarkdownLines = renderHighlightMarkdownLines;
})();
