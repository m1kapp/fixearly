// 독립 순차 await 픽스처. 서로의 결과를 안 쓰는 I/O 두 개를 줄 세운 자리와,
// 같은 트랜잭션을 넘겨 한 커넥션에서 어차피 줄 서서 도는 자리를 한 파일에 둔다.

type Db = { find: (q: { table: string; transaction?: unknown }) => Promise<unknown[]> };

// usersHit: 둘이 독립이다 — Promise.all 로 왕복 두 번이 한 번이 된다.
export async function dashboard(db: Db): Promise<unknown[][]> {
  const usersHit = await db.find({ table: "users" });
  const postsHit = await db.find({ table: "posts" });
  return [usersHit, postsHit];
}

// usersTx: 같은 트랜잭션을 넘긴다 — 한 커넥션이라 병렬로 펴도 이득이 없다(outline). [FP:serial-in-transaction]
export async function locked(db: Db, transaction: unknown): Promise<unknown[][]> {
  const usersTx = await db.find({ table: "users", transaction });
  const postsTx = await db.find({ table: "posts", transaction });
  return [usersTx, postsTx];
}
