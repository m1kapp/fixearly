// O(n²) 게이트 픽스처 — 루프처럼 보이지만 한 번만 도는 자리와 고정 목록 바깥.
import { Report } from "./report";

interface Row { id: string; type: string; count: number }

// pending: 바깥(rows)도 안쪽(pending)도 데이터다 — 잡아야 한다.
export function matchPending(rows: Row[], pending: Row[]): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    const hit = pending.find((p) => p.id === row.id);
    if (hit) out.push(hit);
  }
  return out;
}

// kinds: for-of 의 반복 대상 식은 루프 진입 때 한 번 평가된다(elysia). [FP:quad-loop-header-once]
export function expand(kinds: string[], all: string[]): string[] {
  const out: string[] = [];
  for (const k of kinds.some((x) => x === "all") ? all : kinds) out.push(k);
  return out;
}

// counts: 바깥이 enum 의 고정 목록이다(immich). [FP:quad-object-values-enum]
export function tally(counts: Row[]): Record<string, number> {
  return Object.fromEntries(
    Object.values(Report).map((t) => [t, counts.find((c) => c.type === t)?.count || 0]),
  );
}

// text: 한 곳에서 문자열 slice 로 만들고, 다른 곳에선 문자열이다 — indexOf 는 문자열 검색이다(webpack).
// [FP:quad-string-slice-name]
export function head(input: string): string {
  const text = input.slice(0, 10);
  return text;
}
export function skipComments(src: string, marks: string[]): number {
  const text = src;
  let n = 0;
  for (const m of marks) if (text.indexOf(m) !== -1) n++;
  return n;
}
