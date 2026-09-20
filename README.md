# mypaperread

文献原文与模型译文对照阅读网站。

## 功能

- 导入本地可复制文本的 PDF，或公开的 PDF / 网页 URL。
- PDF 页面渲染、文字提取、按页切换或上下连续滚动。
- 双栏、三栏及单栏阅读；页码对应、搜索、缩放与 Markdown 导出。
- 使用 OpenAI、Azure OpenAI、DeepSeek、OpenRouter、阿里云百炼、硅基流动、火山方舟、Anthropic Claude、Google Gemini，或自定义兼容 OpenAI 的接口翻译。
- API Key 只存在于当前页面内存，刷新页面后需要重新输入。文献和译文也只保留在本次页面会话中。

## 本地运行

Windows：双击 `start-local.cmd`，随后打开 **http://127.0.0.1:8787/**。保持命令窗口打开即可使用，按 Ctrl+C 停止。它运行已构建的本地网站，不需要 ChatGPT 登录。当前电脑已安装所需运行环境；复制到另一台电脑时，需要 Node.js 22.13+ 与 pnpm。

也可以在项目目录运行：

```sh
pnpm install
pnpm run build
pnpm run start
```

日常修改源码时，可运行 `pnpm run dev` 并访问 **http://localhost:5173/**。部署使用 Cloudflare Workers 兼容构建：

```sh
pnpm run build
```

扫描件 PDF 若没有文本层，暂不支持 OCR 翻译。网页导入会读取公开页面文本；需要登录、禁止跨站抓取或采用复杂动态渲染的网站可能无法导入。

## 发布源码到 GitHub

先在 GitHub 创建一个名为 `mypaperread` 的**空白公开仓库**，创建时不要勾选自动生成 README、.gitignore 或许可证。然后在本目录运行，将 `你的用户名` 换成实际 GitHub 用户名：

```sh
git remote add github https://github.com/你的用户名/mypaperread.git
git push -u github main
```

现有的 `origin` 仍指向当前网站的源码仓库；`github` 是新增的公开远端。后续修改后可以分别运行 `git push github main` 和 `git push origin main`。推送 GitHub 前请先选择并加入适合你的开源 `LICENSE`；仅将仓库设为公开，并不会自动授予他人修改和再分发权。当前 Git 历史中未发现 API Key 等凭据，`.openai/hosting.json` 只有站点项目标识。
