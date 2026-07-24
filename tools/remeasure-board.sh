#!/bin/bash
# Re-measure all board repos at HEAD of pinned branch with the fixed engine.
# Emits /private/tmp/board/results/<name>.json with raw metric fields.
set -u
ENGINE=/Users/minho/dev/personal/cleanscore/bin/cleanscore.mjs
ROOT=/private/tmp/board
CLONES=$ROOT/clones
OUT=$ROOT/results
mkdir -p "$CLONES" "$OUT"
REPOS=/private/tmp/board_repos.json

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
  js="$ROOT/o_$name/kit-stats.json"
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
  quad=(q.get('quadratic') or {}).get('sites',0))
json.dump(out, open('$done_f','w'))
print('OK',out['name'],out['sha'],out['grade'],out['score'],'maxCog',out['maxCog'],'over15',out['over15'],'fns',out['functions'])
"
done
echo "=== BATCH DONE ==="; ls "$OUT" | wc -l
