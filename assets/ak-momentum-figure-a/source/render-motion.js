/* Run with NODE_PATH containing sharp. Requires ffmpeg on PATH.
 * Temporary PNG frames go to the supplied directory, outside this asset bundle.
 * Example: node source/render-motion.js /absolute/path/to/temporary/frames
 */
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const {spawnSync}=require('node:child_process');
const fig=require('./figure-a.js');
const dest=path.resolve(__dirname,'..');
const tmp=path.resolve(process.argv[2]||path.join(dest,'temporary-frames'));
fs.mkdirSync(tmp,{recursive:true});
const fps=24,total=28,frames=fps*total;
async function main(){
  let next=0;
  async function worker(){
    for(;;){const i=next++;if(i>=frames)return;const t=i/fps;
      const svg=fig.render(t<16?{time:t,mode:'single'}:{time:t-16,mode:'repeat'});
      await sharp(Buffer.from(svg)).png().toFile(path.join(tmp,`${String(i).padStart(5,'0')}.png`));
    }
  }
  await Promise.all(Array.from({length:4},worker));
  const run=args=>{const p=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);};
  const video=path.join(dest,'ak-momentum-figure-a.mp4');
  run(['-framerate',String(fps),'-i',path.join(tmp,'%05d.png'),'-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-an',video]);
  const palette=path.join(tmp,'palette.png');
  run(['-i',video,'-vf','fps=10,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff','-frames:v','1',palette]);
  run(['-i',video,'-i',palette,'-lavfi','fps=10,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',path.join(dest,'ak-momentum-figure-a.gif')]);
  console.log(JSON.stringify({frames,fps,duration_seconds:total,video}));
}
main().catch(e=>{console.error(e);process.exit(1);});
