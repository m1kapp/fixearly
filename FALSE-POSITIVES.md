# 오탐 카탈로그

이 도구가 **실제로 밟은 오탐**의 정본이다. [PATTERNS.md](./PATTERNS.md)가 "무엇을 잡나"라면
여기는 **"무엇을 잡으면 안 되나"**다. 둘은 같은 무게다 — 가드가 패턴의 절반이라는 말은
[LOOP.md](./LOOP.md)에 적혀 있는데, 정작 가드 목록은 엔진 주석에 흩어져 있었다.
흩어진 지식은 다음 사람이 같은 오탐을 다시 밟는다.

## 규칙

1. **오탐은 기억이 아니라 코드로 남긴다.** 계열마다 `FP:<id>` 태그를 엔진 주석에 박는다.
   `npm test` 가 이 표와 엔진 태그가 1:1인지 확인한다 — 가드를 지우면 테스트가 깨진다.
2. **증거를 같이 적는다.** "그럴 것 같다"는 가드를 넣지 않는다. 어느 저장소 어느 파일에서
   밟았는지 적을 수 없으면 아직 오탐 계열이 아니라 가설이다.
3. **가드는 미탐을 산다.** 오탐 0을 위해 미탐을 받아들인 자리는 그렇게 적는다.
   숨기면 나중에 "왜 이건 안 잡히지"로 되돌아온다.
4. **픽스처가 있으면 계열이 닫힌다.** 픽스처 없는 가드는 리팩터 한 번에 조용히 죽는다.

## 계열

| id | 축 | 무엇을 잘못 잡았나 | 어디서 밟았나 | 가드 | 픽스처 |
|---|---|---|---|---|---|
| `io-name-collision` | 루프 안 파일읽기 | 이름만 보고 유저 함수로 해석 — `x.get()`·`x.find()` 같은 빌트인 호출을 "리더 함수 호출"로 셌다 | 코퍼스 스캔에서 **834곳** | 빌트인 메서드명 제외 + 리더 해석을 파일 스코프로 한정 → 834 → 36 | 없음 |
| `exported-name-escapes-file` | 쓰기만 하는 컬렉션 | `export const allNativeEvents = new Set()` — 이 파일엔 `.add` 뿐이고 읽는 쪽이 다른 모듈에 있다 | react `DOMPluginEventSystem`·`ReactDOMEventHandle` 가 읽는다 | export 된 이름은 통째로 제외 | `write-only-collection.ts` |
| `write-return-value-is-read` | 쓰기만 하는 컬렉션 | `if (skipExit.delete(node)) return` — `delete` 는 있었는지를 돌려주고 그 불리언이 곧 조회다 | tailwind | 값이 버려지는 호출(`ExpressionStatement`)일 때만 쓰기로 센다 | `write-only-collection.ts` |
| `same-name-twice` | 쓰기만 하는 컬렉션 | 다른 스코프의 동명 변수를 한 덩어리로 봤다 | 코퍼스 검증 | 같은 이름이 두 번 선언되면 그 이름은 통째로 포기(미탐을 산다) | `write-only-collection.ts` |
| `regex-exec-walk` | 전역 정규식 상태 | `while ((m = re.exec(s)) !== null)` 는 `/g` 의 정석 순회 관용구다 | twenty (거기선 `lastIndex = 0` 리셋까지 하고 있었다) | `.exec()` 는 이 축에서 제외 | `stateful-regex.ts` |
| `regex-created-in-loop` | 전역 정규식 상태 | 루프 안에서 만든 정규식은 매 회 새 객체라 `lastIndex` 가 샐 수 없다 | 코퍼스 검증 | 루프 안 선언은 제외 | `stateful-regex.ts` |
| `regex-lastindex-reset` | 전역 정규식 상태 | 저자가 `RE.lastIndex = 0` 으로 이미 막아둔 자리를 버그로 잡았다 | nx `update-jest-preset-angular-setup.ts:43·61` — 그 저장소 후보 **2건이 전부 오탐** | `<이름>.lastIndex = ...` 가 파일에 있으면 그 이름 제외 | `stateful-regex.ts` |
| `for-in-needs-array-evidence` | 배열에 for...in | 객체에 쓰는 `for...in` 은 정상인데 같이 잡았다 | 코퍼스 검증 | 배열이라는 증거(리터럴·`map`·`filter`·`split`)가 있는 변수만 | `for-in-array.ts` |
| `for-in-name-collision` | 배열에 for...in | 증거를 파일 스코프로 모으는 탓에, 다른 함수에서 같은 이름이 배열로 선언돼 있으면 객체를 도는 정상 `for...in` 까지 끌려왔다 | mongoose `schema.js:2396`(객체 인덱스 스펙) 이 `schema.js:1005` 의 동명 배열 때문에 잡혔다 — 그 저장소 후보 2건 중 1건 | 같은 이름이 파일에서 두 번 이상 선언되면(파라미터 포함) 포기한다 — `same-name-twice` 와 같은 정책이고 미탐을 산다 | `for-in-array.ts` |
| `fill-domain-api` | 공유 참조 fill | `page.fill(selector, {...})` 처럼 도메인 API 의 `.fill()` 을 `Array.prototype.fill` 로 봤다 | playwright **3곳** | 수신자가 '배열을 만드는 표현'일 때만 | 없음 |
| `map-is-not-a-loop` | 루프 안 new RegExp | 모듈 로드 시 1회 도는 `CACHED = entries.map(... new RegExp ...)` 를 재컴파일로 봤다 | 코퍼스 검증 | 진짜 반복문(`for`/`while`) 안에서만 | 없음 |
| `derived-copy` | 루프 안 인덱스 재구축 | `new Set(x).add(y)` 는 재구축이 아니라 '수정한 파생 복사본'이다 | 코퍼스 검증 | 생성 직후 체이닝된 수정은 제외 | `loop-invariant-index.ts` |
| `loop-var-argument` | 루프 안 인덱스 재구축 | 인자가 루프 변수를 참조하면 매 회 값이 달라 호이스팅 자체가 불가능하다 | 코퍼스 검증 | 루프 변수를 참조하면 제외 | `loop-invariant-index.ts` |
| `reassigned-in-loop` | 루프 안 인덱스 재구축 | 루프 **밖**에서 선언됐다는 이유로 '불변'으로 봤는데, 루프 안에서 다시 대입되고 있었다 | mongoose `getModelsMapForPopulate.js:151` — `modelNames = res.modelNames` 바로 뒤의 `new Set(modelNames)` | 루프 본문에서 대입되는 이름(`=`·복합대입·`++`)이 인자에 있으면 제외 | `loop-invariant-index.ts` |
| `per-iteration-state` | 루프 안 인덱스 재구축 | 결과가 객체 프로퍼티·배열 원소·인자로 빠져나가는데 호이스팅하라고 했다 — 그러면 모든 반복이 같은 인스턴스를 공유한다 | mongoose `getModelsMapForPopulate.js:675·676` — `localField: new Set([data.localField])` | 결과가 리터럴 프로퍼티·원소·호출 인자로 escape 하면 제외 | `loop-invariant-index.ts` |
| `loop-header-runs-once` | 루프 안 인덱스 재구축 · 루프 안 정규식 생성 | 루프 **헤더**를 본문으로 셌다 — `for (const x of new Map(fields))` 의 Map 은 반복마다가 아니라 한 번 만들어진다 | mongoose `model.js:2000` · nx 후보 **4건이 전부** 이 형태였다(`daemon-environment.ts:396·461` · `escape-dollar-sign-env-variables.ts:48` · `pruned-output.ts:745`) — `for (const x of new Set(xs))` 는 중복 제거 후 순회하는 관용구다 | for-of·for-in 의 순회 대상과 for 의 초기화·조건·증감은 바깥 루프 문맥으로 본다 | `loop-invariant-index.ts` |
| `floating-needs-async-context` | floating promise | async 컨텍스트 밖에서는 `await` 를 붙일 수 없어 기계적 수정이 아니다 | 코퍼스 검증 | async 함수 안에서만 | 없음 |
| `promise-all-batching` | 루프 안 DB/HTTP (N+1) | `Promise.all(items.map(async …))` 는 병렬 배칭인데 순차 N+1 로 봤다 | 코퍼스 스캔 | 루프 안에서 **직접 await** 하는 호출만 센다 | 없음 |
| `minified-bundle` | 전 축 | 저장소에 커밋된 벤더 번들·시드 에셋이 git 추적 대상이라 모든 필터를 통과했다 | `for...in` **129곳** 오탐 + 점수 왜곡(twenty 78 B → 86 A, maxCog 356 → 97, 중복 15.7% → 9.5%) | 파일명 관례 + "한 줄이 비정상적으로 길다"로 전역 제외 | 없음 |
| `non-production-file` | 전 축 · 데드코드 | knip 이 `.test-d.ts`·`benchmarks/` 를 "미사용"으로 보고했다 | 데드 **181곳**(파일 수보다 많았다) | 비-프로덕션 파일을 모든 축에서 일관 제외 + 분석 대상과 교집합만 집계 | 없음 |
| `retroactive-author-association` | (측정 자체) | "그 저장소에 처음 내는 사람의 수락률"을 GitHub `author_association` 으로 재려 했다 | PR 이 머지되면 저자가 **소급해서** CONTRIBUTOR 가 된다 — 우리 머지 4건(outline#13117 · nocodb#14309 · vite#23114 · ghost#29831)도 낼 때는 NONE 이었는데 지금은 전부 CONTRIBUTOR 로 조회된다 (2026-08-11) | 그 계산을 걷어냈다. "NONE 이면서 머지됨"은 구조적으로 0 이라 cal.com 0/43 같은 가짜 0% 가 나온다 | 없음 |
| `path-scope-outside-root` | (측정 자체) | 제외 규칙이 절대경로에 물려, 측정 대상 **바깥** 디렉터리 이름이 판정을 뒤집었다 | `/private/tmp` 아래 클론한 storybook — 1559개가 전부 제외되고 **"SSS 100점"** 이 나왔다 (2026-08-10) | 판정을 `--dir` 기준 상대경로로. 0개면 채점 대신 실패 | selftest `제외 규칙 경로 범위` |

## 가드로 못 막아서 **축을 폐기한 것**

오탐이 늘 가드로 끝나지는 않는다. 정적으로 안전하게 가를 수 없으면 축을 버리는 게 맞다.
버린 이유를 남기지 않으면 다음 사람이 같은 축을 다시 만든다.

| 폐기된 축 | 왜 | 증거 |
|---|---|---|
| 가짜 조인 | `for a { for b { if (b.k === a.scalar) } }` 를 조인으로 봤는데, 안쪽이 *탐색*이 아니라 이미 필터된 배열 순회였다. 가드가 어렵고 실적 0 | 다만 이 오탐이 진짜 패턴(`filter` 그룹핑)을 찾아줬다 |
| 변수 담은 async map | `const xs = arr.map(async …); await Promise.all(xs)` 에서 앞줄만 보고 "미대기"로 판정. 데이터플로우 없이 `Promise.all(변수)` 를 못 본다 | vite·n8n·angular **3/3 오탐** |
| renderGates | 오탐이 아니라 **한 번도 발동하지 않았다**. 존경받는 OSS 14종에서 0회 — 죽은 축은 공짜 점수를 준다 | 점수에서 제외 |

## 가드가 아직 없는 것 — 손검증으로만 거른다

정적으로 못 가르는 자리다. 여기 적힌 건 **⑥ 손 검증 단계에서 반드시 확인한다.**

| 계열 | 무엇 | 증거 |
|---|---|---|
| 재시도 루프 | 락 획득 재시도처럼 "순차가 의도"인 루프 안 `execute` | immich `execute` 4곳 중 **3곳이 오탐** |
| 트랜잭션 내부 | 같은 트랜잭션에서 순서가 보장돼야 하는 순차 await | 코퍼스 스캔 |
| 단일 커넥션 | `Promise.all` 로 감싸도 드라이버가 큐잉해 왕복이 안 준다 | typeorm `query()` — QueryRunner 가 커넥션 하나로 보낸다 |
| 유한 n | 패턴은 맞지만 n 이 설정·필드 목록(보통 5개) | 스프레드 누적 축 전체가 T3 로 내려간 이유 |
| 위에서 길이를 막아둔 루프 | 루프 자체는 N+1 모양인데, **몇 줄 위에 길이 가드가 있다** | ghost `member-repository.js:453` — `products.length > 1` 이면 던지므로 n≤1 (2026-08-11) |
| iteration 별 오류 격리 | 루프 안 try/catch 로 한 건 실패를 나머지와 분리한다. 배치로 묶으면 그 의미가 사라진다 | ghost `member-repository.js:1479·1518` (2026-08-11) |
| 의도된 fire-and-forget | 호출 체인 자체가 await 없이 설계됐다 | astro `childrenConnectedCallback()` 도 await 없이 불린다 (2026-08-10) |
| 동작이 바뀌는 await | await 를 붙이면 바깥 `catch` 의 의미가 달라진다 | rollup `watch.ts:98` (2026-08-10) |

## 왜 이 표가 강제되나

`tools/check-false-positives.py` 가 `npm test` 에서 돈다. 확인하는 것:

- 표의 `id` 하나하나가 엔진에 `[FP:<id>]` 태그로 **정확히 한 번** 있는지
- 엔진의 `[FP:...]` 태그 중 표에 없는 게 있는지 (가드만 넣고 기록을 안 한 경우)
- 표가 가리키는 픽스처 파일이 실제로 있는지

가드를 지우면 테스트가 깨지고, 기록 없이 가드를 넣어도 깨진다. 오탐 지식이 사람 기억이
아니라 저장소에 남게 하는 게 목적이다.
