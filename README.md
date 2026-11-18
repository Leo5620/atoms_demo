# Atoms 风格应用生成 Demo

运行：`npm run dev`，然后访问 `http://localhost:3000`。

要启用真实生成：复制 `.env.example` 为 `.env`，设置 `LLM_API_KEY`；默认已配置为 DeepSeek（`LLM_API_BASE=https://api.deepseek.com`，`LLM_MODEL=deepseek-flash`），可换成任何 OpenAI-compatible 服务。密钥仅由 `server.js` 读取，浏览器不会接触。

配置优先级：`server.js` 只在系统环境变量缺失时才从 `.env` 读取，因此可以直接用系统环境变量覆盖，无需 `.env` 文件。Windows PowerShell 示例：

```powershell
$env:LLM_API_KEY = "sk-你的DeepSeek密钥"
$env:LLM_API_BASE = "https://api.deepseek.com"
$env:LLM_MODEL = "deepseek-flash"
npm run dev
```

永久生效可用 `setx LLM_API_KEY "sk-..."`（新开终端后生效），或部署平台（如 Vercel）的环境变量面板。

## 部署（Vercel）

Vercel 是 Serverless 模型，不支持常驻 Node 服务器，因此项目做了双轨适配：

- **本地开发**：`server.js`（常驻 HTTP 服务器，`npm run dev`）。
- **Vercel 部署**：`api/generate.mjs` 自动成为 `POST /api/generate` Serverless Function；`vercel.json` 把非 `/api/*` 的路径回退到 `index.html`（SPA 深链刷新不 404）；静态文件由 Vercel 直接托管。

部署时只需连接 GitHub 仓库（Framework Preset 选 Other），并在项目环境变量中设置 `LLM_API_KEY`、`LLM_API_BASE`、`LLM_MODEL`——`.env` 不会上传。

注意：Vercel Hobby 版函数最长执行 60 秒，复杂应用的生成偶尔会超时，重试即可。

会话和版本保存在浏览器 `localStorage` 的 `atoms_demo_state_v1`。预览使用 `sandbox="allow-scripts"` 的 iframe，不授予同源或父页面访问权。
