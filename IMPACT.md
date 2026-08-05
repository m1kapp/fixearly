# fixearly — 실전 성과 (impact log)

fixearly가 **실제 오픈소스에서 찾아낸 이슈**와 그 결과. 점수판이 아니라 **증거**다 —
"점수"가 등급만 매기는 게 아니라, 진짜 고칠 것을 파일:줄 단위로 짚는다는 증명.

> **fixearly 임팩트 점수: 7**
> 머지된 PR 1개 = **+1점**. (draft·open = 0, 닫힘 = 0)
> _(fixearly가 실제로 고쳐 머지된 것의 누적 — 대상 repo의 점수와는 별개 지표.)_
>
> _(자동 생성 — `node bin/impact.mjs`. GitHub PR 상태 기준.)_

| 발견 | repo | 유형 | PR | 상태 | 점수 |
|------|------|------|----|------|------|
| `deleteBulkMetadata N+1` | [immich · 109.7k★](https://github.com/immich-app/immich) | N+1 (루프 안 순차 DELETE, item당 왕복 1회) | [#30163](https://github.com/immich-app/immich/pull/30163) | 🟢 reviewing | — |
| `sync-agent findOne N+1` | [novu · 39.4k★](https://github.com/novuhq/novu) | N+1 (for 루프 안 findOne, 소스 통합당 쿼리 1회) | [#12074](https://github.com/novuhq/novu/pull/12074) | ⚪ awaiting review | — |
| `booking member diff O(n²)` | [cal.com · 47.3k★](https://github.com/calcom/cal.diy) | O(n²) 배열 조회 (루프 안 .some() 선형스캔 4회 → Set) | [#29828](https://github.com/calcom/cal.diy/pull/29828) | ⚪ awaiting review | — |
| `view-widget-upsert O(n²)` | [twenty · 54.3k★](https://github.com/twentyhq/twenty) | O(n²) 배열 조회 (4개 루프서 .find() 키조회 → Map) | [#23231](https://github.com/twentyhq/twenty/pull/23231) | ❌ closed | — |
| `nested relations hydration O(n²)` | [twenty · 54.3k★](https://github.com/twentyhq/twenty) | O(n²) 그룹핑/조회 (부모 레코드마다 관계행 전수 스캔 → Map) | [#23232](https://github.com/twentyhq/twenty/pull/23232) | ❌ closed | — |
| `lucky-user set rebuild in loop` | [cal.com · 47.3k★](https://github.com/calcom/cal.diy) | 루프 불변 인덱스 재구축 (while마다 new Set 재구축 → 호이스팅) | [#29832](https://github.com/calcom/cal.diy/pull/29832) | ❌ closed | — |
| `dataloader doc placement O(n²)` | [payload · 44k★](https://github.com/payloadcms/payload) | O(n²) (배치당 keys.findIndex 전체 스캔 — Map으로 O(1)) | [#17469](https://github.com/payloadcms/payload/pull/17469) | ⚪ awaiting review | — |
| `translations batch match O(n²)` | [medusa · 35.6k★](https://github.com/medusajs/medusa) | O(n²) (batch당 filter+some 전체 스캔 — Set으로 O(1)) | [#16188](https://github.com/medusajs/medusa/pull/16188) | ✅ merged | +1 |
| `markdown import merge O(n²)` | [outline · 40k★](https://github.com/outline/outline) | O(n²) (형제 out.find title 스캔 — Map으로 O(1)) | [#13117](https://github.com/outline/outline/pull/13117) | ✅ merged | +1 |
| `doc-metadata localization O(n²)` | [strapi · 72.8k★](https://github.com/strapi/strapi) | O(n²) (localization별 versions.find — 복합키 Map으로 O(1)) | [#27125](https://github.com/strapi/strapi/pull/27125) | ⚪ awaiting review | — |
| `parse-fields dedup O(n²)` | [directus · 37.2k★](https://github.com/directus/directus) | O(n²) (nested-field 중복제거 find 스캔 — Set으로 O(1)) | [#27978](https://github.com/directus/directus/pull/27978) | ❌ closed | — |
| `resource-mapper schema validation O(n²)` | [n8n · 199.4k★](https://github.com/n8n-io/n8n) | O(n²) (value별 schema.find — id Map으로 O(1)) | [#34899](https://github.com/n8n-io/n8n/pull/34899) | ✅ merged | +1 |
| `user field validation O(n²)` | [nocodb · 64.4k★](https://github.com/nocodb/nocodb) | O(n²) (value별 baseUsers.find ×4 — id·email Map으로 O(1)) | [#14309](https://github.com/nocodb/nocodb/pull/14309) | ✅ merged | +1 |
| `ExternalRequest field lookup O(n²)` | [budibase · 28.2k★](https://github.com/Budibase/budibase) | O(n²) (행 필드별 fieldNames.find — Set으로 O(1)) | [#19320](https://github.com/Budibase/budibase/pull/19320) | ❌ closed | — |
| `cart variant lookup O(n²)` | [medusa · 35.6k★](https://github.com/medusajs/medusa) | O(n²) 배열 조회 (장바구니 아이템마다 variants 선형 스캔 → Map) | [#16233](https://github.com/medusajs/medusa/pull/16233) | ✅ merged | +1 |
| `eval dataset item 반복 조회` | [langfuse · 32.5k★](https://github.com/langfuse/langfuse) | 중복 쿼리 (변수마다 동일 WHERE 로 같은 행 재조회 → 컬럼 합쳐 1회) | [#15585](https://github.com/langfuse/langfuse/pull/15585) | ⚪ awaiting review | — |
| `in-depth analytics 순차 await` | [typebot · 10.2k★](https://github.com/baptisteArno/typebot.io) | 독립 순차 await (독립 groupBy 3개 직렬 → Promise.all, 합→최댓값) | [#2572](https://github.com/baptisteArno/typebot.io/pull/2572) | ⚪ awaiting review | — |
| `loadTables 카탈로그 전량 재스캔` | [typeorm · 36.6k★](https://github.com/typeorm/typeorm) | O(n²) (테이블마다 columns·constraints·fks·indices 전량 스캔 — Map 그룹핑으로 O(1)) | [#12746](https://github.com/typeorm/typeorm/pull/12746) | ⚪ awaiting review | — |
| `growth stats 집계 3회 직렬` | [ghost · 54.7k★](https://github.com/TryGhost/Ghost) | 독립 순차 await (postId 하나로만 매개되는 집계 3개 직렬 → Promise.all, 합→최댓값) | [#29704](https://github.com/TryGhost/Ghost/pull/29704) | ✅ merged | +1 |
| `pure CSS 청크 선형 조회` | [vite · 82.2k★](https://github.com/vitejs/vite) | O(n²) (청크 x import 마다 pureCssChunkNames 전량 스캔 — Set으로 O(1)) | [#23114](https://github.com/vitejs/vite/pull/23114) | ✅ merged | +1 |
| `resize 핸들러 안 미사용 Map` | [excalidraw · 129k★](https://github.com/excalidraw/excalidraw) | 쓰기만 하는 컬렉션 (포인터 이동마다 채우고 아무도 안 읽음 — 삭제) | [#11805](https://github.com/excalidraw/excalidraw/pull/11805) | ⚪ awaiting review | — |

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
