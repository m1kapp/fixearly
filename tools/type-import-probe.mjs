#!/usr/bin/env node
/**
 * type-import-probe — "한 단어로 런타임 순환을 끊을 수 있는 자리"를 찾는다.
 *
 * 순환 의존 자체는 PR 감이 아니다. 64개 모듈이 얽힌 걸 푸는 건 대형 리팩터고,
 * 요청 없는 아키텍처 개편은 대개 닫힌다.
 *
 * 그런데 부분집합 하나는 다르다: `import { X }` 로 적었지만 X 를 **타입으로만**
 * 쓰는 자리. `import type { X }` 로 바꾸면
 *   · 수정은 한 단어
 *   · 런타임 동작은 완전히 동일(타입은 컴파일 후 사라진다)
 *   · 그 간선이 사라져 런타임 순환이 실제로 끊긴다
 * 기계적이고 · 무해하고 · 이득이 측정 가능하다 — PR 3요건을 다 만족한다.
 *
 * 여기서는 "그런 자리가 순환 위에 있는가"만 판정한다. 순환에 안 걸린 자리는
 * 그냥 스타일 문제라 PR 가치가 없다.
 *
 * 사용: node tools/type-import-probe.mjs --dir=<경로>
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const dir = (process.argv.find((a) => a.startsWith("--dir=")) || "").slice(6);
if (!dir) { console.error("--dir 필요"); process.exit(2); }

const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".turbo", "vendor", "fixtures", "__snapshots__", "generated"]);
const isTest = (n) => /(\.|-)(test|spec)\.[cm]?[jt]sx?$/i.test(n);

const files = [];
(function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith(".")) walk(p); }
    else if (EXT.includes(path.extname(e.name)) && !isTest(e.name)) files.push(p);
  }
})(dir);

const known = new Set(files);
const resolveSpec = (from, spec) => {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  if (known.has(base)) return base;
  for (const e of EXT) if (known.has(base + e)) return base + e;
  const noExt = base.replace(/\.[cm]?js$/, "");
  for (const e of EXT) if (known.has(noExt + e)) return noExt + e;
  for (const e of EXT) if (known.has(path.join(base, "index" + e))) return path.join(base, "index" + e);
  return null;
};

/** 이 파일에서 name 이 값으로 쓰인 적이 있는가. 타입 위치의 참조는 세지 않는다. */
function usedAsValue(sf, names) {
  const live = new Set(names);
  const seenValue = new Set();
  const visit = (n, inType) => {
    if (seenValue.size === live.size) return;
    // 타입 노드 안으로 들어가면 그 아래는 전부 타입 위치다.
    const nowType = inType || ts.isTypeNode(n) || ts.isTypeParameterDeclaration(n) ||
      (ts.isTypeAliasDeclaration(n) && true) || ts.isInterfaceDeclaration(n);
    if (!nowType && ts.isIdentifier(n) && live.has(n.text)) {
      // import 선언 자신의 식별자는 사용이 아니다.
      let p = n.parent;
      const isDecl = p && (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p));
      // 속성 이름(obj.name)이나 객체 키는 참조가 아니다.
      const isMember = p && ts.isPropertyAccessExpression(p) && p.name === n;
      const isKey = p && ts.isPropertyAssignment(p) && p.name === n;
      if (!isDecl && !isMember && !isKey) seenValue.add(n.text);
    }
    ts.forEachChild(n, (c) => visit(c, nowType));
  };
  visit(sf, false);
  return seenValue;
}

const runtimeEdges = new Map(files.map((f) => [f, new Set()]));
const convertible = []; // 타입 전용으로 바꿀 수 있는 간선

for (const f of files) {
  let src; try { src = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (src.length > 1_500_000) continue;
  if (!/\.tsx?$/.test(f)) { // JS 는 타입 import 개념이 없다 — 간선만 세운다
    let sf; try { sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true); } catch { continue; }
    ts.forEachChild(sf, function v(n) {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const t = resolveSpec(f, n.moduleSpecifier.text); if (t && t !== f) runtimeEdges.get(f).add(t);
      }
      ts.forEachChild(n, v);
    });
    continue;
  }
  let sf;
  try { sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
        /\.tsx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS); } catch { continue; }

  const decls = [];
  ts.forEachChild(sf, function v(n) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      let typeOnly = !!c && c.isTypeOnly;
      if (c && !typeOnly && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings))
        typeOnly = c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly);
      const t = resolveSpec(f, n.moduleSpecifier.text);
      if (!t || t === f) return;
      if (typeOnly) return;                 // 이미 타입 전용 — 런타임 간선 아님
      runtimeEdges.get(f).add(t);
      // 부수효과 import(`import './x'`)나 네임스페이스는 값 사용으로 본다
      if (!c || c.namedBindings && ts.isNamespaceImport(c.namedBindings)) return;
      const names = [];
      if (c.name) names.push(c.name.text);
      if (c.namedBindings && ts.isNamedImports(c.namedBindings))
        for (const e of c.namedBindings.elements) if (!e.isTypeOnly) names.push(e.name.text);
      if (names.length) decls.push({ target: t, names, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      if (n.isTypeOnly) return;
      const t = resolveSpec(f, n.moduleSpecifier.text); if (t && t !== f) runtimeEdges.get(f).add(t);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword &&
               n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      const t = resolveSpec(f, n.arguments[0].text); if (t && t !== f) runtimeEdges.get(f).add(t);
    }
    ts.forEachChild(n, v);
  });

  if (!decls.length) continue;
  const allNames = decls.flatMap((d) => d.names);
  const valueUsed = usedAsValue(sf, allNames);
  for (const d of decls) {
    if (d.names.every((n) => !valueUsed.has(n))) convertible.push({ from: f, ...d });
  }
}

function sccOf(graph) {
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], comps = [];
  let counter = 0;
  for (const root of graph.keys()) {
    if (index.has(root)) continue;
    const work = [[root, 0]];
    while (work.length) {
      const fr = work[work.length - 1], v = fr[0];
      if (fr[1] === 0) { index.set(v, counter); low.set(v, counter); counter++; stack.push(v); onStack.add(v); }
      const outs = [...graph.get(v)];
      if (fr[1] < outs.length) {
        const w = outs[fr[1]++];
        if (!index.has(w)) work.push([w, 0]);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      } else {
        if (low.get(v) === index.get(v)) {
          const c = []; let w;
          do { w = stack.pop(); onStack.delete(w); c.push(w); } while (w !== v);
          if (c.length > 1) comps.push(c);
        }
        work.pop();
        if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      }
    }
  }
  return comps;
}

const before = sccOf(runtimeEdges);
const inCycle = new Set(before.flat());
// 순환 위에 있는 전환 가능 간선만 PR 가치가 있다.
const onCycle = convertible.filter((c) => inCycle.has(c.from) && inCycle.has(c.target));

// 전부 바꿨을 때 순환이 실제로 줄어드는지
const after = new Map([...runtimeEdges].map(([k, v]) => [k, new Set(v)]));
for (const c of onCycle) after.get(c.from).delete(c.target);
const afterComps = sccOf(after);

const rel = (f) => path.relative(dir, f);
console.log(JSON.stringify({
  files: files.length,
  cyclesBefore: before.length, filesInCycleBefore: inCycle.size,
  cyclesAfter: afterComps.length, filesInCycleAfter: new Set(afterComps.flat()).size,
  convertibleTotal: convertible.length,
  convertibleOnCycle: onCycle.length,
  samples: onCycle.slice(0, 6).map((c) => ({ file: rel(c.from), line: c.line, names: c.names, target: rel(c.target) })),
}));
