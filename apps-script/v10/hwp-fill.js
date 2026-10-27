/* 한글(.hwp 5.0) 회의록 양식 채우기 — 사용자가 준 양식 파일을 그대로 두고 문단 글자만 바꿔 내려준다.
   구조: OLE 복합문서(CFB) 안의 BodyText/Section0 스트림(raw deflate)에 레코드(PARA_HEADER·PARA_TEXT…)가 들어 있다.
   글자 수가 달라지면 PARA_HEADER의 글자 수와 PARA_TEXT만 바꾸면 되고(문단 모양·글자 모양은 그대로), 한글이 열 때 줄을 다시 배치한다. */
const HWP_TAG={PARA_HEADER:0x42,PARA_TEXT:0x43,CHAR_SHAPE:0x44,LINE_SEG:0x45,CTRL_HEADER:0x47,LIST_HEADER:0x48,TABLE:0x4d};
function hwpB64(b64){const bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function hwpU32(b,o){return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function hwpU16(b,o){return b[o]|(b[o+1]<<8);}
function hwpSetU32(b,o,v){b[o]=v&255;b[o+1]=(v>>>8)&255;b[o+2]=(v>>>16)&255;b[o+3]=(v>>>24)&255;}
function hwpConcat(parts){const n=parts.reduce((t,p)=>t+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
// 한글의 압축 스트림은 deflate 끝 뒤에 몇 바이트가 더 붙어 있어 크롬 DecompressionStream이 마지막에 오류를 낸다 — 그때까지 나온 결과만 모은다.
async function hwpInflate(bytes){
 const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(bytes).catch(()=>{});w.close().catch(()=>{});
 const reader=ds.readable.getReader(),chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;if(value)chunks.push(value);}}catch(e){if(!chunks.length)throw e;}
 return hwpConcat(chunks);
}
async function hwpDeflate(bytes){const cs=new CompressionStream('deflate-raw');const w=cs.writable.getWriter();w.write(bytes);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer());}

/* ---------- CFB(OLE) 읽기·쓰기 ---------- */
function cfbRead(bytes){
 if(hwpU32(bytes,0)!==0xe011cfd0)throw Error('한글 양식 파일이 아닙니다.');
 const ss=1<<hwpU16(bytes,30),ms=1<<hwpU16(bytes,32),nFat=hwpU32(bytes,44),firstDir=hwpU32(bytes,48),cutoff=hwpU32(bytes,56),firstMini=hwpU32(bytes,60),nMini=hwpU32(bytes,64);
 let firstDifat=hwpU32(bytes,68);const fatSectors=[];for(let i=0;i<109&&fatSectors.length<nFat;i++){const v=hwpU32(bytes,76+i*4);if(v<0xfffffffc)fatSectors.push(v);}
 while(firstDifat<0xfffffffc&&fatSectors.length<nFat){const o=512+firstDifat*ss;for(let i=0;i<ss/4-1&&fatSectors.length<nFat;i++){const v=hwpU32(bytes,o+i*4);if(v<0xfffffffc)fatSectors.push(v);}firstDifat=hwpU32(bytes,o+ss-4);}
 const fat=[];fatSectors.forEach(sec=>{const o=512+sec*ss;for(let i=0;i<ss/4;i++)fat.push(hwpU32(bytes,o+i*4));});
 const chain=(start,table)=>{const out=[];let s=start,guard=0;while(s<0xfffffffc&&guard++<1e6){out.push(s);s=table[s];}return out;};
 const readChain=start=>{const secs=chain(start,fat),out=new Uint8Array(secs.length*ss);secs.forEach((s,i)=>out.set(bytes.subarray(512+s*ss,512+s*ss+ss),i*ss));return out;};
 const dirBytes=readChain(firstDir),entries=[];
 for(let o=0;o+128<=dirBytes.length;o+=128){const raw=dirBytes.slice(o,o+128),nl=hwpU16(raw,64),type=raw[66];let name='';for(let i=0;i+1<nl-1;i+=2)name+=String.fromCharCode(hwpU16(raw,i));entries.push({raw,name,type,start:hwpU32(raw,116),size:hwpU32(raw,120)});}
 const root=entries[0],miniFat=[];if(nMini)chain(firstMini,fat).forEach(sec=>{const o=512+sec*ss;for(let i=0;i<ss/4;i++)miniFat.push(hwpU32(bytes,o+i*4));});
 const miniStream=root.size?readChain(root.start).subarray(0,Math.ceil(root.size/ms)*ms):new Uint8Array(0);
 const data=e=>{if(e.type!==2||!e.size)return new Uint8Array(0);if(e.size<cutoff){const secs=chain(e.start,miniFat),out=new Uint8Array(secs.length*ms);secs.forEach((s,i)=>out.set(miniStream.subarray(s*ms,s*ms+ms),i*ms));return out.slice(0,e.size);}return readChain(e.start).slice(0,e.size);};
 // 경로: 저장소(폴더) 자식 포인터를 따라 이름을 붙인다.
 const path=new Array(entries.length).fill('');const walk=(ix,prefix)=>{if(ix>=entries.length||ix===0xffffffff)return;const e=entries[ix];path[ix]=prefix+e.name;walk(hwpU32(e.raw,68),prefix);walk(hwpU32(e.raw,72),prefix);if(e.type===1)walk(hwpU32(e.raw,76),prefix+e.name+'/');};
 walk(hwpU32(root.raw,76),'');entries.forEach((e,i)=>{e.path=path[i];e.data=data(e);});
 return {entries,sectorSize:ss,miniSize:ms,cutoff};
}
function cfbWrite(doc,replace){
 const ss=512,ms=64,cutoff=4096,E=doc.entries.map(e=>({...e,raw:e.raw.slice(),data:replace[e.path]||e.data}));
 const ENDC=0xfffffffe,FREE=0xffffffff,FATS=0xfffffffd;
 const pad=(b,unit)=>{const n=Math.ceil(b.length/unit)*unit;if(n===b.length)return b;const o=new Uint8Array(n);o.set(b);return o;};
 // 1) 작은 스트림은 미니 스트림(64바이트 단위)에, 큰 스트림은 일반 섹터에
 const miniParts=[],miniFat=[];let miniSec=0;
 E.forEach((e,i)=>{if(i===0||e.type!==2)return;if(e.data.length&&e.data.length<cutoff){const p=pad(e.data,ms),n=p.length/ms;e.mstart=miniSec;for(let k=0;k<n;k++)miniFat.push(k===n-1?ENDC:miniSec+k+1);miniSec+=n;miniParts.push(p);}});
 const miniStream=hwpConcat(miniParts);
 const dirCount=Math.ceil(E.length/4)*4;// 섹터당 4개 항목
 const dirBytes=new Uint8Array(dirCount*128);
 const big=[];E.forEach((e,i)=>{if(i===0||e.type!==2)return;if(e.data.length>=cutoff)big.push(e);});
 const miniFatBytes=new Uint8Array(Math.ceil(miniFat.length*4/ss)*ss);miniFatBytes.fill(255);miniFat.forEach((v,i)=>hwpSetU32(miniFatBytes,i*4,v));
 const blocks=[];// 순서: FAT, DIR, MINIFAT, MINISTREAM, 큰 스트림들
 const dirSecs=dirBytes.length/ss,mfSecs=miniFat.length?miniFatBytes.length/ss:0,msSecs=miniStream.length?pad(miniStream,ss).length/ss:0,bigSecs=big.map(e=>pad(e.data,ss).length/ss);
 let fatSecs=1,total;for(let k=0;k<8;k++){total=fatSecs+dirSecs+mfSecs+msSecs+bigSecs.reduce((a,b)=>a+b,0);const need=Math.ceil(total/(ss/4));if(need===fatSecs)break;fatSecs=need;}
 const fat=new Array(fatSecs*(ss/4)).fill(FREE);let cur=0;const alloc=n=>{const start=cur;for(let k=0;k<n;k++)fat[cur+k]=k===n-1?ENDC:cur+k+1;cur+=n;return start;};
 for(let k=0;k<fatSecs;k++)fat[k]=FATS;cur=fatSecs;
 const dirStart=alloc(dirSecs),mfStart=mfSecs?alloc(mfSecs):ENDC,msStart=msSecs?alloc(msSecs):ENDC;
 big.forEach((e,i)=>{e.bstart=alloc(bigSecs[i]);});
 // 2) 디렉터리 항목: 원본을 그대로 두고 시작 섹터·크기만 갱신
 E.forEach((e,i)=>{const raw=e.raw;if(i===0){hwpSetU32(raw,116,msSecs?msStart:ENDC);hwpSetU32(raw,120,miniStream.length);hwpSetU32(raw,124,0);}
  else if(e.type===2){if(!e.data.length){hwpSetU32(raw,116,ENDC);hwpSetU32(raw,120,0);}else if(e.data.length<cutoff){hwpSetU32(raw,116,e.mstart);hwpSetU32(raw,120,e.data.length);}else{hwpSetU32(raw,116,e.bstart);hwpSetU32(raw,120,e.data.length);}hwpSetU32(raw,124,0);}
  dirBytes.set(raw,i*128);});
 for(let i=E.length;i<dirCount;i++){const o=i*128;hwpSetU32(dirBytes,o+68,FREE);hwpSetU32(dirBytes,o+72,FREE);hwpSetU32(dirBytes,o+76,FREE);}
 // 3) 헤더
 const header=new Uint8Array(ss);[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].forEach((v,i)=>header[i]=v);
 header[24]=0x3e;header[26]=3;header[28]=0xfe;header[29]=0xff;header[30]=9;header[32]=6;
 hwpSetU32(header,44,fatSecs);hwpSetU32(header,48,dirStart);hwpSetU32(header,56,cutoff);hwpSetU32(header,60,mfStart);hwpSetU32(header,64,mfSecs);hwpSetU32(header,68,ENDC);hwpSetU32(header,72,0);
 for(let i=0;i<109;i++)hwpSetU32(header,76+i*4,i<fatSecs?i:FREE);
 if(fatSecs>109)throw Error('양식 파일이 너무 큽니다.');
 const fatBytes=new Uint8Array(fatSecs*ss);fat.forEach((v,i)=>hwpSetU32(fatBytes,i*4,v));
 blocks.push(header,fatBytes,dirBytes);if(mfSecs)blocks.push(miniFatBytes);if(msSecs)blocks.push(pad(miniStream,ss));big.forEach(e=>blocks.push(pad(e.data,ss)));
 return hwpConcat(blocks);
}

/* ---------- HWP 레코드 ---------- */
function hwpRecords(buf){
 const out=[];let i=0;
 while(i+4<=buf.length){const h=hwpU32(buf,i);const tag=h&0x3ff,level=(h>>10)&0x3ff;let size=h>>>20;i+=4;if(size===0xfff){size=hwpU32(buf,i);i+=4;}out.push({tag,level,data:buf.slice(i,i+size)});i+=size;}
 return out;
}
function hwpPack(records){
 return hwpConcat(records.flatMap(r=>{const n=r.data.length,h=new Uint8Array(n<0xfff?4:8);hwpSetU32(h,0,(r.tag|(r.level<<10)|((n<0xfff?n:0xfff)<<20))>>>0);if(n>=0xfff)hwpSetU32(h,4,n);return [h,r.data];}));
}
// PARA_TEXT → [{ctrl:bytes}|{text}] 토큰. 확장 제어문자(1~8,11,12,14~23)는 16바이트, 나머지 제어문자는 2바이트.
function hwpParaTokens(data){
 const toks=[];let j=0,text='';const flush=()=>{if(text){toks.push({text});text='';}};
 while(j+1<data.length){const c=hwpU16(data,j);
  if(c<32){flush();const ext=[1,2,3,4,5,6,7,8,11,12,14,15,16,17,18,19,20,21,22,23].includes(c);toks.push({ctrl:data.slice(j,j+(ext?16:2)),code:c});j+=ext?16:2;}
  else{text+=String.fromCharCode(c);j+=2;}}
 flush();return toks;
}
function hwpParaText(data){return hwpParaTokens(data).filter(t=>t.text).map(t=>t.text).join('');}
function hwpEncode(text){const b=new Uint8Array(text.length*2);for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);b[i*2]=c&255;b[i*2+1]=c>>8;}return b;}
// 문단 그룹: PARA_HEADER 레코드와 그 아래(level이 더 큰) 레코드들
function hwpParagraphs(records){
 const out=[];for(let i=0;i<records.length;i++){if(records[i].tag!==HWP_TAG.PARA_HEADER)continue;let j=i+1;while(j<records.length&&records[j].level>records[i].level)j++;out.push({start:i,end:j,level:records[i].level,text:(()=>{const t=records.slice(i+1,j).find(r=>r.tag===HWP_TAG.PARA_TEXT&&r.level===records[i].level+1);return t?hwpParaText(t.data):'';})()});}
 return out;
}
// 문단의 글(제어문자 뒤의 본문)을 바꾼다. 제어문자(구역·단 정의, 표 앵커)는 그대로 둔다.
function hwpSetParaText(records,para,text){
 const head=records[para.start];let ti=-1;for(let k=para.start+1;k<para.end;k++)if(records[k].tag===HWP_TAG.PARA_TEXT&&records[k].level===para.level+1){ti=k;break;}
 const ctrl=ti>=0?hwpParaTokens(records[ti].data).filter(t=>t.ctrl&&t.code!==13).map(t=>t.ctrl):[];
 const ctrlChars=ctrl.reduce((n,c)=>n+c.length/2,0),body=hwpEncode(String(text||'')),parts=[...ctrl];
 if(body.length)parts.push(body);parts.push(new Uint8Array([13,0]));
 const nchars=ctrlChars+body.length/2+1;
 hwpSetU32(head.data,0,(nchars|(hwpU32(head.data,0)&0x80000000))>>>0);// 최상위 비트 = '목록의 마지막 문단' 표시, 원래 값 유지
 // 글자 모양 위치가 새 글 길이를 넘으면 잘라내고(최소 1개), 줄 나눔 정보는 첫 줄만 남긴다(한글이 열 때 다시 계산).
 for(let k=para.start+1;k<para.end;k++){const r=records[k];if(r.level!==para.level+1)continue;
  if(r.tag===HWP_TAG.CHAR_SHAPE){const keep=[];for(let o=0;o+8<=r.data.length;o+=8){if(o===0||hwpU32(r.data,o)<nchars-1)keep.push(r.data.slice(o,o+8));}r.data=hwpConcat(keep);head.data[12]=keep.length&255;head.data[13]=keep.length>>8;}
  if(r.tag===HWP_TAG.LINE_SEG&&r.data.length>36){r.data=r.data.slice(0,36);head.data[14]=1;head.data[15]=0;}}
 const rec={tag:HWP_TAG.PARA_TEXT,level:para.level+1,data:hwpConcat(parts)};
 if(nchars===1&&!ctrl.length){if(ti>=0)records.splice(ti,1);}
 else if(ti>=0)records[ti]=rec;else records.splice(para.start+1,0,rec);
}
function hwpCloneParagraph(records,para){const out=records.slice(para.start,para.end).map(r=>({tag:r.tag,level:r.level,data:r.data.slice()}));if(out[0].data.length>=22)hwpSetU32(out[0].data,18,(Math.random()*0x7fffffff)>>>0);return out;}
function hwpTableCells(records,tableIndex){
 // tableIndex = TABLE 레코드 위치. 같은 level의 LIST_HEADER(셀)들을 (row,col)로 돌려준다.
 const lv=records[tableIndex].level,cells={};
 for(let k=tableIndex+1;k<records.length&&records[k].level>=lv;k++){const r=records[k];if(r.tag===HWP_TAG.LIST_HEADER&&r.level===lv&&r.data.length>=16){const col=hwpU16(r.data,8),row=hwpU16(r.data,10);cells[row+','+col]=k;}}
 return cells;
}
// 셀(LIST_HEADER)의 문단 수를 실제와 맞춘다 — 문단을 늘리거나 줄인 뒤 이 값이 틀리면 한글이 빈 문서로 연다.
function hwpFixListCounts(records){
 // PARA_HEADER 첫 4바이트의 최상위 비트는 "이 목록(구역·셀)의 마지막 문단" 표시다. 문단을 넣고 빼면 다시 매긴다.
 const setLast=(paraIdx,on)=>{const d=records[paraIdx].data,v=hwpU32(d,0)&0x7fffffff;hwpSetU32(d,0,(on?v|0x80000000:v)>>>0);};
 const lists=[{level:0,from:0,to:records.length}];
 records.forEach((r,k)=>{if(r.tag===HWP_TAG.LIST_HEADER||r.tag===HWP_TAG.PARA_HEADER&&false)return;});
 records.forEach((r,k)=>{if(r.tag!==HWP_TAG.LIST_HEADER)return;let j=k+1;for(;j<records.length;j++){const x=records[j];if(x.level<r.level||(x.tag===HWP_TAG.LIST_HEADER&&x.level===r.level))break;}lists.push({level:r.level,from:k+1,to:j,header:r});});
 lists.forEach(L=>{const paras=[];for(let j=L.from;j<L.to;j++){const x=records[j];if(x.tag===HWP_TAG.PARA_HEADER&&x.level===L.level)paras.push(j);}
  paras.forEach((pi,ix)=>setLast(pi,ix===paras.length-1));
  if(L.header&&L.header.data.length>=2){L.header.data[0]=paras.length&255;L.header.data[1]=(paras.length>>8)&255;}});
}
// 한글이 쓰는 압축 스트림 = raw deflate + CRC32(4) + 원본 크기(4)
const HWP_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function hwpCrc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=HWP_CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function hwpCompress(body){const z=await hwpDeflate(body),t=new Uint8Array(8);hwpSetU32(t,0,hwpCrc32(body));hwpSetU32(t,4,body.length);return hwpConcat([z,t]);}
/* ---------- 영업회의록 채우기 ----------
   fill = {reporter, heading1, table1:[[4]x3], table2:[[6]x3], extra, items:[{text,note}], summary:[5]} */
async function hwpFillSalesMinutes(templateBytes,fill){
 const doc=cfbRead(templateBytes),sec=doc.entries.find(e=>e.path==='BodyText/Section0');if(!sec)throw Error('양식에 본문이 없습니다.');
 const compressed=hwpU32(doc.entries.find(e=>e.path==='FileHeader').data,36)&1;
 const records=hwpRecords(compressed?await hwpInflate(sec.data):sec.data);
 const paras=()=>hwpParagraphs(records);
 const findPara=(rx,from=0)=>paras().find(p=>p.start>=from&&rx.test(p.text));
 const tableAfter=from=>{for(let k=from;k<records.length;k++)if(records[k].tag===HWP_TAG.TABLE)return k;return -1;};
 // 글을 바꾸면 레코드 수가 달라져 뒤쪽 셀 위치가 밀리므로, 셀 위치는 매번 표에서 다시 찾는다.
 const setCell=(tableIndex,row,col,text)=>{const li=hwpTableCells(records,tableIndex)[row+','+col];if(li===undefined)return;let k=li+1;while(k<records.length&&records[k].tag!==HWP_TAG.PARA_HEADER)k++;const p=paras().find(p=>p.start===k);if(p)hwpSetParaText(records,p,text);};
 // 1) 제목(보고자)
 const title=findPara(/■/);if(title&&fill.reporter)hwpSetParaText(records,title,'■컨설팅-'+fill.reporter);
 // 2) 1번 제목 + 표
 const h1=findPara(/^1\.\s*유입별/);if(h1&&fill.heading1)hwpSetParaText(records,h1,fill.heading1);
 const t1=tableAfter(h1?h1.end:0);if(t1>=0&&fill.table1)fill.table1.forEach((row,r)=>row.forEach((v,c)=>setCell(t1,r+1,c+1,v)));
 // 3) 2번 표 (순위 | 라벨,건수 ×3)
 const h2=findPara(/^2\.\s*사업형태별/);const t2=tableAfter(h2?h2.end:0);if(t2>=0&&fill.table2)fill.table2.forEach((row,r)=>row.forEach((v,c)=>setCell(t2,r+1,c+1,v)));
 // 4) ※ 별도 사업 메모
 const ex=findPara(/^※/);if(ex&&fill.extra!==undefined)hwpSetParaText(records,ex,fill.extra);
 // 5) 3번: 제목 다음부터 'ㆍ' 요약 전까지가 미팅 목록(마지막 빈 문단은 유지), 그 다음 'ㆍ' 문단 5개가 요약
 const h3=findPara(/^3\.\s*미팅가망/);
 if(h3&&fill.items){
  let all=paras().filter(p=>p.start>h3.start&&p.level===h3.level);
  const firstSum=all.findIndex(p=>/^ㆍ/.test(p.text));
  let list=firstSum>=0?all.slice(0,firstSum):all;
  while(list.length&&list[list.length-1].text==='')list.pop();
  const itemProto=list.find(p=>/^\d+\.\s/.test(p.text))||list[0],noteProto=list.find(p=>p.text&&!/^\d+\.\s/.test(p.text))||itemProto;
  if(itemProto){
   const made=[];fill.items.forEach((it,ix)=>{const a=hwpCloneParagraph(records,itemProto);made.push({recs:a,text:`${ix+1}. ${it.text}`});if(it.note){const b=hwpCloneParagraph(records,noteProto);made.push({recs:b,text:it.note});}});
   if(!made.length){const a=hwpCloneParagraph(records,itemProto);made.push({recs:a,text:'해당 기간 실제 미팅 없음'});}
   const from=list[0].start,to=list[list.length-1].end,fresh=made.flatMap(m=>m.recs);
   records.splice(from,to-from,...fresh);
   // 새로 넣은 문단들에 글 넣기
   let cursor=from;made.forEach(m=>{const p=paras().find(p=>p.start===cursor);hwpSetParaText(records,p,m.text);cursor=paras().find(p=>p.start===cursor).end;});
  }
 }
 if(h3&&fill.summary){const sums=paras().filter(p=>p.start>h3.start&&/^ㆍ/.test(p.text));fill.summary.forEach((t,ix)=>{if(sums[ix])hwpSetParaText(records,sums[ix],t);});}
 hwpFixListCounts(records);
 const body=hwpPack(records);
 const out=cfbWrite(doc,{'BodyText/Section0':compressed?await hwpCompress(body):body,'PrvText':hwpEncode(fill.preview||'')});
 return out;
}
