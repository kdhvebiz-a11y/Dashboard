/* Private follow-up workspace. No personal fields are added to public JSON/cache. */
var FOLLOWUP_ADMIN_HASH_ = '__FOLLOWUP_ADMIN_HASH__';
// SHA-256을 순수 JS로 계산한다. Utilities.computeDigest는 호출마다 수십 ms가 걸려 상담 900행 × 3회 = 1분 이상 걸렸다.
// (결과는 Utilities.computeDigest(SHA_256, s, UTF_8)의 hex와 동일 — 저장된 fu_record_·fu_session_ 키가 그대로 맞는다.)
var FU_K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function fuUtf8_(str){var out=[];for(var i=0;i<str.length;i++){var c=str.charCodeAt(i);if(c>=0xd800&&c<0xdc00&&i+1<str.length){var d=str.charCodeAt(i+1);if(d>=0xdc00&&d<0xe000){c=0x10000+((c-0xd800)<<10)+(d-0xdc00);i++;}}
 if(c<0x80)out.push(c);else if(c<0x800)out.push(0xc0|c>>6,0x80|c&63);else if(c<0x10000)out.push(0xe0|c>>12,0x80|c>>6&63,0x80|c&63);else out.push(0xf0|c>>18,0x80|c>>12&63,0x80|c>>6&63,0x80|c&63);}return out;}
function fuSha256_(str){
 var m=fuUtf8_(str),l=m.length,bits=l*8;m.push(0x80);while(m.length%64!==56)m.push(0);
 for(var i=7;i>=0;i--)m.push(i>=4?0:(bits/Math.pow(2,i*8))&255);
 var h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Array(64);
 for(var off=0;off<m.length;off+=64){
  for(var t=0;t<16;t++)w[t]=(m[off+t*4]<<24)|(m[off+t*4+1]<<16)|(m[off+t*4+2]<<8)|m[off+t*4+3];
  for(t=16;t<64;t++){var x=w[t-15],y=w[t-2],s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3),s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);w[t]=(w[t-16]+s0+w[t-7]+s1)|0;}
  var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],k=h[7];
  for(t=0;t<64;t++){var S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)),ch=(e&f)^(~e&g),t1=(k+S1+ch+FU_K[t]+w[t])|0,S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)),mj=(a&b)^(a&c)^(b&c),t2=(S0+mj)|0;k=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
  h[0]=(h[0]+a)|0;h[1]=(h[1]+b)|0;h[2]=(h[2]+c)|0;h[3]=(h[3]+d)|0;h[4]=(h[4]+e)|0;h[5]=(h[5]+f)|0;h[6]=(h[6]+g)|0;h[7]=(h[7]+k)|0;
 }
 var hex='';for(i=0;i<8;i++)hex+=('00000000'+((h[i]>>>0).toString(16))).slice(-8);return hex;
}
var FU_HASH_MEMO={};
function fuHash_(s) { s=String(s); if(Object.prototype.hasOwnProperty.call(FU_HASH_MEMO,s))return FU_HASH_MEMO[s]; return FU_HASH_MEMO[s]=fuSha256_(s); }
function fuProps_(){return PropertiesService.getScriptProperties();}
function fuToday_(){return Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd');}
function fuDate_(s){s=String(s||'');if(!s)return '';if(!/^20\d{2}-\d{2}-\d{2}$/.test(s)||isNaN(new Date(s+'T00:00:00Z').getTime())||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error('날짜 형식을 확인하세요.');return s;}
function fuAuth_(code){
 if(typeof code!=='string'||code.length<20||code.length>100)throw Error('접속 코드를 확인하세요.');
 var hash=fuHash_(code);
 if(hash===FOLLOWUP_ADMIN_HASH_)return {admin:true,name:'관리자',role:'all'};
 var p=fuProps_(),raw=p.getProperty('fu_access_'+hash);
 if(raw)return JSON.parse(raw);
 var sessionRaw=p.getProperty('fu_session_'+hash);
 if(sessionRaw){
  try{
   var session=JSON.parse(sessionRaw);
   // A remembered browser stays authorized until the user explicitly signs
   // out (or an administrator revokes its token). Legacy 180-day sessions
   // are intentionally accepted as permanent so existing registrations are
   // not interrupted by this policy change.
   if(session.actor)return session.actor;
  }catch(ignore){}
  p.deleteProperty('fu_session_'+hash);
 }
 throw Error('접속 코드가 올바르지 않거나 해제되었습니다.');
}
function fuActor_(code){
 // The dashboard owner is already authenticated by Google. When Apps Script
 // can identify that signed-in account, open the protected workspace without
 // asking for a second code. Public/anonymous visitors have no active email
 // here and still fall back to the scoped access-code check below.
 try{
  if(typeof Session!=='undefined'){
   var active=String(Session.getActiveUser().getEmail()||'').toLowerCase();
   var effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
   if(active&&effective&&active===effective)return {admin:true,name:'관리자',role:'all',google:true};
  }
 }catch(ignore){}
 return fuAuth_(code);
}
function fuAllowed_(actor,r){return actor.admin||r[actor.role]===actor.name;}
function rememberFollowupAccess(code){
 var actor=fuActor_(code),token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
 var p=fuProps_(),hash=fuHash_(token),all=p.getProperties();
 Object.keys(all).filter(function(k){return k.indexOf('fu_session_')===0;}).forEach(function(k){try{if(!JSON.parse(all[k]).actor)p.deleteProperty(k);}catch(ignore){p.deleteProperty(k);}});
 p.setProperty('fu_session_'+hash,JSON.stringify({actor:{admin:!!actor.admin,name:actor.name,role:actor.role},persistent:true,createdAt:new Date().toISOString()}));
 return {code:token,persistent:true};
}
function forgetFollowupAccess(code){
 if(typeof code==='string'&&code.length>=20&&code.length<=100)fuProps_().deleteProperty('fu_session_'+fuHash_(code));
 return true;
}
// 목록에 상담 내용 전체(빈 줄 정리, 6000자까지)를 실어 둔다 → 내용 칸을 누르면 서버 호출 없이 바로 펼쳐진다. 요약은 브라우저가 만든다.
var FU_NOTE_MAX=6000;
function fuPreview_(notes){
 var lines=String(notes||'').split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean);
 var text=lines.join('\n');
 return text.length>FU_NOTE_MAX?text.slice(0,FU_NOTE_MAX)+'\n…(이하 생략 · 원본 상담일지에서 확인)':text;
}
function fuText_(s,max){return String(s||'').trim().slice(0,max||500);}
function fuStatus_(s){
 s=String(s||'').replace(/\s/g,'');
 if(/종료|취소|거절|포기|실주/.test(s))return '종료';
 if(/계약/.test(s)&&!/미계약|계약전|계약예정|계약검토|계약대기/.test(s))return '계약';
 if(/진행|상담|미팅|검토|제안|대기|보류|예정/.test(s))return '진행 중';
 if(/미계약/.test(s))return '미계약';
 return '미분류';
}
function fuContact_(v){
 var contact=String(v[3]||''),notes=String(v[12]||''),phones=contact.match(/(?:\+82[- .]?)?0?\d{1,2}[- .]?\d{3,4}[- .]?\d{4}/g)||[];
 var emails=contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[];
 var name=contact;phones.concat(emails).forEach(function(s){name=name.replace(s,'');});
 return {customer:name.replace(/^[\s,;/]+|[\s,;/]+$/g,'').trim(),phone:phones.join(' / '),email:emails.join(' / '),address:String(v[4]||'')};
}
function fuExtract_(v,headers){
 var base=fuContact_(v),contact=String(v[3]||''),notes=String(v[12]||'');
 function field(rx,lineRx){var out=[];headers.forEach(function(h,i){if(i>=13&&rx.test(h)&&v[i])out.push(String(v[i]));});return out.length?out.join('\n'):notes.split(/\r?\n/).filter(function(s){return lineRx.test(s);}).join('\n');}
 return Object.assign(base,{contactRaw:contact,content:notes,kepco:field(/한전|선로|계통/,/한전|선로|계통/),municipality:field(/지자체|개발행위|인허가/,/지자체|개발행위|인허가/)});
}
function fuRows_(actor){
 var ss=SpreadsheetApp.openById(SHEET_ID),out=[],today=fuToday_(),thisYear=Number(fuToday_().slice(0,4));
 // 연도 탭만 이름으로 바로 연다(시트 전체를 돌며 getLastRow를 부르지 않는다).
 var sheets=[];for(var y=2025;y<=thisYear+1;y++){var sh=ss.getSheetByName(String(y));if(sh)sheets.push(sh);}
 sheets.forEach(function(sh){
  var year=Number(sh.getName());if(sh.getLastRow()<3)return;
  var values=sh.getRange(3,1,sh.getLastRow()-2,13).getDisplayValues();
  values.forEach(function(v,ix){
   var no=String(v[0]||'').trim(),m=no.match(/^(?:(?:sp|ugs)[- ]?)?(\d{1,2})-\d+/i);
   if(!m||Number(m[1])<1||Number(m[1])>12||(!v[2]&&!v[3]&&!v[12]))return;
   var r={id:year+':'+no.toLowerCase(),no:no,year:year,month:Number(m[1]),sourceRow:ix+3,sourceSheet:sh.getName(),gid:sh.getSheetId(),
    statusRaw:String(v[1]||''),status:fuStatus_(v[1]),type:String(v[2]||''),cons:String(v[6]||'').trim()||'미지정',own:String(v[7]||'').trim()||'미지정',meetingDate:String(v[9]||''),capacity:String(v[10]||'')};
   if(!fuAllowed_(actor,r))return;
   // 계약·종료 상담은 기본 목록에서 빠지므로 무거운 해시·날짜 분석을 건너뛴다 (상태 탭에서 고르면 기본 정보만 보인다).
   var closed=r.status==='계약'||r.status==='종료';
   out.push(Object.assign(r,fuContact_(v),{meetingISO:fuSourceDate_(v[9],year),noteEvidence:closed?{date:'',excerpt:'',inferredYear:false,futureHeadings:0}:fuNoteEvidence_(v[12],year,today),note:fuPreview_(v[12]),noteFingerprint:closed?'':fuHash_(String(v[12]||'')).slice(0,24)}));
  });
 });
 var counts={};out.forEach(function(r){counts[r.id]=(counts[r.id]||0)+1;});out.forEach(function(r){r.duplicate=counts[r.id]>1;});return out;
}
function fuStateKey_(id){return 'fu_record_'+fuHash_(id);}
// 상담 목록(전체)은 서버 캐시에 6시간(최대) 보관하고 30분마다 도는 캐시채우기 트리거가 새로 채운다.
// (예전 40분 보관은 트리거 한 번이 5분 넘게 걸리거나 시간 초과되면 캐시가 비어 사용자가 1~6분짜리 전체 읽기를 떠안았다.)
// 후속 기록(연락일·메모)은 캐시와 별개로 매번 새로 읽어 저장 즉시 반영된다.
var FU_CACHE_KEY='fu_rows_v1',FU_CACHE_SEC=21600;
function fuCache_(){try{return typeof CacheService!=='undefined'?CacheService.getScriptCache():null;}catch(e){return null;}}
// 캐시에 든 gzip+base64 문자열 그대로(서버에서 풀지 않음). 관리자 화면은 이 문자열을 받아 브라우저에서 푼다.
function fuCacheRaw_(){
 var c=fuCache_();if(!c)return null;
 try{var head=c.get(FU_CACHE_KEY);if(!head)return null;head=JSON.parse(head);var keys=[];for(var k=0;k<head.n;k++)keys.push(FU_CACHE_KEY+'_'+k);
  var parts=c.getAll(keys),enc='';for(var z=0;z<keys.length;z++){if(!parts[keys[z]])return null;enc+=parts[keys[z]];}
  return {enc:enc,at:head.at||''};}catch(e){return null;}
}
function fuCacheRead_(){
 var raw=fuCacheRaw_();if(!raw)return null;
 try{return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(raw.enc),'application/gzip')).getDataAsString());}catch(e){return null;}
}
// 후속 기록만 골라낸다(fu_record_*). 속성 저장소에는 내용 변경 추적 조각(fu_note_*)이 수백 KB 들어 있어 통째로 보내면 안 된다.
function fuRecords_(props){var out={};Object.keys(props).forEach(function(k){if(k.indexOf('fu_record_')===0)out[k]=props[k];});return out;}
function fuCacheWrite_(obj){
 var c=fuCache_();if(!c)return;
 try{var enc=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(obj),'application/json')).getBytes()),size=90000,n=Math.ceil(enc.length/size),put={};
  if(n>90)return;for(var k=0;k<n;k++)put[FU_CACHE_KEY+'_'+k]=enc.slice(k*size,(k+1)*size);
  c.putAll(put,FU_CACHE_SEC);c.put(FU_CACHE_KEY,JSON.stringify({n:n,at:obj.at}),FU_CACHE_SEC);}catch(e){}
}
function fuWorkspaceRows_(fresh){
 if(!fresh){var hit=fuCacheRead_();if(hit&&hit.rows)return hit;}
 var rows=fuRows_({admin:true,name:'',role:''}),warning=fuObserveNotes_(rows);
 rows.forEach(function(r){r.stateKey=fuStateKey_(r.id);delete r.noteFingerprint;});
 var out={rows:rows,warning:warning,at:new Date().toISOString()};fuCacheWrite_(out);return out;
}
// 배포 직후 웹앱에서 호출(?followup=warm): 이 배포 버전으로 30분 트리거를 다시 만들고 캐시를 채운다.
// (편집기 Head의 캐시채우기 트리거는 배포 코드를 모르므로, 배포 버전에서 만든 트리거만 새 코드를 실행한다.)
function fuInstallWarmTrigger(){
 var made=0;try{ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='fuWarmCache')ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('fuWarmCache').timeBased().everyMinutes(30).create();made=1;}catch(e){Logger.log('상담 후속관리 트리거 실패: '+e.message);}
 var out=fuWorkspaceRows_(true);return {ok:true,rows:out.rows.length,trigger:made};
}
function fuWarmCache(){var t0=Date.now(),out=fuWorkspaceRows_(true);Logger.log('상담 후속관리 캐시 '+out.rows.length+'행 · '+(Date.now()-t0)+'ms');}
// packed=true(브라우저가 gzip을 풀 수 있을 때): 관리자는 캐시 문자열을 그대로 받는다 — 서버가 900행을 풀고 다시 직렬화해
// 1~2MB로 보내던 5초가 base64 300~400KB 전송으로 줄어든다. 담당자(비관리자)는 권한 필터가 필요하므로 서버에서 거른다.
function getFollowupWorkspace(code,fresh,packed){
 var actor=fuActor_(code),today=fuToday_();
 if(packed===true&&actor.admin&&fresh!==true){
  var raw=fuCacheRaw_();
  if(raw)return {actor:actor,packed:raw.enc,at:raw.at,today:today,records:fuRecords_(fuProps_().getProperties())};
 }
 var base=fuWorkspaceRows_(fresh===true),props=fuProps_().getProperties();
 var rows=base.rows.filter(function(r){return fuAllowed_(actor,r);}).map(function(r){var o=Object.assign({},r);o.followup=props[o.stateKey]?JSON.parse(props[o.stateKey]):{version:0,lastContact:'',nextContact:'',note:'',history:[]};delete o.stateKey;return o;});
 return {actor:actor,rows:rows,at:base.at,today:today,observationWarning:base.warning};
}
function getFollowupDetail(code,input){
 var actor=fuActor_(code);input=input||{};
 var year=Number(input.year),row=Number(input.sourceRow),id=String(input.id||'');
 if(!/^20\d{2}$/.test(String(year))||year<2025||!Number.isInteger(row)||row<3||id.indexOf(year+':')!==0)throw Error('상담 위치를 확인하세요.');
 var ss=SpreadsheetApp.openById(SHEET_ID),sh=ss.getSheetByName(String(year));
 if(!sh||row>sh.getLastRow())throw Error('원본 상담을 찾을 수 없습니다.');
 var cols=Math.min(sh.getMaxColumns(),40),headers=sh.getRange(1,1,2,cols).getDisplayValues();
 var names=headers[0].map(function(x,i){return String(x)+' '+headers[1][i];});
 var dataCols=13;names.forEach(function(h,i){if(i>=13&&/한전|선로|계통|지자체|개발행위|인허가/.test(h))dataCols=i+1;});
 var v=sh.getRange(row,1,1,dataCols).getDisplayValues()[0],no=String(v[0]||'').trim(),m=no.match(/^(?:(?:sp|ugs)[- ]?)?(\d{1,2})-\d+/i);
 if(!m||(year+':'+no.toLowerCase())!==id)throw Error('원본 상담번호가 변경되었습니다. 목록을 새로고침하세요.');
 var r={id:id,no:no,year:year,month:Number(m[1]),sourceRow:row,sourceSheet:String(year),gid:sh.getSheetId(),statusRaw:String(v[1]||''),status:fuStatus_(v[1]),type:String(v[2]||''),cons:String(v[6]||'').trim()||'미지정',own:String(v[7]||'').trim()||'미지정',meetingDate:String(v[9]||''),capacity:String(v[10]||'')};
 if(!fuAllowed_(actor,r))throw Error('이 상담의 조회 권한이 없습니다.');
 var p=fuProps_(),raw=p.getProperty(fuStateKey_(id));
 r.followup=raw?JSON.parse(raw):{version:0,lastContact:'',nextContact:'',note:'',history:[]};
 return Object.assign(r,fuExtract_(v,names),{meetingISO:fuSourceDate_(v[9],year),noteEvidence:fuNoteEvidence_(v[12],year,fuToday_())});
}
function saveFollowupRecord(code,input){
 var actor=fuActor_(code);input=input||{};
 var rows=fuRows_(actor).filter(function(r){return r.id===input.id;});
 if(rows.length!==1)throw Error('상담번호가 중복되었거나 조회 권한이 없습니다. 원본을 확인하세요.');
 var r=rows[0],next=fuDate_(input.nextContact),last=fuDate_(input.lastContact),today=fuToday_();
 if(last&&last>today)throw Error('마지막 연락일은 오늘 이후로 저장할 수 없습니다.');
 var note=fuText_(input.note,300),recipient=fuText_(input.recipient,80),action=String(input.action||'schedule');
 if(['schedule','contact','request','resolve'].indexOf(action)<0)throw Error('알 수 없는 처리입니다.');
 if(action==='contact'&&!last)throw Error('연락한 날짜를 입력하세요.');
 if(action==='request'&&(!next||!recipient||[r.cons,r.own].indexOf(recipient)<0||recipient==='미지정'))throw Error('알림 수신 담당자와 연락 예정일을 지정하세요.');
 if(action==='schedule'&&!next)throw Error('다음 연락일을 입력하세요.');
 if(action==='resolve'&&!note)throw Error('알림을 해제하는 이유를 적어 주세요.');
 var lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
  var p=fuProps_(),key=fuStateKey_(r.id),raw=p.getProperty(key),old=raw?JSON.parse(raw):{version:0,history:[]};
  if(Number(input.version)!==Number(old.version))throw Error('다른 사람이 먼저 수정했습니다. 새로고침 후 다시 저장하세요.');
  var event={at:new Date().toISOString(),by:actor.name,action:action,note:note,lastContact:last,nextContact:next,recipient:recipient};
  var data={version:old.version+1,lastContact:last||old.lastContact||'',nextContact:action==='resolve'?'':next,note:note,recipient:action==='request'?recipient:(old.recipient||r.cons),
   requested:action==='request'?true:action==='resolve'||action==='contact'?false:!!old.requested,updatedAt:event.at,updatedBy:actor.name,history:(old.history||[]).concat([event]).slice(-5)};
  var json=JSON.stringify(data),bytes=Utilities.newBlob(json).getBytes().length;
  if(bytes>8500)throw Error('기록이 너무 깁니다. 메모를 줄여 주세요.');
  var all=p.getProperties(),size=Object.keys(all).reduce(function(n,k){return n+Utilities.newBlob(k+all[k]).getBytes().length;},0);
  if(size+bytes>450000)throw Error('연락 기록 저장 공간이 부족합니다. 관리자에게 기록 보관을 요청하세요.');
  p.setProperty(key,json);return data;
 }finally{lock.releaseLock();}
}
function issueFollowupAccess(code,input){
 var actor=fuActor_(code);if(!actor.admin)throw Error('관리자만 발급할 수 있습니다.');
 var role=String(input.role||'cons'),name=fuText_(input.name,80);if(['cons','own'].indexOf(role)<0||name==='미지정')throw Error('담당자를 선택하세요.');
 if(!fuRows_(actor).some(function(r){return r[role]===name;}))throw Error('원본에 없는 담당자입니다.');
 var token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
 var lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
  var p=fuProps_(),who=fuHash_(role+':'+name),old=p.getProperty('fu_member_'+who);
  if(old)p.deleteProperty('fu_access_'+old);
  var hash=fuHash_(token);p.setProperty('fu_access_'+hash,JSON.stringify({admin:false,name:name,role:role}));p.setProperty('fu_member_'+who,hash);
 }finally{lock.releaseLock();}
 return {name:name,role:role,code:token};
}
