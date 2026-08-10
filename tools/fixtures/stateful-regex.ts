// 전역 정규식 상태 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 이름은 전부 다르게 둬서 "잡힌 이름" 목록만 보고 판정할 수 있게 한다.

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// leaks: /g 를 달고 루프 안에서 .test() — lastIndex 가 문자열 사이로 샌다.
const leaks = /^\s+at /g;
export function filterStackLines(lines: string[]): string[] {
  const kept: string[] = [];
  for (const line of lines) {
    if (leaks.test(line)) {
      kept.push(line);
    }
  }
  return kept;
}

// sticky: /y 도 같은 상태를 들고 있다.
const sticky = /token/y;
export function countTokens(inputs: string[]): number {
  let n = 0;
  for (const input of inputs) {
    if (sticky.test(input)) n += 1;
  }
  return n;
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// guarded: 저자가 lastIndex 를 직접 되돌린다 — 상태를 알고 관리하는 자리다.
const guarded = /needle/g;
export function findGuarded(inputs: string[]): string[] {
  const hits: string[] = [];
  for (const input of inputs) {
    guarded.lastIndex = 0;
    if (guarded.test(input)) {
      hits.push(input);
    }
  }
  return hits;
}

// plain: /g 가 없으면 상태가 없다.
const plain = /needle/;
export function findPlain(inputs: string[]): string[] {
  const hits: string[] = [];
  for (const input of inputs) {
    if (plain.test(input)) {
      hits.push(input);
    }
  }
  return hits;
}

// inner: 루프 안에서 만든 정규식은 매 회 새 객체라 샐 수 없다.
export function findInner(inputs: string[]): string[] {
  const hits: string[] = [];
  for (const input of inputs) {
    const inner = /needle/g;
    if (inner.test(input)) {
      hits.push(input);
    }
  }
  return hits;
}

// walked: `while ((m = re.exec(s)))` 는 /g 의 정석 순회 관용구다.
const walked = /needle/g;
export function walkMatches(input: string): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = walked.exec(input)) !== null) {
    found.push(m[0]);
  }
  return found;
}
