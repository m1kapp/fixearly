// 버려진 Promise 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 호출되는 함수 이름을 전부 다르게 둬서 그 이름만 보고 판정할 수 있게 한다.

async function drained(): Promise<void> { await Promise.resolve(); }
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

// relayed: 바깥 객체 메서드와 이름이 같은 옵션 콜백을 넘겨준다. 메서드는 맨 이름으로
// 호출될 수 없으니 이 `relayed(...)` 는 구조분해한 옵션이지 async 메서드가 아니다.
// supabase studio mutation 템플릿 285곳이 이 모양이었다. [FP:floating-method-vs-bare-call]
export function useRelay({ relayed }: { relayed: (e: Error) => void }) {
  return {
    async relayed(error: Error): Promise<void> {
      relayed(error);
    },
  };
}

// flushed: 클래스 메서드를 this 로 await 없이 부른다 — 이건 여전히 잡아야 한다.
export class Queue {
  async flushed(): Promise<void> { await Promise.resolve(); }
  async close(): Promise<void> {
    this.flushed();
  }
}

// 같은 파일 다른 클래스에 async `persisted` 가 있어도, 이 클래스의 `persisted` 는 동기다
// (mastra session.ts SessionThread.set vs SessionState.set).
class Store {
  async persisted(v: number): Promise<void> { await Promise.resolve(v); }
}
class Thread {
  persisted(v: number): void { void v; }
  async run(): Promise<void> {
    this.persisted(1);
  }
}
export { Store, Thread };

// quiet: 본문에 await 가 없어 동기로 끝난다 — 버려도 기다릴 게 없다(slidev saveSnapshot).
// tried: 본문 전체가 catch 있는 try 다 — 실패를 스스로 처리하는 백그라운드 작업(kilocode optimizeTable).
// [FP:floating-benign-callee]
async function quiet(): Promise<void> { void 0; }
async function tried(): Promise<void> {
  try { await Promise.resolve(); } catch { /* logged */ }
}
export async function background(): Promise<void> {
  quiet();
  tried();
}
