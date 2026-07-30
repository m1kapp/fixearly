#!/usr/bin/env node
/**
 * fixearly impact — fixearly가 낸 PR들의 머지 상태를 GitHub에서 긁어
 * 임팩트 점수(머지 1건 = +1)를 계산하고 IMPACT.md를 재생성한다.
 *
 * 소스: impact.json (findings 레지스트리)
 * 사용: node bin/impact.mjs           # 상태 조회 + IMPACT.md 갱신
 *       node bin/impact.mjs --check    # 조회만(파일 안 씀), CI용 종료코드
 *
 * gh 불필요 — 공개 PR은 GitHub REST API로 조회(비인증 60req/h면 충분).
 * GITHUB_TOKEN 있으면 헤더에 실어 레이트리밋 완화.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "impact.json"), "utf-8"));
const findings = registry.findings || [];

/**
 * PR 상태 — "열림" 하나로 뭉치지 않는다.
 *
 * 12개가 전부 '리뷰 중' 으로 보이면 실제로 뭐가 진행되고 뭐가 방치됐는지 알 수 없다.
 * 승인만 받고 머지 버튼을 기다리는 것과, 리뷰어조차 안 붙은 것은 다른 상태다.
 * 리뷰 목록을 한 번 더 받아 그 차이를 드러낸다.
 */
async function prStatus(repo, pr) {
  const headers = { "User-Agent": "fixearly-impact", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const get = async (u) => {
    const res = await fetch(u, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    const d = await get(`https://api.github.com/repos/${repo}/pulls/${pr}`);
    if (d.merged) return { state: "merged", url: d.html_url };
    if (d.state !== "open") return { state: "closed", url: d.html_url };
    if (d.draft) return { state: "draft", url: d.html_url };

    // 열린 PR 만 리뷰를 확인한다 — 닫힌 것에 쓸 호출을 아낀다.
    let reviews = [];
    try {
      reviews = await get(`https://api.github.com/repos/${repo}/pulls/${pr}/reviews?per_page=100`);
    } catch { /* 리뷰 조회 실패는 치명적이지 않다 — open 으로 떨어진다 */ }

    // 리뷰어별 마지막 판정만 센다. APPROVED 후 COMMENTED 가 와도 승인은 유지된다.
    const last = new Map();
    for (const r of reviews) {
      if (r.state === "COMMENTED") continue; // 단순 코멘트는 판정이 아니다
      last.set(r.user?.login, r.state);
    }
    const verdicts = [...last.values()];
    if (verdicts.includes("CHANGES_REQUESTED")) return { state: "changes", url: d.html_url };
    if (verdicts.includes("APPROVED")) return { state: "approved", url: d.html_url };

    // 판정은 없지만 사람이 붙은 흔적 — 리뷰어 지정 또는 리뷰 코멘트.
    const engaged = (d.requested_reviewers || []).length > 0 || (d.review_comments || 0) > 0 || reviews.length > 0;
    return { state: engaged ? "reviewing" : "waiting", url: d.html_url };
  } catch (e) {
    return { state: "unknown", err: e.message };
  }
}

/**
 * 저장소 별 수 — 손으로 적어두면 시점마다 갈린다.
 * 실제로 같은 저장소가 46729★ 와 47k★ 로 갈라져 있었다. GitHub 에서 받아 통일한다.
 */
const starCache = new Map();
async function repoStars(repo) {
  if (starCache.has(repo)) return starCache.get(repo);
  const headers = { "User-Agent": "fixearly-impact", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let n = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (res.ok) n = (await res.json()).stargazers_count ?? null;
  } catch { /* 실패하면 기존 라벨을 그대로 쓴다 */ }
  starCache.set(repo, n);
  return n;
}

/** 39812 → "39.8k" · 1200000 → "1.2m" */
function fmtStars(n) {
  if (n == null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const LABEL = {
  merged: { icon: "✅", ko: "merged", point: 1 },
  approved: { icon: "🔵", ko: "approved · 머지 대기", point: 0 },
  changes: { icon: "🟠", ko: "changes requested", point: 0 },
  reviewing: { icon: "🟢", ko: "reviewing", point: 0 },
  waiting: { icon: "⚪", ko: "awaiting review", point: 0 },
  draft: { icon: "🟡", ko: "draft", point: 0 },
  open: { icon: "🟢", ko: "open", point: 0 },
  closed: { icon: "❌", ko: "closed", point: 0 },
  unknown: { icon: "⚪", ko: "unknown", point: 0 },
};

console.log("  PR 상태 조회 중...\n");
const rows = [];
let score = 0;
for (const f of findings) {
  const st = await prStatus(f.repo, f.pr);
  const L = LABEL[st.state] || LABEL.unknown;
  score += L.point;
  const prUrl = st.url || `https://github.com/${f.repo}/pull/${f.pr}`;
  const stars = fmtStars(await repoStars(f.repo));
  const label = stars ? `${String(f.repoLabel).split("·")[0].trim()} · ${stars}★` : f.repoLabel;
  if (label !== f.repoLabel) f.repoLabel = label; // registry 도 같이 맞춘다
  rows.push({ ...f, repoLabel: label, status: st.state, prUrl });
  console.log(`  ${L.icon} ${L.ko.padEnd(7)} #${f.pr}  ${f.title}  (${f.repo})`);
}
console.log(`\n  임팩트 점수: ${score} (머지 ${score}건)\n`);

if (checkOnly) process.exit(0);

// 상태를 하나라도 못 읽었으면(레이트리밋·네트워크) 파일을 쓰지 않는다.
// 잘못된 'unknown'을 IMPACT.md·랜딩에 박아 로그를 오염시키는 것보다 그대로 두는 게 낫다.
const unknown = rows.filter((r) => r.status === "unknown");
if (unknown.length > 0) {
  console.error(`  ⚠ ${unknown.length}건 상태 조회 실패 — 파일을 갱신하지 않습니다.`);
  console.error("    비인증 GitHub API는 시간당 60회 제한입니다. GITHUB_TOKEN=$(gh auth token) 을 붙여 다시 실행하세요.\n");
  process.exit(1);
}

// IMPACT.md 재생성
const tableRows = rows
  .map((r) => {
    const L = LABEL[r.status] || LABEL.unknown;
    const status = `${L.icon} ${L.ko}${r.status === "draft" || r.status === "open" ? " · 머지되면 +1" : ""}`;
    const pt = L.point ? "+1" : "—";
    return `| \`${r.title}\` | [${r.repoLabel}](https://github.com/${r.repo}) | ${r.type} | [#${r.pr}](${r.prUrl}) | ${status} | ${pt} |`;
  })
  .join("\n");

const md = `# fixearly — 실전 성과 (impact log)

fixearly가 **실제 오픈소스에서 찾아낸 이슈**와 그 결과. 점수판이 아니라 **증거**다 —
"점수"가 등급만 매기는 게 아니라, 진짜 고칠 것을 파일:줄 단위로 짚는다는 증명.

> **fixearly 임팩트 점수: ${score}**
> 머지된 PR 1개 = **+1점**. (draft·open = 0, 닫힘 = 0)
> _(fixearly가 실제로 고쳐 머지된 것의 누적 — 대상 repo의 점수와는 별개 지표.)_
>
> _(자동 생성 — \`node bin/impact.mjs\`. GitHub PR 상태 기준.)_

| 발견 | repo | 유형 | PR | 상태 | 점수 |
|------|------|------|----|------|------|
${tableRows}

## 규칙

- fixearly가 찾은 이슈로 낸 PR만 기록한다.
- **손 검증 필수** — 정적 분석은 후보만 뽑는다. 오탐 PR은 툴 신뢰를 깎으므로 금지.
- **머지되면 +1.** 닫히면 0. 정직하게.

## 어떻게 찾았나

\`\`\`bash
npx fixearly --dir=src --dead
\`\`\`

\`quality.io\`(루프 안 파일읽기 + DB/HTTP 순차 await)와 \`quality.dead\`(knip)가 후보를 파일:줄로
뱉는다. SonarQube가 원리상 못 잡는 축이다. 나머지는 사람의 검증.
`;

fs.writeFileSync(path.join(ROOT, "IMPACT.md"), md);
// 별 수를 새로 받았으면 registry 도 같이 저장한다 — 다음 실행·랜딩이 같은 값을 쓰게.
fs.writeFileSync(path.join(ROOT, "impact.json"), JSON.stringify(registry, null, 1) + "\n");
console.log("  ✓ IMPACT.md 갱신됨");

// 랜딩(index.html) 동기화: 임팩트 점수 + 각 PR 상태 배지(등장 순서 = findings 순서)
const statusText = (st) => {
  const L = LABEL[st] || LABEL.unknown;
  if (st === "merged") return `${L.icon} merged · 임팩트 +1`;
  if (st === "closed") return `${L.icon} closed`;
  return `${L.icon} ${L.ko} · 머지되면 임팩트 +1`;
};
for (const file of ["index.html"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf-8");
  const before = s;
  s = s.replace(/(임팩트 점수 <b>)\d+(<\/b>)/, `$1${score}$2`);
  let i = 0;
  s = s.replace(/(<span class="find-status">)[^<]*(<\/span>)/g, (m, open, close) => {
    const r = rows[i++];
    return r ? `${open}${statusText(r.status)}${close}` : m;
  });
  if (s !== before) {
    fs.writeFileSync(p, s);
    console.log(`  ✓ ${file} 동기화 (점수 ${score}, PR ${rows.length}건)`);
  }
}
