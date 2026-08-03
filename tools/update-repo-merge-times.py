#!/usr/bin/env python3
"""저장소별 외부 기여 PR의 최근 평균 머지 시간을 갱신한다.

각 저장소에서 최근 닫힌 PR 60건을 보고, 그중 봇·멤버·협업자가 아닌 작성자의
머지 PR만 센다. 우리 PR이 기다릴 시간을 가늠하려는 숫자라 내부 팀 PR은 제외한다.

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
        merged = []
        for pr in pulls:
            user = pr.get("user") or {}
            if not pr.get("merged_at"):
                continue
            if pr.get("author_association") in INTERNAL:
                continue
            if user.get("type") == "Bot" or str(user.get("login", "")).endswith("[bot]"):
                continue
            merged.append((parse_time(pr["merged_at"]) - parse_time(pr["created_at"])).total_seconds() / 86400)

        result[repo] = {
            "averageDays": round(sum(merged) / len(merged), 1) if merged else None,
            "mergedExternal": len(merged),
            "sampledClosed": len(pulls),
        }
        average = result[repo]["averageDays"]
        shown = f"{average:.1f}일" if average is not None else "표본 없음"
        print(f"  {repo}: {shown} (외부 머지 {len(merged)}/{len(pulls)})")

    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": "latest 60 closed PRs; merged non-bot external contributors",
        "repos": result,
    }
    with open(OUT, "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")
    print(f"\n{len(repos)}개 저장소 평균 갱신")


if __name__ == "__main__":
    main()
