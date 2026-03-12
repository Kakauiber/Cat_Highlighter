# 页面笔记系统 V1 技术设计

## 1. 设计目标

- 页面笔记与高亮数据解耦
- 对话型大模型页面按完整 URL 分开存储
- 现有高亮功能最小改动
- 为后续导出系统和商业化系统预留统一数据出口

## 2. 当前代码结构判断

当前项目主要文件：

- `content.js`
- `sidepanel.js`
- `options.js`

高亮逻辑已经主要分布在：

- 页面内 DOM 处理：`content.js`
- 侧边栏展示与交互：`sidepanel.js`
- 管理页展示与交互：`options.js`

V1 页面笔记不应进入 `content.js` 主逻辑，因为页面笔记不是 DOM 注入能力，而是侧边栏/管理页的数据能力。

## 3. 数据模型

### 3.1 页面笔记记录

```ts
type PageNoteRecord = {
  pageUrl: string
  pageTitle: string
  content: string
  createdAt: number
  updatedAt: number
  wordCount: number
}
```

### 3.2 存储键

V1 直接使用：

```ts
page_notes_<full_url>
```

说明：

- 使用完整 URL
- 不做 `origin + pathname` 归并
- 不忽略 query/hash
- 这样可以最大程度保证 ChatGPT、Gemini、DeepSeek 等对话页严格隔离

## 4. 共享模块建议

V1 至少新增两个共享模块：

### 4.1 `note-repo.js`

职责：

- 生成 note storage key
- 读取单页笔记
- 保存单页笔记
- 删除单页笔记
- 获取全部笔记摘要

建议导出函数：

```ts
getNoteStorageKey(url)
getPageNote(url)
savePageNote(url, noteRecord)
deletePageNote(url)
listAllPageNotes()
```

### 4.2 `page-note-service.js`

职责：

- 输入内容标准化
- 计算字数
- 自动保存节流
- 生成页面信息卡笔记摘要

建议导出函数：

```ts
normalizeNoteContent(content)
countWords(content)
createNoteDraft(url, title, content, previousRecord)
```

## 5. 页面职责划分

### 5.1 `sidepanel.js`

负责：

- 当前页面笔记模块 UI
- 当前页笔记读取
- 输入变更监听
- 自动保存状态
- 页面信息卡展示“本页是否有笔记”

不负责：

- 页面笔记 DOM 注入
- 导出适配

### 5.2 `options.js`

负责：

- 管理页显示哪些页面有笔记
- 显示字数或轻量标识

不负责：

- 长文本编辑
- 页面笔记主入口

### 5.3 `content.js`

V1 原则上不接入页面笔记逻辑。

## 6. 自动保存策略

建议策略：

- 输入后 500ms 到 800ms 节流保存
- textarea blur 时补一次保存
- 切换页面前不额外强行同步，只要已通过节流保存即可

保存状态建议：

- `idle`
- `saving`
- `saved`
- `error`

## 7. 页面归属策略

页面笔记的页面归属必须与高亮当前已修复策略保持一致：

- 使用完整 URL
- 不做模糊匹配
- 当前页信息从活动 tab 精确读取

对话型大模型页面要求：

- 对话型页面必须以完整对话 URL 作为页面笔记主键
- 例如 `https://chatgpt.com/c/<conversation-id>` 这类 URL，必须一条 URL 对应一条笔记
- 不允许 A/B 对话页复用同一笔记存储项

## 8. 与未来导出系统的关系

虽然 V1 不开发导出 UI，但现在必须为导出系统预留统一读取能力。

建议在后续导出层使用统一组装结构：

```ts
type PageRecord = {
  url: string
  title: string
  highlights: HighlightRecord[]
  note?: PageNoteRecord
}
```

因此 V1 页面笔记实现必须满足：

- 能通过 URL 精确取到对应 note
- 能在导出时按页面与高亮一起组装

## 9. 与未来商业化系统的关系

V1 不开发付费能力，但代码层面建议现在就避免把导出逻辑直接写死在页面代码里。

原因：

- 页面笔记后面会进入导出
- 导出后面会接 feature gate
- 如果现在直接把页面笔记逻辑写散，后面导出和付费会返工

## 10. 风险点

- 如果把页面笔记塞进现有高亮数组，会导致后续导出、删除、统计逻辑全部变脏
- 如果不走完整 URL，对话型大模型页面会有串页风险
- 如果自动保存节流设计不好，容易出现输入卡顿或状态闪烁

## 11. 实施建议

V1 采用“轻量重构”：

- 不整体重写侧边栏
- 不重写管理页
- 新增共享 note 模块
- 在当前页面 tab 内接入笔记 UI

这样改动最小，但为 V2 保留足够扩展空间。
