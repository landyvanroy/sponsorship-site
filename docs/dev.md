# 开发文档（docs/dev.md）

> 站点信息见根目录 [README](../README.md)。本文档涵盖本地开发、目录结构、样式规范、构建与部署等开发相关内容。

## 本地开发

要求 Node.js ≥ 20（推荐 22/24 LTS）。

```bash
npm install        # 安装依赖
npm run build      # 构建到 dist/（Vite 两阶段：SSR 渲染 + 资源构建，含字体子集化）
npm run dev        # Vite dev server，默认 http://localhost:5173（端口被占用自动 +1）
npm run preview    # 预览 dist/ 产物（需先 build，未命中路由回退 404.html）
```

dev server 按请求实时渲染 HTML（`configureServer` 中间件 + `ssrLoadModule`），Tailwind 与 CSS 改动即时热更新（HMR），无需全量重建；未命中路由直接渲染 404 页。dev 模式跳过字体子集化，使用系统宋体回退栈（`src/app/styles/fonts.dev.css`）。

### React DevTools（可选）

本站是纯静态 SSG，浏览器里没有 React 运行时。`npm run dev:devtools`（即 `vite --mode devtools`）会在 dev 渲染的 HTML 中注入客户端运行时（整份文档 hydration）与独立版 DevTools backend；配合独立版应用即可检查组件树：

```bash
npm run dev:devtools   # 终端 1：带 DevTools 接线启动 dev server
npm run devtools       # 终端 2：打开独立版 React DevTools（连接 ws://localhost:8097）
```

生产构建（`npm run build`）不走该分支，产物仍为纯静态零 JS。

> 生产构建需要把源字体放在 `fonts/source/source-font.ttf`（已被 .gitignore 排除，不入库）。
> 缺字体时本地构建不阻塞：页面回退到系统宋体并输出警告；CI 下会直接报错。

## 目录结构

```
├── build.mjs                   # 生产构建编排（Vite 两阶段：SSR 渲染 → 字体子集化 → 资源构建）
├── vite.config.mjs             # dev / preview 配置（SSG 中间件、devtools 注入、404 兜底）
├── ssg.shared.mjs              # dev/build 共享常量与纯函数（locale 配置、码点收集、sitemap 等）
├── public/assets/img/          # 静态图片（原样拷贝，URL 保持 /assets/img/... 不变）
├── src/
│   ├── content/
│   │   ├── zh-cn/site.json     # 中文站点配置：标题 / 导航 / 页脚 / 域名 url / fontCss
│   │   ├── en/site.json        # 英文站点配置
│   │   ├── data/*.json         # 数据驱动内容（JSON）
│   │   └── posts/*.md          # 随笔（Markdown + frontmatter）
│   ├── app/                    # React 组件（Layout/Header/Footer + 各页面，构建期 SSG 渲染为静态 HTML）
│   │   ├── asset-urls.js       # CSS 资源 URL 单一来源（dev/build 渲染前注入实际路径）
│   │   ├── entry-server.jsx    # SSG 渲染入口
│   │   └── styles/tailwind.css # Tailwind 入口（theme + utilities，经 @tailwindcss/vite 编译）
│   └── assets/css/style.css    # 全站手写样式
├── fonts/source/               # 源字体（gitignored，禁止入库）
├── .github/workflows/deploy.yml# CI/CD（node build.mjs → wrangler pages deploy）
└── dist/                       # 构建产物（gitignored）
```

### 构建产物（dist/）

```
dist/{locale}/index.html        # 各语言首页（head 中的 CSS 已被改写为 hash 文件名）
dist/404.html                   # 404 页（中文）
dist/index.html                 # 根路径语言跳转页（全站唯一含 JS 的产物）
dist/assets/<name>-[hash].css   # CSS（Tailwind + style.css 合并 chunk / 字体表 / 页面样式）
dist/assets/<name>-[hash].woff2 # 子集化字体
dist/assets/img/                # 图片（public/ 原样拷贝，无 hash）
dist/sitemap.xml · robots.txt · _headers
```

## 样式规范

### 分层与归属

| 层 | 位置 | 引入方式 | 用途 |
| --- | --- | --- | --- |
| Tailwind 工具类 | `src/app/styles/tailwind.css`（入口），经 `@tailwindcss/vite` 编译 | `Layout.jsx` 全站 `<link>`（URL 见 `asset-urls.js`） | 快速布局 / 间距 / 响应式工具 |
| 全站样式 | `src/assets/css/style.css` | `Layout.jsx` 全站 `<link>` | 页面框架（`.page` / `.page-main`）、Header / Footer、通用排版 |
| 页面级样式 | `src/app/pages/*.css`（与页面 JSX 同目录） | `Layout` 的 `pageCss` 属性按页传入（URL 由 `asset-urls.js` 的 `urls.pages` 管理） | 仅该页面使用的选择器 |

规则：

- **页面专属样式一律写在 `src/app/pages/<Page>.css`**，并在对应页面组件调用 `Layout` 时通过 `pageCss={[...]}` 传入；不要把页面选择器写进 `style.css`，也不要新建全局表。
- **两个以上页面复用的样式**才提升到 `style.css`，命名用 `kebab-case`，前缀体现归属（如 `cover-`、`motto-`）。
- 构建期 CSS 由 Vite 抽取并输出 hash 文件名（多个 `<link>` 可能合并进同一 chunk），无需手写产物路径；源码中也不要硬编码 `/assets/css/...`，一律引用 `asset-urls.js`。

### Tailwind v4 使用约定

- 工具类适合**一次性布局微调**（`flex` / `gap-*` / `md:*` 等）；成体系的设计语言（竖排文字、线框标题、印章、水印等）继续走手写 CSS，保持可读的中文注释。
- 入口刻意**未引入 preflight**（基础重置）：全站已有手写排版，引入重置会破坏现有样式。确需重置时再改回 `@import "tailwindcss";`。
- 类名扫描范围由入口中的 `@source "../**/*.jsx"` 声明；新增扫描目录时改这里，不要依赖默认探测。

### 级联优先级（重要）

加载顺序为 `tailwind.css → style.css → 页面 CSS`，但由于 Tailwind v4 把样式放进 `@layer`，**非分层的手写 CSS 天然压过 Tailwind 工具类**：

- 在既有元素上需要工具类覆盖手写样式时，用 `!` 前缀（如 `!mt-0`），或把手写选择器改为更高优先级；
- 反之，新写的纯工具类元素不受影响。

### 设计基调

- 配色：纸 `#f4efe6` / 淡墨 `#6b6a66` / 浓墨 `#3a3a38` / 朱砂 `#b03a2e`，新增样式优先取用现有色值。
- 字体：正文统一走 `--font-song`（京華老宋體子集，定义于 `fonts.css`），不要另设 font-family。
- 竖排文字用 `writing-mode: vertical-rl` + `text-orientation: upright`（参考 `Index.css` 的题签 / 立轴写法）。

## 中文字体动态子集化

构建时（`build.mjs` 阶段二）遍历所有渲染后的 HTML（暂存于 `.ssg-tmp/`），收集实际用到的每个字符（含生僻字），用 [subset-font](https://github.com/papandreou/subset-font)（HarfBuzz wasm）把 33MB 的源字体子集化为仅含这些字形的 woff2（当前约 152KB）。woff2 与字体 CSS 一并写入暂存目录，交给阶段三的 Vite 客户端构建统一输出 `[name].[hash].woff2`；内容不变则缓存永久有效，新增生僻字后重建，子集自动扩容。缺字回退栈：Songti SC / SimSun / Noto Serif CJK SC / serif。dev 模式跳过子集化（太慢），直接用回退栈。英文站走独立系统衬线栈（`fonts.en.css`），不参与 CJK 子集化。

## 一次性配置（部署前）

1. **Cloudflare 账号**（免费）。
2. **R2 私有桶**（免费 10GB；源字体绝不进公开仓库）：
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create bqcbqc-assets
   npx wrangler r2 object put bqcbqc-assets/fonts/jinghua-oldsong-v3.ttf \
     --file="fonts/source/source-font.ttf" --remote
   ```
3. **API Token**：Cloudflare 面板 → My Profile → API Tokens → Create Token（自定义），权限：`Cloudflare Pages → Edit` + `Workers R2 Storage → Object Read`（Account 级）。
4. **GitHub Secrets**（仓库 Settings → Secrets and variables → Actions）：
   - `CLOUDFLARE_ACCOUNT_ID`（面板首页右侧）
   - `CLOUDFLARE_API_TOKEN`（上一步生成的 token）
5. **Pages 项目**（`wrangler pages deploy` 不会自动创建，需先手动建一次）：
   ```bash
   npx wrangler pages project create bqcbqc --production-branch=main
   ```

配置完成后 push 或在 Actions 页手动 Re-run，CI 会自动构建并部署，正式站点地址 `https://bqcbqc.org`（绑定步骤见下节）。

## 自定义域名 bqcbqc.org 配置

1. 域名 `bqcbqc.org` 就绪后，把其 NS 迁入 Cloudflare（免费方案，推荐：自动 SSL + 完整功能）。
2. Cloudflare 面板 → Workers & Pages → `bqcbqc` → Custom domains → 添加域名（裸域 `bqcbqc.org` + `www.bqcbqc.org` 都可加）。
3. 等待证书自动签发（通常几分钟），HTTPS 直接可用。
4. `src/content/{zh-cn,en}/site.json` 的 `url` 已为 `https://bqcbqc.org`，无需再改；若日后换域名，改这里并 push（sitemap / robots / canonical 全站自动跟随）。

## 字体许可备注

源字体京華老宋體为商业授权字体，**已排除出 git 仓库**，CI 从 R2 私有桶获取。部署前请确认许可条款覆盖：① Web 嵌入（@font-face）；② 子集化；③ 公开可访问站点使用（线上 woff2 子集可被直接下载）。

## 已知限制

- Cloudflare 免费版无中国大陆节点，国内访问速度一般。
- Pages 免费版 500 次构建/月、并发构建 1。
