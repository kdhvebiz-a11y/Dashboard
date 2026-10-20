/* v10: shared reporting model; no write operation against source worksheets. */
const V10 = { payload:null, current:null, selectedYear:null, booted:false,
  colors:['#2364d2','#d38a00','#e36535','#8b5ac4','#139b78','#cf5185'],
  localGoals:store.get('v10_goals',{}), reportNotes:store.get('v10_reportNotes',{}) };
const v10Today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const v10Corp = value => /^(?:SP|그랜드썬SP)$/i.test(txt(value)) ? 'SP' : /UGS|유지에스|유지스/i.test(txt(value)) ? 'UGS' : /그랜드|그랜/.test(txt(value)) ? '그랜드썬' : txt(value)||'미분류';
const v10Source = value => /소개/.test(txt(value)) ? '소개' : /마케팅/.test(txt(value)) ? '마케팅' : '미분류';
const v10OriginalRegion=regionOf;
regionOf=function(value){return [...RG_ORDER,'기타','미분류'].includes(txt(value))?txt(value):v10OriginalRegion(value);};
const v10Date = value => { const m=txt(value).match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : ''; };
const v10Number = value => value===null || value===undefined ? '—' : i(value);
const v10Rate = (a,b) => a===null || b===null || !b ? '—' : pctS(a,b);
const v10Sum = (rows,key) => rows.reduce((s,r)=>s+(Number(r[key])||0),0);
const v10Panel = (title,sub,body) => `<section class="v10-panel"><h3>${esc(title)}</h3><p class="v10-note">${esc(sub||'')}</p>${body}</section>`;
const v10Empty = text => `<div class="v10-empty">${esc(text)}</div>`;
function v10Table(headers,rows){return `<div class="v10-table"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">선택 조건에 해당하는 데이터가 없습니다.</td></tr>`}</tbody></table></div>`;}
function v10Card(label,value,note,color,section){return `<button class="v10-kpi" style="--metric:${color}" data-v10-section="${section}"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></button>`;}
function v10Line(title,sub,axis,series,unit='건',options={}){
 const usable=series.filter(s=>s.values.some(v=>v!==null));
 if(!usable.length) return v10Panel(title,sub,v10Empty('이 조건의 추세를 계산할 자료가 없습니다.'));
 // Unknown values are not converted into zeroes. Separate contiguous known segments.
 const known=axis.map((_,ix)=>usable.every(s=>s.values[ix]!==null));
 const ix=axis.map((_,i)=>i).filter(i=>known[i]);
 if(!ix.length)return v10Panel(title,sub,v10Empty('이 조건의 추세를 계산할 자료가 없습니다.'));
 // Series names live in the legend (or the title for a single line); end-of-line labels were cut off at the right edge and collided with value labels.
 return v10Panel(title,sub+(known.some(x=>!x)?' · 자료 없는 기간 제외':''),chartLine({labels:ix.map(i=>axis[i].label),series:usable.map(s=>({...s,values:ix.map(i=>s.values[i])})),unit,height:245,noLabels:true,...options}));
}
// Chart text size follows the chart's density: the visible font shrinks just enough that a point's value label fits between neighbouring points (never below 11px, never above 16px), so a half-width card with twelve months stays readable without overlapping numbers.
function v10ChartFont(svg,widthPx){
 const cfg=CH[svg.getAttribute('data-line')||svg.getAttribute('data-bar')];
 if(!cfg||!Array.isArray(cfg.labels)||!cfg.labels.length)return 15;
 const f=cfg.fmt||d1,u=cfg.unit||'',n=cfg.labels.length;
 const longest=Math.max(3,...cfg.series.flatMap(s=>s.values.map(v=>v===null||v===undefined?0:String(f(v)+u).length)));
 const slot=widthPx*0.8/Math.max(n-1,1),fit=slot/(longest*0.66);
 return Math.max(11,Math.min(16,fit))*(cfg.series.length>2?0.84:cfg.series.length>1?0.94:1);
}
const v10WireChartsOriginal=wireCharts;
wireCharts=function(root){
 v10WireChartsOriginal(root);
 if(typeof ResizeObserver==='undefined')return;
 chartReadabilityObserver?.disconnect();
 chartReadabilityObserver=new ResizeObserver(entries=>entries.forEach(({target})=>{
  const box=target.getBoundingClientRect(),vb=target.viewBox.baseVal,scale=Math.min(box.width/vb.width,box.height/vb.height);
  if(scale>0)target.style.setProperty('--chart-readable-font',`${v10ChartFont(target,box.width)/scale}px`);
 }));
 root.querySelectorAll('svg.chart').forEach(svg=>chartReadabilityObserver.observe(svg));
};
const v10OriginalRebuild = rebuild;
function v10GroupedBars(title,sub,axis,series,unit='건'){
 const usable=series.filter(s=>s.values.some(v=>v!==null&&v!==undefined));
 const ix=axis.map((_,i)=>i).filter(i=>usable.length&&usable.every(s=>s.values[i]!==null&&s.values[i]!==undefined));
 if(!ix.length)return v10Panel(title,sub,v10Empty('이 조건의 실적을 계산할 자료가 없습니다.'));
 return v10Panel(title,sub+(ix.length<axis.length?' · 자료 없는 기간 제외':''),chartBars({labels:ix.map(i=>axis[i].label),series:usable.map(s=>({...s,values:ix.map(i=>s.values[i])})),unit,height:270,stacked:false}));
}
rebuild = function(tongye,mal,source){
 if(!Array.isArray(tongye)||!Array.isArray(mal))throw new Error('통계·말 시트가 필요합니다.');
 // The original parser assumes a nonempty meeting ledger. An empty new year is valid.
 if(tongye.some((r,i)=>i>=4&&txt(r[3])))v10OriginalRebuild(tongye,mal,source);
 else { const p=parseMal(mal); DB={ledger:[],...p,sum:parseTongyeSummary(tongye),regions:parseRegionTables(tongye),regionDefs:parseRegionDefs(tongye),sectors:parseSectors(tongye),owners:parseOwnerStats(tongye),source,stamp:Date.now()}; }
 const sheetYear=Number(at(tongye,0,5));
 DB.year=String(sheetYear>=2025?sheetYear:Number(DB.year)||Number(v10Today().slice(0,4)));
 DB.ledger=DB.ledger.map(r=>({...r,corp:v10Corp(r.corp),src:v10Source(r.src),year:Number(DB.year),meetingYear:Number(r.date.slice(0,4))||Number(DB.year)}));
 V10.current=DB;
 const y=V10.selectedYear||Number(DB.year);
 v10ActivateYear(y,false);
 if(!V10.booted){v10CurrentMonth();V10.booted=true;}
};
function v10AcceptPayload(d,source){
 if(d?.error)throw new Error(d.error);
 if(!d||!Array.isArray(d.tongye)||!Array.isArray(d.mal))throw new Error('통계·말 시트 응답을 확인해 주세요.');
 V10.payload=d; rebuild(d.tongye,d.mal,source);
 DB.stamp=d.at||Date.now(); if(V10.current)V10.current.stamp=DB.stamp;
}
function v10Years(){
 const p=V10.payload||{};
 return [...new Set([Number(V10.current?.year),...Object.keys(p.yearSheets||{}).map(Number),...Object.keys(p.yearData||{}).map(Number)])].filter(y=>y>=2025&&y<=2100).sort((a,b)=>b-a);
}
function v10LegacyYear(y){
 const raw=V10.payload?.yearSheets?.[y]; if(!raw)return null;
 return raw.filter(v=>v.slice(1,9).some(x=>txt(x))).map(v=>{
  const match=txt(v[0]).match(/^(?:(sp|ugs)[- ]?)?(\d{1,2})-/i),date=v10Date(v[7]);
  return {no:txt(v[0]),year:Number(y),cmo:match?Number(match[2]):0,date,em:Number(date.slice(5,7)),meetingYear:Number(date.slice(0,4)),
   ct:txt(v[1]),src:/소개/.test(txt(v[1]))?'소개':txt(v[1])?'마케팅':'미분류',type:txt(v[2]),reg:regionOf(v[3]),prop:txt(v[4]),cons:txt(v[5]),own:txt(v[6])||'미지정',cap:num(v[8]),corp:match?.[1]?v10Corp(match[1]):'그랜드썬'};
 });
}
function v10ActivateYear(y,draw=true){
 y=Number(y);V10.selectedYear=y;
 if(y===Number(V10.current?.year))DB=V10.current;
 else {
  const records=V10.payload?.yearData?.[y]?.records || v10LegacyYear(y) || [];
  DB={year:String(y),ledger:records.filter(r=>r.date).map(r=>({...r,corp:v10Corp(r.corp),src:v10Source(r.src)})),inquiries:records,
   months:[],msum:[],years:[],sum:null,sectors:[],regions:[],regionDefs:[],owners:null,source:'연도별 문의 원장',stamp:V10.payload?.at||Date.now(),rawYear:true};
 }
 if(draw){state.owner='전체';state.cons='전체';state.type='전체';state.src='전체';state.corp='전체';state.query='';state.region='전체';v10CurrentMonth();refreshFilters();render();}
}
function v10CurrentMonth(){state.mode='month';state.quarters=[];state.months=[Number(v10Today().slice(5,7))];}
// All twelve months remain selectable, including a new or empty month.
dataMonths = () => Array.from({length:12},(_,i)=>i+1);
function v10ObservedMonths(){
 const all=new Set();
 DB.ledger.forEach(r=>{if(r.cmo)all.add(r.cmo);if(r.em&&r.meetingYear===Number(DB.year))all.add(r.em);});
 (DB.sum?.months||[]).forEach(r=>{if(r.inq||r.mt)all.add(r.m);});
 (DB.months||[]).forEach(r=>{if(r.mtTot?.n||r.inq?.total)all.add(r.m);});
 return [...all].sort((a,b)=>a-b);
}
function v10TrendAxis(){
 if(state.mode==='quarter')return compareGroups();
 if(state.mode==='cumulative')return compareGroups();
 if(state.mode==='month'&&state.months.length>1)return compareGroups();
 const selected=selMonths(),end=Math.max(...v10ObservedMonths(),...selected,1);
 return Array.from({length:end},(_,i)=>({label:`${i+1}월`,months:[i+1]}));
}
function v10Match(r,ignore){
 if(ignore!=='own'&&state.owner!=='전체'&&r.own!==state.owner)return false;
 if(ignore!=='cons'&&state.cons!=='전체'&&(txt(r.cons)||'미지정')!==state.cons)return false;
 if(ignore!=='type'&&state.type!=='전체'&&r.type!==state.type)return false;
 if(ignore!=='src'&&state.src!=='전체'&&v10Source(r.src)!==state.src)return false;
 if(ignore!=='corp'&&state.corp!=='전체'&&v10Corp(r.corp)!==v10Corp(state.corp))return false;
 if(ignore!=='reg'&&state.region&&state.region!=='전체'&&regionOf(r.reg)!==state.region&&r.reg!==state.region)return false;
 const q=state.query.trim().toLowerCase();
 return !q||[r.no,r.own,r.cons,r.reg,r.type,r.corp].join(' ').toLowerCase().includes(q);
}
function v10ReportWeekBounds(label,month){
 const match=txt(label).match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*[~～]\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
 if(!match)return null;
 const sm=Number(match[1]),em=Number(match[3]),year=Number(DB.year),sy=sm>Number(month)?year-1:year,ey=em<sm?sy+1:sy;
 const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 return {start:iso(sy,sm,match[2]),end:iso(ey,em,match[4])};
}
function v10ReportRanges(ms){
 return ms.flatMap(m=>(DB.months?.find(x=>x.m===m)?.wmeet||[]).map(w=>v10ReportWeekBounds(w.label,m)).filter(Boolean));
}
function v10ReportPeriodLabel(ms){
 const ranges=v10ReportRanges(ms).sort((a,b)=>a.start.localeCompare(b.start));
 return ranges.length?'보고 주차 기준 · '+ranges[0].start.slice(5).replace('-','/')+'~'+ranges[ranges.length-1].end.slice(5).replace('-','/'):'미팅일 기준 · 보고 주차 자료 없음';
}
function v10Rows(ms,basis=state.basis,ignore){
 if(basis==='exec'){
  // A reporting month owns complete source weeks, including adjacent calendar months.
  const ranges=v10ReportRanges(ms),withoutRanges=ms.filter(m=>!v10ReportRanges([m]).length);
  return DB.ledger.filter(r=>r.date&&v10Match(r,ignore)&&(ranges.some(w=>r.date>=w.start&&r.date<=w.end)||(withoutRanges.includes(r.em)&&r.meetingYear===Number(DB.year)&&r.date<=v10Today()&&r.meetingYear>=r.year)));
 }
 return DB.ledger.filter(r=>r.date&&r.date<=v10Today()&&r.meetingYear>=r.year&&v10Match(r,ignore)&&ms.includes(basis==='exec'?r.em:r.cmo)&&(basis!=='exec'||r.meetingYear===Number(DB.year)));
}
function v10Scoped(){return state.owner!=='전체'||state.cons!=='전체'||state.type!=='전체'||state.src!=='전체'||state.corp!=='전체'||(state.region&&state.region!=='전체')||!!state.query;}
function v10ReportLedgerComplete(ms){
 return ms.every(m=>{
  const block=DB.months?.find(x=>x.m===m),ranges=v10ReportRanges([m]);
  if(!ranges.length||!block?.mtTot)return false;
  const rows=DB.ledger.filter(r=>r.date&&ranges.some(w=>r.date>=w.start&&r.date<=w.end));
  return rows.length===block.mtTot.n&&Math.abs(v10Sum(rows,'cap')-block.mtTot.cap)<0.1;
 });
}
function v10Aggregate(ms){
 const rows=v10Rows(ms,'cohort'),exeRows=v10Rows(ms,'exec');
 const led=sumRows(rows),run=sumRows(exeRows);
 let total=null,power=null,inqMk=null,inqRef=null,pwrMk=null,pwrRef=null;
 let actualN=run.n,actualCap=run.cap,actualMk=run.mk,actualRef=run.ref,actualSource='통계 미팅 원장 · 보고 주차',cohortSource='통계 미팅 원장 · 문의월';
 const sum=sumFor(ms),sector=sectorFor(ms);
 const unknownPerson=state.owner!=='전체'||state.cons!=='전체'||!!state.query||(state.region&&state.region!=='전체');
 if(DB.rawYear){
  const iq=DB.inquiries.filter(r=>ms.includes(r.cmo)&&v10Match(r));
  total=iq.length;power=iq.filter(r=>/^발전사업/.test(r.type)).length;
  inqMk=iq.filter(r=>r.src==='마케팅').length;inqRef=iq.filter(r=>r.src==='소개').length;
  pwrMk=iq.filter(r=>/^발전사업/.test(r.type)&&r.src==='마케팅').length;pwrRef=iq.filter(r=>/^발전사업/.test(r.type)&&r.src==='소개').length;
 } else {
  if(!unknownPerson&&state.type==='전체'&&state.src==='전체'&&state.corp==='전체')total=sum?sum.inq:inqFor(ms).total;
  if(!unknownPerson&&state.type==='전체'&&state.src==='전체'&&state.corp!=='전체'){
   const key=CORP_KEY[state.corp];total=key?(DB.msum||[]).filter(x=>ms.includes(x.m)).reduce((s,r)=>s+(r[key]||0),0):null;
  }
  if(!unknownPerson&&state.type==='전체'&&state.corp==='전체'){
   const q=inqFor(ms);inqMk=q.mk;inqRef=q.ref;
   if(state.src==='마케팅')total=q.mk;
   if(state.src==='소개')total=q.ref;
  }
  if(!unknownPerson){
   // Summary row is the authoritative development-inquiry total; sector table supplies available breakdowns.
   if(state.type==='전체'&&state.corp==='전체'&&sum){pwrMk=sum.pwrMk;pwrRef=sum.pwrRef;power=state.src==='마케팅'?pwrMk:state.src==='소개'?pwrRef:sum.pwr;}
   else if(state.type==='전체'&&state.corp==='전체'&&DB.msum?.length){const q=inqFor(ms);pwrMk=q.mkPwr;pwrRef=q.refPwr;power=state.src==='마케팅'?pwrMk:state.src==='소개'?pwrRef:pwrMk+pwrRef;}
   else if(DB.sectors?.some(b=>b.rows.length)){power=sector.tot.inq.tot;pwrMk=grpMk(sector.tot.inq);pwrRef=sector.tot.inq.ref;}
  }
  const coarse=state.cons==='전체'&&state.type==='전체'&&state.corp==='전체'&&!state.query&&(!state.region||state.region==='전체');
  if(coarse&&state.owner==='전체'){
   const m=malMeetFor(ms);actualSource='말 시트 · 보고 주차 기준';
   actualN=state.src==='마케팅'?m.mkN:state.src==='소개'?m.refN:m.n;
   actualCap=state.src==='마케팅'?m.mkCap:state.src==='소개'?m.refCap:m.cap;
   actualMk=state.src==='소개'?0:m.mkN;actualRef=state.src==='마케팅'?0:m.refN;
  }else if(coarse&&!v10ReportLedgerComplete(ms)){
   const o=malOwnersFor(ms).find(r=>r.name===state.owner);
   if(o){actualN=state.src==='마케팅'?o.mkN:state.src==='소개'?o.refN:o.n;actualCap=state.src==='마케팅'?o.mkCap:state.src==='소개'?o.refCap:o.cap;actualSource='말 시트 · 미팅 담당자별';actualMk=state.src==='소개'?0:o.mkN;actualRef=state.src==='마케팅'?0:o.refN;}
  }
 }
 if(!DB.rawYear&&state.corp!=='전체'&&state.src==='소개'){total=null;power=null;pwrMk=null;pwrRef=null;inqMk=null;inqRef=null;}
 const provisional=(sum&&!v10Scoped())?sum.ctr:led.ctr;
 return {total,power,inqMk,inqRef,pwrMk,pwrRef,cohort:led.n,powerCohort:rows.filter(r=>/^발전사업/.test(r.type)).length,cohortCap:led.cap,actual:actualN,actualCap,actualMk,actualRef,avg:actualN?actualCap/actualN:0,
  provisional,provisionalCap:led.ctrCap,actualSource,cohortSource,rows,exeRows,scheduled:v10ReportRanges(ms).length?exeRows.filter(r=>r.date>v10Today()).length:DB.ledger.filter(r=>ms.includes(r.em)&&r.meetingYear===Number(DB.year)&&r.date>v10Today()&&v10Match(r)).length,
  gap:actualN-run.n,contractConfirmed:null};
}
const CONTRACT_ANNUAL_GOALS={2026:150000}; // kWp; 150 MW annual commitment.
function v10GoalMonth(m){
 const saved=V10.localGoals[`${DB.year}-${m}`];if(saved)return {...saved,source:'직접 설정 · 이 브라우저'};
 const x=DB.msum?.find(x=>x.m===m);
 const reportWeeks=DB.months?.find(x=>x.m===m)?.wmeet?.length||0;
 const stated=reportWeeks?reportWeeks*17:num(V10.payload?.mal?.[0]?.[86]);
 const sourceGoal=typeof contractGoal==='function'?contractGoal('전체',[m]):null;
 return {total:EASY_INQUIRY_TARGETS.monthly,power:DB.rawYear?null:GOAL.inqPwr,meeting:DB.rawYear?null:(stated>0?stated:null),contractCount:null,contractCap:sourceGoal??(x?.goalCtr>0?x.goalCtr:null),source:sourceGoal!==null?'전체 문의 월 1,500건 / 주 17건 × 보고 주차 수 / RPS 원장 월별 계약 목표':'전체 문의 월 1,500건 / 주 17건 × 보고 주차 수 / CE 계약 용량'};
}
function v10Goals(ms){
 if(v10Scoped())return {total:null,power:null,meeting:null,contractCount:null,contractCap:null};
 const all=ms.map(v10GoalMonth),out={};
 ['total','power','meeting','contractCount','contractCap'].forEach(k=>out[k]=all.every(x=>x[k]!==null&&x[k]!==undefined)?v10Sum(all,k):null);
 return out;
}
function v10GoalBar(label,actual,goal,unit,color){
 const has=goal!==null&&goal>0&&actual!==null,p=has?pct(actual,goal):0;
 const format=n=>unit==='MW'?d1(n):v10Number(n);
 return `<div class="v10-goal"><div class="v10-goal-head"><span>${esc(label)}</span><b>${has?d1(p)+'%':'—'}</b></div><div class="v10-track"><span style="width:${Math.min(p,100)}%;background:${color}"></span></div><small>${actual===null?'실적 미확정':format(actual)+unit} / ${goal===null?'목표 미설정':format(goal)+unit} ${has?' · '+(actual>=goal?'목표 달성':`잔여 ${format(goal-actual)}${unit}`):''}</small></div>`;
}
function v10Kpis(a){
 const c=V10.colors;
 return `<div class="v10-kpis">${[
  v10Card('전체 문의',v10Number(a.total)+' 건',a.total===null?'현재 조건으로 나눌 문의 원장 없음':'선택한 달에 접수된 전체 문의',c[0],'inquiry'),
  v10Card('전체 사업 문의',v10Number(a.power)+' 건',`전체 문의 대비 ${v10Rate(a.power,a.total)}`,c[1],'inquiry'),
  v10Card('접수월 기준 미팅',i(a.cohort)+' 건','선택한 달의 문의가 이후 미팅으로 이어진 건',c[2],'meetCoh'),
  v10Card('실제 미팅',i(a.actual)+' 건',a.actualSource,c[3],'meetExe'),
  v10Card('실제 미팅 용량',capS(a.actualCap),`마케팅 ${i(a.actualMk)}건 · 소개 ${i(a.actualRef)}건`,c[0],'capacity'),
  v10Card('평균 미팅 용량',d1(a.avg)+' kW',`실제 미팅 ${i(a.actual)}건 기준`,c[5],'capacity'),
  v10Card('계약 확정 실적','자료 대기','계약 엑셀 업로드 후 집계 예정',c[4],'contract'),
  v10Card('시트 계약 참고',i(a.provisional)+' 건',`미팅 원장의 계약 용량 ${capS(a.provisionalCap)} · 확정 실적과 구분`,c[4],'contract')
 ].join('')}</div>`;
}
function v10Banner(title,sub){return `<div class="v10-banner"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div><div class="v10-status">${esc(DB.year)}년 · ${esc(periodLabel())}<br>${esc(v10Scoped()?'필터 적용 중':'부서 전체')}</div></div>`;}
function v10Trend(ms){
 const ax=v10TrendAxis(),vals=ax.map(g=>v10Aggregate(g.months));
 return `<div class="v10-grid">${v10Line('문의 접수와 미팅 추세','접수월 기준 · 전체 사업 문의 대비 미팅의 변화',ax,[
  {name:'전체 문의',color:V10.colors[0],values:vals.map(x=>x.total)},
  {name:'전체 사업 문의',color:V10.colors[1],values:vals.map(x=>x.power)}])}
 ${v10Line('두 가지 미팅 기준 비교','문의 접수월 성과와 실제 활동월 성과를 나란히 확인',ax,[
  {name:'접수월 미팅',color:V10.colors[2],values:vals.map(x=>x.cohort)},
  {name:'실제 미팅',color:V10.colors[3],values:vals.map(x=>x.actual)}])}</div>`;
}
function v10PeriodTable(){
 const groups=state.mode==='all'||state.mode==='year'?v10TrendAxis():compareGroups();
 return v10Panel('선택 기간 실적 비교','전환율은 발전사업 미팅 ÷ 전체 사업 문의입니다. 누적 평균·비율은 합계로 다시 계산합니다.',v10Table(['기간','전체 문의','전체 사업 문의','접수월 미팅 (전체)','발전 미팅 전환율','실제 미팅','실제 용량','평균 용량','시트 계약 참고'],groups.map(g=>{const a=v10Aggregate(g.months);return [esc(g.label),v10Number(a.total),v10Number(a.power),i(a.cohort),v10Rate(a.powerCohort,a.power),i(a.actual),capS(a.actualCap),d1(a.avg)+' kW',i(a.provisional)];})));
}
function v10Overview(){
 const ms=selMonths(),a=v10Aggregate(ms),g=v10Goals(ms);
 return v10Banner('컨설팅 실적 한눈에 보기','문의 → 미팅 전환과 실제 활동 실적을 함께 확인합니다.')+v10Kpis(a)
 +`<div class="v10-grid">${v10Panel('목표 진행 현황','선택 기간의 목표 합계 · 계약 확정 실적은 자료 수신 후 계산',
 v10GoalBar('전체 문의',a.total,g.total,'건',V10.colors[0])+v10GoalBar('전체 사업 문의',a.power,g.power,'건',V10.colors[1])+v10GoalBar('실제 미팅',a.actual,g.meeting,'건',V10.colors[3])+v10GoalBar('계약',null,g.contractCount,'건',V10.colors[4]))}
 ${v10Panel('보고 전 확인사항','숫자를 해석할 때 함께 확인하세요.',
 `<p>문의월 미팅 전환율 <b>${v10Rate(a.cohort,a.power)}</b></p><p>실제 미팅 용량 <b>${capS(a.actualCap)}</b> · 평균 <b>${d1(a.avg)} kW</b></p><p>미팅 예정 <b>${i(a.scheduled)}건</b> · 실제 미팅 원장 ${i(a.exeRows.length)}건</p><p class="v10-note">문의월 성과는 후속 미팅에 따라 나중에도 늘어납니다. 이번 달은 월 중간 실적이므로 지난달 전체와의 단순 비교에 주의하세요.</p>`)} </div>`
 +v10Trend(ms)+v10PeriodTable();
}
function v10Inquiries(){
 const ms=selMonths(),a=v10Aggregate(ms);
 return v10Banner('문의와 전환','해당 월에 접수된 문의가 언제 미팅으로 이어졌는지 봅니다.')+v10Kpis(a)+v10Trend(ms)+v10PeriodTable();
}
function v10Meetings(basis){
 const ms=selMonths(),a=v10Aggregate(ms),ax=v10TrendAxis(),vals=ax.map(g=>v10Aggregate(g.months)),exec=basis==='exec';
 const graph=v10Line(exec?'실제 미팅 활동 추세':'문의 접수월 미팅 전환 추세',exec?'선택 월에 실제 진행한 미팅 · 문의 접수일과 무관':'문의가 들어온 월에 귀속 · 후속 미팅 포함',ax,[
 {name:exec?'실제 미팅':'접수월 미팅',color:V10.colors[exec?3:2],values:vals.map(x=>exec?x.actual:x.cohort)},
 {name:'목표',color:V10.colors[1],values:ax.map(g=>v10Goals(g.months).meeting)}]);
 const rate=v10Line(exec?'실제 미팅 용량 추세':'문의 → 미팅 전환율',exec?'월별 총 용량 · kW':'접수월 미팅 ÷ 같은 달 전체 사업 문의',ax,[{name:exec?'미팅 용량':'미팅 전환율',color:V10.colors[5],values:vals.map(x=>exec?x.actualCap:x.power?pct(x.cohort,x.power):null)}],exec?'kW':'%');
 return v10Banner(exec?'실제 미팅 활동':'접수월별 미팅 성과',exec?a.actualSource:a.cohortSource)+v10Kpis(a)+`<div class="v10-grid">${graph}${rate}</div>`+v10PeoplePanel(exec?'own':'cons',basis)+v10PeriodTable()+v10Ledger(basis);
}
/* 컨설팅 실적 점수: 컨설팅 담당자(L열)와 제안서 작성자(K열)가 같은 사람이면 1점,
   다른 사람이면 각 0.5점. 한쪽이 비어 있으면 적힌 사람이 1점. 둘 다 비면 '미지정' 1점. */
function v10ConsultingCredits(rows){
 const map=new Map(),get=name=>{if(!map.has(name))map.set(name,{name,score:0,solo:0,shared:0,asCons:0,asProp:0});return map.get(name);};
 rows.forEach(r=>{
  const cons=txt(r.cons),prop=txt(r.prop),names=[...new Set([cons,prop].filter(Boolean))];
  if(cons)get(cons).asCons++;if(prop)get(prop).asProp++;
  if(!names.length){const u=get('미지정');u.score+=1;u.solo++;return;}
  if(names.length===1){const u=get(names[0]);u.score+=1;u.solo++;return;}
  names.forEach(name=>{const u=get(name);u.score+=0.5;u.shared++;});
 });
 return map;
}
function v10PeopleData(role,basis,ms){
 const rows=v10Rows(ms,basis),map=new Map();
 rows.forEach(r=>{const nm=txt(r[role])||'미지정';if(!map.has(nm))map.set(nm,[]);map.get(nm).push(r);});
 let people=[...map].map(([name,rs])=>({name,...sumRows(rs)})).sort((a,b)=>b.n-a.n);
 if(role==='cons'){
  const credits=v10ConsultingCredits(rows);
  credits.forEach((c,name)=>{if(!map.has(name))people.push({name,...sumRows([]),n:0,cap:0,mk:0,ref:0,avg:0});});
  people=people.map(p=>({...p,...(credits.get(p.name)||{score:0,solo:0,shared:0,asCons:0,asProp:0})})).sort((a,b)=>b.score-a.score||b.n-a.n||a.name.localeCompare(b.name,'ko'));
 }
 let source='미팅 원장';
 if(role==='own'&&basis==='exec'&&!DB.rawYear&&!v10ReportLedgerComplete(ms)&&state.cons==='전체'&&state.type==='전체'&&state.corp==='전체'&&!state.query&&(!state.region||state.region==='전체')){
  people=malOwnersFor(ms).filter(o=>state.owner==='전체'||o.name===state.owner).map(o=>{
   const mk=state.src==='소개'?0:o.mkN,ref=state.src==='마케팅'?0:o.refN,n=mk+ref;
   const cap=(state.src==='소개'?0:o.mkCap)+(state.src==='마케팅'?0:o.refCap);
   return {...o,mk,ref,n,cap,avg:n?cap/n:0,ctr:null};
  });
  // The monthly owner table has a fixed number of name slots. If its named
  // rows do not add up to the authoritative monthly total, keep the difference
  // visible instead of silently dropping those meetings.
  if(state.owner==='전체'){
   const all=malMeetFor(ms),targetMk=state.src==='소개'?0:all.mkN,targetRef=state.src==='마케팅'?0:all.refN;
   const targetMkCap=state.src==='소개'?0:all.mkCap,targetRefCap=state.src==='마케팅'?0:all.refCap;
   const used=people.reduce((o,p)=>({mk:o.mk+p.mk,ref:o.ref+p.ref,mkCap:o.mkCap+(state.src==='소개'?0:p.mkCap),refCap:o.refCap+(state.src==='마케팅'?0:p.refCap)}),{mk:0,ref:0,mkCap:0,refCap:0});
   const mk=Math.max(0,targetMk-used.mk),ref=Math.max(0,targetRef-used.ref),mkCap=Math.max(0,targetMkCap-used.mkCap),refCap=Math.max(0,targetRefCap-used.refCap),n=mk+ref,cap=mkCap+refCap;
   if(n||cap)people.push({name:'담당자별 표 미분류',mk,ref,n,mkCap,refCap,cap,avg:n?cap/n:0,ctr:null});
  }
  people.sort((a,b)=>b.n-a.n);source='말 시트 담당자 집계';
 }
 return {people,source};
}
const v10Score=v=>Number.isInteger(v)?String(v):v.toFixed(1);
function v10PeoplePanel(role,basis){
 const {people,source}=v10PeopleData(role,basis,selMonths());
 if(role==='cons'){
  const total=people.reduce((s,p)=>s+(p.score||0),0);
  return v10Panel('컨설팅 담당자 실적',`${basis==='exec'?'보고 주차':'문의 접수월'} 기준 · ${source} · 이름을 누르면 해당 담당자로 조회`,
   v10Table(['담당자','실적 점수','단독 (1점)','분담 (0.5점)','컨설팅 담당','제안서 작성','미팅 용량','평균 용량'],people.map(p=>[
    `<button data-v10-person="${role}" data-name="${esc(p.name)}">${esc(p.name)}</button>`,`<b>${v10Score(p.score||0)}점</b>`,i(p.solo||0)+'건',i(p.shared||0)+'건',i(p.asCons||0)+'건',i(p.asProp||0)+'건',capS(p.cap),d1(p.n?p.cap/p.n:0)+' kW'
   ]))+`<p class="v10-note">점수 기준: 미팅 원장의 <b>컨설팅 담당자</b>와 <b>제안서 작성자</b>가 같은 사람이면 그 사람에게 1점, 서로 다르면 두 사람에게 0.5점씩. 한쪽만 적혀 있으면 적힌 사람이 1점. 점수 합계 ${v10Score(total)}점 = 미팅 ${i(Math.round(total))}건. 미팅 용량·평균은 컨설팅 담당자 기준입니다.</p>`);
 }
 return v10Panel('현장 미팅 담당자',`${basis==='exec'?'보고 주차':'문의 접수월'} 기준 · ${source} · 이름을 누르면 해당 담당자로 조회`,v10Table(['담당자','미팅','마케팅','소개','미팅 용량','평균 용량'],people.map(p=>[
 `<button data-v10-person="${role}" data-name="${esc(p.name)}">${esc(p.name)}</button>`,i(p.n),i(p.mk),i(p.ref),capS(p.cap),d1(p.n?p.cap/p.n:0)+' kW'
 ])));
}
function v10People(role){
 const basis=state.basis,ms=selMonths(),rows=v10Rows(ms,basis),ax=v10TrendAxis();
 const names=[...new Set(rows.map(r=>txt(r[role])||'미지정'))];
 const series=names.map((name,j)=>({name,color:V10.colors[j%6],values:ax.map(g=>v10Rows(g.months,basis).filter(r=>(txt(r[role])||'미지정')===name).length)}));
 return v10Banner(role==='cons'?'컨설팅 담당자 성과':'현장 담당자 성과',role==='cons'?'문의 응대 후 미팅을 잡은 담당자 기준입니다.':'현장에서 미팅을 진행한 담당자 기준입니다.')+v10PeoplePanel(role,basis)+v10Line('담당자별 월간 미팅 추세','서로 같은 기간과 집계 기준으로 비교합니다.',ax,series)+v10Ledger(basis);
}
function v10Breakdown(kind){
 const ms=selMonths(),a=v10Aggregate(ms),rows=v10Rows(ms,'cohort');
 const names=kind==='src'?['마케팅','소개']:['그랜드썬','SP','UGS'];
 const data=names.map(name=>{
  const rs=rows.filter(r=>kind==='src'?r.src===name:r.corp===name),s=sumRows(rs);
  let iq=null,power=null;
  if(!v10Scoped()){
   if(DB.rawYear){const ir=DB.inquiries.filter(r=>ms.includes(r.cmo)&&(kind==='src'?r.src===name:r.corp===name));iq=ir.length;power=ir.filter(r=>/^발전사업/.test(r.type)).length;}
   else if(kind==='src'){iq=name==='마케팅'?a.inqMk:a.inqRef;power=name==='마케팅'?a.pwrMk:a.pwrRef;}
   else {const key=CORP_KEY[name];iq=inqFor(ms)[key]??null;const sec=sectorFor(ms);power=sec.tot.inq[key]??null;}
  }
  return {name,iq,power,powerMeet:rs.filter(r=>/^발전사업/.test(r.type)).length,...s};
 });
 return v10Banner(kind==='src'?'마케팅 · 소개 성과':'법인별 문의 성과',kind==='src'?'전체 문의와 전체 사업 문의를 구분해 전환 실적을 봅니다.':'그랜드썬 · SP · UGS를 같은 기간으로 비교합니다.')
 +v10Panel('문의부터 미팅까지',kind==='corp'?'전체 문의 분류는 말 BU:BW 기준으로 통계 AB194 합계와 다를 수 있습니다. 법인별 사업 문의는 마케팅 집계이며 소개는 별도입니다.':'전체 문의 유입 분류는 말 BX:BY, 전체 사업 문의는 통계 196·197행입니다. 마케팅·소개 전체 문의는 서로 중복될 수 있어 합산하지 않습니다. 전환율은 발전사업 미팅 ÷ 전체 사업 문의입니다.',v10Table([kind==='src'?'유입':'법인','전체 문의 (말)','전체 사업 문의','미팅 (전체)','발전 미팅 전환율','미팅 용량','평균 용량'],data.map(d=>[esc(d.name),v10Number(d.iq),v10Number(d.power),i(d.n),kind==='src'?v10Rate(d.powerMeet,d.power):'—',capS(d.cap),d1(d.avg)+' kW'])))
 +v10Panel('비교 해석','미팅 용량은 선택 문의월에 귀속된 미팅 원장 기준입니다.',`<p class="v10-note">법인과 소개를 동시에 선택한 문의의 교차 집계는 원본 집계표에 없는 경우 계산하지 않습니다. 문의 수와 미팅 원장은 집계 범위가 일치할 때 전환율을 산출합니다.</p>`)+v10PeriodTable();
}
function v10Region(){
 const ms=selMonths(),rows=v10Rows(ms,'cohort'),groups=regionFor(ms),inq=groups.find(g=>g.title==='문의');
 const names=RG_ORDER;
 return v10Banner('지역별 문의와 미팅','문의 접수월 기준 · 권역별 수요와 활동을 비교합니다.')+v10Panel('권역별 실적','지역 문의 집계는 부서 전체 기준입니다. 담당자·유입·법인 교차 필터가 있으면 문의는 —로 표시합니다.',v10Table(['권역','문의','미팅 원장','미팅 용량','평균 용량'],names.map(name=>{
  const rs=rows.filter(r=>regionOf(r.reg)===name||r.reg===name),s=sumRows(rs);
  const iq=DB.rawYear?DB.inquiries.filter(r=>ms.includes(r.cmo)&&v10Match(r)&&(regionOf(r.reg)===name||r.reg===name)).length:v10Scoped()?null:inq?.regions.find(r=>r.region===name)?.sum??null;
  return [esc(name),v10Number(iq),i(s.n),capS(s.cap),d1(s.avg)+' kW'];
 })))+v10Line('권역별 월간 미팅 추세','문의 접수월 기준 · 권역이 미기재된 건은 미팅 원장에서 확인',v10TrendAxis(),names.map((name,j)=>({name,color:V10.colors[j%6],values:v10TrendAxis().map(g=>v10Rows(g.months,'cohort').filter(r=>regionOf(r.reg)===name||r.reg===name).length)})));
}
function v10Capacity(){
 const ms=selMonths(),rows=v10Rows(ms,state.basis),a=v10Aggregate(ms),bands=capBands(rows);
 const labels=['50 kW 미만','50~100 kW 미만','100~300 kW 미만','300~500 kW 미만','500~1,000 kW 미만','1,000~1,500 kW 미만','1,500~2,000 kW 미만','2,000 kW 이상'];
 const recorded=rows.filter(r=>r.cap>0),valid=capBands(recorded),missing=rows.length-recorded.length;
 return v10Banner('미팅 용량 분석',`${state.basis==='exec'?'보고 주차':'문의 접수월'} 기준 · 총 용량과 건당 평균을 함께 확인합니다.`)+v10Kpis(a)
 +v10Panel('용량 구간별 비율',`용량이 기록된 ${i(recorded.length)}건 기준 · 용량 미기재 또는 0인 ${i(missing)}건 제외`,v10Table(['용량 구간','미팅','건수 비중','미팅 용량','평균 용량'],valid.map((b,j)=>[labels[j],i(b.n),v10Rate(b.n,recorded.length),capS(b.cap),d1(b.n?b.cap/b.n:0)+' kW'])))
 +`<div class="v10-grid">${v10PeoplePanel('own',state.basis)}${v10PeoplePanel('cons',state.basis)}</div>`+v10Ledger(state.basis);
}
function v10GoalView(){
 const ms=selMonths(),a=v10Aggregate(ms),g=v10Goals(ms),one=ms.length===1?v10GoalMonth(ms[0]):{};
 return v10Banner('목표와 달성률','기간별 목표를 설정하고 실제 실적과 비교합니다.')
 +v10Panel('선택 기간 목표 달성','문의는 접수월 · 미팅은 진행월 · 계약은 원장 연도·보고 월 기준',v10GoalBar('전체 문의',a.total,g.total,'건',V10.colors[0])+v10GoalBar('전체 사업 문의',a.power,g.power,'건',V10.colors[1])+v10GoalBar('사업주 미팅',a.actual,g.meeting,'건',V10.colors[3])+v10GoalBar('계약 건수',v10Scoped()?null:contractAggregate(ms,{filtered:false}).count,g.contractCount,'건',V10.colors[4])+v10GoalBar('계약 용량',v10Scoped()?null:contractAggregate(ms,{filtered:false}).capacity,g.contractCap,'kWp',V10.colors[4]))
 +v10Panel('월별 목표 설정','입력한 목표를 선택된 각 월에 동일하게 적용합니다. 이 브라우저에 저장되며 원본 스프레드시트는 수정하지 않습니다.',
 `<form id="v10GoalForm"><div class="v10-settings">${[['total','전체 문의 (건)'],['power','전체 사업 문의 (건)'],['meeting','실제 미팅 (건)'],['contractCount','계약 (건)'],['contractCap','계약 용량 (kW)']].map(([k,label])=>`<label>${label}<input type="number" name="${k}" min="0" step="${k==='contractCap'?'0.001':'1'}" value="${one[k]??''}" placeholder="미설정"></label>`).join('')}</div><div class="v10-actions"><button class="btn primary" type="submit">선택 월 목표 저장</button><button class="btn" type="button" data-v10-action="restoreGoals">선택 월 기존 목표로 복원</button><span id="v10GoalStatus" role="status"></span></div></form>`)
 +v10Panel('월별 목표표','—는 미설정입니다. 계약 실적은 엑셀 자료 수신 후 연결합니다.',v10Table(['월','전체 문의 목표','전체 사업 문의 목표','미팅 목표','계약 목표','계약 용량 목표','설정 기준'],ms.map(m=>{const t=v10GoalMonth(m);return [m+'월',v10Number(t.total),v10Number(t.power),v10Number(t.meeting),v10Number(t.contractCount),t.contractCap===null?'—':capS(t.contractCap),esc(t.source)];})));
}
function v10Contract(){
 const a=v10Aggregate(selMonths());
 return v10Banner('계약 실적','계약 엑셀의 확정 실적을 연결할 자리입니다.')+`<div class="v10-callout">계약 엑셀은 아직 받지 않았습니다. 아래 값은 기존 시트의 참고 실적이며, 계약일 기준 확정 실적이나 계약금액을 의미하지 않습니다.</div>`
 +v10Panel('현재 확인 가능한 시트 참고값','문의월 기준 계약 상태 및 미팅 원장의 계약 용량',v10Table(['항목','값'],[['시트 계약 상태 건수',i(a.provisional)+'건'],['미팅 원장 계약 용량',capS(a.provisionalCap)],['계약 확정 건수','자료 대기'],['계약일 기준 월별 실적','자료 대기'],['계약 금액','자료 대기']]))
 +v10Panel('추후 계약 엑셀 연결 기준','파일을 받으면 실제 열 이름과 단위를 확인해 연결합니다.',`<p>상담번호, 계약일, 계약용량(kW), 계약금액, 법인, 담당자를 기준으로 문의·미팅 자료와 연결합니다. 같은 상담번호의 여러 계약과 변경·취소 계약은 별도로 구분합니다.</p>`);
}
function v10Insights(){
 const ms=selMonths(),a=v10Aggregate(ms),g=v10Goals(ms),cards=[];
 if(a.power!==null)cards.push(['문의에서 미팅으로',`선택 문의월 전체 사업 문의 ${i(a.power)}건 중 발전사업 미팅 ${i(a.powerCohort)}건, 전환율 ${v10Rate(a.powerCohort,a.power)}입니다. 전체 사업형태의 미팅은 ${i(a.cohort)}건입니다.`]);
 if(g.meeting>0)cards.push(['실제 미팅 목표',`실제 미팅 ${i(a.actual)}건 / 목표 ${i(g.meeting)}건으로 달성률은 ${v10Rate(a.actual,g.meeting)}입니다. ${a.actual<g.meeting?`목표까지 ${i(g.meeting-a.actual)}건 남았습니다.`:`목표를 ${i(a.actual-g.meeting)}건 초과했습니다.`}`]);
 if(a.pwrMk>0&&a.pwrRef>0){const powerRows=a.rows.filter(r=>/^발전사업/.test(r.type)),report=sumFor(ms),mk=report?report.mtMk:powerRows.filter(r=>r.src==='마케팅').length,ref=report?report.mtRef:powerRows.filter(r=>r.src==='소개').length;cards.push(['유입별 전환 비교',`마케팅 발전사업 문의 ${i(a.pwrMk)}건 중 미팅 ${i(mk)}건으로 ${v10Rate(mk,a.pwrMk)}, 소개 발전사업 문의 ${i(a.pwrRef)}건 중 미팅 ${i(ref)}건으로 ${v10Rate(ref,a.pwrRef)}입니다.`]);}
 if(a.gap!==0)cards.push(['보고 수치 대조',`${a.actualSource} 집계는 ${i(a.actual)}건, 동일 보고 주차 원장은 ${i(a.exeRows.length)}건으로 ${i(Math.abs(a.gap))}건 차이입니다.`]);
 cards.push(['계약 분석 대기','계약 엑셀의 확정 실적이 들어오면 계약일 기준 추세, 미팅 → 계약 전환, 목표 달성률을 보완합니다. 현재 시트 상태만으로 확정 계약 성과를 단정하지 않습니다.']);
 return cards.map(([t,b])=>`<article class="v10-insight"><h4>${esc(t)}</h4><p>${esc(b)}</p></article>`).join('');
}
function v10Ledger(basis=state.basis){
 const rows=v10Rows(selMonths(),basis);
 return v10Panel('미팅 원장',`${basis==='exec'?'보고 주차':'문의 접수월'} 기준 · ${i(rows.length)}건 · 문의 상세와 연락처는 표시하지 않습니다.`,
 `<div class="v10-actions"><button class="btn" data-v10-action="csv" data-basis="${basis}">현재 원장 CSV 내려받기</button></div>`+v10Table(['상담번호','문의월','미팅일','유입','법인','사업형태','컨설팅 담당','미팅 담당','권역','용량'],rows.map(r=>[esc(r.no),`${r.year}년 ${r.cmo}월`,esc(r.date||'미정'),esc(r.src),esc(r.corp),esc(r.type),esc(r.cons||'미지정'),esc(r.own),esc(regionOf(r.reg)==='기타'?r.reg:regionOf(r.reg)),d1(r.cap)+' kW'])));
}
function v10Report(){
 const ms=selMonths(),a=v10Aggregate(ms),key=`${DB.year}-${ms.join(',')}`,note=V10.reportNotes[key]||'';
 return v10Banner('컨설팅 부서 실적 보고',`${DB.year}년 ${periodLabel()} · ${v10Scoped()?'선택 필터 적용':'부서 전체'} · 데이터 갱신 ${new Date(DB.stamp).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`)
 +`<div class="v10-actions"><button class="btn primary" data-v10-action="print">보고서 인쇄 / PDF 저장</button><button class="btn" data-v10-action="summaryCsv">실적 비교표 내려받기</button><span class="v10-note">인쇄 창에서 PDF 저장을 선택할 수 있습니다.</span></div>`
 +v10Kpis(a)+v10PeriodTable()+v10Trend(ms)+`<div class="v10-grid">${v10PeoplePanel('cons','cohort')}${v10PeoplePanel('own','exec')}</div>`
 +v10Panel('종합 분석 및 개선 제안','현재 선택 기간의 수치를 근거로 생성한 검토 의견',v10Insights())
 +v10Panel('보고자 의견','입력 내용은 이 브라우저에 저장됩니다.',`<textarea id="v10ReportNote" data-key="${esc(key)}" aria-label="보고자 의견" placeholder="특이사항, 다음 달 실행 계획, 보고 의견을 입력하세요.">${esc(note)}</textarea>`);
}

// Keep existing filters and period navigation; give each reporting surface one model.
state.region='전체';
SECTIONS.splice(0,SECTIONS.length,
 {k:'overall',t:'실적 한눈에',g:'실적',basis:'cohort'},
 {k:'inquiry',t:'문의 접수 · 전환',g:'실적',basis:'cohort'},
 {k:'meetCoh',t:'접수월별 미팅',g:'실적',basis:'cohort'},
 {k:'meetExe',t:'실제 미팅 활동',g:'실적',basis:'exec'},
 {k:'contract',t:'계약 실적',g:'실적',basis:'cohort'},
 {k:'source',t:'마케팅 · 소개',g:'분석',basis:'cohort'},
 {k:'corp',t:'법인별',g:'분석',basis:'cohort'},
 {k:'region',t:'지역별',g:'분석',basis:'cohort'},
 {k:'cons',t:'컨설팅 담당자',g:'분석',basis:'both'},
 {k:'owner',t:'현장 미팅 담당자',g:'분석',basis:'both'},
 {k:'capacity',t:'용량 분석',g:'분석',basis:'both'},
 {k:'goal',t:'목표 · 달성률',g:'관리',basis:'exec'},
 {k:'records',t:'미팅 원장',g:'관리',basis:'both'},
 {k:'insight',t:'분석 · 개선 제안',g:'보고',basis:'cohort'},
 {k:'report',t:'부서 보고서',g:'보고',basis:'cohort'});
Object.assign(VIEWS,{overall:v10Overview,inquiry:v10Inquiries,meetCoh:()=>v10Meetings('cohort'),meetExe:()=>v10Meetings('exec'),contract:v10Contract,source:()=>v10Breakdown('src'),corp:()=>v10Breakdown('corp'),region:v10Region,cons:()=>v10People('cons'),owner:()=>v10People('own'),capacity:v10Capacity,goal:v10GoalView,records:()=>v10Ledger(),insight:()=>v10Panel('분석 및 개선 제안','선택 기간과 필터 기준 · 참고 의견',v10Insights()),report:v10Report});
const v10PeriodOriginal=renderPeriod;
renderPeriod=function(){
 v10PeriodOriginal();
 const yearSel=document.getElementById('v10Year');
 yearSel.innerHTML=v10Years().map(y=>`<option value="${y}" ${y===Number(DB.year)?'selected':''}>${y}년</option>`).join('');
 $('#psum').innerHTML=`<b>${esc(DB.year)}년 · ${esc(periodLabel())}</b> · ${state.mode==='month'?'여러 월을 선택해 비교할 수 있습니다.':state.mode==='quarter'?'여러 분기를 선택해 비교할 수 있습니다.':''}`;
};
const v10FiltersOriginal=refreshFilters;
refreshFilters=function(){
 v10FiltersOriginal();
 const names=[...new Set(DB.ledger.map(r=>txt(r.cons)||'미지정'))].sort();
 $('#v10Cons').innerHTML=['전체',...names].map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');$('#v10Cons').value=state.cons;
 const fields=[...new Set(DB.ledger.map(r=>r.own||'미지정'))].sort();
 $('#fOwner').innerHTML=['전체',...fields].map(n=>`<option value="${esc(n==='전체'?n:'F:'+n)}">${esc(n)}</option>`).join('');$('#fOwner').value=state.owner==='전체'?'전체':'F:'+state.owner;
 $('#fSrc').innerHTML=['전체','마케팅','소개','미분류'].map(n=>`<option>${n}</option>`).join('');$('#fSrc').value=state.src;
 $('#fCorp').innerHTML=['전체','그랜드썬','SP','UGS','미분류'].map(n=>`<option>${n}</option>`).join('');$('#fCorp').value=state.corp;
 $('#v10Region').value=state.region||'전체';
};
basisNote=function(){
 $('#basisNote').classList.remove('hide');
 $('#basisNote').innerHTML=`<b>${esc(DB.year)}년 · ${esc(periodLabel())}</b> · ${state.basis==='exec'?'보고 주차 기준':'문의 접수월 기준'}${DB.rawYear?' · 연도별 문의 원장 집계 (현재 통계·말 요약표와 집계 방식 차이 가능)':''}${v10Scoped()?' · 필터 적용 · 문의 교차 집계 불가 항목은 — 표시':''}`;
};
stampFoot=function(){
 $('#footStamp').textContent=`v10 · ${DB.source||'시트'} · 데이터 기준 ${new Date(DB.stamp).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`;
};
function v10Reset(){
 state.owner='전체';state.cons='전체';state.type='전체';state.src='전체';state.corp='전체';state.query='';state.region='전체';state.kpiOpen=null;
 V10.selectedYear=Number(V10.current.year);v10ActivateYear(V10.selectedYear,false);v10CurrentMonth();refreshFilters();render();
}
function v10Download(name,rows){
 const cell=x=>'"'+String(x??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const b=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(b),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function v10InstallControls(){
 const top=document.createElement('div');top.className='v10-top';
 top.innerHTML='<label>조회 연도 <select id="v10Year" aria-label="조회 연도"></select></label><button class="btn" id="v10ThisMonth">이번 달</button><button class="btn v10-reset" id="v10ResetAll">전체 초기화</button><button class="btn primary" data-v10-section="report">부서 보고서</button><span class="version">실무 · 보고 통합 / v10</span>';
 $('#periodbar').prepend(top);
 const filters=document.querySelector('#periodbar .filters');
 const label=document.createElement('label');label.innerHTML='컨설팅 담당자<select id="v10Cons" aria-label="컨설팅 담당자"></select>';filters.prepend(label);
 const region=document.createElement('label');region.innerHTML=`권역<select id="v10Region">${['전체',...RG_ORDER,'미분류','기타'].map(x=>`<option>${x}</option>`).join('')}</select>`;filters.insertBefore(region,filters.lastElementChild);
 $('#fOwner').parentNode.firstChild.textContent='현장 미팅 담당자';
 const old=$('#resetBtn'),reset=old.cloneNode(true);old.replaceWith(reset);reset.textContent='조건 초기화';
 reset.addEventListener('click',()=>{state.owner='전체';state.cons='전체';state.type='전체';state.src='전체';state.corp='전체';state.region='전체';state.query='';refreshFilters();render();});
 $('#v10ResetAll').addEventListener('click',v10Reset);
 $('#v10ThisMonth').addEventListener('click',()=>{v10CurrentMonth();render();});
 $('#v10Year').addEventListener('change',e=>v10ActivateYear(e.target.value));
 $('#v10Cons').addEventListener('change',e=>{state.cons=e.target.value;render();});
 $('#v10Region').addEventListener('change',e=>{state.region=e.target.value;render();});
 const oldOwner=$('#fOwner'),newOwner=oldOwner.cloneNode(true);oldOwner.replaceWith(newOwner);
 newOwner.addEventListener('change',e=>{state.owner=e.target.value==='전체'?'전체':e.target.value.slice(2);render();});
 document.querySelector('.foot').innerHTML='<div><b>집계 기준</b> · 문의 접수월의 미팅 성과는 후속 미팅에 따라 갱신됩니다. 실제 미팅은 활동월 기준입니다. 실제 계약은 RPS 엑셀 스냅샷에서 별도로 집계합니다.</div><div id="footStamp"></div>';
 document.addEventListener('click',e=>{
  const section=e.target.closest('[data-v10-section]');if(section){
   const next=section.dataset.v10Section;
   // Team subtabs have different operational meanings. Do not inherit an
   // unrelated basis from the screen that happened to be open before them.
   if(next==='owner')state.basis='exec';
   if(next==='cons')state.basis='cohort';
   state.sect=next;render();return;
  }
  const person=e.target.closest('[data-v10-person]');if(person){state[person.dataset.v10Person==='cons'?'cons':'owner']=person.dataset.name;refreshFilters();render();return;}
  const b=e.target.closest('[data-v10-action]');if(!b)return;
  if(b.dataset.v10Action==='print'){window.print();return;}
  if(b.dataset.v10Action==='restoreGoals'){selMonths().forEach(m=>delete V10.localGoals[`${DB.year}-${m}`]);store.set('v10_goals',V10.localGoals);render();return;}
  if(b.dataset.v10Action==='csv'){const rs=v10Rows(selMonths(),b.dataset.basis);v10Download(`미팅원장_${DB.year}_${periodLabel()}.csv`,[['상담번호','문의연도','문의월','미팅일','유입','법인','사업형태','컨설팅 담당자','현장 담당자','권역','용량(kW)'],...rs.map(r=>[r.no,r.year,r.cmo,r.date,r.src,r.corp,r.type,r.cons,r.own,regionOf(r.reg),r.cap])]);}
   if(b.dataset.v10Action==='summaryCsv')v10Download(`부서실적_${DB.year}.csv`,[['기간','전체 문의','전체 사업 문의','접수월 미팅','실제 미팅','미팅용량(kW)','평균(kW)','시트계약 참고'],...compareGroups().map(g=>{const a=v10Aggregate(g.months);return [g.label,a.total,a.power,a.cohort,a.actual,a.actualCap,a.avg,a.provisional];})]);
 });
 document.addEventListener('submit',e=>{if(e.target.id!=='v10GoalForm')return;e.preventDefault();const data=new FormData(e.target),goals={};for(const k of ['total','power','meeting','contractCount','contractCap']){const val=txt(data.get(k));goals[k]=val===''?null:Number(val);if(goals[k]!==null&&(!Number.isFinite(goals[k])||goals[k]<0))return;}selMonths().forEach(m=>V10.localGoals[`${DB.year}-${m}`]={...goals});store.set('v10_goals',V10.localGoals);render();$('#v10GoalStatus').textContent='선택 월 목표를 저장했습니다.';});
 document.addEventListener('input',e=>{if(e.target.id==='v10ReportNote'){V10.reportNotes[e.target.dataset.key]=e.target.value;store.set('v10_reportNotes',V10.reportNotes);}});
}
v10InstallControls();
loadViaRun=async function(fresh){setStatus('','시트를 읽는 중…');const d=await runGet(fresh);v10AcceptPayload(d,'구글 시트');refreshFilters();render();setStatus('live','시트 연결');};
async function v10Boot(){
 try{
  setStatus('','시트를 읽는 중…');
  // Show the menu and a clear wait message right away; a cold read of the source sheets can take minutes.
  try{renderNav();skeleton('구글 시트에서 원본 자료를 읽는 중입니다');}catch(error){}
  if(window.__INLINE_DATA__?.tongye)v10AcceptPayload(window.__INLINE_DATA__,'구글 시트');
  else if(RUN_MODE){await loadViaRun(false);return;}
  else {const r=await fetch('/data.json',{cache:'no-store'});if(!r.ok)throw new Error('데이터 연결 실패');v10AcceptPayload(await r.json(),'로컬 미리보기 · 구글 시트');}
  refreshFilters();render();setStatus('live','시트 연결');
 }catch(error){setStatus('err','자료 연결 확인 필요');view.innerHTML=v10Empty(error.message);}
}
refreshNow=async function(){
 try{if(RUN_MODE){await loadViaRun(true);return;}setStatus('','새 데이터를 읽는 중…');const r=await fetch('/data.json?fresh=1',{cache:'no-store'});if(!r.ok)throw new Error('갱신 실패');v10AcceptPayload(await r.json(),'구글 시트');refreshFilters();render();setStatus('live','시트 연결');}
 catch(error){setStatus('err','갱신 실패 · 이전 자료 유지');}
};
// The deployed loader reads fresh cached data on demand; the timestamp remains visible.
v10Boot();
