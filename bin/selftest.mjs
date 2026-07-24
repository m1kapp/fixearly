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

// 엔진에서 두 함수 본문을 추출해 격리 평가한다(회귀 대상이 바뀌면 여기서 즉시 깨진다).
const isFnLikeSrc = src.match(/const isFnLike = ([\s\S]*?);\n/);
const cogSrc = src.match(/const cognitiveOf = (\(fn\) => \{[\s\S]*?\n  \});\n/);
if (!isFnLikeSrc || !cogSrc) {
  console.error("selftest: cognitiveOf/isFnLike 본문을 찾지 못했습니다(엔진 구조 변경?).");
  process.exit(2);
}
const isFnLike = eval(`(${isFnLikeSrc[1]})`);
const cognitiveOf = eval(`(${cogSrc[1]})`);

const cog = (code) => {
  const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.ES2020, true);
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
];

let fail = 0;
for (const [name, code, want] of CASES) {
  const got = cog(code);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: got ${got} want ${want}`);
}
console.log(fail ? `\n  ${fail} FAIL` : `\n  ${CASES.length} passed`);
process.exit(fail ? 1 : 0);
