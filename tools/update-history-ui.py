#!/usr/bin/env python3
"""
update-history-ui — 점수 변경 이력을 랜딩에 노출한다.

이 도구는 "규칙이 다른 점수를 나란히 놓으면 진행도가 거짓말을 한다"를 신뢰 근거로
내세운다. 그런데 랜딩은 현재 규칙의 점수만 보여줬다. 하루에 v11 → v12 로 두 번
재발행하면서 20~30곳이 움직였는데, 읽는 사람은 어제 본 등급이 왜 다른지 알 방법이
없었다 — 규칙 버전은 밝히면서 **무엇이 바뀌어서 그랬는지**는 안 보여줬다.

두 곳에 넣는다:
  ① 보드 각 행 상세에 그 저장소의 궤적 (v7 72 → v11 61 → v12 61)
  ② 보드 아래에 규칙 판별 변경 사유

보드에 표현이 두 벌인 문제는 여기서도 같다 — JS 가 그리는 상세(사람이 보는 쪽)와
정적 <details> 폴백. 둘 다 넣는다.

사용: python3 tools/update-history-ui.py [--check]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK = "--check" in sys.argv

hist = json.load(open(f"{ROOT}/data/score-history.json", encoding="utf-8"))
html = open(f"{ROOT}/index.html", encoding="utf-8").read()
cur = json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8"))["version"]
problems, edits = [], 0

# ── ① DATA 에 궤적을 실어 보낸다 (JS 상세가 이걸 읽는다) ────────────────────
m = re.search(r"const DATA = (\[.*?\]);\n", html, re.S)
if not m:
    problems.append("const DATA 를 못 찾음")
else:
    rows = json.loads(m.group(1))
    changed = 0
    for r in rows:
        track = hist["repos"].get(r["name"])
        # 현재 판과 값이 같은 판이 하나뿐이면 보여줄 이야기가 없다
        want = [[t["version"], t["score"]] for t in track] if track else None
        if want and len({s for _, s in want}) == 1:
            want = None
        if r.get("hist") != want:
            if want is None:
                r.pop("hist", None)
            else:
                r["hist"] = want
            changed += 1
    if changed:
        edits += 1
        if not CHECK:
            html = html[: m.start(1)] + json.dumps(rows, ensure_ascii=False) + html[m.end(1):]
        problems.append(f"DATA 궤적 {changed}곳 갱신 필요") if CHECK else None

# ── ② JS 상세 렌더에 궤적 줄을 넣는다 ──────────────────────────────────────
# 이미 들어가 있으면 아무것도 하지 않는다. 한 번 넣고 나면 .dg 앞이 바뀌므로
# 앵커로 다시 찾으려 하면 "못 찾음"이 뜬다 — 그건 문제가 아니라 이미 된 상태다.
if 'r.hist?`<div class="hist">' not in html:
    m2 = re.search(r'(`<div class="dg">)', html)
    if not m2:
        problems.append("JS 상세의 진단 줄(.dg)을 못 찾음")
    else:
        snippet = ('`${r.hist?`<div class="hist"><span class="ko">채점 규칙이 바뀐 이력</span>'
                   '<span class="en">score across rulesets</span> — ${r.hist.map(([v,s],i)=>'
                   '`<b>${v}</b> ${s}`).join(\' <span class="ar">→</span> \')}</div>`:\'\'}'
                   '<div class="dg">')
        html = html[: m2.start(1)] + "`" + snippet[1:] + html[m2.end(1):]
        edits += 1

# ── ③ 스타일 ──────────────────────────────────────────────────────────────
if ".hist{" not in html:
    css = ("\n.hist{margin-top:10px;font-family:var(--font-mono);font-size:11.5px;"
           "color:var(--ink-3);display:flex;align-items:center;gap:6px;flex-wrap:wrap}"
           "\n.hist b{color:var(--ink-2);font-weight:700}"
           "\n.hist .ar{opacity:.5}")
    i = html.rindex("</style>")
    html = html[:i] + css + "\n" + html[i:]
    edits += 1

# ── ④ 보드 아래에 규칙 판별 변경 사유 ──────────────────────────────────────
# 처음엔 "없으면 넣는다"였는데, 그러면 판이 하나 늘어도 랜딩은 옛 목록 그대로다.
# 매번 다시 만들고 --check 가 어긋남을 잡는다.
RS_BEGIN = "<!-- auto:rulesets — tools/update-history-ui.py 가 생성한다. 손으로 고치지 마라. -->"
RS_END = "<!-- /auto:rulesets -->"


def rs_row(r, cls=""):
    return (f'<div class="rs-row{cls}"><span class="rs-v">{r["version"]}</span>'
            f'<span class="rs-d">{r["date"]} · {r["n"]}곳</span>'
            f'<span class="rs-w">{r["changed"]}</span></div>')


# 처음 온 사람이 읽어야 할 건 "지금 자가 뭔가" 하나다. 지난 판은 접어 둔다 —
# 지우지는 않는다. 소급해서 안 고친다는 증거가 그 목록이다.
_now = [r for r in hist["rulesets"] if r["version"] == cur]
_old = list(reversed([r for r in hist["rulesets"] if r["version"] != cur]))
if not _now:
    problems.append(f"현재 판({cur})이 score-history.json 의 rulesets 에 없음")
rows = "".join(rs_row(r, " rs-now") for r in _now)
if _old:
    _vs = " · ".join(r["version"] for r in _old)
    rows += ('<details class="rs-old"><summary>'
             f'<span class="ko">지난 판 {len(_old)}개 — {_vs}</span>'
             f'<span class="en">{len(_old)} earlier rulesets — {_vs}</span></summary>'
             + "".join(rs_row(r) for r in _old) + '</details>')
inner = (
    RS_BEGIN
    + '<div class="rs-h"><span class="ko">보드에 발행된 채점 판</span>'
    '<span class="en">published rulesets</span></div>'
    '<div class="note"><p class="ko">규칙이 다르면 점수를 나란히 놓을 수 없다. '
    '아래는 <b>무엇이 바뀌어서 점수가 움직였는지</b>이지, 저장소가 좋아졌다·나빠졌다는 뜻이 아니다. '
    '보드를 다시 발행한 판만 싣는다 — 발행 없이 지나간 판은 아무도 그 점수를 본 적이 없다. '
    f'현재 판은 <b>{cur}</b>다.</p>'
    '<p class="en">Scores from different rulesets are not comparable. This lists '
    '<b>what changed in the ruler</b>, not whether a project improved. Only rulesets the '
    'board was republished under are listed — the board is on '
    f'<b>{cur}</b>.</p></div>'
    + rows + RS_END)
section = f'<div class="rulesets" id="rulesets">{inner}</div>'

m3 = re.search(r'(</div>\s*</section>\s*<section class="step" id="axes">)', html)
if 'id="rulesets"' in html:
    a = html.index('<div class="rulesets" id="rulesets">')
    if not m3:
        problems.append("보드 섹션 끝을 못 찾음")
    elif html[a:m3.start(1)] != section:
        edits += 1
        if not CHECK:
            html = html[:a] + section + html[m3.start(1):]
elif not m3:
    problems.append("보드 섹션 끝을 못 찾음")
else:
    # 섹션은 .w(폭 제한) 를 닫는 </div> **앞**에 넣는다. 뒤에 넣으면 폭 제한을
    # 벗어나 본문이 오른쪽으로 흘러넘친다 — 실제로 그렇게 나갔다.
    html = html[: m3.start(1)] + section + "</div>" + html[m3.start(1) + len("</div>"):]
    edits += 1
if ".rulesets{" not in html:
    css = ("\n.rulesets{margin-top:var(--space-lg)}"
           "\n.rs-h{font-family:var(--font-mono);font-size:11px;letter-spacing:.06em;"
           "text-transform:uppercase;font-weight:700;color:var(--ink-3);margin-bottom:8px}"
           "\n.rs-row{display:grid;grid-template-columns:52px 132px 1fr;gap:10px;padding:9px 0;"
           "border-top:1px solid var(--line);font-size:13px;line-height:1.55}"
           "\n.rs-v{font-family:var(--font-mono);font-weight:700;color:var(--accent)}"
           "\n.rs-d{font-family:var(--font-mono);font-size:11.5px;color:var(--ink-3)}"
           "\n.rs-w{color:var(--ink-2)}"
           "\n@media(max-width:640px){.rs-row{grid-template-columns:1fr;gap:2px}}")
    i = html.rindex("</style>")
    html = html[:i] + css + "\n" + html[i:]
    edits += 1
if ".rs-old" not in html:
    css = ("\n.rs-now .rs-v{font-size:14px}"
           "\n.rs-old{border-top:1px solid var(--line)}"
           "\n.rs-old>summary{list-style:none;cursor:pointer;padding:10px 0;font-size:12.5px;"
           "color:var(--ink-3);display:flex;align-items:center;gap:7px;min-height:34px}"
           "\n.rs-old>summary::-webkit-details-marker{display:none}"
           "\n.rs-old>summary::before{content:'▸';font-family:var(--font-mono);font-size:10px;"
           "color:var(--ink-3);transition:transform var(--dur) var(--ease-out)}"
           "\n.rs-old[open]>summary::before{transform:rotate(90deg);color:var(--accent)}"
           "\n.rs-old>summary:hover{color:var(--accent)}"
           "\n.rs-old .rs-row:first-of-type{border-top:0}")
    i = html.rindex("</style>")
    html = html[:i] + css + "\n" + html[i:]
    edits += 1


# ── ⑤ 정적 <details> 폴백에도 같은 줄 (JS 막힌 환경) ───────────────────────
def hist_line(name):
    t = hist["repos"].get(name)
    if not t or len({x["score"] for x in t}) == 1:
        return ""
    body = ' <span class="ar">→</span> '.join(f'<b>{x["version"]}</b> {x["score"]}' for x in t)
    return ('<div class="hist"><span class="ko">채점 규칙이 바뀐 이력</span>'
            f'<span class="en">score across rulesets</span> — {body}</div>')


def fix_static(html):
    at = html.index('class="board"')
    out, pos, n = [], 0, 0
    for m in re.finditer(r'<details class="rw">.*?</details>', html[at:], re.S):
        a, b = at + m.start(), at + m.end()
        blk = m.group(0)
        nm = re.search(r'<span class="rn">([^<]+)', blk)
        if nm:
            want = hist_line(nm.group(1))
            cur_line = re.search(r'<div class="hist">.*?</div>', blk, re.S)
            have = cur_line.group(0) if cur_line else ""
            if have != want:
                if have:
                    blk = blk.replace(have, "", 1)
                if want:
                    blk = blk.replace('<div class="dg">', want + '<div class="dg">', 1)
                n += 1
        out.append(html[pos:a] + blk)
        pos = b
    out.append(html[pos:])
    return "".join(out), n


html, static_n = fix_static(html)
if static_n:
    edits += 1

if problems:
    for p in problems:
        print(f"  · {p}")
if CHECK:
    print(f"{'갱신 필요 ' + str(edits) + '건' if edits else '점수 이력이 최신이다'}")
    sys.exit(1 if edits else 0)
if edits:
    open(f"{ROOT}/index.html", "w", encoding="utf-8").write(html)
print(f"갱신 {edits}건 (정적 {static_n}곳) · 규칙 {len(hist['rulesets'])}판")
