#!/usr/bin/env node
/**
 * N+1 탐지기 — 루프 안에서 순차로 도는 I/O 를 찾는다.
 *
 * 왜 이 축인가: O(n²) CPU 스캔은 대부분 주변 I/O 에 묻혀 실측 이득이 안 난다(1.1~1.2배).
 * 반대로 루프 안 I/O 는 비용의 지배항이고, 증거가 "쿼리 N+1회 → 1회"라는 셈이라
 * 벤치마크 없이도 객관적으로 검증된다.
 *
 * 잡는 것: for / for-of / while 본문에서 직접 await 하는 I/O 호출.
 * 안 잡는 것(의도적):
 *  - Promise.all(...map(async)) 안의 await — 이미 동시 실행이다
 *  - 루프 밖 await
 *  - 테스트·스크립트·예제 경로
 *
 * 사용: node bin/nplus1.mjs --dir=<경로> [--json=<출력경로>]
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const args = process.argv.slice(2);
const getFlag = (n) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split("=").slice(1).join("=") : undefined;
};

const rootDir = path.resolve(process.cwd(), getFlag("dir") || ".");
const jsonOut = getFlag("json");

/** I/O 로 볼 수신자·메서드. 이름 기반 휴리스틱 — 오탐은 손검증에서 거른다. */
const IO_RECEIVER = /^(prisma|db|database|tx|trx|knex|repo|repository|em|entityManager|dataSource|redis|cache|kv|s3|storage|bucket|http|axios|client|api|sdk|queue|producer|publisher|mailer|stripe|supabase|clickhouse|es|elastic|mongo|collection)$/i;
const IO_METHOD = /^(find|findOne|findFirst|findMany|findUnique|findUniqueOrThrow|findOneOrFail|findByIds?|get|getMany|query|queryRaw|execute|exec|run|create|createMany|update|updateMany|upsert|delete|deleteMany|save|insert|remove|count|aggregate|fetch|request|send|publish|enqueue|put|set|del|scan|list|head|copy|upload|download)$/;
const IO_GLOBAL = /^(fetch|readFile|readdir|stat|writeFile|appendFile|unlink)$/;

const EXCLUDE_PATH =
  /(^|\/)(test|tests|__tests__|spec|e2e|examples?|samples?|scripts?|benchmark|benchmarks|docs|website|www|codemod|fixtures|mocks?|demo|playground|tools|build|dist|node_modules|\.next)(\/|$)|\.(test|spec|config|stories|d)\./i;

function listFiles(dir) {
  // git 추적 파일만 — 빌드 산출물·미추적 파일 제외
  try {
    const out = execFileSync("git", ["-C", dir, "ls-files", "-z"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 512 * 1024 * 1024,
    });
    return out
      .split("\0")
      .filter((f) => /\.(ts|tsx|mts|cts|js|mjs|jsx)$/.test(f))
      .filter((f) => !EXCLUDE_PATH.test(f))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/** 노드가 감싸는 함수 경계를 넘지 않고 하위를 순회한다. */
function walkWithinFunction(node, visit) {
  node.forEachChild(function step(child) {
    if (
      ts.isFunctionDeclaration(child) ||
      ts.isFunctionExpression(child) ||
      ts.isArrowFunction(child) ||
      ts.isMethodDeclaration(child)
    ) {
      // 콜백 안으로는 따로 들어간다(동시성 판단이 달라지므로 호출부에서 처리)
      return;
    }
    visit(child);
    child.forEachChild(step);
  });
}

/** await 대상이 I/O 로 보이는가 */
function describeIoCall(expr) {
  if (!ts.isCallExpression(expr)) return null;
  const callee = expr.expression;

  if (ts.isPropertyAccessExpression(callee)) {
    const method = callee.name.getText();
    if (!IO_METHOD.test(method)) return null;

    // 수신자 체인의 뿌리 식별자
    let root = callee.expression;
    while (ts.isPropertyAccessExpression(root) || ts.isCallExpression(root)) {
      root = ts.isCallExpression(root) ? root.expression : root.expression;
    }
    const rootName = ts.isIdentifier(root) ? root.getText() : "";
    const chain = callee.expression.getText().slice(0, 60);

    // this.xxxRepository.find(...) 같은 형태도 잡는다
    const chainLooksIo =
      IO_RECEIVER.test(rootName) ||
      /(repository|repo|service|store|client|prisma|db|dao|manager)$/i.test(
        callee.expression.getText().split(".").pop() || "",
      );

    if (!chainLooksIo) return null;
    return { recv: chain, method };
  }

  if (ts.isIdentifier(callee) && IO_GLOBAL.test(callee.getText())) {
    return { recv: "(global)", method: callee.getText() };
  }

  return null;
}

/** 이 await 이 Promise.all 인자 안에 있는가(=이미 동시 실행) */
function insidePromiseAll(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isCallExpression(cur) &&
      ts.isPropertyAccessExpression(cur.expression) &&
      /^(all|allSettled|any|race)$/.test(cur.expression.name.getText()) &&
      /^Promise$/.test(cur.expression.expression.getText())
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

const LOOP_KINDS = new Set([
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
]);

function loopLabel(node, src) {
  if (ts.isForOfStatement(node)) {
    return node.expression.getText(src).replace(/\s+/g, " ").slice(0, 60);
  }
  if (ts.isForInStatement(node)) {
    return node.expression.getText(src).replace(/\s+/g, " ").slice(0, 60);
  }
  if (ts.isForStatement(node)) {
    return (node.condition?.getText(src) ?? "for(;;)").replace(/\s+/g, " ").slice(0, 60);
  }
  return (node.expression?.getText(src) ?? "while").replace(/\s+/g, " ").slice(0, 60);
}

const findings = [];
const files = listFiles(rootDir);

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  if (!text.includes("await")) continue;

  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visit = (node) => {
    if (!LOOP_KINDS.has(node.kind)) return;

    const body = node.statement;
    if (!body) return;

    walkWithinFunction(body, (child) => {
      if (!ts.isAwaitExpression(child)) return;
      if (insidePromiseAll(child)) return;

      const io = describeIoCall(child.expression);
      if (!io) return;

      const { line } = src.getLineAndCharacterOfPosition(child.getStart(src));
      findings.push({
        file: path.relative(rootDir, file),
        line: line + 1,
        recv: io.recv,
        method: io.method,
        loop: loopLabel(node, src),
      });
    });
  };

  src.forEachChild(function step(n) {
    visit(n);
    n.forEachChild(step);
  });
}

// 같은 파일:줄 중복 제거
const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`\n  파일 ${files.length}개 · 순차 I/O 루프 후보 ${unique.length}곳\n`);
for (const f of unique.slice(0, 40)) {
  console.log(`    ${f.recv}.${f.method}()  ${f.file}:${f.line}`);
  console.log(`        loop: ${f.loop}`);
}
if (unique.length > 40) console.log(`    … 외 ${unique.length - 40}곳`);

if (jsonOut) {
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(unique, null, 1));
  console.log(`\n  ✓ 저장 → ${jsonOut}`);
}
