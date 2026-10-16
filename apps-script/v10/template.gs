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
var CACHE_SEC = 21600;               /* 6시간 (CacheService 최대값) */
var CACHE_KEY = 'gsdash_v9';
var CHUNK     = 90000;               /* 값 1개 100KB 한도 아래로 */

/* 읽을 영역 — [시작행, 끝행(0이면 마지막행까지), 시작열, 끝열]  모두 1부터 셈
   파서가 실제로 건드리는 열만 남겼다. 좌표는 시트와 똑같이 유지된다. */
var BLOCKS = [
  { sheet: '통계', max: 2100, ranges: [
      [  5,   0,   3,  14],   /* C~N   미팅 원장 (마지막 행까지) */
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
  var warm = fresh ? null : readCache();
  var t = HtmlService.createTemplateFromFile('index');
  t.DATA = warm ? warm : 'null';
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
  writeCache(json);
  return json;
}

/* ------------------------------------------------------------ 데이터 수집 */
function collectData() {
  try {
    var out = { at: new Date().toISOString() };
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
