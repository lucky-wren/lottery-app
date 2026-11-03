const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/data/workspace/lottery-app/dist/单文件版/彩票统计.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.local/' });
const w = dom.window;
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(1500);
  try {
    const doc = w.document;
    try { w.sessionStorage.setItem('lc_admin', '1'); } catch (e) { }
    console.log('锁屏态:', w.licBlocked());
    ok(typeof w.visibleTabs === 'function', 'visibleTabs 存在');

    await w.ensure('ssq'); await w.ensure('dlt'); await w.ensure('3d'); await w.ensure('pls');

    const ssqTabs = w.visibleTabs().map(t => t.id);
    console.log('  双色球页签:', ssqTabs.join(','));
    ok(ssqTabs.length === 10, '页签数 10（原 11）: ' + ssqTabs.length);
    ok(!ssqTabs.includes('freq') && !ssqTabs.includes('heat') && !ssqTabs.includes('rec'), '旧 freq/heat/rec 已移除');
    ok(ssqTabs.includes('stat') && ssqTabs.includes('zone'), '新增 stat / zone');

    w.S.lot = '3d'; w.render();
    const p3 = w.visibleTabs().map(t => t.id);
    console.log('  福彩3D 页签:', p3.join(','));
    ok(!p3.includes('blue') && !p3.includes('pool'), '⑧ 3D 下 blue/pool 已隐藏');
    ok(p3.length === 8, '3D 页签数 8: ' + p3.length);

    w.S.lot = 'ssq'; w.S.tab = 'stat'; w.S.statView = 'freq'; w.render();
    let m = doc.getElementById('main').innerHTML;
    ok(m.includes('出现次数') && m.includes('冷热分布') && m.includes('遗漏排行'), '① 三视图切换按钮都在');
    ok(m.includes('查看蓝球完整分析'), '② 蓝球跳转按钮存在');

    w.S.statView = 'heat'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('极冷') && m.includes('极热'), '① 冷热视图渲染 OK');
    w.S.statView = 'miss'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('遗漏排行榜'), '① 遗漏视图渲染 OK');

    w.S.tab = 'zone'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('区间分布') && m.includes('一区'), '③ 区间分布独立页签 OK');

    w.S.tab = 'blue'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('蓝球'), '蓝球页渲染 OK');

    w.S.tab = 'mine'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('选号（'), '④ 选号区在');

    w.S.tab = 'fsdt'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('>缩水<'), '⑥ 复式页新增「缩水」tab');
    w.S.fsMode = 'shrink'; w.render(); m = doc.getElementById('main').innerHTML;
    ok(m.includes('缩水过滤'), '⑥ 切到缩水显示过滤卡');

    ok(html.split('class="mask"').length - 1 <= 2, '⑤ mask 模板数: ' + (html.split('class="mask"').length - 1));

    let bad = [];
    for (const lot of ['ssq', 'dlt', '3d', 'pls']) {
      w.S.lot = lot;
      for (const t of w.visibleTabs()) {
        w.S.tab = t.id;
        try { w.render(); } catch (e) { bad.push(lot + '/' + t.id + ':' + e.message); }
      }
    }
    ok(bad.length === 0, '四彩种 × 各页签渲染无异常' + (bad.length ? ': ' + bad.join(' | ') : ''));
  } catch (e) { console.log('异常:', e.message); fail++; }
  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
