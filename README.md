# 北京酷儿合唱团 · 官网（sponsorship-site）

**北京酷儿合唱团**官方网站。纯静态架构：**JSON / Markdown 存内容 → React 组件（SSG 渲染）→ Node 构建 → 中文字体动态子集化 → GitHub Actions 自动部署 Cloudflare Pages（免费版）**。

> 站点文案（团名 / 愿景 / 使命 / 导航 / 页脚）集中在 `src/content/site.json`。更新内容 = 编辑 `src/content/` 下的 JSON / Markdown → `git push` → 约 1–2 分钟后自动上线。无数据库、无服务端。

## 本地开发

要求 Node.js ≥ 20（推荐 22/24 LTS）。

```bash
npm install        # 安装依赖
npm run build      # 构建到 dist/
npm run dev        # 构建 + 启动 http://localhost:8080（监听 src/ 变化自动重建）
npm run preview    # 只启动服务器（需先 build）
```

> 本地开发需要把源字体放在 `fonts/source/source-font.ttf`（已被 .gitignore 排除，不入库）。
> 缺字体时构建不阻塞：页面回退到系统宋体并输出警告。

## 目录结构

```
├── build.js                    # 构建流水线（ESM）
├── dev.js                      # 零依赖本地服务器（含 watch 自动重建）
├── src/
│   ├── content/
│   │   ├── site.json           # 站点配置：标题 / 导航 / 页脚 / 域名 url
│   │   ├── data/gallery.json   # 字帖橱窗数据（JSON 驱动列表 + 详情页）
│   │   └── posts/*.md          # 随笔（Markdown + frontmatter → 列表 + 详情页）
│   ├── app/                    # React 组件（Layout/Nav/Footer + 各页面，构建期 SSG 渲染为静态 HTML）
│   └── assets/                 # css / img
├── fonts/source/               # 源字体（gitignored，禁止入库）
├── .github/workflows/deploy.yml# CI/CD
└── dist/                       # 构建产物（gitignored）
```

## 内容更新 Runbook

**改文案 / 导航 / 页脚**：编辑 `src/content/site.json`。

**字帖橱窗**：编辑 `src/content/data/gallery.json`，增删或修改 `items` 里的条目（`id` 用 ASCII，一项对应一页 `/gallery/<id>/`）。图片可把真实文件放入 `src/assets/img/` 并把条目的 `image` 字段改为对应路径（如 `/assets/img/xxx.jpg`）；不放图则构建时自动生成 SVG 占位图。

**随笔**：在 `src/content/posts/` 新建 `my-post.md`（文件名即 URL slug）：

```markdown
---
title: 标题
date: 2026-10-18
summary: 摘要（列表页显示）
---

正文（Markdown 语法）。
```

改完 `git push` 即可，GitHub Actions 会自动构建并部署。

## 中文字体动态子集化

构建时遍历所有渲染后的 HTML，收集实际用到的每个字符（含生僻字），用 [subset-font](https://github.com/papandreou/subset-font)（HarfBuzz wasm）把 33MB 的源字体子集化为仅含这些字形的 woff2（当前约 223KB，构建 3 秒内）。字体文件名带内容哈希，内容不变则缓存永久有效；新增生僻字后重建，子集自动扩容。缺字回退栈：Songti SC / SimSun / Noto Serif CJK SC / serif。

## 一次性配置（部署前）

1. **Cloudflare 账号**（免费）。
2. **R2 私有桶**（免费 10GB；源字体绝不进公开仓库）：
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create sponsorship-site-assets
   npx wrangler r2 object put sponsorship-site-assets/fonts/jinghua-oldsong-v3.ttf \
     --file="fonts/source/source-font.ttf" --remote
   ```
3. **API Token**：Cloudflare 面板 → My Profile → API Tokens → Create Token（自定义），权限：`Cloudflare Pages → Edit` + `Workers R2 Storage → Object Read`（Account 级）。
4. **GitHub Secrets**（仓库 Settings → Secrets and variables → Actions）：
   - `CLOUDFLARE_ACCOUNT_ID`（面板首页右侧）
   - `CLOUDFLARE_API_TOKEN`（上一步生成的 token）
5. **Pages 项目**（`wrangler pages deploy` 不会自动创建，需先手动建一次）：
   ```bash
   npx wrangler pages project create sponsorship-site --production-branch=main
   ```

配置完成后 push 或在 Actions 页手动 Re-run，CI 会自动构建并部署，站点地址 `https://sponsorship-site.pages.dev`。

## 自定义域名 Runbook（待域名就绪后）

1. 注册域名（可直接在 Cloudflare 注册，成本价），或把现有域名的 NS 迁入 Cloudflare（免费方案，推荐：自动 SSL + 完整功能）。
2. Cloudflare 面板 → Workers & Pages → `sponsorship-site` → Custom domains → 添加域名（裸域 + www 都可加）。
3. 等待证书自动签发（通常几分钟），HTTPS 直接可用。
4. 把 `src/content/site.json` 的 `url` 改为正式域名并 push（sitemap / robots / canonical 全站自动跟随）。

## 字体许可备注

源字体京華老宋體为商业授权字体，**已排除出 git 仓库**，CI 从 R2 私有桶获取。部署前请确认许可条款覆盖：① Web 嵌入（@font-face）；② 子集化；③ 公开可访问站点使用（线上 woff2 子集可被直接下载）。

## 已知限制

- Cloudflare 免费版无中国大陆节点，国内访问速度一般。
- Pages 免费版 500 次构建/月、并发构建 1。
