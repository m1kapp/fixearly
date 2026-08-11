#!/usr/bin/env python3
"""저장소별 외부 기여 PR의 최근 머지 시간을 갱신한다.

각 저장소에서 최근 닫힌 PR 60건을 보고, 그중 봇·멤버·협업자가 아닌 작성자의
머지 PR만 센다. 우리 PR이 기다릴 시간을 가늠하려는 숫자라 내부 팀 PR은 제외한다.

**판정에 쓰는 값은 중앙값이다.** 평균은 묵은 몇 건이 통째로 끌고 간다 — next.js 는
평균 91.9일인데 중앙값은 0.8일이었다. "이 저장소는 보통 며칠 걸리나"를 묻는 자리에
평균을 쓰면 이상치 하나로 판정이 뒤집힌다. 평균도 같이 남기되 참고용이다.

사용: GITHUB_TOKEN=$(gh auth token) python3 tools/update-repo-merge-times.py
"""

import datetime as dt
import json
import os
import urllib.parse
import urllib.request


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/data/repo-merge-times.json"
SAMPLE_SIZE = 60
INTERNAL = {"OWNER", "MEMBER", "COLLABORATOR"}


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def median(values):
    """짝수 개면 가운데 두 값의 평균. 표본이 없으면 None."""
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    value = ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2
    return round(value, 1)


def fetch(repo, token):
    query = urllib.parse.urlencode({
        "state": "closed",
        "sort": "updated",
        "direction": "desc",
        "per_page": SAMPLE_SIZE,
    })
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/pulls?{query}",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "fixearly-merge-times",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]
    repos = sorted({finding["repo"] for finding in findings})
    token = os.environ.get("GITHUB_TOKEN", "")
    result = {}

    for repo in repos:
        pulls = fetch(repo, token)
        merged, external = [], []
        # [FP:retroactive-author-association] "처음 내는 사람(NONE)의 수락률"은
        # 이 API 로 잴 수 없다. author_association 은 **조회 시점의 관계**라서, PR 이
        # 머지되는 순간 그 저자는 CONTRIBUTOR 가 되고 과거 PR 까지 그렇게 보인다.
        # 실측 2026-08-11: 우리 머지 4건(outline#13117 · nocodb#14309 · vite#23114 ·
        # ghost#29831)은 낼 때 전부 NONE 이었는데 지금 조회하면 전부 CONTRIBUTOR 다.
        # 그래서 "NONE 이면서 머지됨"은 구조적으로 거의 0 이 되고, 코호트 수락률을
        # 그렇게 계산하면 cal.com 0/43 · typeorm 0/35 같은 그럴듯한 0% 가 쏟아진다.
        # 한 번 이 숫자를 믿고 "처음 내는 사람은 어디서도 안 받아준다"로 갈 뻔했다.
        # 재려면 저자별로 이 PR 이전의 머지 이력을 따로 조회해야 한다 — 지금은 안 잰다.
        for pr in pulls:
            user = pr.get("user") or {}
            if pr.get("author_association") in INTERNAL:
                continue
            if user.get("type") == "Bot" or str(user.get("login", "")).endswith("[bot]"):
                continue
            external.append(pr)
            if not pr.get("merged_at"):
                continue
            merged.append((parse_time(pr["merged_at"]) - parse_time(pr["created_at"])).total_seconds() / 86400)

        result[repo] = {
            "medianDays": median(merged),
            "averageDays": round(sum(merged) / len(merged), 1) if merged else None,
            "mergedExternal": len(merged),
            # 수락률 — 이 저장소가 외부 PR 을 원래 받는 곳인가. 늦는 이유가 두 가지라
            # 이게 없으면 구분이 안 된다: 우리 것만 밀린 건지(langfuse 83%),
            # 원래 대부분 거절인지(typeorm 8%). 다음에 어디를 고를지가 여기서 갈린다.
            "acceptancePct": round(100 * len(merged) / len(external)) if external else None,
            "closedExternal": len(external),
            "sampledClosed": len(pulls),
        }
        mid = result[repo]["medianDays"]
        rate = result[repo]["acceptancePct"]
        shown = f"중앙 {mid:.1f}일" if mid is not None else "표본 없음"
        print(f"  {repo}: {shown} · 수락률 {rate}% (외부 {len(merged)}/{len(external)})")

    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": "latest 60 closed PRs; merged non-bot external contributors; medianDays is the one we judge by",
        "repos": result,
    }
    with open(OUT, "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"\n{len(repos)}개 저장소 평균 갱신")


if __name__ == "__main__":
    main()
