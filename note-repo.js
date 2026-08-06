// note-repo.js
// Storage CRUD for page notes. Uses chrome.storage.local with key prefix
// "page_notes_" to keep notes fully separate from highlight data.
//
// All functions are exposed via window.PageNotes (shared single namespace).

(function () {
  'use strict';

  var NOTE_PREFIX = 'page_notes_';

  function getStablePageUrl(url) {
    var raw = String(url || '').trim();
    if (!raw) return raw;

    try {
      var parsed = new URL(raw);
      var host = parsed.hostname.toLowerCase();
      var segments = parsed.pathname.split('/').filter(Boolean);
      var isKimiHost = /(\.|^)(kimi\.com|moonshot\.cn)$/i.test(host);

      if (isKimiHost && segments[0] && segments[0].toLowerCase() === 'chat' && segments.length >= 2) {
        var path = parsed.pathname.replace(/\/+$/, '');
        return 'https://www.kimi.com' + path;
      }
    } catch (err) { }

    return raw;
  }

  /**
   * Build the storage key for a given URL.
   * Kimi chat URLs use a stable conversation identity; other URLs remain exact.
   * @param {string} url
   * @returns {string}
   */
  function getNoteStorageKey(url) {
    return NOTE_PREFIX + getStablePageUrl(url);
  }

  /**
   * Read a single page note.
   * @param {string} url  Full page URL
   * @returns {Promise<Object|null>}  PageNoteRecord or null
   */
  async function getPageNote(url) {
    var key = getNoteStorageKey(url);
    var result = await chrome.storage.local.get([key]);
    return result[key] || null;
  }

  /**
   * Write a single page note.
   * @param {string} url  Full page URL
   * @param {Object} noteRecord  PageNoteRecord object
   * @returns {Promise<void>}
   */
  async function savePageNote(url, noteRecord) {
    var key = getNoteStorageKey(url);
    await chrome.storage.local.set({ [key]: noteRecord });
  }

  /**
   * Delete a single page note.
   * @param {string} url  Full page URL
   * @returns {Promise<void>}
   */
  async function deletePageNote(url) {
    var key = getNoteStorageKey(url);
    await chrome.storage.local.remove(key);
  }

  /**
   * List all page notes stored in chrome.storage.local.
   * Returns an array of PageNoteRecord objects (each already contains pageUrl).
   * @returns {Promise<Object[]>}
   */
  async function listAllPageNotes() {
    var all = await chrome.storage.local.get(null);
    var notes = [];

    Object.keys(all).forEach(function (key) {
      if (key.startsWith(NOTE_PREFIX)) {
        var record = all[key];
        if (record && typeof record === 'object' && record.pageUrl) {
          notes.push(record);
        }
      }
    });

    // Sort by most recently updated
    notes.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    return notes;
  }

  // --- Expose to shared namespace ---
  window.PageNotes = window.PageNotes || {};
  window.PageNotes.NOTE_PREFIX = NOTE_PREFIX;
  window.PageNotes.getNoteStorageKey = getNoteStorageKey;
  window.PageNotes.getPageNote = getPageNote;
  window.PageNotes.savePageNote = savePageNote;
  window.PageNotes.deletePageNote = deletePageNote;
  window.PageNotes.listAllPageNotes = listAllPageNotes;
})();
