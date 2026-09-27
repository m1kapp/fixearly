#!/usr/bin/env python3
"""Snapshot GitHub's commit-contributor count for every impact repository."""

import datetime as dt
import json
import os
import re
import subprocess
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/data/repo-contributors.json"


def count_response(raw):
    headers, body = raw.rsplit("\n\n", 1)
    entries = json.loads(body)
    if not isinstance(entries, list):
        raise ValueError("GitHub did not return a contributor list")
    last = re.search(r'page=(\d+)>;\s*rel="last"', headers, re.I)
    return int(last.group(1)) if last else len(entries)


if "--selftest" in sys.argv:
    assert count_response('HTTP/2 200\nLink: <https://api.github.com/x?page=2018>; rel="last"\n\n[{}]') == 2018
    assert count_response("HTTP/2 200\n\n[]") == 0
    print("기여자 수 응답 파싱 통과")
    sys.exit(0)

findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]
repos = sorted({f["repo"] for f in findings})

if "--check" in sys.argv:
    data = json.load(open(OUT, encoding="utf-8"))
    missing = [repo for repo in repos if not isinstance(data["repos"].get(repo), int)]
    print(f"기여자 수 {len(repos) - len(missing)}/{len(repos)}곳 · 기준 {data['generatedAt']}")
    sys.exit(1 if missing else 0)

counts = {}
for repo in repos:
    result = subprocess.run(
        ["gh", "api", "-i", f"repos/{repo}/contributors?per_page=1&anon=true"],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode:
        sys.exit(f"{repo}: {result.stderr.strip()}")
    counts[repo] = count_response(result.stdout)
    print(f"{repo:<28} {counts[repo]:>5,}")

data = {
    "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
    "method": "GitHub REST contributors?per_page=1&anon=true; last-page count; commit authors, not unique humans",
    "repos": counts,
}
with open(OUT, "w", encoding="utf-8") as file:
    json.dump(data, file, ensure_ascii=False, indent=2)
    file.write("\n")
print(f"repo-contributors.json → {len(counts)}곳")
