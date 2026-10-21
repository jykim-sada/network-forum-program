/**
 * 경기도 중장년 네트워크 포럼 — 조편성 로직 (Apps Script API 를 쓰지 않는 순수 함수)
 * 신청 명단 + 사전 설문을 한 사람 한 줄로 합치고, 1인 2주제 × 2라운드로 테이블을 배정한다.
 * 이 PC(node)에서도 같은 파일을 불러 시험할 수 있게 SpreadsheetApp 등은 Code.gs 에만 둔다.
 */

var TOPICS = [
  { id: 1, name: '돌봄과 나의 삶', tables: [1, 2, 3], hall: '한강홀', color: '#00A496', fill: '#D9F2EF' },
  { id: 2, name: '일상과 관계',   tables: [4, 5],    hall: '데미안홀', color: '#ABCD03', fill: '#F0F6CC' },
  { id: 3, name: '모임의 첫걸음', tables: [6, 7],    hall: '데미안홀', color: '#F39800', fill: '#FDEBCC' },
  { id: 4, name: '연결과 확장',   tables: [8, 9],    hall: '데미안홀', color: '#ED6100', fill: '#FBDFCC' }
];
var ROUNDS = [1, 2];

function topicOfTable_(t) {
  for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].tables.indexOf(Number(t)) >= 0) return TOPICS[i];
  return null;
}
function topicById_(id) {
  for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === Number(id)) return TOPICS[i];
  return null;
}

/* ---------- 정규화 ---------- */

function normPhone_(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 10 && d.indexOf('10') === 0) d = '0' + d;   // 시트가 앞자리 0 을 지운 경우
  return d.length >= 9 ? d : '';
}
function fmtPhone_(d) {
  if (!d) return '';
  if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  return d;
}
function normName_(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
function clean_(s) { return String(s == null ? '' : s).replace(/[　\s]+/g, ' ').trim(); }
function rankNum_(v) { var m = String(v == null ? '' : v).match(/([1-4])\s*순위/); return m ? Number(m[1]) : null; }

/** "참여를 희망하지 않는 주제" 칸에서 주제 번호를 뽑는다 (예: "주제 2. (일상과 관계) ...") */
function parseExcluded_(s) {
  var out = [], txt = String(s == null ? '' : s);
  if (!txt) return out;
  var re = /주제\s*([1-4])/g, m;
  while ((m = re.exec(txt))) if (out.indexOf(Number(m[1])) < 0) out.push(Number(m[1]));
  TOPICS.forEach(function (t) { if (txt.indexOf(t.name) >= 0 && out.indexOf(t.id) < 0) out.push(t.id); });
  return out;
}

/* ---------- 시트 값(2차원 배열) 읽기 ---------- */

/** 신청 명단: 위쪽 15줄 안에서 「성명」「연락처」가 함께 있는 줄을 머리글로 본다 */
function parseApplicants_(values) {
  var h = -1;
  for (var i = 0; i < Math.min(values.length, 15); i++) {
    var row = values[i].map(clean_);
    if (row.indexOf('성명') >= 0 && row.indexOf('연락처') >= 0) { h = i; break; }
  }
  if (h < 0) throw new Error('신청 명단에서 「성명」「연락처」 머리글 줄을 찾지 못했습니다.');
  var head = values[h].map(clean_);
  function col(name) { return head.indexOf(name); }
  var c = { sigun: col('시군명'), org: col('소속'), name: col('성명'), gender: col('성별'), age: col('나이'), phone: col('연락처'),
            email: col('이메일 주소'), community: col('커뮤니티 활동유무'), activity: col('비고(활동내용)'), attend: col('참여여부'),
            note: head.lastIndexOf('비고') };
  var out = [];
  for (var r = h + 1; r < values.length; r++) {
    var v = values[r]; function g(k) { return c[k] >= 0 ? v[c[k]] : ''; }
    if (!clean_(g('name'))) continue;
    out.push({ row: r + 1, sigun: g('sigun'), org: g('org'), name: g('name'), gender: g('gender'), age: g('age'), phone: g('phone'),
               email: g('email'), community: g('community'), activity: g('activity'), attend: g('attend'), note: g('note') });
  }
  return out;
}

/** 설문 응답: 머리글 글자 일부로 칸을 찾는다(설문 문항 순서가 바뀌어도 동작). 주제 칸은 「[주제 N.」으로 번호를 읽는다 */
function parseResponses_(values) {
  var head = (values[0] || []).map(clean_);
  function find(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
  var c = {
    ts: find(/^(Timestamp|타임스탬프)/i), name: find(/^성명/), phone: find(/휴대전화|연락처/), gender: find(/^성별/), ageBand: find(/연령/),
    sigun: find(/거주/), route: find(/추천 기관|참여 경로/), org: find(/소속/), now: find(/현재 해당/), commExp: find(/커뮤니티\(모임\) 활동|활동 경험/),
    exclude: find(/희망하지 않는/), story: find(/1순위로 고른/), attend: find(/참석하실 수|참석 여부/), move: find(/이동 방법/),
    want: find(/얻어 가고/), memo: find(/운영진에게/), email: find(/이메일/)
  };
  var topicCol = {};
  head.forEach(function (hd, i) { var m = hd.match(/참여 희망 주제.*\[\s*주제\s*([1-4])/); if (m) topicCol[m[1]] = i; });
  if (c.name < 0 || Object.keys(topicCol).length < 4) throw new Error('설문 시트에서 「성명」 또는 주제 1~4 순위 칸을 찾지 못했습니다.');
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r]; function g(k) { return c[k] >= 0 ? v[c[k]] : ''; }
    if (!clean_(g('name')) && !clean_(g('phone'))) continue;
    var ranks = {}; Object.keys(topicCol).forEach(function (k) { ranks[k] = rankNum_(v[topicCol[k]]); });
    out.push({ row: r + 1, ts: toMs_(g('ts')), name: g('name'), phone: g('phone'), gender: g('gender'), ageBand: g('ageBand'), sigun: g('sigun'),
               route: g('route'), org: g('org'), now: g('now'), commExp: g('commExp'), ranks: ranks, exclude: g('exclude'), story: g('story'),
               attend: clean_(g('attend')), move: g('move'), want: g('want'), memo: g('memo'), email: g('email') });
  }
  return out;
}
function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  var t = Date.parse(String(v || '').replace(/"/g, ''));
  return isNaN(t) ? 0 : t;
}

/* ---------- 두 명단 합치기 ---------- */

/**
 * applicants: [{row, sigun, org, name, gender, age, phone, email, community, activity, attend, note}]
 * responses : [{row, ts(ms), name, phone, gender, ageBand, sigun, route, org, now, commExp,
 *               ranks:{1:n,2:n,3:n,4:n}, exclude, story, attend, move, want, memo, email}]
 * 반환: { people: [...], issues: [{name, phone, kind, detail}] }
 */
function mergePeople_(applicants, responses) {
  var issues = [], byKey = {}, order = [];
  function issue(p, kind, detail) { issues.push({ name: p ? p.name : '', phone: p ? fmtPhone_(p.phone) : '', kind: kind, detail: detail || '' }); }

  // 1) 신청 명단 (연락처 기준, 같은 번호가 두 번이면 하나로)
  applicants.forEach(function (a) {
    var ph = normPhone_(a.phone), nm = clean_(a.name);
    if (!nm) return;
    var key = ph ? 'P' + ph : 'N' + normName_(nm);
    var p = byKey[key];
    if (p) {
      issue(p, '신청 명단 중복', '신청 명단 ' + p.appRows.join('·') + '행과 ' + a.row + '행이 같은 사람(연락처 같음). 소속: ' + p.org + ' / ' + clean_(a.org));
      p.appRows.push(a.row);
      if (clean_(a.org) && p.org.indexOf(clean_(a.org)) < 0) p.org += ' / ' + clean_(a.org);
      return;
    }
    p = {
      key: key, name: nm, phone: ph, gender: clean_(a.gender), age: a.age == null ? '' : a.age, ageBand: '',
      sigun: clean_(a.sigun), org: clean_(a.org), email: clean_(a.email),
      community: clean_(a.community), activity: clean_(a.activity),
      appAttend: clean_(a.attend), appNote: clean_(a.note), appRows: [a.row],
      inApp: true, inSurvey: false, resp: null
    };
    if (!ph) issue(p, '연락처 없음', '신청 명단 ' + a.row + '행 연락처가 비었거나 형식이 다름: ' + clean_(a.phone));
    byKey[key] = p; order.push(p);
  });

  // 이름 색인 (연락처로 못 찾을 때만 사용)
  function byName(nm) {
    var n = normName_(nm);
    return order.filter(function (p) { return p.inApp && normName_(p.name) === n; });
  }

  // 2) 설문 응답 (시간순, 같은 사람이 여러 번 응답하면 마지막 응답 사용)
  var resps = responses.slice().sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
  resps.forEach(function (r) {
    var ph = normPhone_(r.phone), nm = clean_(r.name);
    if (!nm && !ph) return;
    var p = ph ? byKey['P' + ph] : null, how = 'phone';
    if (!p) {
      var cand = byName(nm).filter(function (c) { return !c.inSurvey || (c.resp && normPhone_(c.resp.phone) === ph); });
      if (cand.length === 1) { p = cand[0]; how = 'name'; }
      else if (cand.length > 1) issue({ name: nm, phone: ph }, '동명이인', '설문 ' + r.row + '행: 신청 명단에 같은 이름이 ' + cand.length + '명 있어 자동으로 잇지 않음');
    }
    if (p && p.inSurvey) {
      issue(p, '설문 중복 응답', '설문 ' + p.resp.row + '행과 ' + r.row + '행 — 나중 응답(' + r.row + '행)을 사용');
    }
    if (!p) {
      var key = ph ? 'P' + ph : 'N' + normName_(nm);
      p = byKey[key];
      if (!p) {
        p = { key: key, name: nm, phone: ph, gender: '', age: '', ageBand: '', sigun: '', org: '', email: '',
              community: '', activity: '', appAttend: '', appNote: '', appRows: [], inApp: false, inSurvey: false, resp: null };
        byKey[key] = p; order.push(p);
        issue(p, '설문만 있음', '설문 ' + r.row + '행: 신청 명단에서 연락처·이름으로 찾지 못함' + (ph ? '' : ' (연락처 칸: ' + clean_(r.phone) + ')'));
      }
    } else if (how === 'name') {
      issue(p, '연락처 다름', '설문 연락처 "' + clean_(r.phone) + '" ↔ 신청 명단 ' + fmtPhone_(p.phone) + ' — 이름으로 연결함');
    } else if (normName_(nm) !== normName_(p.name)) {
      issue(p, '이름 다름', '같은 연락처인데 신청 명단 "' + p.name + '" ↔ 설문 "' + nm + '"');
    }
    p.inSurvey = true; p.resp = r;
    if (!p.phone && ph) p.phone = ph;
    if (!p.gender) p.gender = clean_(r.gender).replace('성', '');
    p.ageBand = clean_(r.ageBand);
    if (!p.sigun) p.sigun = clean_(r.sigun);
    if (!p.org) p.org = clean_(r.org);
    if (!p.email) p.email = clean_(r.email);
  });

  // 3) 상태·선호 계산
  order.forEach(function (p) {
    var r = p.resp;
    p.ranks = { 1: null, 2: null, 3: null, 4: null };
    p.exclude = [];
    if (r) {
      TOPICS.forEach(function (t) { p.ranks[t.id] = r.ranks ? (r.ranks[t.id] == null ? null : Number(r.ranks[t.id])) : null; });
      p.exclude = parseExcluded_(r.exclude);
      var got = TOPICS.map(function (t) { return p.ranks[t.id]; }).filter(function (x) { return x != null; });
      var dup = got.length !== got.filter(function (x, i) { return got.indexOf(x) === i; }).length;
      if (dup || got.length < TOPICS.length) {
        issue(p, '순위 중복·누락', '응답: ' + TOPICS.map(function (t) { return '주제' + t.id + '=' + (p.ranks[t.id] || '-'); }).join(', ') + ' — 같은 순위끼리는 자리가 여유 있는 주제로 배정');
      }
      if (clean_(r.memo) && !/^(없[음습]|없습니다|없음\.?|-)\.?$/.test(clean_(r.memo))) issue(p, '운영진 메모', clean_(r.memo));
    }
    var notCome = (r && /어렵|불참|못/.test(r.attend || '')) || /불참/.test(p.appAttend + ' ' + p.activity + ' ' + p.appNote);
    p.status = notCome ? '불참' : (r ? '배정 대상' : '설문 미응답');
    if (notCome && r && !/어렵|불참|못/.test(r.attend || '')) issue(p, '신청 명단에 불참 표시', '설문은 "' + r.attend + '" — 신청 명단 표시를 따라 불참으로 둠');
  });

  return { people: order, issues: issues };
}

/* ---------- 동석 그룹 ---------- */

/**
 * groupTexts: ['임종희, 김영준, 변성진, 박경민', ...] — 이름을 쉼표·가운뎃점·빈칸으로 구분
 * 같은 그룹은 1·2라운드 모두 같은 테이블에 앉힌다. 설문을 안 낸 사람도 배정 대상으로 본다(불참은 제외).
 * 반환: { groups: [[key, ...], ...], issues }
 */
function applyGroups_(people, groupTexts) {
  var groups = [], issues = [];
  (groupTexts || []).forEach(function (txt, gi) {
    var names = String(txt || '').split(/[,·、/\n]+|\s{2,}/).map(clean_).filter(function (x) { return x; });
    if (names.length === 1) names = names[0].split(/\s+/);   // 빈칸 하나로만 구분한 경우
    if (names.length < 2) return;
    var keys = [], label = '동석 그룹 ' + (gi + 1);
    names.forEach(function (nm) {
      var hit = people.filter(function (p) { return normName_(p.name) === normName_(nm); });
      if (hit.length !== 1) {
        issues.push({ name: nm, phone: '', kind: '동석 이름 확인', detail: label + ': 명단에서 「' + nm + '」을(를) ' + (hit.length ? hit.length + '명 찾음(동명이인)' : '찾지 못함') + ' — 이 사람은 빼고 앉힘' });
        return;
      }
      var p = hit[0];
      if (p.status === '불참') { issues.push({ name: p.name, phone: fmtPhone_(p.phone), kind: '동석 이름 확인', detail: label + ': 불참으로 되어 있어 빼고 앉힘' }); return; }
      if (p.group) { issues.push({ name: p.name, phone: fmtPhone_(p.phone), kind: '동석 이름 확인', detail: '동석 그룹 ' + p.group + '과 ' + label + '에 함께 있음 — 앞 그룹만 적용' }); return; }
      if (p.status === '설문 미응답') { p.status = '배정 대상'; p.forced = true; }
      p.group = gi + 1;
      keys.push(p.key);
    });
    if (keys.length) groups.push({ no: gi + 1, keys: keys });
  });
  return { groups: groups, issues: issues };
}

/* ---------- 배정 ---------- */

/**
 * prev: { key: { t1: 테이블번호, t2: 테이블번호 } } — 이미 배정된 사람은 그대로 둔다(운영진이 손으로 고친 값 포함)
 * cap : 테이블당 정원
 * 반환: { assign: { key: {t1, t2, how} }, issues: [...] , load }
 */
function assignTables_(people, prev, cap, groups) {
  var issues = [], assign = {};
  var tLoad = {}, tOrg = {}, tSigun = {};
  for (var t = 1; t <= 9; t++) { tLoad[t] = { 1: 0, 2: 0 }; tOrg[t] = { 1: {}, 2: {} }; tSigun[t] = { 1: {}, 2: {} }; }
  function topicLoad(topic, rd) { return topic.tables.reduce(function (s, x) { return s + tLoad[x][rd]; }, 0); }
  function topicCap(topic) { return topic.tables.length * cap; }
  function orgKey(p) { return normName_(p.org.split('/')[0]); }
  function put(p, table, rd) {
    tLoad[table][rd]++;
    var o = orgKey(p); if (o) tOrg[table][rd][o] = (tOrg[table][rd][o] || 0) + 1;
    if (p.sigun) tSigun[table][rd][p.sigun] = (tSigun[table][rd][p.sigun] || 0) + 1;
  }
  function pickTable(p, topic, rd) {
    var o = orgKey(p);
    return topic.tables.slice().sort(function (a, b) {
      return (tLoad[a][rd] - tLoad[b][rd]) ||
             ((tOrg[a][rd][o] || 0) - (tOrg[b][rd][o] || 0)) ||
             ((tSigun[a][rd][p.sigun] || 0) - (tSigun[b][rd][p.sigun] || 0)) || (a - b);
    })[0];
  }
  function iss(p, kind, detail) { issues.push({ name: p.name, phone: fmtPhone_(p.phone), kind: kind, detail: detail }); }

  var targets = people.filter(function (p) { return p.status === '배정 대상'; });
  var byKey = {}; people.forEach(function (p) { byKey[p.key] = p; });
  var inGroup = {}; (groups || []).forEach(function (g) { g.keys.forEach(function (k) { inGroup[k] = g.no; }); });
  function ratio(id) { var tp = topicById_(id); return (topicLoad(tp, 1) + topicLoad(tp, 2)) / (2 * topicCap(tp)); }

  // 1) 기존 배정 유지 (동석 그룹은 2단계에서 따로)
  var fresh = [];
  targets.forEach(function (p) {
    if (inGroup[p.key]) return;
    var pv = prev && prev[p.key];
    var a = pv ? topicOfTable_(pv.t1) : null, b = pv ? topicOfTable_(pv.t2) : null;
    if (a && b) {
      assign[p.key] = { t1: Number(pv.t1), t2: Number(pv.t2), how: howLabel_(p, a.id, b.id), kept: true };
      put(p, Number(pv.t1), 1); put(p, Number(pv.t2), 2);
      if (a.id === b.id) iss(p, '같은 주제 두 번', '1·2라운드가 모두 주제' + a.id + ' — 조편성 탭에서 한쪽 테이블을 바꿔 주세요');
    } else {
      if (pv && (pv.t1 || pv.t2)) iss(p, '테이블 번호 확인', '조편성 탭의 테이블 번호(' + (pv.t1 || '-') + ', ' + (pv.t2 || '-') + ')를 읽지 못해 새로 배정함');
      fresh.push(p);
    }
  });

  // 2) 동석 그룹: 1·2라운드 모두 한 테이블에. 이미 다 같이 앉아 있으면 그대로 둔다.
  (groups || []).forEach(function (g) {
    var mem = g.keys.map(function (k) { return byKey[k]; }).filter(function (p) { return p && p.status === '배정 대상'; });
    if (!mem.length) return;
    var names = mem.map(function (p) { return p.name; }).join('·');
    var pv0 = prev && prev[mem[0].key];
    var same = pv0 && topicOfTable_(pv0.t1) && topicOfTable_(pv0.t2) && topicOfTable_(pv0.t1).id !== topicOfTable_(pv0.t2).id &&
      mem.every(function (p) { var pv = prev[p.key]; return pv && Number(pv.t1) === Number(pv0.t1) && Number(pv.t2) === Number(pv0.t2); });
    var t1 = 0, t2 = 0;
    if (same) { t1 = Number(pv0.t1); t2 = Number(pv0.t2); }
    else {
      // 그룹 희망: 설문을 낸 사람들 순위의 평균 (아무도 안 냈으면 덜 찬 주제)
      var ids = TOPICS.map(function (t) { return t.id; }).filter(function (id) { return mem.every(function (p) { return p.exclude.indexOf(id) < 0; }); });
      var pos = {};
      ids.forEach(function (id) {
        var r = mem.map(function (p) { return p.ranks[id]; }).filter(function (x) { return x != null; });
        pos[id] = r.length ? r.reduce(function (s, x) { return s + x; }, 0) / r.length : 5;
      });
      var pairs = [];
      for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++)
        pairs.push({ a: ids[i], b: ids[j], lo: Math.min(pos[ids[i]], pos[ids[j]]), hi: Math.max(pos[ids[i]], pos[ids[j]]) });
      pairs.sort(function (x, y) { return (x.lo - y.lo) || (x.hi - y.hi) || ((ratio(x.a) + ratio(x.b)) - (ratio(y.a) + ratio(y.b))); });
      var n = mem.length;
      var room = function (topic, rd) {   // n명이 함께 들어갈 수 있는 테이블 중 가장 빈 곳
        var ok = topic.tables.filter(function (t) { return tLoad[t][rd] + n <= cap; });
        return ok.sort(function (a, b) { return (tLoad[a][rd] - tLoad[b][rd]) || (a - b); })[0] || 0;
      };
      for (var k = 0; k < pairs.length && !t1; k++) {
        var A = topicById_(pairs[k].a), B = topicById_(pairs[k].b);
        var opts = [[A, B], [B, A]].map(function (o) { return { o: o, t1: room(o[0], 1), t2: room(o[1], 2) }; })
          .filter(function (x) { return x.t1 && x.t2; });
        if (!opts.length) continue;
        opts.sort(function (x, y) {
          var bx = Math.abs(topicLoad(x.o[0], 1) + n - topicLoad(x.o[0], 2)) + Math.abs(topicLoad(x.o[1], 2) + n - topicLoad(x.o[1], 1));
          var by = Math.abs(topicLoad(y.o[0], 1) + n - topicLoad(y.o[0], 2)) + Math.abs(topicLoad(y.o[1], 2) + n - topicLoad(y.o[1], 1));
          return bx - by;
        });
        t1 = opts[0].t1; t2 = opts[0].t2;
      }
    }
    if (!t1) {
      issues.push({ name: names, phone: '', kind: '동석 자리 없음', detail: '동석 그룹 ' + g.no + ' ' + mem.length + '명이 함께 앉을 테이블이 없어 각자 배정함 — 정원을 늘리거나 조편성 탭에서 손으로 맞춰 주세요' });
      mem.forEach(function (p) { fresh.push(p); });
      return;
    }
    mem.forEach(function (p) {
      put(p, t1, 1); put(p, t2, 2);
      var A = topicOfTable_(t1), B = topicOfTable_(t2);
      assign[p.key] = { t1: t1, t2: t2, how: '동석 · ' + (p.inSurvey ? howLabel_(p, A.id, B.id) : '설문 미제출'), kept: !!same };
    });
    issues.push({ name: names, phone: '', kind: '동석 그룹', detail: '동석 그룹 ' + g.no + ' (' + mem.length + '명) → 1라운드 ' + t1 + '번 · 2라운드 ' + t2 + '번 테이블' +
      (same ? ' (유지)' : '') + '. 조편성 탭에서 한 사람만 바꾸면 다음 새로 고침 때 그룹 전체가 다시 배정됨' });
  });

  // 3) 새로 온 사람: 설문 응답 시각 순(먼저 응답한 사람이 먼저 원하는 주제를 받음)
  fresh.sort(function (x, y) { return ((x.resp && x.resp.ts) || 0) - ((y.resp && y.resp.ts) || 0); });
  fresh.forEach(function (p) {
    var ids = TOPICS.map(function (t) { return t.id; }).filter(function (id) { return p.exclude.indexOf(id) < 0; });
    var pos = {}; ids.forEach(function (id) { pos[id] = p.ranks[id] == null ? 5 : p.ranks[id]; });
    var pairs = [];
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var lo = Math.min(pos[ids[i]], pos[ids[j]]), hi = Math.max(pos[ids[i]], pos[ids[j]]);
      pairs.push({ a: ids[i], b: ids[j], lo: lo, hi: hi });
    }
    // 1순위를 가장 지키고, 그다음 2순위 … (1+2 → 1+3 → 1+4 → 2+3 …). 순위가 같으면 덜 찬 쪽.
    pairs.sort(function (x, y) { return (x.lo - y.lo) || (x.hi - y.hi) || ((ratio(x.a) + ratio(x.b)) - (ratio(y.a) + ratio(y.b))); });

    var done = false;
    for (var k = 0; k < pairs.length && !done; k++) {
      var A = topicById_(pairs[k].a), B = topicById_(pairs[k].b);
      var opts = [[A, B], [B, A]].filter(function (o) {
        return topicLoad(o[0], 1) < topicCap(o[0]) && topicLoad(o[1], 2) < topicCap(o[1]);
      });
      if (!opts.length) continue;
      // 두 라운드 인원이 고르게: 배정 뒤 더 꽉 차는 쪽의 비율이 작은 방향
      opts.sort(function (x, y) {
        var fx = Math.max((topicLoad(x[0], 1) + 1) / topicCap(x[0]), (topicLoad(x[1], 2) + 1) / topicCap(x[1]));
        var fy = Math.max((topicLoad(y[0], 1) + 1) / topicCap(y[0]), (topicLoad(y[1], 2) + 1) / topicCap(y[1]));
        var bx = Math.abs(topicLoad(x[0], 1) - topicLoad(x[0], 2)) + Math.abs(topicLoad(x[1], 2) - topicLoad(x[1], 1));
        var by = Math.abs(topicLoad(y[0], 1) - topicLoad(y[0], 2)) + Math.abs(topicLoad(y[1], 2) - topicLoad(y[1], 1));
        return (fx - fy) || (by - bx);
      });
      var o = opts[0];
      var t1 = pickTable(p, o[0], 1); put(p, t1, 1);
      var t2 = pickTable(p, o[1], 2); put(p, t2, 2);
      assign[p.key] = { t1: t1, t2: t2, how: howLabel_(p, o[0].id, o[1].id), kept: false };
      done = true;
    }
    if (!done) iss(p, '자리 없음', '희망 주제 어느 조합도 정원이 남지 않음 — 정원을 늘리거나 손으로 배정');
  });

  // 4) 정원 초과 점검 (손으로 고친 경우)
  for (var tb = 1; tb <= 9; tb++) ROUNDS.forEach(function (rd) {
    if (tLoad[tb][rd] > cap) issues.push({ name: '', phone: '', kind: '정원 초과', detail: rd + '라운드 ' + tb + '번 테이블 ' + tLoad[tb][rd] + '명 (정원 ' + cap + '명)' });
  });

  return { assign: assign, issues: issues, load: tLoad };
}

/** 배정된 두 주제가 몇 순위였는지 */
function howLabel_(p, a, b) {
  var ra = p.ranks[a], rb = p.ranks[b];
  var s = [ra, rb].map(function (x) { return x == null ? '?' : x; }).sort().join('+') + '순위';
  var best = TOPICS.map(function (t) { return p.ranks[t.id]; }).filter(function (x) { return x != null; }).sort();
  var ok = best.length >= 2 && ((ra === best[0] && rb === best[1]) || (rb === best[0] && ra === best[1]));
  return ok ? s : s + ' (조정)';
}

/* ---------- 표 만들기 ---------- */

function buildOutputs_(people, assign, cap) {
  var rk = function (p, id) { return p.ranks[id] == null ? '' : p.ranks[id]; };
  var prefStr = function (p) {
    var ids = TOPICS.map(function (t) { return t.id; }).filter(function (id) { return p.ranks[id] != null; })
      .sort(function (a, b) { return p.ranks[a] - p.ranks[b]; });
    return ids.map(function (id) { return '주제' + id; }).join(' > ');
  };

  var STATUS_LABEL = { '배정 대상': '참석(배정)', '설문 미응답': '설문 미제출', '불참': '불참' };
  var merged = [[
    '번호', '이름', '연락처', '성별', '나이', '연령대', '시군', '소속', '신청 명단', '설문', '상태',
    '주제1 순위', '주제2 순위', '주제3 순위', '주제4 순위', '희망 순서', '불희망 주제',
    '1라운드', '2라운드', '희망 반영', '커뮤니티 활동', '1순위 주제에서 하고 싶은 이야기', '얻어 가고 싶은 것', '운영진 메모', '이메일'
  ]];
  var stOrder = { '배정 대상': 0, '설문 미응답': 1, '불참': 2 };
  var sorted = people.slice().sort(function (x, y) {
    return (stOrder[x.status] - stOrder[y.status]) || (((x.resp && x.resp.ts) || 9e15) - ((y.resp && y.resp.ts) || 9e15)) ||
           ((x.appRows[0] || 9999) - (y.appRows[0] || 9999));
  });
  sorted.forEach(function (p, i) {
    var a = assign[p.key], r = p.resp || {};
    merged.push([
      i + 1, p.name, fmtPhone_(p.phone), p.gender, p.age, p.ageBand, p.sigun, p.org,
      p.inApp ? 'O' : '없음', p.inSurvey ? '제출' : '미제출', p.forced ? '참석(동석 지정)' : (STATUS_LABEL[p.status] || p.status),
      rk(p, 1), rk(p, 2), rk(p, 3), rk(p, 4), prefStr(p), p.exclude.map(function (x) { return '주제' + x; }).join(', '),
      a ? a.t1 + '번 (주제' + topicOfTable_(a.t1).id + ')' : '', a ? a.t2 + '번 (주제' + topicOfTable_(a.t2).id + ')' : '', a ? a.how : '',
      p.community || clean_(r.commExp), clean_(r.story), clean_(r.want), clean_(r.memo), p.email
    ]);
  });

  // 조편성 (운영진이 테이블 번호를 고치는 탭 — 다음 새로 고침 때 그대로 유지됨)
  var roster = [['이름', '연락처', '소속', '희망 순서', '1라운드 테이블', '1라운드 주제', '2라운드 테이블', '2라운드 주제', '희망 반영', '구분키']];
  sorted.filter(function (p) { return assign[p.key]; }).forEach(function (p) {
    var a = assign[p.key], A = topicOfTable_(a.t1), B = topicOfTable_(a.t2);
    roster.push([p.name, fmtPhone_(p.phone), p.org, prefStr(p), a.t1, '주제' + A.id + ' ' + A.name, a.t2, '주제' + B.id + ' ' + B.name, a.how, p.key]);
  });

  // 테이블별 명단
  var byTable = {};
  for (var t = 1; t <= 9; t++) byTable[t] = { 1: [], 2: [] };
  sorted.forEach(function (p) {
    var a = assign[p.key]; if (!a) return;
    byTable[a.t1][1].push(p); byTable[a.t2][2].push(p);
  });

  // 그룹워크보드 「참가자 명단」 붙여넣기 (테이블번호<탭>이름)
  var paste = { 1: [], 2: [] };
  for (var tb = 1; tb <= 9; tb++) ROUNDS.forEach(function (rd) {
    byTable[tb][rd].forEach(function (p) { paste[rd].push(tb + '\t' + p.name); });
  });

  return { merged: merged, roster: roster, byTable: byTable, paste: paste };
}

/** 한 번에: 합치기 → 배정 → 표 */
function runAll_(applicants, responses, prev, cap, groupTexts) {
  var m = mergePeople_(applicants, responses);
  var g = applyGroups_(m.people, groupTexts);
  var a = assignTables_(m.people, prev, cap, g.groups);
  var out = buildOutputs_(m.people, a.assign, cap);
  var count = { total: m.people.length, target: 0, noSurvey: 0, absent: 0, forced: 0, assigned: Object.keys(a.assign).length };
  m.people.forEach(function (p) {
    if (p.status === '배정 대상') { count.target++; if (p.forced) count.forced++; }
    else if (p.status === '불참') count.absent++; else count.noSurvey++;
  });
  return { people: m.people, assign: a.assign, load: a.load, issues: m.issues.concat(g.issues, a.issues), out: out, count: count };
}

if (typeof module !== 'undefined') module.exports = { runAll_: runAll_, parseApplicants_: parseApplicants_, parseResponses_: parseResponses_, TOPICS: TOPICS, topicOfTable_: topicOfTable_ };
