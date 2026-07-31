#!/usr/bin/env node
/**
 * fixearly — 다음에 이 코드를 고칠 때 드는 비용을 잰다.
 *
 * Usage:
 *   npx fixearly --dir=src                # 점수·등급 (git 추적 파일만, 빌드산출물 제외)
 *   npx fixearly --dir=src --report       # 한 장짜리 HTML 리포트 (위치·고칠 목록·AI 지시문)
 *   npx fixearly --dir=src --hotspots     # 복잡도 × 변경빈도 = 먼저 고칠 파일
 *   npx fixearly --dir=src --dead         # (선택) knip 데드코드축 — 느림. // @keep 파일 제외
 *   npx fixearly --dir=src --badge        # README 배지 SVG
 *   npx fixearly --dir=src --exclude=a,b  # 모노레포에서 산출물 아닌 패키지 제외
 *   npx fixearly --dir=src --kit          # (선택) @m1kapp/kit 사용 현황 부가 집계
 *
 * 측정할 때마다 .fixearly-history.json 에 스냅샷이 쌓이고, 리포트에 '지난번 대비'가 나온다.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { execFileSync } from "child_process";

const args = process.argv.slice(2);
const getFlag = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : undefined;
};

const srcDir = path.resolve(process.cwd(), getFlag("dir") || "src");
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
const wantDead = args.includes("--dead"); // 데드코드축(knip) 옵트인 — 느리므로 기본 off
const wantBadge = args.includes("--badge"); // README·사이트 임베드용 SVG 배지 생성
const wantMine = args.includes("--mine");   // O(n²) PR 후보 전체 덤프(손검증 파이프라인 입력)
const wantReport = args.includes("--report") || !!getFlag("report"); // 한 장짜리 HTML 리포트
const wantHotspots = args.includes("--hotspots");
// @m1kapp/kit 사용 현황은 부가 정보라 옵트인이다. 범용 도구가 특정 패키지 이름을
// 기본 경로에서 찾고 있으면 "저자 라이브러리를 광고한다"는 인상을 준다.
const wantKit = args.includes("--kit"); // cog × git churn = "먼저 고칠 파일" 랭킹(git 이력 필요)

// 채점 규칙 버전. 유예값·기울기·캡을 바꾸면 이 값을 올려야 한다 —
// 그러지 않으면 규칙이 바뀐 뒤의 점수를 예전 점수와 나란히 놓게 되고, 진행도가 거짓말을 한다.
const SCORING_VERSION = "v12";

// 등급 색 (라이트 기준) — 배지·임베드 공용
const GRADE_COLORS = { S: "#0f7a63", A: "#12915a", B: "#7d8a2c", C: "#c0862e", D: "#cb4436", E: "#8f2f24" };

// shields 스타일 SVG 배지 생성 — "fixearly | A · 90"
function makeBadgeSvg(grade, score) {
  const left = "fixearly";
  const right = `${grade} · ${score}`;
  const color = GRADE_COLORS[String(grade).replace("+", "")] || "#888";
  const cw = 6.6; // 대략적 글자 폭(px, 11pt)
  const lw = Math.round(left.length * cw) + 16;
  const rw = Math.round(right.length * cw) + 18;
  const w = lw + rw;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(left)}: ${esc(right)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#3b3b40"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11">
    <text x="${lw / 2}" y="14">${esc(left)}</text>
    <text x="${lw + rw / 2}" y="14" font-weight="bold">${esc(right)}</text>
  </g>
</svg>`;
}

// kit의 meta.json에서 실제 측정된 LOC 로드
let KIT_FEATURES = {};
let kitVersion = "unknown";
let kitTotalFeatures = { component: 0, hook: 0, util: 0 };

// meta.json 탐색: require.resolve → node_modules 직접 탐색 → 상위 디렉토리
function findMeta() {
  // 1. require.resolve
  try {
    const require = createRequire(path.resolve(process.cwd(), "package.json"));
    return require.resolve("@m1kapp/kit/dist/meta.json");
  } catch {}

  // 2. node_modules에서 직접 탐색
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "@m1kapp", "kit", "dist", "meta.json");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }

  // 3. kit 저장소 안에서 직접 실행하는 경우 (cwd/dist/meta.json)
  const cwdMeta = path.resolve(process.cwd(), "dist", "meta.json");
  if (fs.existsSync(cwdMeta)) return cwdMeta;

  // 4. 이 스크립트가 kit 안에 있으면 형제 dist/ 탐색
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const siblingMeta = path.join(scriptDir, "..", "dist", "meta.json");
  if (fs.existsSync(siblingMeta)) return siblingMeta;

  return null;
}

// 점수는 kit과 무관하다. meta.json 은 --kit 옵트인일 때만 찾는다 —
// 범용 도구가 기본 경로에서 특정 패키지를 뒤지면 "저자 라이브러리 광고"로 읽힌다.
const metaPath = wantKit ? findMeta() : null;
let hasKitMeta = false;
if (metaPath) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    KIT_FEATURES = meta.features || {};
    kitVersion = meta.version || "unknown";
    for (const f of Object.values(KIT_FEATURES)) {
      kitTotalFeatures[f.category] = (kitTotalFeatures[f.category] || 0) + 1;
    }
    hasKitMeta = Object.keys(KIT_FEATURES).length > 0;
  } catch {}
}

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

// knip 바이너리 위치 탐색: kit 내장(우선) → 타겟 node_modules → 없으면 null
function resolveKnipBin() {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const candidates = [
    path.join(scriptDir, "..", "node_modules", "knip", "bin", "knip.js"),
  ];
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    candidates.push(path.join(dir, "node_modules", "knip", "bin", "knip.js"));
    dir = path.dirname(dir);
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

// 파일 상단에 // @keep 주석 있으면 데드 집계서 제외 (의도된 유지 = 코드밖 호출자·크론·웹훅 등)
function hasKeepAnnotation(absPath) {
  try {
    const head = fs.readFileSync(absPath, "utf-8").slice(0, 2000);
    return /@keep\b/.test(head);
  } catch {
    return false;
  }
}

// 데드코드축: knip을 git 루트서 1회 돌리고, 채점 중인 dir 하위로 귀속. @keep 화이트리스트 적용.
function analyzeDeadCode(dir, analyzedSet) {
  let gitRoot;
  try {
    gitRoot = execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    console.log("  [dead] git repo 아님 — 데드코드축 건너뜀\n");
    return null;
  }
  const knipBin = resolveKnipBin();
  if (!knipBin) {
    console.log("  [dead] knip 미설치 — 데드코드축 건너뜀 (npm i -O knip)\n");
    return null;
  }
  console.log("  [dead] knip 분석 중... (프로젝트 전체, 수십초~분)\n");
  let raw;
  try {
    raw = execFileSync("node", [knipBin, "--reporter", "json", "--no-progress"], {
      cwd: gitRoot, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (e) {
    // knip은 이슈 발견 시 exit 1 — stdout은 여전히 유효
    raw = e.stdout ? e.stdout.toString() : "";
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.log("  [dead] knip 출력 파싱 실패 — 건너뜀\n");
    return null;
  }
  const issues = Array.isArray(parsed) ? parsed : parsed.issues || [];
  let deadFiles = 0, keptFiles = 0, unusedExports = 0;
  const deadFileList = [];
  for (const it of issues) {
    const abs = path.resolve(gitRoot, it.file || "");
    if (!abs.startsWith(dir + path.sep) && abs !== dir) continue; // 채점 dir 밖 제외
    // 실제 분석 대상 파일만 — 테스트·벤치·타입선언·자잘 파일은 점수 파일집합에서 이미 빠졌으므로
    // 데드 집계에서도 빼야 일관된다(knip은 .test/benchmarks도 "미사용"으로 보고 → 오집계·pct>100 방지).
    if (analyzedSet && !analyzedSet.has(abs)) continue;
    const fileIsDead = Array.isArray(it.files) && it.files.length > 0;
    const keep = hasKeepAnnotation(abs);
    if (fileIsDead) {
      if (keep) { keptFiles++; continue; }
      deadFiles++;
      if (deadFileList.length < 15) deadFileList.push(path.relative(gitRoot, abs));
      continue;
    }
    if (keep) continue; // @keep 파일의 export는 집계 안 함
    unusedExports +=
      (it.exports?.length || 0) + (it.types?.length || 0) + (it.enumMembers?.length || 0);
  }
  return { deadFiles, keptFiles, unusedExports, worst: deadFileList };
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

// 줄 단위 "코드인가" 플래그 — 함수의 자기 줄수를 셀 때 쓴다.
// 주석·빈 줄을 세면 문서가 두꺼운 코드가 불리해진다(실측: lodash runInContext가 자기줄
// 10,580줄로 나왔는데 대부분이 중첩 함수 사이의 JSDoc이었다). 읽는 부담은 코드 줄이다.
function codeLineFlags(content) {
  return content.split("\n").map((line) => {
    const t = line.trim();
    return !!t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  });
}

// 코드 품질 분석 — 분기 밀도·파일 크기 기반 휴리스틱 (typescript 미설치 시 폴백)
// 주석/문자열 안까지 세는 러프한 근사지만, 프로젝트 간 상대 비교엔 충분
function analyzeQuality(content) {
  const branchTokens = content.match(/\bif\s*\(|\belse\b|\bcase\s|\bcatch\s*[({]|\?\s*[^.:]|&&|\|\|/g);
  const fnTokens = content.match(/\bfunction\b|=>/g);
  return { branches: branchTokens?.length || 0, functions: fnTokens?.length || 0 };
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

// AST 기반 함수별 복잡도 — cyclomatic(McCabe) + cognitive(SonarQube 근사)
// cognitive: 중첩 깊이 가중(+1+depth), 같은 논리 연산자 연쇄(a && b && c)는 1회만,
// ??는 카운트 제외(null 정규화는 복잡성이 아님). 중첩 함수는 별도 함수로 분리 집계
function analyzeAstComplexity(ts, filePath, content) {
  const kind = /\.(tsx|jsx)$/.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);

  const isFnLike = (n) =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n);

  // 코드 줄 누적합 — [a,b] 구간의 코드 줄 수를 O(1)로 얻는다.
  const isCode = codeLineFlags(content);
  const codePrefix = new Int32Array(isCode.length + 1);
  for (let i = 0; i < isCode.length; i++) codePrefix[i + 1] = codePrefix[i] + (isCode[i] ? 1 : 0);
  const codeLinesIn = (a, b) => codePrefix[Math.min(b, isCode.length)] - codePrefix[Math.max(0, a - 1)];

  const fnName = (n) => {
    if (n.name) return n.name.getText(sf);
    const p = n.parent;
    if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
    if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
    return "(anonymous)";
  };

  const ccOf = (fn) => {
    let cc = 1;
    const walk = (n) => {
      if (n !== fn && isFnLike(n)) return; // 중첩 함수는 자기 항목에서 계산
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
          cc++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const op = n.operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) cc++;
          break;
        }
      }
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(fn, walk);
    return cc;
  };

  // cognitive complexity (SonarQube 근사)
  // - 제어 구조: +1 + 현재 중첩 깊이, 내부는 깊이+1
  // - 논리 연산자: 같은 연산자 연쇄당 1회 (&&→|| 전환 시 +1), ?? 제외
  // - 삼항: +1+depth, else(if 아닌): +1
  // 같은 cog 라도 읽는 비용이 다르다. 평평한 가드 절 8개(`if (!x) return`)와 3단 중첩은
  // S3776 정의상 둘 다 8점이 될 수 있지만, 앞은 순서대로 읽으면 끝나고 뒤는 상태를 머리에 쌓아야 한다.
  // 실측 사례: ytcc-next POST() cog 17 = 가드 8개(깊이 1) vs LandscapeStage cog 16 = 조건부 렌더 3단.
  // 전자를 "고쳐라"라고 띄우면 도구가 틀린 일감을 만든다. 그래서 깊이를 따로 잰다.
  // 점수엔 넣지 않는다 — 리포트의 우선순위 판정에만 쓴다(감점 축이 되면 곧바로 게이밍 대상이 된다).
  const cognitiveOf = (fn) => {
    let score = 0;
    let guardScore = 0; // cog 중 '가드 절'이 낸 몫
    let maxNest = 0;
    const dive = (d) => {
      if (d > maxNest) maxNest = d;
      return d;
    };
    // 가드 절 = else 없이 곧장 빠져나가는 if. `if (!url) return 400;`
    // 이런 분기는 하나씩 읽고 잊으면 되므로 머리에 쌓이지 않는다 — 중첩과 비용이 다르다.
    const EXITS = new Set([
      ts.SyntaxKind.ReturnStatement,
      ts.SyntaxKind.ThrowStatement,
      ts.SyntaxKind.ContinueStatement,
      ts.SyntaxKind.BreakStatement,
    ]);
    const isGuard = (n) => {
      if (n.elseStatement) return false;
      const t = n.thenStatement;
      if (!t) return false;
      if (EXITS.has(t.kind)) return true;
      // 블록이면 마지막이 탈출이고 그 앞은 부수효과 몇 줄까지만(로그·정리) 허용
      if (ts.isBlock(t) && t.statements.length > 0 && t.statements.length <= 3) {
        return EXITS.has(t.statements[t.statements.length - 1].kind);
      }
      return false;
    };
    const LOGICAL = new Set([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken]);
    // 직접 재귀 판별용 자기 이름(타입체커가 없으므로 이름 매칭 — bare identifier 호출만, 오탐 최소화).
    const selfName = fnName(fn);
    const validSelf = /^[A-Za-z_$][\w$]*$/.test(selfName);
    const walk = (n, depth, parentLogicalOp) => {
      if (n !== fn && isFnLike(n)) return; // 중첩 함수는 자기 항목에서 계산
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement: {
          walkIf(n, depth, false);
          return;
        }
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ConditionalExpression: {
          score += 1 + depth;
          ts.forEachChild(n, (c) => walk(c, dive(depth + 1), null));
          return;
        }
        case ts.SyntaxKind.SwitchStatement: {
          score += 1 + depth; // switch 전체 1회 (case별 아님)
          ts.forEachChild(n, (c) => walk(c, dive(depth + 1), null));
          return;
        }
        case ts.SyntaxKind.BinaryExpression: {
          const op = n.operatorToken.kind;
          if (LOGICAL.has(op)) {
            if (op !== parentLogicalOp) score += 1; // 연쇄의 시작에서만
            walk(n.left, depth, op);
            walk(n.right, depth, op);
            return;
          }
          break;
        }
        case ts.SyntaxKind.BreakStatement:
        case ts.SyntaxKind.ContinueStatement: {
          if (n.label) score += 1; // 라벨 점프(break/continue LABEL): 구조 +1, 중첩 없음
          return;
        }
        case ts.SyntaxKind.CallExpression: {
          // 직접 재귀 selfName(...) : 구조 +1. this.foo()·간접 재귀는 오탐 방지로 제외.
          if (validSelf && ts.isIdentifier(n.expression) && n.expression.text === selfName) score += 1;
          break; // 인자는 아래 forEachChild 로 계속 walk
        }
      }
      ts.forEachChild(n, (c) => walk(c, depth, null));
    };
    // S3776: if 는 구조 증가(+1) + 중첩 증가(+depth). else-if·else 는 구조 증가(+1)만, 중첩 증가 없음.
    // else-if 를 IfStatement 케이스로 되돌리면 중첩분(+depth)이 잘못 더해진다(루프 안에 있을 때 과대계상).
    const walkIf = (n, depth, isElseIf) => {
      const inc = isElseIf ? 1 : 1 + depth;
      score += inc;
      if (!isElseIf && isGuard(n)) guardScore += inc;
      walk(n.expression, depth, null);
      walk(n.thenStatement, dive(depth + 1), null);
      if (n.elseStatement) {
        if (n.elseStatement.kind === ts.SyntaxKind.IfStatement) {
          walkIf(n.elseStatement, depth, true); // else-if: 구조 +1만, 깊이 유지
        } else {
          score += 1; // else 자체(구조 +1)
          walk(n.elseStatement, dive(depth + 1), null);
        }
      }
    };
    ts.forEachChild(fn, (c) => walk(c, 0, null));
    return { cog: score, nest: maxNest, guard: guardScore };
  };

  const fns = [];
  const collect = (n) => {
    if (isFnLike(n) && (n.body || ts.isArrowFunction(n))) {
      const startLine = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      const endLine = sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
      // 자기 줄수 = 전체 범위 − 직속 중첩 함수들이 차지한 줄. 중첩분을 빼지 않으면
      // 모듈을 감싼 IIFE 하나가 파일 전체를 자기 길이로 신고한다(실측: typescript 52,715줄,
      // lodash 17,251줄 — 둘 다 래퍼였다). 사람이 한 번에 읽는 양은 자기 몸통뿐이다.
      let nestedCode = 0;
      const codeOf = (x) => codeLinesIn(
        sf.getLineAndCharacterOfPosition(x.getStart(sf)).line + 1,
        sf.getLineAndCharacterOfPosition(x.getEnd()).line + 1);
      const scanNested = (x) => {
        if (x !== n && isFnLike(x)) { nestedCode += codeOf(x); return; } // 손자는 자식에 포함
        ts.forEachChild(x, scanNested);
      };
      ts.forEachChild(n, scanNested);
      const cogInfo = cognitiveOf(n);
      fns.push({
        name: fnName(n),
        cc: ccOf(n),
        cog: cogInfo.cog,
        nest: cogInfo.nest,   // 최대 중첩 깊이
        guard: cogInfo.guard, // cog 중 가드 절이 낸 몫 — 높으면 검증 파이프라인이라 쪼갤 이유가 없다
        line: startLine,
        // 함수 길이 — 파일 크기 대신 "한 번에 읽어야 하는 양"의 직접 측정치.
        // 파일 크기는 배치 관습(라이브러리=몰아넣기 vs 앱=쪼개기)에 좌우되고,
        // 의미 없는 파일 분할로 조작된다. 함수 길이는 둘 다에 영향받지 않는다.
        lines: Math.max(1, codeLinesIn(startLine, endLine) - nestedCode),
        span: endLine - startLine + 1,
      });
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);
  return fns;
}

// 중복 코드 감지 — 토큰 정규화(식별자/리터럴 치환) + 슬라이딩 윈도우 해시 (jscpd 라이트)
// import 줄은 제외 (정규화하면 모든 import가 동일해져 가짜 중복 발생)
const DUP_WINDOW = 50; // 토큰 수 ≈ 코드 5~8줄

function tokenizeNormalized(ts, filePath, content) {
  // import/export-from 줄 제거
  const stripped = content
    .split("\n")
    .map((l) => (/^\s*(import\s|export\s+(\{|\*).*\sfrom\s)/.test(l) ? "" : l))
    .join("\n");
  const kind = /\.(tsx|jsx)$/.test(filePath) ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ true, kind, stripped);
  const lineStarts = [0];
  for (let i = 0; i < stripped.length; i++) if (stripped.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const lineOfOffset = (pos) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
  const tokens = [];
  const lines = [];
  let tok = scanner.scan();
  while (tok !== ts.SyntaxKind.EndOfFileToken) {
    let norm;
    // 식별자 원문 유지 — 이전엔 전부 "I"로 정규화했으나, 스키마/타입 라이브러리처럼
    // 구조가 일관된 코드(parseUser vs parseOrder)를 전부 복붙으로 오인해 존경 OSS(zod 34%·
    // valibot 67%)를 학살했다. 원문 유지 시 '정확한 복붙'은 여전히 잡히고(네거티브 검증 99%),
    // 구조적 유사 오탐만 제거된다. 트레이드: 변수명 바꾼 복붙은 못 잡음(정밀도 우선).
    if (tok === ts.SyntaxKind.Identifier) norm = scanner.getTokenText();
    else if (tok === ts.SyntaxKind.JsxText) { tok = scanner.scan(); continue; } // 마크업 텍스트 제외
    else if (tok === ts.SyntaxKind.StringLiteral || tok === ts.SyntaxKind.NoSubstitutionTemplateLiteral || tok === ts.SyntaxKind.NumericLiteral) norm = scanner.getTokenText();
    else norm = String(tok);
    tokens.push(norm);
    // 토큰 시작 위치의 줄 번호 — 줄 시작 오프셋을 한 번만 만들고 이진탐색한다.
    // (예전엔 토큰마다 slice+split 해서 파일 길이의 제곱으로 느려졌다. 20k줄 파일이 80초 걸렸다.)
    lines.push(lineOfOffset(scanner.getTokenStart()));
    tok = scanner.scan();
  }
  return { tokens, lines };
}

function analyzeDuplication(ts, fileContents) {
  // 테스트 파일은 제외 — 반복 구조(케이스 나열)가 본질이라 중복 밀도를 왜곡
  const perFile = fileContents
    .filter(({ file }) => !/\.(test|spec)\.[tj]sx?$/.test(file))
    .map(({ file, content }) => ({
      file,
      ...tokenizeNormalized(ts, file, content),
    }));

  // 윈도우 해시 → 등장 위치 목록
  const seen = new Map(); // hash → [{fi, idx}]
  perFile.forEach((f, fi) => {
    for (let i = 0; i + DUP_WINDOW <= f.tokens.length; i++) {
      let h = 5381;
      for (let k = 0; k < DUP_WINDOW; k++) {
        const s = f.tokens[i + k];
        for (let c = 0; c < s.length; c++) h = ((h * 33) ^ s.charCodeAt(c)) >>> 0;
      }
      const arr = seen.get(h);
      if (arr) {
        // 해시 충돌 방어: 같은 해시라도 실제 토큰열이 같은지 확인(32비트 djb2는 대형 repo에서
        // 생일역설로 가짜 중복을 만들 수 있다). 첫 항목과 토큰 단위로 대조한다.
        const ref = arr[0];
        let same = true;
        for (let k = 0; k < DUP_WINDOW; k++) {
          if (perFile[ref.fi].tokens[ref.idx + k] !== f.tokens[i + k]) { same = false; break; }
        }
        if (same) arr.push({ fi, idx: i });
        else { const key = h + ":" + i; seen.set(key, [{ fi, idx: i }]); }
      } else seen.set(h, [{ fi, idx: i }]);
    }
  });

  // 형제 변종(빌드 타깃별 사본) 판별용 서명: 경로에서 번들러/런타임 변종 표시를 지운 것.
  // react 는 같은 파일을 react-server-dom-{webpack,turbopack,esm,parcel,unbundled,fb} 로 의도적 복제한다.
  // 이런 사본끼리의 일치는 사람이 만든 복붙이 아니라 빌드 타깃 매트릭스라 중복으로 세면 안 된다.
  const VARIANT_WORDS = "webpack|turbopack|parcel|rollup|vite|esbuild|esm|cjs|umd|iife|browser|node|edge|worker|native|fb|unbundled|bundled|legacy|modern";
  // 경로 세그먼트의 변종 표시(react-server-dom-webpack) + 파일명 안의 변종 토큰
  // (ReactFlightWebpackNodeLoader vs ReactFlightUnbundledNodeLoader) 둘 다 지운 서명을 만든다.
  const SEG_RE = new RegExp(`(^|[-_.])(${VARIANT_WORDS})(?=$|[-_./])`, "gi");
  const NAME_RE = new RegExp(`(${VARIANT_WORDS})`, "gi");
  const variantSig = (file) => {
    const norm = file.replace(/\\/g, "/");
    const i = norm.lastIndexOf("/");
    const dir = norm.slice(0, i + 1).replace(SEG_RE, "$1");
    const base = norm.slice(i + 1).replace(NAME_RE, "");
    return (dir + base).replace(/\/+/g, "/");
  };
  const sigOf = perFile.map((f) => variantSig(f.file));

  // 2회 이상 등장한 윈도우가 덮는 토큰 마킹
  const dupMask = perFile.map((f) => new Uint8Array(f.tokens.length));
  const blockKeys = new Set(); // 대표 위치 수집용
  const examples = new Map(); // hash → [위치 문자열]
  let variantSkipped = 0;
  for (const [h, locs] of seen) {
    if (locs.length < 2) continue;
    // 같은 파일 안 인접 중첩(자기 자신과 1토큰 시프트) 제외: 서로 다른 위치 그룹만
    const distinct = locs.filter((a, i) => locs.findIndex((b) => b.fi === a.fi && Math.abs(b.idx - a.idx) < DUP_WINDOW) === i);
    if (distinct.length < 2) continue;
    // 형제 변종 가드: 등장 위치가 전부 '같은 서명'의 파일들이면 빌드 타깃 사본 → 중복 아님
    if (new Set(distinct.map((d) => sigOf[d.fi])).size === 1 &&
        new Set(distinct.map((d) => d.fi)).size > 1) { variantSkipped++; continue; }
    for (const { fi, idx } of distinct) {
      dupMask[fi].fill(1, idx, idx + DUP_WINDOW);
    }
    blockKeys.add(h);
    if (examples.size < 200 && !examples.has(h)) {
      examples.set(h, distinct.slice(0, 3).map(({ fi, idx }) => `${perFile[fi].file}:${perFile[fi].lines[idx]}`));
    }
  }

  let dupTokens = 0;
  let totalTokens = 0;
  const byFile = new Map();
  perFile.forEach((f, fi) => {
    totalTokens += f.tokens.length;
    let d = 0;
    for (let i = 0; i < dupMask[fi].length; i++) d += dupMask[fi][i];
    dupTokens += d;
    if (d > 0) byFile.set(f.file, d);
  });

  const percent = totalTokens > 0 ? Math.round((dupTokens / totalTokens) * 1000) / 10 : 0;
  const worstFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([file, d]) => ({ file, dupTokens: d }));
  // 대표 중복 블록 예시 (여러 위치에 나타나는 것 우선)
  const worstBlocks = [...examples.values()].sort((a, b) => b.length - a.length).slice(0, 3);

  return { percent, dupTokens, totalTokens, blocks: blockKeys.size, worstFiles, worstBlocks, variantSkipped };
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
// 빌트인 컬렉션/프로토타입 메서드 — 타입정보 없이 이름만으로는 유저함수와 구분 불가.
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
      /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
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
        // DB/HTTP N+1: 루프 안에서 '직접 await' 하는 데이터 호출. Promise.all(map) 배칭은
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
  if (/\/(api|server|services?|routes?|controllers?|use-?cases?|repositor\w*|workflows?|queues?|handlers?|resolvers?|jobs?|tasks?)\//.test(file))
    return "backend";
  // frontend is signalled by the JSX extension or explicit component/client dirs — not a bare `/admin/`.
  if (/\.(tsx|jsx)$|\/components?\/|\/dashboard\/|\/client\/|\/ui\//.test(file)) return "frontend";
  return "other";
}
// 루프 반복대상이 배열 리터럴이면 유계(바운드), 식별자·프로퍼티·호출이면 유저데이터일 개연 → dynamic.
function quadOuterDynamic(text) {
  if (!text) return true; // 알 수 없으면 후보 쪽으로(보수적)
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
  const root = text.split(/[.[(]/)[0].trim();
  if (!root) return false;
  if (CONSTish.test(root)) return true;
  return moduleConsts.has(root);
}

// ② 루프 본문이 I/O 를 기다리면 CPU 조회 비용은 반올림 오차다.
//    cypress screenshot 건: 매칭 직후 파일마다 fs.stat + 업로드 — 그쪽이 압도한다.
const QUAD_IO_HINT =
  /\b(prisma|knex|repository|repo|dataSource|entityManager|redis|cache|s3|storage|axios|fetch|http|client|api|sdk|queue|stripe|supabase|clickhouse|mongo)\b|\b(readFile|readdir|stat|writeFile)\b/i;
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
    const kind = /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
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
      const walkDecl = (n) => {
        if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isPropertyDeclaration(n)) &&
            n.name && ts.isIdentifier(n.name) && looksArray(n.initializer, n.type)) {
          const nm = n.name.getText(sf);
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
            sites.push({
              file, line: lineOf(node), recv, method,
              kind: QUADRATIC_GROUP_METHODS.has(method) ? "group" : "lookup",
              zone, outer: outerText || null, dynamicOuter,
              cuts: cuts.length ? cuts : null,
              // PR 우선순위: 백엔드 + 무계 반복이 최상, 게이트에 걸린 건 최하로 민다.
              rank: (QUAD_ZONE_RANK[zone] ?? 2) * 2 + (dynamicOuter ? 1 : 0) - cuts.length * 4,
            });
          }
        }
        // 순회 메서드(map/forEach…)에 넘긴 콜백 본문도 루프로 취급 — 반복대상은 수신자
        if (ITERATING_METHODS.has(method)) {
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
          ITERATING_METHODS.has(node.expression.name.getText(sf)) &&
          isFnLike(child);
        if (!alreadyWalked) walk(child, childInLoop, childLocals, childOuter, childLoop, childFn);
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
      .map((s) => ({ file: s.file, line: s.line, recv: s.recv, method: s.method, zone: s.zone, outer: s.outer })),
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
      /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const loopLabel = (n) => {
      const e = ts.isForOfStatement(n) || ts.isForInStatement(n) ? n.expression
        : ts.isForStatement(n) ? n.condition : n.expression;
      return (e ? e.getText(sf) : "").replace(/\s+/g, " ").slice(0, 60);
    };

    const visit = (node) => {
      if (LOOPS.has(node.kind) && node.statement) {
        const label = loopLabel(node);
        // 의도적 순차면 이 루프는 통째로 건너뛴다.
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
        /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
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
      /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const scan = (statements) => {
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          // 인자가 아니라 콜리만 본다 — 인자에 우연히 든 단어로 잡히면 안 된다.
          const io = run.filter((r) => looksIO(r.call.expression.getText(sf)));
          if (io.length >= 2) {
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
function analyzeTextbookIssues(ts, fileContents) {
  const awaitInForEach = [];
  const spreadAccumulator = [];
  const regexInLoop = [];
  const floatingPromise = [];
  const loopInvariantIndex = [];
  const sharedRefFill = [];
  const numericSortNoComparator = [];
  const emptyCatch = [];
  const statefulRegex = [];
  const forInArray = [];

  for (const { file, content } of fileContents) {
    const kind = /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
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
    // ── 배열로 "보이는" 변수 수집: 리터럴/map/filter/Array.from/split 로 만들어진 것만.
    // for...in 은 객체에 쓰는 게 정상이므로, 배열이라는 증거가 있을 때만 잡는다.
    const arrayVars = new Set();
    {
      const ARRAY_MAKERS = new Set(["map", "filter", "flatMap", "slice", "concat", "split", "from", "keys", "values"]);
      const collect = (n) => {
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
        ts.forEachChild(n, collect);
      };
      ts.forEachChild(sf, collect);
    }

    // ── A) floating promise 준비: 이 파일에서 선언된 async 함수 이름 수집.
    // 로컬 선언만 본다 — 타입 정보 없이 "프라미스를 반환한다"를 확신할 수 있는 유일한 범위다.
    const asyncNames = new Set();
    {
      const collect = (n) => {
        const isAsync = (node) =>
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
        if (ts.isFunctionDeclaration(n) && isAsync(n) && n.name) asyncNames.add(n.name.getText(sf));
        if (ts.isMethodDeclaration(n) && isAsync(n) && n.name) asyncNames.add(n.name.getText(sf));
        if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name) &&
            (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && isAsync(n.initializer))
          asyncNames.add(n.name.getText(sf));
        if (ts.isPropertyDeclaration(n) && n.initializer && n.name &&
            (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && isAsync(n.initializer))
          asyncNames.add(n.name.getText(sf));
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

    const walk = (node, inLoop, inRealLoop, inAsyncFn, loopVars) => {
      let childInLoop = inLoop;
      let childInRealLoop = inRealLoop;
      let childInAsyncFn = inAsyncFn;
      let childLoopVars = loopVars;
      if (isLoopNode(node)) {
        childInLoop = true; childInRealLoop = true;
        // 순회 변수뿐 아니라 루프 '본문에서 선언된 모든 이름'을 지역으로 본다.
        // (루프 안에서 만든 정규식/배열은 매 회 새 객체라 상태가 샐 수 없다)
        childLoopVars = new Set([...loopVars, ...declaredNamesIn(node)]);
      }
      if (isFnLike(node)) {
        childInAsyncFn = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
      }

      // ── 루프 불변 인덱스 재구축: 루프 안에서 new Set(xs)/new Map(xs.map(...)) 를 만드는데
      // 인자의 소스가 루프 밖 값이면 매 회 같은 인덱스를 다시 짓는다 = O(n·m). "고친 척하는 O(n²)".
      // 고침은 생성자를 루프 밖으로 호이스팅. 기계적이고 검증 가능(T2).
      if (inRealLoop && ts.isNewExpression(node) && ts.isIdentifier(node.expression) &&
          (node.expression.getText(sf) === "Set" || node.expression.getText(sf) === "Map") &&
          // 가드: new Set(x).add(y) / new Map(x).set(k,v) 는 '수정한 파생 복사본'이다.
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
        // 가드: (a) 인자가 루프 변수를 참조하면 루프마다 값이 달라 호이스팅 불가 → 제외
        //       (b) 소스 루트가 하나라도 루프 밖(loopVars 아님)이어야 '불변'이다
        const hasOuterSource = [...roots].length > 0;
        if (!usesLoopVar && hasOuterSource) {
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
          // 수신자가 '배열을 만드는 표현'일 때만 — Array.prototype.fill 이 아닌 도메인 API의 .fill()
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

      // ── 전역 플래그 정규식을 루프 안에서 .test(): lastIndex가 문자열 사이로 새어
      // 같은 입력도 호출마다 결과가 뒤바뀐다. 성능이 아니라 "조용히 틀린 답"을 내는 버그.
      // 고침은 /g 제거 또는 매 회 새 정규식.
      // 가드: .exec()는 제외한다 — `while ((m = re.exec(s)) !== null)` 은 /g 정규식의
      // *정석 순회 관용구*이지 버그가 아니다(실제로 twenty에서 lastIndex=0 리셋까지 하고 있었다).
      if (inLoop && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const m = node.expression.name.getText(sf);
        const recv = node.expression.expression;
        // 가드: 루프 안에서 만든 정규식은 매 회 새 객체라 lastIndex가 샐 수 없다 → 제외
        if (m === "test" && ts.isIdentifier(recv) && globalRegexVars.has(recv.getText(sf)) &&
            !loopVars.has(recv.getText(sf))) {
          statefulRegex.push({ file, line: lineOf(node), name: recv.getText(sf), method: m });
        }
      }

      // ── 배열에 for...in: 인덱스가 문자열이고 상속 속성까지 돌며 순서 보장이 없다.
      // 가드: 배열이라는 증거(리터럴·map·filter·split 등)가 있는 변수만.
      if (ts.isForInStatement(node) && ts.isIdentifier(node.expression) &&
          arrayVars.has(node.expression.getText(sf))) {
        forInArray.push({ file, line: lineOf(node), name: node.expression.getText(sf) });
      }

      // ── A) floating promise: async 함수 안에서, 결과를 버리는 문(ExpressionStatement)으로
      // 로컬 async 함수를 await 없이 호출. 고침은 await 한 단어라 완전히 기계적.
      // 가드: async 컨텍스트 안에서만(밖이면 await를 못 붙여 기계적 수정이 아님),
      //       void/then/catch로 감싼 의도적 fire-and-forget은 구조상 여기 안 걸린다.
      if (inAsyncFn && ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const callee = node.expression.expression;
        const name = ts.isIdentifier(callee) ? callee.getText(sf)
          : (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword)
            ? callee.name.getText(sf) : null;
        if (name && asyncNames.has(name)) {
          floatingPromise.push({ file, line: lineOf(node), name });
        }
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.getText(sf);

        if (method === "forEach") {
          for (const arg of node.arguments) {
            if (isFnLike(arg) && hasDirectAwait(arg)) { awaitInForEach.push({ file, line: lineOf(node) }); break; }
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

      // 진짜 반복문(for/while) 안에서만 — .map()으로 1회 만드는 캐시는 재컴파일이 아니다.
      if (inRealLoop && ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.getText(sf) === "RegExp") {
        regexInLoop.push({ file, line: lineOf(node) });
      }

      ts.forEachChild(node, (child) => {
        const alreadyWalked =
          ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          ITERATING_METHODS.has(node.expression.name.getText(sf)) && isFnLike(child);
        if (!alreadyWalked) walk(child, childInLoop, childInRealLoop, childInAsyncFn, childLoopVars);
      });
    };
    ts.forEachChild(sf, (n) => walk(n, false, false, false, new Set()));
  }

  return {
    awaitInForEach: { count: awaitInForEach.length, worst: awaitInForEach.slice(0, 6) },
    spreadAccumulator: { count: spreadAccumulator.length, worst: spreadAccumulator.slice(0, 6) },
    regexInLoop: { count: regexInLoop.length, worst: regexInLoop.slice(0, 6) },
    floatingPromise: { count: floatingPromise.length, worst: floatingPromise.slice(0, 6) },
    loopInvariantIndex: { count: loopInvariantIndex.length, worst: loopInvariantIndex.slice(0, 6) },
    sharedRefFill: { count: sharedRefFill.length, worst: sharedRefFill.slice(0, 6) },
    numericSortNoComparator: { count: numericSortNoComparator.length, worst: numericSortNoComparator.slice(0, 6) },
    emptyCatch: { count: emptyCatch.length, worst: emptyCatch.slice(0, 8) },
    statefulRegex: { count: statefulRegex.length, worst: statefulRegex.slice(0, 6) },
    forInArray: { count: forInArray.length, worst: forInArray.slice(0, 6) },
  };
}

// 타입 위생 — 타입체커 없이 AST 문법만으로 잡히는 "타입을 포기한 자리"들.
// 진단 전용(점수 미반영): any 는 외부 SDK 경계처럼 정당한 쓰임이 있어 사람 판단이 필요하다.
function analyzeTypeSafety(ts, fileContents) {
  const anyType = [], asAny = [], nonNull = [], tsIgnore = [];
  let totalAnnots = 0, tsFiles = 0;

  for (const { file, content } of fileContents) {
    if (!/\.tsx?$/.test(file) || /\.d\.ts$/.test(file)) continue;
    tsFiles++;
    const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    // @ts-ignore / @ts-nocheck / @ts-expect-error — 타입 검사를 끈 자리
    const re = /@ts-(ignore|nocheck|expect-error)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const line = content.slice(0, m.index).split("\n").length;
      tsIgnore.push({ file, line, what: m[1] });
    }

    const walk = (n) => {
      if (n.kind === ts.SyntaxKind.AnyKeyword) anyType.push({ file, line: lineOf(n) });
      if (ts.isTypeNode(n)) totalAnnots++;
      // as any / <any> — 타입을 강제로 지우는 단언
      if ((ts.isAsExpression(n) || ts.isTypeAssertionExpression?.(n)) && n.type?.kind === ts.SyntaxKind.AnyKeyword)
        asAny.push({ file, line: lineOf(n), text: n.getText(sf).replace(/\s+/g, " ").slice(0, 48) });
      // non-null 단언(!) — "여기 null 아님"을 사람이 장담한 자리
      if (ts.isNonNullExpression(n))
        nonNull.push({ file, line: lineOf(n), text: n.getText(sf).replace(/\s+/g, " ").slice(0, 40) });
      ts.forEachChild(n, walk);
    };
    try { ts.forEachChild(sf, walk); } catch { /* 깊은 파일 스킵 */ }
  }

  const pct = (n) => (totalAnnots > 0 ? Math.round((n / totalAnnots) * 1000) / 10 : 0);
  return {
    tsFiles, totalAnnots,
    anyType: { count: anyType.length, pct: pct(anyType.length), worst: anyType.slice(0, 6) },
    asAny: { count: asAny.length, worst: asAny.slice(0, 6) },
    nonNull: { count: nonNull.length, worst: nonNull.slice(0, 6) },
    tsIgnore: { count: tsIgnore.length, worst: tsIgnore.slice(0, 6) },
  };
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

// 파일 분류 — frontend(UI) / backend(API·서버) / shared(공용 유틸)
function classifyFile(filePath, content) {
  const rel = filePath.replace(/\\/g, "/");
  const head = content.slice(0, 300);
  if (
    /\/(api|server)\//.test(rel) ||
    /(^|\/)(route|middleware|instrumentation)\.(ts|js|mjs)$/.test(rel) ||
    /^\s*["']use server["']/.test(head)
  ) {
    return "backend";
  }
  if (/\.(tsx|jsx)$/.test(rel) || /^\s*["']use client["']/.test(head)) {
    return "frontend";
  }
  return "shared";
}

// kit import 감지
function detectKitImports(content) {
  const found = new Set();
  // import { X, Y } from "@m1kapp/kit" 또는 "@m1kapp/kit/..." 패턴
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']@m1kapp\/kit(?:\/[^"']*)?["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const names = match[1].split(",").map((s) => s.trim().split(" as ")[0].trim());
    for (const name of names) {
      if (name && !name.startsWith("type ")) {
        found.add(name);
      }
    }
  }
  // import type은 제외 — 타입만 쓰는 건 코드 절약 아님
  return found;
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

// 비-프로덕션 파일 일관 제외: 테스트·타입테스트(.test-d)·벤치·스토리·__tests__.
// (중복 축에서만 걸러 다른 축엔 포함되던 불일치 제거 — 테스트 콜로케이션이 점수를 깎던 문제.)
// 점수는 "배포되는 프로덕션 코드"의 건강만 잰다. 테스트 존재 여부는 별도 신호.
const NON_SOURCE_RE = /(\.(test|spec|test-d|bench|benchmark|stories|e2e)\.[tj]sx?$)|(\/(__(tests?|mocks?|fixtures?|snapshots?)__|tests?|benchmarks?|__bench__|e2e|fixtures?|mocks?)\/)|(\.d\.ts$)/;
// 벤더링·생성 디렉토리: 저장소에 커밋된 서드파티 코드는 미니파이가 아니어도(개발 빌드는 읽기 가능)
// 사람이 쓴 코드가 아니다. 실제 사례: next.js의 src/compiled/ 45MB(react-dom 개발빌드 여러 벌)가
// 중복 82%·maxCog 997을 만들어 D 27을 찍게 했다 — 전부 벤더 코드였다.
const VENDORED_RE = /\/(compiled|vendor|vendored|third[-_]party|generated|codegen|\.generated|node_modules)\//;
// 배포물이 아닌 부속 디렉토리: 예제·데모·플레이그라운드·문서 사이트·빌드 스크립트.
// 저장소에는 있지만 사용자가 설치하는 물건이 아니라, 점수에 섞이면 "이 라이브러리 코드가
// 어떤 상태인가"라는 질문의 답을 흐린다(angular/packages/examples 6.4k줄 = 문서용 샘플).
const NON_SHIPPED_RE = /\/(examples?|demos?|playground|sandbox|website|scripts)\//;
// --exclude=pat1,pat2 — 모노레포에서 '측정 대상 산출물'이 아닌 하위 패키지 수동 제외.
// 자동 판별 불가한 판단(별도 제품인 devtools 앱, 저장소에 포크해 넣은 남의 툴)에만 쓴다.
// 각 사용처는 board-repos.json에 이유와 함께 기록된다 — 근거 없는 제외는 점수 세탁이다.
const excludePats = (getFlag("exclude") || "").split(",").map((s) => s.trim()).filter(Boolean);
const EXCLUDE_RES = excludePats.map((p) =>
  new RegExp(p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")));
// 테스트 밀도(테스트줄 ÷ 프로덕션줄) — 점수에 절대 반영하지 않는 진단.
// 왜 점수에 안 넣나: 테스트를 채점에 섞으면 지표가 뒤집힌다(실측 — vue D46 → B70).
// 테스트는 길지만 단순해서 '복잡 함수 비율'의 분모만 불린다 = 트리비얼한 테스트를 많이
// 쓰면 점수가 오르는 게이밍이 열린다. 그래서 채점에선 빼고, 양만 따로 센다.
// 쓸모: 같은 복잡도라도 "두껍게 방어된 복잡함"과 "맨몸 복잡함"은 다른 물건이다.
// (코퍼스 52개에서 점수와 상관 rho=0.04 — 점수가 못 보는 독립 축이라는 뜻)
const TEST_FILE_RE = /(\.(test|spec|test-d)\.[tj]sx?$)|(\/(__tests__|tests?|e2e)\/)/;
let testDensity = null;
{
  const testFiles = files.filter((f) => TEST_FILE_RE.test(f.replace(/\\/g, "/")));
  let testLines = 0;
  for (const f of testFiles) {
    try { testLines += fs.readFileSync(f, "utf-8").split("\n").length; } catch { /* 읽기 실패는 무시 */ }
  }
  testDensity = { files: testFiles.length, lines: testLines, percent: null };
}
// percent 는 codeLines 가 정해진 뒤에 채운다(아래 파일 순회에서 누적된다).
// 예전엔 이 값을 JSON 을 쓴 뒤에 계산해서, 산출물엔 늘 null 이 박히고 CLI 만
// 실제 값을 찍었다. 보드 DATA 를 그 산출물로 다시 만들었더니 69행 전부
// 테스트 두께가 사라졌다 — 콘솔과 파일이 다른 말을 하면 안 된다.
{
  const before = files.length;
  files = files.filter((f) => {
    const p = f.replace(/\\/g, "/");
    return !NON_SOURCE_RE.test(p) && !VENDORED_RE.test(p) && !NON_SHIPPED_RE.test(p)
      && !EXCLUDE_RES.some((re) => re.test(p));
  });
  const dropped = before - files.length;
  if (dropped > 0) {
    console.log(`  비-프로덕션·벤더 파일(테스트·벤치·스토리·타입선언·compiled/vendor·예제/스크립트) ${dropped}개 제외 (${files.length}개 분석)\n`);
  }
  if (excludePats.length) console.log(`  수동 제외(--exclude): ${excludePats.join(", ")}\n`);
}

// 미니파이·번들 파일 제외: 저장소에 커밋된 벤더 번들·시드 에셋은 git 추적 대상이라
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

// 자잘 파일 제외: 코드 5줄 미만은 복잡도·중복 신호가 없고, 빈 파일을 대량으로 넣어
// 비율 분모(파일수·토큰수)를 부풀려 점수를 조작하는 패딩 게이밍을 차단한다.
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
    console.log(`  자잘 파일(코드 <${TRIVIAL_MIN_CODE}줄) ${dropped}개 제외 — 패딩 게이밍 방지 (${files.length}개 분석)\n`);
  }
}

let totalLines = 0;
let codeLines = 0;
let totalBranches = 0;
let totalFunctions = 0;
let maxFile = { path: "", lines: 0 };
let longFiles = 0; // 200줄 초과 파일 수
// 유예 구간: 실측상 파일 중앙값 41줄·p90 261줄이라, 260줄까지는 벌점 0(정상 파일의 90%가 무료).
// 그 위로만 완만히 누적 — 260→560줄 0→1, 560→860줄 1→2, 파일당 최대 2.
let longFileSeverity = 0;
const allImports = new Set();
const ts = loadTypescript();
const allFns = []; // AST 모드: {name, cc, cog, line, file}
const fileContents = []; // 중복 감지용
const breakdown = {
  frontend: { files: 0, codeLines: 0 },
  backend: { files: 0, codeLines: 0 },
  shared: { files: 0, codeLines: 0 },
};

for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const counts = countLines(content);
  totalLines += counts.total;
  codeLines += counts.code;
  const bucket = breakdown[classifyFile(file, content)];
  bucket.files++;
  bucket.codeLines += counts.code;
  const q = analyzeQuality(content);
  totalBranches += q.branches;
  totalFunctions += q.functions;
  if (ts) {
    const rel = relDisplay(file);
    for (const fn of analyzeAstComplexity(ts, file, content)) allFns.push({ ...fn, file: rel });
    fileContents.push({ file: rel, content });
  }
  if (counts.code > maxFile.lines) maxFile = { path: relDisplay(file), lines: counts.code };
  if (counts.code > 260) {
    longFiles++;
    longFileSeverity += Math.min(2, (counts.code - 260) / 300);
  }
  const imports = detectKitImports(content);
  for (const imp of imports) allImports.add(imp);
}

const branchDensity = codeLines > 0 ? Math.round((totalBranches / codeLines) * 1000) / 10 : 0;
const avgFileLines = files.length > 0 ? Math.round(codeLines / files.length) : 0;

// 점수 계산 v2 (100점 만점)
// AST 모드: cognitive complexity(중첩 가중, SonarQube 함수당 15 권고) + 중복 밀도(SonarQube 3% 게이트)
// 프로젝트 크기 편향 없게 비율 기반 감점:
// - cog>15 함수 비율 ×3 (최대 25), cog>25 함수 비율 ×5 (최대 15)
// - 최악 함수: cog 20 초과분 ×1 (최대 15)
// - 중복 밀도: 3% 초과분 ×2.5 (최대 25) ← 새 축
// - 200줄 초과 파일: 초과분에 비례한 심각도(200→400줄 0→1, 400→600줄 1→2, 600줄+ 캡) 비율 ×1.5 (최대 10)
//   ※ 파일 개수 기준 이진 카운트(200줄 넘으면 무조건 1) 대신 심각도 가중 — 살짝 넘는 파일과
//     터무니없이 큰 파일을 구분하고, 파일 수 적은 프로젝트가 파일 1개만으로 즉시 만점 감점 맞는 절벽 방지.
// / 평균 파일 길이 80줄 초과분 /5 (최대 10)
// - 렌더 인질(fetch 하나가 무관한 UI까지 막는 자리) ×3 (최대 10)
// - 루프 안 무캐시 파일읽기 사이트 ×4 (최대 20) ← 새 축. 코드 모양이 아무리 깔끔해도
//   호출 1번이 파일 N번을 읽는 구조는 여기서만 드러난다(cognitive·중복으론 원리상 안 잡힘).
let qualityScore;
let cc = null;
let cognitive = null;
let fnLength = null;   // {avg,p90,max,over40,over80,worst} — 함수 길이 분포
let scoreInputs = null; // 채점 입력값 원본(감사·재보정용)
let duplication = null;
let io = null;
let renderGates = null;
let quadratic = null;
let serialAwait = null;
let nplusOne = null;
let coupling = null;
let seqIo = { sites: 0, perThousand: 0 };
let typeSafety = null;
let textbook = null;
if (ts && allFns.length > 0) {
  const byCc = [...allFns].sort((a, b) => b.cc - a.cc);
  cc = {
    functions: allFns.length,
    avg: Math.round((allFns.reduce((s, f) => s + f.cc, 0) / allFns.length) * 10) / 10,
    p90: byCc[Math.floor((byCc.length - 1) * 0.1)].cc,
    max: byCc[0].cc,
    over10: byCc.filter((f) => f.cc > 10).length,
    over20: byCc.filter((f) => f.cc > 20).length,
    worst: byCc.slice(0, 5).map(({ name, cc, file, line }) => ({ name, cc, file, line })),
  };

  const byCog = [...allFns].sort((a, b) => b.cog - a.cog);
  const cogOver15 = byCog.filter((f) => f.cog > 15);
  const cogOver25 = byCog.filter((f) => f.cog > 25);
  const maxCog = byCog[0].cog;
  cognitive = {
    avg: Math.round((allFns.reduce((s, f) => s + f.cog, 0) / allFns.length) * 10) / 10,
    p90: byCog[Math.floor((byCog.length - 1) * 0.1)].cog,
    max: maxCog,
    over15: cogOver15.length,
    over25: cogOver25.length,
    top10avg: Math.round(byCog.slice(0, 10).reduce((a, f) => a + f.cog, 0) / Math.min(10, byCog.length) * 10) / 10,
    // 깊이 분포 — cog 가 같아도 평평한 저장소와 깊은 저장소는 다르다. 점수엔 안 들어간다.
    // reduce 로 접는다 — Math.max(...arr) 는 인자 수가 스택 한도를 넘는다(vscode 18만 함수에서 터졌다)
    maxNest: allFns.reduce((m, f) => (f.nest > m ? f.nest : m), 0),
    deepCount: allFns.filter((f) => (f.nest || 0) >= 4).length, // 4단 이상 = 사람이 상태를 쌓아야 하는 깊이
    worst: byCog.slice(0, 10).map(({ name, cog, cc, nest, guard, file, line }) => ({ name, cog, cc, nest, guard, file, line })),
  };

  // 함수 길이 분포 — "한 번에 읽어야 하는 양". 파일 크기의 대체 후보.
  // 파일 크기는 배치 관습에 좌우되고 의미 없는 분할로 조작되지만(70개 실측: 앱 중앙 87점
  // vs 라이브러리 80 — 앱이 쪼개는 관습을 따르기 때문), 함수 길이는 둘 다에 중립이다.
  const jsxAware = (file) => (/\.(tsx|jsx)$/.test(file || "") ? 60 : 40);
  const byLen = [...allFns].sort((a, b) => (b.lines || 0) - (a.lines || 0));
  fnLength = {
    avg: Math.round((allFns.reduce((s, f) => s + (f.lines || 0), 0) / allFns.length) * 10) / 10,
    p90: byLen[Math.floor((byLen.length - 1) * 0.1)].lines || 0,
    max: byLen[0].lines || 0,
    // 긴 함수 임계는 파일 종류로 나눈다: JSX/TSX는 선언적 마크업이라 같은 복잡도에서 줄이 길다.
    // (실측: 앱 코퍼스가 40줄 단일 임계에서만 −14점 — 로직이 아니라 마크업 때문에 맞는 벌점이었다)
    over40: byLen.filter((f) => (f.lines || 0) > jsxAware(f.file)).length,
    over80: byLen.filter((f) => (f.lines || 0) > jsxAware(f.file) * 2).length,
    top10avg: Math.round(byLen.slice(0, 10).reduce((a, f) => a + (f.lines || 0), 0) / Math.min(10, byLen.length) * 10) / 10,
    // 분모 후보 비교용 — 콜백 같은 자잘 함수가 비율을 얼마나 희석하는지 본다
    countAll: byLen.length,
    count5: byLen.filter((f) => (f.lines || 0) >= 5).length,
    count10: byLen.filter((f) => (f.lines || 0) >= 10).length,
    worst: byLen.slice(0, 10).map(({ name, lines, cog, file, line }) => ({ name, lines, cog, file, line })),
  };

  duplication = analyzeDuplication(ts, fileContents);
  io = analyzeIoDensity(ts, fileContents);
  renderGates = analyzeRenderGates(ts, fileContents);
  quadratic = analyzeQuadraticLookups(ts, fileContents);
  serialAwait = analyzeSerialAwaits(ts, fileContents);
  nplusOne = analyzeNPlusOne(ts, fileContents);
  coupling = analyzeCoupling(ts, fileContents);
  // 불필요한 순차 I/O — N+1 과 독립 순차 await 은 같은 결함이다:
  // 안 기다려도 되는 것을 줄 세워 기다린다. 나눠 두면 각각은 축이 못 된다
  // (실측: N+1 단독은 37곳 중 1곳에서만 발동, 캡에도 못 닿았다).
  // 반드시 두 분석이 끝난 뒤에 계산한다 — 앞에 두면 nplusOne 이 아직 null 이라
  // 조용히 N+1 만 빠진 값이 나온다(실제로 그렇게 immich 가 26곳 대신 24곳으로 나왔다).
  {
    const sites = nplusOne.sites + serialAwait.sites;
    seqIo = {
      sites,
      perThousand: fileContents.length
        ? Math.round((sites / fileContents.length) * 1000 * 100) / 100
        : 0,
    };
  }
  textbook = analyzeTextbookIssues(ts, fileContents);
  typeSafety = analyzeTypeSafety(ts, fileContents);

  // v4 보정: 존경받는 OSS 코퍼스(ky·execa·zod·hono·vite·zustand 등 14종) 분포로 역피팅.
  // 원칙: 건강한 코드베이스도 함수 몇%는 cog15+·중복 약간은 정상 → free 임계 이하 감점 0,
  //       극소 repo가 비율 폭주로 D 맞지 않게 함수 수 하한(floor) 적용, 캡 합 90으로 포화 축소.
  // 스케일 정규화: 절대개수(io·renderGates·maxCog)는 비율/로그로 — 대형이 개수만으로 만렙 맞던 것 해소.
  const SCORE_FN_FLOOR = 40; // 극소 repo 안정화 — 함수 1개 복잡해도 33%가 되지 않게
  const fnDenom = Math.max(allFns.length, SCORE_FN_FLOOR);
  const over15Pct = (cogOver15.length / fnDenom) * 100;
  const over25Pct = (cogOver25.length / fnDenom) * 100;
  const longFileSeverityPct = (longFileSeverity / files.length) * 100;
  const fnOver40Pct = (fnLength.over40 / fnDenom) * 100;
  scoreInputs = {
    over15Pct: Math.round(over15Pct * 100) / 100,
    over25Pct: Math.round(over25Pct * 100) / 100,
    p90Cog: cognitive.p90, maxCog,
    dupPct: duplication.percent,
    longFileSeverityPct: Math.round(longFileSeverityPct * 100) / 100,
    avgFileLines,
    fnOver40Pct: Math.round(fnOver40Pct * 100) / 100,
    fnP90: fnLength.p90, fnMax: fnLength.max,
    fnTop10: fnLength.top10avg, cogTop10: cognitive.top10avg,
    seqIoSites: seqIo.sites,
    seqIoPer1k: seqIo.perThousand,
    quadCandidates: quadratic ? quadratic.candidates : 0,
    quadPer10kLines: quadratic && codeLines
      ? Math.round((quadratic.candidates / codeLines) * 10000 * 100) / 100 : 0,
  };
  // io = 루프 안 파일읽기 + DB/HTTP N+1(순차 await). 파일당 비율.
  // renderGates(렌더 인질)는 실측상 존경 OSS 17종서 0회 발동 = 변별력 없어 점수에서 제외.
  // (진단 출력·JSON엔 유지 — React 앱에서 참고용.)
  qualityScore = Math.max(0, Math.round(
    100
    // 인지 복잡도 감점 = 분포 위주 + 단일 최악함수는 작은 잔여항.
    // 볼륨 재보정(Goodhart 내성): 예전엔 maxCog 단일항이 12점까지 좌우해, '안정적이라 아무도 안 만지는
    // 최악 함수 하나'만 고쳐도 점수가 크게 올랐다(측정을 게임). 이제 분포(over15·over25·p90)가 주도한다.
    // 분포는 함수 하나로 못 흔든다 — 올리려면 '여러 복잡 함수'를 실제로 줄여야 한다.
    - Math.min(12, Math.max(0, over15Pct - 3.0) * 2)  // cog15+ 비율 — 코퍼스 중앙(3.0%)까지 유예, 초과분만 감점
    - Math.min(12, Math.max(0, over25Pct - 1.2) * 3)  // cog25+ 비율 — 1.2%까지 유예
    - Math.min(9, Math.max(0, Math.log2(Math.max(1, cognitive.p90) / 6)) * 3.0) // p90 복잡도(분포). 유예=코퍼스 중앙 6 — 그 이하 0점. /12였을 땐 최대치가 15라 항이 거의 죽어 변별을 못 했다.
    // 최악값 1개 → 상위 10개 평균. 최악 하나만 고치면 다음 순위가 즉시 새 최악이 되어
    // "하나 고치고 끝"이 최적 전략이 됐다(실측: 555줄 함수 고치면 +0.99점, 그 다음부터 ~0).
    // 상위 10개 평균은 미분값이 0이 되지 않는다 — 10개를 실제로 줄여야 계속 내려간다.
    // 유예=코퍼스 중앙(복잡도 65 · 길이 174줄), 기울기는 코퍼스 p90에서 캡에 닿게.
    - Math.min(4, Math.max(0, Math.log2(Math.max(1, cognitive.top10avg) / 65)) * 2.66)
    // 중복 볼륨 축소(16→9). 70개 코퍼스에서 중복%와 점수의 스피어만이 −0.11 — 사실상 무상관인데
    // 캡만 최대였다. 분포가 롱테일이라(valibot 43.5·drizzle 36.2·hono 23.2 vs 나머지 한 자리)
    // 대부분 저장소엔 0점 기여하고 소수만 벼락처럼 때린다. 채점기가 아니라 이상치 탐지기다.
    - Math.min(9, Math.max(0, duplication.percent - 8) * 1.2)
    // 불필요한 순차 I/O = N+1(루프 안 행마다 조회) + 독립 순차 await(서로 안 엮인 것을 줄 세움).
    // 구조 지표가 못 보는 축이다 — 37곳 재측정에서 기존 점수와 rho=-0.18 로 사실상 독립이다.
    //
    // v8 은 N+1 만 넣었고 그건 실패였다: 37곳 중 1곳(immich)에서만 발동했고 그 값조차
    // 캡에 못 닿아, 캡 5점짜리 축이 저장소 하나만 건드리는 장식이었다. 승격 근거로 쓴
    // 표본 12곳이 백엔드 위주였는데 코퍼스는 라이브러리 쪽으로 쏠려 있다(라이브러리 15·
    // 툴체인 7·프레임워크 7 대 앱 8). 라이브러리는 DB 를 안 돌아 구조적으로 0 이다.
    // 같은 결함 부류인 독립 순차 await 을 합치니 발동이 1곳 → 11곳(30%)이 됐다.
    //
    // 유예·기울기는 37곳 실측 분포에서 잡았다(발동 11곳: 3.00~61.47/1000파일):
    //  · 최소 3곳 게이트 — 1~2곳은 의도적 순차(재시도·커서 페이지네이션)일 수 있다.
    //    밀도만 쓰면 작은 저장소가 사이트 한둘로 무너진다(파일 100개·1곳 = 밀도 10).
    //  · 유예 3.0/1000파일 — 그 아래는 0점.
    //  · 기울기 0.185 = 캡이 30.0 에서 닿는다. 37곳 중 3곳(immich·directus·strapi)만 만점 감점.
    //  · 캡 5 유지 — 오탐이 남는다(N+1 탐지 오탐률 26%, 의도적 순차 제외 기준).
    //    헬퍼로 감싸면 탐지를 피할 수 있는 것도 캡을 낮게 두는 이유다.
    - (seqIo.sites >= 3 ? Math.min(5, Math.max(0, seqIo.perThousand - 3.0) * 0.185) : 0)
    // ── 크기 축: 파일 크기(조작 가능) 볼륨을 줄이고, 함수 길이(조작 불가)로 무게를 옮긴다 ──
    // 근거: 같은 코드를 함수 경계에서 6파일로 기계 분할하면 옛 공식은 B71 → S98 (+27점).
    // 코드는 한 줄도 안 변했는데 점수가 뛴다. 파일 경계는 배치 관습이고, 함수 경계는 의미 단위다.
    // 파일 축을 0으로 두진 않는다 — 70개 실측에서 파일 평균줄과 함수 길이의 상관은 +0.16,
    // 즉 서로 다른 것을 재고 있어 정보가 겹치지 않는다. 다만 조작 가능한 축에 큰 무게를 줄 순 없다.
    - Math.min(3, longFileSeverityPct * 1.3)        // 200줄+ 파일 (13 → 3)
    // 평균 파일 길이. 캡을 14 → 5 로 줄일 때 나눗수 /5 를 그대로 뒀더니 캡 도달점이
    // 190 → 145 로 끌려 내려왔다. 코퍼스 p90 이 280 인데 145 에서 이미 만점 감점이라
    // 70곳 중 29곳(41%)이 캡에 붙어 있었다 — 150줄짜리와 2,000줄짜리를 구분 못 한다.
    // "기울기는 p90 에서 캡에 닿게 잡는다"는 이 엔진의 보정 규칙을 유일하게 어기던 항이다
    // (나머지 6개 항은 전부 p90 ±5% 안에서 캡에 닿는다). 5/(280-120) = 0.03125 로 맞춘다.
    - Math.min(5, Math.max(0, avgFileLines - 120) * 0.03125)
    // 함수 길이 = "한 번에 읽어야 하는 양". 중첩 함수·주석 제외한 자기 코드 줄 기준.
    // 유예는 70개 코퍼스 중앙(40줄 초과 비율 4.3% · p90 23줄) — 그 이하 감점 0.
    // 긴 함수 비율만 유일하게 '유예 없음'이다. 다른 축은 코퍼스 중앙까지 봐주지만, 여기서 그러면
    // 관습을 정당화하게 된다("남들도 4%는 길다"). 그리고 파일 크기 축이 하던 광범위 감점 역할을
    // 조작 불가능한 축으로 옮기려면 이 항이 대부분 저장소에 조금씩 닿아야 한다.
    // 기울기는 코퍼스 p90(6.9%)에서 캡에 닿도록 잡았다. 임계는 JSX 60줄 / 그 외 40줄.
    - Math.min(16, fnOver40Pct * 1.95)
    // 함수 길이 p90: 유예=코퍼스 중앙(23줄), 로그 스케일 잔여항.
    // v7 에서 볼륨을 절반으로 줄였다(6점 계수 11.0 → 3점 계수 5.5). 두 가지 실측 근거:
    //  ① 70개 코퍼스에서 fnOver40Pct 와의 상관이 0.914 — 사실상 같은 축을 두 번 재고 있었다.
    //  ② 그런데 계수는 이 항이 가장 가팔라서, 중앙값보다 좋은 저장소에선 다른 축이 전부
    //     유예선 아래로 깔린 뒤 이 항만 남아 점수를 좌우했다. p90 은 함수 하나 늘고 주는 것으로
    //     한 줄씩 움직이는 순위통계라 그 자리에 있으면 안 된다.
    // 실측 사례(formychildren): cog15+ 함수를 저장소에서 전부 없앴는데(0.34% → 0%) p90 이
    // 28 → 29 로 밀리며 순이익이 −1점이 됐다. 개선은 못 받고 노이즈만 맞는 구조였다.
    - Math.min(3, Math.max(0, Math.log2(Math.max(1, fnLength.p90) / 23)) * 5.5)
    - Math.min(4, Math.max(0, Math.log2(Math.max(1, fnLength.top10avg) / 174)) * 3.60)
    // O(n²) 배열 조회 — 루프 안에서 바깥 배열을 .find/.some 으로 훑는 자리.
    //
    // 이 축은 이 도구가 실제로 PR 을 가장 많이 만든 자리다(11건 제출, outline 머지,
    // medusa 승인). 그런데 채점에는 안 들어가 있었다 — 등급은 안 움직이면서 "고칠 줄"만
    // 주고 있었던 셈이다. 축은 채점도 되고 PR 도 나와야 "고칠 줄을 준다"는 약속을 지킨다.
    //
    // 예전에 뺀 이유는 "n 이 큰지 사람이 봐야 한다"였다. 그 우려는 유효해서 세 겹으로 막는다:
    //  ① candidates 만 센다 — 테스트·프론트 구역 제외, 외곽이 정적이면 제외(const-outer),
    //     루프 안에 I/O 가 있으면 제외(io-in-loop), n 이 잘려 있으면 제외(capped-n).
    //  ② 최소 3곳 게이트 — 1~2곳으로 작은 저장소가 무너지지 않게. 37곳 중 3곳이 여기서 면제된다.
    //  ③ 캡 5 — 제출한 O(n²) PR 중 판정 난 6건에서 4건이 닫혔다(오탐률 ~36%).
    //     오탐이 등급을 뒤집으면 안 된다.
    //
    // 정규화는 파일이 아니라 **코드줄** 기준이다. 파일당으로 재면 코드줄과 rho=+0.69 로
    // 규모를 못 지운다(큰 저장소는 파일도 크다). 10k줄당으로 바꾸면 종류 안에서
    // 코드줄 상관이 전부 음수가 된다(툴체인 -0.14 · 프레임워크 -0.25 · 앱 -0.38).
    // 전체 +0.64 는 종류 교란이었다 — 라이브러리 15곳 중 14곳이 0 이라서 생긴 값이다.
    //
    // 유예 1.5/10k줄 = 코퍼스 중앙값, 기울기 1.30 = 캡이 p90(5.34)에서 닿는다.
    // 이 엔진의 보정 규칙("유예=중앙 · 캡은 p90 에서") 그대로다.
    //
    // v11 까지는 이 항이 규칙을 벗어나 있었다(캡이 p90 의 152% 지점). 그게 오탐 대비
    // 의도적 완화라고 적어뒀는데, 실은 상당 부분 **과소 탐지의 증상**이었다 — v12 에서
    // 멤버십 조회(includes/indexOf)를 탐지에 넣자 분포가 위로 밀리면서 같은 캡이 저절로
    // p90 의 112% 가 됐다. 탐지가 실제 분포를 담게 되니 규칙을 그냥 따를 수 있게 됐다.
    // 74곳: 감점 34곳 · 만점 6곳 · 기존 점수와 rho=-0.31.
    - (quadratic && quadratic.candidates >= 3
        ? Math.min(5, Math.max(0, (quadratic.candidates / Math.max(1, codeLines)) * 10000 - 1.5) * 1.30)
        : 0)
    // io(루프 안 파일 읽기)는 점수에서 뺐다: 재시도 루프·커서 페이지네이션처럼 '순차가 필수'인
    // 코드를 구분하려면 사람 검증이 필요한데(PATTERNS.md), 사람이 필요한 축을 자동 채점에
    // 넣으면 작은 저장소가 통째로 무너진다(파일 1개·사이트 2곳 = 만렙 감점). 진단으로만 보고한다.
    // N+1(위 캡 5)은 예외로 넣었다 — 밀도(파일 1000개당)로 재서 작은 저장소가 사이트 몇 곳으로
    // 무너지지 않고, 유예 1.0/1000 아래는 0점이다. 그래도 캡을 5로 묶은 이유는 같다: 오탐이 남는다.
  ));
} else {
  // regex 폴백 (typescript 미설치)
  console.error("  ⚠ typescript를 찾지 못해 regex 근사 모드로 채점합니다 — AST 모드와 점수 체계가 다릅니다.");
  console.error("    정확한 점수를 원하면 대상 또는 이 도구에 typescript를 설치하세요.\n");
  qualityScore = Math.max(0, Math.round(
    100
    - Math.min(40, Math.max(0, branchDensity - 10) * 2)
    - Math.min(30, longFileSeverity * 2.5)
    - Math.min(30, Math.max(0, avgFileLines - 80) / 4)
  ));
}
// 데드코드축 (--dead) — knip 결과를 점수에 반영. @keep 파일은 제외됨.
// 표준 도구(Sonar·CodeClimate)가 안 재는 축: 죽은 파일·export 비율.
let dead = null;
if (wantDead) {
  dead = analyzeDeadCode(srcDir, new Set(files));
  if (dead) {
    const deadFilePct = files.length > 0 ? (dead.deadFiles / files.length) * 100 : 0;
    // 파일당 미사용 export 수 — 예전엔 함수 수로 나눠 단위가 맞지 않았다(타입 위주 패키지에서 무의미)
    const deadExportPct = files.length > 0 ? (dead.unusedExports / files.length) * 100 : 0;
    const deadPenalty = Math.min(20, deadFilePct * 1.0) + Math.min(10, deadExportPct * 0.3);
    dead.filePct = Math.round(deadFilePct * 10) / 10;
    dead.exportPct = Math.round(deadExportPct * 10) / 10;
    dead.penalty = Math.round(deadPenalty * 10) / 10;
    qualityScore = Math.max(0, Math.round(qualityScore - deadPenalty));
  }
}
// 6등급 S~E. S(95+)는 예외적으로 깨끗한 소수만 — 상단이 A+ 하나로 뭉치던 것을 가른다.
// 등급 임계는 존경받는 OSS 52종 코퍼스의 점수 분위수에 맞춘다(임의 커트 아님).
// 실측 분포: p10 58 · p25 66 · 중앙 76 · p75 86 · p90 90.
// 상단(S/A)은 선별적으로 유지하되 하단은 넉넉히 — 유명 OSS 52종 어디도 D 아래로 떨어지지 않는다.
// '점수는 낮아도 등급은 최소 C', D 이하는 구조가 진짜 무너진 경우만.
// 큰 서비스/앱은 구조 지표상 원래 불리하므로, 커트를 분포에 붙여 과도한 저평가를 막는다.
const qualityBase =
  qualityScore >= 90 ? "S" :
  qualityScore >= 80 ? "A" :
  qualityScore >= 70 ? "B" :
  qualityScore >= 55 ? "C" :
  qualityScore >= 35 ? "D" :
  "E";                         // 사실상 방치
// 플러스 — 구간 상위 40%. C 구간이 15점이나 되어서 같은 C 안에서 개선해도 라벨이 안 움직였다.
// 색·분포·비교는 기본 글자(S~E) 그대로 쓰고, 표시만 세분한다.
// S 구간만 S / SS / SSS 3단, 나머지는 상위 40%에 + 를 붙인다.
// 최상단이 "S+"면 심심하고, 만점권(mitt·rxjs·execa 100~98)과 90점을 같은 라벨로 묶기도 아깝다.
const PLUS_AT = { A: 86, B: 76, C: 64, D: 47, E: 21 };
const S_CUTS = [[97, "SSS"], [93, "SS"], [0, "S"]];
const qualityGrade = qualityBase === "S"
  ? S_CUTS.find(([lo]) => qualityScore >= lo)[1]
  : (qualityScore >= PLUS_AT[qualityBase] ? qualityBase + "+" : qualityBase);

// 절약량 계산
// 같은 소스 파일에서 여러 export를 쓰더라도 파일 LOC는 한 번만 카운트
const usedFeatures = [];
let savedLines = 0;
const usedByCategory = { component: 0, hook: 0, util: 0 };
const countedSources = new Set();

for (const name of allImports) {
  const meta = KIT_FEATURES[name];
  if (!meta) continue;

  // 카테고리별 사용 수 (loc 0이어도 카운트 — "Tab"도 사용한 거니까)
  usedByCategory[meta.category] = (usedByCategory[meta.category] || 0) + 1;

  // LOC 절약은 소스 파일 단위로 1번만. 대표(loc>0)만 카운트하므로 import
  // 순서와 무관 — 비대표(loc 0)가 먼저 와도 source를 선점하지 않는다.
  if (meta.loc > 0 && !(meta.source && countedSources.has(meta.source))) {
    if (meta.source) countedSources.add(meta.source);
    usedFeatures.push({ name, loc: meta.loc, category: meta.category });
    savedLines += meta.loc;
  }
}

const estimatedKB = Math.round(savedLines * 40 / 1024);
const estimatedA4 = Math.round(savedLines / 80);
const savedPercent = codeLines > 0 ? Math.round((savedLines / (codeLines + savedLines)) * 100) : 0;

// 사용률: kit이 제공하는 전체 요소 중 몇 개를 쓰고 있는지
const usage = {
  component: { used: usedByCategory.component, total: kitTotalFeatures.component, percent: kitTotalFeatures.component > 0 ? Math.round((usedByCategory.component / kitTotalFeatures.component) * 100) : 0 },
  hook: { used: usedByCategory.hook, total: kitTotalFeatures.hook, percent: kitTotalFeatures.hook > 0 ? Math.round((usedByCategory.hook / kitTotalFeatures.hook) * 100) : 0 },
  util: { used: usedByCategory.util, total: kitTotalFeatures.util, percent: kitTotalFeatures.util > 0 ? Math.round((usedByCategory.util / kitTotalFeatures.util) * 100) : 0 },
};

// 테스트 두께 비율 — 산출물에 담기려면 stats 조립 전에 확정돼야 한다.
if (testDensity) {
  testDensity.percent = codeLines > 0 ? Math.round((testDensity.lines / codeLines) * 1000) / 10 : null;
}

const stats = {
  generatedAt: new Date().toISOString(),
  kitVersion,
  source: {
    dir: relDisplay(srcDir) || ".",
    files: files.length,
    totalLines,
    codeLines,
    breakdown, // frontend(UI) / backend(API·서버) / shared(공용) 별 files·codeLines
  },
  quality: {
    engine: cc ? "ast2" : "regex", // ast2 = cognitive complexity + 중복 감지
    score: qualityScore,
    grade: qualityGrade,        // 표시용 (+ 포함)
    gradeBase: qualityBase,     // 색·분포·비교용
    // 이 점수를 만든 규칙 버전. 산출물이 스스로 밝히지 않으면 v7 로 잰 값과
    // v8 로 잰 값이 같은 표에 섞여도 아무도 모른다 — 실제로 그럴 뻔했다.
    scoringVersion: SCORING_VERSION,
    dead,                 // {deadFiles, keptFiles, unusedExports, filePct, exportPct, penalty, worst[]} — knip(@keep 제외), --dead 시만
    cognitive,            // {avg, p90, max, over15, over25, worst[5]} — 중첩 가중 복잡도
    fnLength,             // {avg,p90,max,over40,over80,worst[5]} — 함수 길이 분포(읽는 단위 크기)
    scoreInputs,          // 채점에 실제로 들어간 비율값 — 보정·재현·감사용
    duplication,          // {percent, blocks, worstFiles, worstBlocks} — 토큰 중복 밀도
    io,                   // {readers, uncachedReaders, loopSites, uncachedLoopSites, worst} — 루프 안 파일 읽기
    textbook,             // {awaitInForEach, spreadAccumulator, regexInLoop} — 교과서 결함(진단 전용)
    typeSafety,           // {anyType,asAny,nonNull,tsIgnore} — 타입 위생(진단 전용, 점수 미반영)
    testDensity,          // {files, lines, percent} — 테스트 두께(진단 전용, 점수 미반영 — 섞으면 지표가 뒤집힌다)
    quadratic,            // {sites, candidates, worst[], files[]} — 루프 안 O(n²) 배열 조회(★candidates 가 점수 반영)
    serialAwait,          // {sites, awaits, worst[]} — 독립인데 순차로 기다리는 await(★seqIo 로 점수 반영)
    nplusOne,             // {sites, perThousand, worst[]} — 루프 안 순차 DB/HTTP 조회(★seqIo 로 점수 반영)
    seqIo,                // {sites, perThousand} — 위 둘을 합친 채점축 "불필요한 순차 I/O"
    coupling,             // {cycles, filesInCycle, percent, largest, worst[]} — 순환 의존(진단 전용, 점수 미반영)
    renderGates,          // {hostages, worst} — fetch 하나가 무관한 UI까지 막고 있는 자리
    cc,                   // {functions, avg, p90, max, over10, over20, worst[5]} — McCabe (참고용)
    branchDensity,        // 100줄당 분기 수 (regex 근사, 참고용)
    branches: totalBranches,
    functions: totalFunctions,
    avgFileLines,
    longFiles,            // 200줄 초과 파일 수
    maxFile,
  },
  kit: {
    features: usedFeatures.sort((a, b) => b.loc - a.loc),
    savedLines,
    savedKB: estimatedKB,
    savedA4: estimatedA4,
    savedPercent,
    usage,
  },
};

// 출력
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
// 산출물 파일명. --kit 모드에선 기존 소비자(m1kkit)를 위해 옛 이름을 유지한다.
const outPath = path.join(outDir, wantKit ? "kit-stats.json" : "fixearly.json");
fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));

// --badge: README·사이트에 붙일 SVG 배지 + 마크다운 스니펫
if (wantBadge) {
  const badgePath = path.join(outDir, "fixearly.svg");
  fs.writeFileSync(badgePath, makeBadgeSvg(qualityGrade, qualityScore));
  const rel = path.relative(process.cwd(), badgePath);
  console.log(`\n  🏷  배지 생성: ${rel}`);
  console.log(`     README에 붙이기:  ![fixearly](${rel})`);
}

console.log(`  파일: ${files.length}개`);
console.log(`  코드: ${codeLines.toLocaleString()}줄 (전체 ${totalLines.toLocaleString()}줄)`);
console.log(`    프론트: ${breakdown.frontend.files}개 파일, ${breakdown.frontend.codeLines.toLocaleString()}줄`);
console.log(`    백엔드: ${breakdown.backend.files}개 파일, ${breakdown.backend.codeLines.toLocaleString()}줄`);
console.log(`    공용: ${breakdown.shared.files}개 파일, ${breakdown.shared.codeLines.toLocaleString()}줄`);
// kit 활용도/절약량은 @m1kapp/kit meta.json이 있을 때만 (선택적 부가정보) — 없으면 점수만.
if (hasKitMeta) {
  console.log(`  kit 사용: ${usedFeatures.length}개 요소`);
  console.log(`    컴포넌트: ${usage.component.used}/${usage.component.total}개 (${usage.component.percent}%)`);
  console.log(`    훅: ${usage.hook.used}/${usage.hook.total}개 (${usage.hook.percent}%)`);
  console.log(`    유틸리티: ${usage.util.used}/${usage.util.total}개 (${usage.util.percent}%)`);
  console.log(`  절약량: 약 ${savedLines.toLocaleString()}줄, ${estimatedKB}KB (A4 ${estimatedA4}장)`);
  console.log(`  비율: 전체의 약 ${savedPercent}%를 kit이 대신 처리`);
}
if (cc) {
  console.log(`  등급: ${qualityGrade} (${qualityScore}점) — 함수 ${cc.functions}개, cognitive 평균 ${cognitive.avg}·최대 ${cognitive.max}, cog15+ ${cognitive.over15}개·cog25+ ${cognitive.over25}개, 중복 ${duplication.percent}%, 200줄+ ${longFiles}개`);
  for (const w of cognitive.worst.filter((f) => f.cog > 15)) {
    console.log(`    복잡: ${w.name} cog ${w.cog} (CC ${w.cc}) — ${w.file}:${w.line}`);
  }
  if (duplication.percent > 3) {
    console.log(`  중복 상위 파일: ${duplication.worstFiles.map((f) => `${f.file}(${f.dupTokens}tok)`).join(", ")}`);
    for (const ex of duplication.worstBlocks) {
      console.log(`    중복 블록: ${ex.join(" ≒ ")}`);
    }
  }
  if (renderGates.hostages > 0) {
    console.log(`  렌더 인질: ${renderGates.hostages}곳 — 데이터를 기다리느라 이미 아는 UI까지 못 그립니다`);
    for (const w of renderGates.worst) {
      console.log(`    인질: <${w.element}> ${w.gate} 대기 (의존 프롭 ${w.dependentProps}/${w.totalProps}) — ${w.file}:${w.line}`);
    }
  }
  if (io.uncachedLoopSites > 0) {
    console.log(`  루프 안 파일읽기: ${io.uncachedLoopSites}곳 (캐시 없는 리더 ${io.uncachedReaders}/${io.readers}개) — 호출 1번이 파일 N번 읽습니다`);
    for (const w of io.worst) {
      console.log(`    반복 읽기: ${w.callee}() — ${w.file}:${w.line}`);
    }
  }
} else {
  console.log(`  등급: ${qualityGrade} (${qualityScore}점) — 분기밀도 ${branchDensity}/100줄, 평균 ${avgFileLines}줄/파일, 200줄+ ${longFiles}개 (regex 폴백 — typescript 설치 시 AST 정밀 분석)`);
}
if (textbook) {
  const t = textbook;
  if (t.awaitInForEach.count > 0) {
    console.log(`  ⚠ await in forEach: ${t.awaitInForEach.count}곳 — forEach는 프라미스를 무시합니다 (기다리지 않는 버그, for...of 또는 Promise.all)`);
    for (const w of t.awaitInForEach.worst) console.log(`    ${w.file}:${w.line}`);
  }
  if (t.spreadAccumulator.count > 0) {
    console.log(`  스프레드 누적: ${t.spreadAccumulator.count}곳 — acc = [...acc, x] 는 매 회 전체 복사 O(n²) (push/직접 대입)`);
    for (const w of t.spreadAccumulator.worst) console.log(`    (${w.where}) ${w.file}:${w.line}`);
  }
  if (t.statefulRegex.count > 0) {
    console.log(`  ⚠ 전역 정규식 상태: ${t.statefulRegex.count}곳 — /g 정규식을 루프에서 .test() 하면 lastIndex가 문자열 사이로 새어 결과가 번갈아 틀립니다`);
    for (const w of t.statefulRegex.worst) console.log(`    ${w.name}.${w.method}() — ${w.file}:${w.line}`);
  }
  if (t.forInArray.count > 0) {
    console.log(`  ⚠ 배열에 for...in: ${t.forInArray.count}곳 — 인덱스가 문자열이고 상속 속성까지 돕니다 (for...of 권장)`);
    for (const w of t.forInArray.worst) console.log(`    ${w.name} — ${w.file}:${w.line}`);
  }
  if (t.emptyCatch.count > 0) {
    console.log(`  빈 catch: ${t.emptyCatch.count}곳 — 에러를 삼킵니다 (최소한 로그나 주석을)`);
    for (const w of t.emptyCatch.worst.slice(0, 4)) console.log(`    ${w.file}:${w.line}`);
  }
  if (t.sharedRefFill.count > 0) {
    console.log(`  ⚠ 공유 참조 fill: ${t.sharedRefFill.count}곳 — Array(n).fill([]/{}) 는 참조 하나를 모든 칸이 공유합니다 (한 칸 수정 = 전부 수정, 조용한 버그)`);
    for (const w of t.sharedRefFill.worst) console.log(`    .fill(${w.what}) — ${w.file}:${w.line}`);
  }
  if (t.numericSortNoComparator.count > 0) {
    console.log(`  ⚠ 숫자 정렬 버그: ${t.numericSortNoComparator.count}곳 — 숫자 배열을 sort() 비교자 없이 = 사전순 ([10,2,1]→[1,10,2])`);
    for (const w of t.numericSortNoComparator.worst) console.log(`    .sort() — ${w.file}:${w.line}`);
  }
  if (t.loopInvariantIndex.count > 0) {
    console.log(`  루프 안 인덱스 재구축: ${t.loopInvariantIndex.count}곳 — 루프 밖 값으로 new Set/Map을 매 회 다시 만듭니다 O(n·m) (루프 밖으로 호이스팅)`);
    for (const w of t.loopInvariantIndex.worst) console.log(`    new ${w.ctor}(${w.src}…) — ${w.file}:${w.line}`);
  }
  if (t.floatingPromise.count > 0) {
    console.log(`  ⚠ floating promise: ${t.floatingPromise.count}곳 — async 함수를 await 없이 호출하고 결과를 버립니다 (기다리지 않는 버그)`);
    for (const w of t.floatingPromise.worst) console.log(`    ${w.name}() — ${w.file}:${w.line}`);
  }
  if (t.regexInLoop.count > 0) {
    console.log(`  루프 안 new RegExp: ${t.regexInLoop.count}곳 — 매 회 재컴파일 (루프 밖으로 호이스팅)`);
    for (const w of t.regexInLoop.worst) console.log(`    ${w.file}:${w.line}`);
  }
}
if (testDensity) {
  if (testDensity.files > 0) {
    // 코퍼스 52개 중앙 102% — 아래면 '맨몸 복잡함' 쪽, 위면 '방어된 복잡함' 쪽으로 읽는다.
    const rel = testDensity.percent >= 102 ? "코퍼스 중앙(102%) 이상" : "코퍼스 중앙(102%) 미만";
    console.log(`  테스트 두께: 프로덕션 ${codeLines.toLocaleString()}줄 대비 테스트 ${testDensity.lines.toLocaleString()}줄 = ${testDensity.percent}% (${testDensity.files}개 파일, ${rel}) — 점수 미반영`);
  }
}
if (typeSafety && typeSafety.tsFiles > 0) {
  const t = typeSafety;
  const bits = [];
  if (t.anyType.count) bits.push(`any ${t.anyType.count}개(타입주석의 ${t.anyType.pct}%)`);
  if (t.asAny.count) bits.push(`as any ${t.asAny.count}`);
  if (t.nonNull.count) bits.push(`non-null(!) ${t.nonNull.count}`);
  if (t.tsIgnore.count) bits.push(`@ts-ignore ${t.tsIgnore.count}`);
  if (bits.length) {
    console.log(`  타입 위생: ${bits.join(" · ")} — 타입을 포기한 자리 (점수 미반영, 경계에선 정당할 수 있음)`);
    for (const w of t.tsIgnore.worst.slice(0, 3)) console.log(`    @ts-${w.what} — ${w.file}:${w.line}`);
    for (const w of t.asAny.worst.slice(0, 3)) console.log(`    ${w.text} — ${w.file}:${w.line}`);
  }
}
// 결합도 — 순환에 묶인 모듈은 따로 읽지도, 테스트하지도, 교체하지도 못한다.
if (coupling && coupling.cycles > 0) {
  console.log(`  순환 의존: ${coupling.cycles}개 (모듈 ${coupling.filesInCycle}개 = ${coupling.percent}%) — 서로를 import 해 한 덩어리가 된 자리(소스 기준), 점수 미반영`);
  for (const c of coupling.worst) {
    // 분석 대상이 cwd 밖이면 ../../.. 이 길게 붙어 읽을 수가 없다 — 공통 앞부분을 걷는다.
    const short = (f) => f.replace(/^(\.\.\/)+/, "").replace(/^.*?\/([^/]+\/[^/]+)$/, "$1");
    console.log(`    ${c.size}개 모듈: ${c.sample.map(short).join(" ↔ ")}${c.size > c.sample.length ? " …" : ""}`);
  }
}
if (serialAwait && serialAwait.sites > 0) {
  console.log(`  독립 순차 await: ${serialAwait.sites}곳 (await ${serialAwait.awaits}개) — 서로 참조 안 하는데 줄줄이 대기, Promise.all 로 합→최댓값, 점수 반영`);
  for (const w of serialAwait.worst.slice(0, 4)) {
    console.log(`    ${w.count}개 연속 — ${w.file}:${w.line}`);
    for (const c of w.calls.slice(0, 3)) console.log(`        await ${c}`);
  }
}
if (quadratic && quadratic.sites > 0) {
  const z = quadratic.zones || {};
  const cb = quadratic.cutBy || {};
  const cutTxt = Object.keys(cb).length
    ? ` · 게이트 컷 ${quadratic.preGateCandidates - quadratic.candidates}곳(${Object.entries(cb).map(([k, v]) => `${k} ${v}`).join(", ")})`
    : "";
  console.log(`  O(n²) 배열 조회: ${quadratic.sites}곳 (PR후보 ${quadratic.candidates}곳${cutTxt} · backend ${z.backend || 0}/frontend ${z.frontend || 0}/test ${z.test || 0}) — 루프 안 선형 탐색, Map/Set으로 O(n) — PR후보 3곳 이상부터 점수 반영`);
  for (const w of quadratic.worst.slice(0, 6)) {
    const tag = w.zone === "backend" ? "★backend" : w.zone;
    console.log(`    [${tag}${w.dynamicOuter ? "" : " ·유계"}] ${w.recv}.${w.method}() — ${w.file}:${w.line}${w.outer ? `  (loop: ${w.outer})` : ""}`);
  }
  if (wantMine) {
    const list = quadratic.candidateList || [];
    console.log(`\n  ── --mine: PR 후보 전체 ${list.length}곳 (backend/기타·무계 반복, 손검증 대상) ──`);
    for (const c of list) {
      console.log(`    [${c.zone}] ${c.recv}.${c.method}() — ${c.file}:${c.line}${c.outer ? `  (loop: ${c.outer})` : ""}`);
    }
    const minePath = path.join(outDir, "quadratic-candidates.json");
    try { fs.writeFileSync(minePath, JSON.stringify(list, null, 2)); console.log(`  ✓ 후보 목록 저장 → ${minePath}`); } catch {}
  }
}

// --hotspots: cog × git churn = "먼저 고칠 파일". 점수(무상태)와 별개 — 시간축(변경빈도)이 필요.
// 복잡함(변경당 비쌈) × 자주변경(빈도) = 리팩터 ROI 최대. 안정적 복잡함수는 낮게(안 건드리므로).
let hotspotRanked = [];
// 저장소 활동량 — 최근 창(6개월) 커밋 수와 마지막 커밋 시각.
// 아무도 안 만지는 코드에 '고쳐라' 목록을 내미는 건 일감을 만들어내는 짓이다.
// 지표는 늘 뭔가를 지적할 수 있지만, 변경 비용은 '변경이 일어날 때만' 발생한다.
let repoActivity = { commits6mo: null, lastCommitAt: null, tracked: false };
// churn 원본(1회 변경도 포함). hotspotRanked 는 churn>=2 만 남기므로 '0회'와 '1회'를 구분 못 한다.
let churnByFile = [];
if ((wantHotspots || wantReport) && ts && allFns.length > 0) {
  // per-file 최악 cog. allFns.file 은 cwd 기준이라 srcDir 기준으로 정규화해 churn 키와 맞춘다.
  const srcAbs = path.resolve(srcDir);
  const fileMaxCog = new Map();
  for (const f of allFns) {
    const key = path.relative(srcAbs, path.resolve(process.cwd(), f.file));
    if (key.startsWith("..")) continue;
    const cur = fileMaxCog.get(key);
    if (!cur || f.cog > cur.cog) fileMaxCog.set(key, { cog: f.cog, name: f.name, line: f.line });
  }
  // git churn (파일별 커밋 터치 수). 이력 없으면 스킵.
  const churn = new Map();
  try {
    const root0 = execFileSync("git", ["-C", srcDir, "rev-parse", "--show-toplevel"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const rel0 = path.relative(root0, path.resolve(srcDir)) || ".";
    const recent = execFileSync("git", ["-C", root0, "log", "--since=6.months", "--no-merges", "--oneline", "--", rel0],
      { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }).trim();
    const last = execFileSync("git", ["-C", root0, "log", "-1", "--format=%cI", "--", rel0], { encoding: "utf-8" }).trim();
    repoActivity = {
      commits6mo: recent ? recent.split("\n").length : 0,
      lastCommitAt: last || null,
      tracked: true,
    };
  } catch { /* git 없음 — 활동량 미상 */ }
  try {
    const root = execFileSync("git", ["-C", srcDir, "rev-parse", "--show-toplevel"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const rel = path.relative(root, path.resolve(srcDir));
    const log = execFileSync("git", ["-C", root, "log", "--no-merges", "--pretty=format:", "--name-only", "--", rel || "."],
      { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 });
    for (const line of log.split("\n")) {
      const p = line.trim(); if (!p) continue;
      const r = path.relative(path.resolve(srcDir), path.resolve(root, p));
      if (r && !r.startsWith("..")) churn.set(r, (churn.get(r) || 0) + 1);
    }
  } catch { /* git 없음/이력 없음 */ }

  if (churn.size === 0) {
    if (wantHotspots) console.log(`\n  핫스팟: git 이력을 읽지 못했습니다 (git repo가 아니거나 --dir 에 커밋 이력 없음).`);
  } else {
    const ranked = [...fileMaxCog.entries()]
      .map(([file, m]) => ({ file, ...m, churn: churn.get(file) || 0 }))
      .filter((r) => r.churn >= 2)
      .map((r) => ({ ...r, hot: r.cog * Math.log1p(r.churn) }))
      .sort((a, b) => b.hot - a.hot);
    hotspotRanked = ranked;
    churnByFile = [...churn.entries()].map(([file, n]) => ({ file, churn: n }));
    if (!wantHotspots) { /* 리포트 전용 호출 — 콘솔 출력 생략 */ } else {
    console.log(`\n  ── --hotspots: 복잡 × 변경빈도 = 먼저 고칠 파일 (점수 아닌 리팩터 우선순위) ──`);
    console.log(`  ${"maxCog".padStart(6)} ${"churn".padStart(5)}   worst함수 · 파일`);
    for (const r of ranked.slice(0, 12)) {
      console.log(`  ${String(r.cog).padStart(6)} ${String(r.churn).padStart(5)}   ${r.name}():${r.line}  ${r.file}`);
    }
    // 안정적 복잡함수(놔둘 것) — cog 높은데 churn 적음
    const stable = [...fileMaxCog.entries()]
      .map(([file, m]) => ({ file, ...m, churn: churn.get(file) || 0 }))
      .filter((r) => r.cog >= 60 && r.churn <= 2)
      .sort((a, b) => b.cog - a.cog).slice(0, 3);
    if (stable.length) {
      console.log(`\n  놔둘 것 (복잡하지만 안정 — churn 낮아 리팩터 ROI 낮음):`);
      for (const r of stable) console.log(`    cog ${r.cog} churn ${r.churn}  ${r.name}()  ${r.file}`);
    }
    try {
      const hp = path.join(outDir, "hotspots.json");
      fs.writeFileSync(hp, JSON.stringify(ranked.slice(0, 50), null, 2));
      console.log(`\n  ✓ 핫스팟 저장 → ${hp}`);
    } catch {}
    }
  }
}
if (dead) {
  console.log(`  데드코드: 죽은 파일 ${dead.deadFiles}개(${dead.filePct}%)·미사용 export ${dead.unusedExports}개(${dead.exportPct}%) → 감점 −${dead.penalty}${dead.keptFiles > 0 ? ` · @keep 제외 ${dead.keptFiles}개` : ""}`);
  for (const f of dead.worst) console.log(`    죽음: ${f}`);
}
// ── (선택) LLM 자문 — 정적 지표가 못 보는 네이밍·응집도. 점수엔 미반영, 자문만 ──
if (args.includes("--llm") && cognitive) {
  try {
    console.log(`  LLM 자문 요청 중... (claude haiku)`);
    // cognitive 최악 3개 함수 소스 발췌 (각 최대 60줄)
    const snippets = cognitive.worst.slice(0, 3).map((w) => {
      const abs = path.resolve(process.cwd(), w.file);
      const src = fs.readFileSync(abs, "utf-8").split("\n");
      const from = Math.max(0, w.line - 1);
      return `// ${w.file}:${w.line} — ${w.name} (cognitive ${w.cog})\n` + src.slice(from, from + 60).join("\n");
    }).join("\n\n---\n\n");

    const prompt = `다음은 한 프로젝트에서 cognitive complexity가 가장 높은 함수들이다. 정적 지표로 못 보는 관점만 평가하라: 네이밍 명확성, 함수 응집도(한 가지 일만 하는가), 본질적 복잡성인지 정리 가능한 복잡성인지. 반드시 아래 JSON 한 줄로만 답하라:
{"naming": 0-100, "cohesion": 0-100, "essential": true|false, "advice": "한국어 한 문장"}

${snippets}`;

    const out = execFileSync("claude", ["-p", prompt, "--model", "haiku"], {
      encoding: "utf-8",
      timeout: 90_000,
      maxBuffer: 1024 * 1024,
    });
    // 중첩 없는 JSON 오브젝트 후보들 중 파싱되는 첫 번째 사용
    const candidates = out.match(/\{[^{}]*\}/g) || [];
    let llm = null;
    for (const c of candidates) {
      try { llm = JSON.parse(c); break; } catch { /* 다음 후보 */ }
    }
    if (llm) {
      stats.quality.llm = { model: "haiku", ...llm };
      fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
      console.log(`  LLM 자문: 네이밍 ${llm.naming} · 응집도 ${llm.cohesion} · 본질적 복잡성 ${llm.essential ? "예" : "아니오"}`);
      console.log(`    → ${llm.advice}`);
    }
  } catch (e) {
    console.log(`  LLM 자문 실패 (claude CLI 필요): ${e.message?.slice(0, 60)}`);
  }
}

console.log(`\n  저장됨 → ${path.relative(process.cwd(), outPath)}\n`);

// 이력 저장 — "고쳤는데 점수가 안 움직인다"의 답은 점수 민감도가 아니라 변화량이다.
// 점수 축을 민감하게 만들면 게이밍 민감도도 같은 계수로 오른다(실측: 분모를 조이면 개당 이득 3배,
// 쓰레기 헬퍼로 얻는 이득도 3배). 그래서 점수는 둔감하게 두고, 체감은 자기 이력과의 비교로 준다.
// 자기 이력은 게이밍이 안 된다 — 헬퍼를 양산해도 "긴 함수 개수"는 줄지 않는다.
const HISTORY_FILE = ".fixearly-history.json";
let history = [];
let previous = null;
{
  const hp = path.resolve(process.cwd(), HISTORY_FILE);
  try { history = JSON.parse(fs.readFileSync(hp, "utf-8")); } catch { history = []; }
  if (!Array.isArray(history)) history = [];
  const dir = path.relative(process.cwd(), path.resolve(srcDir)) || ".";
  const mine = history.filter((h) => h.dir === dir);
  previous = mine.length ? mine[mine.length - 1] : null;
  const snap = {
    dir, at: new Date().toISOString().slice(0, 19).replace("T", " "), rules: SCORING_VERSION,
    score: qualityScore, grade: qualityGrade,
    files: files.length, codeLines,
    ...(ts && scoreInputs ? {
      fnOver40: fnLength.over40, fnP90: fnLength.p90, fnMax: fnLength.max, fnTop10: fnLength.top10avg,
      cogOver15: cognitive.over15, cogOver25: cognitive.over25, cogMax: cognitive.max, cogTop10: cognitive.top10avg,
      dup: duplication.percent, avgFileLines, longFiles,
      quad: (quadratic || {}).sites || 0, functions: totalFunctions,
    } : {}),
  };
  history.push(snap);
  if (history.length > 40) history = history.slice(-40);
  try { fs.writeFileSync(hp, JSON.stringify(history, null, 2)); } catch { /* 쓰기 실패는 무시 */ }
  if (previous && previous.rules && previous.rules !== SCORING_VERSION) {
    console.log(`  지난 측정은 채점 규칙 ${previous.rules}로 잰 값입니다 (현재 ${SCORING_VERSION}) — 점수 비교는 무효, 원지표만 비교하세요.`);
  }
  if (previous) {
    const d = qualityScore - previous.score;
    const sign = d > 0 ? "+" : "";
    const stale = previous.rules && previous.rules !== SCORING_VERSION;
    console.log(`  지난 측정(${previous.at}${stale ? `, 규칙 ${previous.rules}` : ""}) 대비: ${previous.grade} ${previous.score} → ${qualityGrade} ${qualityScore} (${sign}${d}점)${stale ? " ⚠ 규칙 변경됨" : ""}`);
  } else {
    console.log(`  이력 시작 — ${HISTORY_FILE} 에 기록했습니다. 다음 실행부터 변화량을 보여줍니다.`);
  }
}

// --report : 한 장짜리 HTML 리포트. "어디쯤인가 + 무엇부터 고칠까" 두 질문에만 답한다.
// 코퍼스(유명 OSS 70개) 기준선을 패키지에 동봉해 오프라인에서도 비교가 된다.
if (wantReport && !stats.quality.scoreInputs) {
  // regex 폴백에선 축 지표가 없다 — 반쪽 리포트를 내놓는 것보다 이유를 말하는 게 낫다.
  console.error("  리포트는 AST 모드에서만 생성됩니다 (typescript 필요). npx로 실행하면 자동 설치되고,");
  console.error("  이미 설치본을 쓰신다면 대상 프로젝트나 이 도구에 typescript를 설치하세요.\n");
} else if (wantReport) {
  try {
    const { renderReport } = await import("./report.mjs");
    const here = path.dirname(new URL(import.meta.url).pathname);
    const corpusPath = path.join(here, "..", "data", "corpus.json");
    const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf-8"));
    const reportPath = path.resolve(process.cwd(), getFlag("report") || "fixearly-report.html");
    const projectName = path.basename(path.resolve(srcDir)) === "src"
      ? path.basename(path.dirname(path.resolve(srcDir))) + "/src"
      : path.basename(path.resolve(srcDir));
    const html = renderReport({
      projectName, quality: stats.quality, source: stats.source, corpus, hotspots: hotspotRanked,
      previous, history: history.filter((h) => h.dir === (path.relative(process.cwd(), path.resolve(srcDir)) || ".")),
      repoActivity,
      churnByFile,
    });
    fs.writeFileSync(reportPath, html);
    console.log(`  ✓ 리포트 → ${path.relative(process.cwd(), reportPath)}  (브라우저로 열어보세요)\n`);
  } catch (e) {
    console.error(`  리포트 생성 실패: ${e.message}`);
  }
}
