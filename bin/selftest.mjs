#!/usr/bin/env node
/**
 * fixearly selftest — 엔진 내부 순수함수의 회귀 테스트.
 *
 * fixearly.mjs 는 실행 스크립트(import 시 바로 분석을 돈다)라 내부 함수를 export 하지 않는다.
 * 그래서 소스에서 `cognitiveOf`·`isFnLike` 본문만 뽑아 격리 실행한다.
 * 목적: SonarJS S3776(인지 복잡도) 산식이 정본 값과 어긋나지 않는지 고정한다.
 *
 * 사용: node bin/selftest.mjs   (npm test)
 */
import ts from "typescript";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "bin", "fixearly.mjs"), "utf8");

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

const measure = (code) => {
  const sf = ts.createSourceFile("t.ts", code, ts.ScriptTarget.ES2020, true);
  // eslint-disable-next-line no-eval
  const cognitiveOf = eval(`${harness}\ncognitiveOf`); // direct eval: sf·isFnLike·fnName 스코프 공유
  let fn = null;
  const find = (n) => {
    if (!fn && isFnLike(n)) fn = n;
    else ts.forEachChild(n, find);
  };
  ts.forEachChild(sf, find);
  return cognitiveOf(fn); // v7: {cog, nest, guard}
};
const cogOf = (code) => measure(code).cog;

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
  const got = cogOf(code);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: got ${got} want ${want}`);
}

// v7 축: 최대 중첩 깊이(nest)와 가드 절 몫(guard).
// cog 는 `if (!x) return` 여덟 줄과 3단 중첩을 같은 점수로 매긴다 — 읽는 비용은 전혀 다르다.
// 이 두 값이 그 차이를 들고 있으므로 회귀로 못박는다.
const SHAPE_CASES = [
  // 가드만 늘어선 검증 파이프라인: 깊이 1, cog 전부가 가드 몫
  ["가드 3연발", `function f(){ if(!a) return 1; if(!b) return 2; if(!c) return 3; }`, { nest: 1, guard: 3, cog: 3 }],
  // 같은 cog 3인데 3단 중첩: 깊이 3, 가드 0
  ["3단 중첩", `function f(){ if(a){ if(b){ if(c){} } } }`, { nest: 3, guard: 0, cog: 6 }],
  // 가드 블록에 정리 코드가 몇 줄 붙어도 가드로 본다(로그·해제)
  ["블록 가드", `function f(){ if(!a){ log(1); return 2; } body(); }`, { nest: 1, guard: 1, cog: 1 }],
  // else 가 붙으면 빠져나가는 가드가 아니다 — 양쪽을 다 들고 읽어야 한다
  ["else 있으면 가드 아님", `function f(){ if(a) return 1; else return 2; }`, { nest: 1, guard: 0, cog: 2 }],
  // 루프 안 가드(continue)도 가드다
  ["루프 안 continue 가드", `function f(){ for(const x of xs){ if(!x) continue; use(x); } }`, { nest: 2, guard: 2, cog: 3 }],
];
for (const [name, code, want] of SHAPE_CASES) {
  const got = measure(code);
  const ok = got.cog === want.cog && got.nest === want.nest && got.guard === want.guard;
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} 모양: ${name}: got cog${got.cog}/깊이${got.nest}/가드${got.guard} want cog${want.cog}/깊이${want.nest}/가드${want.guard}`);
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
    ["billing admin-api app", "apps/admin-api/src/modules/billing/service.ts", "backend"],
    ["backend named app", "apps/backend/src/modules/goals/service.ts", "backend"],
    ["wiki -back app", "apps/flowiki-back/src/modules/documents/service.ts", "backend"],
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

// 소스 분류도 같은 모노레포 경로를 백엔드로 봐야 LOC breakdown과 O(n²) zone이 갈리지 않는다.
const classifySrc = src.match(/function classifyFile\(filePath, content\) \{[\s\S]*?\n\}/);
if (classifySrc) {
  const classifyFile = eval(`(${classifySrc[0].replace(/^function classifyFile/, "function")})`);
  const CLASSIFY_CASES = [
    ["admin-api", "apps/admin-api/src/modules/billing/service.ts", "", "backend"],
    ["backend", "apps/backend/src/modules/goals/service.ts", "", "backend"],
    ["suffix back", "apps/flowiki-back/src/modules/docs/service.ts", "", "backend"],
    ["tsx frontend", "apps/frontend/src/components/Card.tsx", "", "frontend"],
    ["shared util", "packages/shared/src/date.ts", "", "shared"],
  ];
  for (const [name, file, content, want] of CLASSIFY_CASES) {
    const got = classifyFile(file, content);
    const ok = got === want;
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} source zone: ${name}: got ${got} want ${want}`);
  }
}

// 생성 파일 제외는 이름 또는 강한 생성 배너가 있을 때만 발동한다. migration이라는 이유만으로
// 제외하면 실제 배포 로직을 점수에서 숨길 수 있으므로 일반 migration은 반드시 남긴다.
const generatedSrc = src.match(/function isGeneratedSource\(filePath, content\) \{[\s\S]*?\n\}/);
if (generatedSrc) {
  const isGeneratedSource = eval(`(${generatedSrc[0].replace(/^function isGeneratedSource/, "function")})`);
  const GENERATED_CASES = [
    ["generated basename", "libs/i18n/src/generated.ts", "export const x = 1", true],
    ["generated suffix", "src/sample-rows.generated.ts", "export const x = 1", true],
    ["English banner", "src/schema.ts", "// Code generated by tool. DO NOT EDIT.\nexport {}", true],
    ["Korean banner migration", "src/migrations/1-seed.ts", "// 자동 생성, 손수정 금지\nexport {}", true],
    ["handwritten migration", "src/migrations/1-add-index.ts", "export async function up() {}", false],
    ["ordinary generator", "src/generator.ts", "export function generate() {}", false],
  ];
  for (const [name, file, content, want] of GENERATED_CASES) {
    const got = isGeneratedSource(file, content);
    const ok = got === want;
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} generated: ${name}: got ${got} want ${want}`);
  }
}

// ── 문서가 점수식과 같은 말을 하는지 ──────────────────────────────────────
// 랜딩과 README 는 배점을 손으로 적는다. v8 에서 N+1 을 채점축에 넣었을 때
// 두 문서가 전부 "채점축 4개"로 남아 있었고, 함수 길이는 23인데 26으로 적혀
// 있었다. 숫자를 손으로 적는 문서는 반드시 갈리므로 여기서 고정한다.
{
  console.log("\n문서 ↔ 점수식 일치:");
  const AXES = [
    ["인지 복잡도", ["over15Pct", "over25Pct", "cognitive.p90", "cognitive.top10avg"]],
    ["함수 길이", ["fnOver40Pct", "fnLength.p90", "fnLength.top10avg"]],
    ["중복", ["duplication.percent"]],
    ["파일 크기", ["longFileSeverityPct", "avgFileLines"]],
    ["순차 I/O", ["seqIo"]],
    ["O(n²)", ["quadratic.candidates"]],
  ];
  // AST 모드 점수식만 자른다(regex 폴백은 별도 체계).
  const from = src.indexOf("qualityScore = Math.max(0, Math.round(");
  const to = src.indexOf("  // regex 폴백", from);
  const expr = src.slice(from, to);
  const caps = new Map(AXES.map(([n]) => [n, 0]));
  let matched = 0;
  for (const m of expr.matchAll(/-\s*(?:\((?:[^()]|\([^()]*\))*\?\s*)?Math\.min\((\d+),\s*(.*)$/gm)) {
    const axis = AXES.find(([, keys]) => keys.some((k) => m[2].includes(k)));
    if (!axis) continue;
    caps.set(axis[0], caps.get(axis[0]) + Number(m[1]));
    matched++;
  }
  const total = [...caps.values()].reduce((a, b) => a + b, 0);
  const check = (name, ok, detail) => {
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
  };
  check("점수식 항이 모두 축에 매핑됨", matched === expr.match(/-\s*(?:\((?:[^()]|\([^()]*\))*\?\s*)?Math\.min\(/g).length,
    `${matched}개 매핑`);

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  // lead 문단은 섹션마다 있다 — 배점을 적는 건 #axes 의 것이다.
  const axesSec = html.slice(html.indexOf('id="axes"'), html.indexOf("</section>", html.indexOf('id="axes"')));
  const lead = axesSec.match(/<p class="lead ko">(.*?)<\/p>/s)?.[1] ?? "";
  for (const [axis, cap] of caps) {
    check(`랜딩 배점 ${axis} ${cap}`, lead.includes(`${axis} ${cap}`));
    // 축 이름에 () 나 + 가 들어간다(O(n²), N+1) — 정규식 메타문자를 전부 막아야 한다.
    // `+` 만 escape 하던 때 O(n²) 의 괄호가 캡처 그룹으로 해석돼 조용히 안 맞았다.
    const lit = axis.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    check(`README 배점 ${axis} ${cap}`,
      new RegExp(`\\*\\*${lit}\\*\\*\\s*\\|\\s*${cap}\\s*\\|`).test(readme));
  }
  check(`합계 ${total}`, lead.includes(`합 ${total}`) && readme.includes(`합 ${total}`));

  const nAxes = caps.size;
  check(`랜딩 제목 "축 ${nAxes}개"`, html.includes(`축 ${nAxes}개`));
  check(`랜딩 herometa 채점축 ${nAxes}`, html.includes(`scored axes</span> ${nAxes}`));
  check(`README 제목 "채점축 ${nAxes}개"`, readme.includes(`채점축 ${nAxes}개`));

  // 진단 개수: DIAG 배열이 진짜 출처다(#dx 를 런타임에 덮어쓴다).
  const diagBlock = html.slice(html.indexOf("const DIAG=["), html.indexOf("\n];", html.indexOf("const DIAG=[")));
  const diag = [...diagBlock.matchAll(/^\s*\['(\w+)',/gm)].map((m) => m[1]);
  const byCat = diag.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {});
  const CHIP = { perf: "성능", bug: "정확성 버그", type: "타입 위생", hyg: "위생" };
  for (const [k, ko] of Object.entries(CHIP)) {
    check(`칩 "${ko} ${byCat[k]}"`, html.includes(`${ko} ${byCat[k]}<`));
  }
  check(`랜딩 제목 "결함 ${diag.length}종"`, html.includes(`결함 ${diag.length}종`));
  check(`랜딩 herometa 진단 ${diag.length}`, html.includes(`diagnostics</span> ${diag.length}`));
  check(`README "진단 ${diag.length}종"`, readme.includes(`진단 ${diag.length}종`));
  check("채점축과 진단이 겹치지 않음", !diag.some((_, i) => diagBlock.includes("'N+1'")));
}

// ── 탐지기 픽스처: 참·거짓 양쪽을 고정한다 ────────────────────────────────
// 코퍼스 검증에서만 잡힌 오탐 두 계열(export 된 이름 · 반환값을 쓰는 delete/add)이
// 있었다. 그때 재보지 않았으면 그대로 나갔다. 픽스처가 저장소 밖(스크래치패드)에
// 있으면 다음 사람은 같은 걸 다시 손으로 재야 하므로 여기에 고정한다.
// 오탐이 되살아나면 코퍼스를 다시 받기 전에 여기서 먼저 빨간불이 뜬다.
{
  console.log("\n탐지기 픽스처:");
  const check = (name, ok) => {
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  };
  const FIXTURES = [
    {
      file: "write-only-collection.ts",
      // analyzeTextbookIssues 가 돌려주는 키
      key: "writeOnlyCollection",
      label: "쓰기만 하는 컬렉션",
      hit: ["seen", "audit"],
      miss: ["known", "bag", "passed", "built", "registry", "later", "skip", "chained"],
    },
  ];
  for (const fx of FIXTURES) {
    const p = path.join(ROOT, "tools", "fixtures", fx.file);
    if (!fs.existsSync(p)) { check(`픽스처 ${fx.file} 존재`, false); continue; }
    // 엔진을 그대로 실행해서 본다. 내부 함수를 떼어내 eval 하면 모듈 상수까지
    // 같이 끌어와야 하고, 그 목록이 엔진과 조용히 어긋난다. 실행 경로를 통째로
    // 재는 쪽이 픽스처의 목적(회귀 고정)에 맞다.
    // tools/fixtures 를 그대로 가리키면 엔진이 "비-프로덕션·벤더 파일"로 걸러
    // 0개 분석이 된다(경로에 tools/fixtures 가 들어가서). 중립적인 src/ 로 복사해
    // 실제 소스처럼 재게 한다.
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "fixearly-fx-"));
    fs.mkdirSync(path.join(out, "src"));
    fs.copyFileSync(p, path.join(out, "src", fx.file));
    const r = spawnSync(process.execPath,
      [path.join(ROOT, "bin", "fixearly.mjs"), `--dir=${path.join(out, "src")}`],
      { cwd: out, encoding: "utf8" }); // cwd 를 옮겨 산출물(public/)이 저장소에 안 남게
    const text0 = (r.stdout || "") + (r.stderr || "");
    fs.rmSync(out, { recursive: true, force: true });
    if (/regex 근사 모드/.test(text0)) check(`${fx.key} AST 모드로 측정됨`, false);
    const text = text0;
    const head = text.match(new RegExp(`${fx.label}: (\\d+)곳`));
    const names = new Set([...text.matchAll(/^\s{4}([A-Za-z_$][\w$]*) = new (?:Map|Set)\(\)/gm)].map((m) => m[1]));
    for (const n of fx.hit) check(`${fx.key} 잡음 "${n}"`, names.has(n));
    for (const n of fx.miss) check(`${fx.key} 안 잡음 "${n}"`, !names.has(n));
    // 출력은 상위 몇 건만 찍히므로 총량도 따로 본다 — 오탐이 늘면 여기가 먼저 깨진다.
    check(`${fx.key} 총 ${fx.hit.length}건`, head ? Number(head[1]) === fx.hit.length : false);
  }
}

console.log(fail ? `\n  ${fail} FAIL` : `\n  all passed`);
process.exit(fail ? 1 : 0);
