// 루프 안 N+1 축 픽스처. 루프마다 DB 를 직접 await 하는 자리와,
// Promise.all 로 이미 배칭한 자리를 한 파일에 둔다.

type Repo = {
  findOne: (query: { id: string }) => Promise<{ id: string } | null>;
};

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// loadEach: 루프 안에서 행마다 직접 await — 행 수만큼 왕복한다.
export async function loadEach(eachRepo: Repo, ids: string[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const id of ids) {
    out.push(await eachRepo.findOne({ id }));
  }
  return out;
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// loadBatched: 진짜 루프 안이지만 그룹마다 Promise.all 로 배칭한다 — 순차 N+1 이 아니다.
// 루프 이름을 `groups` 로 둔 건 일부러다. `chunks`·`batches` 로 두면 아래 intent 규칙에
// 먼저 걸려서, 정작 배칭 가드가 일하는지 확인할 수 없다. [FP:promise-all-batching]
export async function loadBatched(batchedRepo: Repo, groups: string[][]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const group of groups) {
    out.push(await Promise.all(group.map(async (id) => await batchedRepo.findOne({ id }))));
  }
  return out;
}

// intentRepo: 루프 라벨이 `chunks` 라 '의도적 순차'로 보고 루프를 통째로 건너뛴다.
// 청크 단위 처리는 대개 메모리·레이트리밋 때문에 일부러 줄 세운 것이다.
// [FP:intentional-sequential-loop]
export async function loadChunked(intentRepo: Repo, chunks: string[][]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const chunk of chunks) {
    for (const id of chunk) {
      out.push(await intentRepo.findOne({ id }));
    }
  }
  return out;
}
