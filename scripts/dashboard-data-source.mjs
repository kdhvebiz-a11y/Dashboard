// Read-only: current full reporting ranges and legacy year ledgers are separate sources.
export const CURRENT_ENDPOINT='https://script.google.com/macros/s/AKfycbzHukN_HIc7iguhO8ujKhJUO4NaPUOSkc2p3RyLe-Emq_UpH9uOOr-xGWZqHwEUkxYM/exec';
export const YEAR_ENDPOINT='https://script.google.com/macros/s/AKfycby7LAZQTCtyReniF7IJtEkXo7LvSVRtvKzAJ4tvUKy5y_pFfNmJcw6UktI1trYFIuS9/exec';
async function get(url,fresh){
 const r=await fetch(url+'?data=1'+(fresh?'&fresh=1':''),{signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error('Google data request failed: '+r.status);
 const d=await r.json();if(d.error)throw new Error(d.error);return d;
}
export async function readDashboardPayload(fresh=false){
 const [current,legacy,weekly]=await Promise.allSettled([get(CURRENT_ENDPOINT,true),get(YEAR_ENDPOINT,fresh),fetch(CURRENT_ENDPOINT+'?weekly=1',{signal:AbortSignal.timeout(60000)}).then(async r=>{if(!r.ok)throw Error('주간 미팅 연결: '+r.status);const d=await r.json();if(!Array.isArray(d.sheets))throw Error('주간 미팅 연결 기능이 필요합니다.');return d;})]);
 if(current.status!=='fulfilled')throw current.reason;
 const d=current.value;
 d.weeklyMeetings=weekly.status==='fulfilled'?weekly.value:{sheets:[],errors:['주간 미팅 원본 연결 실패: '+weekly.reason.message]};
 if(!Array.isArray(d.tongye)||!Array.isArray(d.mal)||!d.tongye[193]?.[29])throw new Error('통계 전체 집계 범위를 읽지 못했습니다. 이전 축소 데이터로 대체하지 않습니다.');
 const warnings=[];
 if(legacy.status==='fulfilled')d.yearSheets=legacy.value.yearSheets;
 else warnings.push('연도별 원장 연결 실패: 현재 통계·말 시트만 표시합니다.');
 d.provenance={reportEndpoint:CURRENT_ENDPOINT,reportAt:d.at,yearEndpoint:YEAR_ENDPOINT,yearAt:legacy.status==='fulfilled'?legacy.value.at:null,warnings};
 return d;
}
