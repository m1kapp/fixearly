// 루프 안 new RegExp 축 픽스처. 진짜 반복문 안에서 만드는 것과,
// 모듈 로드 시 한 번 도는 map() 안에서 만드는 것을 구분해야 한다.

const PATTERNS = ['^a', '^b', '^c'];

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// atLoad: map() 은 모듈 로드 시 1회 돈다 — 캐시를 만드는 코드지 재컴파일이 아니다.
// [FP:map-is-not-a-loop]
export const CACHED = PATTERNS.map((source) => {
  const atLoad = new RegExp(source);
  return atLoad;
});

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// inLoop: 진짜 for 문 안이라 반복마다 정규식을 다시 컴파일한다.
export function matchAll(lines: string[], source: string): string[] {
  const hits: string[] = [];
  for (const line of lines) {
    const inLoop = new RegExp(source);
    if (inLoop.test(line)) {
      hits.push(line);
    }
  }
  return hits;
}
