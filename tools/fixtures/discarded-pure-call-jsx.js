// .js 안 JSX 픽스처 — TS 모드로 읽으면 JSX 가 깨진 문장이 돼 속성 안 .trim() 이 버린 반환값으로 잡혔다
// (kiss-translator Options/Layout.js, 2026-10-09). JS 모드로 읽어야 한다. 그 파일의 모양을 그대로 줄였다.

// 템플릿 리터럴 `.trim()` 결과가 className 값이다 — 버린 게 아니다. 총 건수 검사가 이걸 지킨다.
export function Shell({ wide, mobile, children }) {
  const ref = { current: null };
  return (
    <div className="shell">
      <Header
        onToggle={(event) => {
          ref.current = event.currentTarget;
        }}
      />
      <div className="layout">
        {!mobile && <Nav open={false} />}
        <main className="main">
          <div
            className={`inner ${
              wide ? "inner--wide" : ""
            }`.trim()}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// slug: 같은 파일의 진짜 버린 반환값 — JSX 가 있어도 문장은 계속 잡혀야 한다.
export function Title({ slug }) {
  slug.trim();
  return <h1>{slug}</h1>;
}
