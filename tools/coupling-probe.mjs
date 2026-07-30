#!/usr/bin/env node
/**
 * coupling-probe — 결합도가 채점축이 될 수 있는지 재보는 프로토타입.
 *
 * 현재 5축 중 넷이 "읽기 어려운가"를 잰다. 제품이 파는 건 "다음에 고칠 때 드는
 * 비용"인데 그 비용은 (이해 난이도) x (몇 군데를 같이 고쳐야 하나)다. 두 번째
 * 항이 통째로 안 잡혀 있다.
 *
 * 재는 것:
 *   · 순환 의존 — SCC 크기 2 이상. 있으면 있는 거라 오탐이 원리적으로 없다.
 *   · 팬인 — 이 모듈을 몇이 쓰나. 상위 모듈을 고치면 그만큼이 흔들린다.
 *   · 팬아웃 — 이 모듈이 몇을 쓰나.
 *
 * import 는 ts.preProcessFile 로 뽑는다(정규식보다 정확하고 전체 파싱보다 싸다).
 * 상대 경로만 해석한다 — 패키지 import 는 저장소 밖이라 우리 결합도가 아니다.
 *
 * 사용: node coupling-probe.mjs --dir=<경로>
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const dir = (process.argv.find((a) => a.startsWith("--dir=")) || "").slice(6);
if (!dir) { console.error("--dir 필요"); process.exit(2); }

const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".turbo", "vendor", "fixtures", "__snapshots__", "generated"]);
// 테스트는 그래프에서 뺀다 — 소스를 잡아먹기만 하는 잎이라 팬인을 부풀린다.
const IS_TEST = /(\.|-)(test|spec)\.[cm]?[jt]sx?$/i.test.bind(/(\.|-)(test|spec)\.[cm]?[jt]sx?$/i);

const files = [];
(function walk(d) {
  let ents;
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name) && !e.name.startsWith(".")) walk(p); }
    else if (EXT.includes(path.extname(e.name)) && !IS_TEST(e.name)) files.push(p);
  }
})(dir);

const known = new Set(files);
/** './x' → 실제 파일. 확장자 생략과 디렉터리 index 를 순서대로 시도한다. */
function resolve(fromFile, spec) {
  if (!spec.startsWith(".")) return null; // 패키지 import 는 저장소 밖
  const base = path.resolve(path.dirname(fromFile), spec);
  if (known.has(base)) return base;
  for (const e of EXT) if (known.has(base + e)) return base + e;
  // .js 로 적고 .ts 를 가리키는 ESM 관습
  const noExt = base.replace(/\.[cm]?js$/, "");
  for (const e of EXT) if (known.has(noExt + e)) return noExt + e;
  for (const e of EXT) if (known.has(path.join(base, "index" + e))) return path.join(base, "index" + e);
  return null;
}

const adj = new Map(files.map((f) => [f, new Set()]));      // 런타임 간선만
const adjType = new Map(files.map((f) => [f, new Set()]));  // 타입 전용 간선
const adjAll = new Map(files.map((f) => [f, new Set()]));   // 둘 다
const fanIn = new Map(files.map((f) => [f, 0]));
for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (src.length > 1_500_000) continue; // 생성된 거대 번들
  // 타입 전용 import 는 런타임 간선이 아니다. `import type` 한 단어로 순환을
  // 없앨 수 있으면 그건 탈출구다 — 얼마나 되는지 세려면 둘을 갈라야 한다.
  let sf;
  try { sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
        /\.[jt]sx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS); } catch { continue; }
  const add = (spec, typeOnly) => {
    const t = resolve(f, spec);
    if (!t || t === f) return;
    (typeOnly ? adjType : adj).get(f).add(t);
    adjAll.get(f).add(t);
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      // 절 전체가 type 이거나, 이름 있는 항목이 전부 type 이면 런타임 간선이 아니다.
      let typeOnly = !!c && c.isTypeOnly;
      if (c && !typeOnly && c.namedBindings && ts.isNamedImports(c.namedBindings) && !c.name)
        typeOnly = c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly);
      add(n.moduleSpecifier.text, typeOnly);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      add(n.moduleSpecifier.text, !!n.isTypeOnly);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword &&
               n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      add(n.arguments[0].text, false);
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
}
for (const [, outs] of adjAll) for (const t of outs) fanIn.set(t, fanIn.get(t) + 1);

function sccOf(graph) {
// Tarjan SCC — 재귀는 깊은 그래프에서 스택을 넘기므로 반복으로 쓴다.
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
  const sccs = []; let counter = 0;
for (const root of files) {
  if (index.has(root)) continue;
  const work = [[root, 0]];
  while (work.length) {
    const frame = work[work.length - 1];
    const [v, i] = frame;
    if (i === 0) { index.set(v, counter); low.set(v, counter); counter++; stack.push(v); onStack.add(v); }
    const outs = [...graph.get(v)];
    if (i < outs.length) {
      frame[1]++;
      const w = outs[i];
      if (!index.has(w)) work.push([w, 0]);
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    } else {
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1) sccs.push(comp);
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
    }
  }
}

  return sccs;
}
const sccsRuntime = sccOf(adj);
const sccsAll = sccOf(adjAll);
const sccs = sccsRuntime;

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round((s.length - 1) * p))] : 0; };
const inCycle = sccs.reduce((n, c) => n + c.length, 0);
const fi = [...fanIn.values()], fo = [...adjAll.values()].map((s) => s.size);
const edges = fo.reduce((a, b) => a + b, 0);

console.log(JSON.stringify({
  files: files.length,
  edges,
  cycles: sccsRuntime.length,
  cyclesAll: sccsAll.length,
  filesInCycleAll: sccsAll.reduce((n, c) => n + c.length, 0),
  filesInCycle: inCycle,
  cyclePct: files.length ? Math.round((inCycle / files.length) * 10000) / 100 : 0,
  largestCycle: sccs.reduce((m, c) => Math.max(m, c.length), 0),
  fanInP90: pct(fi, 0.9), fanInMax: Math.max(0, ...fi),
  fanOutP90: pct(fo, 0.9), fanOutMax: Math.max(0, ...fo),
  // 상위 10개 평균 — 최악 하나만 고치면 끝나지 않게(엔진의 다른 축과 같은 이유)
  fanInTop10: (() => { const s = [...fi].sort((a, b) => b - a).slice(0, 10); return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : 0; })(),
  cycleSizes: sccsRuntime.map((c) => c.length).sort((a, b) => b - a),
  worstCycles: sccs.sort((a, b) => b.length - a.length).slice(0, 3)
    .map((c) => ({ size: c.length, sample: c.slice(0, 3).map((f) => path.relative(dir, f)) })),
}));
