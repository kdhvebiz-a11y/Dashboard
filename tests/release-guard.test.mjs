// Release guards for two production incidents (2026-10-20, 2026-10-26).
// 1) Company DRM ("BMS DocuRay") encrypted a tracked file in the PC folder and it was committed.
// 2) Apps Script strips JS comments before serving and cut "https://..." inside a string as if "//" began a comment,
//    which broke the whole v10 script (blank dashboard shell).
import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const skip=new Set(['.git','node_modules','work']);
async function* walk(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(skip.has(e.name))continue;
  const p=join(dir,e.name);
  if(e.isDirectory())yield* walk(p);else if(e.isFile())yield p;
 }
}
const encrypted=[];
for await(const p of walk(root)){
 if((await stat(p)).size<11)continue;
 const head=(await readFile(p)).subarray(0,11).toString('latin1');
 if(head==='BMS DocuRay')encrypted.push(p.slice(root.length));
}
assert.deepEqual(encrypted,[],'회사 문서보안으로 암호화된 파일이 저장소에 있습니다. 원본으로 되돌린 뒤 다시 올리세요: '+encrypted.join(', '));

// The built page must not contain a raw "https://" in the v10 scripts (build writes "https:\/\/" instead).
const html=await readFile(new URL('../apps-script/v10/index.html',import.meta.url),'utf8').catch(()=>null);
if(html){
 const first=(await readFile(new URL('../apps-script/v10/dashboard.js',import.meta.url),'utf8')).split('\n')[0];
 const start=html.indexOf(first);
 assert.ok(start>0,'v10 script start not found in built index.html');
 const raw=(html.slice(start).match(/https?:\/\/[^\s'"`)]{0,40}/g)||[]);
 assert.deepEqual(raw,[],'v10 스크립트에 그대로 남은 https:// 가 있습니다(Apps Script가 주석으로 잘라낼 수 있음)');
}
