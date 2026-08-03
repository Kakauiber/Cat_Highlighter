// Shared export service for the highlighter extension.
// Builds a unified export bundle from page records and renders Markdown.

(function () {
  'use strict';

  const MARKDOWN_TEMPLATE_KEY = 'cat_markdown_export_template';
  const MAX_TEMPLATE_LENGTH = 20000;
  const TEMPLATE_VARIABLE_NAMES = [
    'title',
    'url',
    'source_link',
    'date',
    'note',
    'highlights',
    'note_section',
    'highlights_section'
  ];
  let customMarkdownTemplate = '';
  let templateLoaded = false;

  const TARGET_FEATURE_MAP = {
    html: 'export.markdown',
    markdown: 'export.markdown',
    mowen: 'export.mowen',
    notion: 'export.notion',
    obsidian: 'export.obsidian',
    siyuan: 'export.siyuan'
  };

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

  function getExportLocale() {
    return window.CatI18n && typeof window.CatI18n.getLanguage === 'function' && window.CatI18n.getLanguage() === 'en'
      ? 'en-US'
      : 'zh-CN';
  }

  function getHtmlLang() {
    return getExportLocale() === 'en-US' ? 'en' : 'zh-CN';
  }

  function labelSeparator() {
    return getExportLocale() === 'en-US' ? ': ' : '：';
  }

  function getAnnotationLabel() {
    return t('annotationPrefix', null, '批注：').replace(/[:：]\s*$/, '');
  }

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

  function getDefaultMarkdownTemplate() {
    return [
      '## {{title}}',
      '{{source_link}}',
      '',
      '{{note_section}}',
      '',
      '{{highlights_section}}'
    ].join('\n');
  }

  function normalizeTemplate(value) {
    return String(value || '').replace(/\r\n/g, '\n').trim();
  }

  function getActiveMarkdownTemplate() {
    return customMarkdownTemplate || getDefaultMarkdownTemplate();
  }

  function hasCustomMarkdownTemplate() {
    return Boolean(customMarkdownTemplate);
  }

  function validateMarkdownTemplate(value) {
    const template = normalizeTemplate(value);
    if (!template) {
      return { valid: false, reason: 'empty', unsupported: [] };
    }
    if (template.length > MAX_TEMPLATE_LENGTH) {
      return { valid: false, reason: 'too_long', unsupported: [] };
    }

    const unsupported = [];
    const variablePattern = /{{\s*([^{}]+?)\s*}}/g;
    let match = variablePattern.exec(template);
    while (match) {
      const name = String(match[1] || '').trim();
      if (!TEMPLATE_VARIABLE_NAMES.includes(name) && !unsupported.includes(name)) {
        unsupported.push(name);
      }
      match = variablePattern.exec(template);
    }

    return {
      valid: unsupported.length === 0,
      reason: unsupported.length > 0 ? 'unsupported' : '',
      unsupported
    };
  }

  async function loadMarkdownTemplate(options) {
    if (templateLoaded && !(options && options.force)) {
      return getActiveMarkdownTemplate();
    }

    const result = await chrome.storage.local.get([MARKDOWN_TEMPLATE_KEY]);
    const stored = normalizeTemplate(result[MARKDOWN_TEMPLATE_KEY]);
    const validation = stored ? validateMarkdownTemplate(stored) : { valid: true };
    customMarkdownTemplate = stored && validation.valid ? stored : '';
    templateLoaded = true;
    return getActiveMarkdownTemplate();
  }

  async function saveMarkdownTemplate(value) {
    const template = normalizeTemplate(value);
    const validation = validateMarkdownTemplate(template);
    if (!validation.valid) {
      return validation;
    }

    if (template === normalizeTemplate(getDefaultMarkdownTemplate())) {
      await chrome.storage.local.remove([MARKDOWN_TEMPLATE_KEY]);
      customMarkdownTemplate = '';
      templateLoaded = true;
      return { valid: true, reason: '', unsupported: [], isDefault: true };
    }

    await chrome.storage.local.set({ [MARKDOWN_TEMPLATE_KEY]: template });
    customMarkdownTemplate = template;
    templateLoaded = true;
    return { valid: true, reason: '', unsupported: [], isDefault: false };
  }

  async function resetMarkdownTemplate() {
    await chrome.storage.local.remove([MARKDOWN_TEMPLATE_KEY]);
    customMarkdownTemplate = '';
    templateLoaded = true;
    return getDefaultMarkdownTemplate();
  }

  function renderTemplate(template, variables) {
    return normalizeTemplate(template).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(variables, name)
        ? String(variables[name] || '')
        : match;
    });
  }

  function formatTemplateDate(timestamp) {
    return new Date(timestamp || Date.now()).toLocaleDateString(getExportLocale());
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
      return `[${t('underlineLabel', null, '划线')}]`;
    }

    switch (item.color) {
      case 'blue':
        return `[${t('highlightBlueLabel', null, '高亮/蓝')}]`;
      case 'red':
        return `[${t('highlightRedLabel', null, '高亮/红')}]`;
      case 'yellow':
      default:
        return `[${t('highlightYellowLabel', null, '高亮/黄')}]`;
    }
  }

  function renderHighlightMarkdownLines(item) {
    const text = normalizeMarkdownDisplayText(item.text);
    const lines = [`- ${getHighlightStyleLabel(item)} ${text}`];
    if (item.annotation) {
      lines.push(`  ${t('annotationPrefix', null, '批注：')}${normalizeMarkdownDisplayText(item.annotation)}`);
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

  function renderPageMarkdown(page, bundle) {
    const title = page.title || page.url || t('unnamedPage', null, '未命名页面');
    const note = page.note ? normalizeMarkdownDisplayText(page.note) : '';
    const highlights = page.highlights.length > 0
      ? page.highlights.flatMap(renderHighlightMarkdownLines).join('\n')
      : '';
    const noteSection = note
      ? `### ${t('pageNote', null, '页面笔记')}\n${note}`
      : '';
    const highlightsSection = highlights
      ? `### ${t('annotations', null, '标注')}\n${highlights}`
      : '';
    const rendered = renderTemplate(getActiveMarkdownTemplate(), {
      title: normalizeMarkdownDisplayText(title),
      url: page.url || '',
      source_link: page.url ? `${t('link', null, '链接')}${labelSeparator()}${page.url}` : '',
      date: formatTemplateDate(bundle && bundle.exportedAt),
      note,
      highlights,
      note_section: noteSection,
      highlights_section: highlightsSection
    });

    return rendered
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function exportBundleToMarkdown(bundle) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return '';
    }

    return bundle.pages.map(page => renderPageMarkdown(page, bundle)).filter(Boolean).join('\n\n');
  }

  function exportBundleToSiyuan(bundle) {
    return exportBundleToMarkdown(bundle);
  }

  function renderHighlightNotionLines(item) {
    const text = normalizeMarkdownDisplayText(item.text);
    if (!text) return [];

    const lines = [`- ${getHighlightStyleLabel(item)} ${text}`];
    if (item.annotation) {
      lines.push(`  - 【${getAnnotationLabel()}】${normalizeMarkdownDisplayText(item.annotation)}`);
    }
    return lines;
  }

  function renderPageNotion(page, index, isSinglePage) {
    const lines = [];
    const heading = page.title || page.url || t('unnamedPageWithIndex', { index: index + 1 }, `未命名页面 ${index + 1}`);

    if (!isSinglePage) {
      lines.push(`## ${heading}`);
    }

    if (page.url) {
      lines.push(`[${t('originalLink', null, '原文链接')}](${page.url})`);
    }

    if (page.note) {
      lines.push('');
      lines.push(`${isSinglePage ? '##' : '###'} ${t('pageNote', null, '页面笔记')}`);
      lines.push(normalizeMarkdownDisplayText(page.note));
    }

    if (page.highlights.length > 0) {
      lines.push('');
      lines.push(`${isSinglePage ? '##' : '###'} ${t('annotations', null, '标注')}`);
      page.highlights.forEach(item => {
        lines.push(...renderHighlightNotionLines(item));
      });
    }

    return lines.join('\n').trim();
  }

  function exportBundleToNotion(bundle) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return '';
    }

    if (hasCustomMarkdownTemplate()) {
      return exportBundleToMarkdown(bundle);
    }

    const isSinglePage = bundle.pages.length === 1;
    const title = isSinglePage
      ? (bundle.pages[0].title || bundle.pages[0].url || t('exportTitle', null, '划线猫导出'))
      : t('exportTitleWithCount', countParams(bundle.pageCount || bundle.pages.length, 'page'), `划线猫导出（${bundle.pageCount || bundle.pages.length} 页）`);
    const lines = [
      `# ${normalizeMarkdownDisplayText(title)}`,
      '',
      `${t('exportTime', null, '导出时间')}${labelSeparator()}${new Date(bundle.exportedAt || Date.now()).toLocaleString(getExportLocale())}`,
      `${t('source', null, '来源')}${labelSeparator()}${t('sourceName', null, '划线猫')}`
    ];

    const body = bundle.pages
      .map((page, index) => renderPageNotion(page, index, isSinglePage))
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (body) {
      lines.push('', body);
    }

    return lines.join('\n').trim();
  }

  function normalizeObsidianText(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function escapeYamlString(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  function formatObsidianDateTime(timestamp) {
    const date = new Date(timestamp || Date.now());
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  function renderNoteCalloutLines(note) {
    const text = normalizeObsidianText(note);
    if (!text) return [];

    const lines = text.split('\n');
    return [`> [!note] ${t('pageNote', null, '页面笔记')}`].concat(lines.map(line => `> ${line}`));
  }

  function renderHighlightObsidianLines(item) {
    const text = normalizeObsidianText(item.text);
    if (!text) return [];

    const lines = [`- ${getHighlightStyleLabel(item)} ${text}`];
    if (item.annotation) {
      lines.push(`  - 【${getAnnotationLabel()}】${normalizeObsidianText(item.annotation)}`);
    }
    return lines;
  }

  function renderPageObsidian(page, index) {
    const lines = [];
    const heading = page.title || page.url || t('unnamedPageWithIndex', { index: index + 1 }, `未命名页面 ${index + 1}`);
    lines.push(`## ${heading}`);

    if (page.url) {
      lines.push(`[${t('originalLink', null, '原文链接')}](${page.url})`);
    }

    if (page.note) {
      lines.push('');
      lines.push(...renderNoteCalloutLines(page.note));
    }

    if (page.highlights.length > 0) {
      lines.push('');
      lines.push(`### ${t('annotations', null, '标注')}`);
      page.highlights.forEach(item => {
        lines.push(...renderHighlightObsidianLines(item));
      });
    }

    return lines.join('\n');
  }

  function exportBundleToObsidian(bundle) {
    if (!bundle || !Array.isArray(bundle.pages) || bundle.pages.length === 0) {
      return '';
    }

    const title = bundle.pageCount === 1
      ? (bundle.pages[0].title || bundle.pages[0].url || t('exportTitle', null, '划线猫导出'))
      : t('exportTitleWithCount', countParams(bundle.pageCount, 'page'), `划线猫导出（${bundle.pageCount} 页）`);

    const frontmatter = [
      '---',
      `title: "${escapeYamlString(title)}"`,
      `source: "${escapeYamlString(t('sourceName', null, '划线猫'))}"`,
      `exported_at: "${formatObsidianDateTime(bundle.exportedAt)}"`,
      `page_count: ${bundle.pageCount || 0}`,
      'tags:',
      `  - ${t('sourceName', null, '划线猫')}`,
      '  - Obsidian',
      '---'
    ];

    const body = hasCustomMarkdownTemplate()
      ? exportBundleToMarkdown(bundle)
      : bundle.pages.map(renderPageObsidian).join('\n\n');
    return frontmatter.concat(['', `# ${title}`, '', body]).join('\n');
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
      parts.push(`  <div class="highlight-annotation">${escapeHtml(t('annotationPrefix', null, '批注：'))}${formatMultilineHtml(item.annotation)}</div>`);
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  function renderPageHtml(page) {
    const parts = [
      '<section class="page-block">',
      `  <h2>${escapeHtml(page.title || page.url || t('unnamedPage', null, '未命名页面'))}</h2>`
    ];

    if (page.url) {
      parts.push(`  <p class="page-link"><a href="${escapeHtml(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.url)}</a></p>`);
    }

    if (page.note) {
      parts.push('  <section class="page-section">');
      parts.push(`    <h3>${escapeHtml(t('pageNote', null, '页面笔记'))}</h3>`);
      parts.push(`    <div class="page-note">${formatMultilineHtml(page.note)}</div>`);
      parts.push('  </section>');
    }

    if (page.highlights.length > 0) {
      parts.push('  <section class="page-section">');
      parts.push(`    <h3>${escapeHtml(t('annotations', null, '标注'))}</h3>`);
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
      `<html lang="${getHtmlLang()}">`,
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      `  <title>${escapeHtml(t('exportTitle', null, '划线猫导出'))}</title>`,
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
      `      <h1>${escapeHtml(t('exportTitle', null, '划线猫导出'))}</h1>`,
      `      <div class="export-meta">${escapeHtml(t('exportPageCount', null, '导出页面数'))}${escapeHtml(labelSeparator())}${bundle.pageCount || 0} · ${escapeHtml(t('exportTime', null, '导出时间'))}${escapeHtml(labelSeparator())}${escapeHtml(new Date(bundle.exportedAt || Date.now()).toLocaleString(getExportLocale()))}</div>`,
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

  function downloadBundleAsObsidian(bundle, filenamePrefix) {
    const content = exportBundleToObsidian(bundle);
    if (!content) return false;

    const stamp = formatDateStamp(bundle && bundle.exportedAt);
    downloadTextFile(
      content,
      `${filenamePrefix || 'catlines_obsidian'}_${stamp}.md`,
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
  window.HighlightExport.exportBundleToSiyuan = exportBundleToSiyuan;
  window.HighlightExport.exportBundleToNotion = exportBundleToNotion;
  window.HighlightExport.exportBundleToHtml = exportBundleToHtml;
  window.HighlightExport.exportBundleToObsidian = exportBundleToObsidian;
  window.HighlightExport.downloadBundleAsMarkdown = downloadBundleAsMarkdown;
  window.HighlightExport.downloadBundleAsHtml = downloadBundleAsHtml;
  window.HighlightExport.downloadBundleAsObsidian = downloadBundleAsObsidian;
  window.HighlightExport.getExportTargetState = getExportTargetState;
  window.HighlightExport.normalizeHighlightColor = normalizeHighlightColor;
  window.HighlightExport.getHighlightStyleLabel = getHighlightStyleLabel;
  window.HighlightExport.renderHighlightMarkdownLines = renderHighlightMarkdownLines;
  window.HighlightExport.MARKDOWN_TEMPLATE_KEY = MARKDOWN_TEMPLATE_KEY;
  window.HighlightExport.MAX_TEMPLATE_LENGTH = MAX_TEMPLATE_LENGTH;
  window.HighlightExport.TEMPLATE_VARIABLE_NAMES = TEMPLATE_VARIABLE_NAMES.slice();
  window.HighlightExport.getDefaultMarkdownTemplate = getDefaultMarkdownTemplate;
  window.HighlightExport.getActiveMarkdownTemplate = getActiveMarkdownTemplate;
  window.HighlightExport.hasCustomMarkdownTemplate = hasCustomMarkdownTemplate;
  window.HighlightExport.validateMarkdownTemplate = validateMarkdownTemplate;
  window.HighlightExport.loadMarkdownTemplate = loadMarkdownTemplate;
  window.HighlightExport.saveMarkdownTemplate = saveMarkdownTemplate;
  window.HighlightExport.resetMarkdownTemplate = resetMarkdownTemplate;

  loadMarkdownTemplate().catch(err => {
    console.warn('[HighlightExport] Failed to load export template:', err);
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[MARKDOWN_TEMPLATE_KEY]) return;
      const nextValue = normalizeTemplate(changes[MARKDOWN_TEMPLATE_KEY].newValue);
      const validation = nextValue ? validateMarkdownTemplate(nextValue) : { valid: true };
      customMarkdownTemplate = nextValue && validation.valid ? nextValue : '';
      templateLoaded = true;
    });
  }
})();
