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
const extension=(await read('dashboard.js')).replace('v10Boot();','')+'\n'+await read('source-audit.js')+'\n'+await read('easy-ui.js')+'\n'+await read('sales-meeting.js')+'\n'+contracts+'\n'+await read('followup.js')+'\n'+await read('weekly.js')+'\nv10Boot();';
if(!html.includes('(function boot(){'))throw new Error('Template boot marker missing');
html=html.replace('</head>',`<style>\n${css}\n</style>\n</head>`);
html=html.slice(0,html.indexOf('(function boot(){'))+'\n'+extension+'\n</script>\n<script>\n'+await read('business-parts.js')+'\n</script>\n</body>\n</html>\n';
html=html.replace('const isContract = r => r.ct.indexOf(\'계약\') >= 0;',"const isContract = r => /계약/.test(r.ct) && !/미계약|계약\\s*(취소|예정|검토)|계약\\s*전/.test(r.ct);");
html=html.replace("no.match(/^(?:sp)?(\\d{1,2})-/i)","no.match(/^(?:(?:sp|ugs)[- ]?)?(\\d{1,2})-/i)");
html=html.replace("const s=String(v).replace(/[^0-9.\\-]/g,'');\nconst n=parseFloat(s);", "const hit=String(v).match(/-?\\d[\\d,]*(?:\\.\\d+)?/);\nconst n=hit?parseFloat(hit[0].replace(/,/g,'')):NaN;");
let server=await read('template.gs');
server=server.replace("'gsdash_v9'","'gsdash_v10'").replace('var CHUNK     = 90000','var CHUNK     = 24000');
server=server.replace('var CACHE_SEC = 21600','var CACHE_SEC = 300');
server=server.replace('[  5,   0,   3,  14]','[  1,   0,   1,  14]');
server=server.replace('var out = { at: new Date().toISOString() };','var out = { at: new Date().toISOString(), version: 10 };');
server=server.replace('    return out;\n  } catch (err)',"    out.yearData = collectYearDataV10(SpreadsheetApp.openById(SHEET_ID));\n    return out;\n  } catch (err)");
// Large year ledgers make HtmlService template evaluation very slow when embedded.
// Render the shell immediately, then use the existing google.script.run loader.
server=server.replace('var warm = fresh ? null : readCache();','var warm = null;');
server=server.replace("t.DATA = warm ? warm : 'null';","t.DATA = 'null';");
server=server.replace('  writeCache(json);','  if (!JSON.parse(json).error) writeCache(json);');
server+='\n'+await read('year-data.gs');
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
await writeFile(new URL('index.html',base),html);
await writeFile(new URL('대시보드.gs',base),server);
console.log('v10 Apps Script HTML and server assembled.');
