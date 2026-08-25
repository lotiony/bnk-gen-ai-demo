import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { caps, mono, hairline, panel, term, btn, stCol } from "../ui/flat";

// 감사 로그 — invoker 가 남긴 모든 MCP 호출 기록(시크릿 마스킹 완료본)을 조회.
// 데이터는 GET /api/audit (서버 인메모리 버퍼 + 기동 시 로그파일 tail 복원).
// 필터는 전부 클라이언트 — 최대 500건이라 즉시 반응하고, 서버 쿼리 파라미터를 늘리지 않는다.

const OUTCOME = (e) => {
  if (e.error) return "fail";
  if (typeof e.status !== "number") return "warn";      // 차단/미도달 (blocked 등)
  return e.status < 400 ? "ok" : e.status < 500 ? "warn" : "fail";
};
const OUT_LABEL = { ok: "성공", warn: "경고", fail: "실패" };
const timeOf = (ts) => (ts && ts.length >= 19 ? ts.slice(5, 19).replace("T", " ") : "-");

export default function AuditLog({ t, lang }) {
  const ko = lang !== "en";
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("project");      // project | all
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");             // "" = 전체
  const [outcome, setOutcome] = useState("");         // "" = 전체
  const [live, setLive] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);

  const load = () => api.audit(500, scope === "all" ? "all" : undefined)
    .then((d) => setEntries(d.entries || []))
    .catch(() => setEntries([]))
    .finally(() => setLoading(false));

  useEffect(() => { setLoading(true); setOpenIdx(null); load(); }, [scope]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [live, scope]);

  const actors = useMemo(() => [...new Set(entries.map((e) => e.actor).filter(Boolean))], [entries]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (actor && e.actor !== actor) return false;
      if (outcome && OUTCOME(e) !== outcome) return false;
      if (!needle) return true;
      return [e.tool_id, e.path, e.method, e.actor, e.error, JSON.stringify(e.args)]
        .some((v) => (v || "").toString().toLowerCase().includes(needle));
    });
  }, [entries, q, actor, outcome]);

  const stat = useMemo(() => {
    const lat = rows.map((e) => e.latency_ms).filter((v) => typeof v === "number");
    const by = (o) => rows.filter((e) => OUTCOME(e) === o).length;
    return {
      total: rows.length, ok: by("ok"), warn: by("warn"), fail: by("fail"),
      avg: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
      p95: lat.length ? [...lat].sort((a, b) => a - b)[Math.floor(lat.length * 0.95) - 1] ?? Math.max(...lat) : null,
    };
  }, [rows]);

  const grid = { display: "grid", gridTemplateColumns: "130px 90px minmax(160px,1fr) minmax(180px,1.3fr) 96px 84px", gap: 14, alignItems: "center", padding: "9px 18px" };
  const chip = (on, color) => ({ border: `1px solid ${on ? (color || "var(--blue)") : "var(--line2)"}`, background: on ? "var(--main)" : "var(--card)", color: on ? (color || "var(--navy)") : "var(--muted)", borderRadius: 9, padding: "6px 11px", fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, cursor: "pointer" });
  const kpi = (label, value, color) => (
    <div key={label} style={{ padding: "12px 18px", borderRight: hairline, flex: 1 }}>
      <span style={{ ...caps, display: "block" }}>{label}</span>
      <b style={mono({ display: "block", fontSize: 16, fontWeight: 700, marginTop: 4, color: color || "var(--navy)" })}>{value}</b>
    </div>
  );

  return (
    <div style={{ animation: "fadeUp .3s ease-out" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t?.navAudit || "감사 로그"}</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          {ko ? "MCP 호출 기록 — 인자의 시크릿은 마스킹되어 저장됩니다." : "MCP invocation records — secrets in arguments are masked."}
        </p>
        <span style={{ flex: 1 }} />
        <button style={btn()} onClick={() => setLive(!live)}>{live ? (ko ? "자동 새로고침 켜짐" : "Live on") : (ko ? "자동 새로고침" : "Live")}</button>
        <button style={btn(true)} onClick={load}>{ko ? "새로고침" : "Refresh"}</button>
      </div>

      {/* 요약 */}
      <div style={{ ...panel, display: "flex", marginBottom: 12 }}>
        {kpi(ko ? "호출" : "Calls", stat.total)}
        {kpi(ko ? "성공" : "Success", stat.ok, "var(--green)")}
        {kpi(ko ? "경고 (4xx·차단)" : "Warn", stat.warn, stat.warn ? "var(--amber)" : undefined)}
        {kpi(ko ? "실패 (5xx·에러)" : "Fail", stat.fail, stat.fail ? "var(--red)" : undefined)}
        {kpi(ko ? "평균 지연" : "Avg latency", stat.avg == null ? "-" : `${stat.avg}ms`)}
        <div style={{ padding: "12px 18px", flex: 1 }}>
          <span style={{ ...caps, display: "block" }}>{ko ? "P95 지연" : "P95 latency"}</span>
          <b style={mono({ display: "block", fontSize: 16, fontWeight: 700, marginTop: 4 })}>{stat.p95 == null ? "-" : `${stat.p95}ms`}</b>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={ko ? "tool · 경로 · 인자 검색" : "search tool · path · args"}
          style={{ ...mono({ fontSize: 11.5 }), width: 260, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)" }} />
        <span style={{ width: 1, height: 20, background: "var(--line2)" }} />
        {[["", ko ? "전체" : "All"], ["ok", OUT_LABEL.ok], ["warn", OUT_LABEL.warn], ["fail", OUT_LABEL.fail]].map(([k, lb]) => (
          <button key={k || "all"} onClick={() => setOutcome(k)} style={chip(outcome === k, k ? stCol(k) : undefined)}>{lb}</button>
        ))}
        {actors.length > 1 && (
          <select value={actor} onChange={(e) => setActor(e.target.value)}
            style={{ ...mono({ fontSize: 11 }), padding: "7px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)", cursor: "pointer" }}>
            <option value="">{ko ? "actor 전체" : "all actors"}</option>
            {actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 9, padding: 3 }}>
          {[["project", ko ? "현재 프로젝트" : "This project"], ["all", ko ? "전체" : "All projects"]].map(([k, lb]) => (
            <button key={k} onClick={() => setScope(k)}
              style={{ border: 0, background: scope === k ? "var(--main)" : "transparent", color: scope === k ? "var(--navy)" : "var(--muted)", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", boxShadow: scope === k ? "0 0 0 1px var(--line2)" : "none" }}>{lb}</button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div style={panel}>
        <div style={{ ...grid, borderBottom: "1px solid var(--line2)", paddingTop: 12, paddingBottom: 9 }}>
          <span style={caps}>{ko ? "시각" : "Time"}</span><span style={caps}>Actor</span>
          <span style={caps}>Tool</span><span style={caps}>{ko ? "엔드포인트" : "Endpoint"}</span>
          <span style={caps}>{ko ? "결과" : "Result"}</span>
          <span style={{ ...caps, textAlign: "right" }}>{ko ? "지연" : "Latency"}</span>
        </div>

        {loading ? (
          <div style={mono({ fontSize: 11.5, color: "var(--muted)", padding: "26px 18px" })}>{ko ? "불러오는 중…" : "Loading…"}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "30px 18px", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>
            {entries.length === 0
              ? (ko ? "아직 호출 기록이 없습니다. MCP 탐색에서 호출 테스트를 실행하거나, 변환 검증에서 스모크를 돌리면 여기에 기록됩니다."
                    : "No calls recorded yet.")
              : (ko ? "필터에 맞는 기록이 없습니다." : "No entries match the filter.")}
          </div>
        ) : rows.map((e, i) => {
          const out = OUTCOME(e);
          const open = openIdx === i;
          return (
            <div key={i} style={{ borderBottom: hairline }}>
              <div style={{ ...grid, cursor: "pointer", background: open ? "var(--main)" : "transparent" }}
                onClick={() => setOpenIdx(open ? null : i)}
                onMouseEnter={(ev) => { if (!open) ev.currentTarget.style.background = "var(--main)"; }}
                onMouseLeave={(ev) => { if (!open) ev.currentTarget.style.background = "transparent"; }}>
                <span style={mono({ fontSize: 11, color: "var(--muted)" })}>{timeOf(e.ts)}</span>
                <span style={mono({ fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{e.actor || "-"}</span>
                <span style={mono({ fontSize: 11.5, fontWeight: 600, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{e.tool_id}</span>
                <span style={mono({ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                  <b style={{ color: "var(--text)", marginRight: 7 }}>{e.method || ""}</b>{e.path || ""}
                </span>
                <span style={mono({ fontSize: 11, fontWeight: 700, color: stCol(out) })}>
                  {e.error ? "ERROR" : typeof e.status === "number" ? e.status : (ko ? "차단" : "blocked")}
                </span>
                <span style={mono({ fontSize: 11, color: "var(--muted)", textAlign: "right" })}>
                  {typeof e.latency_ms === "number" ? `${e.latency_ms}ms` : "-"}
                </span>
              </div>
              {open && (
                <div style={{ padding: "0 18px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ ...caps, margin: "2px 0 6px" }}>{ko ? "호출 인자 (마스킹됨)" : "Arguments (masked)"}</div>
                    <pre style={{ ...term, flex: "none", maxHeight: 220 }}>{JSON.stringify(e.args ?? {}, null, 2)}</pre>
                  </div>
                  <div>
                    <div style={{ ...caps, margin: "2px 0 6px" }}>{ko ? "결과" : "Result"}</div>
                    <pre style={{ ...term, flex: "none", maxHeight: 220 }}>{JSON.stringify({
                      outcome: OUT_LABEL[out], status: e.status ?? null, latency_ms: e.latency_ms ?? null,
                      ok: e.ok ?? null, error: e.error ?? null, actor: e.actor, ts: e.ts || null,
                    }, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
