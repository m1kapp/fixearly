// 깊은 비교 집합 연산 축 픽스처. lodash *With 에 isEqual 을 넘기면 모든 쌍을 깊게 비교한다 —
// 명시적 루프가 없어 O(n²) 배열 조회 축이 못 잡는다. 다른 비교자는 깊은 비교가 아니므로 제외한다.

declare function uniqWith<T>(items: T[], cmp: (a: T, b: T) => boolean): T[];
declare function differenceWith<T>(a: T[], b: T[], cmp: (a: T, b: T) => boolean): T[];
declare function isEqual(a: unknown, b: unknown): boolean;
declare function intersectionWith<T>(a: T[], b: T[], cmp: (a: T, b: T) => boolean): T[];
declare const _: { intersectionWith: typeof intersectionWith; isEqual: typeof isEqual };

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// isEqual 을 그대로 넘긴다.
export function dedupeEmails(emails: string[]): string[] {
  return uniqWith(emails, isEqual);
}

// isEqual 하나를 돌려주는 화살표 함수도 같은 비용이다 (n8n array-extensions 의 형태).
export function removeTags(tags: string[], removed: string[]): string[] {
  return differenceWith(tags, removed, (a, b) => isEqual(a, b));
}

// _.intersectionWith(…, _.isEqual) 네임스페이스 호출.
export function sharedIds(ids: number[], others: number[]): number[] {
  return _.intersectionWith(ids, others, _.isEqual);
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// 키 비교는 깊은 비교가 아니다 — 저자가 이미 비교 비용을 정했다.
export function dedupeById(rows: { id: number }[]): { id: number }[] {
  return uniqWith(rows, (a, b) => a.id === b.id);
}
