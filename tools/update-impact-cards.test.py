#!/usr/bin/env python3
import json
import pathlib
import re
import subprocess
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parent.parent


class ImpactCardTimeTest(unittest.TestCase):
    def test_every_impact_card_shows_contributor_count(self):
        findings = json.loads((ROOT / "impact.json").read_text(encoding="utf-8"))["findings"]
        counts = json.loads((ROOT / "data/repo-contributors.json").read_text(encoding="utf-8"))["repos"]
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        grid = html[html.index('<div class="iwrap hide-stalled hide-closed">'):]

        self.assertEqual(set(counts), {f["repo"] for f in findings})
        self.assertEqual(grid.count("기여자 약 "), len(findings))
        self.assertIn(f'기여자 약 {counts["facebook/react"]:,}명', grid)

    def test_merged_pr_can_await_release(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        findings = json.loads((ROOT / "impact.json").read_text(encoding="utf-8"))["findings"]
        for finding in findings:
            if finding.get("release", {}).get("channel") != "pending":
                continue
            with self.subTest(pr=finding["pr"]):
                card = next(card for card in re.findall(r'<article\b.*?</article>', html, re.S)
                            if f'{finding["repo"]}/pull/{finding["pr"]}"' in card)
                self.assertIn(f'PR merged <b>#{finding["pr"]}</b>', card)
                self.assertIn('awaiting release', card)
                self.assertNotIn('/releases/tag/', card)

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
        self.assertIn("Hono 보안 패치 · 의존성 점검", html)
        self.assertNotIn('class="security-proof"', html)
        # 요약 줄은 보안 점검을 포함한 모든 Fixearly findings 를 센다.
        # 리뷰·대기 칸은 스냅샷 시각에 따라 보류로 넘어가므로 숫자를 손으로 박지 않는다.
        # 칸의 '구성'도 박지 않는다 — n8n#37047 이 승인되자 `1 approved` 칸이 새로 생겨
        # `merged · in review` 를 붙여 읽던 정규식이 깨졌다. 머지 수만 본다.
        findings = json.loads((ROOT / "impact.json").read_text(encoding="utf-8"))["findings"]
        merged = sum(1 for f in findings if f.get("status") == "merged")
        self.assertIsNotNone(
            re.search(rf"\b{merged} merged · ", html)
        )

    def test_grid_prioritizes_active_then_newest_with_registry_totals(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        findings = json.loads((ROOT / "impact.json").read_text(encoding="utf-8"))["findings"]
        grid = html[html.index('<div class="iwrap hide-stalled hide-closed">'):]
        ordered = sorted(findings, key=lambda f: (
            0 if f["status"] == "closed" else 1 if f["status"] == "merged"
            else 3 if f["status"] == "approved" else 2,
            f["createdAt"], f["pr"]), reverse=True)
        positions = [grid.index(f"/{f['repo']}/pull/{f['pr']}") for f in ordered]
        self.assertEqual(positions, sorted(positions))
        ranks = re.findall(r'<(?:article|a) class="([^"]+)" data-rank="(\d+)"', grid)
        merged = sum(f["status"] == "merged" for f in findings)
        self.assertEqual(ranks, [("ic done", f"{n:02d}") for n in range(merged, 0, -1)])
        repo_count = len({f["repo"] for f in findings if f["status"] == "merged"})
        self.assertIn(f'<b id="impact-repos">{repo_count}</b>', html)
        self.assertIn(f'<b id="impact-merged">{merged}</b>', html)
        self.assertIn("건 PR 머지 성공 · 목표 100건", html)
        self.assertNotIn('id="impact-prs"', html)
        self.assertNotIn('id="impact-pending"', html)
        # 승인 대기 건이 있을 때만 본다 — n8n#37047 이 닫히자 승인 건이 0 이 됐다.
        if any(f["status"] == "approved" for f in findings):
            self.assertIn("PR 머지 · 승인 후 장기 대기", grid)


if __name__ == "__main__":
    unittest.main()
