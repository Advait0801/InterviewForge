const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '@axe-core/playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch();const setup=await browser.newContext();
const statePath='/tmp/interviewforge-ui-a-responsive-state.json';
let state=await fs.readFile(statePath,'utf8').then(JSON.parse).catch(()=>null);
if(!state) {
 const stamp=Date.now();const username=process.env.QA_USERNAME || `narrow${stamp}`;
 const response=process.env.QA_USERNAME
  ? await setup.request.post('http://localhost:4000/api/auth/login',{data:{identifier:username,password:`Narrow-${username.slice(6)}!`}})
  : await setup.request.post('http://localhost:4000/api/auth/register',{data:{username,email:`${username}@example.invalid`,password:`Narrow-${stamp}!`,fullName:'Narrow Audit'}});
 assert.ok(response.ok(),`QA authentication failed: ${response.status()}`);
 const {token}=await response.json();const headers={Authorization:`Bearer ${token}`};
 const problems=await (await setup.request.get('http://localhost:4000/api/problems',{headers})).json();const problem=problems.problems.find(p=>p.slug==='two-sum');
 const paths=await (await setup.request.get('http://localhost:4000/api/learning-paths',{headers})).json();
 const assessment=await (await setup.request.post('http://localhost:4000/api/assessments',{headers,data:{problemCount:2,difficultyMix:'easy'}})).json();
 state={token,username,problemId:problem.id,pathSlug:paths.paths[0].slug,assessmentId:assessment.assessmentId};
 await fs.writeFile(statePath,JSON.stringify(state),{mode:0o600});
}
const {token,username,problemId,pathSlug,assessmentId}=state;
const routes=['/','/login','/register','/forgot-password','/reset-password','/verify-email','/leaderboard',`/profile/${username}`,'/dashboard','/problems',`/problems/${problemId}`,'/interview','/system-design','/assessments',`/assessments/${assessmentId}`,'/paths',`/paths/${pathSlug}`,'/analytics','/settings'];
const report={browser:browser.version(),width:320,themes:['light','dark'],observations:[],workspaceAxe:[],pageErrors:[],avatarContrast:[]};
try {
 for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:320,height:900},reducedMotion:'reduce'});
  await context.addInitScript(({theme,token})=>{localStorage.setItem('if-theme',theme);localStorage.setItem('if-token',token);},{theme,token});const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  for(const route of routes) {
    await page.goto('http://localhost:3002'+route,{waitUntil:'networkidle'});await page.locator('h1').first().waitFor();
    const layout=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,infiniteAnimations:document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations===Infinity).length}));assert.ok(layout.documentWidth<=321,`${theme} ${route}: overflow ${layout.documentWidth}`);assert.equal(layout.infiniteAnimations,0);
    report.observations.push({theme,route,...layout});
    if(route.startsWith('/problems/')||route.startsWith('/assessments/')) {
      await page.locator('.monaco-editor').first().waitFor({state:'attached'});assert.equal(await page.locator('section[aria-label="Code editor and console"]').count(),1);
      for(const pane of ['Problem','Editor']) {await page.getByRole('button',{name:pane,exact:true}).click();assert.equal(await page.locator('.monaco-editor').count(),1);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();report.workspaceAxe.push({theme,route,pane,violations:result.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),details:v.nodes.map(n=>n.failureSummary)}))});}
      await page.screenshot({path:`web/docs/ui-group-a/${route.startsWith('/problems/')?'problem':'assessment'}-${theme}-320.png`});
    }
    if(route==='/') await page.screenshot({path:`web/docs/ui-group-a/home-${theme}-320.png`});
  }
  await page.goto('http://localhost:3002',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Toggle menu'}).focus();await page.keyboard.press('Enter');await page.getByRole('navigation',{name:'Mobile navigation'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Toggle menu'}).getAttribute('aria-expanded'),'false');assert.ok(await page.getByRole('button',{name:'Toggle menu'}).evaluate(e=>e===document.activeElement));
  if(theme==='light') report.avatarContrast=await page.evaluate(()=>{
    const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    return ['blue','emerald','purple','amber','rose','cyan','indigo','teal'].map(color=>{const element=document.createElement('div');element.className=`bg-${color}-700`;document.body.append(element);const bg=getComputedStyle(element).backgroundColor;const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3);element.remove();return {color,background:bg,ratio:1.05/(luminance(rgb)+.05)};});
  });
  await context.close();
 }
 assert.deepEqual(report.pageErrors,[]);assert.ok(report.avatarContrast.every(c=>c.ratio>=4.5));
} finally {await fs.writeFile('web/docs/ui-group-a/responsive.json',JSON.stringify(report,null,2));await browser.close();}
const violations=report.workspaceAxe.reduce((n,a)=>n+a.violations.length,0);console.log(`${report.observations.length} responsive observations; ${violations} serious/critical workspace violations`);if(violations) process.exitCode=1;
