// 루프 안 파일읽기 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 이 축의 가드가 무너지면 코퍼스 전체에서 834곳짜리 오탐이 났었다 — 그래서 고정한다.
import { readFileSync } from 'node:fs';

// 파일 스코프 리더: 호출될 때마다 실제로 파일을 읽는다. 캐시가 없다.
function loadTemplate(name: string): string {
  return readFileSync(`templates/${name}.html`, 'utf8');
}

// 같은 이름의 리더가 파일 스코프에 있다 — 아래 `cache.get(...)` 을 이 함수 호출로
// 오인하면 안 된다. [FP:io-name-collision] 이 막는 자리가 정확히 이것이다.
function get(name: string): string {
  return readFileSync(`fragments/${name}.html`, 'utf8');
}

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// loadTemplate: 루프마다 캐시 없는 리더를 부른다 — 호출 1번이 파일 N번을 읽는다.
export function renderAll(names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    out.push(loadTemplate(name));
  }
  return out;
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// cache.get(...) 는 Map 의 빌트인 메서드다. 이름만 보면 위의 리더 `get` 과 같아서
// 타입 정보 없이는 구분이 안 된다 — 빌트인 메서드명은 리더 해석에서 제외한다.
export function renderCached(names: string[], cache: Map<string, string>): string[] {
  const out: string[] = [];
  for (const name of names) {
    const hit = cache.get(name);
    if (hit) {
      out.push(hit);
    }
  }
  return out;
}

// 같은 이유로 배열 빌트인도 리더가 아니다.
export function collect(rows: string[][]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    out.push(row.join(','));
  }
  return out;
}
