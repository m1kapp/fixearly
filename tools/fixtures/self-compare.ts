declare const el: { startArrowhead: string | null; endArrowhead: string | null };
declare const args: { filesToInclude?: string; filesToExclude?: string };
declare const node: { key: number; value: string };
declare function areSame(a: unknown, b: unknown): boolean;
declare const list: { id: string }[];
declare const label: string, n: number;
declare function next(): number;

export class Ref {
  constructor(private xref: number) {}
  // hit: 늘 참 (angular isEquivalent)
  isEquivalent(): boolean { return this.xref === this.xref; }
}
// hit: start 였어야 한다 (excalidraw renderElement)
export const pad = el.endArrowhead || el.endArrowhead ? 40 : 20;
// hit: include 였어야 한다 (vscode searchActionsBase)
export const show = !!(args.filesToExclude || args.filesToExclude);
// hit: 가려진 e 를 자기 자신과 비교 (vscode remoteExtensionsInit)
export const found = list.find((e) => areSame(e.id, e.id));
// miss: NaN 검사 관용구
if (node.key !== node.key) console.log("NaN key");
// miss: 맨 이름 하나의 중복은 렌더 관용구 취급
export const text = label && label;
// miss: 호출은 두 번 평가하면 값이 다르다
export const twice = next() === next();
// miss: 공백까지 다르다
export const blank = node.value === " " || node.value === "";
// miss: 리터럴끼리의 비교 함수 호출은 시험용
export const lit = areSame("a", "a");
// miss: 맨 이름의 x === x 는 "NaN 아님" 관용구 (lodash)
export const notNaN = n === n;
// miss: 리터럴끼리 (글자가 없다)
export const off = 0 > 0;
declare const token: { buf: Uint8Array };
declare function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
declare function equal(a: unknown, b: unknown): boolean;
// miss: 길이가 다를 때 하는 더미 비교
timingSafeEqual(token.buf, token.buf);
// miss: 테스트가 상수를 일부러 같은 값과 비교한다
export const nanEq = equal(Math.PI, Math.PI);
// miss: 다른 식
export const diff = el.startArrowhead || el.endArrowhead || n;
