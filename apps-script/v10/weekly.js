/* Calendar weeks connect two independently dated source reports. */
const CW={weeks:store.get('v10_consultingWeeks',{}),loading:false,error:''};
const cwISO=d=>d.toISOString().slice(0,10);
const cwShift=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return cwISO(d);};
function cwWeekOne(year){const d=new Date(Date.UTC(year,0,4));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return cwISO(d);}
function cwWeekCount(year){return Math.round((Date.parse(cwWeekOne(year+1))-Date.parse(cwWeekOne(year)))/604800000);}
function cwRange(year,week){const start=cwShift(cwWeekOne(year),(week-1)*7);return {year,week,start,end:cwShift(start,4),meetingStart:cwShift(start,-3),meetingEnd:cwShift(start,3)};}
function cwSelected(year){const saved=Number(CW.weeks[year]);if(saved>=1&&saved<=cwWeekCount(year))return saved;return Math.max(1,Math.min(cwWeekCount(year),1+Math.floor((Date.parse(v10Today())-Date.parse(cwWeekOne(year)))/604800000)));}
function cwPeriod(raw,year,month){
 const m=String(raw||'').match(/(\d{1,2})[\/-](\d{1,2})\s*[~～–—-]\s*(\d{1,2})[\/-](\d{1,2})/);if(!m)return null;
 const sm=Number(m[1]),em=Number(m[3]);let sy=year;if(month===1&&sm===12)sy--;if(month===12&&sm===1)sy++;
 const start=`${sy}-${String(sm).padStart(2,'0')}-${m[2].padStart(2,'0')}`,end=`${sy+(em<sm?1:0)}-${String(em).padStart(2,'0')}-${m[4].padStart(2,'0')}`;
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||cwISO(new Date(start+'T00:00:00Z'))!==start||cwISO(new Date(end+'T00:00:00Z'))!==end)return null;
 return {start,end};
}
const cwValue=v=>txt(v)===''?null:num(v);
function cwInquiryRows(payload){
 const report=smParseInquiryReport(payload?.tongye);
 return report.weekly.map(w=>({...w,...cwPeriod(w.period,report.year,report.month),year:report.year,month:report.month})).filter(w=>w.start&&new Date(w.start+'T00:00:00Z').getUTCDay()===1&&cwShift(w.start,4)===w.end);
}
function cwMeetingRows(payload){
 const found=new Map();
 for(const sh of payload?.weeklyMeetings?.sheets||[]){
  const name=sh.sheet.match(/^(\d{2})\.(\d{2})$/);if(!name)continue;
  const year=sh.year||2000+Number(name[1]),month=sh.month||Number(name[2]);
  const header=(sh.rows||[]).find(row=>txt(row[0])==='날짜')||[];
  const hasMarketingCapacity=/마케팅.*미팅.*용량/.test(txt(header[4])),hasMarketingCount=/마케팅.*미팅.*건수/.test(txt(header[5]));
  for(const row of sh.rows||[]){
   if(!/^\d+주차$/.test(txt(row[1])))continue;
   const dates=cwPeriod(row[0],year,month);if(!dates||new Date(dates.start+'T00:00:00Z').getUTCDay()!==5||cwShift(dates.start,6)!==dates.end)continue;
   const item={...dates,sheet:sh.sheet,gid:sh.gid,period:txt(row[0]),week:txt(row[1]),capacity:cwValue(row[2]),count:cwValue(row[3]),marketingCapacity:hasMarketingCapacity?cwValue(row[4]):null,marketingCount:hasMarketingCount?cwValue(row[5]):null};
   // A week repeated at a month boundary must not be counted twice.
   if(!found.has(item.start)||item.count!==null)found.set(item.start,item);
  }
 }
 return [...found.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
function cwData(year,week){
 const range=cwRange(year,week),inquiry=cwInquiryRows(V10.payload).find(r=>r.start===range.start&&r.end===range.end),meeting=cwMeetingRows(V10.payload).find(r=>r.start===range.meetingStart&&r.end===range.meetingEnd);
 return {range,inquiry,meeting};
}
const cwLabel=(a,b)=>`${a.slice(5).replace('-','/')} ~ ${b.slice(5).replace('-','/')}`;
const cwMetric=(inquiry,index)=>cwValue(inquiry?.metrics?.[index]?.values?.[4]);
const cwShow=(value,unit='건')=>value===null||value===undefined?'—':`${Number(value).toLocaleString('ko-KR',{maximumFractionDigits:3})}${unit}`;
function cwCard(label,value,note,color){return `<article class="v10-kpi" style="--metric:${color}"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;}
function cwView(){
 const year=Number(DB.year),week=cwSelected(year),{range:r,inquiry,meeting}=cwData(year,week),count=cwWeekCount(year);
 const source=smParseInquiryReport(V10.payload?.tongye),available=cwInquiryRows(V10.payload),meetingRows=cwMeetingRows(V10.payload);
 const selector=`<div class="cw-controls"><button class="btn" data-cw-step="-1" ${week===1?'disabled':''}>이전 주</button><label>연간 주차<select id="consultingWeek" aria-label="연간 주차">${Array.from({length:count},(_,n)=>{const w=cwRange(year,n+1);return `<option value="${n+1}" ${week===n+1?'selected':''}>${n+1}주차 · ${cwLabel(w.start,w.end)}</option>`;}).join('')}</select></label><button class="btn" data-cw-step="1" ${week===count?'disabled':''}>다음 주</button><button class="btn" data-cw-today>이번 주</button><strong>${year}년 ${week}주차</strong></div>`;
 const periods=`<div class="cw-periods"><div><span>문의 · 월요일~금요일</span><b>${cwLabel(r.start,r.end)}</b></div><div><span>미팅 · 금요일~목요일</span><b>${cwLabel(r.meetingStart,r.meetingEnd)}</b></div></div>`;
 const inquiryBody=inquiry?smMetricsTable(inquiry.metrics):v10Empty('이 주의 문의 원본 자료가 연결되지 않았습니다.');
 const meetingBody=meeting?v10Table(['구분','미팅 건수','미팅 용량'],[['전체',cwShow(meeting.count),cwShow(meeting.capacity,' kW')],['마케팅',cwShow(meeting.marketingCount),cwShow(meeting.marketingCapacity,' kW')]]):v10Empty(CW.loading?'미팅 원본을 불러오는 중입니다.':'이 주의 미팅 원본 자료가 연결되지 않았습니다.');
 const rows=Array.from({length:count},(_,n)=>{const w=cwRange(year,n+1),a=available.find(x=>x.start===w.start),b=meetingRows.find(x=>x.start===w.meetingStart);return [`<button class="easy-link ${n+1===week?'cw-selected':''}" data-cw-week="${n+1}">${n+1}주차</button>`,cwLabel(w.start,w.end),cwShow(cwMetric(a,0)),cwShow(cwMetric(a,1)),cwLabel(w.meetingStart,w.meetingEnd),cwShow(b?.count),cwShow(b?.capacity,' kW')];});
 return easyLead('컨설팅 주간 실적','문의와 미팅의 원본 보고 기간을 각각 확인합니다.','주간 · 부서 전체')+selector+periods
 +`<div class="v10-kpis">${cwCard('전체 주간 문의',cwShow(cwMetric(inquiry,0)),'월~금 · 원본 합계',V10.colors[0])}${cwCard('발전사업 주간 문의',cwShow(cwMetric(inquiry,1)),'월~금 · 원본 합계',V10.colors[1])}${cwCard('보고 미팅 건수',cwShow(meeting?.count),'금~목 · 원본 보고 미팅',V10.colors[3])}${cwCard('보고 미팅 용량',cwShow(meeting?.capacity,' kW'),'금~목 · 원본 합계',V10.colors[4])}</div>`
 +`<div class="cw-panels">${v10Panel('유입별 주간 문의',`${cwLabel(r.start,r.end)} · 월~금`,inquiryBody+`<p class="v10-note">문의 원본: 통계 AB~AH · 현재 ${source.year||'—'}년 ${source.month||'—'}월 표가 연결되어 있습니다. 빈칸은 —, 원본의 0은 0으로 표시합니다.</p><a class="easy-link" href="${SALES_MEETING_SOURCE.inquiry}" target="_blank" rel="noopener">문의 원본 열기 ↗</a>`)}${v10Panel('주간 미팅 실적',`${cwLabel(r.meetingStart,r.meetingEnd)} · 금~목`,meetingBody+`<p class="v10-note">미팅 원본: ${esc(meeting?.sheet||'월별 시트')} J~O. 예정 미팅이 포함된 경우 원본 집계 그대로 표시합니다.</p><a class="easy-link" href="https://docs.google.com/spreadsheets/d/1DkUE6SYR9uyS3TGzlRTq28yuGluYpnuF2yuyCt_2lx8/edit?gid=${meeting?.gid||1866167974}" target="_blank" rel="noopener">미팅 원본 열기 ↗</a>`)}</div>`
 +((CW.error||V10.payload?.weeklyMeetings?.errors?.length)?`<div class="v10-callout" role="status">미팅 자료 연결 확인 필요: ${esc(CW.error||V10.payload.weeklyMeetings.errors.join(' / '))}</div>`:'')
 +`<p class="v10-note">주차는 ISO 연간 주차를 사용합니다.${count===53?' '+year+'년은 달력상 53주차가 있어 연말 누락 없이 표시합니다.':''} 서로 다른 기간의 문의와 미팅으로 전환율을 계산하지 않습니다. 문의 과거 주차는 원본에 확인된 자료만 표시합니다.</p>`
 +v10Panel('연간 주차별 비교','주차를 누르면 해당 주의 상세 자료로 이동합니다.',v10Table(['주차','문의 기간 (월~금)','전체 문의','발전사업 문의','미팅 기간 (금~목)','미팅 건수','미팅 용량'],rows))
 +`<p class="v10-note">미팅 자료 갱신: ${esc(V10.payload?.weeklyMeetings?.at?new Date(V10.payload.weeklyMeetings.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'연결 대기')}</p>`;
}
function cwLoad(){
 if(V10.payload?.weeklyMeetings||CW.loading||CW.error||typeof google==='undefined'||!google.script?.run)return;
 CW.loading=true;google.script.run.withSuccessHandler(d=>{CW.loading=false;V10.payload.weeklyMeetings=d;if(state.sect==='weekly')render();}).withFailureHandler(e=>{CW.loading=false;CW.error=String(e.message||e);if(state.sect==='weekly')render();}).collectWeeklyMeetingDataV10();
}
SECTIONS.push({k:'weekly',t:'주간 실적',g:'실적',basis:'exec'});
VIEWS.weekly=()=>{cwLoad();return cwView();};
EASY_MENU.find(x=>x.k==='summary').items.push(['weekly','주간 실적']);
const cwOriginalPeriod=renderPeriod;
renderPeriod=function(){cwOriginalPeriod();document.body.classList.toggle('cw-weekly',state.sect==='weekly');if(state.sect==='weekly'){$('#easyPeriodNote').textContent=`${DB.year}년 · 연간 주차 조회 · 문의 월~금 / 미팅 금~목 · 부서 전체`;} };
const cwToolbar=document.querySelector('.easy-toolbar');
if(cwToolbar){const button=document.createElement('button');button.className='easy-preset cw-open';button.dataset.v10Section='weekly';button.textContent='주간 조회';cwToolbar.insertBefore(button,cwToolbar.firstChild);}
document.addEventListener('change',e=>{if(e.target.id==='consultingWeek'){CW.weeks[DB.year]=Number(e.target.value);store.set('v10_consultingWeeks',CW.weeks);render();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-cw-week],[data-cw-step],[data-cw-today]');if(!b)return;const year=Number(DB.year);if(b.hasAttribute('data-cw-today')){delete CW.weeks[year];}else CW.weeks[year]=Math.max(1,Math.min(cwWeekCount(year),b.dataset.cwWeek?Number(b.dataset.cwWeek):cwSelected(year)+Number(b.dataset.cwStep)));store.set('v10_consultingWeeks',CW.weeks);render();});
