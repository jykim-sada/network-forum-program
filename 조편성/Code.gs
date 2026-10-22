/**
 * 경기도 중장년 네트워크 포럼 — 조편성 (자동 새로 고침)
 * 원본 두 시트(신청 명단 「참석자 명단」 탭 · 사전 설문 응답)를 읽고,
 * 결과는 「결과를 쓸 시트」(기본: 신청 명단 스프레드시트)에 「조편성 …」 탭으로 쓴다. 원래 탭은 건드리지 않는다.
 * 실제 운영: 신청 명단 시트의 「확장 프로그램 → Apps Script」에 Logic.gs + Code.gs 를 합친 파일을 붙여 넣어 씀
 *   (시트 소유 계정으로 실행되어 공유가 필요 없음). 보조 시트 방식은 개인 gmail 계정 권한 문제로 중단.
 *
 * 메뉴 「조편성」
 *   처음 설정      : 설정 탭 만들기 → 권한 승인 → 첫 배정 → 10분마다 자동 새로 고침 켜기
 *   지금 새로 고침  : 새 응답만 빈자리에 배정 (이미 배정된 사람·손으로 고친 테이블 번호는 그대로)
 *   전체 다시 배정  : 지금 응답 전체를 처음부터 다시 배정 (손으로 고친 값도 사라짐)
 */

var SRC_DEFAULT = {
  '신청 명단 시트 ID': '1bnLOIeTxLpYNtnYvKA1K_fvonoHGuzxmYK48MMb--cU',
  '신청 명단 탭 gid': '1188195971',
  '설문 응답 시트 ID': '1UHd10cyEPSDNNlezv2hxzEdImOFG6uL30UxKCO7JoR4',
  '설문 응답 탭 gid': '58738434',
  '테이블당 정원': '8',
  '결과를 쓸 시트 ID': '1bnLOIeTxLpYNtnYvKA1K_fvonoHGuzxmYK48MMb--cU',
  '배정 우선 기준': '1·2순위 우선'   // 또는 '4순위 회피 우선' — 「전체 다시 배정」 때 적용
};
// 신청 명단 스프레드시트 안에 붙는 탭. 기존 탭과 겹치지 않게 모두 「조편성」으로 시작한다.
var TAB = { guide: '조편성 요약', roster: '조편성', tables: '조편성 테이블별', merged: '조편성 제출현황', issues: '조편성 확인필요', paste: '조편성 보드붙여넣기', config: '조편성 설정' };
var TAB_ORDER = ['guide', 'roster', 'tables', 'merged', 'issues', 'paste'];   // 결과 시트에 만드는 탭 (설정 탭은 보조 시트에만)
var NAVY = '#0E4194';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('조편성')
    .addItem('처음 설정 (한 번만)', 'setup')
    .addItem('지금 새로 고침', 'refreshNow')
    .addSeparator()
    .addItem('전체 다시 배정 (희망 최대 반영)…', 'reassignAll')
    .addSeparator()
    .addItem('자동 새로 고침 켜기 (10분마다)', 'autoOn')
    .addItem('자동 새로 고침 끄기', 'autoOff')
    .addToUi();
}

function setup() {
  ensureConfig_();
  var r = refresh_(false);
  autoOn_();
  SpreadsheetApp.getUi().alert('설정 완료',
    '설문 제출·참석 ' + r.count.target + '명 중 ' + r.count.assigned + '명을 배정했습니다. 확인필요 ' + r.issues.length + '건.\n\n' +
    '결과는 「' + r.targetName + '」 스프레드시트의 「조편성 …」 탭에 있습니다:\n' + r.targetUrl +
    '\n\n10분마다 자동으로 새 응답을 반영합니다.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function refreshNow() {
  var r = refresh_(false);
  SpreadsheetApp.getActive().toast('배정 ' + r.count.assigned + '명 · 확인필요 ' + r.issues.length + '건', '조편성 새로 고침 완료', 5);
}

function reassignAll() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('전체 다시 배정', '지금까지의 배정과 손으로 고친 테이블 번호를 모두 지우고, 전체를 보고 희망을 최대한 반영해 다시 배정합니다(「조편성 설정」의 배정 우선 기준 적용). 계속할까요?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var r = refresh_(true);
  SpreadsheetApp.getActive().toast('배정 ' + r.count.assigned + '명 · 확인필요 ' + r.issues.length + '건', '전체 다시 배정 완료', 5);
}

function autoOn() { autoOn_(); SpreadsheetApp.getActive().toast('10분마다 새 응답을 반영합니다.', '자동 새로 고침 켬', 5); }
function autoOff() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'timedRefresh') ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActive().toast('자동 새로 고침을 껐습니다. 메뉴 「지금 새로 고침」으로 반영하세요.', '자동 새로 고침 끔', 5);
}
function autoOn_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'timedRefresh'; });
  if (!has) ScriptApp.newTrigger('timedRefresh').timeBased().everyMinutes(10).create();
}
function timedRefresh() { refresh_(false); }

/* ---------- 설정 ---------- */

/** 설정 탭이 있는 스프레드시트. 메뉴·트리거는 열린 시트, 현황 주소(웹 앱)에서는 ID 로 연다 */
function home_() {
  var ss = null; try { ss = SpreadsheetApp.getActive(); } catch (e) {}
  return ss || SpreadsheetApp.openById(SRC_DEFAULT['결과를 쓸 시트 ID']);
}

// 1·2라운드 모두 같은 테이블에 앉힐 사람들 (설정 탭 「동석 그룹 N」 칸에 동석 그룹 줄이 하나도 없을 때만 쓰는 처음 값)
var DEFAULT_GROUPS = ['임종희, 김영준, 변성진, 박경민'];

function ensureConfig_() {
  var ss = home_();
  if (!ss.getSheetByName(TAB.config)) ss.insertSheet(TAB.config, ss.getSheets().length);   // 원래 탭 뒤에
}

/** 설정 탭 읽기. cfg._groups = 동석 그룹 글자 목록 */
function readConfig_() {
  var cfg = {}; Object.keys(SRC_DEFAULT).forEach(function (k) { cfg[k] = SRC_DEFAULT[k]; });
  var groups = [], hasGroupRows = false;
  var sh = home_().getSheetByName(TAB.config);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    var k = String(r[0]).trim();
    if (/^동석 그룹/.test(k)) { hasGroupRows = true; if (String(r[1]).trim()) groups.push(String(r[1]).trim()); }
    else if (k && r[1] && cfg.hasOwnProperty(k)) cfg[k] = String(r[1]).trim();
  });
  cfg._groups = hasGroupRows ? groups : DEFAULT_GROUPS.slice();
  return cfg;
}

/** 설정 탭을 늘 같은 모양으로 다시 쓴다(값은 읽은 그대로). 동석 그룹은 쓰인 것 + 빈 줄 하나 */
function writeConfig_(cfg, res) {
  var sh = home_().getSheetByName(TAB.config); if (!sh) return;
  var rows = [['항목', '값']];
  Object.keys(SRC_DEFAULT).forEach(function (k) { rows.push([k, cfg[k]]); });
  var g0 = rows.length;
  cfg._groups.concat(['']).forEach(function (g, i) { rows.push(['동석 그룹 ' + (i + 1), g]); });
  rows.push(['', '']);
  rows.push(['결과 보는 곳', res ? res.targetUrl : '']);
  rows.push(['마지막 새로 고침', res ? Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '(실행 중이거나 오류)']);
  rows.push(['마지막 전체 다시 배정', PropertiesService.getScriptProperties().getProperty('lastReassign') || '(아직 없음)']);
  rows.push(['', '']);
  rows.push(['안내', '시트 ID 는 주소의 /d/ 와 /edit 사이, gid 는 주소 끝 gid= 뒤 숫자. 테이블당 정원을 바꾸면 다음 새로 고침부터 적용.']);
  rows.push(['', '배정 우선 기준: 「1·2순위 우선」(원하는 두 주제 그대로 받는 사람 최대) 또는 「4순위 회피 우선」(4순위 받는 사람 최소). 바꾼 뒤 「전체 다시 배정」을 눌러야 적용.']);
  rows.push(['', '동석 그룹: 이름을 쉼표로 구분해 적으면 1·2라운드 모두 같은 테이블에 앉힘. 설문을 안 낸 사람도 배정함(불참은 제외). 새 그룹은 맨 아래 빈 「동석 그룹」 칸에.']);
  sh.clear();
  sh.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  styleHead_(sh, 2);
  sh.getRange(g0 + 1, 1, cfg._groups.length + 1, 2).setBackground('#FFF2CC');
  sh.getRange(rows.length - 7, 1, 8, 1).setFontWeight('bold');
  sh.getRange(rows.length - 2, 2, 3, 1).setWrap(true);
  sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 520);
}

/** 권한 오류일 때 어느 시트인지, 누구 계정으로 실행 중인지 알려 준다 */
function openBook_(id, label, need) {
  try { return SpreadsheetApp.openById(id); }
  catch (e) {
    var me = ''; try { me = Session.getEffectiveUser().getEmail(); } catch (x) {}
    throw new Error('「' + label + '」 시트를 열 권한이 없습니다. 그 시트의 「공유」에서 ' + (me || '이 스크립트 계정') + ' 을(를) ' + need + '(으)로 추가해 주세요. (시트 ID ' + id + ')');
  }
}
function sourceSheet_(id, gid, label) {
  var ss = openBook_(id, label, '뷰어 이상');
  var hit = ss.getSheets().filter(function (s) { return String(s.getSheetId()) === String(gid); })[0];
  if (!hit) throw new Error('원본 시트에서 gid ' + gid + ' 탭을 찾지 못했습니다: ' + ss.getName());
  return hit;
}

/** 조편성 탭에 지금 적힌 테이블 번호(운영진이 고친 값 포함)를 읽는다 */
function readPrev_(out) {
  var sh = out.getSheetByName(TAB.roster), prev = {};
  if (!sh || sh.getLastRow() < 2) return prev;
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = v[0].map(String), k = h.indexOf('구분키'), a = h.indexOf('1라운드 테이블'), b = h.indexOf('2라운드 테이블');
  if (k < 0 || a < 0 || b < 0) return prev;
  for (var i = 1; i < v.length; i++) if (v[i][k]) prev[v[i][k]] = { t1: Number(v[i][a]) || 0, t2: Number(v[i][b]) || 0 };
  return prev;
}

/* ---------- 새로 고침 ---------- */

function refresh_(reset, forceMode) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('다른 새로 고침이 진행 중입니다. 잠시 뒤 다시 눌러 주세요.');
  try {
    ensureConfig_();
    var cfg = readConfig_(), cap = Math.max(1, Number(cfg['테이블당 정원']) || 8);
    if (forceMode) cfg['배정 우선 기준'] = forceMode === '4' ? '4순위 회피 우선' : '1·2순위 우선';
    writeConfig_(cfg, null);
    var appSh = sourceSheet_(cfg['신청 명단 시트 ID'], cfg['신청 명단 탭 gid'], '신청 명단');
    var surSh = sourceSheet_(cfg['설문 응답 시트 ID'], cfg['설문 응답 탭 gid'], '설문 응답');
    var applicants = parseApplicants_(appSh.getDataRange().getValues());
    var responses = parseResponses_(surSh.getDataRange().getValues());
    var ss = openBook_(cfg['결과를 쓸 시트 ID'], '결과를 쓸(신청 명단)', '편집자');
    ensureTabs_(ss);
    var res = runAll_(applicants, responses, reset ? {} : readPrev_(ss), cap, cfg._groups, reset ? (/4/.test(cfg['배정 우선 기준']) ? '4' : '12') : false);
    writeRoster_(ss, res);
    writeTables_(ss, res, cap);
    writeMerged_(ss, res);
    writeIssues_(ss, res);
    writePaste_(ss, res);
    writeGuide_(ss, res, cap, cfg, appSh, surSh, applicants.length, responses.length);
    res.targetName = ss.getName(); res.targetUrl = ss.getUrl();
    if (reset) {   // 전체 다시 배정 결과를 남겨 둔다(확인필요 탭은 10분마다 다시 쓰여 지워지므로)
      var opt = res.issues.filter(function (i) { return i.kind === '최적화'; })[0];
      PropertiesService.getScriptProperties().setProperty('lastReassign', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') +
        ' · ' + (cfg['배정 우선 기준'] || '') + ' · ' + (opt ? opt.detail : '맞교환할 자리가 없었음(이미 최선)'));
    }
    var fresh = readConfig_();   // 새로 고침 도중 설정 탭을 고쳤으면 그 값을 살린다
    if (forceMode) fresh['배정 우선 기준'] = cfg['배정 우선 기준'];
    writeConfig_(fresh, res);
    return res;
  } finally { lock.releaseLock(); }
}

/* ---------- 쓰기 ---------- */

/** 조편성 탭들을 정해진 순서로 맨 뒤에 만든다(이미 있으면 그대로). 기존 탭 앞에는 끼워 넣지 않는다 */
function ensureTabs_(ss) {
  TAB_ORDER.forEach(function (k) { if (!ss.getSheetByName(TAB[k])) ss.insertSheet(TAB[k], ss.getSheets().length); });
}
function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name, ss.getSheets().length);
}
function reset_(sh) {
  var flt = sh.getFilter(); if (flt) flt.remove();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
}
function styleHead_(sh, ncol, row) {
  sh.getRange(row || 1, 1, 1, ncol).setFontWeight('bold').setBackground(NAVY).setFontColor('#FFFFFF').setVerticalAlignment('middle').setWrap(true);
}
function put_(sh, rows, r0) {
  if (!rows.length) return;
  var w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  rows = rows.map(function (r) { var x = r.slice(); while (x.length < w) x.push(''); return x; });
  sh.getRange(r0 || 1, 1, rows.length, w).setValues(rows);
}
function topicFill_(label) {
  var m = String(label).match(/주제\s*([1-4])/); var t = m ? topicById_(Number(m[1])) : null;
  return t ? t.fill : null;
}

function writeRoster_(ss, res) {
  var sh = sheet_(ss, TAB.roster, 1); reset_(sh);
  var rows = res.out.roster; put_(sh, rows);
  sh.getRange(2, 2, Math.max(1, rows.length - 1), 1).setNumberFormat('@');
  styleHead_(sh, rows[0].length); sh.setFrozenRows(1); sh.setFrozenColumns(1);
  var n = rows.length - 1;
  if (n > 0) {
    // 테이블 번호 고르기(1~9) + 고치면 주제 칸이 바로 바뀌는 수식
    var dv = SpreadsheetApp.newDataValidation().requireNumberBetween(1, 9).setAllowInvalid(false).setHelpText('1~9 테이블 번호').build();
    sh.getRange(2, 5, n, 1).setDataValidation(dv); sh.getRange(2, 7, n, 1).setDataValidation(dv);
    var f = function (c) {
      return '=IF(' + c + '="","",' + TOPICS.map(function (t) {
        return 'IF(OR(' + t.tables.map(function (x) { return c + '=' + x; }).join(',') + '),"주제' + t.id + ' ' + t.name + '",';
      }).join('') + '"?"' + TOPICS.map(function () { return ')'; }).join('') + ')';
    };
    var fx = []; for (var i = 2; i <= n + 1; i++) fx.push([f('E' + i), f('G' + i)]);
    sh.getRange(2, 6, n, 1).setFormulas(fx.map(function (r) { return [r[0]]; }));
    sh.getRange(2, 8, n, 1).setFormulas(fx.map(function (r) { return [r[1]]; }));
    var bg = rows.slice(1).map(function (r) {
      return [null, null, null, null, topicFill_(r[5]), topicFill_(r[5]), topicFill_(r[7]), topicFill_(r[7]), /조정/.test(r[8]) ? '#FFF2CC' : null, null];
    });
    sh.getRange(2, 1, n, 10).setBackgrounds(bg);
    sh.getRange(2, 5, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sh.getRange(2, 7, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sh.getRange(2, 10, n, 1).setFontColor('#999999');
  }
  [70, 110, 190, 190, 80, 140, 80, 140, 95, 120].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 5).setNote('여기 번호를 바꾸면 다음 새로 고침 때도 그대로 유지됩니다. (1~3 주제1 · 4~5 주제2 · 6~7 주제3 · 8~9 주제4)');
  sh.getRange(1, 7).setNote('여기 번호를 바꾸면 다음 새로 고침 때도 그대로 유지됩니다.');
}

function writeTables_(ss, res, cap) {
  var sh = sheet_(ss, TAB.tables, 2); reset_(sh);
  var org = function (p) { return String(p.org).split(' / ')[0]; };
  var r = 1, blocks = [];
  sh.getRange(1, 1, 1, 5).setValues([['테이블', '1라운드 이름', '1라운드 소속', '2라운드 이름', '2라운드 소속']]);
  styleHead_(sh, 5); sh.setFrozenRows(1); r = 2;
  for (var t = 1; t <= 9; t++) {
    var tp = topicOfTable_(t), A = res.out.byTable[t][1], B = res.out.byTable[t][2];
    var title = t + '번 테이블 · 주제' + tp.id + ' ' + tp.name + ' · ' + tp.hall + '   (1라운드 ' + A.length + '명 · 2라운드 ' + B.length + '명 / 정원 ' + cap + ')';
    sh.getRange(r, 1, 1, 5).merge().setValue(title).setFontWeight('bold').setBackground(tp.color).setFontColor(tp.id === 2 ? '#1F2D00' : '#FFFFFF');
    r++;
    var n = Math.max(A.length, B.length, 1), rows = [];
    for (var i = 0; i < n; i++) rows.push([i + 1, A[i] ? A[i].name : '', A[i] ? org(A[i]) : '', B[i] ? B[i].name : '', B[i] ? org(B[i]) : '']);
    sh.getRange(r, 1, n, 5).setValues(rows).setBackground(tp.fill);
    sh.getRange(r, 1, n, 1).setHorizontalAlignment('center').setFontColor('#666666');
    r += n + 1;
  }
  [70, 110, 220, 110, 220].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function writeMerged_(ss, res) {
  var sh = sheet_(ss, TAB.merged, 3); reset_(sh);
  var rows = res.out.merged; put_(sh, rows);
  sh.getRange(2, 3, Math.max(1, rows.length - 1), 1).setNumberFormat('@');
  styleHead_(sh, rows[0].length); sh.setFrozenRows(1); sh.setFrozenColumns(2);
  var n = rows.length - 1;
  if (n > 0) {
    var colors = rows.slice(1).map(function (x) { var c = x[10] === '불참' ? '#9E9E9E' : x[10] === '설문 미제출' ? '#B26A00' : '#000000'; return rows[0].map(function () { return c; }); });
    sh.getRange(2, 1, n, rows[0].length).setFontColors(colors);
    sh.getRange(2, 11, n, 1).setBackgrounds(rows.slice(1).map(function (x) {
      return [x[10] === '참석(배정)' ? '#D9F2EF' : x[10] === '설문 미제출' ? '#FFF2CC' : '#EEEEEE'];
    })).setFontWeight('bold');
    sh.getRange(2, 22, n, 3).setWrap(true);
  }
  [40, 70, 110, 45, 45, 60, 70, 180, 60, 45, 80, 60, 60, 60, 60, 190, 80, 95, 95, 90, 80, 260, 200, 200, 180]
    .forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 1, Math.max(2, rows.length), rows[0].length).createFilter();
}

function writeIssues_(ss, res) {
  var sh = sheet_(ss, TAB.issues, 4); reset_(sh);
  var order = ['정원 초과', '자리 없음', '최적화', '동석 자리 없음', '동석 이름 확인', '자리 맞바꿈', '같은 주제 두 번', '테이블 번호 확인', '동명이인', '이름 다름', '연락처 다름', '설문만 있음', '신청 명단 중복', '설문 중복 응답', '신청 명단에 불참 표시', '순위 중복·누락', '연락처 없음', '동석 그룹', '운영진 메모'];
  var list = res.issues.slice().sort(function (a, b) { return order.indexOf(a.kind) - order.indexOf(b.kind); });
  var rows = [['구분', '이름', '연락처', '내용', '처리 메모(자유 기록 — 새로 고침 때 지워짐)']];
  list.forEach(function (i) { rows.push([i.kind, i.name, i.phone, i.detail, '']); });
  if (rows.length === 1) rows.push(['', '', '', '확인할 것이 없습니다.', '']);
  put_(sh, rows); styleHead_(sh, 5); sh.setFrozenRows(1);
  sh.getRange(2, 4, rows.length - 1, 1).setWrap(true);
  [120, 70, 110, 520, 220].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function writePaste_(ss, res) {
  var sh = sheet_(ss, TAB.paste, 5); reset_(sh);
  var split = function (arr) { return arr.map(function (s) { var p = s.split('\t'); return [Number(p[0]), p[1]]; }); };
  var A = split(res.out.paste[1]), B = split(res.out.paste[2]);
  sh.getRange(1, 1, 1, 5).setValues([['1라운드 테이블', '이름', '', '2라운드 테이블', '이름']]);
  styleHead_(sh, 5); sh.getRange(1, 3).setBackground('#FFFFFF');
  if (A.length) sh.getRange(2, 1, A.length, 2).setValues(A);
  if (B.length) sh.getRange(2, 4, B.length, 2).setValues(B);
  sh.getRange(Math.max(A.length, B.length) + 3, 1).setValue('그룹워크보드 운영진 콘솔 「참가자 명단 → 붙여넣기로 채우기」에 라운드별로 두 칸(테이블·이름)을 선택해 복사·붙여넣기 하세요.');
  [110, 110, 20, 110, 110].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

function writeGuide_(ss, res, cap, cfg, appSh, surSh, nApp, nResp) {
  var sh = sheet_(ss, TAB.guide, 0); reset_(sh);
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  var c = res.count;
  var rows = [
    ['경기도 중장년 네트워크 포럼 · 조편성 (자동)', '', '', ''],
    ['마지막 새로 고침', now, '', ''],
    ['', '', '', ''],
    ['전체 인원(제출 여부 무관)', c.total + '명', '신청 명단 ' + nApp + '행 + 설문 ' + nResp + '건을 사람 단위로 합친 수', ''],
    ['설문 제출 · 참석', c.target + '명', '배정 완료 ' + c.assigned + '명 → 「' + TAB.roster + '」「' + TAB.tables + '」 탭' + (c.forced ? ' (설문 미제출 동석 지정 ' + c.forced + '명 포함)' : ''), ''],
    ['설문 미제출', c.noSurvey + '명', '「' + TAB.merged + '」 탭 상태 「설문 미제출」 — 답하면 다음 새로 고침 때 자동 배정', ''],
    ['불참', c.absent + '명', '설문 「참석이 어렵습니다」 또는 신청 명단 「불참」', ''],
    ['확인필요', res.issues.length + '건', '「' + TAB.issues + '」 탭', ''],
    ['', '', '', ''],
    ['테이블', '주제', '1라운드', '2라운드']
  ];
  for (var t = 1; t <= 9; t++) {
    var tp = topicOfTable_(t);
    rows.push([t + '번 (' + tp.hall + ')', '주제' + tp.id + ' ' + tp.name, res.load[t][1] + ' / ' + cap, res.load[t][2] + ' / ' + cap]);
  }
  rows.push(['', '', '', '']);
  rows.push(['규칙', '1인 2주제(1·2라운드 각 1개). 설문 응답이 빠른 순서로 1·2순위를 먼저 주고, 자리가 없으면 3·4순위로 옮김. 같은 주제의 테이블끼리는 인원을 고르게, 같은 소속은 흩어지게 앉힘. 「조편성 설정」의 동석 그룹은 1·2라운드 모두 같은 테이블(설문 미제출도 배정). 「전체 다시 배정」은 전체를 보고 자리를 맞교환해 1·2순위 그대로 받는 사람을 최대로(또는 4순위를 최소로) 만듦.', '', '']);
  rows.push(['고치는 법', '「' + TAB.roster + '」 탭의 1라운드·2라운드 테이블 번호만 바꾸세요. 새로 고침해도 그대로 남습니다. 「조편성 …」 다른 탭은 새로 고침 때 다시 쓰여집니다. 「참석자 명단」 등 원래 탭은 읽기만 합니다.', '', '']);
  rows.push(['새로 고침', '10분마다 자동 + 메뉴 「조편성 → 지금 새로 고침」. 이미 배정된 사람은 움직이지 않고 새 응답자만 빈자리에 들어갑니다.', '', '']);
  rows.push(['원본(읽기만 함)', '신청 명단: ' + appSh.getParent().getName() + ' › ' + appSh.getName(), '', '']);
  rows.push(['', '설문 응답: ' + surSh.getParent().getName() + ' › ' + surSh.getName(), '', '']);
  put_(sh, rows);
  sh.getRange(1, 1, 1, 4).merge().setFontSize(14).setFontWeight('bold').setFontColor(NAVY);
  sh.getRange(4, 1, 5, 1).setFontWeight('bold');
  sh.getRange(4, 2, 5, 1).setFontWeight('bold').setHorizontalAlignment('right');
  styleHead_(sh, 4, 10);
  for (var t2 = 1; t2 <= 9; t2++) sh.getRange(10 + t2, 1, 1, 4).setBackground(topicOfTable_(t2).fill);
  sh.getRange(11, 3, 9, 2).setHorizontalAlignment('center');
  var r0 = 21;
  for (var k = 0; k < 5; k++) sh.getRange(r0 + k, 2, 1, 3).merge().setWrap(true);
  sh.getRange(r0, 1, 5, 1).setFontWeight('bold').setVerticalAlignment('top');
  [190, 260, 170, 170].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

/* ---------- 현황 확인용 주소 (웹 앱) ---------- */
// 이름·연락처 없이 숫자만 돌려준다. 결과 탭을 읽기만 하고 다시 계산하지 않는다.
// 주소: <웹앱 주소>?k=STATUS_KEY  (키가 틀리면 아무것도 돌려주지 않음)
//   &what=1                 방식별 미리 계산(시트 안 바꿈)
//   &action=reassign&mode=4 전체 다시 배정 실행(mode=4 4순위 회피 우선, 12 1·2순위 우선) — 설정 탭 값도 그 기준으로 바뀜
var STATUS_KEY = 'ab19eeffe8c523beb6c97463';

function doGet(e) {
  var out;
  if (!e || !e.parameter || e.parameter.k !== STATUS_KEY) out = { error: 'forbidden' };
  else { try {
    if (e.parameter.action === 'reassign') { var r = refresh_(true, e.parameter.mode === '4' ? '4' : '12'); out = { done: 'reassign', assigned: r.count.assigned, issues: r.issues.length, status: statusSummary_() }; }
    else out = e.parameter.what ? whatIf_() : statusSummary_(); } catch (err) { out = { error: String(err && err.message || err) }; } }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function statusSummary_() {
  var ss = SpreadsheetApp.openById(SRC_DEFAULT['결과를 쓸 시트 ID']);
  var vals = function (name) { var sh = ss.getSheetByName(name); return sh && sh.getLastRow() > 0 ? sh.getDataRange().getDisplayValues() : []; };
  var res = { at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') };

  // 설정: 마지막 새로 고침·우선 기준·동석 그룹 수
  vals(TAB.config).forEach(function (r) {
    if (r[0] === '마지막 새로 고침') res.lastRefresh = r[1];
    if (r[0] === '배정 우선 기준') res.priority = r[1];
    if (/^동석 그룹/.test(r[0]) && r[1]) res.groups = (res.groups || 0) + 1;
  });

  // 제출현황: 상태별 인원
  var m = vals(TAB.merged), st = {};
  if (m.length) { var si = m[0].indexOf('상태'); m.slice(1).forEach(function (r) { st[r[si]] = (st[r[si]] || 0) + 1; }); }
  res.status = st;

  // 조편성: 희망 반영 분포, 1·2순위 그대로, 4순위 포함, 테이블별 인원, 같은 주제 두 번
  var ro = vals(TAB.roster), how = {}, ok12 = 0, has4 = 0, same = 0, load = {};
  for (var t = 1; t <= 9; t++) load[t] = [0, 0];
  if (ro.length) {
    var h = ro[0], a = h.indexOf('1라운드 테이블'), b = h.indexOf('2라운드 테이블'), w = h.indexOf('희망 반영');
    ro.slice(1).forEach(function (r) {
      var lab = r[w]; how[lab] = (how[lab] || 0) + 1;
      var mm = lab.match(/(\d|\?)\+(\d|\?)순위/);
      if (mm && !/조정/.test(lab)) ok12++;
      if (mm && (mm[1] === '4' || mm[2] === '4')) has4++;
      var t1 = Number(r[a]), t2 = Number(r[b]);
      if (load[t1]) load[t1][0]++; if (load[t2]) load[t2][1]++;
      var A = topicOfTable_(t1), B = topicOfTable_(t2); if (A && B && A.id === B.id) same++;
    });
    res.assigned = ro.length - 1;
  }
  res.ok12 = ok12; res.has4 = has4; res.sameTopicTwice = same; res.how = how; res.tableLoad = load;

  // 확인필요: 구분별 건수 + 이름 없는 요약 줄(최적화·동석 그룹·정원 초과)만 내용 포함
  var is = vals(TAB.issues), kinds = {}, notes = [];
  is.slice(1).forEach(function (r) {
    if (!r[0]) return;
    kinds[r[0]] = (kinds[r[0]] || 0) + 1;
    if (r[0] === '최적화' || r[0] === '동석 그룹' || r[0] === '정원 초과') notes.push(r[0] + ': ' + r[3]);
  });
  res.issues = kinds; res.notes = notes;
  res.lastReassign = PropertiesService.getScriptProperties().getProperty('lastReassign') || '';
  return res;
}

/** 지금 데이터로 방식별 결과를 미리 계산(시트는 바꾸지 않음). 숫자만 돌려준다 */
function whatIf_() {
  var ss = SpreadsheetApp.openById(SRC_DEFAULT['결과를 쓸 시트 ID']);
  var cfg = {}; Object.keys(SRC_DEFAULT).forEach(function (k) { cfg[k] = SRC_DEFAULT[k]; });
  var groups = [], cs = ss.getSheetByName(TAB.config);
  if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (/^동석 그룹/.test(r[0])) { if (r[1]) groups.push(r[1]); } else if (r[0] && r[1] && cfg.hasOwnProperty(r[0])) cfg[r[0]] = r[1];
  });
  var cap = Math.max(1, Number(cfg['테이블당 정원']) || 8);
  var app = parseApplicants_(sourceSheet_(cfg['신청 명단 시트 ID'], cfg['신청 명단 탭 gid'], '신청 명단').getDataRange().getValues());
  var sur = parseResponses_(sourceSheet_(cfg['설문 응답 시트 ID'], cfg['설문 응답 탭 gid'], '설문 응답').getDataRange().getValues());
  function measure(r) {
    var P = {}; r.people.forEach(function (p) { P[p.key] = p; });
    var o = { assigned: 0, ok12: 0, has4: 0, rankSum: 0, noSeat: r.issues.filter(function (i) { return i.kind === '자리 없음'; }).length };
    Object.keys(r.assign).forEach(function (k) {
      var a = r.assign[k], x = seatInfo_(P[k], topicOfTable_(a.t1).id, topicOfTable_(a.t2).id);
      o.assigned++; if (x.ok12) o.ok12++; if (x.has4) o.has4++; o.rankSum += x.sum;
    });
    return o;
  }
  return {
    at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    current: measure(runAll_(app, sur, readPrev_(ss), cap, groups, false)),
    firstCome: measure(runAll_(app, sur, {}, cap, groups, false)),
    opt12: measure(runAll_(app, sur, {}, cap, groups, '12')),
    opt4: measure(runAll_(app, sur, {}, cap, groups, '4'))
  };
}
