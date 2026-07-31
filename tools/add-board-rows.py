#!/usr/bin/env python3
"""
add-board-rows — 보드 정적 폴백에 빠진 저장소의 <details> 행을 만들어 넣는다.

보드 표현이 두 벌인 탓에 코퍼스에 저장소를 추가하면 JS 쪽(const DATA)은
update-board-data.py 로 따라오지만 정적 <details> 행은 안 생긴다. JS 가 막힌
환경에서 그만큼 덜 보이게 된다. update-board.mjs 는 '제자리 갱신' 도구라
없는 행을 만들지는 않는다 — 그 자리를 여기서 메운다.

행 구조는 기존 행에서 그대로 따온다(마크업을 새로 짜면 details/summary +
:target 필터로 JS 없이 살아 있게 만든 구조가 깨질 위험을 산다).

사용: BOARD_ROOT=/private/tmp/board python3 tools/add-board-rows.py [--check]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = os.environ.get("BOARD_ROOT", "/private/tmp/board")
CHECK = "--check" in sys.argv

corpus = json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8"))["repos"]
meta = {r["name"]: r for r in json.load(open(f"{ROOT}/tools/board-repos.json", encoding="utf-8"))}
html = open(f"{ROOT}/index.html", encoding="utf-8").read()

board_at = html.index('class="board"')
present = {n for n in re.findall(r'<span class="rn">([^<]+)', html[board_at:]) if not n.startswith("$")}
missing = [r for r in corpus if r["name"] not in present]

if not missing:
    print("정적 폴백에 빠진 저장소 없음")
    sys.exit(0)
if CHECK:
    print(f"정적 폴백에 빠진 저장소 {len(missing)}개: {', '.join(r['name'] for r in missing)}")
    sys.exit(1)

KIND_EN = {"라이브러리": "library", "프레임워크": "framework", "툴체인": "toolchain",
           "앱": "app", "엔진·컴파일러": "engine/compiler"}
# (corpus 키, 한글 라벨, 영문 라벨, 한글 부제, 영문 부제, 막대 최대값, 단위)
METRICS = [
    ("fn40", "긴 함수 비율", "long-fn share", "40줄+ (JSX 60줄+) · 코퍼스 중앙 {m}%", "over 40 lines · median {m}%", 14, "%"),
    ("fnP90", "함수 길이 p90", "fn length p90", "코퍼스 중앙 {m}줄", "corpus median {m}", 70, "줄"),
    ("cog15", "복잡 함수 비율", "complex-fn share", "코퍼스 중앙 {m}%", "corpus median {m}%", 8, "%"),
    ("cogTop10", "복잡도 상위10 평균", "top-10 complexity", "코퍼스 중앙 {m}", "corpus median {m}", 300, ""),
    ("fnTop10", "함수 길이 상위10 평균", "top-10 fn length", "코퍼스 중앙 {m}줄", "corpus median {m}", 600, "줄"),
    ("dup", "중복", "duplication", "코퍼스 중앙 {m}%", "corpus median {m}%", 25, "%"),
    ("avg", "평균 파일 줄", "avg file lines", "보조 항 · 코퍼스 중앙 {m}줄", "minor · median {m}", 300, "줄"),
]
GRADE_VAR = {"S": "gS", "A": "gA", "B": "gB", "C": "gC", "D": "gD", "E": "gE"}


def q(key, p):
    v = sorted(r[key] for r in corpus if r.get(key) is not None)
    x = v[min(len(v) - 1, int(round((len(v) - 1) * p)))]
    return round(x, 1) if isinstance(x, float) else x


def med_score(kind):
    v = sorted(r["score"] for r in corpus if r["kind"] == kind)
    return v[len(v) // 2] if len(v) % 2 else (v[len(v) // 2 - 1] + v[len(v) // 2]) // 2


g = lambda v: f"{v:g}"
Q = {k: (q(k, 0.5), q(k, 0.75)) for k, *_ in METRICS}


def bar_color(val, p50, p75):
    return "--gA" if val <= p50 else ("--gC" if val <= p75 else "--gD")


def row_html(r):
    m = meta.get(r["name"], {})
    sha = ""
    rf = f"{BOARD}/results/{r['name']}.json"
    if os.path.exists(rf):
        sha = json.load(open(rf, encoding="utf-8")).get("sha", "")
    quad = 0
    of = f"{BOARD}/o_{r['name']}/fixearly.json"
    if os.path.exists(of):
        quad = (json.load(open(of, encoding="utf-8"))["quality"].get("quadratic") or {}).get("sites", 0)
    kn, ke = r["kind"], KIND_EN.get(r["kind"], "")
    peer, mine = med_score(r["kind"]), r["score"]
    diff = mine - peer
    n_kind = sum(1 for x in corpus if x["kind"] == r["kind"])
    ver = f'<span class="ver">v{r["ver"]}</span>' if r.get("ver") else ""
    stars = f' · ★{m["stars"]}' if m.get("stars") else ""

    mets = []
    for key, ko, en, sko, sen, mx, unit in METRICS:
        v = r[key]
        p50, p75 = Q[key]
        w = min(100.0, max(0.0, v / mx * 100))
        mets.append(
            f'<div class="met"><div class="ml"><span class="ko">{ko}</span><span class="en">{en}</span>'
            f'<small><span class="ko">{sko.format(m=g(p50))}</span>'
            f'<span class="en">{sen.format(m=g(p50))}</span></small></div>'
            f'<div class="bar"><i style="width:{w:.1f}%;background:var({bar_color(v, p50, p75)})"></i></div>'
            f'<div class="mv">{g(v)}{unit}</div></div>')

    return (
        f'<details class="rw"><summary class="row" data-row="0"><span class="rk">0</span>'
        f'<span class="rn">{r["name"]}{ver}<span class="chip"><span class="ko">{kn}</span>'
        f'<span class="en">{ke}</span></span></span>'
        f'<span class="rm">{r["files"]:,}<span class="ko">파일</span><span class="en">f</span>'
        f'<span class="rml"> · {r["loc"]:,}<span class="ko">줄</span><span class="en">L</span></span>'
        f' · <span class="ko">중복</span><span class="en">dup</span> {g(r["dup"])}%</span>'
        f'<span class="rs"><span class="g {GRADE_VAR[r["grade"]]}">{r["gradeF"]}</span>'
        f'<b>{r["score"]}</b><span class="car">→</span></span></summary>'
        f'<div class="det"><div class="peer"><span class="ko">동종 기준선</span>'
        f'<span class="en">peer baseline</span> — <span class="ko">{kn}</span><span class="en">{ke}</span> '
        f'{n_kind}<span class="ko">개 중앙</span><span class="en"> median</span> <b>{peer}</b> · '
        f'<span class="ko">이 저장소</span><span class="en">this repo</span> <b>{mine}</b> '
        f'<span class="pd">{diff:+d}</span></div>'
        f'<div class="dh">{sha} · {r["files"]:,} <span class="ko">파일</span><span class="en">files</span> · '
        f'{r["loc"]:,} <span class="ko">코드줄</span><span class="en">LOC</span>{stars}</div>'
        + "".join(mets) +
        f'<div class="dg"><span class="ko">진단 · 점수와 무관</span>'
        f'<span class="en">diagnostic · not scored</span> — O(n²) {quad}</div>'
        f'<div class="dfoot"><a class="ghlink" href="{m.get("url","")}" target="_blank" rel="noopener">'
        f'<span class="ko">GitHub에서 보기</span><span class="en">View on GitHub</span>'
        f'<span class="arw">↗</span></a><span class="ghpath"><span class="ko">측정 경로</span>'
        f'<span class="en">measured</span> {m.get("sub","")}</span></div></div></details>')


# 마지막 </details> 뒤에 붙인다. 순서·순위는 update-board.mjs 가 다시 매긴다.
last = html.rindex("</details>", board_at) + len("</details>")
html = html[:last] + "".join(row_html(r) for r in missing) + html[last:]
open(f"{ROOT}/index.html", "w", encoding="utf-8").write(html)
print(f"정적 행 {len(missing)}개 추가: {', '.join(r['name'] for r in missing)}")
print("  → node tools/update-board.mjs 로 순위·정렬을 맞출 것")
