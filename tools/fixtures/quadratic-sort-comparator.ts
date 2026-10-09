// 정렬 비교 함수 안의 선형 탐색 — 비교 함수는 n log n 번 불리므로 O(n² log n) 이다.
// 최근 머지된 성능 PR(sim #5330)이 Map 으로 바꾼 모양 그대로다.

// members: 비교 함수 안에서 매번 find — 잡아야 한다.
export function sortRowsByOwner(rows: { ownerId: string }[], members: { id: string; name: string }[]) {
  return [...rows].sort((a, b) => {
    const ma = members.find((m) => m.id === a.ownerId);
    const mb = members.find((m) => m.id === b.ownerId);
    return (ma?.name ?? '').localeCompare(mb?.name ?? '');
  });
}

// byId: 비교 전에 Map 을 한 번 만들고 get 만 한다 — 고친 모양, 잡으면 안 된다.
export function sortRowsByOwnerFast(rows: { ownerId: string }[], people: { id: string; name: string }[]) {
  const byId = new Map(people.map((m) => [m.id, m.name]));
  return [...rows].sort((a, b) => (byId.get(a.ownerId) ?? '').localeCompare(byId.get(b.ownerId) ?? ''));
}
