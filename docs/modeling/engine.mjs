export function unit(c) {
 if (!c) return '';
 if (/Percent/.test(c.key)) return '%';
 if (/Days|DayIncrement/.test(c.key) && !c.addable) return 'days';
 if (/Amount/.test(c.key)) return 'USD';
 if (c.no==='22') return 'staff';
 return 'count';
}
export function rowsFor(data, scope, year) {
 return data.ids.FY.flatMap((y,i)=> y===year && (scope.agency==='all' ? data.ids.level[i]==='agency' : data.ids.Agency[i]===scope.agency && (scope.component ? data.ids.level[i]==='component' && data.ids.Component[i]===scope.component : data.ids.level[i]==='agency')) ? [i]:[]);
}
export function evaluate(data,scope,keys,op='overlay') {
 const cols=keys.map(k=>data.columns.find(c=>c.key===k));
 if(!keys.length || cols.some(c=>!c)) return {error:'Choose fields from the modules to build a view.'};
 if(op!=='overlay' && keys.length!==2) return {error:'A calculation needs exactly two fields: A and B.'};
 if(op==='subtract' && unit(cols[0])!==unit(cols[1])) return {error:'Subtraction requires matching units.'};
 if(scope.agency==='all' && cols.some(c=>!c.addable)) return {error:'This field cannot be summed across agencies. Choose a single agency; medians and averages are not additive.'};
 const series= op==='overlay' ? cols.map(c=>({label:c.label,unit:unit(c),points:[]})) : [{label:op==='ratio'?'A ÷ B':op==='percent'?'A ÷ B × 100':'A − B',unit:op==='percent'?'%':op==='subtract'?unit(cols[0]):`${unit(cols[0])} / ${unit(cols[1])}`,points:[]}];
 if(op==='overlay' && new Set(cols.map(unit)).size>1) return {error:'Overlay fields must share a unit. Use a calculation or separate views for different units.'};
 for(let year=scope.start;year<=scope.end;year++){
  const rows=rowsFor(data,scope,year);
  const valid=(i,k)=>typeof data.values[k]?.[i]==='number' && Number.isFinite(data.values[k][i]);
  const matched=rows.filter(i=>keys.every(k=>valid(i,k)));
  const sum=(k,indices)=>indices.length?indices.reduce((s,i)=>s+data.values[k][i],0):null;
  const less=(k,indices)=>indices.some(i=>(data.lt1[k]||[]).includes(i));
  if(op==='overlay') keys.forEach((k,j)=>{
   const available=rows.filter(i=>valid(i,k));const lt=less(k,available);
   // A stored 0.5 represents <1, not an exact observation. Show a gap and an explicit table value.
   series[j].points.push({year,value:lt?null:sum(k,available),lessThan:lt&&available.length===1,coverage:available.length,total:rows.length,reason:lt?'Reported as <1; not plotted as an exact value':available.length?'':'Not reported'});
  }); else {
   const a=sum(keys[0],matched),b=sum(keys[1],matched),lt=keys.some(k=>less(k,matched));
   const v=a===null||b===null||lt?null:op==='subtract'?a-b:b>0?a/b*(op==='percent'?100:1):null;
   series[0].points.push({year,value:v,coverage:matched.length,total:rows.length,reason:lt?'Input reported as <1; calculation unavailable':!matched.length?'No matched data':op!=='subtract'&&b<=0?'Denominator must be positive':''});
  }
 }
 return {series,cols};
}
export const TEMPLATES=[
 {id:'q1',name:'Intake & processing',question:'Is processing keeping pace with incoming requests?',modules:['01'],fields:[['01','ProcessedQuantity'],['01','ReceivedQuantity']],op:'percent',note:'Processed ÷ received measures throughput relative to intake. It is not the share of this year’s requests completed: processed requests can come from earlier years.'},
 {id:'q2',name:'Response time',question:'How long do different processing tracks take?',modules:['14','16','17','19','20'],fields:[['14','SimpleResponseTime.ResponseTimeMedian'],['14','ComplexResponseTime.ResponseTimeMedian']],op:'overlay',note:'Compare simple and complex tracks separately. Median times describe completed requests, not the waiting time of all pending requests.'},
 {id:'q3',name:'Capacity & resources',question:'How does processing volume relate to staffing?',modules:['01','22','23','26'],fields:[['01','ProcessedQuantity'],['22','TotalFullTimeStaff']],op:'ratio',note:'Processed requests per reported FOIA staff is a workload indicator, not an individual productivity score. Case complexity and work mix differ.'},
 {id:'q4',name:'Outcomes & exemptions',question:'What share of dispositions are full grants?',modules:['02','05','03','06'],fields:[['02','FullGrantQuantity'],['02','DispositionTotalQuantity']],op:'percent',note:'Full grants ÷ total dispositions. Exemption counts are applications, not unique requests; multiple exemptions can apply to one request.'},
 {id:'q5',name:'Appeals',question:'Do appeal decisions change the initial outcome?',modules:['07','08','12','26'],fields:[['08','ReversedQuantity'],['08','DispositionTotalQuantity']],op:'percent',note:'Completely reversed/remanded ÷ all appeal dispositions, including other closures. This excludes partial reversals from the numerator and is not a merits-only success rate.'},
 {id:'q6',name:'Backlog & intake',question:'How large is year-end backlog relative to annual intake?',modules:['01','26','19','30'],fields:[['26','BackloggedRequestQuantity'],['01','ReceivedQuantity']],op:'percent',note:'Backlog is a year-end stock; intake is an annual flow. This ratio can exceed 100% and is not the percentage of incoming requests that became backlogged. Backlog and all pending requests differ.'}
];
export function templateState(data,t){return {modules:[...t.modules],keys:t.fields.map(([no,part])=>data.columns.find(c=>c.no===no&&c.key.includes(part))?.key).filter(Boolean),op:t.op,template:t.id};}
export function recommend(text){
 const rules=[[/appeal|上诉|申诉/i,'q5'],[/exempt|grant|release|disposition|豁免|公开|披露|结果/i,'q4'],[/staff|cost|resource|capacity|人员|成本|资源/i,'q3'],[/backlog|积压/i,'q6'],[/time|delay|wait|时间|等待|延迟/i,'q2'],[/request|intake|receiv|process|请求|收到|处理/i,'q1']];
 return TEMPLATES.find(t=>t.id===(rules.find(([re])=>re.test(text))?.[1]||'q1'));
}
