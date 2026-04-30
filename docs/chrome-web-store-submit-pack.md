# Chrome Web Store 提交材料

本文件用于正式提交 Chrome Web Store 时复制填写。

## 上传包

上传文件：

`release/cat-highlighter-v1.0-chrome-web-store.zip`

包内只包含插件运行所需文件：`manifest.json`、运行脚本、页面文件、样式文件和图标。不包含 `.git`、开发文档、截图、预览 HTML 或临时文件。

## 基本信息

扩展名称：

划线猫

短描述：

在网页和 AI 对话中高亮、划线、记录灵感，并整理导出到 Markdown、Notion、Obsidian、墨问和思源。

英文短描述：

Highlight, annotate, capture thoughts, and export web or AI chat insights to Markdown, Notion, Obsidian, Mowen, and SiYuan.

类别建议：

生产力

语言建议：

中文（简体）

可见性建议：

Public，但首次提交建议选择审核通过后手动发布。

隐私政策网址：

https://github.com/Kakauiber/Cat_Highlighter/blob/main/PRIVACY.md

## 详细描述

你是否经常在 ChatGPT、Gemini、Kimi、DeepSeek 等 AI 对话中看到重要内容，却很快被新的回复淹没？

你是否在阅读长网页、报告或 AI 答复时，脑子里突然冒出一个问题、一个判断、一个后续追问点，但转眼就忘了？

划线猫就是为这种“边阅读、边思考、边整理”的场景设计的。

它可以帮你在网页和 AI 对话中快速高亮、划线、添加批注，并在侧边栏为当前页面写下笔记。每个网页、每个 AI 对话都会单独保存记录，刷新或重新打开后仍可恢复，让重要内容不再散落在浏览历史和聊天记录里。

你可以用划线猫做这些事：

- 在网页或 AI 答复中高亮重要句子。
- 用黄色、蓝色、红色区分不同类型的信息。
- 对单条高亮添加批注，记录当时的判断和想法。
- 在侧边栏为当前页面写页面笔记，保存问题、总结和后续追问点。
- 在管理页统一查看、搜索、筛选和整理所有记录。
- 将高亮、批注和页面笔记导出为 Markdown、HTML，或发送到墨问、Notion、Obsidian、思源笔记。

划线猫特别适合：

- 高频使用 ChatGPT、Gemini、Kimi、DeepSeek、Perplexity / Comet 的用户。
- 经常阅读网页文章、研究资料、报告和长文档的用户。
- 想把 AI 对话中的重要信息沉淀成笔记和知识库的用户。
- 需要在阅读过程中随手捕捉想法、问题和行动项的用户。

划线猫不是另一个复杂的知识库，而是你在网页和 AI 对话现场的“思考捕捉器”。

数据与隐私：

划线猫默认把高亮、批注、页面笔记和配置保存在浏览器本地。插件没有自建服务器，不会主动上传你的网页内容。只有当你主动点击导出到墨问、Notion 或思源笔记时，相关内容才会发送到你选择的第三方服务。导出到 Obsidian 使用本地 Obsidian 协议和剪贴板完成，不会发送到划线猫服务器。

隐私政策：https://github.com/Kakauiber/Cat_Highlighter/blob/main/PRIVACY.md

## English Full Description

Do important ideas in AI chats get buried as new replies come in?

Do questions, insights, or follow-up prompts occur to you while reading, only to disappear a moment later?

Cat Highlighter is designed for this exact workflow: read, think, and organize.

Highlight, underline, annotate, and write page notes directly on web pages and AI chat pages. Each page or conversation is saved separately, so your highlights can be restored after refreshing or reopening.

With Cat Highlighter, you can:

Highlight important sentences on web pages and in AI responses.

Use different highlight colors to organize different types of information.

Add annotations to individual highlights.

Write page notes to capture questions, summaries, prompts, and action items.

Review, search, filter, and organize saved records on the management page.

Export your highlights, annotations, and notes to Markdown, HTML, Mowen, Notion, Obsidian, or SiYuan.

Cat Highlighter is especially useful for people who:

Frequently use ChatGPT, Gemini, Kimi, DeepSeek, Perplexity, Comet, and other AI tools.

Read long articles, reports, research materials, or documentation.

Want to turn AI conversations into structured notes.

Need to capture thoughts and key points while reading.

Cat Highlighter is not another complicated knowledge base. It is a lightweight tool that helps you capture ideas while you read and chat with AI.

By default, all highlights, annotations, page notes, and settings are stored locally in your browser. Content is only sent to third-party services when you explicitly choose to export it.

## 单一用途说明

划线猫的单一用途是：帮助用户在网页和大模型对话页面中保存文字标注、页面笔记和批注，并在用户主动操作时导出这些记录到本地文件或用户配置的笔记工具。

## 权限说明

`storage`

用于在浏览器本地保存用户创建的高亮、划线、批注、页面笔记、黑名单网站和导出配置。

`activeTab`

用于识别当前标签页，以便侧边栏展示当前页面的高亮和笔记。

`scripting`

用于在当前网页中创建、删除和恢复高亮标记。

`clipboardWrite`

用于用户主动点击复制内容或导出到 Obsidian 时写入剪贴板。

`sidePanel`

用于提供浏览器侧边栏界面，方便用户查看当前页高亮、写页面笔记和导出当前页。

`host_permissions: <all_urls>`

划线猫的核心功能是在用户浏览的网页上进行文字高亮、划线和恢复标注，因此需要访问网页内容。插件只会在用户主动创建高亮、划线或笔记后保存相关页面信息。

`content_scripts.matches: <all_urls>`

用于在用户访问的网页中注入内容脚本，以便识别选中文本、展示工具条、创建高亮和恢复已保存标注。

`all_frames`

用于支持复杂网页和嵌入式框架页面中的选区识别与高亮恢复，例如部分大模型对话页、文档页面或嵌入式内容页面。

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

## 审核测试说明

审核人员可以按以下步骤测试：

1. 安装扩展后打开普通网页。
2. 选中一段文字，点击弹出的工具条创建高亮。
3. 打开侧边栏，确认当前页高亮显示。
4. 切换到「页面笔记」，输入页面笔记，确认自动保存。
5. 刷新页面，确认高亮恢复。
6. 打开管理页，确认页面记录显示。
7. 测试复制本页。
8. 测试导出 Markdown 或 HTML。

墨问、Notion、Obsidian 和思源笔记导出需要用户自己的第三方账号、本地客户端或 API 配置；如审核时不提供这些账号，可只测试 Markdown / HTML 本地导出。

## 截图建议

建议准备 5 张截图：

- 网页选中文字后出现划线猫工具条。
- 网页中已有多条不同颜色高亮。
- 侧边栏当前页高亮列表。
- 侧边栏页面笔记。
- 管理页全部记录和导出入口。

推荐文件名：

- `01-toolbar-highlight.png`
- `02-sidepanel-current-page.png`
- `03-page-note.png`
- `04-management-page.png`
- `05-export-tools.png`

截图建议使用 1280x800，内容保持清晰，避免包含私人信息。详细截图清单见 `docs/chrome-web-store-image-guide.md`。
