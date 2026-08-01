#!/bin/bash
# 새 진단의 재현율·오탐을 코퍼스 75곳에서 잰다.
#
# 왜 있나: `쓰기만 하는 컬렉션` 을 픽스처만 통과시키고 낼 뻔했다. 실제로 코퍼스를
# 재보니 오탐이 두 계열 나왔다 —
#   ① 내보낸 이름(react 의 export const allNativeEvents: 읽는 쪽이 다른 모듈)
#   ② 반환값을 쓰는 쓰기(tailwind 의 `if (skipExit.delete(node)) return`)
# 픽스처는 내가 상상한 것만 담는다. 남의 코드는 상상 못 한 걸 담고 있다.
# **새 진단은 등재 전에 반드시 이걸 돌린다.**
#
# 사용:
#   tools/measure-diagnostic.sh "쓰기만 하는 컬렉션"
#   CORPUS_ROOT=/somewhere tools/measure-diagnostic.sh "루프 불변 인덱스"
#
# 클론은 ~/.cache 에 남긴다. /private/tmp 는 OS 가 비운다 — 실제로 클론 75개를
# 그렇게 날려서 재측정 때 처음부터 다시 받아야 했다.
#
# 결과: $CORPUS_ROOT/<slug>/<repo>.txt 와 요약 한 줄. 두 번째 실행부터는 이미
# 받은 클론을 재사용하므로 몇 분이면 끝난다.
set -u
LABEL="${1:-}"
[ -n "$LABEL" ] || { echo "사용: $0 \"진단 라벨\"  (예: \"쓰기만 하는 컬렉션\")"; exit 2; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
ROOT="${CORPUS_ROOT:-$HOME/.cache/fixearly-corpus}"
CLONES="$ROOT/clones"
SLUG="$(echo "$LABEL" | tr -d ' /')"
OUT="$ROOT/$SLUG"
SCRATCH="$ROOT/.scratch"
mkdir -p "$CLONES" "$OUT" "$SCRATCH"

REPOS="$HERE/board-repos.json"
[ -f "$REPOS" ] || { echo "FAIL 목록 없음: $REPOS"; exit 1; }

python3 -c "
import json
for d in json.load(open('$REPOS')):
    print('|'.join([d['name'], d['url'], d['branch'], d.get('sub','') or '']))
" | while IFS='|' read -r name url branch sub; do
  res="$OUT/$name.txt"
  [ -f "$res" ] && continue
  dir="$CLONES/$name"
  if [ ! -d "$dir/.git" ]; then
    rm -rf "$dir"
    # 얕게 받는다 — 재현율만 재는 데 이력은 필요 없다.
    git clone --depth 1 --branch "$branch" --single-branch --quiet "$url" "$dir" 2>/dev/null \
      || git clone --depth 1 --single-branch --quiet "$url" "$dir" 2>/dev/null \
      || { echo "CLONEFAIL" > "$res"; echo "  clone fail: $name"; continue; }
  fi
  target="$dir"
  [ -n "$sub" ] && [ -d "$dir/$sub" ] && target="$dir/$sub"
  # 산출물(public/·.fixearly-history.json)이 코퍼스나 저장소에 안 남게 scratch 에서 실행
  (cd "$SCRATCH" && node "$REPO/bin/fixearly.mjs" --dir="$target" 2>/dev/null) \
    | grep -A9 "$LABEL" > "$res" || echo "NONE" > "$res"
  echo "  $name"
done

hits=$(grep -l "$LABEL" "$OUT"/*.txt 2>/dev/null | wc -l | tr -d ' ')
total=$(ls "$OUT"/*.txt 2>/dev/null | wc -l | tr -d ' ')
fails=$(grep -l CLONEFAIL "$OUT"/*.txt 2>/dev/null | wc -l | tr -d ' ')
echo
echo "── $LABEL ── $hits/$total 곳에서 검출 · 클론실패 $fails"
echo "   상세: $OUT/<repo>.txt"
echo
echo "다음 단계는 자동화하지 않는다: **걸린 자리를 하나씩 열어 손으로 본다.**"
echo "오탐이 나오면 그 형태를 tools/fixtures/ 픽스처에 MISS 로 넣고 가드를 짜라 —"
echo "그래야 다음 사람이 같은 걸 다시 재지 않는다(bin/selftest.mjs 가 고정한다)."
