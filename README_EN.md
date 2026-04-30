# Cat Highlighter

[中文](README.md) | English

Chrome Web Store: [Install Cat Highlighter](https://chromewebstore.google.com/detail/%E5%88%92%E7%BA%BF%E7%8C%AB/ihhfjhcehkggejpggnddmgpfdbkbobpd)

Privacy Policy: [PRIVACY.md](PRIVACY.md)

Support: [GitHub Issues](https://github.com/Kakauiber/Cat_Highlighter/issues)

Cat Highlighter is a browser annotation and page-note tool for web reading, research, and AI chat workflows. It helps you highlight, underline, annotate, write page notes, and export collected knowledge to Markdown, HTML, Mowen, Notion, Obsidian, or SiYuan.

It is especially useful on AI chat pages such as ChatGPT, Gemini, Kimi, DeepSeek, and Perplexity / Comet. Records are saved by page or conversation URL, so highlights can be restored after refreshing or reopening the page.

<p align="center">
  <img src="docs/assets/promo-marquee-1400x560.png" alt="Cat Highlighter: web highlights, page notes, and knowledge export" width="760">
</p>

<p align="center">
  <img src="docs/assets/01-toolbar-highlight.png" alt="Highlight, underline, and annotate selected text on a web page" width="30%">
  <img src="docs/assets/02-sidepanel-current-page.png" alt="Review current-page highlights and page notes in the side panel" width="30%">
  <img src="docs/assets/04-management-page.png" alt="Manage, filter, and export all saved records" width="30%">
</p>

## Core Features

- Highlight or underline selected text on web pages.
- Use yellow, blue, and red highlight colors.
- Add annotations to individual highlights.
- Write page notes for the current web page or AI conversation.
- Review current-page highlights and notes in the side panel.
- Copy, delete, or export the current page.
- Manage all saved pages in one place.
- Search, filter, batch copy, batch delete, and export records.
- Export to Markdown, HTML, Mowen, Notion, Obsidian, and SiYuan.
- Bilingual interface: Simplified Chinese and English.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Local Installation

For Chrome, Edge, Arc, Comet, and other Chromium-based browsers:

1. Open the browser extension management page.
2. Enable Developer Mode.
3. Click Load Unpacked.
4. Select this project folder.

Example project path:

```text
/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4
```

After installation, click the Cat Highlighter icon in the browser toolbar to open the side panel.

## Basic Usage

### Highlight Or Underline

1. Select text on a web page.
2. Choose a yellow, blue, or red highlight from the floating toolbar, or click the underline button.
3. The annotation is saved automatically.
4. After refreshing the page, saved highlights are restored automatically.

### Review Current-Page Records

Open the side panel:

- The Highlights tab shows all highlights and underlines on the current page.
- Use Ascending / Descending order to review older or newer records first.
- Each record can be copied, annotated, or deleted.
- Copy Page copies current-page notes and highlights as plain text.
- Delete Page removes all highlights from the current page.
- Export Page exports current-page notes and highlights.

### Page Notes

Switch to the Notes tab in the side panel to write notes for the current page or AI conversation.

Page notes are useful for:

- Questions that come up while reading.
- Summaries of highlighted content.
- Follow-up questions for AI chats.
- Judgments, remarks, and action items.

Notes are saved automatically. You can also press `Command + S` / `Ctrl + S` to save manually.

### Manage All Records

Click the Manage button in the side panel to open the management page.

The management page supports:

- Viewing all pages with saved highlights or notes.
- Searching page titles, URLs, notes, and highlight content.
- Sorting by recently updated records.
- Filtering all pages, pages with notes, notes only, or highlights only.
- Expanding a page to review its highlights and notes.
- Batch copying or deleting selected records.
- Exporting all records.

## Export

### Markdown

Exports a `.md` file for editing, archiving, AI processing, or importing into knowledge tools.

The export includes:

- Page title.
- Source link.
- Page notes.
- Highlights and underlines.
- Annotations.

### HTML

Exports a `.html` file with a cleaner reading layout.

### Mowen

Mowen export creates a private note through the Mowen Open API.

Setup:

1. Open Settings from the management page.
2. Select Mowen in Export Settings.
3. Enter your Mowen API Key.
4. Optionally add default tags.
5. Click Test Connection before exporting.

### Notion

Notion export creates a new child page under the target parent page through the official Notion API.

Setup:

1. Open Notion settings and click Connections.
2. Click Develop or Manage Integrations, then create a new integration.
3. Enter an integration name and choose the target parent page in Installation Scope.
4. Copy the Integration Token.
5. Paste the token into Cat Highlighter's Notion settings.
6. Copy the target parent page link and paste it into Page ID / Parent Page Link.
7. Click Test Connection before exporting.

### Obsidian

Obsidian export writes content to the clipboard and opens Obsidian through the `obsidian://new` protocol.

Setup:

1. Open Settings from the management page.
2. Enter the target vault name or path.
3. To get the path, open Obsidian Desktop, switch to the target vault, right-click the vault area in the vault switcher, and choose Copy Path.
4. Optionally enter a target folder, such as `Clippings/Cat Highlighter`.
5. Click Test Connection and confirm that Obsidian creates a test note.

### SiYuan

SiYuan export writes to a target notebook through the local SiYuan API.

Setup:

1. Open SiYuan Desktop.
2. Go to Settings -> About.
3. Copy the API Token.
4. Enter the service URL and API Token in Cat Highlighter.
5. Click Refresh Notebooks and choose a target notebook.
6. Optionally enter a target directory.
7. Click Test Connection before exporting.

## Data And Privacy

Cat Highlighter stores highlights, annotations, page notes, and export settings locally in the browser through `chrome.storage.local`. The extension does not run its own server and does not upload your page content automatically.

Content is sent to third-party services only when you explicitly export to Mowen, Notion, or SiYuan. See [PRIVACY.md](PRIVACY.md) for details.

## Project Structure

- `manifest.json`: Chrome extension manifest.
- `content.js`: Text selection, floating toolbar, highlight creation, and highlight restoration.
- `background.js`: Background service logic.
- `sidepanel.html` / `sidepanel.js` / `sidepanel.css`: Side panel UI and interactions.
- `options.html` / `options.js` / `options.css`: Management page UI and interactions.
- `export-service.js`: Shared export data model and Markdown / HTML rendering.
- `mowen-exporter.js`: Mowen API export.
- `notion-exporter.js`: Notion API export.
- `obsidian-exporter.js`: Obsidian protocol export.
- `siyuan-exporter.js`: SiYuan local API export.
- `note-repo.js` / `page-note-service.js`: Page-note storage and processing.

## Release Checklist

Before publishing to the Chrome Web Store:

- Run regression tests on major supported websites.
- Update `README.md`, `README_EN.md`, and `PRIVACY.md`.
- Prepare store descriptions, screenshots, and permission explanations.
- Confirm the version number in `manifest.json`.
- Package a clean extension zip.

See [docs/release-checklist.md](docs/release-checklist.md) for the full checklist.

## License

MIT License. See [LICENSE](LICENSE).
