// Screens as a visitor meets them, for looking at: node gen/shots.mjs <outdir>
import { chromium } from 'playwright';
const base='http://127.0.0.1:8994/aaron-kaluszyner', out=process.argv[2];
const b=await chromium.launch({channel:'chrome'});
for (const [n,w,h,m] of [['lap',1440,900,false],['short',1280,650,false],['ph',390,844,true]]) {
  const c=await b.newContext({viewport:{width:w,height:h},hasTouch:m,isMobile:m,deviceScaleFactor:1}); const p=await c.newPage();
  await p.goto(base+'/index.html'); await p.waitForTimeout(900); await p.screenshot({path:`${out}/${n}-strum.jpg`,quality:70,type:'jpeg'});
  await p.waitForTimeout(3000); await p.screenshot({path:`${out}/${n}-rest.jpg`,quality:70,type:'jpeg'});
  await c.close();
}
await b.close();
