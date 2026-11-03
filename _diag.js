const {win, activate, ready} = require('./_harness.js');
(async()=>{
  activate(); await ready(600);
  const w = win;
  w.S.lot='ssq';
  if(!w.D.ssq || !w.D.ssq.rows){ console.log('NO DATA'); return; }
  const d=w.D.ssq, N=d.rows.length;
  console.log('期数', N, 'redMax', d.redMax, 'redCount', d.redCount);

  // 历史基准：最近600期形态统计
  const from=Math.max(1,N-600);
  let LK=[],RP=[],SM=[],OD=[],SP=[];
  for(let i=from;i<N;i++){
    const m=w.guessMorph(d.rows[i][2], d.rows[i-1]?d.rows[i-1][2]:null);
    LK.push(m.link); RP.push(m.repeat); SM.push(m.sum); OD.push(m.odd); SP.push(m.span);
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  console.log('\n[历史基准 最近600期]');
  console.log('  连号数 avg', avg(LK).toFixed(3), ' 重号 avg', avg(RP).toFixed(3),
              ' 和值 avg', avg(SM).toFixed(1), ' 奇数 avg', avg(OD).toFixed(2), ' 跨度 avg', avg(SP).toFixed(1));
  // 连号分布
  const lkd={}; LK.forEach(x=>lkd[x]=(lkd[x]||0)+1);
  console.log('  连号分布', JSON.stringify(lkd));

  const prof=w.guessProfile(N);
  console.log('\n[形态画像] sum', prof.sumLo,'~',prof.sumHi, ' odd', prof.oddLo,'~',prof.oddHi,
              ' linkHi',prof.linkHi, ' repHi',prof.repHt||prof.repHi, ' span', prof.spanLo,'~',prof.spanHi,
              ' zLo',JSON.stringify(prof.zLo),' zHi',JSON.stringify(prof.zHi));

  // 各策略：生成 200 注，统计形态与冷热
  const strats=['morph','hot','cold','gap','balance','random'];
  console.log('\n[各策略生成 200 注的形态均值]');
  console.log('策略      连号   重号   和值   奇数   跨度   平均热度(次数)  平均遗漏');
  for(const s of strats){
    let LK2=[],RP2=[],SM2=[],OD2=[],SP2=[],HOT=[],GAP=[];
    for(let k=0;k<200;k++){
      const g=w.guessOne(s,N,prof,null,99);
      const m=w.guessMorph(g.r, prof.last);
      LK2.push(m.link); RP2.push(m.repeat); SM2.push(m.sum); OD2.push(m.odd); SP2.push(m.span);
      const st=w.guessStatArr(2,N,1,d.redMax,-1);
      g.r.forEach(x=>{HOT.push(st.cnt[x]); GAP.push(st.cur[x]);});
    }
    console.log(s.padEnd(9), avg(LK2).toFixed(3), ' ', avg(RP2).toFixed(3), ' ',
      avg(SM2).toFixed(1), ' ', avg(OD2).toFixed(2), ' ', avg(SP2).toFixed(1), '  ',
      avg(HOT).toFixed(1), '        ', avg(GAP).toFixed(2));
  }
})().catch(e=>console.log('ERR',e.message,e.stack.split('\n')[1]));
