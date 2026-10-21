// ===== 네트워크 포럼 조편성 — 신청 명단 시트 붙여넣기용 (Code.gs 한 파일) =====
// 확장 프로그램 → Apps Script → Code.gs 내용을 모두 지우고 이 파일 전체를 붙여 넣은 뒤 저장(Ctrl+S)

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

/* ---------- 배정 ---------- */

/**
 * prev: { key: { t1: 테이블번호, t2: 테이블번호 } } — 이미 배정된 사람은 그대로 둔다(운영진이 손으로 고친 값 포함)
 * cap : 테이블당 정원
 * 반환: { assign: { key: {t1, t2, how} }, issues: [...] , load }
 */
function assignTables_(people, prev, cap) {
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

  // 1) 기존 배정 유지
  var fresh = [];
  targets.forEach(function (p) {
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

  // 2) 새로 온 사람: 설문 응답 시각 순(먼저 응답한 사람이 먼저 원하는 주제를 받음)
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
    function ratio(id) { var tp = topicById_(id); return (topicLoad(tp, 1) + topicLoad(tp, 2)) / (2 * topicCap(tp)); }
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

  // 3) 정원 초과 점검 (손으로 고친 경우)
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
      p.inApp ? 'O' : '없음', p.inSurvey ? '제출' : '미제출', STATUS_LABEL[p.status] || p.status,
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
function runAll_(applicants, responses, prev, cap) {
  var m = mergePeople_(applicants, responses);
  var a = assignTables_(m.people, prev, cap);
  var out = buildOutputs_(m.people, a.assign, cap);
  var count = { total: m.people.length, target: 0, noSurvey: 0, absent: 0, assigned: Object.keys(a.assign).length };
  m.people.forEach(function (p) { if (p.status === '배정 대상') count.target++; else if (p.status === '불참') count.absent++; else count.noSurvey++; });
  return { people: m.people, assign: a.assign, load: a.load, issues: m.issues.concat(a.issues), out: out, count: count };
}

if (typeof module !== 'undefined') module.exports = { runAll_: runAll_, parseApplicants_: parseApplicants_, parseResponses_: parseResponses_, TOPICS: TOPICS, topicOfTable_: topicOfTable_ };


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
  '결과를 쓸 시트 ID': '1bnLOIeTxLpYNtnYvKA1K_fvonoHGuzxmYK48MMb--cU'
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
    .addItem('전체 다시 배정…', 'reassignAll')
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
  var ok = ui.alert('전체 다시 배정', '지금까지의 배정과 손으로 고친 테이블 번호를 모두 지우고 처음부터 다시 배정합니다. 계속할까요?', ui.ButtonSet.YES_NO);
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

function ensureConfig_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(TAB.config);
  if (sh && sh.getLastRow() > 0) return;
  sh = sh || ss.insertSheet(TAB.config, ss.getSheets().length);   // 신청 명단 시트에 붙여 넣어 쓸 때도 원래 탭 뒤에
  var rows = [['항목', '값']];
  Object.keys(SRC_DEFAULT).forEach(function (k) { rows.push([k, SRC_DEFAULT[k]]); });
  sh.getRange(1, 1, rows.length, 2).setValues(rows).setNumberFormat('@');
  styleHead_(sh, 2);
  sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 380);
  sh.getRange(rows.length + 2, 1).setValue('시트 ID 는 주소의 /d/ 와 /edit 사이, gid 는 주소 끝 gid= 뒤 숫자입니다. 테이블당 정원을 바꾸면 다음 새로 고침부터 적용됩니다.');
}

function readConfig_() {
  var cfg = {}; Object.keys(SRC_DEFAULT).forEach(function (k) { cfg[k] = SRC_DEFAULT[k]; });
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB.config);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (r[0] && r[1] && cfg.hasOwnProperty(r[0])) cfg[r[0]] = String(r[1]).trim();
  });
  return cfg;
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

function refresh_(reset) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('다른 새로 고침이 진행 중입니다. 잠시 뒤 다시 눌러 주세요.');
  try {
    ensureConfig_();
    var cfg = readConfig_(), cap = Math.max(1, Number(cfg['테이블당 정원']) || 8);
    var appSh = sourceSheet_(cfg['신청 명단 시트 ID'], cfg['신청 명단 탭 gid'], '신청 명단');
    var surSh = sourceSheet_(cfg['설문 응답 시트 ID'], cfg['설문 응답 탭 gid'], '설문 응답');
    var applicants = parseApplicants_(appSh.getDataRange().getValues());
    var responses = parseResponses_(surSh.getDataRange().getValues());
    var ss = openBook_(cfg['결과를 쓸 시트 ID'], '결과를 쓸(신청 명단)', '편집자');
    ensureTabs_(ss);
    var res = runAll_(applicants, responses, reset ? {} : readPrev_(ss), cap);
    writeRoster_(ss, res);
    writeTables_(ss, res, cap);
    writeMerged_(ss, res);
    writeIssues_(ss, res);
    writePaste_(ss, res);
    writeGuide_(ss, res, cap, cfg, appSh, surSh, applicants.length, responses.length);
    res.targetName = ss.getName(); res.targetUrl = ss.getUrl();
    noteLink_(res);
    return res;
  } finally { lock.releaseLock(); }
}

/** 보조 시트 설정 탭 아래에 결과 시트 주소와 마지막 새로 고침 시각을 남긴다 */
function noteLink_(res) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB.config); if (!sh) return;
  var r = Object.keys(SRC_DEFAULT).length + 4;
  sh.getRange(r, 1, 2, 2).setValues([['결과 보는 곳', res.targetUrl], ['마지막 새로 고침', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm')]]);
  sh.getRange(r, 1, 2, 1).setFontWeight('bold');
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
  var order = ['정원 초과', '자리 없음', '같은 주제 두 번', '테이블 번호 확인', '동명이인', '이름 다름', '연락처 다름', '설문만 있음', '신청 명단 중복', '설문 중복 응답', '신청 명단에 불참 표시', '순위 중복·누락', '연락처 없음', '운영진 메모'];
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
    ['합친 인원', c.total + '명', '신청 명단 ' + nApp + '행 · 설문 ' + nResp + '건', ''],
    ['설문 제출 · 참석', c.target + '명', '배정 완료 ' + c.assigned + '명 → 「' + TAB.roster + '」「' + TAB.tables + '」 탭', ''],
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
  rows.push(['규칙', '1인 2주제(1·2라운드 각 1개). 설문 응답이 빠른 순서로 1·2순위를 먼저 주고, 자리가 없으면 3·4순위로 옮김. 같은 주제의 테이블끼리는 인원을 고르게, 같은 소속은 흩어지게 앉힘.', '', '']);
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
