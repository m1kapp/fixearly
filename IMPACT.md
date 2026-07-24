# cleanscore — 실전 성과 (impact log)

cleanscore가 **실제 오픈소스에서 찾아낸 이슈**와 그 결과. 점수판이 아니라 **증거**다 —
"청결점수"가 등급만 매기는 게 아니라, 진짜 고칠 것을 파일:줄 단위로 짚는다는 증명.

> **cleanscore 임팩트 점수: 0**
> 머지된 PR 1개 = **+1점**. (draft·open = 0, 닫힘 = 0)
> _(cleanscore가 실제로 고쳐 머지된 것의 누적 — 대상 repo의 청결점수와는 별개 지표.)_
>
> _(자동 생성 — `node bin/impact.mjs`. GitHub PR 상태 기준.)_

| 발견 | repo | 유형 | PR | 상태 | 점수 |
|------|------|------|----|------|------|
| `deleteBulkMetadata N+1` | [immich · 108k★](https://github.com/immich-app/immich) | N+1 (루프 안 순차 DELETE, item당 왕복 1회) | [#30163](https://github.com/immich-app/immich/pull/30163) | 🟢 open · 머지되면 +1 | — |
| `sync-agent findOne N+1` | [novu · 40k★](https://github.com/novuhq/novu) | N+1 (for 루프 안 findOne, 소스 통합당 쿼리 1회) | [#12074](https://github.com/novuhq/novu/pull/12074) | 🟢 open · 머지되면 +1 | — |
| `booking member diff O(n²)` | [cal.com · 46729★](https://github.com/calcom/cal.diy) | O(n²) 배열 조회 (루프 안 .some() 선형스캔 4회 → Set) | [#29828](https://github.com/calcom/cal.diy/pull/29828) | 🟢 open · 머지되면 +1 | — |
| `view-widget-upsert O(n²)` | [twenty · 53558★](https://github.com/twentyhq/twenty) | O(n²) 배열 조회 (4개 루프서 .find() 키조회 → Map) | [#23231](https://github.com/twentyhq/twenty/pull/23231) | ❌ closed | — |
| `nested relations hydration O(n²)` | [twenty · 37k★](https://github.com/twentyhq/twenty) | O(n²) 그룹핑/조회 (부모 레코드마다 관계행 전수 스캔 → Map) | [#23232](https://github.com/twentyhq/twenty/pull/23232) | 🟢 open · 머지되면 +1 | — |
| `lucky-user set rebuild in loop` | [cal.com · 47k★](https://github.com/calcom/cal.diy) | 루프 불변 인덱스 재구축 (while마다 new Set 재구축 → 호이스팅) | [#29832](https://github.com/calcom/cal.diy/pull/29832) | 🟢 open · 머지되면 +1 | — |
| `dataloader doc placement O(n²)` | [payload · 43.8k★](https://github.com/payloadcms/payload) | O(n²) (배치당 keys.findIndex 전체 스캔 — Map으로 O(1)) | [#17469](https://github.com/payloadcms/payload/pull/17469) | 🟢 open · 머지되면 +1 | — |
| `translations batch match O(n²)` | [medusa · 35.3k★](https://github.com/medusajs/medusa) | O(n²) (batch당 filter+some 전체 스캔 — Set으로 O(1)) | [#16188](https://github.com/medusajs/medusa/pull/16188) | 🟢 open · 머지되면 +1 | — |
| `markdown import merge O(n²)` | [outline · 39.8k★](https://github.com/outline/outline) | O(n²) (형제 out.find title 스캔 — Map으로 O(1)) | [#13117](https://github.com/outline/outline/pull/13117) | 🟢 open · 머지되면 +1 | — |
| `doc-metadata localization O(n²)` | [strapi · 72.7k★](https://github.com/strapi/strapi) | O(n²) (localization별 versions.find — 복합키 Map으로 O(1)) | [#27125](https://github.com/strapi/strapi/pull/27125) | 🟢 open · 머지되면 +1 | — |
| `parse-fields dedup O(n²)` | [directus · 36.9k★](https://github.com/directus/directus) | O(n²) (nested-field 중복제거 find 스캔 — Set으로 O(1)) | [#27978](https://github.com/directus/directus/pull/27978) | 🟢 open · 머지되면 +1 | — |
| `resource-mapper schema validation O(n²)` | [n8n · 148k★](https://github.com/n8n-io/n8n) | O(n²) (value별 schema.find — id Map으로 O(1)) | [#34899](https://github.com/n8n-io/n8n/pull/34899) | 🟢 open · 머지되면 +1 | — |

## 규칙

- cleanscore가 찾은 이슈로 낸 PR만 기록한다.
- **손 검증 필수** — 정적 분석은 후보만 뽑는다. 오탐 PR은 툴 신뢰를 깎으므로 금지.
- **머지되면 +1.** 닫히면 0. 정직하게.

## 어떻게 찾았나

```bash
npx cleanscore --dir=src --dead
```

`quality.io`(루프 안 파일읽기 + DB/HTTP 순차 await)와 `quality.dead`(knip)가 후보를 파일:줄로
뱉는다. SonarQube가 원리상 못 잡는 축이다. 나머지는 사람의 검증.
