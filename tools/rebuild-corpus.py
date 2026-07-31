#!/usr/bin/env python3
"""
rebuild-corpus — 재측정 산출물에서 data/corpus.json 을 다시 만든다.

랜딩 보드(#board)와 체급·종류 기준선이 전부 이 파일을 읽는다. 채점 규칙을 바꾸면
보드가 옛 규칙 값으로 남는데, 이 엔진은 "규칙이 다른 점수를 나란히 놓으면 진행도가
거짓말을 한다"를 원칙으로 내세운다 — 그러니 규칙을 올렸으면 여기까지 와야 끝이다.

입력: remeasure-board.sh 가 남긴 $BOARD_ROOT/o_<name>/fixearly.json (엔진 원본 산출)
      + tools/board-repos.json (종류·경로)
출력: data/corpus.json

사용: BOARD_ROOT=/private/tmp/board python3 tools/rebuild-corpus.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = os.environ.get("BOARD_ROOT", "/private/tmp/board")

repos = {r["name"]: r for r in json.load(open(f"{ROOT}/tools/board-repos.json", encoding="utf-8"))}


def pkg_version(name):
    """측정 경로에서 가장 가까운 package.json 의 version. 없으면 저장소 루트."""
    meta = repos.get(name, {})
    base = f"{BOARD}/clones/{name}"
    sub = meta.get("sub") or "."
    here = os.path.normpath(os.path.join(base, sub))
    while here.startswith(base):
        p = os.path.join(here, "package.json")
        if os.path.exists(p):
            try:
                v = json.load(open(p, encoding="utf-8")).get("version")
                if v:
                    return str(v).lstrip("v")
            except Exception:
                pass
        nxt = os.path.dirname(here)
        if nxt == here:
            break
        here = nxt
    return ""


def row(name, j):
    q = j["quality"]
    s = j["source"]
    si = q["scoreInputs"]
    cog = q["cognitive"]
    fn = q["fnLength"]
    meta = repos.get(name, {})
    r1 = lambda v: round(v, 1) if isinstance(v, (int, float)) else v
    return {
        "name": name,
        "score": q["score"],
        # grade 는 색·분포용(S/A/B…), gradeF 는 표시용 세분(SSS/SS/S…)
        "grade": q["gradeBase"],
        "gradeF": q["grade"],
        "files": s["files"],
        "loc": s["codeLines"],
        "kind": meta.get("klabel", ""),
        "ver": pkg_version(name),
        "fn40": r1(si["fnOver40Pct"]),
        "fnP90": fn["p90"],
        "fnMax": fn["max"],
        "fnTop10": r1(fn["top10avg"]),
        "cogTop10": r1(cog["top10avg"]),
        "cog15": r1(si["over15Pct"]),
        "maxCog": cog["max"],
        "dup": q["duplication"]["percent"],
        "avg": q["avgFileLines"],
        "maxNest": cog.get("maxNest", 0),
        "deep": cog.get("deepCount", 0),
    }


rows, versions = [], set()
for f in sorted(glob.glob(f"{BOARD}/o_*/fixearly.json")):
    name = re.sub(r"^o_", "", os.path.basename(os.path.dirname(f)))
    if name not in repos:
        continue
    try:
        j = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        print(f"  건너뜀 {name}: {e}", file=sys.stderr)
        continue
    versions.add(j["quality"].get("scoringVersion"))
    rows.append(row(name, j))

if len(versions) != 1:
    sys.exit(f"채점 버전이 섞여 있다: {versions} — 전량을 같은 규칙으로 다시 재라")

rows.sort(key=lambda r: (-r["score"], r["name"]))
out = {
    "version": versions.pop(),
    "n": len(rows),
    "measuredAt": os.environ.get("MEASURED_AT", ""),
    "classes": json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8")).get("classes"),
    "axes": json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8")).get("axes"),
    "repos": rows,
}
json.dump(out, open(f"{ROOT}/data/corpus.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
kinds = {}
for r in rows:
    kinds[r["kind"]] = kinds.get(r["kind"], 0) + 1
print(f"corpus.json → {len(rows)}개 · 규칙 {out['version']} · {kinds}")
