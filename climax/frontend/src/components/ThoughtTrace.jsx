import { useState } from "react";

// ReAct 추론 트레이스 — 에이전트 엔진의 스텝별 사고(thought)·행동(action)·관찰(observation)을
// 세로 스텝퍼로 보여준다. 실행 중이면 마지막 스텝이 맥동한다.
// (QueryPanel 에서 추출 — Query 화면과 비교(Compare) 화면이 공유)
const _ACT_ICON = { search: "🔍", hop: "🔗", read_clauses: "📖", inspect_vocabulary: "📋" };
// 행동별 '결정론 근거' 한 줄 설명 — 사용자에게 왜 이게 확률적 추측이 아닌지 알려준다.
const _DET_WHY = {
  search: "그래프에서 이 SPARQL을 실행한 결과",
  hop: "온톨로지 관계를 따라 결정론적으로 이동",
  read_clauses: "약관 원문 조항을 직접 조회",
  inspect_vocabulary: "온톨로지에 실제 존재하는 값만 확인",
};
export default function ThoughtTrace({ thoughts, running, goal }) {
  const [open, setOpen] = useState({});   // 스텝별 SPARQL 펼침 상태
  const toggle = (i) => setOpen((o) => ({ ...o, [i]: !o[i] }));
  return (
    <div style={{ marginBottom: 8, padding: "2px 2px 4px" }}>
      <style>{`@keyframes ttpulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>🧠</span>
        <b style={{ fontSize: 12.5, color: "var(--navy)", letterSpacing: "-.01em" }}>추론 과정</b>
        <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>· {thoughts.length}스텝</span>
      </div>
      {/* 확정성 설명 — 값·판정이 LLM 추측이 아니라 그래프 실행 결과임을 명시 */}
      <div style={{ fontSize: 10.8, color: "var(--muted)", marginBottom: 9, lineHeight: 1.45,
        background: "rgba(14,155,107,.08)", border: "1px solid rgba(14,155,107,.25)", borderRadius: 8, padding: "5px 9px" }}>
        🔒 LLM은 <b>질의문만</b> 작성 · 값·판정은 <b>그래프에서 실행된 확정 결과</b>입니다. 단계의 <b>🔍 SPARQL</b>을 눌러 근거를 확인하세요.
      </div>
      {goal && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, paddingLeft: 20, lineHeight: 1.5 }}>🎯 {goal}</div>}
      <div style={{ position: "relative" }}>
        {thoughts.map((t, i) => {
          const last = i === thoughts.length - 1;
          const icon = t.kind === "plan" ? "🎯" : t.kind === "finish" ? "✅" : t.kind === "rule" ? "⚖️"
            : t.kind === "anchor" ? "📍" : _ACT_ICON[(t.action || "").split("(")[0]] || "•";
          const act0 = (t.action || "").split("(")[0];
          const why = t.kind === "rule" ? "온톨로지 규칙이 데이터에서 유도한 결정론 판정"
            : t.kind === "anchor" ? "질문 개체를 그래프 라벨로 직접 특정한 뒤 관계를 타고 확장(결정론)"
            : t.pushdown ? "집계를 소스 DB 에 SQL GROUP BY 로 푸시다운(트리플스토어 아님)"
            : _DET_WHY[act0];
          return (
            <div key={i} style={{ display: "flex", gap: 10, paddingBottom: last ? 8 : 13, position: "relative" }}>
              {/* 세로 연결선 */}
              {!last && <span style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 1.5, background: "var(--line2)" }} />}
              <span style={{ flex: "none", width: 21, height: 21, borderRadius: "50%", background: "var(--blue-soft)",
                border: "1.5px solid var(--ans-line)", display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, zIndex: 1, animation: running && last ? "ttpulse 1.2s ease-in-out infinite" : "none" }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div style={{ fontSize: 12.5, color: "var(--navy)", lineHeight: 1.5,
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  title={t.thought}>{t.thought}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {t.action && (
                    <span className="mono" style={{ fontSize: 11, color: "var(--ans-title)",
                      background: "var(--blue-soft)", border: "1px solid var(--ans-line)", borderRadius: 6, padding: "1.5px 7px" }}>{t.action}</span>
                  )}
                  {/* 확정 근거 — SPARQL(또는 집계 푸시다운 SQL)이 있으면 클릭해 펼침 */}
                  {t.sparql && (
                    <button onClick={() => toggle(i)}
                      title={t.pushdown ? "집계를 소스 DB 에 SQL GROUP BY 로 푸시다운해 실행" : "이 단계에서 그래프에 실제 실행된 SPARQL"}
                      style={{ cursor: "pointer", fontSize: 10.5, fontWeight: 700, fontFamily: "var(--sans)",
                        color: t.pushdown ? "#7c3aed" : "#0e9b6b",
                        background: t.pushdown ? "rgba(124,58,237,.1)" : "rgba(14,155,107,.1)",
                        border: `1px solid ${t.pushdown ? "rgba(124,58,237,.35)" : "rgba(14,155,107,.35)"}`,
                        borderRadius: 6, padding: "1.5px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {t.pushdown ? "📊 SQL 푸시다운" : "🔍 SPARQL"}{typeof t.count === "number" ? ` · ${t.count}건` : ""} <span style={{ fontSize: 8 }}>{open[i] ? "▲" : "▼"}</span>
                    </button>
                  )}
                </div>
                {why && (
                  <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3, fontStyle: "italic" }}>확정 근거: {why}</div>
                )}
                {t.sparql && open[i] && (
                  <pre className="mono" style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.5, color: "var(--navy)",
                    background: "var(--code-bg, rgba(120,140,180,.1))", border: "1px solid var(--line2)", borderRadius: 8,
                    padding: "9px 11px", overflowX: "auto", whiteSpace: "pre", maxHeight: 220, overflowY: "auto" }}>{t.sparql}</pre>
                )}
                {t.observation && (
                  <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>↳ {t.observation}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
