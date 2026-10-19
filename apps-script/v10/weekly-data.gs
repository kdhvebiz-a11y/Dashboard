/* Read only the requested weekly meeting summaries; never customer rows. */
function collectWeeklyMeetingDataV10() {
  var id = '1DkUE6SYR9uyS3TGzlRTq28yuGluYpnuF2yuyCt_2lx8';
  var result = { at: new Date().toISOString(), spreadsheetId: id, sheets: [], errors: [] };
  try {
    var ss = SpreadsheetApp.openById(id);
    ss.getSheets().forEach(function(sh) {
      var m = sh.getName().match(/^(\d{2})\.(\d{2})$/);
      if (!m || Number(m[1]) < 25 || Number(m[2]) < 1 || Number(m[2]) > 12) return;
      try {
        result.sheets.push({ sheet: sh.getName(), gid: sh.getSheetId(), year: 2000 + Number(m[1]), month: Number(m[2]), rows: sh.getRange('J1:Q8').getDisplayValues() });
      } catch (e) { result.errors.push(sh.getName() + ': ' + e.message); }
    });
  } catch (e) { result.errors.push(String(e.message || e)); }
  return result;
}
