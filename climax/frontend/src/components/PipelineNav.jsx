import { useDesign } from "../DesignContext";

// 온톨로지 구축 파이프라인 네비게이터 — 큼직한 타일 + 이모지 + 숫자만 (글자 최소화).
// 클릭하면 해당 단계 화면으로 이동한다. 검증(Query)은 최상위 메뉴라 여기서 제외.
export default function PipelineNav({ go }) {
  const { ontology, mapping } = useDesign();
  // 정형 매핑 숫자 = '덮인 distinct 요소 수'(covered) — 매핑현황 커버리지와 일치.
  // 레코드 수(auto+manual)는 한 속성이 여러 컬럼에 매핑되면 부풀어 커버리지와 안 맞아 보였다.
  const mapped = mapping?.covered ?? ((mapping?.auto || 0) + (mapping?.manual || 0));
  const steps = [
    { emoji: "✨", label: "온톨로지 생성", n: ontology?.entities ?? 0, unit: "클래스", n2: ontology?.data_properties ?? 0, unit2: "속성", screen: "ont_generate" },
    { emoji: "🕸️", label: "구조 점검", n: ontology?.relationships ?? 0, unit: "관계", screen: "ont_designer" },
    { emoji: "🔗", label: "DB 매핑", n: mapped, unit: "매핑", screen: "map_automap" },
    { emoji: "📦", label: "실체화", n: ontology?.instances ?? 0, unit: "인스턴스", screen: "map_materialize" },
  ];
  return (
    <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 20, padding: "16px 20px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🧭</span>
        <b style={{ fontSize: 14, color: "var(--navy)" }}>구축 단계</b>
        <span style={{ fontSize: 11.5, color: "var(--faint)" }}>클릭하면 해당 화면으로 이동</span>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 14, flexWrap: "wrap" }}>
      {steps.map((s, i) => {
        const done = s.n > 0;
        return (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 190 }}>
            {i > 0 && <span style={{ fontSize: 22, color: done ? "var(--blue)" : "var(--faint)", fontWeight: 800, flexShrink: 0 }}>→</span>}
            <button onClick={() => go && go(s.screen)}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 18, cursor: "pointer", textAlign: "left",
                background: done ? "var(--blue-soft, #e0f6f3)" : "var(--app)",
                border: `1.5px solid ${done ? "var(--blue)" : "var(--line2)"}` }}>
              <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
              <span style={{ minWidth: 0, lineHeight: 1.2 }}>
                <span style={{ display: "block", fontSize: 24, fontWeight: 800, color: "var(--navy)", whiteSpace: "nowrap" }}>
                  {s.n}<span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--faint)" }}> {s.unit}</span>
                  {s.n2 != null && (
                    <>
                      <span style={{ fontWeight: 500, color: "var(--faint)" }}> · </span>
                      {s.n2}<span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--faint)" }}> {s.unit2}</span>
                    </>
                  )}
                </span>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>{s.label}</span>
              </span>
              {done && (
                <span style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: "50%", background: "var(--blue)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(0,181,166,.35)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              )}
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
