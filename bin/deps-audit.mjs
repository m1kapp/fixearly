// 의존성 취약점 — 락파일의 (이름, 버전)을 OSV.dev 에 물어본다.
//
// 소스 축과 달리 이건 "판단"이 아니라 "사실"이다. 고쳐진 버전이 이미 있으면
// 올리는 것 말고 다른 선택지가 없다. 그래서 리포트에서 소스 항목보다 위에 둔다.
//
// 네트워크가 필요하므로 --deps 옵트인이고 npm test 에는 넣지 않는다
// (bin/impact.mjs 와 같은 규칙). 대신 네트워크 없는 순수 함수 toFixes 를
// tools/test-deps-audit.mjs 가 모의 응답으로 검증한다.
import fs from "node:fs";
import path from "node:path";

const OSV = "https://api.osv.dev/v1";
// GHSA 라벨. OSV 는 CVSS 벡터도 주지만 벡터를 점수로 환산하려면 계산기를 들고 와야 한다 —
// GitHub 이 이미 매겨둔 라벨이 같은 레코드 안에 있으므로 그걸 쓴다.
const RANK = { CRITICAL: 4, HIGH: 3, MODERATE: 2, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

/** "1.2.10" > "1.2.9" 가 되게 숫자 단위로 비교한다. 프리릴리스는 무시(고친 버전엔 안 나온다). */
function cmpVer(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * 락파일에서 설치된 {name, version, dev} 를 뽑는다. npm 생태계만 본다.
 * 락파일이 없으면 package.json 의 고정 버전만 — 범위(^1.2.3)는 실제 설치본을 모르기 때문이다.
 * ponytail: npm 락파일만. pnpm/yarn 은 YAML 파서가 필요하다 — 실제로 그 저장소를 볼 때 붙인다.
 */
export function lockPackages(dir) {
  const direct = directNames(dir);
  // 전이 의존은 "이 패키지를 올려라"가 통하지 않는다 — 내 package.json 에 없기 때문이다.
  // 직접 목록을 못 구하면 표시 자체를 생략한다. 전부 전이로 찍는 것보다 침묵이 낫다.
  return rawLockPackages(dir).map((p) => {
    if (!direct) return p;
    const key = p.name + "@" + p.version;
    return { ...p, direct: direct.has(key), spec: direct.get(key) };
  });
}

/**
 * 고친 버전이 지금 제약 안에 들어오는가. 들어오면 락파일만 갱신하면 되고(`pnpm update`),
 * 아니면 package.json 의 하한을 사람이 올려야 한다 — 리뷰 비용이 다르다.
 * 판정할 수 없는 형태는 null 을 준다. 틀린 지시문보다 말 안 하는 쪽이 낫다.
 * ponytail: semver 라이브러리를 들이지 않는다. 실측에서 나온 건 ^ · ~ · >= · 정확 고정뿐이다.
 */
export function inRange(spec, fixed) {
  if (!spec || !fixed) return null;
  const s = String(spec).trim();
  if (s === "*" || s === "latest" || s.startsWith(">=")) return true;
  // `^8` `~1.2` 처럼 뒷자리를 생략한 형태가 실제로 흔하다(repattern 의 postcss).
  const m = s.match(/^([\^~]?)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m || s.includes("||") || s.includes(" ")) return null;
  const f = String(fixed).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!f) return null;
  const [, op, a, b] = m;
  // 생략된 자리는 "아무 값이나"라서 major 만 맞으면 된다: `8` 은 8.x.x 고정, `^8` 도 같다.
  if (b === undefined) return op === "" ? f[1] === a : f[1] === a;
  if (!op) return false; // 정확 고정 — 무엇을 올리든 밖이다
  if (op === "~") return f[1] === a && f[2] === b;
  // ^ 는 0.x 에서 minor 까지 고정된다. ^0.34.3 은 0.35.0 을 받지 않는다.
  return a === "0" ? f[1] === "0" && f[2] === b : f[1] === a;
}

/**
 * 내가 직접 부르는 `이름@설치버전` 집합. 못 구하면 null.
 *
 * 이름만으로 판정하면 틀린다. repattern 실측(2026-09-13): `nanoid` 를 `^5.1.5` 로 부르는데
 * 락파일에는 3.3.11·3.3.15·3.3.17 이 전이로 같이 들어와 있었고, 이름만 보면 그 셋도 직접이
 * 된다 — "버전 제약을 올려라"는 지시가 나가지만 올릴 제약이 없다. 같은 형태가 13건이었다.
 *
 * ponytail: npm 은 루트 package.json 만 본다 — 워크스페이스는 pnpm 쪽에서만 정확하다.
 */
function directNames(dir) {
  const pnpm = path.join(dir, "pnpm-lock.yaml");
  if (fs.existsSync(pnpm)) {
    const out = new Map();
    let inSection = false, name = null, spec = null;
    for (const line of fs.readFileSync(pnpm, "utf-8").split("\n")) {
      if (/^[^\s]/.test(line)) { inSection = line.startsWith("importers:"); continue; }
      if (!inSection) continue;
      // importer 경로가 2칸, dependencies: 가 4칸, 의존성 이름이 6칸, specifier/version 이 8칸이다.
      let m = line.match(/^ {6}'?((?:@[^/'\s]+\/)?[^:'\s]+)'?:\s*$/);
      if (m) { name = m[1]; spec = null; continue; }
      m = line.match(/^ {8}specifier:\s*(.+)$/);
      if (m) { spec = m[1].trim(); continue; }
      // version 에는 `1.2.3(peer@4)` 처럼 peer 가 붙는다.
      m = line.match(/^ {8}version:\s*([^\s(]+)/);
      if (m && name) out.set(name + "@" + m[1], spec);
    }
    return out.size ? out : null;
  }
  const lock = path.join(dir, "package-lock.json");
  const pj = path.join(dir, "package.json");
  if (!fs.existsSync(pj)) return null;
  const p = JSON.parse(fs.readFileSync(pj, "utf-8"));
  const ranges = new Map([...Object.entries(p.dependencies || {}), ...Object.entries(p.devDependencies || {})]);
  if (!ranges.size) return null;
  // npm 락파일은 최상위 설치본이 `node_modules/<이름>` 에 있다. 중첩(전이)은 더 깊은 경로다.
  const out = new Map();
  if (fs.existsSync(lock)) {
    const j = JSON.parse(fs.readFileSync(lock, "utf-8"));
    for (const [name, range] of ranges) {
      const v = (j.packages || {})[`node_modules/${name}`];
      if (v && v.version) out.set(name + "@" + v.version, range);
    }
  }
  return out.size ? out : null;
}

function rawLockPackages(dir) {
  const lock = path.join(dir, "package-lock.json");
  if (fs.existsSync(lock)) {
    const j = JSON.parse(fs.readFileSync(lock, "utf-8"));
    const out = [];
    // v2/v3: 평평한 packages 맵. 키가 "" 면 대상 프로젝트 자신이라 건너뛴다.
    for (const [key, v] of Object.entries(j.packages || {})) {
      if (!key || !v || !v.version || v.link) continue;
      const at = key.lastIndexOf("node_modules/");
      if (at < 0) continue; // 워크스페이스 경로 — 게시된 패키지가 아니다
      out.push({ name: key.slice(at + 13), version: v.version, dev: !!v.dev });
    }
    // v1: 중첩 dependencies 트리
    if (!out.length && j.dependencies) {
      const walk = (deps) => {
        for (const [name, v] of Object.entries(deps || {})) {
          if (v.version) out.push({ name, version: v.version, dev: !!v.dev });
          if (v.dependencies) walk(v.dependencies);
        }
      };
      walk(j.dependencies);
    }
    return dedupe(out);
  }
  const pnpm = path.join(dir, "pnpm-lock.yaml");
  if (fs.existsSync(pnpm)) return dedupe(pnpmPackages(pnpm));
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const out = [];
  for (const [field, dev] of [["dependencies", false], ["devDependencies", true]]) {
    for (const [name, range] of Object.entries(pkg[field] || {})) {
      if (/^\d+\.\d+\.\d+/.test(range)) out.push({ name, version: range, dev });
    }
  }
  return dedupe(out);
}

/**
 * pnpm-lock.yaml 의 `packages:` 섹션만 읽는다. 키가 `'@scope/name@1.2.3':` 꼴이라
 * 마지막 @ 앞뒤로 가른다. 뒤에 붙는 `(peer@1)`·`(patch_hash=..)` 는 버린다.
 * ponytail: YAML 파서를 들이지 않는다 — 필요한 건 최상위 한 섹션의 키뿐이다.
 * pnpm v9 packages 섹션에는 dev 표시가 없다. 전이 의존은 어차피 구분이 안 되므로 전부 런타임 취급한다.
 */
function pnpmPackages(file) {
  const out = [];
  let inSection = false;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    if (/^[^\s]/.test(line)) { inSection = line.startsWith("packages:"); continue; }
    if (!inSection) continue;
    const m = line.match(/^ {2}'?((?:@[^/'\s]+\/)?[^@'\s]+)@([^'():\s]+)/);
    if (m && /^\d/.test(m[2])) out.push({ name: m[1], version: m[2], dev: false });
  }
  return out;
}

function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) seen.set(`${r.name}@${r.version}`, r);
  return [...seen.values()];
}

/**
 * OSV 응답을 리포트의 fixes 항목 모양으로 바꾼다. 네트워크를 타지 않는 순수 함수다.
 * rows: [{ pkg: {name, version, dev}, vulns: [OSV 레코드] }]
 */
export function toFixes(rows) {
  const items = [];
  for (const { pkg, vulns } of rows) {
    if (!vulns || !vulns.length) continue;
    let sev = "UNKNOWN";
    let fixed = null;
    const ids = [];
    for (const v of vulns) {
      ids.push(v.id);
      const label = String(v.database_specific?.severity || "UNKNOWN").toUpperCase();
      if ((RANK[label] || 0) > (RANK[sev] || 0)) sev = label;
      // 이 취약점 하나를 벗어나는 가장 싼 버전 = 지금 버전보다 큰 fixed 중 최소.
      // 한 레코드에 fixed 가 여럿이면 1.x 백포트와 2.x 가 같이 적힌 것이라,
      // 최대를 고르면 필요 없는 메이저 업그레이드를 권하게 된다.
      let cheapest = null;
      for (const aff of v.affected || []) {
        if (aff.package?.name !== pkg.name) continue;
        for (const r of aff.ranges || []) {
          for (const e of r.events || []) {
            if (!e.fixed || cmpVer(e.fixed, pkg.version) <= 0) continue;
            if (!cheapest || cmpVer(e.fixed, cheapest) < 0) cheapest = e.fixed;
          }
        }
      }
      // 취약점이 여러 건이면 전부 벗어나야 하므로 그중 최대.
      if (cheapest && (!fixed || cmpVer(cheapest, fixed) > 0)) fixed = cheapest;
    }
    const title = String(vulns[0].summary || "").replace(/\s+/g, " ").trim();
    // 제약 안에서 풀리면 락파일 갱신만으로 끝난다. 실측(repattern): 9건 중 4건이 그랬다.
    const covered = pkg.direct === false ? null : inRange(pkg.spec, fixed);
    items.push({
      kind: "취약한 의존성", kindEn: "vulnerable dependency",
      what: `${pkg.name} ${pkg.version} — ${sev === "UNKNOWN" ? "심각도 미상" : sev} ${vulns.length}건`,
      where: `package.json:${pkg.name}`,
      file: "package.json",
      lines: [pkg.name],
      count: 1,
      why: (pkg.direct === false ? "전이 의존 — 내 package.json 에 없다. " : "")
        + (fixed
          ? `${fixed} 에서 고쳐졌다 — ${covered === true ? "지금 제약 안이라 락파일만 갱신하면 된다"
              : covered === false ? `제약(${pkg.spec}) 밖이라 하한을 올려야 한다`
              : "올리는 것 말고 할 일이 없다"}${pkg.dev ? " (dev 의존성)" : ""}. ${title}`
          : `고쳐진 버전이 아직 없다 — 대체하거나 호출부를 막아야 한다${pkg.dev ? " (dev 의존성)" : ""}. ${title}`),
      // 심각도 우선, 같은 심각도면 고칠 수 있는 것(고쳐진 버전 있음)이 먼저.
      // dev 의존성은 런타임에 안 실리므로 한 칸 내리고, 전이 의존은 내 손으로 못 올리므로 더 내린다.
      weight: 1000 + (RANK[sev] || 0) * 100 + (fixed ? 50 : 0)
        - (pkg.dev ? 120 : 0) - (pkg.direct === false ? 200 : 0),
      scored: false,
      stable: false,
      sev, fixed, ids, dev: pkg.dev, direct: pkg.direct, spec: pkg.spec, covered,
    });
  }
  return items.sort((a, b) => b.weight - a.weight);
}

/** 락파일 → OSV → fixes 항목. 네트워크를 탄다. */
export async function auditDeps(dir, { fetchImpl = fetch } = {}) {
  const pkgs = lockPackages(dir);
  if (!pkgs.length) return [];
  const hit = [];
  // querybatch 는 취약점 ID 만 준다(심각도·고쳐진 버전 없음). 걸린 패키지를 거르는 용도로만 쓰고,
  // 걸린 것만 단건 query 로 다시 친다 — 보통 전체의 몇 %다.
  for (let i = 0; i < pkgs.length; i += 500) {
    const batch = pkgs.slice(i, i + 500);
    const res = await fetchImpl(`${OSV}/querybatch`, {
      method: "POST",
      body: JSON.stringify({
        queries: batch.map((p) => ({ package: { name: p.name, ecosystem: "npm" }, version: p.version })),
      }),
    });
    if (!res.ok) throw new Error(`OSV querybatch ${res.status}`);
    const j = await res.json();
    (j.results || []).forEach((r, ix) => { if (r.vulns?.length && batch[ix]) hit.push(batch[ix]); });
  }
  const rows = [];
  for (const p of hit) {
    const res = await fetchImpl(`${OSV}/query`, {
      method: "POST",
      body: JSON.stringify({ package: { name: p.name, ecosystem: "npm" }, version: p.version }),
    });
    if (!res.ok) throw new Error(`OSV query ${res.status}`);
    const j = await res.json();
    rows.push({ pkg: p, vulns: j.vulns || [] });
  }
  return toFixes(rows);
}
