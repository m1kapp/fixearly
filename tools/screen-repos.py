#!/usr/bin/env python3
"""screen-repos — 사냥터 넓히기: 아직 안 건드린 인기 JS/TS 저장소를 게이트부터 거른다.

순서는 메모 그대로다 — 코드를 읽기 전에 문이 열렸는지 본다.
  1. 지나가는 외부 기여자 수락률 ≥50% · 머지 5건 이상 · 중앙 ≤7일 (싼 컷 먼저)
  2. CONTRIBUTING·AGENTS·CLAUDE·PR 템플릿의 AI 문구, 외부 PR 을 닫는 워크플로
  3. 외부 기여자 PR 의 CLA 체크
"open" 이 나온 곳만 클론해서 `fixearly --dir=. --sweep` 로 후보를 센다(훑고 바로 지운다).
"check:ai-mention" 은 문구를 사람이 읽어 판정한다 — 단순 언급과 금지가 섞여 있다.
판정은 data/queue-repos.json(후보) · data/repo-gates.json(막힌 곳)에 남긴다.

사용: [STARS=1500..4000] python3 tools/screen-repos.py out.json   (gh 로그인 필요)
"""
import json, os, re, subprocess, sys, base64, statistics, datetime as dt
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
STARS = os.environ.get("STARS", ">4000")  # 넓힐 때 STARS=1500..4000


def gh(path):
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode:
        return None
    try:
        return json.loads(r.stdout)
    except Exception:
        return None


def known():
    s = set()
    s |= {f["repo"].lower() for f in json.load(open(f"{ROOT}/impact.json"))["findings"]}
    s |= {k.lower() for k in json.load(open(f"{ROOT}/data/repo-gates.json"))["gates"]}
    s |= {q["repo"].lower() for q in json.load(open(f"{ROOT}/data/queue-repos.json"))["repos"]}
    s |= {k.lower() for k in json.load(open(f"{ROOT}/data/repo-merge-times.json"))["repos"]}
    return s


def candidates():
    out = {}
    for lang in ("TypeScript", "JavaScript"):
        for page in range(1, 4):
            q = f"search/repositories?q=language:{lang}+stars:{STARS}+pushed:>2026-09-15+archived:false&sort=stars&per_page=100&page={page}"
            d = gh(q) or {}
            for it in d.get("items", []):
                out[it["full_name"]] = it["stargazers_count"]
    return out


POLICY_FILES = ["CONTRIBUTING.md", ".github/CONTRIBUTING.md", "docs/CONTRIBUTING.md", "AGENTS.md", "CLAUDE.md",
                "AI_POLICY.md", ".github/PULL_REQUEST_TEMPLATE.md", ".github/pull_request_template.md"]
AI_RE = re.compile(r"\b(AI|LLM|LLMs|Copilot|ChatGPT|Claude|generative|AI-generated|AI-assisted)\b")
BAN_RE = re.compile(r"(not accept|won't accept|do not accept|will be closed|automatically close|banned|unsolicited|prohibit|must disclose|disclos)", re.I)


def gate(repo):
    hits, bans = set(), []
    for p in POLICY_FILES:
        d = gh(f"repos/{repo}/contents/{p}")
        if not d or "content" not in d:
            continue
        txt = base64.b64decode(d["content"]).decode("utf-8", "replace")
        for line in txt.splitlines():
            if AI_RE.search(line):
                hits.add(p)
                if BAN_RE.search(line):
                    bans.append(line.strip()[:160])
    wf = gh(f"repos/{repo}/contents/.github/workflows") or []
    restrict = [w["name"] for w in wf if isinstance(w, dict) and re.search(r"close|external|unsolicited|ai-|slop|vouch", w["name"], re.I)]
    return sorted(hits), bans[:3], restrict


def rates(repo):
    pulls = gh(f"repos/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=60") or []
    ext = [p for p in pulls if p.get("author_association") not in ("OWNER", "MEMBER", "COLLABORATOR")
           and (p.get("user") or {}).get("type") != "Bot" and not str((p.get("user") or {}).get("login", "")).endswith("[bot]")]
    per = {}
    for p in ext:
        per[p["user"]["login"]] = per.get(p["user"]["login"], 0) + 1
    drive = [p for p in ext if per[p["user"]["login"]] <= 2]
    t = lambda s: dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    md = [(t(p["merged_at"]) - t(p["created_at"])).total_seconds() / 86400 for p in drive if p.get("merged_at")]
    return {"drive": len(drive), "driveMerged": len(md),
            "drivePct": round(100 * len(md) / len(drive)) if drive else None,
            "median": round(statistics.median(md), 1) if md else None,
            "sample": next((p["number"] for p in ext if p.get("merged_at")), None) if ext else None}


def cla(repo):
    prs = gh(f"repos/{repo}/pulls?state=open&per_page=20&sort=updated&direction=desc") or []
    ext = [p for p in prs if p.get("author_association") in ("CONTRIBUTOR", "NONE", "FIRST_TIME_CONTRIBUTOR")]
    if not ext:
        return None
    sha = ext[0]["head"]["sha"]
    names = [c["name"] for c in (gh(f"repos/{repo}/commits/{sha}/check-runs") or {}).get("check_runs", [])]
    names += [s["context"] for s in (gh(f"repos/{repo}/commits/{sha}/status") or {}).get("statuses", [])]
    # \b: "Check Clang-Format" 은 CLA 가 아니다
    return any(re.search(r"\bcla\b|contributor.license", n, re.I) for n in names)


def one(item):
    repo, stars = item
    r = rates(repo)
    row = {"repo": repo, "stars": stars, **r}
    # cheap cut first: repos that don't take drive-by PRs aren't worth the gate reads
    if not r["drivePct"] or r["drivePct"] < 50 or r["driveMerged"] < 5 or (r["median"] or 99) > 7:
        row["verdict"] = "cut:rate"
        return row
    hits, bans, restrict = gate(repo)
    row.update(aiFiles=hits, aiBan=bans, restrictWf=restrict, cla=cla(repo))
    row["verdict"] = "cut:gate" if (bans or restrict) else ("check:ai-mention" if hits else "open")
    return row


def main():
    k = known()
    c = {r: s for r, s in candidates().items() if r.lower() not in k}
    print(f"candidates {len(c)} (excluded known {len(k)})", file=sys.stderr)
    with ThreadPoolExecutor(6) as ex:
        rows = list(ex.map(one, sorted(c.items(), key=lambda kv: -kv[1])))
    json.dump(rows, open(OUT, "w"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(Counter(r["verdict"] for r in rows), file=sys.stderr)


if __name__ == "__main__":
    main()
