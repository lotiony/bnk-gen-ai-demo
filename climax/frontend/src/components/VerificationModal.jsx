import { useState } from "react";
import { api } from "../api";

const SEVERITY_COLOR = {
  high: "var(--red)",
  medium: "var(--amber)",
  low: "var(--green)",
};

const SEVERITY_BG = {
  high: "var(--red-bg)",
  medium: "var(--amber-bg)",
  low: "var(--green-bg)",
};

const SEVERITY_LABEL = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const KIND_LABEL = {
  spec_only: "스펙에만 있음",
  live_only: "실서버에만 있음",
  type_mismatch: "타입 불일치",
  missing_field: "필드 누락",
};

/**
 * HitL 검증 모달 — 스펙-실서버 불일치 findings 를 나열하고
 * 각 finding 에 대해 [승인] / [거부] 결정을 기록한다.
 *
 * props:
 *   open   — boolean, 모달 표시 여부
 *   report — POST /api/verify 응답 ({ ok, counts, has_high, operations })
 *   onClose — () => void
 */
export default function VerificationModal({ open, report, onClose }) {
  // decided: { [rowKey]: "approve" | "reject" | "pending" }
  const [decided, setDecided] = useState({});
  const [loading, setLoading] = useState({});

  if (!open || !report) return null;

  // operations → findings 플래트닝. rowKey = operationId + "|" + field
  const rows = [];
  for (const op of report.operations || []) {
    for (const f of op.findings || []) {
      rows.push({ ...f, operation_id: op.operation_id, method: op.method, path: op.path });
    }
  }

  const decide = async (row, decision) => {
    const key = `${row.operation_id}|${row.field}`;
    setLoading((s) => ({ ...s, [key]: true }));
    try {
      await api.verifyDecision({ field: row.field, decision, actor: "ui" });
      setDecided((s) => ({ ...s, [key]: decision }));
    } catch {
      // 실패 시 상태 변경 없이 버튼 복원
    } finally {
      setLoading((s) => ({ ...s, [key]: false }));
    }
  };

  const hasFindings = rows.length > 0;
  const allDecided = hasFindings && rows.every((r) => decided[`${r.operation_id}|${r.field}`]);

  const headerColor = report.has_high ? "var(--red)" : hasFindings ? "var(--amber)" : "var(--green)";
  const headerText = !hasFindings
    ? "스펙과 실서버 응답이 일치합니다."
    : report.has_high
    ? "불일치 발견 — 검토 필요"
    : "경미한 불일치";

  const counts = report.counts || {};

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(27,36,64,.38)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620, maxWidth: "94vw", maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          background: "var(--card)", borderRadius: 20, padding: 0,
          boxShadow: "0 30px 80px rgba(27,36,64,.32)",
          animation: "popIn .16s ease",
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--line2)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 800, color: headerColor,
                letterSpacing: "-.01em", marginBottom: 4,
              }}>
                {headerText}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                {hasFindings
                  ? `총 ${rows.length}건 · high ${counts.high ?? 0} · medium ${counts.medium ?? 0} · low ${counts.low ?? 0}`
                  : "검증 완료 — 추가 조치가 필요하지 않습니다."}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: "50%",
                border: "none", background: "var(--main)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--muted)", fontSize: 16, fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
          {allDecided && hasFindings && (
            <div style={{
              marginTop: 12, padding: "8px 12px", borderRadius: 10,
              background: "var(--green-bg)", color: "var(--green)",
              fontSize: 12, fontWeight: 700,
            }}>
              모든 불일치 항목에 대한 결정이 기록되었습니다.
            </div>
          )}
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {!hasFindings ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 12, padding: "40px 0",
              color: "var(--green)",
            }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
                스펙과 실서버 응답이 일치합니다.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((row) => {
                const key = `${row.operation_id}|${row.field}`;
                const dec = decided[key];
                const isLoading = loading[key];
                const sev = row.severity || "low";

                return (
                  <div
                    key={key}
                    style={{
                      border: `1px solid ${dec ? "var(--line2)" : SEVERITY_COLOR[sev] + "44"}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                      background: dec ? "var(--main)" : SEVERITY_BG[sev],
                      opacity: dec ? 0.75 : 1,
                      transition: "opacity .15s",
                    }}
                  >
                    {/* 상단 행: severity badge + field + kind */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        flexShrink: 0,
                        padding: "2px 7px", borderRadius: 7,
                        background: SEVERITY_COLOR[sev],
                        color: "#fff",
                        fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700,
                        letterSpacing: ".04em",
                      }}>
                        {SEVERITY_LABEL[sev] || sev.toUpperCase()}
                      </span>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700,
                        color: "var(--navy)", wordBreak: "break-all",
                      }}>
                        {row.field}
                      </span>
                      <span style={{
                        marginLeft: "auto", flexShrink: 0,
                        fontFamily: "var(--mono)", fontSize: 10,
                        color: "var(--muted)", background: "var(--line2)",
                        padding: "2px 7px", borderRadius: 7,
                      }}>
                        {KIND_LABEL[row.kind] || row.kind}
                      </span>
                    </div>

                    {/* operation 경로 */}
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 6 }}>
                      <span style={{ color: "var(--blue)", fontWeight: 600 }}>{row.method}</span>
                      {" "}{row.path}
                    </div>

                    {/* detail */}
                    {row.detail && (
                      <div style={{
                        fontSize: 12, color: "var(--text)", lineHeight: 1.5, marginBottom: 10,
                      }}>
                        {row.detail}
                      </div>
                    )}

                    {/* 결정 영역 */}
                    {dec ? (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 11px", borderRadius: 9,
                        background: dec === "approve" ? "var(--green-bg)" : "var(--red-bg)",
                        color: dec === "approve" ? "var(--green)" : "var(--red)",
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {dec === "approve" ? "✓ 승인됨" : "✕ 거부됨"}
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => decide(row, "approve")}
                          disabled={isLoading}
                          style={{
                            border: "1px solid var(--green)", borderRadius: 9,
                            padding: "6px 14px", fontSize: 12, fontWeight: 700,
                            fontFamily: "var(--sans)",
                            background: "var(--green-bg)", color: "var(--green)",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.5 : 1,
                          }}
                        >
                          {isLoading ? "…" : "승인"}
                        </button>
                        <button
                          onClick={() => decide(row, "reject")}
                          disabled={isLoading}
                          style={{
                            border: "1px solid var(--red)", borderRadius: 9,
                            padding: "6px 14px", fontSize: 12, fontWeight: 700,
                            fontFamily: "var(--sans)",
                            background: "var(--red-bg)", color: "var(--red)",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            opacity: isLoading ? 0.5 : 1,
                          }}
                        >
                          {isLoading ? "…" : "거부"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--line2)",
          display: "flex", justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              border: "none", borderRadius: 11, padding: "10px 20px",
              fontSize: 13.5, fontWeight: 700, fontFamily: "var(--sans)",
              background: "var(--main)", color: "var(--text)", cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
