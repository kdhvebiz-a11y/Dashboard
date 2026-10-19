import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const base=new URL('../apps-script/v10/',import.meta.url);
const source=(await readFile(new URL('sales-meeting.js',base),'utf8')).split('function smCountMap')[0];
const weekly=(await readFile(new URL('weekly.js',base),'utf8')).split("SECTIONS.push({k:'weekly'")[0];
const c=vm.createContext({store:{get:(_,fallback)=>fallback},txt:v=>String(v??'').trim(),num:v=>Number(String(v??'').replace(/,/g,'').match(/\d+(?:\.\d+)?/)?.[0]||0),V10:{payload:{}},Date,Intl});
vm.runInContext(source+'\n'+weekly,c);const run=s=>vm.runInContext(s,c);
assert.equal(run('cwWeekCount(2025)'),52);
assert.equal(run('cwWeekCount(2026)'),53,'2026 year-end must not be clamped into week 52');
assert.equal(run('cwRange(2026,42).start'),'2026-10-12');
assert.equal(run('cwRange(2026,42).end'),'2026-10-16');
assert.equal(run('cwRange(2026,42).meetingStart'),'2026-10-09');
assert.equal(run('cwRange(2026,42).meetingEnd'),'2026-10-15');
assert.equal(run("cwPeriod('12/26~1/1',2026,1).start"),'2025-12-26');
assert.equal(run("cwPeriod('12/26~1/1',2026,1).end"),'2026-01-01');
run(`V10.payload={tongye:[],weeklyMeetings:{sheets:[{sheet:'26.10',rows:[['날짜','주차','총 미팅용량','총 미팅건수','마케팅 미팅용량','마케팅 미팅건수','소개 미팅용량','소개 미팅건수'],['10/9~10/15','2주차','3017.305 kW','11 건','2620.63 kW','9 건','396.675 kW','2 건'],['10/23~10/29','4주차','','','','','','']]},{sheet:'26.11',rows:[['10/23~10/29','4주차','','','','']]}]},
 mal:[['','','2026'],[],['','','9월 전체 문의'],['','','날짜','주차','총 문의건수','그랜드썬 문의건수','SP 문의건수','유지에스 문의건수'],
  ['','','09/27 ~ 10/03','5주차','124 건','116 건','8 건',''],['','','10/01 ~ 10/03','1주차','43 건','43 건','',''],['','','10/04 ~ 10/10','2주차','139 건','138 건','1 건',''],['','','10/11 ~ 10/17','3주차','167 건','162 건','5 건',''],['','','10/18 ~ 10/24','4주차','','','','']],
 yearData:{2026:{records:[
  {no:'10-1201',inquiryDate:'2026-10-12',ct:'진행',src:'마케팅',corp:'그랜드썬'},{no:'10-1202',inquiryDate:'2026-10-12',ct:'종료',src:'마케팅',corp:'그랜드썬'},{no:'sp10-1301',inquiryDate:'2026-10-13',ct:'진행',src:'마케팅',corp:'SP'},
  {no:'10-1401',inquiryDate:'2026-10-14',ct:'소개 (진행)',src:'소개',corp:'그랜드썬'},{no:'10-1601',inquiryDate:'2026-10-16',ct:'',src:'마케팅',corp:'그랜드썬'},{no:'10-1701',inquiryDate:'2026-10-17',ct:'진행',src:'마케팅',corp:'그랜드썬'},
  {no:'10-0101',inquiryDate:'2026-10-01',ct:'계약',src:'마케팅',corp:'그랜드썬'}]}}};`);
assert.equal(run('cwData(2026,42).sheet.count'),11,'monthly sheet week row is kept for cross-checking');
assert.equal(run('cwData(2026,42).sheet.capacity'),3017.305);
run(`const LEDGER=[{date:'2026-10-09',cap:100,src:'마케팅',own:'조성현'},{date:'2026-10-15',cap:250.5,src:'소개',own:'진으뜸'},{date:'2026-10-16',cap:50,src:'마케팅',own:'조성현'},{date:'2026-10-08',cap:70,src:'마케팅',own:''}];`);
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.source'),'sheet','the monthly tab row is the weekly meeting source');
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.n'),11);
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.referral.n'),2,'referral columns P~Q are read');
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.referral.cap'),396.675);
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.ledger.n'),2,'ledger count is kept for cross-checking');
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.ledger.cap'),350.5);
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.scheduled'),1,'future-dated ledger meetings are flagged as scheduled');
assert.equal(run('cwData(2026,42,V10.payload,LEDGER,"2026-10-10").meeting.owners[0].name'),'조성현','owner split comes from the ledger');
assert.equal(run('cwData(2026,41,V10.payload,LEDGER,"2026-10-10").meeting.source'),'ledger','a week missing from the monthly tabs falls back to the ledger');
assert.equal(run('cwData(2026,41,V10.payload,LEDGER,"2026-10-10").meeting.n'),1);
assert.equal(run('cwData(2026,41,V10.payload,LEDGER,"2026-10-10").meeting.owners[0].name'),'미지정','blank owner is labelled');
assert.equal(run('cwData(2026,42).totals.total'),167,'whole-inquiry week comes from the 말 weekly table');
assert.equal(run('cwData(2026,42).totals.gs'),162);
assert.deepEqual(JSON.parse(JSON.stringify(run('cwData(2026,42).totals.missing'))),[]);
assert.equal(run('cwData(2026,40).totals.total'),167,'a week across the month boundary sums both partial rows (09/27~10/03 + 10/01~10/03)');
assert.equal(run('cwData(2026,43).totals'),null,'a blank 말 row is not zero');
assert.equal(run('cwData(2026,42).biz.all.total'),5,'business inquiries are counted from the ledger by inquiry date, Mon~Fri only');
assert.equal(run('cwData(2026,42).biz.all.gs'),3,'그랜드썬 column excludes referrals');
assert.equal(run('cwData(2026,42).biz.all.ref'),1);
assert.equal(run('cwData(2026,42).biz.active.total'),3,'진행 counts 진행 and 소개 (진행), not blank or 종료');
assert.equal(run('cwData(2026,40).biz.active.total'),1,'계약 counts as active');
assert.equal(run('cwData(2025,42).totals'),null,'no leakage across selected years');
assert.equal(run('cwData(2025,42).biz'),null,'years without a ledger stay blank');
assert.equal(run('cwData(2026,44).sheet.count'),null,'blank future rows are not zero');
assert.equal(run('cwMeetingRows(V10.payload).length'),2,'same week across sheets is deduplicated');
assert.equal(run("cwValue('0 건')"),0);
assert.equal(run("cwValue('')"),null);
assert.equal(run("cwPeriod('13/1~13/7',2026,1)"),null);
run(`const oldSheet={sheet:'25.10',rows:[['날짜','주차','총 미팅용량','총 미팅건수','마케팅 계약','소개 계약'],['10/10~10/16','2주차','1200 kW','5 건','2 건','3 건']]};`);
assert.equal(run('cwMeetingRows({weeklyMeetings:{sheets:[oldSheet]}})[0].marketingCount'),null,'old contract columns must not be reported as meeting counts');
run(`oldSheet.rows[0][4]='마케팅 미팅용량';oldSheet.rows[0][5]='마케팅 미팅건수';`);
assert.equal(run('cwMeetingRows({weeklyMeetings:{sheets:[oldSheet]}})[0].marketingCount'),3);
const gs=await readFile(new URL('weekly-data.gs',base),'utf8');
const server=vm.createContext({SpreadsheetApp:{openById(){throw Error('access denied');}},Date});
vm.runInContext(gs,server);
assert.equal(vm.runInContext('collectWeeklyMeetingDataV10().errors[0]',server),'access denied');
console.log('PASS: independent week boundaries, 52/53 weeks, cross-year matching, source values, missing-data semantics and isolated source errors');
