/* Source differences are visible, never silently adjusted to make totals agree. */
function v10SourceChecks(ms){
 if(DB.rawYear||v10Scoped())return [];
 const sum=sumFor(ms),q=inqFor(ms),a=v10Aggregate(ms),owners=malOwnersFor(ms);
 const months=DB.months.filter(r=>ms.includes(r.m));
 const checks=[];
 const add=(metric,sourceA,valueA,sourceB,valueB)=>checks.push({metric,sourceA,valueA,sourceB,valueB,difference:valueA-valueB});
 if(sum){add('전체 문의','통계 AB194:AO194',sum.inq,'말 BS:BW 요약',q.total);add('전체 사업 문의','통계 195행',sum.pwr,'말 BZ:CA 요약',q.pwr);add('문의월 미팅','통계 204행',sum.mt,'날짜 확인 원장',a.cohort);}
 add('실제 미팅 담당자','말 BB 월 합계',a.actual,'말 담당자별 합계',v10Sum(owners,'n'));
 add('미팅 용량 구간','말 BB 월 합계',a.actual,'말 AZ:BG 용량 구간',months.reduce((s,m)=>s+(m.buckets||[]).reduce((t,b)=>t+(b.n||0),0),0));
 add('활동월 원장','말 BB 월 합계',a.actual,'동일 보고 주차 원장',a.exeRows.length);
 return checks;
}
function v10SourceAudit(){
 const rows=v10SourceChecks(selMonths()),different=rows.filter(r=>r.difference!==0);
 const warnings=V10.payload?.provenance?.warnings||[];
 if(!rows.length&&!warnings.length)return '';
 return `<details class="easy-details source-audit"><summary>원본 대조 · ${different.length?'확인 필요 '+different.length+'항목':'집계 일치'}</summary><p class="v10-note">전체 문의·전체 사업 문의는 통계 AB:AO, 실제 활동은 말 AY:BK 보고표를 우선합니다. 월별 미팅은 보고 주차 전체를 집계합니다. 앞뒤 달 날짜도 해당 월의 보고 주차에 속하면 그 월 실적입니다. 원본은 변경하지 않았습니다.</p>${warnings.map(w=>`<p>${esc(w)}</p>`).join('')}${v10Table(['확인 항목','보고 기준','건수','대조 기준','건수','차이'],rows.map(r=>[esc(r.metric),esc(r.sourceA),i(r.valueA),esc(r.sourceB),i(r.valueB),r.difference?i(r.difference)+'건':'일치']))}<p class="v10-note">차이가 있는 분류의 합계를 전체 KPI로 대체하거나 누락 건을 임의 배분하지 않습니다.</p></details>`;
}
