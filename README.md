# 에너지사업부 대시보드

컨설팅 / 필드 / 외주 / 입찰 선택 탭과 컨설팅 대시보드 소스입니다.

## 작업 위치

이 저장소의 `apps-script/v10/`에서 화면과 Apps Script 소스를 관리합니다.
GitHub Desktop의 Changes → Commit → Push origin으로 소스 변경을 올립니다.
`main` 브랜치에 Push하면 GitHub Actions의 **Deploy dashboard**가 빌드 → 테스트 → 기존 Apps Script 배포 갱신 → 상태 확인을 실행합니다. 실패한 실행은 Actions에서 확인합니다.

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

이 폴더에는 미리보기용 생성 결과를 로컬로만 보관합니다. 인증 설정은 복사하지 않았으므로 로컬 재빌드 전에 기존 인증 설정을 안전하게 준비해야 합니다. GitHub에서 새로 받은 복사본에는 원본 데이터와 생성 결과가 없습니다. GitHub Actions 빌드는 암호화된 Secrets에서 계약 자료와 기존 관리자 인증 해시를 읽습니다. 관리자 접속 코드를 새로 생성하지 않습니다.

## 주간 조회

- 문의: 통계 시트 AB~AH, 월요일~금요일
- 미팅: 월별 시트 J~O, 금요일~목요일
- ISO 연간 주차 사용 (2026년 53주)
- 원본 미입력 값은 0이 아닌 —로 표시
- 문의 과거 주차는 원본에 확인된 자료만 표시

## 업로드 주의

인증정보, 개인별 접속 코드, 고객 원장, 계약 데이터, 백업은 커밋하지 않습니다.
생성 결과를 강제 추가하는 `git add -f`는 사용하지 마세요.
## 자동 배포 설정

저장소 Settings → Secrets and variables → Actions에서 다음 Repository secrets를 사용합니다.

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: 기존 Google 배포 인증
- `CONTRACT_DATA_GZIP_BASE64`: 계약 JSON을 gzip 후 Base64로 인코딩한 비공개 빌드 입력
- `FOLLOWUP_ADMIN_HASH`: 기존 관리자 인증 해시

계약 원본 스냅샷을 교체한 경우 해당 Secret도 갱신해야 합니다. 스프레드시트 실시간 조회 데이터와 별개입니다.
Secrets, 생성 HTML/서버, 백업을 빌드 로그나 Actions artifact로 올리지 않습니다.
외부 PR에서는 배포하지 않으며 main push 및 main 수동 실행만 허용합니다.

### 배포 보존·복구

기존 배포 ID/URL, manifest와 공유 설정을 유지합니다. `index`와 `대시보드` 두 파일만 새 버전에 반영하고 다른 파일은 이전 배포본을 유지합니다.
Apps Script 편집기에 남아 있는 미배포 변경은 버전 생성 뒤 복원합니다. 따라서 자동 배포의 소스 기준은 GitHub이며 편집기의 HEAD는 최신 배포와 다를 수 있습니다.
테스트 실패 시 배포하지 않으며, 배포 후 상태 확인 실패 시 직전 배포 버전으로 되돌립니다. 동시에 편집기나 배포가 변경되면 덮어쓰지 않고 중단합니다.
실제 사이트는 기존 주소를 새로고침하면 확인할 수 있습니다. 주소의 `?v=45` 같은 쿼리는 Apps Script 배포 버전을 고정하지 않습니다.
