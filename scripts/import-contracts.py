#!/usr/bin/env python3
"""RPS 계약 엑셀 → apps-script/v10/contracts-data.json (+ GitHub 비밀값용 gzip/base64).

사용: python scripts/import-contracts.py [엑셀 경로 …]
      경로를 주지 않으면 저장소 루트에서 `YYYY년_RPS프로젝트_YYYY-MM-DD.xlsx`를 찾아
      연도별로 파일명 날짜가 가장 늦은 것(같으면 수정 시각이 늦은 것) 하나만 읽는다.

출력: apps-script/v10/contracts-data.json            (빌드 입력, git 제외)
      apps-script/v10/contracts-data.gzip.b64         (GitHub 비밀값 CONTRACT_DATA_GZIP_BASE64 값, git 제외)

원본 엑셀은 읽기만 한다. 사업별 상세 시트(이름이 "(A)"~"(Z)"로 끝나는 시트)의 O열 발전소명이 있는 행을 계약 원장으로 가져오고,
요약표(상태분류·정리base)는 대조·목표 용도로만 읽는다.
"""
import base64, gzip, hashlib, json, re, sys
from datetime import datetime, timezone, date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit('openpyxl 이 필요합니다: pip install openpyxl')

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / 'apps-script/v10/contracts-data.json'
OUT_B64 = ROOT / 'apps-script/v10/contracts-data.gzip.b64'
NAME_RX = re.compile(r'^(\d{4})년_RPS프로젝트_(\d{4}-\d{2}-\d{2})\.xlsx$')
DETAIL_RX = re.compile(r'\(([A-Z])\)\s*$')


def pick_files(paths):
    """연도별 최신 파일 하나씩."""
    chosen = {}
    for p in paths:
        m = NAME_RX.match(p.name)
        if not m:
            continue
        year, fdate = int(m.group(1)), m.group(2)
        key = (fdate, p.stat().st_mtime)
        if year not in chosen or key > chosen[year][0]:
            chosen[year] = (key, p)
    return [(year, v[1]) for year, v in sorted(chosen.items())]


def text(v):
    return '' if v is None else str(v).strip()


def num(v):
    if v is None or v == '':
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r'[^0-9.\-]', '', str(v))
    try:
        return float(s) if s not in ('', '-', '.') else None
    except ValueError:
        return None


def parse_date(v):
    """F열 계약일 → ISO 날짜. 못 읽으면 None."""
    if v is None or v == '':
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    m = re.match(r'^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})', s)
    if not m:
        return None
    y, mo, d = (int(x) for x in m.groups())
    if y < 100:
        y += 2000
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def read_rows(ws, year, fname, records, issues):
    """한 상세 시트의 계약 행을 읽는다. 열: B NO, C 유입유형, D 설치유형, F 계약일, G 월, I 용량, J 금액(VAT 제외),
    M 컨설팅, N 담당자, O 발전소명, Q 지역, R 설치장소, S 시공사, T 상담번호, U 유입, Y 상태."""
    sheet = ws.title
    business = DETAIL_RX.sub('', sheet).strip()
    for row_no, row in enumerate(ws.iter_rows(min_row=3, max_col=25, values_only=True), start=3):
        col = lambda letter: row[ord(letter) - ord('A')] if ord(letter) - ord('A') < len(row) else None
        rid = f'{year}:{sheet}:{row_no}'
        plant = text(col('O'))
        # 발전소명이 비어 있어도 용량·월이 적힌 행은 계약 행이다(정리base 집계와 맞추기 위해). 완전히 빈 행만 건너뛴다.
        if not plant and not (num(col('I')) and num(col('G'))):
            continue
        if not plant:
            plant = '(발전소명 미기재)'
            issues.append({'id': rid, 'message': '발전소명 미기재', 'value': f'{sheet} {row_no}행'})
        raw_date = col('F')
        iso = parse_date(raw_date)
        if iso is None and text(raw_date):
            issues.append({'id': rid, 'message': '계약일 형식 확인', 'value': text(raw_date)})
        month = num(col('G'))
        status = text(col('Y')) or '미기재'
        category = re.sub(r'\s*\(.*?\)\s*', '', text(col('C'))).strip() or '미분류'
        records.append({
            'id': rid, 'file': fname, 'sheet': sheet, 'row': row_no, 'reportYear': year,
            'reportMonth': int(month) if month else None,
            'date': iso, 'dateRaw': text(raw_date) if raw_date is not None else '',
            'business': business, 'installation': text(col('D')), 'category': category,
            'capacity': num(col('I')), 'amount': num(col('J')),
            'consultant': text(col('M')), 'owner': text(col('N')), 'plant': plant,
            'region': text(col('Q')), 'address': text(col('R')), 'corporation': text(col('S')),
            'inquiryNo': text(col('T')), 'source': text(col('U')) or '미분류', 'status': status,
            'cancelled': bool(re.search(r'취소|해지', status)),
        })


def find_row(ws, label, col_index=3, max_row=120):
    """D열(기본) 라벨이 label 로 시작하는 첫 행의 값 목록."""
    for row in ws.iter_rows(min_row=1, max_row=max_row, values_only=True):
        if col_index < len(row) and text(row[col_index]).startswith(label):
            return row
    return None


def read_summary(wb, year):
    """정리base: 목표·월별 집계, 상태분류: 전체 합계(건수·용량·금액)."""
    goals, monthly, control = {}, [], {'count': None, 'capacity': None, 'amount': None}
    if '정리base' in wb.sheetnames:
        ws = wb['정리base']
        row = find_row(ws, '목표용량')
        if row:
            goals['전체'] = [num(x) or 0 for x in row[4:16]]
            # 바로 아래 세 줄이 직영·외주·입찰 목표
            rows = list(ws.iter_rows(min_row=1, max_row=120, values_only=True))
            idx = next(i for i, r in enumerate(rows) if len(r) > 3 and text(r[3]).startswith('목표용량'))
            for r in rows[idx + 1: idx + 4]:
                name = text(r[3])
                if name in ('직영', '외주', '입찰'):
                    goals[name] = [num(x) or 0 for x in r[4:16]]
        cap = find_row(ws, '계약용량(kW)')
        cnt = find_row(ws, '계약건수(ea)')
        if cap and cnt:
            monthly = [{'month': m + 1, 'capacity': num(cap[4 + m]) or 0, 'count': num(cnt[4 + m]) or 0} for m in range(12)]
    if '상태분류' in wb.sheetnames:
        ws = wb['상태분류']
        for row in ws.iter_rows(min_row=1, max_row=40, values_only=True):
            if len(row) > 4 and text(row[1]) == '합계':
                control = {'count': num(row[2]), 'capacity': num(row[3]), 'amount': num(row[4])}
                break
    return goals, monthly, control


def import_files(files):
    records, issues, sources = [], [], []
    for year, path in files:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        before = len(records)
        for name in wb.sheetnames:
            if DETAIL_RX.search(name):
                read_rows(wb[name], year, path.name, records, issues)
        goals, monthly, control = read_summary(wb, year)
        mine = records[before:]
        sources.append({
            'name': path.name, 'reportYear': year, 'filenameDate': NAME_RX.match(path.name).group(2),
            'modifiedAt': datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'rows': len(mine), 'control': control,
            'detailCapacity': sum(r['capacity'] or 0 for r in mine if not r['cancelled']),
            'detailAmount': sum(r['amount'] or 0 for r in mine if not r['cancelled']),
            'goals': goals, 'monthlyControl': monthly,
        })
        wb.close()
    return {'schema': 1, 'importedAt': datetime.now(timezone.utc).isoformat(), 'sources': sources, 'records': records, 'issues': issues}


def main(argv):
    paths = [Path(a) for a in argv] if argv else list(ROOT.glob('*.xlsx'))
    files = pick_files(paths)
    if not files:
        sys.exit('RPS 계약 엑셀(YYYY년_RPS프로젝트_YYYY-MM-DD.xlsx)을 찾지 못했습니다.')
    data = import_files(files)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    b64 = base64.b64encode(gzip.compress(raw, 9)).decode('ascii')
    OUT_B64.write_text(b64, encoding='ascii')
    for s in data['sources']:
        c = s['control']
        print(f"{s['name']}: 상세 {s['rows']}행 · 용량 {s['detailCapacity']:,.3f} kW (요약 {c['capacity'] or 0:,.3f}) · "
              f"금액 {s['detailAmount']:,.0f} (요약 {c['amount'] or 0:,.0f}) · 요약 건수 {c['count']}")
    print(f"날짜 오류 {len(data['issues'])}건 · JSON {OUT_JSON.stat().st_size:,} bytes · 비밀값 {len(b64):,} chars "
          f"({'OK' if len(b64) < 48000 else '48KB 초과 — GitHub 비밀값 한도'})")


if __name__ == '__main__':
    main(sys.argv[1:])
