# Chrome Web Store 商店页优化稿

## 增长定位

划线猫的商店页不要只强调“网页高亮工具”。更强的第一印象是：

> AI 对话和长文阅读的本地知识收集器

这个定位同时回应三件事：

- 用户痛点：AI 回复、长文、网页资料里的重点很容易被后续内容淹没。
- 产品动作：高亮、划线、批注、页面笔记、管理、导出。
- 信任优势：默认本地保存，没有自建服务器，不主动上传网页内容。

## 扩展名称

中文：

划线猫

英文：

Cat Highlighter

## 短描述

中文推荐：

AI 对话和长文阅读的本地知识收集器：高亮、批注、页面笔记，并导出到 Markdown、Notion、Obsidian、墨问和思源。

中文备选：

在 AI 对话和网页长文中高亮、批注、记录页面笔记，并把内容整理导出到你的知识库。

英文推荐：

A local knowledge collector for AI chats and long reads: highlight, annotate, take page notes, and export to your knowledge tools.

英文备选：

Highlight AI chats and web pages, capture page notes, and export your reading insights to Markdown and knowledge tools.

## 详细描述

划线猫是一款为 AI 对话和长文阅读设计的本地知识收集器。

当你在 AI 聊天页面、网页文章、研究资料或长报告里看到重要内容时，可以直接高亮、划线、添加批注，并在侧边栏写下当前页面的笔记。每个网页、每段 AI 对话都会按页面地址单独保存，刷新或重新打开后仍可恢复记录。

它适合把“读到重点的一瞬间”变成可整理、可搜索、可导出的知识片段。

你可以用划线猫做这些事：

- 在 AI 对话、网页文章和长资料中高亮重要句子。
- 用不同颜色区分事实、观点、疑问和行动项。
- 给单条高亮添加批注，记录当时的判断和想法。
- 在侧边栏写页面笔记，保存总结、追问点和后续任务。
- 在管理页统一查看、搜索、筛选和整理全部页面记录。
- 将高亮、批注和页面笔记导出为 Markdown、HTML，或发送到墨问、Notion、Obsidian、思源笔记。

划线猫特别适合：

- 经常使用 AI 聊天工具，希望把重要回复沉淀成笔记的人。
- 经常阅读网页长文、研究资料、产品文档和报告的人。
- 想把分散在浏览器里的重点内容整理进知识库的人。
- 需要边阅读、边记录判断、问题和行动项的人。

划线猫不是另一个复杂的知识库。它更像你在网页和 AI 对话现场的轻量捕捉层：先把重点和想法留住，再按需要导出到你已经在用的工具。

数据与隐私：

划线猫默认把高亮、划线、批注、页面笔记、页面标签和导出配置保存在浏览器本地。插件没有自建服务器，不会主动上传你的网页内容。

只有当你主动选择导出到墨问、Notion 或思源笔记时，相关内容才会发送到你配置的第三方服务。导出到 Obsidian 使用本地 Obsidian 协议和剪贴板完成。

隐私政策：

https://github.com/Kakauiber/Cat_Highlighter/blob/main/PRIVACY.md

## English Full Description

Cat Highlighter is a local knowledge collector for AI chats and long-form web reading.

When you find something important in an AI conversation, article, research page, documentation, or report, you can highlight it, underline it, annotate it, and write page notes in the side panel. Each page or AI conversation is saved separately by URL, so your records can be restored after refreshing or reopening.

It helps you turn the moment of reading into searchable, reusable, exportable knowledge.

With Cat Highlighter, you can:

- Highlight important sentences in AI chats and web pages.
- Use different colors to separate facts, opinions, questions, and action items.
- Add annotations to individual highlights.
- Write page notes for summaries, follow-up prompts, and next steps.
- Review, search, filter, and organize all saved page records.
- Export highlights, annotations, and page notes to Markdown, HTML, Mowen, Notion, Obsidian, or SiYuan.

Cat Highlighter is especially useful for people who:

- Use AI chat tools often and want to turn useful replies into notes.
- Read long articles, research materials, documentation, or reports.
- Want to move scattered browser insights into a knowledge base.
- Need to capture judgments, questions, and action items while reading.

Cat Highlighter is not another complicated knowledge base. It is a lightweight capture layer for your browser: save the important parts first, then export them to the tools you already use.

Data and privacy:

By default, Cat Highlighter stores highlights, underlines, annotations, page notes, page tags, and export settings locally in your browser. It does not run its own server and does not upload your page content automatically.

Content is sent to Mowen, Notion, or SiYuan only when you explicitly choose to export to those third-party services. Obsidian export uses the local Obsidian protocol and clipboard.

## 单一用途说明

划线猫的单一用途是：帮助用户在网页和 AI 对话页面中保存文字高亮、划线、批注和页面笔记，并在用户主动操作时导出这些记录到本地文件或用户配置的笔记工具。

## 权限说明

`storage`

用于在浏览器本地保存用户创建的高亮、划线、批注、页面笔记、页面标签、黑名单网站和导出配置。

`activeTab`

用于识别当前标签页，以便侧边栏展示当前页面的高亮、笔记和页面操作。

`scripting`

用于在当前网页中创建、删除和恢复高亮标记。

`clipboardWrite`

用于用户主动点击复制内容，或导出到 Obsidian 时写入剪贴板。

`sidePanel`

用于提供浏览器侧边栏界面，方便用户查看当前页高亮、写页面笔记、复制和导出当前页内容。

`host_permissions: <all_urls>`

划线猫的核心功能是在用户浏览的网页上进行文字高亮、划线和恢复标注，因此需要访问网页内容。插件只会在用户主动创建高亮、划线、批注或页面笔记后保存相关页面信息。

`content_scripts.matches: <all_urls>`

用于在用户访问的网页中注入内容脚本，以便识别选中文本、展示工具条、创建高亮和恢复已保存标注。

`all_frames`

用于支持复杂网页和嵌入式框架页面中的选区识别与高亮恢复，例如部分 AI 对话页、文档页面或嵌入式内容页面。

## 隐私实践填写参考

建议披露的数据类型：

- 网站内容：用户主动高亮、划线、批注和记录的网页内容。
- 用户活动：用户创建的标注、页面笔记和导出操作。
- 身份验证信息：用户主动填写的第三方 API Key / Token，仅用于对应导出功能。

建议说明：

- 数据默认保存在浏览器本地 `chrome.storage.local`。
- 插件没有自建服务器。
- 只有用户主动导出时，相关内容才会发送到墨问、Notion 或思源笔记等第三方服务。
- 导出到 Obsidian 通过本地 Obsidian 协议和剪贴板完成。
- 插件不使用远程代码。
- 插件不会出售用户数据，不会用于广告定向，也不会用于信用评估或身份画像。

## 截图策略

推荐按这个顺序上传 5 张截图：

1. `release/store-assets/optimized-zh/01-ai-chat-highlight.png`
2. `release/store-assets/optimized-zh/02-current-page-records.png`
3. `release/store-assets/optimized-zh/03-page-note.png`
4. `release/store-assets/optimized-zh/04-all-records-manager.png`
5. `release/store-assets/optimized-zh/05-export-to-knowledge-base.png`

推荐上传宣传图：

- Marquee: `release/store-assets/optimized-zh/promo-marquee-1400x560-local-knowledge.png`
- Small promo: `release/store-assets/optimized-zh/promo-small-440x280-local-knowledge.png`

## 审核测试说明草稿

审核人员可以按以下步骤测试：

1. 安装扩展后打开普通网页。
2. 选中一段文字，点击弹出的工具条创建高亮。
3. 打开侧边栏，确认当前页高亮显示。
4. 切换到「笔记」，输入页面笔记，确认自动保存。
5. 刷新页面，确认高亮恢复。
6. 打开管理页，确认页面记录显示。
7. 测试复制本页。
8. 测试导出 Markdown 或 HTML。

墨问、Notion、Obsidian 和思源笔记导出需要用户自己的第三方账号、本地客户端或 API 配置；如审核时不提供这些账号，可只测试 Markdown / HTML 本地导出。
