// Optional DOM smoke test (not a rendered browser or visual-layout test).
// JSDOM_PATH=/path/to/jsdom/lib/api.js node tools/test_modeling_ui.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const {JSDOM}=await import(process.env.JSDOM_PATH||'jsdom');
const base=new URL('../docs/modeling/',import.meta.url);
const dom=new JSDOM(readFileSync(new URL('index.html',base),'utf8'),{url:'http://localhost:8784/modeling/'});
for(const k of ['document','location','sessionStorage'])globalThis[k]=dom.window[k];
globalThis.fetch=async p=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL(p,base),'utf8'))});
const errors=[];const oldError=console.error;console.error=(...x)=>errors.push(x.join(' '));
await import(new URL('app.mjs',base));
await new Promise(r=>setTimeout(r,30));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
assert.equal($$('[data-add]').length,32);
assert.equal($$('[data-template]').length,6);
assert.ok($('#chart svg'));
for(const t of $$('[data-template]').map(b=>b.dataset.template)){
 $(`[data-template="${t}"]`).click();assert.ok($('#chart svg'),t+' must render');assert.equal($$('[data-field]:checked').length,2);
}
$('#agency').value='all';$('#agency').dispatchEvent(new dom.window.Event('change'));
$('[data-template="q2"]').click();assert.notEqual($('#agency').value,'all');assert.ok($('#chart svg'));
$('#chart-type').value='bar';$('#chart-type').dispatchEvent(new dom.window.Event('change'));assert.ok($('#chart svg rect'));
$('#chart-type').value='table';$('#chart-type').dispatchEvent(new dom.window.Event('change'));assert.equal($('#table-wrap').open,true);
$('#blank').click();assert.equal($$('[data-module]').length,0);assert.equal($('#csv').disabled,true);
$('[data-add="01"]').click();$$('[data-field]')[2].click();$$('[data-field]')[3].click();assert.ok($('#table tbody tr'));
$('#operation').value='percent';$('#operation').dispatchEvent(new dom.window.Event('change'));assert.ok($('#metrics').textContent.includes('%'));
const before=JSON.parse(sessionStorage.getItem('foia-modeling')).keys;$('#swap').click();assert.deepEqual(JSON.parse(sessionStorage.getItem('foia-modeling')).keys,[...before].reverse());
$('[data-add="06"]').click();assert.ok($('#detail-records').textContent.includes('text & detail records'));
$('#search').value='backlog';$('#search').dispatchEvent(new dom.window.Event('input'));assert.equal($$('[data-add]').length,3);
$('#prompt').value='上诉';$('#chat').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.equal($('[data-apply]').dataset.apply,'q5');
$('#start').value='2025';$('#start').dispatchEvent(new dom.window.Event('change'));$('#end').value='2018';$('#end').dispatchEvent(new dom.window.Event('change'));assert.equal($('#start').value,'2018');
console.error=oldError;assert.deepEqual(errors,[]);
console.log('PASS: 32 modules, six templates, live charts, table/bar modes, agency guardrail, blank canvas, field operations, swap, detail records, search, recommendations, year range.');
dom.window.close();
