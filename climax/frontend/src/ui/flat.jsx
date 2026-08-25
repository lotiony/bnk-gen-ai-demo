// 플랫 패널 + 헤어라인 스타일 토큰 — 시스템/개발자 화면(변환 검증, 감사 로그) 공용.
// 색상은 전부 앱 CSS 변수라 라이트/다크 자동 대응. 카드 중첩 대신 1px 헤어라인으로 영역을 나눈다.
export const caps = { fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--muted)" };
export const mono = (extra = {}) => ({ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", ...extra });
export const hairline = "1px solid var(--line)";
export const panel = { background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, overflow: "hidden" };
export const term = { margin: 0, background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 8, padding: "11px 13px", fontFamily: "var(--mono)", fontSize: 10.6, lineHeight: 1.7, color: "var(--text)", overflow: "auto", flex: 1 };
export const btn = (pri) => ({ border: pri ? "1px solid var(--blue)" : "1px solid var(--line2)", borderRadius: 9, padding: "7px 13px", fontSize: 12, fontWeight: pri ? 700 : 600, cursor: "pointer", background: pri ? "var(--blue)" : "var(--card)", color: pri ? "#fff" : "var(--text)" });

// 상태 → 색. ok|done|pass 계열=초록, warn 계열=앰버, fail 계열=빨강.
export const stCol = (st) => st === "fail" || st === "failed" ? "var(--red)"
  : st === "warn" || st === "warning" ? "var(--amber)" : "var(--green)";
export const Dot = ({ st }) => <span style={{ width: 7, height: 7, borderRadius: "50%", background: stCol(st), display: "inline-block", flexShrink: 0 }} />;
