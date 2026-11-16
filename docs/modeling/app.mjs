import {evaluate,unit,TEMPLATES,templateState,recommend} from './engine.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#245cc5','#078576','#b36629','#9656b4'];
let data,modules,details,state,output,group='All',dragged=null;
const fmt=(v,u)=>v===null?'Not reported':new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v)+(u==='%'?'%':u==='days'?' days':'');
const toast=s=>{ $('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>{const el=$('#toast');if(el)el.style.display='none';},3500); };
const col=k=>data.columns.find(c=>c.key===k);
const moduleGroup=n=>+n<=6?'Requests':+n<=13?'Appeals':+n<=20?'Time':+n<=26?'Resources':'Other';
const options=(items,value)=>items.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('');
function validState(s){
 if(!s || typeof s!=='object')throw Error('Invalid recipe');
 const agencies=new Set(data.ids.Agency),names=new Set(modules.map(m=>m.no));
 const scope=s.scope||{};
 if(scope.agency!=='all'&&!agencies.has(scope.agency))throw Error('Unknown agency');
 if(!Number.isInteger(scope.start)||!Number.isInteger(scope.end)||scope.start<2008||scope.end>2025||scope.start>scope.end)throw Error('Invalid year range');
 if(scope.component&&!data.ids.Component.some((c,i)=>c===scope.component&&data.ids.Agency[i]===scope.agency&&data.ids.level[i]==='component'))throw Error('Unknown component');
 if(!Array.isArray(s.modules)||s.modules.some(n=>!names.has(n))||!Array.isArray(s.keys)||s.keys.length>4||s.keys.some(k=>!col(k)||!s.modules.includes(col(k).no)))throw Error('Invalid module or field');
 if(!['overlay','ratio','percent','subtract'].includes(s.op))throw Error('Invalid operation');
 return {scope:{agency:scope.agency,component:scope.component||'',start:scope.start,end:scope.end},modules:[...new Set(s.modules)],keys:[...new Set(s.keys)],op:s.op,template:TEMPLATES.some(t=>t.id===s.template)?s.template:null,chart:['line','bar','table'].includes(s.chart)?s.chart:'line'};
}
function persist(){try{sessionStorage.setItem('foia-modeling',JSON.stringify(state));}catch{} }
function custom(){state.template=null;}
function renderScope(){
 const agencies=[...new Set(data.ids.Agency)].sort();
 $('#agency').innerHTML=options([['all','All agencies · reported totals'],...agencies.map(a=>[a,a])],state.scope.agency);
 const comps=[...new Map(data.ids.Component.flatMap((c,i)=>c&&data.ids.Agency[i]===state.scope.agency&&data.ids.level[i]==='component'?[[c,data.ids.Name[i]]]:[])).entries()];
 $('#component').innerHTML=options([['','Whole agency'],...comps],state.scope.component);$('#component').disabled=state.scope.agency==='all';
 for(const id of ['start','end'])$('#'+id).innerHTML=options(Array.from({length:18},(_,i)=>[i+2008,'FY'+(i+2008)]),state.scope[id]);
}
function renderLibrary(){
 $('#groups').innerHTML=['All','Requests','Appeals','Time','Resources','Other'].map(g=>`<button class="${group===g?'active':''}" data-group="${g}">${g}</button>`).join('');
 const term=$('#search').value.toLowerCase();
 $('#library').innerHTML=modules.filter(m=>(group==='All'||moduleGroup(m.no)===group)&&`${m.no} ${m.name}`.toLowerCase().includes(term)).map(m=>`<button draggable="true" data-add="${m.no}" class="module-item ${state.modules.includes(m.no)?'selected':''}" title="Add ${esc(m.name)}"><span class="num">${m.no}</span><span>${esc(m.name)}</span><span class="plus">${state.modules.includes(m.no)?'✓':'+'}</span></button>`).join('')||'<p>No matching modules.</p>';
}
function renderCanvas(){
 $('#module-count').textContent=state.modules.length+' MODULES';
 const t=TEMPLATES.find(t=>t.id===state.template);
 $('#question').textContent=t?t.question:'Your custom question · select fields, then choose their relationship.';
 $('#templates').innerHTML=TEMPLATES.map((t,i)=>`<button data-template="${t.id}" class="template ${state.template===t.id?'active':''}"><span>QUESTION 0${i+1}</span>${t.name}</button>`).join('');
 $('#canvas').innerHTML=state.modules.map(no=>{
  const m=modules.find(m=>m.no===no),fields=data.columns.filter(c=>c.no===no);
  return `<article class="module-card" data-module="${no}" draggable="true"><div class="card-head"><strong>${no}</strong><span>${esc(m.name)}</span><button data-remove="${no}" aria-label="Remove module ${no}">×</button></div><div class="fields">${fields.length?fields.map(c=>{const pos=state.keys.indexOf(c.key);return `<label class="field"><input type="checkbox" data-field="${esc(c.key)}" ${pos>=0?'checked':''}><span>${pos>=0?`<b>${String.fromCharCode(65+pos)}</b> `:''}${esc(c.label)}<small>${unit(c)} · ${c.addable?'additive field':'single agency only'}</small></span></label>`}).join(''):'<div class="text-module">Text & detail records<br>Inspect the source descriptions below the chart. These records are not interchangeable with request counts.</div>'}</div></article>`;
 }).join('')||'<div class="empty"><h3>A blank canvas for your question</h3><p>Click a module in the library, or drag it here.</p></div>';
 $('#ports').innerHTML=state.keys.map((k,i)=>`<span class="port"><b>${String.fromCharCode(65+i)}</b> ${esc(col(k).label)}</span>`).join('')||'<span class="muted">No fields selected</span>';
 const n=state.keys.length;
 const flowHeight=Math.max(100,n*48+20),mid=flowHeight/2;
 $('#flow').innerHTML=n?`<svg viewBox="0 0 900 ${flowHeight}" role="img" aria-label="Data flow from selected fields through operation to chart"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#96adc8"/></marker></defs>${state.keys.map((k,i)=>{const yy=12+i*48;return `<path d="M 330 ${yy+16} C 390 ${yy+16}, 400 ${mid}, 450 ${mid}" stroke="#96adc8" stroke-width="1.5" fill="none" marker-end="url(#arrow)"/><rect x="8" y="${yy}" width="322" height="32" rx="6" fill="#f0f5ff" stroke="#cad9e7"/><text x="20" y="${yy+20}" fill="#245cc5" font-size="11">${String.fromCharCode(65+i)} · module ${col(k).no} · ${esc(col(k).label.length>36?col(k).label.slice(0,35)+'…':col(k).label)}</text>`}).join('')}<rect x="450" y="${mid-22}" width="180" height="44" rx="8" fill="#182e42"/><text x="540" y="${mid+4}" text-anchor="middle" fill="white" font-size="12">${state.op==='overlay'?'Compare fields':state.op==='percent'?'A ÷ B × 100':state.op==='ratio'?'A ÷ B':'A − B'}</text><path d="M 630 ${mid} L 730 ${mid}" stroke="#96adc8" stroke-width="1.5" marker-end="url(#arrow)"/><rect x="730" y="${mid-22}" width="160" height="44" rx="8" fill="#eaf6f1" stroke="#b2d9cc"/><text x="810" y="${mid+4}" text-anchor="middle" fill="#07796b" font-size="12">Chart + evidence</text></svg>`:'';
 $('#operation').value=state.op;$('#chart-type').value=state.chart;$('#swap').disabled=state.keys.length!==2;
}
function renderChart(){
 output=evaluate(data,state.scope,state.keys,state.op);
 const t=TEMPLATES.find(t=>t.id===state.template);
 $('#chart-title').innerHTML=`<h3>${esc(t?t.question:state.op==='overlay'?'Selected field trends':state.op==='subtract'?'Difference · A − B':state.op==='percent'?'Relative measure · A ÷ B × 100':'Relative measure · A ÷ B')}</h3><p>${esc(state.scope.agency==='all'?'All agencies · available agency totals':state.scope.agency)}${state.scope.component?' / '+esc(state.scope.component):''} · FY${state.scope.start}–FY${state.scope.end}</p>`;
 $('#metrics').innerHTML='';$('#legend').innerHTML='';$('#table').innerHTML='';
 $('#interpretation').innerHTML=`<strong>How to read this</strong><br>${esc(t?t.note:state.op==='overlay'?'Use the same unit to compare trends. Similar movement does not establish a causal relationship.':`This is an exploratory ${state.op==='subtract'?'difference':'ratio'}. Check that the two fields have a meaningful shared population and reporting scope before interpreting it. A valid arithmetic operation is not automatically a valid analytical claim.`)}`;
 if(output.error){$('#chart').innerHTML=`<div class="empty">${esc(output.error)}</div>`;$('#csv').disabled=true;$('#table-wrap').hidden=true;return;}
 $('#csv').disabled=false;$('#table-wrap').hidden=false;
 const series=output.series;
 $('#metrics').innerHTML=series.map((s,j)=>{const p=s.points.at(-1);return `<div class="metric" style="border-color:${colors[j]}"><small>${esc(s.label)} ${state.op==='overlay'?'':`(${esc(s.unit)})`}</small><strong>${p.lessThan?'&lt;1':fmt(p.value,s.unit)}</strong><span class="year">FY${p.year} · ${p.coverage}/${p.total} reporting rows${p.reason?' · '+esc(p.reason):''}</span></div>`}).join('');
 $('#legend').innerHTML=series.map((s,j)=>`<span><i style="background:${colors[j]}"></i>${esc(s.label)}</span>`).join('');
 const rows=series[0].points.map((p,i)=>`<tr><td>FY${p.year}</td>${series.map(s=>{const q=s.points[i];return `<td>${q.lessThan?'&lt;1':fmt(q.value,s.unit)}<br><small>${q.coverage}/${q.total} reporting${q.reason?' · '+esc(q.reason):''}</small></td>`}).join('')}</tr>`).join('');
 $('#table').innerHTML=`<table><thead><tr><th>Fiscal year</th>${series.map(s=>`<th>${esc(s.label)} (${esc(s.unit)})</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
 $('#table-wrap').open=state.chart==='table';
 if(state.chart==='table'){$('#chart').innerHTML='';return;}
 const values=series.flatMap(s=>s.points.map(p=>p.value)).filter(v=>v!==null);
 if(!values.length){$('#chart').innerHTML='<div class="empty">No plottable observations for this scope.<br>Missing values and “&lt;1” observations are not drawn as zero. Inspect the table or change the scope.</div>';return;}
 const W=960,H=330,L=75,R=25,T=18,B=43,lo=Math.min(0,...values),hi=Math.max(1,...values),span=hi-lo;
 const x=year=>L+(year-state.scope.start)/Math.max(1,state.scope.end-state.scope.start)*(W-L-R);
 const y=v=>H-B-(v-lo)/span*(H-T-B);
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Selected FOIA measures by fiscal year"><title>${esc($('#chart-title h3').textContent)}</title>`;
 for(let i=0;i<=4;i++){const v=lo+span*i/4,yy=y(v);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e3e9ef"/><text x="${L-10}" y="${yy+4}" text-anchor="end" fill="#677887" font-size="11">${esc(Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(v))}${series[0].unit==='%'?'%':''}</text>`;}
 for(let year=state.scope.start;year<=state.scope.end;year++){if(year===state.scope.start||year===state.scope.end||year%Math.max(1,Math.ceil((state.scope.end-state.scope.start)/8))===0)svg+=`<text x="${x(year)}" y="${H-15}" text-anchor="middle" fill="#677887" font-size="11">${year}</text>`;}
 series.forEach((s,j)=>{
  if(state.chart==='line'){let path='',down=false;for(const p of s.points){if(p.value===null){down=false;continue;}path+=`${down?'L':'M'}${x(p.year)},${y(p.value)} `;down=true;}svg+=`<path d="${path}" fill="none" stroke="${colors[j]}" stroke-width="2.5"/>`;}
  for(const p of s.points){if(p.value===null)continue;const title=`FY${p.year} · ${s.label}: ${fmt(p.value,s.unit)} · ${p.coverage}/${p.total} reporting rows`;
   if(state.chart==='bar'){const bw=Math.min(45,(W-L-R)/Math.max(1,s.points.length)/series.length*.7),xx=x(p.year)+(j-series.length/2)*bw;svg+=`<rect x="${Math.max(L,Math.min(W-R-bw,xx))}" y="${Math.min(y(0),y(p.value))}" width="${bw-1}" height="${Math.max(1,Math.abs(y(p.value)-y(0)))}" fill="${colors[j]}" rx="2"><title>${esc(title)}</title></rect>`;}else svg+=`<circle cx="${x(p.year)}" cy="${y(p.value)}" r="4" fill="${colors[j]}" stroke="white" stroke-width="1.5"><title>${esc(title)}</title></circle>`;
  }
 });svg+='</svg>';$('#chart').innerHTML=svg;
}
function renderDetails(){
 const selected=state.modules.filter(n=>['03','06','11'].includes(n));
 $('#detail-records').innerHTML=selected.map(no=>{
  const matches=details.filter(r=>r.no===no&&r.year>=state.scope.start&&r.year<=state.scope.end&&(state.scope.agency==='all'?r.level==='agency':r.agency===state.scope.agency&&(state.scope.component?r.level==='component'&&r.component===state.scope.component:r.level==='agency')));
  return `<details><summary>Module ${no} · text & detail records (${matches.length})</summary><p class="detail-caption">Source descriptions, not deduplicated request totals. Showing the first 150 matching records; narrow the years and agency to inspect more specifically.</p><div class="table-scroll"><table><thead><tr><th>FY / agency</th><th>Description</th><th>Reported quantity</th></tr></thead><tbody>${matches.slice(0,150).map(r=>`<tr><td>${r.year}<br>${esc(r.agency)}</td><td>${esc(r.text)}${r.info?'<br>'+esc(r.info):''}${r.citation?'<br>'+esc(r.citation):''}</td><td>${esc(r.value)||'Not reported'}</td></tr>`).join('')||'<tr><td colspan="3">No records for this scope.</td></tr>'}</tbody></table></div></details>`;
 }).join('');
}
function render(){renderScope();renderLibrary();renderCanvas();renderChart();renderDetails();persist();}
function addModule(no){if(!state.modules.includes(no)){state.modules.push(no);custom();render();}else toast('This module is already on the canvas.');}
function applyTemplate(id){Object.assign(state,templateState(data,TEMPLATES.find(t=>t.id===id)));if(id==='q2'&&state.scope.agency==='all'){state.scope.agency=data.ids.Agency.find(a=>a.includes('Justice'));state.scope.component='';toast('Response-time medians need a single agency. Selected Department of Justice.');}render();}
function download(name,body,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function init(){
 [data,modules,details]=await Promise.all(['../data/foia.json','modules.json','details.json'].map(async p=>{const r=await fetch(p);if(!r.ok)throw Error('Could not load '+p);return r.json();}));
 state={scope:{agency:data.ids.Agency.find(a=>a.includes('Justice')),component:'',start:2016,end:2025},...templateState(data,TEMPLATES[0]),chart:'line'};
 const hash=new URLSearchParams(location.hash.slice(1)).get('recipe');
 try{const stored=hash||sessionStorage.getItem('foia-modeling');if(stored)state=validState(JSON.parse(stored));}catch{toast('Saved view could not be loaded. Showing the default path.');}
 $('#built').textContent=data.built;
 $('#search').addEventListener('input',renderLibrary);
 $('#groups').onclick=e=>{const b=e.target.closest('[data-group]');if(b){group=b.dataset.group;renderLibrary();}};
 $('#library').onclick=e=>{const b=e.target.closest('[data-add]');if(b)addModule(b.dataset.add);};
 $('#templates').onclick=e=>{const b=e.target.closest('[data-template]');if(b)applyTemplate(b.dataset.template);};
 $('#canvas').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){state.modules=state.modules.filter(n=>n!==b.dataset.remove);state.keys=state.keys.filter(k=>col(k).no!==b.dataset.remove);custom();render();}};
 $('#canvas').onchange=e=>{const key=e.target.dataset.field;if(!key)return;if(e.target.checked){if(state.keys.length>=4){e.target.checked=false;toast('Use up to four fields per view.');return;}state.keys.push(key);}else state.keys=state.keys.filter(k=>k!==key);custom();render();};
 document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-add],[data-module]');if(!el)return;dragged=el.dataset.add||el.dataset.module;e.dataTransfer.setData('text/plain',dragged);e.dataTransfer.effectAllowed='copyMove';});
 $('#canvas').ondragover=e=>{e.preventDefault();$('#canvas').classList.add('dragover');};$('#canvas').ondragleave=()=>$('#canvas').classList.remove('dragover');
 $('#canvas').ondrop=e=>{e.preventDefault();$('#canvas').classList.remove('dragover');const no=dragged||e.dataTransfer.getData('text/plain');if(!modules.some(m=>m.no===no))return;const target=e.target.closest('[data-module]')?.dataset.module;if(state.modules.includes(no)&&target&&target!==no){state.modules=state.modules.filter(n=>n!==no);state.modules.splice(state.modules.indexOf(target),0,no);custom();render();}else if(!state.modules.includes(no))addModule(no);dragged=null;};
 for(const id of ['agency','component','start','end'])$('#'+id).onchange=e=>{const v=e.target.value;state.scope[id]=['start','end'].includes(id)?+v:v;if(id==='agency')state.scope.component='';if(state.scope.start>state.scope.end){if(id==='start')state.scope.end=state.scope.start;else state.scope.start=state.scope.end;}render();};
 $('#operation').onchange=e=>{state.op=e.target.value;custom();render();};
 $('#chart-type').onchange=e=>{state.chart=e.target.value;render();};
 $('#swap').onclick=()=>{state.keys.reverse();custom();render();};
 $('#blank').onclick=()=>{state.modules=[];state.keys=[];state.op='overlay';custom();render();};
 $('#save').onclick=()=>download('foia-analysis-recipe.json',JSON.stringify(state,null,2),'application/json');
 $('#load').onchange=async e=>{try{state=validState(JSON.parse(await e.target.files[0].text()));render();toast('Recipe loaded.');}catch(err){toast('Could not load recipe: '+err.message);}e.target.value='';};
 $('#share').onclick=async()=>{const url=new URL(location.href);url.hash=new URLSearchParams({recipe:JSON.stringify(state)}).toString();try{await navigator.clipboard.writeText(url.href);toast('View link copied. The recipient needs access to this dashboard URL.');}catch{location.hash=url.hash;toast('View saved in the address bar. Copy the URL to share.');}};
 $('#csv').onclick=()=>{if(!output.series)return;const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['Agency','Component','Fiscal year','Series','Value','Unit','Reporting rows','Eligible rows','Note']];output.series.forEach(s=>s.points.forEach(p=>rows.push([state.scope.agency,state.scope.component||'Whole agency',p.year,s.label,p.lessThan?'<1':p.value,s.unit,p.coverage,p.total,p.reason||''])));download('foia-analysis.csv',rows.map(r=>r.map(csv).join(',')).join('\r\n'),'text/csv');};
 $('#chat').onsubmit=e=>{e.preventDefault();const t=recommend($('#prompt').value);$('#recommendation').innerHTML=`<strong>Suggested path: ${esc(t.name)}</strong><br>Start with ${t.modules.map(n=>`${n} · ${esc(modules.find(m=>m.no===n).name)}`).join('; ')}.<br>${esc(t.note)}<br><button data-apply="${t.id}">Use this starting path →</button><p class="detail-caption">Keyword suggestion, not an interpretation of your data. Applying replaces the current canvas; save your recipe first if needed.</p>`;};
 $('#recommendation').onclick=e=>{const b=e.target.closest('[data-apply]');if(b){applyTemplate(b.dataset.apply);$('#canvas').scrollIntoView({behavior:'smooth',block:'center'});}};
 render();
}
init().catch(err=>{$('main').innerHTML=`<div class="error"><h2>The data could not be loaded</h2><p>${esc(err.message)}</p><p>Open this page through a local web server, not as a file.</p></div>`;console.error(err);});
