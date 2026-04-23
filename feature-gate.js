// Shared feature gate placeholder.
// Keeps free/paid feature decisions out of page UI logic.

(function () {
  'use strict';

  const FEATURE_STATES = {
    'export.markdown': { enabled: true, tier: 'free' },
    'export.mowen': { enabled: true, tier: 'free' },
    'export.notion': { enabled: true, tier: 'paid' },
    'export.obsidian': { enabled: true, tier: 'paid' },
    'export.siyuan': { enabled: true, tier: 'paid' }
  };

  function getFeatureState(featureName) {
    if (!featureName || !FEATURE_STATES[featureName]) {
      return {
        enabled: false,
        tier: 'unknown',
        reason: 'unknown_feature'
      };
    }

    const state = FEATURE_STATES[featureName];
    return {
      enabled: !!state.enabled,
      tier: state.tier || 'free',
      reason: state.enabled ? '' : 'feature_locked'
    };
  }

  function canUseFeature(featureName) {
    return getFeatureState(featureName).enabled;
  }

  window.FeatureGate = window.FeatureGate || {};
  window.FeatureGate.getFeatureState = getFeatureState;
  window.FeatureGate.canUseFeature = canUseFeature;
})();
