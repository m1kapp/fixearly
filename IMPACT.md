# fixearly — 실전 성과 (impact log)

fixearly가 **실제 오픈소스에서 찾아낸 이슈**와 그 결과. 점수판이 아니라 **증거**다 —
"점수"가 등급만 매기는 게 아니라, 진짜 고칠 것을 파일:줄 단위로 짚는다는 증명.

> **fixearly 임팩트 점수: 13**
> 머지된 PR 1개 = **+1점**. (draft·open = 0, 닫힘 = 0)
> _(fixearly가 실제로 고쳐 머지된 것의 누적 — 대상 repo의 점수와는 별개 지표.)_
>
> _(자동 생성 — `node bin/impact.mjs`. GitHub PR 상태 기준.)_

| 발견 | repo | 유형 | PR | 상태 | 점수 |
|------|------|------|----|------|------|
| `deleteBulkMetadata N+1` | [immich · 113k★](https://github.com/immich-app/immich) | N+1 (루프 안 순차 DELETE, item당 왕복 1회) | [#30163](https://github.com/immich-app/immich/pull/30163) | ❌ closed | — |
| `sync-agent findOne N+1` | [novu · 39.7k★](https://github.com/novuhq/novu) | N+1 (for 루프 안 findOne, 소스 통합당 쿼리 1회) | [#12074](https://github.com/novuhq/novu/pull/12074) | ❌ closed | — |
| `booking member diff O(n²)` | [cal.com · 48k★](https://github.com/calcom/cal.diy) | O(n²) 배열 조회 (루프 안 .some() 선형스캔 4회 → Set) | [#29828](https://github.com/calcom/cal.diy/pull/29828) | ❌ closed | — |
| `view-widget-upsert O(n²)` | [twenty · 55.9k★](https://github.com/twentyhq/twenty) | O(n²) 배열 조회 (4개 루프서 .find() 키조회 → Map) | [#23231](https://github.com/twentyhq/twenty/pull/23231) | ❌ closed | — |
| `nested relations hydration O(n²)` | [twenty · 55.9k★](https://github.com/twentyhq/twenty) | O(n²) 그룹핑/조회 (부모 레코드마다 관계행 전수 스캔 → Map) | [#23232](https://github.com/twentyhq/twenty/pull/23232) | ❌ closed | — |
| `lucky-user set rebuild in loop` | [cal.com · 48k★](https://github.com/calcom/cal.diy) | 루프 불변 인덱스 재구축 (while마다 new Set 재구축 → 호이스팅) | [#29832](https://github.com/calcom/cal.diy/pull/29832) | ❌ closed | — |
| `dataloader doc placement O(n²)` | [payload · 44.5k★](https://github.com/payloadcms/payload) | O(n²) (배치당 keys.findIndex 전체 스캔 — Map으로 O(1)) | [#17469](https://github.com/payloadcms/payload/pull/17469) | ❌ closed | — |
| `translations batch match O(n²)` | [medusa · 36.1k★](https://github.com/medusajs/medusa) | O(n²) (batch당 filter+some 전체 스캔 — Set으로 O(1)) | [#16188](https://github.com/medusajs/medusa/pull/16188) | ✅ merged | +1 |
| `markdown import merge O(n²)` | [outline · 40.4k★](https://github.com/outline/outline) | O(n²) (형제 out.find title 스캔 — Map으로 O(1)) | [#13117](https://github.com/outline/outline/pull/13117) | ✅ merged | +1 |
| `doc-metadata localization O(n²)` | [strapi · 73k★](https://github.com/strapi/strapi) | O(n²) (localization별 versions.find — 복합키 Map으로 O(1)) | [#27125](https://github.com/strapi/strapi/pull/27125) | ❌ closed | — |
| `parse-fields dedup O(n²)` | [directus · 37.7k★](https://github.com/directus/directus) | O(n²) (nested-field 중복제거 find 스캔 — Set으로 O(1)) | [#27978](https://github.com/directus/directus/pull/27978) | ❌ closed | — |
| `resource-mapper schema validation O(n²)` | [n8n · 202.8k★](https://github.com/n8n-io/n8n) | O(n²) (value별 schema.find — id Map으로 O(1)) | [#34899](https://github.com/n8n-io/n8n/pull/34899) | ✅ merged | +1 |
| `user field validation O(n²)` | [nocodb · 64.8k★](https://github.com/nocodb/nocodb) | O(n²) (value별 baseUsers.find ×4 — id·email Map으로 O(1)) | [#14309](https://github.com/nocodb/nocodb/pull/14309) | ✅ merged | +1 |
| `ExternalRequest field lookup O(n²)` | [budibase · 28.2k★](https://github.com/Budibase/budibase) | O(n²) (행 필드별 fieldNames.find — Set으로 O(1)) | [#19320](https://github.com/Budibase/budibase/pull/19320) | ❌ closed | — |
| `cart variant lookup O(n²)` | [medusa · 36.1k★](https://github.com/medusajs/medusa) | O(n²) 배열 조회 (장바구니 아이템마다 variants 선형 스캔 → Map) | [#16233](https://github.com/medusajs/medusa/pull/16233) | ✅ merged | +1 |
| `eval dataset item 반복 조회` | [langfuse · 33.9k★](https://github.com/langfuse/langfuse) | 중복 쿼리 (변수마다 동일 WHERE 로 같은 행 재조회 → 컬럼 합쳐 1회) | [#15585](https://github.com/langfuse/langfuse/pull/15585) | ⚪ awaiting review | — |
| `in-depth analytics 순차 await` | [typebot · 10.3k★](https://github.com/baptisteArno/typebot.io) | 독립 순차 await (독립 groupBy 3개 직렬 → Promise.all, 합→최댓값) | [#2572](https://github.com/baptisteArno/typebot.io/pull/2572) | ✅ merged | +1 |
| `loadTables 카탈로그 전량 재스캔` | [typeorm · 36.6k★](https://github.com/typeorm/typeorm) | O(n²) (테이블마다 columns·constraints·fks·indices 전량 스캔 — Map 그룹핑으로 O(1)) | [#12746](https://github.com/typeorm/typeorm/pull/12746) | 🟢 reviewing | — |
| `growth stats 집계 3회 직렬` | [ghost · 55.1k★](https://github.com/TryGhost/Ghost) | 독립 순차 await (postId 하나로만 매개되는 집계 3개 직렬 → Promise.all, 합→최댓값) | [#29704](https://github.com/TryGhost/Ghost/pull/29704) | ✅ merged | +1 |
| `pure CSS 청크 선형 조회` | [vite · 82.6k★](https://github.com/vitejs/vite) | O(n²) (청크 x import 마다 pureCssChunkNames 전량 스캔 — Set으로 O(1)) | [#23114](https://github.com/vitejs/vite/pull/23114) | ✅ merged | +1 |
| `resize 핸들러 안 미사용 Map` | [excalidraw · 130.8k★](https://github.com/excalidraw/excalidraw) | 쓰기만 하는 컬렉션 (포인터 이동마다 채우고 아무도 안 읽음 — 삭제) | [#11805](https://github.com/excalidraw/excalidraw/pull/11805) | ⚪ awaiting review | — |
| `member 통계 안 미사용 Map` | [ghost · 55.1k★](https://github.com/TryGhost/Ghost) | 쓰기만 하는 컬렉션 (날짜별 Map 을 채우고 아무도 안 읽음 — 삭제) | [#29831](https://github.com/TryGhost/Ghost/pull/29831) | ✅ merged | +1 |
| `invalidate() 안 미사용 Set` | [storybook · 91k★](https://github.com/storybookjs/storybook) | 쓰기만 하는 컬렉션 (파일 변경마다 채우고 아무도 안 읽음 — 소비자는 2022-11 에 이미 삭제됨) | [#35829](https://github.com/storybookjs/storybook/pull/35829) | ⚪ awaiting review | — |
| `스택 트레이스 절반 유실` | [astro · 62.2k★](https://github.com/withastro/astro) | 전역 정규식 상태 (/g 정규식을 filter 안에서 .test() — lastIndex 가 새어 프레임이 하나 걸러 사라진다) | [#17665](https://github.com/withastro/astro/pull/17665) | ⚪ awaiting review | — |
| `graph 명령 안 미사용 Map` | [nx · 29.3k★](https://github.com/nrwl/nx) | 쓰기만 하는 컬렉션 (선언과 .clear() 만 남았다 — 읽기·쓰기는 #32418 에서 사라졌다) | [#36633](https://github.com/nrwl/nx/pull/36633) | ⚪ awaiting review | — |
| `페이지 monitor 검증 뒤 중복 조회` | [openstatus · 9k★](https://github.com/openstatusHQ/openstatus) | N+1 (페이지 생성·수정에서 일괄 검증한 monitor를 루프마다 재조회 — Map 재사용) | [#2583](https://github.com/openstatusHQ/openstatus/pull/2583) | ✅ merged | +1 |
| `청크 렌더 안 미사용 Map` | [rollup · 26.3k★](https://github.com/rollup/rollup) | 쓰기만 하는 컬렉션 (비어 있지 않은 렌더 모듈마다 .set(), 읽기 없음 — 삭제) | [#6482](https://github.com/rollup/rollup/pull/6482) | ✅ merged | +1 |
| `의존성 분할 안 미사용 Set` | [pnpm · 36.3k★](https://github.com/pnpm/pnpm) | 쓰기만 하는 컬렉션 (함수 호출마다 Set 생성, 링크 의존성마다 .add(), 읽기 없음 — 삭제) | [#14032](https://github.com/pnpm/pnpm/pull/14032) | ✅ merged | +1 |
| `bulkSave 오류 문서 반복 매칭` | [mongoose · 27.5k★](https://github.com/Automattic/mongoose) | O(n²) 배열 조회 (문서마다 writeErrors.find 전체 스캔 → 실패 id Set으로 O(1)) | [#16474](https://github.com/Automattic/mongoose/pull/16474) | ✅ merged | +1 |
| `credential 삭제 완료 전 명령 종료` | [n8n · 202.8k★](https://github.com/n8n-io/n8n) | 버려진 Promise (forEach(async) 결과를 기다리지 않아 성공 로그·명령 종료가 삭제보다 먼저 발생 → Promise.all) | [#37047](https://github.com/n8n-io/n8n/pull/37047) | ⚪ awaiting review | — |
| `post relation 연결 반복 조회` | [ghost · 55.1k★](https://github.com/TryGhost/Ghost) | O(n²) (relation마다 전체 posts.find → id Map으로 O(1), 100건에서 id 조회 5,050→100) | [#30284](https://github.com/TryGhost/Ghost/pull/30284) | ⚪ awaiting review | — |

## 규칙

- fixearly가 찾은 이슈로 낸 PR만 기록한다.
- **손 검증 필수** — 정적 분석은 후보만 뽑는다. 오탐 PR은 툴 신뢰를 깎으므로 금지.
- **머지되면 +1.** 닫히면 0. 정직하게.

## 어떻게 찾았나

```bash
npx fixearly --dir=src --dead
```

`quality.io`(루프 안 파일읽기 + DB/HTTP 순차 await)와 `quality.dead`(knip)가 후보를 파일:줄로
뱉는다. SonarQube가 원리상 못 잡는 축이다. 나머지는 사람의 검증.
