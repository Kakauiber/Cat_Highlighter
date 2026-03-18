// Mowen exporter skeleton.
// Prepares a stable payload shape without exposing unfinished UI.

(function () {
  'use strict';

  function buildMowenPayload(bundle) {
    if (!bundle || !Array.isArray(bundle.pages)) {
      return null;
    }

    return {
      exportedAt: bundle.exportedAt || Date.now(),
      source: bundle.source || 'unknown',
      pages: bundle.pages.map(page => ({
        title: page.title || '',
        url: page.url || '',
        note: page.note || '',
        highlights: Array.isArray(page.highlights)
          ? page.highlights.map(item => ({
            text: item.text || '',
            color: item.color || 'yellow',
            annotation: item.annotation || ''
          }))
          : []
      }))
    };
  }

  function canExportToMowen() {
    if (!window.FeatureGate || typeof window.FeatureGate.canUseFeature !== 'function') {
      return false;
    }
    return window.FeatureGate.canUseFeature('export.mowen');
  }

  async function exportBundleToMowen(bundle, options) {
    if (!canExportToMowen()) {
      return { ok: false, reason: 'feature_locked' };
    }

    const payload = buildMowenPayload(bundle);
    if (!payload) {
      return { ok: false, reason: 'invalid_bundle' };
    }

    if (options && typeof options.transport === 'function') {
      return options.transport(payload);
    }

    // No transport configured yet. Keep the skeleton inert until the
    // real Mowen integration is implemented.
    return { ok: false, reason: 'transport_unconfigured', payload };
  }

  window.HighlightMowenExporter = window.HighlightMowenExporter || {};
  window.HighlightMowenExporter.buildMowenPayload = buildMowenPayload;
  window.HighlightMowenExporter.canExportToMowen = canExportToMowen;
  window.HighlightMowenExporter.exportBundleToMowen = exportBundleToMowen;
})();
