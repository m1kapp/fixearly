// `쓰기만 하는 컬렉션` 탐지기의 회귀 픽스처. bin/selftest.mjs 가 이 파일을 읽어
// 아래 두 목록과 실제 탐지 결과를 대조한다.
//
// 여기 있는 오탐 케이스는 전부 **코퍼스 75곳을 실제로 재다가 나온 것들**이다.
// 픽스처만 보고 지어낸 게 아니라 react·tailwind 에서 걸렸던 형태다. 규칙이
// 느슨해지면 그 저장소들에서 다시 오탐이 나므로, 여기서 먼저 깨져야 한다.
//
// 잡혀야 하는 것(HIT):  seen · audit
// 잡히면 안 되는 것(MISS): known · bag · passed · built · registry · later · skip · chained

// ── HIT: 채우기만 하고 아무도 안 읽는다
const seen = new Set<string>();
export function track(id: string) {
  seen.add(id);
}

// ── HIT: 쓰기가 여러 번이어도 읽기가 0이면 마찬가지
const audit = new Map<string, string>();
export function log(k: string, v: string) {
  audit.set(k, v);
  audit.delete(k); // 반환값을 안 쓰므로 이건 쓰기다
}

// ── MISS: .has 로 읽는다
const known = new Set<string>();
export function check(id: string) {
  known.add(id);
  return known.has(id);
}

// ── MISS: 전개로 읽는다
const bag = new Map<string, number>();
export function fill(k: string) {
  bag.set(k, 1);
  return [...bag.keys()];
}

// ── MISS: 인자로 넘기면 밖에서 읽을 수 있다
const passed = new Map<string, number>();
function consume(m: Map<string, number>) {
  return m.size;
}
export function go(k: string) {
  passed.set(k, 1);
  return consume(passed);
}

// ── MISS: 반환하면 호출자가 읽는다
export function build(ks: string[]) {
  const built = new Set<string>();
  for (const k of ks) built.add(k);
  return built;
}

// ── MISS: export 는 다른 모듈이 읽을 수 있다 — 파일 하나로는 판단 불가.
// react 의 `export const allNativeEvents = new Set()` 가 이 형태였다:
// 이 파일엔 .add 뿐이고 DOMPluginEventSystem 이 .forEach, ReactDOMEventHandle 이 .has 로 읽는다.
export const registry = new Set<string>();
export function reg(k: string) {
  registry.add(k);
}

// ── MISS: export { } 로 떨어져 있어도 마찬가지
const later = new Map<string, number>();
function put(k: string) {
  later.set(k, 1);
}
export { later, put };

// ── MISS: delete 의 반환값이 곧 조회다.
// tailwind 의 `if (skipExit.delete(node)) return` 이 이 형태였다.
const skip = new Set<string>();
export function maybe(k: string) {
  skip.add(k);
  if (skip.delete(k)) return true;
  return false;
}

// ── MISS: add 는 자기 자신을 돌려준다 — 체이닝·반환은 컬렉션이 밖으로 새는 것
const chained = new Set<string>();
export function chain(k: string) {
  return chained.add(k);
}
