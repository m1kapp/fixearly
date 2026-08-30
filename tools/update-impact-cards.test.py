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


if __name__ == "__main__":
    unittest.main()
