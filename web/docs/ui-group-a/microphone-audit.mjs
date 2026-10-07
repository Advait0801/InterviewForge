// Device failures and provider-error responses are explicit browser fixtures.
// Registration, authentication, recording/encoding and MIME payloads use the live stack.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://localhost:3002';
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const setup = await browser.newContext();
const stamp = Date.now();
const r = await setup.request.post('http://localhost:4000/api/auth/register', { data: { username: `micuia${stamp}`, email: `micuia${stamp}@example.invalid`, password: `MicUIA-${stamp}!` } });
assert.equal(r.status(), 201);
const { token } = await r.json();
const results = [];
for (const route of ['/interview', '/system-design']) {
  for (const test of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError', 'short', 'unusable', 'retryable', 'confirm']) {
    console.log(route, test);
    const context = await browser.newContext({ permissions: ['microphone'] });
    await context.addInitScript(({token, test}) => {
      localStorage.setItem('if-token', token);
      window.__tracks = [];
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (options) => {
        if (test.endsWith('Error')) throw new DOMException('RAW DEVICE FAILURE', test);
        const stream = await original(options); window.__tracks.push(...stream.getTracks()); return stream;
      };
    }, {token, test});
    const page = await context.newPage();
    await page.route('**/api/interviews', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({json:{session:{id:'mic-fixture', company:'google',currentStage:'behavioral',status:'active'},openingQuestion:{question:'Describe your approach'}}});
    });
    await page.route('**/api/interviews/mic-fixture', (route) => route.fulfill({json:{session:{id:'mic-fixture', company:'google',current_stage:'behavioral',status:'active'},messages:[{id:'q1',role:'assistant',stage:'behavioral',content:'Describe your approach',metadata_json:{kind:'question'},created_at:new Date().toISOString()}]}}));
    const uploads = [];
    await page.route('**/api/interviews/speech/transcribe', async (route) => {
      const body = route.request().postDataJSON(); uploads.push(body);
      if (test === 'unusable') await route.fulfill({status:422,json:{error:'No speech was detected',retryable:false}});
      else if (test === 'retryable' && uploads.length === 1) await route.fulfill({status:503,json:{error:'Speech is temporarily unavailable',retryable:true}});
      else await route.fulfill({json:{transcript:test === 'confirm' ? 'You' : 'I would use a hash map.'}});
    });
    await page.goto(base+route,{waitUntil:'networkidle'});
    if(route === '/interview') {await page.getByRole('button',{name:'Start interview',exact:true}).click();await page.getByRole('textbox',{name:'Your answer',exact:true}).waitFor();}
    const textbox = page.getByRole('textbox',{name:route === '/interview'?'Your answer':'Your explanation',exact:true});
    await textbox.fill('Typed draft');
    await page.getByRole('button',{name:/^Record voice$/i}).click();
    if (test.endsWith('Error')) {
      const alert = await page.locator('p[role=alert]').textContent();
      const expected = {NotAllowedError:'Microphone access is blocked',NotFoundError:'No microphone was found',NotReadableError:'microphone is in use by another app',SecurityError:'secure connection'}[test];
      assert.ok(alert.includes(expected));assert.ok(alert.includes('type your answer'));assert.ok(!alert.includes('RAW DEVICE FAILURE'));
    } else {
      await page.getByRole('button',{name:/^Stop recording$/i}).waitFor();
      if (test !== 'short') await page.waitForTimeout(1200);
      await page.getByRole('button',{name:/^Stop recording$/i}).click();
      if (test === 'short') {await page.getByRole('alert').filter({hasText:'That recording was too short'}).waitFor();assert.equal(uploads.length,0);}
      if (test === 'unusable') {await page.getByRole('alert').filter({hasText:'No speech was detected'}).waitFor();assert.equal(await page.getByRole('button',{name:'Retry transcription'}).count(),0);await page.getByRole('button',{name:'Record again',exact:true}).waitFor();assert.equal(uploads.length,1);}
      if (test === 'retryable') {await page.getByRole('button',{name:'Retry transcription'}).click();await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(t=>t.value.includes('hash map')));assert.deepEqual(uploads[0],uploads[1]);}
      if (test === 'confirm') {await page.getByRole('button',{name:'Use transcript'}).waitFor();assert.equal(await textbox.inputValue(),'Typed draft');await page.getByRole('button',{name:'Use transcript'}).click();assert.equal(await textbox.inputValue(),'Typed draft\n\nYou');}
      for(const upload of uploads) {assert.ok(upload.mimeType.startsWith('audio/'));assert.ok(upload.audioBase64.length>1000);assert.ok(!('filename' in upload));}
      assert.equal(await page.evaluate(()=>window.__tracks.filter(t=>t.readyState==='live').length),0);
    }
    results.push({route,test,uploads:uploads.length,mimeTypes:uploads.map(u=>u.mimeType),passed:true});
    await context.close();
  }
}
await browser.close();
await fs.writeFile(new URL('microphone.json',import.meta.url),JSON.stringify({fixtures:'Device errors, interview session and provider responses; real Chromium MediaRecorder',results},null,2));
console.log(`${results.length} microphone browser cases passed`);
