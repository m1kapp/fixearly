import { createHash } from "crypto";

// Sweep is a triage layer, not another quality score.  It reuses the analyzer's
// existing findings and answers one question: which sites deserve expensive
// context/runtime verification now, and which can wait for the next diff?
const RULES = {
  quadratic: { label: "O(n²) 배열 조회", confidence: 2, severity: 3, fixability: 2, next: "실제 입력 n의 상한과 수정 전후 호출 수·시간을 확인" },
  serialAwait: { label: "독립 await 직렬화", confidence: 2, severity: 3, fixability: 2, next: "호출 간 데이터 의존성과 동시 실패 정책을 확인" },
  nplusOne: { label: "루프 안 N+1", confidence: 2, severity: 3, fixability: 2, next: "대표 입력에서 수정 전후 외부 호출 횟수를 확인" },
  io: { label: "루프 안 파일 읽기", confidence: 1, severity: 3, fixability: 1, next: "실제 반복 횟수와 캐시 가능한 수명 범위를 확인" },
  renderGates: { label: "렌더 인질", confidence: 1, severity: 2, fixability: 1, next: "느린 요청을 넣고 무관한 UI가 먼저 그려지는지 확인" },
  coupling: { label: "순환 의존", confidence: 2, severity: 2, fixability: 1, next: "런타임 간선과 변경 시 함께 깨지는 모듈 범위를 확인" },
  awaitInForEach: { label: "forEach 안 await", confidence: 3, severity: 3, fixability: 3, next: "수정 전 실패·수정 후 같은 입력 통과 테스트를 추가" },
  statefulRegex: { label: "전역 정규식 상태", confidence: 3, severity: 3, fixability: 3, next: "같은 입력을 연속 호출해 결과가 흔들리는지 재현" },
  sharedRefFill: { label: "공유 참조 fill", confidence: 3, severity: 3, fixability: 3, next: "한 원소 변경이 다른 원소까지 바꾸는지 재현" },
  numericSortNoComparator: { label: "숫자 sort 비교자 누락", confidence: 3, severity: 2, fixability: 3, next: "두 자릿수 이상 숫자 입력으로 정렬 결과를 재현" },
  writeOnlyCollection: { label: "쓰기만 하는 컬렉션", confidence: 3, severity: 2, fixability: 3, next: "생성 뒤 소비자 0건과 제거 시 부작용 없음을 확인" },
  forInArray: { label: "배열 for...in", confidence: 3, severity: 2, fixability: 2, next: "확장 프로퍼티가 섞인 배열 입력으로 동작을 확인" },
  loopInvariantIndex: { label: "루프 불변 인덱스", confidence: 2, severity: 2, fixability: 3, next: "루프 밖 계산과 결과가 같고 호출 수가 줄었는지 확인" },
  spreadAccumulator: { label: "스프레드 누적 O(n²)", confidence: 2, severity: 2, fixability: 2, next: "실제 입력 n과 수정 전후 할당량·시간을 확인" },
  regexInLoop: { label: "루프 안 정규식 생성", confidence: 2, severity: 1, fixability: 3, next: "정규식이 반복 중 불변인지 확인" },
  floatingPromise: { label: "버려진 Promise", confidence: 2, severity: 2, fixability: 1, next: "호출자의 오류 처리 계약과 의도적 fire-and-forget 여부를 확인" },
  emptyCatch: { label: "빈 catch", confidence: 2, severity: 1, fixability: 1, next: "삼킨 예외가 정상 분기인지 호출자 계약으로 확인" },
};

const textbookAxes = [
  "awaitInForEach", "statefulRegex", "sharedRefFill", "numericSortNoComparator",
  "writeOnlyCollection", "forInArray", "loopInvariantIndex", "spreadAccumulator",
  "regexInLoop", "floatingPromise", "emptyCatch",
];

const rowsOf = (quality, axis) => {
  if (textbookAxes.includes(axis)) return quality.textbook?.[axis]?.worst || [];
  if (axis === "quadratic") return quality.quadratic?.candidateList || [];
  if (axis === "io") return quality.io?.worst || [];
  return quality[axis]?.worst || [];
};

const loc = (row) => ({
  file: String(row.file || row.from || "(unknown)"),
  line: Number(row.line || row.fromLine || 0),
});

const detailOf = (row) => {
  if (row.callee) return String(row.callee);
  if (row.recv || row.method) return [row.recv, row.method].filter(Boolean).join(".");
  if (row.name) return String(row.name);
  if (row.outer) return String(row.outer);
  if (row.cycle) return Array.isArray(row.cycle) ? row.cycle.join(" → ") : String(row.cycle);
  return "정적 후보";
};

const priorityOf = (rule) => Math.round(
  ((rule.confidence * 4 + rule.severity * 4 + rule.fixability * 2) / 30) * 100,
);

// 80점짜리 O(n²)/직렬 await는 여전히 실제 n·의존성을 모른다. 자동으로 "깊게" 올리면
// 정적 축이 깨끗한 저장소에서 또 작은 후보를 크게 보이게 만든다. 85 이상은 정적 증거만으로도
// 재현 가치가 높은 정확성 계열에 사실상 한정하고, 나머지는 맥락 확인 뒤 승격한다.
const gateOf = (priority) => priority >= 85 ? "deep-dive" : priority >= 55 ? "context" : "deferred";

const fingerprint = (axis, file, source, detail, line) => createHash("sha256")
  .update([axis, file, source || detail || String(line)].join("|"))
  .digest("hex").slice(0, 14);

export function collectSweepCandidates(quality, { readLine } = {}) {
  const out = [];
  for (const [axis, rule] of Object.entries(RULES)) {
    for (const row of rowsOf(quality || {}, axis)) {
      const { file, line } = loc(row);
      const source = String(readLine?.(file, line) || "").trim().replace(/\s+/g, " ");
      const detail = detailOf(row);
      const priority = priorityOf(rule);
      out.push({
        id: fingerprint(axis, file, source, detail, line),
        axis, label: rule.label, file, line, detail,
        priority, gate: gateOf(priority), next: rule.next,
        evidence: {
          confidence: rule.confidence,
          potentialSeverity: rule.severity,
          mechanicalFixability: rule.fixability,
        },
      });
    }
  }
  const seen = new Set();
  return out
    .sort((a, b) => b.priority - a.priority || a.file.localeCompare(b.file) || a.line - b.line)
    .filter((candidate) => !seen.has(candidate.id) && seen.add(candidate.id));
}

export function buildSweepDecision(quality, { previous = [], readLine, sha = null, at = new Date().toISOString() } = {}) {
  const candidates = collectSweepCandidates(quality, { readLine });
  const previousCandidates = Array.isArray(previous) ? previous : [];
  const nowIds = new Set(candidates.map((candidate) => candidate.id));
  const previousIds = new Set(previousCandidates.map((candidate) => candidate.id));
  const fresh = candidates.filter((candidate) => !previousIds.has(candidate.id));
  const persistent = candidates.filter((candidate) => previousIds.has(candidate.id));
  const resolved = previousCandidates.filter((candidate) => !nowIds.has(candidate.id));
  const deepDive = candidates.filter((candidate) => candidate.gate === "deep-dive").length;
  const context = candidates.filter((candidate) => candidate.gate === "context").length;
  const deferred = candidates.length - deepDive - context;
  return {
    version: 1,
    at,
    sha,
    decision: deepDive ? "deep-dive" : "monitor",
    summary: deepDive
      ? `깊게 검증할 정적 후보 ${deepDive}개`
      : context
        ? `즉시 깊게 볼 후보 없음 · 맥락 확인 ${context}개`
        : "정적 후보 없음 — 다음 변경에서 신규·해소만 감시",
    counts: {
      total: candidates.length, deepDive, context, deferred,
      new: fresh.length, persistent: persistent.length, resolved: resolved.length,
    },
    candidates,
    resolved,
  };
}

export function sweepConsoleLines(sweep, limit = 5) {
  const c = sweep.counts;
  const lines = [
    `  빠른 훑기: 깊게 검증 ${c.deepDive} · 맥락 확인 ${c.context} · 보류 ${c.deferred}`,
    `  변화: 신규 ${c.new} · 유지 ${c.persistent} · 해소 ${c.resolved}`,
  ];
  for (const item of sweep.candidates.slice(0, limit)) {
    lines.push(`    [${item.priority}] ${item.label} · ${item.file}:${item.line}`);
    lines.push(`      → ${item.next}`);
  }
  if (!sweep.candidates.length) lines.push("    현재 기준선은 깨끗함 — 다음 실행부터 diff만 보면 됨");
  return lines;
}
