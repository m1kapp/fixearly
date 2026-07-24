#!/usr/bin/env python3
# Board maintenance: regenerate the leaderboard <tbody> from measured results.
# 1) tools/remeasure-board.sh clones each repo in board-repos.json at branch HEAD,
#    runs bin/cleanscore.mjs, and writes raw metrics per repo.
# 2) this script maps metrics->cells (documented heatmap model) and re-ranks by score.
# Paths default to /private/tmp/board (override in the scripts if needed).
"""Regenerate the leaderboard <tbody> from /private/tmp/board/results/*.json.

Heatmap model (documented): each colored metric maps a value to an opacity in
[0.05, 0.47] by distance from an ideal band. Green rgb(18,145,90) on the good
side of a threshold, red rgb(203,68,54) past it. 'files'/'loc' are context-only
(no color). Rows are re-ranked by score desc.
"""
import json, glob, re, os

GREEN = (18, 145, 90)
RED = (203, 68, 54)
CAP = 0.47
FLOOR = 0.05

def ramp(dist, span):
    """dist>=0 from the knee, over `span` reaches CAP. Clamp [FLOOR, CAP]."""
    op = FLOOR + (CAP - FLOOR) * min(1.0, max(0.0, dist / span))
    return round(op, 2)

def color_high(v, thresh, span):
    # good = high (score). green when v>=thresh.
    if v >= thresh:
        return GREEN, ramp(v - thresh, span)
    return RED, ramp(thresh - v, span)

def color_low(v, knee, thresh, gspan, rspan):
    # good = low. full green below knee; fade to FLOOR at thresh; red beyond.
    if v <= thresh:
        # green, fades as v rises from knee->thresh
        d = max(0.0, v - knee)
        op = round(CAP - (CAP - FLOOR) * min(1.0, d / gspan), 2)
        return GREEN, max(FLOOR, op)
    return RED, ramp(v - thresh, rspan)

def cell_num(val_str, rgb, op, ctx=False):
    if ctx:
        return f'<td class="num ctx">{val_str}</td>'
    return f'<td class="num" style="background:rgba({rgb[0]},{rgb[1]},{rgb[2]},{op})">{val_str}</td>'

def grade_class(g):
    return {"A+": "gA", "A": "gA", "B": "gB", "C": "gC", "D": "gD"}.get(g, "gC")

def fmt_int(n):
    return f"{n:,}"

def dup_str(v):
    # match style: integer if whole, else 1 decimal, with %
    if abs(v - round(v)) < 1e-9:
        return f"{int(round(v))}%"
    return f"{v:.1f}%"

def row_html(d):
    score, grade = d["score"], d["grade"]
    dup = d["dup"]
    maxcog = d["maxCog"]
    cog15 = round(d["over15"] / d["functions"] * 100, 1) if d["functions"] else 0.0
    avg = d["avgLines"]
    quad = d["quad"]

    sc_rgb, sc_op = color_high(score, 75, 25)
    dup_rgb, dup_op = color_low(dup, 8, 20, 12, 25)
    mc_rgb, mc_op = color_low(maxcog, 31, 110, 79, 105)
    cg_rgb, cg_op = color_low(cog15, 2, 5, 3, 4)
    av_rgb, av_op = color_low(avg, 120, 185, 65, 95)
    qd_rgb, qd_op = color_low(quad, 0, 10, 10, 30)

    kind = f'<span class="kind"><i class="kchip {d["kcls"]}">{d["klabel"]}</i> ★ {d["stars"]} · <code>{d["branch"]}@{d["sha"]}</code> · <code>{d["sub"]}</code></span>'
    repo = f'<td class="repo"><a href="{d["url"]}" target="_blank" rel="noopener">{d["name"]}</a>{kind}</td>'
    cells = [
        f'<td class="rank">{d["rank"]}</td>',
        repo,
        f'<td><span class="grade-chip {grade_class(grade)}">{grade}</span></td>',
        cell_num(f'<b>{score}</b>', sc_rgb, sc_op),
        cell_num(fmt_int(d["files"]), None, None, ctx=True),
        cell_num(fmt_int(d["loc"]), None, None, ctx=True),
        cell_num(dup_str(dup), dup_rgb, dup_op),
        cell_num(str(maxcog), mc_rgb, mc_op),
        cell_num(f"{cog15:.1f}%", cg_rgb, cg_op),
        cell_num(str(avg), av_rgb, av_op),
        cell_num(str(quad), qd_rgb, qd_op),
    ]
    return "<tr>" + "".join(cells) + "</tr>"

def main():
    rows = [json.load(open(f)) for f in glob.glob("/private/tmp/board/results/*.json")]
    # re-rank by score desc, then by dup asc, then maxCog asc as tiebreak
    rows.sort(key=lambda d: (-d["score"], d["dup"], d["maxCog"]))
    for i, d in enumerate(rows, 1):
        d["rank"] = i
    body = "\n            " + "\n            ".join(row_html(d) for d in rows) + "\n          "
    for fn in ["landing.html", "index.html"]:
        p = f"/Users/minho/dev/personal/cleanscore/{fn}"
        if not os.path.exists(p):
            continue
        s = open(p).read()
        new = re.sub(r"(<tbody>).*?(</tbody>)", lambda m: m.group(1) + body + m.group(2), s, flags=re.S)
        open(p, "w").write(new)
        print(f"updated {fn} ({len(rows)} rows)")
    # summary
    print("\nrank score grade repo         sha       maxCog cog15")
    for d in rows:
        print(f"{d['rank']:>2} {d['score']:>5} {d['grade']:<3} {d['name']:<12} {d['sha']:<9} {d['maxCog']:>6} {round(d['over15']/d['functions']*100,1) if d['functions'] else 0}")

if __name__ == "__main__":
    main()
