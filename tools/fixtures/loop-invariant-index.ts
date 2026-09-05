// 루프 불변 인덱스 재구축 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 소스 이름(new Set(<여기>…))을 전부 다르게 둬서 그 이름만 보고 판정할 수 있게 한다.

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// allowed: 루프 밖 배열로 매 회 같은 Set 을 다시 짓는다. 호이스팅이 기계적으로 안전하다.
export function keepAllowed(rows: string[], allowed: string[]): string[] {
  const kept: string[] = [];
  for (const row of rows) {
    const index = new Set(allowed);
    if (index.has(row)) kept.push(row);
  }
  return kept;
}

// blocked: 생성 직후 바로 조회 — 읽기 전용이라 역시 호이스팅할 수 있다.
export function dropBlocked(rows: string[], blocked: string[]): string[] {
  const kept: string[] = [];
  for (const row of rows) {
    if (!new Set(blocked).has(row)) kept.push(row);
  }
  return kept;
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// chained: new Set(x).add(y) 는 재구축이 아니라 '수정한 파생 복사본'이다. [FP:derived-copy]
export function withEach(rows: string[], base: string[]): Set<string>[] {
  const out: Set<string>[] = [];
  for (const row of rows) {
    out.push(new Set(base).add(row));
  }
  return out;
}

// perRow: 인자가 루프 변수라 매 회 값이 다르다. [FP:loop-var-argument]
export function fanOut(perRow: string[][]): Set<string>[] {
  const out: Set<string>[] = [];
  for (const cells of perRow) {
    const seen = new Set(cells);
    out.push(seen);
  }
  return out;
}

// mutated: 루프 밖에서 선언됐지만 루프 안에서 다시 대입된다 — 값이 매 회 다르다.
// [FP:reassigned-in-loop] mongoose getModelsMapForPopulate.js:151 에서 밟았다.
export function walkNames(docs: string[][], first: string[]): string[][] {
  let mutated = first;
  const out: string[][] = [];
  for (const doc of docs) {
    mutated = doc;
    const deduped = new Set(mutated);
    out.push([...deduped]);
  }
  return out;
}

// escaped: 결과가 객체 프로퍼티로 빠져나간다 — 반복마다 하나씩 필요한 상태다.
// [FP:per-iteration-state] mongoose getModelsMapForPopulate.js:675 에서 밟았다.
export function buildEntries(rows: string[], escaped: string[]): { field: Set<string> }[] {
  const out: { field: Set<string> }[] = [];
  for (const row of rows) {
    out.push({ field: new Set(escaped) });
  }
  return out;
}

// paired: 루프 헤더에서 만든 컬렉션은 반복마다가 아니라 한 번 만들어진다.
// [FP:loop-header-runs-once] mongoose model.js:2000 에서 밟았다.
export function readPairs(paired: [string, string][]): string[] {
  const out: string[] = [];
  for (const [key, value] of new Map(paired)) {
    out.push(`${key}=${value}`);
  }
  return out;
}
