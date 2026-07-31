#!/usr/bin/env python3
"""
update-impact-cards — IMPACT.md 의 PR 상태를 랜딩 08 섹션 카드로 옮긴다.

상태의 단일 출처는 IMPACT.md 다(impact.mjs 가 GitHub 에서 갱신). 이 스크립트는
그걸 읽어 카드 마크업만 다시 만든다. CSS 는 건드리지 않는다 — index.html 에 있다.

사용: python3 tools/update-impact-cards.py   (impact.mjs 실행 후에 돌린다)
"""
import json
import re
import sys

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]
# 저장소 아이콘은 data URI 로 박는다 — 랜딩은 외부 리소스가 0개다.
# tools/fetch-repo-avatars.py 가 만든다.
_av = f"{ROOT}/data/repo-avatars.json"
AVATAR = json.load(open(_av, encoding="utf-8")) if os.path.exists(_av) else {}
md = open(f"{ROOT}/IMPACT.md", encoding="utf-8").read()

STAGE = [
    ("merged",    "✅", "머지됨",         "merged",            3, False),
    ("approved",  "🔵", "승인 · 머지 대기", "approved",          2, False),
    ("changes",   "🟠", "변경 요청",       "changes requested", 1, False),
    ("reviewing", "🟢", "리뷰 진행",       "in review",         1, False),
    ("waiting",   "⚪", "리뷰어 배정 전",   "awaiting review",   0, False),
    ("draft",     "🟡", "초안",           "draft",             0, False),
    ("closed",    "❌", "닫힘",           "closed",            0, True),
]
ICON2KEY = {icon: key for key, icon, *_ in STAGE}
META = {key: (ko, en, at, ended) for key, _i, ko, en, at, ended in STAGE}
ORDER = [k for k, *_ in STAGE]

state_by_pr = {}
for line in md.splitlines():
    m = re.search(r"/pull/(\d+)\)\s*\|\s*([^|]+)\|", line)
    if not m:
        continue
    for icon, key in ICON2KEY.items():
        if icon in m.group(2):
            state_by_pr[m.group(1)] = key
            break

GH_MARK = ('<svg class="gh" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'
           '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>')

STAR = ('<svg class="st" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">'
        '<path d="M8 .25l2.06 4.55 4.94.53-3.68 3.33 1.02 4.87L8 11.1l-4.34 2.43 1.02-4.87L1 5.33l4.94-.53z"/></svg>')



def elapsed(f, key):
    """카드에 붙일 경과 표시. 머지·닫힘은 '며칠 만에', 진행 중은 '며칠째'.

    시간은 사람이 제일 먼저 읽는 신호다 — 6일 만에 머지된 것과 3주째 대기 중인
    것은 같은 '진행'이 아니다. 날짜는 impact.mjs 가 GitHub 에서 받아 registry 에
    남긴다(createdAt/mergedAt/closedAt).
    """
    import datetime as _d
    born = f.get("createdAt")
    if not born:
        return ""
    parse = lambda t: _d.datetime.fromisoformat(t.replace("Z", "+00:00"))
    start = parse(born)
    done = f.get("mergedAt") or f.get("closedAt")
    end = parse(done) if done else _d.datetime.now(_d.timezone.utc)
    days = (end - start).days
    if done:
        return f"{days}일 만에" if days >= 1 else "당일"
    return f"{days}일째" if days >= 1 else "오늘"


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def split_label(label):
    """'outline · 39.8k★' → ('outline', '39.8k')"""
    m = re.match(r"^(.*?)\s*·\s*([\d.,]+k?)\s*★?\s*$", label)
    if m:
        return m.group(1).strip(), m.group(2)
    return label.strip(), None


def trail(at):
    out = []
    for i in range(4):
        if i < at:
            cls = "d done"
        elif i == at:
            cls = "d done" if at == 3 else "d now"
        else:
            cls = "d todo"
        out.append(f'<i class="{cls}"></i>')
    return f'<span class="trail" aria-hidden="true">{"".join(out)}</span>'


# 카드에 저장소 이름만 있으면 "novu 가 뭔데" 에서 읽기가 멈춘다. 한 줄 설명을 붙인다.
# GitHub description 을 그대로 쓰지 않는 이유: 마케팅 문구라 길고 자기소개다
# ("The world's most flexible commerce platform for agents and developers").
# 무엇을 하는 물건인지만 남긴다. 새 저장소는 여기 없으면 빈칸으로 나가고,
# --check 가 잡는다.
BLURB = {
    "outline/outline": ("팀 위키·문서", "team knowledge base"),
    "nocodb/nocodb": ("노코드 DB · Airtable 대안", "no-code database"),
    "novuhq/novu": ("알림 인프라", "notification infrastructure"),
    "medusajs/medusa": ("커머스 백엔드", "commerce backend"),
    "vitejs/vite": ("프런트엔드 빌드 도구", "frontend build tool"),
    "n8n-io/n8n": ("워크플로 자동화", "workflow automation"),
    "immich-app/immich": ("셀프호스팅 사진 보관", "self-hosted photo library"),
    "langfuse/langfuse": ("LLM 관측·평가", "LLM observability"),
    "calcom/cal.diy": ("일정 예약", "scheduling"),
    "payloadcms/payload": ("헤드리스 CMS · Next.js", "headless CMS"),
    "strapi/strapi": ("헤드리스 CMS", "headless CMS"),
    "baptisteArno/typebot.io": ("챗봇 빌더", "chatbot builder"),
    "typeorm/typeorm": ("TypeScript ORM", "TypeScript ORM"),
    "TryGhost/Ghost": ("퍼블리싱·뉴스레터", "publishing & newsletters"),
    "twentyhq/twenty": ("오픈소스 CRM", "open-source CRM"),
    "directus/directus": ("데이터 백엔드", "data backend"),
    "Budibase/budibase": ("사내 도구 빌더", "internal tools builder"),
}


def card(f, key):
    ko, en, at, ended = META[key]
    url = f"https://github.com/{f['repo']}/pull/{f['pr']}"
    name, stars = split_label(f["repoLabel"])
    star_html = f'<span class="stars">{STAR}{stars}</span>' if stars else ""
    # 닫힌 건 트레일을 안 그린다 — 진행이 없으니 진행 표시도 없다.
    mark = "" if ended else trail(at)
    cls = "ic" + (" done" if key == "merged" else "") + (" off" if ended else "")
    age = elapsed(f, key)
    age_html = f'<span class="age">{age}</span>' if age else ""
    src = AVATAR.get(f["repo"])
    fav = f'<img class="ifav" src="{src}" alt="" width="15" height="15" loading="lazy">' if src else ""
    bk, be = BLURB.get(f["repo"], ("", ""))
    what = (f'<span class="iw"><span class="ko">{esc(bk)}</span>'
            f'<span class="en">{esc(be)}</span></span>') if bk else ""
    return (
        f'<a class="{cls}" href="{url}" target="_blank" rel="noopener">'
        f'{GH_MARK}'
        f'<b>{fav}{esc(name)}{star_html}</b>'
        f'{what}'
        f'<span class="it">{esc(f["title"])}</span>'
        f'<span class="ist">{mark}'
        f'<span class="ko">{ko}</span><span class="en">{en}</span>'
        f'{age_html}'
        f'<span class="prn">#{f["pr"]}</span></span></a>'
    )


grouped = {k: [] for k in ORDER}
for f in findings:
    grouped.get(state_by_pr.get(str(f["pr"]), "waiting"), grouped["waiting"]).append(f)

rows = "\n      ".join(card(f, k) for k in ORDER for f in grouped[k])

h = open(f"{ROOT}/index.html", encoding="utf-8").read()
m = re.search(r'(<div class="iwrap">)(.*?)(\n    </div>)', h, re.S)
assert m
h = h[: m.start(2)] + "\n      " + rows + h[m.end(2):]


# 요약 줄(note)도 같은 출처에서 다시 만든다 — 카드만 갱신하면 이 줄이 조용히 낡는다(실제로 그랬다).
counts = {k: len(v) for k, v in grouped.items() if v}
ko_line = " · ".join(f"{META[k][0]} {n}" for k, n in counts.items())
en_line = " · ".join(f"{n} {META[k][1]}" for k, n in counts.items())
h = re.sub(
    r'(<p class="ko">)[^<]*?( — 전체 기록은 <a href="https://github\.com/m1kapp/fixearly/blob/main/IMPACT\.md">)',
    rf"\g<1>{ko_line}\g<2>", h, count=1)
h = re.sub(
    r'(<p class="en">)[^<]*?( — full log in <a href="https://github\.com/m1kapp/fixearly/blob/main/IMPACT\.md">)',
    rf"\g<1>{en_line}\g<2>", h, count=1)

# 새 저장소에 한 줄 설명을 안 붙이면 카드에 이름만 남는다 — 조용히 비는 쪽이라 검사한다.
repos = {f["repo"] for f in findings}
missing = sorted(repos - set(BLURB))
noicon = sorted(repos - set(AVATAR))
for r in missing:
    print(f"  ✗ BLURB 없음: {r}")
for r in noicon:
    print(f"  ✗ 아이콘 없음(python3 tools/fetch-repo-avatars.py): {r}")
missing = missing + noicon

if "--check" in sys.argv:
    print(f"{'설명 누락 ' + str(len(missing)) + '곳' if missing else '카드 설명이 저장소 전부를 덮는다'}"
          f" ({len(findings)}건 / {len({f['repo'] for f in findings})}곳)")
    sys.exit(1 if missing else 0)

open(f"{ROOT}/index.html", "w", encoding="utf-8").write(h)
print("카드 개편:", counts)
print("요약 줄:", ko_line)
