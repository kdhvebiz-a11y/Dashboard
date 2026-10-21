/* A simpler navigation layer, keeping the verified reporting model underneath. */
const EASY_NAV=[
 {k:'inquiry',label:'문의 · 미팅 전환',sub:'들어온 문의의 후속 성과'},
 {k:'meetExe',label:'미팅 현황',sub:'선택한 달에 진행한 미팅'},
 {k:'contract',label:'실제 계약 실적',sub:'RPS 계약 · 용량 · 위치'},
 {k:'owner',label:'담당자별 실적',sub:'현장 · 컨설팅 담당'},
 {k:'source',label:'지역 · 용량 · 법인',sub:'어느 지역·용량·법인의 문의인가'},
 {k:'goal',label:'목표 관리',sub:'목표와 남은 실적'},
 {k:'report',label:'부서 보고서',sub:'보고 · 인쇄 · 내려받기'},
 {k:'presentation',label:'실적발표',sub:'월간 · 분기 · 누적 발표'}
];
/*
 * Keep every existing workspace, but expose only six task-oriented groups in
 * the rail.  The active group's children appear underneath it, so the rail is
 * short while every former destination remains one click away.
 */
const EASY_MENU=[
 {k:'summary',label:'주간 현황',sub:'이번 주 문의와 미팅',open:'weekly',items:[]},
 {k:'inquiries',label:'문의 · 상담',sub:'문의 유입부터 미팅 전환까지',open:'inquiry',items:[['inquiry','문의 · 미팅 전환'],['region','지역'],['capacity','용량'],['corp','법인']]},
 {k:'meetings',label:'미팅실적',sub:'사업주 미팅과 담당자 성과',open:'meetExe',items:[['meetExe','미팅 현황'],['owner','담당자별 실적'],['records','미팅 원장']]},
 {k:'contracts',label:'계약실적',sub:'계약 건수 · 용량 · 위치',open:'contract',items:[['contract','실제 계약 실적']]},
 {k:'goals',label:'목표관리',sub:'목표와 남은 실적',open:'goal',items:[['goal','목표 관리']]},
 {k:'reports',label:'보고자료',sub:'보고서 · 발표 · 회의자료',open:'report',items:[['report','부서 보고서'],['presentation','실적발표'],['salesMeeting','영업회의 자료']]},
 {k:'followups',label:'상담 후속관리',sub:'미팅 후 피드백 · 연락 일정',open:'followup',items:[]}
];
// Legacy section-family mapping is kept for the underlying view model.
const easyGroup=k=>['meetCoh','inquiry'].includes(k)?'inquiry':['cons','owner'].includes(k)?'owner':['source','corp','region','capacity'].includes(k)?'source':['report','insight'].includes(k)?'report':k;
const easyMenuGroup=k=>{
 if(['overall','weekly'].includes(k))return 'summary';
 if(k==='followup')return 'followups';
 if(['inquiry','meetCoh','source','corp','region','capacity'].includes(k))return 'inquiries';
 if(['meetExe','cons','owner','records'].includes(k))return 'meetings';
 if(k==='contract')return 'contracts';
 if(k==='goal')return 'goals';
 if(['report','insight','presentation','salesMeeting'].includes(k))return 'reports';
 return 'summary';
};
const easySubnav=(items,selected)=>`<div class="easy-subnav">${items.map(([key,label])=>`<button data-v10-section="${key}" class="${key===selected?'on':''}">${esc(label)}</button>`).join('')}</div>`;
const easyLead=(title,sub,tag)=>`<div class="easy-lead"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${tag?`<span class="easy-tag">${esc(tag)}</span>`:''}</div>`;
function easyPrimary(a){return `<div class="v10-kpis">${[
 v10Card('새로 들어온 전체 문의',v10Number(a.total)+' 건','문의 접수월 기준',V10.colors[0],'inquiry'),
 v10Card('전체 사업 문의',v10Number(a.power)+' 건',`전체 문의 중 ${v10Rate(a.power,a.total)}`,V10.colors[1],'inquiry'),
 v10Card('이번 문의에서 이어진 미팅',i(a.cohort)+' 건','이후 다른 달에 진행한 미팅도 포함',V10.colors[2],'meetCoh'),
 v10Card('이번 기간에 실제 한 미팅',i(a.actual)+' 건','이전에 들어온 문의의 미팅도 포함',V10.colors[3],'meetExe')].join('')}</div>`;}
function easySecondary(a){return `<div class="easy-secondary"><div><span>실제 미팅 용량</span><b>${capS(a.actualCap)}</b></div><div><span>건당 평균 용량</span><b>${d1(a.avg)} kW</b></div><div><span>계약 확정 실적</span><button class="easy-link" data-v10-section="contract">엑셀 자료 대기 →</button></div></div>`;}
function easyTrendAxis(){
 const axis=v10TrendAxis(),year=Number(DB.year),nowYear=Number(v10Today().slice(0,4)),nowMonth=Number(v10Today().slice(5,7));
 return year===nowYear?axis.filter(g=>Math.min(...g.months)<=nowMonth).map(g=>({...g,months:g.months.filter(m=>m<=nowMonth)})).filter(g=>g.months.length&&(state.mode!=='cumulative'||Number(g.label.replace(/\D/g,''))<=nowMonth)):axis;
}
// Overview building blocks: a big figure with its capacity line, and the bridge that
// explains how the two meeting counts overlap.
const easyBig=(label,value,unit,cap,sub,color,section)=>`<button class="v10-kpi easy-big" style="--metric:${color}" data-v10-section="${section}"><span class="label">${esc(label)}</span><strong>${esc(value)}<em>${esc(unit)}</em></strong>${cap?`<span class="cap">${cap}</span>`:''}<small>${esc(sub)}</small></button>`;
function easyMeetingSplit(a,ms){
 const year=Number(DB.year),exe=new Set(a.exeRows);
 const both=a.rows.filter(r=>exe.has(r)).length;            // this period's inquiries met in this period
 const later=a.rows.length-both;                             // this period's inquiries met in a later month
 const earlier=a.exeRows.filter(r=>!(ms.includes(r.cmo)&&r.year===year)).length; // meetings held now for earlier inquiries
 return {both,later,earlier,cohortLedger:a.rows.length,actualLedger:a.exeRows.length};
}
function easyMeetingBridge(a,ms){
 const s=easyMeetingSplit(a,ms),label=periodLabel(),max=Math.max(s.cohortLedger,s.actualLedger,1),c=V10.colors;
 const seg=(n,color,text)=>n>0?`<span style="flex:${n};background:${color}" title="${esc(text)} ${i(n)}건">${n/max>0.12?esc(text)+' '+i(n):i(n)}</span>`:'';
 const row=(title,sub,total,segments,section)=>`<div class="easy-bridge-row"><button class="easy-bridge-label" data-v10-section="${section}"><b>${esc(title)}</b><small>${esc(sub)}</small></button><div class="bar" style="width:${(Math.max(total,0)/max*100).toFixed(1)}%">${segments}</div><strong>${i(total)}건</strong></div>`;
 const note=`두 막대의 보라색 부분은 같은 미팅입니다 — 이번 기간 문의가 이번 기간에 미팅까지 간 건.${a.gap?` 막대는 원장 기준이며, 보고 집계 ${i(a.actual)}건과 원장 ${i(s.actualLedger)}건은 ${i(Math.abs(a.gap))}건 차이가 있어 원본 확인이 필요합니다.`:''}`;
 return v10Panel('두 미팅 숫자는 어떻게 다른가요?',`${label} 문의에서 이어진 미팅과 ${label}에 진행한 미팅은 겹치는 부분이 있습니다.`,
  `<div class="easy-bridge">${row(`${label} 문의 → 미팅`,'문의 접수월 기준 · 이후 달 미팅 포함',s.cohortLedger,seg(s.both,c[3],'이번 기간 미팅')+seg(s.later,c[2],'다음 달 이후 미팅'),'meetCoh')}${row(`${label}에 진행한 미팅`,'보고 주차 기준 · 이전 문의 포함',s.actualLedger,seg(s.both,c[3],'이번 기간 문의')+seg(s.earlier,c[5],'이전 달 문의'),'meetExe')}</div><div class="easy-bridge-legend"><span><i style="background:${c[3]}"></i>이번 기간 문의 + 이번 기간 미팅 (양쪽에 모두 포함)</span><span><i style="background:${c[2]}"></i>이번 기간 문의 · 다음 달 이후 미팅</span><span><i style="background:${c[5]}"></i>이전 달 문의 · 이번 기간 미팅</span></div><p class="v10-note">${note}</p>`);
}
function easySummaryBlocks(ms,a,g){
 const axis=easyTrendAxis(),values=axis.map(x=>v10Aggregate(x.months)),label=periodLabel(),c=V10.colors;
 const avgCohort=a.cohort?a.cohortCap/a.cohort:0;
 const inquiryBlock=`<section class="easy-block"><div class="easy-block-head"><h3>문의</h3><span>${esc(label)} · 문의 접수월 기준</span></div><div class="easy-block-grid">
  <div class="easy-stack">${easyBig('전체 문의 (총문의)',v10Number(a.total),'건','',a.total===null?'현재 조건으로 나눌 문의 원장 없음':'발전사업 · O&M · 정부사업 등 모든 문의',c[0],'inquiry')}${easyBig('사업 문의',v10Number(a.power),'건','',`전체 문의 중 ${v10Rate(a.power,a.total)} · 발전사업`,c[1],'inquiry')}</div>
  ${v10Line('월별 문의 추세','전체 문의와 사업 문의 · 접수월 기준',axis,[{name:'전체 문의',color:c[0],values:values.map(x=>x.total)},{name:'사업 문의',color:c[1],values:values.map(x=>x.power)}])}
  ${v10Panel('문의 목표',`${label} 목표 대비`,v10GoalBar('전체 문의',a.total,g.total,'건',c[0])+v10GoalBar('사업 문의',a.power,g.power,'건',c[1])+`<div class="easy-tablelink"><button class="easy-link" data-v10-section="goal">목표 설정 · 상세 보기 →</button></div>`)}
 </div></section>`;
 const meetingBlock=`<section class="easy-block"><div class="easy-block-head"><h3>미팅</h3><span>${esc(label)} · 건수와 실제 미팅 용량</span></div><div class="easy-block-grid">
  <div class="easy-stack">${easyBig(`${label} 문의 → 미팅으로 이어진`,i(a.cohort),'건',`미팅 용량 ${capS(a.cohortCap)} <small>· 건당 ${d1(avgCohort)} kW</small>`,'이번 기간에 들어온 문의 중 미팅까지 간 건 · 이후 달 미팅 포함',c[2],'meetCoh')}${easyBig(`${label}에 실제 진행한 미팅`,i(a.actual),'건',`미팅 용량 ${capS(a.actualCap)} <small>· 건당 ${d1(a.avg)} kW</small>`,`${a.actualSource} · 이전 달 문의의 미팅 포함`,c[3],'meetExe')}</div>
  ${v10Line('월별 미팅 추세','문의에서 이어진 미팅과 실제 진행한 미팅',axis,[{name:'문의 → 미팅',color:c[2],values:values.map(x=>x.cohort)},{name:'실제 진행 미팅',color:c[3],values:values.map(x=>x.actual)}])}
  ${v10Panel('미팅 · 계약 목표',`${label} 목표 대비`,v10GoalBar('실제 진행 미팅',a.actual,g.meeting,'건',c[3])+contractGoalProgress()+`<div class="easy-tablelink"><button class="easy-link" data-v10-section="contract">계약 실적 상세 →</button></div>`)}
 </div></section>`;
 return inquiryBlock+meetingBlock+easyMeetingBridge(a,ms);
}
// The former overview screen is folded into the department report; keep the key for old links.
function easyOverview(){return easyReport();}
// 마케팅 · 소개 색: 주간 현황의 미팅 막대와 같은 색을 쓴다.
const EASY_SRC={마케팅:V10.colors[0],소개:V10.colors[5]};
// KPI 카드 + 마케팅/소개 분해 줄. parts=[{name,value(표시 문자열),share(막대용 숫자, 없으면 막대 생략),color}]
function easyKpiSplit(label,value,note,color,section,parts){
 const bar=parts.every(p=>Number.isFinite(p.share))&&parts.some(p=>p.share>0)?`<div class="easy-split-bar">${parts.map(p=>p.share>0?`<i style="flex:${p.share};background:${p.color}"></i>`:'').join('')}</div>`:'';
 return `<button class="v10-kpi easy-kpi-split" style="--metric:${color}" data-v10-section="${section}"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small>${bar}<div class="easy-split-keys">${parts.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.name)} <b>${esc(p.value)}</b></span>`).join('')}</div></button>`;
}
// 문의 → 미팅 전환 화면 공통 몸통 (월별·주간이 같은 순서로 그려진다): 문의 추세 → 전환 건수 → 전환율(전체·마케팅·소개) + 분해표 → 담당자 실적
// 차트 아래 수치표. 줄마다 최고값(▲ 초록)과 최저값(▼ 빨강)을 표시한다. 아직 진행 중인 기간(partial 인덱스)은 비교에서 뺀다.
function easyChartTable(axis,series,unit,noun,partial){
 const fmt=v=>v===null||v===undefined?'—':(unit==='%'?d1(v):i(v))+unit;
 const rows=series.map(s=>{
  const known=s.values.map((v,k)=>({v,k})).filter(x=>x.v!==null&&x.v!==undefined&&x.k!==partial);
  const max=known.length>1?Math.max(...known.map(x=>x.v)):null,min=known.length>1?Math.min(...known.map(x=>x.v)):null;
  const cells=s.values.map((v,k)=>{const text=fmt(v);if(k===partial||v===null||v===undefined||max===min)return `<td>${text}</td>`;if(v===max)return `<td class="easy-max" title="최고">${text}</td>`;if(v===min)return `<td class="easy-min" title="최저">${text}</td>`;return `<td>${text}</td>`;});
  return `<tr><td><i class="easy-key" style="background:${s.color}"></i>${esc(s.name)}</td>${cells.join('')}</tr>`;
 });
 return `<div class="easy-chart-table"><div class="easy-chart-table-head"><span>${esc(noun)}별 수치</span><span class="easy-chart-table-legend"><b class="easy-max"><em>1위</em>최고</b><b class="easy-min"><em>최저</em>가장 낮음</b>${partial>=0?'<small>진행 중인 '+esc(axis[partial].label)+'은 제외</small>':''}</span></div><div class="tblwrap"><table><thead><tr><th>구분</th>${axis.map(a=>`<th>${esc(a.label)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}
function easyConversionBody(axis,points,opts){
 const c=V10.colors,noun=opts.noun,src=name=>({name,color:EASY_SRC[name]}),partial=Number.isInteger(opts.partial)?opts.partial:-1;
 // 차트마다 값 표를 항상 펼쳐 두고(접힌 '값 표로 보기' 대신), 점 위 숫자는 세 선까지 모두 적는다.
 const chart=(title,sub,series,unit='건')=>{const panel=v10Line(title,sub,axis,series,unit,{noTable:true});return panel.includes('chartbox')?panel.replace('<section class="v10-panel">','<section class="v10-panel easy-chart-panel">').replace(/<\/section>$/,easyChartTable(axis,series,unit,noun,partial)+'</section>'):panel;};
 return `<div class="v10-grid">${chart(`${noun}별 문의`,opts.inquirySub,[{name:'전체 문의',color:c[0],values:points.map(p=>p.total)},{name:opts.powerName,color:c[1],values:points.map(p=>p.power)}])}${chart(`${noun}별 문의 → 미팅`,opts.cohortSub,[{name:'미팅으로 이어진 건',color:c[2],values:points.map(p=>p.cohort)},{...src('마케팅'),values:points.map(p=>p.mkCohort)},{...src('소개'),values:points.map(p=>p.refCohort)}])}</div>`
 +`<div class="v10-grid">${chart(`${noun}별 발전사업 미팅 전환율`,opts.rateSub,[{name:'전체',color:c[4],values:points.map(p=>p.rate)},{...src('마케팅'),values:points.map(p=>p.rateMk)},{...src('소개'),values:points.map(p=>p.rateRef)}],'%')}${opts.splitPanel}</div>`
 +opts.peoplePanel;
}
// 마케팅 · 소개 분해표: [이름, 발전사업 문의 수, 그 문의에서 이어진 미팅 원장 행]
// groups: [이름, 전체 문의(말 유입 분류, 없으면 null), 발전사업 문의 수, 그 문의에서 이어진 미팅 원장 행]. 옛 '문의부터 미팅까지' 표의 전체 문의·평균 용량 열을 여기에 합쳤다.
function easySourceSplit(groups,totalAll,powerAll,rowsAll,sub){
 const line=(name,inq,pw,rows,bold)=>{const s=sumRows(rows),pm=rows.filter(r=>/^발전사업/.test(r.type)).length,w=v=>bold?`<b>${v}</b>`:v,key=EASY_SRC[name]?`<span class="easy-src-key"><i style="background:${EASY_SRC[name]}"></i>${esc(name)}</span>`:esc(name);return [w(key),w(v10Number(inq)),w(v10Number(pw)),w(i(rows.length)),w(i(pm)),w(v10Rate(pm,pw)),w(capS(s.cap)),w(d1(s.avg)+' kW')];};
 return v10Panel('마케팅 · 소개별 전환',sub,v10Table(['유입','전체 문의','발전사업 문의','미팅','그중 발전사업','전환율','미팅 용량','평균 용량'],[...groups.map(([name,inq,pw,rows])=>line(name,inq,pw,rows,false)),line('합계',totalAll,powerAll,rowsAll,true)])+'<p class="v10-note">전체 문의는 말 시트의 유입 분류(마케팅·소개가 겹칠 수 있어 합계는 전체 문의 수). 전환율 = 발전사업 미팅 ÷ 발전사업 문의 (각 유입 기준). 최근 접수분은 후속 미팅으로 계속 올라갑니다.</p>').replace('<section class="v10-panel">','<section class="v10-panel easy-split-panel">');
}
// 한 기간의 문의·미팅 집계에서 마케팅/소개 분해 숫자를 뽑는다 (월별은 v10Aggregate 결과, 주간은 cwWeekSet 결과를 같은 모양으로 맞춰 넘긴다).
function easyConversionPoint(total,power,pwrMk,pwrRef,rows){
 const by=name=>rows.filter(r=>v10Source(r.src)===name),pm=list=>list.filter(r=>/^발전사업/.test(r.type)).length;
 const mk=by('마케팅'),ref=by('소개');
 return {total,power,pwrMk,pwrRef,rows,mk,ref,cohort:rows.length,powerCohort:pm(rows),mkCohort:mk.length,refCohort:ref.length,
  rate:power?pct(pm(rows),power):null,rateMk:pwrMk?pct(pm(mk),pwrMk):null,rateRef:pwrRef?pct(pm(ref),pwrRef):null,
  rateMkText:v10Rate(pm(mk),pwrMk),rateRefText:v10Rate(pm(ref),pwrRef)};
}
function easyConversionKpis(p,totalNote,totalValue){
 const c=V10.colors;
 return `<div class="v10-kpis">${v10Card('전체 문의',totalValue,totalNote,c[0],'inquiry')}`
 +easyKpiSplit('발전사업 문의',v10Number(p.power)+' 건',`전체 대비 ${v10Rate(p.power,p.total)}`,c[1],'inquiry',[{name:'마케팅',value:v10Number(p.pwrMk),share:p.pwrMk||0,color:EASY_SRC.마케팅},{name:'소개',value:v10Number(p.pwrRef),share:p.pwrRef||0,color:EASY_SRC.소개}])
 +easyKpiSplit('미팅으로 이어진 건',i(p.cohort)+' 건',`그중 발전사업 ${i(p.powerCohort)}건`,c[2],'meetCoh',[{name:'마케팅',value:i(p.mkCohort),share:p.mkCohort,color:EASY_SRC.마케팅},{name:'소개',value:i(p.refCohort),share:p.refCohort,color:EASY_SRC.소개}])
 +easyKpiSplit('발전사업 미팅 전환율',v10Rate(p.powerCohort,p.power),'발전사업 미팅 ÷ 발전사업 문의',c[4],'meetCoh',[{name:'마케팅',value:p.rateMkText,color:EASY_SRC.마케팅},{name:'소개',value:p.rateRefText,color:EASY_SRC.소개}])
 +`</div>`;
}
function easyInquiry(){
 const a=v10Aggregate(selMonths()),axis=easyTrendAxis(),vals=axis.map(g=>v10Aggregate(g.months));
 const point=x=>easyConversionPoint(x.total,x.power,x.pwrMk,x.pwrRef,x.rows),p=point(a),points=vals.map(point);
 return easyLead('이번에 들어온 문의가 미팅으로 이어졌나요?','선택한 달에 접수된 문의의 후속 성과입니다. 이후 다른 달에 진행한 미팅도 포함합니다.','문의 접수월 기준')
 +easyConversionKpis(p,'선택한 달에 접수된 문의',v10Number(a.total)+' 건')
 +easyConversionBody(axis,points,{noun:'월',partial:Number(DB.year)===Number(v10Today().slice(0,4))?axis.findIndex(g=>g.months.length===1&&g.months[0]===Number(v10Today().slice(5,7))):-1,powerName:'발전사업 문의',inquirySub:'전체 문의와 발전사업 문의 · 접수월 기준',cohortSub:'접수월 기준 · 이후 다른 달에 진행한 미팅 포함',rateSub:'분자·분모 모두 발전사업 기준 · 최근 문의월은 후속 미팅으로 계속 올라갑니다',
   splitPanel:easySourceSplit([['마케팅',a.inqMk,a.pwrMk,p.mk],['소개',a.inqRef,a.pwrRef,p.ref]],a.total,a.power,a.rows,'선택한 달 접수 문의 · 전체 문의·발전사업 문의는 말 시트 집계, 미팅은 그 문의에서 이어진 미팅 원장'),
   peoplePanel:''})
 +v10PeriodTable()+v10PeoplePanel('cons','cohort')+`<details class="easy-details" open><summary>연결된 미팅 ${i(a.rows.length)}건 · 미팅 원장 (접으려면 클릭)</summary>${v10Ledger('cohort')}</details>`;
}
function easyActivity(){
 const ms=selMonths(),a=v10Aggregate(ms),axis=easyTrendAxis(),vals=axis.map(g=>v10Aggregate(g.months));
 return easyLead(`${periodLabel()} 미팅 현황`,`${periodLabel()}에 배정된 보고 주차 전체의 미팅 실적입니다. 앞뒤 달의 날짜도 해당 주차에 속하면 이 달 실적으로 집계합니다.`,v10ReportPeriodLabel(ms))
 +`<div class="v10-kpis">${v10Card('보고 미팅',i(a.actual)+' 건',a.actualSource,V10.colors[3],'meetExe')}${v10Card('총 미팅 용량',capS(a.actualCap),'선택 보고 주차 사업주 미팅',V10.colors[0],'capacity')}${v10Card('건당 평균 용량',d1(a.avg)+' kW','총 용량 ÷ 보고 미팅 건수',V10.colors[5],'capacity')}${v10Card('보고 주차 내 예정',i(a.scheduled)+' 건','오늘 이후 날짜 · 해당 보고 주차 합계에 포함',V10.colors[1],'records')}</div>`
 +v10SourceAudit()
 +easyMeetingTypes(a.exeRows)
 +`<div class="v10-grid">${v10Line('월별 미팅 추세','마케팅과 소개 문의로 실제 진행한 미팅',axis,[{name:'마케팅',color:V10.colors[0],values:vals.map(x=>x.actualMk)},{name:'소개',color:V10.colors[5],values:vals.map(x=>x.actualRef)}])}${v10PeoplePanel('own','exec')}</div>`
 +easyMeetingMonthlyTable(axis,vals)
 +(a.gap?`<div class="v10-callout">동일 보고 주차의 월별 집계 ${i(a.actual)}건과 원장 ${i(a.exeRows.length)}건이 일치하지 않습니다. 원본 집계 내용을 확인해 주세요.</div>`:'')
 +`<details class="easy-details" open><summary>실제 미팅 원장 ${i(a.exeRows.length)}건 (접으려면 클릭)</summary>${v10Ledger('exec')}</details>`;
}
// 사업형태별 미팅: 원장의 사업형태(발전사업(공장, 창고) · 자가소비 · 토지 · 주차장 …)로 묶어 건수 많은 순. 막대는 건수 비중.
function easyMeetingTypes(rows){
 const map=new Map();
 rows.forEach(r=>{const key=txt(r.type)||'미기재';if(!map.has(key))map.set(key,[]);map.get(key).push(r);});
 const groups=[...map].map(([name,rs])=>{const s=sumRows(rs);return {name,n:rs.length,cap:s.cap,avg:s.avg,mk:rs.filter(r=>v10Source(r.src)==='마케팅').length,ref:rs.filter(r=>v10Source(r.src)==='소개').length};}).sort((a,b)=>b.n-a.n||b.cap-a.cap);
 if(!groups.length)return v10Panel('사업형태별 미팅','선택 기간 · 보고 주차 기준',v10Empty('이 기간에 기록된 미팅이 없습니다.'));
 const max=groups[0].n,total=rows.length;
 const body=groups.map((g,j)=>`<tr><td>${j<2?`<span class="easy-rank easy-rank-${j+1}">${j+1}위</span>`:''}${esc(g.name)}</td><td class="easy-bar-cell"><div class="easy-bar"><span style="width:${(g.n/max*100).toFixed(1)}%"></span></div></td><td><b>${i(g.n)}건</b></td><td>${v10Rate(g.n,total)}</td><td>${i(g.mk)} / ${i(g.ref)}</td><td>${capS(g.cap)}</td><td>${d1(g.avg)} kW</td></tr>`).join('');
 return v10Panel('사업형태별 미팅',`${periodLabel()} · 보고 주차 기준 · 미팅 원장의 사업형태 그대로, 건수 많은 순`,`<div class="v10-table easy-types"><table><thead><tr><th>사업형태</th><th></th><th>미팅</th><th>비중</th><th>마케팅 / 소개</th><th>미팅 용량</th><th>평균 용량</th></tr></thead><tbody>${body}</tbody></table></div>`);
}
// 월별 사업주 미팅 요약표 (용량 차트 대신): 줄 = 전체 미팅 / 마케팅 / 소개 / 미팅 용량 / 건당 평균, 칸 = 월. 건수 줄은 1위·최저 표시, 진행 중인 달 제외.
function easyMeetingMonthlyTable(axis,vals){
 const partial=Number(DB.year)===Number(v10Today().slice(0,4))?axis.findIndex(g=>g.months.length===1&&g.months[0]===Number(v10Today().slice(5,7))):-1;
 const c=V10.colors;
 const counts=[{name:'전체 미팅',color:c[3],values:vals.map(x=>x.actual)},{name:'마케팅',color:EASY_SRC.마케팅,values:vals.map(x=>x.actualMk)},{name:'소개',color:EASY_SRC.소개,values:vals.map(x=>x.actualRef)}];
 const caps=[{name:'미팅 용량',color:c[3],cells:vals.map(x=>x.actual?`<b>${capS(x.actualCap)}</b>`:'<span class="easy-dim">—</span>')},{name:'건당 평균',color:c[4],cells:vals.map(x=>x.actual?`<b>${d1(x.actualCap/x.actual)} kW</b>`:'<span class="easy-dim">—</span>')}];
 return v10Panel('월별 미팅 요약','보고 주차 기준 · 건수(전체·마케팅·소개)와 용량·건당 평균을 한 표에 · 건수 줄은 가장 많은 달 1위, 가장 적은 달 최저 표시',easyChartTable(axis,counts,'건','월',partial).replace('class="easy-chart-table"','class="easy-chart-table easy-wide"')+easyPlainTable(axis,caps).replace('class="easy-chart-table','class="easy-chart-table easy-wide easy-tight'));
}
function easyPeople(role){
 const axis=easyTrendAxis(),current=v10PeopleData(role,state.basis,selMonths()).people;
 // Build the legend from every visible month. Using only the selected month
 // made the entire trend chart disappear when that month had no row for a
 // person who worked in another month.
 const totals=new Map();
 axis.forEach(g=>v10PeopleData(role,state.basis,g.months).people.forEach(p=>totals.set(p.name,(totals.get(p.name)||0)+p.n)));
 const names=[...totals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(x=>x[0]);
 const series=names.map((name,j)=>({name,color:V10.colors[j%6],values:axis.map(g=>v10PeopleData(role,state.basis,g.months).people.find(p=>p.name===name)?.n||0)}));
 const trendRows=series.map(s=>{const total=s.values.reduce((sum,v)=>sum+(Number(v)||0),0);return [`<span class="easy-person-key"><i style="background:${s.color}"></i>${esc(s.name)}</span>`,...s.values.map(v=>i(v)+'건'),i(total)+'건',d1(axis.length?total/axis.length:0)+'건'];});
 const total=current.reduce((s,p)=>s+p.n,0),capacity=current.reduce((s,p)=>s+p.cap,0),top=current[0],scored=role==='cons';
 return easyLead('담당자별로 무엇이 달라졌나요?','미팅을 잡은 컨설팅 담당자와 현장에 다녀온 미팅 담당자를 구분합니다.')
 +`<div class="easy-rolemenu">${easySubnav([['owner','현장 미팅 담당자'],['cons','컨설팅 담당자']],state.sect)}<label>보고 싶은 실적 <select id="easyTeamBasis"><option value="cohort" ${state.basis==='cohort'?'selected':''}>이번 문의에서 이어진 미팅</option><option value="exec" ${state.basis==='exec'?'selected':''}>이번 기간 실제로 한 미팅</option></select></label></div>`
 +`<div class="v10-kpis">${v10Card('담당자 수',i(current.length)+' 명',periodLabel()+' 참여 인원',V10.colors[0],state.sect)}${v10Card('미팅 건수',i(total)+' 건',state.basis==='exec'?'실제 미팅월 기준':'문의 접수월 기준',V10.colors[3],state.sect)}${v10Card('미팅 용량',capS(capacity),'담당자 합계',V10.colors[4],state.sect)}${v10Card(scored?'최고 점수 담당자':'최다 담당자',top?top.name:'—',top?(scored?v10Score(top.score||0)+'점 · 컨설팅 '+i(top.asCons||0)+'건 · 제안서 '+i(top.asProp||0)+'건':i(top.n)+'건 · '+capS(top.cap)):'선택 기간 실적 없음',V10.colors[5],state.sect)}</div>`
 +v10PeoplePanel(role,state.basis)
 +v10Line('담당자별 월간 미팅 흐름','위 담당자 표와 같은 집계 기준으로 매월 실적을 비교합니다.',axis,series)
 +v10Panel('담당자별 월간 미팅 수치','위 차트와 같은 기준 · 월별 건수, 기간 합계와 월평균을 바로 확인합니다.',v10Table(['담당자',...axis.map(g=>g.label),'합계','월평균'],trendRows))
 +`<details class="easy-details" open><summary>담당자별 미팅 원장 (접으려면 클릭)</summary>${v10Ledger(state.basis)}</details>`;
}
function easyMarket(k){
 // 마케팅·소개 분해는 '문의 · 미팅 전환' 화면으로 옮겨서, 이 탭은 법인·지역·용량만 보여 준다 ('source' 키는 메뉴 호환용으로 법인 화면을 연다).
 if(k==='source')k='region';
 const nav='';
 let body=k==='corp'?v10Breakdown('corp'):k==='region'?v10Region():v10Capacity();
 if(k==='capacity'){
  body=body.replace(/<div class="v10-kpis">[\s\S]*?(?=<section class="v10-panel">)/,'');
  return nav+body;
 }
 return nav+body;
}
const easyGoalOriginal=v10GoalView;
// Department inquiry targets are independent daily, weekly and monthly commitments.
const EASY_INQUIRY_TARGETS={daily:50,weekly:350,monthly:1500};
const easyGoalState={mode:store.get('v10_goalMode','week'),weeks:store.get('v10_goalWeeks',{}),goals:store.get('v10_weekGoals',{})};
const easyPad=n=>String(n).padStart(2,'0');
function easyIsoWeek(dateText=v10Today()){
 const d=new Date(dateText+'T00:00:00Z'),day=(d.getUTCDay()+6)%7;
 d.setUTCDate(d.getUTCDate()-day+3);
 const first=new Date(Date.UTC(d.getUTCFullYear(),0,4)),firstDay=(first.getUTCDay()+6)%7;
 first.setUTCDate(first.getUTCDate()-firstDay+3);
 return Math.max(1,Math.min(52,1+Math.round((d-first)/604800000)));
}
function easyWeekRange(year,week){
 const jan4=new Date(Date.UTC(Number(year),0,4)),day=(jan4.getUTCDay()+6)%7;
 const monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-day+(Number(week)-1)*7);
 const friday=new Date(monday);friday.setUTCDate(monday.getUTCDate()+4);
 const iso=d=>`${d.getUTCFullYear()}-${easyPad(d.getUTCMonth()+1)}-${easyPad(d.getUTCDate())}`;
 const short=d=>`${d.getUTCMonth()+1}/${d.getUTCDate()}(${['일','월','화','수','목','금','토'][d.getUTCDay()]})`;
 return {week:Number(week),start:iso(monday),end:iso(friday),label:`${short(monday)}~${short(friday)}`};
}
function easyGoalWeek(){
 const y=Number(DB.year),saved=Number(easyGoalState.weeks[y]);
 if(saved>=1&&saved<=52)return saved;
 return y===Number(v10Today().slice(0,4))?easyIsoWeek():52;
}
function easyWeekDefaultGoals(){
 const months=Array.from({length:12},(_,i)=>v10GoalMonth(i+1)),out={};
 for(const k of ['total','power','meeting','contractCount','contractCap'])out[k]=months.every(x=>x[k]!==null&&x[k]!==undefined)?v10Sum(months,k)/52:null;
 return {...out,total:EASY_INQUIRY_TARGETS.weekly,source:'전체 문의 주 350건 · 그 외 연간 목표 ÷ 52'};
}
function easyWeekGoals(week){
 const saved=easyGoalState.goals[`${DB.year}-W${easyPad(week)}`];
 return saved?{...saved,source:'주간 직접 설정 · 이 브라우저'}:easyWeekDefaultGoals();
}
function easyWeekActual(range){
 const rows=DB.ledger.filter(r=>r.date&&r.date>=range.start&&r.date<=range.end&&r.date<=v10Today()&&Number(r.meetingYear)===Number(DB.year)&&v10Match(r));
 const meeting=sumRows(rows),today=v10Today();
 return {rows,meeting:meeting.n,capacity:meeting.cap,contracts:null,contractCap:null};
}
function easyWeeklyGoals(){
 const week=easyGoalWeek(),range=easyWeekRange(DB.year,week),goal=easyWeekGoals(week),actual=easyWeekActual(range),scoped=v10Scoped();
 const option=Array.from({length:52},(_,i)=>{const r=easyWeekRange(DB.year,i+1);return `<option value="${i+1}" ${week===i+1?'selected':''}>${i+1}주차 · ${r.label}</option>`;}).join('');
 const rows=Array.from({length:52},(_,i)=>{const w=i+1,r=easyWeekRange(DB.year,w),g=easyWeekGoals(w);return [`${w}주차`,r.label,g.total===null?'—':d1(g.total),g.power===null?'—':d1(g.power),g.meeting===null?'—':d1(g.meeting),g.contractCount===null?'—':d1(g.contractCount),g.contractCap===null?'—':d1(g.contractCap),esc(g.source)];});
 return `<div class="easy-week-select"><button class="btn" data-easy-week-step="-1" ${week===1?'disabled':''}>이전 주</button><label>조회 주차<select id="v10GoalWeek">${option}</select></label><button class="btn" data-easy-week-step="1" ${week===52?'disabled':''}>다음 주</button><strong>${DB.year}년 ${week}주차 · ${range.label}</strong></div>`
 +`<div class="easy-summary"><strong>월~금 5일을 1주로 집계</strong><span>전체 문의 기본 목표는 주 350건입니다. 일 50건·월 1,500건과 별도로 설정한 값입니다. 그 외 주간 목표는 연간 목표÷52이며, 아래에서 주차별로 조정할 수 있습니다.</span></div>`
 +`<div class="v10-kpis">${v10Card('주간 사업주 미팅',i(actual.meeting)+' 건',`${range.label} · 미팅일 원장`,V10.colors[3],'meetExe')}${v10Card('주간 미팅 용량',capS(actual.capacity),'월~금 사업주 미팅',V10.colors[0],'capacity')}${v10Card('주간 계약','—','계약은 원장 보고 월 단위로 집계',V10.colors[4],'contract')}${v10Card('주간 계약 용량','—','계약일로 주간 실적을 나누지 않음',V10.colors[5],'contract')}</div>`
 +v10Panel('선택 주 목표 달성','미팅은 실제 미팅일 기준입니다. 문의 접수일과 계약 보고 일자가 없어 문의·계약 주간 실적은 표시하지 않습니다.',v10GoalBar('전체 문의',null,goal.total,'건',V10.colors[0])+v10GoalBar('전체 사업 문의',null,goal.power,'건',V10.colors[1])+v10GoalBar('사업주 미팅',scoped?null:actual.meeting,goal.meeting,'건',V10.colors[3]))
 +`<div class="v10-callout">주간 문의 실적은 현재 대시보드 자료에 문의 접수 ‘일자’가 없어 임의로 나누지 않았습니다. 원본에 정확한 접수일 열을 연결하면 주간 문의 달성률도 계산할 수 있습니다.</div>`
 +v10Panel('주차별 목표 설정',`${week}주차 ${range.label}에만 적용됩니다. 이 브라우저에 저장되며 원본 스프레드시트는 수정하지 않습니다.`,`<form id="v10WeekGoalForm" data-week="${week}"><div class="v10-settings">${[['total','전체 문의 (건)'],['power','전체 사업 문의 (건)'],['meeting','실제 미팅 (건)'],['contractCount','계약 (건)'],['contractCap','계약 용량 (kWp)']].map(([k,label])=>`<label>${label}<input type="number" name="${k}" min="0" step="0.1" value="${goal[k]===null||goal[k]===undefined?'':Number(goal[k].toFixed(1))}" placeholder="미설정"></label>`).join('')}</div><div class="v10-actions"><button class="btn primary" type="submit">${week}주차 목표 저장</button><button class="btn" type="button" data-easy-week-action="restore">기본 목표로 복원</button><span id="v10WeekGoalStatus" role="status"></span></div></form>`)
 +`<details class="easy-details"><summary>1~52주 목표표 펼치기</summary>${v10Table(['주차','월~금 기간','전체 문의','전체 사업 문의','미팅','계약','계약 용량(kWp)','설정 기준'],rows)}</details>`;
}
const easyReportOptions=store.get('v10_reportParts',{trend:true,team:true,goal:true,market:false,insight:true});
const easyReportMore={open:store.get('v10_reportMore',false)};
function easyReport(){
 const ms=selMonths(),a=v10Aggregate(ms),g=v10Goals(ms),key=`${DB.year}-${ms.join(',')}`,note=V10.reportNotes[key]||'';
 const options=[['team','담당자'],['market','유입 · 법인 · 지역'],['insight','분석 · 개선 제안']];
 const more=easyReportMore.open;
 return v10Banner('컨설팅 부서 실적 보고',`${DB.year}년 ${periodLabel()} · ${v10Scoped()?'선택 조건 적용':'부서 전체'} · ${new Date(DB.stamp).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 갱신`)
 +`<div class="v10-actions"><button class="btn primary" data-v10-action="print">인쇄 / PDF 저장</button><button class="btn" data-v10-action="summaryCsv">비교표 내려받기</button><button class="btn" data-v10-section="contract">계약 자료 안내</button><span class="easy-spacer"></span><button class="btn" data-v10-action="reportMore" aria-expanded="${more?'true':'false'}">${more?'상세 항목 접기 ▲':'상세 항목 펼치기 ▼'}</button></div>`
 +easySummaryBlocks(ms,a,g)
 +v10Panel('보고자 의견','특이사항과 다음 기간 실행 계획을 적을 수 있습니다.',`<textarea id="v10ReportNote" data-key="${esc(key)}" aria-label="보고자 의견" placeholder="보고 의견을 입력하세요.">${esc(note)}</textarea><div class="easy-report-note">${esc(note)}</div>`)
 +`<div class="easy-report-more${more?'':' hide'}">`
 +`<div class="v10-actions v10-no-print"><span>보고서에 넣을 항목</span>${options.map(([k,label])=>`<label style="font-size:14px"><input type="checkbox" data-report-part="${k}" ${easyReportOptions[k]?'checked':''}> ${label}</label>`).join('')}</div>`
 +v10SourceAudit()+v10PeriodTable()
 +(easyReportOptions.team?`<div class="v10-grid">${v10PeoplePanel('cons','cohort')}${v10PeoplePanel('own','exec')}</div>`:'')
 +(easyReportOptions.market?v10Breakdown('src')+v10Breakdown('corp')+v10Region():'')
 +(easyReportOptions.insight?v10Panel('종합 분석 및 개선 제안','선택한 기간의 수치를 근거로 한 검토 의견',v10Insights()):'')
 +'</div>'
 +'<p class="v10-print-note">문의월의 후속 미팅은 이후 갱신될 수 있습니다. 사업주 미팅은 월별 보고 주차, 계약은 RPS 원장의 계약연도·보고 월을 기준으로 집계합니다.</p>';
}
const easyPerfSlide=(number,title,sub,body)=>`<section class="perf-slide"><header class="perf-slide-head"><span>${String(number).padStart(2,'0')}</span><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></header><div class="perf-slide-body">${body}</div></section>`;
function easyPresentationRegion(ms){
 const meetingRows=v10Rows(ms,'cohort').filter(r=>/^발전사업/.test(r.type)),summary=regionFor(ms).find(g=>g.title==='문의');
 const developmentIndexes=(summary?.cols||[]).map((c,j)=>/^발전사업/.test(c)?j:-1).filter(j=>j>=0);
 const values=RG_ORDER.map(name=>{
  const rows=meetingRows.filter(r=>regionOf(r.reg)===name||r.reg===name),meeting=sumRows(rows);
  let inquiries=null;
  if(DB.rawYear)inquiries=DB.inquiries.filter(r=>ms.includes(r.cmo)&&v10Match(r)&&/^발전사업/.test(r.type)&&(regionOf(r.reg)===name||r.reg===name)).length;
  else if(!v10Scoped()){
   const region=summary?.regions.find(r=>r.region===name);
   inquiries=region?developmentIndexes.reduce((sum,j)=>sum+(Number(region.vals[j])||0),0):null;
  }
  return {name,inquiries,meetings:meeting.n,capacity:meeting.cap,avg:meeting.avg};
 });
 const rank=(key)=>values.filter(x=>x[key]>0).slice().sort((a,b)=>b[key]-a[key]).reduce((map,x,j)=>{if(j<2)map.set(x.name,j+1);return map;},new Map());
 const inquiryRank=rank('inquiries'),meetingRank=rank('meetings');
 values.sort((a,b)=>b.meetings-a.meetings||(b.inquiries||0)-(a.inquiries||0)||RG_ORDER.indexOf(a.name)-RG_ORDER.indexOf(b.name));
 const mark=(value,place,kind)=>place?`<span class="perf-rank ${kind} rank-${place}"><b>${v10Number(value)}</b><small>${place}위</small></span>`:v10Number(value);
 return {values,rows:values.map(x=>[esc(x.name),mark(x.inquiries,inquiryRank.get(x.name),'inquiry'),mark(x.meetings,meetingRank.get(x.name),'meeting'),v10Rate(x.meetings,x.inquiries),capS(x.capacity),d1(x.avg)+' kW']),inquiryRank,meetingRank};
}
function easyPresentationRegionComment(region){
 const inq=region.values.filter(x=>x.inquiries!==null).slice().sort((a,b)=>b.inquiries-a.inquiries),mt=region.values.slice().sort((a,b)=>b.meetings-a.meetings);
 if(!inq.length)return '지역별 발전사업 문의 원본을 확인할 수 없어 문의 순위는 표시하지 않았습니다.';
 return `발전사업 신규 문의는 ${inq[0].name} ${i(inq[0].inquiries)}건이 가장 많고, ${inq[1]?.name||'다음 권역'} ${i(inq[1]?.inquiries||0)}건이 뒤를 이었습니다. 실제 미팅은 ${mt[0].name} ${i(mt[0].meetings)}건이 가장 많으며 전환율은 ${v10Rate(mt[0].meetings,mt[0].inquiries)}입니다.`;
}
const EASY_PRESENTATION_STAFF_DEFAULT=['조성현','최창민','임준길','진으뜸'];
const easyPresentationStaff={extra:store.get('v10_presentation_staff_extra',[])};
function easyPresentationWeeks(month){
 const block=DB.months?.find(x=>x.m===month),source=block?.wmeet||[];
 return source.map((w,j)=>({label:w.label||w.wk||`${j+1}주차`,week:w.wk||`${j+1}주차`,n:w.n||0,cap:w.cap||0,mkN:w.mkN||0,refN:w.refN||0}));
}
function easyPresentationWeekBounds(label,month){
 return v10ReportWeekBounds(label,month);
}
function easyPresentationWeekRows(month){
 const weeks=easyPresentationWeeks(month),rows=v10Rows([month],'exec');
 if(!weeks.length)return [];
 const assign=r=>Math.min(weeks.length-1,Math.max(0,Math.floor(((Number(r.date?.slice(8,10))||1)-1)/7)));
 return weeks.map((w,j)=>{const bounds=easyPresentationWeekBounds(w.label,month);return {...w,rows:rows.filter(r=>bounds?txt(r.date)>=bounds.start&&txt(r.date)<=bounds.end:assign(r)===j)};});
}
function easyPresentationStaffPanel(month){
 const weekRows=easyPresentationWeekRows(month),all=v10Rows([month],'exec'),available=[...new Set(all.map(r=>r.own||'미지정'))].filter(n=>!EASY_PRESENTATION_STAFF_DEFAULT.includes(n)).sort();
 const selected=[...EASY_PRESENTATION_STAFF_DEFAULT,...easyPresentationStaff.extra.filter(n=>available.includes(n))];
 const picker=`<div class="perf-staff-picker v10-no-print"><strong>추가 담당자 선택</strong>${available.length?available.map(n=>`<label><input type="checkbox" data-perf-staff="${esc(n)}" ${easyPresentationStaff.extra.includes(n)?'checked':''}> ${esc(n)}</label>`).join(''):'<span>추가 담당자가 없습니다.</span>'}</div>`;
 const metric=rows=>{const a=sumRows(rows);return `<b>${i(a.n)}건</b><small>${d1(a.cap)} kW</small>`;};
 const own=(rows,name)=>rows.filter(r=>(r.own||'미지정')===name);
 const cells=(rows,name)=>['마케팅','소개'].map((src,j)=>`<td class="${j===0?'perf-person-start':''}">${metric(own(rows,name).filter(r=>v10Source(r.src)===src))}</td>`).join('');
 const tables=[];
 for(let offset=0;offset<selected.length;offset+=4){
  const names=selected.slice(offset,offset+4);
  tables.push(`<div class="v10-table perf-staff-table"><table><thead><tr><th rowspan="2">기간 / 주차</th>${names.map((name,j)=>`<th colspan="2" class="perf-person-head perf-person-start person-${(offset+j)%4}">${esc(name)}</th>`).join('')}</tr><tr>${names.map(()=>'<th class="perf-person-start perf-marketing-head">마케팅</th><th class="perf-referral-head">소개</th>').join('')}</tr></thead><tbody>${weekRows.map(w=>`<tr><td><b>${esc(w.week)}</b><small>${esc(w.label)}</small></td>${names.map(name=>cells(w.rows,name)).join('')}</tr>`).join('')}<tr class="perf-total"><th>월 소계</th>${names.map(name=>cells(all,name)).join('')}</tr><tr class="perf-staff-month-total"><th>${month}월 전체 실적</th>${names.map((name,j)=>`<td colspan="2" class="perf-person-start person-${(offset+j)%4}">${metric(own(all,name))}<span>마케팅 ${i(own(all,name).filter(r=>v10Source(r.src)==='마케팅').length)}건 · 소개 ${i(own(all,name).filter(r=>v10Source(r.src)==='소개').length)}건${own(all,name).some(r=>v10Source(r.src)==='미분류')?` · 기타 ${i(own(all,name).filter(r=>v10Source(r.src)==='미분류').length)}건`:''}</span></td>`).join('')}</tr></tbody></table></div>`);
 }
 const selectedRows=all.filter(r=>selected.includes(r.own||'미지정')),total=sumRows(selectedRows);
 return picker+tables.join('')+`<div class="perf-data-comment"><strong>선택 담당자 전체 합계</strong><span>${i(total.n)}건 · ${d1(total.cap)} kW</span></div><p class="v10-note">${esc(v10ReportPeriodLabel([month]))}. 다른 달의 날짜도 해당 보고 주차에 속하면 ${month}월 실적에 포함합니다. 전체 실적에는 유입 미분류가 있으면 함께 포함합니다.</p>`;
}
const easyPresentationComments={
 records:RUN_MODE?{}:store.get('v10_presentation_comments_local',{}),
 loaded:{},loading:{},saving:{},message:{},error:{},drafts:{},dirty:{},loadSeq:{},editing:{},available:{},availableLoading:{},months:store.get('v10_presentation_comment_months',{})
};
const easyPresentationCommentKey=(year,month)=>`${Number(year)}-${String(Number(month)).padStart(2,'0')}`;
const easyPresentationPeriodSig=(ms=selMonths())=>[...new Set(ms.map(Number))].sort((a,b)=>a-b).join(',');
function easyPresentationCommentMonth(ms=selMonths()){
 const months=[...new Set(ms.map(Number).filter(m=>m>=1&&m<=12))].sort((a,b)=>a-b);
 // A month picked in the editor sticks while the dashboard period stays the same,
 // so last month's presentation can be opened while the period shows this month.
 const choice=easyPresentationComments.months[DB.year];
 if(choice&&typeof choice==='object'&&choice.period===easyPresentationPeriodSig(ms)&&Number(choice.month)>=1&&Number(choice.month)<=12)return Number(choice.month);
 if(months.length===1)return months[0];
 const saved=Number(choice&&typeof choice==='object'?choice.month:choice);
 return months.includes(saved)?saved:(months[months.length-1]||Number(v10Today().slice(5,7)));
}
function easyPresentationCommentBlank(year,month){return {year:Number(year),month:Number(month),text:'',updatedAt:'',updatedBy:'',locked:false,hasPrevious:false,seeded:false};}
function easyPresentationCommentParts(text){
 const raw=txt(text);if(!raw)return {analysis:'',inquiryAnalysis:'',improvement:''};
 try{
  const parsed=JSON.parse(raw);
  if(parsed?.version===3)return {analysis:txt(parsed.analysis),inquiryAnalysis:txt(parsed.inquiryAnalysis),improvement:txt(parsed.improvement)};
  if(parsed?.version===2)return {analysis:txt(parsed.analysis),inquiryAnalysis:'',improvement:txt(parsed.improvement)};
 }catch(error){}
 return {analysis:raw,inquiryAnalysis:'',improvement:''};
}
function easyPresentationCommentText(parts){return parts.analysis||parts.inquiryAnalysis||parts.improvement?JSON.stringify({version:3,analysis:txt(parts.analysis),inquiryAnalysis:txt(parts.inquiryAnalysis),improvement:txt(parts.improvement)}):'';}
function easyPresentationCommentFormText(form){
 const key=easyPresentationCommentKey(form.dataset.year,form.dataset.month),data=new FormData(form);
 const previous=easyPresentationCommentParts(easyPresentationComments.drafts[key]??easyPresentationComments.records[key]?.text??'');
 return easyPresentationCommentText({analysis:data.get('analysis'),inquiryAnalysis:data.get('inquiryAnalysis')??previous.inquiryAnalysis,improvement:data.get('improvement')});
}
function easyPresentationDefaultParts(month){return {
 analysis:`종합분석\n\n· 목표 대비 실적: \n· 원인 및 특이사항: \n· 발표 핵심: `,
 inquiryAnalysis:'',
 improvement:`${month}월 개선방안\n\n① 마케팅\n· \n\n② 컨설팅\n· \n\n③ 한전수전합리화 사업\n· \n\n④ 교육 및 역량 강화\n· `
};}
function easyPresentationCommentRPC(name,...args){return new Promise((resolve,reject)=>{
 if(!RUN_MODE){reject(Error('운영 대시보드에서 팀 공용 저장소에 연결됩니다.'));return;}
 let settled=false;
 const timer=setTimeout(()=>{if(settled)return;settled=true;reject(Error('코멘트 저장소 응답이 늦습니다. 작성한 내용은 유지되며 다시 저장할 수 있습니다.'));},12000);
 const done=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
 try{google.script.run.withSuccessHandler(value=>done(resolve,value)).withFailureHandler(e=>done(reject,Error(e?.message||String(e))))[name](...args);}
 catch(error){done(reject,error);}
});}
// A record is read-only once confirmed, until the reporter presses 수정하기.
const easyPresentationCommentLocked=(record,key)=>!!(record?.locked&&(record.text||record.seeded))&&!easyPresentationComments.editing[key];
function easyEnsurePresentationMonths(year){
 const y=Number(year);
 if(!RUN_MODE||easyPresentationComments.available[y]||easyPresentationComments.availableLoading[y])return;
 easyPresentationComments.availableLoading[y]=true;
 setTimeout(async()=>{
  try{const list=await easyPresentationCommentRPC('listPresentationCommentMonths',y);easyPresentationComments.available[y]=Array.isArray(list)?list.map(Number):[];if(state.sect==='presentation')render();}
  catch(error){/* the picker works without the saved-month marks */}
  finally{easyPresentationComments.availableLoading[y]=false;}
 },0);
}
function easyEnsurePresentationComment(year,month){
 const key=easyPresentationCommentKey(year,month);
 if(easyPresentationComments.loaded[key]||easyPresentationComments.loading[key]||easyPresentationComments.saving[key])return;
 if(!RUN_MODE){easyPresentationComments.records[key]=easyPresentationComments.records[key]||easyPresentationCommentBlank(year,month);easyPresentationComments.loaded[key]=true;return;}
 const seq=(easyPresentationComments.loadSeq[key]||0)+1;easyPresentationComments.loadSeq[key]=seq;easyPresentationComments.loading[key]=true;easyPresentationComments.error[key]='';
 setTimeout(async()=>{
  try{
   const record=await easyPresentationCommentRPC('getPresentationComment',Number(year),Number(month));if(easyPresentationComments.loadSeq[key]!==seq)return;
   easyPresentationComments.records[key]=record;easyPresentationComments.loaded[key]=true;easyPresentationComments.error[key]='';
   if(!easyPresentationComments.dirty[key])easyPresentationComments.drafts[key]=record.text||'';
  }
  catch(error){if(easyPresentationComments.loadSeq[key]===seq){easyPresentationComments.loaded[key]=true;easyPresentationComments.error[key]=error.message||String(error);}}
  finally{if(easyPresentationComments.loadSeq[key]===seq){easyPresentationComments.loading[key]=false;if(state.sect==='presentation')render();}}
 },0);
}
const easyPresentationStamp=at=>at?new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'';
function easyPresentationCommentStatus(record,key){
 if(easyPresentationComments.error[key])return `<span class="perf-comment-error" role="alert">${esc(easyPresentationComments.error[key])}</span><button class="btn" type="button" data-v10-action="presentationCommentRetry" data-year="${record.year}" data-month="${record.month}">저장 내용 다시 불러오기</button>`;
 if(easyPresentationComments.loading[key])return '<span role="status">저장된 코멘트 확인 중… 지금 바로 작성할 수 있습니다.</span>';
 if(easyPresentationComments.message[key])return `<span class="perf-comment-success" role="status">${esc(easyPresentationComments.message[key])}</span>`;
 if(record?.seeded)return `<span class="perf-comment-locked">발표 확정본 · ${esc(easyPresentationStamp(record.updatedAt))} 발표분이 코드에 보관되어 있습니다. 저장을 누르면 팀 저장소에도 기록됩니다.</span>`;
 if(record?.updatedAt){const at=easyPresentationStamp(record.updatedAt);return `<span class="${record.locked?'perf-comment-locked':''}">${record.locked?'확정됨 · ':''}마지막 저장 ${esc(at)}${record.updatedBy?' · '+esc(record.updatedBy):''}</span>`;}
 return '<span>아직 저장된 코멘트가 없습니다.</span>';
}
function easyPresentationCommentEditor(ms){
 const month=easyPresentationCommentMonth(ms),key=easyPresentationCommentKey(DB.year,month);easyEnsurePresentationComment(DB.year,month);easyEnsurePresentationMonths(DB.year);
 const record=easyPresentationComments.records[key]||easyPresentationCommentBlank(DB.year,month),saving=!!easyPresentationComments.saving[key];
 if(!Object.hasOwn(easyPresentationComments.drafts,key))easyPresentationComments.drafts[key]=record.text||'';
 const draft=easyPresentationComments.drafts[key],draftParts=easyPresentationCommentParts(draft),parts=draft?draftParts:easyPresentationDefaultParts(month),saved=easyPresentationCommentParts(record.text);
 const locked=easyPresentationCommentLocked(record,key),readonly=locked||saving;
 const periodMonths=new Set(ms.map(Number)),available=new Set((easyPresentationComments.available[DB.year]||[]).map(Number));
 const options=Array.from({length:12},(_,j)=>j+1).map(m=>`<option value="${m}" ${m===month?'selected':''}>${m}월${available.has(m)?' ✓ 저장됨':''}${periodMonths.has(m)&&!available.has(m)?' · 조회 중인 기간':''}</option>`).join('');
 const inquiryAnalysis=easyPresentationInsights(month);
 const actions=locked
  ?`<button class="btn primary" type="button" data-v10-action="presentationCommentEdit" data-year="${DB.year}" data-month="${month}">수정하기</button>${record.hasPrevious?`<button class="btn" type="button" data-v10-action="presentationCommentRestore" data-year="${DB.year}" data-month="${month}">이전 저장본으로 되돌리기</button>`:''}`
  :`<button class="btn primary" ${saving?'disabled':''}>${saving?'저장 중…':'저장하고 확정'}</button>${record.text||record.seeded?`<button class="btn" type="button" data-v10-action="presentationCommentCancel" data-year="${DB.year}" data-month="${month}">취소</button>`:''}${record.hasPrevious?`<button class="btn" type="button" data-v10-action="presentationCommentRestore" data-year="${DB.year}" data-month="${month}">이전 저장본으로 되돌리기</button>`:''}`;
 const guide=locked?'확정된 코멘트는 그대로 유지됩니다. 고치려면 <b>수정하기</b>를 누른 뒤 저장하세요.':'저장하면 확정되어 다시 <b>수정하기</b>를 누르기 전에는 바뀌지 않습니다. 같은 연도·월을 다시 열면 저장한 내용이 표시됩니다.';
 return `<div class="perf-comment-editor v10-no-print${locked?' perf-comment-readonly':''}"><div class="perf-comment-head"><div><h3>발표 코멘트 작성·저장</h3><p>왼쪽 위에는 자동 집계된 문의 분석을 표시하고, 그 아래 종합분석과 오른쪽 개선방안을 직접 작성합니다. ${guide}</p></div><label>코멘트 월<select id="easyPresentationCommentMonth" aria-label="코멘트 월">${options}</select></label></div><form id="easyPresentationCommentForm" data-year="${DB.year}" data-month="${month}" data-locked="${locked?'1':'0'}"><div class="perf-comment-columns"><div class="perf-comment-analysis-stack"><section class="perf-auto-inquiry"><div class="perf-comment-block-title"><strong>문의 분석</strong><span>문의·미팅·계약 실적 자동 집계</span></div>${inquiryAnalysis}</section><label><strong>종합분석</strong><span>목표 대비 실적의 원인과 발표 핵심</span><textarea name="analysis" maxlength="1600" ${readonly?'readonly':''}>${esc(parts.analysis)}</textarea></label></div><label class="perf-comment-improvement"><strong>개선방안</strong><span>마케팅·컨설팅·사업·교육별 실행 계획</span><textarea name="improvement" maxlength="1600" ${readonly?'readonly':''}>${esc(parts.improvement)}</textarea></label></div><div class="perf-comment-actions">${actions}${easyPresentationCommentStatus(record,key)}<small id="easyPresentationCommentCount">${(parts.analysis.length+parts.improvement.length).toLocaleString()} / 3,200자</small></div></form></div><div class="perf-comment-print"><div><h3>문의 분석</h3>${inquiryAnalysis}<h3>종합분석</h3><p>${saved.analysis?esc(saved.analysis):'저장된 종합분석이 없습니다.'}</p></div><div><h3>개선방안</h3><p>${saved.improvement?esc(saved.improvement):'저장된 개선방안이 없습니다.'}</p></div>${record.updatedAt?`<small>${record.seeded?'발표 확정본 ':'저장 '}${esc(easyPresentationStamp(record.updatedAt))}</small>`:''}</div>`;
}
async function easySavePresentationComment(form){
 const year=Number(form.dataset.year),month=Number(form.dataset.month),key=easyPresentationCommentKey(year,month),text=easyPresentationCommentFormText(form);
 if(easyPresentationComments.saving[key])return;
 const record=easyPresentationComments.records[key];
 if(easyPresentationCommentLocked(record,key))return; // a confirmed comment is never overwritten by an Enter key or stray submit
 easyPresentationComments.drafts[key]=text;easyPresentationComments.dirty[key]=true;easyPresentationComments.loadSeq[key]=(easyPresentationComments.loadSeq[key]||0)+1;easyPresentationComments.loading[key]=false;easyPresentationComments.saving[key]=true;easyPresentationComments.message[key]='';easyPresentationComments.error[key]='';render();
 try{
  const force=!!(record?.locked&&easyPresentationComments.editing[key]);
  const saved=RUN_MODE?await easyPresentationCommentRPC('savePresentationComment',{year,month,text,force}):{...easyPresentationCommentBlank(year,month),text,locked:!!text,updatedAt:new Date().toISOString()};
  easyPresentationComments.records[key]=saved;easyPresentationComments.drafts[key]=saved.text||'';easyPresentationComments.dirty[key]=false;easyPresentationComments.loaded[key]=true;easyPresentationComments.editing[key]=false;easyPresentationComments.message[key]=text?`${year}년 ${month}월 코멘트를 저장하고 확정했습니다.`:`${year}년 ${month}월 저장 코멘트를 비웠습니다.`;
  if(easyPresentationComments.available[year]){const set=new Set(easyPresentationComments.available[year]);if(text)set.add(month);else set.delete(month);easyPresentationComments.available[year]=[...set].sort((a,b)=>a-b);}
  if(!RUN_MODE){store.set('v10_presentation_comments_local',easyPresentationComments.records);}
 }catch(error){easyPresentationComments.error[key]=error.message||String(error);}
 finally{easyPresentationComments.saving[key]=false;render();}
}
async function easyRestorePresentationComment(year,month){
 const key=easyPresentationCommentKey(year,month);
 if(easyPresentationComments.saving[key])return;
 easyPresentationComments.saving[key]=true;easyPresentationComments.message[key]='';easyPresentationComments.error[key]='';render();
 try{
  const saved=await easyPresentationCommentRPC('restorePresentationComment',Number(year),Number(month));
  easyPresentationComments.records[key]=saved;easyPresentationComments.drafts[key]=saved.text||'';easyPresentationComments.dirty[key]=false;easyPresentationComments.loaded[key]=true;easyPresentationComments.editing[key]=false;easyPresentationComments.message[key]=`${year}년 ${month}월 코멘트를 이전 저장본으로 되돌렸습니다.`;
 }catch(error){easyPresentationComments.error[key]=error.message||String(error);}
 finally{easyPresentationComments.saving[key]=false;render();}
}
function easyDownloadPresentationPdf(){
 const month=easyPresentationCommentMonth(),before=document.title;
 document.title=`${DB.year}년_${String(month).padStart(2,'0')}월_컨설팅_실적발표`;
 try{window.print();}finally{document.title=before;}
}
const easyPerfMW=value=>value===null||value===undefined?'—':(value/1000).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2});
function easyPresentationSource(a){
 const powerRows=a.rows.filter(r=>/^발전사업/.test(r.type));
 return {mkAll:a.total,mkPower:a.pwrMk,mkMeet:powerRows.filter(r=>v10Source(r.src)==='마케팅').length,refAll:a.inqRef,refPower:a.pwrRef,refMeet:powerRows.filter(r=>v10Source(r.src)==='소개').length};
}
function easyPresentationInsights(month){
 const a=v10Aggregate([month]),s=easyPresentationSource(a),weeks=easyPresentationWeeks(month),goal=weeks.length*17,c=contractAggregate([month],{filtered:false});
 const cards=[
  ['marketing','마케팅 문의 → 미팅',[['전체 문의',v10Number(s.mkAll)+'건'],['발전사업 문의',v10Number(s.mkPower)+'건'],['미팅',i(s.mkMeet)+'건'],['전환율',v10Rate(s.mkMeet,s.mkPower)]]],
  ['referral','소개 문의 → 미팅',[['전체 문의',v10Number(s.refAll)+'건'],['발전사업 문의',v10Number(s.refPower)+'건'],['미팅',i(s.refMeet)+'건'],['전환율',v10Rate(s.refMeet,s.refPower)]]],
  ['meeting','사업주 미팅 목표',[['주 목표','17건'],['보고 주차',i(weeks.length)+'주'],['월 목표',goal?i(goal)+'건':'—'],['진행 미팅',i(a.actual)+'건'],['달성률',goal?v10Rate(a.actual,goal):'—'],['잔여',goal?i(Math.max(goal-a.actual,0))+'건':'—'],['보고 기간',v10ReportPeriodLabel([month]).replace('보고 주차 기준 · ','')]]],
  ['contract','계약 실적',c.covered?[['계약 건수',i(c.count)+'건'],['계약 용량',easyPerfMW(c.capacity)+' MW'],['공사금액',contractMoney(c.amount)]]:[['계약 건수','—'],['계약 용량','—'],['공사금액','—']]]
 ];
 return `<div class="perf-inquiry-metrics">${cards.map(([kind,title,items])=>`<article class="${kind}"><h4>${esc(title)}</h4><dl>${items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></article>`).join('')}</div>`;
}
function easyPresentationContractComparison(title,months){
 const categories=['전체','직영','외주','입찰'],rows=categories.map(category=>{const goal=contractGoal(category,months),actual=contractCategoryAggregate(months,category);return {category,goal,actual:actual.capacity,count:actual.count};});
 const chart=v10Panel(title,'목표(주황)와 계약 실적(초록)을 유형별로 비교합니다. 단위: MW',chartBars({labels:categories,series:[{name:'목표',color:V10.colors[1],values:rows.map(x=>x.goal===null?null:x.goal/1000)},{name:'실적',color:V10.colors[4],values:rows.map(x=>x.actual/1000)}],unit:'MW',fmt:v=>Number(v).toFixed(2),height:250,stacked:false,noTable:true,horizontalValues:true}));
 const table=`<div class="perf-contract-table"><p class="v10-note">${esc(title)} · 단위: MW</p>${v10Table(['구분','목표 용량','계약 용량','계약 건수','달성률','잔여'],rows.map(x=>[x.category,easyPerfMW(x.goal),easyPerfMW(x.actual),i(x.count)+'건',v10Rate(x.actual,x.goal),x.goal===null?'—':easyPerfMW(Math.max(x.goal-x.actual,0))]))}</div>`;
 return chart+table;
}
function easyPresentationCapacityMatrix(last){
 const labels=['50 kW 미만','50~100 kW','100~300 kW','300~500 kW','500~1,000 kW','1,000~1,500 kW','1,500~2,000 kW','2,000 kW 이상'];
 const rows=[];let selectedSummary='';
 for(let m=1;m<=last;m++){
  const block=DB.months?.find(x=>x.m===m),reportRows=v10Rows([m],'exec'),complete=v10ReportLedgerComplete([m]);
  const limits=[50,100,300,500,1000,1500,2000,Infinity];
  const values=labels.map((_,j)=>complete?reportRows.filter(r=>r.cap>=(j?limits[j-1]:0)&&r.cap<limits[j]).length:Number(block?.buckets?.[j]?.n)||0),top=[...new Set(values.filter(v=>v>0))].sort((a,b)=>b-a).slice(0,2),total=complete?reportRows.length:Number(block?.bkTot)||values.reduce((s,v)=>s+v,0),avg=complete?(total?v10Sum(reportRows,'cap')/total:0):Number(block?.bkAvg)||0;
  rows.push([m+'월',...values.map(v=>{const rank=top.indexOf(v)+1;return rank?`<span class="perf-band-rank rank-${rank}"><b>${i(v)}</b><small>${values.filter(n=>n===v).length>1?'공동 ':''}${rank}위</small></span>`:i(v);}),i(total)+'건',d1(avg)+' kW/건']);
  if(m===last)selectedSummary=top.map((value,j)=>`${j+1}위 ${values.map((v,k)=>v===value?labels[k]:null).filter(Boolean).join(' · ')} (${i(value)}건)`).join(' / ');
 }
 return `<p class="perf-band-summary"><strong>${last}월 주요 용량 구간</strong> ${esc(selectedSummary||'집계된 미팅이 없습니다.')}</p><div class="perf-capacity-table">${v10Table(['월',...labels,'총 미팅','평균 용량'],rows)}</div>`;
}
function easyPresentationMeetingMonth(month){
 const selected=v10Aggregate([month]),weeks=easyPresentationWeeks(month);
 const weekChart=v10Panel(`${month}월 주차별 사업주 미팅`,v10ReportPeriodLabel([month])+' · 실제 미팅만 막대로 표시하며 주 목표 17건은 아래 표에서 비교합니다.',chartBars({labels:weeks.map(w=>w.week),series:[{name:'마케팅',color:'#eb6834',values:weeks.map(w=>w.mkN)},{name:'소개',color:'#2364d2',values:weeks.map(w=>w.refN)}],unit:'건',fmt:i,height:245,stacked:true,noTable:true}));
 const weeklyGoal=17;
 const totals={n:weeks.reduce((s,w)=>s+w.n,0),cap:weeks.reduce((s,w)=>s+w.cap,0),goal:weeks.length*weeklyGoal};
 const weekTable=`<div class="v10-table perf-week-table"><table><thead><tr>${['기간','주차','주 목표','미팅 건수','미팅 용량 (kW)','달성률'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${weeks.map(w=>`<tr class="${w.n>=weeklyGoal?'perf-goal-met':''}"><td>${esc(w.label)}</td><td>${esc(w.week)}</td><td>${i(weeklyGoal)}건</td><td><b>${i(w.n)}건</b></td><td>${d1(w.cap)}</td><td>${v10Rate(w.n,weeklyGoal)}${w.n>=weeklyGoal?'<span class="perf-achieved">목표 달성</span>':''}</td></tr>`).join('')}<tr class="perf-total"><th colspan="2">전체 합계</th><td>${i(totals.goal)}건</td><td>${i(totals.n)}건</td><td>${d1(totals.cap)}</td><td>${v10Rate(totals.n,totals.goal)}</td></tr></tbody></table></div>`;
 const kpis=`<div class="perf-source-kpis"><article class="perf-source-card meeting marketing"><span>${month}월 보고 실적</span><h3>사업주 미팅</h3><strong>${i(selected.actual)}<small>건</small></strong><p>월별 보고 주차 기준</p></article><article class="perf-source-card inquiry marketing"><span>${month}월 미팅 용량</span><h3>총 미팅 용량</h3><strong>${capS(selected.actualCap)}</strong><p>사업주 미팅 전체 용량</p></article><article class="perf-source-card meeting referral"><span>${month}월 평균</span><h3>건당 평균 용량</h3><strong>${d1(selected.avg)}<small>kW</small></strong><p>총 용량 ÷ 진행 건수</p></article><article class="perf-source-card inquiry referral"><span>유입 구분</span><h3>마케팅 / 소개</h3><strong>${i(selected.actualMk)} / ${i(selected.actualRef)}<small>건</small></strong><p>월별 보고 주차 기준</p></article></div>`;
 return kpis+weekChart+weekTable+v10Panel(`1~${month}월 미팅 용량 구간`,'각 월 미팅 건수 1위(노랑)·2위(파랑)를 강조했습니다. 동점은 공동 순위로 표시합니다.',easyPresentationCapacityMatrix(month));
}
function easyPresentationHighlightMonthTable(table,month){
 return table.replace(new RegExp(`(<tr><td>${Number(month)}월</td>)([\\s\\S]*?)(</tr>)`),(_,start,cells,end)=>start+cells.replace(/(<td[^>]*>)([\s\S]*?)(<\/td>)/g,(_,open,value,close)=>open+(/\d/.test(value)?`<span class="perf-value-highlight">${value}</span>`:value)+close)+end);
}
function easyPresentation(){
 const ms=selMonths(),month=easyPresentationCommentMonth(ms),monthSet=[month],axis=easyTrendAxis().filter(g=>Math.min(...g.months)<=month),monthly=axis.map(g=>v10Aggregate(g.months));
 const ytdMonths=Array.from({length:month},(_,j)=>j+1),selected=v10Aggregate(monthSet);
 const now=v10Today(),nowYear=Number(now.slice(0,4)),nowMonth=Number(now.slice(5,7));
 const quarters=Array.from({length:4},(_,q)=>({label:`${q+1}분기`,months:[q*3+1,q*3+2,q*3+3]}));
 const quarterData=quarters.map(q=>{const actual=contractAggregate(q.months,{filtered:false}),goal=contractGoal('전체',q.months),future=Number(DB.year)===nowYear&&q.months[0]>nowMonth;return {...q,actual:future?null:actual.capacity,goal};});
 const sourceMonthly=monthly.map(easyPresentationSource);
 const {mkMeet:selectedMkMeet,refMeet:selectedRefMeet}=easyPresentationSource(selected);
 const sourceKpis=`<div class="perf-source-kpis">
  <article class="perf-source-card inquiry marketing"><span>발전사업 문의 · ${month}월</span><h3>마케팅 문의</h3><strong>${v10Number(selected.pwrMk)}<small>건</small></strong><p>마케팅으로 접수된 발전사업 문의</p></article>
  <article class="perf-source-card meeting marketing"><span>마케팅 문의 → 미팅</span><h3>마케팅 미팅</h3><strong>${i(selectedMkMeet)}<small>건</small></strong><p><b>${v10Rate(selectedMkMeet,selected.pwrMk)} 전환</b> · 마케팅 발전사업 문의 대비</p></article>
  <article class="perf-source-card inquiry referral"><span>발전사업 문의 · ${month}월</span><h3>소개 문의</h3><strong>${v10Number(selected.pwrRef)}<small>건</small></strong><p>소개로 접수된 발전사업 문의</p></article>
  <article class="perf-source-card meeting referral"><span>소개 문의 → 미팅</span><h3>소개 미팅</h3><strong>${i(selectedRefMeet)}<small>건</small></strong><p><b>${v10Rate(selectedRefMeet,selected.pwrRef)} 전환</b> · 소개 발전사업 문의 대비</p></article>
 </div>`;
 const marketingSeries=[{name:'전체 문의',color:'#8793a3',values:sourceMonthly.map(x=>x.mkAll)},{name:'발전사업 문의',color:'#2a78d6',values:sourceMonthly.map(x=>x.mkPower)},{name:'미팅',color:'#eb6834',values:sourceMonthly.map(x=>x.mkMeet)}];
 const referralSeries=[{name:'전체 문의',color:'#8793a3',values:sourceMonthly.map(x=>x.refAll)},{name:'발전사업 문의',color:'#d38a00',values:sourceMonthly.map(x=>x.refPower)},{name:'미팅',color:'#2364d2',values:sourceMonthly.map(x=>x.refMeet)}];
 const sourceTable=`<div class="v10-table perf-source-table"><table><thead><tr><th rowspan="2">월</th><th colspan="4" class="perf-marketing-head">마케팅</th><th colspan="4" class="perf-referral-head perf-source-divider">소개</th></tr><tr>${['마케팅','소개'].map((src,j)=>['전체 문의','발전사업 문의','미팅','전환율'].map((h,k)=>`<th class="${j?'perf-referral-head':'perf-marketing-head'} ${j&&k===0?'perf-source-divider':''}">${h}</th>`).join('')).join('')}</tr></thead><tbody>${axis.map((g,j)=>{const x=sourceMonthly[j];return `<tr><td>${esc(g.label)}</td><td>${v10Number(x.mkAll)}</td><td class="perf-mk-inquiry">${v10Number(x.mkPower)}</td><td class="perf-mk-meeting">${i(x.mkMeet)}</td><td><b>${v10Rate(x.mkMeet,x.mkPower)}</b></td><td class="perf-source-divider">${v10Number(x.refAll)}</td><td class="perf-ref-inquiry">${v10Number(x.refPower)}</td><td class="perf-ref-meeting">${i(x.refMeet)}</td><td><b>${v10Rate(x.refMeet,x.refPower)}</b></td></tr>`;}).join('')}</tbody></table></div>`;
 const yearMonths=Array.from({length:12},(_,j)=>j+1),annualGoal=contractGoal('전체',yearMonths),annualActual=contractAggregate(yearMonths,{filtered:false}).capacity;
 const quarterRows=quarterData.map(q=>[q.label,easyPerfMW(q.goal),easyPerfMW(q.actual),v10Rate(q.actual,q.goal),q.actual===null||q.goal===null?'—':easyPerfMW(Math.max(q.goal-q.actual,0))]);
 quarterRows.push(['연간 합계',easyPerfMW(annualGoal),easyPerfMW(annualActual),v10Rate(annualActual,annualGoal),annualGoal===null?'—':easyPerfMW(Math.max(annualGoal-annualActual,0))].map(v=>`<strong>${v}</strong>`));
 const quarterTable=`<div class="perf-quarter-table"><p class="v10-note">단위: MW · 연간 합계는 해당 계약연도 전체 원장 실적입니다.</p>${v10Table(['분기','계약 목표','실제 계약 용량','달성률','잔여'],quarterRows)}</div>`;
 const region=easyPresentationRegion(monthSet);
 const quarterChart=v10Panel('분기별 계약 용량','분기마다 목표와 실적을 나란히 비교합니다. 단위: MW',chartBars({labels:quarters.map(q=>q.label),series:[{name:'목표',color:V10.colors[1],values:quarterData.map(q=>q.goal===null?null:q.goal/1000)},{name:'실적',color:V10.colors[4],values:quarterData.map(q=>q.actual===null?null:q.actual/1000)}],unit:'MW',fmt:v=>Number(v).toFixed(2),height:280,stacked:false,noTable:true,horizontalValues:true}));
 return `<div class="perf-deck"><div class="perf-cover"><div><span class="perf-eyebrow">GRANDSUN · CONSULTING PERFORMANCE</span><h2>${esc(DB.year)}년 ${month}월<br>컨설팅 실적발표</h2><p>계약·문의·사업주 미팅 실적을 실제 원본과 선택 월에 맞춰 구성했습니다.</p></div><div class="perf-cover-actions"><span>${v10Scoped()?'상세 조건 적용':'부서 전체'}</span></div></div>`
 +easyPerfSlide(1,'분기별 계약 목표와 실적',`${DB.year}년 계약 원장 연도·보고 월 기준`,quarterChart+quarterTable)
 +easyPerfSlide(2,`${month}월과 누적 계약 실적`,'전체·직영·외주·입찰의 목표와 계약 용량을 같은 기준으로 비교합니다.',`<div class="perf-two">${easyPresentationContractComparison(`${month}월`,monthSet)}${easyPresentationContractComparison(`1~${month}월 누적`,ytdMonths)}</div>`)
 +easyPerfSlide(3,'발전사업 신규 문의와 미팅','마케팅과 소개를 분리하고, 문의 접수월 기준으로 후속 미팅을 연결합니다.',sourceKpis+`<p class="v10-note">선택한 보고 월: ${month}월 · 해당 월의 숫자만 강조했습니다.</p><div class="perf-source-charts">${v10Line('마케팅 신규 문의와 미팅','전체 문의·발전사업 문의·미팅의 월별 추세',axis,marketingSeries,'건',{tableAlwaysOpen:true,highlightLabel:month+'월'})}${v10Line('소개 신규 문의와 미팅','전체 문의·발전사업 문의·미팅의 월별 추세',axis,referralSeries,'건',{tableAlwaysOpen:true,highlightLabel:month+'월'})}</div>`+easyPresentationHighlightMonthTable(sourceTable,month))
 +easyPerfSlide(4,`${month}월 지역별 발전사업 신규 문의·미팅`,'마케팅·소개 발전사업 문의만 집계하며 문의월 기준 후속 미팅을 연결합니다.',`<div class="perf-region-table">${v10Table(['권역','발전사업 문의','미팅','전환율','미팅 용량','평균 용량'],region.rows)}</div>`+`<p class="perf-region-guide"><strong>권역 구분</strong> 수도권: 서울·경기·인천 / 충청권: 대전·세종·충북·충남 / 강원권: 강원<br>영남권: 부산·대구·울산·경북·경남 / 호남권: 광주·전북·전남 / 제주: 제주</p><div class="perf-data-comment"><strong>지역별 코멘트</strong><span>${esc(easyPresentationRegionComment(region))}</span></div>`)
 +easyPerfSlide(5,`${month}월 사업주 미팅 현황`,`${month}월 ${v10ReportPeriodLabel([month])}. 앞뒤 달의 날짜도 해당 보고 주차에 속하면 ${month}월 실적에 포함합니다.`,easyPresentationMeetingMonth(month))
 +easyPerfSlide(6,`${month}월 담당자별 사업주 미팅`,'기본 담당자 4명의 마케팅·소개 미팅을 주차별로 표시하며 다른 담당자를 추가할 수 있습니다.',easyPresentationStaffPanel(month))
 +easyPerfSlide(7,'종합분석 및 개선방안','자동 집계된 문의 분석을 확인하고 종합분석과 개선방안을 직접 작성합니다.',easyPresentationCommentEditor(monthSet)+`<div class="perf-next"><strong>집계 기준</strong><span>문의 후속 미팅은 문의월 기준, 사업주 미팅은 월별 보고 주차 기준, 계약은 RPS 원장의 계약연도·보고 월 기준입니다.</span></div>`)
 +'</div>';
}
function easyGoals(){
 const targets=`<div class="v10-kpis">${v10Card('전체 문의 · 일 목표',i(EASY_INQUIRY_TARGETS.daily)+' 건','하루 목표',V10.colors[0],'goal')}${v10Card('전체 문의 · 주 목표',i(EASY_INQUIRY_TARGETS.weekly)+' 건','월~금 조회 · 독립 설정',V10.colors[1],'goal')}${v10Card('전체 문의 · 월 목표',i(EASY_INQUIRY_TARGETS.monthly)+' 건','월 기본 목표',V10.colors[3],'goal')}</div>`;
 const nav=`<div class="easy-goalmode"><button class="${easyGoalState.mode==='week'?'on':''}" data-easy-goal-mode="week">주간 목표 · 52주</button><button class="${easyGoalState.mode==='month'?'on':''}" data-easy-goal-mode="month">월간 목표</button></div>`;
 if(easyGoalState.mode==='week')return targets+nav+easyWeeklyGoals();
 const html=easyGoalOriginal();
 return targets+nav+html.replace(/(<section class="v10-panel"><h3>월별 목표 설정[\s\S]*?<\/form><\/section>)/, '<details class="easy-details"><summary>목표를 새로 입력하거나 수정하기</summary>$1</details>');
}
if(!SECTIONS.some(s=>s.k==='presentation'))SECTIONS.push({k:'presentation',t:'실적발표',g:'보고',basis:'cohort'});
for(let j=SECTIONS.length-1;j>=0;j--)if(SECTIONS[j].k==='overall')SECTIONS.splice(j,1);
Object.assign(VIEWS,{overall:easyOverview,inquiry:easyInquiry,meetCoh:easyInquiry,meetExe:easyActivity,cons:()=>easyPeople('cons'),owner:()=>easyPeople('own'),source:()=>easyMarket('source'),corp:()=>easyMarket('corp'),region:()=>easyMarket('region'),capacity:()=>easyMarket('capacity'),goal:easyGoals,report:easyReport,presentation:easyPresentation});
renderNav=function(){
 const active=easyMenuGroup(state.sect);
 $('#nav').innerHTML='<div class="grp">업무별 대시보드</div>'+EASY_MENU.map((s,ix)=>{
  const on=active===s.k;
  const children=on&&s.items.length>1?`<div class="easy-nav-children" aria-label="${esc(s.label)} 세부 메뉴">${s.items.map(([key,label])=>`<button class="easy-nav-child${state.sect===key||key==='inquiry'&&state.sect==='meetCoh'||key==='source'&&['corp','region','capacity'].includes(state.sect)||key==='owner'&&state.sect==='cons'?' on':''}" data-sect="${key}"><span></span>${esc(label)}</button>`).join('')}</div>`:'';
  return `<button class="nav easy-nav-group${on?' on':''}" data-sect="${s.open}" title="${esc(s.sub)}" aria-expanded="${on&&s.items.length>1?'true':'false'}"><span class="ix">${String(ix+1).padStart(2,'0')}</span><span>${esc(s.label)}</span></button>${children}`;
 }).join('');
 const selected=EASY_MENU.find(x=>x.k===active);
 $('#sectTitle').textContent=selected?.label||sectOf(state.sect).t;
 $('#easyPresentationPdf')?.classList.toggle('hide',state.sect!=='presentation');
 if($('#easySubtitle'))$('#easySubtitle').textContent=selected?.sub||'선택 조건의 상세 자료';
};
function easyFilterCount(){return ['owner','cons','type','src','corp','region'].filter(k=>state[k]&&state[k]!=='전체').length+(state.query?1:0);}
const easyPeriodOriginal=renderPeriod;
renderPeriod=function(){
 easyPeriodOriginal();
 const month=$('#easyMonth');
 if(month)month.value=state.mode==='month'&&state.months.length===1?String(state.months[0]):'custom';
 const count=easyFilterCount();
 $('#easyFilterToggle').innerHTML='상세 조건'+(count?` <span class="easy-count">${count}</span>`:'');
 const names=[state.cons!=='전체'?'컨설팅 '+state.cons:'',state.owner!=='전체'?'현장 '+state.owner:'',...['type','src','corp','region'].map(k=>state[k]!=='전체'?state[k]:'')].filter(Boolean);
 const partial=Number(DB.year)===Number(v10Today().slice(0,4))&&selMonths().includes(Number(v10Today().slice(5,7)));
 $('#easyPeriodNote').textContent=`${DB.year}년 ${periodLabel()} · ${names.length?names.join(' / '):'부서 전체'}${partial?' · 이번 달은 진행 중인 실적입니다.':''}`;
 document.querySelectorAll('[data-easy-preset]').forEach(b=>{
  const p=b.dataset.easyPreset,now=Number(v10Today().slice(5,7));
  b.classList.toggle('on',p==='this'&&state.mode==='month'&&state.months.length===1&&state.months[0]===now&&Number(DB.year)===Number(v10Today().slice(0,4)));
 });
 // 분기·연 누적 목록: 현재 조회 상태를 목록에 반영하고, 연 누적에는 자료가 있는 연도를 모두 보여 준다.
 const quarter=$('#easyQuarter'),ytd=$('#easyYtd');
 if(quarter){const q=state.mode==='quarter'&&state.quarters.length===1?String(state.quarters[0]):'';quarter.value=q;quarter.classList.toggle('on',!!q);if(quarter.options?.[0])quarter.options[0].textContent=q?`${q}분기 ▾`:'분기 ▾';}
 if(ytd){const years=v10Years();ytd.innerHTML=`<option value="">연 누적 ▾</option>`+years.map(y=>`<option value="${y}">${y}년 누적</option>`).join('');const cur=state.mode==='cumulative'?String(DB.year):'';ytd.value=cur;ytd.classList.toggle('on',!!cur);if(ytd.options?.[0])ytd.options[0].textContent=cur?`${cur}년 누적 ▾`:'연 누적 ▾';}
 $('#basisNote').classList.add('hide');
};
function easyPreset(p){
 const today=v10Today(),y=Number(today.slice(0,4)),m=Number(today.slice(5,7));
 if(p==='this'||p==='last'||p==='next'){
  // 이전/다음 달은 지금 보고 있는 달에서 한 칸 움직인다 (월 모드가 아니면 오늘 기준).
  const cur=state.mode==='month'&&state.months.length===1?Number(state.months[0]):m;
  let targetY=Number(DB.year)||y,target=p==='this'?m:p==='last'?cur-1:cur+1;
  if(p==='this')targetY=y;
  if(target<1){target=12;targetY-=1;}if(target>12){target=1;targetY+=1;}
  if(v10Years().includes(targetY)&&Number(DB.year)!==targetY)v10ActivateYear(targetY,false);
  state.mode='month';state.quarters=[];state.months=[target];
 }else if(p==='quarter'){state.mode='quarter';state.quarters=[qOf(m)];state.months=[];}
 else if(p==='ytd'){state.mode='cumulative';state.months=[m];state.quarters=[];}
 refreshFilters();render();
}
// 분기 목록(1~4분기)과 연 누적 목록(연도별)에서 고르면 바로 그 기간으로 조회한다.
function easyPickQuarter(q){
 if(!q)return;state.mode='quarter';state.quarters=[Number(q)];state.months=[];refreshFilters();render();
}
function easyPickYtd(year){
 if(!year)return;const y=Number(year),today=v10Today();
 if(v10Years().includes(y)&&Number(DB.year)!==y)v10ActivateYear(y,false);
 state.mode='cumulative';state.quarters=[];state.months=[y===Number(today.slice(0,4))?Number(today.slice(5,7)):12];refreshFilters();render();
}
function easyInstall(){
 const pbar=$('#periodbar'),oldTop=document.querySelector('.v10-top');
 const year=$('#v10Year'),reset=$('#v10ResetAll');
 const toolbar=document.createElement('div');toolbar.className='easy-toolbar';
 toolbar.innerHTML=`<div class="easy-period"><span id="easyYearSlot"></span><select id="easyMonth" aria-label="조회 월"><option value="custom">선택 기간</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}월</option>`).join('')}</select></div><button class="easy-preset easy-step" data-easy-preset="last">◀ 이전 달</button><button class="easy-preset easy-now" data-easy-preset="this">이번 달</button><button class="easy-preset easy-step" data-easy-preset="next">다음 달 ▶</button><select class="easy-preset easy-preset-select" id="easyQuarter" aria-label="분기 선택"><option value="">분기 ▾</option>${[1,2,3,4].map(q=>`<option value="${q}">${q}분기 · ${q*3-2}~${q*3}월</option>`).join('')}</select><select class="easy-preset easy-preset-select" id="easyYtd" aria-label="연 누적 선택"><option value="">연 누적 ▾</option></select><button class="easy-preset" id="easyCustomToggle" aria-expanded="false">기간 골라 비교</button><span class="easy-spacer"></span><button class="btn" id="easyFilterToggle" aria-expanded="false">상세 조건</button><span id="easyResetSlot"></span>`;
 pbar.prepend(toolbar);$('#easyYearSlot').appendChild(year);$('#easyResetSlot').appendChild(reset);reset.textContent='초기화';oldTop.classList.add('hide');
 const custom=document.createElement('div');custom.id='easyCustom';custom.className='easy-custom hide';
 custom.innerHTML='<p>비교할 월 또는 분기를 누르세요. 여러 개를 골라도 됩니다.</p>';
 const mode=$('#pmode'),pills=$('#ppills'),oldPeriodRow=mode.closest('.prow');
 custom.appendChild(mode);custom.appendChild(pills);oldPeriodRow.classList.add('hide');
 mode.querySelector('[data-mode="all"]').textContent='연 전체';mode.querySelector('[data-mode="year"]').classList.add('hide');
 mode.querySelector('[data-mode="month"]').textContent='월 선택';mode.querySelector('[data-mode="quarter"]').textContent='분기 선택';mode.querySelector('[data-mode="cumulative"]').textContent='누적';
 pbar.appendChild(custom);
 const filters=document.querySelector('#periodbar .filters').closest('.prow');filters.id='easyConditions';filters.classList.add('easy-conditions','hide');pbar.appendChild(filters);
 $('#pbasis').style.display='none';$('#pbasisLab').style.display='none';
 const note=document.createElement('p');note.id='easyPeriodNote';note.className='easy-period-note';pbar.appendChild(note);
 const title=$('#sectTitle'),titleGroup=document.createElement('div');title.replaceWith(titleGroup);
 const titleRow=document.createElement('div');titleRow.className='easy-title-row';titleGroup.appendChild(titleRow);titleRow.appendChild(title);
 const pdfButton=document.createElement('button');pdfButton.id='easyPresentationPdf';pdfButton.type='button';pdfButton.className='btn primary easy-pdf-download hide';pdfButton.dataset.v10Action='presentationPdf';pdfButton.textContent='PDF 다운로드';pdfButton.title='현재 실적발표를 PDF로 저장';titleRow.appendChild(pdfButton);
 const subtitle=document.createElement('p');subtitle.id='easySubtitle';titleGroup.appendChild(subtitle);
 const version=document.createElement('div');version.className='easy-version';version.textContent='실무 · 보고 통합 / v10.2 · 원본 대조';document.querySelector('.rail').appendChild(version);
 $('#easyCustomToggle').addEventListener('click',()=>{const open=custom.classList.toggle('hide')===false;$('#easyCustomToggle').setAttribute('aria-expanded',String(open));if(open&&state.mode==='all')state.mode='month';render();});
 $('#easyFilterToggle').addEventListener('click',()=>{const open=filters.classList.toggle('hide')===false;$('#easyFilterToggle').setAttribute('aria-expanded',String(open));});
 $('#easyMonth').addEventListener('change',e=>{if(e.target.value==='custom'){custom.classList.remove('hide');$('#easyCustomToggle').setAttribute('aria-expanded','true');return;}state.mode='month';state.months=[Number(e.target.value)];state.quarters=[];if(state.sect==='owner')state.owner='전체';if(state.sect==='cons')state.cons='전체';refreshFilters();render();});
 // The main team menu opens on field activity. The consultant subtab opens on
 // inquiry-cohort performance; users can still change the basis afterwards.
 $('#nav').addEventListener('click',e=>{const b=e.target.closest('button[data-sect]');if(!b)return;if(!DB){e.stopPropagation();e.preventDefault();return;} // menu is drawn before the data arrives
  if(b.dataset.sect==='owner')state.basis='exec';if(b.dataset.sect==='cons')state.basis='cohort';},true);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-easy-preset]');if(b)easyPreset(b.dataset.easyPreset);});
 document.addEventListener('change',e=>{if(e.target.id==='easyQuarter')easyPickQuarter(e.target.value);if(e.target.id==='easyYtd')easyPickYtd(e.target.value);});
 document.addEventListener('change',e=>{if(e.target.id==='easyTeamBasis'){state.basis=e.target.value;render();}});
 document.addEventListener('change',e=>{if(e.target.id==='easyPresentationCommentMonth'){easyPresentationComments.months[DB.year]={month:Number(e.target.value),period:easyPresentationPeriodSig()};store.set('v10_presentation_comment_months',easyPresentationComments.months);render();}});
 document.addEventListener('change',e=>{if(e.target.id==='v10GoalWeek'){easyGoalState.weeks[DB.year]=Number(e.target.value);store.set('v10_goalWeeks',easyGoalState.weeks);render();}});
 document.addEventListener('click',e=>{const mode=e.target.closest('[data-easy-goal-mode]');if(mode){easyGoalState.mode=mode.dataset.easyGoalMode;store.set('v10_goalMode',easyGoalState.mode);render();return;}const step=e.target.closest('[data-easy-week-step]');if(step){easyGoalState.weeks[DB.year]=Math.max(1,Math.min(52,easyGoalWeek()+Number(step.dataset.easyWeekStep)));store.set('v10_goalWeeks',easyGoalState.weeks);render();return;}const restore=e.target.closest('[data-easy-week-action="restore"]');if(restore){delete easyGoalState.goals[`${DB.year}-W${easyPad(easyGoalWeek())}`];store.set('v10_weekGoals',easyGoalState.goals);render();}});
 document.addEventListener('submit',e=>{if(e.target.id!=='v10WeekGoalForm')return;e.preventDefault();const data=new FormData(e.target),goals={};for(const k of ['total','power','meeting','contractCount','contractCap']){const raw=txt(data.get(k));goals[k]=raw===''?null:Number(raw);if(goals[k]!==null&&(!Number.isFinite(goals[k])||goals[k]<0))return;}const week=Number(e.target.dataset.week);easyGoalState.goals[`${DB.year}-W${easyPad(week)}`]={...goals};store.set('v10_weekGoals',easyGoalState.goals);render();const status=$('#v10WeekGoalStatus');if(status)status.textContent=`${week}주차 목표를 저장했습니다.`;});
 document.addEventListener('submit',e=>{if(e.target.id!=='easyPresentationCommentForm')return;e.preventDefault();easySavePresentationComment(e.target);});
 document.addEventListener('input',e=>{if(!e.target.matches?.('#easyPresentationCommentForm textarea'))return;const form=e.target.form,year=Number(form.dataset.year),month=Number(form.dataset.month),key=easyPresentationCommentKey(year,month),value=easyPresentationCommentFormText(form),parts=easyPresentationCommentParts(value);easyPresentationComments.drafts[key]=value;easyPresentationComments.dirty[key]=value!==(easyPresentationComments.records[key]?.text||'');const count=$('#easyPresentationCommentCount');if(count)count.textContent=`${(parts.analysis.length+parts.improvement.length).toLocaleString()} / 3,200자`;});
 document.addEventListener('change',e=>{if(!e.target.matches?.('[data-perf-staff]'))return;const name=e.target.dataset.perfStaff;if(e.target.checked&&!easyPresentationStaff.extra.includes(name))easyPresentationStaff.extra.push(name);if(!e.target.checked)easyPresentationStaff.extra=easyPresentationStaff.extra.filter(n=>n!==name);store.set('v10_presentation_staff_extra',easyPresentationStaff.extra);render();});
 document.addEventListener('click',e=>{if(e.target.closest('[data-v10-action="presentationPdf"]')){easyDownloadPresentationPdf();return;}const edit=e.target.closest('[data-v10-action="presentationCommentEdit"]');if(edit){const key=easyPresentationCommentKey(edit.dataset.year,edit.dataset.month);if(!window.confirm(`${edit.dataset.year}년 ${edit.dataset.month}월 확정 코멘트를 수정합니다. 저장하기 전까지는 기존 내용이 유지됩니다.`))return;easyPresentationComments.editing[key]=true;easyPresentationComments.message[key]='';render();return;}const cancel=e.target.closest('[data-v10-action="presentationCommentCancel"]');if(cancel){const key=easyPresentationCommentKey(cancel.dataset.year,cancel.dataset.month);easyPresentationComments.editing[key]=false;easyPresentationComments.drafts[key]=easyPresentationComments.records[key]?.text||'';easyPresentationComments.dirty[key]=false;render();return;}const restore=e.target.closest('[data-v10-action="presentationCommentRestore"]');if(restore){if(!window.confirm(`${restore.dataset.year}년 ${restore.dataset.month}월 코멘트를 직전 저장본으로 되돌립니다. 지금 내용은 다시 되돌리기로 복구할 수 있습니다.`))return;easyRestorePresentationComment(restore.dataset.year,restore.dataset.month);return;}const retry=e.target.closest('[data-v10-action="presentationCommentRetry"]');if(!retry)return;const year=Number(retry.dataset.year),month=Number(retry.dataset.month),key=easyPresentationCommentKey(year,month);easyPresentationComments.loaded[key]=false;easyPresentationComments.error[key]='';easyPresentationComments.message[key]='';easyEnsurePresentationComment(year,month);render();});
 document.addEventListener('click',e=>{if(!e.target.closest('[data-v10-action="reportMore"]'))return;easyReportMore.open=!easyReportMore.open;store.set('v10_reportMore',easyReportMore.open);render();});
 document.addEventListener('change',e=>{if(e.target.dataset.reportPart){easyReportOptions[e.target.dataset.reportPart]=e.target.checked;store.set('v10_reportParts',easyReportOptions);render();}});
 document.addEventListener('input',e=>{if(e.target.id==='v10ReportNote'){const output=document.querySelector('.easy-report-note');if(output)output.textContent=e.target.value;}});
 // Keep the automatic refresh options, without configuration URLs in the daily work surface.
 ['#dropZone','.sync .actions'].forEach(s=>document.querySelector(s)?.classList.add('hide'));
 ['urlScript','urlTongye','urlMal'].forEach(id=>$('#'+id)?.closest('.field')?.classList.add('hide'));
 $('#syncToggle').textContent='자동 갱신';
 const h=document.querySelector('#syncPanel h3'),desc=document.querySelector('#syncPanel p');
 if(h)h.textContent='데이터 자동 갱신';if(desc)desc.textContent='열려 있는 동안의 갱신 간격을 설정합니다. 지금 반영하려면 새로고침을 누르세요.';
 const prefs={dailyChk:store.get('dailyOn',false),everyChk:store.get('everyOn',true)};
 Object.entries(prefs).forEach(([id,val])=>$('#'+id).checked=val);
 $('#everyMin').value=store.get('everyMin',30);$('#dailyTime').value=store.get('dailyTime','14:40');
 const th=store.get('theme',null);if(th)document.documentElement.setAttribute('data-theme',th);
 setupEvery();showNextRun();
}
easyInstall();
