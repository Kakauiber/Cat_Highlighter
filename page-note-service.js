// page-note-service.js
// Business logic helpers for page notes: content normalization, word counting,
// and draft creation.
//
// Appends to the shared window.PageNotes namespace initialised by note-repo.js.

(function () {
    'use strict';

    /**
     * Normalize note content:
     *  - Trim leading/trailing whitespace
     *  - Collapse 3+ consecutive newlines into 2
     *  - Normalize \r\n to \n
     * @param {string} content
     * @returns {string}
     */
    function normalizeNoteContent(content) {
        if (typeof content !== 'string') return '';
        return content
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Count words in mixed Chinese/English content.
     *  - CJK characters each count as 1 word
     *  - Consecutive Latin/digit sequences count as 1 word
     * @param {string} content
     * @returns {number}
     */
    function countWords(content) {
        if (typeof content !== 'string' || content.trim() === '') return 0;

        var count = 0;

        // Match CJK characters (each = 1 word)
        var cjkMatches = content.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff]/g);
        if (cjkMatches) {
            count += cjkMatches.length;
        }

        // Strip CJK, then count remaining word-like sequences (Latin, digits, etc.)
        var withoutCjk = content.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff]/g, ' ');
        var wordMatches = withoutCjk.match(/[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g);
        if (wordMatches) {
            count += wordMatches.length;
        }

        return count;
    }

    /**
     * Create or update a PageNoteRecord draft.
     *
     * If previousRecord is provided, preserves createdAt; otherwise sets it.
     * Always refreshes updatedAt and wordCount.
     *
     * @param {string} url        Full page URL
     * @param {string} title      Page title
     * @param {string} content    Raw note content (will be normalized)
     * @param {Object|null} previousRecord  Existing record, if any
     * @returns {Object}  PageNoteRecord
     */
    function createNoteDraft(url, title, content, previousRecord) {
        var normalized = normalizeNoteContent(content);
        var now = Date.now();

        return {
            pageUrl: url,
            pageTitle: title || '',
            content: normalized,
            createdAt: (previousRecord && previousRecord.createdAt) ? previousRecord.createdAt : now,
            updatedAt: now,
            wordCount: countWords(normalized)
        };
    }

    // --- Expose to shared namespace ---
    window.PageNotes = window.PageNotes || {};
    window.PageNotes.normalizeNoteContent = normalizeNoteContent;
    window.PageNotes.countWords = countWords;
    window.PageNotes.createNoteDraft = createNoteDraft;
})();
