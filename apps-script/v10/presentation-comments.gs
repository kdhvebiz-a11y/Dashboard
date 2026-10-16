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
