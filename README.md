# 네트워크 포럼 운영 프로그램

「경기도 중장년 네트워크 포럼」(2026. 10. 28. 수, 고양 한양문고) 현장에서 스크린 · 운영진 콘솔 · 기록자 · 참가자 화면을 하나로 묶어 돌리는 프로그램입니다. 화면은 Vercel 에서 열리고, 자료 저장 · AI 분석은 Google Apps Script + Google Sheets 가 맡습니다.

## 바로 가기 (Vercel 웹앱)

| 화면 | 주소 | 누가 |
|---|---|---|
| 안내 (입구 · 참가자 QR · 모든 링크) | https://gg-forum-screen.vercel.app | 운영진 |
| 운영진 콘솔 (PIN) | https://gg-forum-screen.vercel.app/admin | 운영진 노트북 |
| 스크린 | https://gg-forum-screen.vercel.app/screen | LED 노트북 (F 키 전체화면) |
| 기록자 (N = 테이블 1~9) | https://gg-forum-screen.vercel.app/recorder?no=1 | 테이블 태블릿 9대 |
| 참가자 · 오늘의 한줄 (N = 테이블) | https://gg-forum-screen.vercel.app/phone?t=1 | 참가자 휴대폰 (QR) |
| 테이블 QR 인쇄 | https://gg-forum-screen.vercel.app/print | 행사 전 1회 |
| 스크린 자료집 (스크린 화면 그대로 한 장씩 · 영상 제외) | https://gg-forum-screen.vercel.app/digest | 행사 뒤 열람 · PDF /digest.pdf · 글판 /app/digest |
| 스크린 스토리보드 (43컷) | https://gg-forum-screen.vercel.app/storyboard | 검토용 |
| 스토리보드 PDF | https://gg-forum-screen.vercel.app/storyboard.pdf | 검토용 |
| 전체 시뮬레이션 (서버 없이 흉내) | https://gg-forum-screen.vercel.app/sim | 검토용 |

- Apps Script 주소(`https://script.google.com/macros/s/<배포ID>/exec?page=admin` 등)로 열어도 같은 화면 · 같은 자료입니다. 배포 ID 는 `배포정보_20261006_v3.md` 에 있습니다.
- 자료(한줄 · 기록 · 분석)는 구글 시트에 저장되고, 운영진 기능은 콘솔 PIN 으로 보호됩니다.

## 폴더

| 폴더 · 파일 | 내용 |
|---|---|
| `appsscript/` | Apps Script 소스. `Code.gs`(서버 · JSON API) · `Common.html`(공통 JS · 로컬 MOCK) · `Screen` `Admin` `Recorder` `Phone` `Start` `Print`.html(화면) · `build_local_preview.ps1`(로컬 미리보기) · `build_vercel_app.ps1`(Vercel 페이지 빌드) |
| `deploy_vercel/` | Vercel 에 올라가는 정적 파일. `app/`(콘솔·스크린·기록자·참가자·인쇄·안내 화면) · `storyboard.html` · `storyboard.pdf` · `sim/` · `vercel.json`(짧은 주소 → app 페이지) |
| `조편성/` | 테이블 조편성 보조 도구(별도 Apps Script) |
| `logo/` | 경기도 · 행복캠퍼스 로고 |
| `설치_운영_가이드_20261006_v3.md` | 설치 · 당일 운영 · 문제 해결 안내 |
| `배포정보_20261006_v3.md` | 배포 번호별 변경 내역 |
| `DESIGN.md` | 색 · 글꼴 · 상태 토큰 |
| `스크린_스토리보드.html` `.pdf` | 스크린 화면 42컷 스토리보드 |
| `네트워크_포럼_운영프로그램_시뮬레이션.html` | 서버 없이 브라우저에서 도는 전체 시뮬레이션 |

## 배포

`배포.ps1` 한 번으로 Apps Script → Vercel 페이지 빌드 → GitHub 푸시 순서로 올라가고, 푸시를 Vercel 이 받아 자동 배포합니다.

```powershell
.\배포.ps1 -Message "바꾼 내용 한 줄"
```

- Apps Script: `clasp push -f` → `clasp deploy -i <배포ID> -d "설명"`
- Vercel: GitHub 푸시로 자동 배포(Root Directory `deploy_vercel`). v3.15부터 PC 에서 CLI 로 올리지 않습니다 — 그 폴더에서 CLI 로 올리면 Root Directory 설정과 겹쳐 실패합니다
- 로컬 미리보기 · 시뮬레이션 재생성: `appsscript\build_local_preview.ps1` → 시뮬레이션은 세션 스크립트(build_onepage.js)로 다시 만듭니다

### GitHub 연동 자동 배포 (v3.14)

Vercel 프로젝트 gg-forum-screen 이 이 저장소에 연결되어 있습니다(Root Directory `deploy_vercel`, 운영 브랜치 main). `deploy_vercel/` 가 바뀐 커밋이 main 에 올라오면 Vercel 이 자동으로 운영 주소에 배포하고, 결과는 저장소 페이지 오른쪽 「Deployments」와 Vercel 대시보드에 남습니다.

- 배포 기록: 푸시 뒤 GitHub Actions 「Record Vercel deployment」가 Vercel 결과를 기다려 저장소 「Deployments」에 남깁니다. (v3.14 의 PC CLI 배포 + `[skip ci]` 방식은 v3.15 에서 그만둠)
- 연결 관리: Vercel 대시보드 → 프로젝트 → Settings → Git. 연결 계정은 GitHub jykim-sada.
- `.github/workflows/record-deployment.yml`: `deploy_vercel/` 가 바뀐 푸시 때 Vercel 의 커밋 상태(성공)를 기다렸다가 저장소 「Deployments」에 운영 주소를 남깁니다. 토큰·비밀값이 필요 없습니다. 저장소 Secrets 에 남아 있는 `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` 는 쓰지 않으므로 지워도 됩니다.

## 주의

- 콘솔 PIN 은 시트 메뉴 「운영진 PIN 설정」으로 바꿉니다. 저장소가 공개이므로 코드의 기본값은 쓰지 않습니다.
- AI 분석 키(`ANTHROPIC_API_KEY`)와 clasp · Vercel 자격 증명은 저장소에 넣지 않습니다.
