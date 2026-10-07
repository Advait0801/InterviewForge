// Targeted real-service continuation, allowing provider latency beyond two minutes.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {token}=JSON.parse(await fs.readFile(process.env.QA_STATE || '/tmp/interviewforge-ui-a-responsive-state.json','utf8'));
const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${process.env.SPEECH_WAV}`]});
const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['microphone']});
await context.addInitScript(t=>{localStorage.setItem('if-token',t);localStorage.setItem('if-theme','light');},token);
const page=await context.newPage();const result={flow:'system design voice/analysis/diagram',pageErrors:[],responses:[],audioUploads:[]};
page.on('pageerror',e=>result.pageErrors.push(e.message));
page.on('response',r=>{if(r.url().includes('/api/'))result.responses.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
page.on('request',r=>{if(r.url().includes('/speech/')&&r.method()==='POST'){const data=r.postDataJSON();result.audioUploads.push({path:new URL(r.url()).pathname,mimeType:data.mimeType,filenamePresent:'filename' in data,encodedBytes:data.audioBase64.length});}});
try {
 await page.goto('http://localhost:3002/system-design',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Design a URL shortener like bit.ly',exact:true}).click();
 await page.getByRole('button',{name:'Record Voice',exact:true}).click();await page.getByRole('button',{name:'Stop Recording',exact:true}).waitFor();await page.waitForTimeout(9000);
 const speech=page.waitForResponse(r=>r.url().endsWith('/speech/transcribe'),{timeout:300000});await page.getByRole('button',{name:'Stop Recording',exact:true}).click();const speechResponse=await speech;assert.ok(speechResponse.ok());result.transcript=(await speechResponse.json()).transcript;
 await page.waitForFunction(()=>document.querySelector('#design-explanation')?.value.trim().split(/\s+/).length>1);
 await page.getByRole('textbox',{name:'Your explanation',exact:true}).fill('Use a stateless HTTP API behind a load balancer. Generate a unique base62 short code, persist the short-code to URL mapping in a replicated database with a uniqueness constraint, and cache popular redirects in Redis. Queue analytics events asynchronously. Define expiration policy and idempotent retries, rate limit creation, validate URLs, measure redirect latency, and shard by short-code hash as traffic grows.');
 const pending=page.waitForResponse(r=>r.url().endsWith('/system-design/analyze'),{timeout:300000});const started=Date.now();await page.getByRole('button',{name:'Analyze design',exact:true}).click();const response=await pending;const analysis=await response.json();assert.ok(response.ok(),JSON.stringify(analysis));assert.ok(analysis.nodes.length);await page.getByRole('heading',{name:'Design feedback',exact:true}).waitFor();result.nodes=analysis.nodes.length;result.durationMs=Date.now()-started;result.passed=true;assert.deepEqual(result.pageErrors,[]);
 await page.screenshot({path:'web/docs/ui-group-a/system-design-live.png'});
 const report=JSON.parse(await fs.readFile('web/docs/ui-group-a/live-flows.json','utf8'));delete report.failure;report.notes.push('The final system-design case was repeated with a five-minute browser wait: the initial provider call completed successfully in 129 seconds, exceeding the harness’s original two-minute wait.');report.flows.push(result);report.responses.push(...result.responses);report.audioUploads.push(...result.audioUploads);await fs.writeFile('web/docs/ui-group-a/live-flows.json',JSON.stringify(report,null,2));
 console.log(`Real system design passed with ${result.nodes} nodes after ${result.durationMs} ms`);
} finally {await browser.close();}
