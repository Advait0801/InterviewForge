// Real browser flows against the local stack; no response fixtures.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://localhost:3002', apiBase = 'http://localhost:4000/api';
const audioFile = process.env.SPEECH_WAV;
if (!audioFile) throw new Error('Set SPEECH_WAV to a speech WAV for Chromium fake audio capture.');
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${audioFile}`] });
const context = await browser.newContext({viewport:{width:1440,height:900},permissions:['microphone','clipboard-read','clipboard-write']});
await context.addInitScript(() => {localStorage.setItem('if-theme','light');localStorage.setItem('if-preferred-lang','python3');});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const report = { browser:browser.version(), when:new Date().toISOString(), flows:[], responses:[], pageErrors:[], notes:['Real local APIs, code-runner, AI interview/design/evaluation, and speech provider; synthetic account and synthesized spoken input. No response fixtures.'] };
page.on('pageerror',e=>report.pageErrors.push(e.message));
page.on('response',async r=> {if(r.url().startsWith(apiBase)) report.responses.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
const stamp=Date.now();
const username = process.env.QA_USERNAME || `uia_${stamp.toString(36)}`, password = process.env.QA_USERNAME ? `UIA-${parseInt(process.env.QA_USERNAME.slice(4),36)}!changed` : `UIA-${stamp}!`;
function recordFlow(value) { report.flows.push(value); console.log(value.flow); }
page.on('request',r=> { if(r.method()==='POST' && r.url().includes('/speech/')) { const data=r.postDataJSON(); (report.audioUploads ||= []).push({path:new URL(r.url()).pathname,mimeType:data.mimeType,filenamePresent:'filename' in data,encodedBytes:data.audioBase64.length}); } });
let token;
async function read(path) {
 const response = await page.request.get(apiBase+path,{headers:{Authorization:`Bearer ${token}`}});
 assert.ok(response.ok(), `${path}: ${response.status()}`);return response.json();
}
async function goto(path) {await page.goto(base+path,{waitUntil:'networkidle'});await page.locator('h1').first().waitFor();}
async function editorCode(code) {
 const pane=page.getByRole('button',{name:'Editor',exact:true});if(await pane.isVisible()) await pane.click();
 const editor=page.locator('.monaco-editor').first();await editor.waitFor({state:'visible'});await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.evaluate(code=>navigator.clipboard.writeText(code),code);await page.keyboard.press('ControlOrMeta+V');
}
async function actionResponse(button, path, check = ()=>true) {
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname===`/api${path}`&&r.request().method()===(path.endsWith('/report')?'GET':'POST')&&check(r),{timeout:300000});await button.click();const response=await pending;const body=await response.json();assert.ok(response.ok(),`${path}: ${response.status()} ${JSON.stringify(body)}`);return body;
}
async function recordVoice(textbox) {
 await page.getByRole('button',{name:/^Record voice$/i}).click();await page.getByRole('button',{name:/^Stop recording$/i}).waitFor();await page.waitForTimeout(9000);
 const response=await actionResponse(page.getByRole('button',{name:/^Stop recording$/i}),'/interviews/speech/transcribe');
 const request=report.responses.at(-1);
 await page.waitForFunction(id=>document.getElementById(id)?.value.trim().split(/\s+/).length>1, await textbox.getAttribute('id'));
 assert.ok((await textbox.inputValue()).trim().split(/\s+/).length>1);
 recordFlow({flow:'voice transcription',transcript:response.transcript,request});
}
try {
 if(!process.env.QA_USERNAME) {
 await goto('/register');
 await page.getByRole('textbox',{name:'Username',exact:true}).fill(username);await page.getByRole('textbox',{name:'Email address',exact:true}).fill(`${username}@example.invalid`);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('textbox',{name:'Full name',exact:true}).fill('UI A Audit');
 await actionResponse(page.getByRole('button',{name:'Create account',exact:true}),'/auth/register');await page.waitForURL('**/dashboard');
 token=await page.evaluate(()=>localStorage.getItem('if-token'));assert.ok(token);recordFlow({flow:'register',passed:true});
 }
 await goto('/login');
 await page.getByRole('textbox',{name:'Email or username',exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await actionResponse(page.getByRole('button',{name:'Sign in',exact:true}),'/auth/login');await page.waitForURL('**/dashboard');token=await page.evaluate(()=>localStorage.getItem('if-token'));recordFlow({flow:'login',passed:true});
 await context.storageState({path:'/tmp/interviewforge-ui-a-live-storage.json'});
 const catalogue=await read('/problems');const problem=catalogue.problems.find(p=>p.slug==='two-sum');assert.ok(problem);
 await goto('/problems');assert.ok(await page.getByRole('link',{name:/Two Sum/}).count());
 await goto(`/problems/${problem.id}`);await editorCode(await fs.readFile('backend/reference_solutions/two-sum/solution.py','utf8'));
 const run=await actionResponse(page.getByRole('button',{name:'Run code',exact:true}),'/submissions');assert.ok(run.passed);assert.equal(run.mode,'run');
 const submit=await actionResponse(page.getByRole('button',{name:'Submit',exact:true}),'/submissions');assert.ok(submit.passed);assert.ok(submit.results.some(r=>r.hidden));for(const r of submit.results.filter(r=>r.hidden)) assert.deepEqual(Object.keys(r).sort(),['hidden','passed']);
 await page.getByText('Accepted',{exact:true}).first().waitFor();recordFlow({flow:'problem run + submit',publicCases:run.results.length,submitCases:submit.results.length,passed:true});
 await page.setViewportSize({width:320,height:900});await page.getByRole('button',{name:'Problem',exact:true}).click();assert.equal(await page.locator('.monaco-editor').count(),1);await page.getByRole('button',{name:'Editor',exact:true}).click();assert.equal(await page.locator('.monaco-editor').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);recordFlow({flow:'320px workspace panes remain mounted',passed:true});await page.setViewportSize({width:1440,height:900});
 await goto('/assessments');await page.getByRole('button',{name:'Easy',exact:true}).click();await page.getByRole('button',{name:'2 problems',exact:true}).click();const created=await actionResponse(page.getByRole('button',{name:'Start assessment',exact:true}),'/assessments');await page.waitForURL(`**/assessments/${created.assessmentId}`);
 const detail=await read(`/assessments/${created.assessmentId}`);
 for(let i=0;i<detail.problems.length;i++) {
  if(i>0) await page.getByRole('tab',{name:`Problem ${i+1}`,exact:true}).click();
  const selected=detail.problems[i];await editorCode(await fs.readFile(`backend/reference_solutions/${selected.slug}/solution.py`,'utf8'));
  const linked=page.waitForResponse(r=>r.url().endsWith(`/assessments/${created.assessmentId}/solve`)&&r.request().method()==='POST');
  const response=await actionResponse(page.getByRole('button',{name:'Submit problem',exact:true}),'/submissions');assert.ok(response.passed);assert.ok((await linked).ok());
 }
 const completed=await actionResponse(page.getByRole('button',{name:'Finish assessment',exact:true}),`/assessments/${created.assessmentId}/submit`);assert.equal(completed.score,100);await page.getByRole('heading',{name:'100% score',exact:true}).waitFor();await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'100% score',exact:true}).waitFor();const finished=await read(`/assessments/${created.assessmentId}`);assert.equal(typeof finished.assessment.score,'string');recordFlow({flow:'assessment solve/link/finish/reload',score:finished.assessment.score,passed:true});
 const paths=await read('/learning-paths');await goto('/paths');await goto(`/paths/${paths.paths[0].slug}`);recordFlow({flow:'paths list and detail',passed:true});
 for(const route of ['/analytics','/leaderboard',`/profile/${username}`,'/settings']) {await goto(route);recordFlow({flow:route,passed:true});}
 await page.getByLabel('Current password',{exact:true}).fill('wrong-password');await page.getByLabel('New password',{exact:true}).fill(password+'changed');await page.getByLabel('Confirm new password',{exact:true}).fill(password+'changed');const incorrect=page.waitForResponse(r=>r.url().endsWith('/users/change-password'));await page.getByRole('button',{name:'Update password',exact:true}).click();assert.equal((await incorrect).status(),401);await page.locator('p[role=alert]').filter({hasText:'incorrect'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('if-token')),token);
 await page.getByLabel('Current password',{exact:true}).fill(password);const changed=await actionResponse(page.getByRole('button',{name:'Update password',exact:true}),'/users/change-password');assert.ok(changed.token);token=changed.token;recordFlow({flow:'settings wrong-password 401 preserves session + password change',passed:true});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=','base64');const avatar=page.waitForResponse(r=>r.url().endsWith('/users/avatar')&&r.request().method()==='POST');await page.getByLabel('Choose profile picture').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:png});assert.ok((await avatar).ok());recordFlow({flow:'avatar upload',passed:true});
 await goto('/interview');const started=await actionResponse(page.getByRole('button',{name:'Start interview',exact:true}),'/interviews');await page.getByRole('textbox',{name:'Your answer',exact:true}).waitFor();const interviewId=started.session.id;await recordVoice(page.getByRole('textbox',{name:'Your answer',exact:true}));const evaluation=await actionResponse(page.getByRole('button',{name:'Evaluate voice',exact:true}),'/interviews/speech/evaluate-explanation');assert.ok(evaluation.evaluation);await page.getByText('Voice Evaluation',{exact:true}).waitFor();
 let outcome;
 for(let turn=0;turn<12;turn++) {
   if(turn>0) await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('I would clarify the requirements and explain assumptions first. For coding I use a hash map and analyze time and space complexity; for system design I separate stateless services, caches and replicated storage, use queues for asynchronous work, and discuss retries, availability, consistency and monitoring. For behavioral questions I describe the situation, my responsibility, the actions I took, and the measurable result, then reflect on what I would improve.');
   outcome=await actionResponse(page.getByRole('button',{name:'Send answer',exact:true}),`/interviews/${interviewId}/answer`);assert.ok(['followup','advance_stage','completed'].includes(outcome.action));
   if(outcome.action==='completed') break;
   await page.waitForFunction(()=>document.querySelector('#interview-answer')?.value==='');
 }
 assert.equal(outcome.action,'completed');await page.getByText('Interview Complete',{exact:true}).first().waitFor();const interviewReport=await actionResponse(page.getByRole('button',{name:'Generate report',exact:true}),`/interviews/${interviewId}/report`);assert.ok(interviewReport.stageScores);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();assert.ok((await download).suggestedFilename().endsWith('.pdf'));recordFlow({flow:'interview voice/evaluation/all stages/report/PDF',stageScores:interviewReport.stageScores,passed:true});
 await goto('/system-design');await page.getByRole('button',{name:'Design a URL shortener like bit.ly',exact:true}).click();await recordVoice(page.getByRole('textbox',{name:'Your explanation',exact:true}));await page.getByRole('textbox',{name:'Your explanation',exact:true}).fill('Use a stateless HTTP API behind a load balancer. Generate a unique base62 short code, persist the short-code to URL mapping in a replicated database with a uniqueness constraint, and cache popular redirects in Redis. Queue analytics events asynchronously. Define expiration policy and idempotent retries, rate limit creation, validate URLs, measure redirect latency, and shard by short-code hash as traffic grows.');const analysis=await actionResponse(page.getByRole('button',{name:'Analyze design',exact:true}),'/interviews/system-design/analyze');assert.ok(analysis.nodes.length);await page.getByRole('heading',{name:'Design feedback',exact:true}).waitFor();recordFlow({flow:'system design voice/analysis/diagram',nodes:analysis.nodes.length,passed:true});
 assert.deepEqual(report.pageErrors,[]);
} catch(error) {report.failure=error.message;await page.screenshot({path:'web/docs/ui-group-a/live-flow-failure.png'});throw error;}
finally {await fs.writeFile('web/docs/ui-group-a/live-flows.json',JSON.stringify(report,null,2));await browser.close();}
console.log(`${report.flows.length} live flows passed; ${report.responses.length} API responses; no browser exceptions`);
