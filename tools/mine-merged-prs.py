#!/usr/bin/env python3
"""
mine-merged-prs — 코퍼스 저장소들에서 **머지된 성능 PR** 을 긁어 규칙 후보를 만든다.

왜: 우리가 머지시킨 3건이 전부 같은 형태였다(루프 안 find → Map). 남이 받아준
diff 의 형태가 곧 "잡을 값이 있는 형태"의 정답지다. 다만 표본이 3건뿐이라 남의
머지 기록으로 늘린다.

**머지 여부는 "형태가 좋았다"만 뜻하지 않는다.** 저장소 문화·리뷰어 컨디션·PR
크기가 섞인 신호다 — directus 는 형태가 아니라 "더 큰 최적화 기회가 있다"는 영역
판단으로 닫혔고 budibase 는 사유조차 없었다. 그래서 여기서 나온 형태는 **후보를
어디서 찾을지**만 알려준다. 넣을지 말지는 tools/measure-diagnostic.sh 의 오탐
검증이 정한다.

사용:
  tools/mine-merged-prs.py                # 목록 수집 (저장소당 40건)
  tools/mine-merged-prs.py --patches      # 작은 PR 의 diff 까지 받는다
  tools/mine-merged-prs.py --classify     # 받은 diff 를 형태로 묶는다

산출: $CORPUS_ROOT/merged-prs/<repo>.json · patches/<repo>-<pr>.diff
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("CORPUS_ROOT", os.path.expanduser("~/.cache/fixearly-corpus"))
# 범주별 검색어와 제목 필터. gh search 는 전문검색이라 본문에 단어가 스친 것들이
# 섞여 들어오므로 제목으로 한 번 더 거른다.
#
# 왜 범주를 나누나: perf 에서 기계화 가능한 형태는 5%뿐이었다. 그 5%가 되는 이유는
# **고치기 전 코드에 시그니처가 있어서**다(루프 안 배열 스캔). 범주마다 그 비율이
# 다를 수 있고, 그건 의견이 아니라 재면 나온다. 같은 파이프라인으로 재서 비교한다.
CATEGORIES = {
    "perf": ("perf",
             r"^(perf|optimi[sz]e)\b|^perf[(:]|\bO\(n|speed ?up|faster|\bavoid .*(loop|scan)\b"),
    # 누수는 해제를 안 한 자리라 정적 시그니처가 뚜렷할 가능성이 높다
    # (addEventListener 짝 없음, setInterval 에 clear 없음, 구독에 unsubscribe 없음).
    "leak": ("leak",
             r"\bleak|\bunsubscrib|\bdispose\b|\bcleanup\b|removeEventListener|clearInterval|clearTimeout"),
    # 교과서 버그 — ESLint 가 이미 많이 잡는 영역이라 경쟁을 같이 봐야 한다.
    "bug": ("bug",
            r"^fix[(:].*\b(race|await|async|promise|leak|null|undefined|mutat)|\brace condition\b|\bfloating promise\b"),
}
CATEGORY = os.environ.get("MINE_CATEGORY", "perf")
if CATEGORY not in CATEGORIES:
    raise SystemExit(f"모르는 범주: {CATEGORY} (가능: {', '.join(CATEGORIES)})")
QUERY_TERM, _title_pat = CATEGORIES[CATEGORY]
TITLE_OK = re.compile(_title_pat, re.I)

OUT = f"{ROOT}/merged-prs" if CATEGORY == "perf" else f"{ROOT}/merged-prs-{CATEGORY}"
PATCHES = f"{ROOT}/patches" if CATEGORY == "perf" else f"{ROOT}/patches-{CATEGORY}"
LIMIT = int(os.environ.get("PR_LIMIT", "40"))
# 큰 PR 은 형태가 하나로 안 읽힌다 — 리팩터·기능이 섞인다. 작은 것만 재료로 쓴다.
MAX_CHANGED = int(os.environ.get("PR_MAX_CHANGED", "160"))



def gh(args, timeout=120):
    r = subprocess.run(["gh"] + args, capture_output=True, text=True, timeout=timeout)
    return r.stdout if r.returncode == 0 else ""


def repos():
    """마이닝 대상. 기본은 채점 코퍼스지만 MINE_REPOS 로 더 넓힐 수 있다.

    마이닝은 채점과 무관하다 — 등급·기준선에 아무 영향이 없으므로 대상을 넓히는
    데 제약이 없다. 채점 코퍼스는 기준선이라 늘리면 전 저장소 점수가 움직이지만,
    여기는 '형태를 어디서 보나'일 뿐이다. tools/mining-repos.json 이 있으면
    그것도 같이 훑는다(slug 문자열 배열).
    """
    seen = set()
    for d in json.load(open(f"{HERE}/board-repos.json", encoding="utf-8")):
        m = re.match(r"https://github\.com/([^/]+/[^/]+)", d["url"])
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            yield d["name"], m.group(1)
    extra = os.environ.get("MINE_REPOS", f"{HERE}/mining-repos.json")
    if os.path.exists(extra):
        for slug in json.load(open(extra, encoding="utf-8")):
            if slug in seen:
                continue
            seen.add(slug)
            yield slug.replace("/", "_"), slug


def collect():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, slug in repos():
        path = f"{OUT}/{name}.json"
        if os.path.exists(path):
            total += len(json.load(open(path, encoding="utf-8")))
            continue
        raw = gh(["search", "prs", "--repo", slug, "--merged", "--limit", str(LIMIT),
                  "--json", "number,title,url,createdAt", QUERY_TERM])
        try:
            items = json.loads(raw) if raw.strip() else []
        except json.JSONDecodeError:
            items = []
        kept = [dict(x, repo=slug) for x in items if TITLE_OK.search(x.get("title", ""))]
        json.dump(kept, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        total += len(kept)
        print(f"  {name} {len(kept)}")
    print(f"\n── 머지된 성능 PR {total}건 / {len(list(repos()))}곳 · {OUT}")


def all_prs():
    for f in sorted(os.listdir(OUT)):
        if not f.endswith(".json"):
            continue
        for x in json.load(open(f"{OUT}/{f}", encoding="utf-8")):
            yield x


def patches():
    os.makedirs(PATCHES, exist_ok=True)
    got = skipped = 0
    for x in all_prs():
        slug, num = x["repo"], x["number"]
        dst = f"{PATCHES}/{slug.replace('/', '_')}-{num}.diff"
        if os.path.exists(dst):
            got += 1
            continue
        meta = gh(["api", f"repos/{slug}/pulls/{num}",
                   "--jq", "{a:.additions,d:.deletions,f:.changed_files}"])
        try:
            m = json.loads(meta)
        except Exception:
            continue
        if m["a"] + m["d"] > MAX_CHANGED or m["f"] > 6:
            skipped += 1
            continue
        diff = gh(["api", f"repos/{slug}/pulls/{num}",
                   "-H", "Accept: application/vnd.github.v3.diff"], timeout=180)
        if not diff.strip():
            continue
        open(dst, "w", encoding="utf-8").write(diff)
        got += 1
        if got % 25 == 0:
            print(f"  {got}건")
    print(f"\n── 패치 {got}건 확보 · 큰 PR {skipped}건 제외(>{MAX_CHANGED}줄 또는 파일 6개 초과)")


# ── 형태 분류 ────────────────────────────────────────────────────────────────
# 각 항목: (이름, 지운 줄 패턴, 넣은 줄 패턴, 이미 잡는 진단인가)
# 누수 범주의 형태. 고침이 대개 "해제를 추가"라 지운 줄 패턴이 비어 있다 —
# 대신 **고치기 전 코드에 시그니처가 있나**를 같이 본다(등록만 있고 해제가 없다).
# 그게 이 마이닝의 진짜 질문이다: 형태가 자주 나오는가가 아니라, 고치기 전
# 코드에서 정적으로 짚을 수 있는가.
SHAPES_LEAK = [
    ("리스너 해제 추가", r"", r"removeEventListener|\.off\(|\.removeListener\(", False),
    ("타이머 해제 추가", r"", r"clearInterval\(|clearTimeout\(", False),
    ("구독 해제 추가", r"", r"\.unsubscribe\(|\.dispose\(|takeUntil\(", False),
    ("AbortController 도입", r"", r"AbortController|\bsignal\b.*abort|\.abort\(", False),
    ("useEffect cleanup 반환", r"", r"^\+\s*return \(\) =>", False),
    ("무한 증가 맵 → Weak", r"new Map\(", r"new WeakMap\(|new WeakSet\(", False),
    ("캐시에 상한·만료 추가", r"", r"\b(maxSize|max_size|ttl|TTL|LRU|evict)\b", False),
]

SHAPES = [
    ("루프 안 find/some → Map·Set", r"\.(find|some|includes|indexOf)\s*\(", r"new (Map|Set)\(|\.(get|has)\(", True),
    ("직렬 await → Promise.all", r"^\s*(const .*=\s*)?await ", r"Promise\.(all|allSettled)\(", True),
    ("스프레드 누적 → push/Map", r"\[\s*\.\.\.\w+\s*,", r"\.push\(|new Map\(", True),
    ("루프 안 정규식 → 호이스팅", r"new RegExp\(", r"^\s*(const|let) \w+ ?= ?new RegExp", True),
    ("N+1 → 일괄 조회", r"\b(findOne|findUnique|findById)\b", r"\b(findMany|whereIn|\$in|IN \()\b", True),
    # 메모이제이션은 "캐시를 새로 만들고 그걸 먼저 조회한다"가 형태다.
    # 처음엔 추가된 줄에 cache|memo 가 있으면 셌는데, 변수명에 스치기만 해도
    # 걸려서 24건이 잡혔다 — 열어보니 대부분 형태가 제각각이었다. 좁혔다.
    ("반복 계산 → 메모이제이션", r"", r"new (Weak)?Map\(.*\n?|\bmemoi?[sz]e\(", False),
    ("문자열 누적 → 배열 join", r"\+=\s*['\"`]", r"\.join\(", False),
    ("정렬 후 순회 → 인덱스", r"\.sort\(", r"new (Map|Set)\(", False),
    ("Object.keys 순회 → Map", r"Object\.(keys|entries|values)\(", r"new Map\(|\.get\(", False),
    # "조기 반환 추가"는 뺐다. `+ if (x) return` 은 성능 PR 이 아닌 것에도 다 붙어서
    # 258건 중 104건을 삼켰고, 열어보니 공통 형태가 없었다. 정적으로 잡으려 해도
    # 모든 가드 절이 걸린다 — 분류기로도 탐지기로도 쓸 수 없는 패턴이다.
]


def classify():
    shapes = SHAPES_LEAK if CATEGORY == "leak" else SHAPES
    files = [f for f in os.listdir(PATCHES)] if os.path.isdir(PATCHES) else []
    if not files:
        print("패치가 없다 — 먼저 --patches 를 돌려라")
        return
    hits, unmatched = {}, []
    for f in files:
        text = open(f"{PATCHES}/{f}", encoding="utf-8", errors="ignore").read()
        minus = "\n".join(l for l in text.splitlines() if l.startswith("-") and not l.startswith("---"))
        plus = "\n".join(l for l in text.splitlines() if l.startswith("+") and not l.startswith("+++"))
        matched = False
        for name, mpat, ppat, known in shapes:
            if (not mpat or re.search(mpat, minus)) and re.search(ppat, plus, re.M):
                hits.setdefault(name, {"n": 0, "known": known, "ex": []})
                hits[name]["n"] += 1
                if len(hits[name]["ex"]) < 3:
                    hits[name]["ex"].append(f)
                matched = True
                break
        if not matched:
            unmatched.append(f)

    print(f"\n── 패치 {len(files)}건 분류\n")
    print(f"{'형태':38s} {'건수':>4s}  진단 유무")
    for name, v in sorted(hits.items(), key=lambda kv: -kv[1]["n"]):
        print(f"{name:38s} {v['n']:>4d}  {'있음' if v['known'] else '★ 없음'}")
    print(f"\n분류 안 됨 {len(unmatched)}건 — 여기 새 형태가 숨어 있다. 몇 개 열어봐라:")
    for f in unmatched[:8]:
        print(f"  {PATCHES}/{f}")
    known = sum(v["n"] for v in hits.values() if v["known"])
    print(f"\n기계적으로 잡히는 형태는 {sum(v['n'] for v in hits.values())}/{len(files)}건뿐이고,")
    print(f"그중 {known}건은 이미 잡는 것이다. 나머지는 대부분 일회성 도메인 수정이라")
    print("규칙으로 옮길 수 없다 — 이 마이닝의 값은 '새 규칙 발굴'보다 **우선순위 확인**에 있다.")
    print("\n'★ 없음' 이 많은 형태부터 탐지기 후보다. 등재 전 tools/measure-diagnostic.sh 로 오탐 검증.")
    print("\n다만 **머지된 diff 의 형태와 탐지기는 다른 문제다.** 탐지기는 고치기 *전*")
    print("코드에서 시그니처를 찾아야 한다. find→Map 은 둘이 일치하는 드문 경우고(루프 안")
    print("배열 스캔이 곧 시그니처), 메모이제이션은 diff 로는 보여도 '여기 캐시가 없다'를")
    print("정적으로 짚을 수 없다. 형태가 자주 나온다고 탐지기가 되는 게 아니다.")


if __name__ == "__main__":
    if "--patches" in sys.argv:
        patches()
    elif "--classify" in sys.argv:
        classify()
    else:
        collect()
