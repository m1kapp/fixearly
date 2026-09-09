// 버려진 Promise 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 호출되는 함수 이름을 전부 다르게 둬서 그 이름만 보고 판정할 수 있게 한다.

async function drained(): Promise<void> {}
async function guarded(): Promise<void> {}
async function chained(): Promise<void> {}
async function voided(): Promise<void> {}
async function awaited(): Promise<void> {}

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// drained: async 함수 안에서 async 호출을 await 없이 버린다 — 실패도, 완료도 안 기다린다.
// 고침이 `await` 한 단어라 기계적이다. rollup#6506 이 정확히 이 모양이었다.
export async function runAll(): Promise<void> {
  drained();
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// guarded: async 컨텍스트 밖이라 await 를 붙일 수 없다 — 기계적 수정이 아니다.
// [FP:floating-needs-async-context]
export function setup(): void {
  guarded();
}

// chained: .catch() 로 처리를 붙였다. 저자가 결과를 알고 버린 자리다.
export async function withHandler(): Promise<void> {
  chained().catch(() => {});
}

// voided: void 로 의도를 표시한 fire-and-forget 이다.
export async function withVoid(): Promise<void> {
  void voided();
}

// awaited: 정상적으로 기다린다.
export async function withAwait(): Promise<void> {
  await awaited();
}
