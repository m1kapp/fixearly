# fixearly

**npx 한 줄로 JS·TS 코드의 버그 줄을 찾는다.** 규칙들은 node·react·angular 같은 남의 저장소에
PR 로 내서 머지된 것들이다. 정적 분석 · 100% 로컬 · LLM 0 · 점수·등급 없음. ([랜딩](https://fixearly.m1k.app))

```bash
npx fixearly --dir=src
```

```
  30개 파일 · 코드 9,631줄

  고칠 줄 13개 — 바로 볼 것 1 · 맥락 확인 8 · 참고 4
  지난 실행 대비: 신규 13 · 유지 0 · 해소 0
    [100] return 없는 콜백 · lib/aws/route53.js:82
      → 콜백이 값을 돌려주게 고치고 결과(찾은 원소·기다린 작업)가 바뀌는 입력을 재현
    [80] 독립 await 직렬화 · lib/aws/alb.js:297
      → 호출 간 데이터 의존성과 동시 실패 정책을 확인
```

(serverless 엔진에 돌린 실제 출력. 맨 위 1건은 [PR 로 냈다](https://github.com/serverless/serverless/pull/13947).)

- **바로 볼 것** — 정적 증거만으로 버그일 가능성이 높은 정확성 규칙. 고쳐서 재현 테스트로 확인하면 된다.
- **맥락 확인** — 성능 후보(O(n²)·순차 await 등). 실제 n 과 호출 간 의존성을 봐야 고칠 가치가 정해진다.
- **참고** — 빈 catch 처럼 대개 의도적인 것.

다시 돌리면 직전 실행과 비교해 **신규·유지·해소**를 센다(`.fixearly-sweep.json`). 해소 = 고친 것.

## 규칙 24종

**정확성 11** — `버려진 Promise` · `forEach 안 await` · `공유 참조 fill` · `숫자 sort 비교자 누락` · `전역 정규식 상태` ·
`버린 반환값` · `위치를 진리값으로(indexOf)` · `return 없는 콜백` · `같은 식 두 번 비교` · `조건 자리의 async 호출` · `finally 가 삼킨 throw`
**성능 10** — `O(n²) 배열 조회` · `루프 안 N+1` · `독립 await 직렬화` · `루프 안 파일 읽기` · `루프 불변 인덱스` · `스프레드 누적` · `루프 안 정규식` · `깊은 비교 집합 연산` · `순환 의존` · `렌더 인질`
**위생 3** — `빈 catch` · `배열에 for...in` · `쓰기만 하는 컬렉션`

규칙마다 고치기 전·후 예시와 그 규칙으로 머지된 PR 은 [랜딩](https://fixearly.m1k.app/#axes)에 있다.

## 규칙은 이렇게 검증한다

1. **남이 이미 고친 걸 읽는다** — 머지된 PR 을 긁어 형태로 묶는다 ([tools/MINING.md](./tools/MINING.md)).
2. **남의 코드에 걸어본다** — 규칙 후보를 오픈소스 74곳(`tools/corpus-repos.json`)에 걸고, 걸린 자리를 손으로 연다.
   오탐이 많으면 떨어뜨린다 (`tools/measure-diagnostic.sh`).
3. **직접 PR 로 낸다** — 남의 저장소 메인테이너가 머지하거나 거절한다. 거절도 사유째 공개한다
   ([IMPACT.md](./IMPACT.md) · [PR-QUEUE.md](./PR-QUEUE.md)).
4. **오탐은 가드로 굳힌다** — [FALSE-POSITIVES.md](./FALSE-POSITIVES.md) 의 계열마다 엔진 가드와 픽스처가 `npm test` 로 묶여 있다.

## 사용법

```bash
npx fixearly --dir=src                 # 고칠 줄 상위 20개
npx fixearly --dir=src --all           # 전부
npx fixearly --dir=src --deps          # 락파일 취약점 · 중단 선언된 의존 (OSV.dev · npm registry, 네트워크 필요)
npx fixearly --dir=. --exclude=apps/devtools   # 모노레포에서 산출물 아닌 패키지 제외
npx fixearly --dir=src --mine          # O(n²) 후보 전체 덤프 (손검증용)
```

git 추적 파일만 읽고, 테스트·벤치·스토리·벤더·생성·미니파이 파일은 알아서 뺀다.
결과는 `public/fixearly.json`(`--out` 으로 변경)에도 떨어진다.

`--deps` 는 **고쳐진 버전이 나온 취약점**과 **저자가 중단 선언한 직접 의존**을 본다. 권고 버전이
배포 런타임(Dockerfile `FROM node:*` · `.nvmrc` · `engines`)에서 도는지도 같이 확인한다.

## 한계

JS·TS 전용이다(`.ts .tsx .js .jsx .mjs .cjs`, TypeScript 컴파일러 API 로 파싱). 설계·테스트·문서·보안은 재지 않는다.
성능 후보는 실행 시점의 n 을 모르므로 "맥락 확인"으로만 낸다.

## 라이선스

MIT
