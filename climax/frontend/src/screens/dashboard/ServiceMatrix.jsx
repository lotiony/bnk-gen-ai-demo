import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { EmptyState, GhostLine, SkelRows, Spinner, sx } from "./bits";
import { CellBar, Spark } from "./microviz";

/* 서비스 이원 상태 매트릭스 — 레거시 upstream 도달성과 MCP 서빙 상태를 같은 행에서 나란히 본다.
   시스템관리자가 장애 때 가장 먼저 하는 일이 책임 소재 절개라서, 이 두 열이 붙어 있어야 한다:
     레거시 down + MCP running  → 우리 잘못 아님 (레거시 팀 이슈)
     레거시 ok   + MCP stopped  → 우리 게이트웨이 문제
   레거시 상태는 프로브 결과(monitor.build_status)에서 오고, 프로브를 한 번도 안 돌리면 unknown이다.
   unknown은 '정상'이 아니라 '모름'이므로 회색으로 눕히고, 프로브 실행 버튼을 같은 패널에 둔다. */

const LEGACY = {
  ok: { tone: "var(--green)", ko: "정상", en: "UP" },
  warn: { tone: "var(--amber)", ko: "일부 실패", en: "PARTIAL" },
  down: { tone: "var(--red)", ko: "응답 없음", en: "DOWN" },
  unknown: { tone: "var(--faint)", ko: "미확인", en: "UNKNOWN" },
};
const MCP = {
  running: { tone: "var(--blue)", ko: "서빙", en: "SERVING" },
  partial: { tone: "var(--amber)", ko: "일부", en: "PARTIAL" },
  stopped: { tone: "var(--red)", ko: "중지", en: "STOPPED" },
};

const Pill = ({ map, state, ko }) => {
  const m = map[state] || map.unknown || { tone: "var(--faint)", ko: "—", en: "—" };
  return <span className="svcm-pill" style={{ color: m.tone }}><i />{ko ? m.ko : m.en}</span>;
};

export default function ServiceMatrix({ servers, ko, go, booted, activeId, onProbed }) {
  const [probing, setProbing] = useState(false);
  const rows = servers || [];
  /* 호출 셀 배경 바의 기준 — 행 간 크기 비교를 눈으로 시킨다 */
  const maxCalls = Math.max(1, ...rows.map((s) => s.calls || 0));

  async function probe() {
    if (!activeId || probing) return;
    setProbing(true);
    try { await api.monitorProbe(activeId); onProbed?.(); }
    finally { setProbing(false); }
  }

  /* 대시보드에 들어올 때마다 자동으로 한 번 돌린다 — 손으로 누르기 전까지 레거시 열이
     '미확인'으로 남아, 장애가 나도 화면상으로는 아무 일 없는 것처럼 보인다.
     프로젝트가 바뀌면 대상 서비스도 바뀌므로 다시 돈다. ref 로 프로젝트당 1회를 보장한다
     (StrictMode 이중 마운트로 두 번 나가는 것 방지). */
  const probedFor = useRef(null);
  useEffect(() => {
    if (!activeId || probedFor.current === activeId) return;
    probedFor.current = activeId;
    probe();
  }, [activeId]);

  return (
    <section className="hud-panel" style={{ ...sx.panelCol, minHeight: 0 }}>
      <div style={sx.phead}>
        <span style={sx.ptick} />
        <div style={sx.lbl}>{ko ? "서비스 상태" : "SERVICE STATUS"}</div>
        <div style={sx.lblSub}>{ko ? "레거시 도달성 · MCP 서빙" : "legacy reachability · MCP serving"}</div>
        {activeId && (
          <button onClick={probe} disabled={probing} style={{ ...sx.errRetry, marginLeft: "auto",
            borderColor: "var(--blue)", color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {probing && <Spinner size={11} color="var(--blue)" />}
            {ko ? "프로브 실행" : "Run probe"}
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {!booted ? <SkelRows n={4} /> : !rows.length ? (
          <EmptyState visual={<GhostLine />}
            title={ko ? "서비스 대기" : "no services yet"}
            hint={ko ? "소스를 등록하면 서비스별 상태가 여기 쌓입니다" : "status appears once sources are registered"}
            cta={ko ? "온보딩 시작" : "Start onboarding"} onCta={() => go?.("onboarding")} />
        ) : (
          <table className="svcm">
            <thead>
              <tr>
                <th>{ko ? "서비스" : "service"}</th>
                <th>{ko ? "레거시" : "legacy"}</th>
                <th>MCP</th>
                <th style={{ textAlign: "right" }}>{ko ? "호출" : "calls"}</th>
                <th>{ko ? "추이" : "trend"}</th>
                <th style={{ textAlign: "right" }}>{ko ? "에러" : "err"}</th>
                <th style={{ textAlign: "right" }}>P95</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.service} onClick={() => go?.("explorer", { service: s.service })}>
                  <td className="svcm-name">{s.service || (ko ? "미분류" : "unclassified")}</td>
                  <td><Pill map={LEGACY} state={s.legacy_state} ko={ko} /></td>
                  <td><Pill map={MCP} state={s.mcp_state} ko={ko} /></td>
                  <td className="svcm-num">
                    {(s.calls || 0).toLocaleString()}
                    <CellBar value={s.calls || 0} max={maxCalls} />
                  </td>
                  <td className="svcm-spark">
                    <Spark data={s.spark} h={18} showLast={false}
                      color={s.error_rate > 0 ? "var(--red)" : "var(--blue)"} />
                  </td>
                  <td className="svcm-num" style={{ color: s.error_rate > 0 ? "var(--red)" : "var(--faint)" }}>
                    {s.error_rate ? `${(s.error_rate * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="svcm-num">{s.p95 != null ? `${s.p95}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
