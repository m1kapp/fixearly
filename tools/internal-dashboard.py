#!/usr/bin/env python3
"""madrascheck-dev 전체 저장소를 재서 로컬 전용 등급표를 만든다.

비공개 저장소명과 결과는 .internal/ 및 사용자 캐시에만 쓴다. 공개 소스나 배포
산출물에는 포함하지 않는다. 원본 작업 디렉터리를 건드리지 않고 얕은 캐시 복제본을
사용하며, 같은 커밋은 이전 결과를 재사용한다.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import datetime as dt
import html
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
ORG = "madrascheck-dev"
LOCAL_OUT = ROOT / ".internal"
CACHE = Path(os.environ.get(
    "FIXEARLY_INTERNAL_CACHE",
    str(Path.home() / ".cache" / "fixearly-internal" / ORG),
)).expanduser().resolve()
CLONES = CACHE / "clones"
WORK = CACHE / "work"
RESULTS = CACHE / "results"
SCORING_VERSION = "v12"
JS_LANGS = {"JavaScript", "TypeScript"}


def run(args, *, cwd=None, timeout=600):
    return subprocess.run(
        [str(x) for x in args], cwd=cwd, capture_output=True, text=True,
        timeout=timeout, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )


def gh_json(args, timeout=120):
    proc = run(["gh", *args], timeout=timeout)
    if proc.returncode:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "GitHub 조회 실패")
    return json.loads(proc.stdout)


def repositories():
    return gh_json([
        "repo", "list", ORG, "--limit", "200", "--json",
        "name,nameWithOwner,visibility,isArchived,isFork,defaultBranchRef,url,updatedAt,primaryLanguage",
    ])


def languages(slug):
    return gh_json(["api", f"repos/{slug}/languages"])


def cached_row(path, sha):
    if not path.exists():
        return None
    try:
        row = json.loads(path.read_text(encoding="utf-8"))
        if row.get("sha") == sha and row.get("scoringVersion") == SCORING_VERSION:
            return row
    except Exception:
        return None
    return None


def repo_sha(repo_dir):
    proc = run(["git", "-C", repo_dir, "rev-parse", "HEAD"])
    return proc.stdout.strip() if proc.returncode == 0 else ""


def prepare_clone(repo):
    slug, name = repo["nameWithOwner"], repo["name"]
    branch = (repo.get("defaultBranchRef") or {}).get("name")
    if not branch:
        return None, "기본 브랜치 없음"
    dst = CLONES / name
    if (dst / ".git").is_dir():
        fetch = run(["git", "-C", dst, "fetch", "--depth", "1", "origin", branch], timeout=300)
        if fetch.returncode:
            return None, fetch.stderr.strip() or "fetch 실패"
        checkout = run(["git", "-C", dst, "checkout", "--detach", "-f", "FETCH_HEAD"], timeout=120)
        if checkout.returncode:
            return None, checkout.stderr.strip() or "checkout 실패"
        return dst, None

    args = [
        "gh", "repo", "clone", slug, dst, "--", "--depth", "1",
        "--filter=blob:none", "--single-branch", "--branch", branch,
    ]
    local_reference = Path.home() / "dev" / ORG / name
    if (local_reference / ".git").is_dir():
        args.extend(["--reference-if-able", local_reference])
    clone = run(args, timeout=600)
    if clone.returncode or not (dst / ".git").is_dir():
        return None, clone.stderr.strip() or clone.stdout.strip() or "clone 실패"
    return dst, None


def base_row(repo, language_bytes):
    branch = (repo.get("defaultBranchRef") or {}).get("name")
    primary = (repo.get("primaryLanguage") or {}).get("name")
    return {
        "repo": repo["nameWithOwner"],
        "name": repo["name"],
        "url": repo["url"],
        "visibility": repo["visibility"],
        "branch": branch,
        "updatedAt": repo["updatedAt"],
        "primaryLanguage": primary,
        "jsTsBytes": sum(language_bytes.get(lang, 0) for lang in JS_LANGS),
        "archived": repo["isArchived"],
        "fork": repo["isFork"],
        "scoringVersion": SCORING_VERSION,
    }


def measure(repo, language_bytes):
    row = base_row(repo, language_bytes)
    if not row["branch"]:
        return {**row, "status": "na", "reason": "빈 저장소"}
    if row["jsTsBytes"] <= 0:
        return {**row, "status": "na", "reason": "JS/TS 소스 없음"}

    repo_dir, error = prepare_clone(repo)
    if error:
        return {**row, "status": "error", "reason": error[:300]}
    sha = repo_sha(repo_dir)
    saved = cached_row(RESULTS / f"{repo['name']}.json", sha)
    if saved:
        return {**saved, **row, "cached": True}

    work = WORK / repo["name"]
    out = work / "out"
    work.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    proc = run([
        "node", ROOT / "bin" / "fixearly.mjs", f"--dir={repo_dir}", f"--out={out}",
    ], cwd=work, timeout=1200)
    result_file = out / "fixearly.json"
    if proc.returncode or not result_file.exists():
        message = proc.stderr.strip() or proc.stdout.strip().splitlines()[-1:] or ["분석 실패"]
        if isinstance(message, list):
            message = message[0]
        if "파일을 찾을 수 없습니다" in message or "소스 파일이 없습니다" in message:
            return {**row, "sha": sha, "status": "na", "reason": "분석 가능한 JS/TS 소스 없음"}
        return {**row, "sha": sha, "status": "error", "reason": str(message)[:300]}

    stats = json.loads(result_file.read_text(encoding="utf-8"))
    quality, source = stats["quality"], stats["source"]
    if source["files"] <= 0 or source["codeLines"] <= 0:
        empty = {**row, "sha": sha, "status": "na", "reason": "분석 가능한 JS/TS 소스 없음"}
        (RESULTS / f"{repo['name']}.json").write_text(
            json.dumps(empty, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return empty
    measured = {
        **row,
        "sha": sha,
        "status": "ok",
        "cached": False,
        "grade": quality["grade"],
        "gradeBase": quality["gradeBase"],
        "score": quality["score"],
        "files": source["files"],
        "codeLines": source["codeLines"],
        "cognitiveAvg": quality["cognitive"]["avg"],
        "cognitiveMax": quality["cognitive"]["max"],
        "duplication": quality["duplication"]["percent"],
        "avgFileLines": quality["avgFileLines"],
        "quadratic": quality["quadratic"]["candidates"],
        "seqIo": quality["seqIo"]["sites"],
        "generatedAt": stats["generatedAt"],
    }
    (RESULTS / f"{repo['name']}.json").write_text(
        json.dumps(measured, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return measured


def dashboard_html(payload):
    safe_json = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>madrascheck-dev · fixearly internal</title>
<style>
:root{{--paper:#f6f8fb;--card:#fff;--line:#e2e8f0;--ink:#111827;--muted:#64748b;--accent:#2563eb;
--S:#0f7a63;--A:#2f8f5b;--B:#7d8a2c;--C:#c0862e;--D:#bf4a38;--E:#8f2f24}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif}}
.wrap{{max-width:1440px;margin:auto;padding:28px clamp(16px,3vw,40px) 60px}}a{{color:inherit;text-decoration:none}}
.top{{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}}h1{{font-size:26px;margin:0;letter-spacing:-.03em}}
.sub{{color:var(--muted);margin:5px 0 0}}.back{{border:1px solid var(--line);background:var(--card);padding:8px 12px;border-radius:9px;color:var(--muted)}}
.summary{{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin:24px 0}}
.stat{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}}.stat small{{display:block;color:var(--muted)}}.stat b{{font-size:22px}}
.controls{{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}}input{{flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff}}
.filters{{display:flex;gap:5px;flex-wrap:wrap}}button{{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;padding:8px 10px;cursor:pointer}}button.on{{background:var(--ink);color:#fff;border-color:var(--ink)}}
.table{{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px}}table{{width:100%;border-collapse:collapse;min-width:1100px}}th,td{{padding:10px 12px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}}th{{position:sticky;top:0;background:#f8fafc;color:var(--muted);font-size:11px;letter-spacing:.04em;cursor:pointer;z-index:1}}th:first-child,td:first-child{{text-align:left;position:sticky;left:0;background:inherit}}tbody tr{{background:#fff}}tbody tr:hover{{background:#f8fbff}}td:first-child{{font-weight:650}}.meta{{display:block;color:var(--muted);font-size:10.5px;font-weight:400}}
.grade{{display:inline-grid;place-items:center;min-width:38px;padding:3px 7px;border-radius:6px;color:white;font-weight:800}}.gS{{background:var(--S)}}.gA{{background:var(--A)}}.gB{{background:var(--B)}}.gC{{background:var(--C)}}.gD{{background:var(--D)}}.gE{{background:var(--E)}}.gNA{{background:#94a3b8}}
.score{{font-size:16px;font-weight:800}}.na{{color:var(--muted);text-align:left!important}}.foot{{color:var(--muted);font-size:12px;margin-top:12px}}
@media(max-width:760px){{.summary{{grid-template-columns:repeat(2,1fr)}}h1{{font-size:22px}}}}
</style></head><body><main class="wrap">
<div class="top"><div><h1>madrascheck-dev · 전체 등급</h1><p class="sub">비공개 로컬 뷰 · 추적된 JS/TS 프로덕션 코드 · fixearly v12</p></div><a class="back" href="../">← 공개 랜딩</a></div>
<section class="summary" id="summary"></section>
<div class="controls"><input id="q" type="search" placeholder="저장소 검색" aria-label="저장소 검색"><div class="filters" id="filters"></div></div>
<div class="table"><table><thead><tr>
<th data-key="name">저장소</th><th data-key="grade">등급</th><th data-key="score">점수</th><th data-key="codeLines">코드 줄</th><th data-key="files">파일</th><th data-key="cognitiveAvg">인지 평균</th><th data-key="cognitiveMax">인지 최대</th><th data-key="duplication">중복 %</th><th data-key="avgFileLines">파일 평균</th><th data-key="quadratic">O(n²)</th><th data-key="seqIo">순차 I/O</th><th data-key="updatedAt">저장소 갱신</th>
</tr></thead><tbody id="rows"></tbody></table></div>
<p class="foot">N/A는 JS/TS 소스가 없거나 빈 저장소다. 캐시 복제본만 분석하며 원본 작업 디렉터리는 수정하지 않는다. 생성 {html.escape(payload['generatedAt'])}</p>
</main><script>
const DATA={safe_json};let filter='ALL',sortKey='score',dir=1;
const rows=DATA.rows, ok=rows.filter(x=>x.status==='ok'), na=rows.length-ok.length;
const avg=ok.length?Math.round(ok.reduce((a,x)=>a+x.score,0)/ok.length):0;
const dist={{}};for(const x of ok)dist[x.gradeBase]=(dist[x.gradeBase]||0)+1;
document.getElementById('summary').innerHTML=[['전체',rows.length],['측정',ok.length],['N/A',na],['평균 점수',avg],['캐시 재사용',rows.filter(x=>x.cached).length]].map(x=>`<div class="stat"><small>${{x[0]}}</small><b>${{x[1]}}</b></div>`).join('');
const grades=['ALL','S','A','B','C','D','E','N/A'];
document.getElementById('filters').innerHTML=grades.map(g=>`<button data-g="${{g}}" class="${{g==='ALL'?'on':''}}">${{g}}${{dist[g]?` ${{dist[g]}}`:g==='N/A'?` ${{na}}`:''}}</button>`).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
const fmt=n=>n==null?'—':Number(n).toLocaleString();
function render(){{const q=document.getElementById('q').value.toLowerCase();let list=rows.filter(x=>(!q||x.repo.toLowerCase().includes(q))&&(filter==='ALL'||(filter==='N/A'?x.status!=='ok':x.gradeBase===filter)));
list.sort((a,b)=>{{let x=a[sortKey],y=b[sortKey];if(x==null)x=sortKey==='score'?999999:'';if(y==null)y=sortKey==='score'?999999:'';return (typeof x==='number'?x-y:String(x).localeCompare(String(y)))*dir}});
document.getElementById('rows').innerHTML=list.map(x=>{{if(x.status!=='ok')return `<tr><td><a href="${{esc(x.url)}}" target="_blank">${{esc(x.name)}}</a><span class="meta">${{esc(x.primaryLanguage||'—')}} · ${{esc(x.branch||'—')}}</span></td><td><span class="grade gNA">N/A</span></td><td colspan="9" class="na">${{esc(x.reason)}}</td><td>${{(x.updatedAt||'').slice(0,10)}}</td></tr>`;return `<tr><td><a href="${{esc(x.url)}}" target="_blank">${{esc(x.name)}}</a><span class="meta">${{esc(x.primaryLanguage||'—')}} · ${{esc(x.branch)}} · ${{esc((x.sha||'').slice(0,7))}}</span></td><td><span class="grade g${{esc(x.gradeBase)}}">${{esc(x.grade)}}</span></td><td class="score">${{x.score}}</td><td>${{fmt(x.codeLines)}}</td><td>${{fmt(x.files)}}</td><td>${{fmt(x.cognitiveAvg)}}</td><td>${{fmt(x.cognitiveMax)}}</td><td>${{fmt(x.duplication)}}</td><td>${{fmt(x.avgFileLines)}}</td><td>${{fmt(x.quadratic)}}</td><td>${{fmt(x.seqIo)}}</td><td>${{(x.updatedAt||'').slice(0,10)}}</td></tr>`}}).join('')}}
document.getElementById('q').addEventListener('input',render);document.getElementById('filters').addEventListener('click',e=>{{const b=e.target.closest('button');if(!b)return;filter=b.dataset.g;document.querySelectorAll('#filters button').forEach(x=>x.classList.toggle('on',x===b));render()}});
document.querySelector('thead').addEventListener('click',e=>{{const k=e.target.dataset.key;if(!k)return;if(sortKey===k)dir*=-1;else{{sortKey=k;dir=k==='name'?1:-1}}render()}});render();
</script></body></html>'''


def write_dashboard(rows):
    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "organization": ORG,
        "scoringVersion": SCORING_VERSION,
        "rows": sorted(rows, key=lambda row: row["name"].lower()),
    }
    LOCAL_OUT.mkdir(parents=True, exist_ok=True)
    (LOCAL_OUT / "madrascheck.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (LOCAL_OUT / "madrascheck.html").write_text(dashboard_html(payload), encoding="utf-8")
    return payload


def scan(jobs):
    for directory in (CLONES, WORK, RESULTS, LOCAL_OUT):
        directory.mkdir(parents=True, exist_ok=True)
    repos = repositories()
    print(f"{ORG} 저장소 {len(repos)}개 확인", flush=True)

    language_map = {}
    with ThreadPoolExecutor(max_workers=min(8, jobs * 2)) as pool:
        futures = {pool.submit(languages, repo["nameWithOwner"]): repo for repo in repos}
        for future in as_completed(futures):
            repo = futures[future]
            try:
                language_map[repo["nameWithOwner"]] = future.result()
            except Exception as error:
                language_map[repo["nameWithOwner"]] = {}
                print(f"  ! {repo['name']}: 언어 조회 실패 — {error}", flush=True)

    rows = []
    completed = 0
    with ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {
            pool.submit(measure, repo, language_map.get(repo["nameWithOwner"], {})): repo
            for repo in repos
        }
        for future in as_completed(futures):
            repo = futures[future]
            try:
                row = future.result()
            except Exception as error:
                row = {**base_row(repo, language_map.get(repo["nameWithOwner"], {})),
                       "status": "error", "reason": str(error)[:300]}
            rows.append(row)
            completed += 1
            label = f"{row.get('grade', 'N/A')} {row.get('score', '')}".strip() if row["status"] == "ok" else f"N/A · {row.get('reason', '')}"
            cache = " · cache" if row.get("cached") else ""
            print(f"  [{completed:02d}/{len(repos)}] {repo['name']}: {label}{cache}", flush=True)

    payload = write_dashboard(rows)
    measured = sum(row["status"] == "ok" for row in rows)
    print(f"\n완료: 측정 {measured} · N/A/오류 {len(rows)-measured}", flush=True)
    print(f"대시보드: http://localhost:4173/.internal/madrascheck.html", flush=True)
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scan", action="store_true", help="GitHub 저장소를 갱신하고 다시 측정")
    parser.add_argument("--serve", action="store_true", help="생성 뒤 localhost:4173 서버 실행")
    parser.add_argument("--jobs", type=int, default=2, help="동시 측정 수 (기본 2)")
    args = parser.parse_args()

    if args.scan or not (LOCAL_OUT / "madrascheck.html").exists():
        scan(max(1, min(args.jobs, 4)))
    if args.serve:
        os.chdir(ROOT)
        os.execvp(sys.executable, [sys.executable, "-m", "http.server", "4173"])


if __name__ == "__main__":
    main()
