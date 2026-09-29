/* Run: NODE_PATH=/path/to/node_modules node source/build.js
 * Requires sharp for PNG exports. No network access is needed.
 */
const fs=require('node:fs');
const path=require('node:path');
const fig=require('./figure-a.js');
const sharp=require('sharp');
const dest=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(__dirname,'figure-a.js'),'utf8');
const final=fig.render({time:16});
const markup=`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>AK-Momentum · Figure A</title>
<style>
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#172b42;font-family:Arial,Helvetica,sans-serif}
main{max-width:1200px;margin:0 auto;padding-bottom:12px}#drawing{width:100%;line-height:0}#drawing svg{width:100%;height:auto;display:block}
.controls{padding:5px 0 14px;display:none}.js .controls{display:block}.row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 4%}
.group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}button{font:inherit;font-size:14px;line-height:1.25;cursor:pointer;border:1px solid #dbe1e8;background:#fff;color:#172b42;border-radius:6px;padding:10px 13px;min-height:40px}
button:hover{background:#f5f7fb}button[aria-pressed="true"]{color:#fff;background:#172b42;border-color:#172b42}button:focus-visible,input:focus-visible{outline:3px solid #4b60bd;outline-offset:3px}
.label{font-size:14px;color:#566577;margin:0 4px 0 12px}.timeline{width:100%;margin:18px 0 0;padding:0;display:flex;gap:10px;align-items:center}
.timeline .transport-button{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;min-height:44px;padding:10px;margin:0;border:0;border-radius:50%;background:transparent;color:#172b42}
.timeline .transport-button:hover{background:#eef1f8}.transport-button svg{display:block;width:24px;height:24px;flex:none;pointer-events:none}
input[type=range]{accent-color:#4b60bd;flex:1;width:auto;cursor:pointer;height:26px;min-width:0;margin:0}
.stages{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:9px 4% 0}.stages button{border-color:transparent;padding:7px 9px;min-height:34px;font-size:13px}.stages button[aria-pressed="true"]{background:#eef1f8;color:#172b42}
.note{font-size:12px;color:#566577;line-height:1.6;margin:12px 4% 0}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:680px){.controls{padding:6px 0 12px}.row{gap:12px;margin-left:5.6%;margin-right:5.6%}.row>.group{width:100%}button{font-size:13px;padding:9px 11px}.label{margin-left:9px}.stages{gap:2px;margin-left:5.6%;margin-right:5.6%}.note{font-size:12px;margin-left:5.6%;margin-right:5.6%}}
@media print{.controls{display:none!important}}
</style>
</head>
<body>
<main aria-label="Interactive explanation of activation-keyed momentum">
<div id="drawing">${final}</div>
<div class="controls">
  <div class="row">
    <div class="group" role="group" aria-label="Explanation">
      <button type="button" id="one-update" aria-pressed="true">One update</button>
      <button type="button" id="repeated-key" aria-pressed="false">Repeated key</button>
    </div>
    <div class="group">
      <span class="label">Input key</span>
      <button type="button" id="key-u" aria-pressed="true" aria-label="Query input direction u">u</button>
      <button type="button" id="key-v" aria-pressed="false" aria-label="Query input direction v">v</button>
    </div>
  </div>
  <div class="timeline">
    <button type="button" id="play" class="transport-button" aria-label="Pause animation" title="Pause animation"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg></button>
    <button type="button" id="replay" class="transport-button" aria-label="Replay animation" title="Replay animation"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.6 6.4A8 8 0 1 1 4 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5.6 2.5v4.8h4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <label for="seek" class="sr-only">Animation position</label><input id="seek" type="range" min="0" max="16" step="0.01" value="0">
  </div>
  <div class="stages" id="stages" role="group" aria-label="Jump to a completed stage"></div>
  <p class="note">Illustrative parameters, not a training run. Bars show one scalar output component. The repeated-key view isolates the contribution of the initial memory.</p>
  <p id="status" class="sr-only" role="status" aria-live="polite"></p>
</div>
</main>
<script>
${code}
</script>
<script>
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let mode='single',key='u',time=media.matches?16:0,playing=!media.matches,last=null,frame=null,lastHeight=0;
  const drawing=$('drawing'),seek=$('seek'),play=$('play');
  const playbackIcons={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/></svg>'
  };
  const duration=()=>mode==='single'?16:12;
  const mobile=()=>window.innerWidth<=680;
  const stageSpecs=()=>mode==='single'?[[0,'Read'],[4.5,'Decay'],[7.5,'Remove'],[10.8,'Write'],[16,'Result']]:[[0,'Initial'],[2.5,'1'],[4.1,'2'],[5.7,'3'],[7.3,'4'],[8.9,'5'],[12,'6']];
  function resizeParent(){const height=Math.ceil(document.querySelector('main').getBoundingClientRect().height);if(window.parent!==window&&height!==lastHeight){lastHeight=height;window.parent.postMessage({type:'ak-figure-a-resize',height},'*');}}
  function sync(){
    drawing.innerHTML=AKFigureA.render({mode,key,time,mobile:mobile()});
    seek.max=duration();seek.value=time;
    const playbackLabel=playing?'Pause animation':'Play animation';
    // Preserve the icon between frames so a pointer press/release has a stable target.
    if(play.getAttribute('aria-label')!==playbackLabel){
      play.innerHTML=playing?playbackIcons.pause:playbackIcons.play;
      play.setAttribute('aria-label',playbackLabel);
      play.setAttribute('title',playbackLabel);
    }
    $('one-update').setAttribute('aria-pressed',String(mode==='single'));
    $('repeated-key').setAttribute('aria-pressed',String(mode==='repeat'));
    $('key-u').setAttribute('aria-pressed',String(key==='u'));
    $('key-v').setAttribute('aria-pressed',String(key==='v'));
    const st=AKFigureA.stateAt(time,mode,key);
    for(const b of $('stages').querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.index)===(mode==='single'?st.phase:st.shownN)));
    resizeParent();
  }
  function announce(){const st=AKFigureA.stateAt(time,mode,key);$('status').textContent=mode==='single'?AKFigureA.titles[st.phase]+'. Input key '+key+'.':'Repeated key '+key+', query '+st.shownN+' of six.';}
  function drawStages(){
    $('stages').innerHTML='';
    stageSpecs().forEach(([t,label],i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.index=i;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{time=t;playing=false;sync();announce();});$('stages').appendChild(b);});
  }
  function setMode(next){mode=next;time=media.matches?duration():0;playing=!media.matches;last=null;drawStages();sync();announce();}
  function setKey(next){key=next;time=media.matches?duration():0;playing=!media.matches;last=null;sync();announce();}
  $('one-update').addEventListener('click',()=>setMode('single'));
  $('repeated-key').addEventListener('click',()=>setMode('repeat'));
  $('key-u').addEventListener('click',()=>setKey('u'));
  $('key-v').addEventListener('click',()=>setKey('v'));
  $('play').addEventListener('click',()=>{if(time>=duration())time=0;playing=!playing;last=null;sync();announce();});
  $('replay').addEventListener('click',()=>{time=0;playing=true;last=null;sync();announce();});
  seek.addEventListener('input',()=>{time=Number(seek.value);playing=false;sync();});
  seek.addEventListener('change',announce);
  window.addEventListener('resize',sync);
  document.addEventListener('visibilitychange',()=>{last=null;});
  media.addEventListener('change',()=>{if(media.matches){playing=false;time=duration();sync();}});
  function tick(now){
    if(playing&&!document.hidden){if(last!==null)time=Math.min(duration(),time+(now-last)/1000);if(time>=duration())playing=false;sync();}
    last=now;frame=requestAnimationFrame(tick);
  }
  document.documentElement.classList.add('js');
  drawStages();sync();requestAnimationFrame(tick);
  // A small deterministic interface for reproducible screenshots and validation.
  window.figureA={getState:()=>({mode,key,time,playing,math:AKFigureA.stateAt(time,mode,key)}),setState:(v)=>{mode=v.mode||mode;key=v.key||key;time=v.time===undefined?time:v.time;playing=false;drawStages();sync();}};
})();
</script>
</body>
</html>`;

async function main(){
  fs.writeFileSync(path.join(dest,'ak-momentum-figure-a.html'),markup);
  const images=[
    ['ak-momentum-figure-a',final],
    ['ak-momentum-figure-a-mobile',fig.render({time:16,mobile:true})],
    ['ak-momentum-figure-a-storyboard',fig.storyboard()],
    ['ak-momentum-figure-a-repeated',fig.render({time:12,mode:'repeat'})],
  ];
  for(const [name,svg]of images){
    fs.writeFileSync(path.join(dest,name+'.svg'),svg);
    await sharp(Buffer.from(svg),{density:144}).png().toFile(path.join(dest,name+'.png'));
    console.log(name);
  }
  console.log('Self-contained interactive HTML built.');
}
main().catch(e=>{console.error(e);process.exit(1);});
