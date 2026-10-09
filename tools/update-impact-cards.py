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
import datetime as dt
from collections import Counter

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
registry = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))
findings = registry["findings"]


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def snapshot_time(data, items):
    """카드의 정적 폴백을 만든 상태 조회 시각.

    열린 PR 의 경과일을 현재 시각으로 만들면 같은 impact.json 이 자정마다 다른
    index.html 을 만들고 --check 가 실패한다. 새 레지스트리는 generatedAt 을 쓰고,
    필드가 없던 기존 레지스트리는 마지막 관측 사건 시각으로 결정론적으로 복구한다.
    """
    if data.get("generatedAt"):
        return parse_time(data["generatedAt"])
    observed = []
    for item in items:
        observed.extend(item.get(key) for key in ("createdAt", "mergedAt", "closedAt"))
        observed.append(item.get("release", {}).get("releasedAt"))
    timestamps = [parse_time(value) for value in observed if value]
    if not timestamps:
        raise ValueError("impact.json 에 generatedAt 또는 상태 시각이 없습니다")
    return max(timestamps)


SNAPSHOT_AT = snapshot_time(registry, findings)
# 저장소 아이콘은 data URI 로 박는다 — 랜딩은 외부 리소스가 0개다.
# tools/fetch-repo-avatars.py 가 만든다.
_av = f"{ROOT}/data/repo-avatars.json"
AVATAR = json.load(open(_av, encoding="utf-8")) if os.path.exists(_av) else {}
_mt = f"{ROOT}/data/repo-merge-times.json"
MERGE_TIMES = json.load(open(_mt, encoding="utf-8")).get("repos", {}) if os.path.exists(_mt) else {}
_contributors = json.load(open(f"{ROOT}/data/repo-contributors.json", encoding="utf-8"))
CONTRIBUTORS = _contributors["repos"]
CONTRIBUTORS_ASOF = _contributors["generatedAt"][:10]
md = open(f"{ROOT}/IMPACT.md", encoding="utf-8").read()

STAGE = [
    ("merged",    "✅", "머지됨",         "merged",            3, False),
    ("approved",  "🔵", "승인 · 머지 대기", "approved",          2, False),
    ("changes",   "🟠", "변경 요청",       "changes requested", 1, False),
    ("reviewing", "🟢", "리뷰 진행",       "in review",         1, False),
    # "리뷰어 배정 전"이라고 적었었는데, 실측해보니 머지된 외부 PR 53건 중 리뷰어가
    # 실제로 배정된 건 22건뿐이다(novu·langfuse 는 0건 — 메인테이너가 그냥 머지한다).
    # 절반 넘는 저장소에서 일어나지도 않는 사건을 기다리는 것처럼 읽혔다.
    ("waiting",   "⚪", "아무도 안 봄",     "nobody has looked", 0, False),
    ("stalled",   "🟣", "보류",           "stalled",           0, False),
    ("draft",     "🟡", "초안",           "draft",             0, False),
    ("closed",    "❌", "닫힘",           "closed",            0, True),
]
# 보류는 GitHub 에 없는 상태다 — 우리가 시간으로 만든다. 닫히지도 머지되지도 않은 채
# 그 저장소의 외부 머지 중앙값 + 유예일을 넘긴 것. "대기"로 묶어두면 어제 낸 것과
# 평소의 세 배를 넘긴 것이 같은 줄에 앉는데, 그 둘은 다음에 할 일이 다르다.
STALL_GRACE_DAYS = 7
# 시간으로만 결정되므로 IMPACT.md 의 아이콘 표에는 넣지 않는다(파싱은 GitHub 상태만).
ICON2KEY = {icon: key for key, icon, *_ in STAGE if key != "stalled"}
META = {key: (ko, en, at, ended) for key, _i, ko, en, at, ended in STAGE}
ORDER = [k for k, *_ in STAGE]
STALLABLE = ("waiting", "reviewing")

state_by_pr = {}
for line in md.splitlines():
    m = re.search(r"/pull/(\d+)\)\s*\|\s*([^|]+)\|", line)
    if not m:
        continue
    for icon, key in ICON2KEY.items():
        if icon in m.group(2):
            state_by_pr[m.group(1)] = key
            break


def stall_after(f):
    """이 PR 이 보류로 넘어가는 경과일. 중앙값을 모르면 None(보류로 안 넘긴다)."""
    middle = MERGE_TIMES.get(f["repo"], {}).get("medianDays")
    return None if middle is None else max(1, int(middle + .5)) + STALL_GRACE_DAYS


def stage_age_days(f, key, reference=None):
    """현재 단계에서 멈춘 기간.

    대기는 PR 생성부터 재지만, 리뷰 중과 승인은 마지막 사람 개입부터 잰다. 오래 대기한 PR에
    오늘 maintainer가 붙었는데 곧바로 보류로 접히면 현재 상태를 거꾸로 보여준다.
    """
    since = (f.get("engagedAt") if key == "reviewing" else
             f.get("approvedAt") if key == "approved" else f.get("createdAt"))
    if not since:
        return None
    start = parse_time(since)
    return int(((reference or SNAPSHOT_AT) - start).total_seconds() // 86400)

GH_MARK = ('<svg class="gh" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'
           '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>')

STAR = ('<svg class="st" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">'
        '<path d="M8 .25l2.06 4.55 4.94.53-3.68 3.33 1.02 4.87L8 11.1l-4.34 2.43 1.02-4.87L1 5.33l4.94-.53z"/></svg>')



def elapsed(f, key, reference=None):
    """카드에 붙일 (한글, 영어, 머지월, 경과일) 사중.

    시간은 사람이 제일 먼저 읽는 신호다 — 6일 만에 머지된 것과 3주째 대기 중인
    것은 같은 '진행'이 아니다. 날짜는 impact.mjs 가 GitHub 에서 받아 registry 에
    남긴다(createdAt/mergedAt/closedAt).

    카드의 다른 글자는 전부 ko/en 쌍인데 이것만 한글이었다. 영어 쪽은 짧게 간다 —
    끝난 건 걸린 기간(in 6d), 진행 중인 건 며칠째인지(day 7). '일째'가 '7번째 날'
    이라 day 7 이 그대로 맞는 대응이다.

    머지된 건 언제 끝났는지도 남긴다("'26.7"). 기간만 있으면 6일이 언제의 6일인지
    모른다.
    """
    born = f.get("createdAt")
    if not born:
        return ("", "", "", None)
    start = parse_time(born)
    merged = f.get("mergedAt")
    done = merged or f.get("closedAt")
    end = parse_time(done) if done else (reference or SNAPSHOT_AT)
    days = (end - start).days
    # 머지월만 적는다. 닫힌 건 굳이 날짜를 새기지 않는다.
    on = f"'{parse_time(merged):%y}.{parse_time(merged).month}" if merged else ""
    if done:
        return ((f"{days}일 만에", f"in {days}d", on, days) if days >= 1
                else ("당일", "same day", on, days))
    return ((f"{days}일째", f"day {days}", "", days) if days >= 1
            else ("오늘", "today", "", days))


if "--selftest" in sys.argv:
    open_pr = {"createdAt": "2026-08-25T15:17:47Z"}
    fixed = snapshot_time({"generatedAt": "2026-08-26T01:00:00Z"}, [])
    assert elapsed(open_pr, "waiting", fixed)[3] == 0
    legacy = snapshot_time({}, [
        open_pr,
        {"release": {"releasedAt": "2026-08-29T15:17:47Z"}},
    ])
    assert elapsed(open_pr, "waiting", legacy)[3] == 4
    closed_pr = {**open_pr, "closedAt": "2026-08-27T15:17:47Z"}
    assert elapsed(closed_pr, "closed", fixed)[3] == 2
    reviewing_pr = {
        "createdAt": "2026-08-11T00:00:00Z",
        "engagedAt": "2026-08-28T00:00:00Z",
    }
    snapshot = parse_time("2026-09-01T00:00:00Z")
    assert stage_age_days(reviewing_pr, "reviewing", snapshot) == 4
    assert stage_age_days(reviewing_pr, "waiting", snapshot) == 21
    assert stage_age_days({"approvedAt": "2026-08-28T00:00:00Z"}, "approved", snapshot) == 4
    print("impact 카드 경과일이 상태 스냅샷 시각에 고정된다 · 리뷰 시계는 사람 개입부터 센다")
    sys.exit(0)


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


def delivery_timeline(f, key, pr_url, age_html):
    """PR 생성 → 머지 → 릴리즈를 링크 가능한 세로 계보로 만든다.

    카드 전체를 PR 링크로 두면 릴리즈 링크를 중첩할 수 없다. 머지 카드의 본문과
    계보를 분리하고, 앞의 두 사건은 PR로, 마지막 사건은 실제 배포 경계로 잇는다.
    아직 머지되지 않은 카드도 같은 세 칸을 유지하되 남은 경계를 사실대로 적는다.
    nightly·프리릴리즈(next·canary·beta)는 안정판으로 과장하지 않는다.
    """
    if key == "closed":
        return ""
    created = f.get("createdAt")
    if not created:
        return ""
    import datetime as _d
    month = lambda value: (lambda dt: f"'{dt:%y}.{dt.month}")(
        _d.datetime.fromisoformat(value.replace("Z", "+00:00")))
    created_month = month(created)
    pr_link = f'href="{pr_url}" target="_blank" rel="noopener"'
    if key != "merged":
        approved_delayed = (key == "approved" and f.get("approvedAt") and
                            stall_after(f) is not None and
                            stage_age_days(f, key) >= stall_after(f))
        pending_ko = {
            "approved": "승인 후 장기 대기" if approved_delayed else "진행 중 · 승인 · 머지 대기",
            "changes": "변경 요청 대응 중",
            "reviewing": "리뷰 진행 중",
            "waiting": "아직 아무도 안 봄",
            "stalled": "보류",
            "draft": "초안",
        }.get(key, "아직")
        pending_en = {
            "approved": "approved · long wait" if approved_delayed else "in progress · approved · awaiting merge",
            "changes": "changes requested",
            "reviewing": "in review",
            "waiting": "not reviewed yet",
            "stalled": "stalled",
            "draft": "draft",
        }.get(key, "pending")
        return (
            f'<span class="iship pending">'
            f'<span class="iship-step now"><a {pr_link}><time>{created_month}</time>'
            f'<span class="ko">PR 생성</span><span class="en">PR opened</span></a>{age_html}</span>'
            f'<span class="iship-step todo"><a {pr_link}>'
            f'<span class="ko">PR 머지 · {pending_ko}</span>'
            f'<span class="en">PR merge · {pending_en}</span></a></span>'
            f'<span class="iship-step todo"><span class="ko">릴리즈 · 머지 후</span>'
            f'<span class="en">release · after merge</span></span>'
            f'</span>'
        )
    release = f.get("release") or {}
    merged = f.get("mergedAt")
    if release.get("channel") == "pending" and created and merged:
        return (
            f'<span class="iship pending">'
            f'<span class="iship-step"><a {pr_link}><time>{created_month}</time>'
            f'<span class="ko">PR 생성</span><span class="en">PR opened</span></a>{age_html}</span>'
            f'<span class="iship-step now"><a {pr_link}><time>{month(merged)}</time>'
            f'<span class="ko">PR 머지 <b>#{f["pr"]}</b></span>'
            f'<span class="en">PR merged <b>#{f["pr"]}</b></span></a></span>'
            f'<span class="iship-step todo"><span class="ko">릴리즈 대기</span>'
            f'<span class="en">awaiting release</span></span></span>'
        )
    version, released, release_url = (release.get("version"),
                                      release.get("releasedAt"),
                                      release.get("url"))
    if not (created and merged and version and released and release_url):
        return ""
    merged_month, release_month = map(month, (merged, released))
    release_link = f'href="{release_url}" target="_blank" rel="noopener"'
    if release.get("channel") == "nightly":
        cls = "iship nightly"
        release_ko = 'nightly 배포 · 안정판 대기'
        release_en = 'nightly shipped · stable pending'
    elif release.get("channel") == "prerelease":
        cls = "iship nightly"
        release_ko = f'프리릴리즈 <b>{esc(version)}</b> · 안정판 대기'
        release_en = f'prerelease <b>{esc(version)}</b> · stable pending'
    else:
        cls = "iship"
        release_ko = f'릴리즈 <b>{esc(version)}</b>'
        release_en = f'released <b>{esc(version)}</b>'
    return (
        f'<span class="{cls}">'
        f'<span class="iship-step"><a {pr_link}><time>{created_month}</time>'
        f'<span class="ko">PR 생성</span><span class="en">PR opened</span></a>{age_html}</span>'
        f'<span class="iship-step"><a {pr_link}><time>{merged_month}</time>'
        f'<span class="ko">PR 머지 <b>#{f["pr"]}</b></span>'
        f'<span class="en">PR merged <b>#{f["pr"]}</b></span></a></span>'
        f'<span class="iship-step"><a {release_link}><time>{release_month}</time>'
        f'<span class="ko">{release_ko}</span><span class="en">{release_en}</span></a></span>'
        f'</span>'
    )


# 카드에 저장소 이름만 있으면 "novu 가 뭔데" 에서 읽기가 멈춘다. 한 줄 설명을 붙인다.
# GitHub description 을 그대로 쓰지 않는 이유: 마케팅 문구라 길고 자기소개다
# ("The world's most flexible commerce platform for agents and developers").
# 무엇을 하는 물건인지만 남긴다. 새 저장소는 여기 없으면 빈칸으로 나가고,
# --check 가 잡는다.
BLURB = {
    "Infisical/infisical": ("시크릿·인증서 관리 플랫폼", "secrets and certificate management platform"),
    "readest/readest": ("전자책 리더 앱", "ebook reader app"),
    "facebook/react": ("UI 라이브러리 · 컴파일러", "UI library and compiler"),
    "eslint/eslint": ("자바스크립트 린터", "JavaScript linter"),
    "angular/angular": ("웹 프레임워크", "web framework"),
    "mikro-orm/mikro-orm": ("TypeScript ORM", "TypeScript ORM"),
    "orval-labs/orval": ("OpenAPI 클라이언트 생성기", "OpenAPI client generator"),
    "BabylonJS/Babylon.js": ("웹 3D 엔진", "web 3D engine"),
    "CherryHQ/cherry-studio": ("데스크톱 AI 클라이언트", "desktop AI client"),
    "remix-run/react-router": ("React 라우터", "React router"),
    "mozilla/pdf.js": ("Mozilla 의 PDF 뷰어", "Mozilla PDF viewer"),
    "vercel/turborepo": ("Vercel 의 모노레포 빌드 도구", "Vercel monorepo build tool"),
    "cytoscape/cytoscape.js": ("그래프 시각화·분석 라이브러리", "graph visualization and analysis library"),
    "Kong/insomnia": ("API 클라이언트", "API client"),
    "TriliumNext/Trilium": ("계층형 개인 지식 노트", "hierarchical personal knowledge base"),
    "promptfoo/promptfoo": ("LLM 앱 평가·레드팀 도구", "LLM eval and red-teaming tool"),
    "labring/FastGPT": ("AI 에이전트·지식베이스 빌더", "AI agent and knowledge base builder"),
    "jupyterlab/jupyterlab": ("Jupyter 노트북 IDE", "Jupyter notebook IDE"),
    "compiler-explorer/compiler-explorer": ("godbolt 컴파일러 탐색기", "godbolt compiler explorer"),
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
    "grafana/grafana": ("관측·대시보드", "observability dashboards"),
    "baptisteArno/typebot.io": ("챗봇 빌더", "chatbot builder"),
    "typeorm/typeorm": ("TypeScript ORM", "TypeScript ORM"),
    "TryGhost/Ghost": ("퍼블리싱·뉴스레터", "publishing & newsletters"),
    "twentyhq/twenty": ("오픈소스 CRM", "open-source CRM"),
    "directus/directus": ("데이터 백엔드", "data backend"),
    "Budibase/budibase": ("사내 도구 빌더", "internal tools builder"),
    "excalidraw/excalidraw": ("화이트보드 · 손그림 다이어그램", "virtual whiteboard"),
    "storybookjs/storybook": ("UI 컴포넌트 개발·문서화", "UI component workshop"),
    "withastro/astro": ("웹 프레임워크 · 콘텐츠 사이트", "web framework"),
    "nrwl/nx": ("모노레포 빌드 시스템", "monorepo build system"),
    "openstatusHQ/openstatus": ("상태 페이지·업타임 모니터링", "status pages & uptime monitoring"),
    "rollup/rollup": ("JavaScript 모듈 번들러", "JavaScript module bundler"),
    "microsoft/vscode": ("코드 에디터", "code editor"),
    "pnpm/pnpm": ("JavaScript 패키지 매니저", "JavaScript package manager"),
    "Automattic/mongoose": ("MongoDB ODM", "MongoDB object modelling"),
    "tailwindlabs/tailwindcss": ("CSS 유틸리티 프레임워크", "utility-first CSS framework"),
}


def card(f, key, rank=None):
    ko, en, at, ended = META[key]
    url = f"https://github.com/{f['repo']}/pull/{f['pr']}"
    name, stars = split_label(f["repoLabel"])
    star_html = f'<span class="stars">{STAR}{stars}</span>' if stars else ""
    # 닫힌 건 트레일을 안 그린다 — 진행이 없으니 진행 표시도 없다.
    mark = "" if ended else trail(at)
    # 보류는 열려는 있지만 우리 쪽에서 손을 뗀 것이다. 살아 있는 카드와 같은 밝기로
    # 두면 목록을 훑을 때 "아직 진행 중"으로 읽히고, 그게 정확히 틀린 인상이다.
    # closed·stalled 는 필터가 잡는 손잡이이기도 하다(index.html 의 .ifilter).
    cls = ("ic" + (" done" if key == "merged" else "")
           + (" off" if ended or key == "stalled" else "")
           + (" closed" if ended else "")
           + (" stalled" if key == "stalled" else ""))
    rank_attr = f' data-rank="{rank:02d}"' if rank is not None else ""
    age_ko, age_en, on, age_days = elapsed(f, key)
    on_html = f'<span class="on">{on}</span>' if on else ""
    # 경과는 생성 시점의 값이라 그대로 두면 시간이 지날수록 거짓말이 된다 —
    # "오늘"이라고 적힌 일주일 된 PR 이 걸려 있게 된다. 기준 시각을 같이 심어
    # 읽는 시점에 다시 계산한다(index.html 의 .age[data-since] 루프).
    # 생성된 글자는 JS 가 막힌 환경의 폴백으로 남는다.
    since = f.get("createdAt") or ""
    until = f.get("mergedAt") or f.get("closedAt") or ""
    attrs = f' data-since="{since}"' + (f' data-until="{until}"' if until else "")
    timing = MERGE_TIMES.get(f["repo"], {})
    middle = timing.get("medianDays")
    sample = timing.get("mergedExternal", 0)
    # 기준선은 끝난 카드에도 붙인다. 처음엔 진행 중인 것에만 뒀는데, 그러면 "2일 만에
    # 머지"가 빠른 건지 평범한 건지 읽을 수가 없다 — vite 는 보통 하루에 머지하면서
    # 외부 PR 은 32%만 받는 곳이라, 같은 2일도 뜻이 다르다. 다만 색(초록·빨강·보라)은
    # 진행 중인 것에만 준다. 끝난 건 실제 결과가 이미 답이라 판정을 덧씌우지 않는다.
    avg_html = ""
    pace_cls = ""
    if middle is not None:
        # 반나절 만에 머지되는 저장소는 반올림하면 0일이 된다. 0 은 숫자가 빠진 것처럼
        # 읽히니 하한을 1일로 둔다 — 표기도, 보류 기준일도 같은 값을 쓴다.
        mid_days = max(1, int(middle + .5))
        done_card = key in ("merged", "closed")
        if not done_card:
            attrs += f' data-median-days="{mid_days}"'
            # 보류로 넘어갈 날짜도 같이 심는다 — 카드를 다시 생성하지 않아도 읽는 시점에
            # JS 가 상태 글자를 바꾼다. 경과와 같은 이유다(index.html 아래 .age 루프).
            if key in STALLABLE or key == "stalled":
                attrs += f' data-stall-days="{mid_days + STALL_GRACE_DAYS}"'
                stall_since = f.get("engagedAt") if key == "reviewing" else since
                if stall_since:
                    attrs += f' data-stall-since="{stall_since}"'
            pace_cls = (" pace-stall" if key == "stalled"
                        else " pace-late" if age_days > mid_days else " pace-ok")
        tip_ko = f"최근 닫힌 PR {timing.get('sampledClosed', 0)}건 중 외부 머지 {sample}건의 중앙값"
        tip_en = f"median of {sample} external merges among recent closed PRs"
        avg_html = (f'<span class="repoavg ko" title="{tip_ko}"> / 보통 {mid_days}일</span>'
                    f'<span class="repoavg en" title="{tip_en}"> / usually {mid_days}d</span>')
        # 늦는 데는 두 가지 이유가 있고 색만으로는 안 갈린다 — 우리 것만 밀린 건지,
        # 저 저장소가 원래 외부 PR 을 거의 안 받는 건지. 수락률을 같이 둔다.
        rate = timing.get("acceptancePct")
        if rate is not None:
            rate_tip_ko = (f"최근 닫힌 외부 PR {timing.get('closedExternal', 0)}건 중 "
                           f"{sample}건이 머지됐다")
            rate_tip_en = (f"{sample} of {timing.get('closedExternal', 0)} recently closed "
                           f"external PRs were merged")
            rate_cls = "rate low" if rate < 30 else "rate"
            avg_html += (f'<span class="{rate_cls} ko" title="{rate_tip_ko}">수락 {rate}%</span>'
                         f'<span class="{rate_cls} en" title="{rate_tip_en}">{rate}% merged</span>')
    if key == "merged":
        age_ko = f"머지까지 {age_days}일" if age_days >= 1 else "당일 머지"
        age_en = f"{age_days}d to merge" if age_days >= 1 else "merged same day"
    age_html = (f'<span class="age{pace_cls}"{attrs}><span class="ko">{age_ko}</span>'
                f'<span class="en">{age_en}</span>{avg_html}</span>') if age_ko else ""
    src = AVATAR.get(f["repo"])
    fav = f'<img class="ifav" src="{src}" alt="" width="15" height="15" loading="lazy">' if src else ""
    # 원래 영어인 제목은 그대로 둔다 — 한국어 화면에서도 코드 용어는 영어가 자연스럽다.
    # 한글이 섞인 것만 ko/en 으로 쪼갠다.
    ten = f.get("titleEn")
    title_html = (f'<span class="ko">{esc(f["title"])}</span>'
                  f'<span class="en">{esc(ten)}</span>') if ten else esc(f["title"])
    bk, be = BLURB.get(f["repo"], ("", ""))
    contributors = f'{CONTRIBUTORS[f["repo"]]:,}'
    what = (f'<span class="iw"><span class="ko">{esc(bk)} · 기여자 약 {contributors}명</span>'
            f'<span class="en">{esc(be)} · ~{contributors} contributors</span></span>')
    # 닫힌 카드는 사유를 그대로 싣는다. "닫힌 것도 같이 둔다"고만 적고 이유를 감추면
    # 남겨둔 의미가 없다 — 거절 사유가 이 목록에서 제일 정보량이 큰 줄이다.
    rk, re_ = f.get("closedReason", ""), f.get("closedReasonEn", "")
    why = (f'<span class="iwhy"><span class="ko">{esc(rk)}</span>'
           f'<span class="en">{esc(re_)}</span></span>') if ended and rk else ""
    shipped = delivery_timeline(f, key, url, age_html)
    # 머지된 PR 번호는 이제 아래 계보의 시작점이다. 상태 줄에도 남기면 같은 숫자가
    # 두 번 보여 위계가 흐려진다. 진행·닫힘 카드는 기존 위치를 유지한다.
    pr_number = "" if key == "merged" else f'<span class="prn">#{f["pr"]}</span>'
    status = (f'<span class="ist">{mark}'
              f'<span class="istate ko">{ko}</span><span class="istate en">{en}</span>'
              f'{on_html}{age_html}{pr_number}</span>') if not shipped else ""
    core = (
        f'{GH_MARK}'
        f'<b>{fav}{esc(name)}{star_html}</b>'
        f'{what}'
        f'<span class="it">{title_html}</span>'
        f'{status}'
    )
    if shipped:
        return (f'<article class="{cls}"{rank_attr}>'
                f'<a class="icmain" href="{url}" target="_blank" rel="noopener">{core}</a>'
                f'{shipped}</article>')
    return (f'<a class="{cls}"{rank_attr} href="{url}" target="_blank" rel="noopener">'
            f'{core}{why}</a>')


grouped = {k: [] for k in ORDER}
for f in findings:
    key = state_by_pr.get(str(f["pr"]), "waiting")
    if key in STALLABLE:
        limit, elapsed_days = stall_after(f), stage_age_days(f, key)
        if limit is not None and elapsed_days is not None and elapsed_days >= limit:
            key = "stalled"
    grouped[key].append(f)

entries = sorted(((f, k) for k in ORDER for f in grouped[k]),
                 key=lambda item: (0 if item[1] == "closed" else 1 if item[1] == "merged"
                                   else 3 if item[1] == "approved" else 2,
                                   item[0].get("createdAt", ""), item[0]["pr"]), reverse=True)
merged_oldest_first = sorted(grouped["merged"], key=lambda f: (f.get("createdAt", ""), f["pr"]))
rank_by_pr = {f["pr"]: rank for rank, f in enumerate(merged_oldest_first, 1)}
rows = "\n      ".join(card(f, k, rank_by_pr.get(f["pr"])) for f, k in entries)

# 머지된 저장소는 히어로에서 로고만 먼저 보여준다. 유명 로고를 장식처럼 빌려온 게
# 아니라 실제 PR이 들어간 곳이라는 뜻이므로, 각 로고는 해당 머지 PR 자체로 연결한다.
merged_contrib = [f for f in findings if state_by_pr.get(str(f["pr"])) == "merged"]
contrib_counts = Counter(f["repo"] for f in merged_contrib)
seen_contrib = set()
contrib = []
for f in merged_contrib:
    if f["repo"] in seen_contrib:
        continue
    seen_contrib.add(f["repo"])
    src = AVATAR.get(f["repo"])
    if not src:
        continue
    name, _stars = split_label(f["repoLabel"])
    url = f"https://github.com/{f['repo']}/pull/{f['pr']}"
    count = contrib_counts[f["repo"]]
    contribution = f"{count} merged contributions" if count > 1 else "merged contribution"
    badge = (f'<span class="contribcount" aria-hidden="true">×{count}</span>'
             if count > 1 else "")
    contrib.append(
        f'<a href="{url}" target="_blank" rel="noopener" '
        f'aria-label="{esc(name)} · {contribution}" '
        f'title="{esc(name)} · {contribution}">'
        f'<img src="{src}" alt="" width="25" height="25" loading="eager">{badge}</a>'
    )

h = open(f"{ROOT}/index.html", encoding="utf-8").read()
h = re.sub(r'(<time class="contrib-asof" datetime=")[^"]+(">)[^<]+(</time>)',
           lambda m: f'{m.group(1)}{CONTRIBUTORS_ASOF}{m.group(2)}{CONTRIBUTORS_ASOF}{m.group(3)}', h)
for marker, count in (("impact-repos", len({f["repo"] for f in grouped["merged"]})),
                      ("impact-merged", len(grouped["merged"]))):
    h, changed = re.subn(rf'(<b id="{marker}">)\d+(</b>)', rf'\g<1>{count}\g<2>', h, count=1)
    assert changed == 1, marker
m = re.search(r'(<div class="iwrap[^"]*">)(.*?)(\n    </div>)', h, re.S)
assert m
h = h[: m.start(2)] + "\n      " + rows + h[m.end(2):]
# 끝을 `</span>` 로 잡으면 안 된다 — 안에 있는 `<span class="contribcount">×2</span>` 가
# 먼저 걸려서 앞부분만 갈아끼우고 나머지가 남는다. 돌릴 때마다 로고가 불어나 히어로에
# 41개가 깔렸다. 주석 마커로 범위를 못박는다.
C_BEGIN, C_END = "<!--auto:contrib-->", "<!--/auto:contrib-->"
if C_BEGIN not in h or C_END not in h:
    print(f"  ✗ 히어로 로고 마커가 없다: {C_BEGIN}{C_END}")
    sys.exit(1)
h = re.sub(re.escape(C_BEGIN) + r".*?" + re.escape(C_END),
           C_BEGIN + "".join(contrib) + C_END, h, count=1, flags=re.S)


# 요약 줄(note)도 같은 출처에서 다시 만든다 — 카드만 갱신하면 이 줄이 조용히 낡는다(실제로 그랬다).
counts = {k: len(v) for k, v in grouped.items() if v}
# 필터 버튼의 개수 — JS 가 읽는 시점에 다시 세지만, 막힌 환경엔 이 숫자가 남는다.
for _kind in ("stalled", "closed"):
    for _id in (f"ifn-{_kind}", f"ifn-{_kind}-en"):
        h = re.sub(rf'(<b id="{_id}">)[^<]*(</b>)',
                   rf"\g<1>{len(grouped.get(_kind, []))}\g<2>", h, count=1)
ko_line = " · ".join(f"{META[k][0]} {n}" for k, n in counts.items())
en_line = " · ".join(f"{n} {META[k][1]}" for k, n in counts.items())
h = re.sub(
    r'(<p class="ko">)[^<]*?( — 전체 기록은 <a href="https://github\.com/m1kapp/fixearly/blob/main/IMPACT\.md">)',
    rf"\g<1>{ko_line}\g<2>", h, count=1)
h = re.sub(
    r'(<p class="en">)[^<]*?( — full log in <a href="https://github\.com/m1kapp/fixearly/blob/main/IMPACT\.md">)',
    rf"\g<1>{en_line}\g<2>", h, count=1)

# 중앙값을 쓰는 이유를 보여주는 next.js 예시도 같은 측정값에서 만든다. 요약 개수만
# 자동화했더니 이 숫자는 8/11 값(평균 91.9일 · 중앙 0.8일)에 그대로 멈춰 있었다.
_next = MERGE_TIMES.get("vercel/next.js", {})
_next_avg, _next_mid = _next.get("averageDays"), _next.get("medianDays")
if _next_avg is not None and _next_mid is not None:
    h = re.sub(r'next\.js 는 평균 [0-9.]+일인데 중앙값 [0-9.]+일',
               f'next.js 는 평균 {_next_avg:.1f}일인데 중앙값 {_next_mid:.1f}일', h, count=1)
    h = re.sub(r'next\.js averages [0-9.]+ days but its median is [0-9.]+',
               f'next.js averages {_next_avg:.1f} days but its median is {_next_mid:.1f}', h, count=1)

# 머지된 것들의 공통 형태와 걸린 기간 — 리드 문장도 손으로 쓰면 반드시 어긋난다.
# "같은 형태"라는 주장은 type 문자열이 실제로 그럴 때만 낸다. 아니면 개수·기간만.
_merged = [f for f in findings if state_by_pr.get(str(f["pr"])) == "merged" and f.get("mergedAt")]
if _merged:
    import datetime as _dt
    _p = lambda t: _dt.datetime.fromisoformat(t.replace("Z", "+00:00"))
    _d = sorted((_p(f["mergedAt"]) - _p(f["createdAt"])).days for f in _merged)
    _span_ko = f"{_d[0]}일" if _d[0] == _d[-1] else f"{_d[0]}~{_d[-1]}일"
    _span_en = f"{_d[0]} days" if _d[0] == _d[-1] else f"{_d[0]}–{_d[-1]} days"
    _n = len(_merged)
    if all(".find" in f["type"] and "Map" in f["type"] for f in _merged):
        _ko = (f"머지된 {_n}건은 형태가 같다 — 루프 안에서 배열을 <code>find</code> 로 훑던 걸 "
               f"Map 으로 바꾼 것. 셋 다 질문 없이 {_span_ko} 만에 들어갔다.")
        _en = (f"The {_n} merged PRs share one shape — an <code>Array.find</code> inside a loop, "
               f"replaced with a Map. All went in within {_span_en}, no questions asked.")
    else:
        _ko = f"머지된 {_n}건은 {_span_ko} 만에 들어갔다."
        _en = f"The {_n} merged PRs went in within {_span_en}."
    h = re.sub(r'(<span id="mshape-ko">).*?(</span>)', rf"\g<1>{_ko}\g<2>", h, count=1, flags=re.S)
    h = re.sub(r'(<span id="mshape-en">).*?(</span>)', rf"\g<1>{_en}\g<2>", h, count=1, flags=re.S)
    print("머지 형태 줄:", _ko)

# 규칙 목록 — 채점축과 머지 실적을 한 표로 녹인다. "규칙이 남에게 머지됐다"를 규칙 단위로 보여준다.
# type 접두어로 규칙을 가른다. 새 축이 머지됐는데 여기 없으면 조용히 빠지는 쪽이라, 모르는 접두어는 누락으로 센다.
# (types, 이름 ko, en, 태그 ko, en, 설명 ko, en, 채점 메모 ko, en)
RULES = [
    (("O(n²)", "O(n²) 배열 조회", "O(n²) 그룹핑/조회"), "O(n²) 조회", "O(n²) lookup", "채점 06", "scored 06",
     "행마다 다른 배열을 <code>.find</code>·<code>.some</code>·<code>.includes</code> 로 처음부터 훑는 자리. "
     "한 번 Map·Set 으로 색인해두면 조회가 O(1)이 된다 — 데이터가 커질수록 차이가 제곱으로 벌어진다.",
     "Each row rescans another array with <code>.find</code>/<code>.some</code>/<code>.includes</code>. "
     "Index it once into a Map/Set and each lookup is O(1) — the gap grows with the square of the data.",
     "테스트·프론트 구역, 정적 외곽, n 이 잘린 자리는 세지 않고 3곳 미만은 면제. 10k줄당 유예 1.0, 캡 5 — "
     "판정 난 초기 PR 6건 중 4건이 닫혀서, 오탐이 등급을 뒤집지 않게 낮게 잡았다.",
     "Test/frontend zones, static outers, and capped-n sites are excluded; under three sites is free. Free below 1.0 "
     "per 10k lines, capped at 5 — four of the first six decided PRs were closed, so a false positive must not flip a grade."),
    (("쓰기만 하는 컬렉션",), "쓰기만 하는 컬렉션", "Write-only collection", "진단", "diagnostic",
     "채우기만 하고 아무도 읽지 않는 Set·Map·배열. 소비하던 코드가 리팩터로 사라진 흔적이라 "
     "지워도 동작이 같고, 매번 채우는 비용만 사라진다. knip 은 <code>.add</code> 도 \"사용\"으로 봐서 못 잡는다.",
     "A Set, Map, or array that is filled but never read — what a refactor left behind. Removing it changes "
     "nothing but the cost of filling it. knip misses it because <code>.add</code> counts as a use.", "", ""),
    (("N+1", "독립 순차 await"), "불필요한 순차 I/O", "Needless sequential I/O", "채점 05", "scored 05",
     "루프 한 바퀴마다 DB·네트워크를 부르는 N+1, 그리고 서로의 결과를 쓰지 않는 <code>await</code> 를 줄 세우는 것. "
     "<code>IN (...)</code> 한 번이나 <code>Promise.all</code> 로 묶으면 왕복이 셈으로 줄어든다.",
     "A DB or network call per loop pass (N+1), and awaits that never use each other's result queued one by one. "
     "One <code>IN (...)</code> or a <code>Promise.all</code> cuts the round trips — provable by counting.",
     "같은 결함이라 한 축. 37곳 재측정에서 기존 점수와 rho=−0.18 로 독립이고 11곳(30%)에서 발동한다. "
     "3곳 미만은 안 센다(재시도·커서 페이지네이션은 순차가 맞다). 유예 3.0/1000파일, 캡 5.",
     "One defect, one axis. Across 37 re-measured repos it is independent of the score (rho=−0.18) and fires in 11 (30%). "
     "Under three sites is ignored — retries and cursor pagination are meant to be serial. Free below 3.0 per 1,000 files, capped at 5."),
    (("버려진 Promise",), "버려진 Promise", "Floating promise", "진단", "diagnostic",
     "async 함수를 <code>await</code> 없이 부르고 결과를 버린다. 실패해도 아무도 모르고, "
     "호출한 쪽은 끝나기 전에 다음 단계로 넘어간다.",
     "An async call with no <code>await</code> and nothing holding the result. Failures vanish, "
     "and the caller moves on before it finishes.", "", ""),
    (("버린 반환값",), "버린 반환값", "Discarded pure call", "진단", "diagnostic",
     "<code>s.replace(…)</code>·<code>arr.concat(…)</code> 를 부르고 결과를 대입하지 않는다. 문자열은 불변이라 "
     "그 줄은 아무것도 안 한다 — 지우려던 줄이 남고, 붙이려던 말이 빠진다.",
     "Calls <code>s.replace(…)</code> or <code>arr.concat(…)</code> and drops the result. Strings are immutable, "
     "so the line does nothing — what it meant to remove stays, what it meant to append is lost.", "", ""),
    (("전역 정규식 상태",), "전역 정규식 상태", "Stateful /g regex", "진단", "diagnostic",
     "<code>/g</code> 정규식을 공유한 채 루프에서 <code>.test()</code> 하면 <code>lastIndex</code> 가 "
     "다음 호출로 새어, 같은 입력에 참·거짓이 번갈아 나온다. 성능이 아니라 조용히 틀린 답이다.",
     "A shared <code>/g</code> regex used with <code>.test()</code> in a loop leaks <code>lastIndex</code> "
     "into the next call, so the same input flips between true and false. Not slow — silently wrong.", "", ""),
    ((), "함수 길이", "Function length", "채점 01", "scored 01",
     "한 번에 읽어야 하는 양. 중첩 함수·주석을 뺀 자기 코드 줄 기준, 40줄 초과(JSX 60줄) 비율. "
     "파일을 쪼개도 안 변한다 — 그래서 조작이 안 된다.",
     "How much you must read at once — a function's own code lines, nested functions and comments removed. "
     "Splitting files doesn't move it, so it can't be gamed.", "", ""),
    ((), "인지 복잡도", "Cognitive complexity", "채점 02", "scored 02",
     "함수를 머리로 따라가는 부담. SonarSource <code>S3776</code> 스펙과 정본값까지 일치 검증.",
     "How hard a function is to follow. Matches SonarSource <code>S3776</code>, verified to canonical values.", "", ""),
    ((), "중복", "Duplication", "채점 03", "scored 03",
     "토큰 단위 복사·붙여넣기 밀도. 74개 실측에서 점수와 상관 −0.11이라 비중을 16→9로 줄였다 — "
     "대부분에겐 0점, 소수에게만 큰 항목이다.",
     "Token-level copy-paste density. Correlates −0.11 with score across 74 repos, so its cap was cut 16 → 9: "
     "zero for most, heavy for a few.", "", ""),
    ((), "파일 크기", "File size", "채점 04", "scored 04",
     "평균 줄 수 + 대형 파일 비중. 보조 항으로 강등(27→8) — 같은 코드를 6파일로 쪼개기만 해도 옛 공식은 +27점을 줬다. "
     "함수 길이와 상관 +0.16이라 버리진 않았다.",
     "Average lines + oversized-file share, demoted to a minor term (27 → 8): splitting identical code into six files "
     "used to gain +27. Kept, because it correlates only +0.16 with function length.", "", ""),
]


def _star_num(v):
    if not v:
        return 0
    v = v.replace(",", "")
    return float(v[:-1]) * 1000 if v.endswith("k") else float(v)


_by_rule = {i: [] for i in range(len(RULES))}
unmapped = []
for f in sorted(findings, key=lambda f: f.get("mergedAt") or ""):
    if state_by_pr.get(str(f["pr"])) != "merged":
        continue
    prefix = f["type"].split(" (")[0]
    i = next((i for i, r in enumerate(RULES) if prefix in r[0]), None)
    if i is None:
        unmapped.append(f"#{f['pr']} {prefix}")
    else:
        _by_rule[i].append(f)
_rows = []
# 머지가 많은 규칙부터, 머지 없는 채점축은 원래 번호 순으로 뒤에.
for i in sorted(_by_rule, key=lambda i: (-len(_by_rule[i]), i)):
    _, ko, en, tko, ten, dko, den, nko, nen = RULES[i]
    _seen = {}
    for f in _by_rule[i]:
        _seen.setdefault(f["repo"], []).append(f)
    _chips = []
    for repo, fs in sorted(_seen.items(), key=lambda kv: -_star_num(split_label(kv[1][-1]["repoLabel"])[1])):
        name, stars = split_label(fs[-1]["repoLabel"])
        src = AVATAR.get(repo)
        fav = f'<img src="{src}" alt="" width="18" height="18" loading="lazy">' if src else ""
        many = f'<i>×{len(fs)}</i>' if len(fs) > 1 else ""
        star = f'<small>{STAR}{stars}</small>' if stars else ""
        _chips.append(f'<a href="https://github.com/{repo}/pull/{fs[0]["pr"]}" target="_blank" rel="noopener"'
                      f' title="{esc(repo)} · {", ".join("#" + str(x["pr"]) for x in fs)}">{fav}'
                      f'<span class="cn"><b>{esc(name)}</b>{star}</span>{many}</a>')
    n = len(_by_rule[i])
    merged = (f'<span class="axk"><span class="ko">머지 {n}건</span><span class="en">{n} merged</span></span>'
              if n else "")
    note = (f'<p class="axs"><span class="ko">{nko}</span><span class="en">{nen}</span></p>' if nko else "")
    chips = f'<div class="axc">{"".join(_chips)}</div>' if _chips else ""
    _rows.append(f'<div class="axr"><div class="axn"><b><span class="ko">{ko}</span><span class="en">{en}</span></b>'
                 f'<span class="axt"><span class="ko">{tko}</span><span class="en">{ten}</span></span>{merged}</div>'
                 f'<p><span class="ko">{dko}</span><span class="en">{den}</span></p>{note}{chips}</div>')
_total = sum(len(v) for v in _by_rule.values())
_nmerged = sum(1 for v in _by_rule.values() if v)
_head = (f'<div class="axh"><span class="ko">규칙 {len(RULES)}개<small>{_nmerged}개가 남의 저장소에 머지됨 · {_total}건</small></span>'
         f'<span class="en">{len(RULES)} rules<small>{_nmerged} merged upstream · {_total} PRs</small></span></div>')
A_BEGIN, A_END = "<!--auto:axmerged-->", "<!--/auto:axmerged-->"
assert A_BEGIN in h and A_END in h, "규칙 목록 마커가 없다"
h = re.sub(re.escape(A_BEGIN) + r".*?" + re.escape(A_END), lambda m: A_BEGIN + _head + "".join(_rows) + A_END,
           h, count=1, flags=re.S)
for u in unmapped:
    print(f"  ✗ 축을 모르는 머지(update-impact-cards.py 의 RULES): {u}")

# 히어로 루프 카드 — 랜딩 첫 화면이 등급이 아니라 "찾고 → 거르고 → 내고 → 판정"을 보여준다.
# 오탐 가드 수는 엔진에 박힌 [FP:…] 태그의 종류 수다. 가드는 손검증에서 떨어진 오탐이 엔진으로 돌아간 흔적이다.
_st = [f.get("status") for f in findings]
_lm, _lc = _st.count("merged"), _st.count("closed")
_lo = len(_st) - _lm - _lc
_fp = len(set(re.findall(r"\[FP:[a-z0-9-]+\]", open(f"{ROOT}/bin/fixearly.mjs", encoding="utf-8").read())))
_lr = len({f["repo"] for f in findings if f.get("status") == "merged"})
# 구조 채점축(함수 길이·복잡도·중복·파일 크기)은 PR 로 내지 않는다 — PR 을 낼 수 있는 규칙만 센다.
_rp = sum(1 for r in RULES if r[0])
def _chip(pos, n, ko, en, val=""):
    v = f"<b>{val}</b>" if val != "" else ""
    return (f'<span class="lc {pos}"><i class="lpn">{n}</i><span class="ko">{ko}</span><span class="en">{en}</span>{v}</span>')
# 가운데 도넛 — 머지 수를 찾아낸 규칙별로 가른다. 조각 색은 머지 많은 순서로 고정 팔레트에서 꺼낸다.
_DONUT_COLORS = ["#2563eb", "#0f7a63", "#60a5fa", "#d97706", "#7c8899", "#a78bfa"]
_seg = sorted(((len(v), RULES[i][1], RULES[i][2]) for i, v in _by_rule.items() if v), key=lambda t: -t[0])
_C, _gap, _off, _arcs, _legend_ko, _legend_en = 2 * 3.14159265 * 60, 3, 0.0, [], [], []
for _k, (_n, _ko, _en) in enumerate(_seg):
    _len = _C * _n / max(_lm, 1)
    _col = _DONUT_COLORS[_k % len(_DONUT_COLORS)]
    _arcs.append(f'<circle r="60" cx="70" cy="70" stroke="{_col}" stroke-dasharray="{max(_len - _gap, 1):.2f} {_C:.2f}" '
                 f'stroke-dashoffset="{-_off:.2f}" style="--d:{_k * .12:.2f}s"><title>{_ko} {_n}</title></circle>')
    _legend_ko.append(f'<i style="background:{_col}"></i>{_ko} {_n}')
    _legend_en.append(f'<i style="background:{_col}"></i>{_en} {_n}')
    _off += _len
_donut = (
    f'<div class="lcen"><svg viewBox="0 0 140 140" aria-hidden="true"><circle r="60" cx="70" cy="70" class="trk"/>{"".join(_arcs)}</svg>'
    f'<div class="lnum"><b>{_lm}</b><span class="ko">PR 머지됨</span><span class="en">PRs merged</span>'
    f'<em><span class="ko">규칙 {len(_seg)}개가 찾아냄</span><span class="en">found by {len(_seg)} rules</span></em></div></div>'
)
_legend = (f'<span class="lleg"><span class="ko">{"".join(f"<span>{x}</span>" for x in _legend_ko)}</span>'
           f'<span class="en">{"".join(f"<span>{x}</span>" for x in _legend_en)}</span></span>')
_loop = (
    '<img src="loop.jpg" width="900" height="900" alt="" loading="eager">'
    + _chip("c1", 1, "배운다 · 고칠 규칙", "Learn · fix rules", _rp)
    + _chip("c2", 2, "고친다 · PR", "Fix · PRs", len(_st))
    + _chip("c3", 3, "판정 · 머지", "Verdict · merged", _lm)
    + _chip("c4", 4, "다진다 · 오탐 가드", "Sharpen · FP guards", _fp)
    + _donut
    + f'<p class="lcap">{_legend}<span class="ko">남의 저장소에서 머지된 PR 과 남의 코드에서 고칠 규칙을 뽑고, 그 규칙으로 다른 저장소를 고쳐 PR 을 낸다. 머지·거절이 다시 규칙을 다듬는다 — 규칙 {_rp}개 중 {_nmerged}개가 머지로 검증 · 저장소 {_lr}곳 · 거절 {_lc} · 대기 {_lo}. </span>'
      f'<span class="en">Fix rules come from PRs strangers merged and from strangers\' code; we apply them to other repos as PRs, and merges and rejections sharpen them again — {_nmerged} of {_rp} rules verified by a merge · {_lr} projects · closed {_lc} · open {_lo}. </span>'
      '<a href="#impact"><span class="ko">전체 기록 →</span><span class="en">Full record →</span></a></p>'
)
L_BEGIN, L_END = "<!--auto:loop-->", "<!--/auto:loop-->"
assert L_BEGIN in h and L_END in h, "히어로 루프 마커가 없다"
h = re.sub(re.escape(L_BEGIN) + r".*?" + re.escape(L_END), lambda m: L_BEGIN + _loop + L_END, h, count=1, flags=re.S)

# 새 저장소에 한 줄 설명을 안 붙이면 카드에 이름만 남는다 — 조용히 비는 쪽이라 검사한다.
notranslated = sorted(f["title"] for f in findings
                      if re.search(r"[가-힣]", f["title"]) and not f.get("titleEn"))
for t in notranslated:
    print(f"  ✗ 영어 제목 없음(impact.json 의 titleEn): {t}")

repos = {f["repo"] for f in findings}
missing = sorted(repos - set(BLURB))
noicon = sorted(repos - set(AVATAR))
nocount = sorted(repos - set(CONTRIBUTORS))
for r in missing:
    print(f"  ✗ BLURB 없음: {r}")
for r in noicon:
    print(f"  ✗ 아이콘 없음(python3 tools/fetch-repo-avatars.py): {r}")
for r in nocount:
    print(f"  ✗ 기여자 수 없음(npm run contributors): {r}")
# 닫힌 건 사유가 없으면 카드가 조용히 "닫힘"만 남는다 — 그게 제일 읽히는 줄인데.
noreason = sorted(f"#{f['pr']}" for f in findings
                  if state_by_pr.get(str(f["pr"])) == "closed"
                  and not (f.get("closedReason") and f.get("closedReasonEn")))
for r in noreason:
    print(f"  ✗ 닫힌 사유 없음(impact.json 의 closedReason/closedReasonEn): {r}")
missing = missing + noicon + nocount + notranslated + noreason + unmapped
missing_release = sorted(f"#{f['pr']}" for f in findings
                         if state_by_pr.get(str(f["pr"])) == "merged"
                         and f.get("release", {}).get("channel") != "pending"
                         and not (f.get("release", {}).get("channel") in ("stable", "nightly", "prerelease")
                                  and f.get("release", {}).get("version")
                                  and f.get("release", {}).get("releasedAt")
                                  and f.get("release", {}).get("url")))
for r in missing_release:
    print(f"  ✗ 릴리즈 계보 없음(impact.json 의 release): {r}")
missing += missing_release
missing_times = sorted(f["repo"] for f in findings
                       if f.get("status") not in ("merged", "closed")
                       and f["repo"] not in MERGE_TIMES)
for r in missing_times:
    print(f"  ✗ 중앙 머지시간 없음(python3 tools/update-repo-merge-times.py): {r}")
missing += missing_times

if "--check" in sys.argv:
    # 설명 커버리지만 보던 검사다. 그래서 **랜딩이 낡아도 통과했다** — 2026-08-11 에
    # astro#17665 과 nx#36633 을 낸 뒤에도 index.html 은 이틀 전 상태 그대로였고
    # npm test 는 초록이었다. 파는 페이지가 조용히 뒤처지는 게 제일 나쁘다.
    # 이제 생성 결과와 실제 파일을 그대로 비교한다.
    current = open(f"{ROOT}/index.html", encoding="utf-8").read()
    outdated = current != h
    if outdated:
        print("  ✗ index.html 이 impact.json 과 다르다 — npm run cards")
    print(f"{'설명 누락 ' + str(len(missing)) + '곳' if missing else '카드 설명이 저장소 전부를 덮는다'}"
          f" ({len(findings)}건 / {len({f['repo'] for f in findings})}곳)")
    sys.exit(1 if (missing or outdated) else 0)

open(f"{ROOT}/index.html", "w", encoding="utf-8").write(h)
print("카드 개편:", counts)
print("요약 줄:", ko_line)
