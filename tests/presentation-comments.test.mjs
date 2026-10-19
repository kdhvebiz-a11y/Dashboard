import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../apps-script/v10/presentation-comments.gs',import.meta.url),'utf8');
const values=new Map();
let failKey='';
let sequence=0;
const properties={
 getProperty:key=>values.has(key)?values.get(key):null,
 getKeys:()=>[...values.keys()],
 setProperty:(key,value)=>{
  if(key===failKey)throw Error('simulated write failure');
  assert.ok(Buffer.byteLength(value,'utf8')<=9000,'every property fits the Apps Script per-value limit');
  return values.set(key,value);
 },
 deleteProperty:key=>values.delete(key)
};
const context=vm.createContext({
 Date,
 Utilities:{getUuid:()=>String(++sequence)},
 PropertiesService:{getScriptProperties:()=>properties},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 Session:{getEffectiveUser:()=>({getEmail:()=> 'reporter@example.com'})}
});
vm.runInContext(source,context);
const get=(y,m)=>JSON.parse(JSON.stringify(context.getPresentationComment(y,m)));

// Seeded month: the confirmed September text shows up even with an empty store.
const seeded=get(2026,9);
assert.equal(seeded.seeded,true);
assert.equal(seeded.locked,true,'a seeded presentation is confirmed');
assert.ok(JSON.parse(seeded.text).improvement.includes('④ 견적서 자동작성'),'September improvement plan is seeded');
assert.ok(JSON.parse(seeded.text).analysis.includes('이격거리 규제완화'),'September analysis is seeded');
assert.deepEqual(JSON.parse(JSON.stringify(context.listPresentationCommentMonths(2026))),[9],'seed is listed as a month with content');
assert.deepEqual(get(2026,8),{year:2026,month:8,text:'',updatedAt:'',updatedBy:'',locked:false,hasPrevious:false,seeded:false});

// Saving over a seed needs no force (nothing stored yet); the saved record then replaces the seed.
const saved=context.savePresentationComment({year:2026,month:9,text:'  9월 개선안\r\n후속 미팅 점검  '});
assert.equal(saved.text,'9월 개선안\n후속 미팅 점검');
assert.equal(saved.updatedBy,'reporter@example.com');
assert.equal(saved.locked,true,'saved comments are confirmed by default');
assert.equal(saved.seeded,false);
assert.equal(get(2026,9).text,'9월 개선안\n후속 미팅 점검');
assert.equal(get(2026,8).text,'','months do not overwrite each other');
assert.deepEqual(JSON.parse(JSON.stringify(context.listPresentationCommentMonths(2026))),[9]);

// A confirmed comment cannot be changed or cleared without force.
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:'몰래 바꾼 내용'}),/확정 상태/);
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:''}),/확정 상태/);
assert.equal(get(2026,9).text,'9월 개선안\n후속 미팅 점검','blocked writes leave the record untouched');
assert.equal(context.savePresentationComment({year:2026,month:9,text:'9월 개선안\n후속 미팅 점검'}).text,'9월 개선안\n후속 미팅 점검','re-saving identical text is allowed');

// Forced overwrite keeps the previous version and can be restored one step.
const second=context.savePresentationComment({year:2026,month:9,text:'수정된 9월 코멘트',force:true});
assert.equal(second.text,'수정된 9월 코멘트');
assert.equal(second.hasPrevious,true);
const restored=context.restorePresentationComment(2026,9);
assert.equal(restored.text,'9월 개선안\n후속 미팅 점검','restore brings the earlier version back');
assert.equal(restored.locked,true);
assert.equal(restored.hasPrevious,true,'the replaced version is kept for a second swap');
assert.equal(context.restorePresentationComment(2026,9).text,'수정된 9월 코멘트');
assert.throws(()=>context.restorePresentationComment(2026,8),/이전 저장본이 없습니다/);

// Clearing with force keeps the cleared text restorable and does not fall back to the seed.
const cleared=context.savePresentationComment({year:2026,month:9,text:'',force:true});
assert.equal(cleared.text,'');
assert.equal(cleared.locked,false);
assert.equal(cleared.hasPrevious,true);
assert.equal(get(2026,9).seeded,false,'an intentional clear is not replaced by the seed');
assert.equal(context.restorePresentationComment(2026,9).text,'수정된 9월 코멘트');
context.savePresentationComment({year:2026,month:9,text:'',force:true});
const afterClear=context.savePresentationComment({year:2026,month:9,text:'비운 뒤 새 코멘트'});
assert.equal(afterClear.hasPrevious,true,'a save after clearing still keeps the earlier text');
assert.equal(context.restorePresentationComment(2026,9).text,'수정된 9월 코멘트');

// Validation and chunking.
assert.throws(()=>context.savePresentationComment({year:2026,month:13,text:'x'}),/월을 확인/);
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:'x'.repeat(10001),force:true}),/10000자/);
const longText='한글😀'.repeat(1250);
context.savePresentationComment({year:2026,month:9,text:longText,force:true});
assert.equal(get(2026,9).text,longText,'5,000 UTF-16 characters including Korean and emoji round-trip');
const beforeFailure=new Map(values);
failKey='performance_presentation_comment_v1_2026-09';
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:'실패 테스트',force:true}),/simulated/);
assert.deepEqual(values,beforeFailure,'failed publication keeps original comment and removes partial chunks');
failKey='';

// Legacy single-property records remain readable and become restorable once overwritten.
values.clear();
values.set('performance_presentation_comment_v1_2026-08',JSON.stringify({text:'이전 형식 코멘트'}));
assert.equal(get(2026,8).text,'이전 형식 코멘트','legacy saved comments remain readable');
assert.equal(get(2026,8).locked,true,'legacy comments count as confirmed');
context.savePresentationComment({year:2026,month:8,text:'새 8월 코멘트',force:true});
assert.equal(context.restorePresentationComment(2026,8).text,'이전 형식 코멘트');
assert.deepEqual(JSON.parse(JSON.stringify(context.listPresentationCommentMonths(2026))),[8,9]);
console.log('PASS: presentation comments persist by year and month with seed, confirmation lock, restore and validation');
