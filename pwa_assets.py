# -*- coding: utf-8 -*-
"""PWA 资源：图标 + manifest.json + sw.js

目的：让手机浏览器可以「添加到主屏幕」，得到一个图标、点开即用。

- 单文件版（dist/单文件版/彩票统计.html）：
  没有伴生文件，manifest 与 apple-touch-icon 全部用 data URI 内嵌。
  Service Worker 不能注册 data URI，故单文件版不注册 SW ——
  但它的数据本来就烤在文件里，浏览器缓存住后离线同样能用。

- 静态站版（dist/static_site/）：
  写出 manifest.json / sw.js / icon-192.png / icon-512.png / apple-touch-icon.png，
  并注册 SW，首次打开后即可离线使用。
"""
import os
import io
import json
import base64

APP_NAME = "彩票统计"
SHORT_NAME = "彩票"
THEME = "#e8402a"
BG = "#ffffff"


def make_icon(size):
    """画一个简单图标：红底 + 白色票面 + 三个小球"""
    try:
        from PIL import Image, ImageDraw
    except Exception:          # noqa
        return None
    img = Image.new("RGB", (size, size), THEME)
    d = ImageDraw.Draw(img)
    s = float(size)
    cx = cy = s / 2
    # 票面（白色圆角矩形，用椭圆近似即可）
    d.ellipse([cx - s * 0.30, cy - s * 0.37, cx + s * 0.30, cy + s * 0.37],
              fill="#ffffff")
    rr = s * 0.085
    for i, col in enumerate(["#e8402a", "#2b6cd4", "#e8402a"]):
        px = cx + (i - 1) * s * 0.155
        d.ellipse([px - rr, cy - rr, px + rr, cy + rr], fill=col)
    return img


def icon_bytes(size):
    im = make_icon(size)
    if im is None:
        return None
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def icon_b64(size):
    b = icon_bytes(size)
    return base64.b64encode(b).decode() if b else None


def manifest_obj():
    return {
        "name": APP_NAME,
        "short_name": SHORT_NAME,
        "start_url": "./index.html",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": BG,
        "theme_color": THEME,
        "lang": "zh-CN",
        "icons": [
            {"src": "./icon-192.png", "sizes": "192x192", "type": "image/png",
             "purpose": "any"},
            {"src": "./icon-512.png", "sizes": "512x512", "type": "image/png",
             "purpose": "any maskable"},
        ],
    }


SW_JS = """/* 彩票统计 · Service Worker
   缓存首页与数据，首次打开后即可离线使用。
   只在 https / localhost 下注册；file:// 打开单文件版时不生效。 */
var CACHE = 'lottery-v1';
var ASSETS = ['./index.html', './manifest.json',
              './data/ssq.json', './data/dlt.json',
              './data/3d.json', './data/pls.json'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(ASSETS.map(function(u){
      return c.add(u).catch(function(){});   /* 缺哪个文件都不影响安装 */
    }));
  }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){
      return k === CACHE ? null : caches.delete(k);
    }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  /* 网络优先，失败再回落缓存：保证能看到最新数据 */
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(req).then(function(r){
        return r || caches.match('./index.html');
      });
    })
  );
});
"""


def install_pwa(outdir, html, single=False):
    """静态站版：写出 manifest.json / sw.js / 图标，并替换 html 占位符"""
    os.makedirs(outdir, exist_ok=True)
    # 图标
    for sz, name in ((192, "icon-192.png"), (512, "icon-512.png"),
                     (180, "apple-touch-icon.png")):
        b = icon_bytes(sz)
        if b:
            with open(os.path.join(outdir, name), "wb") as f:
                f.write(b)
    # manifest
    with open(os.path.join(outdir, "manifest.json"), "w",
              encoding="utf-8") as f:
        json.dump(manifest_obj(), f, ensure_ascii=False, indent=2)
    # sw.js
    with open(os.path.join(outdir, "sw.js"), "w", encoding="utf-8") as f:
        f.write(SW_JS)
    # 替换 html 占位符
    html = html.replace(
        "<!--PWA:APPLE_ICON-->",
        '<link rel="apple-touch-icon" href="./apple-touch-icon.png">', 1)
    html = html.replace(
        "<!--PWA:MANIFEST-->",
        '<link rel="manifest" href="./manifest.json">\n'
        '<script>/* PWA：https / localhost 下注册 Service Worker，'
        '首次打开后即可离线使用 */\n'
        'if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){\n'
        '  window.addEventListener("load",function(){'
        'navigator.serviceWorker.register("./sw.js").catch(function(){});});\n'
        '}</script>', 1)
    return html


def inline_pwa(html):
    """单文件版：把 manifest 与 apple-touch-icon 内联成 data URI"""
    b64 = icon_b64(180)
    if b64:
        html = html.replace(
            "<!--PWA:APPLE_ICON-->",
            '<link rel="apple-touch-icon" href="data:image/png;base64,%s">' % b64,
            1)
    else:
        html = html.replace("<!--PWA:APPLE_ICON-->", "", 1)

    m = manifest_obj()
    # 内联图标改用 data URI（单文件版没有伴生文件）
    b192 = icon_b64(192)
    if b192:
        m["icons"] = [{
            "src": "data:image/png;base64," + b192,
            "sizes": "192x192", "type": "image/png", "purpose": "any"}]
    mj = json.dumps(m, ensure_ascii=False, separators=(",", ":"))
    import urllib.parse
    href = "data:application/manifest+json," + urllib.parse.quote(mj)
    html = html.replace(
        "<!--PWA:MANIFEST-->",
        '<link rel="manifest" href="%s">\n'
        '<script>/* PWA：https 下尝试注册 SW；单文件版无伴生 sw.js，'
        '注册失败会被静默忽略 */\n'
        'if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){\n'
        '  window.addEventListener("load",function(){'
        'navigator.serviceWorker.register("./sw.js").catch(function(){});});\n'
        '}</script>' % href, 1)
    return html


if __name__ == "__main__":
    print("icon180 b64 len:", len(icon_b64(180) or ""))
