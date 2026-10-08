// 버린 반환값 축 픽스처. 잡아야 할 것과 잡으면 안 되는 것을 한 파일에 둔다.
// 수신자 이름을 전부 다르게 둬서 그 이름만 보고 판정할 수 있게 한다.

// ── 잡아야 한다 ─────────────────────────────────────────────────────────────

// spec: 정규식 리터럴로 replace 하고 결과를 버린다 — nx scam-to-standalone 이 정확히 이 모양이었다.
export function dropDeclarations(spec: string): string {
  spec.replace(/declarations: \[.+/, '');
  return spec;
}

// label: concat 결과를 버린다 — theia debug-breakpoint 의 메시지 덧붙이기.
export function appendMessage(label: string, extra: string): string {
  label.concat(', ' + extra);
  return label;
}

// ── 잡으면 안 된다 ──────────────────────────────────────────────────────────

// assigned: 결과를 대입했다.
export function assigned(text: string): string {
  let out = text;
  out = out.replace('a', 'b');
  return out;
}

// collector: 둘째 인자가 함수 — 매치를 모으는 순회 관용구다(pdf.js util). [FP:replace-as-iterator]
export function collect(collector: string): string[] {
  const found: string[] = [];
  collector.replaceAll(/\d+/g, (m) => { found.push(m); return m; });
  return found;
}

// location: 이동이지 문자열 메서드가 아니다. [FP:discard-needs-pure-method]
export function go(location: { replace(url: string): void }): void {
  location.replace('/login');
}

// token: 이 파일이 toLowerCase 를 직접 선언한 클래스의 제자리 변경이다(pdf.js AstIdentifier).
class Ident {
  id = 'X';
  toLowerCase(): void { this.id = this.id.toLowerCase(); }
}
export function lower(token: Ident): Ident {
  token.toLowerCase();
  return token;
}
