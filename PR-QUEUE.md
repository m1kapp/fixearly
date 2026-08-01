# PR 큐

밀도가 높다고 바로 내지 않는다. **물량으로 보이면 저장소가 문을 닫는다** — activepieces 가
외부 PR 을 자동으로 닫게 된 이유가 그것이고(`close-external-prs.yml` 의 문구: "the volume
(a lot of it AI-generated)"), formbricks 도 PR 생성 자체를 협업자로 제한했다. 한 계정에서
하루에 여러 저장소로 나가는 건 그 신호를 만든다.

그래서 후보를 찾으면 여기 넣고, 아래 속도 규칙에 맞춰 내보낸다.

## 제출 기준 — 우리 실적으로 보정한 것

판정이 난 것의 개수는 아래 [지금 열려 있는 것](#지금-열려-있는-것) 블록이 자동으로 센다.
아래 표가 남기는 건 **왜 그렇게 됐는지**다 — 스킬의 사전 게이트를 통과하고도 닫힌 건들이
있고, 그 사유가 게이트보다 정확한 기준이다. 사유의 출처는 `impact.json` 하나다(랜딩
카드도 같은 값을 쓴다). 손으로 두 벌 적으면 반드시 갈리므로 여기서는 생성만 한다.

<!-- auto:decided — tools/update-pr-queue.py 가 생성한다. 손으로 고치지 마라. -->
| PR | 결과 | 사유·메모 |
|---|---|---|
| [outline#13117](https://github.com/outline/outline/pull/13117) | 머지 | 질문 없이 머지 |
| [nocodb#14309](https://github.com/nocodb/nocodb/pull/14309) | 머지 | 질문 없이 머지 |
| [n8n#34899](https://github.com/n8n-io/n8n/pull/34899) | 머지 | 봇이 요구한 changeset prefix 만 고치고 통과 |
| [novu#12074](https://github.com/novuhq/novu/pull/12074) | 승인 | 승인 후 머지 대기 |
| [medusa#16188](https://github.com/medusajs/medusa/pull/16188) | 승인 | 승인 후 머지 대기 |
| [vite#23114](https://github.com/vitejs/vite/pull/23114) | 승인 | 당일 승인, 질문 없음 |
| [budibase#19320](https://github.com/Budibase/budibase/pull/19320) | 닫힘 | 사유 없이 닫힘. 요청받지 않은 최적화는 그냥 거절될 수 있다 |
| [twenty#23231](https://github.com/twentyhq/twenty/pull/23231) | 닫힘 | "redundant with #23232" — 같은 저장소에 겹치는 2건을 냈다 |
| [twenty#23232](https://github.com/twentyhq/twenty/pull/23232) | 닫힘 | 겹친 2건 중 나머지. 사유는 남지 않았다 |
| [directus#27978](https://github.com/directus/directus/pull/27978) | 닫힘 | "이 엣지 케이스의 성능 이득은 churn 을 정당화하지 못한다 — 더 큰 최적화 기회가 있다" |
| [cal.com#29832](https://github.com/calcom/cal.diy/pull/29832) | 닫힘 | 우리가 접었다 — 같은 저장소에 2건이 열려 있어 큰 쪽(#29828)에 리뷰를 몰아줬다 |
<!-- /auto:decided -->

**크기는 판별자가 아니다.** budibase 는 +10/−6 으로 닫혔고 medusa 는 +71/−6 으로 승인됐다.
머지된 outline 이 +12/−1 로 제일 작긴 하지만, 작다고 통과하는 게 아니다.

### ① 현실 **중앙** 크기에서 이득이 나야 한다 — 최댓값이 아니라

directus 에서 실증됐다. 벤치를 정직하게 냈고 "n>1000 에서만 의미가 있다"고 먼저 적었는데,
메인테이너는 정확히 그 문장을 근거로 닫았다. **"어떤 n 에서는 30배"는 통과 사유가 아니다.**

벤치 표에서 *그 코드가 가장 흔하게 만나는 크기* 행을 짚고, 거기서 1.3배 미만이면 안 낸다.
표의 마지막 줄이 아니라 가운데 줄을 본다.

다만 vite#23114 은 작은 쪽(50청크)에서 0.84x 인 표를 그대로 내고도 당일 승인됐다. 표본
1건이라 기준을 풀지는 않지만, **directus 가 닫힌 건 표 모양이 아니라 "더 큰 최적화 기회가
있다"는 영역 판단이었다**는 쪽이 더 맞아 보인다.

### ② 같은 영역에 열린 perf 이슈가 있으면 먼저 읽는다

directus 는 "더 큰 최적화 기회가 있다"고 했다. 메인테이너가 그 영역을 이미 다르게 보고
있으면 우리 미세 최적화는 노이즈로 읽힌다. 코퍼스 저장소의 열린 perf 이슈를 훑는 방법은
이미 있다(수요 우선 탐색) — 제출 **전에** 그 저장소 것만 확인한다.

### ③ 저장소당 1건

twenty 에서 실증. 겹치는 두 건을 내면 하나가 redundant 로 닫힌다.

### ④ 작은 쪽을 본문 맨 앞에

이건 통과율을 올리는 규칙이 아니라 신뢰를 지키는 규칙이다. 숨기면 리뷰어가 찾아내고,
그때는 숫자 전체를 의심받는다.

### 남는 위험

budibase 의 "denounce" 는 사유가 없다. 요청받지 않은 최적화는 어디서든 그냥 거절될 수
있고 이건 줄일 수 없다. 수요 우선 탐색(열린 perf 이슈에서 시작)이 대안이지만 코퍼스
74곳에서 실제로 낼 수 있는 건 0건이었다 — 대부분 이미 고쳐졌거나 우리 축이 아니다.

### 지금 열린 것을 이 기준으로 다시 보면

| PR | 현실 중앙에서 | 판정 |
|---|---|---|
| typeorm#12746 | 20~100 테이블 → 4.3x ~ 22x | 통과 |
| Ghost#29704 | n 무관 (왕복 3 → 1) | 통과 |
| vite#23114 | 200~600 청크 → 2.3x ~ 5.6x | **승인됨.** 50청크에서 0.84x 라 directus 와 같은 인상을 줄까 걱정했는데, sapphi-red 는 당일에 질문 없이 승인했다 |

## 속도 규칙

- **저장소당 1건.** 앞엣것이 닫히거나 머지될 때까지 두 번째를 안 낸다.
  (twenty 에 겹치는 2건을 냈다가 하나가 redundant 로 닫혔다.)
- **하루 1건.** 오늘 3건을 냈는데 많았다 — 서로 다른 저장소여도 계정 하나에서 나간다.
- **열린 것이 5건을 넘으면 멈춘다.** 대응할 여력을 남긴다. 변경 요청이 오면 그게 먼저다.
- **낼 게 없는 날은 안 낸다.** 큐가 비면 비는 대로 둔다.

### 딱 하나의 예외 — 축 커버리지

**머지가 0건인 축의 첫 제출은 5건 상한과 별개로 1건 허용한다.**

상한의 목적은 *물량으로 보이는 걸 막는 것*이다. 그런데 축마다 1건씩은 물량이 아니라
검증이다 — 이 도구가 파는 주장이 "규칙이 남의 저장소에서 머지로 검증됐다"인데,
후보를 손에 들고 안 내면 그 규칙은 우리 기준으로 아직 **미검증**이다.

2026-08-01 기준 머지 3건이 전부 같은 축(`find→Map`)이라 진단 19종 중 1종만
검증된 상태다. 그 상태로 "규칙이 검증됐다"고 쓰면 거짓말이다.

예외를 쓸 때 지키는 것:

- **축당 1건까지.** 그 축에 머지가 하나 붙으면 예외는 닫힌다.
- **저장소당 1건은 그대로.** 이 예외가 그 규칙을 풀지는 않는다.
- **하루 1건도 그대로.** 급해도 몰아서 안 낸다.
- 예외로 낸 건 여기 표에 축 이름과 함께 남긴다 — 왜 상한을 넘겼는지 나중에 설명할 수 있게.

지금 머지 0인 축: `N+1`(승인 1·리뷰 1) · `순차 I/O`(대기 2) · `중복 쿼리`(리뷰 1) ·
`쓰기만 하는 컬렉션`(제출 0, 후보 15건 보유).

## 지금 열려 있는 것

<!-- auto:open — tools/update-pr-queue.py 가 생성한다. 손으로 고치지 마라. -->
| PR | 축 | 상태 | 경과 |
|---|---|---|---|
| [medusa#16188](https://github.com/medusajs/medusa/pull/16188) | O(n²) | 🔵 승인 · 머지 대기 | 8일째 |
| [novu#12074](https://github.com/novuhq/novu/pull/12074) | N+1 | 🔵 승인 · 머지 대기 | 8일째 |
| [vite#23114](https://github.com/vitejs/vite/pull/23114) | O(n²) | 🔵 승인 · 머지 대기 | 1일째 |
| [immich#30163](https://github.com/immich-app/immich/pull/30163) | N+1 | 🟢 리뷰 진행 | 8일째 |
| [langfuse#15585](https://github.com/langfuse/langfuse/pull/15585) | 중복 쿼리 | 🟢 리뷰 진행 | 3일째 |
| [ghost#29704](https://github.com/TryGhost/Ghost/pull/29704) | 순차 I/O | ⚪ 대기 | 1일째 |
| [typebot#2572](https://github.com/baptisteArno/typebot.io/pull/2572) | 순차 I/O | ⚪ 대기 | 2일째 |
| [cal.com#29828](https://github.com/calcom/cal.diy/pull/29828) | O(n²) | ⚪ 대기 | 8일째 |
| [excalidraw#11805](https://github.com/excalidraw/excalidraw/pull/11805) | 쓰기만 하는 컬렉션 | ⚪ 대기 | 오늘 |
| [medusa#16233](https://github.com/medusajs/medusa/pull/16233) | O(n²) | ⚪ 대기 | 3일째 |
| [payload#17469](https://github.com/payloadcms/payload/pull/17469) | O(n²) | ⚪ 대기 | 8일째 |
| [strapi#27125](https://github.com/strapi/strapi/pull/27125) | O(n²) | ⚪ 대기 | 8일째 |
| [typeorm#12746](https://github.com/typeorm/typeorm/pull/12746) | O(n²) | ⚪ 대기 | 1일째 |

**열린 것 13건.** 판정 난 11건 중 머지 3 · 승인 3 · 닫힘 5.
<!-- /auto:open -->

큐에서 새로 꺼내기 전에 이쪽부터 정리한다. 속도 규칙상 열린 것이 5건을 넘으면 멈춘다.
머지된 것은 여기 두지 않는다 — 끝난 일이고, 전체 기록은 [IMPACT.md](IMPACT.md) 에 있다.

## 큐 (측정 완료 · 미제출)

아래는 코퍼스를 `쓰기만 하는 컬렉션` 으로 훑어 나온 15건 중 손검증까지 끝낸 것들이다.
열린 것이 5건 상한을 넘겨 있어 평시엔 하나도 못 내지만, **excalidraw#11805 는 축
커버리지 예외로 냈다** — 이 축은 머지가 0건이라 규칙이 아직 미검증이었다.
예외는 이걸로 닫힌다. 나머지는 열린 것이 5건 밑으로 내려간 뒤 저장소당 1건·하루 1건으로 꺼낸다.

**왜 excalidraw 를 골랐나** — 확률을 재고 골랐다. CLA 없음, 정리 PR 6건 평균
**0.0일** 머지(외부 기여자 1줄짜리도 당일), 우리 열린 PR 없음. 무엇보다 근거가
"미세 최적화"가 아니라 **"2023년 6월 #6123 이후 2년간 아무도 안 읽은 코드"** 라
directus 를 닫은 것 같은 영역 판단이 끼어들 여지가 없다. 리사이즈 포인터 핸들러
안이라 매 틱 이중 순회를 버린다는 점도 붙는다.

고침이 전부 "지우기"라 크기가 작고 동작이 안 변한다. 다만 **작다고 통과하는 게
아니다**(budibase 는 +10/−6 으로 닫혔다) — 꺼낼 때 그 저장소의 게이트 0 과 회전
속도를 먼저 본다.

| 저장소 | 자리 | 형태 |
|---|---|---|
| storybook | `StoryIndexGenerator.ts:826` | 이중 forEach 안에서 `invalidated.add(dep)` — 읽는 곳 없음 |
| rollup | `Chunk.ts:1343` | `renderedModuleSources.set(module, source)` 뒤 소비 없음 |
| angular | `slot_allocation.ts:25` | 주석은 "다음 순회에서 slotMap 을 쓴다"는데 안 쓴다 |
| angular | `temporary_variables.ts:57` · `migration.ts:261` | 같은 형태 2건 |
| react | `renderer.js:817` | 읽는 코드가 `/* DISABLED: …/pull/28417 */` 주석 안에 있다 |
| react | `CollectHoistablePropertyLoads.ts:499` · `AlignReactiveScopesToBlockScopesHIR.ts:78` | 컴파일러 패스 2건 |
| vscode | `chatToolPicker.ts:261` | `mcpServerByTool.set(...)` 뒤 조회 없음 |
| next.js | `export/index.ts:285` | `excludedPrerenderRoutes.add(page)` — 이름과 달리 제외에 안 쓰인다 |
| ghost · astro · pnpm · nx | 각 1건 | 같은 형태 |
| ~~excalidraw~~ | `App.tsx:13467` | **제출됨 → #11805** (축 커버리지 예외) |

react 건은 소비자가 주석 처리돼 있어 **PR 로 내면 "왜 지우냐"가 아니라 "이거
살릴 건가 지울 건가"를 묻는 게 된다** — 지우는 PR 보다 이슈가 맞을 수 있다.

## 훑었고 낼 것이 없던 곳

다시 훑지 않기 위해 사유를 남긴다.

| 저장소 | 후보 | 탈락 사유 |
|---|---|---|
| nuxt | O(n²) 10 | 안쪽이 레이어 목록(1~3개) · 미해결 import 경고 경로 · 빌드 진단 모듈 · 플러그인 수십 개 |
| next.js | 순차 6 | 유일한 await 가 파라미터 프라미스(순수 계산) · `async` 인데 본문에 await 없음 · 빌드타임 1회 · readFile→fetch 는 의존 관계 |
| svelte | 멤버십 12 | ARIA 명세 고정 테이블 · 코드모드 · n 이 엘리먼트당 속성/주석당 코드 수 |
| typeorm | 순차 14 | `query()` 가 QueryRunner 의 커넥션 하나로 보낸다 — 단일 pg Client 는 큐잉해 순차 실행하므로 `Promise.all` 로 왕복이 안 준다 |
| vite | O(n²) optimizer | `crawlDeps`/`scanDeps` 대칭 차집합은 진짜 O(n²)지만 n 이 의존성 수(수십~수백)라 마이크로초 |
| ghost | 순차 43 중 2 | 이메일 알림은 SMTP 가 DB 왕복을 압도 · stripe-migrations 는 순차가 의도 |

## 게이트 0 에서 막힌 곳

측정하기 전에 확인한다. 여기 있는 곳은 벤치를 해도 낼 수 없다.

| 저장소 | 사유 |
|---|---|
| formbricks | PR 생성이 협업자로 제한됨 (순차 I/O 87곳이 있는데도 못 냄) |
| activepieces | `close-external-prs.yml` 이 외부 PR 을 자동으로 닫음 |
| immich | `changelog:*` 라벨 필수 — 메인테이너만 붙일 수 있다 |
| cal.com 계열 | 외부 PR 에서 `required` 잡이 항상 실패 |

## 회전이 느려 후순위

평균 머지가 2주를 넘으면 미룬다. 큐가 비고 열린 것이 정리된 뒤에 본다.

| 저장소 | 외부 머지 | 평균 |
|---|---|---|
| nx | 22/60 | 31.9일 |
| discordjs | 21/60 | 29.7일 |
| nuxt | 21/60 | 20.3일 |
| typeorm | 5/60 | 16.3일 |

## 아직 안 훑은 곳

밀도가 있는데 손검증을 안 한 곳이다. 큐가 비면 여기서 꺼낸다.

| 저장소 | O(n²) | 순차 I/O | 게이트 0 |
|---|---|---|---|
| vscode | 573 | 54 | 미확인 · 규모 때문에 후순위 |
| mongoose | 11 | 0 | CLA 없음 · 외부머지 22/60 · 4.6일 |
| astro | 18 | 2 | CLA 없음 · 외부머지 24/60 · 9.9일 |
| storybook | 32 | 4 | 미확인 |
| pnpm | 24 | 4 | 미확인 |
| angular · typescript · babel | 44 · 32 · 17 | 0 | 미확인 |
| vitest | 19 | 0 | **CLA 있음** — 서명 먼저 |

---

*마커(`auto:decided`·`auto:open`)로 감싼 두 표는 `tools/update-pr-queue.py` 가
`impact.json` 에서 만든다. 나머지 판단·사유는 손으로 쓴다. 후보 밀도는 `npm run measure`
뒤 `data/corpus.json` 과 `$BOARD_ROOT/o_<name>/fixearly.json` 의 `scoreInputs` 에서 나온다.*
