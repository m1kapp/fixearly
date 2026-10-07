// forEach 안 await 축 픽스처. 잡힌 수신자 이름만 보고 판정하도록 이름을 전부 다르게 둔다.

declare function save(x: string): Promise<void>;

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// rows: Array.prototype.forEach 는 콜백의 프라미스를 버린다 — save 가 끝나기 전에 함수가 돌아간다.
export function saveAll(rows: string[]): void {
  rows.forEach(async (row) => {
    await save(row);
  });
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// dataset: forEach 자체를 await 한다 — 프라미스를 돌려주는 자체 구현이라 기다린다(crawlee Dataset).
interface Dataset { forEach(fn: (item: string) => Promise<void>): Promise<void> }
export async function saveDataset(dataset: Dataset): Promise<void> {
  await dataset.forEach(async (item) => {
    await save(item);
  });
}

// plain: 콜백에 await 가 없으면 이 축이 아니다.
export function logAll(plain: string[]): void {
  plain.forEach((p) => console.log(p));
}
