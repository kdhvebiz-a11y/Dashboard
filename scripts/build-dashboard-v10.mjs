// Assemble self-contained Apps Script files from the supplied source and v10 extension.
import { readFile,writeFile } from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const base=new URL('../apps-script/v10/',import.meta.url);
const read=name=>readFile(new URL(name,base),'utf8');
let html=await read('template.html');
const css=(await read('dashboard.css'))+'\n'+(await read('easy-ui.css'))+'\n'+await read('followup.css')+'\n'+await read('readability.css')+'\n'+await read('sales-meeting.css')+'\n'+await read('sales-minutes.css')+'\n'+await read('business-parts.css')+'\n'+await read('weekly.css');
const contractInput=process.env.CONTRACT_DATA_GZIP_BASE64?gunzipSync(Buffer.from(process.env.CONTRACT_DATA_GZIP_BASE64,'base64')).toString('utf8'):await read('contracts-data.json');
const parsedContracts=JSON.parse(contractInput);
if(!Array.isArray(parsedContracts.sources))throw Error('Contract build data is missing or invalid');
const contractData=JSON.stringify(parsedContracts).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const contracts=(await read('contracts.js')).replace('__CONTRACT_DATA__',contractData);
// 영업회의록 한글 양식(.hwp, base64 텍스트로 보관 — 회사 DRM이 .hwp를 암호화할 수 있어 원본 파일은 저장소에 두지 않는다)
const minutesTemplate=(await read('sales-minutes-template.hwp.b64')).replace(/\s+/g,'');
if(!minutesTemplate.startsWith('0M8R4KGxGuE'))throw new Error('sales-minutes-template.hwp.b64 is not an OLE/HWP file');
const salesMeeting=(await read('sales-meeting.js')).replace('__SALES_MINUTES_HWP_B64__',minutesTemplate);
const extension=(await read('dashboard.js')).replace('v10Boot();','')+'\n'+await read('source-audit.js')+'\n'+await read('easy-ui.js')+'\n'+await read('hwp-fill.js')+'\n'+salesMeeting+'\n'+contracts+'\n'+await read('followup.js')+'\n'+await read('weekly.js')+'\nv10Boot();';
// Apps Script strips JS comments before serving, and its scanner can lose track of quotes around nested template literals,
// so a "//" inside a string may be cut off as if it were a comment (this broke contractMap's Kakao link and the whole page).
// Writing every "https://" as "https:\/\/" in the v10 scripts keeps the same value but never looks like a comment.
const guardSlashes=s=>s.replace(/(https?:)\/\//g,'$1\\/\\/');
if(!html.includes('(function boot(){'))throw new Error('Template boot marker missing');
html=html.replace('</head>',`<style>\n${css}\n</style>\n</head>`);
html=html.replace('처음 열 때는 몇 초 걸립니다. 이후에는 훨씬 빠릅니다.','통계·말·문의 원장을 모두 읽습니다. 처음 열 때는 1~3분 걸릴 수 있고, 평소에는 미리 읽어 둔 자료로 바로 열립니다. 새로고침을 누르면 지금 바로 다시 읽습니다.');
html=html.slice(0,html.indexOf('(function boot(){'))+'\n'+guardSlashes(extension)+'\n</script>\n<script>\n'+guardSlashes(await read('business-parts.js'))+'\n</script>\n</body>\n</html>\n';
html=html.replace('const isContract = r => r.ct.indexOf(\'계약\') >= 0;',"const isContract = r => /계약/.test(r.ct) && !/미계약|계약\\s*(취소|예정|검토)|계약\\s*전/.test(r.ct);");
// Line charts: series names live in the legend, so the right margin shrinks when end labels are off, and the first `valueSeries` lines can carry value labels even with three series.
// Optional end-of-line labels for chosen series only (cfg.endLabels = series indices; s.endLabel overrides the text), e.g. the top-ranked regions.
html=html.replace('const showDL = cfg.series.length<=4 && cfg.labels.length>0 && !cfg.noLabels;','const showDL = (cfg.series.length<=4 || Array.isArray(cfg.endLabels)) && cfg.labels.length>0 && !cfg.noLabels;');
html=html.replace('const pts=cfg.series.map((s,si)=>({s,si,y:Y(s.values[n-1])}))','const pts=cfg.series.map((s,si)=>({s,si,y:Y(s.values[n-1])})).filter(p=>!Array.isArray(cfg.endLabels)||cfg.endLabels.includes(p.si))');
html=html.replace('text-anchor="start" style="fill:${p.s.color};font-weight:600">${esc(p.s.name)}</text>`;','text-anchor="start" style="fill:${p.s.color};font-weight:700">${esc(p.s.endLabel||p.s.name)}</text>`;');
html=html.replace('const P={l:100,r:Math.max(dlPad,150),t:32,b:42};','const P={l:100,r:showDL?Math.max(dlPad,150):48,t:32,b:42};');
// Hover: tag x-axis labels (data-xk) and line points (data-pk) with their index so the hovered month can be highlighted (v10 wireCharts).
const swap=(from,to)=>{if(!html.includes(from))throw new Error('Template chart marker missing: '+from.slice(0,60));html=html.replace(from,to);};
// Bar charts: cfg.topLabels = [{text,color}] per category → big label above each group (e.g. quarterly achievement rate).
swap("const P={l:110,r:24,t: cfg.ghost?36 : vRot?Math.min(90,_lw+16) : 34, b:42};","const P={l:110,r:24,t: cfg.ghost?36 : vRot?Math.min(90,_lw+16) : 34, b:42};\nif(cfg.topLabels)P.t+=30;");
swap("hit+=`<rect x=\"${(P.l+iw*k).toFixed(1)}\" y=\"${P.t}\" width=\"${iw.toFixed(1)}\"","if(cfg.topLabels&&cfg.topLabels[k])dl+=`<text class=\"val top\" x=\"${cx.toFixed(1)}\" y=\"${(P.t-12).toFixed(1)}\" text-anchor=\"middle\" style=\"fill:${cfg.topLabels[k].color||'var(--ink)'}\">${esc(cfg.topLabels[k].text)}</text>`;\nhit+=`<rect x=\"${(P.l+iw*k).toFixed(1)}\" y=\"${P.t}\" width=\"${iw.toFixed(1)}\"");
swap('xl+=`<text x="${X(k).toFixed(1)}" y="${H-P.b+24}" text-anchor="middle" ${k===selectedIndex','xl+=`<text data-xk="${k}" x="${X(k).toFixed(1)}" y="${H-P.b+24}" text-anchor="middle" ${k===selectedIndex');
swap('xl+=`<text x="${cx.toFixed(1)}" y="${H-P.b+26}" text-anchor="middle">','xl+=`<text data-xk="${k}" x="${cx.toFixed(1)}" y="${H-P.b+26}" text-anchor="middle">');
swap('paths+=`<circle cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"','paths+=`<circle data-pk="${k}" cx="${X(k).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4"');
{
 // Value labels on up to three lines. At every x the highest point is labelled above, the lowest below and a middle one to the right, so crossing lines do not stack their labels.
 const from=html.indexOf('if(!cfg.noVals && cfg.series.length<=2 && n<=13){'),to=html.indexOf('let hit=\'\';',from);
 if(from<0||to<0)throw Error('chartLine value-label block not found');
 html=html.slice(0,from)+`const labelCount = cfg.noVals ? 0 : n<=13 ? (cfg.valueSeries || (cfg.series.length<=3 ? cfg.series.length : 0)) : 0;
if(labelCount>0){
const multi=cfg.series.length>1;
for(let k=0;k<n;k++){
const pts=cfg.series.slice(0,labelCount).map((sv,si)=>({sv,si,v:sv.values[k]})).filter(p=>p.v>0).sort((a,b)=>b.v-a.v);
pts.forEach((p,rank)=>{
const y=Y(p.v);let ly,lx=X(k),anchor='middle';
if(!multi||pts.length===1||rank===0)ly=y-10;
else if(rank===pts.length-1){ly=y+17;if(ly>H-P.b-5)ly=y-10;}
else {ly=y+4;lx=X(k)+8;anchor='start';}
dl+=\`<text class="val\${multi?' vs':''}" x="\${lx.toFixed(1)}" y="\${ly.toFixed(1)}" text-anchor="\${anchor}"\${multi?\` style="fill:\${p.sv.color}"\`:''}>\${esc((cfg.fmt||d1)(p.v))}\${esc(cfg.unit||'')}</text>\`;
});
}
}
`+html.slice(to);
}
html=html.replace("no.match(/^(?:sp)?(\\d{1,2})-/i)","no.match(/^(?:(?:sp|ugs)[- ]?)?(\\d{1,2})-/i)");
html=html.replace("const s=String(v).replace(/[^0-9.\\-]/g,'');\nconst n=parseFloat(s);", "const hit=String(v).match(/-?\\d[\\d,]*(?:\\.\\d+)?/);\nconst n=hit?parseFloat(hit[0].replace(/,/g,'')):NaN;");
let server=await read('template.gs');
server=server.replace("'gsdash_v9'","'gsdash_v10'").replace('var CHUNK     = 90000','var CHUNK     = 24000');
// A cold read of the source sheets takes minutes; keep the payload cached for 2 hours. The 30-minute
// 캐시채우기 trigger and the post-deploy warm-up refresh it, so visitors almost never wait for a cold read.
// 새로고침 and the client's timed refresh still force a fresh read (fresh=true).
server=server.replace('var CACHE_SEC = 21600','var CACHE_SEC = 7200');
server=server.replace('[  5,   0,   3,  14]','[  1,   0,   1,  14]');
server=server.replace('var out = { at: new Date().toISOString() };','var out = { at: new Date().toISOString(), version: 10 };');
server=server.replace('    return out;\n  } catch (err)',"    out.yearData = collectYearDataV10(SpreadsheetApp.openById(SHEET_ID));\n    return out;\n  } catch (err)");
// Large year ledgers make HtmlService template evaluation very slow when embedded.
// Render the shell immediately, then use the existing google.script.run loader.
server=server.replace('var warm = fresh ? null : readCache();','var warm = null;');
server=server.replace("t.DATA = warm ? warm : 'null';","t.DATA = 'null';");
server=server.replace('  writeCache(json);','  if (!JSON.parse(json).error) writeCache(json);');
server+='\n'+await read('year-data.gs');
// 30분 캐시채우기 트리거가 상담 후속관리 목록 캐시도 함께 채운다(메뉴를 누르면 바로 열리게).
if(!server.includes('  var json = getPayloadJson(true);\n'))throw new Error('캐시채우기 marker missing');
server=server.replace('  var json = getPayloadJson(true);\n',"  var json = getPayloadJson(true);\n  try { fuWarmCache(); } catch (e) { Logger.log('상담 후속관리 캐시 실패: ' + e.message); }\n");
server+='\n'+await read('followup.gs');
server+='\n'+await read('followup-source.gs');
server+='\n'+await read('presentation-comments.gs');
server+='\n'+await read('weekly-data.gs');
server=server.replace('  var fresh = !!p.fresh;',"  if (p.weekly === '1') return ContentService.createTextOutput(JSON.stringify(collectWeeklyMeetingDataV10())).setMimeType(ContentService.MimeType.JSON);\n  var fresh = !!p.fresh;");
// The access secret is local-only; only its SHA-256 hash enters server code.
const adminHash=process.env.FOLLOWUP_ADMIN_HASH||JSON.parse(await readFile(new URL('../.codex-work/followup-access.json',import.meta.url),'utf8')).hash;
if(!/^[a-f0-9]{64}$/i.test(adminHash))throw Error('Valid administrator hash is required; authentication cannot be reset during deployment');
server=server.replace('__FOLLOWUP_ADMIN_HASH__',adminHash);
const release=process.env.GITHUB_SHA||'local';
if(release!=='local'&&!/^[a-f0-9]{40}$/i.test(release))throw Error('Invalid release identifier');
html=html.replace('</head>',`<meta name="dashboard-release" content="${release}">\n</head>`);
server=server.replace('  var fresh = !!p.fresh;',`  if (p.health === '1') return ContentService.createTextOutput(JSON.stringify({ok:true,release:'${release}'})).setMimeType(ContentService.MimeType.JSON);\n  var fresh = !!p.fresh;`);
// 배포 직후 1회: 이 배포 버전으로 상담 후속관리 캐시 트리거를 다시 만들고 캐시를 채운다(배포 커밋을 알아야 호출 가능).
server=server.replace('  var fresh = !!p.fresh;',`  if (p.followup === 'warm' && p.release === '${release}') return ContentService.createTextOutput(JSON.stringify(fuInstallWarmTrigger())).setMimeType(ContentService.MimeType.JSON);\n  var fresh = !!p.fresh;`);
await writeFile(new URL('index.html',base),html);
await writeFile(new URL('대시보드.gs',base),server);
console.log('v10 Apps Script HTML and server assembled.');
