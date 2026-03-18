// Shared export service for the highlighter extension.
// Builds a unified export bundle from page records and renders Markdown.

(function () {
  'use strict';

  const TARGET_FEATURE_MAP = {
    html: 'export.markdown',
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

  function normalizeMarkdownDisplayText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
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
    const text = normalizeMarkdownDisplayText(item.text);
    const lines = [`- ${getHighlightStyleLabel(item)} ${text}`];
    if (item.annotation) {
      lines.push(`  批注：${normalizeMarkdownDisplayText(item.annotation)}`);
    }
    return lines;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeHtmlDisplayText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatMultilineHtml(value) {
    return escapeHtml(normalizeHtmlDisplayText(value)).replace(/\n/g, '<br>');
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
      lines.push(normalizeMarkdownDisplayText(page.note));
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

  function renderHighlightHtml(item) {
    const typeClass = item.type === 'underline' ? 'type-underline' : 'type-highlight';
    const colorClass = `color-${item.color}`;
    const parts = [
      `<div class="highlight-item ${typeClass} ${colorClass}">`,
      `  <span class="highlight-label">${escapeHtml(getHighlightStyleLabel(item).replace(/^\[|\]$/g, ''))}</span>`,
      `  <div class="highlight-text">${formatMultilineHtml(item.text)}</div>`
    ];

    if (item.annotation) {
      parts.push(`  <div class="highlight-annotation">批注：${formatMultilineHtml(item.annotation)}</div>`);
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  function renderPageHtml(page) {
    const parts = [
      '<section class="page-block">',
      `  <h2>${escapeHtml(page.title || page.url || '未命名页面')}</h2>`
    ];

    if (page.url) {
      parts.push(`  <p class="page-link"><a href="${escapeHtml(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.url)}</a></p>`);
    }

    if (page.note) {
      parts.push('  <section class="page-section">');
      parts.push('    <h3>页面笔记</h3>');
      parts.push(`    <div class="page-note">${formatMultilineHtml(page.note)}</div>`);
      parts.push('  </section>');
    }

    if (page.highlights.length > 0) {
      parts.push('  <section class="page-section">');
      parts.push('    <h3>标注</h3>');
      parts.push('    <div class="highlights-list">');
      page.highlights.forEach(item => {
        parts.push(renderHighlightHtml(item));
      });
      parts.push('    </div>');
      parts.push('  </section>');
    }

    parts.push('</section>');
    return parts.join('\n');
  }

  function exportBundleToHtml(bundle) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return '';
    }

    const pageHtml = bundle.pages.map(renderPageHtml).join('\n\n');
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>划线猫导出</title>',
      '  <style>',
      '    :root { color-scheme: light; }',
      '    body { margin: 0; padding: 32px; font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2937; background: #f8fafc; }',
      '    .export-shell { max-width: 920px; margin: 0 auto; }',
      '    .export-header { margin-bottom: 24px; }',
      '    .export-header h1 { margin: 0 0 8px; font-size: 28px; }',
      '    .export-meta { color: #6b7280; font-size: 14px; }',
      '    .page-block { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 24px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }',
      '    .page-block h2 { margin: 0 0 8px; font-size: 24px; }',
      '    .page-link { margin: 0 0 18px; word-break: break-all; }',
      '    .page-link a { color: #4f46e5; text-decoration: none; }',
      '    .page-link a:hover { text-decoration: underline; }',
      '    .page-section { margin-top: 16px; }',
      '    .page-section h3 { margin: 0 0 10px; font-size: 18px; }',
      '    .page-note { padding: 12px 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; white-space: normal; }',
      '    .highlights-list { display: grid; gap: 10px; }',
      '    .highlight-item { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px; background: #fff; }',
      '    .highlight-label { display: inline-block; margin-bottom: 6px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #374151; background: #eef2ff; }',
      '    .highlight-text { font-size: 15px; line-height: 1.55; }',
      '    .highlight-annotation { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db; color: #4b5563; font-size: 14px; }',
      '    .color-yellow .highlight-label { background: #fff6cc; color: #8a6700; }',
      '    .color-blue .highlight-label { background: #e0f0ff; color: #155e9a; }',
      '    .color-red .highlight-label { background: #ffe1e1; color: #a33a3a; }',
      '    .type-underline .highlight-text { text-decoration: underline 2px solid #1f2937; text-underline-offset: 3px; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div class="export-shell">',
      '    <header class="export-header">',
      '      <h1>划线猫导出</h1>',
      `      <div class="export-meta">导出页面数：${bundle.pageCount || 0} · 导出时间：${escapeHtml(new Date(bundle.exportedAt || Date.now()).toLocaleString('zh-CN'))}</div>`,
      '    </header>',
      pageHtml,
      '  </div>',
      '</body>',
      '</html>'
    ].join('\n');
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

  function downloadBundleAsHtml(bundle, filenamePrefix) {
    const content = exportBundleToHtml(bundle);
    if (!content) return false;

    const stamp = formatDateStamp(bundle && bundle.exportedAt);
    downloadTextFile(
      content,
      `${filenamePrefix || 'catlines'}_${stamp}.html`,
      'text/html;charset=utf-8'
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
  window.HighlightExport.exportBundleToHtml = exportBundleToHtml;
  window.HighlightExport.downloadBundleAsMarkdown = downloadBundleAsMarkdown;
  window.HighlightExport.downloadBundleAsHtml = downloadBundleAsHtml;
  window.HighlightExport.getExportTargetState = getExportTargetState;
  window.HighlightExport.normalizeHighlightColor = normalizeHighlightColor;
  window.HighlightExport.getHighlightStyleLabel = getHighlightStyleLabel;
  window.HighlightExport.renderHighlightMarkdownLines = renderHighlightMarkdownLines;
})();
