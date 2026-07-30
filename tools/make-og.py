#!/usr/bin/env python3
"""
make-og — 공유 카드(og.png) 를 굽는다. 1200x630.

트위터·슬랙·디스코드에 링크를 붙이면 이 이미지가 먼저 읽힌다. 히어로 카피보다
먼저 보이는 문구라서 손으로 관리하면 금방 본문과 갈린다. 그래서 숫자는 전부
실제 데이터에서 읽는다 — 등급 분포는 data/corpus.json, PR 성과는 IMPACT.md.

SVG 를 qlmanage 로 굽는 길은 버렸다. viewBox 를 무시하고 제멋대로 스케일해서
오른쪽이 잘렸다. Pillow 로 픽셀을 직접 놓으면 좌표가 곧 결과다.

사용: python3 tools/make-og.py
"""
import json
import os
import re
from collections import Counter

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
M = 80  # 좌우 여백

PAPER = (255, 255, 255)
INK = (15, 23, 35)
INK2 = (74, 87, 105)
INK3 = (124, 136, 153)
ACCENT = (37, 99, 235)
GRADE_COLOR = {
    "S": (15, 122, 99), "A": (47, 143, 91), "B": (125, 138, 44),
    "C": (192, 134, 46), "D": (191, 74, 56), "E": (143, 47, 36),
}
GRADE_ORDER = ["S", "A", "B", "C", "D", "E"]

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


def load_distribution():
    corpus = json.load(open(f"{ROOT}/data/corpus.json", encoding="utf-8"))
    counts = Counter(r["grade"] for r in corpus["repos"])
    return counts, corpus["n"]


def load_headline():
    """H1 을 index.html 에서 읽는다 — 카피를 두 곳에 박아두면 반드시 갈린다."""
    h = open(f"{ROOT}/index.html", encoding="utf-8").read()
    m = re.search(r'<h1 class="ko">(.*?)</h1>', h, re.S)
    if not m:
        raise SystemExit("index.html 에서 <h1 class=\"ko\"> 를 못 찾았다")
    lines = [re.sub(r"<[^>]+>", "", ln).strip() for ln in re.split(r"<br\s*/?>", m.group(1))]
    return [ln for ln in lines if ln]


def load_impact():
    """IMPACT.md 의 상태 아이콘을 센다 — 카드 생성기와 같은 출처를 쓴다."""
    md = open(f"{ROOT}/IMPACT.md", encoding="utf-8").read()
    rows = [m.group(1) for m in re.finditer(r"/pull/\d+\)\s*\|\s*([^|]+)\|", md)]
    return sum("✅" in r for r in rows), sum("🔵" in r for r in rows)


def main():
    counts, total = load_distribution()
    merged, approved = load_impact()

    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 6], fill=ACCENT)

    # 워드마크 — fix 는 잉크, early 는 액센트. 페이지 brand 와 같은 처리.
    f_mark = ko(34, "bold")
    d.text((M, 74), "fix", font=f_mark, fill=INK)
    d.text((M + d.textlength("fix", font=f_mark), 74), "early", font=f_mark, fill=ACCENT)

    tracked(d, (M, 130), "JS / TS · CLI · 설치 없이", ko(18, "semibold"), INK3, track=1.4)

    # 줄이 길면 폭에 맞춰 크기를 줄인다 — 카피가 바뀌어도 안 삐져나가게.
    headline = load_headline()
    size = 78
    while size > 40 and max(d.textlength(ln, font=ko(size, "bold")) for ln in headline) > W - 2 * M:
        size -= 2
    f_h1 = ko(size, "bold")
    top = 186 + (78 - size)  # 작아질수록 위쪽 여백을 조금 내려 균형 유지
    for i, ln in enumerate(headline):
        d.text((M - 4, top + i * int(size * 1.18)), ln, font=f_h1, fill=INK)

    d.text((M, 396), f"유명 오픈소스 {total}개를 같은 자로, 체급을 나눠 재서 만든 기준선.",
           font=ko(25), fill=INK2)

    # 등급 분포 막대 — 폭이 곧 개수다.
    bar_y, bar_h, bar_w = 466, 24, W - 2 * M
    x = float(M)
    f_lab = ko(18, "semibold")
    for g in GRADE_ORDER:
        n = counts.get(g, 0)
        if not n:
            continue
        w = bar_w * n / total
        d.rectangle([x, bar_y, x + w, bar_y + bar_h], fill=GRADE_COLOR[g])
        label = f"{g} {n}"
        lw = d.textlength(label, font=f_lab)
        # 칸보다 글자가 넓으면 뭉개진다 — 그럴 땐 라벨을 생략한다.
        if lw + 8 <= w:
            d.text((x + (w - lw) / 2, bar_y + bar_h + 10), label, font=f_lab, fill=INK3)
        x += w

    # 바닥줄 — 실행 명령과, 그 진단이 실제로 통과했다는 증거.
    f_cmd = mono(23)
    cmd = "npx fixearly --dir=src"
    d.text((M, 552), cmd, font=f_cmd, fill=INK)
    proof = f"   ·   같은 진단으로 낸 PR — 머지 {merged} · 승인 {approved}"
    d.text((M + d.textlength(cmd, font=f_cmd), 553), proof, font=ko(22), fill=INK3)

    out = f"{ROOT}/og.png"
    img.save(out, "PNG", optimize=True)
    print(f"og.png {W}x{H} · 분포 {dict(counts)} · 머지 {merged} 승인 {approved} "
          f"· {os.path.getsize(out) // 1024}KB")


if __name__ == "__main__":
    main()
