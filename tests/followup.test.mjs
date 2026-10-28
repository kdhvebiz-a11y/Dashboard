import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../apps-script/v10/followup.gs',import.meta.url),'utf8');
const props=new Map();const ps={getProperty:k=>props.get(k)||null,setProperty(k,v){props.set(k,v)},deleteProperty(k){props.delete(k)},getProperties:()=>Object.fromEntries(props)};
const context=vm.createContext({console,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s)=>[...createHash('sha256').update(s).digest()],formatDate:()=> '2026-09-17',getUuid:randomUUID,newBlob:s=>({getBytes:()=>Buffer.from(s)})},PropertiesService:{getScriptProperties:()=>ps},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
vm.runInContext(src.replace('__FOLLOWUP_ADMIN_HASH__',createHash('sha256').update('admin-secret-for-test-only').digest('hex')),context);
vm.runInContext(await readFile(new URL('../apps-script/v10/followup-source.gs',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run(`var fixture=[{id:'2026:09-001',no:'09-001',cons:'김상담',own:'박현장',status:'진행 중'},{id:'2026:09-002',no:'09-002',cons:'이상담',own:'최현장',status:'진행 중'}];fuRows_=function(actor){return fixture.filter(function(r){return fuAllowed_(actor,r);}).map(function(r){return Object.assign({},r);});};`);
assert.throws(()=>run("getFollowupWorkspace('bad')"),/접속 코드/);
assert.equal(run("getFollowupWorkspace('admin-secret-for-test-only').rows.length"),2);
context.Session={getActiveUser:()=>({getEmail:()=> 'owner@example.com'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})};
assert.equal(run("getFollowupWorkspace('').actor.google"),true,'signed-in script owner opens without a second code');
delete context.Session;
const remembered=run("rememberFollowupAccess('admin-secret-for-test-only')");context.remembered=remembered.code;
assert.equal(remembered.persistent,true);assert.equal('expiresAt' in remembered,false,'remembered access has no time limit');
assert.equal(run("getFollowupWorkspace(remembered).actor.admin"),true,'remembered browser token opens protected workspace');
const legacyKey='fu_session_'+createHash('sha256').update(remembered.code).digest('hex');
props.set(legacyKey,JSON.stringify({actor:{admin:true,name:'관리자',role:'admin'},expiresAt:1}));
assert.equal(run("getFollowupWorkspace(remembered).actor.admin"),true,'legacy expired timestamp no longer interrupts registered access');
run("forgetFollowupAccess(remembered)");assert.throws(()=>run('getFollowupWorkspace(remembered)'),/해제/);
const staff=run("issueFollowupAccess('admin-secret-for-test-only',{name:'김상담',role:'cons'})");context.staff=staff.code;
assert.equal(run('getFollowupWorkspace(staff).rows.length'),1);
assert.throws(()=>run("issueFollowupAccess(staff,{name:'이상담',role:'cons'})"),/관리자/);
assert.throws(()=>run("saveFollowupRecord(staff,{id:'2026:09-002',version:0,action:'schedule',nextContact:'2026-09-18'})"),/권한/);
assert.throws(()=>run("saveFollowupRecord(staff,{id:'2026:09-001',version:0,action:'contact',lastContact:'2026-09-18'})"),/이후/);
assert.throws(()=>run("saveFollowupRecord(staff,{id:'2026:09-001',version:0,action:'schedule',nextContact:'2026-02-30'})"),/날짜/);
assert.equal(run("saveFollowupRecord(staff,{id:'2026:09-001',version:0,action:'request',nextContact:'2026-09-18',recipient:'박현장',note:'통화 요청'}).requested"),true);
assert.throws(()=>run("saveFollowupRecord(staff,{id:'2026:09-001',version:0,action:'schedule',nextContact:'2026-09-19'})"),/먼저 수정/);
assert.equal(run("saveFollowupRecord(staff,{id:'2026:09-001',version:1,action:'contact',lastContact:'2026-09-17',nextContact:'2026-09-20',note:'확인 완료'}).requested"),false);
assert.equal(run("getFollowupWorkspace(staff).rows[0].followup.version"),2);
run("fixture.push({...fixture[0]})");assert.throws(()=>run("saveFollowupRecord(staff,{id:'2026:09-001',version:2,action:'schedule',nextContact:'2026-09-20'})"),/중복/);run('fixture.pop()');
run("issueFollowupAccess('admin-secret-for-test-only',{name:'김상담',role:'cons'})");assert.throws(()=>run('getFollowupWorkspace(staff)'),/해제/);
for(const [raw,status]of [['소개 (계약)','계약'],['미계약','미계약'],['계약 취소','종료'],['소개 (진행)','진행 중'],['계약 예정','진행 중'],['종료','종료'],['','미분류']])assert.equal(context.fuStatus_(raw),status);
const parsed=context.fuExtract_(['','','','홍길동 010-1234-5678 test@example.com','서울시','','','','','','','','한전 선로 여유 확인\n지자체 이격거리 확인\n상담 기록'],[]);
assert.equal(parsed.customer,'홍길동');assert.equal(parsed.phone,'010-1234-5678');assert.equal(parsed.kepco,'한전 선로 여유 확인');assert.equal(parsed.municipality,'지자체 이격거리 확인');
const listOnly=context.fuContact_(['','','','홍길동 010-1234-5678','서울시']);assert.equal(listOnly.customer,'홍길동');assert.equal('content' in listOnly,false);
const ui=await readFile(new URL('../apps-script/v10/followup.js',import.meta.url),'utf8');
const saved=new Map();const store={get:(k,d)=>saved.has(k)?saved.get(k):d,set:(k,v)=>saved.set(k,v),del:k=>saved.delete(k)};
const c=vm.createContext({txt:x=>String(x||'').trim(),v10Today:()=> '2026-09-17',VIEWS:{},EASY_NAV:[],store,render(){},document:{addEventListener(){}},setTimeout(){},setInterval(){},esc:x=>String(x==null?'':x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),easyLead:(a,b)=>`<h1>${a}</h1><p>${b}</p>`,v10Panel:(t,sub,body)=>`<section>${t}${sub}${body}</section>`,state:{}});vm.runInContext(ui,c);
// HtmlService's script processing misread the previous arrow-expression URL.
assert.equal(c.fuLink({gid:123,sourceRow:8}),'https://docs.google.com/spreadsheets/d/1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc/edit#gid=123&range=A8%3AM8');
const alert=(status,f,e={})=>c.fuAlert({status,followup:f,...e},'2026-09-17');
assert.equal(alert('진행 중',{}).key,'unknown');assert.equal(alert('종료',{}).key,'closed','ended consultations are excluded by default');assert.equal(alert('계약',{nextContact:'2026-09-15'}).key,'closed');
assert.equal(alert('미계약',{}, {noteEvidence:{date:'2026-08-18'}}).key,'stale','non-contract rows remain included at 30 days');
assert.equal(alert('진행 중',{}, {noteEvidence:{date:'2026-08-19'}}).key,'recent','29 days is not stale');
{const a=alert('진행 중',{}, {noteEvidence:{date:'2026-08-18'},meetingISO:'2026-09-01'});assert.equal(a.key,'nofeedback','a meeting with no later note is missing feedback');assert.equal(a.days,16,'days are counted from the meeting');}
assert.equal(alert('진행 중',{}, {noteEvidence:{date:'2026-09-02'},meetingISO:'2026-09-01'}).key,'recent','a note dated after the meeting is feedback');
assert.equal(alert('진행 중',{lastContact:'2026-09-05'},{meetingISO:'2026-09-01'}).key,'recent','a registered contact after the meeting is feedback');
assert.equal(alert('진행 중',{}, {noteObserved:{changed:'2026-09-10'},meetingISO:'2026-09-01'}).key,'recent','a detected M-column change after the meeting is feedback');
assert.equal(alert('진행 중',{}, {meetingISO:'2026-09-18'}).key,'unknown','a future meeting is not awaiting feedback');
assert.equal(alert('진행 중',{}, {meetingISO:'2026-09-17'}).days,0,'a meeting today counts as day 0');
assert.equal(alert('진행 중',{}, {noteObserved:{since:'2026-09-17',changed:''}}).key,'unknown','first observation is not an edit');
assert.equal(alert('진행 중',{}, {noteEvidence:{date:'2026-08-18'},noteObserved:{changed:'2026-09-17'}}).key,'recent');
assert.equal(alert('진행 중',{lastContact:'2026-09-16'},{noteEvidence:{date:'2026-01-01'}}).key,'recent');
assert.equal(alert('진행 중',{}, {noteEvidence:{date:'2026-10-01'}}).key,'unknown','future evidence ignored');
assert.equal(c.fuScope({own:'박',meetingISO:'2026-09-18'},'own','2026-09-17'),false);
assert.equal(c.fuScope({own:'박'},'own','2026-09-17'),false);
assert.equal(c.fuScope({cons:'김'},'cons','2026-09-17'),true);
vm.runInContext("FU.data={today:'2026-09-17',rows:[{id:'a',no:'01-1',year:2026,month:1,cons:'김',own:'박',meetingISO:'2026-01-01',status:'미계약',noteEvidence:{date:'2026-01-01'},followup:{}},{id:'b',no:'01-2',year:2026,month:1,cons:'김',own:'박',meetingISO:'2026-01-01',status:'진행 중',followup:{}}]};",c);
assert.equal(vm.runInContext('FU.role',c),'own');assert.equal(vm.runInContext('FU.status',c),'피드백 없음');assert.equal(vm.runInContext('fuRows().length',c),1,'row b: meeting with no later note');vm.runInContext("FU.status='미대응 확인'",c);assert.equal(vm.runInContext('fuRows().length',c),1,'row a: note on the meeting day counts as feedback, but is 30+ days old');vm.runInContext("FU.status='날짜 확인'",c);assert.equal(vm.runInContext('fuRows().length',c),0);
// 내용 칸 클릭 → 서버 호출 없이 바로 아래에 전체 내용 칸 · 쪽 번호 1 2 3 … 버튼
{
 const rows=Array.from({length:85},(_,k)=>({id:'r'+k,no:'01-'+k,year:2026,month:1,cons:'김',own:'박',meetingISO:'2026-01-01',status:'진행 중',followup:{},note:'첫 줄 '.repeat(100)+'\n끝줄 '+k}));
 vm.runInContext('FU.data='+JSON.stringify({today:'2026-09-17',actor:{admin:true,name:'관리자',role:'all'},at:'2026-09-17T00:00:00Z',rows})+";FU.role='cons';FU.person='전체';FU.status='전체';FU.page=0;FU.detail=null;FU.detailLoading=false;FU.detailFailed=false;FU.selected=fuRows()[0].id;var SEL=FU.selected",c);
 const sel=vm.runInContext('SEL',c),html=vm.runInContext('fuView()',c);
 assert.match(html,/fu-content-box/,'selected row expands instantly');assert.match(html,new RegExp('끝줄 '+sel.slice(1)+'<'),'full note shown');assert.doesNotMatch(html,/상담 상세를 불러오지 못했습니다/,'no detail error before the detail button');
 assert.match(html,new RegExp('data-fu-detail="'+sel+'"'),'detail button present');
 assert.equal((html.match(/fu-page-num/g)||[]).length,3,'85 rows → 3 page numbers');assert.match(html,/fu-page-num on" data-fu-goto="0"/);
 assert.equal(vm.runInContext("fuNotePreview({note:'가'.repeat(400)}).length",c),321,'preview trims to 320 chars');
 assert.equal(vm.runInContext("fuNotePreview({notePreview:'옛 캐시'})",c),'옛 캐시','old cache rows still render');
}
vm.runInContext('FU.data=null;FU.autoTried=false;FU.loading=false',c);assert.match(vm.runInContext('fuView()',c),/불러오는 중/);assert.equal(vm.runInContext('FU.autoTried',c),true);
assert.match(c.fuLogin(),/접속 종료 전까지/);assert.doesNotMatch(c.fuLogin(),/180일/);assert.equal(vm.runInContext("store.get('fu_access','')",c),'');
console.log('PASS: owner auto-auth, remembered browser access, protected staff scope, reissue revocation, conflicts, invalid dates, shared save, contact/status extraction, and alert boundaries');
// Pure-JS SHA-256 must match the platform digest so stored fu_record_/fu_session_ keys stay valid.
for(const s of ['','admin-secret-for-test-only','2026:09-0015','한글 메모 ▶ 2026/10/01 · 😀'.repeat(30)])assert.equal(run(`fuSha256_(${JSON.stringify(s)})`),createHash('sha256').update(s,'utf8').digest('hex'),'fuSha256_ equals SHA-256 hex');

// 관리자 빠른 경로: 서버 캐시의 gzip+base64 문자열을 그대로 받고(packed), 후속 기록은 fu_record_* 만 따로 온다.
{
 const {gzipSync,gunzipSync}=await import('node:zlib');
 const cache=new Map();
 run('var CacheService');
 context.CacheService={getScriptCache:()=>({get:k=>cache.get(k)||null,getAll:ks=>Object.fromEntries(ks.filter(k=>cache.has(k)).map(k=>[k,cache.get(k)])),put(k,v){cache.set(k,v)},putAll(o){Object.entries(o).forEach(([k,v])=>cache.set(k,v))}})};
 Object.assign(context.Utilities,{gzip:b=>({getBytes:()=>[...gzipSync(Buffer.from(b.getBytes()))]}),ungzip:b=>({getDataAsString:()=>gunzipSync(Buffer.from(b.getBytes())).toString('utf8')}),base64Encode:a=>Buffer.from(a).toString('base64'),base64Decode:s=>[...Buffer.from(s,'base64')]});
 context.Utilities.newBlob=(s)=>({getBytes:()=>Buffer.isBuffer(s)||Array.isArray(s)?Buffer.from(s):Buffer.from(String(s)),getDataAsString:()=>Buffer.from(s).toString('utf8')});
 props.set('fu_note_x_0','junk-that-must-not-travel');
 assert.equal(run("getFollowupWorkspace('admin-secret-for-test-only',false,true).packed"),undefined,'first call has no cache → normal rows');
 const packed=run("JSON.stringify(getFollowupWorkspace('admin-secret-for-test-only',false,true))");
 const data=JSON.parse(packed);
 assert.ok(typeof data.packed==='string'&&data.packed.length>20,'second call serves the cached blob');
 assert.ok(!Object.keys(data.records).some(k=>k.indexOf('fu_record_')!==0),'only follow-up records travel');
 assert.ok(Object.keys(data.records).some(k=>k.indexOf('fu_record_')===0),'follow-up records included');
 const base=JSON.parse(gunzipSync(Buffer.from(data.packed,'base64')).toString('utf8'));
 assert.equal(base.rows.length,2);assert.ok(base.rows.every(r=>r.stateKey),'rows carry stateKey for the client merge');
 run("var staff2=issueFollowupAccess('admin-secret-for-test-only',{name:'김상담',role:'cons'}).code");
 assert.equal(run("getFollowupWorkspace(staff2,false,true).packed"),undefined,'members never get the unfiltered blob');
 assert.equal(run("getFollowupWorkspace(staff2,false,true).rows.length"),1);
}
