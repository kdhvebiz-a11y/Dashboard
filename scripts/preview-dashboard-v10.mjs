import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {readDashboardPayload} from './dashboard-data-source.mjs';
const source=new URL('../apps-script/v10/index.html',import.meta.url);
let cached=null,inflight=null;
async function payload(fresh=false){
 if(cached&&!fresh&&Date.now()-cached.time<300000)return cached.data;
 if(inflight)return inflight;
 inflight=(async()=>{
  const d=await readDashboardPayload(fresh);
  cached={data:d,time:Date.now()};return d;
 })().finally(()=>{inflight=null;});return inflight;
}
const server=createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/data.json')){const data=await payload(req.url.includes('fresh=1'));res.writeHead(200,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));return;}
  if(req.url!=='/'){res.writeHead(404);res.end('Not found');return;}
  const html=(await readFile(source,'utf8')).replace('<?!= DATA ?>','null');
  res.writeHead(200,{'content-type':'text/html;charset=utf-8','cache-control':'no-store'});res.end(html);
 }catch(e){res.writeHead(502,{'content-type':'application/json;charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(4176,'127.0.0.1',()=>console.log('Dashboard v10 preview: http://127.0.0.1:4176/'));
