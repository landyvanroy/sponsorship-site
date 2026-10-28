// asset-urls.js — CSS 资源 URL 的单一来源。
// 默认值为生产环境 URL（/assets/css/...，由 Vite 构建产出 hash 文件名）；
// dev server（vite.config.mjs）与生产构建（build.mjs）在渲染前注入实际可解析的源码路径。
const DEFAULTS = {
  tailwind: '/assets/css/tailwind.css',
  style: '/assets/css/style.css',
  pages: {
    index: ['/assets/css/pages/Index.css'],
    '404': [],
  },
};

const override = typeof window !== 'undefined' ? window.__BQC_ASSET_URLS__ : undefined;

const urls = {
  tailwind: override?.tailwind ?? DEFAULTS.tailwind,
  style: override?.style ?? DEFAULTS.style,
  pages: { ...DEFAULTS.pages, ...override?.pages },
};

export function setAssetUrls(next = {}) {
  if (next.tailwind !== undefined) urls.tailwind = next.tailwind;
  if (next.style !== undefined) urls.style = next.style;
  if (next.pages) {
    for (const [key, value] of Object.entries(next.pages)) urls.pages[key] = value;
  }
}

export function getAssetUrls() {
  return urls;
}

export default urls;
