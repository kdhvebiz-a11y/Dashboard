// 영업회의록 한글(.hwp) 양식 채우기: 양식의 다른 스트림은 그대로, 본문 문단 글자만 바뀌고 글자 수 머리말이 맞아야 한다.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../apps-script/v10/hwp-fill.js',import.meta.url),'utf8');
const ctx=vm.createContext({atob,DecompressionStream,CompressionStream,Response,Blob,Uint8Array,Math,String,Error,Array,Object,RegExp,Number,Promise,console});
vm.runInContext(src+'\nthis.api={hwpFillSalesMinutes,cfbRead,hwpRecords,hwpParagraphs,hwpB64,hwpInflate};',ctx);
const {hwpFillSalesMinutes,cfbRead,hwpRecords,hwpParagraphs,hwpB64,hwpInflate}=ctx.api;
const b64=(await readFile(new URL('../apps-script/v10/sales-minutes-template.hwp.b64',import.meta.url),'utf8')).replace(/\s+/g,'');
const tpl=hwpB64(b64);
assert.equal(String.fromCharCode(...tpl.subarray(0,8)),'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1','template is an OLE file');
const fill={reporter:'홍길동',heading1:'1. 유입별 문의건수  [ 11월 1주 진행사항 (11/2~11/6) ]',
 table1:[['36','6','','42'],['14','1','5','20'],['8','','3','11']],
 table2:[['발전사업 (토지)','9','발전사업 (공장, 창고)','1','임대','2'],['발전사업 (공장, 창고)','3','','','발전사업 (토지)','1'],['자가소비 (공장, 창고)','1','','','','']],
 extra:'※한전수전합리화사업 – 1건 (제안2건)',
 items:[{text:'10-2601_경기_화성시_공장_대표_발전사업_미팅가망_그랜드썬',note:'_지붕 3동'},{text:'sp10-2602_부산_강서구_창고_직원_자가소비_SP'}],
 summary:['ㆍ유입별 미팅가망건 – 그랜드썬 1건, SP 1건','ㆍ지역별 대응예정건 – 안성지사 1건, 부산지사 1건','ㆍ문의 – 대표 1건, 직원 1건','ㆍ설치장소 – 공장 1건, 창고 1건','ㆍ미팅가망 및 확정 – 미팅가망 2건'],preview:'미리보기'};
const out=await hwpFillSalesMinutes(tpl,fill);
const a=cfbRead(tpl),b=cfbRead(out);
for(const e of a.entries){if(e.type!==2)continue;const f=b.entries.find(x=>x.path===e.path);assert.ok(f,'stream kept: '+e.path);if(!/Section0|PrvText/.test(e.path))assert.deepEqual(f.data,e.data,'untouched stream identical: '+e.path);}
const recs=hwpRecords(await hwpInflate(b.entries.find(e=>e.path==='BodyText/Section0').data)),paras=hwpParagraphs(recs),texts=paras.map(p=>p.text);
assert.ok(texts.includes('■컨설팅-홍길동'));assert.ok(texts.includes(fill.heading1));
assert.ok(texts.includes('36')&&texts.includes('42')&&texts.includes('임대')&&texts.includes('자가소비 (공장, 창고)'));
assert.ok(texts.includes('1. 10-2601_경기_화성시_공장_대표_발전사업_미팅가망_그랜드썬')&&texts.includes('_지붕 3동')&&texts.includes('2. sp10-2602_부산_강서구_창고_직원_자가소비_SP'));
assert.ok(!texts.some(t=>/^3\. 10-1901/.test(t)),'template meeting rows removed');
assert.ok(texts.includes(fill.summary[4])&&texts.includes(fill.extra));
// 글자 수 머리말 = 본문 UTF-16 글자 수 + 1(문단 끝)
let checked=0;recs.forEach((r,i)=>{if(r.tag!==0x42)return;const n=((r.data[0]|(r.data[1]<<8)|(r.data[2]<<16)|(r.data[3]<<24))>>>0)&0x7fffffff;const t=recs[i+1]&&recs[i+1].tag===0x43?recs[i+1].data.length/2:1;assert.equal(n,t,'nchars at record '+i);checked++;});
assert.ok(checked>60);
// 글자 모양 수[12..14)·영역 태그 수[14..16)·줄 나눔 수[16..18) = 실제 레코드 수
recs.forEach((r,k)=>{if(r.tag!==0x42)return;const u16=o=>r.data[o]|(r.data[o+1]<<8);let cs=0,rt=0,ls=0;for(let j=k+1;j<recs.length&&recs[j].level>r.level;j++){const x=recs[j];if(x.level!==r.level+1)continue;if(x.tag===0x44)cs=x.data.length/8;if(x.tag===0x45)ls=x.data.length/36;if(x.tag===0x46)rt=x.data.length/12;}assert.deepEqual([u16(12),u16(14),u16(16)],[cs,rt,ls],'shape/range/lineseg counts at record '+k);});
// '마지막 문단' 비트(최상위 비트)는 각 목록의 마지막 문단에만 — 제목 문단에 켜지면 한글이 제목만 보여 준다
const lastFlags=recs.map((r,i)=>r.tag===0x42?[i,r.level,!!(r.data[3]&0x80)]:null).filter(Boolean);
assert.equal(lastFlags[0][2],false,'first section paragraph is not marked last');
assert.equal(lastFlags[lastFlags.length-1][2],true,'final paragraph is marked last');
// 셀마다 적힌 문단 수 = 실제 문단 수 (틀리면 한글이 빈 문서로 연다)
recs.forEach((r,k)=>{if(r.tag!==0x48)return;const n=r.data[0]|(r.data[1]<<8);let cnt=0;for(let j=k+1;j<recs.length;j++){const x=recs[j];if(x.level<r.level||(x.tag===0x48&&x.level===r.level))break;if(x.tag===0x42&&x.level===r.level)cnt++;}assert.equal(n,cnt,'list paragraph count at record '+k);});
// 압축 스트림 끝에 CRC32 + 원본 크기(한글 형식)
const z=b.entries.find(e=>e.path==='BodyText/Section0').data,sizeTrailer=(z[z.length-4]|(z[z.length-3]<<8)|(z[z.length-2]<<16)|(z[z.length-1]<<24))>>>0;
assert.equal(sizeTrailer,(await hwpInflate(z)).length,'deflate trailer carries the uncompressed size');
console.log('PASS: hwp minutes template fill ('+checked+' paragraphs)');
