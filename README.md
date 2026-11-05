# 彩票统计 · GitHub Pages 部署说明

## 一、部署后的页面是什么

GitHub Pages 的页面由 `.github/workflows/deploy-pages.yml` 发布：工作流把 `dist/单文件版/彩票统计.html` 复制为 `_site/index.html`，再通过 `actions/upload-pages-artifact@v3` 与 `actions/deploy-pages@v4` 提交为 Pages Artifact。

该 HTML 已把四彩种开奖数据内嵌在文件里，打开即是完整工具，不依赖运行时的数据请求。访问地址为：

```
https://<用户名>.github.io/<仓库名>/
```

工作流使用 Pages Artifact 发布，因此 **Settings → Pages → Build and deployment → Source 选择 GitHub Actions**。

## 二、仓库目录说明

| 路径 | 作用 |
|---|---|
| `.github/workflows/deploy-pages.yml` | 发布单文件版到 GitHub Pages |
| `.github/workflows/refresh-data.yml` | 定时抓取开奖数据并更新 `dist/` |
| `static/index.html` | 网页源码，构建单文件版时读取 |
| `dist/单文件版/彩票统计.html` | 数据内嵌的正式成品，Pages 发布的就是它 |
| `dist/static_site/data/*.json` | 构建链读写的数据副本 |
| `data/ssq.json`、`dlt.json`、`3d.json`、`pls.json` | 网址版首页运行时读取的数据 |
| `index.html` | 网址版首页，运行时 `fetch('./data/<彩种>.json')` |
| `manifest.json`、`sw.js`、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png` | PWA 图标与缓存控制 |
| `.nojekyll` | 让静态文件原样发布，跳过 Jekyll 处理 |
| `build_single.py`、`pwa_assets.py`、`build_static.py` | 生成单文件版与网址版的构建脚本 |
| `crawler.py`、`cron_refresh.py`、`requirements.txt` | 抓取官方接口、增量合并、定时任务入口 |
| `tools/cloud_proxy.py` | 福彩数据在线更新用的云函数源码 |
| `tools/云代理部署说明.md` | 云函数部署与配置步骤 |
| `Dockerfile`、`Procfile`、`railway.json`、`render.yaml`、`vercel.json`、`start.sh` 等 | 其他部署方式的配置文件，Pages 构建不读取 |
| `一键更新并推送.bat`、`刷新数据.bat`、`启动本地服务.bat` 等 | Windows 下手动刷新与推送的工具 |

`deploy-pages.yml` 发布 `dist/单文件版/彩票统计.html`；根目录的 `index.html` 与 `data/` 供网址版使用，在本发布方式下不参与 Pages 构建。Pages 产物只有 `_site/`，仓库里的源码、脚本与文档不会作为网页对外提供。

## 三、首次部署步骤

1. 把仓库文件上传到 `main` 分支根目录，保持 `.github/`、`data/`、`dist/`、`static/`、`tools/` 的目录层级。
2. 打开 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 打开 **Settings → Actions → General → Workflow permissions**，选择 **Read and write permissions**。`refresh-data.yml` 需要把刷新结果提交回仓库。
4. 打开 **Actions**，选中 `部署到 GitHub Pages`，点 **Run workflow** 手动运行一次；向 `dist/单文件版/**` 推送变更时也会自动触发。
5. 等待约 1~2 分钟，访问 `https://<用户名>.github.io/<仓库名>/`。

若仓库是 fork，需要在 Actions 页面先启用工作流；定时工作流在 fork 中默认不运行。

## 四、deploy-pages.yml

| 项 | 内容 |
|---|---|
| 触发条件 | `push` 且 `paths: dist/单文件版/**`；`workflow_dispatch` 手动 |
| 必需文件 | `dist/单文件版/彩票统计.html` |
| 主要步骤 | `actions/checkout` → 建立 `_site/` → 复制成品为 `_site/index.html` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4` |
| 产物 | Pages Artifact，部署后即为站点首页 |

只要 `dist/单文件版/彩票统计.html` 存在，工作流即可完成。数据刷新导致该文件变化时，发布会自动触发。

## 五、refresh-data.yml

| 项 | 内容 |
|---|---|
| 定时 | UTC `13:43`、`01:13`（北京时间 21:43、09:13），开奖日轮询等待官方放出新期号 |
| 手动 | `workflow_dispatch` |
| 主要步骤 | `actions/checkout` → `setup-python` → `pip install -r requirements.txt` → `python3 cron_refresh.py --poll-minutes` → `git add dist/` 并提交 |
| 心跳提交 | 数据无变化时写 `dist/.last-check` 并提交，保持仓库活动，避免公开仓库长时间无提交时定时任务被停用 |
| 依赖文件 | `requirements.txt`、`cron_refresh.py`、`crawler.py`、`static/index.html`、`build_single.py`、`pwa_assets.py`、`dist/static_site/data/*.json` |

GitHub Actions 的出口 IP 位于境外，彩票官方接口可能返回 403 / 567 等风控响应，遇到时该次抓取会失败。数据兜底方式见第七节。

## 六、构建链

```
cron_refresh.py
  ├─ crawler.py                         抓取官方接口
  ├─ dist/static_site/data/*.json       读旧期号、写新数据
  └─ build_single.py                    重新生成单文件版
       ├─ static/index.html             网页源码
       ├─ dist/static_site/data/*.json  内嵌进 HTML 的数据
       └─ pwa_assets.py                 内嵌 PWA 图标
            ↓
     dist/单文件版/彩票统计.html  →  deploy-pages.yml 发布
```

`crawler.py` 采用增量抓取，只取新增期数；合并时保留已有奖池序列，避免长周期走势被截断。

## 七、数据更新方式

| 范围 | 方式 |
|---|---|
| 大乐透 / 排列三 | 页面菜单 → 数据更新 → 「只更新体彩（免代理）」，浏览器直连官方接口，走访客自己的网络 |
| 双色球 / 福彩3D | 管理员配置云代理后导出 `proxy.json` 放到站点根目录，普通用户打开页面即自动生效 |
| 全量重抓 | 本地运行 `刷新数据.bat` / `一键更新并推送.bat`，用本机境内 IP 抓取后推送仓库 |
| 自动 | `refresh-data.yml` 定时执行，成功后由 `deploy-pages.yml` 重新发布 |

四彩种当前数据：双色球 2082 期、大乐透 2942 期、福彩3D 4795 期、排列三 7765 期。

## 八、云代理（可选）

福彩官方接口不开放跨域，双色球与福彩3D 的浏览器在线更新需要云函数转发；体彩接口开放跨域，无需代理。

`proxy.json` 放在站点根目录、与 `index.html` 同级：

```json
{"proxy": "https://xxxx.ap-guangzhou.tencentscf.com/", "updated": "2026-11-05"}
```

配置由管理员在「数据更新」面板完成并导出，普通用户界面不显示配置入口，打开页面时自动读取。单文件版的地址可用 `设置云代理并重建.bat`，或执行 `python build_single.py --proxy=<地址>` 写入 HTML。

地址末尾不带 `?url=`，应用请求时会自行拼接。云函数的部署与验证步骤见 `tools/云代理部署说明.md`。缺 `proxy.json` 时页面照常打开，只是福彩两彩种不能使用在线更新。

## 九、验证

1. 访问站点地址，确认页面加载、页签可切换、开奖记录有数据。
2. 打开 **Actions**，确认 `部署到 GitHub Pages` 为绿色；失败时展开日志定位步骤。
3. 页面覆盖后没有变化，按 `Ctrl+F5` 强刷；`sw.js` 仍缓存旧版时，清除站点数据或用无痕窗口打开一次。
4. 打开浏览器开发者工具的 Network 面板，确认 `data/*.json`（网址版）或页面自身（单文件版）返回 200。

## 十、常见问题

| 现象 | 处理 |
|---|---|
| 打开显示 404 或只看到 README | 确认 Pages Source 为 GitHub Actions，并已成功运行过一次 `部署到 GitHub Pages` |
| 页面内容没变化 | `sw.js` 缓存，强刷或清除站点数据 |
| `deploy-pages.yml` 报找不到文件 | 检查 `dist/单文件版/彩票统计.html` 是否已上传 |
| 定时任务没有运行 | 检查 Workflow permissions、fork 限制，以及仓库近期是否有提交 |
| 抓取工作流报 403 / 567 | 官方接口对境外出口 IP 的风控，改用第七节的本地脚本或云代理 |
| 在线更新里福彩两彩种失败 | 检查 `proxy.json` 是否存在、地址是否可访问、云函数是否已部署 |

## 十一、安全

- 不要把 `管理员账号.txt`、`授权码名单.txt`、`license.json` 放入公开仓库。
- `tools/cloud_proxy.py` 只含彩票官方域名白名单，不含密钥，可以随仓库留存。
- `proxy.json` 里是函数 URL，公开可见；云函数内部已做域名白名单限制。
- 本地诊断脚本与测试文件不参与 Pages 构建，可按需要清理，清理时保留第六节构建链上的文件。
