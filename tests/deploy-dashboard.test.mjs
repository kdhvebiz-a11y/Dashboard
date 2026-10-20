import assert from 'node:assert/strict';
import {deploy,releaseFiles,fingerprint,DEPLOYMENT_ID} from '../scripts/deploy-dashboard.mjs';
const release='a'.repeat(40),html=`<meta name="dashboard-release" content="${release}">`,server=`var health={release:'${release}'};`;
const published={files:[{name:'appsscript',type:'JSON',source:'{"webapp":{"access":"ANYONE_ANONYMOUS"}}'},{name:'index',type:'HTML',source:'old html'},{name:'대시보드',type:'SERVER_JS',source:'old server'},{name:'자동알림창',type:'SERVER_JS',source:'published alert'}]};
const editor=structuredClone(published);editor.files[3].source='unpublished user alert';
assert.equal(releaseFiles(published,html,server).files[3].source,'published alert');
assert.equal(published.files[1].source,'old html','release assembly must not mutate the published snapshot');
assert.throws(()=>releaseFiles({files:[]},html,server),/missing/);
function mock({failVersion=false,concurrentStage=false,failHealth=false,staleReads=0}={}){
 let head=structuredClone(editor),deployment={deploymentConfig:{scriptId:'script',versionNumber:54,manifestFileName:'appsscript',description:'existing'}};
 let staged=false,conflicted=false,stale=0,puts=0,previous=null;const calls=[],sleeps=[];
 const api=async(path,method='GET',body)=>{
  calls.push({path,method});
  if(path==='deployments/'+DEPLOYMENT_ID){
   if(method==='PUT'){previous=deployment;deployment=structuredClone(body);stale=puts++===0?staleReads:0;return structuredClone(deployment);}
   // Simulate the API answering with the pre-update deployment for a few reads after a PUT.
   if(stale>0&&previous){stale--;return structuredClone(previous);}
   return structuredClone(deployment);
  }
  if(path.startsWith('content?'))return structuredClone(published);
  if(path==='content'){
   if(method==='PUT'){head=structuredClone(body);staged=head.files[1].source===html;}
   if(method==='GET'&&staged&&concurrentStage&&!conflicted){head.files[3].source='concurrent editor change';conflicted=true;}
   return structuredClone(head);
  }
  if(path==='versions'&&method==='POST'){if(failVersion)throw Error('version unavailable');return {versionNumber:55};}
  throw Error('Unexpected API operation');
 };
 return {api,checkHealth:async()=>!failHealth,log:()=>{},sleep:async ms=>{sleeps.push(ms);},read:()=>({head,deployment,calls,sleeps})};
}
{
 // A deployment update that the API reports late must not be treated as a failure (it was live and healthy).
 const m=mock({staleReads:3});const result=await deploy({...m,html,server,release});
 assert.equal(result.version,55);assert.equal(m.read().deployment.deploymentConfig.versionNumber,55,'late-visible deployment is kept');
 assert.ok(m.read().sleeps.length>=3,'the version is polled instead of failing on the first stale read');
}
{
 // Even when the API never catches up within the polling window, a healthy public release counts as deployed.
 const m=mock({staleReads:99});const result=await deploy({...m,html,server,release});
 assert.equal(result.version,55);assert.equal(m.read().deployment.deploymentConfig.versionNumber,55);
}
{
 const m=mock({staleReads:99,failHealth:true});await assert.rejects(()=>deploy({...m,html,server,release}),/version verification failed/);
 assert.equal(m.read().deployment.deploymentConfig.versionNumber,54,'unhealthy release is rolled back even when the API lags');
}
{
 const m=mock();const result=await deploy({...m,html,server,release});
 assert.equal(result.version,55);assert.equal(fingerprint(m.read().head),fingerprint(editor),'unpublished editor source is preserved');
 assert.equal(m.read().deployment.deploymentConfig.manifestFileName,'appsscript');
}
{
 const m=mock({failVersion:true});await assert.rejects(()=>deploy({...m,html,server,release}),/version unavailable/);
 assert.equal(fingerprint(m.read().head),fingerprint(editor));assert.equal(m.read().deployment.deploymentConfig.versionNumber,54);
}
{
 const m=mock({failHealth:true});await assert.rejects(()=>deploy({...m,html,server,release}),/health check/);
 assert.equal(m.read().deployment.deploymentConfig.versionNumber,54,'failed public verification rolls back the deployment');
}
{
 const m=mock({concurrentStage:true});await assert.rejects(()=>deploy({...m,html,server,release}),/Concurrent editor/);
 assert.equal(m.read().head.files[3].source,'concurrent editor change','never overwrite concurrent edits');
 assert.equal(m.read().deployment.deploymentConfig.versionNumber,54);
}
console.log('PASS: deployment preserves sharing and unpublished edits, stops concurrent changes, and rolls back failed verification');
