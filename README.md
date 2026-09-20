# mypaperread

一个用于对照阅读文献原文与模型译文的开源网站。支持导入 PDF 或公开网页，按页或连续滚动阅读。

## 功能

- 导入本地带文本层的 PDF，或公开的 PDF / 网页 URL。
- PDF 页面渲染、文字提取、按页切换、上下连续滚动、搜索与缩放。
- 单栏、双栏及三栏阅读，按文献页码对照原文和译文。
- 使用 OpenAI、Azure OpenAI、DeepSeek、OpenRouter、阿里云百炼、硅基流动、火山方舟、Anthropic Claude、Google Gemini 或自定义兼容 OpenAI 的接口翻译。
- 导出 Markdown；可选择在当前浏览器保存 API Key，文献和译文仍只保留在当前页面会话中。

## 快速开始

需要 Node.js 22.13+ 和 pnpm 11。克隆仓库后运行：

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

浏览器打开 `http://localhost:5173/`。本地运行无需 ChatGPT 账号。Windows 用户也可以在安装依赖并完成首次构建后双击 `start-local.cmd`，打开 `http://127.0.0.1:8787/`；该窗口保持开启时网站可用。

```sh
pnpm run build
pnpm run start
```

`build` 生成生产版本，`start` 在本机启动它。修改源码后重新构建即可更新生产版本。

## 使用说明

在网站中导入 PDF 或 URL，选择单栏、双栏或三栏，再选择左右翻页或上下滚动。翻译时，在设置中选择 API 平台、填写对应的 API Key 和模型名。不同平台需要各自有效的密钥；本项目不提供模型额度。

扫描件 PDF 如果没有文本层，目前无法提取内容进行翻译。网页导入只读取公开页面文本；需要登录、禁止抓取或依赖复杂动态渲染的页面可能无法导入。勾选“在此浏览器保存 API Key”后，密钥会以明文保存在该浏览器的本地存储中，刷新页面后可继续使用；密钥不会写入仓库。翻译请求会发送到你选择的模型平台。

## 开发与检查

```sh
pnpm run lint
pnpm run typecheck
pnpm run build
```

项目使用 TypeScript、React、vinext、Vite、Tailwind CSS 和 PDF.js。应用页面在 `app/`，模型平台配置在 `lib/model-providers.ts`，翻译与 URL 导入接口在 `app/api/`。

发现问题或希望贡献代码，请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 报告。

## 许可

本项目以 [MIT License](LICENSE) 开源。`build/sites-vite-plugin.LICENSE` 和 `vendor/shadcn-tailwind-4.13.0.LICENSE.md` 保留了相应第三方代码的许可证。
