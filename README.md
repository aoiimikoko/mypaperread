# mypaperread

文献原文与模型译文对照阅读网站。

## 功能

- 导入本地可复制文本的 PDF，或公开的 PDF / 网页 URL。
- PDF 页面渲染、文字提取、按页切换或上下连续滚动。
- 双栏、三栏及单栏阅读；页码对应、搜索、缩放与 Markdown 导出。
- 使用 OpenAI、Azure OpenAI、DeepSeek、OpenRouter、阿里云百炼、硅基流动、火山方舟、Anthropic Claude、Google Gemini，或自定义兼容 OpenAI 的接口翻译。
- API Key 只存在于当前页面内存，刷新页面后需要重新输入。文献和译文也只保留在本次页面会话中。

## 本地运行

需要 Node.js 22.13+ 与 pnpm。

```sh
pnpm install
pnpm run dev
```

打开开发服务器显示的地址。部署使用 Cloudflare Workers 兼容构建：

```sh
pnpm run build
```

扫描件 PDF 若没有文本层，暂不支持 OCR 翻译。网页导入会读取公开页面文本；需要登录、禁止跨站抓取或采用复杂动态渲染的网站可能无法导入。
