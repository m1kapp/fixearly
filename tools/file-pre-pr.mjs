#!/usr/bin/env node
/**
 * file-pre-pr — pre-pr.json 큐에서 준비된 PR을 발사한다.
 *
 * 사용: node tools/file-pre-pr.mjs <id> [--go]
 *   인자 없이  → 큐 목록(id·repo·status·heldReason) 출력
 *   <id>       → 그 항목의 gh pr create 명령을 출력(본문은 임시파일로 씀). 붙여넣어 실행.
 *   <id> --go  → 바로 gh pr create 실행(호출 자체가 pacing 결정 — 남용가드 유의, 급하게 연속 발사 금지)
 *
 * 발사 성공 후 pre-pr.json 의 status 를 "filed" 로 직접 바꿔라(중복 발사 방지).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "pre-pr.json"), "utf8"));
const id = process.argv[2];
const go = process.argv.includes("--go");

if (!id) {
  console.log("pre-pr 큐:");
  for (const e of reg.queue) {
    console.log(`  [${e.status}] ${e.id}  → ${e.repo}  (${e.branch})`);
    if (e.status !== "filed" && e.heldReason) console.log(`      hold: ${e.heldReason}`);
  }
  console.log("\n발사: node tools/file-pre-pr.mjs <id> [--go]");
  process.exit(0);
}

const e = reg.queue.find((x) => x.id === id);
if (!e) { console.error(`id 없음: ${id}`); process.exit(1); }

const bodyFile = path.join("/tmp", `prepr-${e.id}.md`);
fs.writeFileSync(bodyFile, e.prBody);
const head = `${e.fork.split("/")[0]}:${e.branch}`;
const cmd = `gh pr create --repo ${e.repo} --base ${e.base} --head ${head} ` +
  `--title ${JSON.stringify(e.prTitle)} --body-file ${bodyFile}`;

console.log(`# ${e.id}  (${e.status})`);
if (e.status !== "ready" && !go) {
  console.log(`# ⚠ status=${e.status}: ${e.heldReason || ""}`);
  console.log(`# 발사하려면 pre-pr.json 에서 status를 'ready'로 바꾸거나 --go 를 붙여라.`);
}
console.log(cmd);

if (go) {
  console.log("\n실행 중...");
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    console.log(out.trim());
    console.log("\n✓ 발사됨 — pre-pr.json 의 status 를 'filed'로 바꿔라.");
  } catch (err) {
    console.error("발사 실패:", (err.stdout || "") + (err.stderr || err.message));
    console.error("(GitHub 남용가드일 수 있음 — 최근 같은 repo에 PR 냈으면 시간 두고 재시도)");
  }
}
