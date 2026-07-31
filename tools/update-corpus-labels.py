#!/usr/bin/env python3
"""
update-corpus-labels — 랜딩에 손으로 박힌 '코퍼스 중앙' 값을 corpus.json 과 맞춘다.

보드 행을 열면 지표마다 "코퍼스 중앙 4.0%" 라벨이 붙고, 옆 막대가 [중앙, p75]
임계로 칠해진다. 이 값들은 corpus 에서 나오는데 페이지에는 상수로 박혀 있어
재측정을 해도 안 따라온다. 실제로 v7 값이 288곳 남아 있었다.

여기도 표현이 두 벌이다:
  · 정적 <details> 행의 <div class="met"> 청크 (JS 막힌 환경용 폴백)
  · JS 의 M 배열 (런타임 렌더 — 사람이 보는 쪽)
둘 다 고쳐야 새로고침에도 유지된다.

지표를 라벨 텍스트로 찾으면 안 된다. "코퍼스 중앙 {}%" 는 긴 함수 비율·복잡 함수
비율·중복에 전부 걸려서 서로의 값을 덮어쓴다(실제로 그렇게 짰다가 63건 오검출).
그래서 **청크 단위**로 자르고, 청크를 그 지표의 표시 이름으로 식별한다.

사용: python3 tools/update-corpus-labels.py [--check]
"""
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK = "--check" in sys.argv

# (corpus 키, 정적/JS 청크를 식별하는 한글 표시 이름)
METRICS = [
    ("fn40", "긴 함수 비율"),
    ("fnP90", "함수 길이 p90"),
    ("cog15", "복잡 함수 비율"),
    ("cogTop10", "복잡도 상위10 평균"),
    ("fnTop10", "함수 길이 상위10 평균"),
    ("dup", "중복"),
    ("avg", "평균 파일 줄"),
]
KINDS = ["엔진·컴파일러", "라이브러리", "프레임워크", "툴체인", "앱"]

rows = json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8"))["repos"]
html = open(f"{ROOT}/index.html", encoding="utf-8").read()


def q(key, p):
    v = sorted(r[key] for r in rows if r.get(key) is not None)
    x = v[min(len(v) - 1, int(round((len(v) - 1) * p)))]
    return round(x, 1) if isinstance(x, float) else x


def med(v):
    v = sorted(v)
    return v[len(v) // 2] if len(v) % 2 else (v[len(v) // 2 - 1] + v[len(v) // 2]) // 2


g = lambda v: f"{v:g}"
want = {k: (q(k, 0.5), q(k, 0.75)) for k, _ in METRICS}
by_kind = defaultdict(list)
for r in rows:
    by_kind[r["kind"]].append(r["score"])
kind_med = {k: (len(v), med(v)) for k, v in by_kind.items()}

problems = []


def fix_number_after(text, word, value):
    """`word 12.3` 형태의 숫자를 value 로 바꾼다. 바뀐 텍스트와 변경 수를 준다."""
    pat = re.compile(re.escape(word) + r"\s*([\d.]+)")
    n = 0

    def rep(m):
        nonlocal n
        if m.group(1) == value:
            return m.group(0)
        n += 1
        return m.group(0).replace(m.group(1), value)

    return pat.sub(rep, text), n


# ── ① 정적 <div class="met"> 청크 — 청크당 지표 하나 ──────────────────────
def fix_static(html):
    total = 0
    out, pos = [], 0
    for m in re.finditer(r'<div class="met">.*?</div></div>', html, re.S):
        chunk = m.group(0)
        key = next((k for k, name in METRICS if f'>{name}</span>' in chunk), None)
        if key:
            # 라벨은 <small> 안에만 있다. 저장소 자기 값(<div class="mv">)은 건드리면 안 된다.
            sm = re.search(r"<small>.*?</small>", chunk, re.S)
            if sm:
                fixed = sm.group(0)
                for word in ("코퍼스 중앙", "median"):
                    fixed, n = fix_number_after(fixed, word, g(want[key][0]))
                    total += n
                chunk = chunk[: sm.start()] + fixed + chunk[sm.end():]
        out.append(html[pos:m.start()] + chunk)
        pos = m.end()
    out.append(html[pos:])
    return "".join(out), total


# ── ② JS M 배열 — 항목당 한 줄, r.KEY 로 식별 ─────────────────────────────
def fix_js(html):
    total = 0
    start = html.find("const M=[")
    if start < 0:
        problems.append("JS M 배열을 못 찾음")
        return html, 0
    end = html.index("];", start) + 2
    block = html[start:end]
    for line in block.split("\n"):
        key = next((k for k, _ in METRICS if re.search(rf"r\.{re.escape(k)}\b", line)), None)
        if not key:
            continue
        fixed = line
        for word in ("코퍼스 중앙", "corpus median"):
            fixed, n = fix_number_after(fixed, word, g(want[key][0]))
            total += n
        m = re.search(r"\[([\d.]+),([\d.]+)\]", fixed)
        if m and (m.group(1), m.group(2)) != (g(want[key][0]), g(want[key][1])):
            fixed = fixed[: m.start()] + f"[{g(want[key][0])},{g(want[key][1])}]" + fixed[m.end():]
            total += 1
        if fixed != line:
            block = block.replace(line, fixed)
    return html[:start] + block + html[end:], total


# ── ③ 보드 리드의 종류별 중앙 점수 ────────────────────────────────────────
def fix_kind_sentence(html):
    E, L, F, T, A = (kind_med[k] for k in KINDS)
    total = 0
    ko = (f"<b>엔진·컴파일러 {E[0]}개는 중앙 {E[1]}점</b>으로 "
          f"툴체인({T[1]})·라이브러리({L[1]})·프레임워크({F[1]})보다 구조적으로 낮고, <b>앱은 {A[1]}점</b>이다")
    m = re.search(r"<b>엔진·컴파일러 \d+개는 중앙 \d+점</b>으로 [^<]*?보다 구조적으로 낮고, <b>앱은 \d+점</b>이다", html)
    if not m:
        problems.append("종류별 중앙 문장(한글)을 못 찾음")
    elif m.group(0) != ko:
        html = html.replace(m.group(0), ko)
        total += 1
    en = (f"<b>the {E[0]} engines and compilers sit at a median of {E[1]}</b> — "
          f"below toolchains ({T[1]}), libraries ({L[1]}) and frameworks ({F[1]}) — and apps land at {A[1]}.")
    m = re.search(r"<b>the \d+ engines and compilers sit at a median of \d+</b> — below [^—]*— and apps land at \d+\.", html)
    if not m:
        problems.append("종류별 중앙 문장(영문)을 못 찾음")
    elif m.group(0) != en:
        html = html.replace(m.group(0), en)
        total += 1
    return html, total


new = html
new, a = fix_static(new)
new, b = fix_js(new)
new, c = fix_kind_sentence(new)
n = a + b + c

if problems:
    for p in problems:
        print(f"  ✗ {p}")
if CHECK:
    print(f"{'맞지 않는 값 ' + str(n) + '건' if n else '코퍼스 라벨이 corpus.json 과 일치한다'}"
          f"  (정적 {a} · JS {b} · 종류문장 {c})")
    sys.exit(1 if (n or problems) else 0)

if n:
    open(f"{ROOT}/index.html", "w", encoding="utf-8").write(new)
print(f"갱신 {n}건 (정적 {a} · JS {b} · 종류문장 {c}) · 중앙값 "
      + " · ".join(f"{k} {g(want[k][0])}" for k, _ in METRICS))
sys.exit(1 if problems else 0)
