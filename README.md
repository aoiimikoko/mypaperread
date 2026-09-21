# mypaperread

一个用于对照阅读文献原文与模型译文的开源网站。支持导入 PDF 或公开网页，按页或连续滚动阅读。

## 功能

- 导入本地带文本层的 PDF，或公开的 PDF / 网页 URL。
- 高清 PDF 页面渲染与可选文字层；选中文字可单独翻译或标色。
- 新生成的 PDF 译文按句保存；点击或选中原文句子、点击译文句子时，两侧临时突出对应句，点空白处或按 Esc 取消。
- PDF 和网页文献保存在当前浏览器的文献库中，刷新后可恢复原文件、阅读页码、译文和标色；可从文献库删除。
- 按页切换、上下连续滚动、搜索与缩放。
- 单栏、双栏及三栏阅读，按文献页码对照原文和译文。
- 使用 OpenAI、Azure OpenAI、DeepSeek、OpenRouter、阿里云百炼、硅基流动、火山方舟、Anthropic Claude、Google Gemini 或自定义兼容 OpenAI 的接口翻译。
- 一键翻译 PDF 时只提取识别出的摘要至结论正文，过滤常见页眉、页脚、页码和日期，跳过参考文献等非正文；可导出 Markdown。
- PDF 翻译会合并句子请求并以有限并发处理页面；重复翻译相同内容时复用当前会话缓存。连续阅读只保留视口附近的高清 PDF 画布。
- DeepSeek 翻译默认使用 `deepseek-flash` 的非思考模式，避免普通翻译触发高强度推理造成额外等待。
- 逐句翻译兼容多种 JSON 与编号列表返回格式；模型未遵循批量格式时会自动缩小批次，并以有限并发逐句完成翻译。
- 可选择在当前浏览器保存 API Key。

## 快速开始

需要 Node.js 22.13+ 和 pnpm 11。克隆仓库后运行：

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

浏览器打开 `http://localhost:5173/`。本地运行无需 ChatGPT 账号。Windows 用户也可以双击 `start-local.cmd`，它会先构建当前源码，再打开 `http://127.0.0.1:8787/`；该窗口保持开启时网站可用。更新代码后，先关闭旧的启动窗口，再重新双击脚本。

```sh
pnpm run build
pnpm run start
```

`build` 生成生产版本，`start` 在本机启动它。修改源码后重新构建即可更新生产版本。

## 使用说明

在网站中导入 PDF 或 URL，选择单栏、双栏或三栏，再选择左右翻页或上下滚动。翻译时，在设置中选择 API 平台、填写对应的 API Key 和模型名。不同平台需要各自有效的密钥；本项目不提供模型额度。

扫描件 PDF 如果没有文本层，目前无法提取内容进行翻译。自动正文识别与页眉页脚过滤基于版面和文字规则，复杂排版可能仍需人工核对；无法识别正文时可选中文字单独翻译。旧版已保存的整页译文需要重新翻译相应页面，才能生成逐句对应关系。网页导入只读取公开页面文本；需要登录、禁止抓取或依赖复杂动态渲染的页面可能无法导入。文献保存在当前浏览器的 IndexedDB 中；清除该网站的浏览器数据会同时删除本地文献库。勾选“在此浏览器保存 API Key”后，密钥会以明文保存在该浏览器的本地存储中，刷新页面后可继续使用；密钥不会写入仓库。翻译请求会发送到你选择的模型平台，单次请求延迟仍受平台模型和网络状况影响。

## 开发与检查

```sh
pnpm run lint
pnpm run typecheck
node --experimental-strip-types --test tests/reading.test.mjs
pnpm run build
```

项目使用 TypeScript、React、vinext、Vite、Tailwind CSS 和 PDF.js。应用页面在 `app/`，模型平台配置在 `lib/model-providers.ts`，翻译与 URL 导入接口在 `app/api/`。

发现问题或希望贡献代码，请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 报告。

## 许可

本项目以 [MIT License](LICENSE) 开源。`build/sites-vite-plugin.LICENSE` 和 `vendor/shadcn-tailwind-4.13.0.LICENSE.md` 保留了相应第三方代码的许可证。
