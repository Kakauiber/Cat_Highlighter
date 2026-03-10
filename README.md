# 划线猫 Cat Highlighter

一个面向日常网页阅读与大模型对话场景的浏览器高亮扩展。

支持在任意网页中高亮或划线选中文本，并提供侧边栏、管理页、批注、批量操作和导出能力。针对 ChatGPT 这类单页应用场景做了重点适配，确保不同对话页面的高亮记录能够正确区分和保留。

## 功能特性

- 支持任意网页文本高亮与划线
- 支持多种颜色选择
- 支持为高亮添加批注
- 支持侧边栏查看当前页面与全部高亮
- 支持多选、批量复制、批量删除
- 支持删除本页高亮
- 支持管理页集中整理全部记录
- 支持刷新后恢复高亮
- 支持导出为 Markdown 格式

## 适用场景

- 阅读文章、论文、资料页时做重点标记
- 在 ChatGPT 等大模型对话页面中沉淀关键信息
- 对跨页面阅读内容进行统一整理与导出

## 项目结构

- [`manifest.json`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/manifest.json)：扩展配置入口
- [`content.js`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/content.js)：页面高亮、恢复、存储逻辑
- [`sidepanel.html`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/sidepanel.html) / [`sidepanel.js`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/sidepanel.js) / [`sidepanel.css`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/sidepanel.css)：侧边栏界面与交互
- [`options.html`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/options.html) / [`options.js`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/options.js) / [`options.css`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/options.css)：管理页界面与交互
- [`background.js`](/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4/background.js)：后台服务逻辑

## 本地加载方式

以 Chromium 内核浏览器为例：

1. 打开扩展管理页
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择当前项目目录：

```text
/Users/summer/Documents/Programs/Antigravity/Cat_highlighter_extension_v1.5.4
```

## 当前状态

当前版本重点完善了以下能力：

- ChatGPT 对话页等单页应用场景下的高亮隔离
- 侧边栏当前页面与全部高亮数据一致性
- 管理页与侧边栏删除操作的一致性
- 页级操作与批量操作的稳定性

## License

暂未添加 License。
