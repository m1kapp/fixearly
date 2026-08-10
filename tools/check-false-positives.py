#!/usr/bin/env python3
"""오탐 카탈로그(FALSE-POSITIVES.md)와 엔진 가드가 어긋나지 않는지 확인한다.

가드는 지우기 쉽고, 지워도 아무 소리가 안 난다 — 오탐이 조용히 돌아올 뿐이다.
그래서 계열마다 엔진 주석에 `[FP:<id>]` 태그를 박고, 여기서 세 가지를 못 박는다.

  ① 표의 id 는 엔진에 정확히 한 번 태그돼 있다        (가드를 지우면 깨진다)
  ② 엔진의 태그는 전부 표에 있다                      (기록 없이 가드만 넣으면 깨진다)
  ③ 표가 가리키는 픽스처 파일은 실제로 있다            (픽스처 이름이 썩으면 깨진다)

사용: python3 tools/check-false-positives.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "FALSE-POSITIVES.md"
ENGINE = ROOT / "bin" / "fixearly.mjs"
FIXTURES = ROOT / "tools" / "fixtures"

fail = 0


def bad(msg):
    global fail
    fail += 1
    print(f"  ✗ {msg}")


def main():
    catalog = CATALOG.read_text(encoding="utf-8")
    engine = ENGINE.read_text(encoding="utf-8")

    # 표의 첫 칸이 `id` 인 행만 본다. 아래쪽 "가드가 아직 없는 것" 표는 id 칸이 없다.
    rows = re.findall(r"^\|\s*`([a-z0-9-]+)`\s*\|(.+)$", catalog, re.MULTILINE)
    if not rows:
        bad("FALSE-POSITIVES.md 에서 계열 표를 못 찾았다")
        return

    ids = [r[0] for r in rows]
    dupes = {i for i in ids if ids.count(i) > 1}
    for d in sorted(dupes):
        bad(f"표에 중복된 id: {d}")

    tagged = re.findall(r"\[FP:([a-z0-9-]+)\]", engine)

    for fp_id in ids:
        n = tagged.count(fp_id)
        if n == 0:
            bad(f"엔진에 태그가 없다: [FP:{fp_id}] — 가드가 지워졌거나 태그를 안 달았다")
        elif n > 1:
            bad(f"엔진에 태그가 {n}번 있다(하나여야 한다): [FP:{fp_id}]")

    for fp_id in sorted(set(tagged)):
        if fp_id not in ids:
            bad(f"엔진에만 있고 카탈로그에 없다: [FP:{fp_id}] — 표에 한 줄 추가해라")

    # 픽스처 칸: `이름.ts` 형태만 파일로 본다. "없음", selftest 설명 등은 건너뛴다.
    for fp_id, rest in rows:
        for name in re.findall(r"`([\w.-]+\.ts)`", rest.split("|")[-2] if rest.count("|") >= 2 else rest):
            if not (FIXTURES / name).exists():
                bad(f"{fp_id}: 픽스처 파일이 없다 — tools/fixtures/{name}")

    if not fail:
        print(f"오탐 카탈로그와 엔진 가드가 일치한다 ({len(ids)}계열 · 픽스처 {len(list(FIXTURES.glob('*.ts')))}개)")


main()
sys.exit(1 if fail else 0)
