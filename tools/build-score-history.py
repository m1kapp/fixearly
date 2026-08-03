#!/usr/bin/env python3
"""
build-score-history — 채점 규칙 버전별 점수 스냅샷을 git 이력에서 뽑는다.

이 도구는 "규칙이 다른 점수를 나란히 놓으면 진행도가 거짓말을 한다"를 원칙으로
내세운다. 그런데 정작 랜딩은 현재 규칙의 점수만 보여줘서, 어제 본 등급이 오늘
왜 다른지 읽는 사람이 알 방법이 없었다(하루에 v11 → v12 로 두 번 재발행했다).

버전별로 점수가 어떻게 움직였는지, 그리고 **무엇이 바뀌어서 그랬는지**를 같이
남긴다. 규칙 변경 이유는 측정으로 알 수 없으므로 아래 RULESETS 에 손으로 적는다.

출력: data/score-history.json
사용: python3 tools/build-score-history.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 규칙 버전마다 무엇이 바뀌었는지. 점수 변화를 설명하는 문장이라 손으로 적는다.
RULESETS = {
    "v6": "함수 길이 축 신설. 최악값 1개 대신 상위 10개 평균을 쓰기 시작 — "
          "'제일 나쁜 하나만 고치고 끝'이 최적 전략이 되는 걸 막는다.",
    "v7": "분기의 모양(중첩 깊이·가드 절)을 재기 시작. 함수 길이 p90 이 40줄+ 비율과 "
          "상관 0.914 로 같은 축을 두 번 재고 있어 볼륨을 절반으로 줄였다.",
    "v11": "파일 크기 항이 코퍼스 p90(280줄) 훨씬 전인 145줄에서 이미 만점 감점에 "
           "닿고 있었다 — 캡을 14→5 로 줄이면서 나눗수를 안 고친 누락이다. 70곳 중 "
           "29곳이 캡에 붙어 150줄짜리와 2,000줄짜리를 구분 못 했다. 기울기를 고쳤다. "
           "같은 판에서 O(n²)와 순차 I/O 를 채점축으로 올렸다(v10).",
    "v12": "O(n²) 탐지에 멤버십 조회(includes/indexOf)를 넣었다 — 루프 안에서 배열을 "
           "훑는 가장 흔한 형태인데 빠져 있었다. 수신자가 배열이라는 증거가 있을 때만 "
           "센다. 재현율이 오르자 분포가 밀려 유예·기울기를 규칙대로(유예=중앙, "
           "캡은 p90에서) 되돌릴 수 있게 됐다.",
    "v13": "점수식은 그대로 두고 측정 범위를 바로잡았다. 파일명·생성 배너가 있는 생성물과 "
           "sample/tmp 부속 코드를 제외하고, admin-api·backend·*-back 모노레포 앱을 "
           "백엔드로 분류한다. 범위가 달라진 점수는 이전 판과 비교할 수 없어 버전을 올렸다.",
}


def corpus_at(rev):
    try:
        raw = subprocess.run(["git", "-C", ROOT, "show", f"{rev}:data/corpus.json"],
                             capture_output=True, text=True, timeout=30)
        if raw.returncode:
            return None
        return json.loads(raw.stdout)
    except Exception:
        return None


revs = subprocess.run(["git", "-C", ROOT, "log", "--format=%H %ad", "--date=short",
                       "--", "data/corpus.json"], capture_output=True, text=True).stdout.strip()
if not revs:
    sys.exit("corpus.json 의 git 이력을 못 찾았다")

# 버전당 가장 최신 스냅샷 하나만 쓴다(같은 버전으로 여러 번 커밋될 수 있다).
seen, versions = set(), []
for line in revs.split("\n"):
    sha, date = line.split(" ", 1)
    d = corpus_at(sha)
    if not d or not d.get("version") or d["version"] in seen:
        continue
    seen.add(d["version"])
    versions.append({
        "version": d["version"],
        "date": d.get("measuredAt") or date,
        "n": d.get("n", len(d.get("repos", []))),
        "scores": {r["name"]: r["score"] for r in d.get("repos", [])},
        "grades": {r["name"]: r.get("gradeF") or r.get("grade") for r in d.get("repos", [])},
    })

# 오래된 것부터
order = ["v6", "v7", "v8", "v9", "v10", "v11", "v12", "v13"]
versions.sort(key=lambda v: order.index(v["version"]) if v["version"] in order else 99)

names = sorted({n for v in versions for n in v["scores"]})
history = {}
for name in names:
    track = [{"version": v["version"], "score": v["scores"][name], "grade": v["grades"].get(name)}
             for v in versions if name in v["scores"]]
    if len(track) > 1:
        history[name] = track

# 규칙을 바꿔 재측정하면 행은 자동으로 생기는데 설명은 손으로 적는다 — 안 적으면
# 랜딩에 빈칸이 나간다. 조용히 비는 쪽이라 여기서 막는다.
undocumented = [v["version"] for v in versions if not RULESETS.get(v["version"])]
if undocumented:
    sys.exit(f"RULESETS 에 설명이 없는 판: {', '.join(undocumented)} "
             f"— tools/build-score-history.py 의 RULESETS 에 무엇이 바뀌었는지 적어라")

out = {
    "note": "채점 규칙 버전별 점수. 규칙이 다르면 점수를 나란히 비교할 수 없다 — "
            "이 표는 '무엇이 바뀌어서 점수가 움직였는지'를 보여주기 위한 것이지, "
            "저장소가 좋아졌다/나빠졌다는 뜻이 아니다.",
    "rulesets": [{"version": v["version"], "date": v["date"], "n": v["n"],
                  "changed": RULESETS.get(v["version"], "")} for v in versions],
    "repos": history,
}
json.dump(out, open(f"{ROOT}/data/score-history.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

moved = [(n, t[0]["score"], t[-1]["score"]) for n, t in history.items()
         if t[0]["score"] != t[-1]["score"]]
moved.sort(key=lambda x: abs(x[2] - x[1]), reverse=True)
print(f"score-history.json → 규칙 {len(versions)}판 · 저장소 {len(history)}곳")
print("  판:", " → ".join(f"{v['version']}({v['n']})" for v in versions))
print("  가장 많이 움직인 곳:", ", ".join(f"{n} {a}→{b}" for n, a, b in moved[:5]))
