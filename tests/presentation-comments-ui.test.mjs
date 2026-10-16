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
console.log('PASS: editable loading, load/save race, error drafts, timeout and month isolation');
