// Release notes used by the side panel update card and manager history.
(function () {
    'use strict';

    const UPDATE_NOTICE_KEY = 'cat_pending_update_notice';
    const UPDATE_SEEN_PREFIX = 'cat_update_seen_';

    // Add one entry here for each public release that should be shown to users.
    const RELEASE_NOTES = {
        '1.4.0': {
            zh_CN: {
                title: '划线猫已更新到 v1.4.0',
                items: [
                    '新增页面标签，可为网页或 AI 对话添加一级标签。',
                    '管理页支持按标签筛选，也可以查看无标签页面。',
                    '设置页新增管理标签，可统一重命名或删除标签，删除标签不会删除页面、高亮或笔记。'
                ]
            },
            en: {
                title: 'Cat Highlighter Updated to v1.4.0',
                items: [
                    'Added page-level tags for web pages and AI conversations.',
                    'Filter manager records by tag, including a No Tags view.',
                    'Manage tags in Settings: rename or delete tags without deleting pages, highlights, or notes.'
                ]
            }
        },
        '1.3.0': {
            zh_CN: {
                title: '划线猫已更新到 v1.3.0',
                items: [
                    '新增键盘快捷键，选中文本后可快速高亮或划线。',
                    'Mac 使用 Control + Y/B/R/U，Windows/Linux 使用 Alt + Y/B/R/U。',
                    '设置页可开启或关闭快捷键，工具条自动隐藏更轻巧。'
                ]
            },
            en: {
                title: 'Cat Highlighter Updated to v1.3.0',
                items: [
                    'Added keyboard shortcuts for quick highlighting and underlining after selecting text.',
                    'Use Control + Y/B/R/U on Mac, or Alt + Y/B/R/U on Windows/Linux.',
                    'Keyboard shortcuts can be enabled or disabled in Settings, and the toolbar now hides sooner.'
                ]
            }
        },
        '1.2.0': {
            zh_CN: {
                title: '划线猫已更新到 v1.2.0',
                items: [
                    '新增工具条自动隐藏，选中文本后未操作会自动收起。',
                    '管理页支持点击页面或高亮记录跳转回原文。',
                    '优化 GPT 等慢加载对话页的高亮定位稳定性。'
                ]
            },
            en: {
                title: 'Cat Highlighter Updated to v1.2.0',
                items: [
                    'The toolbar now auto-hides when no action is taken after selecting text.',
                    'Open original pages and highlights directly from the manager page.',
                    'Improved highlight locating reliability on slower AI chat pages such as ChatGPT.'
                ]
            }
        },
        '1.1.0': {
            zh_CN: {
                title: '划线猫已更新到 v1.1.0',
                items: [
                    '新增英文界面，方便英文系统和国际用户使用。',
                    '统一导出成功提示，墨问、Notion、思源等导出结果更清楚。',
                    '点击已高亮文字可重新唤起工具条，继续批注、复制或删除。'
                ]
            },
            en: {
                title: 'Cat Highlighter Updated to v1.1.0',
                items: [
                    'English UI is now available for international users.',
                    'Export success messages are clearer across Mowen, Notion, and SiYuan.',
                    'Click an existing highlight to reopen the toolbar and continue editing.'
                ]
            }
        }
    };

    function normalizeVersion(version) {
        return String(version || '').trim().replace(/^v/i, '');
    }

    function getLanguage() {
        if (window.CatI18n && typeof window.CatI18n.getLanguage === 'function') {
            return window.CatI18n.getLanguage();
        }
        return 'zh_CN';
    }

    function getCurrentVersion() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
            return normalizeVersion(chrome.runtime.getManifest().version);
        }
        return '';
    }

    function getFallbackNotes(version, language) {
        const normalized = normalizeVersion(version) || getCurrentVersion();
        if (language === 'en') {
            return {
                version: normalized,
                title: `Cat Highlighter Updated to v${normalized}`,
                items: ['This version includes recent improvements and fixes.']
            };
        }

        return {
            version: normalized,
            title: `划线猫已更新到 v${normalized}`,
            items: ['本版本包含近期功能优化与问题修复。']
        };
    }

    function getNotes(version, language) {
        const normalized = normalizeVersion(version);
        const lang = language || getLanguage();
        const entry = RELEASE_NOTES[normalized];
        const localized = entry && (entry[lang] || entry.zh_CN || entry.en);
        if (!localized) {
            return getFallbackNotes(normalized, lang);
        }

        return {
            version: normalized,
            title: localized.title,
            items: Array.isArray(localized.items) ? localized.items.slice() : []
        };
    }

    function compareVersionsDesc(left, right) {
        const a = normalizeVersion(left).split('.').map(part => Number(part) || 0);
        const b = normalizeVersion(right).split('.').map(part => Number(part) || 0);
        const max = Math.max(a.length, b.length);
        for (let index = 0; index < max; index += 1) {
            const diff = (b[index] || 0) - (a[index] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    function getAllNotes(language) {
        return Object.keys(RELEASE_NOTES)
            .sort(compareVersionsDesc)
            .map(version => getNotes(version, language));
    }

    window.CatReleaseNotes = {
        UPDATE_NOTICE_KEY,
        UPDATE_SEEN_PREFIX,
        getCurrentVersion,
        getNotes,
        getAllNotes
    };
})();
