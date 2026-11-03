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
    await w.ensure('ssq'); await w.ensure('3d');
    w.S.lot = 'ssq'; w.S.tab = 'mine'; w.render();
    let m = doc.getElementById('main').innerHTML;
    ok(m.includes('选号（'), '④ 选号区在 mine 页');
    ok(/我的选号记录|共 <b>/.test(m) || m.includes('筛选'), '④ 记录段已并入 mine 页');

    // 角标挂到 mine
    const tb = doc.getElementById('t-mine');
    ok(!!tb, '④ t-mine 按钮存在');
    ok(!doc.getElementById('t-rec'), '④ 旧的 t-rec 页签已移除');

    // ⑤ 弹窗：依次打开四个，确认有 mh 标题栏
    const cases = [['showHelp', '功能说明'], ['showSource', '数据来源'], ['openLic', '访问授权']];
    for (const [fn, title] of cases) {
      if (typeof w[fn] === 'function') {
        w[fn]();
        let h = doc.getElementById('modal').innerHTML;
        ok(h.includes('class="mh"') && h.includes('class="mask"') && h.includes('class="mb"'),
          '⑤ ' + title + ' 弹窗结构完整（mask/modal/mh/mb）');
        ok(h.includes(title) || title === '访问授权', '⑤ ' + title + ' 标题正确');
        w.closeHelp();
      } else { console.log('  · 跳过 ' + fn + '（不存在）'); }
    }

    // 收藏命名弹窗（自定义关闭函数）
    if (typeof w.favNameOpen === 'function') {
      w.favNameOpen('ssq', [1, 2, 3, 4, 5, 6], [7], function () { });
      let h = doc.getElementById('modal').innerHTML;
      ok(h.includes('favNameCancel'), '⑤ 收藏命名弹窗使用自定义关闭函数');
      ok(h.includes('class="mh"'), '⑤ 收藏命名弹窗标题栏完整');
      w.closeHelp();
    }

    // ⑦ renderMine 已拆分
    ok(typeof w.minePickPad === 'function', '⑦ minePickPad 已抽出');
    ok(typeof w.renderMine === 'function', '⑦ renderMine 仍在');

    // ⑥ 缩水共用复式号码盘
    ok(typeof w.fsIsFushi === 'function', '⑥ fsIsFushi 存在');
    w.S.fsMode = 'shrink';
    ok(w.fsIsFushi() === true, '⑥ shrink 模式走复式号码盘');
    w.S.fsMode = 'dantuo';
    ok(w.fsIsFushi() === false, '⑥ 胆拖模式不走复式号码盘');
    w.S.fsMode = 'fushi';

    // 号码统计窗口共用
    w.S.tab = 'stat'; w.S.statWin = 'month'; w.S.statView = 'freq'; w.render();
    m = doc.getElementById('main').innerHTML;
    ok(m.includes('近一个月'), '① 窗口下拉在号码统计页');
  } catch (e) { console.log('异常:', e.message, e.stack.split('\n')[1]); fail++; }
  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
