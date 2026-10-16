/* Contact details stay in memory and are loaded only through protected RPCs. */
const FU={key:store.get('fu_access',''),data:null,detail:null,loading:false,detailLoading:false,detailToken:0,autoTried:false,error:'',message:'',role:'own',person:'전체',status:'미대응 확인',year:'전체',period:'all',query:'',selected:'',page:0,issued:null};
const fuStatus=raw=>{const s=txt(raw).replace(/\s/g,'');if(/종료|취소|거절|포기|실주/.test(s))return '종료';if(/계약/.test(s)&&!/미계약|계약전|계약예정|계약검토|계약대기/.test(s))return '계약';if(/진행|상담|미팅|검토|제안|대기|보류|예정/.test(s))return '진행 중';return /미계약/.test(s)?'미계약':'미분류';};
const fuEnd=r=>r.status==='계약';
function fuManualAlert(r,today=FU.data?.today||v10Today()){
 const f=r.followup||{};
 if(f.nextContact&&f.nextContact<today)return {key:'late',label:'연락 기한 지남',rank:0};
 if(f.nextContact===today)return {key:'today',label:'오늘 연락',rank:1};
 if(f.requested)return {key:'request',label:'연락 요청',rank:2};
 if(f.nextContact)return {key:'planned',label:'연락 예정',rank:4};
 if(!fuEnd(r)&&!f.lastContact)return {key:'unknown',label:'연락 기록 확인 필요',rank:3};
 if(!fuEnd(r)&&f.lastContact)return {key:'unscheduled',label:'다음 연락일 미정',rank:3};
 return {key:'closed',label:'별도 연락 일정 없음',rank:5};
}
const fuDays=(date,today)=>date?Math.max(0,Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000)):null;
function fuScope(r,role=FU.role,today=FU.data?.today||v10Today()){
 return !!r[role]&&r[role]!=='미지정'&&(role!=='own'||!!r.meetingISO&&r.meetingISO<=today);
}
function fuAlert(r,today=FU.data?.today||v10Today()){
 if(fuEnd(r))return {key:'closed',label:'계약 · 확인 제외',rank:5,days:null,date:'',basis:'B열 계약 상태'};
 const candidates=[{date:r.noteEvidence?.date,basis:'M열 상담기록 날짜'+(r.noteEvidence?.inferredYear?' (연도 추정)':'')},{date:r.noteObserved?.changed,basis:'M열 변경 감지일'},{date:r.followup?.lastContact,basis:'별도 등록한 실제 연락일'}].filter(x=>x.date&&x.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
 if(!candidates.length)return {key:'unknown',label:'기록 날짜 확인 필요',rank:1,days:null,date:'',basis:'과거 수정일·연락일 확인 불가'};
 const evidence=candidates[0],days=fuDays(evidence.date,today);
 // A later meeting is not a new note/contact, but should not be treated as 30 days overdue yet.
 const meetingRecent=r.meetingISO&&r.meetingISO<=today&&fuDays(r.meetingISO,today)<30;
 return {...evidence,days,key:days>=30&&!meetingRecent?'stale':'recent',label:days>=30&&!meetingRecent?'미대응 확인 대상':meetingRecent&&days>=30?'최근 미팅 · 후속 기록 확인':'최근 기록 있음',rank:days>=30&&!meetingRecent?0:3};
}
function fuEvidence(r){const a=fuAlert(r);return `<div class="fu-evidence"><b>${esc(a.date||'날짜 미확인')}</b><small>${esc(a.basis)}</small>${a.days!==null?`<strong>${a.days}일 경과</strong>`:''}${r.meetingISO?`<small>미팅 후 ${fuDays(r.meetingISO,FU.data?.today||v10Today())}일</small>`:''}</div>`;}
function fuRows(ignoreStatus=false){
 const rows=(FU.data?.rows||[]).filter(r=>fuScope(r)&&(FU.person==='전체'||r[FU.role]===FU.person)&&(FU.year==='전체'||r.year===Number(FU.year))&&(FU.period!=='selected'||(r.year===Number(DB.year)&&selMonths().includes(r.month)))&&(!FU.query||[r.no,r.customer,r.phone,r.address,r.cons,r.own].join(' ').toLowerCase().includes(FU.query.toLowerCase())));
 return rows.filter(r=>ignoreStatus||FU.status==='전체'||FU.status==='미대응 확인'&&fuAlert(r).key==='stale'||FU.status==='날짜 확인'&&fuAlert(r).key==='unknown'||FU.status==='최근 기록'&&fuAlert(r).key==='recent'||FU.status==='미계약'&&!fuEnd(r)||r.status===FU.status).sort((a,b)=>fuAlert(a).rank-fuAlert(b).rank||(fuAlert(b).days||0)-(fuAlert(a).days||0)||b.year-a.year||b.month-a.month||a.no.localeCompare(b.no));
}
function fuRPC(name,...args){return new Promise((resolve,reject)=>{
 if(typeof google==='undefined'||!google.script?.run){reject(Error('상담 후속관리는 운영 대시보드에서 연결됩니다.'));return;}
 google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e?.message||String(e))))[name](...args);
});}
function fuFlash(message,error=false){FU.message=error?'':message;FU.error=error?message:'';}
async function fuLoad(){
 if(FU.loading)return;const key=FU.key;FU.loading=true;FU.error='';render();
 try{const data=await fuRPC('getFollowupWorkspace',key);if(FU.key!==key)return;FU.data=data;if(!FU.data.actor.admin){FU.role=FU.data.actor.role;FU.person=FU.data.actor.name;}FU.page=0;}
 catch(e){if(FU.key===key)fuFlash(e.message,true);}finally{if(FU.key===key){FU.loading=false;render();}}
}
async function fuOpen(r){
 const token=++FU.detailToken;FU.selected=r.id;FU.detail=null;FU.detailLoading=true;fuFlash('');render();
 try{const detail=await fuRPC('getFollowupDetail',FU.key,{id:r.id,year:r.year,sourceRow:r.sourceRow});if(token===FU.detailToken)FU.detail={...detail,noteObserved:r.noteObserved};}
 catch(e){if(token===FU.detailToken)fuFlash(e.message,true);}finally{if(token===FU.detailToken){FU.detailLoading=false;render();document.querySelector('.fu-detail')?.scrollIntoView({behavior:'smooth',block:'start'});}}
}
const fuBadge=r=>`<span class="fu-badge ${fuAlert(r).key}">${esc(fuAlert(r).label)}</span>`;
const fuSelect=(label,key,options)=>`<label>${esc(label)}<select data-fu-filter="${key}">${options.map(v=>`<option value="${esc(v[0])}" ${String(FU[key])===String(v[0])?'selected':''}>${esc(v[1])}</option>`).join('')}</select></label>`;
function fuLink(r){return 'https:'+'/'+'/docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit#gid='+encodeURIComponent(r.gid)+'&range='+encodeURIComponent('A'+r.sourceRow+':M'+r.sourceRow);}
function fuLoading(){return `<section class="fu-lock" role="status"><div class="fu-lock-icon">상담 후속관리</div><h2>담당 상담과 연락 일정을 불러오는 중입니다.</h2><p>이 브라우저에 확인된 관리 권한을 불러오고 있습니다.</p></section>`;}
function fuLogin(){return `<section class="fu-lock"><div class="fu-lock-icon">상담 후속관리</div><h2>이 브라우저는 최초 한 번만 담당자 확인이 필요합니다.</h2><p>확인이 끝나면 접속 종료 전까지 이 메뉴를 누르는 즉시 상담 목록이 열립니다.<br>팀 담당자는 관리자에게 받은 본인 전용 코드를 입력하면 배정된 상담만 볼 수 있습니다.</p><form id="fuLogin"><label>최초 확인용 접속 코드<input name="code" type="password" autocomplete="off" required minlength="20" placeholder="관리자 또는 담당자 접속 코드"></label><button class="btn primary" ${FU.loading?'disabled':''}>${FU.loading?'불러오는 중…':'이 브라우저에서 바로 보기'}</button></form><p class="v10-note">고객 전화번호와 주소를 보호하기 위한 최초 확인입니다. 확인 코드는 저장하지 않고 이 브라우저 전용 권한만 안전하게 기억하며, 접속 종료를 누르면 해제됩니다.</p>${FU.error?`<p class="fu-error" role="alert">${esc(FU.error)}</p>`:''}</section>`;}
function fuDetail(){
 const base=FU.data.rows.find(r=>r.id===FU.selected);if(!base)return '';
 if(FU.detailLoading)return `<section class="fu-detail fu-detail-loading" role="status"><h2>상담 상세를 불러오는 중…</h2><p>목록보다 긴 상담 내용은 선택한 한 건만 안전하게 읽습니다.</p></section>`;
 const r=FU.detail;if(!r)return `<section class="fu-detail fu-detail-loading" role="alert"><h2>상담 상세를 불러오지 못했습니다.</h2><p>${esc(FU.error||'목록을 새로고침한 뒤 다시 선택하세요.')}</p><button class="btn" data-fu-action="close">닫기</button></section>`;
 const f=r.followup,a=fuAlert(r),recipients=[...new Set([r.cons,r.own].filter(x=>x&&x!=='미지정'))];
 const fields=[['고객 이름',r.customer],['전화번호',r.phone],['이메일',r.email],['컨설팅 담당자',r.cons],['현장 미팅 담당자',r.own],['사업형태',r.type],['주소',r.address],['미팅일 / 용량',[r.meetingDate,r.capacity].filter(Boolean).join(' / ')],['상담기록 날짜 (M)',(r.noteEvidence?.date||'날짜 확인 필요')+(r.noteEvidence?.inferredYear?' · 시트 연도 추정':'')],['M열 변경 감지일',r.noteObserved?.changed||'감지된 변경 없음 · 과거 수정일 아님'],['변경 비교 시작일',r.noteObserved?.since||'미확인'],['실제 연락일 (별도 등록)',f.lastContact||'미등록 · 미연락 확정 아님'],['판정 근거',a.basis+(a.days!==null?' · '+a.days+'일 경과':'')]];
 return `<section class="fu-detail" role="region" aria-label="상담 상세"><header><div><small>${r.year}년 상담일지 · ${esc(r.statusRaw||'상태 미기재')}</small><h2>${esc(r.no)} <span>${esc(r.customer||'고객명 확인')}</span></h2></div><button class="btn" data-fu-action="close">상세 닫기</button></header><div class="fu-detail-body"><div><div class="fu-detail-fields">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'미기재')}${k==='전화번호'&&v?` <a href="tel:${esc(v.split(' / ')[0].replace(/[^+\d]/g,''))}">전화 걸기</a>`:''}</dd></div>`).join('')}</div><div class="fu-actions"><a href="${fuLink(r)}" target="_blank" rel="noopener">원본 상담일지 보기 ↗</a>${r.address?`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}" target="_blank" rel="noopener">주소 지도 보기 ↗</a>`:''}</div><details class="fu-raw"><summary>원본 고객·연락처 표기</summary><p>${esc(r.contactRaw||'미기재')}</p></details><div class="fu-detail-fields"><div><dt>한전선로 · 계통</dt><dd class="fu-pre">${esc(r.kepco||'원본에 별도 표기 없음')}</dd></div><div><dt>지자체 · 인허가</dt><dd class="fu-pre">${esc(r.municipality||'원본에 별도 표기 없음')}</dd></div></div><p class="v10-note">한전·지자체는 원본 열 또는 상담 내용에서 해당 단어가 포함된 문장을 표시합니다.</p><h3>상담 내용</h3><div class="fu-content">${esc(r.content||'상담 내용 미기재')}</div></div><aside><h3>다음 연락 관리</h3>${fuBadge(r)}<p class="v10-note">${f.lastContact?'마지막 기록된 연락 '+esc(f.lastContact):'기존 연락 여부는 확인 후 기록하세요.'}</p>${r.duplicate?'<p class="fu-error">같은 연도에 상담번호가 중복됩니다. 원본 확인 전에는 저장할 수 없습니다.</p>':''}<form id="fuRecord" data-id="${esc(r.id)}" data-version="${f.version||0}"><label>처리<select name="action"><option value="schedule">다음 연락 예약</option><option value="contact">연락 결과 기록</option><option value="request">담당자에게 연락 요청 알림</option><option value="resolve">연락 알림 해제</option></select></label><label>연락한 날짜<input name="lastContact" type="date" max="${v10Today()}" value="${esc(f.lastContact||'')}"></label><label>다음 연락일<input name="nextContact" type="date" value="${esc(f.nextContact||'')}"></label><label>알림 수신 담당자<select name="recipient"><option value="">선택</option>${recipients.map(n=>`<option ${n===(f.recipient||r.cons)?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label>연락 결과 · 요청 메모<textarea name="note" maxlength="300" rows="4" placeholder="통화 결과와 다음에 확인할 내용을 적으세요."></textarea></label><button class="btn primary" ${r.duplicate||FU.loading?'disabled':''}>${FU.loading?'저장 중…':'연락 기록 저장'}</button><p class="v10-note">연락 기록은 팀 공용으로 저장됩니다. 원본 상담 내용과 상태는 원본에서 수정합니다.</p></form><h3>최근 기록</h3><ol class="fu-history">${(f.history||[]).slice().reverse().map(h=>`<li><b>${esc(({contact:'연락 결과',schedule:'연락 예약',request:'연락 요청',resolve:'알림 해제'})[h.action]||h.action)}</b><small>${esc(h.at.slice(0,16).replace('T',' '))} UTC · ${esc(h.by)}</small><p>${esc(h.note||'메모 없음')}</p>${h.nextContact?`<small>다음 연락 ${esc(h.nextContact)}</small>`:''}</li>`).join('')||'<li>아직 등록한 기록이 없습니다.</li>'}</ol><small>최근 5회 기록 보관</small></aside></div></section>`;
}
function fuAdmin(){
 if(!FU.data.actor.admin)return '';
 const names=[...new Set(FU.data.rows.map(r=>r[FU.role]).filter(x=>x!=='미지정'))].sort();
 return `<details class="easy-details"><summary>담당자 접속 코드 발급</summary><p class="v10-note">현재 선택한 역할(${FU.role==='cons'?'컨설팅':'현장 미팅'})의 담당 상담만 볼 수 있는 코드입니다. 재발급하면 이전 코드는 해제됩니다.</p><form id="fuAccess" class="fu-access"><label>담당자<select name="name">${names.map(n=>`<option>${esc(n)}</option>`).join('')}</select></label><button class="btn" ${FU.loading?'disabled':''}>담당자 코드 발급</button></form>${FU.issued?`<div class="fu-issued"><b>${esc(FU.issued.name)} 담당자 코드</b><input readonly aria-label="발급한 담당자 코드" value="${esc(FU.issued.code)}"><small>선택해 복사한 뒤 해당 담당자에게 전달하세요. 이 화면을 나가면 다시 표시하지 않습니다.</small></div>`:''}</details>`;
}
function fuView(){
 if(!FU.data){
  if(!FU.autoTried&&!FU.loading){FU.autoTried=true;setTimeout(()=>fuLoad(),0);return fuLoading();}
  return FU.loading?fuLoading():fuLogin();
 }
 const base=fuRows(true),rows=fuRows(),counts={stale:0,recent:0,unknown:0,closed:0};base.forEach(r=>{const k=fuAlert(r).key;if(k in counts)counts[k]++;});
 const people=[...new Set(FU.data.rows.map(r=>r[FU.role]).filter(n=>n&&n!=='미지정'))].sort(),years=[...new Set(FU.data.rows.map(r=>r.year))].sort((a,b)=>b-a),pages=Math.max(1,Math.ceil(rows.length/40));FU.page=Math.min(FU.page,pages-1);
 const tabs=['미대응 확인','날짜 확인','최근 기록','미계약','전체','진행 중','종료','계약','미분류'];
 return `<div class="fu-role-tabs" role="group" aria-label="후속관리 담당 구분">${[['own','필드','H열 필드영업 담당 · J열 미팅 완료'],['cons','컨설팅','G열 컨설팅 담당 · 미팅 전 상담 포함']].map(([k,label,sub])=>`<button data-fu-role-tab="${k}" class="${FU.role===k?'on':''}" aria-pressed="${FU.role===k}" ${!FU.data.actor.admin&&FU.data.actor.role!==k?'disabled':''}><b>${label}</b><small>${sub}</small></button>`).join('')}</div>`
 +easyLead(FU.role==='own'?'미팅 이후, 후속 기록이 멈춘 상담':'담당 상담의 후속 기록을 확인하세요','계약을 제외한 상담을 확인합니다. 종료·보류도 포함하며, 실제 미연락 여부는 담당자 확인이 필요합니다.','상담일지 원본 기준')
 +`<div class="fu-toolbar"><span>${esc(FU.data.actor.name)} ${FU.data.actor.admin?'· 전체 조회':'· 담당 상담 조회'}</span><small>조회 ${esc(new Date(FU.data.at).toLocaleString('ko-KR'))}</small><button class="btn" data-fu-action="refresh" ${FU.loading?'disabled':''}>${FU.loading?'불러오는 중…':'상담 새로고침'}</button><button class="btn" data-fu-action="logout">접속 종료</button></div>`
 +(FU.error?`<p class="fu-error" role="alert">${esc(FU.error)}</p>`:'')+(FU.message?`<p class="fu-success" role="status">${esc(FU.message)}</p>`:'')
 +(FU.data.observationWarning?`<p class="fu-error" role="alert">${esc(FU.data.observationWarning)} · 상담기록 날짜로 확인하세요.</p>`:'')
 +`<div class="fu-metrics"><div class="request"><span>${FU.role==='own'?'미팅 후 미계약':'담당 미계약 상담'}</span><strong>${base.length-counts.closed}</strong><small>B열 계약 제외 · 종료 포함</small></div><div class="late"><span>30일 이상 미대응 확인</span><strong>${counts.stale}</strong><small>기록·변경·등록 연락이 오래된 상담</small></div><div class="today"><span>기록 날짜 확인 필요</span><strong>${counts.unknown}</strong><small>날짜 근거가 없어 별도 확인</small></div><div class="recent"><span>최근 기록·미팅</span><strong>${counts.recent}</strong><small>30일 이내 근거 있음 · 연락 완료와 다름</small></div></div>`
 +`<details class="fu-method"><summary>미대응은 어떻게 판단하나요? · 30일 기준</summary><p><b>필드:</b> H열 담당자가 있고 J열 미팅일이 오늘까지인 상담. <b>컨설팅:</b> G열 담당 상담 전체. B열 계약은 제외하고 종료·보류는 포함합니다.</p><p>M열의 날짜로 시작하는 문단에서 최근 날짜를 찾습니다. 문장 중간의 한전·예정일은 사용하지 않습니다. 연도 없는 날짜는 상담 시트 연도를 적용해 ‘연도 추정’으로 표시합니다. 과거 기록의 연도가 다르면 원본 확인이 필요합니다.</p><p>상담기록 날짜, 이후 감지한 M열 변경일, 별도 등록한 실제 연락일 중 최근 근거가 30일 이상 지났을 때 확인 대상으로 표시합니다. 최근 30일 이내 미팅은 별도 유예합니다. <b>내용 수정은 통화 증명이 아니며, 기록이 없다고 미연락으로 확정하지 않습니다.</b></p><p>구글의 과거 셀 ‘수정 기록 표시’는 자동으로 읽지 못합니다. 이 기능을 적용한 뒤 상담을 조회할 때 M열 내용의 변경을 비교합니다. 최초 조회일을 수정일로 처리하지 않으며, 조회 사이 변경·원복은 감지하지 못합니다. 정확한 과거 수정일은 원본 셀의 수정 기록에서 확인하세요.</p></details>`
 +`<section class="fu-filter-panel"><div class="fu-filter-grid">${fuSelect('담당자','person',[['전체','전체 담당자'],...people.map(n=>[n,n])])}${fuSelect('문의 연도','year',[['전체','2025년 이후 전체'],...years.map(y=>[y,y+'년'])])}${fuSelect('조회 범위','period',[['all','과거 상담까지 전체'],['selected','상단에서 선택한 문의월']])}<label class="fu-search">상담 찾기<input data-fu-search value="${esc(FU.query)}" placeholder="상담번호 · 고객 · 전화 · 주소 (Enter)"></label><button class="btn" data-fu-action="reset">조건 초기화</button></div><p class="v10-note">계약 분류는 상담일지 B열 기준이며 RPS 계약 확정 실적과 별개입니다. 필드 목록은 미팅 미입력·미래 미팅을 제외합니다.</p></section>`
 +`<div class="fu-tabs" role="group" aria-label="상담 상태">${tabs.map(t=>`<button data-fu-status="${t}" class="${FU.status===t?'on':''}" aria-pressed="${FU.status===t}">${t}${t==='미대응 확인'?` ${counts.stale}`:t==='날짜 확인'?` ${counts.unknown}`:''}</button>`).join('')}</div>`
 +fuDetail()
 +v10Panel('담당 상담 목록',`${rows.length.toLocaleString()}건 · 상담번호 선택 → 연락처·주소·한전·지자체·전체 상담 내용 확인`,(rows.length?v10Table(['확인 상태','상담번호','B 진행 최종','담당자','J 미팅일','판정 근거 · 경과일','최근 상담기록 발췌','고객 / 전화'],rows.slice(FU.page*40,(FU.page+1)*40).map(r=>[fuBadge(r),`<button data-fu-open="${esc(r.id)}">${r.year} / ${esc(r.no)}</button>`,esc(r.statusRaw||'미기재'),esc(r[FU.role]),esc(r.meetingISO||'미입력'),fuEvidence(r),`<span class="fu-note-excerpt">${esc(r.noteEvidence?.excerpt||'날짜로 시작하는 기록 없음')}</span>`,`<div>${esc(r.customer||'미기재')}<br>${esc(r.phone||'미기재')}</div>`])):'<p class="fu-empty">이 조건에 해당하는 상담이 없습니다. ‘날짜 확인’ 또는 ‘전체’를 선택해 다른 상담을 확인하세요.</p>')+`<div class="fu-pagination"><button class="btn" data-fu-page="-1" ${FU.page===0?'disabled':''}>이전</button><span>${FU.page+1} / ${pages}</span><button class="btn" data-fu-page="1" ${FU.page>=pages-1?'disabled':''}>다음</button></div>`)
 +fuAdmin();
}
VIEWS.followup=fuView;
EASY_NAV.splice(5,0,{k:'followup',label:'상담 후속관리',sub:'담당 상담 · 연락 일정 · 알림'});
const fuOldRender=render;
render=function(){fuOldRender();const bar=$('#periodbar');if(bar)bar.classList.toggle('fu-period-hidden',state.sect==='followup'&&FU.period==='all');const independent=['contract','followup'].includes(state.sect);$('#basisNote')?.classList.toggle('hide',independent);$('#easyFilterToggle')?.classList.toggle('hide',independent);if(independent)$('#easyConditions')?.classList.add('hide');if(state.sect==='contract')$('#easyPeriodNote').textContent=`${DB.year}년 ${periodLabel()} · ${contractBasisLabel()} 기준 · 아래 계약 전용 조건 적용`;const title=$('#sectTitle');if(title&&FU.data&&title.insertAdjacentHTML){document.querySelector('#fuBell')?.remove();const count=FU.data.rows.filter(r=>fuScope(r)&&fuAlert(r).key==='stale').length;title.insertAdjacentHTML('afterend',`<button id="fuBell" class="fu-bell" data-v10-section="followup">${FU.role==='own'?'필드':'컨설팅'} 미대응 확인 ${count}</button>`);}};
document.addEventListener('submit',async e=>{
 if(e.target.id==='fuLogin'){e.preventDefault();FU.key=txt(new FormData(e.target).get('code'));FU.autoTried=true;await fuLoad();if(FU.data){try{const remembered=await fuRPC('rememberFollowupAccess',FU.key);FU.key=remembered.code;store.set('fu_access',FU.key);fuFlash('이 브라우저에서는 앞으로 바로 열립니다.');render();}catch(err){fuFlash('상담은 열렸지만 자동 접속 저장에 실패했습니다.',true);render();}}return;}
 if(e.target.id==='fuAccess'){e.preventDefault();if(FU.loading)return;FU.loading=true;const data=new FormData(e.target);try{FU.issued=await fuRPC('issueFollowupAccess',FU.key,{name:data.get('name'),role:FU.role});fuFlash('담당자 코드가 발급됐습니다.');}catch(err){fuFlash(err.message,true);}finally{FU.loading=false;render();}return;}
 if(e.target.id!=='fuRecord')return;e.preventDefault();if(FU.loading)return;
 const f=new FormData(e.target),input={id:e.target.dataset.id,version:Number(e.target.dataset.version),action:f.get('action'),lastContact:f.get('lastContact'),nextContact:f.get('nextContact'),recipient:f.get('recipient'),note:f.get('note')};
 FU.loading=true;const button=e.target.querySelector('button');button.disabled=true;button.textContent='저장 중…';
 try{const saved=await fuRPC('saveFollowupRecord',FU.key,input);FU.data.rows.filter(r=>r.id===input.id).forEach(r=>r.followup=saved);if(FU.detail?.id===input.id)FU.detail.followup=saved;fuFlash(input.action==='request'?'담당자 대시보드에 연락 요청 알림을 등록했습니다.':'연락 기록을 저장했습니다.');FU.loading=false;render();}
 catch(err){FU.loading=false;fuFlash(err.message,true);button.disabled=false;button.textContent='연락 기록 저장';e.target.querySelector('.fu-error')?.remove();e.target.insertAdjacentHTML('beforeend',`<p class="fu-error" role="alert">${esc(err.message)}</p>`);}
});
document.addEventListener('change',e=>{const k=e.target.dataset?.fuFilter;if(!k)return;if(!FU.data?.actor.admin&&['role','person'].includes(k)){fuFlash('담당자는 본인에게 배정된 상담만 조회합니다.');render();return;}FU[k]=e.target.value;if(k==='role')FU.person='전체';FU.page=0;FU.selected='';FU.detail=null;FU.detailLoading=false;FU.detailToken++;FU.issued=null;render();});
document.addEventListener('keydown',e=>{if(e.target.hasAttribute?.('data-fu-search')&&e.key==='Enter'){FU.query=e.target.value.trim();FU.page=0;render();}});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-fu-action],[data-fu-status],[data-fu-open],[data-fu-page],[data-fu-person],[data-fu-role-tab]');if(!b||b.disabled)return;
 if(b.hasAttribute('data-fu-role-tab')){if(!FU.data.actor.admin&&b.dataset.fuRoleTab!==FU.data.actor.role)return;FU.role=b.dataset.fuRoleTab;FU.person=FU.data.actor.admin?'전체':FU.data.actor.name;FU.status='미대응 확인';FU.page=0;FU.selected='';FU.detail=null;FU.detailLoading=false;FU.detailToken++;FU.issued=null;render();return;}
 if(b.dataset.fuPerson){FU.person=b.dataset.fuPerson;FU.role=b.dataset.fuRole||'cons';FU.status='전체';state.sect='followup';render();return;}
 if(b.hasAttribute('data-fu-open')){const r=FU.data.rows.find(r=>r.id===b.dataset.fuOpen);if(r)await fuOpen(r);return;}
 if(b.hasAttribute('data-fu-status')){FU.status=b.dataset.fuStatus;FU.page=0;FU.selected='';FU.detail=null;FU.detailLoading=false;FU.detailToken++;render();return;}
 if(b.hasAttribute('data-fu-page')){FU.page+=Number(b.dataset.fuPage);render();return;}
 const action=b.dataset.fuAction;
 if(action==='refresh'){await fuLoad();return;}
 if(action==='logout'){const old=FU.key;FU.key='';store.del('fu_access');FU.data=null;FU.detail=null;FU.detailLoading=false;FU.detailToken++;FU.issued=null;FU.selected='';FU.loading=false;FU.autoTried=true;fuFlash('');document.querySelector('#fuBell')?.remove();if(old)fuRPC('forgetFollowupAccess',old).catch(()=>{});}
 if(action==='close'){FU.selected='';FU.detail=null;FU.detailLoading=false;FU.detailToken++;}
 if(action==='reset'){FU.role=FU.data.actor.admin?'own':FU.data.actor.role;FU.person=FU.data.actor.admin?'전체':FU.data.actor.name;FU.year='전체';FU.period='all';FU.status='미대응 확인';FU.query='';FU.page=0;FU.selected='';FU.detail=null;FU.detailLoading=false;FU.detailToken++;}
 render();
});
// Refresh the in-app alert badge while signed in. Never send emails or push messages.
setInterval(()=>{if(FU.data&&!FU.loading&&!FU.selected&&!document.hidden)fuLoad();},300000);
