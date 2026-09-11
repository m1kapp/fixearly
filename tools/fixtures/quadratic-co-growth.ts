// O(n·m) 후보 선별 신호 픽스처. n 이 커도 m 이 안 자라면 사실상 선형이라 후보가 아니다.
// 여기서는 "안쪽이 바깥 루프와 같이 자라는가"만 판정한다(coGrows).

interface Row {
  id: string;
  name: string;
}

// ── 같이 자란다 ─────────────────────────────────────────────────────────────

// seenRows: 루프 안에서 push 로 자란다 — 반복이 늘면 스캔 대상도 같이 는다.
// eslint no-duplicate-case 가 정확히 이 모양이었고, 그래서 냈다.
export function findDuplicates(rows: Row[]): Row[] {
  const seenRows: Row[] = [];
  const dupes: Row[] = [];
  for (const row of rows) {
    if (seenRows.some(seen => seen.id === row.id)) {
      dupes.push(row);
    } else {
      seenRows.push(row);
    }
  }
  return dupes;
}

// ── 안 자란다 ───────────────────────────────────────────────────────────────

// patchedNames: 루프 밖에서 받은 목록이고 루프 안에서 안 자란다. 바깥이 수천이어도
// 안쪽이 서너 개면 O(n × 상수)다 — pnpm 락파일 대 패치된 의존성이 이 모양이었다.
export function markPatched(rows: Row[], patchedNames: string[]): Row[] {
  const marked: Row[] = [];
  for (const row of rows) {
    if (patchedNames.some(name => name === row.name)) {
      marked.push(row);
    }
  }
  return marked;
}

// failedRows: 루프 반복대상과 같은 배열이라 모양은 '같이 자람'이지만, 스캔이 throw 하는
// 블록 안에 있다 — 실패할 때 한 번 돌고 끝난다. jest `ensureNoDuplicateConfigs` 가 이 모양.
// [FP:throw-path-runs-once]
export function assertUnique(failedRows: Row[]): void {
  const byId = new Map<string, Row>();
  for (const row of failedRows) {
    const prior = byId.get(row.id);
    if (prior) {
      const message = `duplicate id at ${failedRows.indexOf(row)} and ${failedRows.indexOf(prior)}`;
      throw new Error(message);
    }
    byId.set(row.id, row);
  }
}
