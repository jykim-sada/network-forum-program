# DESIGN.md — 네트워크 포럼 발표보드 디자인 토큰

출처: `appsscript/Screen.html`·`Admin.html`·`Recorder.html`·`Phone.html`의 `:root` 토큰에서 추출(2026-10-06). 가정: 아래 값은 코드에 이미 있는 값을 그대로 옮긴 것이며, 새 토큰은 이 파일에 먼저 적고 쓴다.

## 색
| 토큰 | 값 | 용도 |
|---|---|---|
| `--gg` | #0E4194 | 경기도 CI 파랑. 버튼·제목·칩 |
| `--gg-l` | #1B5AAE | 스크린 그라데이션 밝은 끝 |
| `--gg-d` | #072448 | 스크린 바탕(어두운 끝) |
| `--gg-green` | #299738 | 경기도 CI 초록(보조) |
| `--hc-teal` / `--teal` | #00A496 | 행복캠퍼스 청록. 주제 1 |
| `--hc-lime` / `--lime` | #ABCD03 | 행복캠퍼스 라임. 주제 2 |
| `--hc-orange` / `--orange` | #F39800 | 행복캠퍼스 주황. 주제 3 |
| `--hc-deep` / `--deep` | #ED6100 | 진한 주황. 주제 4, 강조 버튼 |
| `--hc-yellow` | #EDC300 | 보조 노랑 |
| `--teal-b` `--lime-b` `--orange-b` `--yellow-b` `--green-b` | #4FD8C8 #CBE84F #FFB43F #FFDE4D #57D07A | 어두운 스크린 위 밝은 변형(제목·강조) |
| `--txt` | #F4F7FC | 스크린 본문 글자 |
| `--mut` / `--mut-2` | #A8BFE2 / #7D97C2 | 스크린 보조 글자 |
| `--bg` | #F1F4F9 | 밝은 화면(콘솔·기록자·폰) 바탕 |
| `--ink` | #0f172a (콘솔) · #161C26 (기록자·폰) | 밝은 화면 글자 |
| `--muted` | #5F6979 | 밝은 화면 보조 글자 |
| `--line` | #DEE4EE | 테두리 |
| `--card` | #FFFFFF | 카드 |
| `--soft` | #EEF2F8 | 연한 칸 바탕 |
| `--ok` | #00786E | 완료 상태 |
| `--gold` / `--gold-bg` | #B86E00 / #FFF6E9 | 주의 상태 |
| 오류 | #B23A2E | 실패·삭제 |
| 진행 상태(신규) | wait = `--soft`+`--muted`, draft = `--gold-bg`+`--gold`, done = `--done-bg`(#E0F5F2)+`--ok` | 테이블 현황·진행 현황 패널 |
| `--paper` / `--rule` / `--mut-2` | #FFFDF7 / #E3E8F0 / #8A93A2 | 참가자 페이지 종이 질감 카드·괘선·흐린 보조 글자(v2부터 사용) |
| 참가자 placeholder / 완료 테두리 | #AEB6C4 / #9ADBD3 | 참가자 페이지 입력 안내 글자·작성 완료 상자 테두리(v2부터 사용) |
| 묶음 색(차트) | #4FD8C8 #CBE84F #FFB43F #FFDE4D #FF9250 #57D07A #A8BFE2 | 오늘의 한줄 묶음 도넛·막대 7색(Common GROUP_COLORS, v2부터 사용) |
| QR 실패 안내 | #333 | QR 라이브러리 실패 시 흰 상자 안 글자 |

## 글꼴
- 스크린·기록자·폰·안내: `"GyeonggiTitle","Malgun Gothic","맑은 고딕",system-ui,sans-serif` (경기천년제목, jsdelivr 웹폰트, 실패 시 맑은 고딕)
- 콘솔: `"IBM Plex Sans KR","Malgun Gothic","맑은 고딕",system-ui,sans-serif` (Google Fonts)
- 스크린 크기: 제목 `clamp(34px,4.6vw,56px)`, 한 문장 `clamp(30px,4.4vw,56px)`, 본문 `clamp(19px,2.3vw,28px)`, 타이머 `clamp(70px,13vw,170px)`
- 숫자는 `font-variant-numeric: tabular-nums`

## 간격·모양
- 카드 radius 8px, 칩 radius .4em, 버튼 radius 6px(콘솔) / 24px(폰 보내기)
- 스크린 본문 패딩 `clamp(16px,2.6vh,36px) clamp(26px,4vw,64px)`
- 상단 브랜드 밴드: 흰 바탕 + 로고 2개 + 청록·라임·주황 삼색 띠(`.tri`)

## 모션
- 작성 완료가 새로 생긴 테이블 칸은 donepop 1.2s(살짝 커졌다 돌아오며 노란 테두리가 퍼짐, 한 번만). 패널 전환·강조 페이드 ≤ 300ms, 새 글 pop 500ms, 막대 채우기 900ms, 새 글 강조 flash 1.2s와 흐르는 벽 줄 배경 전환 1.5s(한 번만 일어나는 색 전환, 레이아웃 이동 없음). `prefers-reduced-motion: reduce`이면 모두 0ms이고 흐르는 벽도 멈춘다.

## 금지
- 토큰 밖의 보라·파랑 그라데이션, 장식용 이모지 제목, 토큰 우회 HEX(위 표 밖), AI를 언급하는 자기참조 문구("AI가 생성한…" 등은 분석 엔진 표시에만 허용).
