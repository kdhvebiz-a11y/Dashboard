/* Contract source: read-only import of the user's RPS workbook detail sheets. */
const CONTRACT_DATA = __CONTRACT_DATA__;
const contractFilter={basis:'report',business:'전체',source:'전체',consultant:'전체',owner:'전체',corporation:'전체',region:'전체',query:''};
const contractBasisLabel=()=>'계약 원장 연도·보고 월';
const contractMoney=n=>n===null?'—':(n/100000000).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억원';
const contractCap=n=>n===null?'—':capS(n).replace('MW','MWp').replace(/kW$/,'kWp');
const contractSourceForYear=year=>CONTRACT_DATA.sources.find(s=>Number(s.reportYear)===Number(year));
function contractGoal(category,months){
 const values=contractSourceForYear(DB.year)?.goals?.[category];
 return Array.isArray(values)?months.reduce((sum,m)=>sum+(Number(values[m-1])||0),0):null;
}
function contractCategoryAggregate(months,category='전체'){
 const rows=CONTRACT_DATA.records.filter(r=>r.reportYear===Number(DB.year)&&months.includes(r.reportMonth)&&!r.cancelled&&(category==='전체'||r.category===category));
 return {rows,count:rows.length,capacity:v10Sum(rows,'capacity')};
}
function contractGoalProgress(){
 const year=Number(DB.year),annual=CONTRACT_ANNUAL_GOALS[year]??null;
 if(annual===null)return '';
 const ms=selMonths(),selected=contractAggregate(ms,{filtered:false}),all=contractAggregate(Array.from({length:12},(_,j)=>j+1),{filtered:false});
 const periodGoal=contractGoal('전체',ms);
 const months=[...new Set(ms)].sort((a,b)=>a-b),contiguous=months.every((m,j)=>j===0||m===months[j-1]+1);
 const period=months.length===1?months[0]+'월':months.length===3&&contiguous&&(months[0]-1)%3===0?`${Math.ceil(months[0]/3)}분기 (${months[0]}~${months[2]}월)`:contiguous?`${months[0]}~${months[months.length-1]}월`:months.map(m=>m+'월').join('·');
 const progress=(title,actual,goal,scope,color)=>{
  const known=actual!==null&&goal!==null&&goal>0,rate=known?pct(actual,goal):0,fmt=n=>d1(n/1000)+'MW';
  const summary=`${goal===null?'목표 미설정':'목표 <b>'+fmt(goal)+'</b>'} ${actual===null?'· 계약 실적 확인 필요':'중 <b>'+fmt(actual)+' 계약</b>'}${known?' · <b>'+d1(rate)+'% 달성</b>':''}`;
  const remaining=!known?'목표 또는 계약 실적을 확인해 주세요.':actual>=goal?`${scope} 목표를 달성했습니다.${actual>goal?' 목표보다 '+fmt(actual-goal)+' 초과':''}`:`${scope} 목표 달성에 <b>${fmt(goal-actual)} 더 필요</b>`;
  return `<div class="v10-goal"><div class="v10-goal-head"><strong>${esc(title)}</strong></div><p class="v10-note">${summary}</p><div class="v10-track"><span style="width:${Math.min(Math.max(rate,0),100)}%;background:${color}"></span></div><small>${remaining}</small></div>`;
 };
 return `<div class="contract-goal-progress">${progress(period+' 목표, 얼마나 달성했나요?',selected.capacity,periodGoal,period,V10.colors[0])}${progress(year+'년 연간 목표, 얼마나 달성했나요?',all.capacity,annual,'연간',V10.colors[4])}<p class="v10-note">위는 원본의 월별 목표 합계와 선택 기간 실적을, 아래는 ${year}년 원장 전체와 연간 목표를 비교합니다.<br>부서 전체 · 계약 원장 연도·보고 월 기준${all.missingCapacity?' · 용량 미기재 '+all.missingCapacity+'건 제외':''}${!CONTRACT_DATA.sources.some(s=>s.reportYear===year)?' · 해당 연도 전체 원장 미연결':''}</p></div>`;
}
// 팀별 목표 달성(선택 기간 + 연간): 전체·직영·외주·입찰 카드마다 목표 용량 / 달성 용량 / 달성률. 계약 조건 필터와 무관한 부서 전체 기준.
function contractTeamGoals(){
 const src=contractSourceForYear(DB.year);if(!src?.goals?.전체)return '';
 const ms=[...new Set(selMonths())].sort((a,b)=>a-b),year=Array.from({length:12},(_,j)=>j+1);
 const contiguous=ms.every((m,j)=>j===0||m===ms[j-1]+1);
 const period=ms.length===1?ms[0]+'월':ms.length===3&&contiguous&&(ms[0]-1)%3===0?`${Math.ceil(ms[0]/3)}분기`:contiguous?`${ms[0]}~${ms[ms.length-1]}월`:ms.map(m=>m+'월').join('·');
 const cards=contractTeamCards(ms,period,year,`${DB.year}년 연간`);
 return v10Panel('팀별 목표 달성',`${period} · 직영·외주·입찰 목표 용량 대비 계약 용량 · 원본 정리base 목표, 원장 보고 월 기준 · 100% 이상 초록, 70% 이상 노랑, 그 아래 빨강`,cards);
}
// 팀별 카드 묶음(부서 전체·직영·외주·입찰): 첫 줄 = 첫 기간(크게), 둘째 줄 = 둘째 기간. 계약실적(선택 기간+연간)과 실적발표(선택 월+1~N월)가 같이 쓴다.
function contractTeamCards(ms,label1,ms2,label2,{big2=false}={}){
 const src=contractSourceForYear(DB.year);if(!src?.goals?.전체)return '';
 const mw=n=>n>=1000?d1(n/1000)+'MW':i(Math.round(n))+'kW';
 const cls=r=>r===null?'':r>=100?'ok':r>=70?'warm':'low';
 const block=(label,goal,act,count,big)=>{const rate=goal?act/goal*100:null,c=cls(rate);
  return `<div class="ct-team-row${big?' big':''}"><span class="ct-team-scope">${label}</span><div class="ct-team-nums"><span><small>목표</small><b>${goal?mw(goal):'—'}</b></span><span><small>달성 · ${i(count)}건</small><b>${mw(act)}</b></span><span class="ct-rate ${c}"><small>달성률</small><b>${rate===null?'—':d1(rate)+'%'}</b></span></div><div class="v10-track ct-team-track"><span class="${c}" style="width:${rate===null?0:Math.min(rate,100)}%"></span></div></div>`;};
 const cards=[['전체',V10.colors[4]],['직영',V10.colors[0]],['외주',V10.colors[1]],['입찰',V10.colors[2]]].map(([cat,color])=>{
  const p=contractCategoryAggregate(ms,cat),y=contractCategoryAggregate(ms2,cat);
  return `<article class="ct-team${cat==='전체'?' all':''}" style="--team:${color}"><h4><i></i>${cat==='전체'?'부서 전체':cat}</h4>${block(label1,contractGoal(cat,ms),p.capacity,p.count,true)}${block(label2,contractGoal(cat,ms2),y.capacity,y.count,big2)}</article>`;
 }).join('');
 return `<div class="ct-teams">${cards}</div>`;
}
// 월별 목표 대비 달성: 전체·직영·외주·입찰 각 줄에 "목표 / 계약 / 달성률". 목표는 원본 정리base 시트, 계약은 원장(보고 월) 집계.
function contractMonthlyGoalTable(){
 const src=contractSourceForYear(DB.year);if(!src?.goals?.전체)return '';
 const months=Array.from({length:12},(_,j)=>j+1),nowM=Number(v10Today().slice(5,7)),thisYear=Number(DB.year)===Number(v10Today().slice(0,4));
 const cats=[['전체','전체',V10.colors[4]],['직영','직영',V10.colors[0]],['외주','외주',V10.colors[1]],['입찰','입찰',V10.colors[2]]];
 const mw=n=>n>=1000?d1(n/1000)+'MW':i(Math.round(n))+'kW';
 const body=cats.map(([cat,label,color])=>{
  const goals=src.goals[cat]||[],cells=months.map(m=>{
   const goal=Number(goals[m-1])||0,act=contractCategoryAggregate([m],cat).capacity,future=thisYear&&m>nowM;
   if(!goal&&!act)return '<td><span class="easy-dim">—</span></td>';
   const rate=goal?act/goal*100:null,cls=future?'':rate===null?'':rate>=100?'ok':rate>=70?'warm':'low';
   return `<td class="ct-cell ${cls}"><small>목표 ${mw(goal)}</small><b>${act?mw(act):'—'}</b><em>${rate===null||(!act&&future)?'':d1(rate)+'%'}</em></td>`;
  }).join('');
  const goalSum=goals.reduce((a,b)=>a+(Number(b)||0),0),actSum=contractCategoryAggregate(months,cat).capacity,rate=goalSum?actSum/goalSum*100:null;
  return `<tr><td><i class="easy-key" style="background:${color}"></i>${esc(label)}</td>${cells}<td class="ct-cell total"><small>목표 ${mw(goalSum)}</small><b>${mw(actSum)}</b><em>${rate===null?'':d1(rate)+'%'}</em></td></tr>`;
 }).join('');
 return v10Panel('월별 목표 대비 계약 달성','원본 정리base 시트의 월별 목표(전체·직영·외주·입찰)와 원장 계약 용량 · 칸마다 목표 / 계약 / 달성률 · 100% 이상 초록, 70% 이상 노랑, 그 아래 빨강',`<div class="easy-chart-table easy-wide ct-goal"><div class="tblwrap"><table><thead><tr><th>구분</th>${months.map(m=>`<th>${m}월</th>`).join('')}<th>연간</th></tr></thead><tbody>${body}</tbody></table></div></div>`);
}
// 사업 분류(상세 시트)별 계약: 발전사업(A)·자가소비(B)… 시트 이름 그대로, 건수 많은 순. 선택 기간 기준.
function contractSheetTable(rows){
 const map=new Map();rows.forEach(r=>{const k=r.sheet||r.business;if(!map.has(k))map.set(k,[]);map.get(k).push(r);});
 const groups=[...map].map(([name,rs])=>({name,n:rs.length,cap:v10Sum(rs,'capacity'),amount:rs.some(r=>r.amount!==null)?v10Sum(rs,'amount'):null,missing:rs.filter(r=>r.amount===null).length})).sort((a,b)=>b.n-a.n||b.cap-a.cap);
 if(!groups.length)return '';
 const total=rows.length,totalCap=v10Sum(rows,'capacity'),max=groups[0].n;
 const body=groups.map((g,j)=>`<tr><td>${j<2?`<span class="easy-rank easy-rank-${j+1}">${j+1}위</span>`:''}${esc(g.name)}</td><td class="easy-bar-cell"><div class="easy-bar"><span style="width:${(g.n/max*100).toFixed(1)}%;background:${V10.colors[4]}"></span></div></td><td><b>${i(g.n)}건</b></td><td>${v10Rate(g.n,total)}</td><td>${contractCap(g.cap)}</td><td>${v10Rate(g.cap,totalCap)}</td><td>${contractMoney(g.amount)}${g.missing?`<br><small>미기재 ${g.missing}건</small>`:''}</td></tr>`).join('');
 return v10Panel('사업 분류별 계약',`${periodLabel()} · 원본 상세 시트(발전사업(A) ~ 기타(Z)) 기준 · 건수 많은 순`,`<div class="v10-table easy-types"><table><thead><tr><th>분류 (시트)</th><th></th><th>건수</th><th>건수 비중</th><th>계약 용량</th><th>용량 비중</th><th>공사금액 (VAT 제외)</th></tr></thead><tbody>${body}</tbody></table></div>`);
}
const contractMap=r=>r.address?'https://map.kakao.com/link/search/'+encodeURIComponent(r.address):'';
function contractMatch(r){
 return ['business','source','consultant','owner','corporation','region'].every(k=>contractFilter[k]==='전체'||r[k]===contractFilter[k])&&(!contractFilter.query||[r.plant,r.inquiryNo,r.address,r.consultant,r.owner].join(' ').toLowerCase().includes(contractFilter.query.toLowerCase()));
}
function contractAggregate(months,{filtered=true,basis='report'}={}){
 const y=Number(DB.year);
 const covered=CONTRACT_DATA.sources.some(s=>s.reportYear===y);
 const candidates=CONTRACT_DATA.records.filter(r=>{
  if(filtered&&!contractMatch(r))return false;
  return r.reportYear===y&&months.includes(r.reportMonth);
 });
 const cancelled=candidates.filter(r=>r.cancelled),rows=candidates.filter(r=>!r.cancelled);
 const capKnown=rows.filter(r=>r.capacity!==null),amountKnown=rows.filter(r=>r.amount!==null);
 return {covered,rows,count:covered?rows.length:null,capacity:covered&&(!rows.length||capKnown.length)?v10Sum(rows,'capacity'):null,amount:covered&&(!rows.length||amountKnown.length)?v10Sum(rows,'amount'):null,
  missingCapacity:rows.length-capKnown.length,missingAmount:rows.length-amountKnown.length,avg:capKnown.length?v10Sum(capKnown,'capacity')/capKnown.length:null,cancelled:cancelled.length,future:0};
}
function contractSourceNote(){
 const s=CONTRACT_DATA.sources;
 return `<p class="v10-note">계약 원본: ${s.map(x=>esc(x.name)).join(', ')}<br>파일 가져온 시각: ${esc(new Date(CONTRACT_DATA.importedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))} · 엑셀 스냅샷 (시트 자동 갱신과 별개)</p>`;
}
function contractControls(all,filters){
 // 계약 조건: 한 줄짜리 작은 칩 선택(라벨이 칩 안에). 고른 조건은 파랗게 표시.
 const chip=([key,label])=>{const on=contractFilter[key]!=='전체';return `<label class="ct-chip${on?' on':''}"><small>${label}</small><select aria-label="계약 ${label}" data-contract-filter="${key}"><option>전체</option>${[...new Set(all.map(r=>r[key]||'미지정'))].sort().map(v=>`<option ${contractFilter[key]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;};
 const active=filters.filter(([k])=>contractFilter[k]!=='전체').length+(contractFilter.query?1:0);
 return `<section class="contract-controls ct-compact"><div class="ct-bar"><b class="ct-bar-title">계약 조건${active?` <em>${active}</em>`:''}</b>${filters.map(chip).join('')}<label class="ct-chip ct-find${contractFilter.query?' on':''}"><small>검색</small><input data-contract-search value="${esc(contractFilter.query)}" placeholder="발전소·주소·상담번호"></label><span class="ct-bar-actions"><button class="btn ct-mini" data-contract-action="reset"${active?'':' disabled'}>초기화</button><button class="btn ct-mini" data-contract-action="csv">내려받기</button><button class="btn ct-mini" data-v10-section="followup">상담 관리 →</button></span></div><p class="ct-bar-note">${esc(DB.year)}년 ${esc(periodLabel())} · ${esc(contractBasisLabel())} 기준 · 원장의 보고 월로 집계(계약일은 상세 정보)</p></section><details class="contract-source"><summary>계약 원본과 집계 안내</summary>${contractSourceNote()}<p>${esc(DB.year)}년 계약 파일에 포함된 행을 ${esc(DB.year)}년 실적으로 보고, 원장의 보고 월로 월별 집계합니다. 상단 연도·기간과 위 계약 조건을 적용합니다. 문의·미팅 상세 조건은 적용하지 않습니다. ‘그 외’ 유입은 마케팅으로 단정하지 않습니다.</p></details>`;
}
function contractKpis(a){return `<div class="v10-kpis">${v10Card('계약 등록 건수',v10Number(a.count)+' 건','발전소별 원장 행 기준 · 취소 제외',V10.colors[4],'contract')}${v10Card('계약 용량',contractCap(a.capacity),`원본 단위 kWp · 미기재 ${a.missingCapacity}건`,V10.colors[3],'contract')}${v10Card('공사금액 (VAT 제외)',contractMoney(a.amount),`금액 기재분 합계 · 미기재 ${a.missingAmount}건`,V10.colors[0],'contract')}${v10Card('평균 계약 용량',a.avg===null?'—':d1(a.avg)+' kWp','용량 기재 건 기준 평균',V10.colors[5],'contract')}</div>`;}
function contractTable(rows){return v10Table(['발전소 · 위치','계약일 / 보고 월','사업형태','용량 (kWp)','공사금액 (VAT 제외)','컨설팅 / 담당자','유입 / 시공사','상담번호 / 상태','원본'],rows.map(r=>[
 `<strong>${esc(r.plant)}</strong><br>${esc(r.address||'주소 미기재')}${contractMap(r)?`<br><a href="${esc(contractMap(r))}" target="_blank" rel="noopener noreferrer">카카오맵에서 위치 보기 ↗</a>`:''}`,
 `${esc(r.date||r.dateRaw+' (날짜 확인)')}<br><small>${r.reportYear}년 ${r.reportMonth||'미지정'}월</small>`,esc(r.business),r.capacity===null?'—':d1(r.capacity),r.amount===null?'미기재':r.amount.toLocaleString('ko-KR')+'원',`${esc(r.consultant)} / ${esc(r.owner)}`,`${esc(r.source)}<br>${esc(r.corporation)}`,`${esc(r.inquiryNo||'미기재')}<br>${esc(r.status)}`,`${esc(r.sheet)} ${r.row}행`
 ]));}
function contractGroup(rows,key){
 const names=[...new Set(rows.map(r=>r[key]||'미지정'))];
 return names.map(name=>{const a=rows.filter(r=>(r[key]||'미지정')===name),missing=a.filter(r=>r.amount===null).length;return [key==='consultant'||key==='owner'?`<button data-fu-person="${esc(name)}" data-fu-role="${key==='owner'?'own':'cons'}">${esc(name)} · 상담 보기</button>`:esc(name),i(a.length),contractCap(a.some(r=>r.capacity!==null)?v10Sum(a,'capacity'):null),contractMoney(missing===a.length?null:v10Sum(a,'amount'))+(missing?`<br><small>금액 미기재 ${missing}건</small>`:'')];}).sort((a,b)=>Number(b[1].replaceAll(',',''))-Number(a[1].replaceAll(',','')));
}
function contractView(){
 const a=contractAggregate(selMonths()),axis=easyTrendAxis(),vals=axis.map(g=>contractAggregate(g.months));
 const report=contractFilter.basis==='report';
 const all=CONTRACT_DATA.records.filter(r=>r.reportYear===Number(DB.year)||r.date?.startsWith(DB.year+'-'));
 const filters=[['business','사업형태'],['source','유입'],['consultant','컨설팅 담당'],['owner','현장 담당'],['corporation','시공사'],['region','지역']];
 const issues=CONTRACT_DATA.issues.map(x=>{const r=CONTRACT_DATA.records.find(r=>r.id===x.id);return [esc(r?.sheet||''),r?.row||'',esc(r?.plant||''),esc(x.message),esc(x.value)];});
 const partial=!CONTRACT_DATA.sources.some(s=>s.reportYear===Number(DB.year));
 return easyLead('실제 계약 실적','RPS 계약 원장을 기준으로 계약 건수·용량·공사금액·설치 위치를 확인합니다.',contractBasisLabel())
 +contractControls(all,filters)
 +(partial?'<div class="v10-callout">선택 연도의 전체 계약 파일이 없습니다. 다른 연도 원장에 포함된 계약만 표시되므로 연간 전체 실적으로 사용하지 마세요.</div>':'')
 +contractKpis(a)+(contractTeamGoals()||(contractGoalProgress()?v10Panel('실제 계약 목표 달성','선택 기간과 연간 계약 용량',contractGoalProgress()):''))
 +`<p class="v10-note">계약서 수가 아닌 발전소별 원장 행을 셉니다. 동일 상담번호의 여러 발전소를 합치지 않습니다. 취소 ${a.cancelled}건 제외. 계약일이 과거 연도이거나 형식 오류여도 ${DB.year}년 원장과 보고 월이 있으면 ${DB.year}년 실적에 포함합니다.</p>`
 +contractMonthlyGoalTable()
 +contractSheetTable(a.rows)
 +`<div class="v10-grid">${v10Line('계약 건수 추세',contractBasisLabel()+' 기준',axis,[{name:'계약',color:V10.colors[4],values:vals.map(x=>x.count)}])}${v10Line('계약 용량 추세','원본 계약용량 · 단위 kWp',axis,[{name:'계약 용량',color:V10.colors[3],values:vals.map(x=>x.capacity)}],'kWp')}</div>`
 +v10Line('공사금액 추세','VAT 제외 · 금액 기재분만 합산',axis,[{name:'공사금액',color:V10.colors[0],values:vals.map(x=>x.amount===null?null:x.amount/100000000)}],'억원')
 +`<div class="v10-grid">${v10Panel('미팅 담당자별 계약','원본 N열 담당자(미팅)',v10Table(['담당자','건수','용량','공사금액'],contractGroup(a.rows,'owner')))}${v10Panel('사업형태별 계약','사업별 상세 시트 기준',v10Table(['사업형태','건수','용량','공사금액'],contractGroup(a.rows,'business')))}</div>`
 +v10Panel('계약 상세와 위치',`${a.rows.length}행 · 주소 기반 지도 검색 링크이며 현장 좌표를 검증한 것은 아닙니다.`,contractTable(a.rows))
 +`<details class="easy-details"><summary>계약 원본 확인 · 확인 필요 ${issues.length}건 / 요약 대조</summary>${v10Table(['시트','행','발전소','확인 항목','원본 값'],issues)}${v10Table(['원본 파일','상세 행 수','요약표 건수','상세 용량','요약 용량','상세 공사금액','요약 공사금액'],CONTRACT_DATA.sources.map(s=>[esc(s.name),s.rows,v10Number(s.control.count),capS(s.detailCapacity),capS(s.control.capacity||0),contractMoney(s.detailAmount),contractMoney(s.control.amount??null)]))}<p>집계표의 수식 결과와 상세 원장에 차이가 있어도 원본을 수정하거나 행을 임의 삭제하지 않습니다. 파일명 날짜는 실제 계약일이나 데이터 마감일로 사용하지 않습니다.</p></details>`;
}
function contractReport(){const a=contractAggregate(selMonths(),{filtered:false});return v10Panel('실제 계약 실적','계약 원장 연도·보고 월 기준 · 문의·미팅 조건과 독립',contractSourceNote()+contractKpis(a));}
VIEWS.contract=contractView;
const contractOldSecondary=easySecondary;
easySecondary=function(a){
 const c=contractAggregate(selMonths(),{filtered:false});
 const label=v10Scoped()?'계약 전용 조회 →':c.covered?`${i(c.count)}건 · ${contractMoney(c.amount)} →`:'해당 연도 자료 없음 →';
 return contractOldSecondary(a).replace('엑셀 자료 대기 →',label);
};
const contractOldInsights=v10Insights;
v10Insights=function(){const c=contractAggregate(selMonths(),{filtered:false}),body=c.covered?`선택 기간 실제 계약은 ${i(c.count)}건, 계약 용량은 ${contractCap(c.capacity)}, 공사금액은 ${contractMoney(c.amount)}입니다.`:'선택 기간에 확인된 실제 계약 원장 실적이 없습니다.';return contractOldInsights().replace(/<h4>계약 분석 대기<\/h4>[\s\S]*?<\/p>/,`<h4>실제 계약 실적</h4><p>${body}</p>`);};
// 부서 보고서 삭제(2026-10-26): 예전 주소·저장 상태로 들어오면 실적발표로 보낸다.
VIEWS.report=VIEWS.insight=()=>{state.sect='presentation';return VIEWS.presentation();};
const contractOldGoals=VIEWS.goal;
// 목표관리: 마케팅(전체 문의) · 컨설팅(사업주 미팅) · 필드(계약 직영·외주·입찰) — 이번 주/이번 달/매월/올해 달성·미달성.
const GOAL_BOARD={marketing:{week:350,month:1516},consulting:{week:17,month:72}};
function goalBoardData(){
 const year=Number(DB.year),today=v10Today(),thisYear=Number(today.slice(0,4))===year,nowM=thisYear?Number(today.slice(5,7)):12;
 const months=Array.from({length:12},(_,j)=>j+1),agg=months.map(m=>m<=nowM?v10Aggregate([m]):null);
 const ct=cat=>months.map(m=>m<=nowM?contractCategoryAggregate([m],cat).capacity:null),goal=cat=>months.map(m=>contractGoal(cat,[m]));
 const rows=[
  {k:'marketing',team:'마케팅',label:'전체 문의',unit:'건',goals:months.map(()=>GOAL_BOARD.marketing.month),acts:agg.map(a=>a?a.total:null)},
  {k:'consulting',team:'컨설팅',label:'사업주 미팅',unit:'건',goals:months.map(()=>GOAL_BOARD.consulting.month),acts:agg.map(a=>a?a.actual:null)},
  ...['전체','직영','외주','입찰'].map(cat=>({k:'field-'+cat,team:'필드',label:cat==='전체'?'계약 전체':cat,unit:'kW',sub:cat!=='전체',goals:goal(cat),acts:ct(cat)}))];
 return {year,thisYear,nowM,months,rows};
}
const goalFmt=(n,unit)=>n===null||n===undefined?'—':unit==='kW'?(n>=1000?d1(n/1000)+'MW':i(Math.round(n))+'kW'):i(n)+'건';
const goalCls=(rate,live)=>rate===null?'':rate>=100?'ok':live?'live':rate>=70?'warm':'low';
const goalBadge=(rate,live)=>rate===null?'':rate>=100?'<span class="gb-badge ok">달성</span>':live?'<span class="gb-badge live">진행 중</span>':'<span class="gb-badge low">미달성</span>';
function goalBoard(){
 if(v10Scoped())return v10Panel('목표관리','상세 조건이 걸려 있으면 목표를 비교할 수 없습니다.',v10Empty('상단 상세 조건을 초기화하면 부서 전체 목표 달성을 볼 수 있습니다.'));
 const D=goalBoardData(),ms=[...new Set(selMonths())].sort((a,b)=>a-b).filter(m=>m<=D.nowM);
 const sel=ms.length?ms:[D.nowM],live=D.thisYear&&sel.includes(D.nowM),label=sel.length===1?sel[0]+'월':`${sel[0]}~${sel[sel.length-1]}월`;
 const ytd=D.months.filter(m=>m<=D.nowM),sum=(arr,ix)=>ix.reduce((t,m)=>arr[m-1]===null?t:t+arr[m-1],0);
 // 이번 주(월~금 문의 · 금~목 미팅)
 let wk=null;try{if(D.thisYear&&typeof cwData==='function'){const w=cwThisWeek(D.year),d=cwData(D.year,w);wk={w,range:d.range,inq:d.totals?d.totals.total:null,meet:d.meeting?d.meeting.n:null};}}catch(e){wk=null;}
 const line=(title,act,goal,unit,isLive,note)=>{const rate=goal&&act!==null&&act!==undefined?act/goal*100:null;return `<div class="gb-line"><div class="gb-line-head"><span>${title}</span>${goalBadge(rate,isLive)}</div><div class="gb-line-nums"><b class="${goalCls(rate,isLive)}">${rate===null?'—':d1(rate)+'%'}</b><span><strong>${goalFmt(act,unit)}</strong><small>목표 ${goalFmt(goal,unit)}</small></span></div><div class="v10-track gb-track"><span class="${goalCls(rate,isLive)}" style="width:${rate===null?0:Math.min(rate,100)}%"></span></div>${note?`<small class="gb-note">${note}</small>`:''}</div>`;};
 // 카드 머리: 팀 이름 크게, 그 아래 목표 기준을 한 줄 칩으로(주 350건 · 월 1,516건).
 const card=(team,sub,color,body)=>{const chips=String(sub).split(' · ');return `<article class="gb-card" style="--team:${color}"><header class="gb-head"><h4><i></i>${team}</h4><div class="gb-chips">${chips.map((c,ix)=>`<span class="${ix===0?'gb-chip-what':'gb-chip'}">${esc(c)}</span>`).join('')}</div></header>${body}</article>`;};
 const R=k=>D.rows.find(r=>r.k===k);
 const mk=R('marketing'),cs=R('consulting'),fa=R('field-전체');
 const annualNote=(r)=>{const g=sum(r.goals,D.months),a=sum(r.acts,ytd);return `연간 목표 ${goalFmt(g,r.unit)} 중 ${g?d1(a/g*100):'—'}%`;};
 const wkLabel=wk?`이번 주 (${wk.w}주)`:'이번 주';
 const cards=`<div class="gb-cards">`
  +card('마케팅','전체 문의 · 주 350건 · 월 1,516건',V10.colors[0],(wk?line(wkLabel,wk.inq,GOAL_BOARD.marketing.week,'건',true,`${cwLabel(wk.range.start,wk.range.end)} 월~금 · 말 시트 주차 표`):'')+line(label,sum(mk.acts,sel),sum(mk.goals,sel),'건',live)+line(`${D.year}년 누적 (1~${D.nowM}월)`,sum(mk.acts,ytd),sum(mk.goals,ytd),'건',false,annualNote(mk)))
  +card('컨설팅','사업주 미팅 · 주 17건 · 월 72건',V10.colors[3],(wk?line(wkLabel,wk.meet,GOAL_BOARD.consulting.week,'건',true,`${cwLabel(wk.range.meetingStart,wk.range.meetingEnd)} 금~목 · 주간 업무 진행사항`):'')+line(label,sum(cs.acts,sel),sum(cs.goals,sel),'건',live)+line(`${D.year}년 누적 (1~${D.nowM}월)`,sum(cs.acts,ytd),sum(cs.goals,ytd),'건',false,annualNote(cs)))
  +card('필드','계약 용량 · 직영·외주·입찰 월 목표',V10.colors[4],line(`${label} 계약 전체`,sum(fa.acts,sel),sum(fa.goals,sel),'kW',live)
    +`<div class="gb-teams">${['직영','외주','입찰'].map(cat=>{const r=R('field-'+cat),g=sum(r.goals,sel),a=sum(r.acts,sel),rate=g?a/g*100:null,yg=sum(r.goals,ytd),ya=sum(r.acts,ytd),yr=yg?ya/yg*100:null;return `<div class="gb-team"><b>${cat}</b><span>${label} <em class="${goalCls(rate,live)}">${rate===null?'—':d1(rate)+'%'}</em><small>${goalFmt(a,'kW')} / ${goalFmt(g,'kW')}</small></span><span>누적 <em class="${goalCls(yr,false)}">${yr===null?'—':d1(yr)+'%'}</em><small>${goalFmt(ya,'kW')} / ${goalFmt(yg,'kW')}</small></span></div>`;}).join('')}</div>`
    +line(`${D.year}년 누적 (1~${D.nowM}월)`,sum(fa.acts,ytd),sum(fa.goals,ytd),'kW',false,annualNote(fa)))
  +`</div>`;
 // 매월 표
 const head=`<tr><th>팀</th><th>구분</th>${D.months.map(m=>`<th${m===D.nowM&&D.thisYear?' class="gb-now"':''}>${m}월</th>`).join('')}<th>올해 누적</th></tr>`;
 const body=D.rows.map(r=>{
  let done=0,due=0;
  const cells=D.months.map(m=>{const g=r.goals[m-1],a=r.acts[m-1],isLive=D.thisYear&&m===D.nowM;
   if(a===null)return `<td class="ct-cell future"><small>목표 ${goalFmt(g,r.unit)}</small><b>—</b><em></em></td>`;
   const rate=g?a/g*100:null;if(!isLive&&rate!==null){due++;if(rate>=100)done++;}
   return `<td class="ct-cell ${goalCls(rate,isLive)}"><small>목표 ${goalFmt(g,r.unit)}</small><b>${goalFmt(a,r.unit)}</b><em>${rate===null?'':d1(rate)+'%'}${isLive?' · 진행':''}</em></td>`;}).join('');
  const yg=sum(r.goals,ytd),ya=sum(r.acts,ytd),yr=yg?ya/yg*100:null;
  return `<tr class="${r.sub?'gb-sub':''}"><td>${r.sub?'':r.team}</td><td>${r.label}</td>${cells}<td class="ct-cell total ${goalCls(yr,false)}"><small>목표 ${goalFmt(yg,r.unit)}</small><b>${goalFmt(ya,r.unit)}</b><em>${yr===null?'':d1(yr)+'%'}</em><small class="gb-hit">${due}달 중 ${done}달 달성</small></td></tr>`;}).join('');
 const table=v10Panel('매월 목표 달성',`${D.year}년 · 칸마다 목표 / 실적 / 달성률 · 100% 이상 초록(달성), 70% 이상 노랑, 그 아래 빨강 · 이번 달은 진행 중(파랑) · 올해 누적은 1~${D.nowM}월 목표 합계 대비`,`<div class="easy-chart-table easy-wide ct-goal gb-table"><div class="tblwrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`);
 const basis=`<p class="v10-note gb-basis">마케팅 = 말 시트 전체 문의(월별), 컨설팅 = 실제 진행 사업주 미팅(미팅일 기준), 필드 = RPS 계약 원장 보고 월 기준 계약 용량(목표는 원본 정리base 시트). 이번 주 문의는 월~금, 미팅은 금~목 보고 주차입니다.</p>`;
 return cards+table+basis
  +`<details class="easy-details"><summary>예전 목표 설정 도구 (주간 52주 목표표 · 월별 직접 입력)</summary>${contractOldGoals()}</details>`;
}
VIEWS.goal=goalBoard;
document.addEventListener('change',e=>{const k=e.target.dataset?.contractFilter;if(k&&Object.hasOwn(contractFilter,k)){contractFilter[k]=e.target.value;render();}});
document.addEventListener('keydown',e=>{if(e.target.hasAttribute?.('data-contract-search')&&e.key==='Enter'){contractFilter.query=e.target.value.trim();render();}});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-contract-action],#v10ResetAll');if(!b)return;
 if(b.id==='v10ResetAll'||b.dataset.contractAction==='reset'){Object.assign(contractFilter,{basis:'report',business:'전체',source:'전체',consultant:'전체',owner:'전체',corporation:'전체',region:'전체',query:''});render();}
 if(b.dataset.contractAction==='csv')v10Download(`계약실적_${DB.year}_${contractBasisLabel()}.csv`,[['발전소','계약일','보고연도','보고월','사업형태','용량(kWp)','공사금액(VAT제외,원)','컨설팅','담당자','유입','시공사','상담번호','상태','설치장소','지도링크','파일','시트','행'],...contractAggregate(selMonths()).rows.map(r=>[r.plant,r.date||r.dateRaw,r.reportYear,r.reportMonth,r.business,r.capacity,r.amount,r.consultant,r.owner,r.source,r.corporation,r.inquiryNo,r.status,r.address,contractMap(r),r.file,r.sheet,r.row])]);
});
