#!/usr/bin/env node
/**
 * update-board — data/corpus.json 의 점수/등급을 랜딩 보드에 반영한다.
 *
 * 왜 '제자리 갱신'인가: 보드 마크업은 details/summary + :target 필터로 JS 없이도 살아 있게
 * 짜여 있다(모바일에서 인라인 스크립트가 CSP에 막힌 적이 있다). 그 구조를 매번 다시 생성하면
 * 그때마다 깨질 위험을 산다. 채점 규칙이 바뀌어도 실제로 달라지는 건 점수·등급·순위뿐이므로
 * (v6 → v7 실측: 원지표 차이는 소수점 반올림뿐) 그 세 가지만 건드린다.
 *
 * 하는 일:
 *   ① 각 체급 그룹 안에서 <details> 행을 뽑아 corpus 의 새 점수로 재정렬
 *   ② 순위(rk)·data-row 재번호
 *   ③ 등급 배지와 점수 숫자 교체
 *   ④ '동종 기준선' 줄의 중앙값·이 저장소·격차 재계산 (kind 별 중앙값이 점수와 함께 움직인다)
 *
 * 사용: node tools/update-board.mjs [--check]
 *   --check  파일을 쓰지 않고 무엇이 바뀌는지만 출력
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const corpusRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "corpus.json"), "utf8"));
const repos = corpusRaw.repos || corpusRaw;
const byName = new Map(repos.map((r) => [r.name, r]));

const BADGE = { SSS: "g gS", SS: "g gS", S: "g gS", "A+": "g gA", A: "g gA", "B+": "g gB", B: "g gB", "C+": "g gC", C: "g gC", "D+": "g gD", D: "g gD", "E+": "g gE", E: "g gE" };

// kind(종류)별 중앙 점수 — '동종 기준선' 줄이 쓰는 값. 점수가 바뀌면 이것도 바뀐다.
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const kindStats = new Map();
for (const r of repos) {
  if (!kindStats.has(r.kind)) kindStats.set(r.kind, []);
  kindStats.get(r.kind).push(r.score);
}
const kindMedian = new Map([...kindStats].map(([k, v]) => [k, median(v)]));
const kindCount = new Map([...kindStats].map(([k, v]) => [k, v.length]));

const nameOf = (row) => {
  const m = row.match(/<span class="rn">([^<]+)</);
  return m ? m[1] : null;
};

function patchRow(row, repo, rank, dataRow) {
  let out = row;
  const badge = BADGE[repo.gradeF] || "g gA";

  // ③ 등급 배지 + 점수
  out = out.replace(
    /<span class="g g[A-Za-z]+">[A-Z+]+<\/span><b>\d+<\/b>/,
    `<span class="${badge}">${repo.gradeF}</span><b>${repo.score}</b>`,
  );
  // ② 순위 · data-row
  out = out.replace(/<span class="rk">\d+<\/span>/, `<span class="rk">${rank}</span>`);
  out = out.replace(/data-row="\d+"/, `data-row="${dataRow}"`);

  // ④ 동종 기준선: "… 라이브러리 31개 중앙 <b>87</b> · 이 저장소 <b>100</b> <span class="pd">+13</span>"
  const med = kindMedian.get(repo.kind);
  const cnt = kindCount.get(repo.kind);
  const gap = repo.score - med;
  out = out.replace(
    /(<div class="peer">[\s\S]*?<\/span>\s*)(\d+)(<span class="ko">개 중앙<\/span>)/,
    (_m, pre, _n, post) => pre + cnt + post,
  );
  out = out.replace(
    /(개 중앙<\/span><span class="en"> median<\/span> <b>)\d+(<\/b>)/,
    (_m, pre, post) => pre + med + post,
  );
  out = out.replace(
    /(<span class="en">this repo<\/span> <b>)\d+(<\/b> <span class="pd[^"]*">)[+\-−]?\d+(<\/span>)/,
    (_m, pre, mid, post) => `${pre}${repo.score}${mid}${gap >= 0 ? "+" : "−"}${Math.abs(gap)}${post}`,
  );
  return out;
}

let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const boardStart = html.indexOf('<div class="board"');
if (boardStart < 0) {
  console.error("보드 블록을 찾지 못했습니다.");
  process.exit(2);
}

// 그룹 경계로 자른다. 각 그룹 = <div class="grp" …><div class="grph">…</div> + <details>…</details>*
const changes = [];
let dataRow = 0;
const groupRe = /(<div class="grp" id="[^"]+"[^>]*>)(<div class="grph">[\s\S]*?<\/div>)([\s\S]*?)(?=<div class="grp" id=|<\/div><\/main>|$)/g;

const newHtml = html.replace(groupRe, (whole, open, head, body) => {
  // 그룹 꼬리(닫는 </div> 등)는 마지막 </details> 뒤를 그대로 남긴다
  const lastEnd = body.lastIndexOf("</details>");
  if (lastEnd < 0) return whole;
  const rowsPart = body.slice(0, lastEnd + "</details>".length);
  const tail = body.slice(lastEnd + "</details>".length);

  const rows = rowsPart.split("</details>").filter((s) => s.includes("<details")).map((s) => s + "</details>");
  const withRepo = rows.map((row) => ({ row, repo: byName.get(nameOf(row)) })).filter((x) => x.repo);
  if (withRepo.length !== rows.length) {
    console.error(`경고: 그룹에서 corpus 에 없는 저장소 ${rows.length - withRepo.length}개 — 원본 유지`);
    return whole;
  }
  // ① 새 점수로 재정렬 (동점은 중복 낮은 순 → 최대 복잡도 낮은 순, 옛 생성기와 동일 규칙)
  withRepo.sort((a, b) => b.repo.score - a.repo.score || a.repo.dup - b.repo.dup || a.repo.maxCog - b.repo.maxCog);

  const rebuilt = withRepo.map((x, i) => {
    const before = { score: (x.row.match(/<b>(\d+)<\/b><span class="car">/) || [])[1], grade: (x.row.match(/<span class="g g[A-Za-z]+">([A-Z+]+)<\/span>/) || [])[1] };
    if (String(x.repo.score) !== before.score || x.repo.gradeF !== before.grade) {
      changes.push(`${x.repo.name}: ${before.grade} ${before.score} → ${x.repo.gradeF} ${x.repo.score}`);
    }
    return patchRow(x.row, x.repo, i + 1, dataRow++);
  }).join("");

  return open + head + rebuilt + tail;
});

console.log(`점수·등급 변동 ${changes.length}건`);
for (const c of changes) console.log("  " + c);

if (CHECK) {
  console.log("\n--check: 파일을 쓰지 않았습니다.");
  process.exit(0);
}
// 구조 회귀 가드 — 행 수·태그 균형이 어긋나면 쓰지 않는다(예전에 문자열 수술로 보드를 깨뜨렸다)
const count = (s, re) => (s.match(re) || []).length;
for (const [label, re] of [["details 열기", /<details class="rw">/g], ["details 닫기", /<\/details>/g], ["summary", /<summary class="row"/g], ["grp", /<div class="grp" id=/g]]) {
  if (count(newHtml, re) !== count(html, re)) {
    console.error(`중단: ${label} 개수가 ${count(html, re)} → ${count(newHtml, re)} 로 바뀌었습니다.`);
    process.exit(1);
  }
}
// index.html 만 쓴다. 예전엔 landing.html 에도 같은 내용을 썼는데, 읽은 건
// index.html 이라서 두 파일이 서로를 덮는 관계였다. landing.html 은 삭제했다.
fs.writeFileSync(path.join(ROOT, "index.html"), newHtml);
console.log("갱신 → index.html");
