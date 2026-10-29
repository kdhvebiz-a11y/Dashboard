// 계약 자료 암호화/복호화 (AES-256-GCM).
// 2026-10-29: GitHub 비밀값에 24KB짜리 gzip/base64를 넣으면 저장 과정에서 값이 바뀌어("incorrect data check")
// 배포가 계속 실패했다. 그래서 자료 본문은 암호화한 파일(apps-script/v10/contracts-data.enc)로 저장소에 두고,
// 비밀값에는 64자 열쇠(CONTRACT_DATA_KEY)만 둔다. 공개 저장소에는 암호문만 올라가므로 고객 정보는 보이지 않는다.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync,existsSync} from 'node:fs';

export const ENC_MAGIC='GSENC1';
const keyFile=new URL('../.codex-work/contract-key.txt',import.meta.url);

/** 열쇠: 환경변수 CONTRACT_DATA_KEY(64자 hex) → 없으면 .codex-work/contract-key.txt(git 제외). */
export function loadKey(){
 const raw=(process.env.CONTRACT_DATA_KEY||(existsSync(keyFile)?readFileSync(keyFile,'utf8'):'')).trim();
 if(!raw)return null;
 if(!/^[0-9a-fA-F]{64}$/.test(raw))throw new Error('CONTRACT_DATA_KEY must be 64 hex characters (got '+raw.length+')');
 return Buffer.from(raw,'hex');
}
export const newKeyHex=()=>randomBytes(32).toString('hex');

/** JSON 문자열 → gzip → AES-256-GCM → 텍스트(GSENC1 머리글 + base64, 76자 줄바꿈). */
export function encryptContracts(jsonText,key){
 const iv=randomBytes(12);
 const c=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([c.update(gzipSync(Buffer.from(jsonText,'utf8'),{level:9})),c.final()]);
 const b64=Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');
 return ENC_MAGIC+'\n'+(b64.match(/.{1,76}/g)||[]).join('\n')+'\n';
}
export function decryptContracts(text,key){
 const lines=text.replace(/\r/g,'').trim().split('\n');
 if(lines.shift()!==ENC_MAGIC)throw new Error('contracts-data.enc: unknown format');
 const buf=Buffer.from(lines.join(''),'base64');
 const d=createDecipheriv('aes-256-gcm',key,buf.subarray(0,12));
 d.setAuthTag(buf.subarray(12,28));
 const plain=Buffer.concat([d.update(buf.subarray(28)),d.final()]);
 return gunzipSync(plain).toString('utf8');
}
