# 네트워크 포럼 운영 프로그램

「경기도 중장년 네트워크 포럼」(2026. 10. 28. 수, 고양 한양문고) 현장에서 스크린 · 운영진 콘솔 · 기록자 · 참가자 화면을 하나로 묶어 돌리는 프로그램입니다. 서버는 Google Apps Script + Google Sheets, 정적 자료는 Vercel 에 올립니다.

## 폴더

| 폴더 · 파일 | 내용 |
|---|---|
| `appsscript/` | Apps Script 소스. `Code.gs`(서버) · `Common.html`(공통 JS · 로컬 MOCK) · `Screen` `Admin` `Recorder` `Phone` `Start` `Print`.html(화면) · `build_local_preview.ps1`(로컬 미리보기 빌드) |
| `deploy_vercel/` | Vercel 에 올라가는 정적 파일. `index.html` 스토리보드 · `sim/` 시뮬레이션 · `storyboard.pdf` · `vercel.json`(짧은 주소 → Apps Script 연결) |
| `조편성/` | 테이블 조편성 보조 도구(별도 Apps Script) |
| `logo/` | 경기도 · 행복캠퍼스 로고 |
| `설치_운영_가이드_20261006_v3.md` | 설치 · 당일 운영 · 문제 해결 안내 |
| `배포정보_20261006_v3.md` | 배포 번호별 변경 내역 |
| `DESIGN.md` | 색 · 글꼴 · 상태 토큰 |
| `스크린_스토리보드.html` `.pdf` | 스크린 화면 44컷 스토리보드 |
| `네트워크_포럼_운영프로그램_시뮬레이션.html` | 서버 없이 브라우저에서 도는 전체 시뮬레이션 |

## 주소

- 실제 프로그램(Apps Script): 콘솔 `…/exec?page=admin`, 스크린 `?page=screen`, 기록자 `?page=recorder&no=N`, 참가자 `?page=phone&t=N`, 인쇄 `?page=print`
- Vercel: https://gg-forum-screen.vercel.app (스토리보드) · `/sim` (시뮬레이션) · `/storyboard.pdf` · `/admin` `/screen` `/recorder` `/phone` `/print` 는 실제 프로그램으로 넘어가는 짧은 주소

## 배포

`배포.ps1` 한 번으로 Apps Script 와 Vercel 에 함께 올라가고 GitHub 에 커밋 · 푸시됩니다.

```powershell
.\배포.ps1 -Message "바꾼 내용 한 줄"
```

- Apps Script: `clasp push -f` → `clasp deploy -i <배포ID> -d "설명"` (배포 ID 는 `배포정보_20261006_v3.md`)
- Vercel: `deploy_vercel` 안에서 `vercel.cmd deploy --prod --yes`
- 로컬 미리보기 · 시뮬레이션 재생성: `appsscript\build_local_preview.ps1` → 시뮬레이션은 세션 스크립트(build_onepage.js)로 다시 만듭니다

## 주의

- 콘솔 PIN 은 스크립트 속성 `ADMIN_PIN` 으로 바꿀 수 있습니다(기본값은 코드에 있으니 저장소는 비공개로 둡니다).
- AI 분석 키(`ANTHROPIC_API_KEY`)와 clasp 자격 증명은 저장소에 넣지 않습니다.
