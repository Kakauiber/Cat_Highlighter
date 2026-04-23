# 划线猫发布前检查清单

本清单用于 Chrome Web Store 上架前的最终核对。

## 1. 功能回归测试

每个测试页面至少检查：高亮、划线、删除、批注、侧边栏同步、刷新恢复、管理页显示、复制本页、导出本页、导出全部。

建议测试页面：

- ChatGPT 对话页面。
- Gemini 对话页面。
- Kimi 对话页面。
- DeepSeek 对话页面。
- Perplexity / Comet 页面。
- 普通网页文章。
- 飞书文档等复杂编辑页面。

重点场景：

- 同一大模型网站的不同对话页分别保存，不串页。
- 新增高亮后侧边栏能同步显示。
- 删除网页上的高亮后，侧边栏和管理页不再显示该记录。
- 刷新页面后高亮仍能恢复。
- 页面笔记不会在不同页面之间串数据。
- 复制本页包含页面笔记和高亮，且为纯文本。
- 导出本页包含页面笔记、高亮和批注。
- 导出全部包含全部页面记录。

## 2. 导出功能测试

### Markdown

- 导出文件能正常下载。
- 页面笔记、标注、批注都存在。
- 空行不过多，阅读顺畅。

### HTML

- 导出文件能正常打开。
- 单条标注卡片清晰。
- 页面笔记、标注、批注都存在。

### 墨问

- API Key 保存成功。
- 测试私密笔记创建成功。
- 正式导出创建私密笔记。
- 导出内容包含页面标题、原文链接、页面笔记、标注和批注。

### Notion

- API 集成密钥保存成功。
- 目标父页面链接 / ID 能识别。
- 测试页面创建成功。
- 正式导出能在目标父页面下创建子页面。
- 导出内容包含页面标题、原文链接、页面笔记、标注和批注。

### Obsidian

- 仓库名称 / 路径保存成功。
- 测试笔记能通过 Obsidian 打开并创建。
- 正式导出写入目标仓库和目标文件夹。

### 思源笔记

- 服务地址和 API Token 保存成功。
- 能刷新笔记本列表。
- 测试文档创建成功。
- 正式导出写入目标笔记本和目录。

## 3. Manifest 检查

- `name` 准确。
- `description` 不超过 Chrome Web Store 限制，并准确表达功能，建议控制在 132 个字符以内。
- `version` 已更新到本次发布版本。
- `icons` 包含 16、32、48、128 尺寸。
- `permissions` 均有合理说明。
- `host_permissions` 使用 `<all_urls>` 的原因已在审核说明中解释。
- `content_scripts.matches` 使用 `<all_urls>` 的原因已在审核说明中解释。
- `all_frames` 的原因已在审核说明中解释。
- 扩展包内没有不必要的测试截图、临时文件和系统文件。

## 4. Chrome Web Store 素材

- 128x128 图标。
- 至少 1 张截图，建议 4-5 张。
- 短描述。
- 详细描述。
- 单一用途说明。
- 权限说明。
- 隐私政策链接。
- 测试说明。

建议截图：

- 网页上高亮和划线。
- 侧边栏当前页高亮。
- 页面笔记。
- 管理页全部记录。
- 导出配置页。
- 导出到 Notion / 墨问 / Obsidian / 思源的结果示例。
- 截图尺寸建议使用 1280x800 或 640x400，保持清晰，不要使用模糊、倾斜或包含过多文字的图片。

## 5. 隐私与数据声明

- 已准备 `PRIVACY.md`。
- Chrome Web Store 隐私表单中的数据类型与 `PRIVACY.md` 保持一致。
- 已说明数据默认保存在 `chrome.storage.local`。
- 已说明 API Key / Token 的存储和使用方式。
- 已说明只有用户主动导出时才会发送数据到第三方。
- 已说明没有远程代码。

## 6. 打包前检查

运行：

```bash
git status
node -c options.js
node -c sidepanel.js
node -c content.js
node -c background.js
node -c export-service.js
node -c mowen-exporter.js
node -c notion-exporter.js
node -c obsidian-exporter.js
node -c siyuan-exporter.js
node -c feature-gate.js
node -c note-repo.js
node -c page-note-service.js
git diff --check
```

确认：

- 工作区干净。
- 当前版本已提交。
- `manifest.json` 版本号已更新。
- 打包 zip 的根目录直接包含 `manifest.json`。

## 7. 上架流程

1. 注册并登录 Chrome Web Store Developer Dashboard。
2. 添加新项目。
3. 上传扩展 zip。
4. 填写商店列表。
5. 填写隐私字段。
6. 填写权限说明。
7. 如有必要，填写测试说明。
8. 提交审核。

官方参考：

- Chrome Web Store 发布流程：https://developer.chrome.com/docs/webstore/publish
- 准备扩展：https://developer.chrome.com/docs/webstore/prepare
- 隐私字段：https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- 商店列表：https://developer.chrome.com/docs/webstore/best-listing
