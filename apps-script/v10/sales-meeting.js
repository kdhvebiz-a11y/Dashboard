/* Copy-ready weekly sales meeting report. Source Sheets stay read-only. */
const SALES_MEETING_SOURCE={
 inquiry:'https:'+'/'+'/docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit?gid=488428713#gid=488428713',
 meeting:'https:'+'/'+'/docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit?gid=843263122#gid=843263122'
};
const salesMeetingState={
 detailKey:txt(store.get('v10_salesMeetingDetailKey','')),
 week:Number(store.get('v10_salesMeetingWeek',0))||0,
 reporter:txt(store.get('v10_salesMeetingReporter','김동호'))||'김동호',
 extra:txt(store.get('v10_salesMeetingExtra','한전수전합리화사업 - 0건 (제안1건)')),
 actions:txt(store.get('v10_salesMeetingActions','')),
 target:'' // 보고 주차를 가리키는 날짜(ISO). 비면 '오늘 기준 지난 월~금 주'.
};
const SM_COL={AB:27,AC:28,AD:29,AE:30,AF:31,AG:32,AH:33,AI:34,N:13,O:14,P:15,Q:16};
const smCell=(rows,r,c)=>txt(rows?.[r]?.[c]);
const smNumber=value=>{const t=txt(value);return t?`${v10Number(num(t))}`:'—';};
const smDatePad=value=>String(value).padStart(2,'0');
function smPeriodBounds(value,year,monthHint){
 const parts=[...txt(value).matchAll(/(?:(20\d{2})[\/.\-])?(\d{1,2})[\/.\-](\d{1,2})/g)].map(match=>({year:num(match[1]),month:num(match[2]),day:num(match[3])}));
 if(parts.length<2)return null;
 let startYear=parts[0].year||num(year),endYear=parts[1].year||startYear;
 if(!startYear)return null;
 if(!parts[0].year&&monthHint&&parts[0].month+6<num(monthHint))startYear++;
 if(!parts[1].year&&parts[1].month<parts[0].month)endYear=startYear+1;else if(!parts[1].year)endYear=startYear;
 const iso=partYear=>part=>`${partYear}-${smDatePad(part.month)}-${smDatePad(part.day)}`;
 return {start:iso(startYear)(parts[0]),end:iso(endYear)(parts[1])};
}
function smDetailKey(detail){
 const bounds=smPeriodBounds(detail?.period,detail?.year,detail?.month);
 return detail?`${num(detail.year)}-${smDatePad(detail.month)}-${num(detail.week)}-${bounds?.start||txt(detail.period)}`:'';
}
function smDetailMeetingMatch(detail,meeting){
 const inquiryBounds=smPeriodBounds(detail?.period,detail?.year,detail?.month),meetingBounds=smPeriodBounds(meeting?.period,meeting?.year,detail?.month);
 return !!(inquiryBounds&&meetingBounds&&inquiryBounds.start===meetingBounds.start&&inquiryBounds.end===meetingBounds.end);
}
function smSelectDetail(inquiry,meeting){
 const details=inquiry?.details||[];
 if(!details.length)return null;
 const byTarget=salesMeetingState.target&&details.find(detail=>smContains(detail,salesMeetingState.target));
 if(byTarget)return byTarget;
 const stored=details.find(detail=>smDetailKey(detail)===salesMeetingState.detailKey);
 if(stored)return stored;
 return details.find(detail=>smDetailMeetingMatch(detail,meeting))||details.find(detail=>{
  const bounds=smPeriodBounds(detail.period,detail.year,detail.month);
  return bounds&&bounds.start<=v10Today()&&bounds.end>=v10Today();
 })||details.findLast?.(detail=>{
  const bounds=smPeriodBounds(detail.period,detail.year,detail.month);
  return bounds&&bounds.start<=v10Today();
 })||details.at(-1);
}
function smPeriodLabel(period){return txt(period).replace(/\s*~\s*/,' ~ ');}
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
function smSelectedPeriod(){
 const months=selMonths(),month=state.mode==='month'&&state.months?.length?Number(state.months[0]):Number(months.at(-1));
 return {year:Number(V10.selectedYear||DB.year),month:month||Number(v10Today().slice(5,7))};
}
function smInquiryDate(record,year){
 const direct=v10Date(record?.inquiryDate);
 if(direct)return direct;
 const match=txt(record?.no).match(/^(?:sp|ugs)?(\d{1,2})-(\d{2})\d+/i),month=num(match?.[1]),day=num(match?.[2]);
 return month>=1&&month<=12&&day>=1&&day<=31?`${year}-${smDatePad(month)}-${smDatePad(day)}`:'';
}
function smWorkdayName(date){return ['일','월','화','수','목','금','토'][date.getUTCDay()];}
function smIsoDate(date){return `${date.getUTCFullYear()}-${smDatePad(date.getUTCMonth()+1)}-${smDatePad(date.getUTCDate())}`;}
function smDisplayDate(date){return `${date.getUTCMonth()+1}/${date.getUTCDate()}(${smWorkdayName(date)})`;}
function smMonthWorkweeks(year,month){
 const first=new Date(Date.UTC(year,month-1,1)),last=new Date(Date.UTC(year,month,0)),day=first.getUTCDay()||7,start=new Date(first);
 start.setUTCDate(first.getUTCDate()-(day-1));
 if(start.getUTCDate()+4<first.getUTCDate()&&start.getUTCMonth()===first.getUTCMonth())start.setUTCDate(start.getUTCDate()+7);
 const weeks=[];
 for(let monday=new Date(start);monday<=last;monday.setUTCDate(monday.getUTCDate()+7)){
  const friday=new Date(monday);friday.setUTCDate(friday.getUTCDate()+4);
  // 원본 시트 관례: 수요일이 속한 달의 주차 (예: 8/31~9/4 = 9월 1주, 9/28~10/2 = 9월 5주)
  const wednesday=new Date(monday);wednesday.setUTCDate(wednesday.getUTCDate()+2);
  if(wednesday<first||wednesday>last)continue;
  weeks.push({week:weeks.length+1,start:smIsoDate(monday),end:smIsoDate(friday),period:`${monday.getUTCMonth()+1}/${monday.getUTCDate()}~${friday.getUTCMonth()+1}/${friday.getUTCDate()}`});
 }
 return weeks;
}
function smInquirySource(record){
 if(/소개/.test(`${txt(record?.src)} ${txt(record?.ct)}`))return '소개';
 if(/^(?:SP|그랜드썬SP)$/i.test(txt(record?.corp)))return 'SP';
 if(/UGS|유지에스|유지스/i.test(txt(record?.corp)))return '유지에스';
 return '그랜드썬';
}
function smDerivedMetric(label,records){
 const sources=['그랜드썬','SP','유지에스','소개'],values=sources.map(source=>records.filter(record=>smInquirySource(record)===source).length);
 return {label,values:[...values,values.reduce((sum,value)=>sum+value,0)]};
}
function smDerivedMetrics(records){
 const business=records.filter(record=>/^발전사업/.test(txt(record.type))),progress=business.filter(record=>/진행/.test(txt(record.ct)));
 return [smDerivedMetric('전체 주간문의',records),smDerivedMetric('발전사업 주간 문의',business),smDerivedMetric('발전사업 주간 진행',progress)];
}
function smDerivedTop(records){
 return ['그랜드썬','SP','유지에스','소개'].map(source=>{
  const values=smCountMap(records.filter(record=>smInquirySource(record)===source&&/^발전사업/.test(txt(record.type))),record=>txt(record.type));
  return {source,items:values.slice(0,3).map(([label,value])=>({label,value:String(value)}))};
 });
}
function smParseInquiryLedger(year,month,records){
 const all=(Array.isArray(records)?records:[]).map(record=>({...record,_inquiryDate:smInquiryDate(record,year)}));
 records=all.filter(record=>record._inquiryDate.startsWith(`${year}-${smDatePad(month)}-`));
 const ranges=smMonthWorkweeks(year,month),details=ranges.map(range=>{
  const selected=all.filter(record=>record._inquiryDate>=range.start&&record._inquiryDate<=range.end),days=[];
  for(let cursor=new Date(`${range.start}T00:00:00Z`),end=new Date(`${range.end}T00:00:00Z`);cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
   const date=smIsoDate(cursor),rows=selected.filter(record=>record._inquiryDate===date);
   days.push({day:`${smDatePad(cursor.getUTCMonth()+1)}-${smDatePad(cursor.getUTCDate())}`,metrics:smDerivedMetrics(rows)});
  }
  return {...range,year,month,days,total:smDerivedMetrics(selected),top:smDerivedTop(selected),derived:true};
 });
 return {year,month,monthly:smDerivedMetrics(records),weekly:details.map(({week,period,total})=>({week,period,metrics:total})),details,ready:true,derived:true};
}
function smInquiryForSelection(){
 const target=smSelectedPeriod(),sheet=smParseInquiryReport(V10.payload?.tongye);
 if(sheet.year===target.year&&sheet.month===target.month&&sheet.details.length)return sheet;
 const records=V10.payload?.yearData?.[target.year]?.records||[];
 return smParseInquiryLedger(target.year,target.month,records);
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
function smIsoWeek(value){
 const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
 const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
 return Math.ceil((((date-yearStart)/86400000)+1)/7);
}
function smMeetingBranch(region){
 const group=regionOf(region);
 return ['수도권','충청권','강원권'].includes(group)?'안성지사':['영남권','호남권','제주'].includes(group)?'부산지사':'기타';
}
function smMeetingSite(type){return ['공장','창고','근생','주거','축사','재배사','주차장','토지'].find(site=>txt(type).includes(site))||'기타';}
function smParseMeetingLedger(rows,detail){
 rows=Array.isArray(rows)?rows:[];
 const bounds=detail?.start&&detail?.end?{start:detail.start,end:detail.end}:smPeriodBounds(detail?.period,detail?.year,detail?.month);
 if(!bounds)return {year:detail?.year||0,week:0,period:'',count:0,entries:[],summary:{source:[],branch:[],site:[],relation:[],status:[]},ready:false,basis:'ledger'};
 const entries=[];
 for(let r=0;r<rows.length;r++){
  const date=v10Date(smCell(rows,r,4));
  if(!date||date<bounds.start||date>bounds.end)continue;
  const no=smCell(rows,r,3),source=smCell(rows,r,5),corp=smCell(rows,r,8),type=smCell(rows,r,9),consultant=smCell(rows,r,11),owner=smCell(rows,r,12),region=smCell(rows,r,13),capacity=smCell(rows,r,7);
  if(!no)continue;
  const sourceName=/소개/.test(source)?'소개':/SP/i.test(corp)?'SP':/UGS|유지/.test(corp)?'유지에스':'그랜드썬';
  const text=[no,region,type,consultant,owner,sourceName,capacity?`${capacity}kW`:'',date].filter(Boolean).join('_');
  entries.push({no:entries.length+1,text,source:sourceName,branch:smMeetingBranch(region),site:smMeetingSite(type),status:'미팅실적'});
 }
 const start=new Date(`${bounds.start}T00:00:00Z`),end=new Date(`${bounds.end}T00:00:00Z`),period=`${bounds.start.replace(/-/g,'/')}(${smWorkdayName(start)})~${bounds.end.replace(/-/g,'/')}(${smWorkdayName(end)})`;
 return {year:Number(bounds.start.slice(0,4)),week:smIsoWeek(bounds.start),period,current:'선택 문의 주차와 같은 기간의 실제 미팅 원장',count:entries.length,entries,summary:{source:smCountMap(entries,e=>e.source),branch:smCountMap(entries,e=>e.branch),site:smCountMap(entries,e=>e.site),relation:[],status:smCountMap(entries,e=>e.status)},ready:true,basis:'ledger'};
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
 return `<section id="salesMeetingCopy" class="sales-report-card sales-copy-section"><header><div><p class="sales-kicker">${esc(report.year)}년 ${i(report.week)}주차</p><h3>이번 주 사업주 미팅</h3><p>${esc(report.period)} · 총 ${i(report.count)}건${report.current?` · ${esc(report.current)}`:''}</p></div><strong>${i(report.count)}건</strong></header><div class="sales-summary-grid">${smSummaryTable('유입별',report.summary.source)}${smSummaryTable('지역 담당',report.summary.branch)}${smSummaryTable('설치장소',report.summary.site)}${smSummaryTable('문의 관계',report.summary.relation)}${smSummaryTable('미팅 상태',report.summary.status)}</div><div class="v10-table sales-table sales-meeting-list"><table><thead><tr><th>번호</th><th>영업회의 미팅 내용</th></tr></thead><tbody>${report.entries.length?report.entries.map(entry=>`<tr><td>${i(entry.no)}</td><td class="left">${esc(entry.text)}</td></tr>`).join(''):'<tr><td colspan="2">선택 기간에 실제 미팅이 없습니다.</td></tr>'}</tbody></table></div></section>`;
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
 const matched=smDetailMeetingMatch(detail,meeting),mismatch=matched?'':`<p class="minutes-period-warning">※ 문의 주차와 미팅 원본의 날짜가 다릅니다. 각 제목의 기간을 확인하세요.</p>`;
 return `<section id="salesMinutesCopy" class="sales-minutes-report"><h2 class="minutes-report-title"><span>■</span>컨설팅-${esc(salesMeetingState.reporter)}</h2><div class="minutes-report-box"><div class="minutes-box-title">* 컨설팅 내용</div><div class="minutes-period-basis"><b>문의 ${esc(detail.year)}년 ${i(detail.month)}월 ${i(detail.week)}주차</b><span>${esc(smPeriodLabel(detail.period))} · 월~금</span><b>미팅 ${esc(meeting.year)}년 ${i(meeting.week)}주차</b><span>${esc(smPeriodLabel(meeting.period))} · ${meeting.basis==='ledger'?'실제 미팅 원장':'원본 기준'}</span></div>${mismatch}<h3>1. 유입별 문의건수 <span>[ ${i(detail.month)}월 ${i(detail.week)}주 진행사항 (${esc(detail.period)}) ]</span></h3>${smMinuteInquiryTable(detail,sources)}<h3>2. 사업형태별 문의건수</h3>${smMinuteTopTable(detail,sources)}${extra}<h3>3. 미팅가망 및 특이사항 <span>[ ${esc(meeting.year)}년 ${i(meeting.week)}주차 (${esc(meeting.period)}) ]</span></h3><ol class="minutes-meeting-list">${entries.length?entries.map(entry=>`<li><span>${esc(entry.main)}</span>${entry.note?`<strong>${esc(entry.note)}</strong>`:''}</li>`).join(''):'<li><span>해당 기간 실제 미팅 없음</span></li>'}</ol><ul class="minutes-summary">${smMinuteSummaryLine('유입별 미팅가망',meeting.summary.source)}${smMinuteSummaryLine('지역별 대응예정',meeting.summary.branch)}${smMinuteSummaryLine('문의',meeting.summary.relation)}${smMinuteSummaryLine('설치장소',meeting.summary.site)}${smMinuteSummaryLine('미팅가망 및 확정',meeting.summary.status)}</ul>${actions}</div></section>`;
}
// 별도 사업 메모: 한전수전합리화사업 건수·제안 건수만 숫자로 입력 → "한전수전합리화사업 - N건 (제안M건)" 문장으로 회의록에 들어간다.
function smKepco(){const m=txt(salesMeetingState.extra).match(/(\d+)\s*건\s*\(\s*제안\s*(\d+)\s*건\s*\)/);return {count:m?Number(m[1]):0,proposal:m?Number(m[2]):0};}
function smSetKepco(count,proposal){const n=v=>Math.max(0,Math.min(999,Math.floor(Number(v)||0)));salesMeetingState.extra=`한전수전합리화사업 - ${n(count)}건 (제안${n(proposal)}건)`;store.set('v10_salesMeetingExtra',salesMeetingState.extra);}
// 영업회의는 주차 단위로만 본다: 오늘 기준 보고 주(월~토요일 전이면 지난주, 토·일이면 이번 주)의 금요일을 기준 날짜로 쓴다.
function smShiftDate(iso,days){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return smIsoDate(d);}
function smReportFriday(today=v10Today()){const d=new Date(today+'T00:00:00Z'),dow=d.getUTCDay(),monday=smShiftDate(today,-((dow+6)%7));return dow===6||dow===0?smShiftDate(monday,4):smShiftDate(monday,-3);}
function smContains(detail,iso){const b=smPeriodBounds(detail?.period,detail?.year,detail?.month);return !!(b&&b.start<=iso&&b.end>=iso);}
// 기준 날짜가 들어 있는 달을 찾아 상단 기간을 그 달로 맞춘다(원본 시트 주차 > 월요일이 속한 달 > 금요일이 속한 달).
function smAlignMonth(target){
 const year=Number(V10.selectedYear||DB.year),mon=smShiftDate(target,-((new Date(target+'T00:00:00Z').getUTCDay()+6)%7));
 const months=[...new Set([mon,target].filter(d=>Number(d.slice(0,4))===year).map(d=>Number(d.slice(5,7))))];
 const keep={mode:state.mode,months:state.months,quarters:state.quarters};let found=null;
 for(const m of months){state.mode='month';state.months=[m];state.quarters=[];const inq=smInquiryForSelection();if(inq.details?.some(d=>smContains(d,target))){if(!inq.derived)return m;found??=m;}}
 if(found){state.months=[found];return found;}
 Object.assign(state,keep);return null;
}
function easySalesMeeting(){
 if(!salesMeetingState.target)salesMeetingState.target=smReportFriday();
 smAlignMonth(salesMeetingState.target);
 const inquiry=smInquiryForSelection(),weeklyMeeting=smParseMeetingReport(V10.payload?.meeting26),detail=smSelectDetail(inquiry,weeklyMeeting),meeting=detail&&smDetailMeetingMatch(detail,weeklyMeeting)?weeklyMeeting:smParseMeetingLedger(V10.payload?.tongye,detail);
 salesMeetingState.detailKey=smDetailKey(detail);salesMeetingState.week=detail?.week||0;
 const matched=smDetailMeetingMatch(detail,meeting);
 const inquirySection=inquiry.ready?`<section id="salesInquiryCopy" class="sales-report-card sales-copy-section"><header><div><p class="sales-kicker">${esc(inquiry.year)}년 ${i(inquiry.month)}월 ${inquiry.derived?'문의 원장 재집계':'원본 집계'}</p><h3>월간 · 주차별 문의 현황</h3><p>상단에서 선택한 연도·월의 문의 접수일을 기준으로 월~금 주차를 표시합니다.</p></div><strong>${i(inquiry.month)}월</strong></header><h4 class="sales-subtitle">월 전체 문의</h4>${smMetricsTable(inquiry.monthly)}<p class="sales-note">${inquiry.derived?'상담번호의 문의 접수일을 기준으로 다시 집계했습니다.':'합계는 원본 통계 시트의 값을 그대로 표시합니다.'}</p><h4 class="sales-subtitle">주차별 문의</h4>${smWeeklyOverview(inquiry)}${detail?`<div class="sales-detail-head"><div><h4>${detail.month}월 ${detail.week}주차 일자별 문의</h4><p>${esc(detail.period)} · 월요일~금요일</p></div></div>${smDailyTable(detail)}${smTopThree(detail)}`:''}</section>`:`<section id="salesInquiryCopy" class="sales-report-card sales-copy-section"><h3>월간 · 주차별 문의 현황</h3><p class="sales-empty">선택한 연도·월의 문의 자료를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p></section>`;
 const sourcePeriods=[detail?`문의 ${esc(detail.year)}년 ${i(detail.month)}월 ${i(detail.week)}주차 · ${esc(smPeriodLabel(detail.period))}`:'문의 자료 대기',meeting.ready?`미팅 ${esc(meeting.year)}년 ${i(meeting.week)}주차 · ${esc(smPeriodLabel(meeting.period))}`:'미팅 자료 대기'].join(' / ');
 const reportFri=smReportFriday(),isReport=detail&&smContains(detail,reportFri),nextMonday=smShiftDate(salesMeetingState.target,3);
 // 주간 현황과 같은 막대: [보고 주차 ▾] [◀ 이전 주 | 이번 주 | 다음 주 ▶] ·········· 2026년 10월 3주차 (문의 · 미팅 기간)
 const pickYear=Number(V10.selectedYear||DB.year),allWeeks=[];for(let m=1;m<=12;m++)smMonthWorkweeks(pickYear,m).forEach(w=>allWeeks.push({...w,month:m}));
 const target=salesMeetingState.target,cur=allWeeks.find(w=>w.start<=target&&w.end>=target),rep=allWeeks.find(w=>w.start<=reportFri&&w.end>=reportFri);
 const options=allWeeks.map(w=>`<option value="${w.end}" ${cur&&w.end===cur.end?'selected':''}>${w.month}월 ${w.week}주차 · ${esc(w.period.replace('~',' ~ '))}${rep&&w.end===rep.end?' · 이번 주':''}</option>`).join('');
 const first=allWeeks[0],last=allWeeks[allWeeks.length-1],atFirst=!cur||cur.end===first?.end,atLast=!cur||cur.end===last?.end||nextMonday>v10Today();
 const nowLabel=detail?`${esc(detail.year)}년 ${i(detail.month)}월 ${i(detail.week)}주차`:cur?`${pickYear}년 ${cur.month}월 ${cur.week}주차`:'주차 자료 없음';
 const nowSub=`문의 ${detail?esc(smPeriodLabel(detail.period)):cur?esc(cur.period):'—'}${meeting.ready?` · 미팅 ${i(meeting.week)}주차`:''}`;
 const periodSelector=`<section class="periodbar sm-periodbar" aria-label="보고 주차 선택"><div class="sm-toolbar"><label class="cw-pick">보고 주차<select id="smWeekPick" aria-label="보고 주차">${options}</select></label><div class="cw-nav" role="group" aria-label="주차 이동"><button class="btn cw-step" type="button" data-sm-week="-1" ${atFirst?'disabled':''}>◀ 이전 주</button><button class="btn cw-now${isReport?' on':''}" type="button" data-sm-week="0" ${isReport?'aria-current="true"':''}>이번 주</button><button class="btn cw-step" type="button" data-sm-week="1" ${atLast?'disabled':''}>다음 주 ▶</button></div><strong class="cw-current">${nowLabel} <small>${nowSub}</small></strong></div><p class="easy-period-note">${nowLabel} · 문의 ${detail?esc(smPeriodLabel(detail.period))+' (월~금)':'자료 없음'}${meeting.ready?` / 미팅 ${esc(meeting.year)}년 ${i(meeting.week)}주차 · ${esc(smPeriodLabel(meeting.period))}`:''} · 부서 전체</p></section>${detail&&!matched?`<p class="sm-week-warn">문의 주차와 미팅 자료의 날짜가 다릅니다. 미팅은 ${meeting.ready?esc(smPeriodLabel(meeting.period)):'자료 대기'} 기준입니다.</p>`:''}`;
 return periodSelector+`<div class="sales-minutes-controls"><label>보고자명<input id="salesMeetingReporter" maxlength="20" value="${esc(salesMeetingState.reporter)}"></label><div class="sales-extra-field"><span>별도 사업 메모</span><div class="sm-extra-row"><b>한전수전합리화사업</b><input id="smKepcoCount" type="number" min="0" max="999" inputmode="numeric" value="${i(smKepco().count)}" aria-label="한전수전합리화사업 건수"><em>건</em><b>제안</b><input id="smKepcoProposal" type="number" min="0" max="999" inputmode="numeric" value="${i(smKepco().proposal)}" aria-label="한전수전합리화사업 제안 건수"><em>건</em></div></div><label class="sales-actions-field">후속 조치 · 담당/기한<textarea id="salesMeetingActions" maxlength="500" rows="2" placeholder="선택 입력 · 예: 김동호 / 10월 16일 / 제안서 발송">${esc(salesMeetingState.actions)}</textarea></label></div><div class="sales-copy-toolbar"><button class="btn primary" data-sales-copy="minutes">회의록 형식 복사</button><button class="btn" data-sales-copy="all">원본 상세 전체 복사</button><button class="btn" data-sales-copy="inquiry">문의표만 복사</button><button class="btn" data-sales-copy="meeting">미팅표만 복사</button><a class="btn" href="${SALES_MEETING_SOURCE.inquiry}" target="_blank" rel="noopener">문의 원본 열기</a><a class="btn" href="${SALES_MEETING_SOURCE.meeting}" target="_blank" rel="noopener">미팅 원본 열기</a><span id="salesCopyStatus" role="status"></span></div><div class="sm-hwp-copy"><b>한글 양식에 내용만 붙이기</b><button class="btn" data-sm-num="1">① 유입별 문의건수 <small>숫자 3줄 × 4칸</small></button><button class="btn" data-sm-num="2">② 사업형태별 TOP 3 <small>3줄 × 6칸</small></button><button class="btn" data-sm-num="3">③ 미팅가망 · 특이사항 <small>글</small></button><p>①② 한글 회의록 표에서 <b>첫 숫자 칸부터 마지막 칸까지 마우스로 블록 지정 → Ctrl+V</b> 하면 표 모양은 그대로 두고 칸 안 내용만 바뀝니다. ③은 붙일 자리에 커서를 두고 Ctrl+V.</p></div><div class="v10-callout sales-basis"><b>권장 보고 순서</b> 주간 문의 → 문의 TOP 3 → 미팅가망·특이사항 → 후속 조치 순으로 보고합니다. 보고자명과 메모를 수정하면 회의록 미리보기와 복사본에 바로 반영됩니다.</div>${smMinutesReport(inquiry,detail,meeting)}<details class="sales-source-details"><summary>원본 상세자료 펼치기</summary><div class="v10-callout sales-basis"><b>집계 기준</b> 영업회의 자료는 대시보드 상단에서 선택한 연도·월을 따라갑니다. 문의 주차를 바꾸면 같은 날짜의 실제 미팅도 함께 바뀝니다.</div><div id="salesMeetingCopyRoot" class="sales-copy-root">${inquirySection}${smMeetingSection(meeting)}</div></details>`;
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
 clone.querySelectorAll('.minutes-period-basis').forEach(node=>node.setAttribute('style','display:grid;grid-template-columns:auto 1fr;gap:2px 9px;margin:6px 0 8px;padding:6px 8px;border:1px solid #6685ad;background:#eef5ff;font-size:10px;line-height:1.35;'));
 clone.querySelectorAll('.minutes-period-warning').forEach(node=>node.setAttribute('style','margin:4px 0;color:#b52b1d;font-size:10px;font-weight:800;'));
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
 smHwpFriendly(root,clone);
 return clone;
}
// 한글(HWP) 붙여넣기: 한글은 width:100%·grid·px 글꼴을 제대로 못 읽어 표가 글자 폭으로 쪼그라든다.
// 화면에 보이는 열 너비를 재서 칸마다 고정 너비(px)를 넣고, 글자 크기는 pt(최소 9pt), 기간 안내는 줄바꿈으로 바꾼다.
function smHwpFriendly(root,clone,width=640){
 const orig=[...root.querySelectorAll('table')],copy=[...clone.querySelectorAll('table')];
 copy.forEach((t,ix)=>{
  const o=orig[ix],tw=o?.getBoundingClientRect().width;if(!tw)return;
  const scale=width/tw,oc=[...o.querySelectorAll('th,td')],cc=[...t.querySelectorAll('th,td')];
  t.setAttribute('width',width);t.setAttribute('cellspacing','0');t.setAttribute('cellpadding','3');
  t.setAttribute('style',(t.getAttribute('style')||'').replace(/width:[^;]*;?/g,'').replace(/table-layout:[^;]*;?/g,'')+`width:${width}px;table-layout:fixed;`);
  cc.forEach((c,k)=>{const w=oc[k]?.getBoundingClientRect().width;if(!w)return;const px=Math.max(18,Math.round(w*scale));c.setAttribute('width',px);c.setAttribute('style',(c.getAttribute('style')||'')+`width:${px}px;`);});
 });
 clone.querySelectorAll('.minutes-period-basis').forEach(box=>{
  box.setAttribute('style','display:block;margin:6px 0 8px;padding:5px 8px;border:1px solid #6685ad;background:#eef5ff;font-size:9pt;line-height:1.5;');
  box.querySelectorAll('span').forEach(sp=>{sp.setAttribute('style','margin-left:6px;');sp.after(document.createElement('br'));});
 });
 clone.querySelectorAll('[style]').forEach(node=>{
  const st=node.getAttribute('style').replace(/font-size:\s*([\d.]+)px/g,(m,px)=>`font-size:${Math.max(9,Math.round(Number(px)*0.75*2)/2)}pt`).replace(/font-family:[^;]*;?/g,"font-family:'맑은 고딕','Malgun Gothic',sans-serif;").replace(/display:grid;?|grid-template-columns:[^;]*;?|gap:[^;]*;?/g,'');
  node.setAttribute('style',st);
 });
}
// 한글 양식 칸 채우기용: 서식 없는 글(칸은 Tab, 줄은 줄바꿈)만 복사한다. 한글 표 블록에 붙이면 칸마다 들어간다.
function smPlainCell(el){return txt(el?.textContent).replace(/^—$/,'-');}
function smNumbersText(kind){
 const root=document.querySelector('#salesMinutesCopy');if(!root)return '';
 if(kind==='1')return [...root.querySelectorAll('.minutes-inquiry-table tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(smPlainCell).join('\t')).join('\r\n');
 if(kind==='2')return [...root.querySelectorAll('.minutes-top-table tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(smPlainCell).join('\t')).join('\r\n');
 const items=[...root.querySelectorAll('.minutes-meeting-list li')].map((li,ix)=>{const main=txt(li.querySelector('span')?.textContent),note=txt(li.querySelector('strong')?.textContent);return `${ix+1}. ${main}${note?'\r\n   '+note:''}`;});
 const summary=[...root.querySelectorAll('.minutes-summary li')].map(li=>'• '+txt(li.textContent));
 return items.concat(summary).join('\r\n');
}
async function smCopyNumbers(kind){
 const text=smNumbersText(kind),status=$('#salesCopyStatus');
 if(!text){if(status)status.textContent='복사할 내용이 없습니다.';return;}
 try{await navigator.clipboard.writeText(text);if(status)status.textContent=kind==='3'?'③ 글을 복사했습니다. 한글에서 붙일 자리에 Ctrl+V.':`${kind==='1'?'①':'②'} 숫자를 복사했습니다. 한글 표에서 칸을 블록 지정한 뒤 Ctrl+V.`;}
 catch(e){if(status)status.textContent='브라우저가 복사를 막았습니다. 다시 한 번 눌러 주세요.';}
}
document.addEventListener('click',event=>{const b=event.target.closest?.('[data-sm-num]');if(b)smCopyNumbers(b.dataset.smNum);});
async function smCopyReport(kind){
 const selector=kind==='minutes'?'#salesMinutesCopy':kind==='inquiry'?'#salesInquiryCopy':kind==='meeting'?'#salesMeetingCopy':'#salesMeetingCopyRoot',root=document.querySelector(selector),status=$('#salesCopyStatus');
 if(!root)return;
 const clone=smPrepareClipboard(root),plain=(clone.innerText||clone.textContent||'').replace(/\n{3,}/g,'\n\n').trim(),html=`<html><head><meta charset="utf-8"><\/head><body><!--StartFragment--><div style="font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:10pt;color:#14243a">${clone.innerHTML}</div><!--EndFragment--><\/body><\/html>`;
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
 if(event.target.id==='salesMeetingWeek'){salesMeetingState.detailKey=txt(event.target.value);store.set('v10_salesMeetingDetailKey',salesMeetingState.detailKey);render();return;}
 const setting={salesMeetingReporter:['reporter','v10_salesMeetingReporter'],salesMeetingExtra:['extra','v10_salesMeetingExtra'],salesMeetingActions:['actions','v10_salesMeetingActions']}[event.target.id];
 if(!setting)return;salesMeetingState[setting[0]]=txt(event.target.value);store.set(setting[1],salesMeetingState[setting[0]]);render();
});
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-sales-copy]');if(button)smCopyReport(button.dataset.salesCopy);});
document.addEventListener('change',event=>{if(event.target.id!=='smKepcoCount'&&event.target.id!=='smKepcoProposal')return;const k=smKepco();smSetKepco(event.target.id==='smKepcoCount'?event.target.value:k.count,event.target.id==='smKepcoProposal'?event.target.value:k.proposal);render();});
document.addEventListener('change',event=>{if(event.target.id==='smWeekPick'){salesMeetingState.target=event.target.value;salesMeetingState.detailKey='';render();}});
document.addEventListener('click',event=>{const b=event.target.closest?.('[data-sm-week]');if(!b||b.disabled)return;const n=Number(b.dataset.smWeek);salesMeetingState.target=n===0?smReportFriday():smShiftDate(salesMeetingState.target||smReportFriday(),7*n);salesMeetingState.detailKey='';render();});
// 영업회의 화면에서는 월·분기·연 누적 기간 막대를 숨긴다(주차 단위로만 본다).
{const smRenderBase=render;render=function(...a){document.body.classList.toggle('sm-mode',state.sect==='salesMeeting');return smRenderBase.apply(this,a);};}
