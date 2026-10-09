declare const props: { name: string }[], mods: number[], appenders: { flush(): Promise<void> }[];
declare const keys: string[], rows: { ok: boolean }[], jobs: { run(): Promise<void> }[], items: number[], tasks: number[];
declare const data: string[][], crons: string[], started: string[];

export async function run() {
  // hit: 블록 본문이 값을 안 돌려줘 늘 undefined (n8n nodeTypesUtils)
  const field = props.find((prop) => { prop.name === "x"; });
  // hit: (medusa docs-generator 접근자 판정)
  const priv = mods.find((m) => { m === 1 || m === 2; });
  // hit: Promise.all 이 아무것도 안 기다린다 (vscode cliProcessMain)
  await Promise.all(appenders.map((a) => { a.flush(); }));
  // miss: 결과를 버린 filter 는 forEach 대용
  keys.filter((k) => { if (k) console.log(k); });
  // miss: return 이 있다
  const kept = rows.filter((r) => { return r.ok; });
  // miss: async 콜백은 Promise 를 돌려준다
  await Promise.all(jobs.map(async (j) => { await j.run(); }));
  // miss: Promise.all 밖의 map
  const logged = items.map((i) => { console.log(i); });
  // miss: throw 만 하는 콜백
  const none = tasks.some(() => { throw new Error("no"); });
  // miss: forEach 화살표 식 본문의 filter 도 결과를 버린다 (medusa mikro-orm-repository)
  data.forEach((tags) => tags.filter((k) => { console.log(k); }));
  // miss: 마지막이 동기 push — 기다릴 Promise 가 없다 (payload cron 등록)
  await Promise.all(crons.map((c) => { const id = c.trim(); started.push(id); }));
  return [field, priv, kept, logged, none];
}
