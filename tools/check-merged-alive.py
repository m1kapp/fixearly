#!/usr/bin/env python3
"""머지된 규칙이 그 저장소에 아직 살아 있나 — impact.json 의 merged 건을 현재 HEAD 와 대본다.

왜 필요한가: 이 제품이 파는 건 "규칙이 남의 저장소에 머지된다"다. 머지는 한 번 일어난 사건이고,
그 뒤 되돌려지거나 리팩터에 쓸려가면 주장의 근거가 사라진다. 아무도 안 보고 있었다.

방법: PR patch 에서 추가된 줄(삭제만 한 PR 은 지워진 줄)을 뽑아 현재 파일과 대조한다.
  - 추가 PR: 샘플이 다 있으면 alive
  - 삭제 PR: 지운 줄이 안 돌아왔으면 alive

한계 — 줄 단위 매칭이라 **거짓 경보가 난다**(2026-09-13 실측 3건 전부 거짓이었다):
  - 리포맷: nocodb#14309 은 `if (…) map.set(…)` 이 두 줄로 갈려 LOST 로 떴지만 살아 있었다.
  - 흔한 줄: Ghost#29831 의 `const date = moment(row.date)…` 는 무관한 루프에도 있어 BACK 으로 떴다.
그래서 SUSPECT 는 판정이 아니라 **손으로 볼 목록**이다. 네트워크를 타므로 npm test 에 넣지 않는다.

사용: GITHUB_TOKEN=$(gh auth token) python3 tools/check-merged-alive.py
"""
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

SKIP = re.compile(r"(__tests__|\.test\.|\.spec\.|\.changeset/)")
ROOT = Path(__file__).resolve().parent.parent


def gh(args):
    proc = subprocess.run(["gh"] + args, capture_output=True, text=True)
    return proc.stdout if proc.returncode == 0 else ""


def distinctive(patch, marker):
    """patch 에서 marker('+'/'-') 로 시작하는 줄 중 판별력 있는 것만."""
    out = []
    for line in patch.split("\n"):
        if line.startswith(marker) and not line.startswith(marker * 3):
            text = line[1:].strip()
            if len(text) >= 25 and not text.startswith(("//", "*", "/*", "#")):
                out.append(text)
    out.sort(key=len, reverse=True)
    return out[:3]


def check(repo, pr):
    files = gh(["api", f"repos/{repo}/pulls/{pr}/files", "--paginate"])
    if not files:
        return "ERROR", ["PR 파일을 못 읽었다"]
    verdicts, worst = [], "alive"
    for entry in json.loads(files):
        path, patch = entry.get("filename", ""), entry.get("patch") or ""
        if SKIP.search(path) or entry.get("status") == "removed":
            continue
        added, removed = distinctive(patch, "+"), distinctive(patch, "-")
        sample, mode = (added, "added") if added else (removed, "removed")
        if not sample:
            continue
        content = gh(["api", f"repos/{repo}/contents/{path}", "-q", ".content"])
        if not content:
            verdicts.append(f"{path}: 파일 없음")
            worst = "SUSPECT"
            continue
        text = base64.b64decode(content).decode("utf8", "replace")
        hits = sum(1 for s in sample if s in text)
        ok = hits == len(sample) if mode == "added" else hits == 0
        if not ok:
            worst = "SUSPECT"
        verdicts.append(f"{path.split('/')[-1]}: {mode} {hits}/{len(sample)}")
    return worst, verdicts or ["샘플 없음"]


def main():
    findings = json.loads((ROOT / "impact.json").read_text())["findings"]
    merged = [f for f in findings if f.get("status") == "merged"]
    suspects = 0
    for f in merged:
        verdict, detail = check(f["repo"], f["pr"])
        if verdict != "alive":
            suspects += 1
        print(f"  {verdict:8} {f['repo']}#{f['pr']} — {' | '.join(detail)}")
    print(f"\n머지 {len(merged)}건 · 살아있음 {len(merged) - suspects} · 손검증 대상 {suspects}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
