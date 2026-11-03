const {win, activate, ready} = require('./_harness.js');
(async()=>{
  activate(); await ready(600);
  const w=win; w.S.lot='ssq';
  const d=w.D.ssq, N=d.rows.length, prof=w.guessProfile(N);

  // 1. 形态约束拒绝率
  console.log('[形态约束拒绝率] (生成1000次原始注, 看多少被形态挡下)');
  for(const s of ['morph','hot','cold','random']){
    let ok=0, first=0;
    for(let k=0;k<1000;k++){
      const g=w.guessOneRaw(s,N);
      const m=w.guessMorph(g.r, prof.last);
      if(w.guessMorphOK(m,prof)) ok++;
      // 单维度拒绝原因
      if(m.sum<prof.sumLo||m.sum>prof.sumHi) first++;
    }
    console.log('  ', s.padEnd(7), '通过率', (ok/10).toFixed(1)+'%', ' 和值越界', (first/10).toFixed(1)+'%');
  }

  // 2. 多注重合（当前 maxOv=2）
  console.log('\n[多注重合] maxOv=2, 各策略生成 5 注, 重复30轮');
  for(const s of ['morph','hot','cold']){
    let mxAll=0, avAll=0, failOv=0, rounds=30;
    for(let r=0;r<rounds;r++){
      const out=[];
      for(let i=0;i<5;i++) out.push(w.guessOne(s,N,prof,out,2));
      let mx=0,sum=0,c=0;
      for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){const o=w.guessOverlap(out[i].r,out[j].r); mx=Math.max(mx,o); sum+=o; c++;}
      mxAll+=mx; avAll+=sum/c;
      if(mx>2) failOv++;
    }
    console.log('  ', s.padEnd(7), '平均重合', (avAll/rounds).toFixed(2), ' 最大重合均值', (mxAll/rounds).toFixed(2), ' 违约轮次', failOv+'/'+rounds);
  }

  // 3. 策略区分度：同一策略反复生成，号码重合度（集中度）
  console.log('\n[策略内集中度] 各策略生成5注, 统计"出现频次最高的号码"被选中的注数');
  for(const s of ['hot','cold','random']){
    const freq={};
    for(let r=0;r<20;r++){
      const out=[];
      for(let i=0;i<5;i++) out.push(w.guessOne(s,N,prof,out,99));
      out.forEach(g=>g.r.forEach(x=>freq[x]=(freq[x]||0)+1));
    }
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const bot=Object.entries(freq).sort((a,b)=>a[1]-b[1]).slice(0,5);
    console.log('  ', s.padEnd(7), '最常出:', top.map(x=>x[0]+':'+x[1]).join(' '), '| 最少:', bot.map(x=>x[0]+':'+x[1]).join(' '));
  }

  // 4. 号码热度排名：看看 hot 策略到底选的是不是热号
  const st=w.guessStatArr(2,N,1,33,-1);
  const arr=[]; for(let n=1;n<=33;n++) arr.push({n, c:st.cnt[n]});
  arr.sort((a,b)=>b.c-a.c);
  console.log('\n[号码热度排名] 前8热:', arr.slice(0,8).map(x=>x.n+'('+x.c+')').join(' '));
  console.log('               后8冷:', arr.slice(-8).map(x=>x.n+'('+x.c+')').join(' '));
  console.log('  理论均值', (N*6/33).toFixed(1), ' 实际min', arr[arr.length-1].c, ' max', arr[0].c);
})().catch(e=>console.log('ERR',e.message,e.stack.split('\n')[1]));
