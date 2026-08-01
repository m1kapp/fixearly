#!/usr/bin/env python3
"""
try-corpus-candidates — 채점 코퍼스 후보를 **보드에 넣기 전에** 재본다.

코퍼스를 늘리면 기준선(종류·체급 중앙)이 움직이고 기존 74곳 점수가 전부 따라
움직인다. 되돌리기 어려운 작업이라 board-repos.json 은 손대지 않고 따로 잰다.
여기서 나온 값을 보고 v13 재발행 여부를 결정한다.

왜 앱 위주인가: 지금 코퍼스는 라이브러리 32 vs 앱 13 이고, 그 13에도 vscode
(300만 줄)가 섞여 있다. 정작 이 도구를 돌릴 사람의 저장소는 앱 쪽이다.
개수를 늘리는 게 아니라 **종류를 맞추는** 게 목적이다.

사용: tools/try-corpus-candidates.py [--measure]
  (인자 없음) 메타데이터만 조회 — 별·기본 브랜치·HEAD sha
  --measure    클론 + 측정까지. 오래 걸린다.
산출: $CORPUS_ROOT/candidates/<slug>.json
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
ROOT = os.environ.get("CORPUS_ROOT", os.path.expanduser("~/.cache/fixearly-corpus"))
OUT = f"{ROOT}/candidates"
CLONES = f"{ROOT}/clones"
SCRATCH = f"{ROOT}/.scratch"


def gh(args, timeout=180):
    r = subprocess.run(["gh"] + args, capture_output=True, text=True, timeout=timeout)
    return r.stdout if r.returncode == 0 else ""


def meta(slug):
    raw = gh(["api", f"repos/{slug}",
              "--jq", "{stars:.stargazers_count,branch:.default_branch,lang:.language,archived:.archived}"])
    try:
        return json.loads(raw)
    except Exception:
        return None


def main():
    os.makedirs(OUT, exist_ok=True)
    slugs = json.load(open(f"{HERE}/corpus-candidates.json", encoding="utf-8"))
    rows = []
    for slug in slugs:
        m = meta(slug)
        if not m:
            print(f"  ✗ {slug} — 조회 실패")
            continue
        rows.append(dict(slug=slug, **m))
        print(f"  {slug:34s} ★{m['stars']:>7,}  {m['branch']:<12s} {m['lang']}")
    json.dump(rows, open(f"{OUT}/meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if "--measure" not in sys.argv:
        print(f"\n메타 {len(rows)}곳 → {OUT}/meta.json")
        print("측정하려면 --measure. 클론이 커서 오래 걸린다.")
        return

    os.makedirs(CLONES, exist_ok=True)
    os.makedirs(SCRATCH, exist_ok=True)
    for r in rows:
        slug = r["slug"]
        name = slug.replace("/", "_")
        dst = f"{OUT}/{name}.json"
        if os.path.exists(dst):
            continue
        d = f"{CLONES}/{name}"
        if not os.path.isdir(f"{d}/.git"):
            subprocess.run(["git", "clone", "--depth", "1", "--branch", r["branch"],
                            "--single-branch", "--quiet", f"https://github.com/{slug}", d],
                           capture_output=True)
        if not os.path.isdir(d):
            print(f"  ✗ {slug} clone 실패")
            continue
        sha = subprocess.run(["git", "-C", d, "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True).stdout.strip()
        p = subprocess.run(["node", f"{REPO}/bin/fixearly.mjs", f"--dir={d}"],
                           capture_output=True, text=True, cwd=SCRATCH)
        out = p.stdout
        g = re.search(r"등급: ([A-Z+]+) \((\d+)점\)", out)
        loc = re.search(r"코드: ([\d,]+)줄", out)
        files = re.search(r"파일: ([\d,]+)개", out)
        row = dict(r, sha=sha,
                   grade=g.group(1) if g else None,
                   score=int(g.group(2)) if g else None,
                   loc=int(loc.group(1).replace(",", "")) if loc else None,
                   files=int(files.group(1).replace(",", "")) if files else None)
        json.dump(row, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"  {slug:34s} {row['grade'] or '?':>4s} {str(row['score'] or '?'):>4s}점  "
              f"{(row['loc'] or 0):>9,}줄")

    print(f"\n측정 완료 → {OUT}/")
    print("다음: 체급·종류 분포를 보고 기준선이 얼마나 움직이는지 계산한 뒤 v13 재발행 여부를 정한다.")


if __name__ == "__main__":
    main()
