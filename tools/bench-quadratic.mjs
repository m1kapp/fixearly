#!/usr/bin/env node
/**
 * bench-quadratic — O(n²) 후보의 알고리즘 델타를 격리 측정한다.
 *
 * 우리 패턴은 "루프 안에서 배열을 .find/.some/.includes 로 스캔 → Map/Set" 하나뿐이라,
 * 주변 비즈니스 로직 없이 그 델타만 합성 데이터로 잰다. 전체앱 벤치가 아니라 **알고리즘
 * 마이크로벤치** — 배속(ratio)은 정확하고, 절대 µs 로 "진짜 substantial 인가"를 가른다.
 *
 * 사용: node tools/bench-quadratic.mjs --shape=keyjoin --M=2000 --N=2000
 *   --shape  membership | keyjoin   (기본 keyjoin: arr.find(a=>a.id===x))
 *   --M      바깥 루프 반복수(예: 결과 행 수)     기본 1000
 *   --N      안쪽 배열 크기(스캔 대상)            기본 1000 (없으면 M 따라 스윕)
 *
 * 판정: 한 번의 연산(M회 루프)의 old 시간이
 *   > 5ms  → substantial (measured Nx 로 PR)
 *   0.1~5ms→ 상황 따라(핫패스·빈도면 substantial)
 *   < 0.1ms→ µs 정리(공짜-마진으로만, 또는 스킵)
 */
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
}));
const shape = args.shape || "keyjoin";
const M = parseInt(args.M || "1000", 10);
const fixedN = args.N ? parseInt(args.N, 10) : null;

function makeData(N, keyed) {
  const arr = keyed
    ? Array.from({ length: N }, (_, i) => ({ id: "id_" + i, v: i }))
    : Array.from({ length: N }, (_, i) => "id_" + i);
  // 바깥 루프가 찾는 키들 — 절반은 hit, 절반은 miss(최악에 가깝게)
  const probes = Array.from({ length: M }, (_, i) => "id_" + ((i % (2 * N)) | 0));
  return { arr, probes };
}

function run(N) {
  const keyed = shape === "keyjoin";
  const { arr, probes } = makeData(N, keyed);
  const findOld = keyed
    ? (x) => arr.find(a => a.id === x)
    : (x) => arr.find(a => a === x);

  // OLD: 매 probe 마다 스캔
  let t = process.hrtime.bigint(), acc = 0;
  for (const x of probes) if (findOld(x)) acc++;
  const oldNs = Number(process.hrtime.bigint() - t);

  // NEW: Map/Set 한 번 빌드 후 조회
  t = process.hrtime.bigint(); acc = 0;
  const idx = keyed ? new Map(arr.map(a => [a.id, a])) : new Set(arr);
  for (const x of probes) if (idx.has ? idx.has(x) : idx.get(x)) acc++;
  const newNs = Number(process.hrtime.bigint() - t);

  return { N, M, oldMs: oldNs / 1e6, newMs: newNs / 1e6, x: oldNs / newNs };
}

console.log(`  shape=${shape}  M(outer loop)=${M}`);
console.log(`  ${"N(inner)".padStart(9)}  ${"old(ms)".padStart(9)}  ${"new(ms)".padStart(9)}  ${"speedup".padStart(8)}  verdict`);
const Ns = fixedN ? [fixedN] : [50, 200, 1000, 5000, 20000];
for (const N of Ns) {
  const r = run(N);
  const v = r.oldMs > 5 ? "SUBSTANTIAL" : r.oldMs > 0.1 ? "context-dependent" : "µs-cleanup only";
  console.log(`  ${String(r.N).padStart(9)}  ${r.oldMs.toFixed(3).padStart(9)}  ${r.newMs.toFixed(3).padStart(9)}  ${(r.x.toFixed(1) + "x").padStart(8)}  ${v}`);
}
console.log("\n  ↑ old(ms) = 한 연산(M회 루프)의 벽시계 시간. PR엔 현실 M·N 을 넣어 측정치를 박되,");
console.log("    '격리 마이크로벤치(전체앱 아님)' 라고 정직히 밝히고, 좁은 경우 미미함도 인정한다.");
