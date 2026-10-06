const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
const b = await chromium.launch();
const T=JSON.parse(process.env.TARGETS), R=5, out={};
const med=a=>{const x=[...a].sort((p,q)=>p-q);return x[Math.floor(x.length/2)]};
for (let r=0;r<R;r++) for (const [n,u] of Object.entries(T)) {
  const c=await b.newContext({viewport:{width:1440,height:900}}); const p=await c.newPage();
  const f=`${process.env.TRACE_DIR || '.'}/r-${n}.json`;
  await b.startTracing(p,{path:f,categories:['cc','viz','gpu','devtools.timeline','disabled-by-default-devtools.timeline','loading']});
  await p.goto(u,{waitUntil:'networkidle'});
  const fcp=await p.evaluate(()=>performance.getEntriesByName('first-contentful-paint')[0]?.startTime);
  await b.stopTracing(); await c.close();
  const ev=JSON.parse(fs.readFileSync(f)).traceEvents;
  const t0=Math.min(...ev.filter(e=>e.name==='ParseHTML').map(e=>e.ts));
  const sum=(names)=>ev.filter(e=>e.ph==='X'&&names.includes(e.name)&&e.ts<t0+(fcp+20)*1000).reduce((a,e)=>a+e.dur/1000,0);
  const o=(out[n] ||= {fcp:[],raster:[],gpu:[]});
  o.fcp.push(fcp); o.raster.push(sum(['RasterTask','TileManager::RunRasterTask'])); o.gpu.push(sum(['GpuRasterization','RasterDecoderImpl::DoEndRasterCHROMIUM','SkiaOutputSurfaceImplOnGpu::SwapBuffers','Gpu::Scheduler::RunTask']));
}
for (const [n,o] of Object.entries(out)) console.log(n.padEnd(12),'coldFCP',med(o.fcp).toFixed(0),' raster ms',med(o.raster).toFixed(1),' gpu ms',med(o.gpu).toFixed(1));
await b.close();
