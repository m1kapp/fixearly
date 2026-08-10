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
from collections import Counter

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
findings = json.load(open(f"{ROOT}/impact.json", encoding="utf-8"))["findings"]
# 저장소 아이콘은 data URI 로 박는다 — 랜딩은 외부 리소스가 0개다.
# tools/fetch-repo-avatars.py 가 만든다.
_av = f"{ROOT}/data/repo-avatars.json"
AVATAR = json.load(open(_av, encoding="utf-8")) if os.path.exists(_av) else {}
_mt = f"{ROOT}/data/repo-merge-times.json"
MERGE_TIMES = json.load(open(_mt, encoding="utf-8")).get("repos", {}) if os.path.exists(_mt) else {}
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

GH_MARK = ('<svg class="gh" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'
           '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>')

STAR = ('<svg class="st" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">'
        '<path d="M8 .25l2.06 4.55 4.94.53-3.68 3.33 1.02 4.87L8 11.1l-4.34 2.43 1.02-4.87L1 5.33l4.94-.53z"/></svg>')



def elapsed(f, key):
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
    import datetime as _d
    born = f.get("createdAt")
    if not born:
        return ("", "", "", None)
    parse = lambda t: _d.datetime.fromisoformat(t.replace("Z", "+00:00"))
    start = parse(born)
    merged = f.get("mergedAt")
    done = merged or f.get("closedAt")
    end = parse(done) if done else _d.datetime.now(_d.timezone.utc)
    days = (end - start).days
    # 머지월만 적는다. 닫힌 건 굳이 날짜를 새기지 않는다.
    on = f"'{parse(merged):%y}.{parse(merged).month}" if merged else ""
    if done:
        return ((f"{days}일 만에", f"in {days}d", on, days) if days >= 1
                else ("당일", "same day", on, days))
    return ((f"{days}일째", f"day {days}", "", days) if days >= 1
            else ("오늘", "today", "", days))


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
    "excalidraw/excalidraw": ("화이트보드 · 손그림 다이어그램", "virtual whiteboard"),
    "storybookjs/storybook": ("UI 컴포넌트 개발·문서화", "UI component workshop"),
}


def card(f, key):
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
    what = (f'<span class="iw"><span class="ko">{esc(bk)}</span>'
            f'<span class="en">{esc(be)}</span></span>') if bk else ""
    # 닫힌 카드는 사유를 그대로 싣는다. "닫힌 것도 같이 둔다"고만 적고 이유를 감추면
    # 남겨둔 의미가 없다 — 거절 사유가 이 목록에서 제일 정보량이 큰 줄이다.
    rk, re_ = f.get("closedReason", ""), f.get("closedReasonEn", "")
    why = (f'<span class="iwhy"><span class="ko">{esc(rk)}</span>'
           f'<span class="en">{esc(re_)}</span></span>') if ended and rk else ""
    return (
        f'<a class="{cls}" href="{url}" target="_blank" rel="noopener">'
        f'{GH_MARK}'
        f'<b>{fav}{esc(name)}{star_html}</b>'
        f'{what}'
        f'<span class="it">{title_html}</span>'
        f'<span class="ist">{mark}'
        f'<span class="istate ko">{ko}</span><span class="istate en">{en}</span>'
        f'{on_html}{age_html}'
        f'<span class="prn">#{f["pr"]}</span></span>'
        f'{why}</a>'
    )


grouped = {k: [] for k in ORDER}
for f in findings:
    key = state_by_pr.get(str(f["pr"]), "waiting")
    if key in STALLABLE:
        limit, elapsed_days = stall_after(f), elapsed(f, key)[3]
        if limit is not None and elapsed_days is not None and elapsed_days >= limit:
            key = "stalled"
    grouped[key].append(f)

rows = "\n      ".join(card(f, k) for k in ORDER for f in grouped[k])

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

# 새 저장소에 한 줄 설명을 안 붙이면 카드에 이름만 남는다 — 조용히 비는 쪽이라 검사한다.
notranslated = sorted(f["title"] for f in findings
                      if re.search(r"[가-힣]", f["title"]) and not f.get("titleEn"))
for t in notranslated:
    print(f"  ✗ 영어 제목 없음(impact.json 의 titleEn): {t}")

repos = {f["repo"] for f in findings}
missing = sorted(repos - set(BLURB))
noicon = sorted(repos - set(AVATAR))
for r in missing:
    print(f"  ✗ BLURB 없음: {r}")
for r in noicon:
    print(f"  ✗ 아이콘 없음(python3 tools/fetch-repo-avatars.py): {r}")
# 닫힌 건 사유가 없으면 카드가 조용히 "닫힘"만 남는다 — 그게 제일 읽히는 줄인데.
noreason = sorted(f"#{f['pr']}" for f in findings
                  if state_by_pr.get(str(f["pr"])) == "closed"
                  and not (f.get("closedReason") and f.get("closedReasonEn")))
for r in noreason:
    print(f"  ✗ 닫힌 사유 없음(impact.json 의 closedReason/closedReasonEn): {r}")
missing = missing + noicon + notranslated + noreason
missing_times = sorted(f["repo"] for f in findings
                       if f.get("status") not in ("merged", "closed")
                       and f["repo"] not in MERGE_TIMES)
for r in missing_times:
    print(f"  ✗ 중앙 머지시간 없음(python3 tools/update-repo-merge-times.py): {r}")
missing += missing_times

if "--check" in sys.argv:
    print(f"{'설명 누락 ' + str(len(missing)) + '곳' if missing else '카드 설명이 저장소 전부를 덮는다'}"
          f" ({len(findings)}건 / {len({f['repo'] for f in findings})}곳)")
    sys.exit(1 if missing else 0)

open(f"{ROOT}/index.html", "w", encoding="utf-8").write(h)
print("카드 개편:", counts)
print("요약 줄:", ko_line)
