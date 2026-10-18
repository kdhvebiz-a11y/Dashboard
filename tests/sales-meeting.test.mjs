import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,server,source]=await Promise.all([
 readFile(new URL('../apps-script/v10/index.html',import.meta.url),'utf8'),
 readFile(new URL('../apps-script/v10/대시보드.gs',import.meta.url),'utf8'),
 readFile(new URL('../apps-script/v10/sales-meeting.js',import.meta.url),'utf8')
]);
assert.match(server,/sheet:\s*'미팅26'/,'server reads the weekly meeting sheet');
assert.match(server,/\[\s*1,\s*225,\s*28,\s*41\]/,'server includes the copy-ready inquiry area');
assert.match(server,/out\.meeting26\s*=\s*got\['미팅26'\]/,'API path returns weekly meeting data');
assert.match(server,/out\.meeting26\s*=\s*readViaSheet/,'SpreadsheetApp path returns weekly meeting data');
assert.ok(html.includes('영업회의 자료'),'generated dashboard contains the new workspace');
assert.ok(html.includes('회의록 형식 복사'),'generated dashboard exposes the HWP-ready copy action');
assert.ok(html.includes('원본 상세 전체 복사'),'generated dashboard retains raw-detail copy');
assert.ok(html.includes('문의표만 복사')&&html.includes('미팅표만 복사'));
assert.ok(html.includes('text/html'),'clipboard keeps table formatting for Hangul');
assert.ok(source.includes('1. 유입별 문의건수')&&source.includes('2. 사업형태별 문의건수')&&source.includes('3. 미팅가망 및 특이사항'),'minutes preview follows the supplied meeting-note order');
assert.ok(source.includes('후속 조치 · 담당/기한'),'minutes can append accountable next actions');
assert.ok(source.includes("kind==='minutes'?'#salesMinutesCopy'"),'minutes copy is isolated from raw-detail tables');
assert.ok(source.includes('월 전체는 달력월, 주차 합계는 보고 주차 기준'),'period distinction is explicit');
assert.ok(source.includes('미팅26 시트의 N1:AE70'),'missing-source error is actionable');
assert.ok(source.includes('보고 주차 선택'),'sales meeting report exposes week selection above the preview');
assert.ok(source.includes('smDetailMeetingMatch'),'inquiry and meeting periods are paired by dates');
assert.ok(source.includes('minutes-period-basis'),'copied minutes state both inquiry and meeting week ranges');
console.log('PASS: sales meeting data source, navigation and Hangul copy UI');
