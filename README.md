# 에너지사업부 대시보드

컨설팅 / 필드 / 외주 / 입찰 선택 탭과 컨설팅 대시보드 소스입니다.

## 작업 위치

이 저장소의 `apps-script/v10/`에서 화면과 Apps Script 소스를 관리합니다.
GitHub Desktop의 Changes → Commit → Push origin으로 소스 변경을 올립니다.
GitHub 업로드만으로 Apps Script 웹앱이 배포되지는 않습니다.

## 로컬 미리보기

Node.js가 설치된 환경에서 저장소 폴더를 터미널로 열고 실행합니다.

```sh
node scripts/preview-dashboard-v10.mjs
```

주소: http://127.0.0.1:4176/
이 포트에 기존 미리보기가 실행 중이면 중복 실행하지 마세요.

## 빌드 및 비공개 파일

```sh
node scripts/build-dashboard-v10.mjs
node --test tests/weekly.test.mjs tests/dashboard-v10.test.mjs tests/sales-meeting.test.mjs tests/presentation-comments-ui.test.mjs
```

빌드에는 다음 로컬 전용 자료가 필요하며 GitHub에는 포함하지 않습니다.

- `apps-script/v10/contracts-data.json`: 실제 계약 데이터
- `.codex-work/followup-access.json`: 기존 관리자 인증 설정 (임의로 재생성하지 않음)
- `apps-script/v10/index.html`: 계약 데이터가 포함된 생성 결과
- `apps-script/v10/대시보드.gs`: 인증 해시가 포함된 생성 결과

이 폴더에는 미리보기용 생성 결과를 로컬로만 보관합니다. 인증 설정은 복사하지 않았으므로 재빌드 전에 기존 인증 설정을 안전하게 준비해야 합니다. GitHub에서 새로 받은 복사본에는 원본 데이터와 생성 결과가 없습니다.

## 주간 조회

- 문의: 통계 시트 AB~AH, 월요일~금요일
- 미팅: 월별 시트 J~O, 금요일~목요일
- ISO 연간 주차 사용 (2026년 53주)
- 원본 미입력 값은 0이 아닌 —로 표시
- 문의 과거 주차는 원본에 확인된 자료만 표시

## 업로드 주의

인증정보, 개인별 접속 코드, 고객 원장, 계약 데이터, 백업은 커밋하지 않습니다.
생성 결과를 강제 추가하는 `git add -f`는 사용하지 마세요.
실제 서비스 반영은 Apps Script 배포를 별도로 확인한 뒤 진행합니다.
