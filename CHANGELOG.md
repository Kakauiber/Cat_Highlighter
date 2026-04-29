# Changelog

All notable changes to Cat Highlighter are documented in this file.

## v1.0.0 - 2026-04-28

Initial public release.

### Added

- Web text highlighting, underlining, annotation, deletion, and refresh recovery.
- Current-page side panel for highlights, page notes, copy, delete, sorting, and page-level export.
- Manager page for all saved pages, search, filters, selection, batch copy, batch delete, and export all.
- Page notes for recording thoughts, questions, and follow-up prompts per page or AI conversation.
- Markdown and HTML export.
- Export integrations for Mowen, Notion, Obsidian, and SiYuan.
- Bilingual UI support for Simplified Chinese and English.
- Chrome Web Store release materials and privacy documentation.

### Privacy

- Records and export settings are stored locally in `chrome.storage.local` by default.
- Cat Highlighter does not use a custom server.
- Content is only sent to third-party services when the user explicitly exports to Mowen, Notion, or SiYuan.
- Obsidian export uses the local Obsidian protocol and clipboard.
