/* Figure A — deterministic, dependency-free SVG renderer.
 * The same renderer supplies the interactive figure, stills, and video frames.
 * One scalar output, orthonormal keys u and v, M_previous=[1,1].
 * β=.9, η=.4, δ=.5. The residual always reads PRE-UPDATE memory.
 */
(function (root) {
  'use strict';
  const P = Object.freeze({ beta: .9, eta: .4, delta: .5, initial: [1, 1] });
  const C = { ink:'#172b42', muted:'#566577', line:'#dbe1e8', grid:'#eef1f5',
    old:'#4b60bd', fresh:'#087f75', erase:'#b56524', ghost:'#a5aebc',
    bg:'#ffffff', pale:'#f5f7fb', newPale:'#e6f4f0' };
  const titles=['Read the current association','Decay every direction','Remove old content along the key','Write the new value along the key','A direction-selective refresh'];
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{x=clamp(x); return x*x*(3-2*x);};
  const fmt=(x,d=2)=>Number(x).toFixed(d);
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function stateAt(time=16, mode='single', key='u') {
    const k=key==='v'?1:0;
    if(mode==='repeat') {
      const q=clamp((time-1)/1.6,0,6), n=Math.floor(q), z=smooth((q-n)/.62);
      const retention=j=>(j===k?P.beta-P.eta:P.beta);
      const old=[0,1].map(j=>Math.pow(retention(j),n)*(1-z+z*retention(j)));
      const ema=Math.pow(P.beta,n)*(1-z+z*P.beta);
      return {mode,key,k,time,n,q,transition:z>1e-9&&z<1-1e-9,completedN:Math.min(6,n+(z>=1-1e-9?1:0)),shownN:Math.min(6,n+(z>0?1:0)),old,write:[0,0],total:old,ema,phase:0};
    }
    const t=clamp(time,0,16), decay=smooth((t-2)/2), erase=smooth((t-5)/2), write=smooth((t-8)/2);
    const old=[1-(1-P.beta)*decay,1-(1-P.beta)*decay];
    old[k]-=P.eta*P.initial[k]*erase;
    const fresh=[0,0]; fresh[k]=P.eta*P.delta*write;
    const phase=t<2?0:t<5?1:t<8?2:t<11?3:4;
    return {mode,key,k,time:t,decay,erase,write:fresh,old,total:old.map((x,j)=>x+fresh[j]),phase};
  }
  const text=(x,y,s,size=22,color=C.ink,weight=400,anchor='start',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
  const line=(x1,y1,x2,y2,c=C.line,w=1,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" ${extra}/>`;
  const rect=(x,y,w,h,c,extra='')=>`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${h}" fill="${c}" ${extra}/>`;
  const circle=(x,y,r,c,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${extra}/>`;
  function arrow(x1,y1,x2,y2,c,w=4,dashed=false) {
    const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);
    if(l<.2)return '';
    const ux=dx/l,uy=dy/l,h=Math.min(11,l*.35),hw=h*.56;
    return line(x1,y1,x2-ux*h*.8,y2-uy*h*.8,c,w,`stroke-linecap="round" ${dashed?'stroke-dasharray="7 6"':''}`)+`<path d="M${x2},${y2} L${x2-ux*h-uy*hw},${y2-uy*h+ux*hw} L${x2-ux*h+uy*hw},${y2-uy*h-ux*hw} Z" fill="${c}"/>`;
  }
  function header(w,h,title,subtitle,mobile,extraSubtitle='') {
    return rect(0,0,w,h,C.bg)+
      text(mobile?36:48,83,title,mobile?30:36,C.ink,600)+
      text(mobile?36:48,119,subtitle,mobile?19:21,C.muted)+
      (extraSubtitle?text(36,146,extraSubtitle,18,C.muted):'')+
      line(mobile?36:48,mobile?164:148,w-(mobile?36:48),mobile?164:148);
  }
  function coordinates(s,mobile) {
    const ox=mobile?112:132,oy=mobile?512:594,l=mobile?210:312;
    const xy=(a)=>[ox+a[0]*l,oy-a[1]*l];
    const active=s.key, other=active==='u'?'v':'u';
    let out='';
    for(const t of [.5,1]){
      out+=line(ox+t*l,oy,ox+t*l,oy-1.08*l,C.grid)+line(ox,oy-t*l,ox+1.08*l,oy-t*l,C.grid);
      out+=text(ox+t*l,oy+28,fmt(t,1),18,C.muted,400,'middle')+text(ox-16,oy-t*l+6,fmt(t,1),18,C.muted,400,'end');
    }
    out+=text(ox-13,oy+27,'0',18,C.muted,400,'end');
    out+=arrow(ox,oy,ox+1.2*l,oy,s.key==='u'?C.ink:C.ghost,2);
    out+=arrow(ox,oy,ox,oy-1.2*l,s.key==='v'?C.ink:C.ghost,2);
    out+=text(ox+1.26*l,oy+7,'u',27,C.ink,500)+text(ox-22,oy-1.2*l+20,'v',27,C.ink,500,'middle');
    const bp=xy([1,1]);
    out+=line(ox,oy,...bp,C.ghost,2,'stroke-dasharray="6 6"')+circle(...bp,5,C.bg,`stroke="${C.ghost}" stroke-width="2"`);
    out+=text(bp[0]+13,bp[1]-(s.mode==='repeat'?22:12),s.mode==='repeat'?'n = 0':'before',18,C.muted);
    if(s.mode==='repeat') {
      const ep=xy([s.ema,s.ema]);
      out+=line(ox,oy,...ep,C.ghost,3,'stroke-dasharray="7 5"')+circle(...ep,6,C.ghost);
      const history=[];for(let n=0;n<=Math.floor(s.q);n++)history.push(xy([0,1].map(j=>Math.pow(j===s.k?P.beta-P.eta:P.beta,n))));
      history.push(xy(s.old));
      if(history.length>1)out+=`<polyline points="${history.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${C.old}" stroke-width="2" opacity=".45"/>`;
      for(const p of history.slice(0,-1))out+=circle(...p,3,C.old);
      const ap=xy(s.old);
      out+=line(ap[0],ap[1],ep[0],ep[1],C.line,1.5,'stroke-dasharray="4 5"');
      out+=arrow(ox,oy,...ap,C.old,5)+circle(...ap,6,C.old);
      if(Math.hypot(ap[0]-ep[0],ap[1]-ep[1])>70){
        out+=text(ep[0]+14,ep[1]+24,'EMA',20,C.muted,600);
        out+=text(ap[0]+14,ap[1]+25,'AK',20,C.old,600);
      }else{
        out+=text(ep[0]+14,ep[1]+28,'AK / EMA',18,C.muted,500);
      }
    } else {
      const old=xy(s.old),total=xy(s.total);
      out+=line(total[0],total[1],total[0],oy,C.line,1.5,'stroke-dasharray="4 5"')+line(ox,total[1],total[0],total[1],C.line,1.5,'stroke-dasharray="4 5"');
      if(s.erase>.001) {
        const before=xy([P.beta,P.beta]);
        if(active==='u'){
          out+=arrow(before[0],before[1]-28,old[0],old[1]-28,C.erase,3);
          out+=text((before[0]+old[0])/2,old[1]-42,'−'+fmt(P.eta*s.erase),19,C.erase,600,'middle');
        } else {
          out+=arrow(before[0]+30,before[1],old[0]+30,old[1],C.erase,3);
          out+=text(old[0]+45,(before[1]+old[1])/2+6,'−'+fmt(P.eta*s.erase),19,C.erase,600);
        }
      }
      out+=arrow(ox,oy,...old,C.old,5)+circle(...old,5,C.old);
      if(s.write[s.k]>.001) {
        out+=arrow(...old,...total,C.fresh,7)+circle(...total,6,C.fresh);
        if(active==='u')out+=text((old[0]+total[0])/2,total[1]+31,'+'+fmt(s.write[s.k]),19,C.fresh,600,'middle');
        else out+=text(total[0]-14,(old[1]+total[1])/2+6,'+'+fmt(s.write[s.k]),19,C.fresh,600,'end');
        if(s.phase===4)out+=active==='u'?text(total[0]+15,total[1]+8,'after',19,C.ink,500):text(total[0]-14,total[1]-14,'after',19,C.ink,500,'end');
      }
    }
    out+=text(mobile?320:343,mobile?572:648,s.mode==='repeat'?'Contribution of the initial buffer':'One row of the momentum buffer',mobile?18:20,C.muted,400,'middle');
    return out;
  }
  function stackedBar(s,j,x,y,len,height,mobile) {
    const b=s.old[j],w=s.write[j],name=j===0?'u':'v',active=j===s.k;
    let out=text(x,y-17,name+(active?'  ·  queried':'  ·  perpendicular'),22,C.ink,600);
    out+=rect(x,y,len,height,C.pale)+rect(x,y,b*len,height,C.old);
    if(w>.0001)out+=rect(x+b*len,y,w*len,height,C.fresh);
    if(b*len>62)out+=text(x+b*len/2,y+height/2+7,fmt(b),20,C.bg,500,'middle');
    if(w*len>52)out+=text(x+(b+w/2)*len,y+height/2+7,fmt(w),19,C.bg,500,'middle');
    out+=text(x+len+20,y+height/2+8,fmt(b+w),25,C.ink,600);
    return out;
  }
  function singleBars(s,mobile) {
    const x=mobile?54:672,y=mobile?686:321,len=mobile?414:348,h=mobile?44:48;
    let out=text(x,y-63,'Stored error prediction',mobile?23:24,C.ink,500);
    out+=stackedBar(s,0,x,y,len,h,mobile);
    out+=stackedBar(s,1,x,y+(mobile?106:133),len,h,mobile);
    let detail;
    if(s.phase===0)detail=['Read 1.00; observe δ = 0.50.','Residual: 0.50 − 1.00 = −0.50.'];
    else if(s.phase===1)detail=['Both old values receive the same decay.','β × 1.00 = 0.90 in each direction.'];
    else if(s.phase===2)detail=['Subtract η × the original prediction.','0.90 − 0.40 × 1.00 = 0.50.'];
    else if(s.phase===3)detail=['Add ηδ along the same key.','0.40 × 0.50 = 0.20 of new content.'];
    else detail=[`${s.key} retains β − η = 0.50 of its old value.`,`${s.key==='u'?'v':'u'} retains β = 0.90; it still decays.`];
    const dy=mobile?884:566;
    out+=text(x,dy,detail[0],mobile?19:21,C.muted)+text(x,dy+31,detail[1],mobile?19:21,C.muted);
    return out;
  }
  function repeatBars(s,mobile) {
    const x=mobile?54:672,y=mobile?620:252,len=mobile?414:348;
    const other=s.key==='u'?'v':'u';
    let out=text(x,y,'Initial-memory retention',mobile?23:24,C.ink,500);
    out+=text(x,y+48,`${s.key}  ·  repeatedly queried`,22,C.ink,600);
    for(const [i,label,val,color] of [[0,'EMA',s.ema,C.ghost],[1,'AK',s.old[s.k],C.old]]){
      const yy=y+71+i*63;
      out+=text(x,yy+22,label,18,color===C.old?C.old:C.muted,600);
      out+=rect(x+68,yy,len-68,32,C.pale)+rect(x+68,yy,val*(len-68),32,color);
      out+=text(x+len+20,yy+25,fmt(val,3),23,C.ink,600);
    }
    const vy=y+236;
    out+=text(x,vy,`${other}  ·  not queried`,22,C.ink,600);
    out+=text(x,vy+44,'Both',18,C.muted,600)+rect(x+68,vy+20,len-68,32,C.pale)+rect(x+68,vy+20,s.ema*(len-68),32,C.old);
    out+=text(x+len+20,vy+45,fmt(s.ema,3),23,C.ink,600);
    out+=text(x,mobile?949:600,'New writes are excluded from this view.',mobile?20:21,C.muted);
    return out;
  }
  function legend(s,mobile) {
    if(s.mode==='repeat') {
      const y=mobile?992:690;
      return line(mobile?55:54,y,mobile?90:89,y,C.old,5)+text(mobile?101:101,y+7,'AK old memory',20,C.ink)+
        line(mobile?341:535,y,mobile?376:570,y,C.ghost,3,'stroke-dasharray="7 5"')+text(mobile?387:584,y+7,'EMA old memory',20,C.ink);
    }
    const y=mobile?952:689;
    let out=rect(mobile?54:54,y-15,18,18,C.old)+text(mobile?83:85,y,'Old memory',mobile?18:21);
    out+=rect(mobile?239:405,y-15,18,18,C.fresh)+text(mobile?268:436,y,'New write',mobile?18:21);
    out+=line(mobile?409:758,y-7,mobile?438:791,y-7,C.erase,3)+text(mobile?449:806,y,'Removal',mobile?18:21);
    return out;
  }
  function formula(s,mobile) {
    const y=mobile?(s.mode==='repeat'?1044:1004):773;
    const top=mobile?y-32:731,h=mobile?(s.mode==='repeat'?87:85):82;
    let out=rect(mobile?32:38,top,mobile?576:1124,h,C.pale,'rx="10"');
    if(s.mode==='repeat'){
      const other=s.key==='u'?'v':'u';
      if(mobile)out+=text(50,y,`AK:  C⁽${s.key}⁾ₙ = (β − η)ⁿ,   C⁽${other}⁾ₙ = βⁿ`,23,C.ink,500)+text(50,y+35,'EMA:  C⁽u⁾ₙ = C⁽v⁾ₙ = βⁿ',23,C.muted);
      else out+=text(63,y,`AK:  C⁽${s.key}⁾ₙ = (β − η)ⁿ,  C⁽${other}⁾ₙ = βⁿ`,26,C.ink,500)+text(659,y,'EMA:  C⁽u⁾ₙ = C⁽v⁾ₙ = βⁿ',25,C.muted);
    } else {
      if(mobile){
        out+=text(50,y,'Mₜ = βMₜ₋₁ − η(Mₜ₋₁x̂)x̂ᵀ',26,C.ink,500)+text(116,y+35,'+ ηδx̂ᵀ',26,C.fresh,600);
      } else {
        out+=text(65,y,'Mₜ =',29,C.ink,500)+text(162,y,'βMₜ₋₁',29,C.old,500)+text(283,y,'− η(Mₜ₋₁x̂)x̂ᵀ',29,C.erase,500)+text(584,y,'+ ηδx̂ᵀ',29,C.fresh,500);
        out+=text(850,y,'x̂ = '+s.key+'  ·  u ⟂ v',24,C.muted);
      }
    }
    return out;
  }
  function render({time=16,mode='single',key='u',mobile=false}={}) {
    const s=stateAt(time,mode,key),w=mobile?640:1200,h=mobile?(mode==='repeat'?1152:1090):840;
    const title=mode==='repeat'?'Repeated inputs shorten memory.':'Refresh the direction you see.';
    const sub=mobile?`Unit key x̂ = ${key}  ·  β = 0.90  ·  η = 0.40`:`Unit key x̂ = ${key}    ·    β = 0.90    ·    η = 0.40    ·    ${mode==='single'?'δ = 0.50    ·    Illustrative example':'Initial memory only; new writes excluded'}`;
    let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="figure-a-title figure-a-desc"><title id="figure-a-title">${esc(title)}</title><desc id="figure-a-desc">${esc(mode==='single'?`One row of the momentum buffer begins at (1,1). With key ${key}, global decay multiplies both components by .9. Selective removal subtracts .4 of the original queried component; the new write adds .4 times .5. The queried component becomes .7 and the perpendicular component becomes .9. Blue is old memory, green is new content, orange is extra removal.`:`For repeated unit key ${key}, the contribution of initial memory decays by .5 per query in that direction and .9 in the perpendicular direction. EMA decays both by .9. New writes are excluded.`)}</desc><g font-family="DejaVu Sans, Arial, sans-serif">`;
    out+=header(w,h,title,sub,mobile,mobile?(mode==='single'?'δ = 0.50  ·  Illustrative single-output example':'Only the contribution of the initial memory'): '');
    const phaseLabel=mode==='repeat'?(s.transition?`Applying query ${s.shownN} of 6 along ${key}`:s.completedN===0?'Before the first query':`After ${s.completedN} ${s.completedN===1?'query':'queries'} along ${key}`):titles[s.phase];
    out+=text(mobile?36:48,mobile?204:193,mode==='repeat'?(mobile?'REPEATED QUERIES':s.transition?`${s.n} → ${s.n+1}`:'n = '+s.completedN):String(s.phase+1).padStart(2,'0'),mobile?15:16,C.muted,600);
    out+=text(mobile?36:(mode==='repeat'?142:96),mobile?237:193,phaseLabel,mobile?23:26,C.ink,500);
    out+=coordinates(s,mobile)+(mode==='single'?singleBars(s,mobile):repeatBars(s,mobile))+legend(s,mobile)+formula(s,mobile);
    if(mobile)out+=text(36,h-13,'Two input dimensions · one output component',17,C.muted);
    out+='</g></svg>';
    return out;
  }
  function storyboard() {
    const w=1200,h=1000,st=[stateAt(0),stateAt(4.5),stateAt(7.5),stateAt(12)];
    let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="story-title story-desc"><title id="story-title">AK-Momentum, one update in four stages</title><desc id="story-desc">Starting from one in each direction, global decay leaves .9 in both. Removing .4 from the queried u direction leaves .5 and .9. Writing .2 along u gives .7 and .9. Blue shows old memory and green the new write.</desc><g font-family="DejaVu Sans, Arial, sans-serif">`;
    out+=header(w,h,'One update, four visible operations.','Unit key x̂ = u    ·    β = 0.90    ·    η = 0.40    ·    δ = 0.50    ·    Illustrative example',false);
    out+=text(422,202,'u  ·  queried direction',24,C.ink,600)+text(833,202,'v  ·  perpendicular',24,C.ink,600);
    const labels=[['01','Read','Use the original prediction.'],['02','Decay','Multiply both old values by β.'],['03','Remove','Subtract η × 1.00 along u.'],['04','Write','Add ηδ = 0.20 along u.']];
    for(let i=0;i<4;i++){
      const y=254+i*157;
      out+=text(48,y+24,labels[i][0],20,C.muted,600)+text(97,y+24,labels[i][1],28,C.ink,600)+text(97,y+63,labels[i][2],20,C.muted);
      for(let j=0;j<2;j++){
        const x=j?833:422,l=265,b=st[i].old[j],f=st[i].write[j];
        out+=rect(x,y,265,52,C.pale)+rect(x,y,b*l,52,C.old)+rect(x+b*l,y,f*l,52,C.fresh);
        out+=text(x+l+13,y+36,fmt(b+f),26,C.ink,600);
        if(i===3&&j===0)out+=text(x,y+90,'0.50 old + 0.20 new',21,C.muted);
      }
      if(i<3)out+=line(48,y+118,1152,y+118);
    }
    out+=rect(48,884,18,18,C.old)+text(79,901,'Retained old memory',21)+rect(422,884,18,18,C.fresh)+text(454,901,'Newly written value',21);
    out+=text(48,962,'Along u:  Mₜu = (β − η)Mₜ₋₁u + ηδ',25,C.ink,500)+text(713,962,'Along v:  Mₜv = βMₜ₋₁v',25,C.ink,500);
    return out+'</g></svg>';
  }
  const api={P,C,stateAt,render,storyboard,titles};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.AKFigureA=api;
})(typeof globalThis!=='undefined'?globalThis:this);
