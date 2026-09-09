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

// loadBatched: 진짜 루프 안이지만 청크마다 Promise.all 로 배칭한다 — 순차 N+1 이 아니다.
// 개별 호출은 콜백 안에 있고, 스캔은 중첩 함수 경계를 넘지 않는다. [FP:promise-all-batching]
export async function loadBatched(batchedRepo: Repo, chunks: string[][]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const chunk of chunks) {
    out.push(await Promise.all(chunk.map(async (id) => await batchedRepo.findOne({ id }))));
  }
  return out;
}
