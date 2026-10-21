/**************************************************************
 * 경기도 중장년 네트워크 포럼 — 그룹워크 발표보드 (Google Apps Script) v3
 * 2026. 10. 28.(수) 12:30~16:00 · 고양 한양문고 (데미안홀·한강홀)
 *
 * [설치]
 *  1) 새 구글 스프레드시트 생성 → 확장 프로그램 > Apps Script
 *  2) 이 파일 내용을 Code.gs 에 붙여넣기
 *  3) Common / Start / Phone / Screen / Recorder / Admin / Print 7개 HTML 파일 추가(HTML 형식, 같은 이름)
 *  4) 저장 → 시트로 돌아가 새로고침 → 메뉴 「발표보드」 > 「① 초기 설정」 실행 (권한 승인 1회)
 *  5) 배포 > 새 배포 > 유형: 웹 앱 / 실행 계정: 나 / 액세스 권한: 모든 사용자 → 배포
 *  6) 메뉴 「발표보드」 > 「② 웹앱 주소 보기」 로 화면별 주소 확인
 *  7) (선택) 메뉴 「Claude API 키 설정」 → AI 분석 사용. 키가 없으면 규칙 기반 정리로 동작
 *
 * [주소]  <웹앱주소>?page=start    안내(모든 화면 링크·QR)
 *         <웹앱주소>?page=phone    참가자 · 오늘의 한줄 (QR용, 무기명) · &t=3 이면 3번 테이블로 기록
 *         <웹앱주소>?page=screen   스크린 (데미안홀 LED, 조작 없음)
 *         <웹앱주소>?page=recorder 기록자 (9테이블) · &no=3 이면 3번 테이블 고정
 *         <웹앱주소>?page=admin    운영진 콘솔 (PIN 필요, 기본 2026)
 *         <웹앱주소>?page=print    테이블 QR 인쇄 (A4 9장)
 *
 * [저장 위치]  「한줄」「기록」「분석」「설정」 시트. 진행 상태(단계·장표)는 스크립트 속성.
 *   v2 의 「기록」(9열) 은 처음 실행 때 「기록_구_v2」 로 이름만 바꿔 보존하고 새 「기록」(6열)을 만든다.
 *   「발표」 시트는 더 이상 쓰지 않는다(지우지도 않는다). 1부 프로그램·명단은 「설정」 시트의 program 행(JSON)에 저장한다.
 **************************************************************/

var EVENT = { name: '경기도 중장년 네트워크 포럼', date: '2026. 10. 28.(수)', time: '12:30~16:00', place: '고양 한양문고 (데미안홀·한강홀)' };
var PROMPT = '오늘 여기서 얻어 가고 싶은 것, 하나';
var TZ = 'Asia/Seoul';
var DEFAULT_PIN = '2026';
var SHEET_LINES = '한줄', SHEET_REC = '기록', SHEET_REC_OLD = '기록_구_v2', SHEET_ANA = '분석', SHEET_CONF = '설정';

/* 토론 주제·테이블 (운영계획안 10. 5. 기준) — Common.html 의 클라이언트 사본과 같게 유지 */
var TOPICS = [
  /* 운영계획안(10.12 확정) 그대로: title = 내비게이션 안내 멘트형 주제명, sub = 항목(짧은 이름), ask = 부제(참가자용 질문), q = 핵심 질문(기록지에 남길 것) */
  { id: 1, title: "목적지를 '나'로 변경합니다", sub: '돌봄과 나의 삶', ask: '내 인생을 계속 미룰 순 없잖아요?', tables: [1, 2, 3], q: '가족을 돌보는 동안 미뤄둔 나의 일과 삶은 무엇이었고, 이제 나를 위해 시작했거나 시작하고 싶은 것은 무엇이며, 그것을 가능하게 하려면 무엇이 필요한가?' },
  { id: 2, title: "경로를 '새 일상'으로 재설정합니다", sub: '일상과 관계', ask: '회사를 그만뒀지, 사람까지 그만둔 건 아니잖아요?', tables: [4, 5], q: '직장을 떠난 뒤 하루와 사람 관계는 어떻게 달라졌고, 새 일상과 새 관계를 어떻게 만들어 가고 있으며, 그 과정에서 무엇이 도움이 되고 무엇이 부족한가?' },
  { id: 3, title: "길 안내를 '나의 첫 모임'으로 시작합니다", sub: '모임의 첫걸음', ask: '모임이 나랑 맞는지는, 가 봐야 알잖아요?', tables: [6, 7], q: '모임에 처음 나가게 된 계기 혹은 망설이는 이유는 무엇이고, 나에게 맞는 모임과 맞지 않는 모임은 무엇이 달랐으며, 첫걸음을 떼는 데 필요한 것은 무엇인가?' },
  { id: 4, title: "주행 모드를 '함께 가기'로 전환합니다", sub: '연결과 확장', ask: '우리 모임이 한 걸음 더 나아가려면, 누구와 무엇을 함께해야 할까요?', tables: [8, 9], q: '우리 모임이 지금 필요로 하는 것은 무엇이고, 다른 모임이나 기관과 연결되면 무엇을 함께할 수 있으며, 그 첫 번째 공동 행동은 무엇인가?' }
];
var TT = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4 };
var PHASES = ['reg', 'part1', 'p2', 'r1', 'r2', 'collect', 'share', 'close', 'end'];   // p2 = 2부 발제·주제 안내(13:30~13:40)
var TABLE_COUNT = 9;
/* 입력 길이 상한 (클라이언트도 같은 값을 쓴다) */
var LIMIT = { line: 500, note: 6000, wish: 500, dev: 64, id: 40, program: 45000 };

/* ============================================================
 *  1부 프로그램·명단·화면 문구 (설정 시트 program 행, JSON) — Common.html 의 DEFAULT_PROGRAM 과 같게 유지
 * ========================================================== */
var DEFAULT_PROGRAM = {
  video: { title: '다시, 나는', url: '' },   // 운영 계획(안): 「다시, 나는」 — 다시 나로 살아가는 '나는'(I am), 다시 날아오르는 '나는'(I fly)
  greet: [{ name: '', title: '', kind: 'greet' }],   // kind: 'greet' 인사말 · 'cong' 축사
  speakers: [{ title: '내 나이 55세, 다시 또 다시', name: '' },
    { title: '부모도 챙겼고, 자녀도 챙겼고, 이제는 나', name: '' },
    { title: '직장은 0개, 직업은 3개', name: '' }],
  photo: { title: '경기도 중장년 네트워크 포럼', sub: '경기 중장년, 경험을 잇고 내일을 묻다', pos: 'top' },
  roster: { '1': { '1': [], '2': [] }, '2': { '1': [], '2': [] }, '3': { '1': [], '2': [] }, '4': { '1': [], '2': [] }, '5': { '1': [], '2': [] }, '6': { '1': [], '2': [] }, '7': { '1': [], '2': [] }, '8': { '1': [], '2': [] }, '9': { '1': [], '2': [] } },
  communities: [],
  facts: { title: '경기도 중장년, 지금', lead: '전국에서 가장 많은 중장년이 사는 곳, 그만큼 정책 파급효과가 큰 곳입니다.',
    items: [{ v: '557만 명', k: '경기도 중장년 인구', s: '전국에서 가장 많습니다' }, { v: '41%', k: '도 전체 인구 중 비중', s: '' },
      { v: '28%', k: '전국 중장년 중 경기도', s: '정책 파급효과가 큽니다' }, { v: '52.9세', k: '주된 일자리 퇴직 평균', s: '이후 소득 공백' },
      { v: '73%', k: '돌봄 부담', s: '' }, { v: '61.8%', k: '고독사 위험', s: '' }, { v: '41%', k: '1인 가구 급증', s: '' }],
    foot: '복합적인 생애전환기 위기에 직면해 있습니다.' },
  live: { panels: ['status', 'roster', 'facts', 'trend'], sec: 20, pin: '' },
  cloud: { style: 'a', frame: 'word' },   // 결과공유 마지막 「포럼의 키워드」: style a(기울임)·b(수평)·c(칩), frame none·area·word·both (v3.11)
  trends: { src: '트렌드 코리아 2027', collect: true, sec: 12, items: [
    { k: '바이브세션', s: '수출과 성장률은 역대급인데 장사와 살림은 팍팍하다. 지표와 체감의 간극이 2027년을 읽는 출발점.' },
    { k: '권태 사회', s: '볼 것, 먹을 것, 할 것이 넘치는데 「재밌는 일 없나」. 자극이 많아서 생기는 권태.' },
    { k: '하프 시그널', s: 'X세대가 맞는 갱년기는 예전과 다르다. 직장 안의 갱년기, 자녀의 사춘기와 겹치는 갱년기.' },
    { k: '휴먼 엣지', s: 'AI가 결과물을 쉽게 만들수록 사람의 판단과 수고가 차별적 가치가 된다.' },
    { k: '해봄 경제', s: 'AI가 시도의 비용을 낮췄다. 돈과 사람이 필요하던 일도 혼자 「일단 해본다」.' },
    { k: '안목', s: '같은 것을 보고 다르게 가치를 찾는 눈. 취향을 넘어 자본이 되는 안목은 공부와 경험으로 쌓인다.' }] },
  close: { title: '혼자의 경험을 넘어, 함께의 연결로', text: '' }
};
var LIVE_PANELS = ['status', 'roster', 'facts', 'trend'];   // 'lines'(오늘의 한줄)는 v3.3 삭제, 'trend' 는 v3.4 추가, 'map'(테이블 지도)은 v3.8 에서 진행 현황에 합침 — 저장값의 'map' 은 status 로 본다
var GREET_KINDS = ['greet', 'cong'];
var LEGACY_PHOTO_TITLE = '중장년 네트워크 포럼', LEGACY_CLOSE_TEXT = '오늘 나온 이야기는 PDF로 정리해 경기도 정책 기초자료로 전달합니다.\n16:00 폐회';   // v3.2 까지의 기본 문구 → 새 기본값으로
var PHOTO_POS = ['top', 'middle', 'bottom'];

/* ---- 입력 검증 보조 ---- */
function isInt_(n, lo, hi) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi; }
function str_(v, max, def) { if (v == null) return def == null ? '' : def; v = String(v); return v.length > max ? v.slice(0, max) : v; }
function isObj_(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

/* 저장 전 정규화: 없는 키는 기본값, 문자열 길이·배열 길이 상한, pos/panels/pin 허용값 검사 */
function normalizeProgram_(p) {
  p = isObj_(p) ? p : {};
  var D = DEFAULT_PROGRAM, o = {};
  var v = isObj_(p.video) ? p.video : {};
  o.video = { title: str_(v.title, 80, D.video.title), url: str_(v.url, 500, '').trim() };
  o.greet = (Array.isArray(p.greet) ? p.greet : D.greet).slice(0, 8).map(function (g, i) { g = isObj_(g) ? g : {}; return { name: str_(g.name, 30).trim(), title: str_(g.title, 60).trim(), kind: GREET_KINDS.indexOf(g.kind) >= 0 ? g.kind : (i === 0 ? 'greet' : 'cong') }; });
  var sp = (Array.isArray(p.speakers) && p.speakers.length) ? p.speakers : D.speakers;
  o.speakers = sp.slice(0, 6).map(function (x) { x = isObj_(x) ? x : {}; return { title: str_(x.title, 60).trim(), name: str_(x.name, 30).trim() }; });
  var ph = isObj_(p.photo) ? p.photo : {};
  o.photo = { title: str_(ph.title, 60, D.photo.title), sub: str_(ph.sub, 100, D.photo.sub), pos: PHOTO_POS.indexOf(ph.pos) >= 0 ? ph.pos : D.photo.pos };
  if (o.photo.title === LEGACY_PHOTO_TITLE) o.photo.title = D.photo.title;
  o.roster = {}; var rs = isObj_(p.roster) ? p.roster : {};
  for (var t = 1; t <= TABLE_COUNT; t++) {
    o.roster[t] = {};
    for (var r = 1; r <= 2; r++) {
      var a = isObj_(rs[t]) ? rs[t][r] : null;
      o.roster[t][r] = (Array.isArray(a) ? a : []).map(function (n) { return str_(n, 12).trim(); }).filter(function (n) { return !!n; }).slice(0, 12);
    }
  }
  o.communities = (Array.isArray(p.communities) ? p.communities : []).map(function (n) { return str_(n, 30).trim(); }).filter(function (n) { return !!n; }).slice(0, 60);
  var f = isObj_(p.facts) ? p.facts : {};
  o.facts = { title: str_(f.title, 60, D.facts.title), lead: str_(f.lead, 200, D.facts.lead),
    items: (Array.isArray(f.items) ? f.items : D.facts.items).slice(0, 12).map(function (it) { it = isObj_(it) ? it : {}; return { v: str_(it.v, 20).trim(), k: str_(it.k, 40).trim(), s: str_(it.s, 60).trim() }; }),
    foot: str_(f.foot, 200, D.facts.foot) };
  var lv = isObj_(p.live) ? p.live : {};
  var want = (Array.isArray(lv.panels) ? lv.panels : []).map(function (k) { return k === 'map' ? 'status' : k; });   // 옛 'map' 은 status 로 (v3.8)
  var panels = LIVE_PANELS.filter(function (k) { return want.indexOf(k) >= 0; });   // 순서는 LIVE_PANELS 순(진행 현황 먼저), 모르는 값·중복 제거
  if (panels.length && !isObj_(p.trends) && panels.indexOf('trend') < 0) panels.push('trend');   // v3.4 이전 저장값이면 트렌드 패널을 한 번 켜 준다 (아는 패널이 하나도 없으면 아래에서 기본값)
  var sec = Number(lv.sec);
  o.live = { panels: panels.length ? panels : D.live.panels.slice(), sec: isInt_(sec, 5, 120) ? sec : D.live.sec, pin: LIVE_PANELS.indexOf(lv.pin === 'map' ? 'status' : lv.pin) >= 0 ? (lv.pin === 'map' ? 'status' : lv.pin) : '' };
  var cl = isObj_(p.cloud) ? p.cloud : {};
  o.cloud = { style: ['a', 'b', 'c'].indexOf(cl.style) >= 0 ? cl.style : D.cloud.style, frame: ['none', 'area', 'word', 'both'].indexOf(cl.frame) >= 0 ? cl.frame : D.cloud.frame };   // v3.11
  var c = isObj_(p.close) ? p.close : {};
  o.close = { title: str_(c.title, 80, D.close.title), text: str_(c.text, 500, D.close.text) };
  if (o.close.text === LEGACY_CLOSE_TEXT) o.close.text = '';
  var tr = isObj_(p.trends) ? p.trends : {}; var tsec = Number(tr.sec);
  o.trends = { src: str_(tr.src, 40, D.trends.src).trim() || D.trends.src, collect: tr.collect == null ? D.trends.collect : tr.collect !== false, sec: isInt_(tsec, 5, 60) ? tsec : D.trends.sec,
    items: (Array.isArray(tr.items) ? tr.items : D.trends.items).slice(0, 10).map(function (it) { it = isObj_(it) ? it : {}; return { k: str_(it.k, 30).trim(), s: str_(it.s, 160).trim(), m: str_(it.m, 80).trim() }; }) };
  return o;
}

/* ============================================================
 *  웹앱 진입
 * ========================================================== */
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase() : 'start';
  if (page === 'push') return pushLine_(e);                             // 리허설 입력 통로 (시트 메뉴에서 열었을 때만)
  if (page === 'snapshot') return ContentService.createTextOutput(JSON.stringify(getSnapshot(0))).setMimeType(ContentService.MimeType.JSON);   // 읽기 전용: 스크린이 받는 것과 같은 스냅샷(스토리보드·점검용). 쓰기 없음
  if (e && e.parameter && e.parameter.api === '1') {   // JSON API(GET): 읽기(getSnapshot 긴 폴링)만 — 쓰기·운영진 함수는 POST 로만(주소창·링크 미리보기가 GET 을 그냥 실행하므로) (v3.12.1)
    var gfn = String(e.parameter.fn || '');
    if (!API_GET_FNS[gfn]) return ContentService.createTextOutput(JSON.stringify({ __error: 'GET 은 읽기(getSnapshot)만 됩니다. 쓰기는 POST 로' })).setMimeType(ContentService.MimeType.JSON);
    return apiCall_(gfn, e.parameter.args);
  }
  var map = { start: ['Start', '안내'], phone: ['Phone', '오늘의 한줄'], screen: ['Screen', '스크린'], recorder: ['Recorder', '기록자'], admin: ['Admin', '운영진 콘솔'], print: ['Print', '테이블 QR 인쇄'] };
  if (!map[page]) page = 'start';
  ensureSheets_();
  var t = HtmlService.createTemplateFromFile(map[page][0]);
  var no = Number((e && e.parameter && e.parameter.no) || 0);          // 기록자 페이지: ?page=recorder&no=3 이면 3번 테이블이 미리 선택됨
  var tb = Number((e && e.parameter && e.parameter.t) || 0);           // 참가자 페이지: ?page=phone&t=3 이면 3번 테이블 QR 로 들어온 것
  t.CFG = JSON.stringify({ page: page, no: isInt_(no, 1, TABLE_COUNT) ? no : 0, table: isInt_(tb, 1, TABLE_COUNT) ? tb : 0, url: getWebAppUrl_(), event: EVENT, prompt: PROMPT, logoGG: LOGO_GG, logoHC: LOGO_HC });
  return t.evaluate()
    .setTitle(EVENT.name + ' · ' + map[page][1])
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* ---- JSON API (v3.12): 화면을 Vercel 등 다른 서버에서 띄울 때 google.script.run 대신 fetch 로 부른다.
 *  허용 목록의 공개 함수만, 인자는 JSON 배열. PIN 검사는 각 admin 함수 안에서 그대로. 오류는 {__error} 로 돌려 클라이언트의 실패 처리로 간다.
 *  읽기(getSnapshot)는 GET ?api=1&fn=&args=, 쓰기는 POST(본문 {fn,args}, text/plain 이라 브라우저 사전 요청 없음). */
var API_GET_FNS = { getSnapshot: 1 };   // GET 으로 허용하는 읽기 함수
var API_FNS = { getSnapshot: 1, addLine: 1, updateLine: 1, deleteLine: 1, markDone: 1, setEditing: 1, saveRecord: 1, screenReport: 1, adminCheckPin: 1, adminSetState: 1, adminSetProgram: 1, adminAnalyze: 1, adminReset: 1, adminFillDemo: 1, adminHideLine: 1, adminRefresh: 1 };
function doPost(e) {
  var body = {}; try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}') || {}; } catch (err) { body = {}; }
  return apiCall_(body.fn, body.args);
}
function apiCall_(fn, args) {
  var out;
  try {
    fn = String(fn || ''); if (!API_FNS[fn] || typeof globalThis[fn] !== 'function') throw new Error('없는 기능: ' + fn);
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch (e2) { args = []; } }
    if (!Array.isArray(args)) args = [];
    out = globalThis[fn].apply(null, args); if (out === undefined) out = null;
  } catch (err) { out = { __error: String(err && err.message ? err.message : err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* 리허설 입력 통로: <웹앱주소>?page=push&text=...&dev=...&t=3
 * 시트 메뉴 「리허설 입력 통로 열기」로 켠 동안에만 동작한다. 행사 당일에는 「닫기」로 막는다.
 * 참가자 페이지와 같은 addLine 을 쓰므로 시트·스크린 반영 방식은 동일하다. */
function pushLine_(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  if (PropertiesService.getScriptProperties().getProperty('REHEARSAL') !== 'Y') return out({ ok: false, error: '리허설 입력 통로가 닫혀 있습니다. 시트 메뉴 「발표보드 > 리허설 입력 통로 열기」' });
  var p = (e && e.parameter) || {};
  if (String(p.done || '') === '1' && !p.text) return out(markDone(String(p.dev || '')));   // &done=1 만 주면 그 기기를 「작성 완료」로 표시
  var r = addLine(String(p.text || ''), String(p.dev || 'rehearsal'), Number(p.t || 0));
  if (r.ok && String(p.done || '') === '1') markDone(String(p.dev || 'rehearsal'));
  return out(r);
}
function openRehearsal() { PropertiesService.getScriptProperties().setProperty('REHEARSAL', 'Y'); SpreadsheetApp.getActive().toast('리허설 입력 통로를 열었습니다. 행사 전 「닫기」를 눌러 주세요.', '발표보드', 6); }
function closeRehearsal() { PropertiesService.getScriptProperties().deleteProperty('REHEARSAL'); SpreadsheetApp.getActive().toast('리허설 입력 통로를 닫았습니다.', '발표보드', 5); }
function getWebAppUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; } }

/* ============================================================
 *  시트 메뉴
 * ========================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('발표보드')
    .addItem('① 초기 설정', 'initSheets')
    .addItem('② 웹앱 주소 보기', 'showUrls')
    .addSeparator()
    .addItem('운영진 PIN 설정', 'setPin')
    .addItem('Claude API 키 설정', 'setApiKey')
    .addItem('현재 상태 확인', 'checkState')
    .addSeparator()
    .addItem('리허설용 예시 데이터 채우기', 'fillDemoData')
    .addItem('리허설 입력 통로 열기 (자동 입력 테스트용)', 'openRehearsal')
    .addItem('리허설 입력 통로 닫기', 'closeRehearsal')
    .addItem('진행 상태 초기화 (입력 유지)', 'resetStateMenu')
    .addItem('화면 새로 고침 (시트를 직접 고친 뒤)', 'refreshMenu')
    .addItem('오늘의 한줄 전체 비우기', 'clearLinesMenu')
    .addItem('전체 비우기 (기록·한줄·분석 — 프로그램 설정은 유지)', 'clearAllMenu')
    .addToUi();
}
function initSheets() { ensureSheets_(); SpreadsheetApp.getActive().toast('초기 설정 완료. 이제 배포 > 새 배포 > 웹 앱 으로 배포하세요.', '발표보드', 8); }
function showUrls() {
  var u = getWebAppUrl_() || '(배포 후 다시 확인하세요)';
  SpreadsheetApp.getUi().alert('웹앱 주소\n\n▶ 안내(모든 링크·QR)\n' + u + '?page=start\n\n▶ 참가자 오늘의 한줄(QR)\n' + u + '?page=phone\n\n▶ 스크린\n' + u + '?page=screen\n\n▶ 기록자\n' + u + '?page=recorder\n\n▶ 운영진 콘솔\n' + u + '?page=admin\n\n▶ 테이블 QR 인쇄\n' + u + '?page=print\n\n운영진 PIN: ' + getPin_());
}
function setPin() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('운영진 PIN 설정', '운영진 콘솔에 들어갈 때 쓰는 숫자·문자 (현재: ' + getPin_() + ')', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var v = String(r.getResponseText() || '').trim();
  if (!v) return;
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', v);
  try { CacheService.getScriptCache().remove('PIN'); } catch (e) {}
  ui.alert('PIN 을 「' + v + '」 로 바꿨습니다.');
}
function setApiKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Claude API 키 설정', 'console.anthropic.com 에서 발급한 키(sk-ant-...)를 붙여넣으세요. 키는 스크립트 속성에만 저장되고 화면에 나가지 않습니다. 비우면 삭제.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var k = String(r.getResponseText() || '').trim();
  var p = PropertiesService.getScriptProperties();
  if (!k) { p.deleteProperty('ANTHROPIC_API_KEY'); ui.alert('API 키를 삭제했습니다. 분석은 규칙 기반으로 동작합니다.'); return; }
  p.setProperty('ANTHROPIC_API_KEY', k);
  ui.alert('API 키를 저장했습니다. 분석 실행 시 Claude(claude-opus-5)를 사용합니다.');
}
/* 기록 상태 규칙(클라이언트 recStatus 와 같음): 바라는 것이 있거나 기록 80자 이상 = done, 1~79자 = draft, 0자 = wait */
function recStatus_(x) { if (x.done) return 'done'; return (String(x.note || '').trim() || String(x.wish || '').trim()) ? 'draft' : 'wait'; }   // 완료 = 기록자가 「저장」을 누른 뒤 안 고침
function checkState() {
  var st = getState_(); var p = PropertiesService.getScriptProperties();
  var lines = readLines_(); var vis = lines.filter(function (o) { return !o.hidden; }).length;
  var devs = {}, dones = {}; lines.forEach(function (o) { if (!o.hidden) { devs[o.dev] = 1; if (o.done) dones[o.dev] = 1; } });
  vis = vis + ', 작성 ' + Object.keys(devs).length + '명, 완료 ' + Object.keys(dones).length + '명';
  var recs = readRecords_(); var cnt = { wait: 0, draft: 0, done: 0 };
  for (var t = 1; t <= TABLE_COUNT; t++) for (var r = 1; r <= 2; r++) cnt[recStatus_((recs[t] || {})[r] || {})]++;
  var prog = readProgram_(); var rosterN = 0;
  for (var t2 = 1; t2 <= TABLE_COUNT; t2++) rosterN += prog.roster[t2][1].length + prog.roster[t2][2].length;
  SpreadsheetApp.getUi().alert('현재 상태\n\n단계: ' + st.phase + (st.round ? ' (' + st.round + '라운드)' : '') + '\n장표: ' + (st.slide + 1) + '\n입력 마감: ' + (st.closed ? '예' : '아니오') + '\n분석 완료: ' + (st.analyzed ? '예' : '아니오') + '\n참석자 수(목표): ' + (st.expected || 0) +
    '\n오늘의 한줄: ' + lines.length + '건 (표시 ' + vis + ')\n테이블 기록(18칸): 완료 ' + cnt.done + ' · 작성 중 ' + cnt.draft + ' · 대기 ' + cnt.wait +
    '\n프로그램: 발표자 ' + prog.speakers.length + '명 · 인사말 ' + prog.greet.filter(function (g) { return g.name && g.kind !== 'cong'; }).length + '명 · 축사 ' + prog.greet.filter(function (g) { return g.name && g.kind === 'cong'; }).length + '명 · 명단 ' + rosterN + '명 · 영상 ' + (prog.video.url ? '있음' : '없음') +
    '\n개정 번호: ' + getRev_() + '\nAPI 키: ' + (p.getProperty('ANTHROPIC_API_KEY') ? '있음' : '없음') + '\n리허설 입력 통로: ' + (p.getProperty('REHEARSAL') === 'Y' ? '열림' : '닫힘') + '\n운영진 PIN: ' + getPin_());
}
function resetStateMenu() { saveState_(defaultState_()); bumpRev_(); SpreadsheetApp.getActive().toast('진행 상태를 처음(등록)으로 되돌렸습니다.', '발표보드', 5); }
function refreshMenu() { bumpRev_(); SpreadsheetApp.getActive().toast('화면들이 시트를 다시 읽습니다 (몇 초 안에 반영).', '발표보드', 5); }   // 시트를 손으로 고친 뒤 (v3.10.4)
/* 시트를 손으로 고치면(기록·한줄·분석·설정) 스냅샷 캐시를 지워 화면이 다시 읽게 한다 — 단순 트리거: 사용자가 시트에서 직접 고칠 때만 실행되고, 스크립트가 쓴 값에는 실행되지 않는다 (v3.10.4) */
function onEdit(e) {
  try { var name = e && e.range && e.range.getSheet().getName(); if ([SHEET_REC, SHEET_LINES, SHEET_ANA, SHEET_SET].indexOf(name) >= 0) bumpRev_(); } catch (err) {}
}
function clearLinesMenu() { clearLines_(); SpreadsheetApp.getActive().toast('오늘의 한줄을 모두 비웠습니다.', '발표보드', 5); }
function clearAllMenu() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('전체 비우기', '기록·한줄·분석을 모두 지우고 상태를 초기화합니다(프로그램 설정은 남습니다). 되돌릴 수 없습니다. 계속할까요?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  clearAll_(); SpreadsheetApp.getActive().toast('전체를 비웠습니다.', '발표보드', 5);
}

/* ============================================================
 *  시트 준비
 *   한줄 : id | 시각 | 시분 | 내용 | 기기 | 숨김 | 삭제 | 수정 | 완료 | 테이블
 *   기록 : 테이블 | 라운드 | 주제 | 기록 | 바라는 것 | 최종수정 | 완료     (18행 고정, 완료 = 기록자가 「저장」을 누름)
 *   분석 : 시각 | 엔진 | 결과(JSON)
 *   설정 : 키 | 값                                                      (program 행 = 1부 프로그램·명단 JSON)
 * ========================================================== */
var H_LINES = ['id', '시각', '시분', '내용', '기기', '숨김', '삭제', '수정', '완료', '테이블'];   // 수정: 고친 횟수, 완료: 참가자가 「작성 완료」를 누름, 테이블: QR 꼬리표(0=미지정)
var H_REC = ['테이블', '라운드', '주제', '기록', '바라는 것', '최종수정', '완료'];   // 완료: 기록자가 「저장」(작성 완료)을 누름. 고치면 풀림
var H_ANA = ['시각', '엔진', '결과'];

function isTrue_(v) { return v === true || v === 1 || /^(1|true|y|예)$/i.test(String(v == null ? '' : v).trim()); }   // 시트 칸의 TRUE·1·예 를 참으로
function demoDone_(t, r) { return !((t === 4 && r === 2) || (t === 7 && r === 1)); }
function header_(sh, H) {
  sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground('#0E4194').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}
function ensureSheets_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_LINES);
  if (!sh) { sh = ss.insertSheet(SHEET_LINES); header_(sh, H_LINES); sh.setColumnWidth(4, 420); sh.getRange('C:C').setNumberFormat('@'); sh.getRange('D:E').setNumberFormat('@'); }   // 내용·기기 칸은 글자 서식 — '=' 로 시작해도 수식이 되지 않게
  else if (sh.getLastColumn() < H_LINES.length || String(sh.getRange(1, H_LINES.length).getValue()) !== H_LINES[H_LINES.length - 1]) { header_(sh, H_LINES); sh.getRange('C:C').setNumberFormat('@'); sh.getRange('D:E').setNumberFormat('@'); }   // 9열(v2) 시트는 머리글만 다시 써서 보정(행 보존)
  var rc = ss.getSheetByName(SHEET_REC);
  if (rc && rc.getRange(1, 1, 1, 6).getValues()[0].join('|') === H_REC.slice(0, 6).join('|') && String(rc.getRange(1, 7).getValue()) !== H_REC[6]) header_(rc, H_REC);   // v3(6열) → 7열: 머리글만 다시 써서 「완료」 추가(행 보존)
  if (rc && rc.getRange(1, 1, 1, H_REC.length).getValues()[0].join('|') !== H_REC.join('|')) {   // 옛 9열 「기록」은 이름만 바꿔 보존 (되돌리기: 이름을 「기록」으로)
    var oldName = SHEET_REC_OLD, k = 2;
    while (ss.getSheetByName(oldName)) { oldName = SHEET_REC_OLD + '_' + k; k++; }
    rc.setName(oldName); rc = null;
  }
  if (!rc) {
    rc = ss.insertSheet(SHEET_REC); header_(rc, H_REC);
    var rows = [];
    for (var t = 1; t <= TABLE_COUNT; t++) for (var r = 1; r <= 2; r++) rows.push([t, r, TT[t], '', '', '', '']);
    rc.getRange(2, 1, rows.length, H_REC.length).setValues(rows);
    rc.setColumnWidth(4, 520); rc.setColumnWidth(5, 320); rc.getRange('D:E').setWrap(true); rc.getRange('D:E').setNumberFormat('@');
  }
  var an = ss.getSheetByName(SHEET_ANA);
  if (!an) { an = ss.insertSheet(SHEET_ANA); header_(an, H_ANA); an.setColumnWidth(3, 800); }
  var cf = ss.getSheetByName(SHEET_CONF);
  if (!cf) {
    cf = ss.insertSheet(SHEET_CONF); header_(cf, ['키', '값']);
    cf.getRange('B:B').setNumberFormat('@');
    cf.getRange(2, 1, 6, 2).setValues([['행사명', EVENT.name], ['일시', EVENT.date + ' ' + EVENT.time], ['장소', EVENT.place], ['한줄 질문', PROMPT], ['안내', '행사명·일시·장소·한줄 질문은 Code.gs 상단 EVENT·PROMPT 를 고치세요(참고용). program 행은 콘솔 「프로그램」 탭에서 저장됩니다 — 직접 고치지 마세요.'], ['program', '']]);
    cf.setColumnWidth(2, 600);
  } else if (!confRow_(cf, 'program')) { cf.appendRow(['program', '']); cf.getRange('B:B').setNumberFormat('@'); }
  return ss;
}
function confRow_(cf, key) {
  var n = cf.getLastRow(); if (n < 2) return 0;
  var v = cf.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === key) return i + 2;
  return 0;
}

/* ============================================================
 *  진행 상태 (스크립트 속성) · 개정 번호 · 캐시
 * ========================================================== */
function defaultState_() { return { phase: 'reg', round: 0, roundStart: 0, slide: 0, same: {}, closed: false, analyzed: false, analyzedAt: 0, forceWall: false, hold: false, expected: 0, updatedAt: 0 }; }   // hold: 스크린 화면 멈춤 (v3.10)
function getState_() {
  var s = PropertiesService.getScriptProperties().getProperty('STATE');
  var d = defaultState_();
  if (!s) return d;
  try { var o = JSON.parse(s); for (var k in o) d[k] = o[k]; return d; } catch (e) { return d; }
}
function saveState_(st) { st.updatedAt = Date.now(); PropertiesService.getScriptProperties().setProperty('STATE', JSON.stringify(st)); return bumpRev_({ state: st }); }   // 상태만 바뀜 → 스냅샷 캐시의 state 칸만 교체 (v3.9)
function getRev_() { return Number(PropertiesService.getScriptProperties().getProperty('REV') || 0); }
/* 개정 번호의 캐시 거울: 폴링의 빠른 길(same 판정)·긴 폴링이 PropertiesService(하루 읽기 한도 5만)를 타지 않게. 캐시가 비면 속성에서 읽어 다시 채운다 (v3.9) */
function getRevFast_() { var c = CacheService.getScriptCache(); var v = null; try { v = c.get('REV'); } catch (e) {} if (v != null && v !== '') return Number(v) || 0; var r = getRev_(); try { c.put('REV', String(r), 21600); } catch (e2) {} return r; }
/* 개정 번호 +1. patch 가 있으면(예: {state}·{lines}·{records}·{screen}) 캐시된 스냅샷의 그 칸만 바꿔 다음 폴링이 시트를 다시 읽지 않게 하고, 없으면 스냅샷 캐시를 지운다 (v3.9) */
function bumpRev_(patch) {
  var lock = LockService.getScriptLock(); var locked = false;
  try { lock.waitLock(8000); locked = true; } catch (e) {}   // 등록 러시 때 한줄 쓰기가 잠금을 1~2초씩 잡는다 — 짧게 기다리다 포기하면 SNAP 을 지워 모두가 시트를 다시 읽게 되므로 참가자 쪽(8초)만큼 기다린다 (v3.10)
  var p = PropertiesService.getScriptProperties();
  var r = Number(p.getProperty('REV') || 0) + 1;
  p.setProperty('REV', String(r));
  var cache = CacheService.getScriptCache();
  /* 순서가 중요 (v3.10): 스냅샷(SNAP)을 먼저 새 번호로 고친 뒤 맨 끝에 REV 를 올린다 — 기다리던 긴 폴링이 새 REV 를 보는 순간 SNAP 은 이미 새것이라 시트를 다시 읽는 느린 길(1~3초)로 빠지지 않는다. 잠금은 캐시 갱신까지 덮어 두 호출이 서로의 칸을 덮어쓰지 않게 */
  var patched = false;
  if (patch && locked) { try { var c = cache.get('SNAP'); if (c) { var o = JSON.parse(c); for (var k in patch) o[k] = patch[k]; o.rev = r; var js = JSON.stringify(o); if (Utilities.newBlob(js).getBytes().length < 95000) { cache.put('SNAP', js, 21600); patched = true; } } } catch (e5) {} }
  if (!patched) { try { cache.remove('SNAP'); } catch (e3) {} }
  try { cache.put('REV', String(r), 21600); } catch (e4) {}
  try { lock.releaseLock(); } catch (e2) {}
  return r;
}
function getPin_() {   // 캐시 거울(5분): 콘솔 호출마다 속성을 읽지 않는다. 「운영진 PIN 설정」이 바꾸면 바로 지운다 (v3.10)
  var c = CacheService.getScriptCache(); var v = null; try { v = c.get('PIN'); } catch (e) {} if (v) return v;
  v = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || DEFAULT_PIN; try { c.put('PIN', v, 300); } catch (e2) {} return v;
}
function checkPin_(pin) {
  if (String(pin || '') === getPin_()) return;   // 맞는 PIN 은 언제나 통과 — 전역 실패 카운터가 운영진을 막지 못하게(익명 호출로 틀린 PIN 을 반복해 콘솔을 잠그던 길 차단, v3.12.1)
  var cache = CacheService.getScriptCache(), fails = 1;
  try { fails = Number(cache.get('PINFAIL') || 0) + 1; cache.put('PINFAIL', String(fails), 600); } catch (e) {}
  if (fails === 8 || fails % 50 === 0) console.warn('운영진 PIN 틀림 ' + fails + '회(10분 창) — 무차별 대입 가능성. 시트 메뉴 「운영진 PIN 설정」으로 길고 추측 어려운 PIN 을 쓰세요');
  throw new Error(fails >= 8 ? 'PIN 이 맞지 않습니다 (틀린 시도가 많습니다 — 운영진이 아니면 그만두세요)' : 'PIN 이 맞지 않습니다');
}
function nowHM_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm'); }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

/* ============================================================
 *  읽기
 * ========================================================== */
function readLines_() {
  var sh = ensureSheets_().getSheetByName(SHEET_LINES);
  var n = sh.getLastRow(); if (n < 2) return [];
  var v = sh.getRange(2, 1, n - 1, H_LINES.length).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    if (!v[i][0]) continue;
    if (String(v[i][6]) === 'TRUE' || v[i][6] === true) continue;      // (예전 방식의 삭제 표시가 남아 있으면 건너뜀)
    var ts = Number(v[i][1]) || 0;
    var at = ts ? Utilities.formatDate(new Date(ts), TZ, 'HH:mm') : String(v[i][2] || '');   // 시분 칸을 시트가 날짜로 바꿔도 안전하게 시각(ms)에서 계산
    var tb = Number(v[i][9]) || 0;
    out.push({ id: String(v[i][0]), ts: ts, at: at, text: String(v[i][3] || ''), dev: String(v[i][4] || ''), hidden: (String(v[i][5]) === 'TRUE' || v[i][5] === true), edited: Number(v[i][7]) || 0, done: (String(v[i][8]) === 'TRUE' || v[i][8] === true), table: isInt_(tb, 1, TABLE_COUNT) ? tb : 0, row: i + 2 });
  }
  return out;
}
/* 화면에 내보내는 한줄: 기기 ID(dev)는 일방향 해시 8자로 바꾸고 행 번호는 뺀다 — 남의 글을 지우거나 고칠 수 없게 */
function who_(dev) {
  dev = String(dev || ''); if (!dev) return '';
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, dev, Utilities.Charset.UTF_8); var s = '';
  for (var i = 0; i < 4; i++) { var v = (b[i] + 256) % 256; s += (v < 16 ? '0' : '') + v.toString(16); }
  return s;
}
function exportLine_(o) { return { id: o.id, ts: o.ts, at: o.at, text: o.text, dev: who_(o.dev), hidden: o.hidden, edited: o.edited, done: o.done, table: o.table }; }
function readRecords_() {
  var sh = ensureSheets_().getSheetByName(SHEET_REC);
  var v = sh.getRange(2, 1, TABLE_COUNT * 2, H_REC.length).getValues();
  var out = {};
  for (var t = 1; t <= TABLE_COUNT; t++) out[t] = { 1: { note: '', wish: '', updatedAt: '', done: false }, 2: { note: '', wish: '', updatedAt: '', done: false } };
  for (var i = 0; i < v.length; i++) {
    var tt = Number(v[i][0]), r = Number(v[i][1]); if (!isInt_(tt, 1, TABLE_COUNT) || !(r === 1 || r === 2)) continue;
    out[tt][r] = { note: String(v[i][3] || ''), wish: String(v[i][4] || ''), updatedAt: String(v[i][5] || ''), done: isTrue_(v[i][6]) };
  }
  return out;
}
function readProgram_() {
  var cf = ensureSheets_().getSheetByName(SHEET_CONF); var row = confRow_(cf, 'program'); var o = null;
  if (row) { try { var js = String(cf.getRange(row, 2).getValue() || ''); o = js ? JSON.parse(js) : null; } catch (e) { o = null; } }
  return normalizeProgram_(o);
}
function writeProgram_(js) {
  var cf = ensureSheets_().getSheetByName(SHEET_CONF); var row = confRow_(cf, 'program');
  if (!row) cf.appendRow(['program', js]); else cf.getRange(row, 2).setValue(js);
}
/* 스크린이 알려 오는 상태(영상 파일 준비 여부) — PIN 없음, 6시간 캐시. 콘솔 「오프닝 영상」 줄에 표시 */
function screenReport(info) {
  if (!isObj_(info)) return { ok: false, error: '형식 오류' };
  var v = isObj_(info.video) ? info.video : null; var id = str_(info.id, 40).trim();
  var o = { at: Date.now(), id: id, video: v ? { name: str_(v.name, 80).trim(), size: Number(v.size) || 0, dur: Number(v.dur) || 0 } : null };
  var prev = readScreen_();
  if (!o.video && prev && prev.video && prev.id && prev.id !== id) return { ok: true, kept: true };   // 다른 브라우저(콘솔 미리보기 등)의 「영상 없음」은 스크린 노트북의 「준비됨」을 덮지 않는다
  var same = !!prev && prev.id === id && JSON.stringify(prev.video) === JSON.stringify(o.video);
  try { CacheService.getScriptCache().put('SCREEN', JSON.stringify(o), 21600); } catch (e) {}
  if (!same) bumpRev_({ screen: o });   // 같은 내용이면 개정 번호를 올리지 않는다 (콘솔 미리보기 ↔ 보고 무한 반복 방지)
  return { ok: true, same: same };
}
function readScreen_() { try { var s = CacheService.getScriptCache().get('SCREEN'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function readAnalysis_() {
  var sh = ensureSheets_().getSheetByName(SHEET_ANA);
  var n = sh.getLastRow(); if (n < 2) return null;
  var v = sh.getRange(n, 1, 1, 3).getValues()[0];
  try { var o = JSON.parse(v[2]); o.at = String(v[0]); o.engine = String(v[1]); return o; } catch (e) { return null; }
}

/* ============================================================
 *  클라이언트 API — 폴링
 *   화면들은 2~3초마다 getSnapshot(내가 아는 개정번호) 를 부른다.
 *   바뀐 것이 없으면 {same:true} 만 돌려주므로 시트를 읽지 않는다.
 * ========================================================== */
function getSnapshot(sinceRev, waitMs) {
  sinceRev = Number(sinceRev) || 0; waitMs = Math.min(8000, Math.max(0, Number(waitMs) || 0));
  var rev = getRevFast_();
  if (sinceRev && sinceRev === rev && waitMs) {   // 긴 폴링(스크린): 개정 번호가 바뀔 때까지 최대 waitMs 동안 0.12초마다 캐시만 보고 바로 답한다 — 콘솔 「다음」이 스크린에 더 빨리 닿게 (v3.9 → v3.10 간격 단축)
    var until = Date.now() + waitMs;
    while (Date.now() < until) { Utilities.sleep(120); rev = getRevFast_(); if (rev !== sinceRev) break; }
  }
  var editing = Object.keys(readEditing_()).length;
  if (sinceRev && sinceRev === rev) return { same: true, rev: rev, now: Date.now(), editing: editing };
  var cache = CacheService.getScriptCache();
  var c = null; try { c = cache.get('SNAP'); } catch (e) {}
  if (c) { try { var o = JSON.parse(c);
    if (o.rev > rev) { Utilities.sleep(60); var rev2 = getRevFast_(); if (o.rev > rev2) { try { cache.put('REV', String(o.rev), 21600); } catch (e6) {} } rev = Math.max(rev2, o.rev); }   // SNAP 이 먼저, REV 가 나중에 써지는 짧은 순간이면 REV 를 한 번 더 읽고, 그래도 SNAP 이 새것이면(REV 캐시 쓰기 실패) SNAP 번호로 캐시를 고친다 — 번호는 속성에서만 커지므로 SNAP 이 더 새것일 수는 있어도 틀릴 수는 없다 (v3.10)
    if (o.rev === rev) { o.now = Date.now(); o.editing = editing; return o; } } catch (e2) {} }
  var snap = { rev: rev, state: getState_(), lines: readLines_().map(exportLine_), records: readRecords_(), program: readProgram_(), analysis: readAnalysis_(), screen: readScreen_() };
  var js = JSON.stringify(snap);
  var bytes = 0; try { bytes = Utilities.newBlob(js).getBytes().length; } catch (e4) { bytes = js.length * 3; }
  if (bytes < 95000) { try { cache.put('SNAP', js, 21600); } catch (e3) {} }   // CacheService 한도 100KB(바이트)
  snap.now = Date.now(); snap.editing = editing;
  return snap;
}

/* ---- 「수정 중」 인원: 참가자가 수정 버튼을 누르면 등록, 저장·취소하면 해제. 3분이 지나면 자동으로 빠진다 ---- */
var EDIT_TTL_MS = 3 * 60 * 1000;
function readEditing_() {   // 캐시 거울 먼저, 비면 속성에서 읽어 채운다 (v3.9)
  var s = null; try { s = CacheService.getScriptCache().get('EDITING'); } catch (e0) {}
  if (s == null) { s = PropertiesService.getScriptProperties().getProperty('EDITING') || '{}'; try { CacheService.getScriptCache().put('EDITING', s, 21600); } catch (e1) {} }
  var o = {}; try { o = s ? JSON.parse(s) : {}; } catch (e) {}
  var now = Date.now(), out = {}; for (var k in o) if (now - Number(o[k]) < EDIT_TTL_MS) out[k] = o[k];
  return out;
}
function setEditing(dev, on) { return setEditing_(dev, on); }   // 참가자 페이지가 부르는 공개 함수 — 스냅샷 칸(patch)은 밖에서 넣을 수 없다
function setEditing_(dev, on, patch) {   // patch: 같이 바꿀 스냅샷 칸 — 서버 안에서만(updateLine 이 lines 를 넘긴다) (v3.10)
  dev = str_(dev, LIMIT.dev).trim(); if (!dev) return { ok: false, error: '기기 정보가 없습니다' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(5000); } catch (e) { return { ok: false, error: '잠시 후 다시 시도해 주세요' }; }
  var o;
  try { o = readEditing_(); if (on) o[dev] = Date.now(); else delete o[dev]; var ej = JSON.stringify(o); PropertiesService.getScriptProperties().setProperty('EDITING', ej); try { CacheService.getScriptCache().put('EDITING', ej, 21600); } catch (e3) {} }
  finally { try { lock.releaseLock(); } catch (e2) {} }
  bumpRev_(patch || {});   // patch 없으면 스냅샷 내용은 그대로(수정 중 인원은 답할 때 붙인다)
  return { ok: true, editing: Object.keys(o).length };
}

/* ============================================================
 *  참가자 · 오늘의 한줄
 * ========================================================== */
function addLine(text, dev, table) {
  if (text != null && typeof text !== 'string') return { ok: false, error: '내용 형식 오류' };
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, error: '내용이 없습니다' };
  if (text.length > LIMIT.line) return { ok: false, error: LIMIT.line + '자까지 적을 수 있습니다' };
  dev = str_(dev, LIMIT.dev).trim();
  var tb = (table == null || table === '') ? 0 : Number(table);
  if (!isInt_(tb, 0, TABLE_COUNT)) return { ok: false, error: '테이블 번호는 1~' + TABLE_COUNT + ' (0 = 미지정)' };
  var id = Utilities.getUuid().slice(0, 8) + Date.now().toString(36);
  var at = nowHM_();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return { ok: false, error: '잠시 후 다시 눌러 주세요' }; }
  try {
    var sh = ensureSheets_().getSheetByName(SHEET_LINES);
    if (dev) {   // 한 기기당 20개, 2초 간격 — 스크린 도배 방지
      var mine = readLines_().filter(function (o) { return o.dev === dev; });
      if (mine.length >= 20) return { ok: false, error: '한 기기에서는 20개까지 올릴 수 있습니다' };
      if (mine.length && Date.now() - Number(mine[mine.length - 1].ts || 0) < 2000) return { ok: false, error: '잠시 후 다시 올려 주세요' };
    }
    sh.appendRow([id, Date.now(), at, text, dev, false, false, 0, false, tb]);
  } finally { try { lock.releaseLock(); } catch (e2) {} }
  bumpRev_({ lines: readLines_().map(exportLine_) });
  return { ok: true, id: id, at: at };
}
/* 참가자가 자기 글을 지우면 시트에서 행을 실제로 삭제한다 */
function deleteLine(id, dev) {
  id = str_(id, LIMIT.id).trim(); dev = str_(dev, LIMIT.dev).trim();
  if (!id) return { ok: false, error: '글 번호가 없습니다' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return { ok: false, error: '잠시 후 다시 눌러 주세요' }; }
  try {
    var lines = readLines_();
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].id === id) {
        if (lines[i].dev !== dev) return { ok: false, error: '본인 글만 지울 수 있습니다' };
        ensureSheets_().getSheetByName(SHEET_LINES).deleteRow(lines[i].row);
        bumpRev_({ lines: readLines_().map(exportLine_) }); return { ok: true };
      }
    }
    return { ok: false, error: '글을 찾지 못했습니다' };
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}
/* 참가자가 자기 글을 고친다. 고치면 그 사람의 「완료」는 풀리고, 다시 「작성 완료」를 눌러야 완료로 센다 */
function updateLine(id, dev, text) {
  id = str_(id, LIMIT.id).trim(); dev = str_(dev, LIMIT.dev).trim();
  if (!id) return { ok: false, error: '글 번호가 없습니다' };
  if (text != null && typeof text !== 'string') return { ok: false, error: '내용 형식 오류' };
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, error: '내용이 없습니다' };
  if (text.length > LIMIT.line) return { ok: false, error: LIMIT.line + '자까지 적을 수 있습니다' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return { ok: false, error: '잠시 후 다시 눌러 주세요' }; }
  try {
    var sh = ensureSheets_().getSheetByName(SHEET_LINES); var lines = readLines_(); var found = null;
    for (var i = 0; i < lines.length; i++) if (lines[i].id === id) { found = lines[i]; break; }
    if (!found) return { ok: false, error: '글을 찾지 못했습니다' };
    if (found.dev !== dev) return { ok: false, error: '본인 글만 고칠 수 있습니다' };
    sh.getRange(found.row, 4).setValue(text);
    sh.getRange(found.row, 8).setValue((found.edited || 0) + 1);
    for (var j = 0; j < lines.length; j++) if (lines[j].dev === found.dev && lines[j].done) sh.getRange(lines[j].row, 9).setValue(false);
  } finally { try { lock.releaseLock(); } catch (e2) {} }
  setEditing_(dev, false, { lines: readLines_().map(exportLine_) });   // 저장했으니 「수정 중」에서 빠짐 + 고친 글을 스냅샷 캐시에 (전엔 빈 패치라 고친 글이 다음 변경 때까지 스크린에 안 닿았음, v3.10 고침)
  return { ok: true, at: nowHM_() };
}
/* 참가자가 「작성 완료」를 누르면 그 사람(기기)의 글 전부에 완료 표시 */
function markDone(dev) {
  dev = str_(dev, LIMIT.dev).trim(); if (!dev) return { ok: false, error: '기기 정보가 없습니다' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return { ok: false, error: '잠시 후 다시 눌러 주세요' }; }
  var n = 0;
  try {
    var sh = ensureSheets_().getSheetByName(SHEET_LINES); var lines = readLines_();
    for (var i = 0; i < lines.length; i++) if (lines[i].dev === dev) { sh.getRange(lines[i].row, 9).setValue(true); n++; }
  } finally { try { lock.releaseLock(); } catch (e2) {} }
  if (!n) return { ok: false, error: '먼저 한 줄을 올려 주세요' };
  bumpRev_({ lines: readLines_().map(exportLine_) }); return { ok: true, count: n };
}

/* ============================================================
 *  기록자 — saveRecord(t, r, {note, wish, done})   done=true 는 「저장」 버튼(작성 완료), 자동 저장은 done 없이 와서 완료가 풀린다
 * ========================================================== */
function saveRecord(t, r, data) {
  t = Number(t); r = Number(r);
  if (!isInt_(t, 1, TABLE_COUNT) || !(r === 1 || r === 2)) return { ok: false, error: '테이블·라운드 오류' };
  if (data != null && !isObj_(data)) return { ok: false, error: '기록 형식 오류' };
  data = data || {};
  if (data.note != null && typeof data.note !== 'string') return { ok: false, error: '기록 형식 오류' };
  if (data.wish != null && typeof data.wish !== 'string') return { ok: false, error: '바라는 것 형식 오류' };
  var note = String(data.note || ''), wish = String(data.wish || ''), done = isTrue_(data.done);
  if (done && !note.trim() && !wish.trim()) return { ok: false, error: '내용을 적은 뒤 저장해 주세요' };
  if (note.length > LIMIT.note) return { ok: false, error: '기록은 ' + LIMIT.note + '자까지 저장됩니다' };
  if (wish.length > LIMIT.wish) return { ok: false, error: '바라는 것은 ' + LIMIT.wish + '자까지 저장됩니다' };
  var row = 2 + (t - 1) * 2 + (r - 1);
  var sh = ensureSheets_().getSheetByName(SHEET_REC);
  var ab = sh.getRange(row, 1, 1, 2).getValues()[0];
  if (Number(ab[0]) !== t || Number(ab[1]) !== r) {   // 시트 행이 정렬·삽입으로 어긋났으면 열 값으로 찾는다
    row = 0; var col = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getValues();
    for (var i = 0; i < col.length; i++) if (Number(col[i][0]) === t && Number(col[i][1]) === r) { row = i + 2; break; }
    if (!row) return { ok: false, error: '기록 시트에서 테이블 ' + t + ' · ' + r + '라운드 행을 찾지 못했습니다' };
  }
  sh.getRange(row, 4, 1, 4).setValues([[note, wish, nowStr_(), done ? true : '']]);
  var rev = bumpRev_({ records: readRecords_() });
  return { ok: true, rev: rev, at: nowHM_(), done: done };
}

/* ============================================================
 *  운영진 (PIN 필요) — PIN 이 틀리면 checkPin_ 이 throw (콘솔의 실패 핸들러가 받음)
 * ========================================================== */
function adminCheckPin(pin) { checkPin_(pin); return { ok: true, url: getWebAppUrl_(), hasKey: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') }; }
function adminSetState(pin, patch) {
  checkPin_(pin);
  if (patch == null) patch = {};
  if (!isObj_(patch)) return { ok: false, error: '상태 변경 형식 오류' };
  var st = getState_();
  if (patch.phase !== undefined) {
    if (PHASES.indexOf(patch.phase) < 0) return { ok: false, error: '단계 값 오류' };
    var changed = st.phase !== patch.phase;
    st.phase = patch.phase;
    if (changed) { st.slide = 0; st.hold = false; }   // 장표 번호는 단계 안에서 0부터 · 화면 멈춤도 풀린다
    if (patch.phase === 'r1' || patch.phase === 'r2') { var rn = patch.phase === 'r1' ? 1 : 2; if (changed || patch.restartRound || st.round !== rn) { st.round = rn; st.roundStart = Date.now(); } }
    if (patch.phase === 'collect') st.closed = true;
    if (patch.phase === 'reg' || patch.phase === 'part1' || patch.phase === 'p2') { st.round = 0; st.roundStart = 0; }
  }
  if (patch.restartRound && (st.phase === 'r1' || st.phase === 'r2')) st.roundStart = Date.now();
  if (patch.slide !== undefined) { var sl = Number(patch.slide); if (!isInt_(sl, 0, 99)) return { ok: false, error: '장표 번호 오류' }; if (sl !== Number(st.slide)) st.hold = false; st.slide = sl; }   // 장표가 바뀌면 화면 멈춤은 풀린다
  if (patch.same !== undefined) {
    var sm = {};
    if (isObj_(patch.same)) Object.keys(patch.same).slice(0, 40).forEach(function (k) { sm[str_(k, 20)] = !!patch.same[k]; });
    st.same = sm;
  }
  if (patch.toggleSame !== undefined) { var k2 = str_(patch.toggleSame, 20); if (!isObj_(st.same)) st.same = {}; st.same[k2] = !st.same[k2]; }
  if (patch.closed !== undefined) st.closed = !!patch.closed;
  if (patch.forceWall !== undefined) st.forceWall = !!patch.forceWall;
  if (patch.video !== undefined) { var vc = isObj_(patch.video) ? String(patch.video.cmd || '') : String(patch.video || ''); if (['play', 'pause', 'restart'].indexOf(vc) < 0) return { ok: false, error: '영상 명령 오류 (play·pause·restart)' }; st.videoCmd = { cmd: vc, at: Date.now() }; }   // 스크린 오프닝 영상 제어
  if (patch.expected !== undefined) { var ex = Number(patch.expected); if (!isInt_(ex, 0, 999)) return { ok: false, error: '참석자 수는 0~999 사이' }; st.expected = ex; }   // 당일 참석자 수 (오늘의 한줄 목표)
  if (patch.hold !== undefined) st.hold = !!patch.hold;   // 스크린 화면 멈춤: 라운드 패널 순환·휴식 화면 교대를 지금 보이는 것에서 정지(내용 갱신은 계속). 장표·단계가 바뀌면 자동으로 풀린다 (v3.10)
  if (patch.op !== undefined) st.op = str_(patch.op, 24);   // 콘솔이 붙인 변경 꼬리표 — 스크린·콘솔이 미리 그린 상태와 서버 상태를 맞출 때 씀 (v3.10)
  var rev = saveState_(st);   // 속성(REV)을 다시 읽지 않는다
  return { ok: true, state: st, rev: rev };
}
/* 1부 프로그램·명단·화면 문구 저장 (콘솔 「프로그램」「참가자 명단」 탭). 정규화해서 설정 시트 program 행에 JSON 으로 */
function adminSetProgram(pin, program) {
  checkPin_(pin);
  if (!isObj_(program)) return { ok: false, error: '프로그램 형식 오류' };
  var prog = normalizeProgram_(program);
  var js = JSON.stringify(prog);
  if (js.length > LIMIT.program) return { ok: false, error: '프로그램 설정이 너무 큽니다 (' + js.length + '자, 최대 ' + LIMIT.program + '자)' };
  writeProgram_(js);
  var rev = bumpRev_();
  return { ok: true, program: prog, rev: rev };
}
function adminHideLine(pin, id, hidden) {
  checkPin_(pin);
  id = str_(id, LIMIT.id).trim(); if (!id) return { ok: false, error: '글 번호가 없습니다' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(8000); } catch (e) { return { ok: false, error: '잠시 후 다시 눌러 주세요' }; }
  try {
    var lines = readLines_();
    for (var i = 0; i < lines.length; i++) if (lines[i].id === id) {
      ensureSheets_().getSheetByName(SHEET_LINES).getRange(lines[i].row, 6).setValue(!!hidden); bumpRev_({ lines: readLines_().map(exportLine_) }); return { ok: true };
    }
  } finally { try { lock.releaseLock(); } catch (e2) {} }
  return { ok: false, error: '글을 찾지 못했습니다' };
}
/* 콘솔 「리허설용 예시 데이터 채우기」 — 시트 메뉴의 fillDemoData 와 같음 */
function adminFillDemo(pin) { checkPin_(pin); fillDemoData(); return { ok: true }; }
function adminRefresh(pin) { checkPin_(pin); bumpRev_(); return { ok: true }; }   // 콘솔 「화면 새로 고침」: 스냅샷 캐시만 지운다(자료 변경 없음) (v3.10.4)
function adminReset(pin, mode) {
  checkPin_(pin);
  if (mode === 'state') { saveState_(defaultState_()); bumpRev_(); }   // 캐시를 통째로 지워 시트를 손으로 고친 것도 반영 (v3.10.4)
  else if (mode === 'lines') clearLines_();
  else if (mode === 'all') clearAll_();
  else return { ok: false, error: '초기화 종류 오류 (state·lines·all)' };
  return { ok: true };
}
function clearLines_() { var sh = ensureSheets_().getSheetByName(SHEET_LINES); var n = sh.getLastRow(); if (n >= 2) sh.deleteRows(2, n - 1); bumpRev_(); }
/* 기록·한줄·분석을 비우고 상태를 처음으로. 설정 시트(program)는 그대로 둔다 */
function clearAll_() {
  var ss = ensureSheets_();
  var sh = ss.getSheetByName(SHEET_LINES); var n = sh.getLastRow(); if (n >= 2) sh.deleteRows(2, n - 1);
  var rc = ss.getSheetByName(SHEET_REC); var blank = []; for (var i = 0; i < TABLE_COUNT * 2; i++) blank.push(['', '', '', '']); rc.getRange(2, 4, TABLE_COUNT * 2, 4).setValues(blank);
  var an = ss.getSheetByName(SHEET_ANA); var m = an.getLastRow(); if (m >= 2) an.deleteRows(2, m - 1);
  saveState_(defaultState_()); bumpRev_();   // 한줄·기록·분석도 비웠으니 스냅샷 캐시를 통째로 지운다(saveState_ 는 state 칸만 바꿈) (v3.9)
}

/* ============================================================
 *  분석 (15:00~15:20) — Claude 가 있으면 Claude, 없으면 규칙 기반
 * ========================================================== */
function adminAnalyze(pin) {
  checkPin_(pin);
  var records = readRecords_(), lines = readLines_().filter(function (o) { return !o.hidden; });
  var result, engine;
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (key) {
    try { result = analyzeWithClaude_(key, records, lines); engine = 'claude-opus-5'; }
    catch (e) { result = analyzeRuleBased_(records, lines); engine = '규칙 기반 (Claude 실패: ' + String(e.message || e).slice(0, 80) + ')'; }
  } else { result = analyzeRuleBased_(records, lines); engine = '규칙 기반 (API 키 없음)'; }
  result.tables = fixTables_(result.tables, records);
  var at = nowStr_();
  /* 시트 한 칸은 50,000자까지 — 넘치면 대표 글·핵심 문장을 줄여서 저장한다 */
  var js = JSON.stringify(result);
  if (js.length > 48000) { ((result.oneline && result.oneline.groups) || []).forEach(function (g) { g.examples = (g.examples || []).slice(0, 3); }); js = JSON.stringify(result); }
  if (js.length > 48000) { ((result.oneline && result.oneline.groups) || []).forEach(function (g) { g.examples = (g.examples || []).slice(0, 1); }); (result.tables || []).forEach(function (tb) { tb.points = (tb.points || []).map(function (p) { return cut_(p, 120); }); }); js = JSON.stringify(result); }
  if (js.length > 49500) return { ok: false, error: '분석 결과가 너무 큽니다 (' + js.length + '자). 기록을 줄이거나 다시 실행해 주세요' };
  ensureSheets_().getSheetByName(SHEET_ANA).appendRow([at, engine, js]);
  var st = getState_(); st.analyzed = true; st.analyzedAt = Date.now(); st.closed = true; saveState_(st);
  bumpRev_({ analysis: readAnalysis_() });   // 스냅샷 캐시의 analysis 칸도 새 결과로 (saveState_ 는 state 칸만 바꿈) (v3.9)
  result.at = at; result.engine = engine;
  return { ok: true, engine: engine, analysis: result };
}

var ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['tables', 'topics', 'wishes', 'oneline'],
  properties: {
    tables: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['t', 'one', 'points', 'wish', 'kw'], properties: {
      t: { type: 'integer' }, one: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, wish: { type: 'string' }, kw: { type: 'array', items: { type: 'string' } } } } },   // kw: 테이블 핵심어 (v3.10.3)   // 「함께할 일(todo)」은 v3.9.3 에서 삭제 — 기록자 화면에 적는 칸이 없음
    topics: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'sum', 'kw', 'sug'], properties: {
      id: { type: 'integer' }, sum: { type: 'string' }, kw: { type: 'array', items: { type: 'string' } }, sug: { type: 'array', items: { type: 'string' } } } } },
    wishes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'tables'], properties: { text: { type: 'string' }, tables: { type: 'string' } } } },
    oneline: { type: 'object', additionalProperties: false, required: ['sum', 'kw', 'groups'], properties: {
      sum: { type: 'string' },
      kw: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['word', 'n'], properties: { word: { type: 'string' }, n: { type: 'integer' } } } },
      groups: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'n', 'sum', 'examples'], properties: { name: { type: 'string' }, n: { type: 'integer' }, sum: { type: 'string' }, examples: { type: 'array', items: { type: 'string' } } } } } } }
  }
};
var SYSTEM_PROMPT = '당신은 경기도 중장년 정책 포럼의 기록 정리 담당자입니다. 9개 테이블의 토론 기록(기록자가 자유롭게 길게 적은 글)과 참가자들이 등록 때 적은 「오늘의 한줄」을 읽고, 결과공유 화면과 경기도 제출 보고서에 그대로 쓸 수 있게 정리합니다. ' +
  '원문에 없는 사실·숫자·기관명을 지어내지 마십시오. 참가자를 비판하거나 평가하지 말고, 「문제」「미흡」 대신 「의견」「제안」「필요한 것」으로 쓰십시오. ' +
  '화면용 문장(one·sum)은 간결한 문어체 한 문장(70자 이내), 핵심(points)은 개조식 60자 이내, 핵심어(kw)는 2~8자 명사구, 건의(sug·wish)는 경기도·시군이 할 수 있는 일을 45~80자 개조식으로 씁니다.';

function analyzeWithClaude_(key, records, lines) {
  var blocks = [];
  for (var i = 0; i < TOPICS.length; i++) {
    var tp = TOPICS[i]; var part = ['### 주제 ' + tp.id + '. ' + tp.title + ' (' + tp.sub + ') — 테이블 ' + tp.tables.join('·'), '핵심 질문: ' + tp.q];
    for (var j = 0; j < tp.tables.length; j++) {
      var t = tp.tables[j];
      part.push('#### 테이블 ' + t);
      for (var r = 1; r <= 2; r++) {
        var rec = (records[t] || {})[r] || { note: '', wish: '' };
        part.push('- ' + r + '라운드 기록: ' + (rec.note.trim() || '(없음)') + '\n- ' + r + '라운드 바라는 것: ' + (rec.wish.trim() || '(없음)'));
      }
    }
    blocks.push(part.join('\n'));
  }
  var userPrompt = '아래는 「' + EVENT.name + '」 참여토론(주제 4개, 9테이블, 2라운드) 기록과 등록 때 참가자들이 무기명으로 적은 「오늘의 한줄」(' + lines.length + '건)입니다. 테이블의 기록은 1라운드·2라운드 참가자가 다르므로 두 라운드를 합쳐 그 테이블(주제)의 이야기로 정리합니다.\n\n' +
    blocks.join('\n\n') + '\n\n### 오늘의 한줄 (질문: ' + PROMPT + ')\n' + (lines.length ? lines.map(function (o) { return '- ' + o.text + (o.table ? ' [테이블 ' + o.table + ']' : ''); }).join('\n') : '(없음)') + '\n\n' +
    '다음을 JSON 으로만 답하십시오.\n' +
    '1) tables: 9개 테이블 각각 { t(테이블 번호 1~9, 빠짐없이), one(그 테이블의 이야기를 대표하는 한 문장, 70자 이내), points(그 테이블 8명이 나눈 서로 다른 이야기를 빠짐없이 4~6개. 겹치는 이야기는 하나로 합치고, 기록이 짧으면 3개까지 줄여도 됨. 각 60자 이내 개조식으로 누가 어떤 경험·생각을 말했는지가 드러나게), wish(경기도·시군에 바라는 것, 80자 이내. 「바라는 것」 칸을 우선 쓰고 없으면 기록에서 찾되, 없으면 빈 문자열), kw(그 테이블 기록에서 자주 나온 핵심어 4~6개. 각 2~8자의 명사형으로 — 예: "돌봄 품앗이", "아침 루틴", "모임 소개 영상". 서술어·조사 없이, 기록이 비어 있으면 빈 배열) }. 기록이 비어 있는 테이블은 one 에 "기록 없음" 이라고만 쓰고 points 는 빈 배열.\n' +
    '2) topics: 주제 4개 각각 { id, sum(그 주제 테이블들의 논의를 관통하는 한 문장, 70자 내외), kw(핵심어 4~6개), sug(경기도에 대한 건의 2~3개, 테이블의 「바라는 것」을 근거로) }.\n' +
    '3) wishes: 9개 테이블의 「바라는 것」을 비슷한 것끼리 묶어 6~9개로 정리. text 는 45자 내외, tables 는 "테이블 1·3" 처럼 근거 테이블.\n' +
    '4) oneline: 오늘의 한줄 전체를 「같은 뜻·같은 맥락」끼리 묶습니다.\n' +
    '   groups: 글의 실제 내용에 따라 묶음 수를 정하세요(보통 3~8개, 내용이 단순하면 더 적게). 미리 정한 분류를 쓰지 말고 글에서 드러나는 뜻·맥락으로 묶으세요. 모든 글을 정확히 한 묶음에만 넣어 n 의 합이 전체 건수(' + lines.length + ')와 같게 하세요. name 은 2~10자 이름표(예: 다른 모임과의 연결), sum 은 그 묶음이 바라는 것을 한 문장(40자 내외)으로, examples 는 그 묶음을 가장 잘 보여 주는 원문을 그대로 최대 6개(대표적인 것부터, 짧은 것과 긴 것을 섞어, [테이블 n] 표시는 빼고). n 이 큰 순서로.\n' +
    '   kw: 핵심어 8개와 각 언급 건수 n.\n' +
    '   sum: 전체를 2문장으로 요약. 사회자가 그대로 읽을 수 있게 「…습니다」체.';
  function build(effort) {
    return { model: 'claude-opus-5', max_tokens: 16000, system: SYSTEM_PROMPT, thinking: { type: 'adaptive' },
      output_config: { effort: effort, format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } },
      messages: [{ role: 'user', content: userPrompt }] };
  }
  var effort = PropertiesService.getScriptProperties().getProperty('AI_EFFORT') || 'medium';
  var data;
  try { data = anthropicFetch_(key, build(effort), true); }
  catch (e1) { if (!/^API \d/.test(String(e1 && e1.message || ''))) throw e1; data = anthropicFetch_(key, build('low'), true); }   // 시간 초과·네트워크 예외는 바로 규칙 기반으로
  if (data.stop_reason === 'refusal') throw new Error('모델이 응답을 거부했습니다');
  var text = '';
  for (var k = 0; k < data.content.length; k++) if (data.content[k].type === 'text' && data.content[k].text) { text = data.content[k].text; break; }
  if (!text) throw new Error('빈 응답');
  return JSON.parse(text);
}
/** 서버측 폴백 베타(거부 시 다른 모델로 자동 재시도). 조직에 미허용(400)이면 헤더 없이 1회 재시도 */
function anthropicFetch_(key, payload, withFallback) {
  var headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  var body = JSON.parse(JSON.stringify(payload));
  if (withFallback) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', headers: headers, payload: JSON.stringify(body), muteHttpExceptions: true });
  var code = res.getResponseCode(); var txt = res.getContentText();
  if (code === 200) return JSON.parse(txt);
  if (withFallback && code === 400) return anthropicFetch_(key, payload, false);
  throw new Error('API ' + code + ' ' + txt.slice(0, 160));
}

/* ---- 규칙 기반 정리 (API 키가 없거나 실패했을 때) — Common.html 의 MOCK 과 같은 규칙 ---- */
var STOP = ('오늘 여기서 여기 얻어 가고 싶은 하나 것 수 등 더 좀 그리고 그 저 우리 나 내 제 한 줄 있는 없는 대한 위한 위해 같은 정말 너무 조금 뭘 뭐 해 하는 있는지 건지 ' +
  '경우 부분 필요 생각 의견 내용 사람들 정도 이런 저런 그런 통해 대해 관련 때문 다른 다음 어디 어떻게 무엇 조금이라도 직접 실제로 함께 같이 다시 계속 꾸준히 이제 아직 그냥 정말로 조금씩 ' +
  '이야기 말 분 데 때 뒤 전 중 가장 바로 모두 모든 서로 이번 그동안 둘 셋 번째 처음 공통 중심 결론 제안 사례 이유 라운드 테이블 명 분들 분이 말이 것은 것이 것을 것도 했다 있었다 없었다 나왔다 됐다 된다 한다 이었다 였다 많았다 싶다 있다 없다 마무리 미리 먼저 자주 오래 거의 특히 이미 아마 또한 다만 역시 매우 아주 항상 자꾸 금방 우선 결국 과연 마치 더욱 새로 당장 지금 요즘 전혀 별로').split(/\s+/);   // 뒤쪽 줄: 기록문 상투어·부사 (Common.html 의 STOP 과 같아야 함, v3.10.3)
var KEEP = ['경기도','품앗이','어린이','나들이','놀이터','민주주의','시군구','시군별','행복캠퍼스'];   // 조사처럼 끝나지만 그대로 둘 말 (경기도 → 경기 방지)
var VERB_JA = /^(만들|하|열|가|보|쓰|내|나|오|만나|해보|모이|나누|찾|알아보|배우|시작하)자$/;   // 청유형(…하자)
var JOSA = ['으로부터', '에서는', '에게서', '으로써', '이라도', '까지', '부터', '에서', '에게', '으로', '이나', '처럼', '보다', '마다', '조차', '마저', '은', '는', '이', '가', '을', '를', '의', '에', '도', '로', '과', '와', '랑', '만'];
/* 서술어 어미(…싶습니다, …어요 등)를 떼어 낸다. 남은 말이 2자 미만이거나 연결어미(…고/…서/…며)로 끝나는 짧은 말은 버린다 */
var ENDINGS = ['싶습니다', '싶어요', '겠습니다', '했습니다', '습니다', '입니다', '합니다', '했으면', '있으면', '으면', '이에요', '에요', '어요', '아요', '해요', '거든요', '네요', '지요', '고요', '하고', '하는', '했던', '하며', '해서', '어서', '아서', '는지', '은지', '을지', '니다'];
function tokens_(s) {
  var raw = String(s || '').replace(/[^가-힣A-Za-z0-9\s]+/g, ' ').split(/\s+/); var out = [];
  for (var i = 0; i < raw.length; i++) {
    var w = raw[i]; if (!w) continue;
    if (KEEP.indexOf(w) < 0) {
      for (var j = 0; j < JOSA.length; j++) if (w.length > JOSA[j].length + 1 && w.slice(-JOSA[j].length) === JOSA[j]) { w = w.slice(0, -JOSA[j].length); break; }
      for (var k = 0; k < ENDINGS.length; k++) if (w.length > ENDINGS[k].length && w.slice(-ENDINGS[k].length) === ENDINGS[k]) { w = w.slice(0, -ENDINGS[k].length); break; }
    }
    if (w.length < 2 || STOP.indexOf(w) >= 0) continue;
    if (/^것/.test(w) || /다$/.test(w)) continue;   // 「것…」·서술어(…했다·…이었다)
    if ((w.length <= 3 && /[고서며]$/.test(w)) || (w.length >= 4 && /[고서며면]$/.test(w)) || (w.length === 3 && /면$/.test(w))) continue;   // 연결어미꼴(…하고·…해서·…하며·…하면)
    if (/[한든려]$/.test(w) || (w.length === 2 && /드$/.test(w)) || VERB_JA.test(w)) continue;   // 관형·연결·청유형(시작한·만든·늘려·만드·만들자) (v3.10.3)
    out.push(w);
  }
  return out;
}
/* 테이블 핵심어(규칙): 두 번 이상 나온 말을 먼저, 3개가 안 되면 한 번 나온 말 중 명사꼴(…한·…든·…려·…자·…고 등 서술어꼴 제외)로 채운다 (v3.10.3) */
function tableKw_(texts, n) {
  var f = {}; texts.forEach(function (t) { tokens_(t).forEach(function (w) { f[w] = (f[w] || 0) + 1; }); });
  var ws = Object.keys(f).sort(function (a, b) { return f[b] - f[a] || a.localeCompare(b); });
  var out = ws.filter(function (w) { return f[w] >= 2; }).slice(0, n); var min = Math.min(n, 4);
  if (out.length < min) ws.forEach(function (w) { if (out.length < min && f[w] < 2 && out.indexOf(w) < 0 && !/[한든려드자고서며면들]$/.test(w)) out.push(w); });
  return out;
}
function topWords_(texts, n) {
  var f = {}; texts.forEach(function (t) { tokens_(t).forEach(function (w) { f[w] = (f[w] || 0) + 1; }); });
  return Object.keys(f).sort(function (a, b) { return f[b] - f[a] || a.localeCompare(b); }).slice(0, n);
}
/* 문장 나누기: 마침표·물음표·느낌표·줄바꿈 기준 (MOCK 의 sentences 와 같음) */
function sentences_(s) {
  var m = String(s || '').replace(/\r/g, '').match(/[^.!?\n。]+[.!?。]?/g) || [];
  return m.map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 2; });
}
function cut_(s, n) { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
/* 테이블의 1·2라운드 기록·바라는 것을 합친다 */
function recText_(records, t) {
  var notes = [], wishes = [];
  for (var r = 1; r <= 2; r++) { var x = (records[t] || {})[r] || {}; var nt = String(x.note || '').trim(), ws = String(x.wish || '').trim(); if (nt) notes.push(nt); if (ws) wishes.push(ws); }
  return { note: notes.join('\n'), wish: wishes.join(' / ') };
}
/* 규칙: one = 기록 첫 문장(≤70자), points = 그다음 문장 최대 6개(같은 문장은 한 번), wish = 바라는 것(≤80자) */
function tableRule_(records, t) {
  var x = recText_(records, t); var ss = sentences_(x.note); var seen = {};
  var rest = (ss.length > 1 ? ss.slice(1) : ss.slice(0, 1)).filter(function (p) { var k = p.replace(/\s+/g, ''); if (seen[k]) return false; seen[k] = true; return true; });
  return { t: t, one: cut_(ss[0] || '', 70), points: rest.slice(0, 6).map(function (p) { return cut_(p, 90); }), wish: cut_(x.wish, 80), kw: tableKw_([x.note, x.wish], 6) };   // 핵심은 한 문장(첫 문장) 다음 문장들로 — 첫 문장이 두 번 보이지 않게 · kw: 자주 나온 말 (v3.10.3)
}
/* Claude 결과의 tables 를 9건·번호순으로 맞추고, 빠진 테이블은 규칙으로 채운다 */
function fixTables_(tables, records) {
  var by = {}; (Array.isArray(tables) ? tables : []).forEach(function (x) { if (isObj_(x) && isInt_(Number(x.t), 1, TABLE_COUNT)) by[Number(x.t)] = x; });
  var out = [];
  for (var t = 1; t <= TABLE_COUNT; t++) {
    var x = by[t];
    if (!x) { out.push(tableRule_(records, t)); continue; }
    var kw = (Array.isArray(x.kw) ? x.kw : []).map(function (k) { return str_(k, 16).trim(); }).filter(Boolean).slice(0, 6);
    if (!kw.length) { var rt = recText_(records, t); kw = tableKw_([rt.note, rt.wish], 6); }   // Claude 가 안 주면 규칙으로 (v3.10.3)
    out.push({ t: t, one: str_(x.one, 120), points: (Array.isArray(x.points) ? x.points : []).slice(0, 6).map(function (p) { return str_(p, 120); }), wish: str_(x.wish, 160), kw: kw });
  }
  return out;
}
var CATS = [['사람·연결', ['연락처', '사람', '모임', '연결', '네트워크', '만남', '친구', '동료', '대표', '같이']], ['정보·방법', ['정보', '방법', '힌트', '노하우', '사례', '자료', '팁', '배움', '어디서']], ['정책·경기도', ['경기도', '정책', '지원', '제도', '예산', '도청', '시군']], ['마음·용기', ['용기', '위로', '공감', '힘', '확인', '마음', '응원', '자신감', '혼자']]];
function analyzeRuleBased_(records, lines) {
  var tables = [];
  for (var t0 = 1; t0 <= TABLE_COUNT; t0++) tables.push(tableRule_(records, t0));
  var topics = [];
  for (var i = 0; i < TOPICS.length; i++) {
    var tp = TOPICS[i]; var texts = [], sug = [];
    tp.tables.forEach(function (t) { var x = recText_(records, t); if (x.note) texts.push(x.note); if (x.wish) { texts.push(x.wish); sug.push(x.wish + ' (테이블 ' + t + ')'); } });
    var kw = topWords_(texts, 6);
    topics.push({ id: tp.id, sum: '테이블 ' + tp.tables.join('·') + ' 기록에서 자주 나온 말: ' + (kw.join(', ') || '(기록 없음)'), kw: kw, sug: sug });
  }
  var wishes = [];
  for (var t = 1; t <= TABLE_COUNT; t++) { var w = recText_(records, t).wish; if (w) wishes.push({ text: w, tables: '테이블 ' + t }); }
  var groups = CATS.map(function (c) { return { name: c[0], n: 0, sum: '', examples: [], keys: c[1] }; }); var other = { name: '그 밖에', n: 0, sum: '', examples: [], keys: [] };
  lines.forEach(function (o) {
    var hit = null; for (var k = 0; k < groups.length; k++) { if (groups[k].keys.some(function (x) { return o.text.indexOf(x) >= 0; })) { hit = groups[k]; break; } }
    hit = hit || other; hit.n++; if (hit.examples.length < 6) hit.examples.push(o.text);
  });
  groups.push(other);
  groups = groups.filter(function (g) { return g.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  groups.forEach(function (g) { g.sum = g.name + ' 관련 ' + g.n + '건 (키워드 규칙으로 묶음)'; delete g.keys; });
  var f = {}; lines.forEach(function (o) { tokens_(o.text).forEach(function (w) { f[w] = (f[w] || 0) + 1; }); });
  var lkw = Object.keys(f).sort(function (a, b) { return f[b] - f[a] || a.localeCompare(b); }).slice(0, 8).map(function (w) { return { word: w, n: f[w] }; });
  return { tables: tables, topics: topics, wishes: wishes, oneline: { sum: '오늘의 한줄 ' + lines.length + '건이 모였습니다. 자주 나온 말은 ' + (lkw.slice(0, 5).map(function (x) { return x.word; }).join(', ') || '(없음)') + ' 입니다.', kw: lkw, groups: groups } };
}

/* ============================================================
 *  리허설용 예시 데이터 (시트 메뉴) — 실제 행사 전 「전체 비우기」로 지운다. Common.html 의 mockFillDemo 와 같은 내용
 * ========================================================== */
var DEMO_RECORDS = {
  1: [['부모님 병원 동행과 손주 돌봄이 겹치면서 정작 내 건강검진은 3년째 미루고 있다는 이야기가 많았다. 돌봄을 하는 사람이 쉴 수 있는 시간이 없다는 점에 모두 공감했다. 같은 처지의 이웃이 잠깐 대신 봐 주는 품앗이가 실제로 큰 도움이 됐다는 경험이 나왔다.', '돌봄 가족 대상 단기 휴식 지원과 상담 창구를 한 곳에서 안내해 주면 좋겠다'],
    ['2라운드에서는 돌봄 비용 문제가 중심이었다. 장기요양 등급 신청 절차를 몰라 몇 달을 허비했다는 분이 두 명 있었다. 정보가 흩어져 있어 중장년 눈높이로 정리된 안내서가 필요하다는 데 뜻이 모였다.', '장기요양·긴급돌봄·비용 정보를 한 장으로 정리한 안내서']],
  2: [['건강 루틴을 혼자 지키기 어렵다는 이야기가 먼저 나왔다. 아침 걷기 인증방을 만들어 서로 확인해 주니 3개월을 이어 갔다는 사례가 있었다. 몸이 먼저 무너지면 돌봄도 못 한다는 말에 모두 고개를 끄덕였다.', '행복캠퍼스에 돌봄 가족 대상 건강·심리 프로그램을 정규 개설해 주면 좋겠다'],
    ['마음 건강 이야기가 많았다. 돌봄 중에 우울감을 느껴도 어디에 말할 데가 없었다는 경험이 여러 명에게서 나왔다. 월 1회 돌봄 수다회처럼 가볍게 모이는 자리가 필요하다는 제안이 있었다.', '돌봄 경험자끼리 모이는 수다회 공간과 소액 운영비']],
  3: [['나를 지탱해 준 것은 제도가 아니라 같은 처지의 이웃 한 사람이었다는 말이 인상적이었다. 시군마다 돌봄 경험자 연락망이 있으면 좋겠다는 의견이 나왔다. 모임 장소를 구하기 어렵다는 현실적인 문제도 함께 이야기했다.', '시군별 돌봄 경험자 연락망과 행복캠퍼스의 모임 장소 제공'],
    ['배우자 간병을 하는 남성 참가자의 이야기가 중심이 됐다. 남성 돌봄자는 정보도 모임도 찾기 어렵다는 점이 공통으로 나왔다. 돌봄 교육을 남성 눈높이로 따로 열어 달라는 요청이 있었다.', '남성 돌봄자 대상 돌봄 교육과 모임 지원']],
  4: [['퇴직 후 평일 오전 10시에 갈 곳이 없다는 것이 가장 큰 변화였다는 데 모두 공감했다. 요일별로 오전 모임을 커뮤니티끼리 나눠 열면 매일 갈 곳이 생긴다는 아이디어가 나왔다. 커피 한 잔 값이면 충분하니 공간만 있으면 된다는 말이 있었다.', '행복캠퍼스 평일 오전 개방 공간과 저렴한 이용료'],
    ['명함 없이 이름으로 불리는 데 1년이 걸렸다는 이야기로 시작했다. 직함이 사라진 뒤 관계를 새로 맺는 법을 배운 적이 없다는 고백이 이어졌다. 퇴직 전에 관계와 일상을 미리 설계하는 프로그램이 있었으면 좋았겠다는 의견이 많았다.', '퇴직 예정자 대상 관계·일상 설계 프로그램을 회사와 연계해 사전 안내']],
  5: [['하루 리듬을 다시 만드는 데 가장 도움이 된 것은 정해진 시간에 만나는 사람이었다. 동네 도서관 독서 모임이 일상의 축이 됐다는 사례가 있었다. 혼자 있는 시간이 길어지면 외출 자체가 어려워진다는 경험도 나왔다.', '동네 단위로 소규모 모임을 열 수 있는 공간 정보 제공'],
    ['가족과의 관계 변화가 주제였다. 하루 종일 집에 있으니 배우자와 부딪히는 일이 늘었다는 이야기가 많았다. 부부가 함께 참여하는 프로그램이 있으면 좋겠다는 제안이 나왔다.', '퇴직 후 부부 관계 프로그램과 상담 연계']],
  6: [['첫 모임의 문턱은 정보가 아니라 나 같은 사람이 있을까 하는 마음이었다는 데 모두 동의했다. 신규 참가자에게 동행 회원 한 명을 붙여 주는 짝꿍 방식이 효과가 있었다는 경험이 나왔다. 모집 문구가 딱딱하면 아예 연락을 못 한다는 지적도 있었다.', '경기도 중장년 커뮤니티 지도와 첫 방문 체험권'],
    ['아직 모임에 나가지 못하는 이유를 솔직하게 나눴다. 시간과 비용보다 내가 껴도 될까 하는 마음이 더 컸다는 말이 많았다. 첫날 프로그램을 통일해서 누구나 같은 출발선에 서게 하자는 제안이 나왔다.', '모집 문구를 경력 무관·첫 방문 환영으로 바꾸는 안내 지침']],
  7: [['내일센터나 행복캠퍼스 상담을 받을 때 커뮤니티를 함께 소개받았으면 좋았겠다는 의견이 나왔다. 상담과 모임이 따로 돌아간다는 점이 아쉽다고 했다. 상담 창구에서 모임 체험을 바로 연결하는 절차가 필요하다는 데 뜻이 모였다.', '내일센터·행복캠퍼스 상담 시 커뮤니티를 함께 소개하는 연계 절차'],
    ['온라인으로 먼저 얼굴을 익히고 나가면 부담이 줄었다는 경험이 공유됐다. 모임 전에 짧은 온라인 소개 시간을 두자는 제안이 있었다. 교통이 불편한 지역은 이동 지원이 있어야 참여가 가능하다는 이야기도 나왔다.', '외곽 지역 참가자를 위한 이동 지원과 온라인 사전 모임 도구']],
  8: [['우리 모임 하나로는 작지만 31개 시군이 이으면 정책이 된다는 말에 공감이 모였다. 시군 커뮤니티 대표 연락망을 만들고 분기마다 온라인 교류회를 열자는 제안이 나왔다. 서로의 행사에 가 주는 것부터 시작하자는 구체적인 약속도 있었다.', '경기도 중장년 커뮤니티 네트워크 협의체 구성과 연 1회 포럼 정례화'],
    ['경기도가 열어 줘야 할 문으로 공간 예약과 소액 활동비가 꼽혔다. 공동 프로젝트를 하려 해도 모일 장소가 없다는 현실이 반복됐다. 커뮤니티끼리 품앗이로 강사를 교환하자는 아이디어도 나왔다.', '커뮤니티 간 공동 프로젝트용 소액 활동비와 공간 예약 우선권']],
  9: [['연결의 첫 행동은 거창한 사업이 아니라 서로의 행사에 가 주는 것이라는 데 모두 동의했다. 다음 달부터 이웃 커뮤니티 행사에 참여하고 결과를 나누기로 했다. 경기도 누리집에 커뮤니티 행사 달력이 있으면 좋겠다는 의견이 있었다.', '경기도 중장년 커뮤니티 행사 달력(온라인) 운영'],
    ['시군 경계를 넘는 교류가 거의 없다는 점이 지적됐다. 고양과 파주처럼 가까운 시군부터 합동 행사를 열어 보자는 제안이 나왔다. 성과를 경기도에 보고하는 통로가 있으면 지속될 것이라는 이야기로 마무리했다.', '인접 시군 합동 행사 지원과 성과 보고 통로']]
};
/* [내용, 테이블 번호] — 테이블 1~9 에 고르게 */
var DEMO_LINES = [['다른 시 모임 대표 연락처 하나', 1], ['우리 모임이 뭘 더 할 수 있는지 힌트', 2], ['나만 힘든 게 아니라는 확인', 3], ['경기도가 실제로 뭘 해 줄 수 있는지', 4], ['돌봄 정보 어디서 찾는지', 5], ['다음에 같이 할 사람', 6],
  ['평일 오전에 갈 곳', 7], ['용기', 8], ['같은 고민을 하는 사람들과의 만남', 9], ['우리 동네에서 시작할 수 있는 작은 일 하나', 1], ['퇴직 후 하루를 채우는 방법', 2], ['부모님 돌봄과 내 건강을 함께 챙기는 요령', 3],
  ['모임을 꾸준히 이어 가는 노하우', 4], ['행복캠퍼스 프로그램 정보', 5], ['내 경험이 누군가에게 쓸모 있다는 느낌', 6], ['시군을 넘어 함께할 동료', 7], ['정책에 우리 목소리가 들어가는 통로', 8], ['새로 시작할 용기와 응원', 9],
  ['첫 모임에 나갈 때 덜 떨리는 방법', 1], ['돌봄하는 사람끼리의 연락망', 2], ['혼자가 아니라는 마음', 3], ['우리 모임을 알릴 기회', 4], ['경기도 지원 사업 신청 방법', 5], ['오늘 만난 사람 한 명과 다음 약속', 6]];
var DEMO_SURNAME = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황'];
var DEMO_GIVEN = ['영희', '철수', '민수', '지영', '수진', '현우', '미경', '성호', '은주', '정민', '상훈', '혜진', '동현', '소영', '재원', '경자', '영수', '미숙', '준호', '선희', '태호', '나영', '병철', '은정'];
/* 테이블 9 × 라운드 2 × 8명 예시 이름 (mockFillDemo 와 같은 규칙) */
function demoRoster_() {
  var o = {};
  for (var t = 1; t <= TABLE_COUNT; t++) { o[t] = { 1: [], 2: [] }; for (var r = 1; r <= 2; r++) for (var i = 0; i < 8; i++) o[t][r].push(DEMO_SURNAME[(t * 3 + r * 5 + i) % DEMO_SURNAME.length] + DEMO_GIVEN[(t * 7 + r * 11 + i * 3) % DEMO_GIVEN.length]); }
  return o;
}
function demoProgram_() {
  var p = JSON.parse(JSON.stringify(DEFAULT_PROGRAM));
  p.greet = [{ name: '김영희', title: '경기도 중장년 행복캠퍼스 (예시)', kind: 'greet' }, { name: '박철수', title: '경기도청 (예시)', kind: 'cong' }];
  p.speakers[0].name = '이정민'; p.speakers[1].name = '최수진'; p.speakers[2].name = '정호영';
  p.roster = demoRoster_();
  p.communities = ['고양 늘푸른 걷기회', '파주 책읽는 오후', '수원 N잡 연구소', '성남 돌봄 품앗이', '안산 다시 시작 합창단', '용인 인생 2막 사진반'];
  return p;
}
function fillDemoData() {
  var ss = ensureSheets_();
  var rc = ss.getSheetByName(SHEET_REC); var rows = [];
  for (var t = 1; t <= TABLE_COUNT; t++) for (var r = 1; r <= 2; r++) { var d = DEMO_RECORDS[t][r - 1]; rows.push([d[0], d[1], nowStr_(), demoDone_(t, r)]); }   // 두 칸(4번 2라운드·7번 1라운드)은 「작성 중」으로 남겨 현황 색을 보여 준다
  rc.getRange(2, 4, rows.length, 4).setValues(rows);
  var sh = ss.getSheetByName(SHEET_LINES); var lrows = [];
  DEMO_LINES.forEach(function (x, i) { lrows.push(['demo' + i, Date.now() - (DEMO_LINES.length - i) * 60000, nowHM_(), x[0], 'demo' + i, false, false, 0, i % 2 === 0, x[1]]); });
  sh.getRange(sh.getLastRow() + 1, 1, lrows.length, H_LINES.length).setValues(lrows);
  /* 프로그램은 비어 있는 칸만 예시로 채운다 — 콘솔에서 이미 넣은 인사말·발표자·명단·커뮤니티·트렌드·수치는 그대로 (v3.9.9) */
  var cur = readProgram_(), demo = normalizeProgram_(demoProgram_());
  if (!cur.greet.some(function (g) { return String(g.name || g.title || "").trim(); })) cur.greet = demo.greet;
  if (!cur.speakers.some(function (x) { return String(x.name || "").trim(); })) cur.speakers = demo.speakers;
  var rosterN = 0; for (var rt = 1; rt <= TABLE_COUNT; rt++) { var ro = cur.roster[rt] || {}; rosterN += (ro[1] || []).length + (ro[2] || []).length; } if (!rosterN) cur.roster = demo.roster;
  if (!cur.communities.length) cur.communities = demo.communities;
  writeProgram_(JSON.stringify(cur));
  bumpRev_();
  SpreadsheetApp.getActive().toast('예시 데이터(기록 18건·한줄 24건·프로그램·명단)를 채웠습니다. 행사 전 「전체 비우기」로 지우세요.', '발표보드', 6);
}

/* 로고 (경기도 CI 심볼 · 경기 중장년 행복캠퍼스 심볼) — 외부 링크 없이 파일에 직접 포함 (이전 정책간담회 보드와 동일) */
var LOGO_GG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAy4AAAEsCAYAAAAl5OeJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAFkJSURBVHhe7Z0JeF1Vub/TMtg2e307SVuwDDIINCkFxEKTliR7feskpSooInG8KnoVxfnvPIAR4Qq1U85ea+9zTtKBQVHrRRxAVFT0ogiOiIBMCgIyz7QMnfJ/1jrnpOluwdLm5Ey/93neh8q9QJKzsvb67bXW9zUcmpkzty3q+GBbZu6S1rg92xa367ZMewghrDY7jP39bY3bF8/KdHxgVqZzVkOZmT3UvndrNHdBW6bjs/ZrbM20Z7b9uiGEFa9dG8Qdkf1za9xxTlvU/paZev4+yd/58aRvTd9urzQdh8zKzeubmW0/qzVuz7RmOuJtvnYIYVVr1w6tmfaVrdm5n2iYmZl7SmvccVFrpv32tlzHQ22Z9vva4vZ7IYTV5axsx33297c17ritNdNxYVt2Xir5oB9vZpmOQ2ZmOz7aFrf/1H2duY4Hk183hLAKzLT/uy3bcb/9c2um/S8z447zDsvNa03+zo8nc3Jz9miN53bMzM77Wmum/fdt2fYH27IdD2zztUMIq1u7dhia99isuP37Da2Zjne1xe1XtGY61h6+cv5wW3becFumYzOEsLqcNTjP/f62Ztqfbs12XN6anfu65IN+vDk8am9ry3Z8sTXT/mf3Na6Yj/kFwmo02zHs5phMx+bWTMf99oTGzGzHEcnf+fHEBpe27Lxuu8vSmum4e9bQ/OFZQ1jDQFhr2rXD7As7h9vi9t82zMy0nzorar+yNe5YP/v844bdL/7gPAhhlWlfPNjf37ZM+3NtmY6fzswec2LyQT/ezErPndU2OO+Mtqj9b+5rXH3cNl83hLAKHCrMMfnw8sjMTPvQYUPtRyZ/58cTt+OS6whmZjpyNkwdvuq44cNXYQ0DYa1p1w5HfLNruC1qvy6/4xK1/6Q10/6M/YVvy9m3th0QwirTvWnMuR2Xta3Zjh9XzI5Lpv1LrXH79e5rdLu6237tEMIKN1eYY7Idw62ZjgdmRnNzFbPjkr/bco99KztrBdYwENaadu0w+yK343LNlqNicce6UUfFIIRVpn0rUbFHxeL2v7ivMX9UDEJYbW45KmaDS6UfFYMQ1pBbHRVDcIGwNkRwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCBEJZMBBcIYZlEcIGwBkVwgRCWTAQXCGGZRHCBsAZFcIEQlkwEFwhhmURwgbAGRXCB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';
var LOGO_HC = 'data:image/png;base64,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';
