const {win, activate, ready} = require('./_harness.js');
(async()=>{
  activate(); await ready(600);
  const w=win; w.S.lot='ssq';
  const d=w.D.ssq, N=d.rows.length, prof=w.guessProfile(N);
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const dist=a=>{const m={};a.forEach(x=>m[x]=(m[x]||0)+1);const k=Object.keys(m).sort((p,q)=>p-q);
    return k.map(x=>x+':'+(m[x]/a.length*100).toFixed(1)+'%').join(' ');};

  // 历史分布（最近600期）
  const from=N-600; const H={lk:[],rp:[],sm:[],od:[],sp:[],zc:[]};
  for(let i=from;i<N;i++){
    const m=w.guessMorph(d.rows[i][2], d.rows[i-1]?d.rows[i-1][2]:null);
    H.lk.push(m.link); H.rp.push(m.repeat); H.sm.push(m.sum); H.od.push(m.odd); H.sp.push(m.span);
    H.zc.push(m.zc.join('-'));
  }
  // 生成分布
  const G={lk:[],rp:[],sm:[],od:[],sp:[],zc:[]};
  for(let k=0;k<600;k++){
    const g=w.guessOne('morph',N,prof,null,99);
    const m=w.guessMorph(g.r, prof.last);
    G.lk.push(m.link); G.rp.push(m.repeat); G.sm.push(m.sum); G.od.push(m.odd); G.sp.push(m.span);
    G.zc.push(m.zc.join('-'));
  }
  console.log('【连号分布】历史:', dist(H.lk));
  console.log('          生成:', dist(G.lk));
  console.log('【重号分布】历史:', dist(H.rp));
  console.log('          生成:', dist(G.rp));
  console.log('【奇数分布】历史:', dist(H.od));
  console.log('          生成:', dist(G.od));
  console.log('【和值】历史 avg', avg(H.sm).toFixed(1), 'sd', Math.sqrt(avg(H.sm.map(x=>(x-avg(H.sm))**2))).toFixed(1),
              '| 生成 avg', avg(G.sm).toFixed(1), 'sd', Math.sqrt(avg(G.sm.map(x=>(x-avg(G.sm))**2))).toFixed(1));
  console.log('【跨度】历史 avg', avg(H.sp).toFixed(1), 'sd', Math.sqrt(avg(H.sp.map(x=>(x-avg(H.sp))**2))).toFixed(1),
              '| 生成 avg', avg(G.sp).toFixed(1), 'sd', Math.sqrt(avg(G.sp.map(x=>(x-avg(G.sp))**2))).toFixed(1));
  console.log('【区间分布】历史 前6:', dist(H.zc).slice(0,80));
  console.log('          生成 前6:', dist(G.zc).slice(0,80));

  // 策略区分度：冷热号命中率
  console.log('\n【策略区分度】各策略生成300注，看落在"历史前8热"/"后8冷"的比例');
  const st=w.guessStatArr(2,N,1,33,-1);
  const arr=[]; for(let n=1;n<=33;n++) arr.push({n,c:st.cnt[n]});
  arr.sort((a,b)=>b.c-a.c);
  const hot8=arr.slice(0,8).map(x=>x.n), cold8=arr.slice(-8).map(x=>x.n);
  for(const s of ['hot','cold','gap','balance','random','morph']){
    let h=0,c=0,tot=0;
    for(let k=0;k<300;k++){
      const g=w.guessOne(s,N,prof,null,99);
      g.r.forEach(x=>{tot++; if(hot8.includes(x))h++; if(cold8.includes(x))c++;});
    }
    console.log('  ',s.padEnd(8),'热号占比',(h/tot*100).toFixed(2)+'%','(随机基准24.2%)  冷号占比',(c/tot*100).toFixed(2)+'%');
  }
})().catch(e=>console.log('ERR',e.message,e.stack.split('\n')[1]));
