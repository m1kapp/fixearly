// 배열에 for...in 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 순회 대상 이름을 전부 다르게 둬서 그 이름만 보고 판정할 수 있게 한다.

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// parts: split 이 만든 배열을 for...in 으로 돈다 — 인덱스가 문자열이고 상속 속성까지 돈다.
export function joinAliases(key: string, aliases: Record<string, string>): string {
  const parts = key.split('.');
  const out: string[] = [];
  for (const i in parts) {
    out.push(aliases[parts[i]] ?? parts[i]);
  }
  return out.join('.');
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// spec: 객체를 for...in 으로 도는 건 정상이다. [FP:for-in-needs-array-evidence]
export function normalizeSpec(spec: Record<string, number>): string[] {
  const out: string[] = [];
  for (const key in spec) {
    out.push(`${key}:${spec[key]}`);
  }
  return out;
}

// fields: 이 함수에서는 객체 파라미터인데, 아래 다른 함수에 같은 이름의 배열이 있다.
// 증거를 파일 스코프로 모으기 때문에 이름이 겹치면 끌려온다. [FP:for-in-name-collision]
// mongoose `schema.js:2396` 이 `schema.js:1005` 의 동명 배열 때문에 잡혔던 자리다.
export function renameIndexKeys(fields: Record<string, number>, aliases: Record<string, string>): string[] {
  const out: string[] = [];
  for (const key in fields) {
    out.push(aliases[key] ?? key);
  }
  return out;
}

export function encryptedFieldList(source: Record<string, string>): string[] {
  const fields = Object.entries(source).map(([path]) => path);
  return fields;
}
