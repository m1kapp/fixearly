#!/bin/bash
# Re-measure all board repos at HEAD of pinned branch with the fixed engine.
# Emits /private/tmp/board/results/<name>.json with raw metric fields.
set -u
# 저장소 위치가 바뀌어도 안 깨지게 이 스크립트 기준으로 푼다(tools/ 의 부모).
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="$HERE/../bin/fixearly.mjs"
# /private/tmp 은 OS 가 비운다. 실제로 클론 70개와 측정 산출물을 그렇게 날렸다.
# 기본값은 그대로 두되, BOARD_ROOT 로 살아남는 곳을 지정할 수 있게 한다.
ROOT="${BOARD_ROOT:-/private/tmp/board}"
CLONES=$ROOT/clones
OUT=$ROOT/results
mkdir -p "$CLONES" "$OUT"
# 목록은 저장소에 있다. 예전엔 /private/tmp 를 가리켜서, tmp 가 비워진 뒤로는
# 첫 줄부터 아무것도 못 읽고 조용히 0건 처리로 끝났다.
REPOS="${BOARD_REPOS:-$HERE/board-repos.json}"
[ -f "$REPOS" ] || { echo "FAIL 목록 없음: $REPOS"; exit 1; }

python3 -c "import json;[print(d['name']+'|'+d['url']+'|'+d['branch']+'|'+d['sub']+'|'+str(d['rank'])+'|'+d['kcls']+'|'+d['klabel']+'|'+d['stars']) for d in json.load(open('$REPOS'))]" | while IFS='|' read -r name url branch sub rank kcls klabel stars; do
  done_f="$OUT/$name.json"
  if [ -f "$done_f" ]; then echo "skip $name"; continue; fi
  dir="$CLONES/$name"
  if [ ! -d "$dir/.git" ]; then
    echo "clone $name ($branch)..."
    git clone --depth 1 -b "$branch" -q "$url" "$dir" 2>/dev/null || git clone --depth 1 -q "$url" "$dir" 2>/dev/null
  fi
  [ -d "$dir/.git" ] || { echo "FAIL clone $name"; continue; }
  sha=$(cd "$dir" && git rev-parse --short HEAD)
  tgt="$dir/$sub"; [ "$sub" = "." ] && tgt="$dir"
  [ -d "$tgt" ] || { echo "FAIL subdir $name: $sub"; continue; }
  node "$ENGINE" --dir="$tgt" --out="$ROOT/o_$name" >/dev/null 2>&1
  # 엔진은 --kit 을 줄 때만 kit-stats.json 을 쓴다. 여기선 안 주므로 fixearly.json 이다.
  # 옛 이름을 읽고 있어서 모든 저장소가 "FAIL measure" 로 떨어졌다.
  js="$ROOT/o_$name/fixearly.json"
  [ -f "$js" ] || { echo "FAIL measure $name"; continue; }
  RANK="$rank" KCLS="$kcls" KLABEL="$klabel" STARS="$stars" NAME="$name" SHA="$sha" URL="$url" BRANCH="$branch" SUB="$sub" python3 -c "
import json,os
d=json.load(open('$js')); q=d['quality']; s=d['source']; c=q['cognitive']
out=dict(rank=int(os.environ['RANK']), name=os.environ['NAME'], url=os.environ['URL'],
  kcls=os.environ['KCLS'], klabel=os.environ['KLABEL'], stars=os.environ['STARS'],
  branch=os.environ['BRANCH'], sub=os.environ['SUB'], sha=os.environ['SHA'],
  score=q['score'], grade=q['grade'], files=s['files'], loc=s['codeLines'],
  dup=q['duplication']['percent'], maxCog=c['max'], over15=c['over15'],
  functions=q['functions'], avgLines=q['avgFileLines'],
  quad=(q.get('quadratic') or {}).get('sites',0),
  # v8 에서 새로 들어간 축. 안 담으면 재측정을 돌려도 보정할 근거가 안 남는다.
  nplus=(q.get('nplusOne') or {}).get('sites',0),
  nplusPer1k=(q.get('nplusOne') or {}).get('perThousand',0),
  serial=(q.get('serialAwait') or {}).get('sites',0),
  scoringVersion=q.get('scoringVersion'),
  # 채점축 승격 후보를 판정하려면 '기존 점수와 독립인가'를 봐야 한다. 그 상관을
  # 계산할 원자료를 여기서 같이 담는다 — 재측정은 비싸서 두 번 돌릴 수 없다.
  ioLoop=(q.get('io') or {}).get('uncachedLoopSites',0),
  # hostages 는 목록이 아니라 개수다(엔진이 \`\${renderGates.hostages}곳\` 으로 찍는다).
  renderGates=((q.get('renderGates') or {}).get('hostages') or 0),
  textbook={k:(v or {}).get('count',0) for k,v in (q.get('textbook') or {}).items()},
  typeSafety={k:(q['typeSafety'][k] or {}).get('count',0)
              for k in ('anyType','asAny','nonNull','tsIgnore') if q.get('typeSafety')},
  anyPct=((q.get('typeSafety') or {}).get('anyType') or {}).get('pct',0),
  tsFiles=(q.get('typeSafety') or {}).get('tsFiles',0))
json.dump(out, open('$done_f','w'))
print('OK',out['name'],out['sha'],out['grade'],out['score'],'maxCog',out['maxCog'],'over15',out['over15'],'fns',out['functions'])
"
done
echo "=== BATCH DONE ==="; ls "$OUT" | wc -l
