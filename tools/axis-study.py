#!/usr/bin/env python3
"""채점축 승격 후보 판정 — 재측정 결과에서 독립성·변별력을 잰다.

기준(N+1 을 넣을 때 쓴 것과 같다):
  ① 독립성 — 기존 점수와 상관이 낮아야 새 정보다. |rho| < 0.4 를 통과선으로 본다.
  ② 변별력 — 0 인 저장소가 너무 많으면 대부분에게 0점이라 축이 아니다.
                반대로 전부 0 아닌데 분포가 좁아도 못 가른다.
  ③ 규모 중립 — 코드줄과 상관이 높으면 '큰 저장소 벌주기'가 된다.
"""
import glob
import json
import os
import sys

# 재측정 산출물 위치. remeasure-board.sh 의 BOARD_ROOT 과 맞춘다.
RESULTS = os.environ.get("BOARD_ROOT", "/private/tmp/board") + "/results/*.json"


def rank(xs):
    """동점은 평균 순위(스피어만 정의)."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r


def spearman(a, b):
    ra, rb = rank(a), rank(b)
    n = len(a)
    ma, mb = sum(ra) / n, sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    da = sum((x - ma) ** 2 for x in ra) ** 0.5
    db = sum((y - mb) ** 2 for y in rb) ** 0.5
    return num / (da * db) if da and db else 0.0


def pct(xs, p):
    s = sorted(xs)
    if not s:
        return 0
    i = min(len(s) - 1, int(round((len(s) - 1) * p)))
    return s[i]


rows = [json.load(open(f)) for f in glob.glob(RESULTS)]
if len(rows) < 10:
    sys.exit(f"결과 {len(rows)}개 — 판정하기엔 부족하다")

print(f"표본 {len(rows)}개 · 채점버전 {set(r.get('scoringVersion') for r in rows)}\n")

per1k = lambda r, v: (v / r["files"] * 1000) if r["files"] else 0.0
tb = lambda r, k: r.get("textbook", {}).get(k, 0)
ty = lambda r, k: r.get("typeSafety", {}).get(k, 0)

CANDIDATES = [
    ("N+1 (현 채점축)",      lambda r: r.get("nplusPer1k", 0)),
    ("독립 순차 await",       lambda r: per1k(r, r.get("serial", 0))),
    ("O(n²) 배열 조회",       lambda r: per1k(r, r.get("quad", 0))),
    ("루프 안 파일읽기",        lambda r: per1k(r, r.get("ioLoop", 0))),
    ("렌더 인질",            lambda r: per1k(r, r.get("renderGates", 0))),
    ("floating promise",  lambda r: per1k(r, tb(r, "floatingPromise"))),
    ("await in forEach",  lambda r: per1k(r, tb(r, "awaitInForEach"))),
    ("빈 catch",           lambda r: per1k(r, tb(r, "emptyCatch"))),
    ("전역 정규식 상태",        lambda r: per1k(r, tb(r, "statefulRegex"))),
    ("루프 불변 인덱스",        lambda r: per1k(r, tb(r, "loopInvariantIndex"))),
    ("스프레드 누적",          lambda r: per1k(r, tb(r, "spreadAccumulator"))),
    ("루프 안 정규식",         lambda r: per1k(r, tb(r, "regexInLoop"))),
    ("공유 참조 fill",        lambda r: per1k(r, tb(r, "sharedRefFill"))),
    ("숫자 정렬",            lambda r: per1k(r, tb(r, "numericSortNoComparator"))),
    ("배열에 for...in",      lambda r: per1k(r, tb(r, "forInArray"))),
    ("any 남용(%)",         lambda r: r.get("anyPct", 0) or 0),
    ("as any",            lambda r: per1k(r, ty(r, "asAny"))),
    ("non-null (!)",      lambda r: per1k(r, ty(r, "nonNull"))),
    ("@ts-ignore",        lambda r: per1k(r, ty(r, "tsIgnore"))),
]

score = [r["score"] for r in rows]
loc = [r["loc"] for r in rows]

print(f"{'후보':<20}{'|rho|점수':>9}{'rho코드줄':>9}{'0아닌곳':>8}{'중앙':>8}{'p90':>9}{'최대':>9}  판정")
print("-" * 92)
out = []
for name, f in CANDIDATES:
    v = [f(r) for r in rows]
    nz = sum(1 for x in v if x > 0)
    if nz == 0:
        print(f"{name:<20}{'—':>9}{'—':>9}{nz:>8}{'—':>8}{'—':>9}{'—':>9}  전 표본 0 — 축 불가")
        continue
    rs, rl = spearman(v, score), spearman(v, loc)
    med, p90, mx = pct(v, .5), pct(v, .9), max(v)
    nzp = nz / len(rows)
    indep = abs(rs) < 0.40
    discr = 0.15 <= nzp <= 0.95 and p90 > 0
    neutral = abs(rl) < 0.55
    verdict = ("승격 후보" if (indep and discr and neutral)
               else "탈락: " + " ".join(x for x, ok in
                    [("점수와 중복", indep), ("변별 없음", discr), ("규모 편향", neutral)] if not ok))
    print(f"{name:<20}{rs:>9.2f}{rl:>9.2f}{nz:>8}{med:>8.2f}{p90:>9.2f}{mx:>9.2f}  {verdict}")
    out.append((name, rs, nzp, p90, verdict))

print("\n승격 후보만:")
for name, rs, nzp, p90, v in out:
    if v == "승격 후보":
        print(f"  · {name}: 점수와 rho={rs:+.2f}, {nzp*100:.0f}% 저장소에서 발생, p90={p90:.2f}/1000파일")

# N+1 유예·기울기 재보정 — 엔진 주석에 남긴 TODO
n1 = sorted(r.get("nplusPer1k", 0) for r in rows)
print(f"\nN+1 밀도 분포(현 유예 1.0 · 캡 5 · 기울기 1.2):")
for p in (.5, .75, .9, .95, 1.0):
    print(f"  p{int(p*100):<3} {pct(n1, p):.2f}")
hit = [x for x in n1 if x > 1.0]
print(f"  유예 초과 {len(hit)}/{len(n1)}곳 · 캡(5점)에 닿는 밀도는 {1.0 + 5/1.2:.2f} 이상 "
      f"→ 해당 {sum(1 for x in n1 if x >= 1.0 + 5/1.2)}곳")
