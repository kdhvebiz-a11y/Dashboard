/**
 * 그랜드썬 컨설팅 성과 대시보드 — 웹앱 (v9, 담당자별 P~Z 추가)
 * ---------------------------------------------------------------------------
 * v7에서 바뀐 것
 *   1) 캐시를 미리 채운다 — 30분마다 도는 트리거가 시트를 대신 읽어 둔다.
 *      사용자는 시트 읽기를 기다리지 않는다. (이게 가장 큰 개선)
 *   2) 캐시가 따뜻하면 화면에 데이터를 바로 실어 보낸다 — 왕복 1회로 끝난다.
 *      캐시가 비어 있을 때만 화면 먼저 → 데이터 나중 방식으로 넘어간다.
 *   3) 읽는 열을 파서가 실제로 쓰는 것만 남겼다.  5.0만 셀 → 3.1만 셀
 *   4) Sheets 고급 서비스가 켜져 있으면 batchGet 한 번으로 읽는다 (2~4배 빠름).
 *      꺼져 있으면 예전 방식으로 자동 대체되므로 그냥 두어도 동작한다.
 *   5) 캐시 유지 시간 10분 → 6시간
 *
 * 처음 한 번 해야 할 일 — 트리거 등록 (아래 둘 중 하나)
 *   (가) 편집기 왼쪽 ⏰ 트리거 → 트리거 추가 →
 *        함수 `캐시채우기` · 시간 기반 · 분 단위 타이머 · 30분마다 → 저장
 *   (나) 함수 목록에서 `설치` 를 골라 실행 (권한 화면이 한 번 더 뜬다)
 *
 * 주소 뒤 옵션:  ?data=1 → JSON   ?callback=함수 → JSONP   ?fresh=1 → 캐시 무시
 * 시트는 읽기만 하며 수정하지 않습니다.
 */

var SHEET_ID  = '1PR1M6AfYkzmvYlzFKkV4KRhJWTWs0rzZBmroZ3CSwyc';
var CACHE_SEC = 300;               /* 6시간 (CacheService 최대값) */
var CACHE_KEY = 'gsdash_v10';
var CHUNK     = 24000;               /* 값 1개 100KB 한도 아래로 */

/* 읽을 영역 — [시작행, 끝행(0이면 마지막행까지), 시작열, 끝열]  모두 1부터 셈
   파서가 실제로 건드리는 열만 남겼다. 좌표는 시트와 똑같이 유지된다. */
var BLOCKS = [
  { sheet: '통계', max: 2100, ranges: [
      [  1,   0,   1,  14],   /* C~N   미팅 원장 (마지막 행까지) */
      [  1, 135,  16,  26],   /* P~Z   담당자별 미팅·계약 (연간 + 월별) */
      [  1, 225,  28,  41],   /* AB~AO 영업회의용 주간 문의 + 월별 집계표 */
      [  1, 305,  67,  86],   /* BO~CH 사업형태별 문의·미팅·계약 (월 21섹터) */
      [  1, 130,  96, 244]    /* CR~IJ 권역 정의 + 권역별 문의·미팅·담당자 */
  ]},
  { sheet: '말',   max: 560,  ranges: [
      [  1, 550,   3,  15],   /* C~O   주차별 전체문의 · 사업형태별 */
      [  1, 550,  21,  27],   /* U~AA  미팅 · 계약 */
      [  1, 550,  31,  36],   /* AE~AJ 연간 사업형태별 */
      [  1, 550,  51,  63],   /* AY~BK 미팅 간 달 · 용량구간 · 담당자 */
      [  1,  30,  64,  65],   /* BL~BM 연도별 전체문의 */
      [  1,  30,  71,  90]    /* BS~CL 월별 요약 · 목표 */
  ]},
  { sheet: '미팅26', max: 70, ranges: [
      [  1,  70,  14,  31]    /* N~AE 영업회의용 이번 주 미팅 목록 · 요약 */
  ]}
];

/* ---------------------------------------------------------------- 진입점 */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.weekly === '1') return ContentService.createTextOutput(JSON.stringify(collectWeeklyMeetingDataV10())).setMimeType(ContentService.MimeType.JSON);
  if (p.health === '1') return ContentService.createTextOutput(JSON.stringify({ok:true,release:'ce17343ad93030eb0da97a44a3e93806d9a83b50'})).setMimeType(ContentService.MimeType.JSON);
  var fresh = !!p.fresh;

  if (p.data || p.callback) {
    var json = getPayloadJson(fresh);
    if (p.callback && /^[A-Za-z0-9_$]{1,64}$/.test(p.callback)) {
      return ContentService.createTextOutput(p.callback + '(' + json + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  /* 캐시가 이미 차 있으면 데이터를 화면에 같이 실어 보낸다 (왕복 1회).
     비어 있으면 null 을 실어 보내고, 브라우저가 화면을 먼저 그린 뒤 따로 받아 간다. */
  var warm = null;
  var t = HtmlService.createTemplateFromFile('index');
  t.DATA = 'null';
  return t.evaluate()
    .setTitle('그랜드썬 컨설팅 성과 대시보드')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* 브라우저가 google.script.run 으로 부르는 함수 */
function getDashboardData(fresh) {
  return getPayloadJson(!!fresh);
}

/* --------------------------------------------------- 트리거 (미리 채우기) */
function 캐시채우기() {
  var t0 = new Date().getTime();
  var json = getPayloadJson(true);
  Logger.log('캐시 갱신 ' + (new Date().getTime() - t0) + 'ms · '
             + Math.round(json.length / 1024) + 'KB');
}

function 설치() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '캐시채우기') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('캐시채우기').timeBased().everyMinutes(30).create();
  캐시채우기();
  Logger.log('30분마다 캐시를 미리 채우도록 등록했습니다.');
}

/* ------------------------------------------------------------ 캐시 계층 */
function readCache() {
  var cache = CacheService.getScriptCache();
  var meta = cache.get(CACHE_KEY + '_n');
  if (!meta) return null;
  var n = parseInt(meta, 10), parts = [];
  for (var k = 0; k < n; k++) {
    var s = cache.get(CACHE_KEY + '_' + k);
    if (s === null) return null;          /* 일부만 남았으면 무효 */
    parts.push(s);
  }
  return parts.join('');
}

function writeCache(json) {
  try {
    var cache = CacheService.getScriptCache(), map = {}, i = 0, k = 0;
    for (i = 0; i < json.length; i += CHUNK) map[CACHE_KEY + '_' + (k++)] = json.substring(i, i + CHUNK);
    map[CACHE_KEY + '_n'] = String(k);
    cache.putAll(map, CACHE_SEC);
  } catch (err) { /* 캐시는 실패해도 넘어간다 */ }
}

function getPayloadJson(fresh) {
  if (!fresh) {
    var hit = readCache();
    if (hit) return hit;
  }
  var json = JSON.stringify(collectData());
  if (!JSON.parse(json).error) writeCache(json);
  return json;
}

/* ------------------------------------------------------------ 데이터 수집 */
function collectData() {
  try {
    var out = { at: new Date().toISOString(), version: 10 };
    var viaApi = false;
    try { viaApi = (typeof Sheets !== 'undefined' && Sheets.Spreadsheets); } catch (e) { viaApi = false; }
    if (viaApi) {
      var got = readViaApi();
      out.tongye = got['통계'];
      out.mal    = got['말'];
      out.meeting26 = got['미팅26'];
      out.via    = 'api';
    } else {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      out.tongye = readViaSheet(ss, BLOCKS[0]);
      out.mal    = readViaSheet(ss, BLOCKS[1]);
      out.meeting26 = readViaSheet(ss, BLOCKS[2]);
      out.via    = 'app';
    }
    out.yearData = collectYearDataV10(SpreadsheetApp.openById(SHEET_ID));
    return out;
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
}

/* --- 빠른 경로: Sheets 고급 서비스 batchGet (요청 1회) --- */
function readViaApi() {
  var ranges = [], plan = [];
  BLOCKS.forEach(function (blk) {
    blk.ranges.forEach(function (r) {
      ranges.push("'" + blk.sheet + "'!" + colA1(r[2]) + r[0] + ':' + colA1(r[3]) + (r[1] ? r[1] : ''));
      plan.push({ sheet: blk.sheet, r0: r[0], c0: r[2], max: blk.max });
    });
  });
  var res = Sheets.Spreadsheets.Values.batchGet(SHEET_ID, {
    ranges: ranges,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });
  var grids = {};
  (res.valueRanges || []).forEach(function (vr, ix) {
    var q = plan[ix];
    if (!grids[q.sheet]) grids[q.sheet] = {};
    paint(grids[q.sheet], vr.values || [], q.r0, q.c0, q.max);
  });
  var out = {};
  BLOCKS.forEach(function (blk) { out[blk.sheet] = flatten(grids[blk.sheet] || {}); });
  return out;
}

/* --- 대체 경로: SpreadsheetApp --- */
function readViaSheet(ss, blk) {
  var sh = ss.getSheetByName(blk.sheet);
  if (!sh) throw new Error('"' + blk.sheet + '" 시트를 찾을 수 없습니다.');
  var lastRow = Math.min(sh.getLastRow() || 1, blk.max);
  var lastCol = sh.getMaxColumns();
  var grid = {};
  blk.ranges.forEach(function (r) {
    var r0 = r[0], r1 = r[1] ? Math.min(r[1], blk.max) : lastRow;
    var c0 = r[2], c1 = Math.min(r[3], lastCol);
    if (r1 < r0 || c1 < c0) return;
    paint(grid, sh.getRange(r0, c0, r1 - r0 + 1, c1 - c0 + 1).getDisplayValues(), r0, c0, blk.max);
  });
  return flatten(grid);
}

/* 읽어 온 직사각형을 시트와 같은 절대 좌표에 얹는다 */
function paint(grid, vals, r0, c0, max) {
  for (var i = 0; i < vals.length; i++) {
    var rIx = r0 - 1 + i;
    if (rIx >= max) break;
    var row = vals[i];
    if (!row) continue;
    for (var j = 0; j < row.length; j++) {
      var v = row[j];
      if (v === '' || v === null || v === undefined) continue;
      if (!grid[rIx]) grid[rIx] = {};
      grid[rIx][c0 - 1 + j] = (typeof v === 'string') ? v : String(v);
    }
  }
}

/* 성긴 좌표표를 배열로 — 빈 칸은 '', 뒤쪽 여백은 잘라낸다 */
function flatten(grid) {
  var maxR = -1, r, c;
  for (var k in grid) { r = parseInt(k, 10); if (r > maxR) maxR = r; }
  var out = [];
  for (r = 0; r <= maxR; r++) {
    var g = grid[r];
    if (!g) { out.push([]); continue; }
    var e = -1;
    for (var k2 in g) { c = parseInt(k2, 10); if (c > e) e = c; }
    var line = new Array(e + 1);
    for (c = 0; c <= e; c++) line[c] = (g[c] === undefined) ? '' : g[c];
    out.push(line);
  }
  return out;
}

function colA1(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

/* ------------------------------------------------------- 점검용 (수동 실행) */
function 속도점검() {
  var t0 = new Date().getTime();
  var r = collectData();
  var t1 = new Date().getTime();
  if (r.error) { Logger.log('오류: ' + r.error); return; }
  var json = JSON.stringify(r);
  Logger.log('읽기 ' + (t1 - t0) + 'ms · 경로 ' + r.via
             + ' · 통계 ' + r.tongye.length + '행 · 말 ' + r.mal.length + '행');
  Logger.log('전송량 약 ' + Math.round(json.length / 1024) + 'KB');
  Logger.log('원장 5행: ' + r.tongye[4].slice(2, 9).join(' | '));
  var t2 = new Date().getTime();
  readCache();
  Logger.log('캐시에서 읽기 ' + (new Date().getTime() - t2) + 'ms'
             + (readCache() ? '' : ' — 캐시가 비어 있습니다'));
}

function 캐시비우기() {
  var c = CacheService.getScriptCache();
  var n = parseInt(c.get(CACHE_KEY + '_n') || '0', 10);
  var keys = [CACHE_KEY + '_n'];
  for (var k = 0; k < n; k++) keys.push(CACHE_KEY + '_' + k);
  c.removeAll(keys);
  Logger.log('캐시를 비웠습니다.');
}

/* v10 additions: year discovery and a compact, read-only inquiry ledger. */
function collectYearDataV10(ss) {
  var result = {};
  ss.getSheets().forEach(function(sh) {
    var year = sh.getName();
    if (!/^20\d{2}$/.test(year) || Number(year) < 2025) return;
    var last = sh.getLastRow();
    var records = [];
    if (last >= 3) {
      var rows = sh.getRange(3, 1, last - 2, Math.min(sh.getMaxColumns(),13)).getDisplayValues();
      rows.forEach(function(v) {
        var no = String(v[0] || '').trim();
        var match = no.match(/^(?:(sp|ugs)[- ]?)?(\d{1,2})-(\d{2})\d+/i);
        // Number-only preallocated rows are not actual inquiries.
        if (!match || !v.slice(1).some(function(cell) { return String(cell || '').trim(); })) return;
        var month = Number(match[2]);
        if (month < 1 || month > 12) return;
        var day = Number(match[3]);
        var inquiryDate = day >= 1 && day <= 31 ? year+'-'+('0'+month).slice(-2)+'-'+('0'+day).slice(-2) : '';
        var dt = String(v[9] || '').match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
        var date = dt ? dt[1]+'-'+('0'+dt[2]).slice(-2)+'-'+('0'+dt[3]).slice(-2) : '';
        var status = String(v[1] || '').trim();
        var area = String(v[4] || '');
        var reg = /서울|경기|인천/.test(area)?'수도권':/충남|충북|충청|대전|세종/.test(area)?'충청권':/강원/.test(area)?'강원권':/부산|대구|울산|경남|경북|경상/.test(area)?'영남권':/광주|전남|전북|전라/.test(area)?'호남권':/제주/.test(area)?'제주':area?'기타':'미분류';
        records.push({no:no,year:Number(year),cmo:month,inquiryDate:inquiryDate,date:date,em:dt?Number(dt[2]):0,meetingYear:dt?Number(dt[1]):0,
          ct:status,src:/소개/.test(status)?'소개':status?'마케팅':'미분류',type:String(v[2]||''),reg:reg,
          prop:String(v[5]||''),cons:String(v[6]||''),own:String(v[7]||'미지정'),
          cap:parseFloat(String(v[10]||'').replace(/[^0-9.\-]/g,''))||0,
          corp:match[1]?match[1].toUpperCase():'그랜드썬'});
      });
    }
    result[year] = {records:records,source:year+' 문의 원장',sourceRule:'소개 상태는 소개, 나머지 기재 상태는 마케팅; 법인은 상담번호 접두어 기준'};
  });
  return result;
}

/* Private follow-up workspace. No personal fields are added to public JSON/cache. */
var FOLLOWUP_ADMIN_HASH_ = '225e67703980313ff77a9a0482c1462076d44619e0a5ef303a78de555db6e6c3';
function fuHash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
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
 var ss=SpreadsheetApp.openById(SHEET_ID),out=[];
 ss.getSheets().forEach(function(sh){
  var year=Number(sh.getName());if(!/^20\d{2}$/.test(sh.getName())||year<2025||sh.getLastRow()<3)return;
  var values=sh.getRange(3,1,sh.getLastRow()-2,13).getDisplayValues();
  values.forEach(function(v,ix){
   var no=String(v[0]||'').trim(),m=no.match(/^(?:(?:sp|ugs)[- ]?)?(\d{1,2})-\d+/i);
   if(!m||Number(m[1])<1||Number(m[1])>12||(!v[2]&&!v[3]&&!v[12]))return;
   var r={id:year+':'+no.toLowerCase(),no:no,year:year,month:Number(m[1]),sourceRow:ix+3,sourceSheet:sh.getName(),gid:sh.getSheetId(),
    statusRaw:String(v[1]||''),status:fuStatus_(v[1]),type:String(v[2]||''),cons:String(v[6]||'').trim()||'미지정',own:String(v[7]||'').trim()||'미지정',meetingDate:String(v[9]||''),capacity:String(v[10]||'')};
   if(fuAllowed_(actor,r))out.push(Object.assign(r,fuContact_(v),{meetingISO:fuSourceDate_(v[9],year),noteEvidence:fuNoteEvidence_(v[12],year,fuToday_()),noteFingerprint:fuHash_(String(v[12]||'')).slice(0,24)}));
  });
 });
 var counts={};out.forEach(function(r){counts[r.id]=(counts[r.id]||0)+1;});out.forEach(function(r){r.duplicate=counts[r.id]>1;});return out;
}
function fuStateKey_(id){return 'fu_record_'+fuHash_(id);}
function getFollowupWorkspace(code){
 var actor=fuActor_(code),rows=fuRows_(actor),observationWarning=fuObserveNotes_(rows),props=fuProps_().getProperties();
 rows.forEach(function(r){r.followup=props[fuStateKey_(r.id)]?JSON.parse(props[fuStateKey_(r.id)]):{version:0,lastContact:'',nextContact:'',note:'',history:[]};});
 rows.forEach(function(r){delete r.noteFingerprint;});
 return {actor:actor,rows:rows,at:new Date().toISOString(),today:fuToday_(),observationWarning:observationWarning};
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

/* Source evidence only. Never infer an actual phone call from an edit. */
function fuSourceDate_(value,year){
 var s=String(value||'').trim(),m=s.match(/^(?:(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})|(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일)(?!\d)/);
 if(!m)return '';
 var d=String(m[1]||year)+'-'+('0'+(m[2]||m[4]||m[6])).slice(-2)+'-'+('0'+(m[3]||m[5]||m[7])).slice(-2);
 try{return fuDate_(d);}catch(e){return '';}
}
function fuNoteEvidence_(notes,year,today){
 var latest={date:'',excerpt:'',inferredYear:false},future=0;
 String(notes||'').split(/\r?\n/).forEach(function(line){
  var s=line.trim().replace(/^[▶►●>*\-\s]+/,'').replace(/^[\[(]\s*/,'');
  // Only dated paragraph headings; ignore embedded grid/permit dates and phone numbers.
  var date=fuSourceDate_(s,year);if(!date)return;
  if(date>today){future++;return;}
  if(date>=latest.date)latest={date:date,excerpt:line.trim().slice(0,160),inferredYear:!/^20\d{2}[.\/-]/.test(s)};
 });
 latest.futureHeadings=future;return latest;
}
function fuObserveNotes_(rows){
 // One compact, private snapshot. No raw M contents or personal fields are stored.
 var lock=LockService.getScriptLock(),locked=false;
 try{
  lock.waitLock(15000);locked=true;
  var p=fuProps_(),all=p.getProperties(),manifest=all.fu_note_manifest?JSON.parse(all.fu_note_manifest):null,map={};
  if(manifest){
   if(!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>60||!/^[a-zA-Z0-9]+$/.test(manifest.generation))throw Error('내용 변경 추적 색인 오류');
   var encoded='';for(var j=0;j<manifest.count;j++){var chunk=all['fu_note_'+manifest.generation+'_'+j];if(!chunk)throw Error('내용 변경 추적 저장소를 확인하세요.');encoded+=chunk;}
   map=JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),'application/gzip')).getDataAsString());
  }
  var today=fuToday_(),dirty=false;
  rows.forEach(function(r){
   if(r.duplicate||!r.noteFingerprint)return;
   var key=fuHash_(r.id).slice(0,24),old=map[key],hash=r.noteFingerprint;
   if(!old){old=[hash,today,''];map[key]=old;dirty=true;}
   else if(old[0]!==hash){old=[hash,old[1],today];map[key]=old;dirty=true;}
   r.noteObserved={since:old[1],changed:old[2]};
  });
  if(dirty){
   var data=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(map),'application/json')).getBytes());
   var existing=Object.keys(all).reduce(function(n,k){return n+Utilities.newBlob(k+all[k],'text/plain').getBytes().length;},0);
   if(existing+data.length>440000)throw Error('내용 변경 추적 공간이 부족합니다. 관리자 확인이 필요합니다.');
   var gen=Utilities.getUuid().replace(/-/g,''),n=Math.ceil(data.length/7500);
   // Commit the manifest last; do not replace the prior snapshot until all chunks exist.
   for(var k=0;k<n;k++)p.setProperty('fu_note_'+gen+'_'+k,data.slice(k*7500,(k+1)*7500));
   p.setProperty('fu_note_manifest',JSON.stringify({generation:gen,count:n}));
   if(manifest)for(var z=0;z<manifest.count;z++)p.deleteProperty('fu_note_'+manifest.generation+'_'+z);
  }
  return '';
 }catch(e){rows.forEach(function(r){delete r.noteObserved;});return 'M열 변경 감지 미확인: '+e.message;}
 finally{if(locked)lock.releaseLock();}
}

/* Monthly performance-presentation comments shared by every dashboard browser. */
var PRESENTATION_COMMENT_PREFIX = 'performance_presentation_comment_v1_';
var PRESENTATION_COMMENT_MAX = 10000;

function presentationCommentPeriod_(year, month) {
  var y = Number(year), m = Number(month);
  if (!isFinite(y) || Math.floor(y) !== y || y < 2018 || y > 2100) {
    throw new Error('코멘트 연도를 확인하세요.');
  }
  if (!isFinite(m) || Math.floor(m) !== m || m < 1 || m > 12) {
    throw new Error('코멘트 월을 확인하세요.');
  }
  return { year: y, month: m, key: PRESENTATION_COMMENT_PREFIX + y + '-' + (m < 10 ? '0' : '') + m };
}

function presentationCommentBlank_(period) {
  return { year: period.year, month: period.month, text: '', updatedAt: '', updatedBy: '' };
}

function getPresentationComment(year, month) {
  var period = presentationCommentPeriod_(year, month);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(period.key);
    if (!raw) return presentationCommentBlank_(period);
    var saved = JSON.parse(raw);
    if (saved.parts) {
      var chunks = saved.parts.map(function(key) {
        var chunk = props.getProperty(key);
        if (chunk === null) throw new Error('저장된 코멘트 일부를 불러오지 못했습니다. 다시 시도하세요.');
        return chunk;
      });
      saved = JSON.parse(chunks.join(''));
    }
    return {
      year: period.year,
      month: period.month,
      text: String(saved.text || '').slice(0, PRESENTATION_COMMENT_MAX),
      updatedAt: String(saved.updatedAt || ''),
      updatedBy: String(saved.updatedBy || '')
    };
  } finally {
    lock.releaseLock();
  }
}

function presentationCommentCleanup_(props, keys) {
  (keys || []).forEach(function(key) {
    // Cleanup must not turn an already committed save into a failed save.
    try { props.deleteProperty(key); } catch (err) {}
  });
}

function savePresentationComment(input) {
  input = input || {};
  var period = presentationCommentPeriod_(input.year, input.month);
  var text = String(input.text == null ? '' : input.text).replace(/\r\n?/g, '\n').trim();
  if (text.length > PRESENTATION_COMMENT_MAX) {
    throw new Error('코멘트는 ' + PRESENTATION_COMMENT_MAX + '자까지 저장할 수 있습니다.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var previous = props.getProperty(period.key);
    var oldParts = [];
    try { oldParts = previous ? (JSON.parse(previous).parts || []) : []; } catch (err) {}
    if (!text) {
      props.deleteProperty(period.key);
      presentationCommentCleanup_(props, oldParts);
      return presentationCommentBlank_(period);
    }
    var email = '';
    try { email = Session.getEffectiveUser().getEmail() || ''; } catch (err) { email = ''; }
    var saved = {
      year: period.year,
      month: period.month,
      text: text,
      updatedAt: new Date().toISOString(),
      updatedBy: email
    };
    // Values are limited to 9 KB. Split by Unicode code point so long Korean
    // comments (or emoji) can be saved without breaking a surrogate pair.
    var points = Array.from(JSON.stringify(saved));
    var prefix = period.key + '_part_' + Utilities.getUuid() + '_';
    var parts = [];
    try {
      for (var offset = 0; offset < points.length; offset += 1000) {
        var key = prefix + parts.length;
        parts.push(key);
        props.setProperty(key, points.slice(offset, offset + 1000).join(''));
      }
      // Publish only after every chunk exists; a failed write preserves the old record.
      props.setProperty(period.key, JSON.stringify({parts: parts}));
    } catch (err) {
      presentationCommentCleanup_(props, parts);
      throw err;
    }
    presentationCommentCleanup_(props, oldParts);
    return saved;
  } finally {
    lock.releaseLock();
  }
}

/* Read only the requested weekly meeting summaries; never customer rows. */
function collectWeeklyMeetingDataV10() {
  var id = '1DkUE6SYR9uyS3TGzlRTq28yuGluYpnuF2yuyCt_2lx8';
  var result = { at: new Date().toISOString(), spreadsheetId: id, sheets: [], errors: [] };
  try {
    var ss = SpreadsheetApp.openById(id);
    ss.getSheets().forEach(function(sh) {
      var m = sh.getName().match(/^(\d{2})\.(\d{2})$/);
      if (!m || Number(m[1]) < 25 || Number(m[2]) < 1 || Number(m[2]) > 12) return;
      try {
        result.sheets.push({ sheet: sh.getName(), gid: sh.getSheetId(), year: 2000 + Number(m[1]), month: Number(m[2]), rows: sh.getRange('J1:O8').getDisplayValues() });
      } catch (e) { result.errors.push(sh.getName() + ': ' + e.message); }
    });
  } catch (e) { result.errors.push(String(e.message || e)); }
  return result;
}
