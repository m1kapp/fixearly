#!/usr/bin/env node
/**
 * cleanscore selftest — 엔진 내부 순수함수의 회귀 테스트.
 *
 * cleanscore.mjs 는 실행 스크립트(import 시 바로 분석을 돈다)라 내부 함수를 export 하지 않는다.
 * 그래서 소스에서 `cognitiveOf`·`isFnLike` 본문만 뽑아 격리 실행한다.
 * 목적: SonarJS S3776(인지 복잡도) 산식이 정본 값과 어긋나지 않는지 고정한다.
 *
 * 사용: node bin/selftest.mjs   (npm test)
 */
import ts from "typescript";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "bin", "cleanscore.mjs"), "utf8");

// 엔진에서 세 함수 선언을 통째로 추출한다(회귀 대상이 바뀌면 여기서 즉시 깨진다).
// cognitiveOf 는 fnName·isFnLike 를 참조하고 fnName 은 sf 를 클로저로 잡으므로,
// sf 가 살아있는 cog() 안에서 direct eval 로 세 선언을 함께 평가한다.
const isFnLikeSrc = src.match(/  const isFnLike = [\s\S]*?;\n/);
const fnNameSrc = src.match(/  const fnName = \(n\) => \{[\s\S]*?\n  \};\n/);
const cogSrc = src.match(/  const cognitiveOf = \(fn\) => \{[\s\S]*?\n  \};\n/);
if (!isFnLikeSrc || !fnNameSrc || !cogSrc) {
  console.error("selftest: isFnLike/fnName/cognitiveOf 선언을 찾지 못했습니다(엔진 구조 변경?).");
  process.exit(2);
}
const harness = isFnLikeSrc[0] + fnNameSrc[0] + cogSrc[0];
const isFnLikeVal = isFnLikeSrc[0].match(/const isFnLike = ([\s\S]*);\n/)[1];
const isFnLike = eval(`(${isFnLikeVal})`); // sf 비의존 — 모듈 스코프에서 find 용

const cog = (code) => {
  const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.ES2020, true);
  // eslint-disable-next-line no-eval
  const cognitiveOf = eval(`${harness}\ncognitiveOf`); // direct eval: sf·isFnLike·fnName 스코프 공유
  let fn = null;
  const find = (n) => {
    if (!fn && isFnLike(n)) fn = n;
    else ts.forEachChild(n, find);
  };
  ts.forEachChild(sf, find);
  return cognitiveOf(fn);
};

// [설명, 코드, 기대값] — 값은 SonarSource Cognitive Complexity(S3776) 정본 기준.
const CASES = [
  // else-if 는 구조 +1 만(중첩 증가 없음). 루프 안에 있어도 depth 가 더해지면 안 된다.
  ["else-if in while", `function f(){ while(x){ if(a){} else if(b){} else {} } }`, 5],
  ["flat if/elseif/elseif/else", `function f(){ if(a){} else if(b){} else if(c){} else {} }`, 4],
  // else-if 의 '본문'은 여전히 한 단계 중첩된다(링크 자체만 중첩 면제).
  ["nested if inside else-if body", `function f(){ while(x){ if(a){} else if(b){ if(c){} } } }`, 7],
  // 이중 루프 + 중첩 if (라벨 점프 없음).
  ["double loop + if", `function f(m){ for(let i=1;i<=m;++i){ for(let j=2;j<i;++j){ if(i%j==0){ return i; } } } }`, 6],
  // 논리 연산 연쇄: 같은 연산자 연쇄는 1회, 연산자 바뀌면 +1.
  ["logical sequence", `function f(){ if(a && b && c || d){} }`, 3],
  // 삼항 중첩.
  ["nested ternary", `function f(){ return a ? (b?1:2) : 3; }`, 3],
  // else { if } 는 else-if 와 다르다: else 가 중첩을 올려 내부 if 가 +2.
  ["else-block if (not else-if)", `function f(){ if(a){} else { if(b){} } }`, 4],
  // 라벨 continue: for+1, for+2, if+3, continue LABEL +1 = 7 (SonarSource sumOfPrimes 정본).
  ["labeled continue", `function f(max){ outer: for(let i=1;i<=max;++i){ for(let j=2;j<i;++j){ if(i%j==0){ continue outer; } } } }`, 7],
  // 라벨 없는 break/continue 는 증가 없음.
  ["unlabeled break", `function f(){ for(;;){ if(a){ break; } } }`, 3],
  // 직접 재귀: if+1, 재귀호출 2회 +2 = 3.
  ["direct recursion (fib)", `function fib(n){ if(n<2) return n; return fib(n-1)+fib(n-2); }`, 3],
  // 화살표 재귀도 바인딩 이름으로 잡는다.
  ["arrow recursion", `const walk = (n) => { if(n){ walk(n.next); } };`, 2],
  // this.foo()·동명 타 함수 호출은 재귀로 세지 않는다(오탐 방지).
  ["method call not counted as recursion", `function run(){ this.run(); other.run(); }`, 0],
];

let fail = 0;
for (const [name, code, want] of CASES) {
  const got = cog(code);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: got ${got} want ${want}`);
}

// O(n²) 축의 zone 분류 회귀 — 백엔드가 프론트보다 먼저 매칭돼야 한다(api/admin 라우트 오분류 방지).
const zoneSrc = src.match(/function quadZoneOf\(file\) \{[\s\S]*?\n\}/);
if (zoneSrc) {
  const quadZoneOf = eval(`(${zoneSrc[0].replace(/^function quadZoneOf/, "function")})`);
  const ZONE_CASES = [
    ["medusa admin REST route", "packages/medusa/src/api/admin/translations/batch/route.ts", "backend"],
    ["directus api service", "api/src/services/collections.ts", "backend"],
    ["strapi admin UI component", "packages/core/admin/admin/src/components/LeftMenu.tsx", "frontend"],
    ["outline server task", "server/queues/tasks/MarkdownAPIImportTask.ts", "backend"],
    ["spec file", "server/services/foo.test.ts", "test"],
    ["plain lib file", "src/utils/format.ts", "other"],
  ];
  for (const [name, path, want] of ZONE_CASES) {
    const got = quadZoneOf(path);
    const ok = got === want;
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} zone: ${name}: got ${got} want ${want}`);
  }
}

console.log(fail ? `\n  ${fail} FAIL` : `\n  all passed`);
process.exit(fail ? 1 : 0);
