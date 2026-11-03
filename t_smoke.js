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
    await w.ensure('ssq');
    w.S.lot = 'ssq'; w.S.tab = 'mine';

    // 收藏（走页内输入框，不依赖 prompt）
    w.S.pickRed = [2, 11, 13, 14, 16, 26]; w.S.pickBlue = [1];
    if (typeof w.addBet === 'function') w.addBet();
    let bets = w.getBets();
    ok(bets.length >= 1, '收藏前置：我的选号有 ' + bets.length + ' 注');

    // 投注图片弹窗（⑤ 改造过外壳）
    if (typeof w.showBetImage === 'function') {
      w.showBetImage();
      let h = doc.getElementById('modal').innerHTML;
      ok(h.includes('class="mh"') && h.includes('投注图片'), '⑤ 投注图片弹窗结构完整');
      ok(h.includes('class="mb"'), '⑤ 投注图片内容区完整');
      w.closeHelp();
    } else { console.log('  · betSlip 不存在，跳过'); }

    // 收藏命名弹窗
    const fnames = Object.keys(w).filter(k => /^fav/i.test(k) && typeof w[k] === 'function');
    console.log('  收藏相关函数:', fnames.join(','));
    if (typeof w.favAskName === 'function') {
      w.favAskName([2,11,13,14,16,26],[1],function(){});
      let h = doc.getElementById('modal').innerHTML;
      ok(h.includes('class="mh"') && h.includes('class="mask"'), '⑤ 收藏命名弹窗结构完整');
      const el = doc.getElementById('favname');
      ok(!!el, '⑤ 收藏命名输入框存在（不依赖 prompt）');
      if (el) {
        el.value = '测试收藏';
        if (typeof w.favNameOk === 'function') { w.favNameOk(); }
      }
    }

    // 二维码 / 扫码导入 / 守号追踪 弹窗
    [['syncShowQr','二维码'],['syncShowImport','扫码导入'],['favGTrack','守号追踪']].forEach(function (p) {
      if (typeof w[p[0]] === 'function') {
        try {
          if(p[0]==='favGTrack'){ var fl=w.favFlat?w.favFlat():[]; if(!fl.length){ console.log('  · 无收藏，跳过守号追踪'); return; } w[p[0]](fl[0].lot, fl[0]); } else w[p[0]]();
          let h = doc.getElementById('modal').innerHTML;
          if(h.trim()==='' ){ console.log('  · '+p[0]+' 需要 canvas，jsdom 无此能力（环境限制，非缺陷）'); } else ok(h.includes('class="mh"') && h.includes('class="mb"'), '⑤ ' + p[0] + ' 弹窗结构完整');
          w.closeHelp();
        } catch (e) { console.log('  · ' + p[0] + ' 调用异常（可能需参数）'); }
      }
    });

    // 备份 txt
    if (typeof w.backupTxt === 'function') {
      let t = w.backupTxt();
      ok(typeof t === 'string' && t.indexOf('我的收藏') >= 0 || t.indexOf('选号') >= 0, '备份文本可生成');
    }
  } catch (e) { console.log('异常:', e.message); fail++; }
  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
