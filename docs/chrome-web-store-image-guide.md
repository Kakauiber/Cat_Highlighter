# Chrome Web Store 图片素材清单

本清单用于划线猫 Chrome Web Store 商店页图片上传。

## 推荐上传素材

### 应用图标

已具备：

- `icons/icon128.png`

### 商店截图

推荐上传 5 张，尺寸均为 `1280 x 800`，格式为 PNG。

中文截图上传顺序：

1. `release/store-assets/optimized-zh/01-ai-chat-highlight.png`
2. `release/store-assets/optimized-zh/02-current-page-records.png`
3. `release/store-assets/optimized-zh/03-page-note.png`
4. `release/store-assets/optimized-zh/04-all-records-manager.png`
5. `release/store-assets/optimized-zh/05-export-to-knowledge-base.png`

英文截图上传顺序：

1. `release/store-assets/optimized-en/01-ai-chat-highlight.png`
2. `release/store-assets/optimized-en/02-current-page-records.png`
3. `release/store-assets/optimized-en/03-page-note.png`
4. `release/store-assets/optimized-en/04-manager-and-settings.png`
5. `release/store-assets/optimized-en/05-export-to-knowledge-base.png`

### 小型宣传图

中文推荐上传：

- `release/store-assets/optimized-zh/promo-small-440x280-local-knowledge-clear.png`

英文推荐上传：

- `release/store-assets/optimized-en/promo-small-440x280-local-knowledge.png`

尺寸：

`440 x 280`

### Marquee 宣传图

中文推荐上传：

- `release/store-assets/optimized-zh/promo-marquee-1400x560-local-knowledge.png`

英文推荐上传：

- `release/store-assets/optimized-en/promo-marquee-1400x560-local-knowledge.png`

尺寸：

`1400 x 560`

## 截图叙事顺序

这组截图按用户扫图时的理解路径设计：

1. 先看到可以在 AI 对话和长文中直接划重点。
2. 再看到当前页高亮会进入侧边栏，并按页面保存。
3. 再看到可以写页面笔记，记录追问、判断和行动项。
4. 再看到管理页可以集中搜索和整理所有记录。
5. 最后看到可以导出到知识库工具。

## 文案控制

截图内只保留少量场景标题，避免变成大段说明图。Chrome Web Store 的商店页正文负责详细解释，截图负责让用户快速理解工作流。

## 质量检查

上传前确认：

- 图片尺寸准确：截图 `1280 x 800`，小型宣传图 `440 x 280`，Marquee `1400 x 560`。
- 没有出现真实 API Key、Token、邮箱或私人文档内容。
- 没有浏览器开发者工具、错误提示或调试信息。
- 所展示功能与当前版本一致。
- 截图标题没有遮挡核心操作区域。

## 生成脚本

优化后的截图和宣传图由以下脚本生成：

`release/store-assets/create_optimized_store_assets.py`

重新生成：

```bash
/Users/summer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 release/store-assets/create_optimized_store_assets.py
```

脚本会输出到：

`release/store-assets/optimized-zh/`

`release/store-assets/optimized-en/`
