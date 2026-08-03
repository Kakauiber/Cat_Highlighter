# Changelog

All notable changes to Cat Highlighter are documented in this file.

## v1.4.0 - 2026-05-20

### Added

- Page-level tags for saved web pages and AI conversations.
- Add or remove page tags from the side panel and manager page.
- Filter manager records by tag, including a `No Tags` view.
- Manage tags in Settings, including renaming or deleting tags across all pages.

### Improved

- Deleting a tag now clearly explains that only the tag is removed; pages, highlights, and notes are not deleted.
- The side panel current-page action area is more compact: page tags now sit next to page export, while low-frequency page deletion remains available from the manager.

## v1.3.0 - 2026-05-11

### Added

- Keyboard shortcuts for quick highlighting and underlining after selecting text.
- Mac shortcuts use `Control + Y/B/R/U`; Windows and Linux shortcuts use `Alt + Y/B/R/U`.
- Settings switch for enabling or disabling keyboard shortcuts.

### Improved

- Toolbar auto-hide delay reduced to make selection workflows less intrusive.
- Keyboard shortcut help text now adapts to the current platform.

## v1.2.0 - 2026-05-09

### Added

- Toolbar auto-hide after selecting text when no action is taken.
- Manager page source navigation: open original pages and jump back to individual highlights.
- Update notice card and release history support for this release.

### Improved

- More reliable highlight locating on slower AI chat pages such as ChatGPT.
- Existing highlight locating now restores the target highlight on demand before scrolling.

## v1.1.0 - 2026-04-30

### Added

- English UI support and improved bilingual text consistency for Chrome Web Store international users.
- Direct toolbar actions from existing highlights: click a saved highlight or underline to copy, annotate, delete, recolor, or convert it without selecting the text again.

### Improved

- Unified export success feedback for Mowen and SiYuan exports to reduce duplicate exports caused by unclear completion status.
- Manager page page-level export now uses the same export choices as the side panel.
- Full-export note titles are unified across supported note destinations.

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
