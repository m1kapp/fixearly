// 단일 파일 HTML 리포트 생성기.
// 목적: "우리는 어디쯤이고, 무엇부터 고쳐야 하나" 두 질문에만 답한다.
// 랜딩(마케팅)과 다른 물건이다 — 여긴 남의 저장소가 아니라 당신 저장소가 주인공이다.
// 외부 자산 0 (CSP 안전), 열면 바로 보이는 한 장.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// <script type="text/plain"> 안은 엔티티가 해석되지 않는다. 따옴표를 이스케이프하면 클립보드에 &quot;가 그대로 실린다.
// 종료 태그만 무력화하고 나머지는 원문 그대로 둔다.
const raw = (s) => String(s ?? "").replace(/<\/(script)/gi, "<\\/$1");
const n = (x) => (typeof x === "number" ? x.toLocaleString() : x);

const GRADE_COLORS = { S: "#0f7a63", A: "#12915a", B: "#7d8a2c", C: "#c0862e", D: "#cb4436", E: "#8f2f24" };

// 등급 + 플러스 — 각 구간의 상위 40%에 +를 붙인다. 구간이 넓어(C는 15점) 같은 C 안에서도
// 차이가 큰데 라벨이 하나뿐이라 변화가 안 보였다. 색·분포는 기본 글자 기준 그대로다.
const PLUS_AT = { A: 86, B: 76, C: 64, D: 47, E: 21 };
const S_CUTS = [[97, "SSS"], [93, "SS"], [0, "S"]];
function baseGrade(score, cuts) {
  for (const [g, lo] of cuts) if (score >= lo) return g;
  return "E";
}
function gradeOf(score, cuts) {
  const g = baseGrade(score, cuts);
  if (g === "S") return S_CUTS.find(([lo]) => score >= lo)[1];
  return score >= PLUS_AT[g] ? g + "+" : g;
}

// 체급 기준은 '코드줄'이다. 파일 수로 나누면 배치 관습이 체급을 정한다 —
// 실측 줄/파일이 34~2008로 59배 차이라(lodash 3파일 17k줄) 같은 덩치가 다른 링에 섰다.
// 점수 축에서 파일 크기를 강등한 것과 같은 이유다.
function classOf(loc, classes) {
  for (const c of classes) if (loc >= c.lo && (c.hi === null || loc < c.hi)) return c;
  return classes[classes.length - 1];
}


// 체급 벨트 — 격투 단체가 체급을 표시하는 방식 그대로. 판에 코드줄 임계를 새긴다.
// 체급 판 배지 — 작은 자리용
function plate(i, size, col, label) {
  const t = i / 5;
  const uid = "p" + i;
  const rx = 30, ry = 21 + t * 3;
  const ink = "#2b2226";
  return `<svg class="bl" viewBox="0 0 64 52" width="${size}" height="${size * 52 / 64}" aria-hidden="true">
  <defs><linearGradient id="${uid}g" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="42%" stop-color="${col}"/><stop offset="100%" stop-color="${col}"/></linearGradient></defs>
  <ellipse cx="32" cy="26" rx="${rx}" ry="${ry}" fill="url(#${uid}g)" stroke="${ink}" stroke-width="2.4"/>
  <ellipse cx="32" cy="26" rx="${rx - 4}" ry="${ry - 3.4}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".45"/>
  <text x="32" y="${26 + ry * 0.33}" text-anchor="middle" fill="#fff"
    font-family="ui-monospace,Menlo,monospace" font-size="${ry * 0.86}" font-weight="700">${label}</text>
  </svg>`;
}

// 체급 벨트 배지 — 복싱/격투 단체가 실제로 쓰는 체급 상징(챔피언십 벨트).
// 캐릭터와 달리 6개가 같은 퀄로 나오고, 판 안에 코드줄 임계가 들어가 정보도 담는다.
function belt(i, size, col, label) {
  // 작은 크기(탭)에선 벨트 끈이 뭉개진다 → 챔피언 판만 남긴다. 큰 크기(리포트 헤더)는 벨트 전체.
  if (size < 70) return plate(i, size, col, label);
  const t = i / 5;
  const uid = "b" + i;
  const w = 120, h = 62;
  const strapH = 15 + t * 7;              // 체급이 오를수록 두꺼운 벨트
  const plateR = 17 + t * 4;              // 중앙 판도 커진다
  const cy = h / 2, cx = w / 2;
  const ink = "#2b2226";
  return `<svg class="bl" viewBox="0 0 ${w} ${h}" width="${size}" height="${size * h / w}" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a4048"/><stop offset="50%" stop-color="#2b2226"/><stop offset="100%" stop-color="#191418"/></linearGradient>
    <linearGradient id="${uid}p" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="40%" stop-color="${col}"/><stop offset="100%" stop-color="${col}"/></linearGradient>
  </defs>
  <rect x="2" y="${cy - strapH / 2}" width="${w - 4}" height="${strapH}" rx="${strapH / 2}" fill="url(#${uid}s)"/>
  <rect x="8" y="${cy - strapH / 2 + 3}" width="${w - 16}" height="2" rx="1" fill="#fff" opacity=".12"/>
  ${[18, w - 18].map((x) => `<circle cx="${x}" cy="${cy}" r="${3.4 + t}" fill="${col}" stroke="${ink}" stroke-width="1.4"/>`).join("")}
  <ellipse cx="${cx}" cy="${cy}" rx="${plateR * 1.35}" ry="${plateR}" fill="url(#${uid}p)" stroke="${ink}" stroke-width="2.2"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${plateR * 1.13}" ry="${plateR * 0.8}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".45"/>
  <text x="${cx}" y="${cy + plateR * 0.24}" text-anchor="middle" fill="#fff"
    font-family="ui-monospace,Menlo,monospace" font-size="${plateR * 0.66}" font-weight="700">${label}</text>
  </svg>`;
}

const beltLabel=(c)=>c.hi==null?`${Math.round(c.lo/1000)}k+`:`${Math.round(c.hi/1000)}k`;

// 막대: 코퍼스 중앙 이하 초록 · p75까지 주황 · 그 위 빨강.
function bar(value, scaleMax, median, p75) {
  const w = Math.max(2, Math.min(100, (value / scaleMax) * 100));
  const col = value <= median ? "#12915a" : value <= p75 ? "#c0862e" : "#cb4436";
  const mk = Math.min(100, (median / scaleMax) * 100);
  return `<div class="bar"><i style="width:${w}%;background:${col}"></i><u style="left:${mk}%"></u></div>`;
}

// "무엇부터 고칠까" 우선순위. 점수를 올리는 순서가 아니라 변경 비용이 큰 순서다.
// churn(최근 수정 횟수)이 있으면 그것으로, 없으면 크기·복잡도만으로 정렬한다.
function buildFixList(q, hotspots) {
  const items = [];
  const fl = q.fnLength || {};
  // 핫스팟 키는 --dir 기준 상대경로, 함수 목록은 cwd 기준이라 서로 다르다. 접미 일치로 잇는다.
  const churnRows = (hotspots || []).map((h) => [String(h.file).replace(/\\/g, "/"), h.churn || 0]);
  const churnOf = {
    get(file) {
      const f = String(file || "").replace(/\\/g, "/");
      for (const [k, v] of churnRows) if (f === k || f.endsWith("/" + k) || k.endsWith("/" + f)) return v;
      return 0;
    },
  };

  for (const w of (fl.worst || []).slice(0, 8)) {
    const churn = churnOf.get(w.file) || 0;
    items.push({
      kind: "긴 함수", kindEn: "long function",
      what: `${w.name}() ${w.lines}줄`,
      where: `${w.file}:${w.line}`,
      why: churn ? `이 파일은 최근 ${churn}번 바뀌었다 — 매번 이 길이를 읽는다` : "한 번에 읽어야 하는 양이 크다",
      weight: (w.lines || 0) * Math.log2(2 + churn),
      scored: true,
    });
  }
  for (const w of (q.cognitive?.worst || []).slice(0, 5)) {
    const churn = churnOf.get(w.file) || 0;
    items.push({
      kind: "복잡한 함수", kindEn: "complex function",
      what: `${w.name}() 복잡도 ${w.cog}`,
      where: `${w.file}:${w.line}`,
      why: churn ? `churn ${churn}회 — 자주 만지는데 분기가 깊다` : "중첩 분기가 깊어 따라가기 어렵다",
      weight: (w.cog || 0) * 2.2 * Math.log2(2 + churn),
      scored: true,
    });
  }
  for (const s of (q.quadratic?.worst || []).slice(0, 8)) {
    items.push({
      kind: "O(n²)", kindEn: "quadratic lookup",
      what: `${s.callee || s.method || "선형 탐색"} — 루프 안 배열 스캔`,
      where: `${s.file}:${s.line}`,
      why: "Map/Set으로 바꾸면 O(1). 다만 n이 실제로 큰지 먼저 확인할 것",
      weight: 40 + (churnOf.get(s.file) || 0),
      scored: false,
    });
  }
  for (const s of (q.io?.worst || []).slice(0, 5)) {
    items.push({
      kind: "루프 안 I/O", kindEn: "I/O in loop",
      what: `${s.callee || "reader"}() — 반복 호출`,
      where: `${s.file}:${s.line}`,
      why: "호출 한 번이 파일/DB를 N번 읽는다 (순차가 필수인 경우는 예외)",
      weight: 45 + (churnOf.get(s.file) || 0),
      scored: false,
    });
  }
  const tb = q.textbook || {};
  for (const [key, label] of [["awaitInForEach", "forEach 안 await"], ["spreadAccumulator", "스프레드 누적"], ["regexInLoop", "루프 안 정규식"]]) {
    for (const s of (tb[key]?.worst || tb[key]?.sites || []).slice(0, 3)) {
      items.push({
        kind: label, kindEn: key, what: label, where: `${s.file}:${s.line}`,
        why: "교과서 결함 — 고치는 비용이 거의 없다", weight: 30, scored: false,
      });
    }
  }
  // 같은 파일에서 같은 종류가 여러 번 걸리면 한 줄로 묶는다.
  // 3줄 떨어진 readFileSync 두 개는 사람에겐 한 가지 일이다.
  const merged = [];
  const byKey = new Map();
  for (const it of items) {
    const file = String(it.where).split(":")[0];
    const key = it.kind + "|" + file;
    const seen = byKey.get(key);
    if (seen) { seen.count++; seen.lines.push(String(it.where).split(":")[1]); seen.weight += it.weight * 0.35; continue; }
    const rec = { ...it, count: 1, lines: [String(it.where).split(":")[1]], file };
    byKey.set(key, rec); merged.push(rec);
  }
  return merged.sort((a, b) => b.weight - a.weight);
}

// 항목 하나짜리 지시문 — 전체 목록이 아니라 이 결함만 고치게 한다.
// 한 번에 하나가 원칙이라, 복사도 하나씩 되어야 원칙과 도구가 어긋나지 않는다.
function itemPrompt(f, ctx) {
  const rule = {
    "긴 함수": "의미 단위로 자른다. 잘라낸 함수에 이름을 붙일 수 없으면 자르지 않은 것이다. 줄 수를 줄이려는 기계적 분할 금지.",
    "복잡한 함수": "중첩을 걷어낸다(빠른 반환·가드절·분기 테이블). 분기 자체를 없애려 들지 말고 깊이를 낮춰라.",
    "O(n²)": "먼저 바깥 배열의 실제 크기를 코드에서 역추적하라. 상수 목록·설정값이면 고치지 말고 그 근거를 적어라. 크면 Map/Set으로 O(1).",
    "루프 안 I/O": "순차가 필수인지 먼저 판단하라(재시도·커서 페이지네이션은 정상). 아니면 배치 조회나 캐시로 호출 수를 줄인다.",
  }[f.kind] || "가장 작은 변경으로 고친다.";
  return `# 결함 하나 수정: ${f.kind}

## 대상
- 저장소: \`${ctx.projectName}\` (${ctx.cls.ko} · 청결점수 ${ctx.score} ${ctx.gradeF || ctx.grade})
- 위치: **${f.count > 1 ? `${f.file} (${f.lines.length}곳: ${f.lines.join(', ')}행)` : f.where}**
- 내용: ${f.what}${f.count > 1 ? ` — 같은 파일에서 ${f.count}번 반복된다. 한 번에 함께 고쳐라.` : ''}
- 왜 지금인가: ${f.why}

## 방법
${rule}

## 규칙
1. **동작 100% 불변.** 공개 시그니처·반환 타입·에러 종류·호출 순서를 바꾸지 않는다.
2. 이 항목 **하나만** 고친다. 눈에 보이는 다른 문제는 손대지 말고 목록으로만 남겨라.
3. 커밋 1개로 끝낸다. 타입체크·테스트를 통과시키고, 실패하면 되돌린다.
4. 새 의존성·포맷팅 일괄 변경·주석만 추가하는 변경 금지.

## 보고
1. 고쳤는지 / 안 고쳤는지와 그 이유 (안 고치는 판단도 정답일 수 있다)
2. diff
3. **동작이 같다는 근거** — 통과한 테스트 이름이나 수동 검증 절차. 확인 안 했으면 "확인 안 함"이라고 쓴다.`;
}

// 축 하나짜리 개선 지시문 — "점수를 올려라"가 아니라 "이 성질을 실제로 낮춰라".
// 후보 목록을 실제 측정값에서 뽑아 붙이고, 지표만 건드리는 우회로를 규칙으로 막는다.
function axisPrompt(pen, ctx, q) {
  const fl = q.fnLength || {}, cg = q.cognitive || {}, du = q.duplication || {};
  const list = (rows, fmt) => rows.length ? rows.map((r, i) => `${i + 1}. ${fmt(r)}`).join("\n") : "(측정된 후보 없음)";
  const spec = {
    "긴 함수 비율": {
      goal: "40줄(JSX 60줄)을 넘는 함수의 비율을 코퍼스 중앙 4.0%까지 낮춘다",
      how: "함수를 의미 단위로 쪼갠다. 잘라낸 조각에 이름을 붙일 수 없으면 자르지 않은 것이다.",
      cands: list((fl.worst || []).slice(0, 6), (w) => `${w.name}() ${w.lines}줄 — ${w.file}:${w.line}`),
      ban: "- 한 함수를 기계적으로 3등분해 줄 수만 맞추기\n- 로직을 다른 파일로 옮겨 숫자만 옮기기",
    },
    "cog15+ 비율": {
      goal: "인지 복잡도 15를 넘는 함수 비율을 3.0% 아래로 낮춘다",
      how: "중첩을 걷어낸다 — 빠른 반환·가드절·분기 테이블·조건 추출. 분기 개수가 아니라 깊이를 줄여라.",
      cands: list((cg.worst || []).slice(0, 6), (w) => `${w.name}() 복잡도 ${w.cog} — ${w.file}:${w.line}`),
      ban: "- 조건을 헬퍼로 빼서 복잡도만 다른 함수로 이동시키기",
    },
    "cog25+ 비율": {
      goal: "인지 복잡도 25를 넘는 함수 비율을 1.2% 아래로 낮춘다",
      how: "가장 깊은 중첩부터 평탄화한다. 상태 분기가 많다면 상태를 먼저 정리하라.",
      cands: list((cg.worst || []).slice(0, 6), (w) => `${w.name}() 복잡도 ${w.cog} — ${w.file}:${w.line}`),
      ban: "- 조건을 헬퍼로 빼서 복잡도만 옮기기",
    },
    "복잡도 p90": {
      goal: "복잡한 쪽 10% 함수의 복잡도를 낮춘다 (분포를 내리는 일이라 함수 하나로는 안 움직인다)",
      how: "worst 목록부터 순서대로. 한 번에 하나씩, 커밋마다 테스트 통과.",
      cands: list((cg.worst || []).slice(0, 6), (w) => `${w.name}() 복잡도 ${w.cog} — ${w.file}:${w.line}`),
      ban: "- 큰 함수 하나만 고치고 끝내기 (분포 지표라 효과 없음)",
    },
    "중복": {
      goal: "토큰 중복 밀도를 8% 아래로 낮춘다",
      how: "**같은 이유로 함께 바뀔 코드만** 합친다. 우연히 닮은 코드는 그대로 두는 게 맞다.",
      cands: list((du.worstFiles || []).slice(0, 4), (f) => `${f.file} — 중복 토큰 ${f.dupTokens}`),
      ban: "- 우연히 닮은 두 모듈에서 공용 헬퍼 추출 (결합도만 오른다)\n- 빌드 타깃별 의도적 사본 통합",
    },
    "함수 길이 p90": {
      goal: "함수 길이 상위 10%를 23줄 아래로 내린다",
      how: "긴 함수 목록 위에서부터 의미 단위로 분해.",
      cands: list((fl.worst || []).slice(0, 6), (w) => `${w.name}() ${w.lines}줄 — ${w.file}:${w.line}`),
      ban: "- 줄바꿈·포맷팅으로 줄 수 줄이기",
    },
    "함수 길이 상위10 평균": {
      goal: "가장 긴 함수 10개의 평균을 174줄 아래로 내린다 (하나만 고치면 다음 순위가 올라온다 — 여러 개를 줄여야 움직인다)",
      how: "단계별로 이름 있는 함수로 추출. 추출할 때마다 커밋하고 동작을 확인한다.",
      cands: list((fl.worst || []).slice(0, 10), (w) => `${w.name}() ${w.lines}줄 — ${w.file}:${w.line}`),
      ban: "- 본문을 다른 파일로 통째 이동",
    },
    "복잡도 상위10 평균": {
      goal: "가장 복잡한 함수 10개의 평균 복잡도를 65 아래로 낮춘다",
      how: "가장 깊은 분기부터. 상태 머신이면 테이블로, 검증이면 가드절로.",
      cands: list((cg.worst || []).slice(0, 10), (w) => `${w.name}() 복잡도 ${w.cog} — ${w.file}:${w.line}`),
      ban: "- 조건 일부를 다른 함수로 옮겨 숫자만 낮추기",
    },
    "평균 파일 줄": {
      goal: "평균 파일 길이를 120줄 아래로 낮춘다",
      how: "**긴 파일을 쪼개는 게 목적이 아니다.** 파일이 긴 진짜 이유(한 파일에 여러 책임)를 먼저 확인하고, 책임이 실제로 여러 개일 때만 나눈다.",
      cands: `가장 긴 파일: ${q.maxFile?.path || "—"} (${q.maxFile?.lines || 0}줄) · 200줄 넘는 파일 ${q.longFiles || 0}개`,
      ban: "- 응집도 무시하고 파일 분할 (이 도구는 이 항목 배점을 5점으로 낮춰뒀다 — 여기서 점수를 벌 생각이면 그만두는 게 낫다)",
    },
    "200줄+ 파일": {
      goal: "200줄 넘는 파일의 비중을 낮춘다",
      how: "책임이 섞인 파일만 고른다. 단일 책임인데 긴 파일은 그대로 둔다.",
      cands: `가장 긴 파일: ${q.maxFile?.path || "—"} (${q.maxFile?.lines || 0}줄) · 200줄 넘는 파일 ${q.longFiles || 0}개`,
      ban: "- 기계적 분할",
    },
  }[pen.key] || { goal: `${pen.key}를 목표(${pen.target})까지 낮춘다`, how: "가장 큰 기여부터 순서대로.", cands: "(후보 목록 없음)", ban: "- 지표만 겨냥한 변경" };

  return `# 축 개선: ${pen.key}

## 지금
- 저장소 \`${ctx.projectName}\` · ${ctx.cls.ko} · 청결점수 ${ctx.score} ${ctx.gradeF || ctx.grade}
- **${pen.key}: ${pen.now}** (목표 ${pen.target}) — 이 항목에서 ${pen.got.toFixed(1)}점이 깎여 있다

## 목표
${spec.goal}.
점수는 결과일 뿐이다. **읽고 고치는 비용이 실제로 줄지 않으면 실패**로 친다.

## 방법
${spec.how}

## 후보 (측정값에서 뽑은 것)
${spec.cands}

## 금지
${spec.ban}
- 확인 없이 "개선했다"고 주장하기

## 규칙
1. **동작 100% 불변.** 공개 시그니처·반환 타입·에러 종류·호출 순서 유지.
2. 후보 하나 = 커밋 하나. 커밋마다 타입체크·테스트 통과.
3. 전부 고칠 필요 없다. **안 고치는 판단과 그 이유**도 결과물이다.

## 보고
1. 후보별 [고침 / 안 고침 + 이유]
2. 커밋별 diff와 한 줄 요약
3. **동작이 같다는 근거** — 통과한 테스트 이름 또는 수동 검증 절차
4. \`npx cleanscore --dir=<경로> --report\` 재실행 후 이 항목 수치 전후 비교`;
}

// 이 항목을 고치면 점수가 얼마 오르나 — 공식에 그대로 넣어 계산한다.
// 대부분의 항목은 "분포 항"이라 하나로는 거의 안 움직이고, 진단 항목은 아예 0이다.
// 그 사실을 숨기면 "고쳤는데 왜 안 올라?"가 된다.
function scoreEffect(f, q, si) {
  const cap = (v, c) => Math.min(c, Math.max(0, v));
  const L2 = (v, base) => Math.max(0, Math.log2(Math.max(1, v) / base));
  const fnDenom = Math.max(q.functions || 1, 40);
  if (f.kind === "긴 함수") {
    const w = (q.fnLength?.worst || []).find((x) => `${x.file}:${x.line}` === f.where);
    const now = cap(si.fnOver40Pct * 1.95, 16);
    const next = cap(Math.max(0, si.fnOver40Pct - (100 / fnDenom)) * 1.95, 16);
    let gain = now - next;
    // 이 함수가 최장 함수라면 '최장 함수' 항도 함께 풀린다 (다음 순위가 새 최장이 된다)
    // 상위10 평균 항: 이 함수가 상위 10에 있으면 평균이 내려간다(100줄로 줄인다고 가정)
    const top = (q.fnLength?.worst || []).slice(0, 10);
    if (w && top.some((x) => x === w)) {
      const cur = si.fnTop10;
      const next = (top.reduce((a, x) => a + x.lines, 0) - w.lines + Math.min(100, w.lines)) / top.length;
      gain += cap(L2(cur, 174) * 3.6, 4) - cap(L2(next, 174) * 3.6, 4);
    }
    return { gain, note: gain < 0.5 ? "분포 항 — 여러 개 고쳐야 움직인다" : "상위10 평균 항이 함께 내려간다" };
  }
  if (f.kind === "복잡한 함수") {
    const w = (q.cognitive?.worst || []).find((x) => `${x.file}:${x.line}` === f.where);
    let gain = cap((si.over15Pct - (100 / fnDenom) - 3.0) * 2, 12) * -1 + cap((si.over15Pct - 3.0) * 2, 12);
    const top = (q.cognitive?.worst || []).slice(0, 10);
    if (w && top.some((x) => x === w)) {
      const cur = si.cogTop10;
      const next = (top.reduce((a, x) => a + x.cog, 0) - w.cog + Math.min(15, w.cog)) / top.length;
      gain += cap(L2(cur, 65) * 2.66, 4) - cap(L2(next, 65) * 2.66, 4);
    }
    return { gain, note: gain < 0.5 ? "복잡도 축은 이미 기준선 안 — 점수는 거의 안 움직인다" : "상위10 평균 항이 함께 내려간다" };
  }
  return { gain: 0, note: "진단 항목 — 점수에 반영되지 않는다 (성능·정확성 문제)" };
}

// 변화량 — 좋아진 방향은 초록, 나빠진 방향은 빨강. 방향은 지표별로 다르다(점수만 클수록 좋다).
function deltaRows(prev, cur) {
  const { score, si, q, files, codeLines } = cur;
  const rows = [
    { key: "청결점수", from: prev.score, to: score, up: true },
    { key: "긴 함수 (40줄+)", from: prev.fnOver40, to: q.fnLength?.over40, up: false, unit: "개" },
    { key: "함수 길이 상위10 평균", from: prev.fnTop10, to: si.fnTop10, up: false, unit: "줄" },
    { key: "함수 길이 p90", from: prev.fnP90, to: si.fnP90, up: false, unit: "줄" },
    { key: "복잡 함수 (cog15+)", from: prev.cogOver15, to: q.cognitive?.over15, up: false, unit: "개" },
    { key: "복잡도 상위10 평균", from: prev.cogTop10, to: si.cogTop10, up: false },
    { key: "중복", from: prev.dup, to: si.dupPct, up: false, unit: "%" },
    { key: "평균 파일 줄", from: prev.avgFileLines, to: si.avgFileLines, up: false, unit: "줄" },
    { key: "O(n²) 후보", from: prev.quad, to: (q.quadratic || {}).sites || 0, up: false, unit: "곳" },
    { key: "코드줄", from: prev.codeLines, to: codeLines, up: null, unit: "줄" },
  ];
  return rows.filter((r) => r.from != null && r.to != null && r.from !== r.to).map((r) => {
    const diff = Math.round((r.to - r.from) * 10) / 10;
    const better = r.up === null ? 0 : (r.up ? diff > 0 : diff < 0) ? 1 : -1;
    return {
      key: r.key, from: n(r.from) + (r.unit || ""), to: n(r.to) + (r.unit || ""),
      delta: (diff > 0 ? "+" : "") + n(diff) + (r.unit || ""),
      dir: better > 0 ? " good" : better < 0 ? " bad" : "",
    };
  });
}

// 점수를 올리려면 어느 축인가 — 실제 감점액이 큰 순서. 추정이 아니라 계산값이다.
function penaltyBreakdown(si) {
  const cap = (v, c) => Math.min(c, Math.max(0, v));
  const L2 = (v, base) => Math.max(0, Math.log2(Math.max(1, v) / base));
  return [
    { key: "긴 함수 비율", cap: 16, got: cap(si.fnOver40Pct * 1.95, 16), now: `${si.fnOver40Pct}%`, target: "4.0% 이하" },
    { key: "cog15+ 비율", cap: 12, got: cap((si.over15Pct - 3.0) * 2, 12), now: `${si.over15Pct}%`, target: "3.0% 이하" },
    { key: "cog25+ 비율", cap: 12, got: cap((si.over25Pct - 1.2) * 3, 12), now: `${si.over25Pct}%`, target: "1.2% 이하" },
    { key: "복잡도 p90", cap: 9, got: cap(L2(si.p90Cog, 6) * 3.0, 9), now: String(si.p90Cog), target: "6 이하" },
    { key: "중복", cap: 9, got: cap((si.dupPct - 8) * 1.2, 9), now: `${si.dupPct}%`, target: "8% 이하" },
    { key: "함수 길이 p90", cap: 6, got: cap(L2(si.fnP90, 23) * 11, 6), now: `${si.fnP90}줄`, target: "23줄 이하" },
    { key: "평균 파일 줄", cap: 5, got: cap((si.avgFileLines - 120) / 5, 5), now: `${si.avgFileLines}줄`, target: "120줄 이하" },
    { key: "복잡도 상위10 평균", cap: 4, got: cap(L2(si.cogTop10, 65) * 2.66, 4), now: String(si.cogTop10), target: "65 이하" },
    { key: "함수 길이 상위10 평균", cap: 4, got: cap(L2(si.fnTop10, 174) * 3.6, 4), now: `${si.fnTop10}줄`, target: "174줄 이하" },
    { key: "200줄+ 파일", cap: 3, got: cap(si.longFileSeverityPct * 1.3, 3), now: `${si.longFileSeverityPct}%`, target: "—" },
  ].sort((a, b) => b.got - a.got);
}

// 동료 목록 테이블 — "누구랑 비교당하는지"를 감추지 않는다.
let CUTS = [["S", 90], ["A", 80], ["B", 70], ["C", 55], ["D", 35], ["E", 0]];
function repoTable(rows, me) {
  const GC = GRADE_COLORS;
  const row = (r, mine) => `<tr${mine ? ' class="mine"' : ""}>
    <td class="rn">${esc(r.name)}${r.ver ? ` <span class="rv">v${esc(r.ver)}</span>` : ""}${mine ? ' <span class="rv">이 저장소</span>' : ""}</td>
    <td class="rk">${esc(r.kind || "")}</td>
    <td class="rf">${n(r.files)}</td>
    <td class="rf">${r.loc ? n(r.loc) : "—"}</td>
    <td class="rg"><span class="gg" style="background:${GC[r.grade]}">${r.gradeF || r.grade}</span><b>${r.score}</b></td>
  </tr>`;
  const all = (me ? [...rows, me] : rows.slice()).map((r) => ({ ...r, gradeF: r.gradeF || gradeOf(r.score, CUTS) }))
    .sort((a, b) => b.score - a.score);
  return `<table class="rt"><thead><tr>
    <th>저장소</th><th>종류</th><th class="num">파일</th><th class="num">코드줄</th><th class="num">등급</th>
  </tr></thead><tbody>${all.map((r) => row(r, me && r === me)).join("")}</tbody></table>`;
}

// AI에게 그대로 붙여넣는 작업 지시문.
// 설계 의도: (1) 목표를 "점수"가 아니라 "변경 비용"으로 못박아 굿하트를 막고,
// (2) 동작 불변을 검증 가능한 형태로 요구하고, (3) 도구가 스스로 인정한 한계
// (O(n²)는 n이 커야 의미 있음, 파일 분할은 조작)를 지시문에 넣어 헛수고를 막는다.
function buildPrompt({ projectName, grade, score, cls, rank, total, peerMed, si, fixes }) {
  const top = fixes.slice(0, 10).map((f, i) =>
    `${i + 1}. [${f.kind}] ${f.what}\n   위치: ${f.where}\n   이유: ${f.why}`).join("\n");
  return `# 코드 부채 정리 작업

## 맥락
- 대상: \`${projectName}\` (${cls.ko}, ${si.avgFileLines}줄/파일 평균)
- 현재 청결점수 ${score}점 ${grade}등급 — 같은 체급 유명 오픈소스 ${total}개 중 ${rank}위 (체급 중앙 ${peerMed}점)
- 코퍼스 대비: 긴 함수 ${si.fnOver40Pct}% (중앙 4.0%) · 함수 길이 p90 ${si.fnP90}줄 (중앙 23줄) · 복잡 함수 ${si.over15Pct}% (중앙 2.9%) · 중복 ${si.dupPct}% (중앙 3.9%)

## 목표
점수를 올리는 게 아니라 **다음 사람이 이 코드를 고칠 때 드는 비용**을 낮춘다.
점수는 결과로 따라오게 둔다. 아래 규칙을 어기면서 점수만 올리는 변경은 실패로 친다.

## 고칠 자리 (변경 비용 순 — 위에서부터)
${top}

## 작업 규칙 (반드시 지킬 것)
1. **동작 100% 불변.** 공개 API 시그니처·반환 타입·에러 종류·이벤트 순서를 바꾸지 않는다.
2. **한 번에 하나.** 항목 1개 = 커밋 1개. 커밋마다 타입체크와 테스트를 통과시키고, 실패하면 다음으로 넘어가지 않는다.
3. **긴 함수는 "의미 단위"로 자른다.** 줄 수를 줄이려고 기계적으로 자르지 마라. 잘라낸 함수에 이름을 붙일 수 없으면 자르지 않은 것이다.
4. **파일을 의미 없이 쪼개지 마라.** 파일 분할로 지표를 낮추는 것은 조작이며, 이 도구는 그 배점을 이미 낮춰놨다.
5. **O(n²)는 n을 먼저 확인.** 바깥 배열의 실제 크기를 코드에서 역추적하라. 상수 목록·설정값처럼 n이 작으면 **고치지 말고 그 이유를 적어라.**
6. **중복은 함부로 합치지 마라.** 우연히 닮은 코드를 공용 헬퍼로 뽑으면 결합도만 오른다. 같은 이유로 함께 바뀔 코드만 합친다.
7. 새 의존성 추가 금지. 포맷팅 일괄 변경 금지. 주석만 추가하는 변경 금지.

## 산출물
1. **계획** — 항목별로 [고친다 / 안 고친다 + 이유] 판정부터. 전부 고칠 필요 없다.
2. **단계별 변경** — 커밋 단위 diff와 각 커밋의 한 줄 요약.
3. **불변 증명** — 각 변경마다 "동작이 같다"를 어떻게 확인했는지. 테스트 이름, 실행 결과, 수동 검증 절차 중 하나 이상. 확인 안 했으면 안 했다고 쓴다.
4. **재측정** — 작업 후 \`npx cleanscore --dir=<경로> --report\` 를 다시 돌려 전후 점수와 축별 변화를 붙인다.

## 하지 말 것
- 지표를 겨냥한 변경 (파일 쪼개기, 무의미한 헬퍼 추출, 짧은 함수 대량 생성)
- 확인 없이 "개선했다"고 주장하기
- 한 커밋에 여러 항목 섞기`;
}

export function renderReport({ projectName, quality, source, corpus, hotspots, previous, history }) {
  const q = quality;
  const si = q.scoreInputs;
  const score = q.score;
  const grade = q.gradeBase || String(q.grade).replace(/\+|S{2,}/g, (m) => (m[0] === "S" ? "S" : ""));  // 색·분포용 기본 등급
  const gradeF = q.grade || gradeOf(score, corpus.gradeCuts);     // 표시용(+ 포함)
  const files = source.files;
  const codeLines = source.codeLines;
  const cls = classOf(codeLines, corpus.classes);
  const peers = corpus.repos.filter((r) => classOf(r.loc || 0, corpus.classes).ko === cls.ko);
  const better = peers.filter((r) => r.score > score).length;
  const rank = better + 1;
  const total = peers.length + 1;
  const peerScores = peers.map((r) => r.score).sort((a, b) => a - b);
  const peerMed = peerScores.length
    ? (peerScores.length % 2 ? peerScores[(peerScores.length - 1) / 2]
      : Math.round((peerScores[peerScores.length / 2 - 1] + peerScores[peerScores.length / 2]) / 2))
    : null;
  CUTS = corpus.gradeCuts;
  const A = corpus.axes;
  const fixes = buildFixList(q, hotspots);
  const pens = penaltyBreakdown(si);
  const totalPen = pens.reduce((s, p) => s + p.got, 0);
  // 지켜낸 축 — 감점 0인 항목. "잘하고 있는 것"을 먼저 보여준다.
  const kept = pens.filter((p) => p.got <= 0.05);
  const keptNote = kept.length >= 5
    ? "축 절반 이상이 무실점이다. 남은 감점은 몇 군데에 몰려 있다는 뜻이라, 손댈 곳이 적다."
    : "이 축들은 코퍼스 기준선 안쪽이다. 여기 손댈 필요 없다.";
  const metrics = [
    ["긴 함수 비율", `40줄+ (JSX 60줄+)`, si.fnOver40Pct, 14, A.fn40, `${si.fnOver40Pct}%`],
    ["함수 길이 p90", "한 번에 읽는 양", si.fnP90, 70, A.fnP90, `${si.fnP90}줄`],
    ["함수 길이 상위10 평균", "최악 10개 평균", si.fnTop10, 600, A.fnTop10 || A.fnMax, `${si.fnTop10}줄`],
    ["복잡 함수 비율", "cog 15 초과", si.over15Pct, 8, A.cog15, `${si.over15Pct}%`],
    ["복잡도 상위10 평균", "최악 10개 평균", si.cogTop10, 300, A.cogTop10 || A.maxCog, String(si.cogTop10)],
    ["중복", "토큰 단위", si.dupPct, 25, A.dup, `${si.dupPct}%`],
    ["평균 파일 줄", "보조 항", si.avgFileLines, 300, A.avg, `${si.avgFileLines}줄`],
  ];

  // 체급 분포 스트립 — 동료들 점수 위에 내 위치를 찍는다
  const strip = peers.map((r) =>
    `<span class="pt" style="left:${r.score}%" title="${esc(r.name)} ${r.score}"></span>`).join("") +
    `<span class="me" style="left:${score}%"><b>${score}</b></span>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>cleanscore — ${esc(projectName)}</title>
<style>
/* ── 토큰: 타입 스케일·간격 스케일을 고정한다. 임의값 금지 ── */
:root{
  color-scheme:light;
  --ink:#12141a; --ink-2:#4a5160; --ink-3:#8891a0; --paper:#fff; --paper-2:#f7f8fa;
  --line:#e9ebf0; --line-2:#d6dae2; --accent:#2f6df6;
  --good:#12915a; --good-bg:#f2faf5; --good-line:#cbe6d8; --bad:#cb4436; --warn:#c0862e;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Pretendard","Segoe UI",Roboto,sans-serif;
  /* 타입 5단 */
  --t-xs:11px; --t-sm:12.5px; --t-md:14px; --t-lg:16px; --t-h2:19px;
  /* 간격 8의 배수 */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
  --r:10px; --r-sm:7px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-size:var(--t-md);line-height:1.6;word-break:keep-all;overflow-wrap:break-word;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.w{max-width:960px;margin:0 auto;padding:0 var(--s5)}

/* ── 헤더 ── */
header{border-bottom:1px solid var(--line);padding:var(--s6) 0 var(--s5)}
.brand{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.09em;color:var(--ink-3);text-transform:uppercase}
h1{font-size:clamp(26px,4vw,34px);line-height:1.15;letter-spacing:-.028em;font-weight:800;margin:var(--s2) 0 0}
.hero{display:flex;flex-wrap:wrap;gap:var(--s3) var(--s5);align-items:center;margin-top:var(--s4);min-width:0}
.big{display:flex;align-items:center;gap:var(--s3)}
.g{display:inline-flex;align-items:center;justify-content:center;min-width:44px;padding:0 8px;height:44px;border-radius:9px;
  color:#fff;font-weight:800;font-size:21px;line-height:1}
.sc{font-size:42px;font-weight:850;letter-spacing:-.03em;line-height:44px}
.meta{font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-2);display:flex;
  gap:var(--s1) var(--s4);flex-wrap:wrap;flex:1 1 300px;min-width:0}
.meta span{white-space:nowrap}

/* ── 섹션 ── */
section{padding:var(--s7) 0;border-bottom:1px solid var(--line)}
h2{font-size:var(--t-h2);font-weight:750;letter-spacing:-.015em;line-height:1.3;margin:0 0 var(--s1)}
.sub{color:var(--ink-2);font-size:13.5px;line-height:1.6;margin:0 0 var(--s5);max-width:62em}

/* ── 분포 스트립 ── */
.strip{position:relative;height:42px;margin:var(--s5) 0 var(--s2);border-radius:var(--r-sm);
  background:linear-gradient(90deg,#fdeceb,#fdf5e8 45%,#eef8f1)}
.strip .pt{position:absolute;top:13px;width:2px;height:16px;background:var(--ink-3);opacity:.5;transform:translateX(-1px)}
.strip .me{position:absolute;top:-6px;transform:translateX(-50%);white-space:nowrap}
.strip .me b{display:inline-block;background:var(--ink);color:#fff;font-family:var(--mono);
  font-size:var(--t-sm);font-weight:700;padding:3px 9px;border-radius:6px}
.strip .me::after{content:"";display:block;width:2px;height:22px;background:var(--ink);margin:2px auto 0}
.axis{display:flex;justify-content:space-between;font-family:var(--mono);font-size:var(--t-xs);color:var(--ink-3)}

/* ── 축 막대 ── */
.met{display:grid;grid-template-columns:minmax(160px,230px) 1fr 76px;gap:var(--s4);align-items:center;
  padding:var(--s3) 0;border-bottom:1px solid var(--line)}
.met:last-of-type{border-bottom:0}
.ml{font-size:13.5px;line-height:1.4}
.ml small{display:block;color:var(--ink-3);font-size:var(--t-xs);font-family:var(--mono);margin-top:2px}
.bar{position:relative;height:8px;background:var(--paper-2);border-radius:99px}
.bar i{display:block;height:100%;border-radius:99px}
.bar u{position:absolute;top:-3px;width:1px;height:14px;background:var(--ink-3);opacity:.45}
.mv{text-align:right;font-family:var(--mono);font-weight:700;font-size:13.5px}

/* ── 카드 공통 ── */
.note,.kept,.step,.howto{border-radius:var(--r);padding:var(--s4) var(--s4);font-size:13px;line-height:1.6}
.note{background:var(--paper-2);border-left:3px solid var(--line-2);border-radius:0 var(--r) var(--r) 0;
  color:var(--ink-2);margin-top:var(--s5)}
.howto{border:1px solid var(--line-2);background:var(--paper-2);color:var(--ink-2);margin:0 0 var(--s5)}
.howto b{color:var(--ink)}
.kept{border:1px solid var(--good-line);background:var(--good-bg);margin:0 0 var(--s5)}
.kept .kt{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.06em;text-transform:uppercase;
  color:var(--good);margin-bottom:var(--s3)}
.kc{display:inline-block;border:1px solid var(--good-line);background:#fff;border-radius:99px;
  padding:3px 11px;margin:0 var(--s2) var(--s2) 0;font-size:var(--t-sm);color:#2c5c44}
.kc b{font-family:var(--mono);font-weight:700}
.kept .kn{margin:var(--s1) 0 0;font-size:var(--t-sm);color:#3f6b55}
.step{border:1px solid var(--line-2);border-left:3px solid var(--accent);border-radius:0 var(--r) var(--r) 0;margin:var(--s5) 0 0}
.step .st{font-family:var(--mono);font-size:var(--t-xs);letter-spacing:.06em;text-transform:uppercase;
  color:var(--accent);margin-bottom:var(--s2)}
.step p{margin:0}
.step .sg{margin-top:var(--s3);font-family:var(--mono);font-size:13.5px;display:flex;gap:var(--s2);
  align-items:baseline;flex-wrap:wrap}
.step .sg span{color:var(--ink-3)}
.step .sg b{color:var(--good);font-size:15px}
.step .sn{margin-top:var(--s2);font-size:var(--t-xs);color:var(--ink-3)}

/* ── 감점 행 ── */
.pen{display:grid;grid-template-columns:minmax(210px,272px) minmax(90px,1fr) 116px 78px;gap:var(--s4);align-items:center;
  padding:var(--s3) 0;border-bottom:1px solid var(--line)}
.pen:last-of-type{border-bottom:0}
.pen .pb{height:8px;background:var(--paper-2);border-radius:99px;display:flex;overflow:hidden}
.pen .pb i{display:block;height:100%}
.pen .pb i.ok{background:#bfe3cd}
.pen .pb i.no{background:var(--bad)}
.pa{text-align:right}
.pen .pv{text-align:right;font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-3);white-space:nowrap}
.pen .pv b{color:var(--ink);font-weight:700;font-size:13.5px}

/* ── 표 공통 ── */
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-weight:600;color:var(--ink-3);font-size:var(--t-xs);font-family:var(--mono);
  text-transform:uppercase;letter-spacing:.06em;padding:0 var(--s3) var(--s2) 0;border-bottom:1px solid var(--line-2);white-space:nowrap}
td{padding:var(--s3) var(--s3) var(--s3) 0;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
.tag{display:inline-block;font-family:var(--mono);font-size:10.5px;padding:2px 8px;border-radius:99px;
  border:1px solid var(--line-2);color:var(--ink-2);white-space:nowrap;line-height:1.5}
.tag.s{border-color:#c9d6f8;color:#2f5fd0;background:#f4f7ff}
.loc{font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-2);word-break:break-all;margin-top:3px}
.why{color:var(--ink-3);font-size:var(--t-sm);line-height:1.55}
.eff{display:inline-block;margin-top:var(--s2);font-family:var(--mono);font-size:10.5px;
  border-radius:99px;padding:2px 8px;border:1px solid var(--line-2);color:var(--ink-3);white-space:nowrap}
.eff.up{border-color:#bfe3cd;background:var(--good-bg);color:#1d7a52;font-weight:700}
.eff.none{border-style:dashed}
.effn{display:block;margin-top:3px;font-size:10.5px;color:var(--ink-3);line-height:1.45}
.cnt{display:inline-block;margin-left:var(--s2);font-family:var(--mono);font-size:10.5px;color:var(--ink-3);
  border:1px solid var(--line-2);border-radius:99px;padding:1px 8px}
.fx th.num,td.act{text-align:right}
td.act{white-space:nowrap}

/* ── 버튼 ── */
.cp{border:1px solid var(--line-2);background:var(--paper);border-radius:var(--r-sm);padding:7px 15px;
  font-size:var(--t-sm);font-weight:650;font-family:var(--sans);color:var(--ink);cursor:pointer;
  min-width:74px;text-align:center;box-sizing:border-box;line-height:1.4;
  transition:border-color .15s ease,color .15s ease}
.cp:hover{border-color:var(--accent);color:var(--accent)}
.cp.ok{border-color:var(--good);color:var(--good)}
.cp.mini{padding:5px 0;font-size:var(--t-sm);font-weight:600;border-radius:6px;min-width:64px}

/* ── 아코디언 ── */
.acc{margin-top:var(--s4);border-top:1px solid var(--line)}
.acc summary,.ex summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:var(--s2);
  font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-2)}
.acc summary{padding:var(--s3) 0}
.acc summary::-webkit-details-marker,.ex summary::-webkit-details-marker{display:none}
.acc summary::before,.ex summary::before{content:"+";font-weight:700;color:var(--ink-3)}
.acc[open] summary::before,.ex[open] summary::before{content:"−"}
.acc summary:hover,.ex summary:hover{color:var(--accent)}
.ex{margin-top:var(--s3);border-top:1px solid var(--line)}
.ex summary{padding:var(--s3) 0 0;font-size:var(--t-xs);color:var(--ink-3)}
.ex pre{background:#0f1218;color:#dfe4ec;font-family:var(--mono);font-size:11.5px;line-height:1.65;
  padding:var(--s4);border-radius:9px;overflow:auto;max-height:320px;white-space:pre-wrap;
  word-break:break-word;margin:var(--s3) 0 var(--s1)}

/* ── 동료 표 ── */
.rt{margin:var(--s1) 0 var(--s4);width:100%}
.rt th{padding:0 var(--s3) var(--s2) 0}
.rt td{padding:var(--s2) var(--s3) var(--s2) 0;font-size:13.5px}
.rt tr:hover td{background:var(--paper-2)}
.rt .rn{font-weight:600}
.rt .rv{font-family:var(--mono);font-size:var(--t-xs);color:var(--ink-3);font-weight:400}
.rt .rk{color:var(--ink-3);font-size:var(--t-sm);white-space:nowrap}
.rt .rf{font-family:var(--mono);font-size:var(--t-sm);color:var(--ink-2);text-align:right;white-space:nowrap}
.rt .rg{text-align:right;white-space:nowrap;font-family:var(--mono)}
.rt .rg b{display:inline-block;min-width:26px;text-align:right;font-weight:750;font-size:13.5px}
.rt .gg{display:inline-block;min-width:26px;text-align:center;border-radius:4px;padding:1px 5px;
  margin-right:var(--s2);color:#fff;font-size:10.5px;font-weight:750}
.rt tr.mine td{background:#eaf1ff;border-top:1px solid #b9cdfa;border-bottom:1px solid #b9cdfa;font-weight:650}
.rt tr.mine:hover td{background:#e2ebff}
.rt tr.mine .rn{color:var(--accent);padding-left:9px}
.rt tr.mine .rf{color:var(--ink)}
.rt tr.mine td:first-child{box-shadow:inset 3px 0 0 var(--accent)}

dialog{border:1px solid var(--line-2);border-radius:var(--r);padding:0;max-width:min(94vw,720px);width:100%;
  background:var(--paper);color:var(--ink);box-shadow:0 24px 60px rgba(18,20,26,.22)}
dialog::backdrop{background:rgba(18,20,26,.42)}
.pd-h{display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);border-bottom:1px solid var(--line)}
.pd-h b{font-size:14px;font-weight:700;font-family:var(--mono);min-width:0;overflow-wrap:anywhere}
.pd-x{margin-left:auto;border:0;background:transparent;color:var(--ink-3);font-size:20px;line-height:1;
  padding:2px 6px;border-radius:6px;cursor:pointer}
.pd-x:hover{background:var(--paper-2);color:var(--ink)}
#pd-b{background:#0f1218;color:#dfe4ec;font-family:var(--mono);font-size:11.5px;line-height:1.7;
  padding:var(--s4) var(--s5);margin:0;max-height:min(58vh,520px);overflow:auto;white-space:pre-wrap;word-break:break-word}
.pd-f{display:flex;align-items:center;gap:var(--s3);padding:var(--s4) var(--s5);flex-wrap:wrap}
.pd-n{font-size:var(--t-sm);color:var(--ink-3)}
.dl{display:grid;gap:0}
.dr{display:grid;grid-template-columns:minmax(160px,240px) 1fr 96px;gap:var(--s4);align-items:center;
  padding:var(--s3) 0;border-bottom:1px solid var(--line)}
.dr:last-child{border-bottom:0}
.dk{font-size:13.5px}
.dv{font-family:var(--mono);font-size:13px;display:flex;gap:var(--s2);align-items:baseline;flex-wrap:wrap}
.dv .d0{color:var(--ink-3)}
.dv .dar{color:var(--ink-3)}
.dv b{font-weight:700}
.dd{text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ink-3);white-space:nowrap}
.dr.good .dd{color:var(--good)}
.dr.good .dv b{color:var(--good)}
.dr.bad .dd{color:var(--bad)}
.dr.bad .dv b{color:var(--bad)}
.warn{color:var(--bad)}
footer{padding:var(--s6) 0 var(--s7);color:var(--ink-3);font-size:var(--t-sm);
  font-family:var(--mono);line-height:1.8}

/* ── 좁은 화면 ── */
@media(max-width:720px){
  .w{padding:0 var(--s4)}
  section{padding:var(--s6) 0}
  .met{grid-template-columns:1fr;gap:var(--s2);padding:var(--s3) 0}
  .pen{grid-template-columns:1fr;gap:var(--s2)}
  .mv,.pen .pv,.pa{text-align:left}
  .dr{grid-template-columns:1fr;gap:var(--s1)}
  .dd{text-align:left}
  .fx thead{display:none}
  .fx tr{display:block;padding:var(--s3) 0;border-bottom:1px solid var(--line)}
  .fx td{display:block;border:0;padding:2px 0}
  .fx td.why{padding-top:var(--s2)}
  .fx td.act{text-align:left;padding-top:var(--s3)}
  .rt th:nth-child(4),.rt td:nth-child(4),.rt .rk{display:none}
  .rt td{padding:var(--s2) var(--s2) var(--s2) 0}
}
</style></head><body>
<header><div class="w">
  <div class="brand">cleanscore · ${esc(corpus.version)} · 코퍼스 ${corpus.n}개 기준</div>
  <h1>${esc(projectName)}</h1>
  <div class="hero">
    <div class="big"><span class="g${gradeF.length > 1 ? " gp" : ""}" style="background:${GRADE_COLORS[grade]}">${gradeF}</span><span class="sc">${score}</span></div>
    <div class="meta">
      <span>${esc(cls.ko)}</span>
      <span>${n(files)}파일</span>
      <span>${n(source.codeLines)} 코드줄</span>
      <span>함수 ${n(q.functions)}개</span>
      <span>체급 내 ${rank}/${total}위${peerMed !== null ? ` · 체급 중앙 ${peerMed}점` : ""}</span>
    </div>
  </div>
</div></header>

<section><div class="w">
  <h2>어디쯤인가</h2>
  <p class="sub">같은 체급(${esc(cls.ko)}, ${n(cls.lo)}~${cls.hi ? n(cls.hi) : "∞"}줄) 유명 오픈소스 ${peers.length}개 위에 이 저장소를 찍은 것.</p>
  <div class="strip">${strip}</div>
  <div class="axis"><span>0</span><span>35 · D</span><span>55 · C</span><span>70 · B</span><span>80 · A</span><span>90 · S</span><span>100</span></div>
  <div class="note">막대 위 회색 눈금이 동료 저장소다. ${peers.length ? `가장 가까운 동료: ${esc(peers.slice().sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score)).slice(0, 3).map((r) => `${r.name} ${r.score}`).join(" · "))}` : ""}</div>
  <details class="acc"><summary>같은 체급 ${peers.length}개 전부 보기</summary>
    ${repoTable(peers, { name: projectName, kind: "", files, loc: source.codeLines, score, grade, gradeF, ver: "" })}
  </details>

</div></section>

<section><div class="w">
  <h2>축별 위치</h2>
  <p class="sub">막대의 세로 눈금이 코퍼스 중앙값. 초록=중앙 이하 · 주황=상위 25%까지 · 빨강=그 위.</p>
  ${metrics.map(([label, sub, val, scale, ax, disp]) => `<div class="met">
    <div class="ml">${esc(label)}<small>${esc(sub)} · 중앙 ${ax.median}</small></div>
    ${bar(val, scale, ax.median, ax.p75)}
    <div class="mv">${esc(disp)}</div></div>`).join("")}
</div></section>

<section><div class="w">
  <h2>무엇부터 고칠까</h2>
  <p class="sub">점수 순서가 아니라 <b>변경 비용</b> 순서다. 각 줄에 <b>점수 영향</b>도 적었다 — 대부분은 분포 항이라 하나로는 거의 안 움직이고, 진단 항목은 0이다. git 이력이 있으면 자주 고치는 파일을 위로 올린다.
  ${fixes.some((f) => !f.scored) ? "회색 태그는 점수에 반영되지 않는 진단이다 — 등급과 무관하게 실제 결함이다." : ""}</p>
  <table class="fx"><thead><tr><th style="width:100px">무엇</th><th>어디</th><th style="width:32%">왜</th><th class="num" style="width:86px">AI 지시문</th></tr></thead><tbody>
  ${fixes.slice(0, 14).map((f, ix) => `<tr>
    <td><span class="tag${f.scored ? " s" : ""}">${esc(f.kind)}</span></td>
    <td><div>${esc(f.what)}${f.count > 1 ? `<span class="cnt">같은 파일 ${f.count}곳</span>` : ""}</div>
      <div class="loc">${esc(f.count > 1 ? `${f.file}:${f.lines.join(", :")}` : f.where)}</div></td>
    <td class="why">${esc(f.why)}
      ${(() => { const ef = scoreEffect(f, q, si);
        return ef.gain >= 0.5 ? `<span class="eff up">점수 +${ef.gain.toFixed(1)}</span>`
          : ef.gain > 0.02 ? `<span class="eff">점수 +${ef.gain.toFixed(2)}</span>`
          : `<span class="eff none">점수 무관</span>`; })()}
      <span class="effn">${esc(scoreEffect(f, q, si).note)}</span></td>
    <td class="act"><button class="cp mini" data-open="i${ix}" data-title="${esc(f.kind)} · ${esc(f.where)}">지시문</button>
      <script type="text/plain" id="i${ix}">${raw(itemPrompt(f, { projectName, cls, score, grade, gradeF }))}</script></td></tr>`).join("")}
  </tbody></table>
  ${fixes.length === 0 ? '<div class="note">짚을 자리가 없다. 진단 17종 모두 깨끗하다.</div>' : ""}
</div></section>

${previous ? `<section><div class="w">
  <h2>지난번 대비</h2>
  <p class="sub">${esc(previous.at)} 측정과 비교.${previous.rules && previous.rules !== corpus.version ? ` <b class="warn">지난 측정은 채점 규칙 ${esc(previous.rules)}로 잰 값이라 점수 비교는 무효다</b> — 원지표(개수·줄수)만 보라.` : ""} <b>점수는 절대 위치, 이건 당신이 한 일</b>이다 —
  자기 이력과의 비교라 지표만 건드려서는 움직이지 않는다.${history && history.length > 2 ? ` 기록 ${history.length}회.` : ""}</p>
  <div class="dl">${deltaRows(previous, { score, si, q, files, codeLines }).map((d) => `<div class="dr${d.dir}">
    <div class="dk">${esc(d.key)}</div>
    <div class="dv"><span class="d0">${esc(d.from)}</span><span class="dar">→</span><b>${esc(d.to)}</b></div>
    <div class="dd">${esc(d.delta)}</div></div>`).join("")}</div>
</div></section>

` : ""}<section><div class="w">
  <h2>점수 지도</h2>
  <p class="sub">각 줄의 <b>[복사]</b>는 그 축을 <b>실제로</b> 낮추는 작업 지시문이다 — 후보 목록과 "이렇게 하면 반칙" 규칙이 함께 들어간다.
  100점에서 시작해 축마다 깎인다. <b>지켜낸 ${(100 - totalPen).toFixed(0)}점</b>이 왼쪽, 깎인 ${totalPen.toFixed(1)}점이 오른쪽이다. 추정이 아니라 계산값.</p>

  ${kept.length ? `<div class="kept"><div class="kt">이미 지켜낸 축 — 감점 0</div>
    ${kept.map((k) => `<span class="kc">${esc(k.key)} <b>${esc(k.now)}</b></span>`).join("")}
    <p class="kn">${esc(keptNote)}</p></div>` : ""}

  ${pens.filter((p) => p.got > 0.05).map((p, pi) => `<div class="pen">
    <div>${esc(p.key)}<br><span class="loc">지금 ${esc(p.now)} → 목표 ${esc(p.target)}</span></div>
    <div class="pb"><i class="ok" style="width:${Math.round(((p.cap - p.got) / p.cap) * 100)}%"></i><i class="no" style="width:${Math.round((p.got / p.cap) * 100)}%"></i></div>
    <div class="pv"><b>${(p.cap - p.got).toFixed(1)}</b> 확보 · −${p.got.toFixed(1)}</div>
    <div class="pa"><button class="cp mini" data-open="a${pi}" data-title="축 개선 · ${esc(p.key)}">지시문</button>
      <script type="text/plain" id="a${pi}">${raw(axisPrompt(p, { projectName, cls, score, grade, gradeF }, q))}</script></div></div>`).join("")}


  <div class="note"><b>점수를 올리려고 고치지 마라.</b> 위 "무엇부터 고칠까"를 먼저 하고 점수는 따라오게 두는 편이 낫다.
  파일을 의미 없이 쪼개면 평균 파일 줄만 내려가고 읽기는 더 나빠진다 — 그래서 그 항목의 배점을 5점으로 낮췄다.</div>
</div></section>

<footer><div class="w">
  이건 특정 기준으로 바라본 한 단면이다. 설계·테스트·문서·보안·성능·커뮤니티는 재지 않는다.<br>
  기준선: 유명 오픈소스 ${corpus.n}개 (${esc(corpus.measuredAt)} 측정) · 채점축 4개 · 진단 17종
</div></footer>
<dialog id="pdlg">
  <div class="pd-h"><b id="pd-t"></b><button class="pd-x" data-close>×</button></div>
  <pre id="pd-b"></pre>
  <div class="pd-f"><button class="cp" id="pd-c">복사</button>
    <span class="pd-n">Claude Code·Codex·Cursor에 붙여넣으면 된다</span></div>
</dialog>
<script>
const dlg = () => document.getElementById('pdlg');
document.addEventListener('click', function (ev) {
  const open = ev.target.closest('[data-open]');
  if (open) {
    const src = document.getElementById(open.getAttribute('data-open')); if (!src) return;
    document.getElementById('pd-t').textContent = open.getAttribute('data-title') || '작업 지시문';
    document.getElementById('pd-b').textContent = src.textContent;
    dlg().showModal(); return;
  }
  if (ev.target.closest('[data-close]')) { dlg().close(); return; }
  // 백드롭 클릭 — 클릭이 dialog 자신에 떨어지면 내용 바깥이다
  if (ev.target === dlg()) { dlg().close(); return; }
  const cp = ev.target.closest('#pd-c');
  if (cp) {
    const t = document.getElementById('pd-b').textContent;
    const done = () => { cp.textContent = '복사됨 ✓'; cp.classList.add('ok');
      setTimeout(() => { cp.textContent = '복사'; cp.classList.remove('ok'); }, 1800); };
    const fallback = () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a);
      a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); done(); };
    if (navigator.clipboard) { navigator.clipboard.writeText(t).then(done, fallback); } else { fallback(); }
  }
});
</script>
</body></html>`;
}
