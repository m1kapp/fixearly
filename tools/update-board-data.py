#!/usr/bin/env python3
"""
update-board-data — 랜딩 보드가 실제로 읽는 `const DATA = [...]` 를 다시 만든다.

주의: 보드에는 표현이 두 벌 있다.
  ① 정적 <details> 행 — JS 가 막힌 환경용 폴백. tools/update-board.mjs 가 제자리 갱신한다.
  ② 인라인 스크립트의 `const DATA` — #brd·#tabs 를 런타임에 다시 그린다. **사람이 보는 건 이쪽이다.**
①만 고치면 새로고침하는 순간 옛 점수로 돌아간다. 실제로 그럴 뻔했다.

측정값은 엔진 산출($BOARD_ROOT/o_<name>/fixearly.json)에서 가져오고,
별 수·저장소 URL·측정 경로·제외 사유(exw)는 측정으로 알 수 없으니 기존 DATA 에서 보존한다.

사용: BOARD_ROOT=/private/tmp/board python3 tools/update-board-data.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = os.environ.get("BOARD_ROOT", "/private/tmp/board")

html = open(f"{ROOT}/index.html", encoding="utf-8").read()
m = re.search(r"const DATA = (\[.*?\]);\n", html, re.S)
if not m:
    sys.exit("index.html 에서 `const DATA = [...]` 를 못 찾았다")
prev = {r["name"]: r for r in json.loads(m.group(1))}

corpus = {r["name"]: r for r in json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8"))["repos"]}
r1 = lambda v: round(v, 1) if isinstance(v, (int, float)) else v

rows, dropped = [], []
for name, c in corpus.items():
    f = f"{BOARD}/o_{name}/fixearly.json"
    if not os.path.exists(f):
        dropped.append(name)
        continue
    q = json.load(open(f, encoding="utf-8"))["quality"]
    p = prev.get(name, {})
    sha = ""
    rf = f"{BOARD}/results/{name}.json"
    if os.path.exists(rf):
        sha = json.load(open(rf, encoding="utf-8")).get("sha", "")
    rows.append({
        "name": name, "grade": c["grade"], "gradeF": c["gradeF"], "score": c["score"],
        "files": c["files"], "loc": c["loc"], "dup": c["dup"], "maxCog": c["maxCog"],
        "cog15": c["cog15"], "avg": c["avg"],
        "quad": (q.get("quadratic") or {}).get("sites", 0),
        "fn40": c["fn40"], "fnP90": c["fnP90"], "fnMax": c["fnMax"],
        "fnTop10": c["fnTop10"], "cogTop10": c["cogTop10"],
        # 측정으로 알 수 없는 값은 기존 DATA 에서 그대로 가져온다
        "stars": p.get("stars", ""), "kind": c["kind"], "ver": c["ver"],
        "sha": sha or p.get("sha", ""), "url": p.get("url", ""),
        "sub": p.get("sub", ""), "exw": p.get("exw", ""),
        "td": r1((q.get("testDensity") or {}).get("percent") or 0),
    })

rows.sort(key=lambda r: (-r["score"], r["name"]))
gone = sorted(set(prev) - {r["name"] for r in rows})
blob = json.dumps(rows, ensure_ascii=False)
html = html[: m.start(1)] + blob + html[m.end(1):]
open(f"{ROOT}/index.html", "w", encoding="utf-8").write(html)
print(f"DATA → {len(rows)}개 (이전 {len(prev)})")
if gone:
    print(f"  빠진 저장소: {', '.join(gone)}")
if dropped:
    print(f"  엔진 산출 없어 건너뜀: {', '.join(dropped)}")
