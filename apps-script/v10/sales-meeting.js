/* Copy-ready weekly sales meeting report. Source Sheets stay read-only. */
const SALES_MEETING_SOURCE={
 inquiry:'https:'+'/'+'/docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit?gid=488428713#gid=488428713',
 meeting:'https:'+'/'+'/docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit?gid=843263122#gid=843263122'
};
const salesMeetingState={
 week:Number(store.get('v10_salesMeetingWeek',0))||0,
 reporter:txt(store.get('v10_salesMeetingReporter','김동호'))||'김동호',
 extra:txt(store.get('v10_salesMeetingExtra','한전수전합리화사업 - 0건 (제안1건)')),
 actions:txt(store.get('v10_salesMeetingActions',''))
};
const SM_COL={AB:27,AC:28,AD:29,AE:30,AF:31,AG:32,AH:33,AI:34,N:13,O:14,P:15,Q:16};
const smCell=(rows,r,c)=>txt(rows?.[r]?.[c]);
const smNumber=value=>{const t=txt(value);return t?`${v10Number(num(t))}`:'—';};
const smMetric=(rows,row)=>({label:smCell(rows,row,SM_COL.AC),values:[SM_COL.AD,SM_COL.AE,SM_COL.AF,SM_COL.AG,SM_COL.AH].map(c=>smCell(rows,row,c))});
function smMetricBlock(rows,row){
 const out=[];
 for(let r=row;r<Math.min(row+7,rows.length)&&out.length<3;r++){
  const metric=smMetric(rows,r);
  if(['전체 주간문의','발전사업 주간 문의','발전사업 주간 진행'].includes(metric.label))out.push(metric);
 }
 return out;
}
function smParseInquiryReport(rows){
 rows=Array.isArray(rows)?rows:[];
 let year=num(smCell(rows,0,SM_COL.AB)),month=num(smCell(rows,0,SM_COL.AC));
 const monthlyHead=rows.findIndex((_,r)=>/^\d{2}월\s*전체$/.test(smCell(rows,r,SM_COL.AB)));
 if(monthlyHead>=0&&!month)month=num(smCell(rows,monthlyHead,SM_COL.AB));
 if(!year){const hit=rows.slice(0,190).flat().map(txt).find(v=>/^20\d{2}년?$/.test(v));year=num(hit);}
 const monthly=monthlyHead>=0?smMetricBlock(rows,monthlyHead+1):[];
 const detailStarts=[];
 rows.slice(0,190).forEach((_,r)=>{
  const m=smCell(rows,r,SM_COL.AB).match(/^(20\d{2})년\s*(\d{1,2})월\s*(\d+)주\s*진행사항\s*\(([^)]+)\)/);
  if(m)detailStarts.push({row:r,year:Number(m[1]),month:Number(m[2]),week:Number(m[3]),period:m[4]});
 });
 const firstDetail=detailStarts[0]?.row??190,weekly=[];
 for(let r=Math.max(0,monthlyHead+1);r<Math.min(firstDetail,rows.length);r++){
  const raw=smCell(rows,r,SM_COL.AB),m=raw.match(/^(\d+)주차\s*([\s\S]*)$/);
  if(!m||smCell(rows,r,SM_COL.AC)!=='전체 주간문의')continue;
  weekly.push({week:Number(m[1]),period:txt(m[2]).replace(/^\s+/,''),metrics:smMetricBlock(rows,r)});
 }
 const details=detailStarts.map((head,index)=>{
  const end=detailStarts[index+1]?.row??Math.min(rows.length,190),days=[];
  let total=[],top=[];
  for(let r=head.row+1;r<end;r++){
   const day=smCell(rows,r,SM_COL.AB);
   if(/^\d{2}-\d{2}$/.test(day)&&smCell(rows,r,SM_COL.AC)==='전체 주간문의')days.push({day,metrics:smMetricBlock(rows,r)});
   if(day==='주간전체'&&smCell(rows,r,SM_COL.AC)==='전체 주간문의')total=smMetricBlock(rows,r);
   if(/문의\s*TOP\s*3/.test(day))top=[SM_COL.AB,SM_COL.AD,SM_COL.AF,SM_COL.AH].map(c=>({source:smCell(rows,r,c).replace(/\s*문의\s*TOP\s*3.*/,''),items:[1,2,3].map(offset=>({label:smCell(rows,r+offset,c),value:smCell(rows,r+offset,c+1)})).filter(x=>x.label)}));
  }
  const overview=weekly.find(w=>w.week===head.week);
  return {...head,period:head.period||overview?.period||'',days,total:total.length?total:(overview?.metrics||[]),top};
 });
 return {year,month,monthly,weekly,details,ready:monthly.length>0||weekly.length>0||details.length>0};
}
function smCountMap(entries,getter){
 const map=new Map();
 entries.forEach(entry=>{const key=getter(entry);if(key)map.set(key,(map.get(key)||0)+1);});
 return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko'));
}
function smEntrySource(text){return ['그랜드썬','SP','유지에스','소개'].find(x=>text.includes(`_${x}_`))||'기타';}
function smEntrySite(text){return ['공장','창고','근생','주거','축사','재배사','주차장','토지'].find(x=>text.includes(`_${x}_`))||'기타';}
function smEntryRelation(text){return ['대표','직원','협력사','건물주','가족','지인'].find(x=>text.includes(`_${x}_`))||'기타';}
function smEntryStatus(text){return text.includes('_미팅가망_')?'미팅가망':/\d{4}\/\d{1,2}\/\d{1,2}/.test(text)?'미팅확정':'확인 필요';}
function smEntryBranch(text){
 const region=['서울','경기','인천','강원','충북','충남','대전','세종','부산','대구','울산','경북','경남','광주','전북','전남','제주'].find(x=>text.includes(`_${x}_`));
 return ['서울','경기','인천','강원','충북','충남','대전','세종'].includes(region)?'안성지사':region?'부산지사':'기타';
}
function smParseMeetingReport(rows){
 rows=Array.isArray(rows)?rows:[];
 const year=num(smCell(rows,1,SM_COL.N)),week=num(smCell(rows,1,SM_COL.O)),period=smCell(rows,1,SM_COL.P),stated=num(smCell(rows,0,SM_COL.Q));
 let current='';
 for(let r=0;r<Math.min(rows.length,6)&&!current;r++)for(let c=SM_COL.N;c<=30;c++){const v=smCell(rows,r,c);if(/이번주는\s*\d+\s*주차/.test(v)){current=v;break;}}
 const entries=[];
 for(let r=0;r<rows.length;r++){
  const no=smCell(rows,r,SM_COL.N),text=smCell(rows,r,SM_COL.O);
  if(/^\d+\.$/.test(no)&&text)entries.push({no:num(no),text});
 }
 return {year,week,period,current,count:stated||entries.length,entries,summary:{source:smCountMap(entries,e=>smEntrySource(e.text)),branch:smCountMap(entries,e=>smEntryBranch(e.text)),site:smCountMap(entries,e=>smEntrySite(e.text)),relation:smCountMap(entries,e=>smEntryRelation(e.text)),status:smCountMap(entries,e=>smEntryStatus(e.text))},ready:entries.length>0};
}
function smMetricsTable(rows,firstHeader='구분'){
 return `<div class="v10-table sales-table"><table><thead><tr>${[firstHeader,'그랜드썬','SP','유지에스','소개','합계'].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th>${esc(r.label)}</th>${r.values.map(v=>`<td>${esc(smNumber(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function smWeeklyOverview(report){
 return `<div class="v10-table sales-table sales-week-overview"><table><thead><tr>${['주차 · 기간','구분','그랜드썬','SP','유지에스','소개','합계'].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${report.weekly.map(w=>w.metrics.map((r,j)=>`<tr>${j===0?`<th rowspan="${w.metrics.length}">${w.week}주차<small>${esc(w.period)}</small></th>`:''}<th>${esc(r.label)}</th>${r.values.map(v=>`<td>${esc(smNumber(v))}</td>`).join('')}</tr>`).join('')).join('')}</tbody></table></div>`;
}
function smTopThree(detail){
 if(!detail?.top?.length)return '<p class="sales-empty">유입별 TOP 3 자료가 없습니다.</p>';
 return `<div class="sales-top-grid">${detail.top.map(group=>`<article><h4>${esc(group.source)} 문의 TOP 3</h4><ol>${group.items.map(item=>`<li><span>${esc(item.label)}</span><b>${esc(smNumber(item.value))}건</b></li>`).join('')}</ol></article>`).join('')}</div>`;
}
function smDailyTable(detail){
 if(!detail?.days?.length)return '<p class="sales-empty">선택 주의 일자별 자료가 없습니다.</p>';
 return `<div class="v10-table sales-table sales-day-table"><table><thead><tr>${['일자','구분','그랜드썬','SP','유지에스','소개','합계'].map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${detail.days.map(day=>day.metrics.map((r,j)=>`<tr>${j===0?`<th rowspan="${day.metrics.length}">${esc(day.day)}</th>`:''}<th>${esc(r.label)}</th>${r.values.map(v=>`<td>${esc(smNumber(v))}</td>`).join('')}</tr>`).join('')).join('')}${detail.total.map((r,j)=>`<tr class="sales-total">${j===0?`<th rowspan="${detail.total.length}">주간전체</th>`:''}<th>${esc(r.label)}</th>${r.values.map(v=>`<td>${esc(smNumber(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function smSummaryTable(title,rows){return `<article><h4>${esc(title)}</h4><table><tbody>${rows.map(([name,value])=>`<tr><th>${esc(name)}</th><td>${i(value)}건</td></tr>`).join('')||'<tr><td>자료 없음</td></tr>'}</tbody></table></article>`;}
function smMeetingSection(report){
 if(!report.ready)return `<section id="salesMeetingCopy" class="sales-report-card sales-copy-section"><h3>이번 주 사업주 미팅</h3><p class="sales-empty">미팅26 시트의 N1:AE70 자료를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p></section>`;
 return `<section id="salesMeetingCopy" class="sales-report-card sales-copy-section"><header><div><p class="sales-kicker">${esc(report.year)}년 ${i(report.week)}주차</p><h3>이번 주 사업주 미팅</h3><p>${esc(report.period)} · 총 ${i(report.count)}건${report.current?` · ${esc(report.current)}`:''}</p></div><strong>${i(report.count)}건</strong></header><div class="sales-summary-grid">${smSummaryTable('유입별',report.summary.source)}${smSummaryTable('지역 담당',report.summary.branch)}${smSummaryTable('설치장소',report.summary.site)}${smSummaryTable('문의 관계',report.summary.relation)}${smSummaryTable('미팅 상태',report.summary.status)}</div><div class="v10-table sales-table sales-meeting-list"><table><thead><tr><th>번호</th><th>영업회의 미팅 내용</th></tr></thead><tbody>${report.entries.map(entry=>`<tr><td>${i(entry.no)}</td><td class="left">${esc(entry.text)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
const SM_MINUTE_SOURCES=[
 {name:'그랜드썬',index:0,cls:'gs'},
 {name:'SP',index:1,cls:'sp'},
 {name:'유지에스',index:2,cls:'ugs'},
 {name:'소개',index:3,cls:'ref'}
];
function smMinuteSources(detail){
 return SM_MINUTE_SOURCES.filter(source=>source.name!=='유지에스'||detail.total.some(row=>num(row.values[source.index])!==0)||(detail.top.find(group=>group.source===source.name)?.items||[]).some(item=>num(item.value)!==0));
}
function smMinuteInquiryTable(detail,sources){
 const rowClass=label=>label==='전체 주간문의'?'minutes-row-total':label==='발전사업 주간 문의'?'minutes-row-business':'minutes-row-progress';
 return `<div class="minutes-table-wrap"><table class="minutes-inquiry-table"><thead><tr><th></th>${sources.map(source=>`<th class="minutes-source-${source.cls}">${esc(source.name)}</th>`).join('')}<th class="minutes-source-sum">합계</th></tr></thead><tbody>${detail.total.map(row=>`<tr class="${rowClass(row.label)}"><th>${esc(row.label)}</th>${sources.map(source=>`<td>${esc(smNumber(row.values[source.index]))}</td>`).join('')}<td>${esc(smNumber(row.values[4]))}</td></tr>`).join('')}</tbody></table></div>`;
}
function smMinuteTopTable(detail,sources){
 const groups=sources.map(source=>({source,group:detail.top.find(group=>group.source===source.name)||{items:[]}}));
 return `<div class="minutes-table-wrap"><table class="minutes-top-table"><thead><tr><th>순위</th>${groups.map(({source})=>`<th colspan="2" class="minutes-source-${source.cls}">${esc(source.name)} 문의 TOP 3</th>`).join('')}</tr></thead><tbody>${[0,1,2].map(index=>`<tr><th>${index+1}위</th>${groups.map(({group})=>{const item=group.items[index];return `<td>${esc(item?.label||'—')}</td><td class="minutes-count">${item?esc(smNumber(item.value)):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function smMinuteEntryParts(value){
 const chunks=txt(value).split('_').filter(Boolean);
 if(!chunks.length)return {main:'',note:''};
 let note='',tail=chunks[chunks.length-1],slash=tail.split(/\s*\/\s*/);
 if(slash.length>1){chunks[chunks.length-1]=slash.shift();note=slash.join(' / ');}
 else if(tail.length>=18&&/[가-힣]/.test(tail)){note=chunks.pop();}
 return {main:chunks.join('_'),note};
}
function smMinuteSummaryLine(label,rows){
 return `<li><b>${esc(label)}</b> - ${rows.map(([name,value])=>`${esc(name)} ${i(value)}건`).join(', ')||'자료 없음'}</li>`;
}
function smMinutesReport(inquiry,detail,meeting){
 if(!detail||!meeting.ready)return `<section id="salesMinutesCopy" class="sales-minutes-report"><p class="sales-empty">회의록 형식에 필요한 주차별 문의 또는 미팅 자료가 없습니다.</p></section>`;
 const sources=smMinuteSources(detail),entries=meeting.entries.map(entry=>({no:entry.no,...smMinuteEntryParts(entry.text)}));
 const extra=salesMeetingState.extra?`<p class="minutes-extra">※${esc(salesMeetingState.extra)}</p>`:'';
 const actions=salesMeetingState.actions?`<h3>4. 후속 조치</h3><div class="minutes-actions">${esc(salesMeetingState.actions).replace(/\n/g,'<br>')}</div>`:'';
 return `<section id="salesMinutesCopy" class="sales-minutes-report"><h2 class="minutes-report-title"><span>■</span>컨설팅-${esc(salesMeetingState.reporter)}</h2><div class="minutes-report-box"><div class="minutes-box-title">* 컨설팅 내용</div><h3>1. 유입별 문의건수 <span>[ ${i(inquiry.month)}월 ${i(detail.week)}주 진행사항 (${esc(detail.period)}) ]</span></h3>${smMinuteInquiryTable(detail,sources)}<h3>2. 사업형태별 문의건수</h3>${smMinuteTopTable(detail,sources)}${extra}<h3>3. 미팅가망 및 특이사항</h3><ol class="minutes-meeting-list">${entries.map(entry=>`<li><span>${esc(entry.main)}</span>${entry.note?`<strong>${esc(entry.note)}</strong>`:''}</li>`).join('')}</ol><ul class="minutes-summary">${smMinuteSummaryLine('유입별 미팅가망',meeting.summary.source)}${smMinuteSummaryLine('지역별 대응예정',meeting.summary.branch)}${smMinuteSummaryLine('문의',meeting.summary.relation)}${smMinuteSummaryLine('설치장소',meeting.summary.site)}${smMinuteSummaryLine('미팅가망 및 확정',meeting.summary.status)}</ul>${actions}</div></section>`;
}
function easySalesMeeting(){
 const inquiry=smParseInquiryReport(V10.payload?.tongye),meeting=smParseMeetingReport(V10.payload?.meeting26),detailWeeks=inquiry.details.map(x=>x.week),week=detailWeeks.includes(salesMeetingState.week)?salesMeetingState.week:(detailWeeks.at(-1)||0),detail=inquiry.details.find(x=>x.week===week);
 salesMeetingState.week=week;
 const inquirySection=inquiry.ready?`<section id="salesInquiryCopy" class="sales-report-card sales-copy-section"><header><div><p class="sales-kicker">${esc(inquiry.year)}년 ${i(inquiry.month)}월 원본 집계</p><h3>월간 · 주차별 문의 현황</h3><p>월 전체는 달력월, 주차 합계는 보고 주차 기준이라 서로 다를 수 있습니다.</p></div><strong>${i(inquiry.month)}월</strong></header><h4 class="sales-subtitle">월 전체 문의</h4>${smMetricsTable(inquiry.monthly)}<p class="sales-note">합계는 원본 통계 시트의 값을 그대로 표시합니다.</p><h4 class="sales-subtitle">주차별 문의</h4>${smWeeklyOverview(inquiry)}${detail?`<div class="sales-detail-head"><div><h4>${detail.week}주차 일자별 문의</h4><p>${esc(detail.period)}</p></div><label>상세 주차<select id="salesMeetingWeek">${inquiry.details.map(x=>`<option value="${x.week}" ${x.week===detail.week?'selected':''}>${x.week}주차 · ${esc(x.period)}</option>`).join('')}</select></label></div>${smDailyTable(detail)}${smTopThree(detail)}`:''}</section>`:`<section id="salesInquiryCopy" class="sales-report-card sales-copy-section"><h3>월간 · 주차별 문의 현황</h3><p class="sales-empty">통계 시트의 AB1:AI190 자료를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p></section>`;
 const sourcePeriods=[inquiry.ready?`문의 ${esc(inquiry.year)}년 ${i(inquiry.month)}월`:'문의 자료 대기',meeting.ready?`미팅 ${esc(meeting.year)}년 ${i(meeting.week)}주차`:'미팅 자료 대기'].join(' · ');
 return easyLead('영업회의 자료','회의록 1페이지 형식과 원본 상세표를 한글에 바로 붙여넣을 수 있습니다.',sourcePeriods)+`<div class="sales-minutes-controls"><label>보고자명<input id="salesMeetingReporter" maxlength="20" value="${esc(salesMeetingState.reporter)}"></label><label>별도 사업 메모<input id="salesMeetingExtra" maxlength="100" value="${esc(salesMeetingState.extra)}" placeholder="예: 한전수전합리화사업 - 0건 (제안1건)"></label><label class="sales-actions-field">후속 조치 · 담당/기한<textarea id="salesMeetingActions" maxlength="500" rows="2" placeholder="선택 입력 · 예: 김동호 / 10월 16일 / 제안서 발송">${esc(salesMeetingState.actions)}</textarea></label></div><div class="sales-copy-toolbar"><button class="btn primary" data-sales-copy="minutes">회의록 형식 복사</button><button class="btn" data-sales-copy="all">원본 상세 전체 복사</button><button class="btn" data-sales-copy="inquiry">문의표만 복사</button><button class="btn" data-sales-copy="meeting">미팅표만 복사</button><a class="btn" href="${SALES_MEETING_SOURCE.inquiry}" target="_blank" rel="noopener">문의 원본 열기</a><a class="btn" href="${SALES_MEETING_SOURCE.meeting}" target="_blank" rel="noopener">미팅 원본 열기</a><span id="salesCopyStatus" role="status"></span></div><div class="v10-callout sales-basis"><b>권장 보고 순서</b> 주간 문의 → 문의 TOP 3 → 미팅가망·특이사항 → 후속 조치 순으로 보고합니다. 보고자명과 메모를 수정하면 회의록 미리보기와 복사본에 바로 반영됩니다.</div>${smMinutesReport(inquiry,detail,meeting)}<details class="sales-source-details"><summary>원본 상세자료 펼치기</summary><div class="v10-callout sales-basis"><b>집계 기준</b> 문의 자료와 미팅 자료는 각 원본 시트에 적힌 기간을 그대로 표시합니다. 대시보드 상단의 월 선택과 달라도 영업회의 자료의 기준은 바뀌지 않습니다.</div><div id="salesMeetingCopyRoot" class="sales-copy-root">${inquirySection}${smMeetingSection(meeting)}</div></details>`;
}
function smPrepareClipboard(root){
 const clone=root.cloneNode(true);
 clone.querySelectorAll('select,label,.sales-note').forEach(node=>node.remove());
 clone.querySelectorAll('section').forEach(node=>node.setAttribute('style','margin:0 0 22px;padding:18px;border:1px solid #b9c5d6;border-radius:8px;font-family:Malgun Gothic,Arial,sans-serif;color:#14243a;background:#fff;'));
 clone.querySelectorAll('h3').forEach(node=>node.setAttribute('style','margin:0 0 8px;font-size:20px;'));
 clone.querySelectorAll('h4').forEach(node=>node.setAttribute('style','margin:16px 0 7px;font-size:16px;'));
 clone.querySelectorAll('table').forEach(node=>node.setAttribute('style','width:100%;border-collapse:collapse;table-layout:auto;margin:8px 0;font-size:13px;'));
 clone.querySelectorAll('th,td').forEach(node=>node.setAttribute('style','border:1px solid #8898ac;padding:7px 9px;text-align:center;vertical-align:middle;'));
 clone.querySelectorAll('th').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#eaf0f8;font-weight:700;'));
 clone.querySelectorAll('td.left').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'text-align:left;'));
 clone.querySelectorAll('.minutes-report-title').forEach(node=>node.setAttribute('style','margin:0 0 8px;font-size:17px;font-weight:800;color:#111;'));
 clone.querySelectorAll('.minutes-report-box').forEach(node=>node.setAttribute('style','border:1px solid #111;padding:0 8px 10px;color:#111;background:#fff;font-family:Malgun Gothic,Arial,sans-serif;'));
 clone.querySelectorAll('.minutes-box-title').forEach(node=>node.setAttribute('style','margin:0 -8px 8px;padding:3px 7px;border-bottom:1px dotted #444;font-size:13px;font-weight:800;'));
 clone.querySelectorAll('.sales-minutes-report h3').forEach(node=>node.setAttribute('style','margin:9px 0 4px;font-size:13px;font-weight:800;'));
 clone.querySelectorAll('.sales-minutes-report table').forEach(node=>node.setAttribute('style','width:100%;border-collapse:collapse;table-layout:fixed;margin:3px 0;font-size:11px;'));
 clone.querySelectorAll('.sales-minutes-report th,.sales-minutes-report td').forEach(node=>node.setAttribute('style','border:1px solid #111;padding:3px 4px;text-align:center;vertical-align:middle;'));
 clone.querySelectorAll('.minutes-source-gs').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#cdddf4;'));
 clone.querySelectorAll('.minutes-source-sp').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#d9a3dc;'));
 clone.querySelectorAll('.minutes-source-ugs').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#fff0bd;'));
 clone.querySelectorAll('.minutes-source-ref').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#f5dcc4;'));
 clone.querySelectorAll('.minutes-source-sum').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#d6e8d1;'));
 clone.querySelectorAll('.minutes-row-total th').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#00ef21;'));
 clone.querySelectorAll('.minutes-row-business th').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'background:#fff200;'));
 clone.querySelectorAll('.minutes-row-business td,.minutes-count').forEach(node=>node.setAttribute('style',node.getAttribute('style')+'color:#d7191c;font-weight:800;'));
 clone.querySelectorAll('.minutes-meeting-list').forEach(node=>node.setAttribute('style','margin:2px 0 8px;padding-left:24px;font-size:11px;line-height:1.3;'));
 clone.querySelectorAll('.minutes-meeting-list strong').forEach(node=>node.setAttribute('style','display:block;color:#d7191c;font-weight:800;'));
 clone.querySelectorAll('.minutes-summary').forEach(node=>node.setAttribute('style','margin:8px 0 0;padding-left:18px;font-size:11px;line-height:1.35;'));
 clone.querySelectorAll('.minutes-extra,.minutes-actions').forEach(node=>node.setAttribute('style','margin:5px 0;font-size:11px;line-height:1.35;'));
 return clone;
}
async function smCopyReport(kind){
 const selector=kind==='minutes'?'#salesMinutesCopy':kind==='inquiry'?'#salesInquiryCopy':kind==='meeting'?'#salesMeetingCopy':'#salesMeetingCopyRoot',root=document.querySelector(selector),status=$('#salesCopyStatus');
 if(!root)return;
 const clone=smPrepareClipboard(root),plain=(clone.innerText||clone.textContent||'').replace(/\n{3,}/g,'\n\n').trim(),html=`<div style="font-family:'Malgun Gothic',Arial,sans-serif;color:#14243a">${clone.innerHTML}</div>`;
 try{
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined')await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
  else await navigator.clipboard.writeText(plain);
  if(status)status.textContent='복사했습니다. 한글에서 Ctrl+V로 붙여넣으세요.';
 }catch(err){if(status)status.textContent='브라우저가 복사를 막았습니다. 다시 한 번 눌러 주세요.';}
}
if(!SECTIONS.some(s=>s.k==='salesMeeting'))SECTIONS.push({k:'salesMeeting',t:'영업회의 자료',g:'보고',basis:'exec'});
if(!EASY_NAV.some(s=>s.k==='salesMeeting'))EASY_NAV.push({k:'salesMeeting',label:'영업회의 자료',sub:'한글 보고서에 바로 복사'});
Object.assign(VIEWS,{salesMeeting:easySalesMeeting});
document.addEventListener('change',event=>{
 if(event.target.id==='salesMeetingWeek'){salesMeetingState.week=Number(event.target.value);store.set('v10_salesMeetingWeek',salesMeetingState.week);render();return;}
 const setting={salesMeetingReporter:['reporter','v10_salesMeetingReporter'],salesMeetingExtra:['extra','v10_salesMeetingExtra'],salesMeetingActions:['actions','v10_salesMeetingActions']}[event.target.id];
 if(!setting)return;salesMeetingState[setting[0]]=txt(event.target.value);store.set(setting[1],salesMeetingState[setting[0]]);render();
});
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-sales-copy]');if(button)smCopyReport(button.dataset.salesCopy);});
