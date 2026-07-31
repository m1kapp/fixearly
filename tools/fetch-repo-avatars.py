#!/usr/bin/env python3
"""
fetch-repo-avatars — 임팩트 카드에 붙일 저장소 아이콘을 data URI 로 받아둔다.

랜딩은 외부 리소스가 0개다(이미지 태그도 0개, 전부 인라인 SVG). 아이콘을
githubusercontent 에서 직접 불러오면 그게 깨지고, GitHub CDN 이 죽으면 카드가
빈칸이 된다. 그래서 받아서 base64 로 박는다 — 32px 이면 한 장에 1~2KB다.

org 아바타가 사실상 그 프로젝트 로고다(vite·n8n·strapi 전부).

출력: data/repo-avatars.json  { "owner/repo": "data:image/png;base64,..." }
사용: python3 tools/fetch-repo-avatars.py [--check]
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/data/repo-avatars.json"
CHECK = "--check" in sys.argv
SIZE = 32  # 15px 로 그리니 2배. 더 키워도 눈에 안 띄고 용량만 는다.

findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]
repos = list(dict.fromkeys(f["repo"] for f in findings))
have = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}

missing = [r for r in repos if r not in have]
stale = [r for r in have if r not in repos]

if CHECK:
    for r in missing:
        print(f"  ✗ 아이콘 없음: {r}")
    print(f"{'아이콘 누락 ' + str(len(missing)) + '곳' if missing else '아이콘이 저장소 전부를 덮는다'}"
          f" ({len(repos)}곳 · {os.path.getsize(OUT) // 1024 if os.path.exists(OUT) else 0}KB)")
    sys.exit(1 if missing else 0)


def avatar_url(repo):
    owner = repo.split("/")[0]
    r = subprocess.run(["gh", "api", f"users/{owner}", "--jq", ".avatar_url"],
                       capture_output=True, text=True, timeout=30)
    return r.stdout.strip() or None


for repo in missing:
    url = avatar_url(repo)
    if not url:
        print(f"  ⚠ {repo}: 아바타 URL 없음")
        continue
    try:
        with urllib.request.urlopen(f"{url}&s={SIZE}", timeout=25) as res:
            raw = res.read()
        have[repo] = "data:image/png;base64," + base64.b64encode(raw).decode()
        print(f"  + {repo:<26} {len(raw):>5}B")
    except Exception as e:
        print(f"  ⚠ {repo}: {e}")

# 레지스트리에서 빠진 저장소는 같이 지운다 — 안 그러면 파일만 계속 큰다.
for r in stale:
    have.pop(r, None)
    print(f"  - {r} (레지스트리에 없음)")

json.dump(have, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(f"repo-avatars.json → {len(have)}곳 · {os.path.getsize(OUT) // 1024}KB")
