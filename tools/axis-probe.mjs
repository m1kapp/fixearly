#!/usr/bin/env node
/**
 * axis-probe — 새 채점축 후보 넷을 한 번에 재는 프로토타입.
 *
 * 축 채택 기준은 둘 다여야 한다: 점수를 움직이고, 그 지적으로 실제 PR 이 나온다.
 * 여기서는 "잴 가치가 있는가"만 본다 — 발동 빈도와 분포. 독립성·층화는 밖에서 계산한다.
 *
 * 후보:
 *  A. 동기 I/O — readFileSync·execSync 류를 async 함수 안이나 루프 안에서 호출.
 *     Node 서버에서 이벤트 루프를 통째로 막는다. 고침은 async 판으로 교체라 기계적이고,
 *     증거가 "이벤트 루프 N ms 블로킹"이라 벤치 논쟁이 없다.
 *  B. 무제한 팬아웃 — Promise.all(X.map(async …)) 에서 X 가 데이터 배열.
 *     동시성 상한이 없어 커넥션·메모리를 소진한다.
 *  C. 중복 await — 같은 함수 안에서 같은 호출을 두 번 이상 await. 캐시하면 왕복이 준다.
 *  D. 깊은 복사 — JSON.parse(JSON.stringify(x)).
 *
 * 사용: node tools/axis-probe.mjs --dir=<경로>
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const dir = (process.argv.find((a) => a.startsWith("--dir=")) || "").slice(6);
if (!dir) { console.error("--dir 필요"); process.exit(2); }

const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", "coverage",
  ".next", ".turbo", "vendor", "fixtures", "__snapshots__", "generated"]);
const isTest = (n) => /(\.|-)(test|spec|bench)\.[cm]?[jt]sx?$/i.test(n);

const files = [];
(function walk(d) {
  let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith(".")) walk(p); }
    else if (EXT.includes(path.extname(e.name)) && !isTest(e.name)) files.push(p);
  }
})(dir);

const SYNC_IO = /^(readFileSync|writeFileSync|appendFileSync|existsSync|readdirSync|statSync|lstatSync|mkdirSync|rmSync|unlinkSync|copyFileSync|execSync|execFileSync|spawnSync)$/;
// 기동·설정 경로는 동기 I/O 가 정상이다. 요청마다 도는 코드만 문제다.
// 기동·빌드·CLI 경로는 동기 I/O 가 정상이다. 실측해보니 후보의 대부분이 여기였다 —
// vite 의존성 최적화, vitest 스캐폴딩, nuxt 빌드, storybook builder, 그리고 next.js 의
// compiled/ 아래 번들된 벤더 코드(61곳 중 대부분). 이걸 안 빼면 "서버가 멈춘다"는
// 주장을 뒷받침하지 못하는 숫자가 된다.
const STARTUP = /(config|\.config\.|webpack|rollup|vite\.|esbuild|cli\/|bin\/|scripts?\/|codemod|plugin\.|loader|setup|bootstrap|migrat|seed|compiled\/|vendor|commands?\/|create\/|builder|optimizer|generator|devtools|test-utils|packag(e|ing))/i;
// 요청마다 도는 경로만 센다. 이름으로 판별한다 — 서버·API·라우트·핸들러·미들웨어.
const SERVER = /(^|\/)(server|api|routes?|handlers?|controllers?|middlewares?|services?|resolvers?|queues?|workers?|jobs?)(\/|\.)/i;

const out = { files: files.length, syncIo: [], fanout: [], dupAwait: [], deepClone: [] };
let codeLines = 0;

for (const f of files) {
  let src; try { src = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (src.length > 1_500_000) continue;
  codeLines += src.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
  let sf;
  try { sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
        /\.[jt]sx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS); } catch { continue; }
  const rel = path.relative(dir, f);
  const startupish = STARTUP.test(rel);
  const serverish = SERVER.test(rel);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
  const isLoop = (n) => n.kind === ts.SyntaxKind.ForStatement || n.kind === ts.SyntaxKind.ForInStatement ||
    n.kind === ts.SyntaxKind.ForOfStatement || n.kind === ts.SyntaxKind.WhileStatement ||
    n.kind === ts.SyntaxKind.DoStatement;

  // C 를 위해 함수 단위로 await 호출 텍스트를 모은다.
  const awaitsByFn = new Map();

  const visit = (n, inAsync, inLoop, fnKey) => {
    const nowAsync = isFnLike(n)
      ? !!(n.modifiers || []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
      : inAsync;
    const nowLoop = isLoop(n) ? true : inLoop;
    const nowKey = isFnLike(n) ? `${rel}:${lineOf(n)}` : fnKey;

    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.getText(sf)
        : ts.isIdentifier(callee) ? callee.getText(sf) : "";

      // A. 동기 I/O — async 함수 안이거나 루프 안일 때만. 기동·설정 경로는 제외.
      if (SYNC_IO.test(name) && !startupish && (nowAsync || nowLoop)) {
        out.syncIo.push({ file: rel, line: lineOf(n), name, where: nowAsync ? "async-fn" : "loop", server: serverish });
      }

      // B. 무제한 팬아웃 — Promise.all(X.map(async …)), X 가 대문자 상수가 아닐 때.
      if (ts.isPropertyAccessExpression(callee) && callee.name.getText(sf) === "all" &&
          callee.expression.getText(sf) === "Promise" && n.arguments[0]) {
        const a0 = n.arguments[0];
        if (ts.isCallExpression(a0) && ts.isPropertyAccessExpression(a0.expression) &&
            a0.expression.name.getText(sf) === "map") {
          const recv = a0.expression.expression.getText(sf);
          const cb = a0.arguments[0];
          const cbAsync = cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) &&
            (cb.modifiers || []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
          // 상수 목록·리터럴은 상한이 코드에 박혀 있다 → 제외
          const bounded = /^[A-Z][A-Z0-9_]{2,}$/.test(recv.split(".").pop() || "") ||
            ts.isArrayLiteralExpression(a0.expression.expression);
          if (cbAsync && !bounded) out.fanout.push({ file: rel, line: lineOf(n), recv });
        }
      }

      // D. 깊은 복사 — JSON.parse(JSON.stringify(x))
      if (name === "parse" && ts.isPropertyAccessExpression(callee) &&
          callee.expression.getText(sf) === "JSON" && n.arguments[0]) {
        const inner = n.arguments[0];
        if (ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression) &&
            inner.expression.name.getText(sf) === "stringify" &&
            inner.expression.expression.getText(sf) === "JSON") {
          out.deepClone.push({ file: rel, line: lineOf(n), inLoop: nowLoop });
        }
      }
    }

    // C. 중복 await — 같은 함수 안에서 같은 호출 텍스트를 두 번 이상
    if (ts.isAwaitExpression(n) && ts.isCallExpression(n.expression) && nowKey) {
      const t = n.expression.getText(sf).replace(/\s+/g, " ");
      if (t.length < 120) {
        if (!awaitsByFn.has(nowKey)) awaitsByFn.set(nowKey, new Map());
        const m = awaitsByFn.get(nowKey);
        m.set(t, (m.get(t) || 0) + 1);
      }
    }

    ts.forEachChild(n, (c) => visit(c, nowAsync, nowLoop, nowKey));
  };
  ts.forEachChild(sf, (n) => visit(n, false, false, null));

  for (const [key, m] of awaitsByFn) {
    for (const [call, cnt] of m) {
      // 인자 없는 호출은 매번 다른 값을 줄 수 있다(Date.now 류) — 인자가 있는 것만
      if (cnt >= 2 && /\(.+\)/.test(call)) out.dupAwait.push({ fn: key, call: call.slice(0, 70), count: cnt });
    }
  }
}

out.codeLines = codeLines;
out.counts = {
  syncIo: out.syncIo.length,
  syncIoServer: out.syncIo.filter((x) => x.server).length, fanout: out.fanout.length,
  dupAwait: out.dupAwait.length, deepClone: out.deepClone.length,
};
out.syncIo = out.syncIo.filter((x) => x.server);
for (const k of ["syncIo", "fanout", "dupAwait", "deepClone"]) out[k] = out[k].slice(0, 5);
console.log(JSON.stringify(out));
