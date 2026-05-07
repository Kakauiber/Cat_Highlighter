// Background service worker

const UPDATE_NOTICE_KEY = 'cat_pending_update_notice';

// Open Side Panel on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener((details) => {
    if (!details || details.reason !== 'update') {
        return;
    }

    const manifest = chrome.runtime.getManifest();
    chrome.storage.local.set({
        [UPDATE_NOTICE_KEY]: {
            version: manifest.version,
            previousVersion: details.previousVersion || '',
            createdAt: Date.now(),
            seen: false
        }
    }).catch((error) => {
        console.warn('[CatHighlighter] Failed to store update notice:', error);
    });
});
