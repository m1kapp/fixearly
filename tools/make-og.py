#!/usr/bin/env python3
"""
make-og — 공유 카드(og.png) 를 굽는다. 1200x630.

트위터·슬랙·디스코드에 링크를 붙이면 이 이미지가 먼저 읽힌다. 히어로 카피보다
먼저 보이는 문구라서 손으로 관리하면 금방 본문과 갈린다. 그래서 숫자는 전부
실제 데이터에서 읽는다 — index.html 의 루프 영역(생성됨)과 같은 숫자다.

SVG 를 qlmanage 로 굽는 길은 버렸다. viewBox 를 무시하고 제멋대로 스케일해서
오른쪽이 잘렸다. Pillow 로 픽셀을 직접 놓으면 좌표가 곧 결과다.

사용: python3 tools/make-og.py
"""
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
M = 80  # 좌우 여백

PAPER = (255, 255, 255)
INK = (15, 23, 35)
INK2 = (74, 87, 105)
INK3 = (124, 136, 153)
ACCENT = (37, 99, 235)

KO = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
MONO = "/System/Library/Fonts/Menlo.ttc"
FACE = {"regular": 0, "medium": 2, "semibold": 4, "bold": 6}


def ko(size, weight="regular"):
    return ImageFont.truetype(KO, size, index=FACE[weight])


def mono(size, index=1):  # Menlo 1 = Bold
    return ImageFont.truetype(MONO, size, index=index)


def tracked(d, xy, text, font, fill, track=0.0):
    """자간을 벌려 그린다 — Pillow 에 letter-spacing 이 없어서 글자씩 놓는다."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track
    return x


def load_loop():
    """히어로 루프 영역에서 숫자를 읽는다 — 페이지와 공유 카드가 같은 출처를 쓴다."""
    h = open(f"{ROOT}/index.html", encoding="utf-8").read()
    m = re.search(r"<!--auto:loop-->(.*?)<!--/auto:loop-->", h, re.S)
    if not m:
        raise SystemExit("index.html 에서 루프 영역을 못 찾았다")
    loop = m.group(1)
    seg = [(c, t, int(n)) for c, t, n in
           re.findall(r'stroke="(#[0-9a-f]{6})"[^>]*><title>(.+?) (\d+)</title>', loop)]
    chips = [int(n) for n in re.findall(r'<span class="lc c\d">.*?<b>(\d+)</b>', loop)]
    return seg, chips


def load_headline():
    """H1 을 index.html 에서 읽는다 — 카피를 두 곳에 박아두면 반드시 갈린다."""
    h = open(f"{ROOT}/index.html", encoding="utf-8").read()
    m = re.search(r'<h1 class="ko">(.*?)</h1>', h, re.S)
    if not m:
        raise SystemExit("index.html 에서 <h1 class=\"ko\"> 를 못 찾았다")
    lines = [re.sub(r"<[^>]+>", "", ln).strip() for ln in re.split(r"<br\s*/?>", m.group(1))]
    return [ln for ln in lines if ln]


def hexrgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def main():
    seg, (rules, prs, merged, guards) = load_loop()

    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # 오른쪽: 랜딩과 같은 루프 그림, 가운데에 규칙별 머지 도넛.
    S, X0, Y0 = 520, W - 520 - 30, (H - 520) // 2 + 6
    art = Image.open(f"{ROOT}/loop.jpg").convert("RGB").resize((S, S), Image.LANCZOS)
    img.paste(art, (X0, Y0))
    cx, cy, r, sw = X0 + S / 2, Y0 + S / 2, 84, 18
    d.ellipse([cx - r - 6, cy - r - 6, cx + r + 6, cy + r + 6], fill=PAPER)
    total, a = sum(n for _, _, n in seg) or 1, -90.0
    for col, _, n in seg:
        sweep = 360 * n / total
        d.arc([cx - r, cy - r, cx + r, cy + r], a, a + sweep - 1.5, fill=hexrgb(col), width=sw)
        a += sweep
    f_num, f_sub = ko(58, "bold"), ko(17, "medium")
    num = str(merged)
    d.text((cx - d.textlength(num, font=f_num) / 2, cy - 48), num, font=f_num, fill=INK)
    sub = "PR 머지됨"
    d.text((cx - d.textlength(sub, font=f_sub) / 2, cy + 18), sub, font=f_sub, fill=INK2)

    d.rectangle([0, 0, W, 6], fill=ACCENT)

    # 워드마크 — fix 는 잉크, early 는 액센트. 페이지 brand 와 같은 처리.
    f_mark = ko(34, "bold")
    d.text((M, 74), "fix", font=f_mark, fill=INK)
    d.text((M + d.textlength("fix", font=f_mark), 74), "early", font=f_mark, fill=ACCENT)

    tracked(d, (M, 130), "JS / TS · CLI · 설치 없이", ko(18, "semibold"), INK3, track=1.4)

    # 줄이 길면 왼쪽 칸 폭에 맞춰 크기를 줄인다 — 카피가 바뀌어도 그림을 안 덮게.
    col_w = X0 - M - 10
    headline = load_headline()
    size = 64
    while size > 36 and max(d.textlength(ln, font=ko(size, "bold")) for ln in headline) > col_w:
        size -= 2
    f_h1 = ko(size, "bold")
    for i, ln in enumerate(headline):
        d.text((M - 3, 196 + i * int(size * 1.22)), ln, font=f_h1, fill=INK)

    f_body = ko(23)
    d.text((M, 372), "규칙은 남의 저장소에 PR 로 내서 검증한다.", font=f_body, fill=INK2)
    d.text((M, 406), f"규칙 {len(seg)}개가 찾아 머지된 PR {merged}건.", font=f_body, fill=INK2)

    # 규칙별 머지 막대 — 폭이 곧 건수, 색은 도넛과 같다.
    bar_y, bar_h, x = 462, 14, float(M)
    for col, _, n in seg:
        w = col_w * n / total
        d.rectangle([x, bar_y, x + w - 3, bar_y + bar_h], fill=hexrgb(col))
        x += w
    f_lab = ko(16, "medium")
    lx = M
    for col, title, n in seg[:3]:
        d.ellipse([lx, bar_y + 30, lx + 10, bar_y + 40], fill=hexrgb(col))
        lab = f"{title} {n}"
        d.text((lx + 16, bar_y + 25), lab, font=f_lab, fill=INK3)
        lx += 16 + d.textlength(lab, font=f_lab) + 18

    f_cmd = mono(23)
    d.text((M, 552), "npx fixearly --dir=src", font=f_cmd, fill=INK)

    out = f"{ROOT}/og.png"
    img.save(out, "PNG", optimize=True)
    print(f"og.png {W}x{H} · 머지 {merged} · PR {prs} · 규칙 {len(seg)} · {os.path.getsize(out) // 1024}KB")


if __name__ == "__main__":
    main()
