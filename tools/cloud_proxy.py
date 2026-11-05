# -*- coding: utf-8 -*-
"""境内云函数：福彩接口 CORS 代理（方案2）

为什么需要它
------------
实测（2026-11-03）：
  · 体彩 webapi.sporttery.cn  → 响应头含 access-control-allow-origin: *
    浏览器可直连，不需要代理。
  · 福彩 www.cwl.gov.cn       → 无任何 CORS 头，且不支持 JSONP
    浏览器直接请求会被同源策略拦截，必须经一层代理。

代理必须部署在**境内**，因为彩票站按 IP 段风控，
GitHub Actions / Render / Vercel 等境外出口一律 403 / 567。

支持的平台
----------
腾讯云 SCF + 函数 URL（API 网关触发器已下线）、阿里云 FC、华为云 FunctionGraph
（均为 Python 3 运行时，只用标准库，无需打包依赖）

腾讯云函数 URL 事件注意（对照官方文档）
--------------------------------------
事件函数收到的 event 兼容 apigw 协议，但**去掉了 queryStringParameters**，
查询参数只出现在 queryString 里；httpMethod 字段存在。
下面的 _q() 已把 queryString 放在首位，OPTIONS 预检也能被识别，
因此同一份代码在「函数 URL」和旧「API 网关触发器」下都能取到参数。

对外接口
--------
?url=<URL编码后的目标地址>   代理该地址并返回原文，带 CORS 头
?lot=ssq|3d|dlt|pls          直接返回该彩种最近数据（JSON，带 CORS 头）
                             注意：体彩直连即可，这里只是顺带提供

安全
----
只白名单放行彩票官方域名，避免被拿去当任意代理（开放代理会被滥用、封 IP）。
"""
import json
import urllib.request
import urllib.error

# 只允许代理这些域名
ALLOW_HOST = (
    "www.cwl.gov.cn",
    "cwl.gov.cn",
    "webapi.sporttery.cn",
    "www.sporttery.cn",
)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json; charset=utf-8",
}


def _ok(body, status=200):
    # 官方文档《函数 URL 概述》：标准响应负载为 {statusCode, headers, body}。
    # 但控制台「参数兼容」开启时，网关侧也可能按 API 网关集成响应格式解析，
    # 而该格式要求 isBase64Encoded 存在（见《API 网关触发器概述》）。
    # 带上 False 两种解析都能通过，函数 URL 会忽略多余字段。
    return {"isBase64Encoded": False, "statusCode": status, "headers": CORS,
            "body": body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)}


def _err(msg, status=400):
    return _ok({"success": False, "error": msg}, status)


def _allowed(url):
    """只放行彩票官方域名"""
    try:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ""
    except Exception:
        return False
    host = host.lower()
    return any(host == h or host.endswith("." + h) for h in ALLOW_HOST)


def _get(url, referer):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": referer,
    })
    return urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")


def _q(event, key):
    """兼容不同平台的取参方式"""
    q = (event.get("queryString") or event.get("queryStringParameters")
         or event.get("queryParameters") or {})
    if isinstance(q, dict):
        v = q.get(key)
        if isinstance(v, list):
            # 可能出现重复参数（如 ?url=&url=真实地址），跳过空值
            v = next((x for x in v if x), None)
        if v:
            return v
    for k in ("query", "params", "body"):
        d = event.get(k)
        if isinstance(d, dict) and d.get(key):
            return d[key]
    # 部分平台把参数放在 JSON 字符串 body 里
    b = event.get("body")
    if isinstance(b, str) and b.strip().startswith("{"):
        try:
            d = json.loads(b)
            if isinstance(d, dict) and d.get(key):
                return d[key]
        except Exception:
            pass
    return None


def main_handler(event, context=None):
    """腾讯云 SCF / 通用入口"""
    try:
        # 预检请求
        m = (event.get("httpMethod") or event.get("method") or "GET").upper()
        if m == "OPTIONS":
            return _ok("")

        # 诊断端点：回显 event 的关键字段，确认参数落在哪里（无需日志投递）
        if _q(event, "diag"):
            return _ok({
                "ok": True, "diag": True,
                "event_keys": sorted(list(event.keys()))[:40],
                "httpMethod": event.get("httpMethod") or event.get("method"),
                "queryString": event.get("queryString"),
                "hasQueryStringParameters": "queryStringParameters" in event,
                "queryStringParameters": event.get("queryStringParameters"),
                "path": event.get("path"),
            })

        url = _q(event, "url")
        if url:
            if not _allowed(url):
                return _err("域名不在白名单内", 403)
            ref = "https://www.sporttery.cn/" if "sporttery" in url \
                else "https://www.cwl.gov.cn/"
            try:
                return _ok(_get(url, ref))
            except Exception as e:      # noqa
                return _err("上游请求失败: %s" % e, 502)

        lot = _q(event, "lot")
        if lot:
            table = {
                "ssq":  ("https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/"
                         "findDrawNotice?name=ssq&issueCount=%d",
                         "https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/"),
                "3d":   ("https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/"
                         "findDrawNotice?name=3d&issueCount=%d",
                         "https://www.cwl.gov.cn/ygkj/wqkjgg/sd/"),
                "dlt":  ("https://webapi.sporttery.cn/gateway/lottery/"
                         "getHistoryPageListV1.qry?gameNo=85&provinceId=0"
                         "&pageSize=%d&isVerify=1&pageNo=1",
                         "https://www.sporttery.cn/"),
                "pls":  ("https://webapi.sporttery.cn/gateway/lottery/"
                         "getHistoryPageListV1.qry?gameNo=35&provinceId=0"
                         "&pageSize=%d&isVerify=1&pageNo=1",
                         "https://www.sporttery.cn/"),
            }
            if lot not in table:
                return _err("不支持的彩种: %s" % lot, 400)
            tpl, ref = table[lot]
            want = int(_q(event, "n") or 30)
            try:
                return _ok(_get(tpl % max(1, min(want, 300)), ref))
            except Exception as e:      # noqa
                return _err("上游请求失败: %s" % e, 502)

        # 根路径健康检查：不带参数时返回 200 自检 JSON，方便直接在浏览器里
        # 确认「函数已部署、请求确实到达了函数」。若打开地址看不到这段，
        # 说明被网关/策略挡在门外，问题不在函数代码。
        return _ok({
            "ok": True,
            "service": "lottery-proxy",
            "hint": "用法：?lot=ssq&n=3 或 ?url=<白名单内的彩票官方地址>",
            "lots": ["ssq", "3d", "dlt", "pls"],
        })
    except Exception as e:              # noqa
        return _err("内部错误: %s" % e, 500)


# 阿里云 FC 入口名不同，做一个别名
handler = main_handler


def lambda_handler(event, context=None):
    """AWS Lambda / 华为云兼容入口"""
    return main_handler(event, context)


if __name__ == "__main__":
    # 本地自测：python3 cloud_proxy.py
    # 依次验证：根路径自检 / 诊断端点 / 函数 URL 原生 event / 参数兼容 event
    for ev in ({}, {"queryString": {"diag": "1"}},
               {"queryString": {"diag": "1"}, "httpMethod": "GET"}):
        r = main_handler(ev)
        print(r["statusCode"], r["body"][:200])
    print("带参数(本地出网):",
          main_handler({"queryStringParameters": {"lot": "ssq", "n": "3"}})["body"][:200])
