// 공유 참조 fill 축 픽스처. Array(n).fill([]) 는 참조 하나를 모든 칸이 공유한다 —
// 한 칸을 고치면 전부 바뀌는 조용한 버그다. 도메인 API 의 .fill() 과 섞이면 안 된다.

type Page = { fill: (options: { once: boolean }) => void };

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// Array(n).fill([]) — 모든 칸이 같은 배열을 가리킨다.
export function makeBuckets(n: number): string[][] {
  return Array(n).fill([]);
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// page.fill({ ... }) 은 도메인 API 다. 이름이 같을 뿐 Array.prototype.fill 이 아니다.
// [FP:fill-domain-api] playwright 에서 3곳 밟았다.
export function submit(page: Page): void {
  page.fill({ once: true });
}
