/* Monthly performance-presentation comments shared by every dashboard browser. */
var PRESENTATION_COMMENT_PREFIX = 'performance_presentation_comment_v1_';
var PRESENTATION_COMMENT_MAX = 10000;

/* Presentation text that was confirmed in a meeting but may be missing from the
   shared store. A month listed here is shown until a saved record replaces it.
   Keys are 'YYYY-MM'; the text is the version-3 JSON the editor uses. */
var PRESENTATION_COMMENT_SEEDS = {
  '2026-09': {
    updatedAt: '2026-09-30T08:37:10.000Z',
    text: JSON.stringify({
      version: 3,
      analysis: [
        '· 한국산업단지공단 미팅건은 소개건으로 분류 (7월1건, 8월9건, 9월9건)',
        '· 100kW미만 공장문의 비율이 올라가는 추세',
        '· 9월18일 이격거리 규제완화로 토지문의증가'
      ].join('\n'),
      inquiryAnalysis: '',
      improvement: [
        '1. 마케팅',
        '· 배너 대표님이 밀고있는 지원사업 삭제요청',
        '· 발전사업, 건물, 산업단지 등 직관적인 단어를 통한 배너광고 요청',
        '· 홈페이지 프로모션 지속적인 업데이트 요청',
        '· 구조물 등 강점을 어필할 수 있는 페이지 업데이트요청',
        '→ 전시회에서 시연했던 구조물을 잡고 돌려서 볼수있도록 요청',
        '· 냉동창고, 제조업소, 골프장 등 AI를 활용한 배치, 용량, 수익분석 우편송부',
        '· 채널톡 도입확정',
        '→ 에너지사업부 AI 질의응답 답변 가이드라인 제공',
        '',
        '2. 컨설팅',
        '· 전력망 혁신대책에 따른 계통관리변전소 신규사업자 접수가능',
        '· AI 프로그램 자동화를 통한 업무시간 단축 및 무응답 건 대응시간 확보',
        '▶완료된 AI',
        '① 컨설팅 대시보드',
        '② 태양광 입지 분석기',
        '③ PMS 자동화 등록프로그램',
        '④ 한전수전합리화 자동계산기',
        '⑤ 계통관리변전소 신규사업자 솔팅 프로그램',
        '▶준비중 AI',
        '① 무응답건 컨설팅 담당자별 알림 웹페이지',
        '② 미팅 후 미대응 및 누락건 미팅 담당자별 알림 웹페이지',
        '③ 제안서 자동작성',
        '④ 견적서 자동작성'
      ].join('\n')
    })
  }
};

function presentationCommentPeriod_(year, month) {
  var y = Number(year), m = Number(month);
  if (!isFinite(y) || Math.floor(y) !== y || y < 2018 || y > 2100) {
    throw new Error('코멘트 연도를 확인하세요.');
  }
  if (!isFinite(m) || Math.floor(m) !== m || m < 1 || m > 12) {
    throw new Error('코멘트 월을 확인하세요.');
  }
  var id = y + '-' + (m < 10 ? '0' : '') + m;
  return { year: y, month: m, id: id, key: PRESENTATION_COMMENT_PREFIX + id };
}

function presentationCommentBlank_(period) {
  return { year: period.year, month: period.month, text: '', updatedAt: '', updatedBy: '', locked: false, hasPrevious: false, seeded: false };
}

function presentationCommentSeed_(period) {
  var seed = PRESENTATION_COMMENT_SEEDS[period.id];
  if (!seed) return null;
  return { year: period.year, month: period.month, text: String(seed.text || ''), updatedAt: String(seed.updatedAt || ''), updatedBy: '발표 확정본', locked: true, hasPrevious: false, seeded: true };
}

/* Reads the pointer record; returns {pointer, record} where record is the
   assembled saved object (or null when nothing is stored). */
function presentationCommentRead_(props, period) {
  var raw = props.getProperty(period.key);
  if (!raw) return { pointer: null, record: null };
  var pointer = JSON.parse(raw), saved = pointer;
  if (pointer.parts) saved = pointer.parts.length ? JSON.parse(presentationCommentJoin_(props, pointer.parts)) : (pointer.cleared || null);
  return { pointer: pointer, record: saved };
}

function presentationCommentJoin_(props, keys) {
  return keys.map(function(key) {
    var chunk = props.getProperty(key);
    if (chunk === null) throw new Error('저장된 코멘트 일부를 불러오지 못했습니다. 다시 시도하세요.');
    return chunk;
  }).join('');
}

function presentationCommentShape_(period, saved, pointer) {
  return {
    year: period.year,
    month: period.month,
    text: String(saved.text || '').slice(0, PRESENTATION_COMMENT_MAX),
    updatedAt: String(saved.updatedAt || ''),
    updatedBy: String(saved.updatedBy || ''),
    locked: saved.locked !== false,
    hasPrevious: !!(pointer && pointer.prevParts && pointer.prevParts.length),
    seeded: false
  };
}

function getPresentationComment(year, month) {
  var period = presentationCommentPeriod_(year, month);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var found = presentationCommentRead_(props, period);
    if (!found.record) return presentationCommentSeed_(period) || presentationCommentBlank_(period);
    return presentationCommentShape_(period, found.record, found.pointer);
  } finally {
    lock.releaseLock();
  }
}

/* Months of a year that have a saved (or seeded) comment, for the month picker. */
function listPresentationCommentMonths(year) {
  var y = Number(year);
  if (!isFinite(y)) return [];
  var out = {};
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys ? props.getKeys() : [];
  var head = PRESENTATION_COMMENT_PREFIX + y + '-';
  keys.forEach(function(key) {
    var m = key.indexOf(head) === 0 ? key.slice(head.length, head.length + 2) : '';
    if (/^\d\d$/.test(m) && key.length === head.length + 2) out[Number(m)] = true;
  });
  Object.keys(PRESENTATION_COMMENT_SEEDS).forEach(function(id) {
    if (id.indexOf(y + '-') === 0) out[Number(id.slice(5, 7))] = true;
  });
  return Object.keys(out).map(Number).sort(function(a, b) { return a - b; });
}

function presentationCommentCleanup_(props, keys) {
  (keys || []).forEach(function(key) {
    // Cleanup must not turn an already committed save into a failed save.
    try { props.deleteProperty(key); } catch (err) {}
  });
}

function presentationCommentWriteParts_(props, period, saved) {
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
  } catch (err) {
    presentationCommentCleanup_(props, parts);
    throw err;
  }
  return parts;
}

/* input: {year, month, text, force}
   A saved comment is confirmed (locked) by default. Overwriting or clearing a
   confirmed comment requires force:true, which the editor sends only after the
   reporter pressed 수정하기. The replaced version is kept as the previous record. */
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
    var found = presentationCommentRead_(props, period);
    var previous = found.record, pointer = found.pointer || {};
    var oldParts = pointer.parts || [], oldPrev = pointer.prevParts || [];
    var previousLocked = previous ? previous.locked !== false : false;
    if (previousLocked && !input.force && String(previous.text || '') !== text) {
      throw new Error(period.year + '년 ' + period.month + '월 코멘트는 확정 상태입니다. 수정하기를 누른 뒤 저장하세요.');
    }
    // A legacy single-property record has no chunks yet; chunk it so it survives as the previous version.
    if (previous && previous.text && !pointer.parts) oldParts = presentationCommentWriteParts_(props, period, previous);
    // After a clear the current record has no chunks: keep the earlier text as the restorable version.
    var keepPrev = oldParts.length ? oldParts : oldPrev, dropPrev = oldParts.length ? oldPrev : [];
    if (!text) {
      if (!previous) return presentationCommentBlank_(period);
      // Clearing keeps the cleared text as the previous version so it can be restored.
      var cleared = { year: period.year, month: period.month, text: '', updatedAt: new Date().toISOString(), updatedBy: presentationCommentUser_(), locked: false };
      props.setProperty(period.key, JSON.stringify({ parts: [], prevParts: keepPrev, cleared: cleared }));
      presentationCommentCleanup_(props, dropPrev);
      return presentationCommentShape_(period, cleared, { prevParts: keepPrev });
    }
    var saved = {
      year: period.year,
      month: period.month,
      text: text,
      updatedAt: new Date().toISOString(),
      updatedBy: presentationCommentUser_(),
      locked: true
    };
    var parts = presentationCommentWriteParts_(props, period, saved);
    try {
      // Publish only after every chunk exists; a failed write preserves the old record.
      props.setProperty(period.key, JSON.stringify({ parts: parts, prevParts: keepPrev }));
    } catch (err) {
      presentationCommentCleanup_(props, parts);
      throw err;
    }
    presentationCommentCleanup_(props, dropPrev);
    return presentationCommentShape_(period, saved, { prevParts: keepPrev });
  } finally {
    lock.releaseLock();
  }
}

/* Puts the previous version back (one step). The current version becomes the previous one. */
function restorePresentationComment(year, month) {
  var period = presentationCommentPeriod_(year, month);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var found = presentationCommentRead_(props, period);
    var pointer = found.pointer || {};
    if (!pointer.prevParts || !pointer.prevParts.length) throw new Error('되돌릴 이전 저장본이 없습니다.');
    var restored = JSON.parse(presentationCommentJoin_(props, pointer.prevParts));
    restored.locked = true;
    props.setProperty(period.key, JSON.stringify({ parts: pointer.prevParts, prevParts: pointer.parts || [] }));
    return presentationCommentShape_(period, restored, { prevParts: pointer.parts || [] });
  } finally {
    lock.releaseLock();
  }
}

function presentationCommentUser_() {
  try { return Session.getEffectiveUser().getEmail() || ''; } catch (err) { return ''; }
}
