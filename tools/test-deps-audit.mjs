// deps-audit 의 순수 부분만 검증한다 — 네트워크 없이 돌아야 npm test 에 들어갈 수 있다.
// 모의 응답은 2026-09-13 에 OSV 에서 실제로 받은 lodash 4.17.15 레코드의 축약본이다.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lockPackages, toFixes, auditDeps } from "../bin/deps-audit.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fixearly-deps-"));

// ── 락파일 v3 ─────────────────────────────────────────────
fs.writeFileSync(path.join(tmp, "package-lock.json"), JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "app", version: "1.0.0" },
    "node_modules/lodash": { version: "4.17.15" },
    "node_modules/typescript": { version: "5.9.3", dev: true },
    "node_modules/a/node_modules/lodash": { version: "4.17.15" }, // 중첩 중복
    "packages/ui": { version: "0.0.1", link: true },              // 워크스페이스
  },
}));
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.15" } }));
const pkgs = lockPackages(tmp);
assert.strictEqual(pkgs.find((p) => p.name === "lodash").direct, true, "package.json 이 부르는 것은 직접");
assert.strictEqual(pkgs.find((p) => p.name === "typescript").direct, false, "락파일에만 있으면 전이");
assert.deepStrictEqual(pkgs.map((p) => `${p.name}@${p.version}`).sort(),
  ["lodash@4.17.15", "typescript@5.9.3"], "중첩 중복은 합치고 워크스페이스는 뺀다");
assert.strictEqual(pkgs.find((p) => p.name === "typescript").dev, true);

// ── 락파일이 없으면 package.json 의 고정 버전만 ─────────────
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "fixearly-deps-"));
fs.writeFileSync(path.join(tmp2, "package.json"), JSON.stringify({
  dependencies: { lodash: "^4.17.15", pinned: "1.2.3" },
}));
assert.deepStrictEqual(lockPackages(tmp2).map((p) => p.name), ["pinned"],
  "범위 지정은 실제 설치본을 모르므로 묻지 않는다");

// ── pnpm-lock.yaml v9 ─────────────────────────────────────
const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), "fixearly-deps-"));
fs.writeFileSync(path.join(tmp3, "pnpm-lock.yaml"), `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      lodash:
        specifier: ^4.17.15
        version: 4.17.15
  apps/web:
    devDependencies:
      '@adobe/css-tools':
        specifier: ^4.5.0
        version: 4.5.0

packages:

  '@adobe/css-tools@4.5.0':
    resolution: {integrity: sha512-xxx}
  lodash@3.10.1:
    resolution: {integrity: sha512-old}
  lodash@4.17.15:
    resolution: {integrity: sha512-yyy}
  esbuild@0.21.5(patch_hash=abc):
    resolution: {integrity: sha512-zzz}
  '@types/react@18.3.1(peer@1.0.0)':
    resolution: {integrity: sha512-www}
  typescript@5.9.3:
    engines: {node: '>=14'}

snapshots:

  'not-a-package@1.0.0':
    dependencies: {}
`);
assert.deepStrictEqual(lockPackages(tmp3).map((p) => `${p.name}@${p.version}`).sort(),
  ["@adobe/css-tools@4.5.0", "@types/react@18.3.1", "esbuild@0.21.5", "lodash@3.10.1", "lodash@4.17.15", "typescript@5.9.3"],
  "packages 섹션만 · 스코프 이름 유지 · peer/patch 접미 제거 · snapshots 와 importers 는 제외");
const p3 = lockPackages(tmp3);
assert.strictEqual(p3.find((p) => p.version === "4.17.15").direct, true, "importers 의 dependencies 는 직접");
// 같은 이름의 다른 버전이 전이로 들어오면 그건 직접이 아니다 (repattern 의 nanoid 3.x 형태)
assert.strictEqual(p3.find((p) => p.version === "3.10.1").direct, false, "이름만 같고 버전이 다르면 전이");
assert.strictEqual(p3.find((p) => p.name === "@adobe/css-tools").direct, true, "워크스페이스의 devDependencies 도 직접");
assert.strictEqual(p3.find((p) => p.name === "typescript").direct, false, "importers 에 없으면 전이");

fs.rmSync(tmp3, { recursive: true, force: true });

// ── OSV 레코드 → fixes 항목 ────────────────────────────────
const vulns = [
  {
    id: "GHSA-29mw-wpgm-hmr9", summary: "ReDoS in lodash",
    database_specific: { severity: "MODERATE" },
    affected: [{ package: { name: "lodash", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.9" }] }] }],
  },
  {
    id: "GHSA-35jh-r3h4-6jhm", summary: "Command Injection in lodash",
    database_specific: { severity: "HIGH" },
    affected: [
      { package: { name: "lodash", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] },
      { package: { name: "lodash.template", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ fixed: "9.9.9" }] }] }, // 다른 패키지 — 무시
    ],
  },
];
const [fx] = toFixes([{ pkg: { name: "lodash", version: "4.17.15", dev: false }, vulns }]);
assert.strictEqual(fx.kind, "취약한 의존성");
assert.strictEqual(fx.sev, "HIGH", "여러 건이면 가장 높은 심각도");
assert.strictEqual(fx.fixed, "4.17.21", "이미 지나친 4.17.9 는 답이 아니고, 남은 취약점을 벗어나는 4.17.21");
assert.match(fx.why, /4\.17\.21 에서 고쳐졌다/);
assert.strictEqual(fx.file, "package.json");
assert.strictEqual(fx.count, 1);
assert.strictEqual(fx.scored, false, "보안은 채점축이 아니다 — 등급과 별개로 고친다");

// 한 레코드 안의 백포트 — 2.0.0 이 아니라 1.9.1 로 충분하다
const [bp] = toFixes([{ pkg: { name: "x", version: "1.5.0" }, vulns: [{
  id: "A", database_specific: { severity: "LOW" },
  affected: [{ package: { name: "x" }, ranges: [{ events: [{ fixed: "2.0.0" }, { fixed: "1.9.1" }] }] }],
}] }]);
assert.strictEqual(bp.fixed, "1.9.1", "백포트가 있으면 메이저 업그레이드를 권하지 않는다");

// 취약점이 여러 건이면 전부 벗어나야 한다. 10.0.0 > 9.9.9 — 문자열 비교면 뒤집힌다
const [v10] = toFixes([{ pkg: { name: "x", version: "1.0.0" }, vulns: [
  { id: "A", database_specific: { severity: "LOW" }, affected: [{ package: { name: "x" }, ranges: [{ events: [{ fixed: "9.9.9" }] }] }] },
  { id: "B", database_specific: { severity: "LOW" }, affected: [{ package: { name: "x" }, ranges: [{ events: [{ fixed: "10.0.0" }] }] }] },
] }]);
assert.strictEqual(v10.fixed, "10.0.0");

// 직접 목록을 못 구하면 표시를 생략한다 — 전부 전이로 찍는 것보다 침묵이 낫다
const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), "fixearly-deps-"));
fs.writeFileSync(path.join(tmp4, "package-lock.json"), JSON.stringify({
  lockfileVersion: 3, packages: { "node_modules/lodash": { version: "4.17.15" } },
}));
assert.strictEqual(lockPackages(tmp4)[0].direct, undefined, "package.json 이 없으면 판단하지 않는다");
const [noMark] = toFixes([{ pkg: lockPackages(tmp4)[0], vulns }]);
assert.ok(!noMark.why.startsWith("전이 의존"), "모르는 것을 전이라고 적지 않는다");
fs.rmSync(tmp4, { recursive: true, force: true });

// 전이로 밝혀지면 순위가 내려가고 이유가 앞에 붙는다
const [tr] = toFixes([{ pkg: { name: "lodash", version: "4.17.15", direct: false }, vulns }]);
const [di] = toFixes([{ pkg: { name: "lodash", version: "4.17.15", direct: true }, vulns }]);
assert.ok(tr.weight < di.weight, "전이는 직접보다 아래");
assert.match(tr.why, /^전이 의존/);

// 심각도 순, 같으면 dev 가 아래
const order = toFixes([
  { pkg: { name: "low", version: "1.0.0" }, vulns: [{ id: "L", database_specific: { severity: "LOW" }, affected: [] }] },
  { pkg: { name: "crit", version: "1.0.0" }, vulns: [{ id: "C", database_specific: { severity: "CRITICAL" }, affected: [] }] },
  { pkg: { name: "critdev", version: "1.0.0", dev: true }, vulns: [{ id: "D", database_specific: { severity: "CRITICAL" }, affected: [] }] },
]).map((f) => f.where.split(":")[1]);
assert.deepStrictEqual(order, ["crit", "critdev", "low"]);

// ── auditDeps: 배치로 거르고 걸린 것만 단건 조회 ─────────────
const calls = [];
const fakeFetch = async (url, opt) => {
  const body = JSON.parse(opt.body);
  calls.push(url.endsWith("/querybatch") ? "batch" : `query:${body.package.name}`);
  if (url.endsWith("/querybatch")) {
    return { ok: true, json: async () => ({ results: body.queries.map((q) => (q.package.name === "lodash" ? { vulns: [{ id: "GHSA-x" }] } : {})) }) };
  }
  return { ok: true, json: async () => ({ vulns }) };
};
const out = await auditDeps(tmp, { fetchImpl: fakeFetch });
assert.deepStrictEqual(calls, ["batch", "query:lodash"], "깨끗한 패키지는 단건 조회를 안 한다");
assert.strictEqual(out.length, 1);
assert.strictEqual(out[0].fixed, "4.17.21");

// 실패는 조용히 넘기지 않는다 — 0건과 "못 물어봄"은 다른 결과다
await assert.rejects(
  auditDeps(tmp, { fetchImpl: async () => ({ ok: false, status: 503 }) }),
  /OSV querybatch 503/);

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(tmp2, { recursive: true, force: true });
console.log("deps-audit: 통과");
