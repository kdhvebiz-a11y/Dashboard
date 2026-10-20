/* Calendar weeks connect two independently dated source reports. */
const CW={weeks:store.get('v10_consultingWeeks',{}),loading:false,error:''};
const cwISO=d=>d.toISOString().slice(0,10);
const cwShift=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return cwISO(d);};
function cwWeekOne(year){const d=new Date(Date.UTC(year,0,4));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return cwISO(d);}
function cwWeekCount(year){return Math.round((Date.parse(cwWeekOne(year+1))-Date.parse(cwWeekOne(year)))/604800000);}
function cwRange(year,week){const start=cwShift(cwWeekOne(year),(week-1)*7);return {year,week,start,end:cwShift(start,4),meetingStart:cwShift(start,-3),meetingEnd:cwShift(start,3)};}
function cwThisWeek(year){return Math.max(1,Math.min(cwWeekCount(year),1+Math.floor((Date.parse(v10Today())-Date.parse(cwWeekOne(year)))/604800000)));}
function cwSelected(year){const saved=Number(CW.weeks[year]);if(saved>=1&&saved<=cwWeekCount(year))return saved;return Math.max(1,Math.min(cwWeekCount(year),1+Math.floor((Date.parse(v10Today())-Date.parse(cwWeekOne(year)))/604800000)));}
function cwPeriod(raw,year,month){
 const m=String(raw||'').match(/(\d{1,2})[\/-](\d{1,2})\s*[~～–—-]\s*(\d{1,2})[\/-](\d{1,2})/);if(!m)return null;
 const sm=Number(m[1]),em=Number(m[3]);let sy=year;if(month===1&&sm===12)sy--;if(month===12&&sm===1)sy++;
 const start=`${sy}-${String(sm).padStart(2,'0')}-${m[2].padStart(2,'0')}`,end=`${sy+(em<sm?1:0)}-${String(em).padStart(2,'0')}-${m[4].padStart(2,'0')}`;
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||cwISO(new Date(start+'T00:00:00Z'))!==start||cwISO(new Date(end+'T00:00:00Z'))!==end)return null;
 return {start,end};
}
const cwValue=v=>txt(v)===''?null:num(v);
/* 전체 문의: 말 시트 주차별 전체 문의 표(일~토, 월 경계에서 나뉨). 주말 문의가 없어 월~금 주와 일치한다. */
function cwMalWeeklyRows(payload){
 const rows=Array.isArray(payload?.mal)?payload.mal:[],year=num(rows[0]?.[2])||0;
 const out=[];
 rows.forEach(row=>{
  const m=txt(row?.[2]).match(/^(\d{1,2})\/(\d{1,2})\s*[~～]\s*(\d{1,2})\/(\d{1,2})$/);
  if(!m||!/주차/.test(txt(row?.[3])))return;
  const iso=(mo,d)=>`${year}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  out.push({start:iso(m[1],m[2]),end:iso(m[3],m[4]),total:cwValue(row[4]),gs:cwValue(row[5]),sp:cwValue(row[6]),ugs:cwValue(row[7])});
 });
 return {year,rows:out};
}
function cwDays(start,end){const out=[];for(let d=start;d<=end;d=cwShift(d,1))out.push(d);return out;}
function cwInquiryTotals(payload,year,range){
 const mal=cwMalWeeklyRows(payload);
 if(!mal.rows.length||mal.year!==Number(year))return null;
 const hit=mal.rows.filter(x=>x.start<=range.end&&x.end>=range.start);
 if(!hit.length||hit.every(x=>x.total===null))return null;
 const sum=key=>hit.reduce((s,x)=>s+(x[key]||0),0);
 const missing=cwDays(range.start,range.end).filter(d=>!hit.some(x=>x.start<=d&&x.end>=d));
 return {total:sum('total'),gs:sum('gs'),sp:sum('sp'),ugs:sum('ugs'),missing,rows:hit};
}
/* 사업 문의: 연도별 문의 원장(상담번호의 월-일이 접수일). 통계 AB 표의 '발전사업 주간 문의·진행'과 같은 기준. */
function cwLedger(payload,year){const y=payload?.yearData?.[year];return y?y.records||[]:null;}
const cwActive=r=>/진행|계약/.test(txt(r.ct));
function cwBusinessWeek(payload,year,range){
 const ledger=cwLedger(payload,year);if(!ledger)return null;
 const rows=ledger.filter(r=>r.inquiryDate>=range.start&&r.inquiryDate<=range.end);
 const split=list=>({gs:list.filter(r=>r.src!=='소개'&&r.corp==='그랜드썬').length,sp:list.filter(r=>r.src!=='소개'&&r.corp==='SP').length,ugs:list.filter(r=>r.src!=='소개'&&r.corp==='UGS').length,ref:list.filter(r=>r.src==='소개').length,total:list.length});
 return {all:split(rows),active:split(rows.filter(cwActive)),rows};
}
function cwMeetingRows(payload){
 const found=new Map();
 for(const sh of payload?.weeklyMeetings?.sheets||[]){
  const name=sh.sheet.match(/^(\d{2})\.(\d{2})$/);if(!name)continue;
  const year=sh.year||2000+Number(name[1]),month=sh.month||Number(name[2]);
  const header=(sh.rows||[]).find(row=>txt(row[0])==='날짜')||[];
  const hasMarketingCapacity=/마케팅.*미팅.*용량/.test(txt(header[4])),hasMarketingCount=/마케팅.*미팅.*건수/.test(txt(header[5])),hasReferralCapacity=/소개.*미팅.*용량/.test(txt(header[6])),hasReferralCount=/소개.*미팅.*건수/.test(txt(header[7]));
  for(const row of sh.rows||[]){
   if(!/^\d+주차$/.test(txt(row[1])))continue;
   const dates=cwPeriod(row[0],year,month);if(!dates||new Date(dates.start+'T00:00:00Z').getUTCDay()!==5||cwShift(dates.start,6)!==dates.end)continue;
   const item={...dates,sheet:sh.sheet,gid:sh.gid,period:txt(row[0]),week:txt(row[1]),capacity:cwValue(row[2]),count:cwValue(row[3]),marketingCapacity:hasMarketingCapacity?cwValue(row[4]):null,marketingCount:hasMarketingCount?cwValue(row[5]):null,referralCapacity:hasReferralCapacity?cwValue(row[6]):null,referralCount:hasReferralCount?cwValue(row[7]):null};
   // A week repeated at a month boundary must not be counted twice.
   if(!found.has(item.start)||item.count!==null)found.set(item.start,item);
  }
 }
 return [...found.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
/* 주간 미팅: 원본은 '주간 업무 진행사항' 시트의 월별 탭(26.10 …) J~Q 주차 집계(금~목).
   통계 시트 A~N 미팅 원장은 담당자별 분해와 대조용으로 쓰고, 월별 탭에 그 주차 행이 없을 때만 원장 집계로 대신한다. */
function cwLedgerMeetings(ledger,range,today){
 const rows=(ledger||[]).filter(r=>r.date&&r.date>=range.meetingStart&&r.date<=range.meetingEnd);
 const sum=list=>({n:list.length,cap:Math.round(list.reduce((s,r)=>s+(Number(r.cap)||0),0)*1000)/1000});
 const owners=[...new Set(rows.map(r=>txt(r.own)||'미지정'))].map(name=>{const list=rows.filter(r=>(txt(r.own)||'미지정')===name);return {name,...sum(list),mk:list.filter(r=>r.src==='마케팅').length,ref:list.filter(r=>r.src==='소개').length};}).sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name));
 return {...sum(rows),marketing:sum(rows.filter(r=>r.src==='마케팅')),referral:sum(rows.filter(r=>r.src==='소개')),scheduled:today?rows.filter(r=>r.date>today).length:0,owners,rows};
}
function cwData(year,week,payload=V10.payload,ledger=(typeof DB!=='undefined'&&DB?DB.ledger:[]),today=(typeof v10Today==='function'?v10Today():'')){
 const range=cwRange(year,week),totals=cwInquiryTotals(payload,year,range),biz=cwBusinessWeek(payload,year,range),sheet=cwMeetingRows(payload).find(r=>r.start===range.meetingStart&&r.end===range.meetingEnd);
 const fromLedger=cwLedgerMeetings(ledger,range,today);
 const hasSheet=!!(sheet&&sheet.count!==null);
 const meeting=hasSheet
  ?{n:sheet.count,cap:sheet.capacity===null?0:sheet.capacity,marketing:{n:sheet.marketingCount,cap:sheet.marketingCapacity},referral:{n:sheet.referralCount,cap:sheet.referralCapacity},source:'sheet',owners:fromLedger.owners,scheduled:fromLedger.scheduled,ledger:fromLedger}
  :{...fromLedger,source:'ledger',ledger:fromLedger};
 return {range,totals,biz,meeting,sheet};
}
const cwLabel=(a,b)=>`${a.slice(5).replace('-','/')} ~ ${b.slice(5).replace('-','/')}`;
const cwShow=(value,unit='건')=>value===null||value===undefined?'—':`${Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3})}${unit}`;
function cwCard(label,value,note,color){return `<article class="v10-kpi" style="--metric:${color}"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;}
function cwView(){
 const year=Number(DB.year),week=cwSelected(year),{range:r,totals,biz,meeting,sheet}=cwData(year,week),count=cwWeekCount(year);
 const meetingRows=cwMeetingRows(V10.payload),malYear=cwMalWeeklyRows(V10.payload).year;
 const missingNote=totals?.missing?.length?` · ${totals.missing.map(d=>d.slice(5).replace('-','/')).join(', ')} 구간은 원본 표에 없음`:'';
 const totalSub=totals?`말 시트 주차 표${missingNote}`:(malYear&&malYear!==year?`${year}년 전체 문의 주차 원본 없음 (말 시트는 ${malYear}년)`:'말 시트 주차 표에 이 주가 아직 없음');
 const bizSub=biz?`문의 원장 접수일 기준 · 진행 ${i(biz.active.total)}건${biz.all.ref?` · 소개 ${i(biz.all.ref)}건`:''}`:`${year}년 문의 원장 미연결`;
 const ledgerNote=meeting.source==='sheet'&&meeting.ledger.n!==meeting.n?` · 미팅 원장 ${i(meeting.ledger.n)}건과 ${i(Math.abs(meeting.ledger.n-meeting.n))}건 차이`:'';
 const meetingSource=meeting.source==='sheet'?`주간 업무 진행사항 ${esc(sheet.sheet)} 탭`:(CW.loading?'월별 탭 불러오는 중 · 임시로 미팅 원장 집계':'월별 탭에 이 주차 행이 없어 미팅 원장으로 집계');
 const tile=(color,label,period,value,unit,line2,sub)=>`<article class="cw-tile" style="--metric:${color}"><header><b>${esc(label)}</b><span>${esc(period)}</span></header><div class="cw-tile-value">${value}<em>${unit}</em></div><div class="cw-tile-line">${line2}</div><small>${sub}</small></article>`;
 const summary=`<div class="cw-tiles">`
  +tile(V10.colors[0],'주간 문의',`${cwLabel(r.start,r.end)} · 월~금`,cwShow(totals?totals.total:null,''),totals?'건':'',totals?`그랜드썬 ${cwShow(totals.gs)} · SP ${cwShow(totals.sp)} · 유지에스 ${cwShow(totals.ugs)}`:'—',esc(totalSub))
  +tile(V10.colors[1],'발전사업 주간 문의',`${cwLabel(r.start,r.end)} · 월~금`,cwShow(biz?biz.all.total:null,''),biz?'건':'',biz?`진행 <b>${i(biz.active.total)}건</b> · 마케팅 ${i(biz.all.total-biz.all.ref)}건 · 소개 ${i(biz.all.ref)}건`:'—',esc(biz?'문의 원장 접수일 기준':bizSub))
  +tile(V10.colors[3],'주간 미팅',`${cwLabel(r.meetingStart,r.meetingEnd)} · 금~목`,i(meeting.n),'건',`용량 <b>${esc(cwShow(meeting.cap,' kW'))}</b>${meeting.n&&meeting.cap?` · 건당 ${d1(meeting.cap/meeting.n)} kW`:''} · 마케팅 ${cwShow(meeting.marketing.n)} · 소개 ${cwShow(meeting.referral.n)}`,`${meetingSource}${meeting.scheduled?` · 예정 ${i(meeting.scheduled)}건 포함`:''}${ledgerNote}`)
  +`</div>`;
 // Stacked horizontal bars: every row shares one scale so lengths compare directly.
 const CW_CORP=[['gs','그랜드썬',V10.colors[0]],['sp','SP',V10.colors[2]],['ugs','유지에스',V10.colors[4]],['ref','소개',V10.colors[5]]];
 const cwBar=(segments,total,max,label,valueText,note)=>{
  const segs=segments.filter(x=>x.value>0).map(x=>`<span style="flex:${x.value};background:${x.color}" title="${esc(x.name)} ${i(x.value)}건">${x.value/max>0.09?i(x.value):''}</span>`).join('');
  const width=max>0&&total!==null?Math.max(total/max*100,total>0?2:0):0;
  return `<div class="cw-bar-row"><div class="cw-bar-label">${label}</div><div class="cw-bar-track"><div class="cw-bar" style="width:${width.toFixed(1)}%">${segs}</div></div><div class="cw-bar-value">${valueText}</div><div class="cw-bar-note">${note||''}</div></div>`;
 };
 const legend=items=>`<div class="cw-legend">${items.map(([name,color])=>`<span><i style="background:${color}"></i>${esc(name)}</span>`).join('')}</div>`;
 const rate=(a,b)=>a!==null&&b?`${Math.round(a/b*100)}%`:'—';
 const inqMax=Math.max(totals?totals.total:0,biz?biz.all.total:0,1);
 const corpSegs=src=>CW_CORP.map(([k,name,color])=>({name,color,value:src?.[k]||0}));
 const inquiryBody=(totals||biz)?`<div class="cw-bars">`
  +cwBar(corpSegs(totals),totals?totals.total:null,inqMax,'전체 문의',`<b>${cwShow(totals?totals.total:null)}</b>`,totals?`그랜드썬 ${i(totals.gs)} · SP ${i(totals.sp)} · 유지에스 ${i(totals.ugs)}`:esc(totalSub))
  +cwBar(corpSegs(biz?.all),biz?biz.all.total:null,inqMax,'발전사업 문의',`<b>${cwShow(biz?biz.all.total:null)}</b>`,biz&&totals?`전체의 ${rate(biz.all.total,totals.total)} · 소개 ${i(biz.all.ref)}건`:(biz?`소개 ${i(biz.all.ref)}건`:'문의 원장 미연결'))
  +cwBar(corpSegs(biz?.active),biz?biz.active.total:null,inqMax,'발전사업 진행',`<b>${cwShow(biz?biz.active.total:null)}</b>`,biz?`발전사업 문의의 ${rate(biz.active.total,biz.all.total)} · 진행·계약 상태`:'')
  +`</div>`+legend(CW_CORP.map(([k,name,color])=>[name,color]))
  :v10Empty('이 주의 문의 원본 자료가 연결되지 않았습니다.');
 const SRC_COLORS={마케팅:V10.colors[0],소개:V10.colors[5]};
 const mtMax=Math.max(meeting.n,...meeting.owners.map(o=>o.n),1);
 const srcSeg=(mk,ref)=>[{name:'마케팅',color:SRC_COLORS.마케팅,value:mk||0},{name:'소개',color:SRC_COLORS.소개,value:ref||0}];
 const mkN=meeting.marketing.n,refN=meeting.referral.n,splitKnown=mkN!==null&&refN!==null;
 const meetingBody=`<div class="cw-bars">`
  +cwBar(splitKnown?srcSeg(mkN,refN):[{name:'전체',color:V10.colors[3],value:meeting.n}],meeting.n,mtMax,'<b>전체</b>',`<b>${i(meeting.n)}건</b>`,`${esc(cwShow(meeting.cap,' kW'))}${meeting.n&&meeting.cap?` · 건당 ${d1(meeting.cap/meeting.n)} kW`:''}${splitKnown?` · 마케팅 ${i(mkN)} / 소개 ${i(refN)}`:''}`)
  +meeting.owners.map(o=>cwBar(srcSeg(o.mk,o.ref),o.n,mtMax,esc(o.name),`<b>${i(o.n)}건</b>`,`${esc(cwShow(o.cap,' kW'))}${o.n?` · 건당 ${d1(o.cap/o.n)} kW`:''}`)).join('')
  +`</div>`+legend([['마케팅',SRC_COLORS.마케팅],['소개',SRC_COLORS.소개]])
  +(meeting.owners.length?'':v10Empty(meeting.n?'원장에 담당자가 적힌 미팅이 없습니다.':'이 주에 기록된 미팅이 없습니다.'));
 const today=v10Today();
 const rows=Array.from({length:count},(_,n)=>{const d=cwData(year,n+1),futureInq=d.range.start>today,futureMt=d.range.meetingStart>today;return [`<button class="easy-link ${n+1===week?'cw-selected':''}" data-cw-week="${n+1}">${n+1}주차</button>`,cwLabel(d.range.start,d.range.end),cwShow(d.totals?d.totals.total:null),futureInq?'—':cwShow(d.biz?d.biz.all.total:null),futureInq?'—':cwShow(d.biz?d.biz.active.total:null),cwLabel(d.range.meetingStart,d.range.meetingEnd),futureMt&&!d.meeting.n?'—':i(d.meeting.n)+'건',futureMt&&!d.meeting.n?'—':cwShow(d.meeting.cap,' kW')];});
 return easyLead('컨설팅 주간 실적',`${year}년 ${week}주차 · 문의와 미팅의 원본 보고 기간을 각각 확인합니다. 주차는 위 조회 바에서 바꿉니다.`,`${year}년 ${week}주차${week===cwThisWeek(year)?' · 이번 주':''}`)+summary
 +`<div class="cw-panels">${v10Panel('유입별 주간 문의',`${cwLabel(r.start,r.end)} · 월~금 · 전체 → 발전사업 → 진행 순으로 좁아집니다`,inquiryBody+`<p class="v10-note">전체 문의는 말 시트 주차 표(법인별), 발전사업 문의·진행은 ${year}년 문의 원장 접수일 기준. 막대 길이는 세 줄이 같은 눈금입니다.</p><a class="easy-link" href="${SALES_MEETING_SOURCE.inquiry}" target="_blank" rel="noopener">문의 원본 열기 ↗</a>`)}${v10Panel('주간 미팅 실적',`${cwLabel(r.meetingStart,r.meetingEnd)} · 금~목 · 전체와 담당자별, 마케팅·소개로 나눔`,meetingBody+`<p class="v10-note">미팅 원본: 주간 업무 진행사항 시트 월별 탭(${esc(sheet?.sheet||'26.MM')}) J~Q 주차 집계. 담당자별은 통계 시트 미팅 원장의 미팅날짜 기준이며 원장 집계는 ${i(meeting.ledger.n)}건 · ${cwShow(meeting.ledger.cap,' kW')}입니다.</p><a class="easy-link" href="https://docs.google.com/spreadsheets/d/1DkUE6SYR9uyS3TGzlRTq28yuGluYpnuF2yuyCt_2lx8/edit?gid=${sheet?.gid||1866167974}" target="_blank" rel="noopener">미팅 원본 열기 ↗</a>`)}</div>`
 +((CW.error||V10.payload?.weeklyMeetings?.errors?.length)?`<div class="v10-callout" role="status">미팅 자료 연결 확인 필요: ${esc(CW.error||V10.payload.weeklyMeetings.errors.join(' / '))}</div>`:'')
 +`<p class="v10-note">주차는 ISO 연간 주차를 사용합니다.${count===53?' '+year+'년은 달력상 53주차가 있어 연말 누락 없이 표시합니다.':''} 서로 다른 기간의 문의와 미팅으로 전환율을 계산하지 않습니다. 전체 문의는 말 시트 주차 표, 발전사업 문의는 문의 원장, 미팅은 주간 업무 진행사항 시트의 월별 탭에서 가져옵니다.</p>`
 +v10Panel('연간 주차별 비교','주차를 누르면 해당 주의 상세 자료로 이동합니다.',v10Table(['주차','문의 기간 (월~금)','전체 문의','발전사업 문의','발전사업 진행','미팅 기간 (금~목)','미팅 건수','미팅 용량'],rows))
 +`<p class="v10-note">미팅 자료 갱신: ${esc(V10.payload?.weeklyMeetings?.at?new Date(V10.payload.weeklyMeetings.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'연결 대기')}</p>`;
}
function cwLoad(){
 if(V10.payload?.weeklyMeetings||CW.loading||CW.error||typeof google==='undefined'||!google.script?.run)return;
 CW.loading=true;google.script.run.withSuccessHandler(d=>{CW.loading=false;V10.payload.weeklyMeetings=d;if(state.sect==='weekly')render();}).withFailureHandler(e=>{CW.loading=false;CW.error=String(e.message||e);if(state.sect==='weekly')render();}).collectWeeklyMeetingDataV10();
}
SECTIONS.push({k:'weekly',t:'주간 실적',g:'실적',basis:'exec'});
VIEWS.weekly=()=>{cwLoad();return cwView();};
EASY_MENU.find(x=>x.k==='summary').items.push(['weekly','주간 실적']);
if(state.sect==='overall')state.sect='weekly'; // the weekly view is the landing screen
const cwOriginalPeriod=renderPeriod;
// The week picker lives in the top toolbar, right after the year, so the period bar and the
// weekly view read as one control: 연간 주차 [select] → 이전 주 · 이번 주 · 다음 주.
function cwToolbarHTML(year){
 const week=cwSelected(year),count=cwWeekCount(year),today=cwThisWeek(year),range=cwRange(year,week);
 const options=Array.from({length:count},(_,n)=>{const w=cwRange(year,n+1);return `<option value="${n+1}" ${week===n+1?'selected':''}>${n+1}주차 · ${cwLabel(w.start,w.end)}${n+1===today?' · 이번 주':''}</option>`;}).join('');
 return `<label class="cw-pick">연간 주차<select id="consultingWeek" aria-label="연간 주차">${options}</select></label><div class="cw-nav" role="group" aria-label="주차 이동"><button class="btn cw-step" type="button" data-cw-step="-1" ${week===1?'disabled':''}>◀ 이전 주</button><button class="btn cw-now${week===today?' on':''}" type="button" data-cw-today ${week===today?'aria-current="true"':''}>이번 주</button><button class="btn cw-step" type="button" data-cw-step="1" ${week===count?'disabled':''}>다음 주 ▶</button></div><strong class="cw-current">${year}년 ${week}주차 <small>문의 ${cwLabel(range.start,range.end)} · 미팅 ${cwLabel(range.meetingStart,range.meetingEnd)}</small></strong>`;
}
renderPeriod=function(){cwOriginalPeriod();const weekly=state.sect==='weekly';document.body.classList.toggle('cw-weekly',weekly);
 const toolbar=document.querySelector('.easy-toolbar');let slot=document.getElementById('cwToolbarWeek');
 if(weekly&&toolbar){if(!slot){slot=document.createElement('div');slot.id='cwToolbarWeek';slot.className='cw-toolbar';const period=toolbar.querySelector('.easy-period');period?period.after(slot):toolbar.prepend(slot);}slot.innerHTML=cwToolbarHTML(Number(DB.year));}
 else slot?.remove?.();
 if(weekly){$('#easyPeriodNote').textContent=`${DB.year}년 · 연간 주차 조회 · 문의 월~금 / 미팅 금~목 · 부서 전체`;} };
const cwToolbar=document.querySelector('.easy-toolbar');
if(cwToolbar){const button=document.createElement('button');button.className='easy-preset cw-open';button.dataset.v10Section='weekly';button.textContent='주간 조회';cwToolbar.insertBefore(button,cwToolbar.firstChild);}
document.addEventListener('change',e=>{if(e.target.id==='consultingWeek'){CW.weeks[DB.year]=Number(e.target.value);store.set('v10_consultingWeeks',CW.weeks);render();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-cw-week],[data-cw-step],[data-cw-today]');if(!b)return;const year=Number(DB.year);if(b.hasAttribute('data-cw-today')){delete CW.weeks[year];}else CW.weeks[year]=Math.max(1,Math.min(cwWeekCount(year),b.dataset.cwWeek?Number(b.dataset.cwWeek):cwSelected(year)+Number(b.dataset.cwStep)));store.set('v10_consultingWeeks',CW.weeks);render();});
