# PR 큐

밀도가 높다고 바로 내지 않는다. **물량으로 보이면 저장소가 문을 닫는다** — activepieces 가
외부 PR 을 자동으로 닫게 된 이유가 그것이고(`close-external-prs.yml` 의 문구: "the volume
(a lot of it AI-generated)"), formbricks 도 PR 생성 자체를 협업자로 제한했다. 한 계정에서
하루에 여러 저장소로 나가는 건 그 신호를 만든다.

그래서 후보를 찾으면 여기 넣고, 아래 속도 규칙에 맞춰 내보낸다.

## 속도 규칙

- **저장소당 1건.** 앞엣것이 닫히거나 머지될 때까지 두 번째를 안 낸다.
  (twenty 에 겹치는 2건을 냈다가 하나가 redundant 로 닫혔다.)
- **하루 1건.** 오늘 3건을 냈는데 많았다 — 서로 다른 저장소여도 계정 하나에서 나간다.
- **열린 것이 5건을 넘으면 멈춘다.** 대응할 여력을 남긴다. 변경 요청이 오면 그게 먼저다.
- **낼 게 없는 날은 안 낸다.** 큐가 비면 비는 대로 둔다.

## 지금 열려 있는 것

| PR | 축 | 상태 |
|---|---|---|
| [outline#13117](https://github.com/outline/outline/pull/13117) | O(n²) | ✅ 머지 |
| [novu#12074](https://github.com/novuhq/novu/pull/12074) | N+1 | 🔵 승인 · 머지 대기 |
| [medusa#16188](https://github.com/medusajs/medusa/pull/16188) | O(n²) | 🔵 승인 · 머지 대기 |
| [n8n#34899](https://github.com/n8n-io/n8n/pull/34899) | O(n²) | 🟠 변경 요청 → 반영 완료, 재검토 대기 |
| [typeorm#12746](https://github.com/typeorm/typeorm/pull/12746) | O(n²) | ⚪ 대기 |
| [Ghost#29704](https://github.com/TryGhost/Ghost/pull/29704) | 순차 I/O | ⚪ 대기 |
| [vite#23114](https://github.com/vitejs/vite/pull/23114) | O(n²) | ⚪ 대기 |

**열린 것이 이미 6건이다. 큐에서 새로 꺼내기 전에 이쪽부터 정리한다.**

## 큐 (측정 완료 · 미제출)

지금은 비어 있다. 오늘 측정한 것은 전부 제출했거나 게이트에서 떨어졌다.

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

*이 문서는 손으로 갱신한다. 후보 밀도는 `npm run measure` 뒤 `data/corpus.json` 과
`$BOARD_ROOT/o_<name>/fixearly.json` 의 `scoreInputs` 에서 나온다.*
