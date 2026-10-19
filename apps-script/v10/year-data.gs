/* v10 additions: year discovery and a compact, read-only inquiry ledger. */
function collectYearDataV10(ss) {
  var result = {};
  ss.getSheets().forEach(function(sh) {
    var year = sh.getName();
    if (!/^20\d{2}$/.test(year) || Number(year) < 2025) return;
    var last = sh.getLastRow();
    var records = [];
    if (last >= 3) {
      var rows = sh.getRange(3, 1, last - 2, Math.min(sh.getMaxColumns(),13)).getDisplayValues();
      rows.forEach(function(v) {
        var no = String(v[0] || '').trim();
        var match = no.match(/^(?:(sp|ugs)[- ]?)?(\d{1,2})-(\d{2})\d+/i);
        // Number-only preallocated rows are not actual inquiries.
        if (!match || !v.slice(1).some(function(cell) { return String(cell || '').trim(); })) return;
        var month = Number(match[2]);
        if (month < 1 || month > 12) return;
        var day = Number(match[3]);
        var inquiryDate = day >= 1 && day <= 31 ? year+'-'+('0'+month).slice(-2)+'-'+('0'+day).slice(-2) : '';
        var dt = String(v[9] || '').match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
        var date = dt ? dt[1]+'-'+('0'+dt[2]).slice(-2)+'-'+('0'+dt[3]).slice(-2) : '';
        var status = String(v[1] || '').trim();
        var area = String(v[4] || '');
        var reg = /서울|경기|인천/.test(area)?'수도권':/충남|충북|충청|대전|세종/.test(area)?'충청권':/강원/.test(area)?'강원권':/부산|대구|울산|경남|경북|경상/.test(area)?'영남권':/광주|전남|전북|전라/.test(area)?'호남권':/제주/.test(area)?'제주':area?'기타':'미분류';
        records.push({no:no,year:Number(year),cmo:month,inquiryDate:inquiryDate,date:date,em:dt?Number(dt[2]):0,meetingYear:dt?Number(dt[1]):0,
          ct:status,src:/소개/.test(status)?'소개':status?'마케팅':'미분류',type:String(v[2]||''),reg:reg,
          prop:String(v[5]||''),cons:String(v[6]||''),own:String(v[7]||'미지정'),
          cap:parseFloat(String(v[10]||'').replace(/[^0-9.\-]/g,''))||0,
          corp:match[1]?match[1].toUpperCase():'그랜드썬'});
      });
    }
    result[year] = {records:records,source:year+' 문의 원장',sourceRule:'소개 상태는 소개, 나머지 기재 상태는 마케팅; 법인은 상담번호 접두어 기준'};
  });
  return result;
}
