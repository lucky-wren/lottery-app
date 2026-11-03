const {win, activate, ready} = require('./_harness.js');
(async()=>{
  activate(); await ready(600);
  const w=win; const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  for(const lot of ['ssq','dlt','3d','pls']){
    w.setLot(lot); await ready(500);
    const d=w.D[lot];
    if(!d||!d.rows||!d.rows.length){ console.log(lot,'NO DATA'); continue; }
    const N=d.rows.length, prof=w.guessProfile(N), isP=w.isPos();
    let res=[];
    for(const s of ['hot','cold','morph']){
      let mx=0,av=0,bad=0,okm=0;
      for(let r=0;r<30;r++){
        const out=[];
        for(let i=0;i<5;i++) out.push(w.guessOne(s,N,prof,out,2));
        let m2=0,su=0,c=0;
        for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){
          const o=isP?0:w.guessOverlap(out[i].r,out[j].r);
          m2=Math.max(m2,o);su+=o;c++;
        }
        mx+=m2;av+=su/c; if(m2>2)bad++;
        // 唯一性（3D）
        if(isP){ const set=new Set(out.map(g=>g.r.slice().sort().join(','))); if(set.size<5) bad++; }
      }
      res.push(s+' 重合'+(av/30).toFixed(2)+(bad?' 违约'+bad:''));
    }
    console.log(lot.padEnd(4),'N='+String(N).padEnd(5),'redMax='+(d.redMax||'-'),'|',res.join(' | '));
  }
  // 按位玩法策略区分度
  w.setLot('3d'); await ready(500);
  const d3=w.D['3d'], N3=d3.rows.length, p3=w.guessProfile(N3);
  console.log('\n[福彩3D 策略区分度] 各位生成300次, 看各位落在"历史最热3位数字"的比例');
  for(let pos=0;pos<3;pos++){
    const st=w.guessStatArr(2,N3,0,9,pos);
    const arr=[];for(let n=0;n<=9;n++)arr.push({n,c:st.cnt[n]});
    arr.sort((a,b)=>b.c-a.c);
    const hot3=arr.slice(0,3).map(x=>x.n);
    let line='  第'+(pos+1)+'位 热数字'+hot3.join('')+' : ';
    for(const s of ['hot','cold','random']){
      let h=0,t=0;
      for(let k=0;k<300;k++){
        const g=w.guessOne(s,N3,p3,null,99);
        if(hot3.includes(g.r[pos]))h++; t++;
      }
      line+=s+'='+(h/t*100).toFixed(1)+'%(基30%) ';
    }
    console.log(line);
  }
})().catch(e=>console.log('ERR',e.message,e.stack.split('\n')[1]));
