#!/usr/bin/env python3
import json
import pathlib
import re
import subprocess
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent


class ImpactCardTimeTest(unittest.TestCase):
    def test_elapsed_time_uses_registry_snapshot(self):
        result = subprocess.run(
            [sys.executable, ROOT / "tools/update-impact-cards.py", "--selftest"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn("상태 스냅샷 시각에 고정된다", result.stdout)

    def test_security_contribution_is_in_grid_as_fixearly_detection(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        grid_pos = html.index('<div class="iwrap hide-stalled hide-closed">')
        security_pos = html.index("openstatusHQ/openstatus/pull/2620")

        self.assertGreater(security_pos, grid_pos)
        self.assertIn("보안 점검", html)
        self.assertNotIn('class="security-proof"', html)
        # 요약 줄은 보안 점검을 포함한 모든 Fixearly findings 를 센다.
        # 리뷰·대기 칸은 스냅샷 시각에 따라 보류로 넘어가므로 숫자를 손으로 박지 않는다.
        findings = json.loads((ROOT / "impact.json").read_text(encoding="utf-8"))["findings"]
        merged = sum(1 for f in findings if f.get("status") == "merged")
        self.assertIsNotNone(
            re.search(rf"\b{merged} merged · \d+ in review · \d+ nobody has looked", html)
        )


if __name__ == "__main__":
    unittest.main()
