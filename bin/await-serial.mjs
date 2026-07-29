#!/usr/bin/env node
/**
 * 순차 await 탐지기 — 서로 독립인데 줄줄이 기다리는 I/O 를 찾는다.
 *
 * 왜 이 축인가: O(n²) 축은 작은 n 에서 이득이 사라지고(손익분기), N+1 축은 상한 상수에
 * 자주 막힌다. 이 축은 둘 다 없다 — 독립 호출 2개만 있어도 레이턴시가 합(sum)에서
 * 최댓값(max)으로 바뀌므로 n=2 에서 이미 절반이다. 증거도 셈으로 나온다(왕복 3회 → 1회).
 *
 * 잡는 것: 같은 블록에서 연속으로 오는 `const x = await f()` 중, 뒤엣것이 앞엣것의
 *         바인딩을 **참조하지 않는** 구간(=독립).
 * 안 잡는 것(의도적):
 *  - 뒤가 앞의 결과를 쓰는 경우(진짜 의존)
 *  - 사이에 if/return/throw/loop 등 제어흐름이 낀 경우
 *  - 이미 Promise.all 안에 있는 것
 *  - await 이 1개뿐인 구간
 *
 * 사용: node bin/await-serial.mjs --dir=<경로> [--json=<출력>] [--min=2]
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
const minRun = Number(getFlag("min") || 2);

const EXCLUDE_PATH =
  /(^|\/)(test|tests|__tests__|spec|e2e|examples?|samples?|scripts?|benchmark|benchmarks|docs|website|www|codemod|fixtures|mocks?|demo|playground|tools|build|dist|node_modules|\.next)(\/|$)|\.(test|spec|config|stories|d)\./i;

/** I/O 로 볼 만한 호출인지 — 순수 계산 await 은 묶어도 이득이 없다. */
const IO_HINT =
  /(prisma|db|database|tx|trx|knex|repo|repository|entityManager|dataSource|redis|cache|kv|s3|storage|bucket|http|axios|client|api|sdk|queue|stripe|supabase|clickhouse|mongo|collection|service|fetch|query|find|get|load|list|count|aggregate|read)/i;

function listFiles(dir) {
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

/** `const x = await f()` 형태면 { names, call, node } 를 준다. */
function asAwaitDecl(stmt) {
  if (!ts.isVariableStatement(stmt)) return null;
  const decls = stmt.declarationList.declarations;
  if (decls.length !== 1) return null;

  const decl = decls[0];
  if (!decl.initializer || !ts.isAwaitExpression(decl.initializer)) return null;

  const call = decl.initializer.expression;
  if (!ts.isCallExpression(call)) return null;

  // 선언된 이름들(구조분해 포함)
  const names = new Set();
  const collect = (name) => {
    if (ts.isIdentifier(name)) names.add(name.getText());
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) {
        if (ts.isBindingElement(el)) collect(el.name);
      }
    }
  };
  collect(decl.name);

  return { names, call, stmt };
}

/** 노드 하위에서 참조되는 식별자 전부 */
function referencedIdentifiers(node) {
  const out = new Set();
  const walk = (n) => {
    if (ts.isIdentifier(n)) out.add(n.getText());
    n.forEachChild(walk);
  };
  walk(node);
  return out;
}

function insidePromiseCombinator(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isCallExpression(cur) &&
      ts.isPropertyAccessExpression(cur.expression) &&
      /^(all|allSettled|any|race)$/.test(cur.expression.name.getText()) &&
      cur.expression.expression.getText() === "Promise"
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
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

  /** 블록의 문장 목록을 훑어 연속 독립 await 구간을 찾는다. */
  const scanBlock = (statements) => {
    let run = [];

    const flush = () => {
      if (run.length >= minRun) {
        const ioCount = run.filter((r) => IO_HINT.test(r.call.getText().slice(0, 80))).length;
        if (ioCount >= minRun) {
          const { line } = src.getLineAndCharacterOfPosition(run[0].stmt.getStart(src));
          findings.push({
            file: path.relative(rootDir, file),
            line: line + 1,
            count: run.length,
            calls: run.map((r) => r.call.getText().replace(/\s+/g, " ").slice(0, 54)),
          });
        }
      }
      run = [];
    };

    for (const stmt of statements) {
      const info = asAwaitDecl(stmt);
      if (!info) {
        flush();
        continue;
      }
      if (insidePromiseCombinator(info.call)) {
        flush();
        continue;
      }

      // 앞 구간의 바인딩을 참조하면 의존 — 구간을 끊는다.
      const refs = referencedIdentifiers(info.call);
      const dependsOnPrevious = run.some((prev) => [...prev.names].some((n) => refs.has(n)));
      if (dependsOnPrevious) {
        flush();
      }

      run.push(info);
    }
    flush();
  };

  const visit = (node) => {
    if (ts.isBlock(node) || ts.isSourceFile(node)) scanBlock(node.statements);
    node.forEachChild(visit);
  };
  visit(src);
}

const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
unique.sort((a, b) => b.count - a.count);

console.log(`\n  파일 ${files.length}개 · 독립 순차 await 구간 ${unique.length}곳\n`);
for (const f of unique.slice(0, 30)) {
  console.log(`    ${f.count}개 연속  ${f.file}:${f.line}`);
  f.calls.forEach((c) => console.log(`        await ${c}`));
}
if (unique.length > 30) console.log(`    … 외 ${unique.length - 30}곳`);

if (jsonOut) {
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(unique, null, 1));
  console.log(`\n  ✓ 저장 → ${jsonOut}`);
}
