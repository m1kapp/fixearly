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
| [typebot#2572](https://github.com/baptisteArno/typebot.io/pull/2572) | 머지 | 사람 리뷰 없이 20.7일 만에 메인테이너가 직접 머지 |
| [openstatus#2583](https://github.com/openstatusHQ/openstatus/pull/2583) | 머지 | — |
| [orval#4254](https://github.com/orval-labs/orval/pull/4254) | 머지 | — |
| [rollup#6482](https://github.com/rollup/rollup/pull/6482) | 머지 | — |
| [rollup#6506](https://github.com/rollup/rollup/pull/6506) | 머지 | — |
| [rollup#6534](https://github.com/rollup/rollup/pull/6534) | 머지 | — |
| [readest#6687](https://github.com/readest/readest/pull/6687) | 머지 | — |
| [mikro-orm#8391](https://github.com/mikro-orm/mikro-orm/pull/8391) | 머지 | — |
| [mikro-orm#8392](https://github.com/mikro-orm/mikro-orm/pull/8392) | 머지 | — |
| [mikro-orm#8393](https://github.com/mikro-orm/mikro-orm/pull/8393) | 머지 | — |
| [promptfoo#11464](https://github.com/promptfoo/promptfoo/pull/11464) | 머지 | — |
| [outline#13117](https://github.com/outline/outline/pull/13117) | 머지 | 질문 없이 머지 |
| [pnpm#14032](https://github.com/pnpm/pnpm/pull/14032) | 머지 | — |
| [nocodb#14309](https://github.com/nocodb/nocodb/pull/14309) | 머지 | 질문 없이 머지 |
| [turborepo#14433](https://github.com/vercel/turborepo/pull/14433) | 머지 | — |
| [cline#14974](https://github.com/cline/cline/pull/14974) | 머지 | — |
| [medusa#16188](https://github.com/medusajs/medusa/pull/16188) | 머지 | 메인테이너 승인 뒤 머지 |
| [medusa#16233](https://github.com/medusajs/medusa/pull/16233) | 머지 | 메인테이너 승인 뒤 자동 머지 |
| [mongoose#16474](https://github.com/Automattic/mongoose/pull/16474) | 머지 | 리뷰의 변경 요청을 반영한 뒤 승인·머지 |
| [astro#17987](https://github.com/withastro/astro/pull/17987) | 머지 | — |
| [Babylon.js#18980](https://github.com/BabylonJS/Babylon.js/pull/18980) | 머지 | — |
| [jupyterlab#20008](https://github.com/jupyterlab/jupyterlab/pull/20008) | 머지 | — |
| [cherry-studio#21363](https://github.com/CherryHQ/cherry-studio/pull/21363) | 머지 | — |
| [vite#23114](https://github.com/vitejs/vite/pull/23114) | 머지 | 당일 승인, 2일 만에 머지 |
| [ghost#29704](https://github.com/TryGhost/Ghost/pull/29704) | 머지 | 메인테이너가 병렬화 변경을 승인한 뒤 머지 |
| [ghost#29831](https://github.com/TryGhost/Ghost/pull/29831) | 머지 | — |
| [ghost#31019](https://github.com/TryGhost/Ghost/pull/31019) | 머지 | — |
| [n8n#34899](https://github.com/n8n-io/n8n/pull/34899) | 머지 | 봇이 요구한 changeset prefix 만 고치고 통과 |
| [react#37699](https://github.com/facebook/react/pull/37699) | 머지 | — |
| [n8n#40103](https://github.com/n8n-io/n8n/pull/40103) | 머지 | — |
| [angular#70690](https://github.com/angular/angular/pull/70690) | 머지 | — |
| [angular#70977](https://github.com/angular/angular/pull/70977) | 머지 | — |
| [angular#71119](https://github.com/angular/angular/pull/71119) | 머지 | — |
| [openstatus#2620](https://github.com/openstatusHQ/openstatus/pull/2620) | 닫힘 | 상위 #2751 의존성 업데이트로 Hono 4.13.8·node-server 2.1.1이 반영돼 보안 목표가 충족됐다. 이 PR은 미병합 |
| [openstatus#2780](https://github.com/openstatusHQ/openstatus/pull/2780) | 닫힘 | 메인테이너가 V1 API 폐기 예정이라고 밝혀 우리가 닫았다 |
| [FastGPT#7918](https://github.com/labring/FastGPT/pull/7918) | 닫힘 | 메인테이너: catch-all 이라 await 없이도 기대대로 동작한다 · 새 버전에서 이 자동 갱신·재시도 자체를 없앴다 |
| [excalidraw#11805](https://github.com/excalidraw/excalidraw/pull/11805) | 닫힘 | 우리가 접었다 — 중앙 1일인 곳에서 34일째 사람 반응 0. 이 저장소 외부 PR 수락률 18% |
| [novu#12074](https://github.com/novuhq/novu/pull/12074) | 닫힘 | 우리가 접었다 — 중앙 1일인 곳에서 15일째 사람 리뷰 0(승인은 봇). 슬롯을 회수했다 |
| [typeorm#12746](https://github.com/typeorm/typeorm/pull/12746) | 닫힘 | 우리가 접었다 — 46일째 사람 리뷰 0(반응은 봇뿐), 09-12 핑에도 무응답. 슬롯을 회수했다 |
| [langfuse#15585](https://github.com/langfuse/langfuse/pull/15585) | 닫힘 | 우리가 접었다 — 중앙 0.6일인 곳에서 37일째 사람 반응 0(붙은 건 CLA 봇뿐) |
| [payload#17469](https://github.com/payloadcms/payload/pull/17469) | 닫힘 | 우리가 접었다 — 중앙 4일인 곳에서 14일째 아무 반응이 없었다 |
| [astro#17665](https://github.com/withastro/astro/pull/17665) | 닫힘 | 우리가 접었다 — 중앙 2일인 곳에서 24일째 사람 반응 0. CI 는 통과 상태였다 |
| [budibase#19320](https://github.com/Budibase/budibase/pull/19320) | 닫힘 | 사유 없이 닫힘. 요청받지 않은 최적화는 그냥 거절될 수 있다 |
| [budibase#19555](https://github.com/Budibase/budibase/pull/19555) | 닫힘 | 게이트 0 — 외부 PR 은 "작성자에게 배정된" 이슈를 참조해야 하는데 배정은 메인테이너만 한다 |
| [eslint#21317](https://github.com/eslint/eslint/pull/21317) | 닫힘 | AI 보조 PR 은 선행 이슈가 필요하다는 정책(게이트 0, 우리가 안 읽었다) · 메인테이너는 이득도 의심했다 — "린터는 보통 생성 코드를 안 훑는다" |
| [twenty#23231](https://github.com/twentyhq/twenty/pull/23231) | 닫힘 | "redundant with #23232" — 같은 저장소에 겹치는 2건을 냈다 |
| [twenty#23232](https://github.com/twentyhq/twenty/pull/23232) | 닫힘 | 겹친 2건 중 나머지. 사유는 남지 않았다 |
| [strapi#27125](https://github.com/strapi/strapi/pull/27125) | 닫힘 | 우리가 접었다 — 중앙 2일인 곳에서 14일째 아무 반응이 없었다 |
| [directus#27978](https://github.com/directus/directus/pull/27978) | 닫힘 | "이 엣지 케이스의 성능 이득은 churn 을 정당화하지 못한다 — 더 큰 최적화 기회가 있다" |
| [cal.com#29828](https://github.com/calcom/cal.diy/pull/29828) | 닫힘 | 우리가 접었다 — 외부 기여자는 `required` 잡이 항상 실패한다 (게이트 0). 이 저장소 수락률 10% |
| [cal.com#29832](https://github.com/calcom/cal.diy/pull/29832) | 닫힘 | 우리가 접었다 — 같은 저장소에 2건이 열려 있어 큰 쪽(#29828)에 리뷰를 몰아줬다 |
| [immich#30163](https://github.com/immich-app/immich/pull/30163) | 닫힘 | 우리가 접었다 — `changelog:*` 라벨은 메인테이너만 붙일 수 있어 우리 쪽에서 더 할 게 없었다 (게이트 0) |
| [ghost#30284](https://github.com/TryGhost/Ghost/pull/30284) | 닫힘 | 우리가 접었다 — 중앙 1.8일인 곳에서 15일째 사람 반응 0. 09-01 에 핑도 보냈지만 답이 없었다 |
| [storybook#35829](https://github.com/storybookjs/storybook/pull/35829) | 닫힘 | 우리가 접었다 — Danger 가 `ci:*`·`qa:*` 라벨에서 막는데 그 라벨은 메인테이너만 붙일 수 있다 (게이트 0) |
| [nx#36633](https://github.com/nrwl/nx/pull/36633) | 닫힘 | 우리가 접었다 — 34일째 사람 리뷰 0(반응은 봇뿐), 09-12 핑에도 무응답. 슬롯을 회수했다 |
| [n8n#37047](https://github.com/n8n-io/n8n/pull/37047) | 닫힘 | 승인 뒤 merge queue 의 CLA 검사가 PR 을 연 계정(yoominho91)을 미서명으로 잡았다. 같은 커밋으로 irontaek 이 #40103 을 다시 열었다 |
| [react#37698](https://github.com/facebook/react/pull/37698) | 닫힘 | 잘못된 GitHub 계정(yoominho91)으로 제출해 닫고 irontaek의 #37699로 교체했다 |
| [grafana#133985](https://github.com/grafana/grafana/pull/133985) | 닫힘 | 우리가 접었다 — 게이트 0 을 안 읽었다: 모든 커밋 서명 필수인데 서명 키가 없었다. 브랜치를 되돌리자 GitHub 가 자동으로 닫았다 |
| [vscode#334230](https://github.com/microsoft/vscode/pull/334230) | 닫힘 | 우리가 접었다 — 12일째 사람 리뷰 0(반응은 봇뿐), 09-12 핑에도 무응답. 슬롯을 회수했다 |
<!-- /auto:decided -->

**크기는 판별자가 아니다.** budibase 는 +10/−6 으로 닫혔고 medusa 는 +71/−6 으로 승인됐다.
머지된 outline 이 +12/−1 로 제일 작긴 하지만, 작다고 통과하는 게 아니다.

### ①-a 정정 — 린터에는 적용하지 않는다 (2026-09-11, eslint#21317 닫힘)

아래 개정을 근거로 eslint#21317 을 냈고 **닫혔다.** 메인테이너 사유 두 줄 중 하나가
①-a 를 정면으로 친다:

> ESLint usually does not run on generated code.

맞는 말이다. ①-a 는 "도구는 레포 전체를 훑으니 제일 큰 입력이 비용을 정한다"고 했는데,
**린터는 생성 코드를 애초에 안 훑는다**(`.eslintignore`·`ignores` 로 빠진다). 그러니
"생성된 파서의 case 600개"는 그 도구가 실제로 만나는 입력이 아니다. 꼬리를 잘못 잡았다.

그래서 ①-a 는 이렇게 좁힌다:

- **린터·포매터에는 적용하지 않는다.** 이들은 사람이 쓴 소스만 본다 — 사람이 손으로
  쓴 switch 는 case 10개 미만이고, 그게 중앙이자 꼬리다.
- **번들러·패키지 매니저·컴파일러에는 계속 적용한다.** 이들은 생성·벤더 코드를 **반드시**
  통과시킨다(번들러는 node_modules 를, 패키지 매니저는 락파일 전체를). 꼬리가 실제 입력이다.
- 판별 질문: **"그 도구가 생성 코드를 입력으로 받는 게 정상인가?"** 아니면 ① 로 돌아간다.

부수로 배운 것: **낼 곳의 AI 정책을 먼저 읽는다.** eslint 는 AI 보조 PR 에 선행 이슈를
요구하는데(`ai-policy#pull-request-acceptance-criteria`) 그걸 안 읽고 냈다. PR 템플릿의
AI 체크박스를 정직하게 체크하면 그 정책이 그대로 적용된다 — 체크를 피하는 게 아니라
**정책을 먼저 읽고 이슈부터 여는 게** 맞는 순서다.

### ①-a 도구 코드에서는 "중앙"이 파일이 아니라 **입력 전체**다 — 2026-09-10 개정

규칙 ① 을 린터·컴파일러·번들러 코드에 그대로 대면 아무것도 못 낸다. eslint 룰 하나를
예로 들면, 그 룰이 "가장 흔하게 만나는" switch 는 case 몇 개짜리라 이득이 0이다.

그런데 그 계산이 틀렸다. **린트 룰은 한 파일을 고르는 게 아니라 레포 전체를 훑는다.**
사용자가 체감하는 비용은 평균 switch 가 아니라 그 레포에서 제일 큰 switch 가 만든다 —
생성된 파서·상태머신·룩업 테이블 한 파일이 전체 린트 시간을 끌어올린다. 앱 코드의
"이 함수는 대개 10개를 받는다"와 성격이 다르다.

그래서 도구 코드(린터·컴파일러·번들러·패키지 매니저)에서는 중앙을 **그 도구가 실제로
돌아가는 입력 분포의 꼬리**로 읽는다. 다만 정직하게 쓴다: 작은 쪽에서 이득이 0이면
본문에 그렇게 적고, 표에 작은 크기 행을 같이 싣는다(규칙 ④ 와 같은 이유다).

앱 코드에는 개정이 적용되지 않는다. 거기서 n 이 스키마·페이지 크기에 묶여 있으면 그건
여전히 안 낸다 — directus#27978 이 닫힌 사유가 그대로 살아 있다.

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

twenty 와 cal.diy 에서 실증. 겹치는 두 건을 내면 하나가 redundant 로 닫히거나
(twenty#23231), 리뷰를 나눠 갖게 돼 우리가 접는다(cal.diy#29832). 닫힌 17건 중
물량 때문에 죽은 건 이 2건뿐이고, 둘 다 **같은 저장소 안**이었다.

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
| vite#23114 | 200~600 청크 → 2.3x ~ 5.6x | **머지됨.** 50청크에서 0.84x 라 directus 와 같은 인상을 줄까 걱정했는데, sapphi-red 는 당일 승인했고 2일 뒤 머지됐다 |

## 어디에 낼지 — 2026-08-08 에 다시 세운 게이트

**2026-09-27 신규 제출 기준:** 병합 가능성이 높은 후보만 낸다. 저장소는 최근 닫힌 외부 PR
20건 이상·수락률 80% 이상이어야 한다. 이것은 **1차 필터**이며 개별 PR 의 확률은 아니다.
그다음 해당 저장소에 우리 열린 PR 이 없고, CLA·AI 정책·필수 CI 등 제출 게이트가 해결돼
있어야 한다. 수정 자체는 메인테이너 요청이나 유사 PR 의 병합 선례가 있고, 실제 문제와
검증 결과를 보여줄 수 있어야 한다. 요청받지 않은 미세 최적화는 전체 경로의 이득이
확인되지 않으면 내지 않는다. 하나라도 빠지면 보류하고, 적합한 후보가 없으면 제출하지
않는다. 기존 PR 은 각각의 상태로 계속 판단한다.

아래 2026-08-08 의 60% 기준과 축 커버리지 예외는 당시 결정의 기록이며 신규 제출에는
적용하지 않는다.

밀도(후보가 몇 개 나오나)로 골랐더니 **낼 수 없거나 받지 않는 곳**에 절반을 썼다.
그날 실측한 숫자로 순서를 바꾼다. 이 순서는 판별력이 검증된 순이다.

| 순위 | 기준 | 컷 | 왜 |
|---|---|---|---|
| ① | **수락률** | 60% 미만 제외 | 최근 닫힌 외부 PR 중 머지 비율. 우리 결과와 제일 잘 맞는다 |
| ② | 중앙 머지일 | 3일 초과면 후순위 | 평균 말고 중앙값 |
| ③ | 게이트 0 | 제출 **전에** 확인 | CLA · 필수 라벨 · 외부 PR 을 닫는 봇 · 외부에서 항상 실패하는 필수 잡 |
| ④ | 별 | 30k 이상 | **판별용이 아니라 홍보용이다** |

**④ 를 판별 기준으로 쓰면 안 된다.** 우리 머지 6곳이 전부 35k 이상이라 그럴듯해
보이지만, 닫힌 4곳도 28k~54k 다. 애초에 30k 밑에는 두 번밖에 안 냈다 — 비교할 표본이
없다. 오늘 잰 값이 더 분명하다: cal.com 은 47.3k 인데 수락률 10%, langfuse 는 32.5k 인데
84% 다. **별은 문이 열렸는지를 말해주지 않는다.** 다만 파는 문장이 "우리 규칙이 남의
저장소에서 머지됐다"이고 그 설득력은 이름값에서 오므로, 같은 조건이면 큰 쪽을 고른다.

이 게이트를 처음부터 썼다면 cal.com(10%) · typeorm(10%) · typebot(10%) · excalidraw(18%)
**네 건을 안 냈다.** 그 넷이 방치 더미의 절반이었다.

### 무시당하는 진짜 이유는 저장소가 아니라 성격이다

보류 6건 중 4건은 수락률 60~87% 인 곳에서 2주를 서 있었다. 문은 열려 있는데 우리 것만
안 움직였다는 뜻이고, 공통점은 전부 **요청받지 않은 미세 최적화**라는 것이다. directus 는
그걸 명시적으로 사유로 적고 닫았고, budibase 는 사유 없이 닫았다.

같은 날 잰 것: **머지된 외부 PR 의 36%가 본문에 이슈를 참조한다.** 요청이 있던 일을
한 것과 우리가 찾아낸 것을 들고 간 것은 리뷰 우선순위가 다르다. 수요 우선 탐색을
"열린 perf 이슈 74곳에 0건"으로 접었는데, 그건 **perf 라벨만** 본 것이다. `help wanted`
· `good first issue` 중 우리 축과 겹치는 것까지 넓혀야 한다. 이게 채택률을 근본적으로
올리는 유일한 레버다.

### 그 레버를 실제로 당겨봤다 — 2026-08-10 측정, 결과는 0건

게이트를 통과한 저장소 11곳(storybook · astro · nx · pnpm · angular · rollup · vite ·
medusa · outline · nocodb · n8n)에서 `help wanted` + `good first issue` 를 열린 것으로
전부 긁었다. **88건.** 우리 축(O(n²) · N+1 · 중복 쿼리 · 순차 I/O · 쓰기만 하는 컬렉션)과
겹치는 것은 **0건**이다. 키워드로 걸린 4건도 전부 캐시 불안정 · `optimizePackageImports`
버그처럼 우리 디텍터가 보는 자리가 아니었다.

같은 11곳의 perf 라벨 열린 이슈는 **12건뿐이고**, 그중 우리 축은 역시 0건이다 — 사이드바
스크롤 랙, AOT 빌드 속도, 워커 번들링처럼 전부 **아키텍처·기능 모양**이다. 기계적 변환으로
닫히는 이슈는 애초에 이슈로 남지 않는다. 발견되면 그 자리에서 고쳐진다.

**결론: 수요 우선 탐색은 라벨을 넓혀도 비어 있다.** perf 라벨만 본 게 문제가 아니었다.
"유일한 레버"라는 표현은 취소한다 — 이 경로로는 채택률을 못 올린다. 남은 레버는
저장소 선택(게이트)과 근거의 성격(“미세 최적화”가 아니라 “2년간 아무도 안 읽은 코드”처럼
영역 판단이 끼어들 수 없는 것)뿐이다.

## 제출 직전에 돌리는 것 — `npm run pre-pr -- --dir=<저장소> --title="..."`

내용이 맞아도 **그 저장소의 관례**를 어기면 CI 가 먼저 빨개진다. 2026-08-11 astro#17665 의
`Lint` 가 그렇게 깨졌다: 테스트를 `.js` 로 썼는데 그 디렉터리 기존 3개가 전부 `.ts` 였고
`tsconfig.test.json` 의 include 도 `test/units/**/*.ts` 뿐이라, eslint 가
`was not found by the project service` 로 파싱을 거부했다. 코드는 멀쩡했다.

손으로 "관례를 확인하자"고 적어두면 다음에도 놓치므로 검사로 만들었다
(`tools/pre-pr-check.mjs`). 보는 것:

| # | 검사 | 왜 |
|---|---|---|
| ① | 락파일·`.DS_Store` 가 diff 에 있나 | 로컬 install 한 번이면 따라붙는다. 리뷰어 눈에 제일 먼저 띄는 잡음 |
| ② | 신규 파일 확장자가 **형제 파일**과 같나 | 확장자는 취향이 아니라 tsconfig·lint 대상 목록이다 (astro 에서 밟음) |
| ③ | 신규 `.ts` 가 어떤 tsconfig 의 `include` 에 걸리나 | 확장자가 같아도 글롭 밖이면 같은 증상 |
| ④ | 저장소에 PR 제목 검증 스크립트가 있으면 **그걸로** 돌려본다 | nx `scripts/validate-pr-title.js` 처럼. 추측하지 말고 그 저장소 코드로 판정 |
| ⑤ | changeset 쓰는 저장소인데 빠졌나 | 없으면 본문에 왜 없는지 적어야 한다 |
| ⑥ | 테스트 변경이 있나 | 파일명(`*.test.*`)뿐 아니라 `test/`·`__tests__/` 디렉터리도 본다 — rollup 은 `test/watch/index.js` 라 파일명만 보면 놓친다 |
| ⑦ | 저장소에 **AI 정책**이 있나 | eslint#21317 이 여기서 닫혔다 — AI 보조 PR 은 선행 이슈 필수. 템플릿·CONTRIBUTING 에서 찾아 알린다 |

`bin/selftest.mjs` 가 합성 저장소로 이 검사기의 양방향을 고정한다 — 어긋난 확장자는 잡고,
맞으면 통과. 검사기 자신도 첫 실행에서 오탐을 냈다(주석 제거 정규식이 `include` 글롭의
`/*` 를 블록 주석 시작으로 먹었다). 그것도 회귀로 박아뒀다.

## 속도 규칙

- **저장소당 1건.** 앞엣것이 닫히거나 머지될 때까지 두 번째를 안 낸다. **관측된 유일한
  물량 피해가 이것이다** — 닫힌 17건 중 2건이 정확히 여기서 죽었다(twenty#23231 은
  `redundant with #23232` 로 닫혔고, cal.diy#29832 는 같은 저장소에 2건이라 우리가 접어
  #29828 에 리뷰를 몰아줬다). 같은 저장소의 두 건은 같은 리뷰어의 시간을 나눠 가진다.
- ~~**하루 1건**~~ · ~~**열린 것 5건 상한**~~ — **2026-09-13 철회했다. 근거가 없었다.**

  출발 전제는 "물량이 보이면 저장소가 문을 닫는다"였는데, **한 번도 관측된 적이 없다.**
  닫힌 17건의 사유는 게이트 0(5건) · 무응답이라 우리가 회수(7건) · 이득 의심(2건) ·
  요청받지 않은 정리(1건) · 같은 저장소 겹침(2건)이다. 물량·스팸을 든 곳은 **0건**이다.

  모집단도 반대다. 대상 저장소의 **외부 기여자** 동시 오픈 분포를 쟀다(2026-09-13,
  `author_association` 이 CONTRIBUTOR·NONE·FIRST_TIME 인 것만):

  | 저장소 | 2건 이상 연 외부 저자 | 최다 보유 |
  |---|---|---|
  | angular | 19명 | 28건 |
  | nx | 18명 | 5건(메인테이너 33건 제외) |
  | typeorm | 21명 | 6건 |
  | vscode | 22명 | 7건(봇·팀원 제외) |
  | n8n | 33명 | 9건(봇 제외) |
  | medusa | 22명 | 16건 |
  | rollup | 3명 | 2건 |

  서로 다른 저장소에 7건을 열어둔 계정은 **눈에 띄는 축이 아니다.** 이 상한은 바깥의
  반응을 막은 게 아니라 우리 제출만 막았다 — twenty 후보는 하루 1건이 아니라 이 상한에
  막혀 대기했다(#53).

- **대신 남는 것은 여력이다.** 리뷰어가 뭔가 물었으면 **그 대응이 새 제출보다 먼저다.**
  이건 숫자가 아니라 상태로 판단한다 — 공이 우리에게 넘어온 PR 이 있으면 거기부터.
- **낼 게 없는 날은 안 낸다.** 큐가 비면 비는 대로 둔다. 지금 병목은 상한이 아니라
  게이트와 후보 품질이라, 상한을 치웠다고 제출이 늘지는 않는다.

### 이전 정책 기록 — 축 커버리지 예외 (2026-09-27 종료)

**머지가 0건인 축은 후보를 손에 들면 낸다.** (원래 이 조항은 5건 상한의 예외였다.
상한이 철회된 지금은 예외가 아니라 우선순위다 — 같은 값이면 미검증 축을 먼저 낸다.)

상한의 목적은 *물량으로 보이는 걸 막는 것*이다. 그런데 축마다 1건씩은 물량이 아니라
검증이다 — 이 도구가 파는 주장이 "규칙이 남의 저장소에서 머지로 검증됐다"인데,
후보를 손에 들고 안 내면 그 규칙은 우리 기준으로 아직 **미검증**이다.

2026-08-01 기준 머지 3건이 전부 같은 축(`find→Map`)이라 진단 19종 중 1종만
검증된 상태다. 그 상태로 "규칙이 검증됐다"고 쓰면 거짓말이다.

예외를 쓸 때 지키는 것:

- **축당 1건까지.** 그 축에 머지가 하나 붙으면 이 우선순위는 닫힌다.
- **저장소당 1건은 그대로.** 철회된 건 전체 상한과 하루 제한이지 이 규칙이 아니다.
- 예외로 낸 건 여기 표에 축 이름과 함께 남긴다 — 왜 상한을 넘겼는지 나중에 설명할 수 있게.

지금 머지 0인 축: `N+1`(낸 것 없음) · `중복 쿼리`(보류 1).
`순차 I/O` 는 ghost#29704 가, `쓰기만 하는 컬렉션` 은 **ghost#29831 이 2026-08-11 에
머지되면서** 검증됐다 — 두 축의 예외는 닫혔다.

**N+1 축은 2026-08-10 부터 다시 미제출 상태다.** 낸 것이 novu#12074 하나였는데 우리가
닫았고, immich#30163 은 게이트 0 이라 접었다. 축 커버리지 예외의 목적은 규칙을 머지로
검증하는 것이므로 이 축에는 예외가 **다시 열려 있다** — 단, 위 게이트를 통과한 곳에서만
쓴다. novu 는 수락률 87% 인데도 15일 동안 사람이 안 왔다. 게이트를 통과했다고 회전이
보장되지는 않는다는 뜻이라, 다음 N+1 은 중앙 1~2일인 곳으로 고른다.

**2026-08-17 준비 — openstatus 후보를 최신 main(`b0fe974`)에서 손검증했다.** 페이지 생성·
수정 API(`apps/server/src/routes/v1/pages/post.ts:137`, `put.ts:146`)는 먼저 요청의 모니터를
`inArray` 한 번으로 전부 읽어 유효성을 검사한다. 그런데 그 결과를 블록 밖으로 넘기지 않고,
바로 아래 루프에서 같은 workspace·id·deletedAt 조건으로 `findFirst` 를 모니터마다 다시
실행한다. 이미 읽은 행을 id Map 으로 넘기면 모니터 읽기가 요청당 **1+N회 → 1회**가 되고,
이름(`externalName || name`)·입력 순서·잘못된 id 거절 동작은 그대로다. POST·PUT 테스트에
숫자 배열·객체 배열·잘못된 id·externalName 경계가 이미 있다.

게이트도 통과한다. 최근 외부 PR 수락률 **80%(28/35)** · 중앙 **0.5일**, 우리 열린 PR 0,
CLA·외부 PR 자동 닫기 없음. 열린 #2338 이 같은 두 파일을 건드리지만 Drizzle v1 문법만
바꾸고 루프의 재조회는 그대로 남긴다. 그래서 중복 후보는 아니고, 먼저 머지되면 rebase 때
조회 문법만 맞추면 된다. 제출 전 `pnpm verify` 와 두 route 테스트를 돌린다.

**2026-09-03 준비 — vscode 후보를 최신 main(`09363dd1`)에서 손검증하고 브랜치를 밀어뒀다.**
`chatToolPicker.ts` 의 `mcpServerByTool` 은 툴 id → `IMcpServer` Map 인데 읽는 곳이 없다. 마지막
소비자 `mcpServerByTool.get(tool.id)` 는 2025-05-21 #249448("Add support for tool sets")이
버킷 키를 `ToolDataSource.toKey` 로 바꾸면서 지웠고, 이튿날 #249556 이 그 상태 그대로
`chatToolActions.ts` 에서 지금 파일로 옮겼다. QuickTree 재작성(#257748)·구 피커 삭제(#260414)도
살아남아 15개월째다. 고침은 Map·채우는 이중 루프·`IMcpServer` import 삭제(−8/+1), `mcpService` 는
아래 `mcpServers` 에서 계속 쓰므로 남긴다. 게이트: 수락률 91% · 중앙 0.1일 · 우리 열린 PR 0 ·
CLA 는 봇 댓글(`@microsoft-github-policy-service agree`)뿐 · 이슈 없는 외부 정리 PR 머지 사례
있음(#334095). `queue-repos.json` 의 "링크된 이슈 없는 외부 PR 을 봇이 닫는다"는 메모는 워크플로·
닫힌 PR 60건에서 근거를 못 찾았다 — 메인테이너가 *버그* PR 에 "이슈 먼저" 라고 답한 사례(#291187)
뿐이라 정리 PR 에는 해당 없다고 본다. 로컬에서 hygiene(11,742 파일)·eslint·tsc 통과(tsc 잔여
217건은 전부 electron-main 쪽 `Cannot find module 'electron'` — postinstall 을 건너뛴 환경 문제).
열린 #287192(텔레메트리)가 같은 파일을 건드리지만 이 줄은 문맥으로만 지나간다. 같은 날 #334230 으로 제출했다(하루 1건).

## 지금 열려 있는 것

<!-- auto:open — tools/update-pr-queue.py 가 생성한다. 손으로 고치지 마라. -->
| PR | 축 | 상태 | 경과 / 외부 머지 중앙값 |
|---|---|---|---|
| [Babylon.js#18990](https://github.com/BabylonJS/Babylon.js/pull/18990) | 버린 반환값 | ⚪ 대기 | 오늘 / 보통 1일 |
| [infisical#8536](https://github.com/Infisical/infisical/pull/8536) | 쓰기만 하는 컬렉션 | ⚪ 대기 | 오늘 / 보통 1일 |
| [insomnia#10575](https://github.com/Kong/insomnia/pull/10575) | forEach 안 await | ⚪ 대기 | 1일째 / 보통 1일 |
| [Trilium#11949](https://github.com/TriliumNext/Trilium/pull/11949) | 버려진 Promise | ⚪ 대기 | 1일째 / 보통 1일 |
| [angular#71267](https://github.com/angular/angular/pull/71267) | 버린 반환값 | ⚪ 대기 | 오늘 / 보통 2일 |
| [compiler-explorer#9241](https://github.com/compiler-explorer/compiler-explorer/pull/9241) | 버린 반환값 | ⚪ 대기 | 1일째 / 보통 1일 |
| [cytoscape.js#3527](https://github.com/cytoscape/cytoscape.js/pull/3527) | O(n²) | ⚪ 대기 | 1일째 / 보통 6일 |
| [pdf.js#22102](https://github.com/mozilla/pdf.js/pull/22102) | 쓰기만 하는 컬렉션 | ⚪ 대기 | 1일째 / 보통 1일 |
| [n8n#40311](https://github.com/n8n-io/n8n/pull/40311) | O(n²) | ⚪ 대기 | 3일째 / 보통 2일 |
| [nx#37332](https://github.com/nrwl/nx/pull/37332) | 버린 반환값 | ⚪ 대기 | 1일째 / 보통 1일 |
| [react-router#15591](https://github.com/remix-run/react-router/pull/15591) | 버려진 Promise | ⚪ 대기 | 1일째 / 보통 3일 |
| [strapi#27893](https://github.com/strapi/strapi/pull/27893) | 버려진 Promise | ⚪ 대기 | 7일째 / 보통 6일 |
| [super-productivity#10607](https://github.com/super-productivity/super-productivity/pull/10607) | 쓰기만 하는 컬렉션 | ⚪ 대기 | 오늘 |
| [tailwindcss#20525](https://github.com/tailwindlabs/tailwindcss/pull/20525) | 버려진 Promise | ⚪ 대기 | 12일째 / 보통 1일 · 보류 |
| [astro#18149](https://github.com/withastro/astro/pull/18149) | O(n²) | ⚪ 대기 | 12일째 / 보통 2일 · 보류 |

**열린 것 15건(보류 2건 빼면 13건).** 판정 난 59건 중 머지 33 · 승인 0 · 닫힘 26.
<!-- /auto:open -->

**2026-08-10 준비** — astro 후보를 손검증까지 끝내고 브랜치만 만들어 뒀다(하루 1건이라
오늘은 안 낸다). `viteBuild` 가 `pageInput` 을 루프에서 채우는데 읽는 곳이 없다. 소비자는
`ssrBuild(opts, internals, pageInput, container)` 였고 2025-12-04 "Environment API"(#14306)
에서 그 호출이 통째로 갈리면서 Set 만 남았다 — storybook 과 같은 모양이다. 원본에
`// (comment above may be outdated ?)` 라는 주석까지 붙어 있어 저자도 의심하던 자리다.
지우면 `routeIsRedirect(pageData.route)` 분기도 같이 빠지는데, 그 함수는
`route?.type === 'redirect'` 뿐이라 부작용이 없다. 안 쓰게 된 import 도 같이 지웠다.
게이트 0: CLA 없음 · 외부 PR 을 닫는 봇 없음 · 수락률 72% · 중앙 2.0일.

**2026-08-11 — 하루 2건을 냈다. 규칙을 어긴 것이므로 사유를 남긴다.**
astro#17665 을 낸 뒤 같은 날 nx#36633 을 냈다. 문서의 예외 조건("둘 다 수락률 60% 이상
**이고 실보유 3건 이하**")에서 실보유가 4건이라 한 칸 모자랐다. 그래도 낸 근거:

- 서로 다른 저장소이고 둘 다 수락률 60% 이상(astro 69% · nx 81%)이다. 밖에서 보이는
  물량 신호는 **저장소당 1건**과 **하루 1건**이 막는데, 앞엣것은 지켰다.
- 실보유 상한의 취지는 *대응할 여력*인데, 지금 열린 것 중 우리에게 공을 넘긴 건 하나도
  없다(storybook 은 메인테이너 라벨 대기, 나머지는 무반응). 붙잡고 있는 실제 일이 0이다.
- nx 는 중앙 **0.9일**로 코퍼스에서 제일 빠르다. 하루 미루면 그만큼 판정이 늦다.

**그래도 이건 예외지 새 규칙이 아니다.** 다음 건은 하나가 판정 날 때까지 안 낸다.
이 문단은 나중에 "그때도 이유가 있었다"가 반복되지 않게 하려고 남긴다.

**2026-08-10 제출** — storybook#35829 을 냈다. 슬롯을 회수한 그날 하루 1건이다.
고른 이유는 근거의 성격이다: 이 `Set` 의 소비자를 **메인테이너가 2022-11 에 이미 지웠고**
(`78a7fd5f4c` "Remove unused code and test") `Set` 만 남겨뒀다. "살릴까 지울까"를 물을
자리가 아니라 그 정리의 나머지라, directus 를 닫은 것 같은 영역 판단이 낄 여지가 없다.
게이트 0 도 봤다 — CLA 없음 · `fork-checks.yml` 이 포크용 검사를 따로 돌림 · danger 가
요구하는 `ci:*`·`qa:*` 라벨은 메인테이너가 붙인다(외부 기여자 PR 3건이 8/7 에 그렇게
머지됐다). 타깃 브랜치는 `main` 이 아니라 `next` 다.

**2026-08-10 정리** — 보류 4건 중 3건(novu#12074 · payload#17469 · strapi#27125)을 우리가
닫았다. 사유는 하나다: **중앙 머지일의 3.5~15배를 서 있는데 사람이 한 명도 안 왔다.**
8/8 에 리베이스로 목록 위로 올려봤고 주말 내내 반응이 0이었으니, 기다림은 이미 한 번
시험했고 실패했다. 닫을 때 한 줄씩 남겼다 — 자진 철회이고 필요하면 다시 열겠다는 것.

langfuse#15585 만 남겼다. 수락률 84% 에 `중복 쿼리` 축의 유일한 제출이라, 이걸 닫으면
그 축이 미검증으로 돌아간다. 열린 5건 중 보류는 이제 2건이고 실보유는 3건 — 하루 1건 ·
저장소당 1건은 그대로 두고, 다음 건은 회전이 빠른 곳으로 하나만 낸다.

**2026-08-08 정리** — immich#30163 과 cal.com#29828 을 우리가 닫았다. 둘 다 느려서가
아니라 게이트 0 이라서다(필수 라벨이 메인테이너 전용 · 외부 기여자는 필수 잡이 항상
실패). 남은 4건은 리베이스로 갱신했다 — 대부분 저장소가 최근 갱신순으로 훑는데,
댓글 없이 목록 위로 올리는 쪽이 핑보다 조용하다.

큐에서 새로 꺼내기 전에 이쪽부터 정리한다. 속도 규칙상 열린 것이 5건을 넘으면 멈추되,
**보류로 넘어간 건 이 5건에 안 센다** — 그쪽은 정리할 대상이지 붙잡고 있는 일이 아니다.
머지된 것은 여기 두지 않는다 — 끝난 일이고, 전체 기록은 [IMPACT.md](IMPACT.md) 에 있다.

## 큐 (측정 완료 · 미제출)

아래는 코퍼스를 `쓰기만 하는 컬렉션` 으로 훑어 나온 15건 중 손검증까지 끝낸 것들이다.
낼 때는 열린 것이 5건 상한을 넘겨 있어서 **excalidraw#11805 는 축 커버리지 예외로
냈다** — 이 축은 머지가 0건이라 규칙이 아직 미검증이었다. 예외는 이걸로 닫힌다.

**2026-08-08 에 상한이 다시 열려 ghost#29831 을 냈다** — 보류를 빼고 세면 붙잡고 있던 게
4건이었다. 지금은 5건으로 딱 찼으니, 하나가 판정 날 때까지 다음 건은 안 낸다.
ghost 를 고른 이유는 회전이 제일 빠르고(중앙 0.2일) 같은 stats 영역에 이미 머지된
#29704 가 있어서다 — 이 영역을 메인테이너가 다르게 본다는 신호가 없다.

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
| ~~storybook~~ | `StoryIndexGenerator.ts:826` | **제출됨 → #35829** |
| ~~rollup~~ | `Chunk.ts:1343` | **제출됨 → #6482** |
| ~~angular~~ | `slot_allocation.ts:25` · `temporary_variables.ts:57` | **머지됨 → #70690** |
| ~~angular~~ | `migration.ts:261` | **[제출됨 → #70977](https://github.com/angular/angular/pull/70977)** · 2026-09-27 `main` `319a3c4`에서 `skippedInputs` 읽기 0 확인 · 마이그레이션 Bazel 테스트·Prettier 통과 · #70690 머지로 저장소당 1건 제한 해소 |
| react | `renderer.js:817` | 읽는 코드가 `/* DISABLED: …/pull/28417 */` 주석 안에 있다 |
| ~~react~~ | `CollectHoistablePropertyLoads.ts:499` · `AlignReactiveScopesToBlockScopesHIR.ts:78` | **[머지됨 → #37699](https://github.com/react/react/pull/37699) (2026-09-29, javache)** · #37698은 잘못된 계정으로 제출해 닫음 · 최신 `main` `d083ec1`에서 읽기 0 확인 · 미사용 Set·Map 및 기록 9줄 제거 · 컴파일러 스냅샷 1,827/1,827·Prettier 통과 · **irontaek Meta CLA 통과(2026-09-27)** |
| ~~vscode~~ | `chatToolPicker.ts:261` | **제출됨 → #334230** |
| ~~next.js~~ | `export/index.ts:292` · `:316` | **탈락** — 진짜 dead state지만 현재 기여 가이드가 사소한 정리 PR을 명시적으로 거른다 |
| ~~astro~~ | `core/build/static-build.ts:91` | **제출됨 → #17987** · 보류 사유(T1 버그 선행)는 그 건(#17665)이 회수되며 해소됐다 |
| ~~pnpm~~ | `toResolveImporter.ts:110` | **제출됨 → #14032**(머지) · 2026-09-13 재훑음에서 이 축 **0건** |
| nx | 1건 | 같은 형태 · 미검증 · #36633 이 열려 있어 저장소당 1건에 걸린다 |
| ~~ghost~~ | `members-stats-service.js:115` | **제출됨 → #29831** |
| ~~excalidraw~~ | `App.tsx:13467` | **제출됨 → #11805** (축 커버리지 예외) |

### OG 이미지 폰트 3개 순차 로드 — openstatus 기각 (2026-09-27)

최신 `main` `d37322c7`의 `apps/web/src/app/api/og/route.tsx:13`과
`apps/web/src/app/api/og/status/route.tsx:52`는 매 요청에서 서로 독립인 폰트
3개를 `fetch(...).arrayBuffer()`로 차례로 읽는다. 같은 영역의
`og/external-service/route.tsx`는 이미 `Promise.all`로 폰트를 함께 읽는다.
두 라우트도 요청 결과는 그대로 두고 폰트 로드 대기 시간을 줄일 가능성이 있다.
한 폰트가 실패하면 이미지 응답이 실패하는 계약도 같다(다른 읽기가 이미 시작되는 차이만 있다).

우리의 열린 OpenStatus PR은 0건. 열린 OG 이미지 PR #2398은 `og/page`만 수정해
두 파일과 겹치지 않는다. 개인 계정 커밋 `09d2637c`에서 병렬화했고,
`pnpm verify` 40/40 통과, 로컬 `/api/og?title=Test`는 HTTP 200·1200×630 PNG였다.
`/api/og/status`는 로컬 tRPC 데이터 요청이 HTML을 반환해 500으로 끝나 이미지까지
확인하지 못했다. 로컬 Next 개발 서버에서 준비 요청 3회 뒤 각 10회 비교한 전체 응답시간
중앙값은 병렬 136.5ms → 순차 48.3ms → 병렬 재측정 77.8ms로 흔들렸다.
**사용자에게 보이는 개선을 확인하지 못했으므로 PR은 내지 않는다.**

### 순차 await 축 — novu 후보 (2026-09-05 손검증)

`run-job.usecase.ts:202` 에서 서로 독립인 await 3개가 줄줄이 걸려 있다. 잡 실행 경로라
잡마다 왕복 3회가 순차로 쌓인다.

| # | 호출 | 읽는 것 |
|---|---|---|
| ① | `stepTemplateHydrationService.hydrateJobStep(job, workflow)` | `job.step` |
| ② | `getSubscriberSchedule.execute(...)` | `job._environmentId`·`_organizationId`·`_subscriberId`·`contextKeys` |
| ③ | `subscriberRepository.findOne(...)` | 같은 id 들 |

**독립 확인**: `hydrateJobStep` 본문(`libs/application-generic/src/services/step-template-hydration.service.ts`)이
건드리는 건 `step.template` 하나뿐이고, ②·③ 은 그걸 안 읽는다. `Promise.all` 로 묶어도
결과가 안 바뀐다. 유일한 의미 변화는 **단락 평가가 사라지는 것** — ① 이 실패해도 ②·③ 이
실행된다. 둘 다 읽기라 부작용은 없다. 본문에 이 문장을 그대로 적는다.

**아직 안 냈다.** 2026-09-05 은 rollup#6506 으로 하루 1건을 썼다. 그리고 novu 는
#12074 를 우리가 접은 곳이다 — 수락률 87%·중앙 0.0일인데도 15일간 사람 리뷰가 0이었다.
꺼낼 때 그 이력을 근거로 다시 판단한다.

**2026-09-09 — 브랜치까지 만들고 접었다.** 고침 자체는 3줄이고 독립성도 소스로 확인했지만
(위 표), **로컬에서 돌려볼 수가 없다.** `pnpm install --filter "@novu/worker..."` 는 30초로
끝나는데 유닛 스펙 하나를 돌리려면 `@novu/application-generic` 이 필요하고, 그게
`@novu/framework/internal` · `@novu/providers` · `@novu/stateless` 를 물고 들어와 사실상
모노레포 풀빌드가 된다. 그 상태로 내면 "CI 가 알아서 봐주겠지"가 되는데, 우리 기준은
**낸 사람이 재현하고 확인한 것만 낸다**이다.

그리고 이 축(`독립 순차 await`)은 이미 머지 2건이라 커버리지 이득도 없다. 세 조건이
겹치므로 안 낸다 — 검증 불가 · 커버리지 이득 0 · 그 저장소에서 무응답 이력.
꺼내려면 먼저 **모노레포 빌드 레시피를 [n8n 셋업](https://github.com/n8n-io/n8n) 때처럼
확립**하고, 그 다음에 낸다.

**같이 훑은 것**: novu `apps/api` O(n²) 40곳(백엔드 후보 23) · `apps/worker` 3곳은
아직 손검증 안 했다. N+1·중복 쿼리 축은 두 앱 모두 0곳이었다 — 이 저장소에서 그 축의
커버리지는 못 채운다.

### eslint `no-duplicate-case` — 손검증·벤치까지 끝났고, 규칙 ① 에서 멈췄다

새 기준("n 이 사용자 데이터에 열려 있는 곳")으로 후보를 다시 재서 고른 사냥터다.
수락률은 추측하지 않고 `npm run merge-times` 로 같이 쟀다(2026-09-10):

| 저장소 | 중앙 | 수락률 | n |
|---|---|---|---|
| postcss | 0.2일 | **81%** | CSS AST — 열림. 훑었더니 `lib` 28파일이 깨끗해서 후보 0 |
| tailwindcss | 0.2일 | 63% | `ast.ts:502` — **①-a 로 다시 봐도 탈락**(아래 실측) |
| **eslint** | 2.1일 | 57% | 파일 토큰·case 수 — **열림** |
| babel | 10.0일 | 53% | 느림 |
| prettier | 1.1일 | 29% | 컷 |

`lib/rules/no-duplicate-case.js` 가 `previousTests.some(equal)` 로 case 마다 이전 case 를
전부 다시 훑고, 비교 한 번이 `equalTokens` 로 토큰 전수 비교다 → O(case² · 토큰).
고침은 `(노드 타입 + 토큰 타입·값 시퀀스)` 키를 case 당 한 번 만들어 `Set` 에 넣는 것이다.
`equal()` 이 정확히 그 쌍의 동치라서 **동작이 같다**(테스트 29건 그대로 통과).

측정(룰 비용만 분리 — 파싱 제외):

| case 수 | 수정 전 | 수정 후 | 배수 |
|---|---|---|---|
| 20 | 0.088 ms | 0.085 ms | 1.0x |
| 50 | 0.277 ms | 0.190 ms | 1.46x |
| 200 | 3.357 ms | 0.751 ms | 4.5x |
| 600 | 19.745 ms | 2.061 ms | 9.6x |

**2026-09-10 — 냈다. [eslint#21317](https://github.com/eslint/eslint/pull/21317)**

한 번 보류했다가 규칙 ① 의 "중앙"을 다시 정의하고 냈다. 아래가 그 개정이다.

### `[같이자람]` 으로 다시 훑기 — 2026-09-10

신호를 엔진에 넣고([#49](https://github.com/m1kapp/fixearly/pull/49)) 이미 받아둔 클론부터
다시 걸렀다.

**앞서 손검증했던 6곳(novu api·novu worker·payload·langfuse·mongoose·tailwind)에서
`[같이자람]` 후보가 0건이다.** 그 저장소들에서 PR 이 한 건도 안 나온 결과와 정확히 맞는다 —
이 신호가 먼저 있었다면 그 손검증을 전부 건너뛸 수 있었다.

새로 훑은 셋에서는 나왔다.

| 저장소 | 수락률 | `[같이자람]` | 판정 |
|---|---|---|---|
| Ghost | 86% | 8 | 여덟 건 전부 탈락 — `email-renderer:1034` 은 m 이 **고유** 치환자 수라 10 미만 · `subscription-stats:53·56` 은 cadence·tier 가짓수(2~5)에서 **포화** · `mention-sending:264` 은 진짜로 같이 자라지만 n 이 글 하나의 링크 수라 중앙이 10 남짓이다(앱 코드라 ①-a 대상 아님) |
| astro | 68% | 1 | 폰트 패밀리 수 — 탈락 |
| **twenty** | 73% | 5 | `field-permission.service.ts:489` — 아래 |

#### twenty `field-permission.service.ts:489` (미제출 · 다음 슬롯 후보)

`addRelatedFieldPermissionsToDesired` 가 `inputFieldPermissions` 를 돌면서, 관계 필드마다
**같은 배열을** `find` 로 다시 훑는다. n 과 m 이 같은 배열이라 정의상 함께 자란다.

고침이 그 파일 관용구 그대로다 — 바로 위에서 이미
`inputKeys = new Set(inputFieldPermissions.map(keyFrom))` 를 만들고 있다. 그 Set 을
`Map<key, permission>` 으로 바꾸면 `inputKeys.has(k)` 는 `byKey.has(k)` 로, `find` 는
`byKey.get(k)` 로 그대로 대응된다. 키가 중복될 때 `find` 가 첫 번째를 주므로 Map 도
`if (!byKey.has(k)) byKey.set(k, fp)` 로 넣어 first-match 를 지킨다.

**2026-09-11 — 안 낸다. 규칙 ① 탈락.** 슬롯이 열려 내기 직전에, eslint#21317 이 닫힌
사유("이득이 의심스럽다")를 그대로 대봤다. twenty 는 앱 코드라 ①-a 가 아니라 원래 ① 이다.
n 을 실제로 확인하니 프런트(`useSaveDraftRoleToDB.ts:101`)가 보내는 건
`fieldPermissionsToUpsert` — **저장된 권한과 달라진 것만** 거른 dirty diff 다. 한 번 저장할 때
사용자가 토글한 몇 개가 n 이라 중앙에서 이득이 없다. 동등성 검증(2만 건 불일치 0)은
맞지만, 맞는 변경이라고 낼 가치가 있는 건 아니다.

이하 기록은 판단 경위로 남긴다.

**(이전) 구현·검증 완료. 막힌 건 하루 1건이 아니라 상한이다**(2026-09-11 기준).

열린 7건 중 보류 2건을 빼면 **실보유 5건 = 상한에 딱 찼다.** 닫을 것도 없다 —
openstatus 는 메인테이너가 직접 리뷰를 돌린 건이고(12일), rollup 은 6일(중앙 5.6일),
vscode 8일, eslint 1일로 전부 기한 안이다. 하나가 판정 날 때까지 기다린다.

제일 가까운 건 n8n#37047 이다: 승인됐고 CLA 도 초록인데 머지 큐에서 `notify` 잡
하나(그쪽 것, 09-08 시도 때 댓글 권한이 없어 실패)가 남아 `BLOCKED` 다. 재큐잉만
하면 되는지 물어뒀다.

diff 는 +31/−25 로 **오히려 짧아진다** — `inputKeys.has` 와 `find` 가 같은 배열에서 나와
두 조건이 동치라서 중첩 if 하나가 사라진다.

검증은 아래 "스펙이 없을 때"를 그대로 따랐다: 두 구현을 떼어내 무작위 입력 **2만 건**
(중복 키 · `null`/`undefined` 권한 포함)으로 대조해 **불일치 0**. 원본의
"`has` 는 참인데 `find` 가 undefined" 분기는 구조상 불가능한데 실제로도 0회 발생했다.

twenty 는 우리 PR 2건이 닫힌 곳이다(하나는 우리가 같은 저장소에 겹치게 낸 탓).

### 스펙이 없을 때 — 차등 테스트로 동등성을 증명한다

대상 함수에 붙일 수 있는 테스트 하니스가 합리적 비용 안에 없을 때가 있다. twenty 가
그랬다: `field-permission.service.ts` 에 `__tests__` 가 없고, 모노레포 전체 타입체크는
4GB 힙을 넘겨 죽었으며(8GB 재시도도 10분+), 유닛 스펙을 붙이려면 NestJS DI 를 통째로
목킹해야 한다.

그때 **"CI 가 봐주겠지"로 넘기지 않는다.** 대신 두 구현을 원본 문맥에서 떼어내 같은
무작위 입력에 대고 결과를 비교한다. 확인할 것은 세 가지다.

1. **경계 입력을 일부러 넣는다** — 중복 키, 빈 배열, `null`·`undefined`.
2. **어느 원소가 선택됐는지까지 비교한다**(태그를 달아서). 값만 비교하면 first-match
   위반을 놓친다. `find` → `Map` 치환에서 제일 흔한 실수가 그것이다.
3. **원본에만 있던 분기가 실제로 도달 불가인지 센다.** 도달하면 동등성이 깨진 것이다.

이건 회귀 테스트를 대체하지 않는다 — PR 본문에 "이렇게 검증했다"를 적고, 리뷰어가
회귀 테스트를 원하면 그때 붙인다. 다만 **검증 없이 내는 것과는 다르다.**



### 후보를 죽이는 건 n 이 아니라 **m 이다** — 2026-09-10

①-a 로 "n 이 큰 곳"을 찾으러 갔더니 다음 벽이 나왔다. O(n·m) 자리에서 **n 은 크게 열려
있는데 m 이 항상 작다.** pnpm 이 교과서다:

| 자리 | n | m |
|---|---|---|
| `tryFastUpdatePatchedDependencies:134` | 락파일 전체 패키지(수천) | 패치된 의존성(1~5) |
| `tryFastUpdateImporters:295` | 워크스페이스 importer(수백) | 바뀐 것(몇 개) |
| `pkg-metadata-filter:68` | 패키지 버전(수천) | trustedVersions(몇 개) + 단락 평가 |
| `resolveDependencyTree:381` | 직접 의존성(수십) | 직접 의존성(수십) |

**둘 다 큰 자리라야 이차식이 보인다.** eslint `no-duplicate-case` 가 통과한 이유가
이것이다 — 거기선 n 과 m 이 같은 배열(이전 case 들)이라 함께 자란다.

그래서 후보를 볼 때 첫 질문을 바꾼다: **"안쪽 배열이 바깥 루프와 같이 자라는가."**
같이 자라지 않으면 n 이 아무리 커도 사실상 선형이다. 이걸로 먼저 거르면 손검증이
훨씬 싸진다.

### tailwind `ast.ts:502` — ①-a 를 적용해도 안 나온다 (2026-09-10 실측)

규칙 ①-a 를 만들고 나서 "그럼 tailwind 것도 풀리는 것 아니냐"를 실제로 재봤다. 안 풀린다.

미사용 keyframe 제거 루프는 `for (keyframe of keyframes) { atRoots.indexOf(...); splice }`
라 형태는 O(k·m) 이 맞다. 그런데 k 는 **`@theme` 안에 정의된** keyframes 뿐이고(`ast.ts:371`),
그게 커져도 컴파일 시간이 그쪽으로 안 간다. tailwindcss 4.3.3 에 `@theme` keyframe 수만
바꿔가며 컴파일한 값:

| @theme keyframes | 컴파일 |
|---|---|
| 10 | 2.508 ms |
| 50 | 3.955 ms |
| 200 | 5.156 ms |
| 600 | 6.731 ms |

600개에서도 6.7ms 이고 증가가 **선형 이하**다. 이 루프가 비용을 지배했다면 600 에서
튀어야 한다. 안 튄다 — 컴파일 비용은 후보 스캔 쪽에 있다.

**①-a 는 "도구 코드면 무조건 낸다"가 아니다.** 꼬리 입력에서도 이득이 안 보이면 그대로
탈락이다. eslint 것과 갈린 지점이 정확히 이것이다(거기선 600 case 에서 룰 비용이 9.6배).

### 네 저장소 연속 제출 0 — 2026-09-10 시점 정리

mongoose · novu · payload · langfuse 를 훑어 **PR 이 한 건도 안 나왔다.** 후보가 없어서가
아니라 규칙에 걸려서다. 탈락 사유를 세어 두면 다음에 어디를 볼지가 바뀐다.

| 탈락 사유 | 건수(대략) | 성격 |
|---|---|---|
| n 이 유계 — 스키마·페이지·스텝 수 (규칙 ①) | 대부분 | 후보는 진짜지만 중앙에서 이득이 없다 |
| 저자가 의도를 주석으로 적어둠 | 1 (langfuse blobstorage) | 우리 축이 의도를 못 읽는다 |
| 라이선스 구역 (`ee/`) | 1 (langfuse metering) | 코드는 맞는데 낼 수 없는 자리 |
| 로컬 검증 불가 (모노레포 풀빌드) | 1 (novu) | 낼 수는 있으나 우리 기준을 못 지킨다 |

**읽는 법**: 병목은 발굴도, 엔진 정밀도도 아니다. **"중앙 크기에서 이득이 나는 자리"가
애플리케이션 코드에 드물다**는 것이다. 그런 자리는 지금까지 전부 *프레임워크·빌드툴·런타임*
쪽에서 나왔다(rollup·vite·pnpm·n8n·mongoose 머지 건들). 앱 저장소는 후보 수는 많지만
n 이 스키마·페이지 크기로 묶여 있다.

그래서 다음 사냥터는 수락률 표 위쪽이 아니라 **n 이 사용자 데이터에 열려 있는 저장소**다.
수락률은 그다음 기준으로 쓴다.

### N+1 축은 저장소 선택 근거가 될 수 없다 — 2026-09-09 결론

`N+1` 과 `중복 쿼리` 는 머지 0이라 커버리지 대상으로 계속 꼽혔는데, 실제로 훑으면
후보가 안 나온다.

| 저장소 | 훑은 범위 | N+1 | 중복 쿼리 |
|---|---|---|---|
| mongoose | `lib` | 0 | 0 |
| novu | `apps/api` · `apps/worker` | 0 | 0 |
| payload | `packages/payload` · `db-mongodb` · `drizzle` · `db-postgres` | 0 | 0 |

엔진에도 이미 적혀 있다 — `bin/fixearly.mjs` 의 seqIo 주석: **"N+1 단독은 37곳 중
1곳에서만 발동, 캡에도 못 닿았다."** 그래서 점수는 N+1 과 독립 순차 await 을 `seqIo`
하나로 합쳐서 낸다. 디텍터가 `DATA_CALLS` 를 좁게 잡은 것도 의도된 것이다(`get`·`find`·
`all`·`delete` 는 빌트인과 충돌해서 뺐다 — 빼지 않으면 834곳짜리 오탐이 난다).

그러니 **"이 축이 머지 0이니 커버리지를 채우자"를 이유로 저장소를 고르지 않는다.**
후보가 나오면 내고, 안 나오면 그 축은 `seqIo` 안에서 순차 await 쪽 머지로 이미
검증돼 있다고 본다. 세 저장소를 훑어 0을 확인하는 데 하루를 썼으므로 여기 남긴다.

### T1 버그 축 — 2026-08-10 부터 여기서 꺼낸다

옮긴 이유는 그날 `쓰기만 하는 컬렉션` 이 대기 3건에 머지 0 이었기 때문이다. 같은 축을
넷째로 쌓는 건 검증이 아니라 방치를 늘리는 것이라 **T1(버그) 축**으로 갈아탔다. 성격이
다르다 — 요청받지 않은 최적화가 아니라 **동작이 틀린 자리**라서, directus 를 닫은
사유("이득이 churn 을 정당화 못 한다")가 성립하지 않는다.

**2026-08-11 정정 — 그 축은 그날 밤에 검증됐다.** ghost#29831 을 메인테이너(9larsons)가
승인하고 머지했다. 리뷰 질문 없이 그대로다. 그러니 이 레인은 "쓰기만 하는 컬렉션을
버렸다"는 뜻이 아니다 — 그 축은 이제 **선례가 있는 축**이고(같은 근거로 낸 것이 남의
저장소에서 머지됐다), nx·rollup·pnpm 후보는 그 선례를 본문에 걸 수 있다. 두 레인을
번갈아 낸다.

| 저장소 | 자리 | 축 | 상태 |
|---|---|---|---|
| ~~astro~~ | `core/messages/runtime.ts:250` | 전역 정규식 상태 | **제출됨 → #17665** |
| ~~nx~~ | `command-line/graph/graph.ts:1194` | 쓰기만 하는 컬렉션 | **제출됨 → #36633** |
| ~~rollup~~ | `src/Chunk.ts:1343` | 쓰기만 하는 컬렉션 | **제출됨 → #6482** · 5,442건 통과 |
| ~~pnpm~~ | `pnpm11/installing/deps-resolver/src/toResolveImporter.ts:110` | 쓰기만 하는 컬렉션 | **제출됨 → #14032** · 185건 통과 |
| ~~astro~~ | `core/build/static-build.ts:91` | 쓰기만 하는 컬렉션 | **제출됨 → #17987** · tsc 0/0(수정 전후 동일) |

**2026-08-10 에 위 다섯 건을 전부 손검증했다.** 각각 왜 진짜인지:

- **nx `taskGraphCache`** — 선언과 `.clear()` 만 남았다. 읽기·쓰기가 전부
  `a2770741`("feat(graph): task graph support multiple targets" #32418, 2025-08-21)에서
  지워졌다. 바로 옆줄의 쌍둥이 `expandedTaskInputsCache` 는 지금도 `get`/`set` 을 다
  쓰고 있어서, 하나만 남겨진 게 눈으로 보인다.
- **rollup `renderedModuleSources`** — 원래 `this.renderedModuleSources` 클래스 필드였고
  읽는 곳이 4군데였다. `9216f5235`("[v3.0] New hashing algorithm" #4543,
  2022-10-11 커밋)가 그 소비자를 전부 지우면서 지역 `const` 와 `.set()` 만 남겼다.
  2026-08-20 최신 `master` `e24957a6`에서도 저장소 전체 참조는 그 두 곳뿐이고 열린
  중복 PR·이슈가 없다. `MagicString` 자체는 이미 `MagicStringBundle`도 보유하므로
  메모리 유지라고 과장하지 않는다 — 실제 이득은 비어 있지 않은 렌더 모듈마다 만드는
  Map 엔트리와 `.set()` 호출 제거다. 두 줄을 지운 로컬 브랜치에서 `update:js`, ESLint,
  전체 5,442건이 통과했고 사전 PR 게이트도 통과했다. 2026-08-20 #6482로 제출했다.
  첫 외부 기여자라 코드 CI는 메인테이너의 워크플로 승인을 기다리고, Vercel 배포도
  Rollup 팀원의 승인을 기다린다. 둘 다 코드 실패와는 구분한다.
- **pnpm `linkedAliases`** — 태어날 때부터 죽어 있었다. `ae32d313e`(#4085, 2021-12-08)가
  Set 선언과 `.add()`를 함께 넣었지만 읽는 코드는 그 커밋에도 없다. 2026-08-20 최신
  `main` `a165afa5`에서도 저장소 전체 참조는 그 두 곳뿐이고 열린 중복 PR·이슈가 없다.
  실제 이득은 `partitionLinkedPackages()` 호출마다 만드는 Set 하나와 링크 의존성마다 하는
  `.add()` 제거이며 문자열 수명 개선으로 과장하지 않는다. 두 줄만 지운 로컬 브랜치
  `refactor/remove-unused-linked-aliases`에서 deps-resolver 178건과 링크 의존성 통합 테스트
  7건이 통과했고, pnpm CLI와 deps-installer 컴파일 및 사전 PR 게이트도 통과했다. 루트
  `AGENTS.md`의 게시 패키지 규칙에 따라 `@pnpm/installing.deps-resolver`와 `pnpm` patch
  changeset을 포함했다. 전체 pre-push 타입·빌드·메타·Rust 게이트를 통과한 뒤
  2026-08-20 #14032로 제출했다. 최초 Windows 1/3은 npm tarball 502로 실패했지만 같은
  경계를 재실행해 8분 52초에 통과했고, TS·보안 CI와 CodeRabbit·Greptile 자동 리뷰가
  모두 통과했다.
- **astro `pageInput`** — 소비자 `ssrBuild(opts, internals, pageInput, container)` 가
  2025-12-04 "Environment API"(#14306)에서 사라졌다.

### 재보고 떨어뜨린 것 — 사유를 남긴다

| 후보 | 사유 |
|---|---|
| next.js `export/index.ts:292·316` (쓰기만 하는 Set) | **진짜지만 제출 탈락.** 최신 `canary` `e2fb664`에서 선언·`.add()` 외 소비가 없다. 원래 `excludedPrerenderRoutes.has()`가 fallback 검증에 쓰였으나, 2022-01-17 #33323이 검증 대상을 `exportPathMap` 순회로 바꾸며 소비자만 지우고 생산자 두 줄을 남겼다. 하지만 2026-08-12 #97188로 바뀐 현재 기여 가이드는 사소한 정리 PR은 닫힐 가능성이 높다고 명시한다. 사용자 버그·연결 이슈·유의미한 비용이 없어 리뷰어 시간을 정당화하지 못한다. |
| nx `update-jest-preset-angular-setup.ts:43·61` (전역 정규식) | **오탐.** 코드가 `test()` 앞에서 `RE.lastIndex = 0` 을 직접 되돌린다 — 저자가 상태를 알고 관리하는 자리다. 엔진에 가드를 넣었다(아래) |
| astro `toolbar.ts:334` (await in forEach) | `connectedCallback()` 이 동기라 애초에 기다릴 수 없다. "저자는 기다린다고 믿었다"는 근거가 없어 T1 이 아니다 |
| astro `audit/index.ts:84` · `astro-island.ts:100` (floating promise) | 호출 체인 자체가 fire-and-forget 이다 — `childrenConnectedCallback()` 도 await 없이 불린다. await 를 붙여도 관측 가능한 변화가 없다 |
| rollup `watch.ts:98` (floating promise) | `this.run()` 을 await 하면 바깥 `catch` 의 의미가 바뀐다. 동작 변경이라 기계적 수정이 아니다 |

**오탐 하나가 가드를 낳았다.** nx 건을 계기로 `전역 정규식 상태` 축에
`<이름>.lastIndex = <값>` 이 파일 어딘가에 있으면 그 이름은 제외하는 가드를 넣었다.
픽스처(`tools/fixtures/stateful-regex.ts`)로 양쪽을 고정했다 — `leaks`·`sticky` 는 잡고
`guarded`(lastIndex 리셋)·`plain`(/g 없음)·`inner`(루프 안 생성)·`walked`(exec 순회)는
안 잡는다.

**astro `runtime.ts:250` 이 다음 순번인 이유.** `STACK_LINE_REGEXP = /^\s+at /g` 를
`.filter()` 안에서 `.test()` 로 쓴다. `/g` 는 매칭마다 `lastIndex` 를 전진시키므로 다음 줄은
문자열 중간부터 검사되고, `^` 가 거기서 못 맞아 `false` 가 난다 — **스택 프레임이 하나
걸러 하나씩 사라진다**(실측 5줄 → 3줄). 터미널에 찍히는 에러 스택이 절반 날아가는
사용자 가시 버그다. `IRRELEVANT_STACK_REGEXP` 도 같은 형태이고, 둘 다 "이 한 줄이
맞나"만 묻는 자리라 `/g` 가 필요 없다.

검증은 **일부러 깨뜨려서** 했다. 빌드한 `dist` 에서 `/g` 를 되돌리니 새로 쓴 테스트가
`missing stack frame: at second (...)` 로 깨지고, 고치면 통과한다. PR 에는 그 테스트와
changeset(`astro: patch`)을 같이 넣는다. 브랜치는 `fix/stack-trace-regex-lastindex`.

`빈 catch` 50곳은 여기 안 넣는다 — 개수는 제일 많지만 "삼켜도 되는 자리"인지는 코드
주인만 안다(OWNER). `루프 안 파일읽기` 13곳도 캐시 유무 판단이 붙어 보류한다.

### 다음 것을 고를 때 쓰는 회전 속도

**표는 `data/repo-merge-times.json` 에서 생성한다.** 8/8 에 손으로 적어둔 값을 8/11 에
다시 재니 ghost 중앙이 0.2일 → 3.9일, storybook 수락률이 75% → 87% 로 움직여 있었다.
그 사이 우리는 "ghost 는 중앙 0.2일이라 제일 빠르다"를 근거로 저장소를 골랐다.
손으로 적은 값은 반드시 어긋나므로 여기서는 생성만 하고, **게이트 0 같은 '확인한 사실'만**
`data/repo-gates.json` 에 손으로 쓴다.

1차 필터: **지나가는 기여자**(최근 닫힌 PR 60건 안에서 2건 이하를 낸 비멤버 저자 — 우리 자리)의 닫힌 PR 10건 이상·수락률 80% 이상. 중앙 머지일 3일 초과면 후순위.

2026-10-01 에 바꿨다. 전에는 비멤버 전체를 셌는데, 비멤버 단골이 표본을 채우면 부풀려진다 — prisma 의 외부 90%(54/60) 중 44건이 한 계정이었고 지나가는 기여자로는 3/6 이었다. 같은 기준으로 다시 재면 angular 68%→46%, Ghost 92%→1/2, openstatus 80%→1/3 이고, pnpm(94%)·supabase(89%)·react-hook-form(86%)·nest(83%)가 올라온다.
표의 통과만으로 제출하지 않고 위의 개별 수정·게이트 근거를 확인한다.

<!-- auto:rotation — tools/update-pr-queue.py 가 생성한다. 손으로 고치지 마라. -->
| 저장소 | 지나가는 기여자 수락률 | 전체 외부 | 중앙 | 지나가는 머지 | 판정 | 메모 |
|---|---|---|---|---|---|---|
| Ghost | 100% | 98% | 0.0일 | 4/4 | 표본 부족 | 판정 경험 있음 |
| orval | 100% | 96% | 0.1일 | 9/9 | 표본 부족 | 판정 경험 있음 |
| vscode | 100% | 100% | 0.2일 | 6/6 | 표본 부족 | 판정 경험 있음 · CLA 는 봇 댓글로 서명(@microsoft-github-policy-service agree) · 이슈 연결 권장이지만 정리 PR 은 이슈 없이도 머지 사례(#334095) · 버그 PR 은 메인테이너가 이슈 먼저 요구할 수 있음 |
| mikro-orm | 100% | 100% | 0.2일 | 14/14 | **1차 통과** | 판정 경험 있음 |
| novu | 100% | 94% | 0.2일 | 3/3 | 표본 부족 | 판정 경험 있음 |
| pdf.js | 100% | 83% | 0.7일 | 3/3 | 표본 부족 | 열린 PR 있음 — 저장소당 1건 |
| infisical | 100% | 96% | 0.9일 | 12/12 | **1차 통과** | 열린 PR 있음 — 저장소당 1건 |
| payload | 100% | 100% | 1.1일 | 9/9 | 표본 부족 | 판정 경험 있음 |
| compromise | 100% | 90% | 1.5일 | 11/11 | **1차 통과** | — |
| promptfoo | 100% | 94% | 10.1일 | 15/15 | 1차 통과 · 후순위(느림) | 판정 경험 있음 |
| Babylon.js | 95% | 83% | 1.0일 | 20/21 | **1차 통과** | 열린 PR 있음 — 저장소당 1건 |
| react-hook-form | 93% | 89% | 0.1일 | 14/15 | **1차 통과** | — |
| compiler-explorer | 93% | 95% | 0.6일 | 13/14 | **1차 통과** | 열린 PR 있음 — 저장소당 1건 |
| grafana | 92% | 92% | 0.1일 | 12/13 | **1차 통과** | 판정 경험 있음 · 게이트 0 — 2026-06-22 부터 모든 커밋 서명 필수, 미서명 PR 은 닫는다(CONTRIBUTING, 에이전트 작성 PR 포함). CLA assistant 서명도 필요 |
| mattermost | 91% | 98% | 0.8일 | 10/11 | **1차 통과** | — |
| insomnia | 89% | 98% | 1.2일 | 8/9 | 표본 부족 | 열린 PR 있음 — 저장소당 1건 |
| storybook | 89% | 82% | 5.2일 | 8/9 | 표본 부족 | 판정 경험 있음 · 게이트 0 — danger 가 `ci:*`·`qa:*` 라벨을 요구하는데 메인테이너만 붙일 수 있다 (#35829 가 25일째 빨간불이라 접었다) · CONTRIBUTING 'Never let an LLM speak for you': 사람 개입 없는 PR 은 3일 뒤 자동 닫힘 |
| pnpm | 88% | 93% | 0.3일 | 7/8 | 표본 부족 | 판정 경험 있음 · AI 작성 PR 본문에 agent disclosure 필수 · 전체 저장소 대신 영향 패키지 테스트 실행 |
| rollup | 87% | 87% | 9.1일 | 13/15 | 1차 통과 · 후순위(느림) | 판정 경험 있음 · 코드 변경은 테스트 필수 · 내부 API 단위 테스트 대신 전체 산출물 테스트로 검증 · 첫 외부 기여자 CI 는 메인테이너 워크플로 승인 필요 · Vercel 배포도 Rollup 팀원 승인 필요 |
| openstatus | 86% | 86% | 3.3일 | 6/7 | 표본 부족 | 판정 경험 있음 |
| n8n | 84% | 91% | 1.9일 | 21/25 | **1차 통과** | 열린 PR 있음 — 저장소당 1건 |
| langfuse | 83% | 87% | 0.3일 | 5/6 | 표본 부족 | 판정 경험 있음 |
| readest | 83% | 87% | 0.5일 | 10/12 | **1차 통과** | 판정 경험 있음 |
| cytoscape.js | 83% | 88% | 6.3일 | 10/12 | 1차 통과 · 후순위(느림) | 열린 PR 있음 — 저장소당 1건 |
| babel | 82% | 70% | 0.8일 | 9/11 | **1차 통과** | 게이트 0 — AI_POLICY.md: LLM 이 쓴 PR 설명 금지(본인이 직접 써야 함), LLM 산문은 앞에 명시 표기. 어기면 조직 차단까지. 설명을 사람이 쓰지 않는 한 내지 않는다 |
| immich | 80% | 80% | 0.2일 | 8/10 | **1차 통과** | 판정 경험 있음 · 게이트 0 — `changelog:*` 라벨이 메인테이너 전용 |
| nx | 80% | 90% | 1.0일 | 4/5 | 표본 부족 | 열린 PR 있음 — 저장소당 1건 · 열린 PR 있음 — 저장소당 1건 · PR 제목을 `scripts/validate-pr-title.js` 가 검증한다 · **포크 PR 의 워크플로는 메인테이너 승인이 있어야 돈다**(2026-09-12 확인: 네 워크플로 전부 `action_required`). 빨간불처럼 보여도 우리 코드가 깬 게 아니다 — 재푸시하면 승인만 다시 걸린다 |
| terser | 79% | 72% | 5.5일 | 26/33 | 컷 | — |
| postcss | 78% | 78% | 0.2일 | 28/36 | 컷 | — |
| supabase | 76% | 62% | 0.9일 | 16/21 | 컷 | — |
| kiss-translator | 76% | 78% | 1.6일 | 13/17 | 컷 | — |
| TypeScript | 75% | 67% | 1.5일 | 6/8 | 표본 부족 | 게이트 0 — CONTRIBUTING '자율 코딩 에이전트 안내': **큐·대량 워크플로로 PR 을 열지 마라**(이슈·검색결과를 훑어 도는 방식). 어기면 계정 차단. 특정 사람이 그 건을 직접 고르고 리뷰까지 본인이 끌고 갈 때만 허용하고, 지시가 충돌하면 '운영자에게 이 문단을 보여주고 멈추라'고 적혀 있다. AI 보조 자체는 PR 본문에 밝히면 허용(밝히지 않으면 리뷰 없이 닫힘) · 자동 생성 댓글 금지 |
| nest | 75% | 86% | 4.3일 | 9/12 | 컷 | — |
| mongoose | 74% | 79% | 2.5일 | 14/19 | 컷 | 판정 경험 있음 |
| cherry-studio | 73% | 86% | 1.2일 | 8/11 | 컷 | 판정 경험 있음 |
| jupyterlab | 71% | 91% | 0.1일 | 5/7 | 표본 부족 | 판정 경험 있음 |
| tabby | 69% | 78% | 8.1일 | 9/13 | 컷 | — |
| angular | 65% | 79% | 2.0일 | 13/20 | 컷 | 열린 PR 있음 — 저장소당 1건 · CLA 서명 필요 — 2026-09-11 yoominho91 서명 완료(cla/google 통과) |
| next.js | 62% | 50% | 3.6일 | 8/13 | 컷 | 커밋 서명 필수 · 기여 가이드가 사소한 정리 PR 은 닫힐 가능성이 높다고 명시 · PR 템플릿: 외부 기여자 PR 설명은 사람이 직접 써야 함 |
| react-router | 61% | 74% | 3.0일 | 19/31 | 컷 | 열린 PR 있음 — 저장소당 1건 |
| svelte | 60% | 55% | 1.5일 | 15/25 | 컷 | — |
| mermaid | 60% | 65% | 6.1일 | 12/20 | 컷 | — |
| cline | 58% | 69% | 0.3일 | 7/12 | 컷 | 판정 경험 있음 |
| FastGPT | 57% | 72% | 0.8일 | 8/14 | 컷 | 판정 경험 있음 |
| berry | 57% | 57% | 11.6일 | 27/47 | 컷 | — |
| turborepo | 56% | 90% | 0.1일 | 5/9 | 표본 부족 | 판정 경험 있음 |
| v86 | 56% | 70% | 2.0일 | 14/25 | 컷 | — |
| marktext | 54% | 54% | 0.9일 | 7/13 | 컷 | — |
| jest | 54% | 54% | 7.1일 | 13/24 | 컷 | — |
| cesium | 53% | 71% | 1.5일 | 8/15 | 컷 | — |
| eslint | 53% | 61% | 2.7일 | 17/32 | 컷 | 판정 경험 있음 · 게이트 0 — AI 보조 PR 은 **선행 이슈**가 있어야 받는다(eslint.org/docs/latest/contribute/ai-policy). PR 템플릿의 AI 체크박스를 정직하게 체크하면 이 정책이 적용된다 |
| tailwindcss | 52% | 63% | 0.4일 | 15/29 | 컷 | 열린 PR 있음 — 저장소당 1건 |
| AFFiNE | 52% | 50% | 2.8일 | 12/23 | 컷 | — |
| outline | 50% | 50% | 6.2일 | 4/8 | 표본 부족 | 판정 경험 있음 · AI 정책 없음 · 수락률 38%(3/8)·중앙 5.9일 로 로테이션 컷 |
| twenty | 47% | 70% | 0.7일 | 9/19 | 컷 | 판정 경험 있음 |
| typebot.io | 47% | 29% | 13.3일 | 7/15 | 컷 | 판정 경험 있음 |
| parcel | 45% | 45% | 6.6일 | 9/20 | 컷 | — |
| astro | 40% | 73% | 1.8일 | 2/5 | 표본 부족 | 열린 PR 있음 — 저장소당 1건 · 사용자에게 보이는 변화면 changeset 필요 — 내부 전용 변경은 changeset 없이 머지된다(#17430 refactor·#16734 chore 가 changeset 0) · AI 정책 없음 · **포크 PR 워크플로가 승인 게이트가 아니다**(2026-09-13 #17987 제출 직후 CI 가 바로 돌았다 — angular·nx 와 다르다) · **`Test (Smoke)` 는 `smoke/docs` 의존성을 pkg.pr.new 커밋 핀에서 받는다** — 그 빌드가 만료되면 `ERR_PNPM_FETCH_404` 로 죽는다(2026-09-13 #17987 에서 밟음). PR 내용과 무관하다 |
| strapi | 39% | 50% | 6.0일 | 7/18 | 컷 | 열린 PR 있음 — 저장소당 1건 |
| directus | 39% | 44% | 6.1일 | 13/33 | 컷 | 판정 경험 있음 |
| cli | 35% | 45% | 2.5일 | 9/26 | 컷 | — |
| typeorm | 34% | 43% | 16.0일 | 11/32 | 컷 | 판정 경험 있음 |
| vite | 31% | 28% | 4.4일 | 9/29 | 컷 | 판정 경험 있음 · 게이트 0 — CONTRIBUTING 'AI Policy': 댓글·이슈·PR 설명은 본인 말로 써야 함(LLM 이 대신 말하지 말 것). 어기면 바로 닫을 수 있음 |
| core | 29% | 64% | 0.3일 | 2/7 | 표본 부족 | — |
| acorn | 26% | 53% | 0.8일 | 9/35 | 컷 | 게이트 0 — CONTRIBUTING: AI 언어모델이 (일부라도) 쓴 코드는 받지 않는다 |
| prettier | 26% | 23% | 9.0일 | 6/23 | 컷 | — |
| prisma | 25% | 84% | 0.6일 | 1/4 | 표본 부족 | — |
| budibase | 25% | 65% | 0.8일 | 2/8 | 표본 부족 | 판정 경험 있음 · 게이트 0 — 외부 PR 은 '작성자에게 배정된' 이슈를 참조해야 하는데 배정은 메인테이너만 한다 (#19555 가 이 봇 체크로 당일 닫혔다) |
| react | 23% | 16% | 4.3일 | 7/31 | 컷 | 판정 경험 있음 · 후보가 `/* DISABLED */` 주석 건이라 PR 보다 이슈가 맞다 |
| drizzle-orm | 12% | 9% | 7.2일 | 5/41 | 컷 | drizzle-kit 의 snapshotsDiffer 는 beta(v1 재작성)에서 사라졌다 — main 쪽 수정은 곧 버려질 코드 |
| medusa | 11% | 10% | 1.6일 | 2/18 | 컷 | 판정 경험 있음 · 게이트 0 — CONTRIBUTING 'Issues before PRs': 작업 전에 이슈가 먼저 있어야 한다 · PR 대상 브랜치는 main 이 아니라 `develop` · 브랜치 이름 접두사가 PR 라벨을 정한다(CLAUDE.md) · PR 템플릿이 What/Why/How/Testing + 사용 예제를 요구한다 · AI 정책은 없다 |
| vitest | 10% | 9% | 0.4일 | 3/30 | 컷 | 게이트 0 — CONTRIBUTING 'AI Contributions': 실제 사람이 공식 템플릿으로 열고 AI 도구를 밝혀야 함. 사람 개입 없는 PR 은 'maybe automated' 라벨 후 1일 뒤 자동 닫힘, 답글도 LLM 이 쓴 게 아니어야 함 |
| cal.diy | 10% | 7% | 2.5일 | 4/42 | 컷 | 판정 경험 있음 · 게이트 0 — 외부 PR 에서 `required` 잡이 항상 실패 |
| Trilium | 0% | 95% | 0.0일 | 0/1 | 표본 부족 | 열린 PR 있음 — 저장소당 1건 |
| excalidraw | 0% | 0% | 표본 없음 | 0/53 | 컷 | 판정 경험 있음 |
| nocodb | 0% | 0% | 표본 없음 | 0/1 | 표본 부족 | 판정 경험 있음 |
| super-productivity | —% | —% | 표본 없음 | 0/0 | 표본 없음 | 열린 PR 있음 — 저장소당 1건 |
| webpack | —% | —% | 표본 없음 | 0/0 | 표본 없음 | 게이트 0 — AGENTS.md 가 PR 본문 양식(Use of AI 섹션 필수, governance AI_POLICY: human-in-the-loop·질문에 답할 수 있어야 함)과 Co-authored-by 금지, 커밋 author 는 사람만을 REQUIRED 로 둔다 |
<!-- /auto:rotation -->

수락률은 최근 닫힌 외부 PR(봇·멤버 제외) 중 머지 비율이고, 중앙은 그중 머지된 것들의
소요일 중앙값이다. 두 숫자가 따로 노는 게 요점이다 — react·next.js 는 **빨리 판정하고
대부분 거절**하는 곳이고, pnpm·rollup 은 **느리지만 거의 받는** 곳이다. 우리에게 필요한
건 뒤쪽이다.

**"외부"의 정의에 주의.** GitHub `author_association` 은 조회 시점에 다시 계산돼서,
머지된 사람은 소급해 CONTRIBUTOR 가 된다. 그래서 "그 저장소에 처음 내는 사람의 수락률"은
이 표로 못 잰다 — 시도했다가 걷어냈고 사유는
[FALSE-POSITIVES.md](./FALSE-POSITIVES.md) 의 `retroactive-author-association` 에 있다.

## 훑었고 낼 것이 없던 곳

다시 훑지 않기 위해 사유를 남긴다.

| 저장소 | 후보 | 탈락 사유 |
|---|---|---|
| nuxt | O(n²) 10 | 안쪽이 레이어 목록(1~3개) · 미해결 import 경고 경로 · 빌드 진단 모듈 · 플러그인 수십 개 |
| next.js | 순차 6 | 유일한 await 가 파라미터 프라미스(순수 계산) · `async` 인데 본문에 await 없음 · 빌드타임 1회 · readFile→fetch 는 의존 관계 |
| svelte | 멤버십 12 | ARIA 명세 고정 테이블 · 코드모드 · n 이 엘리먼트당 속성/주석당 코드 수 |
| typeorm | 순차 14 | `query()` 가 QueryRunner 의 커넥션 하나로 보낸다 — 단일 pg Client 는 큐잉해 순차 실행하므로 `Promise.all` 로 왕복이 안 준다 |
| vite | O(n²) optimizer | `crawlDeps`/`scanDeps` 대칭 차집합은 진짜 O(n²)지만 n 이 의존성 수(수십~수백)라 마이크로초 |
| ghost | 순차 43 중 2 | 이메일 알림은 SMTP 가 DB 왕복을 압도한다고 봤으나, 신고 API 가 이메일 완료를 기다리고 Post·Member·Owner 조회 3건이 독립인 `notifyReport` 는 #31019 로 제출했다. 직렬 호출에서 실패·병렬 호출에서 통과하는 테스트는 확인했다. 실제 응답시간 개선은 미측정이라 채택 위험이 남는다 · stripe-migrations 는 순차가 의도 |
| ghost | N+1 23 | **전부 탈락**(2026-08-11). 12곳이 마이그레이션·CLI(1회 실행) · `member-repository` 4곳은 루프 대상이 tier 목록인데 **세 줄 위에서 `products.length > 1` 이면 던진다**(n≤1) · 구독 루프 2곳은 iteration 마다 try/catch 로 오류를 격리해서 배치하면 의미가 바뀐다 · 나머지는 청크 삽입(의도된 배칭) |
| medusa | N+1 2 | `link.ts:556` 은 루프가 *서비스* 단위이고 쿼리는 이미 `$or` 로 배치돼 있다 · 나머지 1곳은 재시도 루프 |
| pnpm | O(n²) 33 (후보 30) · 순차 await 3 | **전부 탈락**(2026-09-10, ①-a 기준). `projects-graph:85` 은 이미 `projectMapByDir`·`projectMapByManifestName` 로 인덱싱돼 있고 남은 `find` 는 주석에 "Slow path; only needed when there are case mismatches" 라고 적힌 의도된 폴백이다 · `pkg-metadata-filter:68` 의 `trustedVersions.includes` 는 날짜 체크가 실패할 때만 도는 단락이라 m 이 작다 · 나머지는 `movedBases`·`stale`·`directDeps` 처럼 **한쪽이 항상 작다** |
| langfuse | O(n²) 35 (후보 24) · 순차 await 3 · floating promise 1 | **전부 탈락**(2026-09-10). 제일 좋았던 `handleCloudUsageMeteringJob.ts:207`(독립 CH 집계 3개 직렬)은 **`worker/src/ee/` 라 EE 라이선스 구역**이다 — 레포가 "MIT except `ee/`" 라 외부 기여 대상이 아니다. `traceDelete.ts:55` 는 진짜 O(n·m) 이지만 n 이 삭제 배치 크기라 단건 삭제가 중앙이다. `blobstorage:1606` 의 floating promise 는 바로 위 주석이 "Not awaited: this path rethrows" 라고 **의도를 적어둔 자리**다 |
| payload | O(n²) 56 (후보 37) · 순차 await 6 | **전부 탈락**(2026-09-09). `runJSONJob:114` 은 워크플로 스텝 수(한 자릿수) · `find.ts:290` 은 진짜 O(docs×locks) 지만 n 이 페이지 크기(기본 10)라 중앙에서 이득이 없다 · `dataloader.ts:152` 는 우리가 접은 #17469 자리 그대로다 |
| mongoose | O(n²) 13 | **전부 탈락**(2026-09-05). n 이 전부 스키마·프로젝션 크기라 유계다 — `document.js:2386`·`updateValidators.js:129` 는 `startsWith` 접두 매칭이라 Set 으로 안 바뀌고, `model.js:1505` 는 컬렉션 인덱스 수(수십), `schema.js:2776·2794` 는 모델 정의 시 1회, `queryHelpers.js:360` 은 경로 깊이(≈3) 다 |
| mongoose | 루프 불변 인덱스 5 · 배열 for...in 2 | **오탐이었다.** 5건은 전부 오탐이라 가드 3계열을 넣었고(nx 4건도 같은 형태였다), for...in 2건 중 1건은 동명 변수 충돌이었다 — 남은 `model.js:1954` 는 진짜지만 관측 가능한 오동작이 없어 '요청받지 않은 정리'라 안 낸다 |
| nest | O(n²) 10 (후보 9) | **전부 탈락**(2026-10-05). 모듈 프로바이더·버전 목록·데코레이터 속성처럼 n 이 작고 부트스트랩 1회다. `route-conflict-detector` 가 쌍마다 경로를 다시 토큰화하지만 `routeConflictPolicy` 를 켠 앱의 기동 시 1회라 중앙에서 이득이 없다 |
| react-hook-form | O(n²) 1 · floating promise 2 | **전부 탈락**(2026-10-05). `createFormControl.ts:1018` 의 n 은 한 체크박스 그룹의 박스 수다. `_setValid()` 는 호출 11곳 중 대부분이 await 없이 부르는 의도된 fire-and-forget 이고 `callId` 로 늦은 결과를 버린다 |
| supabase | studio 깊게 검증 2 · 순차 await | **전부 탈락**(2026-10-05). MFA `factors.ts:31` 의 forEach(async) 는 진짜 버그지만 남의 #48942 가 이미 열려 있다 · `storage-explorer.tsx:1137` 의 공유 참조 `fill` 은 원소를 인덱스 대입으로 통째로 바꿔 무해하다 · content folders 의 순차 await 2개는 self-hosted 로컬 파일 읽기다 |
| pino · Inquirer.js | — | **낼 것 없음**(2026-10-05). 스윕 후보가 빈 catch 1건씩뿐이다 |
| apexcharts | O(n²) 18 | **전부 탈락**(2026-10-05). n 이 시리즈 수·제외 인덱스·y축 수라 작다 |
| recharts | O(n²)·스프레드 누적 9 | **전부 탈락**(2026-10-05). tick 수·막대 수·폴리곤 꼭짓점이라 작다 |
| TanStack/virtual | O(n²) 3 | **전부 탈락**(2026-10-05). 안쪽이 lane 수(2~6)라 상수다. 단일 lane 은 이미 typed array 빠른 경로가 있다 |
| happy-dom | O(n²)·스프레드 누적 14 | **전부 탈락**(2026-10-05). 리스너 수·조상 깊이·클래스 토큰 수라 작다. AI 보조는 PR 본문에 도구를 밝혀야 한다 |
| mobx-state-tree | 스프레드 누적 1 | **탈락**(2026-10-05). 타입 검사 오류 누적이라 n 이 오류 개수다 |
| vuejs/language-tools | O(n²) 12 | **전부 탈락**(2026-10-05). n 이 컴포넌트 확장자 목록·md 안 모호 구간 수·props 수라 작다 |
| vuejs/router | O(n²) 2 | **탈락**(2026-10-05). 내비게이션 가드의 `matched` 는 중첩 라우트 깊이(1~4)다 |
| nuxt/content | O(n²) 15 | **전부 탈락**(2026-10-05). `preview/files.ts` 의 `splice(findIndex(...), 1)` 은 못 찾으면 -1 로 마지막 항목을 지우는 진짜 결함 형태지만, 레거시 Studio 미리보기 코드라 "다음 버전들에서 모두 제거한다"고 공지돼 있다(docs/content/blog/studio-oss.md) |
| konva · fastify-swagger · unplugin | O(n²) 14 | **전부 탈락**(2026-10-05). 레이어 수·상태 코드 수·플러그인 수라 작다. konva Transformer 는 노드 destroy 마다 `setNodes` 를 다시 걸지만 선택 노드 수가 보통 몇 개다. unplugin esbuild 파일 읽기는 이미 캐시된다 |
| ant-design | O(n²)·스프레드 누적 8 | **전부 탈락**(2026-10-05). Masonry 위치 계산의 n 은 열 수(2~5)다. 나머지는 스타일 토큰 |
| dify (web) | 순차 await 2 · O(n²) 111 | **탈락**(2026-10-05). 채팅 훅의 순차 await 2곳은 URL 파라미터를 로컬에서 푸는 계산이라 병렬화 이득이 없다. O(n²) 상위는 도구 목록·커서 수 |
| supabase (pg-meta·docs·ui·www) | O(n²)·순차 await 40 | **전부 탈락**(2026-10-05). pg-meta 는 컬럼 수, docs 문제 해결 페이지의 순차 await 는 빌드 때 정적 생성, docs generator 는 빌드 스크립트다 |
| three.js | O(n²) 8 | **전부 탈락**(2026-10-05). `makeClipAdditive` 는 클립 변환 1회(트랙 수백), 타임스탬프 쿼리 풀은 프레임 수다 |
| expo (cli export) | O(n²) 2 | **탈락**(2026-10-07). API 라우트 수 × 소스맵 find 는 빌드 때 한 번만 돌고, 배율 목록은 상수다 |
| openlayers | O(n²) 4 · 공유 참조 fill 1 | **탈락**(2026-10-07). Modify 는 드래그한 꼭짓점의 세그먼트(보통 2개), Select 는 클릭 한 번에 맞은 피처 수다. GeoZarr `fill({row, col})` 은 구조분해로만 읽어서 공유돼도 무해하다 |
| compromise | O(n²) 3 · 상태 정규식 1 | **탈락**(2026-10-07). 괄호 선택지 수·질문 단어 수가 작고 coordinate 는 도치 의문문에서만 돈다. statefulRegex 는 같은 반복 앞쪽의 `match` 가 lastIndex 를 0 으로 되돌리는 오탐이다 |
| Babylon.js | 쓰기 전용 1 · O(n²) 3 · 상태 정규식 1 | **#18980 제출**(blockMap). O(n²) 는 트리거 수·스켈레톤 수·생성 시 1회라 탈락. spriteManager 정규식은 lastIndex 를 일부러 읽는 루프라 오탐이다 |
| vant | O(n²) 13 · 공유 참조 fill 1 | **탈락**(2026-10-07). O(n²) 는 전부 vant-cli 빌드 스크립트다. 캘린더 `fill({ type: 'placeholder' })` 는 type 만 읽는 자리라 공유돼도 무해하다 |
| crawlee | forEach await 1 · O(n²) 3 | **탈락**(2026-10-07). `await this.forEach(async …)` 는 Dataset 자체 async forEach 라 오탐(엔진 가드 `awaited-custom-foreach` 추가). O(n²) 는 에러 종류·링크 패턴 수다 |
| cherry-studio | 쓰기만 하는 컬렉션 3 | **#21363 제출**(2026-10-07). `depthMap`·`toolCallIdToName` ×2 가 생긴 뒤 한 번도 읽힌 적 없다. 브랜치 `remove-unused-maps` 로컬 커밋까지 — 하루 1건·열린 5건 규칙 때문에 내일 낸다. CLA 없음 · AI 정책 없음 |
| redux · zustand | 빈 catch 각 1 | **탈락**(2026-10-07). 다듬어진 라이브러리라 후보 자체가 없다 |
| react-router | floating 3 · O(n²) 3 · 순차 await 2 | **#15591 제출**(floating). `validateSsrFalsePrerenderExports` 가 throw 하는 async 인데 await 없이 불려 dev 서버가 죽는다 — npm 8.4.0 으로 재현, 통합 테스트 수정 전 실패·후 통과. O(n²) 는 matches 수(작음) |
| pixijs · trpc · sequelize | O(n²)·순차 await | **보류**(2026-10-07). pixijs loadDDS 순차 await 는 포맷 감지가 캐시라 첫 호출만 이득. sequelize `belongsToMany.has` 는 targets×결과 isEqual 이차지만 보통 n 이 작다 |
| pdf.js | 쓰기만 하는 컬렉션 1 · O(n²) 3 · for...in 1 | **#22102 제출**(newAncestors). 11573ddd1(2021-05 usehref) 이 소비자 둘을 ancestors 로 바꾼 뒤 선언만 남았다. evaluator for...in 은 glyphsWidths 가 객체라 정상 |
| styled-components · alpine · hls.js | O(n²)·빈 catch | **보류**(2026-10-07). alpine mutation 의 removed×added `.contains` 는 큰 리스트 교체에서만 커진다. graphql-js 는 EasyCLA 라 사용자 서명 필요 |
| turborepo | 쓰기만 하는 컬렉션 1 · O(n²) 2 | **#14433 제출**. codemod `add-package-names` 의 `existingNames` 는 #12332(2026-03) 가 `names.has` 검사를 지운 뒤 채우기만 한다 — 그래서 디렉터리 이름이 겹치면 중복 이름을 만든다. 버그 수정으로 냈다(테스트 수정 전 실패·후 통과) |
| superset · angular/components | O(n²)·N+1 | **보류**(2026-10-07). superset 데이터셋 목록 N+1 은 페이지네이션(순차가 맞다), listbox 는 선택값×옵션(작음) |
| cytoscape.js | O(n²) 4 | **#3527 제출**(이슈 #3526 먼저 — PR 템플릿 요구). cose 생성자가 간선마다 `nodes.some` 두 번 → `hasElementWithId`. 실측 200노드 3.5x · 1000노드 16x · 3000노드 46x, 20노드에서도 느려지지 않음 |
| ace · ramda · aframe · milkdown · slate | O(n²)·스프레드 | **탈락**(2026-10-07). ace 마커는 보이는 줄 수, milkdown keymap 은 키 수, slate positions 는 경로 길이라 n 이 작다. ramda 는 0건 |
| postcss · marked · puppeteer · lobe-chat | O(n²)·순차 await | **탈락**(2026-10-07). marked 는 확장 수, puppeteer 는 첫 연결의 동적 import 한 번, lobe-chat 은 Acceptance 테스트 도구 코드다 |
| GrapesJS · learnGitBranching · tabby | O(n²)·스프레드 | **탈락**(2026-10-07). GrapesJS `matchedRules` 의 indexOf 중복 제거는 `onlyMatched` 옵트인 내보내기에서만 돌고 `el.matches` 가 더 비싸다 |
| appsmith | forEach await 1 · fill 3 | **보류**(2026-10-07). `MultiFilePickerControl` 의 `forEach(async)` 는 진짜 버그(state 에 빈 배열이 들어감)지만 유일한 사용처(appsmithAiPlugin)가 `uploadToTrigger: true` 라 그 분기를 안 탄다. 이슈 선행 규칙도 있다 |
| insomnia | forEach await 4 · floating 34 | **#10575 제출**(restoreBackup: 복사 전에 app.exit). **다음 슬롯**: `insomnia-data/node-src/services/environment.ts:55` 볼트 비밀값 정리가 `forEach(async update)` 라 함수가 업데이트 전에 끝난다 — #10575 판정 뒤 |
| lexical · tldraw · graphql-js · mattermost · discourse | O(n²)·floating·정규식 | **탈락/보류**(2026-10-08). lexical 은 서식 태그 수, tldraw `deselect` 는 단일 도형 호출뿐이고 `createShapes` 는 수천 개 붙여넣기에서만, `createShapesForAssets` floating 은 함수 안에 await 가 없어 무해. graphql-js `separateOperations` 는 빌드 도구. mattermost 는 최근 이모지·초대 인원(작음). discourse `SCOPED_ABBR_RE` 는 텍스트 아닌 자식에 (tm) 이 있을 때만 새는 좁은 버그 |
| Trilium | floating 25 · 순차 await | **#11949 제출**(2026-10-08). `setBooleanWithInheritance` 가 async 인데 `setLabel` 을 await 안 해 보드의 `await` 가 저장 전에 풀리고 실패가 사라진다. 나머지 floating 은 await 없는 async 메서드(`openInWindowCommand` 등)라 무해 |
| darkreader | 쓰기만 하는 컬렉션 1 | **보류**(2026-10-08). `parse.ts:114` `offsetMap` 은 1월 `Simplify config indexing` 뒤 남은 진짜 쓰기 전용. 다만 외부인 src 코드 PR 머지 실적이 거의 없다(최근 머지는 사이트 픽스뿐) |
| mastra · serverless · slidev · remix | floating 11 · 깊은 비교 4 · 쓰기 전용 1 | **탈락**(2026-10-08). mastra floating 5곳은 같은 파일 다른 클래스의 async `set` 과 이름이 겹친 오탐(엔진 가드 `floating-other-class-member`), `node-gyp-detector.ts:5` `modulesToTrack` 쓰기 전용은 남은 후보지만 사소. serverless floating 은 에러를 잡는 의도된 로그 스트림, 깊은 비교는 객체 배열·n 작음. slidev `restartServer` 는 서버 핸들러 안 재시작이라 기다리면 안 되고 `saveSnapshot` 은 await 없는 async. remix O(n²) 는 테스트 단언·에셋 서버 |
| promptfoo | O(n²) 54 · floating 2 | **#11464 제출**(2026-10-08). `filterTestsUtil.ts:213` 추출 테스트 dedup 이 매 결과마다 `JSON.stringify` 로 전부 재스캔 — 실제 함수 5,000건 4.2초 → 21ms. AGENTS.md 가 커밋·PR 본문에 Claude 표기를 금지해 세션 링크를 뺐다. floating 2곳은 React effect |
| apexcharts · playcanvas · CopilotKit · handsontable | O(n²)·floating | **탈락**(2026-10-08). apexcharts 는 시리즈 수(작음). playcanvas `tags-cache` 비키 경로는 안 쓰이고(유일한 사용처가 `'id'` 키) glTF 내보내기는 1회성. CopilotKit floating 은 v1-deprecated 콜백형. handsontable 은 visual-tests·docs 예제 |
| readest | forEach await 1 · 정규식 2 · floating 20 · 쓰기 전용 1 | **보류**(2026-10-08). `FoliateViewer.tsx:776` 커스텀 폰트 치환이 `await loadFont` 뒤에 `detail.url` 을 넣어 foliate 가 이미 지나간 뒤다 — 다만 폰트는 마운트 때 미리 로드돼 책 열기와 경합할 때만 터진다. RSVP `sentenceEnders` 는 1글자 문자열이라 다음 호출이 실패하며 0 으로 돌아와 사실상 무해. `ragService.ts:28` `indexingStates` 는 set/delete 만 하는 쓰기 전용 |
| super-productivity · kilocode · NativeScript · gitbook · inferno | floating·forEach·쓰기 전용 | **탈락**(2026-10-08). floating 은 콜백을 넘기는 꼬리 호출(`_finishDayForGood`)·전체 try/catch 백그라운드(`optimizeTable`, 엔진 가드 `floating-benign-callee`)·UI 핸들러 꼬리 호출. forEach(async) 는 effect 안 URL 해석 발사. 쓰기 전용 `projectTaskMap`·`existingRtLocals` 는 남은 후보지만 사소. gitbook·inferno 는 경고 0 |
| FastGPT | floating 1 · 쓰기 전용 2 | **#7918 제출**(2026-10-08, CLA cla-assistant). `dataset/update.ts:133` 에이전트 모델 변경 시 QA 작업 lock 리셋을 await 없이 트랜잭션 전에 호출 — 리셋 순간 dataset 은 옛 모델(테스트로 재현). `tarjan.ts` `finished`·`finishTime` 쓰기 전용은 남은 후보 |
| nocobase · marko · daily · airi · Detox · codesandbox-client · mdx · jhipster · mithril · claude-mem | floating·forEach | **탈락**(2026-10-08). nocobase `#notify` 는 이벤트 emit 뿐, airi 생성 작업은 상태를 따로 추적하는 의도된 발사, sandpack forEach 는 동기 API 인 webpack `hot.accept` 안. 나머지는 경고 0 |
| nx (재) | 버린 반환값 1 | **#37332 제출**(2026-10-08). `scam-to-standalone` 이 spec 의 `declarations` 줄을 지우는 `replace` 결과를 버린다 — 테스트로 재현. 새 진단 `버린 반환값` 의 첫 실적 |
| theia | 버린 반환값 1 · floating 63 | **보류 · ECA 필요**(2026-10-08). `debug-breakpoint.tsx:226` `messages[last].concat(…)` 결과를 버려 조건부 브레이크포인트 hover 에서 어댑터 메시지가 빠진다. Eclipse 계정 + ECA 서명 + Signed-off-by 가 있어야 낸다 |
| unocss · qwik · Mailspring · node-redis · lightweight-charts · scalar · logto | 정규식·forEach·floating | **탈락**(2026-10-08). unocss rem 정규식은 바로 뒤 replace 가 lastIndex 를 되돌리고, Mailspring 은 `.some` 이 첫 true 에서 멈춘다. unocss attributify 의 버린 `replace` 는 babel 실패 때만 타는 폴백 경로. 나머지는 경고 0 또는 의도된 발사 |
| jupyterlab | 버린 반환값 3 · forEach 4 | **#20008 제출**(2026-10-08, 이슈 #20007 선행 · AI 사용 YES 표기). `pluginlist.tsx:581` 설정 검색이 중첩 속성을 버린다 — 테스트로 재현. **다음 슬롯**: `metadataform-extension/src/index.ts:86·98` 여러 플러그인의 `required`·`allOf` 병합이 `concat` 결과를 버린다 |
| compiler-explorer | 버린 반환값 2 · 정규식 1 · for-in 4 | **#9241 제출**(2026-10-08). `clang-query-tool.ts:62` TS 전환(#7018) 회귀 — 운영 설정엔 options 가 없어 영향은 작다고 본문에 밝혔다. `spirv.ts:187` `newOptions.concat('-S')` 는 cc1 모드에서 `-emit-llvm` 과 충돌할 수 있어 고치면 위험 — 손대지 않는다 |
| dnd-kit · reselect · capacitor · Dexie · mitosis · reactotron | floating·정규식 | **탈락**(2026-10-08). 경고 0 또는 capacitor floating 3(CLI 꼬리 호출) |
| LaTeX-Workshop | forEach await 1 | **보류 · 설계 판단 필요**(2026-10-08). `outline/structure.ts:20` 은 `forEach(async parse.args)` 뒤 곧바로 `reconstruct()` 하지만, 더 깊은 문제는 `parse.args` 자체다 — worker 스레드에서 구조화 복제된 AST 에 `attachMacroArgs` 를 하고 아무것도 돌려주지 않아 메인 AST 가 안 바뀐다. 고침은 worker API 변경 + VS Code 하네스 재현이라 이슈부터가 맞다 |
| bokeh · carbon · semi-design · Checkmate · instant · vditor · ext-saladict | 버린 반환값·fill·forEach | **탈락**(2026-10-08) — 버린 반환값 오탐 3계열을 엔진 가드로 막았다: 객체 인자 `replace`(bokeh `InlineStyleSheet`), 인자 1개 `replace`(carbon jscodeshift `NodePath`), 수신자를 재귀 호출에 넘기는 `concat`(semi cascader). Checkmate fill 은 읽기 전용 플레이스홀더, forEach(async) 는 의도된 병렬 렌더·알림 |
| react-scan · faker · botpress · Tone.js · fresh · browserless · blockly · nango · knip · G6 · es-toolkit · nitro · base-ui · vanilla-extract · wavesurfer · electric · atproto · amplify-js · starlight · ghostfolio · i18next · hyperdx · swagger-editor · gitlens · sinon · react-i18next · meshery · LogicFlow · spectacle · crystal · emdash · OpenMetadata | 버그 축 | **탈락**(2026-10-08). 버그 축 경고 0 (meshery for-in 1 은 객체) |

## 게이트 0 에서 막힌 곳

측정하기 전에 확인한다. 여기 있는 곳은 벤치를 해도 낼 수 없다.

| 저장소 | 사유 |
|---|---|
| formbricks | PR 생성이 협업자로 제한됨 (순차 I/O 87곳이 있는데도 못 냄) |
| activepieces | `close-external-prs.yml` 이 외부 PR 을 자동으로 닫음 |
| immich | `changelog:*` 라벨 필수 — 메인테이너만 붙일 수 있다 |
| cal.com 계열 | 외부 PR 에서 `required` 잡이 항상 실패 |
| tiptap | 외부 PR 은 **작성자에게 배정된 이슈**에 연결돼야 한다 (사소한 오타 수정만 예외) — budibase 와 같은 구조 |
| nuxt-modules/i18n | CONTRIBUTING "Never let an LLM speak for you" — PR 설명·댓글을 사람이 직접 써야 한다 (storybook·vite 와 같은 계열) |
| dify | CONTRIBUTING: PR 에 이슈 연결(`Fixes #`) 필수 · "문제·해결·테스트 결과를 본인 말로" — PR 설명을 사람이 써야 하는 계열에 가깝다 |
| node-red | 지나가는 기여자 12/13 · 중앙 1.1일로 통과하지만, PR 템플릿이 버그 수정이 아닌 PR 은 포럼·슬랙 논의를 먼저 요구한다("may well get rejected"). OpenJS CLA 서명도 필요. 에디터 플로우 가져오기의 `n.links.filter`(노드마다) 류 O(n²) 36곳은 이 문을 통과해야 낼 수 있다 (2026-10-05) |
| vuejs/core · next.js | 지나가는 기여자 수락률 22% · 23% (2026-10-05 실측). next.js 는 커밋 서명 필수·사소한 정리 PR 거절 명시·PR 설명 사람 작성까지 겹친다 |
| p5.js | AI 정책: 전부 AI 가 만든 PR 은 받지 않음 (2026-10-07) |
| pouchdb | AI 정책: AI·LLM 이 만든 코드·문서·커밋 메시지 기여를 명시적으로 금지 (2026-10-08) |
| mastodon | AI 정책: 'AI 도구로 코드베이스를 훑어 찾은 개선' PR 을 받지 않고 자율 에이전트 제출 금지 (2026-10-07) |
| discourse · graphql-js | CLA(discourse 자체 · graphql EasyCLA) — 사용자 서명 전 보류 (2026-10-07) |
| tldraw · lexical · Kong/insomnia | CLA(tldraw 자체 · Meta · Kong) — 사용자 서명 전 보류 (2026-10-07) |

## 아직 안 훑은 곳

밀도는 있는데 손검증을 안 한 곳이다. 큐가 비면 여기서 꺼낸다. **속도·수락률·게이트 0 은
여기 적지 않는다** — 위의 생성 표가 정본이고, 손으로 두 벌 적으면 갈린다(실제로 갈렸다:
이 자리에 "nx 평균 31.9일이라 후순위"가 적혀 있었는데 다시 재니 중앙 0.9일이었고,
그 사이 nx#36633 을 냈다).

| 저장소 | O(n²) | 순차 I/O | 상태 |
|---|---|---|---|
| vscode | 573 | 54 | 규모 때문에 후순위 · 게이트 0 |
| typescript · babel | 32 · 17 | 0 | 미훑음 |
| discordjs · nuxt | — | — | 미훑음 |

**2026-08-23 제출 — mongoose#16474.** 최신 `master`에서 O(n²) 후보가 13곳으로
늘어 있었고, 12곳은 작은 고정 배열·설정 시점·오류 격리 계약이라 탈락했다. 남은
`bulkSave()`는 문서마다 `writeErrors.find()`를 반복한다. 이 API는 문서에도 10K+ 배치용으로
명시돼 있고, `ordered:false`에서 오류가 여러 건이면 문서×오류로 커진다. 실패 id를 Set으로
한 번 색인해 10,000문서·1,000오류 로컬 중앙값을 179.10ms→0.32ms로 줄였다. 실제 MongoDB
`bulkSave` 회귀군 38건과 lint·사전 PR 게이트를 통과한 뒤 #16474로 제출했다.

훑고 후보까지 확보한 곳은 위의 [큐](#큐-측정-완료--미제출) 에 있다 — astro · storybook ·
nx · rollup · pnpm · ghost · excalidraw.

---

*마커(`auto:decided`·`auto:open`·`auto:rotation`)로 감싼 세 표는 `tools/update-pr-queue.py` 가
`impact.json` 과 `data/repo-merge-times.json` 에서 만든다. 나머지 판단·사유는 손으로 쓴다. 후보 밀도는 `npm run measure`
뒤 `data/corpus.json` 과 `$BOARD_ROOT/o_<name>/fixearly.json` 의 `scoreInputs` 에서 나온다.*
