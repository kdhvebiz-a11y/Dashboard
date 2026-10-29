// apps-script/v10/contracts-data.json(git 제외) → apps-script/v10/contracts-data.enc(저장소에 올리는 암호문).
// 사용: node scripts/encrypt-contracts.mjs            (열쇠: CONTRACT_DATA_KEY 또는 .codex-work/contract-key.txt)
//       node scripts/encrypt-contracts.mjs --new-key  (열쇠가 없을 때 새로 만들어 .codex-work/contract-key.txt에 저장)
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadKey,newKeyHex,encryptContracts,decryptContracts} from './contract-crypto.mjs';
const base=new URL('../apps-script/v10/',import.meta.url);
let key=loadKey();
if(!key){
 if(!process.argv.includes('--new-key'))throw new Error('열쇠가 없습니다. CONTRACT_DATA_KEY를 주거나 --new-key로 만드세요.');
 const hex=newKeyHex();mkdirSync(new URL('../.codex-work/',import.meta.url),{recursive:true});
 writeFileSync(new URL('../.codex-work/contract-key.txt',import.meta.url),hex+'\n');
 console.log('새 열쇠를 .codex-work/contract-key.txt에 저장했습니다. GitHub 비밀값 CONTRACT_DATA_KEY에 같은 값을 넣으세요.');
 key=Buffer.from(hex,'hex');
}
const json=readFileSync(new URL('contracts-data.json',base),'utf8');
const parsed=JSON.parse(json);
if(!Array.isArray(parsed.sources))throw new Error('contracts-data.json이 올바르지 않습니다');
const enc=encryptContracts(JSON.stringify(parsed),key);
if(JSON.parse(decryptContracts(enc,key)).records.length!==parsed.records.length)throw new Error('복호화 검증 실패');
writeFileSync(new URL('contracts-data.enc',base),enc);
console.log('contracts-data.enc 작성: '+enc.length.toLocaleString()+' chars · 계약 '+parsed.records.length+'행 · 출처 '+parsed.sources.map(s=>s.name).join('/'));
