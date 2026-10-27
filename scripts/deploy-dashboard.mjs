// Deploy only the dashboard files. Keep editor-only changes and sharing untouched.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const SCRIPT_ID='1vjd_vQXbncbVPvOlgRZZsy0XLRYXqywWIwAc-S_9Pov7d4gn75NhmTIj';
export const DEPLOYMENT_ID='AKfycbzHukN_HIc7iguhO8ujKhJUO4NaPUOSkc2p3RyLe-Emq_UpH9uOOr-xGWZqHwEUkxYM';
export const WEB_URL=`https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;
export const filesOnly=d=>({files:d.files.map(({name,type,source})=>({name,type,source}))});
export const fingerprint=d=>createHash('sha256').update(JSON.stringify(filesOnly(d).files.sort((a,b)=>a.name.localeCompare(b.name)))).digest('hex');
export function releaseFiles(published,html,server){
 const next=filesOnly(published);
 for(const [name,type,source] of [['index','HTML',html],['대시보드','SERVER_JS',server]]){
  const matches=next.files.filter(f=>f.name===name&&f.type===type);
  if(matches.length!==1)throw Error('Expected dashboard file is missing or ambiguous: '+name);
  matches[0].source=source;
 }
 return next;
}
export async function deploy({api,html,server,release,checkHealth,backup=async()=>{},warm=async()=>{},log=console.log,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!/^[a-f0-9]{40}$/i.test(release))throw Error('Deployment requires a Git commit identifier');
 if(!html.includes(`content="${release}"`)||!server.includes(`release:'${release}'`))throw Error('Build/release identifier mismatch');
 // Right after another run updated the deployment, the API may still answer with the older record for a while;
 // read until two consecutive answers agree so a stale first read is not mistaken for a concurrent change later.
 let prior=await api('deployments/'+DEPLOYMENT_ID);
 for(let n=0;n<8;n++){await sleep(3000);const again=await api('deployments/'+DEPLOYMENT_ID);const same=JSON.stringify(again.deploymentConfig)===JSON.stringify(prior.deploymentConfig);prior=again;if(same)break;}
 if(!Number.isInteger(prior.deploymentConfig?.versionNumber))throw Error('Existing versioned deployment is required');
 const published=await api('content?versionNumber='+prior.deploymentConfig.versionNumber);
 const head=await api('content');
 const next=releaseFiles(published,html,server);
 await backup({head,prior});
 if(fingerprint(await api('content'))!==fingerprint(head))throw Error('Editor changed during preparation; deployment stopped');
 let staged=false,version;
 try{
  staged=true;
  await api('content','PUT',next);
  if(fingerprint(await api('content'))!==fingerprint(next))throw Error('Staged source verification failed');
  version=await api('versions','POST',{description:'GitHub '+release.slice(0,12)});
  if(!Number.isInteger(version.versionNumber))throw Error('Version creation was not confirmed');
 }finally{
  if(staged){
   const now=await api('content');
   if(fingerprint(now)===fingerprint(next)){
    await api('content','PUT',filesOnly(head));
    if(fingerprint(await api('content'))!==fingerprint(head))throw Error('Editor source restoration failed; deployment not changed');
   }else if(fingerprint(now)!==fingerprint(head))throw Error('Concurrent editor change detected; deployment stopped without overwriting it');
  }
 }
 const target={...prior.deploymentConfig,versionNumber:version.versionNumber,description:'GitHub '+release.slice(0,12)};
 const latest=await api('deployments/'+DEPLOYMENT_ID);
 if(JSON.stringify(latest.deploymentConfig)!==JSON.stringify(prior.deploymentConfig))throw Error('Deployment changed concurrently; refusing to replace it');
 // The Apps Script API can answer a GET with the pre-update deployment for a while after a PUT,
 // so the version is polled and the public health check (which proves the live release) is decisive.
 const settled=async want=>{
  for(let n=0;n<12;n++){
   const d=await api('deployments/'+DEPLOYMENT_ID);
   if(d.deploymentConfig?.versionNumber===want)return true;
   await sleep(5000);
  }
  return false;
 };
 try{
  await api('deployments/'+DEPLOYMENT_ID,'PUT',{deploymentConfig:target});
  const confirmed=await settled(version.versionNumber);
  if(!confirmed)log('Deployment version not yet visible through the API; relying on the public health check.');
  if(!await checkHealth(release))throw Error(confirmed?'Published health check failed':'Deployment version verification failed');
 }catch(e){
  await api('deployments/'+DEPLOYMENT_ID,'PUT',{deploymentConfig:prior.deploymentConfig});
  if(!await settled(prior.deploymentConfig.versionNumber))throw Error('Rollback could not be verified; inspect deployment immediately');
  log('Previous deployment restored after verification failure.');
  throw e;
 }
 log('Deployment verified: version '+version.versionNumber+' / commit '+release.slice(0,12));
 // Pre-read the sheets so the first visitor after a deploy gets a warm cache instead of a cold multi-minute read.
 try{await warm();log('Cache warmed after deployment.');}catch(e){log('Cache warm-up skipped: '+(e.message||e));}
 return {version:version.versionNumber,previousVersion:prior.deploymentConfig.versionNumber,url:WEB_URL};
}
export async function main(){
 const env=process.env;
 for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN','GITHUB_SHA'])if(!env[key])throw Error('Required secret or release is missing: '+key);
 const authResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(30000),body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token'})});
 if(!authResponse.ok)throw Error('Google authentication failed (HTTP '+authResponse.status+'); reauthorize the deployment account');
 const auth=await authResponse.json();if(!auth.access_token)throw Error('Google did not return an access token');
 if(env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+auth.access_token);
 const api=async(path,method='GET',body)=>{
  const r=await fetch(`https://script.googleapis.com/v1/projects/${SCRIPT_ID}/${path}`,{method,signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok)throw Error('Apps Script '+method+' '+path+' failed (HTTP '+r.status+')');
  return r.json();
 };
 const base=new URL('../apps-script/v10/',import.meta.url);
 const html=await readFile(new URL('index.html',base),'utf8'),server=await readFile(new URL('대시보드.gs',base),'utf8');
 const checkHealth=async release=>{
  for(let n=0;n<6;n++){
   try{const r=await fetch(WEB_URL+'?health=1&release='+release+'&check='+n,{signal:AbortSignal.timeout(25000)});if(r.ok){const d=await r.json();if(d.ok===true&&d.release===release)return true;}}catch{}
   if(n<5)await new Promise(r=>setTimeout(r,5000));
  }
  return false;
 };
 const backup=async data=>{
  const folder=new URL('../outputs/deployment-'+Date.now()+'/',import.meta.url);await mkdir(folder,{recursive:true});
  await writeFile(new URL('prior.json',folder),JSON.stringify(data),{mode:0o600});
 };
 const warm=async()=>{
  for(const q of ['?data=1&fresh=1','?weekly=1','?followup=warm&release='+env.GITHUB_SHA]){const r=await fetch(WEB_URL+q,{signal:AbortSignal.timeout(330000)});if(!r.ok)throw Error('warm-up '+q+' HTTP '+r.status);await r.text();}
 };
 const result=await deploy({api,html,server,release:env.GITHUB_SHA,checkHealth,backup,warm});
 if(env.GITHUB_STEP_SUMMARY)await writeFile(env.GITHUB_STEP_SUMMARY,`## Dashboard deployed\n- Commit: ${env.GITHUB_SHA}\n- Version: ${result.version}\n- Previous version: ${result.previousVersion}\n- [Open dashboard](${WEB_URL})\n`,{flag:'a'});
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
