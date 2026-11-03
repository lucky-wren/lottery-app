const {win, activate, ready} = require('./_harness.js');
(async()=>{
  activate(); await ready(600);
  const w=win; const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  for(const lot of ['ssq','dlt','3d','pls']){
    w.S.lot=lot;
    if(!w.D[lot]||!w.D[lot].rows){console.log(lot,'NO DATA');continue;}
    const N=w.D[lot].rows.length, prof=w.guessProfile(N);
    let res=[];
    for(const s of ['hot','cold','morph']){
      let mx=0,av=0,bad=0;
      for(let r=0;r<40;r++){
        const out=[];
        for(let i=0;i<5;i++) out.push(w.guessOne(s,N,prof,out,2));
        let m2=0,su=0,c=0;
        for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){
          const o=w.isPos()? (out[i].r.join()===out[j].r.join()?1:0) : w.guessOverlap(out[i].r,out[j].r);
          m2=Math.max(m2,o);su+=o;c++;
        }
        mx+=m2;av+=su/c; if(m2>2)bad++;
      }
      res.push(s+': 平均重合'+(av/40).toFixed(2)+' 最大'+(mx/40).toFixed(2)+(bad?' 违约'+bad+'/40':''));
    }
    console.log(lot.padEnd(4), 'N='+N, '|', res.join('  |  '));
  }
  // 分散度三档对比
  w.S.lot='ssq';
  const N=w.D.ssq.rows.length, prof=w.guessProfile(N);
  console.log('\n[分散度三档] hot 策略 5 注');
  for(const sp of [0.6,0.3,0.1]){
    w.S.guessSpread=sp;
    let mx=0,av=0;
    for(let r=0;r<40;r++){
      const out=[];
      for(let i=0;i<5;i++) out.push(w.guessOne('hot',N,prof,out,2));
      let m2=0,su=0,c=0;
      for(let i=0;i<5;i++)for(let j=i+1;j<5;j++){const o=w.guessOverlap(out[i].r,out[j].r);m2=Math.max(m2,o);su+=o;c++;}
      mx+=m2;av+=su/c;
    }
    console.log('  spread='+sp, '平均重合',(av/40).toFixed(2),'最大重合',(mx/40).toFixed(2));
  }
  w.S.guessSpread=0.3;
})().catch(e=>console.log('ERR',e.message,e.stack.split('\n')[1]));
