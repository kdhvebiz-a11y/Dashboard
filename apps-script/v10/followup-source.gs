/* Source evidence only. Never infer an actual phone call from an edit. */
function fuSourceDate_(value,year){
 var s=String(value||'').trim(),m=s.match(/^(?:(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})|(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일)(?!\d)/);
 if(!m)return '';
 var d=String(m[1]||year)+'-'+('0'+(m[2]||m[4]||m[6])).slice(-2)+'-'+('0'+(m[3]||m[5]||m[7])).slice(-2);
 try{return fuDate_(d);}catch(e){return '';}
}
function fuNoteEvidence_(notes,year,today){
 var latest={date:'',excerpt:'',inferredYear:false},future=0;
 String(notes||'').split(/\r?\n/).forEach(function(line){
  var s=line.trim().replace(/^[▶►●>*\-\s]+/,'').replace(/^[\[(]\s*/,'');
  // Only dated paragraph headings; ignore embedded grid/permit dates and phone numbers.
  var date=fuSourceDate_(s,year);if(!date)return;
  if(date>today){future++;return;}
  if(date>=latest.date)latest={date:date,excerpt:line.trim().slice(0,160),inferredYear:!/^20\d{2}[.\/-]/.test(s)};
 });
 latest.futureHeadings=future;return latest;
}
function fuObserveNotes_(rows){
 // One compact, private snapshot. No raw M contents or personal fields are stored.
 var lock=LockService.getScriptLock(),locked=false;
 try{
  lock.waitLock(15000);locked=true;
  var p=fuProps_(),all=p.getProperties(),manifest=all.fu_note_manifest?JSON.parse(all.fu_note_manifest):null,map={};
  if(manifest){
   if(!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>60||!/^[a-zA-Z0-9]+$/.test(manifest.generation))throw Error('내용 변경 추적 색인 오류');
   var encoded='';for(var j=0;j<manifest.count;j++){var chunk=all['fu_note_'+manifest.generation+'_'+j];if(!chunk)throw Error('내용 변경 추적 저장소를 확인하세요.');encoded+=chunk;}
   map=JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),'application/gzip')).getDataAsString());
  }
  var today=fuToday_(),dirty=false;
  rows.forEach(function(r){
   if(r.duplicate||!r.noteFingerprint)return;
   var key=fuHash_(r.id).slice(0,24),old=map[key],hash=r.noteFingerprint;
   if(!old){old=[hash,today,''];map[key]=old;dirty=true;}
   else if(old[0]!==hash){old=[hash,old[1],today];map[key]=old;dirty=true;}
   r.noteObserved={since:old[1],changed:old[2]};
  });
  if(dirty){
   var data=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(map),'application/json')).getBytes());
   var existing=Object.keys(all).reduce(function(n,k){return n+Utilities.newBlob(k+all[k],'text/plain').getBytes().length;},0);
   if(existing+data.length>440000)throw Error('내용 변경 추적 공간이 부족합니다. 관리자 확인이 필요합니다.');
   var gen=Utilities.getUuid().replace(/-/g,''),n=Math.ceil(data.length/7500);
   // Commit the manifest last; do not replace the prior snapshot until all chunks exist.
   for(var k=0;k<n;k++)p.setProperty('fu_note_'+gen+'_'+k,data.slice(k*7500,(k+1)*7500));
   p.setProperty('fu_note_manifest',JSON.stringify({generation:gen,count:n}));
   if(manifest)for(var z=0;z<manifest.count;z++)p.deleteProperty('fu_note_'+manifest.generation+'_'+z);
  }
  return '';
 }catch(e){rows.forEach(function(r){delete r.noteObserved;});return 'M열 변경 감지 미확인: '+e.message;}
 finally{if(locked)lock.releaseLock();}
}
