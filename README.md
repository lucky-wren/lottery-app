# 彩票统计 · GitHub Pages 部署说明

本仓库是一个**自动更新的静态站点**：定时工作流在云端抓取开奖数据，重新生成单文件页面，再由部署工作流发布到 GitHub Pages。页面数据已内嵌在 HTML 里，访客打开即用、不需要联网取数，也不需要任何配置。

访问地址：`https://<用户名>.github.io/<仓库名>/`

---

## 一、仓库目录说明

| 路径 | 作用 |
|---|---|
| `.github/workflows/refresh-data.yml` | 定时抓取数据、重建产物、推送提交 |
| `.github/workflows/deploy-pages.yml` | 把单文件版发布为 Pages 首页 |
| `cron_refresh.py` | 定时工作流入口：轮询等开奖、合并数据、触发构建 |
| `crawler.py` | 抓取四个彩种官方接口；请求经境内云函数转发 |
| `build_single.py` | 把数据烤进 HTML，生成单文件版 |
| `build_static.py` | 生成网址版站点（`dist/static_site/`） |
| `pwa_assets.py` | manifest、图标、Service Worker |
| `static/index.html` | 页面源码（所有功能都在这里） |
| `dist/单文件版/彩票统计.html` | **Pages 实际发布的文件**，数据内嵌 |
| `dist/static_site/data/*.json` | 四彩种数据文件，增量合并的基准 |
| `cloud_proxy.py` | 境内云函数源码（也给到 `tools/` 一份） |
| `云代理部署说明.md` | 云函数逐屏部署、验证与排错 |
| `requirements.txt` | 定时工作流安装的 Python 依赖 |

`dist/` 下的产物要提交进仓库：它既是定时抓取的合并基准，也是 Pages 的发布来源。

---

## 二、一次性配置

### 1. 配置仓库 Secret `LOTTERY_PROXY`

云函数地址是**唯一需要配置的东西**。

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

- Name：`LOTTERY_PROXY`
- Secret：函数 URL 地址，形如 `https://125xxxxxxx-abcdefgh.ap-guangzhou.tencentscf.com`

末尾**不要带 `?url=`**。云函数的部署步骤见 `云代理部署说明.md`，源码在 `cloud_proxy.py`。

### 2. Pages Source 选 GitHub Actions

仓库 → **Settings** → **Pages** → **Build and deployment** → **Source** 选 **GitHub Actions**。

部署工作流用 `actions/deploy-pages@v4` 上传 Pages Artifact，必须选这一项；不要选 `Deploy from a branch`。

### 3. Workflow permissions

仓库 → **Settings** → **Actions** → **General** → **Workflow permissions** 选 **Read and write permissions**，并保存。

定时工作流需要把更新后的 `dist/` 提交回仓库，只读权限会推送失败。

### 4. 手动跑一次

**Actions** → **定时刷新彩票数据** → **Run workflow** → **Run workflow**。

这一步会验证云函数连通性、抓取四彩种、生成产物并推送，并由工作流显式触发部署工作流。之后 **Actions** → **部署到 GitHub Pages** 跑完，站点即可访问。

---

## 三、云函数（境内转发）

GitHub Actions 的 runner 出口 IP 在境外，彩票站按 IP 段风控，直接抓官方接口会返回 403 / 567。云函数部署在境内，出口 IP 不在被封的段里。

抓取脚本把每个官方请求改写成：

```
<函数地址>?url=<URL 编码后的官方接口地址>
```

云函数代请求官方接口，把原文返回给脚本。`cloud_proxy.py` 里写死了域名白名单，只放行 `www.cwl.gov.cn`、`cwl.gov.cn`、`webapi.sporttery.cn`、`www.sporttery.cn`，避免被当作开放代理滥用。

函数 URL 建议配置：

- 授权类型：**开放**（匿名访问，定时工作流不携带凭证）
- CORS：**不启用**，跨域由源码返回的响应头处理；若启用，Allow-Origin 填 `*`、Allow-Methods 勾 `GET`、Expose-Headers 不要留空
- 执行超时：**60 秒**（默认 3 秒会在冷启动时超时）
- 触发器：保持「暂不创建」，建好函数后单独创建函数 URL

验证：浏览器打开 `https://你的地址/?lot=ssq&n=3`，返回双色球 JSON 即可。详细逐屏配置与排错见 `云代理部署说明.md`。

---

## 四、定时抓取工作流 `refresh-data.yml`

触发方式：

| 方式 | 时间（北京） | 用途 |
|---|---|---|
| schedule | 21:43 | 晚于各彩种开奖时刻，配合轮询等官方出数据 |
| schedule | 次日 09:13 | 兜底，补前一天的漏网之鱼 |
| workflow_dispatch | 手动 | 随时可跑，可指定轮询分钟数（默认 12） |
| push 到 main | 代码变更时 | `dist/**` 与 `*.md` 被排除，不会自我循环 |

工作流步骤：

1. 拉取代码、配置 Python 3.11、安装 `requirements.txt`
2. **检查云代理配置与连通性**：Secret 缺失会直接报红；否则请求 `?lot=ssq&n=1` 确认云函数可达
3. `python3 cron_refresh.py --poll-minutes 12`：按开奖日轮询，直到官方最新期号变化
4. 提交 `dist/`；无变化时写一个心跳提交（公开仓库 60 天无 activity 会被静默禁用定时任务）
5. 用 `gh workflow run deploy-pages.yml` 显式触发部署工作流
6. 任一彩种抓取失败都让 job 变红，已成功的部分照常写入

`LOTTERY_PROXY` 作为 job 级环境变量注入，同一份值被 `crawler.py`（转发请求）和 `build_single.py`（构建期常量）读取。

---

## 五、增量抓取与合并

`cron_refresh.py` 先把仓库里已有的 `dist/static_site/data/*.json` 预填到抓取器的磁盘缓存，再以增量模式运行：

| 彩种 | 每次抓取量 |
|---|---|
| 双色球、福彩3D | 最近 60 期 |
| 大乐透、排列三 | 最近 1 页（100 期） |

抓到的新期与已有全量数据按期号合并去重，奖池序列也合并后截断到最近 120 期。这样云函数只需转发小响应，不会因全量历史过大而超时。

保护逻辑：

- 官方最新期号没变就不写入
- 抓取失败回落到过期缓存时，CI 判定为失败，不拿旧数据冒充新数据
- 抓到的期号比仓库已有的还旧，直接放弃本次更新

---

## 六、构建链与部署

```
refresh-data.yml
  └─ cron_refresh.py
       ├─ crawler.py  ──(经境内云函数)──> 官方接口
       ├─ dist/static_site/data/*.json（合并后的全量数据）
       └─ build_single.py → dist/单文件版/彩票统计.html
                                └─ workflow_dispatch 触发 deploy-pages.yml
                                     └─ _site/index.html → GitHub Pages
```

`deploy-pages.yml` 只做一件事：把 `dist/单文件版/彩票统计.html` 复制成 `_site/index.html`，校验文件里含 `EMBEDDED_DATA` 标记后上传并发布。触发条件是手动 Run，或 `refresh-data.yml` 末尾的 `workflow_dispatch` 调用。

> 使用 `GITHUB_TOKEN` 推送的提交不会触发新的 workflow 运行，也不会触发 Pages 生成。因此 `refresh-data.yml` 在推送后显式调用部署工作流，不能依赖 `on: push` 的 `dist/单文件版/**` 路径过滤。

构建期还会把 Secret 地址写成产物里的 `PX_BUILTIN` 常量，仅在「数据来源」弹窗里显示通道状态，不参与取数。

---

## 七、页面里的数据更新

页面**没有手动更新入口**，菜单里也没有「数据更新」项；不需要访客登录或配置任何地址。

- 顶部常驻显示**数据更新于**（构建时刻）和最新一期摘要，用来判断数据新旧
- 数据由云端定时抓取后整体重建，页面不会往设备本机写增量数据
- Service Worker 会缓存页面，覆盖发布后若看不到变化，按 **Ctrl+F5** 强制刷新，或清一次站点数据 / 用无痕窗口打开
- 页面是单文件版，数据已内嵌，离线也能查看历史与全部分析功能

---

## 八、验证

| 检查项 | 怎么看 |
|---|---|
| Secret 已生效 | 定时工作流「检查云代理配置与连通性」打印 `云函数自检 HTTP 200` |
| 抓取成功 | 定时工作流日志里四彩种都输出期数与最新期号，且 `CHANGED=yes` 或无变化心跳 |
| 产物已提交 | 仓库 `dist/单文件版/彩票统计.html` 的提交时间更新 |
| 部署被触发 | 定时工作流末尾打印 `已触发 部署到 GitHub Pages` |
| 部署成功 | **部署到 GitHub Pages** 工作流绿灯 |
| 页面最新 | 强刷后顶部「数据更新于」为刚才的构建时间，最新一期摘要正确 |

---

## 九、常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面 404 | Pages Source 选成了分支部署，仓库根目录没有 `index.html` | Source 改成 **GitHub Actions**，手动 Run 一次部署工作流 |
| 定时工作流报「未配置仓库 Secret LOTTERY_PROXY」 | Secret 没建或名字不一致 | 按第二节重建，名字必须完全一致 |
| 云函数自检失败 | 地址失效、授权类型不是「开放」、超时过短 | 浏览器打开根路径看自检 JSON，再按云代理部署说明排查 |
| 抓取返回 403 / 567 | 云函数出口被上游临时限流，或 Secret 指向了境外平台 | 等下一次定时运行；确认云函数在境内云 |
| 数据没变化但工作流全绿 | 官方还没出新期；或抓取回落到过期缓存 | 看日志里 `CHANGED=` 与每个彩种的期号输出 |
| 推送失败 `permission denied` | Workflow permissions 是只读 | 改为 **Read and write permissions** |
| 页面看不到更新 | Service Worker 缓存 | Ctrl+F5，或清站点数据 |
| 仓库产物已更新但页面数据仍是旧的 | `GITHUB_TOKEN` 推送不会触发部署工作流 | 手动 Run 一次「部署到 GitHub Pages」；长期使用请换成本包里带显式触发步骤的 `refresh-data.yml` |
| 定时任务长期不跑 | 公开仓库 60 天无 activity 被禁用 | 工作流每天写心跳提交；长时间停跑后手动 Run 一次恢复 |

---

## 十、安全

- 云函数地址只放在仓库 Secret 里，不写死在源码；产物里的内置常量仅作状态显示
- 云函数「授权类型 = 开放」意味着任何人可匿名调用，真正的防线是 `cloud_proxy.py` 里的域名白名单，不是 URL 保密
- `管理员账号.txt`、`授权码名单.txt`、`license.json` 属于本地工程文件，**不要提交到公开仓库**；上传包里已排除
- 定时工作流一天只跑 1~2 次且只抓增量，避免高频请求触发上游限流

---

## 十一、修改管理员密码

页面里管理员登录后，可以在「管理员 → 修改密码」修改密码。**这个改动只对本机立即生效**：页面是纯静态的，密码散列是构建时写进 HTML 的，浏览器改不了它。

要让 Pages 上所有访客都用新密码，二选一：

**方式 A · 用页面导出的配置**

1. 改密成功页点「下载 license.json」（或「复制完整配置」）
2. 用下载的文件覆盖本地工程里的同名文件。它包含页面内嵌的全部授权字段（`salt` / `expire` / `codes` / `sigSalt` / `admin` / `regUrl`）；如果本地 `license.json` 另有自定义字段，请改用方式 B，避免覆盖时丢失
3. 重新构建并推送：

```bash
python build_single.py
python build_static.py
git add dist/ static/
git commit -m "更新管理员密码"
git push
```

**方式 B · 用本地脚本**

```bash
python make_license.py --admin-pass 你的新密码
python build_single.py
python build_static.py
git add dist/ static/
git commit -m "更新管理员密码"
git push
```

`make_license.py` 会同步更新 `管理员账号.txt`，原有授权码、`salt`、`sigSalt`、登记表地址都保留，不会重新签码。

推送 `dist/单文件版/**` 会触发 `deploy-pages.yml` 自动部署。部署完成后，本机之前的改密记录因为内嵌散列已变化会自动作废，统一以新的内置密码为准。

改密成功页里的新密码明文只显示一次，刷新即消失，可用「下载账号备忘」留底。`管理员账号.txt`、`授权码名单.txt`、含明文密码的备忘文件都不要提交到公开仓库。

---

## 附：本地重建产物

在自己电脑上可以不依赖云端工作流重新生成页面：

```bash
python build_single.py                      # 用仓库现有数据生成单文件版
python build_single.py --refresh            # 先抓取再生成（直连，境内网络可用）
python build_single.py --proxy=你的地址     # 构建期内置云函数地址
python build_static.py                      # 生成网址版站点
```

Windows 下可用 `设置云代理并重建.bat`、`刷新数据.bat`、`一键更新并推送.bat`。这些是本地维护工具，页面本身不提供手动更新入口。
