// 위치를 "0번 자리" 의미로 쓰는 저장소 (whistle). !s.indexOf 가 세 번 넘게 나온다.
declare const a: string, b: string, c: string, cmd: string, s: string;
export const startsA = !a.indexOf("x");
export const startsB = !b.indexOf("y");
export const startsC = !c.indexOf("z");
// 같은 저자의 "로 시작하지 않으면" — 의도다
if (cmd.indexOf("--registry=")) console.log(cmd);
export function parse(): void {
  if (s.indexOf("curl ")) return;
}
