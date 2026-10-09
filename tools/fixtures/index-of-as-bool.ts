declare const msg: string, code: string, names: string[], mimes: string[], root: string, out: string;
declare const head: string, tail: string, dot: string, label: string, list: number[];

// hit: -1(없음)이 참이라 'customer' 가 없어도 들어간다 (Ghost member-bread-service)
if (msg.indexOf("customer") && code === "resource_missing") console.log(msg);
// hit: 술어 콜백 식 본문 — 첫 원소만 거짓이고 나머지는 전부 참 (vscode cellOutput)
export const copyable = mimes.find((m) => names.indexOf(m) || m.startsWith("image/"));
// hit: 접두사일 때(0) 오히려 거짓 (nx run-type-check)
export const declDir = root && out.indexOf(root) ? out.replace(root, "") : undefined;
// miss: !s.indexOf(x) 는 startsWith 관용구
if (!head.indexOf("#")) console.log(head);
// miss: 비교가 있다
if (tail.indexOf("#") !== -1) console.log(tail);
// miss: 값 자리 — 뒤에서 -1 과 비교한다 (three PropertyBinding)
export const lastDot = dot && dot.lastIndexOf(".");
// miss: 일부러 -1·양수를 참으로 쓴다 (echarts isNameSpecified)
export const specified = !!(label && label.indexOf("series\0"));
// miss: 값 자리 — 산술
export const at = list.findIndex((n) => n > 1) + 1;
