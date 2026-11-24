#!/usr/bin/env node
/**
 * fixearly — JS/TS 코드에서 고칠 줄을 짚는다. 규칙은 남의 저장소에 PR 로 내서 머지된 것들이다.
 *
 * Usage:
 *   npx fixearly --dir=src                # 고칠 줄 목록 (git 추적 파일만, 빌드산출물 제외)
 *   npx fixearly --dir=src --all          # 목록 전체 (기본은 상위 20개)
 *   npx fixearly --dir=src --deps         # (선택) 락파일 취약점 — OSV.dev 조회, 네트워크 필요
 *   npx fixearly --dir=src --exclude=a,b  # 모노레포에서 산출물 아닌 패키지 제외
 *   npx fixearly --dir=src --mine         # O(n²) 후보 전체 덤프 (손검증용)
 *
 * 결과는 public/fixearly.json 에, 직전 실행 대비 신규·해소는 .fixearly-sweep.json 에 쌓인다.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { buildSweepDecision, sweepConsoleLines, thanksUrl } from "./sweep.mjs";

const args = process.argv.slice(2);
const getFlag = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : undefined;
};

// 실경로로 푼다. git 은 루트를 실경로로 돌려주므로(macOS /var → /private/var) 심볼릭 링크
// 경로를 그대로 두면 git 루트 기준 상대경로가 전부 ".." 가 되어 핫스팟·churn 이 빈다.
const srcDir = (() => {
  const p = path.resolve(process.cwd(), getFlag("dir") || "src");
  try { return fs.realpathSync(p); } catch { return p; }
})();
const outDir = path.resolve(process.cwd(), getFlag("out") || "public");

// 파일 경로 표시 기준. 저장소 안에서 돌리면 cwd 가 맞지만, --dir 이 cwd 밖을
// 가리키면 `../../../../../private/tmp/...` 같은 것이 리포트에 그대로 찍힌다.
// 클릭도 안 되고 읽을 수도 없다. cwd 기준이 밖으로 나가면 분석 대상의 git 루트로,
// 그것도 없으면 분석 대상 자체로 떨어진다.
const DISPLAY_BASE = (() => {
  const fromCwd = path.relative(process.cwd(), srcDir);
  if (!fromCwd.startsWith("..")) return process.cwd();
  try {
    const root = execFileSync("git", ["-C", srcDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (root) return root;
  } catch { /* git repo 가 아니면 분석 대상 기준으로 */ }
  return srcDir;
})();
/** 사람이 읽을 파일 경로. 기준 밖으로 나가면 그때만 cwd 로 물러선다. */
const relDisplay = (f) => {
  const r = path.relative(DISPLAY_BASE, f);
  return r.startsWith("..") ? path.relative(process.cwd(), f) : r;
};
const wantMine = args.includes("--mine"); // O(n²) PR 후보 전체 덤프(손검증 파이프라인 입력)
const wantAll = args.includes("--all");
// 의존성 취약점은 네트워크(OSV.dev)를 타므로 옵트인이다. 오프라인에서도 결과가 나와야 한다.
const wantDeps = args.includes("--deps");
// 탐지 규칙 버전 — 규칙이 바뀌면 올린다. 직전 실행과의 신규·해소 비교가 규칙 변경 때문인지 가린다.
const RULES_VERSION = "v18";

// 소스 파일 수집
function collectFiles(dir, exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      results.push(...collectFiles(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

// git 추적 파일 집합 (빌드산출물·gitignore 대상 제외). git repo 아니면 null 반환 → 폴백.
function gitTrackedSet(dir) {
  try {
    const out = execFileSync("git", ["-C", dir, "ls-files", "-z"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
    const set = new Set();
    for (const rel of out.split("\0")) {
      if (rel) set.add(path.resolve(dir, rel));
    }
    return set.size > 0 ? set : null;
  } catch {
    return null;
  }
}




// 줄 수 카운트 (빈 줄, 주석만 있는 줄 제외)
function countLines(content) {
  const lines = content.split("\n");
  let total = 0;
  let code = 0;
  for (const line of lines) {
    total++;
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*")) {
      code++;
    }
  }
  return { total, code };
}



// 프로젝트의 typescript 패키지 로드 (AST 기반 정밀 분석용)
function loadTypescript() {
  // 1) fixearly에 번들된 typescript를 '먼저' 쓴다 — 같은 저장소를 어디서 실행하든
  //    같은 점수가 나와야 배지가 비교 가능하다(예전엔 타겟의 TS 버전에 따라 점수가 흔들렸다).
  try {
    const req = createRequire(import.meta.url);
    return req("typescript");
  } catch {}
  // 2) 폴백: 타겟 프로젝트의 typescript.
  //    이게 없으면 타겟에 typescript 없을 때 조용히 regex 폴백으로 떨어져 점수가 달라진다(배지 비교 불가).
  try {
    const req = createRequire(path.resolve(process.cwd(), "package.json"));
    return req("typescript");
  } catch {}
  return null;
}

// .js 도 JSX 를 품는다(CRA·Vite 의 .js 컴포넌트). TS 모드로 읽으면 JSX 가 깨진 문장이 돼
// 속성 안의 `.trim()` 이 "버린 반환값" 으로 잡혔다(kiss-translator Layout.js, 2026-10-09).
// JS 모드는 JSX 를 같이 파싱한다.
function scriptKindOf(ts, file) {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.(jsx|js|mjs|cjs)$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}





// 파일 I/O 밀도 — "한 번 처리하는 데 파일을 몇 번이나 읽게 되는 구조인가".
// cognitive·중복은 코드 모양만 보므로, 5줄짜리 흠 없는 리더가 루프에서 120번 불리는
// 종류는 원리상 못 잡는다(그래서 요청당 492회 읽던 코드가 A+ 100점을 통과했다).
// 여기선 리더 함수를 찾고, 그게 루프 안에서 불리는 자리를 센다. 리더가 캐시를 끼고
// 있으면 반복 호출돼도 실제 읽기는 한 번이라 감점하지 않고 참고로만 남긴다.
const FILE_READ_CALLS = new Set(["readFileSync", "readFile", "readdirSync"]);
// DB/HTTP 데이터 접근 — 루프 안에서 순차 await 하면 전형적 N+1(Sonar가 못 잡는 앱의 진짜 병목).
// 이름은 Array/Map/Promise 빌트인과 충돌하지 않는 것만(get/find/all/delete 제외 → 오탐 방지).
const DATA_CALLS = new Set([
  "query", "execute", "exec", "raw", "aggregate", "transaction",
  "findMany", "findFirst", "findUnique", "findOne", "createMany", "updateMany", "deleteMany", "upsert",
  "fetch", "request",
]);
const ITERATING_METHODS = new Set(["map", "forEach", "flatMap", "filter", "reduce", "some", "every", "find"]);
// O(n²) 분석만 정렬 비교 함수도 루프로 본다 — 비교 함수는 n log n 번 불리므로 그 안의 find 는 O(n² log n) 이다.
// 최근 머지된 성능 PR(sim #5330)이 "sort 비교 함수 안의 .find 가 최악" 이라며 Map 으로 바꿨는데 엔진은 못 봤다.
const QUAD_ITERATING_METHODS = new Set([...ITERATING_METHODS, "sort", "toSorted"]);
// [FP:io-name-collision] 빌트인 컬렉션/프로토타입 메서드 — 타입정보 없이 이름만으로는 유저함수와 구분 불가.
// x.push()/map.get()/set.has() 같은 메서드 호출을 동명의 최상위 함수(리더)로 오인하면
// 코드베이스 전역에서 거대한 오탐이 난다(예: Array.push → push 리더 → 루프 IO 834개).
const BUILTIN_METHODS = new Set([
  "push", "pop", "shift", "unshift", "splice", "slice", "concat", "join", "fill", "copyWithin",
  "map", "filter", "forEach", "reduce", "reduceRight", "some", "every", "find", "findIndex",
  "flat", "flatMap", "sort", "reverse", "indexOf", "lastIndexOf", "includes", "keys", "values", "entries",
  "get", "set", "has", "add", "delete", "clear",
  "then", "catch", "finally", "toString", "valueOf", "hasOwnProperty",
]);

function analyzeIoDensity(ts, fileContents) {
  const parsed = fileContents.map(({ file, content }) => ({
    file,
    sf: ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKindOf(ts, file),
    ),
  }));

  const isFnLike = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n);

  const nameOf = (sf, n) => {
    if (n.name) return n.name.getText(sf);
    const p = n.parent;
    if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
    return null;
  };

  const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // 1단계: 함수마다 "직접 파일을 읽는가 / 자기 캐시를 쓰는가 / 누구를 부르는가"를 모은다
  const fns = new Map(); // 이름 -> { file, line, readsDirectly, hasOwnCache, calls:Set }
  for (const { file, sf } of parsed) {
    const moduleHasMap = /new (Map|WeakMap)\s*[<(]/.test(sf.text);
    // 모듈 스코프 변수 이름 — "읽고 또 대입하는" 변수를 쓰면 그게 메모이제이션이다
    // (globalThis에 물린 캐시나 `let memo = null` 패턴. Map만 캐시로 보면 이런 걸 다 놓친다)
    const moduleVars = new Set();
    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) moduleVars.add(decl.name.getText(sf));
        }
      }
    }

    const collect = (node) => {
      if (isFnLike(node) && node.body) {
        let readsDirectly = false;
        let mapCacheOps = 0;
        const calls = new Set();
        const readVars = new Set();
        const writtenVars = new Set();
        const rootName = (expr) => {
          let cur = expr;
          while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) cur = cur.expression;
          return ts.isIdentifier(cur) ? cur.getText(sf) : null;
        };
        const scan = (n) => {
          if (n !== node && isFnLike(n)) return; // 중첩 함수는 자기 항목에서 본다
          if (ts.isCallExpression(n)) {
            const callee = n.expression;
            const called = ts.isPropertyAccessExpression(callee) ? callee.name.getText(sf) : callee.getText(sf);
            if (FILE_READ_CALLS.has(called)) readsDirectly = true;
            if (called === "get" || called === "set") mapCacheOps++;
            calls.add(called);
          }
          if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const target = rootName(n.left);
            if (target && moduleVars.has(target)) writtenVars.add(target);
          }
          if (ts.isIdentifier(n) && moduleVars.has(n.getText(sf))) readVars.add(n.getText(sf));
          ts.forEachChild(n, scan);
        };
        ts.forEachChild(node, scan);
        const memoizesByVar = [...writtenVars].some((v) => readVars.has(v));
        const name = nameOf(sf, node);
        // 파일 스코프 키: 전역 이름충돌(다른 파일의 동명 함수가 리더면 오염) 방지.
        const key = name ? `${file}::${name}` : null;
        if (key && !fns.has(key)) {
          fns.set(key, {
            name,
            file,
            line: lineOf(sf, node),
            readsDirectly,
            // 캐시로 보는 두 형태: 모듈 Map을 get/set 하거나, 모듈 변수를 읽고 다시 대입하거나
            hasOwnCache: (moduleHasMap && mapCacheOps >= 2) || memoizesByVar,
            calls,
          });
        }
      }
      ts.forEachChild(node, collect);
    };
    ts.forEachChild(sf, collect);
  }

  // 2단계: 호출 그래프로 "리더"를 전파한다 — getThemeComments → readJson → readFileSync 처럼
  //        직접 읽지 않고 한 다리 건너 읽는 함수가 실제 N+1의 주인공이라 이게 핵심이다.
  //        읽기 경로가 전부 캐시를 거치면 그 함수도 캐시된 리더로 본다(반복 호출돼도 읽기는 한 번).
  const readers = new Map(); // file::name -> { file, line, cached }
  for (const [key, fn] of fns) {
    if (fn.readsDirectly) readers.set(key, { file: fn.file, line: fn.line, cached: fn.hasOwnCache });
  }
  const MAX_HOPS = 2; // 얇은 래퍼(getThemeComments → readJson)까지만. 더 깊으면 전부 리더가 된다
  for (let pass = 0; pass < MAX_HOPS; pass++) {
    let changed = false;
    for (const [key, fn] of fns) {
      if (readers.has(key)) continue;
      // 호출명을 같은 파일 안에서만 리더로 해석 — 크로스파일 이름충돌 차단.
      const calledReaders = [...fn.calls]
        .filter((c) => !BUILTIN_METHODS.has(c))
        .map((c) => readers.get(`${fn.file}::${c}`))
        .filter(Boolean);
      if (calledReaders.length === 0) continue;
      readers.set(key, {
        file: fn.file,
        line: fn.line,
        cached: fn.hasOwnCache || calledReaders.every((r) => r.cached),
      });
      changed = true;
    }
    if (!changed) break;
  }

  // 3단계: 그 리더(또는 fs 읽기 자체)가 루프 안에서 불리는 자리를 찾는다.
  //        for/while뿐 아니라 map·forEach 같은 순회 콜백 안도 루프로 본다.
  const sites = [];
  for (const { file, sf } of parsed) {
    // 캐시를 직접 관리하는 함수 안에서의 읽기는 캐시 미스일 때만 나간다(2단 캐시의 디스크 티어 등)
    const walk = (node, inLoop, inCachingFn) => {
      let childInLoop = inLoop;
      let childInCachingFn = inCachingFn;
      if (isFnLike(node)) {
        const selfName = nameOf(sf, node);
        const self = selfName ? fns.get(`${file}::${selfName}`) : null;
        if (self && self.hasOwnCache) childInCachingFn = true;
      }
      switch (node.kind) {
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
          childInLoop = true;
          break;
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const isMethodCall = ts.isPropertyAccessExpression(callee);
        const called = isMethodCall ? callee.name.getText(sf) : callee.getText(sf);
        // 메서드 호출(x.NAME())이 빌트인 컬렉션 메서드명이면 동명 유저함수(리더)로 해석하지 않는다.
        // 리더 해석은 같은 파일 스코프에서만 — 크로스파일 이름충돌 차단.
        const reader = (isMethodCall && BUILTIN_METHODS.has(called)) ? undefined : readers.get(`${file}::${called}`);
        if (inLoop && (FILE_READ_CALLS.has(called) || reader)) {
          const cached = inCachingFn || (reader ? reader.cached : false);
          sites.push({ file, line: lineOf(sf, node), callee: called, cached });
        }
        // [FP:promise-all-batching] DB/HTTP N+1: 루프 안에서 '직접 await' 하는 데이터 호출. Promise.all(map) 배칭은
        // 개별 호출이 직접 await 되지 않으므로(부모가 await 아님) 자동 제외 = 올바른 패턴은 안 깎임.
        if (inLoop && DATA_CALLS.has(called) && node.parent && ts.isAwaitExpression(node.parent)) {
          sites.push({ file, line: lineOf(sf, node), callee: called, cached: false });
        }
        // 순회 메서드에 넘긴 콜백 본문은 루프 안으로 취급
        if (ts.isPropertyAccessExpression(callee) && ITERATING_METHODS.has(callee.name.getText(sf))) {
          for (const arg of node.arguments) {
            if (isFnLike(arg)) walk(arg, true, childInCachingFn);
          }
        }
      }
      ts.forEachChild(node, (child) => {
        const alreadyWalked =
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ITERATING_METHODS.has(node.expression.name.getText(sf)) &&
          isFnLike(child);
        if (!alreadyWalked) walk(child, childInLoop, childInCachingFn);
      });
    };
    ts.forEachChild(sf, (n) => walk(n, false, false));
  }

  const uncached = sites.filter((s) => !s.cached);
  const readerList = [...readers.entries()].map(([name, r]) => ({ name, ...r }));
  return {
    readers: readerList.length,
    uncachedReaders: readerList.filter((r) => !r.cached).length,
    loopSites: sites.length,
    uncachedLoopSites: uncached.length,
    worst: uncached.slice(0, 5).map(({ file, line, callee }) => ({ file, line, callee })),
  };
}

// 렌더 인질 — 데이터 하나를 기다리느라 그와 무관한 UI까지 통째로 못 그리는 자리.
// `{data && <Nav a={local} b={data.x} onChange={fn} />}` 처럼 프롭 대부분이 이미 아는
// 값인데 fetch 하나 때문에 전체가 대기하면, 사용자에겐 매번 로딩으로 보인다.
// 게이트에 걸린 요소가 그 데이터에 실제로 의존하는 비율로 판정한다.
const HOSTAGE_DEP_RATIO = 0.5; // 프롭 절반도 안 쓰면서 전체를 막고 있으면 인질

// O(n²) 배열 조회 — 루프 안에서 "루프 밖에 선언된 배열"에 선형 탐색(find/findIndex/some)을 돌리는 자리.
// 루프 n번 × 탐색 m번 = O(n·m). Map/Set을 한 번 만들어 쓰면 O(n+m)이 되는 기계적 개선이라
// 취향이 개입하지 않는다(복잡도·중복과 달리 정답이 하나) — 그래서 외부 기여(PR)로도 안전한 축.
// find/findIndex/some만 본다: 배열 전용 메서드라 문자열(str.includes) 오탐이 원천 차단된다.
const QUADRATIC_METHODS = new Set(["find", "findIndex", "some"]);
// filter는 "그룹핑" 형제 패턴 — 고치는 법이 다르다(Map<key, T> 가 아니라 Map<key, T[]>).
// 역시 배열 전용이라 문자열 오탐이 없다.
const QUADRATIC_GROUP_METHODS = new Set(["filter"]);
// 멤버십 조회 — 루프 안에서 배열을 훑는 가장 흔한 형태인데 오래 빠져 있었다.
// 그냥 넣으면 문자열 연산이 쏟아진다(`path.includes("/")`). 그래서 수신자가
// **배열이라는 증거**가 있을 때만 센다(아래 arrayVars). Set.has 는 O(1)이라 제외한다.
const QUADRATIC_MEMBERSHIP_METHODS = new Set(["includes", "indexOf", "lastIndexOf"]);

// O(n²) 사이트를 PR 가치순으로 가른다. 같은 O(n²)라도 프론트 UI 루프(n=메뉴·필터, 유계)와
// 백엔드 유저데이터 루프(n=요청·행, 무계)는 PR감이 천지차. zone(파일경로)이 지배적 신호다.
function quadZoneOf(file) {
  if (/\.(test|spec)\.|__tests__|\/tests?\/|\/e2e\/|\/fixtures?\/|\/migrations?\//.test(file)) return "test";
  // backend before frontend: e.g. medusa `api/admin/*.route.ts` is a REST route, not UI.
  // 모노레포 앱 이름도 본다: apps/admin-api, apps/backend, apps/flowiki-back 같은 경로는
  // 디렉터리 안에 다시 /api/가 없어서 예전에는 other로 빠졌다.
  if (/(^|\/)(api|server|backend|back|[^/]+-api|[^/]+-back|services?|routes?|controllers?|use-?cases?|repositor\w*|workflows?|queues?|handlers?|resolvers?|jobs?|tasks?)(\/|$)/.test(file))
    return "backend";
  // frontend is signalled by the JSX extension or explicit component/client dirs — not a bare `/admin/`.
  if (/\.(tsx|jsx)$|\/components?\/|\/dashboard\/|\/client\/|\/ui\//.test(file)) return "frontend";
  return "other";
}
// 루프 반복대상이 배열 리터럴이면 유계(바운드), 식별자·프로퍼티·호출이면 유저데이터일 개연 → dynamic.
function quadOuterDynamic(text) {
  if (!text) return true; // 알 수 없으면 후보 쪽으로(보수적)
  // [...rows] 는 복사본이지 리터럴이 아니다 — 정렬 전 복사(`[...rows].sort(…)`)가 흔하다.
  if (/^\[\s*\.\.\.[\w$.]+\s*\]$/.test(text)) return true;
  if (/^\[/.test(text)) return false; // [a,b,c] 리터럴
  return true;
}

/**
 * 후보 컷 게이트 — "이론상 O(n²)"와 "고칠 가치"는 다르다.
 *
 * 실측(저장소 83곳): 원시 후보 1,680개 중 실제로 제출할 만한 건 2개였다.
 * 탈락 사유가 세 가지로 수렴해서 그걸 자동 판정한다. 컷된 것도 목록엔 남기고
 * 사유를 붙인다 — 조용히 숨기면 도구를 믿을 수 없다.
 */

// ① 바깥 루프가 상수 목록이면 O(n²)가 아니다.
//    SEARCHABLES(4개) × content = O(4n) = O(n). 고쳐도 상수배(실측 1.1~1.2배)만 준다.
const CONSTish = /^[A-Z][A-Z0-9_]{2,}$/; // ALL_CAPS 식별자
function quadConstOuter(text, moduleConsts) {
  if (!text) return false;
  // [FP:quad-object-values-enum] `Object.values(IntegrityReport)` 는 enum·상수 객체의 고정 목록이다.
  // 루트가 `Object` 라 예전엔 데이터로 봤다 — immich integrity.repository 가 이 모양이었다(2026-10-11).
  const ov = /^Object\.(?:values|keys|entries)\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(text.trim());
  if (ov) return /^[A-Z]/.test(ov[1]) || moduleConsts.has(ov[1]);
  const root = text.split(/[.[(]/)[0].trim();
  if (!root) return false;
  if (CONSTish.test(root)) return true;
  return moduleConsts.has(root);
}

// ② 루프 본문이 I/O 를 기다리면 CPU 조회 비용은 반올림 오차다.
//    cypress screenshot 건: 매칭 직후 파일마다 fs.stat + 업로드 — 그쪽이 압도한다.
const QUAD_IO_HINT =
  /\b(prisma|knex|repository|repo|dataSource|entityManager|redis|cache|s3|storage|axios|fetch|http|client|api|sdk|queue|stripe|supabase|clickhouse|mongo)\b|\b(readFile|readdir|stat|writeFile)\b/i;
// 안쪽 배열이 바깥 루프와 **같이 자라는가**. O(n·m) 은 둘 다 자랄 때만 이차식이다 —
// pnpm 실측: 락파일 수천 개를 패치된 의존성 1~5개와 맞대는 자리는 사실상 선형이었다.
// 같이 자란다고 보는 신호 두 개:
//   (a) 누적기 — 루프 안에서 수신자에 push/add/unshift/set 하거나 재대입한다
//   (b) 같은 컬렉션 — 수신자가 바로 그 루프의 반복 대상이다
function quadCoGrows(ts, loopNode, sf, root, outerText) {
  if (outerText && String(outerText).trim() === root) return true;
  if (!loopNode) return false;
  const GROWERS = new Set(["push", "add", "unshift", "set", "concat"]);
  let found = false;
  const g = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
        GROWERS.has(n.expression.name.getText(sf))) {
      let c = n.expression.expression;
      while (ts.isPropertyAccessExpression(c)) c = c.expression;
      if (ts.isIdentifier(c) && c.getText(sf) === root) { found = true; return; }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left) && n.left.getText(sf) === root) { found = true; return; }
    ts.forEachChild(n, g);
  };
  ts.forEachChild(loopNode, g);
  return found;
}

function quadIoInLoop(ts, loopNode, sf) {
  if (!loopNode) return false;
  let found = false;
  const g = (n) => {
    if (found) return;
    if (ts.isAwaitExpression(n)) {
      const t = n.expression.getText(sf).slice(0, 120);
      if (QUAD_IO_HINT.test(t)) { found = true; return; }
    }
    ts.forEachChild(n, g);
  };
  ts.forEachChild(loopNode, g);
  return found;
}

// ③ n 에 상한 상수가 박혀 있으면 규모가 안 큰다.
//    dub BATCH_SIZE=100, trigger MAX_BATCH_V2_TRIGGER_ITEMS=500, next.js 라우트매처 4개.
const QUAD_CAP_HINT =
  /\b(BATCH_SIZE|MAX_[A-Z0-9_]+|[A-Z0-9_]+_LIMIT|PAGE_SIZE|PER_PAGE)\b|\.slice\(\s*0\s*,\s*\d{1,3}\s*\)|\b(take|limit)\s*:\s*\d{1,3}\b/;
function quadCappedN(fnText) {
  return !!fnText && QUAD_CAP_HINT.test(fnText);
}
const QUAD_ZONE_RANK = { backend: 3, other: 2, frontend: 1, test: 0 };

function analyzeQuadraticLookups(ts, fileContents) {
  const sites = [];
  for (const { file, content } of fileContents) {
    const kind = scriptKindOf(ts, file);
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    // 모듈 최상단의 const 배열/enum — 바깥 루프가 이걸 돌면 크기가 고정이다.
    const moduleConsts = new Set();
    for (const st of sf.statements) {
      if (ts.isEnumDeclaration(st) && st.name) { moduleConsts.add(st.name.getText(sf)); continue; }
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const init = d.initializer;
        // 모듈 최상단 const 는 프로세스 수명 동안 고정이다. 리터럴뿐 아니라 배열을 만드는
        // 호출로 파생된 것도 마찬가지다 — svelte 의 `const abstract_roles =
        // aria_roles.filter(...)` 는 ARIA 명세 테이블에서 한 번 만들어지는 고정 목록인데,
        // 리터럴만 보던 때는 이걸 데이터로 착각해 O(n²)로 잡았다.
        const ARRAY_FROM_CALL = new Set(["map", "filter", "flatMap", "slice", "concat",
          "split", "from", "keys", "values", "entries", "sort", "reverse", "flat", "of"]);
        const arrayish = (e) =>
          ts.isArrayLiteralExpression(e) ||
          (ts.isAsExpression(e) && arrayish(e.expression)) ||
          (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) &&
            ARRAY_FROM_CALL.has(e.expression.name.getText(sf)));
        if (arrayish(init)) moduleConsts.add(d.name.getText(sf));
      }
    }
    // 배열이라는 증거가 있는 이름만 모은다. 멤버십 조회(includes/indexOf)는 문자열에도
    // 같은 이름이 있어서, 증거 없이 세면 `url.includes("/")` 같은 것이 전부 잡힌다.
    // 증거: 배열 리터럴 초기화 · 배열을 만드는 호출 · T[] / Array<T> 타입 주석.
    const ARRAY_MAKERS = new Set(["map", "filter", "flatMap", "slice", "concat", "split",
      "from", "keys", "values", "entries", "sort", "reverse", "flat"]);
    const arrayVars = new Set();
    const smallLiteralVars = new Set();
    {
      const looksArray = (init, type) => {
        if (type && (ts.isArrayTypeNode(type) ||
            (ts.isTypeReferenceNode(type) && type.typeName.getText(sf) === "Array"))) return true;
        if (!init) return false;
        if (ts.isArrayLiteralExpression(init)) return true;
        if (ts.isAsExpression(init)) return looksArray(init.expression, init.type);
        if (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression))
          return ARRAY_MAKERS.has(init.expression.name.getText(sf));
        return false;
      };
      // [FP:quad-string-slice-name] `slice`·`concat` 은 문자열에도 있다. webpack syntax-parser 의
      // `const text = store.input.slice(…)` 하나 때문에 파일 전체의 `text.indexOf("*/", i)` 가 배열 스캔으로
      // 잡혔다(2026-10-11). 이 둘만으로 얻은 증거는, 같은 파일에 같은 이름의 배열 아닌 선언이 있으면 버린다.
      const AMBIGUOUS_MAKERS = new Set(["slice", "concat"]);
      const weakOnly = new Set();
      const strong = new Set();
      const nonArray = new Set();
      const walkDecl = (n) => {
        if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer &&
            !looksArray(n.initializer, n.type)) nonArray.add(n.name.getText(sf));
        if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isPropertyDeclaration(n)) &&
            n.name && ts.isIdentifier(n.name) && looksArray(n.initializer, n.type)) {
          const nm = n.name.getText(sf);
          const ini = n.initializer;
          const weak = !n.type && ini && ts.isCallExpression(ini) && ts.isPropertyAccessExpression(ini.expression) &&
            AMBIGUOUS_MAKERS.has(ini.expression.name.getText(sf));
          (weak ? weakOnly : strong).add(nm);
          arrayVars.add(nm);
          // 함수 안에서 선언된 작은 고정 목록도 사실상 상수다 — 스코프가 아니라 크기로 본다.
          // `const listTypes = ["a","b","c"]` 를 루프에서 훑는 건 O(n x 3) = O(n) 이다.
          // 모듈 상수만 걸러서는 이걸 못 잡는다(실측: outline·ghost 의 멤버십 후보에 섞여 있었다).
          const init = n.initializer;
          if (init && ts.isArrayLiteralExpression(init) &&
              // 빈 리터럴은 제외한다 — `const seen = []` 뒤에 push 로 자라는 누적기이지
              // 고정 목록이 아니다. 크기 0 을 "작다"로 보면 진짜 O(n²)를 지운다.
              init.elements.length >= 1 && init.elements.length <= 12 &&
              !init.elements.some((e) => ts.isSpreadElement(e))) {
            smallLiteralVars.add(nm);
          }
        }
        ts.forEachChild(n, walkDecl);
      };
      ts.forEachChild(sf, walkDecl);
      for (const nm of weakOnly) if (!strong.has(nm) && nonArray.has(nm)) arrayVars.delete(nm);
    }

    const isFnLike = (n) =>
      ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
    const isLoopNode = (n) =>
      n.kind === ts.SyntaxKind.ForStatement || n.kind === ts.SyntaxKind.ForInStatement ||
      n.kind === ts.SyntaxKind.ForOfStatement || n.kind === ts.SyntaxKind.WhileStatement ||
      n.kind === ts.SyntaxKind.DoStatement;

    // 서브트리 안에서 선언된 이름 — 루프 안에서 만들어진 배열은 매 회 새로 만들어지므로 제외(오탐 방지)
    const declaredIn = (node) => {
      const names = new Set();
      const addBinding = (name) => {
        if (!name) return;
        if (ts.isIdentifier(name)) { names.add(name.getText(sf)); return; }
        // 구조분해도 지역 선언이다 — const { items } = row / const [a] = pair
        if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
          for (const el of name.elements) if (ts.isBindingElement(el)) addBinding(el.name);
        }
      };
      const g = (n) => {
        if (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) addBinding(n.name);
        ts.forEachChild(n, g);
      };
      ts.forEachChild(node, g);
      return names;
    };

    const loopIterableText = (n) => {
      if ((n.kind === ts.SyntaxKind.ForOfStatement || n.kind === ts.SyntaxKind.ForInStatement) && n.expression)
        return n.expression.getText(sf).replace(/\s+/g, " ").slice(0, 60);
      return null; // for(;;)/while: 반복대상 미상
    };

    const walk = (node, inLoop, locals, outerText, loopNode, fnNode) => {
      let childInLoop = inLoop;
      let childLocals = locals;
      let childOuter = outerText;
      let childLoop = loopNode;
      let childFn = isFnLike(node) ? node : fnNode;
      if (isLoopNode(node)) {
        childInLoop = true;
        childLocals = new Set([...locals, ...declaredIn(node)]);
        childOuter = loopIterableText(node) ?? outerText;
        childLoop = node;
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.getText(sf);
        const recvNode = node.expression.expression;
        // 수신자는 식별자뿐 아니라 프로퍼티 경로도 본다 — this.items / state.list 가
        // NestJS·클래스 코드의 지배적 형태인데 예전엔 통째로 놓치고 있었다.
        // 지역성은 경로의 '루트 식별자'로 판정한다(this는 지역이 아니므로 항상 통과).
        const recvRoot = (e) => {
          let c = e;
          while (ts.isPropertyAccessExpression(c)) c = c.expression;
          if (ts.isIdentifier(c)) return c.getText(sf);
          return c.kind === ts.SyntaxKind.ThisKeyword ? "this" : null;
        };
        const recvIsPath = ts.isIdentifier(recvNode) || ts.isPropertyAccessExpression(recvNode);
        const root = recvIsPath ? recvRoot(recvNode) : null;
        // 멤버십 조회는 수신자가 배열이라는 증거가 있을 때만. this.x·a.b 경로는 증거를
        // 못 잡으므로 보수적으로 제외한다 — 과소 보고가 오탐보다 낫다.
        const isMembership = QUADRATIC_MEMBERSHIP_METHODS.has(method) &&
          ts.isIdentifier(recvNode) && arrayVars.has(recvNode.getText(sf));
        if (inLoop && recvIsPath && root &&
            (QUADRATIC_METHODS.has(method) || QUADRATIC_GROUP_METHODS.has(method) || isMembership)) {
          const recv = recvNode.getText(sf);
          // 수신자가 배열이 아니면 배열 스캔이 아니다. 배열 메서드는 첫 인자가 항상 함수인데,
          // 같은 이름의 속성 호출은 값을 넘긴다 — nuxt `options.filter(template)` 은 사용자가
          // 넘긴 술어 함수고, typescript 저장소의 `ts.filter(...)` 는 네임스페이스 유틸이다.
          // 채점축이 된 뒤로는 이런 오탐 하나가 등급을 움직이므로 여기서 끊는다.
          const arg0 = node.arguments[0];
          // 멤버십 조회는 값을 넘기므로 이 가드를 적용하면 안 된다 — 대신 배열 증거로 걸렀다.
          const argIsFn = isMembership ||
            (!!arg0 && (ts.isArrowFunction(arg0) || ts.isFunctionExpression(arg0)));
          if (!locals.has(root) && argIsFn) {
            const zone = quadZoneOf(file);
            const dynamicOuter = quadOuterDynamic(outerText);
            // 게이트 — 왜 이 후보가 실이득이 없는지 사유를 붙인다.
            const cuts = [];
            if (quadConstOuter(outerText, moduleConsts)) cuts.push("const-outer");
            // 안쪽(수신자)이 모듈 상수면 O(n × 상수) = O(n) 이다. 게이트가 바깥만 보고 있어서
            // INTERCEPTION_ROUTE_MARKERS 같은 상수 목록 조회가 이차식으로 잡히고 있었다.
            if (CONSTish.test(root) || moduleConsts.has(root) || smallLiteralVars.has(root))
              cuts.push("const-inner");
            if (quadIoInLoop(ts, loopNode, sf)) cuts.push("io-in-loop");
            if (quadCappedN(fnNode ? fnNode.getText(sf) : "")) cuts.push("capped-n");
            // [FP:throw-path-runs-once] 스캔이 throw 로 끝나는 블록 안이면 실패할 때 한 번 돈다 —
            // 루프 반복마다가 아니다. jest ensureNoDuplicateConfigs 가 오류 메시지에 indexOf 를 썼다.
            let throwPath = false;
            for (let p = node.parent; p && p !== loopNode; p = p.parent)
              if (ts.isBlock(p) && p.statements.some(ts.isThrowStatement)) { throwPath = true; break; }
            if (throwPath) cuts.push("throw-path");
            const coGrows = !throwPath && quadCoGrows(ts, loopNode, sf, root, outerText);
            sites.push({
              coGrows,
              file, line: lineOf(node), recv, method,
              kind: QUADRATIC_GROUP_METHODS.has(method) ? "group" : "lookup",
              zone, outer: outerText || null, dynamicOuter,
              cuts: cuts.length ? cuts : null,
              // PR 우선순위: 백엔드 + 무계 반복이 최상, 게이트에 걸린 건 최하로 민다.
              rank: (QUAD_ZONE_RANK[zone] ?? 2) * 2 + (dynamicOuter ? 1 : 0)
                + (coGrows ? 3 : 0) - cuts.length * 4,
            });
          }
        }
        // 순회 메서드(map/forEach…)에 넘긴 콜백 본문도 루프로 취급 — 반복대상은 수신자
        if (QUAD_ITERATING_METHODS.has(method)) {
          const iterText = ts.isPropertyAccessExpression(node.expression)
            ? node.expression.expression.getText(sf).replace(/\s+/g, " ").slice(0, 60)
            : outerText;
          for (const arg of node.arguments) {
            if (isFnLike(arg)) walk(arg, true, new Set([...childLocals, ...declaredIn(arg)]), iterText);
          }
        }
      }

      ts.forEachChild(node, (child) => {
        const alreadyWalked =
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          QUAD_ITERATING_METHODS.has(node.expression.name.getText(sf)) &&
          isFnLike(child);
        if (alreadyWalked) return;
        // [FP:quad-loop-header-once] for-of/for-in 의 반복 대상 식과 for 초기화식은 루프 진입 때 한 번 평가된다.
        // elysia `for (const t of types.some(…) ? ALL : types)` 를 루프 안 스캔으로 셌다(2026-10-11).
        const once = (node.kind === ts.SyntaxKind.ForOfStatement || node.kind === ts.SyntaxKind.ForInStatement)
          ? child === node.expression
          : node.kind === ts.SyntaxKind.ForStatement && child === node.initializer;
        if (once) walk(child, inLoop, locals, outerText, loopNode, childFn);
        else walk(child, childInLoop, childLocals, childOuter, childLoop, childFn);
      });
    };
    ts.forEachChild(sf, (n) => walk(n, false, new Set(), null, null, null));
  }

  const byFile = new Map();
  for (const s of sites) byFile.set(s.file, (byFile.get(s.file) || 0) + 1);
  // PR 후보 = 백엔드/기타 + 무계 반복 + 테스트 아님. 이게 실제 손검증 대상 좁히기.
  const preGate = sites.filter((s) => s.zone !== "test" && s.zone !== "frontend" && s.dynamicOuter);
  const candidates = preGate.filter((s) => !s.cuts);
  // 왜 걸렀는지 사유별 집계 — 도구가 조용히 숨기면 신뢰할 수 없다.
  const cutBy = {};
  for (const s of preGate) for (const c of s.cuts || []) cutBy[c] = (cutBy[c] || 0) + 1;
  const ranked = [...sites].sort((a, b) => b.rank - a.rank);
  const zoneCount = sites.reduce((m, s) => ((m[s.zone] = (m[s.zone] || 0) + 1), m), {});
  return {
    sites: sites.length,
    candidates: candidates.length,     // PR 손검증 우선 대상 수
    preGateCandidates: preGate.length, // 게이트 적용 전 후보 수
    cutBy,                             // {const-outer, io-in-loop, capped-n} 사유별 컷 수
    zones: zoneCount,                  // {backend, frontend, test, other}
    worst: ranked.slice(0, 12),        // PR 가치순 상위 (기존 slice(0,8) 무순 → 랭킹)
    // 채굴용 전체 후보 목록(백엔드/기타·무계 반복·테스트 아님) — --mine 로 덤프. 손검증 파이프라인 입력.
    candidateList: candidates
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 500)
      .map((s) => ({ file: s.file, line: s.line, recv: s.recv, method: s.method, zone: s.zone, outer: s.outer, coGrows: s.coGrows })),
    files: [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([file, n]) => ({ file, n })),
  };
}

/**
 * N+1 — 루프 안에서 순차로 도는 DB/HTTP 조회.
 *
 * analyzeIoDensity 는 파일 읽기(readFileSync 계열)를 보고, 이건 데이터 접근을 본다.
 * 구조 지표(복잡도·중복·길이)와 상관이 낮아(표본 12곳 r=0.19) 새 정보를 준다 —
 * 실측에서 S 등급 저장소가 밀도 최고인 경우가 나왔다. 그래서 점수에 넣는다.
 *
 * 채점에 쓰는 건 **확신 높은 부분만**이다:
 *  - 읽기 계열만. 쓰기(create/update)를 묶는 건 반환값·트랜잭션 의미가 달라져 위험하다
 *  - 의도적 순차(커서 페이지네이션·폴링·청크·재시도)는 제외 — 순차가 정답인 코드다
 *  - Promise 조합자 안의 await 제외 — 이미 동시 실행이다
 */
const NPLUS_IO_RECV =
  /^(prisma|db|database|tx|trx|knex|repo|repository|em|entityManager|dataSource|redis|cache|kv|s3|storage|bucket|http|axios|client|api|sdk|queue|stripe|supabase|clickhouse|mongo|collection)$/i;
const NPLUS_READ =
  /^(find|findOne|findFirst|findMany|findUnique|findUniqueOrThrow|findOneOrFail|findByIds?|get|getMany|query|count|aggregate|fetch|request|list)$/;
// 순차가 의도인 반복 — 고치면 안 되는 것들.
const NPLUS_INTENT =
  /^(cursor|.*Depth|i\s*<|.*TIMEOUT|.*timeout|Date\.now|chunks?|batches?|retries|attempt|page|hasMore|true)/i;

function analyzeNPlusOne(ts, fileContents) {
  const sites = [];

  const inCombinator = (node) => {
    let cur = node.parent;
    while (cur) {
      if (
        ts.isCallExpression(cur) &&
        ts.isPropertyAccessExpression(cur.expression) &&
        /^(all|allSettled|any|race)$/.test(cur.expression.name.getText()) &&
        cur.expression.expression.getText() === "Promise"
      ) return true;
      cur = cur.parent;
    }
    return false;
  };

  const LOOPS = new Set([
    ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.WhileStatement, ts.SyntaxKind.DoStatement,
  ]);

  for (const { file, content } of fileContents) {
    if (!content.includes("await")) continue;
    const sf = ts.createSourceFile(
      file, content, ts.ScriptTarget.Latest, true,
      scriptKindOf(ts, file),
    );

    const loopLabel = (n) => {
      // 가드 [FP:retry-loop-no-condition]: `for (let attempt = 0; ; attempt++)` 는 조건이 없어 라벨이 비었다 —
      // 초기화식의 변수 이름으로 의도를 읽는다(vscode codexProviderConfiguration, 2026-10-11).
      const e = ts.isForOfStatement(n) || ts.isForInStatement(n) ? n.expression
        : ts.isForStatement(n) ? (n.condition || n.initializer) : n.expression;
      return (e ? e.getText(sf) : "").replace(/^(let|const|var)\s+/, "").replace(/\s+/g, " ").slice(0, 60);
    };

    const visit = (node) => {
      if (LOOPS.has(node.kind) && node.statement) {
        const label = loopLabel(node);
        // 가드 [FP:intentional-sequential-loop]: 루프 라벨이 `chunks`·`batches`·`retries`·`page`
        // 같은 모양이면 통째로 건너뛴다 — 청크·재시도·페이지네이션은 메모리나 레이트리밋
        // 때문에 일부러 줄 세운 것이라 Promise.all 로 펴면 의미가 바뀐다.
        if (!NPLUS_INTENT.test(label.trim())) {
          const scan = (n) => {
            // 중첩 함수 경계는 넘지 않는다 — 콜백은 동시성 판단이 다르다.
            if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
                ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) return;
            if (ts.isAwaitExpression(n) && !inCombinator(n)) {
              const call = n.expression;
              if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)) {
                const method = call.expression.name.getText(sf);
                if (NPLUS_READ.test(method)) {
                  let root = call.expression.expression;
                  while (ts.isPropertyAccessExpression(root) || ts.isCallExpression(root)) root = root.expression;
                  const rootName = ts.isIdentifier(root) ? root.getText(sf) : "";
                  const chainTail = (call.expression.expression.getText(sf).split(".").pop() || "");
                  if (NPLUS_IO_RECV.test(rootName) ||
                      /(repository|repo|service|store|client|prisma|db|dao|manager)$/i.test(chainTail)) {
                    sites.push({
                      file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                      recv: call.expression.expression.getText(sf).slice(0, 50),
                      method, loop: label,
                    });
                  }
                }
              }
            }
            ts.forEachChild(n, scan);
          };
          ts.forEachChild(node.statement, scan);
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }

  const seen = new Set();
  const unique = sites.filter((s) => {
    const k = `${s.file}:${s.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const perThousand = fileContents.length
    ? Math.round((unique.length / fileContents.length) * 1000 * 100) / 100
    : 0;

  return { sites: unique.length, perThousand, worst: unique.slice(0, 5) };
}

/**
 * 독립 순차 await — 서로 참조하지 않는데 줄줄이 기다리는 I/O.
 *
 * O(n²)·N+1 과 다른 축이다. 저 둘은 n 이 작으면 이득이 사라지지만(Map 구축 고정비,
 * 배치 상한), 이건 독립 호출 2개만 있어도 레이턴시가 합에서 최댓값으로 바뀐다.
 * 즉 작은 n 에서도 이득이 유지되고, 증거가 "왕복 N회 → 1회"라 측정 논쟁이 없다.
 *
 * 같은 블록에서 연속으로 오는 `const x = await f()` 중 뒤엣것이 앞엣것의 바인딩을
 * 참조하지 않는 구간을 찾는다. 의존이 있으면 구간을 끊고, Promise 조합자 안의 것은
 * 이미 동시 실행이라 제외한다.
 */
/**
 * 결합도 — 저장소 안 모듈 사이의 순환 의존.
 *
 * 다른 축이 전부 "읽기 어려운가"를 잰다. 그런데 고치는 비용은
 * (이해 난이도) x (몇 군데를 같이 고쳐야 하나)다. 순환에 묶인 모듈은
 * 따로 읽을 수도, 따로 테스트할 수도, 따로 교체할 수도 없다 — 한 덩어리다.
 *
 * 재는 것은 **소스 수준** 결합이다. 방출된 번들의 순환이 아니다. tsc 는 타입
 * 위치에서만 쓰인 import 를 기본으로 지우므로(실측: 그런 파일의 방출 결과에
 * import 문이 아예 없다), 여기 세는 간선 일부는 tsc 산출물엔 없다. 그래도
 * 세는 이유는 이 축이 재는 게 "사람이 이 모듈을 따로 읽고 따로 테스트할 수
 * 있는가"이기 때문이다 — 소스에 import 가 적혀 있으면 읽는 사람에겐 의존이다.
 * (esbuild·swc 처럼 파일 하나씩 변환하는 도구에선 실제로 런타임 간선이 된다.)
 *
 * `import type` 만 뺀다. 그건 저자가 "이건 타입 의존일 뿐"이라고 명시한
 * 경우라 결합의 성격이 다르다. 37개 실측에서 전체 순환의 37%가 여기 해당했다.
 *
 * 상대 경로만 해석한다. 패키지 import 는 저장소 밖이라 우리 결합도가 아니고,
 * tsconfig 별칭은 설정을 읽어야 해서 여기선 놓친다(그만큼 과소 보고다).
 *
 * 진단 전용 — 점수 미반영. 35곳 실측에서 기존 점수와 rho=-0.24 로 대체로
 * 독립이지만, 가장 많이 발동하는 앱 8곳 안에서는 rho=-0.67 로 절반쯤 겹친다.
 * 표본이 얇아(앱 n=8, 코퍼스 70개 중 35개) 채점축 승격은 보류한다.
 */
function analyzeCoupling(ts, fileContents) {
  const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const known = new Set(fileContents.map((f) => f.file));
  const resolveSpec = (from, spec) => {
    if (!spec.startsWith(".")) return null;
    const base = path.normalize(path.join(path.dirname(from), spec));
    if (known.has(base)) return base;
    for (const e of EXT) if (known.has(base + e)) return base + e;
    // ESM 관습: .js 로 적고 실제로는 .ts 를 가리킨다
    const noExt = base.replace(/\.[cm]?js$/, "");
    for (const e of EXT) if (known.has(noExt + e)) return noExt + e;
    for (const e of EXT) if (known.has(path.join(base, "index" + e))) return path.join(base, "index" + e);
    return null;
  };

  const adj = new Map(fileContents.map((f) => [f.file, new Set()]));
  for (const { file, content } of fileContents) {
    let sf;
    try {
      sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
        scriptKindOf(ts, file));
    } catch { continue; }
    const add = (spec) => {
      const t = resolveSpec(file, spec);
      if (t && t !== file) adj.get(file).add(t);
    };
    const visit = (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const c = n.importClause;
        let typeOnly = !!c && c.isTypeOnly;
        // `import { type A, type B } from` — 항목이 전부 type 이면 런타임 간선이 아니다
        if (c && !typeOnly && !c.name && c.namedBindings && ts.isNamedImports(c.namedBindings))
          typeOnly = c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly);
        if (!typeOnly) add(n.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        if (!n.isTypeOnly) add(n.moduleSpecifier.text);
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword &&
                 n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
        add(n.arguments[0].text);
      }
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
  }

  // Tarjan SCC. 재귀로 쓰면 깊은 그래프(typescript 는 231개 모듈 순환)에서 스택이 넘는다.
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
  const comps = [];
  let counter = 0;
  for (const root of known) {
    if (index.has(root)) continue;
    const work = [[root, 0]];
    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame[0];
      if (frame[1] === 0) {
        index.set(v, counter); low.set(v, counter); counter++;
        stack.push(v); onStack.add(v);
      }
      const outs = [...adj.get(v)];
      if (frame[1] < outs.length) {
        const w = outs[frame[1]++];
        if (!index.has(w)) work.push([w, 0]);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      } else {
        if (low.get(v) === index.get(v)) {
          const comp = [];
          let w;
          do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
          if (comp.length > 1) comps.push(comp);
        }
        work.pop();
        if (work.length) {
          const u = work[work.length - 1][0];
          low.set(u, Math.min(low.get(u), low.get(v)));
        }
      }
    }
  }

  comps.sort((a, b) => b.length - a.length);
  const filesInCycle = comps.reduce((n, c) => n + c.length, 0);
  return {
    cycles: comps.length,
    filesInCycle,
    percent: fileContents.length ? Math.round((filesInCycle / fileContents.length) * 1000) / 10 : 0,
    largest: comps.length ? comps[0].length : 0,
    worst: comps.slice(0, 3).map((c) => ({ size: c.length, sample: c.slice(0, 3) })),
  };
}

function analyzeSerialAwaits(ts, fileContents) {
  // 순수 계산 await 을 묶어봐야 이득이 없다 — I/O 로 보이는 호출만 센다.
  //
  // 예전엔 호출문 전체(인자 포함)를 부분문자열로 훑어서 오탐이 났다. next.js 에서
  // `metadataBase` 안의 "dataBase" 가 database 로, `ctx` 안의 "tx" 가 트랜잭션으로
  // 잡혔다. 둘 다 순수 계산이라 Promise.all 이득이 0인데 채점축을 움직이고 있었다.
  //
  // 이제 **콜리만** 보고, 식별자를 단어로 쪼갠 뒤(카멜케이스·점·언더바) 그 단어와
  // 맞춘다. `prisma.user.findMany` → [prisma,user,find,many] 는 잡히고,
  // `resolveUrlValuesOfObject` → [resolve,url,values,of,object] 는 안 잡힌다.
  const IO_WORDS = new Set([
    "prisma", "db", "database", "tx", "trx", "knex", "repo", "repository",
    "entitymanager", "datasource", "redis", "cache", "kv", "s3", "storage", "bucket",
    "http", "axios", "client", "api", "sdk", "queue", "stripe", "supabase",
    "clickhouse", "mongo", "collection", "service", "fetch", "query", "find",
    "get", "load", "list", "count", "aggregate", "read", "insert", "update",
    "upsert", "delete", "save", "exec", "request", "send",
  ]);
  /** 식별자 경로를 단어로 쪼갠다: `ctx.db.findMany` → [ctx, db, find, many] */
  const wordsOf = (text) =>
    text.split(/[^A-Za-z0-9]+/).flatMap((part) =>
      part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/\s+/)
    ).filter(Boolean).map((w) => w.toLowerCase());
  const looksIO = (calleeText) => wordsOf(calleeText).some((w) => IO_WORDS.has(w));

  const sites = [];

  const namesOf = (ts_, decl) => {
    const out = new Set();
    const collect = (name) => {
      if (ts_.isIdentifier(name)) out.add(name.getText());
      else if (ts_.isObjectBindingPattern(name) || ts_.isArrayBindingPattern(name)) {
        for (const el of name.elements) if (ts_.isBindingElement(el)) collect(el.name);
      }
    };
    collect(decl.name);
    return out;
  };

  const refsOf = (node) => {
    const out = new Set();
    const walk = (n) => { if (ts.isIdentifier(n)) out.add(n.getText()); n.forEachChild(walk); };
    walk(node);
    return out;
  };

  const inCombinator = (node) => {
    let cur = node.parent;
    while (cur) {
      if (
        ts.isCallExpression(cur) &&
        ts.isPropertyAccessExpression(cur.expression) &&
        /^(all|allSettled|any|race)$/.test(cur.expression.name.getText()) &&
        cur.expression.expression.getText() === "Promise"
      ) return true;
      cur = cur.parent;
    }
    return false;
  };

  for (const { file, content } of fileContents) {
    if (!content.includes("await")) continue;
    const sf = ts.createSourceFile(
      file, content, ts.ScriptTarget.Latest, true,
      scriptKindOf(ts, file),
    );

    const scan = (statements) => {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          // 인자가 아니라 콜리만 본다 — 인자에 우연히 든 단어로 잡히면 안 된다.
          const io = run.filter((r) => looksIO(r.call.expression.getText(sf)));
          // 가드 [FP:serial-in-transaction]: 인자에 `transaction`·`lock` 옵션을 넘기면 한 커넥션을 공유한다 —
          // Promise.all 로 펴도 줄 서서 돈다. outline subscriptions.ts 가 주석으로 그렇게 밝혔다(2026-10-11).
          const txOpt = run.some((r) => r.call.arguments.some((a) => ts.isObjectLiteralExpression(a) &&
            a.properties.some((p) => p.name && /^(transaction|lock)$/.test(p.name.getText(sf)))));
          if (io.length >= 2 && !txOpt) {
            sites.push({
              file,
              line: sf.getLineAndCharacterOfPosition(run[0].stmt.getStart(sf)).line + 1,
              count: run.length,
              calls: run.map((r) => r.call.getText(sf).replace(/\s+/g, " ").slice(0, 60)),
            });
          }
        }
        run = [];
      };

      for (const stmt of statements) {
        if (!ts.isVariableStatement(stmt) || stmt.declarationList.declarations.length !== 1) { flush(); continue; }
        const decl = stmt.declarationList.declarations[0];
        if (!decl.initializer || !ts.isAwaitExpression(decl.initializer)) { flush(); continue; }
        const call = decl.initializer.expression;
        if (!ts.isCallExpression(call) || inCombinator(call)) { flush(); continue; }

        const refs = refsOf(call);
        if (run.some((prev) => [...prev.names].some((n) => refs.has(n)))) flush();
        run.push({ names: namesOf(ts, decl), call, stmt });
      }
      flush();
    };

    const visit = (n) => {
      if (ts.isBlock(n) || ts.isSourceFile(n)) scan(n.statements);
      n.forEachChild(visit);
    };
    visit(sf);
  }

  sites.sort((a, b) => b.count - a.count);
  return {
    sites: sites.length,
    awaits: sites.reduce((s, x) => s + x.count, 0),
    worst: sites.slice(0, 5),
  };
}

// 교과서 결함 3종 — 정답이 하나뿐이라 외부 기여(PR)로도 안전한 축.
//  ① await in .forEach(): forEach는 콜백의 프라미스를 무시한다 → 기다리지 않는 "진짜 버그".
//  ② 스프레드 누적: 루프/reduce에서 acc = [...acc, x] → 매 회 전체 복사 = O(n²).
//  ③ 루프 안 new RegExp(): 매 회 정규식 재컴파일 → 루프 밖으로 호이스팅.
const DEEP_EQUAL_SET_OPS = new Set(["uniqWith", "differenceWith", "intersectionWith", "unionWith", "xorWith", "pullAllWith"]);

/** 비교자가 isEqual 자체이거나, isEqual(...) 한 번을 돌려주는 함수인가. */
function isIsEqualComparator(ts, sf, cmp) {
  const isIsEqualName = (e) =>
    (ts.isIdentifier(e) && e.getText(sf) === "isEqual") ||
    (ts.isPropertyAccessExpression(e) && e.name.getText(sf) === "isEqual");
  if (isIsEqualName(cmp)) return true;
  if (!ts.isArrowFunction(cmp) && !ts.isFunctionExpression(cmp)) return false;
  let body = cmp.body;
  if (ts.isBlock(body)) {
    if (body.statements.length !== 1 || !ts.isReturnStatement(body.statements[0])) return false;
    body = body.statements[0].expression;
  }
  return !!body && ts.isCallExpression(body) && isIsEqualName(body.expression);
}

function analyzeTextbookIssues(ts, fileContents) {
  const awaitInForEach = [];
  const spreadAccumulator = [];
  const regexInLoop = [];
  const floatingPromise = [];
  const loopInvariantIndex = [];
  const sharedRefFill = [];
  const deepEqualSetOp = [];
  const numericSortNoComparator = [];
  const emptyCatch = [];
  const statefulRegex = [];
  const forInArray = [];
  const writeOnlyCollection = [];
  const discardedPureCall = [];
  const indexOfAsBool = [];
  const callbackNoReturn = [];
  const selfCompare = [];
  const asyncInCondition = [];
  const finallySwallow = [];

  for (const { file, content } of fileContents) {
    const kind = scriptKindOf(ts, file);
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const isFnLike = (n) =>
      ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
    const isLoopNode = (n) =>
      n.kind === ts.SyntaxKind.ForStatement || n.kind === ts.SyntaxKind.ForInStatement ||
      n.kind === ts.SyntaxKind.ForOfStatement || n.kind === ts.SyntaxKind.WhileStatement ||
      n.kind === ts.SyntaxKind.DoStatement;

    // ── 전역 플래그 정규식 변수 수집: const RE = /x/g  (루프 밖 선언 = lastIndex 상태 공유)
    const globalRegexVars = new Set();
    // ── [FP:regex-lastindex-reset] lastIndex 를 직접 0 으로 되돌리는 정규식 이름 수집 → 이 축에서 제외한다.
    // 저자가 상태 누수를 이미 알고 손으로 막아둔 자리다. 실측 2026-08-10: nx 의
    // update-jest-preset-angular-setup.ts 두 곳이 `RE.lastIndex = 0` 을 test() 앞뒤로
    // 넣어두고 있었는데 그걸 버그로 잡았다 — 오탐 2/2, 즉 그 저장소에서는 전부 오탐이었다.
    const lastIndexResetVars = new Set();
    // ── 배열로 "보이는" 변수 수집: 리터럴/map/filter/Array.from/split 로 만들어진 것만.
    // for...in 은 객체에 쓰는 게 정상이므로, 배열이라는 증거가 있을 때만 잡는다.
    const arrayVars = new Set();
    // 같은 이름이 파일 안에서 두 번 이상 선언되면 어느 쪽 증거인지 알 수 없다 — 통째로 포기한다.
    // `쓰기만 하는 컬렉션` 축의 same-name-twice 와 같은 정책이다.
    const declaredTwice = new Set();
    {
      const seenDecl = new Set();
      const ARRAY_MAKERS = new Set(["map", "filter", "flatMap", "slice", "concat", "split", "from", "keys", "values"]);
      const collect = (n) => {
        // 파라미터도 선언이다 — mongoose 에서 밟은 자리가 정확히 "다른 함수의 파라미터"였다.
        if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name)) {
          const nm = n.name.getText(sf);
          if (seenDecl.has(nm)) declaredTwice.add(nm); else seenDecl.add(nm);
        }
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
          const init = n.initializer;
          if (ts.isRegularExpressionLiteral(init)) {
            const text = init.getText(sf);
            const flags = text.slice(text.lastIndexOf("/") + 1);
            if (flags.includes("g") || flags.includes("y")) globalRegexVars.add(n.name.getText(sf));
          }
          if (ts.isArrayLiteralExpression(init)) arrayVars.add(n.name.getText(sf));
          if (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) &&
              ARRAY_MAKERS.has(init.expression.name.getText(sf))) arrayVars.add(n.name.getText(sf));
        }
        // RE.lastIndex 를 쓰거나 읽는다 — 손으로 상태를 관리하는 자리라는 신호로 충분하다.
        // 읽기도 포함한다: Babylon spriteManager 는 test() 뒤 lastIndex 를 일부러 읽어 다음 위치를 잡는다(2026-10-07).
        if (ts.isPropertyAccessExpression(n) && n.name.getText(sf) === "lastIndex" &&
            ts.isIdentifier(n.expression)) {
          lastIndexResetVars.add(n.expression.getText(sf));
        }
        ts.forEachChild(n, collect);
      };
      ts.forEachChild(sf, collect);
    }

    // ── A) floating promise 준비: 이 파일에서 선언된 async 함수 이름 수집.
    // 로컬 선언만 본다 — 타입 정보 없이 "프라미스를 반환한다"를 확신할 수 있는 유일한 범위다.
    // 가드 [FP:floating-method-vs-bare-call]: 메서드·클래스 필드는 맨 이름으로 호출될 수 없다.
    // 맨 이름 호출은 함수 선언·변수 대입 함수와만, `this.x()` 는 메서드·필드와만 맞춘다.
    // supabase studio 의 mutation 템플릿 285곳 — `async onError() { onError(...) }` 안의 호출은
    // 구조분해한 옵션 콜백인데 바깥 메서드 이름과 같아서 잡혔다(2026-10-01).
    // ── 버린 반환값 준비: 이 파일이 직접 선언한 메서드·필드 이름. 같은 이름의 자체 메서드(pdf.js
    // AstIdentifier.toLowerCase 처럼 제자리 변경)는 String/Array 의 순수 메서드가 아니다.
    const ownMemberNames = new Set();
    {
      const g = (n) => {
        // 클래스 몸체의 선언만 — 타입 리터럴의 시그니처(`{ replace(url): void }`)까지 세면 파일 전체가 빠진다.
        if ((ts.isMethodDeclaration(n) || ts.isPropertyDeclaration(n)) && n.name && ts.isClassLike(n.parent))
          ownMemberNames.add(n.name.getText(sf));
        ts.forEachChild(n, g);
      };
      ts.forEachChild(sf, g);
    }
    // 가드 [FP:discard-receiver-constructed]: 이 파일에서 `x = new Foo()` 로 만든 이름(마지막 속성 이름 기준)은
    // 문자열이 아니다 — cesium `this._backfaceCommands = new ManagedArray()` 뒤 `tileset._backfaceCommands.trim()` (2026-11-25).
    const constructedNames = new Set();
    {
      const lastName = (e) => ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;
      const g = (n) => {
        let target = null, init = null;
        if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) { target = n.left; init = n.right; }
        else if ((ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n)) && n.initializer) { target = n.name; init = n.initializer; }
        if (target && init && ts.isNewExpression(init) && !/^(String|Array)$/.test(init.expression.getText(sf))) {
          const name = lastName(target);
          if (name) constructedNames.add(name);
        }
        ts.forEachChild(n, g);
      };
      ts.forEachChild(sf, g);
    }
    // 가드 [FP:magic-string-file]: magic-string 의 replace·trim 은 제자리 변경이다(rollup·storybook).
    const usesMagicString = /from\s+['"]magic-string['"]|require\(\s*['"]magic-string['"]\s*\)/.test(content);
    const asyncNames = new Set();
    const asyncMemberNames = new Set();
    // 가드 [FP:floating-benign-callee]: 버려도 잃는 게 없는 async 함수 — 자기 본문(중첩 함수 제외)에 await 가
    // 없거나(동기로 끝나 기다릴 게 없다), 본문 전체가 catch 있는 try 하나다(실패를 스스로 처리하는 백그라운드 작업).
    // 같은 이름이 여럿이면 전부 무해할 때만 뺀다. slidev saveSnapshot · Trilium openInWindowCommand ·
    // serverless #streamContainerLogs · kilocode optimizeTable 가 이 모양이었다(2026-10-08).
    const benignAsync = new Map();
    {
      const hasOwnAwait = (body) => {
        let found = false;
        const g = (n) => {
          if (found || ts.isFunctionLike(n)) return;
          if (ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier)) { found = true; return; }
          ts.forEachChild(n, g);
        };
        ts.forEachChild(body, g);
        return found;
      };
      const isBenign = (fn) => {
        const body = fn.body;
        if (!body || !ts.isBlock(body)) return false;
        if (!hasOwnAwait(body)) return true;
        return body.statements.length === 1 && ts.isTryStatement(body.statements[0]) && !!body.statements[0].catchClause;
      };
      const note = (name, fn) => benignAsync.set(name, (benignAsync.get(name) ?? true) && isBenign(fn));
      const collect = (n) => {
        const isAsync = (node) =>
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
        if (ts.isFunctionDeclaration(n) && isAsync(n) && n.name) { asyncNames.add(n.name.getText(sf)); note(n.name.getText(sf), n); }
        if (ts.isMethodDeclaration(n) && isAsync(n) && n.name) { asyncMemberNames.add(n.name.getText(sf)); note(n.name.getText(sf), n); }
        if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name) &&
            (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && isAsync(n.initializer)) {
          asyncNames.add(n.name.getText(sf)); note(n.name.getText(sf), n.initializer);
        }
        if (ts.isPropertyDeclaration(n) && n.initializer && n.name &&
            (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && isAsync(n.initializer)) {
          asyncMemberNames.add(n.name.getText(sf)); note(n.name.getText(sf), n.initializer);
        }
        ts.forEachChild(n, collect);
      };
      ts.forEachChild(sf, collect);
    }

    // 서브트리 안에서 선언된 모든 이름(구조분해 포함)
    const declaredNamesIn = (node) => {
      const names = new Set();
      const addBinding = (name) => {
        if (!name) return;
        if (ts.isIdentifier(name)) { names.add(name.getText(sf)); return; }
        if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
          for (const el of name.elements) if (ts.isBindingElement(el)) addBinding(el.name);
        }
      };
      const g = (n) => {
        if (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) addBinding(n.name);
        ts.forEachChild(n, g);
      };
      ts.forEachChild(node, g);
      return names;
    };

    // 서브트리 안에서 '대입되는' 이름 — 루프 밖에서 선언됐어도 루프 안에서 값이 바뀌면
    // 그 값은 불변이 아니다. `x = f()` / `x += 1` / `x++` / `x ||= y` 를 전부 센다.
    const assignedNamesIn = (node) => {
      const names = new Set();
      const g = (n) => {
        if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) &&
            (n.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
             /Equals(Token)?$/.test(ts.SyntaxKind[n.operatorToken.kind] || "")))
          names.add(n.left.getText(sf));
        if ((ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) &&
            ts.isIdentifier(n.operand) &&
            (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken))
          names.add(n.operand.getText(sf));
        ts.forEachChild(n, g);
      };
      ts.forEachChild(node, g);
      return names;
    };

    // 콜백 본문에 (중첩 함수 제외) await가 있나
    const hasDirectAwait = (fn) => {
      let found = false;
      const g = (n) => {
        if (found) return;
        if (n !== fn && isFnLike(n)) return;
        if (ts.isAwaitExpression(n)) { found = true; return; }
        ts.forEachChild(n, g);
      };
      ts.forEachChild(fn, g);
      return found;
    };

    // 리터럴이 자기 자신(target)을 스프레드하는가 — [...acc, x] / {...acc, k:v}
    // 누적기가 자기 자신을 통째로 복사하는가. 스프레드 문법만 보면 재현율이 샌다 —
    // acc.concat(x) 와 Object.assign({}, acc, …) 은 같은 O(n²)인데 다른 문법이다.
    // 진단으로만 쓸 땐 놓쳐도 손해가 작지만, 채점축 후보로 재려면 세 형태를 다 봐야 한다.
    // 안 그러면 "스프레드를 concat 으로 바꾸면 점수가 오른다"가 최적 전략이 된다.
    const spreadsSelf = (target, init) => {
      if (!target || !ts.isIdentifier(target)) return false;
      const name = target.getText(sf);
      const isSelf = (e) => e && ts.isIdentifier(e) && e.getText(sf) === name;
      if (ts.isArrayLiteralExpression(init))
        return init.elements.some((e) => ts.isSpreadElement(e) && isSelf(e.expression));
      if (ts.isObjectLiteralExpression(init))
        return init.properties.some((p) => ts.isSpreadAssignment(p) && isSelf(p.expression));
      if (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression)) {
        // acc = acc.concat(x) — 수신자가 누적기 자신이면 매 회 전체 복사다.
        if (init.expression.name.getText(sf) === "concat" && isSelf(init.expression.expression)) return true;
        // acc = Object.assign({}, acc, {k: v}) — 첫 인자가 새 객체라 acc 를 통째로 복사한다.
        // Object.assign(acc, …) 은 제자리 변형이라 O(n²)가 아니다 — 그건 제외된다.
        if (init.expression.name.getText(sf) === "assign" &&
            ts.isIdentifier(init.expression.expression) && init.expression.expression.getText(sf) === "Object" &&
            init.arguments.length > 1 && ts.isObjectLiteralExpression(init.arguments[0]) &&
            init.arguments[0].properties.length === 0 &&
            init.arguments.slice(1).some(isSelf)) return true;
      }
      return false;
    };

    const walk = (node, inLoop, inRealLoop, inAsyncFn, loopVars, loopAssigned = new Set()) => {
      let childInLoop = inLoop;
      let childInRealLoop = inRealLoop;
      let childInAsyncFn = inAsyncFn;
      let childLoopVars = loopVars;
      let childLoopAssigned = loopAssigned;
      if (isLoopNode(node)) {
        childInLoop = true; childInRealLoop = true;
        // 순회 변수뿐 아니라 루프 '본문에서 선언된 모든 이름'을 지역으로 본다.
        // (루프 안에서 만든 정규식/배열은 매 회 새 객체라 상태가 샐 수 없다)
        childLoopVars = new Set([...loopVars, ...declaredNamesIn(node)]);
        childLoopAssigned = new Set([...loopAssigned, ...assignedNamesIn(node)]);
      }
      if (isFnLike(node)) {
        childInAsyncFn = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      }

      // ── 루프 불변 인덱스 재구축: 루프 안에서 new Set(xs)/new Map(xs.map(...)) 를 만드는데
      // 인자의 소스가 루프 밖 값이면 매 회 같은 인덱스를 다시 짓는다 = O(n·m). "고친 척하는 O(n²)".
      // 고침은 생성자를 루프 밖으로 호이스팅. 기계적이고 검증 가능(T2).
      if (inRealLoop && ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
          (node.expression.getText(sf) === "Set" || node.expression.getText(sf) === "Map") &&
          // 가드 [FP:derived-copy]: new Set(x).add(y) / new Map(x).set(k,v) 는 '수정한 파생 복사본'이다.
          // 매 회 다른 값을 만드는 것이므로 호이스팅하면 동작이 깨진다(재귀에 넘기는 불변 스냅샷 등).
          !(ts.isPropertyAccessExpression(node.parent) &&
            ["add", "set", "delete"].includes(node.parent.name.getText(sf)))) {
        const arg = node.arguments && node.arguments[0];
        // 인자에서 참조하는 루트 식별자들을 모은다
        const roots = new Set();
        let usesLoopVar = false;
        // 인자 안의 콜백(map/filter…)이 자체 선언한 이름은 '루프 변수'가 아니다 → 그 이름들을 빼고 본다.
        const innerDecls = declaredNamesIn(arg);
        const collect = (n) => {
          if (ts.isFunctionExpression(n) || ts.isArrowFunction(n)) {
            for (const p of n.parameters) if (ts.isIdentifier(p.name)) innerDecls.add(p.name.getText(sf));
          }
          if (ts.isIdentifier(n)) {
            const nm = n.getText(sf);
            if (innerDecls.has(nm)) { /* 콜백 지역 변수 — 무시 */ }
            else if (loopVars.has(nm)) usesLoopVar = true;
            else roots.add(nm);
          }
          ts.forEachChild(n, collect);
        };
        if (arg) collect(arg);
        // 가드 [FP:loop-var-argument]: (a) 인자가 루프 변수를 참조하면 루프마다 값이 달라 호이스팅 불가 → 제외
        //       (b) 소스 루트가 하나라도 루프 밖(loopVars 아님)이어야 '불변'이다
        const hasOuterSource = [...roots].length > 0;
        // 가드 [FP:reassigned-in-loop]: 루프 밖에서 선언됐어도 루프 안에서 다시 대입되면 값이 매 회 다르다.
        // mongoose `getModelsMapForPopulate.js:151` — `modelNames = res.modelNames` 뒤의 `new Set(modelNames)`.
        const reassigned = [...roots].some((r) => childLoopAssigned.has(r));
        // 가드 [FP:per-iteration-state]: 결과가 객체 리터럴 프로퍼티·배열 원소·인자로 '빠져나가면'
        // 그 컬렉션은 반복마다 하나씩 필요한 상태다. 호이스팅하면 전부 같은 인스턴스를 공유한다.
        // mongoose `getModelsMapForPopulate.js:675` — `localField: new Set([data.localField])`.
        const escapes = node.parent && (
          ts.isPropertyAssignment(node.parent) || ts.isArrayLiteralExpression(node.parent) ||
          (ts.isCallExpression(node.parent) && node.parent.arguments.includes(node)) ||
          (ts.isNewExpression(node.parent) && (node.parent.arguments || []).includes(node)));
        if (!usesLoopVar && hasOuterSource && !reassigned && !escapes) {
          const src = [...roots][0];
          loopInvariantIndex.push({ file, line: lineOf(node), ctor: node.expression.getText(sf), src });
        }
      }

      // ── 완전히 빈 catch: catch (e) {} — 에러를 삼킨다. 로그·주석도 없다.
      if (ts.isCatchClause(node) && node.block.statements.length === 0) {
        emptyCatch.push({ file, line: lineOf(node) });
      }

      // ── Array(n).fill([]) / .fill({}) : 참조 하나를 모든 칸이 공유한다.
      // arr[0].push(x) 하면 모든 칸이 바뀐다 — 조용히 틀린 답. 고침은 Array.from({length:n}, () => []).
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.getText(sf) === "fill" && node.arguments.length >= 1 &&
          // [FP:fill-domain-api] 수신자가 '배열을 만드는 표현'일 때만 — Array.prototype.fill 이 아닌 도메인 API의 .fill()
          // (Playwright의 page.fill(selector, {..}) 처럼)을 오탐하지 않는다.
          (() => {
            const r = node.expression.expression;
            if (ts.isNewExpression(r) && ts.isIdentifier(r.expression) && r.expression.getText(sf) === "Array") return true;
            if (ts.isCallExpression(r) && ts.isIdentifier(r.expression) && r.expression.getText(sf) === "Array") return true;
            if (ts.isArrayLiteralExpression(r)) return true;
            // Array(n) / new Array(n) 를 담은 변수까지는 정적으로 확신 못 하므로 위 세 형태만.
            return false;
          })()) {
        const a0 = node.arguments[0];
        if (ts.isArrayLiteralExpression(a0) || ts.isObjectLiteralExpression(a0) ||
            (ts.isNewExpression(a0) && ts.isIdentifier(a0.expression) && ["Array","Set","Map"].includes(a0.expression.getText(sf)))) {
          sharedRefFill.push({ file, line: lineOf(node), what: a0.getText(sf).slice(0, 20) });
        }
      }

      // ── 깊은 비교 집합 연산: lodash uniqWith/differenceWith/… 에 isEqual 을 넘기면 모든 쌍을 깊게 비교한다(O(n·m)).
      // 명시적 루프가 없어서 O(n²) 배열 조회 축이 못 잡는 자리다. 원소가 원시값뿐이면 Set 이 같은 답을 낸다
      // (n8n#40311: 이메일 2만 개 중복 제거 885ms → 1.3ms). 객체 원소면 키를 정해야 해서 고침이 저장소마다 다르다.
      if (ts.isCallExpression(node) && node.arguments.length >= 2) {
        const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.getText(sf)
          : ts.isIdentifier(node.expression) ? node.expression.getText(sf) : "";
        if (DEEP_EQUAL_SET_OPS.has(callee) && isIsEqualComparator(ts, sf, node.arguments[node.arguments.length - 1])) {
          deepEqualSetOp.push({ file, line: lineOf(node), name: callee });
        }
      }

      // ── 숫자 배열을 .sort() 비교자 없이: 문자열 사전순 정렬이라 [10,2,1] -> [1,10,2].
      // 배열이 숫자라는 증거(요소가 전부 숫자 리터럴, 또는 .length/.map(Number) 흔적)가 있을 때만.
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.getText(sf) === "sort" && node.arguments.length === 0) {
        const recv = node.expression.expression;
        // 수신자가 숫자 배열 리터럴이거나, 방금 만든 숫자 배열일 때만 (오탐 최소화)
        if (ts.isArrayLiteralExpression(recv) && recv.elements.length > 0 &&
            recv.elements.every((e) => ts.isNumericLiteral(e) ||
              (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand)))) {
          numericSortNoComparator.push({ file, line: lineOf(node) });
        }
      }

      // 가드 [FP:regex-match-resets]: 같은 루프 본문에서 test() 보다 앞서 str.match(RE)·str.replace(RE, …) 가 돌면
      // /g 의 match·replace 는 lastIndex 를 0 으로 되돌리고 끝나므로 매 회 깨끗한 상태로 test() 한다.
      // compromise 05-parens-merge.js 가 이 모양이었다(2026-10-07).
      function resetEarlierInLoop(testCall, name) {
        let loop = testCall.parent;
        while (loop && !ts.isIterationStatement(loop, false) && !ts.isFunctionLike(loop)) loop = loop.parent;
        if (!loop || ts.isFunctionLike(loop)) return false;
        let found = false;
        const visit = (n) => {
          if (found || n.pos >= testCall.pos) return;
          if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
              ["match", "replace", "replaceAll"].includes(n.expression.name.getText(sf)) &&
              n.arguments[0] && ts.isIdentifier(n.arguments[0]) && n.arguments[0].getText(sf) === name) {
            found = true;
            return;
          }
          ts.forEachChild(n, visit);
        };
        ts.forEachChild(loop.statement, visit);
        return found;
      }

      // ── 전역 플래그 정규식을 루프 안에서 .test(): lastIndex가 문자열 사이로 새어
      // 같은 입력도 호출마다 결과가 뒤바뀐다. 성능이 아니라 "조용히 틀린 답"을 내는 버그.
      // 고침은 /g 제거 또는 매 회 새 정규식.
      // 가드 [FP:regex-exec-walk]: .exec()는 제외한다 — `while ((m = re.exec(s)) !== null)` 은 /g 정규식의
      // *정석 순회 관용구*이지 버그가 아니다(실제로 twenty에서 lastIndex=0 리셋까지 하고 있었다).
      if (inLoop && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const m = node.expression.name.getText(sf);
        const recv = node.expression.expression;
        // 가드 [FP:regex-created-in-loop]: 루프 안에서 만든 정규식은 매 회 새 객체라 lastIndex가 샐 수 없다 → 제외
        if (m === "test" && ts.isIdentifier(recv) && globalRegexVars.has(recv.getText(sf)) &&
            !loopVars.has(recv.getText(sf)) && !lastIndexResetVars.has(recv.getText(sf)) &&
            !resetEarlierInLoop(node, recv.getText(sf))) {
          statefulRegex.push({ file, line: lineOf(node), name: recv.getText(sf), method: m });
        }
      }

      // ── 배열에 for...in: 인덱스가 문자열이고 상속 속성까지 돌며 순서 보장이 없다.
      // 가드 [FP:for-in-needs-array-evidence]: 배열이라는 증거(리터럴·map·filter·split 등)가 있는 변수만.
      // 가드 [FP:for-in-name-collision]: 증거는 파일 스코프로 모으므로, 같은 이름이 다른 함수에서
      // 배열로 선언돼 있으면 객체를 도는 정상 `for...in` 까지 끌려온다. 이름이 두 번 선언되면 포기한다.
      // mongoose `schema.js:2396` — 객체 인덱스 스펙인데 `schema.js:1005` 의 동명 배열 때문에 잡혔다.
      if (ts.isForInStatement(node) && ts.isIdentifier(node.expression) &&
          arrayVars.has(node.expression.getText(sf)) &&
          !declaredTwice.has(node.expression.getText(sf))) {
        forInArray.push({ file, line: lineOf(node), name: node.expression.getText(sf) });
      }

      // ── A) floating promise: async 함수 안에서, 결과를 버리는 문(ExpressionStatement)으로
      // 로컬 async 함수를 await 없이 호출. 고침은 await 한 단어라 완전히 기계적.
      // 가드 [FP:floating-needs-async-context]: async 컨텍스트 안에서만(밖이면 await를 못 붙여 기계적 수정이 아님),
      //       void/then/catch로 감싼 의도적 fire-and-forget은 구조상 여기 안 걸린다.
      // ── 버린 반환값: 문자열·배열의 순수 메서드를 부르고 결과를 버린다. 문자열은 불변이라
      // `s.replace(…)` 한 줄은 아무것도 안 한다 — 대입을 빠뜨린 자리다. 고침은 대입 한 번.
      // nx scam-to-standalone `spec.replace(/declarations: \[.+/, '')` · theia `messages[i].concat(…)` (2026-10-08).
      // 가드 [FP:discard-needs-pure-method]: 제자리 변경과 이름이 겹치는 메서드는 뺀다 — DOM `normalize()`,
      //   `location.replace()`·`router.replace()`(이동), 자체 클래스가 같은 이름을 선언한 경우.
      // 가드 [FP:replace-as-iterator]: replace 는 첫 인자가 문자열·정규식 리터럴이고 둘째 인자가 함수가
      //   아닐 때만 — 콜백으로 매치를 모으는 `str.replaceAll(re, fn)` 은 의도된 순회다(pdf.js util).
      // 같은 축: `new XError(…)` 를 만들고 throw 를 빠뜨린 문장. 에러가 아무 일도 안 하고 흐름이 계속된다.
      // node benchmark/fs 21곳 `default: new Error('Invalid type')` — 잘못된 type 이 조용히 측정됐다(2026-10-10).
      if (ts.isExpressionStatement(node) && ts.isNewExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) && /(Error|Exception)$/.test(node.expression.expression.text)) {
        discardedPureCall.push({ file, line: lineOf(node), name: node.expression.expression.text, method: "new" });
      }
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
          ts.isPropertyAccessExpression(node.expression.expression) && !usesMagicString) {
        const call = node.expression;
        const m = call.expression.name.getText(sf);
        const recv = call.expression.expression;
        const recvText = recv.getText(sf);
        const PURE = DISCARD_PURE_METHODS;
        let hit = PURE.has(m);
        // 가드 [FP:discard-receiver-passed-along]: 수신자를 인자 안에서 다시 넘기면(`content.concat(render(x, content))`)
        // 호출된 쪽이 수신자에 직접 push 한다 — 버린 concat 은 군더더기일 뿐 버그가 아니다(semi cascader, 2026-10-08).
        if (hit && ts.isIdentifier(recv) && call.arguments.some((a) => {
          let found = false;
          const g = (n) => { if (found) return; if (ts.isIdentifier(n) && n.text === recv.text) { found = true; return; } ts.forEachChild(n, g); };
          g(a);
          return found;
        })) hit = false;
        // 가드 [FP:discard-receiver-not-string]: 같은 함수 안에서 수신자에 문자열·배열에 없는 멤버를 쓰면
        // 자체 객체다 — compromise `vb.replace('did', 'will')` 옆엔 `vb.match`·`vb.remove` 가, super-productivity
        // `tracked.trim()` 옆엔 `tracked.rawRanges`·`tracked.text` 가 있었다. 둘 다 제자리 변경 메서드였다(2026-10-09, 7건).
        let foreign = false;
        // 수신자가 `this._buf`·`a.b` 같은 속성 체인이어도 같은 텍스트로 본다 — Babylon `this._selectionContent.concat()`
        // 옆엔 `this._selectionContent.reset()` 이 있었다(SmartArray 의 제자리 concat, 2026-10-09).
        const chain = ts.isIdentifier(recv) || (ts.isPropertyAccessExpression(recv) && /^[\w$.]+$/.test(recvText));
        if (chain && (PURE.has(m) || m === "replace" || m === "replaceAll")) {
          let scope = node.parent;
          while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
          const g = (n) => {
            if (foreign) return;
            if (ts.isPropertyAccessExpression(n) && n.expression.getText(sf) === recvText &&
                !STRING_ARRAY_MEMBERS.has(n.name.text)) { foreign = true; return; }
            ts.forEachChild(n, g);
          };
          if (scope) g(scope);
        }
        // 가드 [FP:trim-with-args]: String#trim·trimStart·trimEnd·toLowerCase·toUpperCase 는 인자를 받지 않는다 —
        // 인자가 있으면 자체 메서드다(cesium ManagedArray `stack.trim(maxLength)`, 2026-11-25).
        if (/^(trim|trimStart|trimEnd|toLowerCase|toUpperCase)$/.test(m) && call.arguments.length > 0) hit = false;
        {
          const last = ts.isIdentifier(recv) ? recv.text : ts.isPropertyAccessExpression(recv) ? recv.name.text : null;
          if (last && constructedNames.has(last)) hit = false;
        }
        if (m === "replace" || m === "replaceAll") {
          const [a0, a1] = call.arguments;
          // 가드 [FP:replace-needs-two-args]: String#replace 는 늘 인자 2개다 — 1개짜리는 NodePath·location·router 의
          // 제자리 교체·이동이다(carbon codemod `path.get('source').get('value').replace('…')`, 2026-10-08).
          hit = call.arguments.length === 2 && !!a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0) || ts.isRegularExpressionLiteral(a0)) &&
            !(a1 && (ts.isArrowFunction(a1) || ts.isFunctionExpression(a1))) &&
            // 가드 [FP:replace-non-string-arg]: 둘째 인자가 객체·배열 리터럴이면 String#replace 가 아니다
            // (bokeh InlineStyleSheet.replace(":host", {…}), 2026-10-08).
            !(a1 && (ts.isObjectLiteralExpression(a1) || ts.isArrayLiteralExpression(a1))) &&
            !/(^|\.)(location|router|history|navigation|navigate)$/i.test(recvText);
        }
        if (hit && !foreign && recv.kind !== ts.SyntaxKind.ThisKeyword && !ownMemberNames.has(m)) {
          discardedPureCall.push({ file, line: lineOf(node), name: recvText.slice(0, 40), method: m });
        }
      }

      if (inAsyncFn && ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const callee = node.expression.expression;
        const name = ts.isIdentifier(callee) ? callee.getText(sf)
          : (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword)
            ? callee.name.getText(sf) : null;
        const names = ts.isIdentifier(callee) ? asyncNames : asyncMemberNames;
        // 가드 [FP:floating-other-class-member]: `this.x()` 는 감싸는 클래스가 x 를 직접 선언했으면 그 선언으로 판정한다.
        // 이름만 보면 같은 파일 다른 클래스의 async x 와 섞인다 — mastra session.ts 의 동기 `set` 5곳이
        // SessionState 의 async `set` 때문에 잡혔다(2026-10-08).
        let ownAsync = null;
        if (name && !ts.isIdentifier(callee)) {
          let c = node.parent;
          while (c && !ts.isClassLike(c)) c = c.parent;
          const own = c?.members.filter((m) => m.name?.getText(sf) === name) ?? [];
          if (own.length) ownAsync = own.some((m) => {
            const fn = ts.isPropertyDeclaration(m) ? m.initializer : m;
            return fn?.modifiers?.some((k) => k.kind === ts.SyntaxKind.AsyncKeyword);
          });
        }
        if (name && (ownAsync ?? names.has(name)) && !benignAsync.get(name)) {
          floatingPromise.push({ file, line: lineOf(node), name });
        }
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.getText(sf);

        // 가드 [FP:awaited-custom-foreach]: `await x.forEach(async …)` 는 forEach 가 프라미스를 돌려준다는 뜻 —
        // Array.prototype.forEach 가 아니라 기다려주는 자체 구현이다. crawlee Dataset.forEach 가 이 모양이었다(2026-10-07).
        if (method === "forEach" && !ts.isAwaitExpression(node.parent)) {
          for (const arg of node.arguments) {
            if (isFnLike(arg) && hasDirectAwait(arg)) {
              awaitInForEach.push({ file, line: lineOf(node), name: node.expression.expression.getText(sf) });
              break;
            }
          }
        }

        if (method === "reduce") {
          const cb = node.arguments[0];
          if (cb && isFnLike(cb) && cb.parameters.length > 0 && ts.isIdentifier(cb.parameters[0].name)) {
            const acc = cb.parameters[0].name;
            let bad = false;
            const g = (n) => {
              if (bad) return;
              if (n !== cb && isFnLike(n)) return;
              // 호출식도 본다 — reduce 안 acc.concat(x) / Object.assign({}, acc, …) 도 같은 전체 복사다.
              if ((ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n) || ts.isCallExpression(n)) &&
                  spreadsSelf(acc, n)) { bad = true; return; }
              ts.forEachChild(n, g);
            };
            ts.forEachChild(cb, g);
            if (bad) spreadAccumulator.push({ file, line: lineOf(node), where: "reduce" });
          }
        }

        if (ITERATING_METHODS.has(method)) {
          // 순회 콜백은 "루프"지만 진짜 반복문은 아니다 — 모듈 로드 시 1회 도는 map()도 여기 해당.
          for (const arg of node.arguments) if (isFnLike(arg)) walk(arg, true, inRealLoop, childInAsyncFn, new Set([...childLoopVars, ...declaredNamesIn(arg)]));
        }
      }

      if (inLoop && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          spreadsSelf(node.left, node.right)) {
        spreadAccumulator.push({ file, line: lineOf(node), where: "loop" });
      }

      // [FP:map-is-not-a-loop] 진짜 반복문(for/while) 안에서만 — .map()으로 1회 만드는 캐시는 재컴파일이 아니다.
      if (inRealLoop && ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.getText(sf) === "RegExp") {
        regexInLoop.push({ file, line: lineOf(node) });
      }

      ts.forEachChild(node, (child) => {
        const alreadyWalked =
          ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          ITERATING_METHODS.has(node.expression.name.getText(sf)) && isFnLike(child);
        if (alreadyWalked) return;
        // [FP:loop-header-runs-once] 루프 '헤더'(for-of/for-in 의 순회 대상, for 의 초기화·조건·증감)는
        // 본문이 아니다 — `for (const x of new Map(fields))` 의 Map 은 반복마다가 아니라 한 번 만들어진다.
        // mongoose `model.js:2000` 에서 밟았다. 헤더는 바깥 루프 문맥을 그대로 물려준다.
        const isBody = !isLoopNode(node) || child === node.statement;
        if (!isBody) { walk(child, inLoop, inRealLoop, childInAsyncFn, loopVars, loopAssigned); return; }
        walk(child, childInLoop, childInRealLoop, childInAsyncFn, childLoopVars, childLoopAssigned);
      });
    };
    ts.forEachChild(sf, (n) => walk(n, false, false, false, new Set()));

    // ── 쓰기만 하는 컬렉션: new Map()/new Set() 을 만들어 넣기만 하고 한 번도 안 읽는다.
    // 채워 넣는 비용은 매번 내면서 그 값을 쓰는 곳이 없다 — 대개 소비하던 코드가
    // 사라지고 생산만 남은 자리다. knip 이 못 잡는다: export 가 아니라 지역 변수고,
    // 이름은 멀쩡히 '참조'되기 때문이다(.add 도 참조다). 읽기/쓰기를 구분해야 보인다.
    //
    // 판정: 선언 말고 이 이름의 모든 참조가 쓰기 메서드의 수신자이면 write-only.
    // 한 군데라도 .get/.has/.size/전개/인자 전달/반환이면 읽는 것이므로 후보에서 뺀다.
    // 그래서 오탐이 나오려면 '읽기가 정적으로 안 보이는 경로'여야 하는데, 그건
    // eval 이나 with 뿐이다. 재할당되는 이름도 뺀다(다른 값이 들어올 수 있다).
    collectWriteOnly(ts, sf, file, lineOf, writeOnlyCollection);
    collectBoolMisuse(ts, sf, file, lineOf, indexOfAsBool, callbackNoReturn);
    collectSelfCompare(ts, sf, file, lineOf, selfCompare);
    collectAsyncInCondition(ts, sf, file, lineOf, asyncInCondition);
    collectFinallySwallow(ts, sf, file, lineOf, finallySwallow);
  }

  // 가드 [FP:index-repo-startswith-style]: 저장소 전체에 `!s.indexOf(x)` 가 3번 이상이면 그 저자는 위치를 "0번 자리"
  // 의미로 쓴다 — `if (s.indexOf('curl '))` 는 "curl 로 시작하지 않으면"이다(whistle 17회 · 조건 자리 5건 전부 의도).
  // 진짜 버그가 나온 Ghost·vscode·nx·angular·n8n 은 이 관용구가 0회였다(10-10).
  const bangIndexOf = fileContents.reduce((n, { content }) => n + (content.match(/![A-Za-z_$][\w$.]*\.indexOf\(/g) || []).length, 0);
  if (bangIndexOf >= 3) indexOfAsBool.length = 0;

  return {
    awaitInForEach: { count: awaitInForEach.length, worst: awaitInForEach.slice(0, 6) },
    spreadAccumulator: { count: spreadAccumulator.length, worst: spreadAccumulator.slice(0, 6) },
    regexInLoop: { count: regexInLoop.length, worst: regexInLoop.slice(0, 6) },
    floatingPromise: { count: floatingPromise.length, worst: floatingPromise.slice(0, 6) },
    loopInvariantIndex: { count: loopInvariantIndex.length, worst: loopInvariantIndex.slice(0, 6) },
    sharedRefFill: { count: sharedRefFill.length, worst: sharedRefFill.slice(0, 6) },
    deepEqualSetOp: { count: deepEqualSetOp.length, worst: deepEqualSetOp.slice(0, 6) },
    numericSortNoComparator: { count: numericSortNoComparator.length, worst: numericSortNoComparator.slice(0, 6) },
    emptyCatch: { count: emptyCatch.length, worst: emptyCatch.slice(0, 8) },
    statefulRegex: { count: statefulRegex.length, worst: statefulRegex.slice(0, 6) },
    forInArray: { count: forInArray.length, worst: forInArray.slice(0, 6) },
    writeOnlyCollection: { count: writeOnlyCollection.length, worst: writeOnlyCollection.slice(0, 6) },
    discardedPureCall: { count: discardedPureCall.length, worst: discardedPureCall.slice(0, 6) },
    indexOfAsBool: { count: indexOfAsBool.length, worst: indexOfAsBool.slice(0, 6) },
    callbackNoReturn: { count: callbackNoReturn.length, worst: callbackNoReturn.slice(0, 6) },
    selfCompare: { count: selfCompare.length, worst: selfCompare.slice(0, 6) },
    asyncInCondition: { count: asyncInCondition.length, worst: asyncInCondition.slice(0, 6) },
    finallySwallow: { count: finallySwallow.length, worst: finallySwallow.slice(0, 6) },
  };
}

// 버린 반환값 축이 보는 순수 메서드. 결과를 버리면 아무 일도 안 일어나는 것만 — 이름이 같은 제자리 변경
// (Array#reverse·sort·splice, DOM normalize)은 넣지 않는다.
// 수신자 판별(문자열이 아닌 자체 객체 가드)이 쓰는 허용 목록 — 수신자가 문자열·배열이면 이 이름만 나온다.
const STRING_ARRAY_MEMBERS = new Set([
  ...Object.getOwnPropertyNames(String.prototype), ...Object.getOwnPropertyNames(Array.prototype),
]);
const DISCARD_PURE_METHODS = new Set([
  "concat", "toLowerCase", "toUpperCase", "toLocaleLowerCase", "toLocaleUpperCase", "trim", "trimStart", "trimEnd",
  "padStart", "padEnd", "toSorted", "toReversed", "toSpliced", "substring", "substr", "repeat",
]);

/**
 * 위치가 진리값으로 쓰이는 자리와, 값을 돌려줘야 하는 콜백이 아무것도 안 돌려주는 자리.
 * 둘 다 고치면 한 줄이고 동작이 실제로 바뀐다 — 2026-10-10 코퍼스 75곳에서 원형으로 잰 결과:
 *   indexOfAsBool: 조건 자리 8건 중 진짜 4건(Ghost Stripe 오류 분기 · vscode 노트북 복사 버튼 ·
 *     nx outDir 접두사 판정이 뒤집힘 · nx `search()` 를 확장자 판정에) — 나머지 4건은 값 자리라 아래에서 뺀다.
 *   callbackNoReturn: 결과를 쓰는 find 2건(n8n displayOptions · medusa docs 접근자 판정) 전부 진짜,
 *     Promise.all 안 동기 map 2건(vscode CLI flush · 원격 확장 설치) 전부 진짜.
 */
function collectBoolMisuse(ts, sf, file, lineOf, idxOut, cbOut) {
  const PREDICATE = new Set(["filter", "find", "findIndex", "findLast", "findLastIndex", "some", "every"]);
  const POSITION = new Set(["indexOf", "lastIndexOf", "findIndex", "search"]);
  const PROMISE_COMBINATOR = /^Promise\.(all|allSettled|any|race)$/;
  const SYNC_TAIL = new Set(["push", "unshift", "set", "add", "delete", "splice", "assign", "log", "warn", "error", "info", "debug"]);
  const fnOfPredicate = (fn) => {
    const call = fn.parent;
    return call && ts.isCallExpression(call) && call.arguments[0] === fn &&
      ts.isPropertyAccessExpression(call.expression) && PREDICATE.has(call.expression.name.text);
  };
  // 위치 값이 진리값으로 소비되는가. 괄호와 &&·|| 는 타고 올라가고, 그 밖의 자리(비교·대입·반환·인자)는 값이다.
  const inCondition = (node) => {
    let n = node;
    for (;;) {
      const p = n.parent;
      if (!p) return false;
      if (ts.isParenthesizedExpression(p)) { n = p; continue; }
      if (ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          p.operatorToken.kind === ts.SyntaxKind.BarBarToken)) { n = p; continue; }
      if ((ts.isIfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) && p.expression === n) return true;
      if (ts.isForStatement(p) && p.condition === n) return true;
      if (ts.isConditionalExpression(p) && p.condition === n) return true;
      // `list.find((m) => TYPES.indexOf(m) || …)` — 술어 콜백의 식 본문은 진리값 자리다.
      if (ts.isArrowFunction(p) && p.body === n && fnOfPredicate(p)) return true;
      // 가드 [FP:index-bang-startswith]: `!s.indexOf(x)` 는 "0번 자리에 있다"(startsWith) 관용구다.
      // `!!(name && name.indexOf(P))` 처럼 일부러 -1·양수를 참으로 쓰는 자리도 여기서 빠진다(echarts isNameSpecified).
      return false;
    }
  };
  const hasValueReturn = (body) => {
    let found = false;
    const g = (n) => {
      if (found || ts.isFunctionLike(n)) return;
      if ((ts.isReturnStatement(n) && n.expression) || ts.isThrowStatement(n)) { found = true; return; }
      ts.forEachChild(n, g);
    };
    ts.forEachChild(body, g);
    return found;
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const m = node.expression.name.text;
      const recv = node.expression.expression.getText(sf).replace(/\s+/g, " ").slice(0, 40);
      if (POSITION.has(m) && node.arguments.length >= 1 && inCondition(node)) {
        idxOut.push({ file, line: lineOf(node), name: recv, method: m });
      }
      const cb = node.arguments[0];
      if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb)) && ts.isBlock(cb.body) &&
          cb.body.statements.length > 0 && !hasValueReturn(cb.body)) {
        // 가드 [FP:predicate-result-discarded]: 결과를 버리는 filter·some 은 forEach 대용이다 — 콜백이 값을
        // 안 돌려줘도 아무 일도 안 바뀐다(medusa mikro-orm-repository·cypress validateOverridableAtRunTime).
        // forEach 화살표의 식 본문도 버린다(medusa `data.forEach(({ update }) => Object.keys(update).filter(…))`).
        const p = node.parent;
        const forEachBody = ts.isArrowFunction(p) && p.body === node && ts.isCallExpression(p.parent) &&
          ts.isPropertyAccessExpression(p.parent.expression) && p.parent.expression.name.text === "forEach";
        const used = !ts.isExpressionStatement(p) && !ts.isVoidExpression(p) && !forEachBody;
        let hit = PREDICATE.has(m) && used;
        // 동기 map 은 Promise.all 의 인자일 때만 — 그 밖의 "map 을 forEach 처럼"은 결과 배열을 안 쓰는 경우가 많다.
        if ((m === "map" || m === "flatMap") && !(cb.modifiers || []).some((x) => x.kind === ts.SyntaxKind.AsyncKeyword)) {
          const outer = node.parent;
          // 가드 [FP:map-sync-tail]: 마지막 문장이 push·set·log 같은 동기 호출이면 기다릴 게 처음부터 없다 —
          // payload `cronJobs.map((c) => { const cron = new Cron(…); this.crons.push(cron) })` (10-10 코퍼스).
          const last = cb.body.statements[cb.body.statements.length - 1];
          const tail = ts.isExpressionStatement(last) && ts.isCallExpression(last.expression) ? last.expression.expression : null;
          const tailName = tail && (ts.isPropertyAccessExpression(tail) ? tail.name.text : ts.isIdentifier(tail) ? tail.text : "");
          hit = ts.isCallExpression(outer) && outer.arguments[0] === node &&
            PROMISE_COMBINATOR.test(outer.expression.getText(sf)) &&
            !!tailName && !SYNC_TAIL.has(tailName);
        }
        if (hit) cbOut.push({ file, line: lineOf(node), name: recv, method: m });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/**
 * 같은 식을 자기 자신과 비교하는 자리 — 늘 같은 답이 나오고, 대개 다른 이름을 쓰려던 복사·붙여넣기다.
 * 2026-10-10 코퍼스 75곳 원형: angular `isEquivalent() { return this.xref === this.xref }`(늘 참) ·
 * vscode `find(e => areSameExtensions(e.identifier, e.identifier))`(가려진 e) · excalidraw
 * `endArrowhead || endArrowhead`(start 였어야) · vscode 검색 `filesToExclude || filesToExclude`(include 였어야).
 */
// ── 조건 자리의 async 호출: `if (isValid())` 에서 isValid 가 async 면 조건은 Promise 라 늘 참이고, `!isValid()` 는 늘 거짓이다.
// vscode `!this.canInstallResourceExtension(ext)` 는 설치 불가 확인을 통째로 건너뛰고, react 릴리즈 스크립트
// `if (executableIsAvailable('gh'))` 는 gh 가 없어도 검증을 돌렸다(2026-10-15 코퍼스 원형: 6건 중 4건 진짜).
// 같은 파일에서 async 로 선언된 것만 본다 — 맨 이름 호출은 함수 선언·변수만, `this.x()` 는 메서드만 맞춘다.
// 가드 [FP:async-cond-name-kind]: 맨 이름 `isEngineValid(...)` 는 import 한 동기 함수였고, 같은 파일의 같은 이름은
// async 메서드였다(vscode extensionGalleryService). 이름 공간을 섞으면 그 둘이 같아진다.
function collectAsyncInCondition(ts, sf, file, lineOf, out) {
  const isAsync = (fn) => !!fn?.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  const fnAsync = new Map(), methodAsync = new Map();
  const mark = (map, name, a) => map.set(name, map.has(name) ? (map.get(name) && a) : a);
  const collect = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) mark(fnAsync, n.name.text, isAsync(n));
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
             (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) mark(fnAsync, n.name.text, isAsync(n.initializer));
    else if (ts.isMethodDeclaration(n) && n.name && ts.isIdentifier(n.name)) mark(methodAsync, n.name.text, isAsync(n));
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const inCondition = (n) => {
    let c = n, p = n.parent, negated = false;
    while (p && (ts.isParenthesizedExpression(p) ||
      (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) ||
      (ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || p.operatorToken.kind === ts.SyntaxKind.BarBarToken)))) {
      if (ts.isPrefixUnaryExpression(p)) negated = true;
      c = p; p = p.parent;
    }
    if (!p) return false;
    if ((ts.isIfStatement(p) || ts.isWhileStatement(p) || ts.isDoStatement(p)) && p.expression === c) return true;
    if (ts.isConditionalExpression(p) && p.condition === c) return true;
    return negated;
  };
  const visit = (n) => {
    if (ts.isCallExpression(n) && !ts.isAwaitExpression(n.parent)) {
      const c = n.expression;
      let name = null;
      if (ts.isIdentifier(c) && fnAsync.get(c.text)) name = c.text;
      else if (ts.isPropertyAccessExpression(c) && c.expression.kind === ts.SyntaxKind.ThisKeyword &&
               methodAsync.get(c.name.text)) name = `this.${c.name.text}`;
      if (name && inCondition(n)) out.push({ file, line: lineOf(n), name });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// ── finally 가 삼킨 throw: `catch (e) { if (dev) throw e; } finally { return x; }` 에서 finally 의 return·throw 가
// catch 의 throw 를 덮어써 그 throw 는 절대 밖으로 못 나간다. 다시 던지려던 의도가 죽는다.
// excalidraw delta.ts 3곳이 "dev·test 면 다시 던져 알아채자" 고 적어두고 finally 에서 return 했다(2026-10-16 원형:
// 코퍼스 75 + 10k+ 75곳에서 3건, 전부 진짜). finally 블록 맨 위 단계의 return·throw 만 본다 — `if` 안에 있으면 조건부라
// 의도된 경우가 있고(svelte async.js 는 플래그로 막는다), catch 가 다시 던지지 않으면 삼키는 게 의도다
// (cypress fetch 패치: "내부 오류로 사용자 요청을 막지 마라").
function collectFinallySwallow(ts, sf, file, lineOf, out) {
  const owned = (root, pred) => {
    const hits = [];
    const walk = (m) => {
      if (m !== root && (ts.isFunctionLike(m) || ts.isClassLike(m) || ts.isTryStatement(m))) return;
      if (pred(m)) hits.push(m);
      ts.forEachChild(m, walk);
    };
    walk(root);
    return hits;
  };
  const nameOf = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent.name.getText(sf);
    }
    return "<anonymous>";
  };
  const visit = (n) => {
    if (ts.isTryStatement(n) && n.catchClause && n.finallyBlock) {
      const exit = n.finallyBlock.statements.find((st) => ts.isReturnStatement(st) || ts.isThrowStatement(st));
      const rethrow = exit && owned(n.catchClause.block, ts.isThrowStatement)[0];
      if (rethrow) out.push({ file, line: lineOf(exit), name: nameOf(n), throwLine: lineOf(rethrow),
        kind: ts.isReturnStatement(exit) ? "return" : "throw" });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

function collectSelfCompare(ts, sf, file, lineOf, out) {
  const K = ts.SyntaxKind;
  // `x - x` 는 넣지 않는다 — fingerprintjs `f[0] = f[0] - f[0]` 처럼 Infinity 로 NaN 을 일부러 만든다.
  const CMP = new Set([K.EqualsEqualsEqualsToken, K.EqualsEqualsToken, K.LessThanToken, K.GreaterThanToken,
    K.LessThanEqualsToken, K.GreaterThanEqualsToken]);
  const LOGIC = new Set([K.AmpersandAmpersandToken, K.BarBarToken]);
  const SAME_FN = /(same|equals?|compare|^eq$|isEqual|deepEqual|shallowEqual|areEqual)/i;
  // 호출·증감·할당이 있으면 두 번 평가한 값이 다를 수 있다 — `next() === next()` 는 자기 비교가 아니다.
  const pure = (n) => {
    let ok = true;
    const g = (x) => {
      if (!ok) return;
      if (ts.isCallExpression(x) || ts.isNewExpression(x) || ts.isPostfixUnaryExpression(x) || ts.isAwaitExpression(x) ||
          (ts.isPrefixUnaryExpression(x) && (x.operator === K.PlusPlusToken || x.operator === K.MinusMinusToken)) ||
          (ts.isBinaryExpression(x) && x.operatorToken.kind >= K.FirstAssignment && x.operatorToken.kind <= K.LastAssignment)) ok = false;
      ts.forEachChild(x, g);
    };
    g(n);
    return ok;
  };
  // 공백까지 원문 그대로 비교한다 — 정규화하면 `x === ' ' || x === ''` 가 같아진다.
  const KEYWORD = new Set([K.TrueKeyword, K.FalseKeyword, K.NullKeyword, K.UndefinedKeyword, K.ThisKeyword]);
  const same = (a, b) => pure(a) && !KEYWORD.has(a.kind) && a.getText(sf) === b.getText(sf) && /[A-Za-z_$]/.test(a.getText(sf));
  // 가드 [FP:self-compare-flow-generic]: Flow 파일은 JS 로 읽으면 `Array<Array<T>>` 가 비교식으로 깨진다(react ReactFizzServer).
  if (/@flow\b/.test(sf.text.slice(0, 2000))) return;
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && same(node.left, node.right)) {
      const op = node.operatorToken.kind;
      // 가드 [FP:self-compare-nan-idiom]: `x !== x` 는 NaN 검사 관용구다(vue `vnode.key !== vnode.key`, mobx `+a !== +a`).
      // `!==`·`!=` 는 비교 집합에 넣지 않는다.
      // `value === value` 처럼 맨 이름의 같음 비교도 "NaN 이 아님" 관용구다(lodash·node comparisons·svelte equality).
      // `b >= b` 도 같다(vega extentIndex: null 아니고 NaN 아닌 첫 값 찾기).
      const nanIdiom = ts.isIdentifier(node.left) && (op === K.EqualsEqualsEqualsToken || op === K.EqualsEqualsToken ||
        op === K.GreaterThanEqualsToken || op === K.LessThanEqualsToken);
      if (CMP.has(op) && !nanIdiom) out.push({ file, line: lineOf(node), name: node.left.getText(sf).slice(0, 40), op: node.operatorToken.getText(sf) });
      // 가드 [FP:self-compare-render-idiom]: `label && label` 처럼 맨 이름 하나의 중복과 JSX 자식 `{x && x}` 는
      // 렌더 관용구·무해한 중복이라 뺀다 — payload·next.js 예제 템플릿에 수십 곳.
      else if (LOGIC.has(op) && !ts.isIdentifier(node.left) && !ts.isJsxExpression(node.parent)) {
        out.push({ file, line: lineOf(node), name: node.left.getText(sf).slice(0, 40), op: node.operatorToken.getText(sf) });
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length === 2) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      const arg = node.arguments[0];
      // 가드 [FP:self-compare-call-constant]: 비교 함수 호출은 인자가 속성 접근일 때만 본다. 맨 이름·리터럴·`Math.PI`·`Number.NaN`
      // 을 같은 값과 비교하는 건 테스트가 일부러 쓰는 모양이다(deno `assert/equal_test.ts` `equal(NaN, NaN)`, Cesium Specs).
      // timingSafeEqual(b, b) 는 길이가 다를 때 일부러 하는 더미 비교다(super-productivity·twinny 토큰 비교).
      const memberArg = (ts.isPropertyAccessExpression(arg) || ts.isElementAccessExpression(arg)) &&
        !/^(Math|Number|Infinity|NaN)\b/.test(arg.getText(sf));
      if (SAME_FN.test(name) && name !== "timingSafeEqual" && memberArg && same(arg, node.arguments[1])) {
        out.push({ file, line: lineOf(node), name: node.arguments[0].getText(sf).slice(0, 40), op: name + "()" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** 쓰기만 하는 Map/Set 을 한 파일에서 찾는다. analyzeTextbookIssues 가 파일마다 부른다. */
function collectWriteOnly(ts, sf, file, lineOf, out) {
  const WRITE = new Set(["set", "add", "delete", "clear"]);

  // [FP:exported-name-escapes-file] 내보낸 이름은 이 파일만 봐서는 판단할 수 없다 — 읽는 쪽이 다른 모듈에 있다.
  // react 의 `export const allNativeEvents = new Set()` 가 그랬다: 이 파일엔 .add 뿐이고
  // DOMPluginEventSystem 이 .forEach, ReactDOMEventHandle 이 .has 로 읽는다.
  // 코퍼스 검증에서 이 계열이 오탐의 전부였다. export 는 통째로 뺀다.
  const exported = new Set();
  const markExports = (n) => {
    if (ts.isVariableStatement(n) &&
        n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations)
        if (ts.isIdentifier(d.name)) exported.add(d.name.getText(sf));
    }
    // export { a, b } — 선언과 떨어져 있는 형태
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) exported.add((e.propertyName ?? e.name).getText(sf));
    }
    if (ts.isExportAssignment(n) && ts.isIdentifier(n.expression)) exported.add(n.expression.getText(sf));
    ts.forEachChild(n, markExports);
  };
  ts.forEachChild(sf, markExports);

  // 후보: const/let x = new Map()/new Set(). 이름 → 선언 노드
  const cand = new Map();
  const findDecls = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
        ts.isNewExpression(n.initializer) && ts.isIdentifier(n.initializer.expression)) {
      const ctor = n.initializer.expression.getText(sf);
      if (ctor === "Map" || ctor === "Set") {
        const name = n.name.getText(sf);
        if (exported.has(name)) return; // 모듈 밖에서 읽힐 수 있다
        // [FP:same-name-twice] 같은 이름이 두 번 선언되면(다른 스코프) 스코프 없이는 구분 못 한다 — 통째로 포기.
        cand.set(name, cand.has(name) ? null : { node: n, ctor });
      }
    }
    ts.forEachChild(n, findDecls);
  };
  ts.forEachChild(sf, findDecls);
  if (cand.size === 0) return;

  const reads = new Set();   // 한 번이라도 읽힌 이름
  const writes = new Map();  // 이름 → 쓰기 횟수
  const visit = (n) => {
    if (ts.isIdentifier(n) && cand.has(n.getText(sf))) {
      const name = n.getText(sf);
      const d = cand.get(name);
      // 선언의 이름 자리 자체는 참조가 아니다
      if (!(d && d.node && d.node.name === n)) {
        const p = n.parent;
        // [FP:write-return-value-is-read] 쓰기 메서드라도 **반환값을 쓰면 읽기다.** tailwind 의
        // `if (skipExit.delete(node)) return` 이 그랬다 — delete 는 있었는지 여부를
        // 돌려주고, 그 불리언이 곧 조회다. add/set 도 자기 자신을 돌려주므로
        // 체이닝하거나 인자로 넘기면 컬렉션이 밖으로 새어 나간다.
        // 그래서 '값이 버려지는 호출'일 때만 쓰기로 센다.
        const call = p && ts.isPropertyAccessExpression(p) && p.expression === n &&
          p.parent && ts.isCallExpression(p.parent) && p.parent.expression === p &&
          WRITE.has(p.name.getText(sf)) ? p.parent : null;
        const isWriteReceiver = !!call && ts.isExpressionStatement(call.parent);
        // 재할당(x = …)도 읽기로 친다 — 다른 값이 들어오면 이 분석의 전제가 깨진다.
        const isReassign =
          p && ts.isBinaryExpression(p) && p.left === n &&
          p.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        if (isWriteReceiver && !isReassign) writes.set(name, (writes.get(name) ?? 0) + 1);
        else reads.add(name);
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);

  // [FP:write-only-read-commented-out] 읽는 코드를 주석으로 꺼 둔 자리다 — 지우자는 PR 은 "다시 켤 것" 으로 닫힌다.
  // react devtools `hideElementsWithPaths` 는 `/* DISABLED: …/pull/28417 … for (… of hideElementsWithPaths) */` 였다(2026-10-09).
  const commented = (sf.text.match(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g) || []).join("\n");
  for (const [name, d] of cand) {
    if (!d) continue;                       // 같은 이름 중복 선언 — 판단 포기
    if (reads.has(name)) continue;          // 한 군데라도 읽으면 아니다
    if (new RegExp(`\\b${name}\\s*(\\.(size|has|get|forEach|keys|values|entries)\\b|\\))|\\bof\\s+${name}\\b`).test(commented)) continue;
    if (!writes.has(name)) continue;        // 만들기만 하고 안 건드리는 건 다른 문제(미사용 변수)
    // [FP:write-only-gc-retention] 객체가 수거되지 않게 참조만 들고 있는 보관용 컬렉션이다 — 읽지 않는 게 정상이다.
    // Electron Notification 은 참조를 잃으면 수거돼 클릭 핸들러가 사라진다(cindy `liveNotifications`), oh-my-pi `retainedShells`.
    if (/retain|alive|keepalive|^live[A-Z]|hold|pinned|strongRef/i.test(name)) continue;
    out.push({ file, line: lineOf(d.node), name, ctor: d.ctor, writes: writes.get(name) });
  }
}


function analyzeRenderGates(ts, fileContents) {
  const findings = [];

  for (const { file, content } of fileContents) {
    if (!/\.(tsx|jsx)$/.test(file)) continue;
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    // 훅이 물어다 주는 값(로딩이 있는 값)을 찾는다: const { data: x } = useSomething()
    const fetched = new Set();
    const findHookVars = (n) => {
      if (
        ts.isVariableDeclaration(n) &&
        n.initializer &&
        ts.isCallExpression(n.initializer) &&
        /^use[A-Z]/.test(
          ts.isPropertyAccessExpression(n.initializer.expression)
            ? n.initializer.expression.name.getText(sf)
            : n.initializer.expression.getText(sf),
        ) &&
        ts.isObjectBindingPattern(n.name)
      ) {
        for (const el of n.name.elements) {
          const source = (el.propertyName || el.name).getText(sf);
          if (source === "data") fetched.add(el.name.getText(sf));
        }
      }
      ts.forEachChild(n, findHookVars);
    };
    ts.forEachChild(sf, findHookVars);
    if (fetched.size === 0) continue;

    const rootName = (expr) => {
      let cur = expr;
      while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) cur = cur.expression;
      return ts.isIdentifier(cur) ? cur.getText(sf) : null;
    };

    /** 이 노드가 그 변수를 실제로 참조하는가 */
    const references = (node, name) => {
      let found = false;
      const scan = (n) => {
        if (found) return;
        if (ts.isIdentifier(n) && n.getText(sf) === name) found = true;
        else ts.forEachChild(n, scan);
      };
      scan(node);
      return found;
    };

    /** 게이트에 쓰인 fetch 변수들 */
    const gateVars = (expr) => {
      const names = new Set();
      const scan = (n) => {
        if (ts.isIdentifier(n) && fetched.has(n.getText(sf))) names.add(n.getText(sf));
        ts.forEachChild(n, scan);
      };
      scan(expr);
      return [...names];
    };

    const inspectGate = (testExpr, element) => {
      const vars = gateVars(testExpr);
      if (vars.length === 0) return;
      const el = ts.isJsxElement(element) ? element.openingElement : element;
      if (!el.attributes) return;
      const props = el.attributes.properties;
      if (props.length < 2) return; // 프롭이 거의 없으면 판단할 근거가 없다

      const dependent = props.filter((p) => vars.some((v) => references(p, v))).length;
      const ratio = dependent / props.length;
      if (ratio < HOSTAGE_DEP_RATIO) {
        findings.push({
          file,
          line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
          element: el.tagName ? el.tagName.getText(sf) : "?",
          gate: vars.join(", "),
          dependentProps: dependent,
          totalProps: props.length,
        });
      }
    };

    const walk = (n) => {
      // {data && <El .../>}
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        (ts.isJsxElement(n.right) || ts.isJsxSelfClosingElement(n.right))
      ) {
        inspectGate(n.left, n.right);
      }
      // {data ? <El .../> : null}
      if (ts.isConditionalExpression(n) && (ts.isJsxElement(n.whenTrue) || ts.isJsxSelfClosingElement(n.whenTrue))) {
        inspectGate(n.condition, n.whenTrue);
      }
      // 괄호로 감싼 JSX도 같은 취급
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ts.isParenthesizedExpression(n.right) &&
        (ts.isJsxElement(n.right.expression) || ts.isJsxSelfClosingElement(n.right.expression))
      ) {
        inspectGate(n.left, n.right.expression);
      }
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(sf, walk);
    void rootName;
  }

  return {
    hostages: findings.length,
    worst: findings.slice(0, 5),
  };
}



// 실행
console.log(`\n  분석 중... ${srcDir}\n`);

let files = collectFiles(srcDir);
if (files.length === 0) {
  console.error(`  파일을 찾을 수 없습니다: ${srcDir}`);
  process.exit(1);
}

// git 추적 파일만 분석 (빌드산출물·자동생성·gitignore 제외). git repo 아니면 폴백.
const trackedSet = gitTrackedSet(srcDir);
if (trackedSet) {
  const before = files.length;
  files = files.filter((f) => trackedSet.has(f));
  const removed = before - files.length;
  console.log(`  git 추적 파일만 분석 — 빌드산출물·미추적 ${removed}개 제외 (${files.length}개 대상)\n`);
  if (files.length === 0) {
    console.error(`  git 추적 소스 파일이 없습니다: ${srcDir}`);
    process.exit(1);
  }
} else {
  console.log(`  git repo 아님 — 파일시스템 전체 분석 (빌드산출물 포함될 수 있음)\n`);
}

// [FP:non-production-file] 비-프로덕션 파일 일관 제외: 테스트·타입테스트(.test-d)·`.unit.`(qwik)·벤치·스토리·__tests__.
// (중복 축에서만 걸러 다른 축엔 포함되던 불일치 제거 — 테스트 콜로케이션이 점수를 깎던 문제.)
// 점수는 "배포되는 프로덕션 코드"의 건강만 잰다. 테스트 존재 여부는 별도 신호.
// [FP:capitalized-specs-dir] cesium 은 테스트를 Specs/ 에 둔다(2026-11-25).
const NON_SOURCE_RE = /(\.(test|spec|test-d|unit|bench|benchmark|stories|e2e)\.[tj]sx?$)|(\/(__(tests?|mocks?|fixtures?|snapshots?)__|tests?|[Ss]pecs?|testdata|benchmarks?|__bench__|e2e|fixtures?|mocks?)\/)|(\.d\.ts$)/;
// 벤더링·생성 디렉토리: 저장소에 커밋된 서드파티 코드는 미니파이가 아니어도(개발 빌드는 읽기 가능)
// 사람이 쓴 코드가 아니다. 실제 사례: next.js의 src/compiled/ 45MB(react-dom 개발빌드 여러 벌)가
// 중복 82%·maxCog 997을 만들어 D 27을 찍게 했다 — 전부 벤더 코드였다.
const VENDORED_RE = /\/(compiled|vendor|vendored|third[-_]party|generated|codegen|\.generated|node_modules)\//;
// 배포물이 아닌 부속 디렉토리: 예제·샘플·데모·플레이그라운드·문서 사이트·빌드 스크립트·tmp.
// 저장소에는 있지만 사용자가 설치하는 물건이 아니라, 점수에 섞이면 "이 라이브러리 코드가
// 어떤 상태인가"라는 질문의 답을 흐린다(angular/packages/examples 6.4k줄 = 문서용 샘플).
const NON_SHIPPED_RE = /\/(examples?|samples?|demos?|playground|sandbox|website|scripts|tmp)\//;
// [FP:path-scope-outside-root] 위 세 정규식은 전부 "저장소 안에서의 자리"를 묻는다. 그런데 절대경로에 그대로 물리면
// 측정 대상 바깥의 디렉터리 이름이 판정을 뒤집는다 — /private/tmp 에 클론해서 재면
// NON_SHIPPED_RE 의 `tmp` 가 걸려 전 파일이 비-프로덕션으로 빠지고, 남은 게 0개라
// "파일 0개 · SSS 100점"이 나온다. 조용히 만점을 주는 오답이라 제일 나쁜 실패다.
// (실측 2026-08-10: storybook 을 /private/tmp 아래에서 재니 1559개가 전부 제외됐다.)
// 그래서 판정은 srcDir 기준 상대경로로만 한다. 앞의 "/" 는 최상위 디렉터리도
// `/(tests?)\//` 형태로 걸리게 하려고 붙인다.
function scanPath(absFile) {
  const rel = path.relative(srcDir, absFile).replace(/\\/g, "/");
  return rel.startsWith("..") ? absFile.replace(/\\/g, "/") : "/" + rel;
}

// 디렉터리뿐 아니라 파일명·머리말로도 생성물을 판별한다. 실제 사내 저장소에서
// `generated.ts`, `sample-rows.generated.ts`, 그리고 "자동 생성, 손수정 금지" migration이
// 수만 줄의 데이터 리터럴을 제품 코드로 위장했다. 이름만 migration인 파일은 실행 코드일 수
// 있으므로 제외하지 않고, 생성 사실을 명시한 강한 증거가 있을 때만 걷어낸다.
function isGeneratedSource(filePath, content) {
  const p = filePath.replace(/\\/g, "/");
  if (/(^|\/)(generated|codegen)\.[cm]?[jt]sx?$/i.test(p)) return true;
  if (/(^|\/)[^/]+\.(generated|codegen)\.[cm]?[jt]sx?$/i.test(p)) return true;
  const head = content.slice(0, 2400);
  return /@generated\b|code generated .*do not edit|auto(?:matically)?[- ]generated(?: file| by)?|this file (?:is )?generated|do not edit(?: this file)?|손수정\s*금지|자동\s*생성.{0,80}(?:수정\s*금지|손수정)/i.test(head);
}
// --exclude=pat1,pat2 — 모노레포에서 '측정 대상 산출물'이 아닌 하위 패키지 수동 제외.
// 자동 판별 불가한 판단(별도 제품인 devtools 앱, 저장소에 포크해 넣은 남의 툴)에만 쓴다.
// 각 사용처는 corpus-repos.json에 이유와 함께 기록된다 — 근거 없는 제외는 점수 세탁이다.
const excludePats = (getFlag("exclude") || "").split(",").map((s) => s.trim()).filter(Boolean);
const EXCLUDE_RES = excludePats.map((p) =>
  new RegExp(p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")));
{
  const before = files.length;
  files = files.filter((f) => {
    const p = scanPath(f);
    if (NON_SOURCE_RE.test(p) || VENDORED_RE.test(p) || NON_SHIPPED_RE.test(p)
      || EXCLUDE_RES.some((re) => re.test(p))) return false;
    try {
      return !isGeneratedSource(p, fs.readFileSync(f, "utf-8"));
    } catch {
      return true;
    }
  });
  const dropped = before - files.length;
  if (dropped > 0) {
    console.log(`  비-프로덕션·벤더·생성 파일(테스트·벤치·스토리·타입선언·compiled/vendor·generated·예제/스크립트) ${dropped}개 제외 (${files.length}개 분석)\n`);
  }
  if (excludePats.length) console.log(`  수동 제외(--exclude): ${excludePats.join(", ")}\n`);
}

// [FP:minified-bundle] 미니파이·번들 파일 제외: 저장소에 커밋된 벤더 번들·시드 에셋은 git 추적 대상이라
// 지금까지의 필터를 전부 통과하지만, 사람이 쓴 코드가 아니라 모든 축을 오염시킨다.
// (실제 사례: 시드 프로젝트의 번들 index.mjs 하나가 for...in 오탐 100곳 이상을 만들었다)
// 판정: 파일명 관례 또는 "한 줄이 비정상적으로 길다"(미니파이의 결정적 특징).
{
  const isMinified = (p) => {
    if (/\.(min|bundle)\.[cm]?js$/.test(p.replace(/\\/g, "/"))) return true;
    try {
      const text = fs.readFileSync(p, "utf-8");
      if (text.length < 500) return false;
      const lines = text.split("\n");
      const longest = lines.reduce((m, l) => (l.length > m ? l.length : m), 0);
      const avg = text.length / lines.length;
      return longest > 2000 || avg > 200;
    } catch {
      return false;
    }
  };
  const before = files.length;
  files = files.filter((f) => !isMinified(f));
  const dropped = before - files.length;
  if (dropped > 0) {
    console.log(`  미니파이·번들 파일 ${dropped}개 제외 — 사람이 쓴 코드가 아님 (${files.length}개 분석)\n`);
  }
}

// 자잘 파일 제외: 코드 5줄 미만은 진단할 거리가 없다.
const TRIVIAL_MIN_CODE = 5;
{
  const before = files.length;
  files = files.filter((f) => {
    try {
      return countLines(fs.readFileSync(f, "utf-8")).code >= TRIVIAL_MIN_CODE;
    } catch {
      return false;
    }
  });
  const dropped = before - files.length;
  if (dropped > 0) {
    console.log(`  자잘 파일(코드 <${TRIVIAL_MIN_CODE}줄) ${dropped}개 제외 (${files.length}개 분석)\n`);
  }
}

// 여기까지 오는 동안 파일이 전부 걸러졌으면 멈춘다. 0개를 훑으면 "고칠 것 없음"이 나오는데,
// 그건 "깨끗하다"가 아니라 "아무것도 안 봤다"이다. 침묵하는 0건보다 실패가 낫다.
// 필터가 여러 겹이라(제외 규칙 · 미니파이 · 자잘 파일) 마지막 한 곳에서만 본다.
if (files.length === 0) {
  console.error(`  분석할 프로덕션 파일이 없습니다 — 후보가 전부 제외되었습니다.`);
  console.error(`  --dir 이 테스트·예제·벤더 디렉터리를 가리키는지, --exclude 가 너무 넓은지,`);
  console.error(`  대상이 코드 ${TRIVIAL_MIN_CODE}줄 미만 파일뿐인지 확인하세요.\n`);
  process.exit(1);
}

const ts = loadTypescript();
if (!ts) {
  console.error("  typescript 를 찾지 못했습니다. 진단은 AST 로만 합니다 — 대상이나 이 도구에 typescript 를 설치하세요.");
  process.exit(1);
}
let codeLines = 0;
const fileContents = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  codeLines += countLines(content).code;
  fileContents.push({ file: relDisplay(file), content });
}

const quality = {
  io: analyzeIoDensity(ts, fileContents),
  renderGates: analyzeRenderGates(ts, fileContents),
  quadratic: analyzeQuadraticLookups(ts, fileContents),
  serialAwait: analyzeSerialAwaits(ts, fileContents),
  nplusOne: analyzeNPlusOne(ts, fileContents),
  coupling: analyzeCoupling(ts, fileContents),
  textbook: analyzeTextbookIssues(ts, fileContents),
};

// 직전 실행의 후보와 비교해 신규·유지·해소를 가른다. 해소 = 고친 것.
const statePath = path.resolve(process.cwd(), ".fixearly-sweep.json");
const stateKey = path.relative(process.cwd(), srcDir) || ".";
let state = { version: 1, scans: {} };
try {
  const loaded = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  if (loaded && loaded.version === 1 && loaded.scans && typeof loaded.scans === "object") state = loaded;
} catch { /* 첫 실행 또는 손상된 로컬 기준선 */ }
let sha = null;
try {
  sha = execFileSync("git", ["-C", DISPLAY_BASE, "rev-parse", "--short=12", "HEAD"], {
    encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
  }).trim() || null;
} catch { /* git 밖의 소스도 훑을 수 있다 */ }
const readLine = (file, line) => {
  if (!line || file === "(unknown)") return "";
  try { return fs.readFileSync(path.resolve(DISPLAY_BASE, file), "utf-8").split("\n")[line - 1] || ""; }
  catch { return ""; }
};
const sweep = buildSweepDecision(quality, { previous: state.scans[stateKey]?.candidates || [], readLine, sha });
state.scans[stateKey] = { at: sweep.at, rules: RULES_VERSION, sha, candidates: sweep.candidates };
try { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); }
catch { /* 읽기 전용 환경에서도 결과는 낸다 */ }

console.log(`  ${files.length}개 파일 · 코드 ${codeLines.toLocaleString()}줄\n`);
for (const line of sweepConsoleLines(sweep, wantAll ? Infinity : 20)) console.log(line);
if (!wantAll && sweep.candidates.length > 20) console.log(`    … 외 ${sweep.candidates.length - 20}개 (--all 로 전체)`);
const thanks = thanksUrl(sweep);
if (thanks) console.log(`\n  고친 게 있다면 숫자만 남겨 주세요 (코드·경로는 안 들어갑니다):\n    ${thanks}`);

if (wantMine) {
  const list = quality.quadratic.candidateList || [];
  console.log(`\n  ── --mine: O(n²) 후보 전체 ${list.length}곳 (손검증 대상) ──`);
  for (const c of list) {
    console.log(`    ${c.coGrows ? "[같이자람]" : "[m작음?]"} [${c.zone}] ${c.recv}.${c.method}() — ${c.file}:${c.line}${c.outer ? `  (loop: ${c.outer})` : ""}`);
  }
}

// --deps : 락파일의 (이름, 버전)을 OSV.dev 에 물어 취약점을 받는다.
let deps = null;
if (wantDeps) {
  try {
    const { auditDeps, auditDeprecated } = await import("./deps-audit.mjs");
    const vulns = await auditDeps(DISPLAY_BASE);
    // 저자가 접은 패키지도 같이 본다 — 취약점이 0건이어도 "지금 이걸 쓰고 있는 게 맞나"는 남는다.
    const dropped = await auditDeprecated(DISPLAY_BASE);
    deps = [...vulns, ...dropped].sort((a, b) => b.weight - a.weight);
    console.log("");
    if (!vulns.length) console.log("  의존성: 알려진 취약점 없음 (OSV.dev)");
    else {
      console.log(`  의존성 취약점 ${vulns.length}건 (OSV.dev)`);
      for (const d of vulns.slice(0, 5)) {
        console.log(`    ${d.what}${d.fixed ? ` → ${d.fixed} 로 올리면 끝` : " · 고쳐진 버전 없음"}`);
      }
      if (vulns.length > 5) console.log(`    … 외 ${vulns.length - 5}건`);
    }
    if (dropped.length) {
      console.log(`  저자가 중단 선언한 직접 의존 ${dropped.length}건 (npm registry)`);
      for (const d of dropped.slice(0, 5)) {
        console.log(`    ${d.what.replace(" — 저자가 중단 선언", "")}${d.latestDeprecated ? ` · 최신(${d.latest})도 중단 — 갈아타야 함` : ` → ${d.latest} 로 올리면 끝`}`);
      }
      if (dropped.length > 5) console.log(`    … 외 ${dropped.length - 5}건`);
    }
  } catch (e) {
    // 못 물어본 것과 0건은 다른 결과다 — 조용히 0건으로 만들지 않는다.
    console.error(`  의존성 점검 실패: ${e.message}`);
  }
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "fixearly.json");
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  rules: RULES_VERSION,
  source: { dir: relDisplay(srcDir) || ".", files: files.length, codeLines },
  diagnostics: quality,
  sweep,
  ...(deps ? { deps } : {}),
}, null, 2));
if (wantMine) fs.writeFileSync(path.join(outDir, "quadratic-candidates.json"), JSON.stringify(quality.quadratic.candidateList || [], null, 2));
console.log(`\n  저장됨 → ${path.relative(process.cwd(), outPath)}\n`);
