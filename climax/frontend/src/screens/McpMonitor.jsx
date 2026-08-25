import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";

// S1 마스터-디테일 · MCP 활동 중심 모니터. 데이터 = monitorStatus(pid) 하나(recent 임베드).
// 좌: 밀집 목록(검색/정렬/필터) · 우: 선택 서버 상세(지표4 + 최근 호출로그).
// 레거시 프로브는 목록 dot + 상세 칩으로 축소. 색은 앱의 CSS var 사용(hero #101934만 리터럴).

const CAP = 200; // ponytail: 가상스크롤 라이브러리 없이 상한. 초과 시 검색으로 좁히도록 유도.

export default function McpMonitor({ t, lang }) {
  const ko = lang === "ko";
  const { activeId } = useProjects();
  const [status, setStatus] = useState({ enabled: false, servers: [], totals: {} });
  const [sel, setSel] = useState(null); // 선택 service
  const [q, setQ] = useState(""); // 검색어
  const [sort, setSort] = useState("errors"); // errors|calls|name|legacy
  const [filter, setFilter] = useState(null); // null|"errors"|"legacy_down"|"idle"
  const [probing, setProbing] = useState(null); // 프로브 중인 service

  const reload = () => {
    if (!activeId) return;
    api.monitorStatus(activeId)
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, servers: [], totals: {} }));
  };
  useEffect(() => { setSel(null); reload(); }, [activeId]);

  const probe = async (service) => {
    setProbing(service);
    try { await api.monitorProbe(activeId, service); reload(); }
    finally { setProbing(null); }
  };

  const view = useMemo(() => {
    let rows = status.servers || [];
    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((r) =>
        (r.service || "").toLowerCase().includes(s) ||
        (r.resources || []).some((x) => (x.name || "").toLowerCase().includes(s)));
    }
    if (filter === "errors") rows = rows.filter((r) => (r.error_rate || 0) > 0);
    if (filter === "legacy_down") rows = rows.filter((r) => r.legacy_state === "down");
    if (filter === "idle") rows = rows.filter((r) => (r.calls || 0) === 0);
    const cmp = {
      errors: (a, b) => (b.error_rate || 0) - (a.error_rate || 0),
      calls: (a, b) => (b.calls || 0) - (a.calls || 0),
      name: (a, b) => (a.service || "").localeCompare(b.service || ""),
      legacy: (a, b) => {
        const rank = { down: 0, warn: 1, unknown: 2, ok: 3 };
        return (rank[a.legacy_state] ?? 9) - (rank[b.legacy_state] ?? 9);
      },
    }[sort];
    return [...rows].sort(cmp);
  }, [status, q, filter, sort]);

  // 선택 없거나 현재 선택이 필터로 사라지면 목록 최상단을 default focus — 상세가 빈 적 없도록
  useEffect(() => {
    const rows = view || [];
    if (!rows.length) { if (sel) setSel(null); return; }
    if (!sel || !rows.some((s) => s.service === sel)) setSel(rows[0].service);
  }, [view, sel]);

  const shown = view.slice(0, CAP);
  const selServer = view.find((s) => s.service === sel) || null;

  if (!activeId) return <Empty msg={ko ? "프로젝트를 선택하세요." : "Select a project."} />;
  if (status.enabled === false) return <Empty msg={ko
    ? "아직 변환된 MCP가 없습니다. 변환 완료 후 모니터링이 활성화됩니다."
    : "No converted MCP yet. Monitoring activates after conversion."} />;

  const totals = status.totals || {};
  const servers = status.servers || [];
  const errPct = totals.error_rate != null ? Math.round(totals.error_rate * 1000) / 10 : 0;
  const errColor = errPct > 0 ? "var(--amber)" : "#fff";

  return (
    <div style={{ animation: "fadeUp .3s ease-out" }}>
      {/* PAGE HEADER — 메뉴 타이틀(카드 밖, 콘텐츠 상단) */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--blue-bg)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>▤</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>{ko ? "MCP 서버 모니터링" : "MCP Server Monitoring"}</h1>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
            {ko ? "MCP 호출 활동 중심, 레거시 원본 상태 병기" : "MCP call activity, legacy upstream health alongside"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)", background: "var(--green-bg)", border: "1px solid var(--line2)", borderRadius: 10, padding: "7px 12px" }}>
          <Dot c="var(--green)" />{ko ? "변환 완료 · 활성" : "Converted · Active"}
        </div>
      </div>

      {/* 지표 스트립 (다크, 타이틀 없음) */}
      <div style={{ background: "#101934", borderRadius: 20, padding: "18px 26px", boxShadow: "0 18px 44px rgba(0,0,0,.35)", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 22 }}>
          <Metric label="MCP calls" first>{totals.calls ?? 0}</Metric>
          <Metric label="Error rate" color={errColor}>{errPct}<small style={{ fontSize: 14, fontWeight: 600, color: "#8792b8" }}>%</small></Metric>
          <Metric label="MCP servers">{servers.length} <small style={{ fontSize: 14, fontWeight: 600, color: "#8792b8" }}>· tools {totals.tools ?? 0}</small></Metric>
          <Metric label="Legacy up" color={(totals.legacy_up ?? 0) === servers.length ? "#fff" : "var(--amber)"}>{totals.legacy_up ?? 0} <small style={{ fontSize: 14, fontWeight: 600, color: "#8792b8" }}>/ {servers.length}</small></Metric>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 220 }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={ko ? "tool·서비스 검색…" : "search tool·service…"}
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "var(--navy)", fontFamily: "var(--mono)", fontSize: 12 }} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 10, padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", cursor: "pointer" }}>
          <option value="errors">{ko ? "정렬: 에러율" : "sort: errors"}</option>
          <option value="calls">{ko ? "정렬: 호출" : "sort: calls"}</option>
          <option value="name">{ko ? "정렬: 이름" : "sort: name"}</option>
          <option value="legacy">{ko ? "정렬: 레거시" : "sort: legacy"}</option>
        </select>
        <Chip on={filter === "errors"} onClick={() => setFilter(filter === "errors" ? null : "errors")}>{ko ? "에러 있음" : "has errors"}</Chip>
        <Chip on={filter === "legacy_down"} onClick={() => setFilter(filter === "legacy_down" ? null : "legacy_down")}>{ko ? "레거시 down" : "legacy down"}</Chip>
        <Chip on={filter === "idle"} onClick={() => setFilter(filter === "idle" ? null : "idle")}>{ko ? "미호출" : "idle"}</Chip>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
          {view.length} {ko ? "서버" : "servers"}{view.length > CAP ? ` · ${ko ? "상위 200 표시 · 검색으로 좁히세요" : "top 200 shown · narrow by search"}` : ""}
        </span>
      </div>

      {/* MASTER-DETAIL */}
      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 14, height: 520 }}>
        {/* LEFT: dense list */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, fontFamily: "var(--mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>
            <span>{ko ? "서버 / 서비스" : "server / service"}</span>
            <span style={{ textAlign: "right" }}>{ko ? "호출" : "calls"}</span>
            <span style={{ textAlign: "right" }}>{ko ? "에러" : "err"}</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {shown.length === 0 && (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
                {ko ? "조건에 맞는 서버가 없습니다." : "No matching servers."}
              </div>
            )}
            {shown.map((s) => {
              const on = sel === s.service;
              const dotc = legacyDot(s.legacy_state);
              const ep = (s.error_rate || 0) * 100;
              const [etxt, ecol] = ep === 0 && (s.calls || 0) > 0
                ? ["0%", "var(--green)"]
                : (s.calls || 0) === 0
                  ? ["—", "var(--muted)"]
                  : [`${Math.round(ep * 10) / 10}%`, ep >= 5 ? "var(--red)" : "var(--amber)"];
              return (
                <div key={s.service} onClick={() => setSel(s.service)}
                  style={{ display: "grid", gridTemplateColumns: "1fr 64px 52px", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: on ? "var(--sel)" : "transparent", boxShadow: on ? "inset 3px 0 0 var(--sel-border)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Dot c={dotc} />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 13, fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--navy)" }}>{s.service}</b>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--faint)" }}>
                        {s.tools || 0} tools{legacySub(s.legacy_state, ko)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: (s.calls || 0) === 0 ? "var(--muted)" : "var(--navy)" }}>{abbr(s.calls || 0)}</div>
                  <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: ecol }}>{etxt}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: detail */}
        <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, padding: "18px 20px", overflowY: "auto" }}>
          {!selServer ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13.5 }}>
              {ko ? "왼쪽에서 서버를 선택하세요." : "Select a server on the left."}
            </div>
          ) : (
            <DetailView server={selServer} ko={ko} probing={probing} onProbe={() => probe(selServer.service)} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailView({ server, ko, probing, onProbe }) {
  const s = server;
  const busy = probing === s.service;
  const [llbl] = legacyLabel(s.legacy_state, ko);
  const ep = (s.error_rate || 0) * 100;
  const epTxt = (s.calls || 0) === 0 ? "—" : `${Math.round(ep * 10) / 10}%`;
  const epCol = ep === 0 ? "var(--green)" : ep >= 5 ? "var(--red)" : "var(--amber)";
  const recent = s.recent || [];

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Dot c={legacyDot(s.legacy_state)} size={11} />
        <div style={{ fontSize: 19, fontWeight: 800, color: "var(--navy)" }}>{s.service}</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", background: "var(--amber-bg)", padding: "5px 10px", borderRadius: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>
          {ko ? "레거시" : "legacy"} {llbl}{s.base_url ? ` · ${hostOf(s.base_url)}` : ""}{s.extra_hosts > 0 ? ` ${ko ? "외" : "+"} ${s.extra_hosts}` : ""}
        </span>
        <button onClick={onProbe} disabled={busy}
          style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 9, border: "1px solid var(--blue)", background: "transparent", color: "var(--blue)", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          {busy ? <Spinner /> : <span>↻</span>}{ko ? (busy ? "확인 중" : "확인") : (busy ? "probing" : "probe")}
        </button>
      </div>

      {/* metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <MetricTile k={ko ? "MCP 호출" : "MCP calls"} v={(s.calls ?? 0).toLocaleString()} />
        <MetricTile k={ko ? "에러율" : "error rate"} v={epTxt} color={(s.calls || 0) === 0 ? "var(--navy)" : epCol} />
        <MetricTile k="p95" v={s.p95 != null ? `${s.p95}ms` : "—"} color={s.p95 == null ? "var(--muted)" : "var(--navy)"} />
        <MetricTile k={ko ? "활성 tool" : "active tool"} v={`${s.active ?? 0}/${s.tools ?? 0}`} />
      </div>

      {/* recent log */}
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", margin: "4px 0 9px" }}>
        {ko ? "최근 호출 로그" : "recent call log"}
      </div>
      <pre style={{ background: "var(--code)", borderRadius: 12, padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.75, color: "var(--code-text)", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 240, margin: 0 }}>
        {recent.length === 0 ? (
          <span style={{ color: "var(--faint)" }}>
            {ko ? "아직 호출 없음 · MCP 탐색에서 호출 테스트 시 집계" : "no calls yet · counted when you test-call from MCP Explore"}
          </span>
        ) : (
          recent.map((e, i) => {
            const ok = e.ok !== false && (e.status == null || e.status < 400);
            const stTxt = ok
              ? `${e.status ?? 200} · ${e.latency_ms != null ? e.latency_ms + "ms" : "-"}`
              : `${e.status ?? "err"} err`;
            return (
              <div key={i}>
                <span style={{ color: "var(--faint)" }}>{(e.ts || "-").padEnd(10)}</span>
                {"  "}
                <span style={{ color: "var(--navy)", fontWeight: 600 }}>{(e.tool || "").padEnd(16)}</span>
                {"  "}
                <span style={{ color: "var(--faint)" }}>actor={e.actor || "-"}</span>
                {"  "}
                <span style={{ color: ok ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{stTxt}</span>
              </div>
            );
          })
        )}
      </pre>
    </div>
  );
}

// ── 헬퍼 ──────────────────────────────────────────────

// 호출수 축약: 1000 이상 → "1.2k"
function abbr(n) {
  if (n >= 1000) {
    const v = Math.round(n / 100) / 10;
    return `${v}k`;
  }
  return String(n);
}

function hostOf(url) {
  if (!url) return "";
  try { const u = new URL(url); return u.host; } catch { return url.replace(/^https?:\/\//, "").replace(/\/.*$/, ""); }
}

// legacy_state → dot 색
function legacyDot(state) {
  return { ok: "var(--green)", warn: "var(--amber)", down: "var(--red)" }[state] || "var(--faint)";
}

// legacy_state → [라벨]
function legacyLabel(state, ko) {
  return {
    ok: [ko ? "정상" : "up"],
    warn: [ko ? "일부 이상" : "warn"],
    down: [ko ? "응답 없음" : "down"],
  }[state] || [ko ? "미확인" : "unknown"];
}

// 목록 서브라인의 " · leg?" 부분
function legacySub(state, ko) {
  if (state === "down") return ` · ${ko ? "레거시 down" : "leg down"}`;
  if (state === "ok") return ` · ${ko ? "레거시 up" : "leg up"}`;
  if (state === "warn") return ` · ${ko ? "레거시 경고" : "leg warn"}`;
  return "";
}

function Dot({ c, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-block", background: c }} />;
}

function Chip({ on, onClick, children }) {
  return (
    <span onClick={onClick}
      style={{ fontFamily: "var(--mono)", fontSize: 10.5, padding: "6px 11px", borderRadius: 9, cursor: "pointer",
        border: "1px solid " + (on ? "var(--blue)" : "var(--line2)"),
        background: on ? "var(--blue-bg)" : "var(--card)",
        color: on ? "var(--blue-d, var(--blue))" : "var(--muted)" }}>
      {children}
    </span>
  );
}

function Metric({ label, children, first, color }) {
  return (
    <div style={{ borderLeft: first ? 0 : "1px solid rgba(255,255,255,.07)", paddingLeft: first ? 0 : 16 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "#8792b8" }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 800, color: color || "#fff", marginTop: 5, lineHeight: 1 }}>{children}</div>
    </div>
  );
}

function MetricTile({ k, v, color }) {
  return (
    <div style={{ background: "var(--main)", borderRadius: 12, padding: "12px 13px" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9, textTransform: "uppercase", color: "var(--muted)" }}>{k}</div>
      <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4, color: color || "var(--navy)" }}>{v}</div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />;
}

function Empty({ msg }) {
  return <div style={{ border: "1.5px dashed var(--line2)", borderRadius: 16, padding: "48px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13.5, animation: "fadeUp .3s ease-out" }}>{msg}</div>;
}
