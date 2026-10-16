import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../apps-script/v10/presentation-comments.gs',import.meta.url),'utf8');
const values=new Map();
let failKey='';
let sequence=0;
const properties={
 getProperty:key=>values.has(key)?values.get(key):null,
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

assert.deepEqual(JSON.parse(JSON.stringify(context.getPresentationComment(2026,9))),{year:2026,month:9,text:'',updatedAt:'',updatedBy:''});
const saved=context.savePresentationComment({year:2026,month:9,text:'  9월 개선안\r\n후속 미팅 점검  '});
assert.equal(saved.text,'9월 개선안\n후속 미팅 점검');
assert.equal(saved.updatedBy,'reporter@example.com');
assert.equal(context.getPresentationComment(2026,9).text,'9월 개선안\n후속 미팅 점검');
assert.equal(context.getPresentationComment(2026,8).text,'','months do not overwrite each other');
context.savePresentationComment({year:2026,month:9,text:''});
assert.equal(context.getPresentationComment(2026,9).text,'','blank save clears the month');
assert.throws(()=>context.savePresentationComment({year:2026,month:13,text:'x'}),/월을 확인/);
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:'x'.repeat(10001)}),/10000자/);
const longText='한글😀'.repeat(1250);
context.savePresentationComment({year:2026,month:9,text:longText});
assert.equal(context.getPresentationComment(2026,9).text,longText,'5,000 UTF-16 characters including Korean and emoji round-trip');
const beforeFailure=new Map(values);
failKey='performance_presentation_comment_v1_2026-09';
assert.throws(()=>context.savePresentationComment({year:2026,month:9,text:'실패 테스트'}),/simulated/);
assert.deepEqual(values,beforeFailure,'failed publication keeps original comment and removes partial chunks');
failKey='';
context.savePresentationComment({year:2026,month:9,text:''});
assert.equal(values.size,0,'clearing also removes stored chunks');
values.set('performance_presentation_comment_v1_2026-08',JSON.stringify({text:'이전 형식 코멘트'}));
assert.equal(context.getPresentationComment(2026,8).text,'이전 형식 코멘트','legacy saved comments remain readable');
console.log('PASS: presentation comments persist by year and month with validation');
