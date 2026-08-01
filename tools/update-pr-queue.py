#!/usr/bin/env python3
"""
update-pr-queue — PR-QUEUE.md 의 '지금 열려 있는 것' 표를 impact.json 에서 다시 만든다.

이 문서만 손으로 갱신하고 있었고, 실제로 어긋났다 — "열린 것이 6건이다" 라고 적힌
동안 14건이었고, vite 는 승인됐는데 표에는 대기로 남아 있었다. 판단(속도 규칙,
탈락 사유, 게이트 0)은 사람이 쓰는 게 맞지만 **개수와 상태는 사람이 쓸 이유가 없다.**

마커 사이만 생성한다. 바깥의 글은 건드리지 않는다.

상태는 impact.mjs 가 registry 에 남긴 status 를 읽는다 — 네트워크를 안 타므로
npm test 안에서 돌 수 있다. 상태가 낡았다면 그건 `npm run impact` 를 안 돌린 것이고,
그 자체가 알아야 할 사실이다.

사용: python3 tools/update-pr-queue.py [--check]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = f"{ROOT}/PR-QUEUE.md"
CHECK = "--check" in sys.argv
BEGIN = "<!-- auto:open — tools/update-pr-queue.py 가 생성한다. 손으로 고치지 마라. -->"
END = "<!-- /auto:open -->"

LABEL = {
    "merged": "✅ 머지", "approved": "🔵 승인 · 머지 대기", "changes": "🟠 변경 요청",
    "reviewing": "🟢 리뷰 진행", "waiting": "⚪ 대기", "draft": "🟡 초안",
    "closed": "❌ 닫힘", "unknown": "· 알 수 없음",
}
OPEN = ("approved", "changes", "reviewing", "waiting", "draft")
ORDER = {k: i for i, k in enumerate(OPEN)}

findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]


def axis(t):
    """자유서술인 type 에서 축 이름만 뽑는다.
    'O(n²) (청크 x import 마다 …)' → 'O(n²)'
    '독립 순차 await (…)'          → '순차 I/O'
    """
    head = t.split("(")[0].strip() or t
    if head.startswith("N+1"):
        return "N+1"
    if head.startswith("O"):
        return "O(n²)"
    if "순차 await" in t or "순차" in head:
        return "순차 I/O"
    if "중복 쿼리" in head:
        return "중복 쿼리"
    return head


def days(f):
    import datetime as d
    if not f.get("createdAt"):
        return ""
    born = d.datetime.fromisoformat(f["createdAt"].replace("Z", "+00:00"))
    n = (d.datetime.now(d.timezone.utc) - born).days
    return f"{n}일째" if n >= 1 else "오늘"


rows = sorted((f for f in findings if f.get("status") in OPEN),
              key=lambda f: (ORDER[f["status"]], f["repo"]))
decided = [f for f in findings if f.get("status") in ("merged", "closed")]
merged = [f for f in decided if f["status"] == "merged"]
approved = [f for f in findings if f.get("status") == "approved"]

body = ["| PR | 축 | 상태 | 경과 |", "|---|---|---|---|"]
for f in rows:
    name = str(f["repoLabel"]).split("·")[0].strip()
    body.append(f"| [{name}#{f['pr']}](https://github.com/{f['repo']}/pull/{f['pr']}) "
                f"| {axis(f['type'])} | {LABEL[f['status']]} | {days(f)} |")
body.append("")
body.append(f"**열린 것 {len(rows)}건.** 판정 난 {len(decided) + len(approved)}건 중 "
            f"머지 {len(merged)} · 승인 {len(approved)} · "
            f"닫힘 {len(decided) - len(merged)}.")
block = BEGIN + "\n" + "\n".join(body) + "\n" + END

doc = open(DOC, encoding="utf-8").read()
m = re.search(re.escape(BEGIN) + r".*?" + re.escape(END), doc, re.S)
if not m:
    print(f"  ✗ 마커가 없다. PR-QUEUE.md 의 '지금 열려 있는 것' 아래에 넣어라:\n"
          f"    {BEGIN}\n    {END}")
    sys.exit(1)

same = m.group(0) == block


def without_age(block_text):
    """경과 열을 지운 사본. --check 는 이걸로 비교한다.

    경과는 생성 시점 기준으로 계산해 박히는데 검사는 실행 시점에 다시 계산한다 —
    그래서 아무것도 안 바뀌어도 날짜가 넘어가면 '오늘'이 '1일째'가 되면서 테스트가
    깨졌다. 커밋 직후엔 통과하고 다음 날 CI 는 빨간불이라는 뜻이다. 상태·개수가
    어긋나는 건 여전히 잡되, 시계만으로는 안 깨지게 마지막 열을 빼고 본다."""
    return re.sub(r"\|[^|\n]*\|\s*$", "|", block_text, flags=re.M)


if CHECK:
    # 표가 낡은 게 아니라 날짜만 넘어간 경우를 구분해서 알려준다.
    stale = without_age(m.group(0)) != without_age(block)
    if stale:
        print(f"PR 큐 표가 낡았다 (열린 것 {len(rows)}건) — python3 tools/update-pr-queue.py")
    elif not same:
        print("PR 큐 표가 impact.json 과 일치한다 (경과 표기만 하루치 밀림)")
    else:
        print("PR 큐 표가 impact.json 과 일치한다")
    sys.exit(1 if stale else 0)

if not same:
    open(DOC, "w", encoding="utf-8").write(doc[: m.start()] + block + doc[m.end():])
print(f"PR-QUEUE.md {'갱신' if not same else '변경 없음'} · 열린 것 {len(rows)}건 · "
      f"머지 {len(merged)} 승인 {len(approved)} 닫힘 {len(decided) - len(merged)}")
