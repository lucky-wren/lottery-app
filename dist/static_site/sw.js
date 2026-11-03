/* 彩票统计 · Service Worker
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
