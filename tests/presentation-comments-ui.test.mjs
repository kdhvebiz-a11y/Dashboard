import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../apps-script/v10/easy-ui.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('const easyPresentationComments='),source.indexOf('function easyDownloadPresentationPdf'));
const timers=new Map(),calls=[];
let timerId=0;
const google={script:{get run(){
 const handlers={};
 const runner={
  withSuccessHandler(fn){handlers.success=fn;return runner;},
  withFailureHandler(fn){handlers.failure=fn;return runner;},
  getPresentationComment(...args){calls.push({name:'get',args,...handlers});},
  savePresentationComment(...args){calls.push({name:'save',args,...handlers});}
 };
 return runner;
}}};
const context=vm.createContext({
 google,RUN_MODE:true,DB:{year:2026},state:{sect:'presentation'},
 store:{get:(_key,fallback)=>fallback,set(){}},
 esc:s=>String(s),txt:s=>String(s||'').trim(),selMonths:()=>[9],v10Today:()=> '2026-09-29',
 easyPresentationInsights:()=>'<div class="perf-inquiry-metrics">자동 문의 분석</div>',
 setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},
 clearTimeout:id=>timers.delete(id),
 FormData:class {constructor(form){this.form=form;}get(name){if(name==='analysis')return this.form.analysis??this.form.text??'';if(name==='inquiryAnalysis')return this.form.inquiryAnalysis??null;return this.form.improvement??'';}},
 render(){vm.runInContext('easyEnsurePresentationComment(2026,9)',context);}
});
const run=s=>vm.runInContext(s,context);
vm.runInContext(code,context);
const tick=async(ms)=>{
 for(const [id,timer] of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}
 await Promise.resolve();await Promise.resolve();
};
const html=run('easyPresentationCommentEditor([9])');
assert.ok(!/<textarea[^>]*disabled/.test(html),'loading must not prevent typing');
assert.ok(html.includes('문의 분석')&&html.includes('자동 문의 분석'),'inquiry analysis is rendered from automatic metrics');
assert.ok(!html.includes('name="inquiryAnalysis"'),'inquiry analysis is no longer an editable textarea');
assert.ok(html.includes('name="analysis"'),'overall analysis remains editable');
await tick(0);
assert.equal(calls.length,1);
const saving=run("easySavePresentationComment({dataset:{year:'2026',month:'9'},analysis:'직접 작성한 의견',inquiryAnalysis:'문의 분석',improvement:'실행 계획'})");
await tick(0);
assert.deepEqual(calls.map(c=>c.name),['get','save'],'saving during load does not start a second fetch');
calls[1].success({year:2026,month:9,text:'{\"version\":3,\"analysis\":\"직접 작성한 의견\",\"inquiryAnalysis\":\"문의 분석\",\"improvement\":\"실행 계획\"}',updatedAt:'2026-09-29T00:00:00Z'});
await saving;
calls[0].success({year:2026,month:9,text:'늦게 도착한 이전 내용'});
await Promise.resolve();await Promise.resolve();
assert.equal(run("easyPresentationCommentParts(easyPresentationComments.drafts['2026-09']).analysis"),'직접 작성한 의견','late load cannot overwrite saved text');
assert.equal(run("easyPresentationCommentParts(easyPresentationComments.drafts['2026-09']).inquiryAnalysis"),'문의 분석');
assert.equal(run("easyPresentationCommentParts(easyPresentationCommentFormText({dataset:{year:'2026',month:'9'},analysis:'수정된 종합분석',improvement:'계획'})).inquiryAnalysis"),'문의 분석','removing the old inquiry textarea must preserve its stored content');

const failedSave=run("easySavePresentationComment({dataset:{year:'2026',month:'9'},analysis:'오류가 나도 유지할 초안',improvement:'보존할 개선방안'})");
calls.at(-1).failure({message:'저장 연결 오류'});
await failedSave;
assert.equal(run("easyPresentationCommentParts(easyPresentationComments.drafts['2026-09']).analysis"),'오류가 나도 유지할 초안');
assert.equal(run("easyPresentationComments.saving['2026-09']"),false);

run('easyEnsurePresentationComment(2026,8)');await tick(0);
await tick(12000);
assert.equal(run("easyPresentationComments.loading['2026-08']"),false,'timeout ends loading');
const count=calls.length;
run('easyEnsurePresentationComment(2026,8)');await tick(0);
assert.equal(calls.length,count,'render does not retry failed loads forever');
assert.equal(run("easyPresentationCommentParts(easyPresentationComments.drafts['2026-09']).analysis"),'오류가 나도 유지할 초안','other month loading preserves current draft');
// Confirmed (locked) comments: read-only until 수정하기, saves carry force only while editing, month picker lists every month.
run("easyPresentationComments.records['2026-07']={year:2026,month:7,text:'{\"version\":3,\"analysis\":\"7월 확정 분석\",\"inquiryAnalysis\":\"\",\"improvement\":\"7월 계획\"}',updatedAt:'2026-07-31T09:00:00Z',updatedBy:'',locked:true,hasPrevious:true,seeded:false};easyPresentationComments.loaded['2026-07']=true;");
const lockedHtml=run('easyPresentationCommentEditor([7])');
assert.ok(/<textarea name="analysis"[^>]*readonly/.test(lockedHtml),'confirmed comment is read-only');
assert.ok(lockedHtml.includes('data-v10-action="presentationCommentEdit"'),'offers 수정하기');
assert.ok(lockedHtml.includes('data-v10-action="presentationCommentRestore"'),'offers restore when a previous version exists');
assert.ok(!lockedHtml.includes('저장하고 확정'),'no save button while confirmed');
assert.ok(lockedHtml.includes('확정됨'),'status says confirmed');
assert.equal((lockedHtml.match(/<option value="\d+"/g)||[]).length,12,'every month can be opened regardless of the dashboard period');
const before=calls.length;
await run("easySavePresentationComment({dataset:{year:'2026',month:'7'},analysis:'우회 저장',improvement:'x'})");
assert.equal(calls.length,before,'a confirmed comment ignores stray submits');
assert.equal(run("easyPresentationCommentParts(easyPresentationComments.records['2026-07'].text).analysis"),'7월 확정 분석');
run("easyPresentationComments.editing['2026-07']=true");
const editingHtml=run('easyPresentationCommentEditor([7])');
assert.ok(!/<textarea name="analysis"[^>]*readonly/.test(editingHtml),'editing unlocks the textareas');
assert.ok(editingHtml.includes('저장하고 확정')&&editingHtml.includes('presentationCommentCancel'),'editing shows save and cancel');
const forced=run("easySavePresentationComment({dataset:{year:'2026',month:'7'},analysis:'수정한 분석',improvement:'7월 계획'})");
await tick(0);
assert.equal(calls.at(-1).name,'save');
assert.equal(calls.at(-1).args[0].force,true,'editing a confirmed comment sends force');
calls.at(-1).success({year:2026,month:7,text:calls.at(-1).args[0].text,updatedAt:'2026-10-19T00:00:00Z',locked:true,hasPrevious:true,seeded:false});
await forced;
assert.equal(run("easyPresentationComments.editing['2026-07']"),false,'saving confirms again');
assert.ok(run('easyPresentationCommentEditor([7])').includes('readonly'),'back to read-only after save');
// Seeded September text is shown confirmed and the picker remembers a month while the period is unchanged.
run("easyPresentationComments.records['2026-09']={year:2026,month:9,text:'{\"version\":3,\"analysis\":\"9월 분석\",\"inquiryAnalysis\":\"\",\"improvement\":\"9월 계획\"}',updatedAt:'2026-09-30T08:37:10Z',updatedBy:'발표 확정본',locked:true,hasPrevious:false,seeded:true};easyPresentationComments.editing['2026-09']=false;");
const seededHtml=run('easyPresentationCommentEditor([9])');
assert.ok(seededHtml.includes('발표 확정본')&&/readonly/.test(seededHtml),'seeded presentation text is confirmed');
run("easyPresentationComments.months[2026]={month:9,period:easyPresentationPeriodSig([10])}");
assert.equal(run('easyPresentationCommentMonth([10])'),9,'a picked month sticks while the period is the same');
assert.equal(run('easyPresentationCommentMonth([11])'),11,'a new period resets the pick');
console.log('PASS: editable loading, load/save race, error drafts, timeout, month isolation, confirmation lock and month picker');
