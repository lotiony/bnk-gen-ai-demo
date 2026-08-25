import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { useDesign } from "../DesignContext";
import OntologyGraph from "../components/OntologyGraph";
import JobBanner from "../components/JobBanner";
import PipelineNav from "../components/PipelineNav";

const APPROVAL_COLOR = { auto: "#009387", manual: "#2f6fd0", approved: "#009387", pending: "#c26a12", rejected: "#d64545" };
const linkColor = (a) => APPROVAL_COLOR[a] || "#c26a12";

const _svg = (d) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const IC_CHECK = _svg(<path d="M20 6 9 17l-5-5" />);
const IC_X = _svg(<path d="M18 6 6 18M6 6l12 12" />);
const iconBtn = (icon, title, onClick, tone) => (
  <button onClick={onClick} title={title}
    style={{ border: `1px solid ${tone}`, background: `${tone}18`, color: tone, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>{icon}</button>
);

const TABS = {
  map_information: "Information",
  map_import: "Import",
  map_designer: "Graph Design",
  map_manual: "Manual",
  map_automap: "Auto-Map",
  map_materialize: "Materialize",
  map_diagnostics: "Diagnostics",
};

const th = { textAlign: "left", padding: "12px 18px", fontSize: 11, letterSpacing: ".05em", color: "var(--muted)", background: "var(--main)", borderBottom: "1px solid var(--line)" };
const td = { padding: "12px 18px", borderBottom: "1px solid var(--line)", color: "var(--text)" };

function Badge({ text, tone }) {
  const c = { auto: ["#e0f6f3", "#009387"], approved: ["#e0f6f3", "#009387"], pending: ["#fdeee0", "#c26a12"], rejected: ["#fde8e8", "#d64545"] }[tone] || ["var(--main)", "var(--muted)"];
  return <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: c[0], color: c[1], padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>{text}</span>;
}

function Bar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const tone = value >= 0.8 ? "var(--blue)" : value >= 0.6 ? "#e8a020" : "#d64545";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 72, height: 6, background: "var(--main)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: "var(--navy)", fontWeight: 700 }}>{value?.toFixed(2)}</span>
    </div>
  );
}

// 단순 리스트(Manual / Diagnostics)
function MapList({ view, field, cols, mapRow }) {
  const { activeId } = useProjects();
  const { rev } = useDesign();   // 에이전트 챗이 매핑을 바꾸면 증가 → 목록 재조회
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let alive = true; setBusy(true);
    api.mappingView(view)
      .then((d) => { if (alive) setRows((d?.[field] || []).map(mapRow || ((x) => x))); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [view, field, activeId, rev]);

  if (busy) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;
  if (!rows?.length) return <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>항목이 없습니다.</div>;

  return (
    <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead><tr>{cols.map(([, h]) => <th key={h} className="mono" style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(([k, , render]) => (
                <td key={k} style={{ ...td, borderBottom: i < rows.length - 1 ? td.borderBottom : "none" }}>{render ? render(r[k], r) : (r[k] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Auto-Map — 실행 + 게이트 A 승인/반려
const kindTag = (kind) => (
  <span className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99,
    background: kind === "entity" ? "#eaf1fb" : "var(--main)", color: kind === "entity" ? "#2f6fd0" : "var(--muted)" }}>
    {kind === "entity" ? "클래스" : "속성"}
  </span>
);

function AutoMap() {
  const { activeId } = useProjects();
  const { reload, rev } = useDesign();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // 시작 안내 배너 — 진행 상세는 상단 '작업'에서
  const pollRef = useRef(null);

  useEffect(() => {   // 탭 재진입·프로젝트 전환 시 저장된 마지막 실행 결과 복원 + 진행 중 잡 이어받기
    let alive = true;
    setData(null);
    api.mappingView("proposals")
      .then((d) => { if (alive && d.proposals?.length) setData(d); })
      .catch(() => {});
    api.automapStatus().then((s) => { if (alive && s.status === "running") { setBusy(true); poll(); } }).catch(() => {});
    return () => { alive = false; clearTimeout(pollRef.current); };
  }, [activeId]);

  // 백그라운드 잡 폴링 — 완료되면 저장된 제안을 다시 읽어 표시
  const poll = () => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => {
      api.automapStatus().then((s) => {
        if (s.status === "running") return poll();
        setBusy(false); setMsg(null);
        api.mappingView("proposals").then((d) => { setData(d); reload(); }).catch(() => {});
      }).catch(() => setBusy(false));
    }, 1500);
  };
  const run = () => {
    setBusy(true);
    api.mappingAutoRun().then(() => {
      setMsg({ text: "자동 매핑을 시작합니다. 진행 상황은 상단 '작업'에서 확인하세요." });
      poll();
    }).catch(() => setBusy(false));
  };
  const decide = (source, decision) =>
    api.mappingDecide(source, decision).then((p) => {
      setData((d) => ({ ...d, proposals: d.proposals.map((x) => (x.source === source ? { ...x, status: p.status } : x)) }));
      if (decision === "approve") reload();
    });

  const proposals = (data?.proposals || []).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const auto = proposals.filter((p) => p.status === "auto").length;
  const pending = proposals.filter((p) => p.status === "pending").length;

  return (
    <div>
      <JobBanner msg={msg} onClose={() => setMsg(null)} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={run} disabled={busy}
          style={{ border: "none", cursor: busy ? "default" : "pointer", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "10px 20px", borderRadius: 12, opacity: busy ? 0.6 : 1 }}>
          {busy ? "실행 중…" : data ? "다시 실행" : "자동 매핑 실행"}
        </button>
        {data && <span style={{ fontSize: 13, color: "var(--muted)" }}>임계값 <b style={{ color: "var(--navy)" }}>{data.threshold ?? 0.8}</b> · 자동승인 <b style={{ color: "#009387" }}>{auto}</b> · 사람승인 대기 <b style={{ color: "#c26a12" }}>{pending}</b>{data.ran_at ? <> · 실행 {data.ran_at}</> : null}</span>}
        {/* 실행 메타 배지 — 예전 실행 복원분(필드 없음 = null/undefined)에는 표시하지 않음 */}
        {data && data.semantic != null && (
          <span className="mono" title={data.semantic ? "글자 유사도 + 임베딩 의미 유사도 결합" : "임베딩 호출 실패/미설정 — 글자 유사도만 사용됨"}
            style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99, background: data.semantic ? "#e0f6f3" : "var(--main)", color: data.semantic ? "#009387" : "var(--muted)" }}>
            {data.semantic ? "의미매칭 ON" : "글자매칭만"}
          </span>
        )}
        {data && data.llm != null && (
          <span className="mono" title={data.llm ? "점수 미달 소스를 LLM 이 후보 중에서 최종 판정" : "LLM 판정 실패 — Azure OpenAI 미설정 또는 호출 오류 (점수 기준 폴백)"}
            style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99, background: data.llm ? "#f1ecfb" : "#fde8e8", color: data.llm ? "#8a63d2" : "#d64545" }}>
            {data.llm ? "LLM 판정 ON" : "LLM 판정 실패"}
          </span>
        )}
      </div>

      {!data ? (
        <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          정형 스키마를 온톨로지에 자동 매핑합니다 — <b>테이블→클래스</b>, <b>컬럼→속성</b>.
          신뢰도 <b>임계값 이상은 자동 승인·즉시 반영</b>, 미만은 <b>사람 승인(게이트 A)</b>으로 분리됩니다.
        </div>
      ) : (
        <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr>
              <th className="mono" style={{ ...th, width: 70 }}>종류</th>
              <th className="mono" style={th}>소스</th><th className="mono" style={th}>선택 후보</th>
              <th className="mono" style={th}>신뢰도</th><th className="mono" style={th}>게이트 A</th>
            </tr></thead>
            <tbody>
              {proposals.map((p, i) => (
                <tr key={p.source}>
                  <td style={{ ...td, borderBottom: i < proposals.length - 1 ? td.borderBottom : "none" }}>{kindTag(p.kind)}</td>
                  <td style={{ ...td, borderBottom: i < proposals.length - 1 ? td.borderBottom : "none" }}>
                    <div className="mono" style={{ color: "var(--navy)", fontWeight: 700 }}>{p.source}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.comment}</div>
                  </td>
                  <td style={{ ...td, borderBottom: i < proposals.length - 1 ? td.borderBottom : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: "var(--navy)", fontWeight: 600 }}>{p.chosen_label || "—"}</span>
                      {p.method === "llm" && <span className="mono" title="LLM 최종 판정" style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 7px", whiteSpace: "nowrap", borderRadius: 99, background: "#f1ecfb", color: "#8a63d2" }}>LLM</span>}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.chosen || ""}</div>
                  </td>
                  <td style={{ ...td, borderBottom: i < proposals.length - 1 ? td.borderBottom : "none" }}><Bar value={p.confidence} /></td>
                  <td style={{ ...td, borderBottom: i < proposals.length - 1 ? td.borderBottom : "none" }}>
                    {p.status === "auto" && <Badge text="자동 승인" tone="auto" />}
                    {p.status === "approved" && <Badge text="승인됨" tone="approved" />}
                    {p.status === "rejected" && <Badge text="반려됨" tone="rejected" />}
                    {p.status === "pending" && (
                      <span style={{ display: "flex", gap: 6 }}>
                        {iconBtn(IC_CHECK, "승인", () => decide(p.source, "approve"), "#009387")}
                        {iconBtn(IC_X, "반려", () => decide(p.source, "reject"), "#d64545")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 매핑 그래프 데이터 훅 — Designer 와 Information 현황 그래프가 공유.
// 노드 상태: 매핑됨 → 승인색 소스 태그(+data 속성 진행률 n/m), 미매핑 → 점선 표시.
function useMappingGraph() {
  const { activeId } = useProjects();
  const { rev } = useDesign();   // 에이전트 챗이 온톨로지·매핑을 바꾸면 증가 → 그래프 재조회
  const [ont, setOnt] = useState(null);       // {classes, properties}
  const [schema, setSchema] = useState([]);   // [{table, comment, columns:[{name,comment}]}]
  const [maps, setMaps] = useState(null);     // {entity_mappings, relationship_mappings}
  const [groups, setGroups] = useState([]);
  const [insts, setInsts] = useState([]);     // 문서 실체화 인스턴스 — 커버리지 doc 집계용
  const [rk, setRk] = useState(0);

  useEffect(() => {
    let alive = true;
    setOnt(null); setMaps(null);
    Promise.all([api.ontologyView("designer"), api.mappingSchema(), api.mappingView("designer"), api.ontologyGroups(), api.ontologyView("instances")])
      .then(([o, s, m, g, ins]) => {
        if (!alive) return;
        setOnt({ classes: o.classes || [], properties: o.properties || [] });
        setSchema(s.tables || []); setMaps(m); setGroups(g.groups || []); setInsts(ins.instances || []);
      })
      .catch(() => { if (alive) { setOnt({ classes: [], properties: [] }); setSchema([]); setMaps({ entity_mappings: [], relationship_mappings: [] }); } });
    return () => { alive = false; };
  }, [activeId, rk, rev]);

  const nodes = ont?.classes || [];
  const edges = useMemo(() => {
    if (!ont) return [];
    const uris = new Set(ont.classes.map((c) => c.uri));
    const rel = ont.properties.filter((p) => p.kind === "object" && uris.has(p.domain) && uris.has(p.range))
      .map((p) => ({ domain: p.domain, range: p.range, label: p.label, uri: p.uri }));
    // 계층(subClassOf)도 포함 — 온톨로지 Designer 와 같은 엣지 집합이어야 레이아웃이 같은 모양으로
    // 수렴하고, 계층으로만 연결된 클래스가 고립 노드로 구석에 밀리지 않는다.
    const hier = ont.classes.filter((c) => c.parent && uris.has(c.parent))
      .map((c) => ({ domain: c.uri, range: c.parent, label: "", kind: "hier" }));
    return rel.concat(hier);
  }, [ont]);
  const entMap = useMemo(() => Object.fromEntries((maps?.entity_mappings || []).map((e) => [e.ontology_class, e])), [maps]);
  const relMap = useMemo(() => Object.fromEntries((maps?.relationship_mappings || []).map((r) => [r.property, r])), [maps]);
  const docCls = useMemo(() => new Set(insts.map((i) => i.class)), [insts]);   // 문서 인스턴스 보유 클래스

  const nodeStatus = (uri) => {
    const e = entMap[uri];
    if (!e) return { dashed: true };   // 미매핑 — 점선·흐림
    const ps = (ont?.properties || []).filter((p) => p.domain === uri);
    const done = ps.filter((p) => relMap[p.uri]).length;
    return { color: linkColor(e.approval), tag: ps.length ? `${e.source} · ${done}/${ps.length}` : e.source };
  };

  return { ont, schema, maps, groups, nodes, edges, entMap, relMap, docCls, insts, nodeStatus, refetch: () => setRk((k) => k + 1) };
}

// Mapping Designer — 온톨로지 Designer 와 동일한 그래프 + 노드 클릭 매핑 편집
function MappingDesigner() {
  const { reload, rev } = useDesign();
  const { ont, schema, maps, groups, nodes, edges, entMap, relMap, nodeStatus, refetch } = useMappingGraph();
  const [sel, setSel] = useState(null);       // 선택된 클래스 uri
  const [msg, setMsg] = useState(null);

  const refresh = () => { refetch(); reload(); };
  const runSeq = (ops) => ops.reduce((pr, op) => pr.then(op), Promise.resolve());

  const setEntity = (uri, table) => {
    const cur = entMap[uri];
    const ops = [];
    if (cur && cur.source !== table) ops.push(() => api.mappingDeleteLink("entity", uri, cur.source));
    if (table && (!cur || cur.source !== table)) ops.push(() => api.mappingAddLink("entity", uri, table, 1.0));
    if (!ops.length) return;
    runSeq(ops).then(refresh);
  };
  const setRel = (prop, col) => {
    const cur = relMap[prop];
    const ops = [];
    if (cur && cur.source !== col) ops.push(() => api.mappingDeleteLink("relationship", prop, cur.source));
    if (col && (!cur || cur.source !== col)) ops.push(() => api.mappingAddLink("relationship", prop, col, 1.0));
    if (!ops.length) return;
    runSeq(ops).then(refresh);
  };

  if (!ont || !maps) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;

  const totalLinks = (maps.entity_mappings || []).length + (maps.relationship_mappings || []).length;
  const selClass = nodes.find((c) => c.uri === sel);
  const selProps = sel ? ont.properties.filter((p) => p.domain === sel) : [];
  // 연결(교차) 테이블 = FK 2개 이상 + 자기 키 없이 FK 로 시작 — object 관계의 다대다 매핑 대상
  const relTables = schema.filter((t) => (t.columns || []).filter((c) => c.fk).length >= 2 && t.columns?.[0]?.fk);
  const inp = { border: "1px solid var(--line2)", borderRadius: 9, padding: "8px 11px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--app)", outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer" };
  const lbl = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 5, display: "block" };
  const open = !!selClass;

  const mapBadge = (m) => m && (
    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: linkColor(m.approval) + "22", color: linkColor(m.approval), padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>
      {m.approval === "auto" ? "자동" : m.approval === "manual" ? "수동" : m.approval} · {Number(m.confidence).toFixed(2)}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: 420 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ fontSize: 14 }}>
          <b style={{ color: "var(--navy)" }}>{nodes.length}</b> <span style={{ color: "var(--muted)" }}>classes ·</span>{" "}
          <b style={{ color: "var(--navy)" }}>{totalLinks}</b> <span style={{ color: "var(--muted)" }}>mappings · 노드를 클릭해 소스를 매핑하세요</span>
        </div>
        <span style={{ flex: 1 }} />
        {[["auto", "자동 매핑"], ["manual", "수동/승인"]].map(([a, t]) => (
          <span key={a} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            <i className="mono" style={{ fontStyle: "normal", fontSize: 8.5, fontWeight: 700, color: "#fff", background: linkColor(a), padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99 }}>TB · n/m</i>{t}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
          <i style={{ width: 13, height: 13, borderRadius: "50%", border: "1.6px dashed var(--faint)", background: "var(--main)" }} />미매핑
        </span>
        {edges.some((e) => e.kind === "hier") && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
            <i style={{ width: 16, height: 0, borderTop: "2px dashed #8a93ab" }} />⊑ 상위
          </span>
        )}
        <button onClick={refetch} style={{ border: "1px solid var(--line2)", background: "var(--app)", color: "var(--text)", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>↻ 새로고침</button>
      </div>

      <OntologyGraph nodes={nodes} edges={edges} groups={groups} selected={sel}
        onSelect={(uri) => { setMsg(null); setSel(uri); }} nodeStatus={nodeStatus}
        containerStyle={{ flex: 1, minHeight: 0 }} />

      {/* 우측 슬라이드 — 선택 클래스 매핑 편집 */}
      {open && <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,48,.18)", zIndex: 40 }} />}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "24vw", minWidth: 360, maxWidth: 560, background: "var(--app)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(27,36,64,.16)", zIndex: 41, transform: open ? "translateX(0)" : "translateX(101%)", transition: "transform .2s ease-out", display: "flex", flexDirection: "column" }}>
        {selClass && (
          <>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15, color: "var(--navy)" }}>{selClass.label}</b>
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{selClass.uri}</div>
              </div>
              <button onClick={() => setSel(null)} title="닫기" style={{ border: "1px solid var(--line2)", background: "var(--app)", color: "var(--muted)", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <span style={lbl}>클래스 → 소스 테이블</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select value={entMap[sel]?.source || ""} onChange={(e) => setEntity(sel, e.target.value)} style={inp}>
                    <option value="">— 매핑 없음 —</option>
                    {schema.map((t) => <option key={t.table} value={t.table}>{t.table}{t.comment ? ` (${t.comment})` : ""}</option>)}
                  </select>
                  {mapBadge(entMap[sel])}
                </div>
              </div>

              <div>
                <span style={{ ...lbl, marginBottom: 10 }}>속성 → 소스 컬럼 <span style={{ color: "var(--faint)", fontWeight: 500 }}>({selProps.length})</span></span>
                {selProps.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>이 클래스에 연결된 속성이 없습니다.</span> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {selProps.map((p) => (
                      <div key={p.uri}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{p.label}</span>
                          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{p.kind}</span>
                          {mapBadge(relMap[p.uri])}
                        </div>
                        <select value={relMap[p.uri]?.source || ""} onChange={(e) => setRel(p.uri, e.target.value)} style={inp}>
                          <option value="">— 매핑 없음 —</option>
                          {p.kind === "object" && relTables.length > 0 && (
                            <optgroup label="연결 테이블 (다대다 관계)">
                              {relTables.map((t) => <option key={t.table} value={t.table}>{t.table}{t.comment ? ` (${t.comment})` : ""}</option>)}
                            </optgroup>
                          )}
                          {schema.map((t) => (
                            <optgroup key={t.table} label={t.table}>
                              {(t.columns || []).map((c) => <option key={`${t.table}.${c.name}`} value={`${t.table}.${c.name}`}>{c.name}{c.comment ? ` (${c.comment})` : ""}{c.fk ? ` · FK→${c.fk}` : ""}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg && <span style={{ color: "#c26a12", fontSize: 12.5, fontWeight: 600 }}>{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Manual — 표 기반 수동 매핑 편집기. 온톨로지의 모든 클래스/속성을 나열하고
// 행마다 셀렉트로 소스 테이블/컬럼을 지정·변경·해제한다 (Designer 노드 클릭 편집의 일괄 버전).
const KIND_TAG = {
  entity: ["클래스", "#eaf1fb", "#2f6fd0"],
  data: ["속성", "var(--main)", "var(--muted)"],
  object: ["관계", "#f1ecfb", "#8a63d2"],
};

function ManualMapping() {
  const { reload, rev } = useDesign();
  const { ont, schema, maps, nodes, entMap, relMap, docCls, refetch } = useMappingGraph();
  const [q, setQ] = useState("");
  if (!ont || !maps) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;

  const refresh = () => { refetch(); reload(); };
  const runSeq = (ops) => ops.reduce((pr, op) => pr.then(op), Promise.resolve());
  const setLink = (kind, uri, cur, source) => {
    const ops = [];
    if (cur && cur.source !== source) ops.push(() => api.mappingDeleteLink(kind, uri, cur.source));
    if (source && (!cur || cur.source !== source)) ops.push(() => api.mappingAddLink(kind, uri, source, 1.0));
    if (ops.length) runSeq(ops).then(refresh);
  };

  const clsLabel = (uri) => nodes.find((c) => c.uri === uri)?.label || uri;
  // 연결(교차) 테이블 = FK 2개 이상 + 자기 키 없이 FK 로 시작 — 다대다 관계의 매핑 대상 (R2RML 관행)
  const relTables = schema.filter((t) => (t.columns || []).filter((c) => c.fk).length >= 2 && t.columns?.[0]?.fk);
  const rows = [
    // doc: 문서 인스턴스로 실체화된 클래스 — 정형 매핑 없이도 커버된 것으로 취급(Diagnostics 기준과 동일)
    ...nodes.map((c) => ({ kind: "entity", uri: c.uri, label: c.label, sub: "", m: entMap[c.uri], doc: docCls.has(c.uri) })),
    ...ont.properties.map((p) => ({ kind: p.kind, uri: p.uri, label: p.label, sub: clsLabel(p.domain), m: relMap[p.uri] })),
  ].filter((r) => !q || r.label.includes(q) || r.uri.includes(q) || r.sub.includes(q) || (r.m?.source || "").includes(q));
  const mappedN = rows.filter((r) => r.m || r.doc).length;

  const inp = { border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontFamily: "var(--sans)", background: "var(--app)", outline: "none", width: "100%", maxWidth: 320, boxSizing: "border-box", cursor: "pointer" };
  const badge = (m) => m && (
    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: linkColor(m.approval) + "22", color: linkColor(m.approval), padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap" }}>
      {m.approval === "auto" ? "자동" : m.approval === "manual" ? "수동" : m.approval} · {Number(m.confidence).toFixed(2)}
    </span>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · URI · 소스 검색"
          style={{ border: "1px solid var(--line2)", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--app)", color: "var(--text)", outline: "none", width: 240 }} />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          <b style={{ color: "var(--navy)" }}>{mappedN}</b> / {rows.length} 커버됨 (정형 매핑 + 문서 실체화) — 셀렉트로 소스를 지정하거나 해제하세요
        </span>
      </div>

      <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead><tr>
            <th className="mono" style={{ ...th, width: 70 }}>종류</th>
            <th className="mono" style={th}>온톨로지 대상</th>
            <th className="mono" style={th}>소스 매핑</th>
            <th className="mono" style={{ ...th, width: 110 }}>상태</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const [kLabel, kBg, kColor] = KIND_TAG[r.kind] || KIND_TAG.data;
              const last = i === rows.length - 1;
              return (
                <tr key={r.uri}>
                  <td style={{ ...td, borderBottom: last ? "none" : td.borderBottom }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99, background: kBg, color: kColor }}>{kLabel}</span>
                  </td>
                  <td style={{ ...td, borderBottom: last ? "none" : td.borderBottom }}>
                    <b style={{ color: "var(--navy)" }}>{r.label}</b>
                    {r.sub && <span style={{ fontSize: 12, color: "var(--muted)" }}> · {r.sub}</span>}
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{r.uri}</div>
                  </td>
                  <td style={{ ...td, borderBottom: last ? "none" : td.borderBottom }}>
                    {r.kind === "entity" ? (
                      <select value={r.m?.source || ""} onChange={(e) => setLink("entity", r.uri, r.m, e.target.value)} style={inp}>
                        <option value="">— 매핑 없음 —</option>
                        {schema.map((t) => <option key={t.table} value={t.table}>{t.table}{t.comment ? ` (${t.comment})` : ""}</option>)}
                      </select>
                    ) : (
                      <select value={r.m?.source || ""} onChange={(e) => setLink("relationship", r.uri, r.m, e.target.value)} style={inp}>
                        <option value="">— 매핑 없음 —</option>
                        {r.kind === "object" && relTables.length > 0 && (
                          <optgroup label="연결 테이블 (다대다 관계)">
                            {relTables.map((t) => <option key={t.table} value={t.table}>{t.table}{t.comment ? ` (${t.comment})` : ""}</option>)}
                          </optgroup>
                        )}
                        {schema.map((t) => (
                          <optgroup key={t.table} label={t.table}>
                            {(t.columns || []).map((c) => <option key={`${t.table}.${c.name}`} value={`${t.table}.${c.name}`}>{c.name}{c.comment ? ` (${c.comment})` : ""}{c.fk ? ` · FK→${c.fk}` : ""}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={{ ...td, borderBottom: last ? "none" : td.borderBottom }}>
                    {badge(r.m)
                      || (r.doc && <span className="mono" title="문서 인스턴스로 실체화됨 — 정형 매핑 불필요 (필요 시 추가 가능)" style={{ fontSize: 10.5, fontWeight: 700, background: "#f1ecfb", color: "#8a63d2", padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>문서 실체화</span>)
                      || <span style={{ fontSize: 12, color: "var(--faint)" }}>미매핑</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>검색 결과가 없습니다.</div>}
      </div>
    </div>
  );
}

// Information — 오버뷰 대시보드. "전체 N개 중 M개 매핑"을 헤드라인 숫자 + 진행 링으로.
const SEG_C = { auto: "#009387", manual: "#2f6fd0", doc: "#8a63d2", none: "#e3e6f0" };
const SEG_NAME = { auto: "자동", manual: "수동", doc: "문서", none: "미매핑" };

// 원형 진행 링 — 매핑률(단일 색조 = 크기 인코딩), 중앙에 퍼센트 헤드라인
function Ring({ pct, color = "#009387" }) {
  const R = 56, C = 2 * Math.PI * R;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" style={{ flexShrink: 0 }}>
      <circle cx="75" cy="75" r={R} fill="none" stroke="var(--main)" strokeWidth="15" />
      {pct > 0 && (
        <circle cx="75" cy="75" r={R} fill="none" stroke={color} strokeWidth="15" strokeLinecap="round"
          strokeDasharray={`${C * Math.min(1, pct)} ${C}`} transform="rotate(-90 75 75)" />
      )}
      <text x="75" y="86" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--navy)">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

function CoverageTile({ title, sub, d }) {
  const mapped = d.total - d.none;
  const pct = d.total ? mapped / d.total : 0;
  // 하단 분해 행 — 색 점 + 라벨 + 비율 바 + 수치. 배타 분할(각 항목이 정확히 한 버킷): 자동+수동+문서+미매핑 = 전체.
  // '문서'는 정형 매핑 없이 문서 실체화로만 커버된 doc-only 수(정형 매핑과 겹치지 않음).
  const maxN = Math.max(d.auto, d.manual, d.doc ?? 0, d.none, 1);
  const row = (label, n, color, outline) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderTop: "1px solid var(--line)" }}>
      <i style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: outline ? "1px solid var(--line2)" : "none", flexShrink: 0 }} />
      <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", width: 56, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "var(--main)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${(n / maxN) * 100}%`, height: "100%", background: outline ? "#cfd5e4" : color, borderRadius: 99 }} />
      </div>
      <b className="mono" style={{ fontSize: 16, color: "var(--navy)", minWidth: 40, textAlign: "right" }}>{n}</b>
    </div>
  );
  return (
    <div style={{ flex: "1 1 340px", minWidth: 320, background: "var(--app)", border: "1px solid var(--line)", borderRadius: 18, padding: "24px 28px", display: "flex", flexDirection: "column" }}>
      {/* 타이틀 — 진하게 */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>{title}</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", marginLeft: 8 }}>{sub}</span>
      </div>
      {/* 상단 — 링 + 헤드라인 */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18 }}>
        <Ring pct={pct} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "var(--navy)", lineHeight: 1.1, marginBottom: 6 }}>
            {mapped}<span style={{ fontSize: 21, color: "var(--muted)", fontWeight: 700 }}> / {d.total}</span>
          </div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>전체 {d.total}개 중<br />{mapped}개 매핑됨</div>
        </div>
      </div>
      {/* 하단 — 배타 분할: 자동/수동/문서(문서만)/미매핑이 겹치지 않고 합이 전체와 같다. */}
      <div>
        {row("자동", d.auto, SEG_C.auto)}
        {row("수동", d.manual, SEG_C.manual)}
        {(d.doc ?? 0) > 0 && row("문서", d.doc, SEG_C.doc)}
        {row("미매핑", d.none, SEG_C.none, true)}
      </div>
    </div>
  );
}

// 승인 구성 스택바 — 세그먼트 간 2px 표면 간격, 바깥 끝만 4px 라운드, 폭 충분하면 안쪽 수치
function StackBar({ d, height = 26 }) {
  const segs = ["auto", "manual", "doc", "none"].filter((k) => d[k] > 0);
  if (!d.total) return <div style={{ flex: 1, height, borderRadius: 5, border: "1px dashed var(--line2)" }} />;
  return (
    <div style={{ flex: 1, display: "flex", gap: 2, height }}>
      {segs.map((k, i) => (
        <div key={k} title={`${SEG_NAME[k]} ${d[k]}`}
          style={{ flex: d[k], minWidth: 10, background: SEG_C[k], display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: `${i === 0 ? "5px" : "0"} ${i === segs.length - 1 ? "5px 5px" : "0 0"} ${i === 0 ? "5px" : "0"}` }}>
          {d[k] / d.total >= 0.09 && (
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: k === "none" ? "var(--muted)" : "#fff" }}>{d[k]}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function MappingCharts() {
  const { ont, maps, nodes, entMap, relMap, docCls } = useMappingGraph();
  if (!maps || !ont) return <div style={{ color: "var(--muted)", padding: "24px 4px" }}>현황 불러오는 중…</div>;
  if (!nodes.length) return null;
  const props = ont.properties || [];

  // docSet: 테이블 매핑이 없어도 문서 인스턴스로 실체화된 항목은 '문서' 커버로 집계
  const tally = (items, pick, docSet) => {
    let auto = 0, manual = 0, doc = 0;
    for (const it of items) {
      const m = pick(it);
      if (m?.approval === "auto") auto++;
      else if (m) manual++;
      else if (docSet?.has(it.uri)) doc++;
    }
    return { auto, manual, doc, none: items.length - auto - manual - doc, total: items.length };
  };
  // tally 는 배타 분할(자동/수동/문서만/미매핑) — 타일 분해·스택바·링 모두 이 배타 카운트를 쓴다.
  const cls = tally(nodes, (c) => entMap[c.uri], docCls);
  const dat = tally(props.filter((p) => p.kind === "data"), (p) => relMap[p.uri]);
  const obj = tally(props.filter((p) => p.kind === "object"), (p) => relMap[p.uri]);
  const kinds = [["엔티티", cls], ["속성", dat], ["관계", obj]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <CoverageTile title="엔티티" sub="CLASS" d={cls} />
        <CoverageTile title="속성" sub="DATA" d={dat} />
        <CoverageTile title="관계" sub="OBJECT" d={obj} />
      </div>

      {/* 승인 구성 — 종류별 자동/수동/미매핑 비율을 한 화면에서 비교 */}
      <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 18, padding: "24px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <b style={{ fontSize: 16, color: "var(--navy)" }}>매핑 승인 구성</b>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            {["auto", "manual", "doc", "none"].map((k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--muted)" }}>
                <i style={{ width: 12, height: 12, borderRadius: 4, background: SEG_C[k], border: k === "none" ? "1px solid var(--line2)" : "none" }} />{SEG_NAME[k]}
              </span>
            ))}
          </div>
        </div>
        {kinds.map(([lb, d]) => (
          <div key={lb} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 13 }}>
            <span style={{ width: 56, fontSize: 14.5, fontWeight: 700, color: "var(--navy)", textAlign: "right", flexShrink: 0 }}>{lb}</span>
            <StackBar d={d} />
            <span className="mono" style={{ fontSize: 13.5, color: "var(--muted)", width: 96, flexShrink: 0 }}>
              {d.total - d.none}/{d.total} 매핑
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 오답 원인 배지 메타 — 4종(데이터없음·관계없음·앵커링오류·LLM오류)
const CAUSE_META = {
  no_data: { label: "데이터 없음", color: "#6b7280", bg: "rgba(107,114,128,.14)" },
  no_relation: { label: "관계 없음", color: "#b45309", bg: "rgba(180,83,9,.14)" },
  anchor_error: { label: "앵커링 오류", color: "#2563eb", bg: "rgba(37,99,235,.14)" },
  llm_error: { label: "LLM 오류", color: "#7c3aed", bg: "rgba(124,58,237,.14)" },
};
const STATUS_META = {
  open: { label: "미분석", color: "var(--muted)" },
  analyzed: { label: "분석됨", color: "var(--navy)" },
  resolved: { label: "해결됨", color: "#009387" },
  dismissed: { label: "무시", color: "var(--faint)" },
};

// 오답 케이스 — Query 가 답 못 낸 질의 수집 → '플랫폼에이전트' 원인 분석 → 조치하기 폐루프.
function FailureCases() {
  const { activeId } = useProjects();
  const { reload } = useDesign();   // 관계 추가 등 조치 후 온톨로지 갱신 신호
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);      // 배치 분석 중
  const [acting, setActing] = useState(null);   // 조치 중인 fid
  const [note, setNote] = useState(null);       // 조치 결과/가이드 배너

  const load = () => api.failuresList().then((d) => setItems(d.failures || [])).catch(() => setItems([]));
  useEffect(() => { setItems(null); setNote(null); load(); }, [activeId]);

  const analyze = () => { if (busy) return; setBusy(true); setNote(null); api.failuresAnalyze().then(load).catch(() => {}).finally(() => setBusy(false)); };
  const act = (f) => {
    setActing(f.id); setNote(null);
    api.failureAct(f.id).then((r) => {
      if (r.error) setNote({ tone: "err", text: r.error });
      else if (r.manual) setNote({ tone: "info", text: `💡 ${r.guide}` });
      else { setNote({ tone: "ok", text: `✓ 조치 완료 — ${r.action}${r.detail ? ` (${r.detail})` : ""}` }); reload(); }
      load();
    }).catch(() => setNote({ tone: "err", text: "조치 실패" })).finally(() => setActing(null));
  };
  const setStatus = (f, status) => api.failureSetStatus(f.id, status).then(load).catch(() => {});
  const del = (f) => api.failureDelete(f.id).then(load).catch(() => {});

  const card = { background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" };
  const head = { display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" };
  if (items == null) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;
  const openCount = items.filter((f) => f.status === "open").length;
  const noteBg = { ok: "rgba(0,147,135,.1)", err: "var(--red-bg)", info: "var(--blue-soft)" };
  const noteFg = { ok: "#009387", err: "var(--red)", info: "var(--ans-title)" };

  return (
    <div style={card}>
      <div style={head}>
        <b style={{ fontSize: 14.5, color: "var(--navy)" }}>🧪 오답 케이스</b>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{items.length}건{openCount ? ` · 미분석 ${openCount}` : ""}</span>
        <span style={{ flex: 1 }} />
        <button onClick={analyze} disabled={busy || !openCount}
          title="미분석 오답의 원인(데이터없음·관계없음·앵커링·LLM)을 플랫폼에이전트가 분석합니다"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 30, boxSizing: "border-box", border: "none", background: openCount ? "var(--blue)" : "var(--line2)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 14px", borderRadius: 8, cursor: busy || !openCount ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy && <span style={{ width: 11, height: 11, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />}
          {busy ? "분석 중…" : "분석"}
        </button>
      </div>
      {note && (
        <div style={{ margin: "12px 18px 0", padding: "9px 13px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
          background: noteBg[note.tone], color: noteFg[note.tone], border: `1px solid ${noteFg[note.tone]}33` }}>{note.text}</div>
      )}
      {items.length === 0 ? (
        <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          수집된 오답이 없습니다 — Query 에서 답을 못 낸 질의(노드 0·"확인 불가")가 자동으로 여기 모입니다.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["질문", "원인", "오답 사유", "상태", ""].map((h, i) => <th key={i} className="mono" style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((f, i) => {
              const cm = CAUSE_META[f.cause];
              const sm = STATUS_META[f.status] || STATUS_META.open;
              const last = i === items.length - 1;
              const bb = last ? "none" : td.borderBottom;
              const canAct = f.status === "analyzed" || (f.cause && f.status !== "resolved");
              return (
                <tr key={f.id}>
                  <td style={{ ...td, borderBottom: bb, maxWidth: 300 }}>
                    <div style={{ color: "var(--navy)", fontWeight: 600 }}>{f.question}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>발생 {f.hits}회 · {(f.last_seen || "").replace("T", " ")}</div>
                  </td>
                  <td style={{ ...td, borderBottom: bb, width: 96 }}>
                    {cm ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: cm.bg, color: cm.color, whiteSpace: "nowrap" }}>{cm.label}</span>
                      : <span style={{ fontSize: 11, color: "var(--faint)" }}>미분석</span>}
                  </td>
                  <td style={{ ...td, borderBottom: bb, fontSize: 12.5, color: "var(--text)", maxWidth: 360 }}>{f.reason || <span style={{ color: "var(--faint)" }}>—</span>}</td>
                  <td style={{ ...td, borderBottom: bb, width: 68 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: sm.color }}>{sm.label}</span></td>
                  <td style={{ ...td, borderBottom: bb, width: 150, whiteSpace: "nowrap" }}>
                    {canAct && f.status !== "resolved" && (
                      <button onClick={() => act(f)} disabled={acting === f.id}
                        style={{ border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 11.5, padding: "5px 10px", borderRadius: 7, cursor: "pointer", marginRight: 6, opacity: acting === f.id ? 0.6 : 1 }}>
                        {acting === f.id ? "…" : "조치하기"}
                      </button>
                    )}
                    {f.status !== "dismissed" && f.status !== "resolved" && (
                      <button onClick={() => setStatus(f, "dismissed")} title="무시"
                        style={{ border: "1px solid var(--line2)", background: "transparent", color: "var(--muted)", fontSize: 11.5, padding: "5px 9px", borderRadius: 7, cursor: "pointer", marginRight: 6 }}>무시</button>
                    )}
                    <button onClick={() => del(f)} title="삭제" style={{ border: "none", background: "transparent", color: "var(--faint)", fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Diagnostics — 매핑 공백/신뢰도 이슈 + SHACL 계약 검증 + 오답 케이스(서브탭).
function DiagnosticsPanel() {
  const { activeId } = useProjects();
  const [sub, setSub] = useState("contract");   // contract(계약 검증) | failures(오답 케이스)
  const [issues, setIssues] = useState(null);
  const [shacl, setShacl] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setIssues(null); setShacl(null);
    api.mappingView("diagnostics")
      .then((d) => { if (alive) { setIssues(d.issues || []); setShacl(d.shacl || null); } })
      .catch(() => { if (alive) setIssues([]); });
    return () => { alive = false; };
  }, [activeId]);

  const runShacl = () => {
    if (busy) return;
    setBusy(true);
    api.shaclRun().then(setShacl).catch(() => {}).finally(() => setBusy(false));
  };

  const card = { background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 16 };
  const head = { display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" };
  const subBtn = (id, label) => (
    <button key={id} onClick={() => setSub(id)}
      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700,
        color: sub === id ? "var(--navy)" : "var(--muted)", padding: "8px 4px", marginBottom: -1,
        borderBottom: `2px solid ${sub === id ? "var(--blue)" : "transparent"}` }}>{label}</button>
  );

  return (
    <div>
      {/* 서브탭 — 계약 검증 / 오답 케이스 */}
      <div style={{ display: "flex", gap: 18, marginBottom: 16, borderBottom: "1px solid var(--line)" }}>
        {subBtn("contract", "🛡️ 계약 검증")}
        {subBtn("failures", "🧪 오답 케이스")}
      </div>
      {sub === "failures" ? <FailureCases /> : issues == null ? (
        <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>
      ) : (
      <>
      {/* SHACL 계약 검증 */}
      <div style={card}>
        <div style={head}>
          <b style={{ fontSize: 14.5, color: "var(--navy)" }}>🛡️ SHACL 계약 검증</b>
          {shacl && (shacl.conforms
            ? <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99, background: "#e0f6f3", color: "#009387" }}>적합 ✓</span>
            : <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99, background: "#fde8e8", color: "#d64545" }}>위반 {shacl.violations?.length ?? 0}건</span>)}
          {shacl && <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>shapes {shacl.shapes}{shacl.rules ? ` · ⚖ 교차규칙 ${shacl.rules}` : ""} · 실행 {shacl.ran_at}</span>}
          <span style={{ flex: 1 }} />
          <button onClick={runShacl} disabled={busy}
            title="온톨로지 계약(허용값 owl:oneOf · 관계 domain/range)에서 SHACL shapes 를 생성하고, 사실 교차검증 규칙(⚖ 사고일∈보험기간 · 청구담보∈가입담보 · 지급액≤가입금액, SHACL-SPARQL)으로 A-Box(문서+행) 전체를 검증합니다"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 30, boxSizing: "border-box", border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 14px", borderRadius: 8, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy && <span style={{ width: 11, height: 11, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />}
            검증 실행
          </button>
        </div>
        {!shacl ? (
          <div style={{ padding: "26px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            아직 실행 전 — 허용값(owl:oneOf)·관계(domain/range) 계약 위반을 검사합니다. 행 실체화 후 실행하세요.
          </div>
        ) : shacl.violations?.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["대상", "속성", "위반 값", "내용"].map((h) => <th key={h} className="mono" style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {shacl.violations.map((v, i) => (
                <tr key={i}>
                  <td style={{ ...td, borderBottom: i < shacl.violations.length - 1 ? td.borderBottom : "none" }}><b style={{ color: "var(--navy)" }}>{v.target}</b></td>
                  <td style={{ ...td, borderBottom: i < shacl.violations.length - 1 ? td.borderBottom : "none" }} className="mono">{v.path}</td>
                  <td style={{ ...td, borderBottom: i < shacl.violations.length - 1 ? td.borderBottom : "none" }}><span style={{ color: "#d64545", fontWeight: 700 }}>{v.value}</span></td>
                  <td style={{ ...td, borderBottom: i < shacl.violations.length - 1 ? td.borderBottom : "none", fontSize: 12.5 }}>{v.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "26px 20px", textAlign: "center", color: "#009387", fontSize: 13, fontWeight: 600 }}>✓ 모든 A-Box 데이터가 온톨로지 계약에 적합합니다.</div>
        )}
      </div>

      {/* 집계 안전성 — 차원별 disjoint(단일값)·covering(전수) 검사. 합산을 소스로 밀기 전 안전 계약. */}
      {shacl?.agg_safety && (() => {
        const A = shacl.agg_safety;
        const VM = { safe: { t: "✅ 합산 안전", c: "#009387", bg: "rgba(0,147,135,.12)" },
          partial: { t: "🟡 부분", c: "#b7791f", bg: "rgba(183,121,31,.14)" },
          risk: { t: "🔴 이중계산 위험", c: "#d64545", bg: "rgba(214,69,69,.14)" } };
        const nRisk = A.filter((x) => x.verdict === "risk").length;
        return (
          <div style={card}>
            <div style={head}>
              <b style={{ fontSize: 14.5, color: "var(--navy)" }}>📊 집계 안전성</b>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>차원 {A.length}개 · 이중계산 위험 {nRisk}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>GROUP BY 합산이 안전한지(겹침·누락) 검사</span>
            </div>
            {A.length === 0 ? (
              <div style={{ padding: "22px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>검사할 카테고리 차원이 없습니다. (행 실체화 후 실행)</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["차원", "판정", "값 종류", "커버리지", "이중계산", "누락"].map((h) => <th key={h} className="mono" style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {A.map((x, i) => {
                    const v = VM[x.verdict]; const bb = i < A.length - 1 ? td.borderBottom : "none";
                    return (
                      <tr key={i}>
                        <td style={{ ...td, borderBottom: bb }}><b style={{ color: "var(--navy)" }}>{x.cls}</b><span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}> · {x.dimension}</span></td>
                        <td style={{ ...td, borderBottom: bb }}><span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: v.bg, color: v.c, whiteSpace: "nowrap" }}>{v.t}</span></td>
                        <td style={{ ...td, borderBottom: bb }} className="mono">{x.distinct}종</td>
                        <td style={{ ...td, borderBottom: bb }} className="mono">{Math.round(x.coverage * 100)}%</td>
                        <td style={{ ...td, borderBottom: bb }} className="mono"><span style={{ color: x.double_count ? "#d64545" : "var(--faint)", fontWeight: x.double_count ? 700 : 400 }}>{x.double_count}</span></td>
                        <td style={{ ...td, borderBottom: bb }} className="mono"><span style={{ color: x.undercount ? "#b7791f" : "var(--faint)" }}>{x.undercount}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={{ padding: "9px 18px", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", lineHeight: 1.5 }}>
              이중계산=한 개체가 값 2개(겹침 → 합산 부풀림) · 누락=값 없는 개체(GROUP BY 에서 빠져 과소집계). 둘 다 0이면 이 차원으로 소스에 합산을 안전하게 밀 수 있음.
            </div>
          </div>
        );
      })()}

      {/* 매핑 이슈 (gap / low_confidence) */}
      <div style={card}>
        <div style={head}><b style={{ fontSize: 14.5, color: "var(--navy)" }}>매핑 이슈</b><span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{issues.length}건</span></div>
        {issues.length === 0 ? (
          <div style={{ padding: "26px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>이슈가 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <tbody>
              {issues.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, width: 110, borderBottom: i < issues.length - 1 ? td.borderBottom : "none" }}><Badge text={r.type} tone={r.type === "gap" ? "pending" : "rejected"} /></td>
                  <td style={{ ...td, borderBottom: i < issues.length - 1 ? td.borderBottom : "none" }} className="mono">{r.target}</td>
                  <td style={{ ...td, borderBottom: i < issues.length - 1 ? td.borderBottom : "none" }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}
    </div>
  );
}

// Materialize — 매핑·문서에서 인스턴스(A-Box) 생성.
// ① 정형DB: 승인된 클래스↔테이블 매핑이 실체화 규칙(행→인스턴스, 트리플 스토어 연동 시).
// ② 문서: 조항 청크에서 승인된 클래스의 개별 사례를 추출·적재(편-장-절-관-조 출처 보존).
function MaterializePanel() {
  const { activeId } = useProjects();
  const { reload, ontology, rev } = useDesign();
  const rowAccess = (ontology?.row_access === "materialized" || ontology?.materialize_rows) ? "materialized" : "virtual";   // 정형DB 행 접근 모드 (off 폐지 — 기본 virtual)
  const [rowBusy, setRowBusy] = useState(false);
  const setAccess = (mode) => {
    if (rowBusy || mode === rowAccess) return;
    setRowBusy(true);
    const label = { virtual: "가상 OBDA — SPARQL 을 R2RML 로 SQL 로 번역(복제 없음)", materialized: "실체화 — 행을 그래프에 트리플로 적재" }[mode];
    api.setRowAccess(mode)
      .then((r) => { setMsg({ text: `행 접근: ${label}${r.triples ? ` · ${r.triples} triples` : ""}${r.value_domains ? ` · 값 계약 ${r.value_domains}` : ""}` }); reload(); })
      .catch(() => {})
      .finally(() => setRowBusy(false));
  };
  const [rows, setRows] = useState(null);     // 문서 인스턴스
  const [links, setLinks] = useState([]);     // 인스턴스 간 관계 [{s,p_label,o_label,...}]
  const [maps, setMaps] = useState(null);     // {entity_mappings, ...}
  const [classes, setClasses] = useState([]);
  const [rk, setRk] = useState(0);
  const [job, setJob] = useState(null);
  const [expand, setExpand] = useState({});
  const [sec, setSec] = useState("db");       // 하위 탭 — "db" | "doc"
  const [msg, setMsg] = useState(null);       // 시작 안내 배너 — 진행 상세는 상단 '작업'에서
  const pollRef = useRef(null);

  const [dbRows, setDbRows] = useState({});   // 테이블별 행 수 — 데모 DB
  const [sameAs, setSameAs] = useState([]);   // 엔티티 해소 링크 (inst: ↔ dat: owl:sameAs)
  const [saBusy, setSaBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([api.ontologyView("instances"), api.mappingView("designer"), api.ontologyView("entities"), api.mappingSchema(), api.resolveList().catch(() => ({ links: [] }))])
      .then(([d, m, e, s, sa]) => {
        if (!alive) return;
        setRows(d.instances || []); setLinks(d.instance_links || []); setMaps(m); setClasses(e.entities || []);
        setDbRows(Object.fromEntries((s.tables || []).map((t) => [t.table, t.rows])));
        setSameAs(sa.links || []);
      })
      .catch(() => { if (alive) { setRows([]); setMaps({ entity_mappings: [] }); } });
    api.instantiateStatus().then((s) => { if (alive) { setJob(s); if (s.status === "running") startPoll(); } }).catch(() => {});
    return () => { alive = false; clearTimeout(pollRef.current); };
  }, [activeId, rk, rev]);

  const startPoll = () => {
    clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => {
      api.instantiateStatus().then((s) => {
        setJob(s);
        if (s.status === "running") startPoll();
        else { setMsg(null); setRk((k) => k + 1); reload(); }
      }).catch(() => {});
    }, 1500);
  };
  const run = () => {
    api.ontologyInstantiate().then((r) => {
      if (r.error) { setJob({ status: "error", error: r.error }); return; }
      setMsg({ text: "문서 인스턴스 추출을 시작합니다. 진행 상황은 상단 '작업'에서 확인하세요." });
      setJob({ status: "running" }); startPoll();
    });
  };
  const clearDocs = () => {
    if (!window.confirm("추출된 문서 인스턴스를 모두 삭제할까요?")) return;
    api.ontologyInstancesClear().then(() => { setRk((k) => k + 1); reload(); });
  };
  const runResolve = () => {
    if (saBusy) return;
    setSaBusy(true);
    api.resolveRun()
      .then((r) => { setSameAs(r.links || []); setMsg({ text: `엔티티 해소 완료 — 자동 연결 ${r.auto} · 승인 대기 ${r.pending}` }); })
      .catch(() => {}).finally(() => setSaBusy(false));
  };
  const decideResolve = (l, d) =>
    api.resolveDecide(l.inst, l.dat, d)
      .then(() => api.resolveList()).then((r) => setSameAs(r.links || [])).catch(() => {});

  const running = job?.status === "running";
  const clsLabel = (uri) => classes.find((c) => c.uri === uri)?.label || uri;
  const byClass = useMemo(() => {
    const m = {};
    for (const r of rows || []) (m[r.class_label || r.class] = m[r.class_label || r.class] || []).push(r);
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  const outLinks = useMemo(() => {   // 인스턴스 → 나가는 관계 목록
    const m = {};
    for (const l of links) (m[l.s] = m[l.s] || []).push(l);
    return m;
  }, [links]);
  const ents = maps?.entity_mappings || [];

  if (rows == null || maps == null) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;

  const card = { background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 16 };
  const secHead = { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" };

  // 하위 탭 버튼 — 밑줄 스타일, 개수 표시
  const tabBtn = (key, label, count) => {
    const on = sec === key;
    return (
      <button key={key} onClick={() => setSec(key)}
        style={{ border: "none", background: "transparent", cursor: "pointer", padding: "9px 2px", marginRight: 26,
          fontSize: 14, fontWeight: on ? 800 : 600, color: on ? "var(--navy)" : "var(--muted)",
          borderBottom: on ? "2.5px solid var(--blue)" : "2.5px solid transparent", display: "inline-flex", alignItems: "center", gap: 7 }}>
        {label}
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: on ? "#eaf1fb" : "var(--main)", color: on ? "#2f6fd0" : "var(--muted)", padding: "2px 8px", whiteSpace: "nowrap", borderRadius: 99 }}>{count}</span>
      </button>
    );
  };

  return (
    <div>
      <JobBanner msg={msg} onClose={() => setMsg(null)} />
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -8, marginBottom: 14 }}>
        온톨로지(T-Box) → 인스턴스(A-Box) 생성. 정형DB는 매핑 규칙으로, 비정형 문서는 추출로 실체화됩니다.
      </p>

      <div style={{ borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
        {tabBtn("db", "정형DB", ents.length)}
        {tabBtn("doc", "문서 기반 인스턴스", rows.length)}
        {tabBtn("resolve", "🧩 엔티티 해소", sameAs.filter((l) => l.status === "auto" || l.status === "approved").length)}
      </div>

      {/* ① 정형DB 실체화 규칙 */}
      {sec === "db" && <div style={card}>
        <div style={secHead}>
          <b style={{ fontSize: 14.5, color: "var(--navy)" }}>정형DB 실체화 규칙</b>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{ents.length} 매핑</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => window.open(api.ontologyExportR2rmlUrl(), "_blank")}
            title="승인된 매핑을 표준 R2RML(Turtle)로 내려받습니다 — Ontop 등 정식 OBDA 엔진에서 그대로 사용 가능"
            style={{ display: "inline-flex", alignItems: "center", height: 30, boxSizing: "border-box", border: "1px solid #009387", background: "#e0f6f3", color: "#009387", fontWeight: 700, fontSize: 12, padding: "0 13px", borderRadius: 8, cursor: "pointer" }}>⭳ R2RML</button>
          {/* 정형DB 행 접근 2-state — 운영에선 실체화 대신 가상(SPARQL→SQL)이 표준 (off 폐지) */}
          <span style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 9, overflow: "hidden", height: 30 }}>
            {[["virtual", "🔀 가상", "SPARQL 을 R2RML 로 SQL 로 번역해 DB 직접 조회 — 복제 없음(Ontop 방식)"],
              ["materialized", "⚡ 실체화", "행을 트리플로 그래프에 적재 — OWL 추론 포함, 데이터 복제"]].map(([mode, label, tip]) => (
              <button key={mode} onClick={() => setAccess(mode)} disabled={rowBusy} title={tip}
                style={{ border: "none", background: rowAccess === mode ? "var(--blue)" : "var(--app)", color: rowAccess === mode ? "#fff" : "var(--muted)", fontWeight: 700, fontSize: 12, padding: "0 12px", cursor: rowBusy ? "default" : "pointer" }}>{label}</button>
            ))}
          </span>
        </div>
        {ents.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>승인된 클래스↔테이블 매핑이 없습니다 — Auto-Map/Graph Design에서 먼저 매핑하세요.</div>
        ) : (
          <div>
            {ents.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < ents.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>{e.source}</span>
                <span style={{ color: "var(--faint)" }}>→</span>
                <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{clsLabel(e.ontology_class)}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  테이블의 각 행 = 인스턴스{dbRows[e.source] != null && <> · <b style={{ color: "var(--navy)" }}>{dbRows[e.source]}행</b></>}
                </span>
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: linkColor(e.approval) + "22", color: linkColor(e.approval), padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>{e.approval === "auto" ? "자동" : "수동"}</span>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* ③ 엔티티 해소 — 같은 실체(문서 inst: vs DB 행 dat:)를 owl:sameAs 로 통합 */}
      {sec === "resolve" && (() => {
        const active = sameAs.filter((l) => l.status === "auto" || l.status === "approved");
        const pend = sameAs.filter((l) => l.status === "pending");
        const tone = { auto: ["#e0f6f3", "#009387", "자동"], approved: ["#e0f6f3", "#009387", "승인"], pending: ["#fdf3e0", "#c26a12", "대기"], rejected: ["#fde8e8", "#d64545", "반려"] };
        const shown = [...pend, ...active, ...sameAs.filter((l) => l.status === "rejected")];
        return (
          <div style={card}>
            <div style={secHead}>
              <b style={{ fontSize: 14.5, color: "var(--navy)" }}>🧩 엔티티 해소</b>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                연결 {active.length}{pend.length > 0 ? ` · 대기 ${pend.length}` : ""}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>문서 인스턴스 ↔ DB 행 · owl:sameAs · 키/라벨 결정 매칭(LLM 미사용)</span>
              <button onClick={runResolve} disabled={saBusy}
                title="문서 인스턴스와 정형DB 행을 owl:sameAs 로 연결합니다 — 결정적 키(담보코드·증권번호 등) 일치와 라벨 완전일치는 자동, 유사(≥0.8)는 사람 승인"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 30, boxSizing: "border-box", border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 14px", borderRadius: 8, cursor: saBusy ? "default" : "pointer", opacity: saBusy ? 0.6 : 1 }}>
                {saBusy && <span style={{ width: 11, height: 11, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />}
                해소 실행
              </button>
            </div>
            {shown.length === 0 ? (
              <div style={{ padding: "34px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                아직 해소 결과가 없습니다. <b>해소 실행</b> — 예: 문서의 <b>대인배상Ⅱ</b> ↔ DB 행 <b>TB_COV_MST 대인배상Ⅱ</b>가 하나의 실체로 통합됩니다.
              </div>
            ) : shown.map((l, i) => {
              const [bg, fg, txt] = tone[l.status] || tone.pending;
              return (
                <div key={`${l.inst}|${l.dat}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i < shown.length - 1 ? "1px solid var(--line)" : "none", opacity: l.status === "rejected" ? 0.55 : 1 }}>
                  <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{l.inst_label}</b>
                  <span className="mono" style={{ fontSize: 10.5, background: "#f1ecfb", color: "#8a63d2", padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>문서</span>
                  <span style={{ color: "var(--faint)", fontWeight: 700 }}>⇄</span>
                  <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{l.dat_label}</b>
                  <span className="mono" style={{ fontSize: 10.5, background: "#eaf1fb", color: "#2f6fd0", padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>{(l.dat || "").replace("dat:", "").split("_").slice(0, 3).join("_")}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{l.basis === "key" ? `🔑 키 일치 ${l.key || ""}` : l.basis === "exact" ? "완전일치" : `유사 ${l.score}`}</span>
                  <span style={{ flex: 1 }} />
                  {l.status === "pending" ? (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <button onClick={() => decideResolve(l, "approve")} style={{ border: "none", background: "#e0f6f3", color: "#009387", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>승인</button>
                      <button onClick={() => decideResolve(l, "reject")} style={{ border: "none", background: "#fde8e8", color: "#d64545", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>반려</button>
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, background: bg, color: fg, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99 }}>{txt}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ② 문서 기반 인스턴스 — ①과 동일한 카드/헤더 구조 */}
      {sec === "doc" && <div style={{ ...card, marginBottom: 0 }}>
        <div style={secHead}>
          <b style={{ fontSize: 14.5, color: "var(--navy)" }}>문서 기반 인스턴스</b>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {rows.length} instances{links.length > 0 ? ` · 관계 ${links.length}` : ""}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>조항 청크 → 승인된 클래스의 개별 사례</span>
          <button onClick={run} disabled={running}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 30, boxSizing: "border-box", border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 14px", borderRadius: 8, cursor: running ? "default" : "pointer", opacity: running ? 0.6 : 1 }}>
            {running ? <span style={{ width: 12, height: 12, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> : "✦"}
            {running ? "추출 중…" : "문서 인스턴스 추출"}
          </button>
          {rows.length > 0 && (
            <button onClick={clearDocs} style={{ display: "inline-flex", alignItems: "center", height: 30, boxSizing: "border-box", border: "1px solid #d64545", background: "#fde8e8", color: "#d64545", fontWeight: 700, fontSize: 12, padding: "0 13px", borderRadius: 8, cursor: "pointer" }}>초기화</button>
          )}
        </div>

        {job?.status === "error" && <div style={{ margin: "14px 18px 0", padding: "11px 16px", background: "#fde8e8", border: "1px solid #d64545", borderRadius: 12, color: "#d64545", fontSize: 13, fontWeight: 600 }}>{job.error}</div>}

        {rows.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            아직 문서 인스턴스가 없습니다. <b>문서 인스턴스 추출</b>을 실행하세요 — 예: 클래스 <b>특약</b> → 인스턴스 <b>고령자교통안전교육특약</b>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 18px" }}>
            {byClass.map(([cls, items]) => {
              const open = expand[cls] !== false;
              return (
                <div key={cls} style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                  <div onClick={() => setExpand((e) => ({ ...e, [cls]: !open }))}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", cursor: "pointer", background: "var(--main)", borderBottom: open ? "1px solid var(--line)" : "none" }}>
                    <span style={{ color: "var(--faint)", fontSize: 11, transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                    <b style={{ fontSize: 14, color: "var(--navy)" }}>{cls}</b>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{items.length} instances</span>
                  </div>
                  {open && items.map((r, i) => (
                    <div key={r.uri} style={{ padding: "11px 16px 11px 34px", borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)", marginBottom: 3 }}>{r.label}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.path ? `${r.doc} · ${r.path}` : r.doc || "—"}</div>
                      {r.evidence && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 3 }}>{r.evidence}</div>}
                      {/* 데이터 속성 값 — 속성: 값 칩 */}
                      {(r.values || []).length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {r.values.map((v) => (
                            <span key={v.prop} className="mono" style={{ fontSize: 10.5, background: "var(--main)", color: "var(--navy)", padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>
                              <span style={{ color: "var(--muted)" }}>{v.label}</span> {v.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* 인스턴스 간 관계 — →관계→ 대상 */}
                      {(outLinks[r.uri] || []).length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {outLinks[r.uri].map((l, k) => (
                            <span key={k} className="mono" title={l.evidence} style={{ fontSize: 10.5, background: "#f1ecfb", color: "#8a63d2", padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>
                              →{l.p_label}→ {l.o_label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>}
    </div>
  );
}

export default function MappingDesign({ screen, go }) {
  const tab = TABS[screen] || "Information";

  return (
    <div style={{ padding: "28px 34px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: 0 }}>Mapping · {tab}</h1>
      </div>
      <p style={{ color: "var(--text)", fontSize: 14, marginBottom: 24 }}>정형DB → 온톨로지 매핑 · {tab}</p>

      {tab === "Information" && <><PipelineNav go={go} /><MappingCharts /></>}

      {tab === "Auto-Map" && <AutoMap />}

      {tab === "Manual" && <ManualMapping />}

      {tab === "Diagnostics" && <DiagnosticsPanel />}

      {tab === "Graph Design" && <MappingDesigner />}

      {tab === "Materialize" && <MaterializePanel />}

      {tab === "Import" && (
        <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "52px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{tab}</div>
          이 화면은 준비 중입니다 — 다음 슬라이스에서 구현됩니다.
        </div>
      )}
    </div>
  );
}
