#!/usr/bin/env python3
import pathlib
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

    def test_security_contribution_is_separate_from_fixearly_totals(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        grid_pos = html.index('<div class="iwrap hide-stalled hide-closed">')
        security_pos = html.index('data-contribution="security"')

        self.assertGreater(security_pos, grid_pos)
        self.assertNotIn("openstatusHQ/openstatus/pull/2620", html[grid_pos:security_pos])
        self.assertIn("별도 기여 · Fixearly 탐지 아님", html)
        self.assertIn('id="security-contribution"', html)
        self.assertIn("13 merged · 3 in review · 1 nobody has looked", html)


if __name__ == "__main__":
    unittest.main()
