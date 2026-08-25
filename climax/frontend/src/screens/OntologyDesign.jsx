import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { useDesign } from "../DesignContext";
import { motion } from "framer-motion";
import { shades, dispLabel, degreeMap, nodeR, useGraphSim, nodePop, edgeGeom, prefersReducedMotion, zoomView, hierarchyDepth, HIER_COLOR, CORE_COLOR, hexPath, PROP_COLOR } from "../components/OntologyGraph";
import JobBanner from "../components/JobBanner";
import QueryPanel from "./QueryPanel";
import PipelineNav from "../components/PipelineNav";
import { MappingCharts } from "./MappingDesign";

// 사이드바 screen id → 탭 제목
const TABS = {
  ont_information: "Information",
  ont_import: "Import",
  ont_generate: "Generate",
  ont_designer: "Graph Design",
  ont_entities: "Entities",
  ont_relationships: "Relationships",
  query: "Query",   // 최상위 검증 화면 — 온톨로지·매핑 공용이라 ont_ 접두사 없음
};

// 리스트형 탭 — view API 로 받아 표로 렌더
const LIST_VIEWS = {
  ont_entities: { view: "entities", field: "entities", cols: [["label", "이름"], ["uri", "URI"], ["parent", "상위"], ["group", "그룹"]] },
  ont_relationships: { view: "relationships", field: "relationships", cols: [["label", "이름"], ["uri", "URI"], ["domain", "도메인"], ["range", "레인지"]] },
};

function ListTable({ cfg }) {
  const { activeId } = useProjects();
  const { reload, rev } = useDesign();   // rev = 에이전트 챗이 온톨로지를 바꿨을 때 증가
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(true);
  const [rk, setRk] = useState(0);
  const [classes, setClasses] = useState([]);   // 관계 domain/range 선택지
  const [groups, setGroups] = useState([]);      // 엔티티 그룹 선택지
  const [form, setForm] = useState(null);        // 편집 슬라이드 폼
  const [err, setErr] = useState(null);

  const editable = cfg.view === "entities" || cfg.view === "relationships";
  const isEnt = cfg.view === "entities";

  useEffect(() => {
    let alive = true;
    setBusy(true); setForm(null); setErr(null);
    const jobs = [api.ontologyView(cfg.view)];
    if (editable) jobs.push(api.ontologyView("entities"), api.ontologyGroups());
    Promise.all(jobs)
      .then(([d, ents, grp]) => {
        if (!alive) return;
        setRows(d?.[cfg.field] || []);
        if (editable) { setClasses(ents?.entities || []); setGroups(grp?.groups || []); }
      })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [cfg.view, cfg.field, activeId, rk, rev]);   // eslint-disable-line

  const refresh = () => { setRk((k) => k + 1); reload(); };
  const clsLabel = (uri) => classes.find((c) => c.uri === uri)?.label || uri;
  const openRow = (r) => {
    if (!editable) return;
    setErr(null);
    setForm(isEnt
      ? { uri: r.uri, label: r.label || "", group: r.group || "default", parent: r.parent || "" }
      : { uri: r.uri, label: r.label || "", domain: r.domain, range: r.range, description: r.description || "" });
  };
  const close = () => { setForm(null); setErr(null); };
  const save = () => {
    if (!form.label.trim()) { setErr("이름을 입력하세요."); return; }
    const done = (res) => { if (res?.error) setErr(res.error); else { close(); refresh(); } };
    const fail = (e) => setErr(String(e.message || e));
    if (isEnt) api.ontologyUpdateEntity(form.uri, form.label.trim(), form.group, form.parent ?? "").then(done).catch(fail);
    else api.ontologyUpdateRelationship(form.uri, form.label.trim(), form.domain, form.range, form.description || "").then(done).catch(fail);
  };
  const del = () => {
    if (!window.confirm(isEnt ? "이 엔티티를 삭제할까요? 연결된 관계도 함께 정리됩니다." : "이 관계를 삭제할까요?")) return;
    const done = () => { close(); refresh(); };
    (isEnt ? api.ontologyDeleteEntity(form.uri) : api.ontologyDeleteRelationship(form.uri)).then(done);
  };

  const inp = { border: "1px solid var(--line2)", borderRadius: 9, padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--sans)", background: "var(--app)", outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 5, display: "block" };
  const open = !!form;

  return (
    <>
      {busy ? <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>
        : !rows || rows.length === 0 ? (
          <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
            이 프로젝트에는 아직 항목이 없습니다.
          </div>
        ) : (
          <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  {cfg.cols.map(([, h]) => (
                    <th key={h} className="mono" style={{ textAlign: "left", padding: "12px 18px", fontSize: 11, letterSpacing: ".05em", color: "var(--muted)", background: "var(--main)", borderBottom: "1px solid var(--line)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.uri || r.id || i} onClick={() => openRow(r)}
                    style={{ cursor: editable ? "pointer" : "default", background: open && form.uri === r.uri ? "var(--blue-soft)" : undefined }}
                    onMouseEnter={editable ? (e) => { if (!(open && form.uri === r.uri)) e.currentTarget.style.background = "var(--main)"; } : undefined}
                    onMouseLeave={editable ? (e) => { if (!(open && form.uri === r.uri)) e.currentTarget.style.background = ""; } : undefined}>
                    {cfg.cols.map(([k]) => (
                      <td key={k} style={{ padding: "12px 18px", borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none", color: k === "label" ? "var(--navy)" : "var(--text)", fontWeight: k === "label" ? 700 : 400, fontFamily: (k === "uri" || k === "domain" || k === "range") ? "var(--mono, monospace)" : undefined }}>
                        {k === "parent" ? (r[k] ? clsLabel(r[k]) : "—")
                          : (k === "domain" || k === "range") && !isEnt ? clsLabel(r[k]) : (r[k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* 우측 슬라이드 편집 패널 (전체화면 ~20%) */}
      {open && <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(20,26,48,.18)", zIndex: 40 }} />}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "20vw", minWidth: 340, maxWidth: 560, background: "var(--app)", borderLeft: "1px solid var(--line)", boxShadow: "-12px 0 40px rgba(27,36,64,.16)", zIndex: 41, transform: open ? "translateX(0)" : "translateX(101%)", transition: "transform .2s ease-out", display: "flex", flexDirection: "column" }}>
        {form && (
          <>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
              <b style={{ fontSize: 15, color: "var(--navy)", flex: 1 }}>{isEnt ? "엔티티 수정" : "관계 수정"}</b>
              {iconBtn(IC.x, "닫기", close, "var(--muted)")}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <span style={lbl}>이름</span>
                <input value={form.label} autoFocus onChange={(e) => { setForm((f) => ({ ...f, label: e.target.value })); setErr(null); }}
                  onKeyDown={(e) => e.key === "Enter" && save()} style={inp} />
              </div>
              {isEnt ? (
                <>
                <div>
                  <span style={lbl}>그룹</span>
                  <select value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                    <option value="default">미지정</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <span style={lbl}>상위 클래스 (subClassOf)</span>
                  <select value={form.parent || ""} onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                    <option value="">— 없음 (최상위) —</option>
                    {classes.filter((c) => c.uri !== form.uri).map((c) => <option key={c.uri} value={c.uri}>{c.label || c.uri}</option>)}
                  </select>
                </div>
                </>
              ) : (
                <>
                  <div>
                    <span style={lbl}>출발 클래스 (domain)</span>
                    <select value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                      {classes.map((c) => <option key={c.uri} value={c.uri}>{c.label || c.uri}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>도착 클래스 (range)</span>
                    <select value={form.range} onChange={(e) => setForm((f) => ({ ...f, range: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                      {classes.map((c) => <option key={c.uri} value={c.uri}>{c.label || c.uri}</option>)}
                    </select>
                  </div>
                  <div>
                    <span style={lbl}>설명 (선택)</span>
                    <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={inp} />
                  </div>
                </>
              )}
              <div>
                <span style={lbl}>URI</span>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)", background: "var(--main)", borderRadius: 8, padding: "8px 12px", wordBreak: "break-all" }}>{form.uri}</div>
              </div>
              {err && <span style={{ color: "#d64545", fontSize: 12.5, fontWeight: 600 }}>{err}</span>}
            </div>
            <div style={{ borderTop: "1px solid var(--line)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={save} disabled={!form.label.trim()} title="저장"
                style={{ border: "none", background: "var(--blue)", color: "#fff", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, cursor: form.label.trim() ? "pointer" : "default", opacity: form.label.trim() ? 1 : 0.45 }}>{IC.check}</button>
              {iconBtn(IC.trash, "삭제", del, "#d64545")}
              <span style={{ flex: 1 }} />
              {iconBtn(IC.x, "취소", close, "var(--muted)")}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function MiniBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const tone = value >= 0.8 ? "var(--blue)" : value >= 0.6 ? "#e8a020" : "#d64545";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 64, height: 6, background: "var(--main)", borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: tone }} /></div>
      <span className="mono" style={{ fontSize: 12, color: "var(--navy)", fontWeight: 700 }}>{value?.toFixed(2)}</span>
    </div>
  );
}

// CQ(예상질문) 관리 — 엑셀 업로드 + 생성/수정/삭제
function CQPanel({ cqState }) {
  const { activeId } = useProjects();
  const qBadge = (q) => {
    if (!cqState) return null;
    return stateDot(cqState.failed.includes(q) ? "failed" : cqState.done.includes(q) ? "done" : "pending");
  };
  const [cqs, setCqs] = useState([]);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(null);

  useEffect(() => { api.cqList().then((d) => setCqs(d.cqs)).catch(() => setCqs([])); }, [activeId]);

  const add = () => {
    const q = input.trim(); if (!q) return;
    api.cqAdd(q).then((cq) => { setCqs((cs) => [...cs, cq]); setInput(""); });
  };
  const save = (id) => {
    const q = editText.trim(); if (!q) return;
    api.cqUpdate(id, q).then((cq) => { setCqs((cs) => cs.map((x) => (x.id === id ? cq : x))); setEditId(null); });
  };
  const del = (id) => api.cqDelete(id).then(() => setCqs((cs) => cs.filter((x) => x.id !== id)));
  const upload = (file) => {
    if (!file) return; setBusy(true); setImp(null);
    api.cqImport(file).then((d) => { if (d.error) setImp({ err: d.error }); else { setCqs(d.cqs); setImp({ added: d.added, filename: d.filename }); } })
      .catch((e) => setImp({ err: String(e.message || e) })).finally(() => setBusy(false));
  };


  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>예상질문 (Competency Questions) <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>· {cqs.length}건</span></div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px solid var(--blue)", background: "var(--app)", color: "var(--blue-d)", fontWeight: 700, fontSize: 13, padding: "8px 16px", borderRadius: 10, cursor: "pointer" }}>
          <input type="file" accept=".xlsx,.xlsm,.csv,.txt" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} />
          {busy ? "업로드 중…" : "⭱ 엑셀 업로드"}
        </label>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>CQ가 온톨로지 범위(생성 대상)를 정합니다. 엑셀(.xlsx)·CSV 업로드 또는 직접 추가하세요.</p>

      {imp && (imp.err
        ? <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 9, background: "#fde8e8", color: "#c0392b", fontSize: 13 }}>{imp.err}</div>
        : <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 9, background: "var(--blue-soft)", color: "var(--blue-d)", fontSize: 13 }}>{imp.filename} — {imp.added}건 추가</div>)}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="예상질문 입력 후 Enter 또는 추가" style={{ flex: 1, border: "1px solid var(--line2)", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: "var(--sans)", outline: "none" }} />
        <button onClick={add} style={{ border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "0 22px", borderRadius: 10, cursor: "pointer" }}>추가</button>
      </div>

      {cqs.length === 0 ? (
        <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "var(--muted)" }}>아직 예상질문이 없습니다.</div>
      ) : (
        <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, flex: 1, minHeight: 160, overflowY: "auto" }}>
          {cqs.map((cq, i) => (
            <div key={cq.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: i < cqs.length - 1 ? "1px solid var(--line)" : "none" }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)", width: 22, flexShrink: 0 }}>{i + 1}</span>
              {editId === cq.id ? (
                <>
                  <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save(cq.id)} autoFocus
                    style={{ flex: 1, border: "1px solid var(--blue)", borderRadius: 8, padding: "6px 10px", fontSize: 14, fontFamily: "var(--sans)", outline: "none" }} />
                  {iconBtn(IC.check, "저장", () => save(cq.id), "#009387")}
                  {iconBtn(IC.x, "취소", () => setEditId(null), "var(--muted)")}
                </>
              ) : (
                <>
                  <span style={{ flex: 1, color: "var(--navy)", fontSize: 14 }}>{cq.question}</span>
                  {qBadge(cq.question)}
                  {iconBtn(IC.edit, "수정", () => { setEditId(cq.id); setEditText(cq.question); }, "var(--blue-d)")}
                  {iconBtn(IC.trash, "삭제", () => del(cq.id), "#d64545")}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Generate — 탭(Data Sources / Documents / Guidelines / Options) + 우상단 Generate 버튼
const GEN_TABS = [["cq", "예상질문", "❓"], ["sources", "Data Sources", "▤"], ["documents", "Documents", "▦"], ["guidelines", "Guidelines", "💡"], ["options", "Options", "⚙"]];
const SRC_COLOR = { "CQ": ["#e0f6f3", "#009387"], "문서": ["#efe8fb", "#7a3fb0"], "정형DB": ["#e6f4ea", "#1faf6b"], "정리": ["#fdeee0", "#c26a12"], "점검": ["#eaf1fb", "#2f6fd0"] };

// 공용 아이콘 (stroke 형 미니 SVG)
const _svg = (d, extra) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}{extra}</svg>
);
const IC = {
  edit: _svg(<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />),
  trash: _svg(<path d="M3 6h18" />, <><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></>),
  check: _svg(<path d="M20 6 9 17l-5-5" />),
  x: _svg(<path d="M18 6 6 18M6 6l12 12" />),
};
// 아이콘 버튼 + 상태 점(dot) 헬퍼
const iconBtn = (icon, title, onClick, tone) => (
  <button onClick={onClick} title={title}
    style={{ border: `1px solid ${tone}`, background: "var(--app)", color: tone, width: 27, height: 27, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>{icon}</button>
);
const stateDot = (state) => {
  const [color, label] = state === "failed" ? ["#d64545", "에러"] : state === "done" ? ["#1faf6b", "완료"] : ["#c2c8db", "미생성"];
  return <span title={label} style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />;
};

// 도메인 가이드라인 — 자유 텍스트 지침을 저장해 생성 프롬프트에 주입한다(도메인 무관 엔진, 지침은 데이터).
function GuidelinesPanel() {
  const { activeId } = useProjects();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");   // "" | "saving" | "saved"
  const dirtyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false); setStatus(""); dirtyRef.current = false;
    api.guidelines()
      .then((d) => { if (alive) { setText(d.guidelines || ""); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [activeId]);

  // 자동 저장 — 편집 후 포커스가 벗어날 때(내용이 바뀐 경우에만) 서버에 저장한다.
  const saveOnBlur = () => {
    if (!loaded || !dirtyRef.current) return;
    dirtyRef.current = false;
    setStatus("saving");
    api.saveGuidelines(text).then(() => setStatus("saved")).catch(() => setStatus(""));
  };

  return (
    <div>
      <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 22px", marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💡</span> 도메인 가이드라인
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
          이 도메인의 <b style={{ color: "var(--text)" }}>배경·업무 규칙·용어·모델링 지침</b>을 적어두면, 온톨로지{" "}
          <b style={{ color: "var(--text)" }}>생성 시 LLM 프롬프트에 주입</b>되어 후보 추출·명명·구조화가 이 지침을 최우선으로 참고합니다.
          도메인이 바뀌면 이 내용만 교체하면 됩니다 — 엔진은 도메인에 무관합니다.
        </p>
      </div>
      <textarea value={text} disabled={!loaded}
        onChange={(e) => { setText(e.target.value); dirtyRef.current = true; setStatus(""); }}
        onBlur={saveOnBlur}
        placeholder={"예)\n- 이 도메인은 자동차보험이다. '담보'와 '특약'을 구분한다.\n- 개별 특약·담보 명칭(예: 고령자교통안전교육특약)은 인스턴스이며 클래스로 만들지 않는다.\n- 지급·면책·대기기간은 조건 전용 클래스로 모델링한다.\n- 용어 표기 통일: '납입보험료'는 '보험료'로 쓴다."}
        style={{ width: "100%", minHeight: 300, boxSizing: "border-box", padding: "14px 16px", border: "1px solid var(--line2)", borderRadius: 12, fontSize: 13.5, lineHeight: 1.7, fontFamily: "var(--sans)", color: "var(--text)", background: "var(--card)", resize: "vertical" }} />
      <div style={{ marginTop: 10, height: 18, fontSize: 13, fontWeight: 600, color: status === "saved" ? "#009387" : "var(--muted)" }}>
        {status === "saving" ? "저장 중…"
          : status === "saved" ? "✓ 자동 저장됨 — 다음 생성부터 반영됩니다"
            : "입력 후 다른 곳을 클릭하면 자동 저장됩니다"}
      </div>
    </div>
  );
}

function GenPanel() {
  const { reload, ontology, rev } = useDesign();
  const { activeId } = useProjects();
  const [tab, setTab] = useState("cq");
  const [sources, setSources] = useState(null);
  const [docs, setDocs] = useState(null);
  const [selT, setSelT] = useState(new Set());
  const [selD, setSelD] = useState(new Set());
  const [cands, setCands] = useState(null);
  const [method, setMethod] = useState(null);
  const [job, setJob] = useState(null);          // null|running|done|error — 서버 잡 상태
  const [jobMsg, setJobMsg] = useState(null);    // 배치 진행 메시지
  const [genWarn, setGenWarn] = useState([]);    // 부분 실패(건너뛴 배치) 경고
  const [genInfo, setGenInfo] = useState([]);    // 정보성 알림(유사어 병합 등) — 실패 아님
  const [genFailed, setGenFailed] = useState([]); // 미처리 질문 — 실패분만 재시도의 대상
  const [srcState, setSrcState] = useState(null); // 소스별 done/failed/pending — 배지용
  const [flt, setFlt] = useState({ kind: "all", source: "all", status: "all", band: "all" }); // 후보 트리아지 필터
  const [panelOpen, setPanelOpen] = useState(false); // 우측 생성결과 드로어 — 결과 없으면 접힘이 기본
  const [animReady, setAnimReady] = useState(false); // 최초 복원 시엔 애니 없이 즉시 열림, 이후 토글만 애니
  const [viewMode, setViewMode] = useState("conf");  // conf=신뢰도순 | group=클래스별(구조)
  const [genErr, setGenErr] = useState(null);
  const [genMsg, setGenMsg] = useState(null);    // 시작 안내 배너 — 진행 상세는 상단 '작업'에서
  const genBodyRef = useRef(null);
  const pollRef = useRef(null);
  const busy = job === "running";
  useEffect(() => { genBodyRef.current?.scrollTo({ top: 0 }); }, [tab]);   // 탭 전환 시 맨 위로

  const loadCands = () => api.ontologyView("candidates")
    .then((d) => { setCands(d.candidates?.length ? d.candidates : null); setMethod(d.method || null); }).catch(() => {});
  const loadState = () => api.genState().then(setSrcState).catch(() => {});
  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(() => {
      api.genStatus().then((s) => {
        if (s.status === "running") { setJobMsg(s.message || null); return; }
        stopPoll();
        setGenMsg(null);   // 잡 종료 — 시작 안내 배너 정리
        if (s.status === "done") { setJob("done"); setGenErr(null); setGenWarn(s.warnings || []); setGenInfo(s.infos || []); setGenFailed(s.failed_cqs || []); loadCands(); loadState(); setPanelOpen(true); }
        else if (s.status === "cancelled") { setJob(null); setGenErr(null); loadCands(); loadState(); }   // 부분 결과 반영
        else if (s.status === "error") { setJob("error"); setGenErr(s.error || "알 수 없는 오류"); }
        else setJob(null);
      }).catch(() => {});
    }, 2500);
  };
  useEffect(() => () => stopPoll(), []);   // 언마운트 시 폴링만 정리(잡은 서버에서 계속)
  useEffect(() => {   // 재진입 시 서버 잡 상태 복원 — 생성 중이었으면 이어서 폴링
    api.genStatus().then((s) => {
      if (s.status === "running") { setJob("running"); setJobMsg(s.message || null); startPoll(); }
      else if (s.status === "done") { setJob("done"); setGenWarn(s.warnings || []); setGenInfo(s.infos || []); setGenFailed(s.failed_cqs || []); }
      else if (s.status === "error") { setJob("error"); setGenErr(s.error || null); }
      else setJob(null);
    }).catch(() => {});
  }, [activeId]);

  useEffect(() => {
    api.genSources().then((d) => { setSources(d); setSelT(new Set(d.tables.map((t) => t.table))); }).catch(() => setSources({ tables: [], total_tables: 0, total_columns: 0 }));
    api.genDocuments().then((d) => { setDocs(d); setSelD(new Set(d.documents.map((x) => x.doc))); }).catch(() => setDocs({ documents: [] }));
    // 이전 생성 결과 복원(탭 이동·재접속에도 유지) — 결과가 있으면 드로어 자동 펼침
    api.ontologyView("candidates").then((d) => {
      setCands(d.candidates?.length ? d.candidates : null); setMethod(d.method || null);
      setPanelOpen(!!d.candidates?.length);   // 복원 시엔 애니 없이 즉시 반영
      setTimeout(() => setAnimReady(true), 60);   // 다음 커밋부터 토글 애니 활성화
    }).catch(() => setTimeout(() => setAnimReady(true), 60));
    loadState();
  }, [activeId]);

  const run = () => {
    setGenErr(null); setJob("running");
    api.ontologyGenerate([...selT], [...selD])
      .then((d) => {
        if (d.error) { setJob("error"); setGenErr(d.error); return; }
        setGenMsg({ text: "온톨로지 생성을 시작합니다. 진행 상황은 상단 '작업'에서, 결과는 생성 결과에서 확인하세요." });
        startPoll();
      })
      .catch((e) => { setJob("error"); setGenErr(String(e.message || e)); });
  };
  const clear = () => api.ontologyGenerateClear().then(() => { setCands(null); setMethod(null); setGenWarn([]); setGenInfo([]); setGenFailed([]); loadState(); });

  // 트리아지 — 필터·정렬(신뢰도 내림차순)·일괄 처리
  const inBand = (c) => flt.band === "all" ? true
    : flt.band === "high" ? c.confidence >= 0.8
    : flt.band === "mid" ? c.confidence >= 0.5 && c.confidence < 0.8
    : c.confidence < 0.5;
  const visible = (cands || [])
    .filter((c) => (flt.kind === "all" || c.kind === flt.kind)
      && (flt.source === "all" || c.source === flt.source)
      && (flt.status === "all" || (c.status || "pending") === flt.status)
      && inBand(c))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const visPending = visible.filter((c) => (c.status || "pending") === "pending" && !c.exists);
  const bulk = (decision) => {
    const ids = visPending.map((c) => c.id);
    if (!ids.length) return;
    if (!window.confirm(`표시된 대기 ${ids.length}건을 ${decision === "approve" ? "승인" : "반려"}합니다. 진행할까요?`)) return;
    api.ontologyDecideBulk(ids, decision).then(() => {
      const set = new Set(ids);
      setCands((cs) => cs.map((x) => (set.has(x.id) ? { ...x, status: decision === "approve" ? "approved" : "rejected" } : x)));
      if (decision === "approve") reload();
    });
  };
  // 구조 파악용 — uri→라벨 맵 + 클래스별 그룹핑
  const labelMap = useMemo(() => Object.fromEntries((cands || []).map((c) => [c.uri, c.label])), [cands]);
  const lbl = (u) => (u ? (labelMap[u] || String(u).split(":").pop()) : null);
  const groups = useMemo(() => {
    if (viewMode !== "group") return null;
    const byDom = {};
    visible.filter((c) => c.kind !== "class").forEach((c) => {
      const d = c.domain || "__none__";
      (byDom[d] = byDom[d] || []).push(c);
    });
    const used = new Set();
    const out = [];
    visible.filter((c) => c.kind === "class").forEach((c) => {
      out.push({ uri: c.uri, label: c.label, self: c, items: byDom[c.uri] || [] });
      used.add(c.uri);
    });
    Object.entries(byDom).forEach(([d, items]) => {
      if (!used.has(d)) out.push({ uri: d, label: d === "__none__" ? "소속 미지정" : `${lbl(d)} (기존/미표시)`, self: null, items });
    });
    return out;
  }, [visible, viewMode, labelMap]);

  const selFlt = (key, opts) => (
    <select value={flt[key]} onChange={(e) => setFlt((f) => ({ ...f, [key]: e.target.value }))}
      style={{ border: "1px solid var(--line2)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontFamily: "var(--sans)", background: "var(--app)", cursor: "pointer" }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const decide = (id, decision) =>
    api.ontologyGenerateDecide(id, decision).then((c) => {
      setCands((cs) => cs.map((x) => (x.id === id ? { ...x, status: c.status } : x)));
      if (decision === "approve") reload();
    });
  const toggle = (set, fn) => (key) => fn((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleT = toggle(selT, setSelT);
  const toggleD = toggle(selD, setSelD);

  // 소스별 상태 배지 — 완료(녹)/에러(적)/미생성(회)
  const GRP = { cq: "cq", sources: "tables", documents: "docs" };
  const tabBadge = (key) => {
    const g = srcState?.[GRP[key]];
    if (!g) return null;
    const pill = (txt, bg, fg) => <span className="mono" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 7px", whiteSpace: "nowrap", borderRadius: 99, background: bg, color: fg }}>{txt}</span>;
    if (g.failed.length) return pill(g.failed.length, "#fde8e8", "#d64545");
    if (g.pending.length) return pill(g.pending.length, "var(--main)", "var(--muted)");
    if (g.done.length) return pill("✓", "#e6f4ea", "#0f7d4d");
    return null;
  };
  const itemBadge = (group, name) => {
    const g = srcState?.[group];
    if (!g) return null;
    return stateDot(g.failed.includes(name) ? "failed" : g.done.includes(name) ? "done" : "pending");
  };

  const selBtns = (onAll, onNone) => (
    <span style={{ display: "inline-flex", borderRadius: 9, overflow: "hidden", border: "1px solid var(--line2)" }}>
      <button onClick={onAll} style={{ border: "none", background: "var(--navy)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer" }}>✓ Select All</button>
      <button onClick={onNone} style={{ border: "none", background: "var(--app)", color: "var(--text)", fontSize: 12, fontWeight: 700, padding: "6px 14px", cursor: "pointer" }}>× Select None</button>
    </span>
  );
  const cb = { width: 17, height: 17, accentColor: "#2f6fd0", cursor: "pointer", flexShrink: 0 };
  const th = { textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "var(--navy)", borderBottom: "2px solid var(--line)", position: "sticky", top: 0, background: "var(--app)", zIndex: 1 };

  return (
    <div style={{ height: "calc(100% + 30px)", marginBottom: -30, display: "flex", flexDirection: "column" }}>{/* 하단 앱 패딩(30px)까지 블리드 — 드로어가 바닥까지 채움. overflow hidden 금지(우측 블리드 핸들 잘림 방지) */}
      {/* 고정 헤더 — 제목 · Generate 버튼 · 탭 (스크롤과 무관하게 항상 고정) */}
      <div style={{ flexShrink: 0, background: "var(--main)", padding: "28px 34px 0", boxShadow: "0 8px 14px -12px rgba(27,36,64,.18)", zIndex: 2, position: "relative" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: "0 0 4px" }}>Ontology · Generate</h1>
        <p style={{ color: "var(--text)", fontSize: 14, marginBottom: 18 }}>프로젝트별 온톨로지(T-Box) 설계 · Generate</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>예상질문(항상 포함) + 선택한 소스에서 후보를 생성합니다 · <b>완료(녹색) 항목은 자동으로 건너뛰고</b> 에러·미생성만 처리 · 전체 재생성은 초기화 후</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="mono" title="승인 시 실시간 반영" style={{ fontSize: 12, color: "var(--muted)", background: "var(--app)", padding: "6px 12px", borderRadius: 9 }}>
              T-Box · <b style={{ color: "var(--navy)" }}>{ontology?.entities ?? "–"}</b> entities · <b style={{ color: "var(--navy)" }}>{ontology?.relationships ?? "–"}</b> rel
            </span>
            <button onClick={run} disabled={busy}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1.5px solid var(--blue)", background: "var(--app)", color: "var(--blue-d)", fontWeight: 700, fontSize: 13.5, padding: "9px 18px", borderRadius: 11, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              <span>✦</span>{busy ? "Generating…" : "Generate Ontology"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)" }}>
          {GEN_TABS.map(([key, label, ic]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ border: "none", background: "none", cursor: "pointer", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: tab === key ? "var(--blue-d)" : "var(--muted)", borderBottom: `2px solid ${tab === key ? "var(--blue)" : "transparent"}`, marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{ic}</span>{label}{tabBadge(key)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0, marginRight: -26 }}>{/* 우측 앱 패딩까지 블리드 — 드로어 끝단 밀착 */}
      {/* 좌측 — 탭 콘텐츠 (예상질문은 하단까지) */}
      <div ref={genBodyRef} style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "20px 24px 24px 34px", display: "flex", flexDirection: "column" }}>
      {/* 시작 안내 배너 — 진행 상세(배치 n/m)는 상단 '작업' 아이콘에서 확인 */}
      <JobBanner msg={genMsg} onClose={() => setGenMsg(null)} />
      {genErr && !busy && (
        <div style={{ padding: "13px 18px", background: "#fde8e8", border: "1px solid #f5c6c6", borderRadius: 12, marginBottom: 16, color: "#c0392b", fontSize: 13.5 }}>
          <b>생성 실패</b> — {genErr}
        </div>
      )}
      {genInfo.length > 0 && !busy && !genErr && (
        <div style={{ padding: "12px 18px", background: "var(--blue-soft)", border: "1px solid var(--blue-bg)", borderRadius: 12, marginBottom: 16, color: "var(--navy)", fontSize: 13.5 }}>
          <b style={{ color: "var(--blue-d)" }}>정리 완료</b> — {genInfo.join(" · ")}
        </div>
      )}
      {(genWarn.length > 0 || genFailed.length > 0) && !busy && !genErr && (
        <div style={{ padding: "13px 18px", background: "#fdf3e0", border: "1px solid #f0dcb4", borderRadius: 12, marginBottom: 16, color: "#8a6116", fontSize: 13.5 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span><b>일부 배치 실패</b> — 성공분은 정상 반영됐습니다.{genFailed.length > 0 && <> 미처리 질문 <b>{genFailed.length}건</b>.</>}</span>
            {genFailed.length > 0 && (
              <button onClick={() => { setJob("running"); setGenErr(null); api.genRetryFailed().then((d) => { if (d.error) { setJob("error"); setGenErr(d.error); } else startPoll(); }).catch((e) => { setJob("error"); setGenErr(String(e.message || e)); }); }}
                style={{ border: "1px solid #c26a12", background: "#fff", color: "#c26a12", fontWeight: 700, fontSize: 12.5, padding: "6px 14px", borderRadius: 9, cursor: "pointer", flexShrink: 0 }}>
                ↻ 실패분만 재시도 ({genFailed.length}건)
              </button>
            )}
          </div>
          {genWarn.length > 0 && <div style={{ marginTop: 4, fontSize: 12.5 }}>{genWarn.join(" · ")}</div>}
          {genFailed.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>미처리 질문 {genFailed.length}건 보기</summary>
              <ol style={{ margin: "6px 0 0 20px", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 2 }}>
                {genFailed.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </details>
          )}
        </div>
      )}
      <div style={{ opacity: busy ? 0.45 : 1, pointerEvents: busy ? "none" : "auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Data Sources */}
      {tab === "sources" && sources && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <p style={{ color: "var(--text)", fontSize: 13.5, marginBottom: 12 }}>온톨로지 생성을 위해 AI 모델에 스키마를 보낼 테이블을 선택하세요.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14 }}>
            <span style={{ color: "#1faf6b", fontWeight: 800 }}>✓</span>
            <b style={{ color: "var(--navy)" }}>{sources.total_tables} tables</b> <span style={{ color: "var(--muted)" }}>available with</span> <b style={{ color: "var(--navy)" }}>{sources.total_columns} columns</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>생성에 포함할 테이블 선택:</span>
            {selBtns(() => setSelT(new Set(sources.tables.map((t) => t.table))), () => setSelT(new Set()))}
          </div>
          <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead><tr>
                <th style={{ ...th, width: 40 }}></th><th style={th}>Table</th><th style={{ ...th, width: 80, textAlign: "center" }}>Columns</th><th style={th}>Description</th>
              </tr></thead>
              <tbody>
                {sources.tables.map((t, i) => (
                  <tr key={t.table} style={{ cursor: "pointer" }} onClick={() => toggleT(t.table)}>
                    <td style={{ padding: "11px 14px", borderBottom: i < sources.tables.length - 1 ? "1px solid var(--line)" : "none" }}><input type="checkbox" checked={selT.has(t.table)} onChange={() => toggleT(t.table)} onClick={(e) => e.stopPropagation()} style={cb} /></td>
                    <td style={{ padding: "11px 14px", borderBottom: i < sources.tables.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <div style={{ fontWeight: 800, color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>{t.table}{itemBadge("tables", t.table)}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{t.path}</div>
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: i < sources.tables.length - 1 ? "1px solid var(--line)" : "none", textAlign: "center", color: "var(--text)" }}>{t.columns}</td>
                    <td style={{ padding: "11px 14px", borderBottom: i < sources.tables.length - 1 ? "1px solid var(--line)" : "none", color: "var(--text)" }}>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && docs && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <p style={{ color: "var(--text)", fontSize: 13.5, marginBottom: 12 }}>RAG 파이프라인이 파싱·청킹한 문서에서 클래스를 추출합니다.</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}><span style={{ color: "#1faf6b", fontWeight: 800 }}>✓</span> <b style={{ color: "var(--navy)" }}>{docs.documents.length} documents</b> <span style={{ color: "var(--muted)" }}>사용 가능</span></span>
            {selBtns(() => setSelD(new Set(docs.documents.map((x) => x.doc))), () => setSelD(new Set()))}
          </div>
          <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead><tr>
                <th style={{ ...th, width: 40 }}></th><th style={th}>Document</th><th style={{ ...th, width: 80, textAlign: "center" }}>Chunks</th><th style={th}>Keywords</th>
              </tr></thead>
              <tbody>
                {docs.documents.map((d, i) => (
                  <tr key={d.doc} style={{ cursor: "pointer" }} onClick={() => toggleD(d.doc)}>
                    <td style={{ padding: "11px 14px", borderBottom: i < docs.documents.length - 1 ? "1px solid var(--line)" : "none" }}><input type="checkbox" checked={selD.has(d.doc)} onChange={() => toggleD(d.doc)} onClick={(e) => e.stopPropagation()} style={cb} /></td>
                    <td style={{ padding: "11px 14px", borderBottom: i < docs.documents.length - 1 ? "1px solid var(--line)" : "none", fontWeight: 800, color: "var(--navy)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>{d.doc}{itemBadge("docs", d.doc)}</span>
                    </td>
                    <td style={{ padding: "11px 14px", borderBottom: i < docs.documents.length - 1 ? "1px solid var(--line)" : "none", textAlign: "center", color: "var(--text)" }}>{d.chunks}</td>
                    <td style={{ padding: "11px 14px", borderBottom: i < docs.documents.length - 1 ? "1px solid var(--line)" : "none", color: "var(--muted)", fontSize: 12.5 }}>{(d.keywords || []).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "cq" && <CQPanel cqState={srcState?.cq} />}

      {tab === "guidelines" && <GuidelinesPanel />}

      {tab === "options" && (
        <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 14, padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Options</div>
          생성 옵션(신뢰도 임계값 등) — 준비 중
        </div>
      )}

      </div>
      </div>

      {/* 우측 — 생성 결과 드로어 (Generate 한정) · 우측 끝단 밀착 탭 핸들 */}
      <div style={{ width: panelOpen ? "65%" : 16, minWidth: panelOpen ? 420 : 16, flexShrink: 0, display: "flex", minHeight: 0, transition: animReady ? "width .16s ease-out" : "none" }}>
        {/* 세로 중앙, 끝단 밀착 토글 탭 */}
        <div onClick={() => setPanelOpen((v) => !v)} title={panelOpen ? "생성 결과 접기" : `생성 결과 펼치기 · ${cands?.length ?? 0}건`}
          onMouseEnter={(e) => { const p = e.currentTarget.firstChild; p.style.background = "var(--blue-soft)"; p.style.color = "var(--blue-d)"; p.style.borderColor = "var(--blue)"; }}
          onMouseLeave={(e) => { const p = e.currentTarget.firstChild; p.style.background = "var(--app)"; p.style.color = "var(--muted)"; p.style.borderColor = "var(--line2)"; }}
          style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center", cursor: "pointer" }}>
          <div style={{ width: 16, height: 130, borderRadius: "10px 0 0 10px", background: "var(--app)", border: "1px solid var(--line2)", borderRight: "none", boxShadow: "-3px 3px 10px rgba(27,36,64,.10)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 8.5, transition: "background .12s, color .12s, border-color .12s" }}>
            {panelOpen ? "▶" : "◀"}
          </div>
        </div>
        {panelOpen && (
        <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--line)", background: "var(--app)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", flexShrink: 0 }}>
            <b style={{ fontSize: 14.5, color: "var(--navy)" }}>생성 결과</b>
            <span style={{ flex: 1 }} />
            {cands && <button onClick={clear} style={{ border: "1px solid var(--line2)", background: "var(--app)", color: "var(--muted)", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 9, cursor: "pointer" }}>↺ 초기화</button>}
          </div>
          {!cands ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13.5, padding: 24, textAlign: "center" }}>
              아직 생성 결과가 없습니다.<br />Generate Ontology 를 실행하세요.
            </div>
          ) : (
            <>
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flexShrink: 0, borderBottom: "1px solid var(--line)" }}>
                {selFlt("kind", [["all", "종류 전체"], ["class", "class"], ["object", "object"], ["data", "data"], ["subclass", "계층"]])}
                {selFlt("source", [["all", "소스 전체"], ["CQ", "CQ"], ["문서", "문서"], ["정형DB", "정형DB"], ["정리", "정리"], ["점검", "점검"]])}
                {selFlt("status", [["all", "상태 전체"], ["pending", "대기"], ["approved", "승인"], ["rejected", "반려"]])}
                {selFlt("band", [["all", "신뢰도 전체"], ["high", "0.8 이상"], ["mid", "0.5~0.8"], ["low", "0.5 미만"]])}
                <span style={{ display: "inline-flex", border: "1px solid var(--line2)", borderRadius: 9, overflow: "hidden" }}>
                  {[["conf", "신뢰도순"], ["group", "클래스별"]].map(([m, t2]) => (
                    <button key={m} onClick={() => setViewMode(m)} title={m === "group" ? "클래스 아래에 속성·관계를 묶어서 표시" : "신뢰도 내림차순"}
                      style={{ border: "none", background: viewMode === m ? "var(--navy)" : "var(--app)", color: viewMode === m ? "#fff" : "var(--muted)", fontWeight: 700, fontSize: 11.5, padding: "6px 11px", cursor: "pointer" }}>{t2}</button>
                  ))}
                </span>
                {(flt.kind !== "all" || flt.source !== "all" || flt.status !== "all" || flt.band !== "all") && (
                  <button onClick={() => setFlt({ kind: "all", source: "all", status: "all", band: "all" })} title="필터 해제"
                    style={{ border: "none", background: "#fdeee0", color: "#c26a12", fontWeight: 700, fontSize: 10.5, padding: "3px 9px", whiteSpace: "nowrap", borderRadius: 99, cursor: "pointer" }}>필터 적용 중 ✕</button>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={() => bulk("approve")} disabled={!visPending.length}
                  style={{ border: "1px solid #009387", background: "#e0f6f3", color: "#009387", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 9, cursor: visPending.length ? "pointer" : "default", opacity: visPending.length ? 1 : 0.45 }}>
                  ✓ 대기 {visPending.length}건 승인
                </button>
                <button onClick={() => bulk("reject")} disabled={!visPending.length}
                  style={{ border: "1px solid #d64545", background: "#fde8e8", color: "#d64545", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 9, cursor: visPending.length ? "pointer" : "default", opacity: visPending.length ? 1 : 0.45 }}>
                  ✕ 반려
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
              <thead><tr>
                {[["후보", "26%"], ["종류", 52], ["구조", "17%"], ["근거", "auto"], ["신뢰도", 104], ["게이트", 72]].map(([h, w]) => (
                  <th key={h} className="mono" style={{ width: w === "auto" ? undefined : w, textAlign: "left", padding: "10px 12px", fontSize: 11, color: "var(--muted)", background: "var(--main)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(() => {
                  const b = { borderBottom: "1px solid var(--line)", padding: "9px 12px", verticalAlign: "middle", overflow: "hidden" };
                  const ell = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" };
                  const struct = (c) => {
                    const nm = (uri, fb) => lbl(uri) || fb || "?";   // 후보 라벨 → 보존 라벨 순 폴백(점검 후보는 T-Box 끝점)
                    const t2 = c.kind === "object" ? `${nm(c.domain, c.domain_label)} → ${nm(c.range, c.range_label)}`
                      : c.kind === "subclass" ? `${nm(c.domain, c.domain_label)} ⊑ ${nm(c.range, c.range_label)} (상위)`
                      : c.kind === "data" ? (nm(c.domain, c.domain_label) !== "?" ? `${nm(c.domain, c.domain_label)}의 속성` : "—") : "—";
                    return <span className="mono" title={t2} style={{ ...ell, fontSize: 11.5, color: c.kind === "object" || c.kind === "subclass" ? "var(--navy)" : c.kind === "data" ? "var(--text)" : "var(--faint)" }}>{t2}</span>;
                  };
                  const row = (c, opts = {}) => (
                    <tr key={c.id} style={opts.head ? { background: "var(--blue-soft)" } : undefined}>
                      <td style={{ ...b, paddingLeft: opts.child ? 26 : 12 }}>
                        <div title={c.label} style={{ color: "var(--navy)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
                          {opts.child && <span style={{ color: "var(--faint)", flexShrink: 0 }}>└</span>}
                          {c.source && <span className="mono" style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: (SRC_COLOR[c.source] || ["var(--main)", "var(--muted)"])[0], color: (SRC_COLOR[c.source] || ["var(--main)", "var(--muted)"])[1] }}>{c.source}</span>}
                          <span style={{ ...ell }}>{c.label}</span>
                        </div>
                      </td>
                      <td style={b}><span className="mono" style={{ fontSize: 11, color: "var(--text)", whiteSpace: "nowrap" }}>{c.kind}</span></td>
                      <td style={b}>{struct(c)}</td>
                      <td style={b}><span className="mono" title={(c.evidence || []).join(", ")} style={{ ...ell, fontSize: 11.5, color: "var(--muted)" }}>{(c.evidence || []).join(", ")}</span></td>
                      <td style={b}><MiniBar value={c.confidence} /></td>
                      <td style={b}>
                        {c.exists ? <span title="기존 — T-Box에 이미 존재">{stateDot("done")}</span>
                          : c.status === "approved" ? <span title="승인됨" style={{ width: 24, height: 24, borderRadius: "50%", background: "#e0f6f3", color: "#009387", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{IC.check}</span>
                          : c.status === "rejected" ? <span title="반려됨" style={{ width: 24, height: 24, borderRadius: "50%", background: "#fde8e8", color: "#d64545", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{IC.x}</span>
                          : <span style={{ display: "flex", gap: 6 }}>
                              {iconBtn(IC.check, "승인", () => decide(c.id, "approve"), "#009387")}
                              {iconBtn(IC.x, "반려", () => decide(c.id, "reject"), "#d64545")}
                            </span>}
                      </td>
                    </tr>
                  );
                  if (viewMode !== "group") return visible.map((c) => row(c));
                  return groups.flatMap((g) => [
                    g.self ? row(g.self, { head: true }) : (
                      <tr key={`h-${g.uri}`} style={{ background: "var(--main)" }}>
                        <td colSpan={6} style={{ ...b, fontWeight: 800, color: "var(--navy)", fontSize: 12.5 }}>{g.label} · {g.items.length}</td>
                      </tr>
                    ),
                    ...g.items.map((c) => row(c, { child: true })),
                  ]);
                })()}
              </tbody>
            </table>
              </div>
            </>
          )}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}

// Import — OWL/RDFS/TTL 업로드 → 파싱 → T-Box 병합
function ImportPanel() {
  const { reload } = useDesign();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const upload = (file) => {
    if (!file) return;
    setBusy(true); setErr(null); setRes(null);
    api.ontologyImport(file)
      .then((d) => { if (d.error) setErr(d.error); else { setRes(d); reload(); } })
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
        style={{ display: "block", border: `2px dashed ${over ? "var(--blue)" : "var(--line2)"}`, background: over ? "var(--blue-soft)" : "var(--app)", borderRadius: 16, padding: "44px 24px", textAlign: "center", cursor: "pointer", transition: "all .12s" }}>
        <input type="file" accept=".ttl,.owl,.rdf,.xml,.jsonld,.json,.nt,.n3" style={{ display: "none" }}
          onChange={(e) => upload(e.target.files?.[0])} />
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>{busy ? "파싱 중…" : "온톨로지 파일을 끌어놓거나 클릭"}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>.ttl · .owl · .rdf · .jsonld · .nt</div>
      </label>

      {err && <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fde8e8", color: "#c0392b", fontSize: 13 }}>{err}</div>}

      {res && (
        <div style={{ marginTop: 14, padding: "16px 20px", borderRadius: 12, background: "var(--blue-soft)", border: "1px solid var(--blue-bg)" }}>
          <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{res.filename} 병합 완료</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 13.5, color: "var(--text)" }}>
            <span>파싱 <b style={{ color: "var(--navy)" }}>{res.parsed}</b></span>
            <span>클래스 +<b style={{ color: "#009387" }}>{res.classes_added}</b></span>
            <span>프로퍼티 +<b style={{ color: "#009387" }}>{res.properties_added}</b></span>
            <span>갱신 <b style={{ color: "var(--navy)" }}>{res.updated}</b></span>
            <span>총 Entities <b style={{ color: "var(--navy)" }}>{res.total_entities}</b> · Properties <b style={{ color: "var(--navy)" }}>{res.total_properties}</b></span>
          </div>
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>업로드한 온톨로지가 현재 프로젝트 T-Box에 병합됩니다(URI 기준 중복 병합). Entities·Relationships 탭에서 확인하세요.</p>
    </div>
  );
}

// 노드 색은 청록(클래스) + 앰버(핵심 — 연결 TOP 5) 2분 — ../components/OntologyGraph 공유 상수.
// 연결 수는 색이 아니라 채움 농도·글로우·테두리 두께(연속 채널)로 표현한다.

const PR = 12.5;   // 속성(위성 원) 반지름 — 클래스 육각형(25)의 절반 정도

// 검색형 클래스 선택기 — 관계 카드의 출발/도착. 나열 select 대신 타이핑으로 좁혀 선택(클래스가 많아도 사용 가능).
// onQuery(text|null) — 타이핑 중인 검색어를 상위로 알림(그래프에서 매칭 노드 실시간 활성화, null=검색 종료).
// 온톨로지 파일 확장자 — 프로젝트 가져오기에 올리면 갈 곳(Generate 온톨로지 임포트)을 안내한다.
const ONT_FILE_EXTS = new Set([".ttl", ".owl", ".rdf", ".n3", ".nt", ".xml", ".jsonld", ".trig", ".nq"]);

// PROJECT EXPORT / IMPORT — 환경 간 프로젝트 이전(Information 화면).
// TTL 과 다르다: TTL 임포트는 {uri,label,kind,domain,range} 만 복원해 매핑·인스턴스·CQ·규칙이
// 사라진다. 이 경로는 스토어 설정을 통째로 옮기므로 로컬에서 만든 환경이 그대로 재현된다.
function ProjectTransfer({ onDone }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // {tone:"ok"|"err", text}

  const pick = (overwrite) => { fileRef.current.dataset.overwrite = overwrite ? "1" : ""; fileRef.current.click(); };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    const overwrite = e.target.dataset.overwrite === "1";
    e.target.value = "";                      // 같은 파일 재선택 가능하게
    if (!f) return;
    // 확장자 선검사 — TTL/OWL 을 여기 올리는 혼동이 잦다. 올리기 전에 갈 곳을 알려준다.
    const ext = (f.name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
    if (ONT_FILE_EXTS.has(ext)) {
      setMsg({ tone: "err", text: `${ext} 는 온톨로지 파일입니다 — Generate 화면의 온톨로지 임포트를 쓰세요` });
      return;
    }
    if (ext && ext !== ".json") {
      setMsg({ tone: "err", text: `${ext} 는 지원하지 않습니다 — PROJECT EXPORT 로 받은 .json 을 올려주세요` });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      const r = await api.ontologyImportProject(f, overwrite);
      if (r.error) {
        // 대상에 이미 클래스가 있으면 서버가 거부한다 — 덮어쓸지 여기서 되묻는다.
        if (r.existing_classes && !overwrite
            && window.confirm(`이 프로젝트에 이미 클래스 ${r.existing_classes}개가 있습니다.\n덮어쓸까요? (되돌릴 수 없습니다)`)) {
          const r2 = await api.ontologyImportProject(f, true);
          if (r2.error) setMsg({ tone: "err", text: r2.error });
          else { setMsg({ tone: "ok", text: `IMPORT 완료 — 클래스 ${r2.classes} · 매핑 ${r2.entity_mappings}` }); onDone?.(); }
        } else setMsg({ tone: "err", text: r.error });
      } else {
        setMsg({ tone: "ok", text: `IMPORT 완료 — 클래스 ${r.classes} · 매핑 ${r.entity_mappings}` });
        onDone?.();
      }
    } catch (err) {
      setMsg({ tone: "err", text: String(err.message || err) });
    } finally { setBusy(false); }
  };

  const tile = {
    flex: 1, minWidth: 210, display: "flex", alignItems: "center", gap: 13, textAlign: "left",
    border: "1px solid #7a5cff55", background: "var(--purple-bg)", color: "var(--navy)",
    borderRadius: 14, padding: "15px 18px", fontFamily: "var(--sans)",
    cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
  };
  const icon = { fontSize: 24, lineHeight: 1, flexShrink: 0, color: "#7a5cff" };
  const title = { fontSize: 13.5, fontWeight: 800, letterSpacing: ".02em" };
  const sub = { fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 };
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => window.open(api.ontologyExportProjectUrl(), "_blank")} disabled={busy} style={tile}
          title="온톨로지 계약 + 매핑 + 인스턴스 + CQ + 규칙을 JSON 한 파일로 저장합니다">
          <span style={icon}>⭳</span>
          <span><div style={title}>PROJECT EXPORT</div><div style={sub}>계약·매핑·인스턴스·CQ·규칙을 JSON 한 파일로</div></span>
        </button>
        <button onClick={() => pick(false)} disabled={busy} style={tile}
          title="내보낸 JSON 을 이 프로젝트에 복원합니다. 이미 클래스가 있으면 덮어쓸지 다시 확인합니다.">
          <span style={icon}>⭱</span>
          <span><div style={title}>{busy ? "IMPORTING…" : "PROJECT IMPORT"}</div><div style={sub}>내보낸 .json 을 이 프로젝트에 복원</div></span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
      <div style={{ marginTop: 11, fontSize: 11.5, lineHeight: 1.5, color: "var(--faint)" }}>
        TTL 내보내기와 다릅니다 — TTL 은 클래스·관계·속성 이름만 오가고 매핑·인스턴스·CQ 는 빠집니다.
        환경을 그대로 옮기려면(로컬 → ACA) 이 경로를 쓰세요.
      </div>
      {msg && <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, color: msg.tone === "ok" ? "var(--green)" : "#d64545" }}>{msg.text}</div>}
    </div>
  );
}


function ClassPicker({ nodes, value, onChange, exclude, placeholder, onQuery }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const qRef = useRef(onQuery);
  qRef.current = onQuery;
  useEffect(() => () => { qRef.current && qRef.current(null); }, []);   // 언마운트(카드 닫힘) 시 그래프 필터 해제
  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); qRef.current && qRef.current(null); } };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);
  const selLabel = (nodes || []).find((n) => n.uri === value)?.label || "";
  const ql = q.trim().toLowerCase();
  const list = (nodes || [])
    .filter((n) => n.uri !== exclude && (!ql || (n.label || "").toLowerCase().includes(ql) || (n.uri || "").toLowerCase().includes(ql)))
    .slice(0, 30);
  return (
    <span ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <input value={open ? q : selLabel} placeholder={placeholder || "클래스 검색…"}
        onFocus={() => { setOpen(true); setQ(""); onQuery && onQuery(""); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); onQuery && onQuery(e.target.value); }}
        style={{ border: `1px solid ${value ? "var(--line2)" : "var(--blue)"}`, borderRadius: 8, padding: "7px 10px", fontSize: 13,
          fontFamily: "var(--sans)", background: "var(--app)", outline: "none", width: 140 }} />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, minWidth: 190, maxHeight: 224, overflowY: "auto",
          background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,16,38,0.18)", padding: 4 }}>
          {list.length === 0 && <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--muted)" }}>일치하는 클래스 없음</div>}
          {list.map((n) => (
            <div key={n.uri} onMouseDown={(e) => { e.preventDefault(); onChange(n.uri); setOpen(false); setQ(""); onQuery && onQuery(null); }}
              style={{ padding: "7px 10px", fontSize: 12.5, borderRadius: 7, cursor: "pointer", fontWeight: n.uri === value ? 700 : 500,
                color: n.uri === value ? "var(--blue-d)" : "var(--text)", background: n.uri === value ? "var(--blue-soft)" : "transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--blue-soft)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = n.uri === value ? "var(--blue-soft)" : "transparent"; }}>
              {n.label || n.uri}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
const ADD_COLOR = "#4c8dff";   // 추가/연결 진행 중 하이라이트 — 기존 그래프(청록/앰버)와 구분되는 파란색
const PTYPES = [["xsd:string", "문자열"], ["xsd:integer", "정수"], ["xsd:decimal", "숫자"], ["xsd:date", "날짜"], ["xsd:boolean", "불리언"]];

// Designer — 클래스(노드) + object property(엣지) 그래프 시각화.
// 레이아웃/헬퍼(useGraphSim(d3-force)·nodeR·shades 등)는 ../components/OntologyGraph 에서 공유(Mapping Designer 와 동일).
function DesignerPanel() {
  const { activeId } = useProjects();
  const { reload, ontology, rev } = useDesign();
  const [nodes, setNodes] = useState(null);
  const [edges, setEdges] = useState([]);
  const [hier, setHier] = useState([]);   // 계층(subClassOf) 엣지 — child.parent 에서 파생
  const [dataProps, setDataProps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);   // 호버 노드 — 이웃(에고 네트워크)만 일시 강조
  const [tierHover, setTierHover] = useState(null);   // 범례 호버 — 해당 역할/색/TOP5/계층 노드만 강조
  const [q, setQ] = useState("");   // 검색어 — 클래스·속성 이름 매칭 노드만 활성화
  const [pickQ, setPickQ] = useState(null);   // 관계 카드 클래스 선택기 타이핑 검색어 — 상단 검색과 동일하게 그래프 실시간 활성화
  const [rk, setRk] = useState(0);
  const [drag, setDrag] = useState(null);
  const [view, setView] = useState(null);   // 현재 viewBox(줌/이동)
  const [spaceDown, setSpaceDown] = useState(false);   // 스페이스 홀드 = 팬 모드
  const [relForm, setRelForm] = useState(null);        // 관계 추가 폼 {domain, range, label}
  const [relErr, setRelErr] = useState(null);
  const [delAsk, setDelAsk] = useState(false);         // 관계 삭제 2단계 확인 — 쓰레기 버튼 → '삭제 확인' 버튼
  const [nodeForm, setNodeForm] = useState(null);      // 노드 + 버튼 카드 {uri, kind:"rel"|"prop", label, range, ptype, description}
  const [nodeErr, setNodeErr] = useState(null);
  const [linkDrag, setLinkDrag] = useState(null);      // + 버튼 드래그 관계 연결 {from, sx, sy, x, y, moved}
  const [mergeCand, setMergeCand] = useState(null);    // 노드 드래그 병합 후보 — 겹쳐진 대상 클래스 uri
  const [propForm, setPropForm] = useState(null);      // 속성 편집 카드 {uri, label, ptype, domain} — 패널 속성 태그 클릭으로 오픈
  const [propErr, setPropErr] = useState(null);
  const [propDelAsk, setPropDelAsk] = useState(false); // 속성 삭제 2단계 확인
  const [chipHover, setChipHover] = useState(null);    // 패널 태그 호버 {kind:"prop"|"rel", uri, host|domain·range} — 그래프에서 해당 요소만 활성화
  const movedRef = useRef(false);
  const svgRef = useRef(null);
  const panRef = useRef(null);   // 팬 시작점(스페이스+드래그)

  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(null);   // {text, err}
  const runReview = () => {
    setReviewBusy(true); setReviewMsg(null);
    api.ontologyReviewRelationships()   // 백그라운드 시작 — 진행/완료는 상단 '작업' 아이콘에서 추적
      .then((r) => {
        if (r.error) setReviewMsg({ text: r.error, err: true });
        else if (r.already) setReviewMsg({ text: "이미 구조 점검이 실행 중입니다 — 상단 '작업' 아이콘에서 진행 상황을 확인하세요." });
        else setReviewMsg({ text: "구조 점검을 시작합니다. 제안은 Generate › 생성 결과에서 확인하세요." });
      })
      .catch((e) => setReviewMsg({ text: String(e.message || e), err: true }))
      .finally(() => setReviewBusy(false));
  };

  const clearAll = () => {
    if (!window.confirm("추출된 엔티티·관계·그룹과 생성 결과(후보·승인 상태), 그리고 그 위에 세워진 매핑·실체화(문서 인스턴스·엔티티 해소·행 접근)·SHACL 리포트·확정 쿼리까지 모두 삭제합니다. 예상질문은 유지됩니다. 되돌릴 수 없습니다. 진행할까요?")) return;
    api.ontologyClear().then(() => { setRk((k) => k + 1); reload(); });
  };
  const saveRel = () => {
    if (!relForm?.label.trim() || !relForm.domain || !relForm.range) return;
    const done = (r) => { if (r.error) setRelErr(r.error); else { setRelForm(null); setRelErr(null); setRk((k) => k + 1); reload(); } };
    const fail = (e) => setRelErr(String(e.message || e));
    if (relForm.mode === "edit") {
      api.ontologyUpdateRelationship(relForm.uri, relForm.label.trim(), relForm.domain, relForm.range, relForm.description || "").then(done).catch(fail);
    } else {
      api.ontologyAddRelationship(relForm.label.trim(), relForm.domain, relForm.range, relForm.description || "").then(done).catch(fail);
    }
  };
  const delRel = () => {
    if (!relForm?.uri) return;
    if (!delAsk) { setDelAsk(true); return; }   // 1차 클릭 = 인라인 확인 대기 — 네이티브 confirm 은 환경에 따라 차단돼 무반응이 된다
    api.ontologyDeleteRelationship(relForm.uri)
      .then(() => { setDelAsk(false); setRelForm(null); setRelErr(null); setRk((k) => k + 1); reload(); })
      .catch((e) => { setDelAsk(false); setRelErr(String(e.message || e)); });
  };
  const openEdge = (e) => {
    setRelErr(null); setDelAsk(false);
    setRelForm({ mode: "edit", uri: e.uri, label: e.label || "", domain: e.domain, range: e.range, description: e.description || "" });
  };
  // 노드 + 버튼 카드 — 관계(출발 고정)·속성 추가·클래스 병합. 관계 도착은 비워둔 채 시작(사용자가 검색으로 선택)
  const openNodeForm = (uri, kind = "rel") => {
    setRelForm(null); setPropForm(null); setNodeErr(null);
    setNodeForm({ uri, kind, label: "", range: "", ptype: "xsd:string", description: "", uris: uri ? [uri] : [] });
  };
  // 드래그 드랍 병합 — 겹쳐 놓은 대상(target)이 첫 항목(살아남는 URI), 끌어온 노드가 흡수됨
  const openMergeForm = (target, dragged) => {
    setRelForm(null); setPropForm(null); setNodeErr(null);
    setNodeForm({ uri: "", kind: "merge", label: nodes.find((x) => x.uri === target)?.label || target,
      range: "", ptype: "xsd:string", description: "", uris: [target, dragged] });
  };
  const saveNodeForm = () => {
    if (!nodeForm) return;
    const done = (r) => { if (r.error) setNodeErr(r.error); else { setNodeForm(null); setNodeErr(null); setRk((k) => k + 1); reload(); } };
    const fail = (e) => setNodeErr(String(e.message || e));
    if (nodeForm.kind === "merge") {
      if (!nodeForm.label.trim() || (nodeForm.uris || []).length < 2) return;
      const target = nodeForm.uris[0];
      api.ontologyMergeClasses(nodeForm.uris, nodeForm.label.trim())
        .then((r) => { if (r.error) setNodeErr(r.error); else { setNodeForm(null); setNodeErr(null); setSel(target); setRk((k) => k + 1); reload(); } })
        .catch(fail);
      return;
    }
    if (nodeForm.kind === "class") {   // 클래스 신규 — 생성이 놓친 개념을 코드 수정 없이 보충
      if (!nodeForm.label.trim()) return;
      api.ontologyAddClass(nodeForm.label.trim(), nodeForm.parent || null, nodeForm.description || "").then(done).catch(fail);
      return;
    }
    if (!nodeForm.label.trim() || !nodeForm.uri || (nodeForm.kind === "rel" && !nodeForm.range)) return;
    if (nodeForm.kind === "rel") {
      api.ontologyAddRelationship(nodeForm.label.trim(), nodeForm.uri, nodeForm.range, nodeForm.description || "").then(done).catch(fail);
    } else {
      api.ontologyAddProperty(nodeForm.label.trim(), nodeForm.uri, nodeForm.ptype || "xsd:string", nodeForm.description || "").then(done).catch(fail);
    }
  };
  // 속성 편집 카드 — 패널의 속성 태그 클릭으로 오픈, 수정/삭제(2단계 확인)
  const openProp = (p) => {
    setRelForm(null); setNodeForm(null); setPropErr(null); setPropDelAsk(false);
    setPropForm({ uri: p.uri, label: p.label, ptype: p.range || "xsd:string", domain: p.domain });
  };
  const savePropForm = () => {
    if (!propForm?.label.trim()) return;
    api.ontologyUpdateProperty(propForm.uri, propForm.label.trim(), propForm.ptype)
      .then((r) => { if (r.error) setPropErr(r.error); else { setPropForm(null); setPropErr(null); setRk((k) => k + 1); reload(); } })
      .catch((e) => setPropErr(String(e.message || e)));
  };
  const delPropForm = () => {
    if (!propDelAsk) { setPropDelAsk(true); return; }
    api.ontologyDeleteProperty(propForm.uri)
      .then(() => { setPropDelAsk(false); setPropForm(null); setRk((k) => k + 1); reload(); })
      .catch((e) => { setPropDelAsk(false); setPropErr(String(e.message || e)); });
  };

  useEffect(() => {
    let alive = true;
    Promise.all([api.ontologyView("entities"), api.ontologyView("relationships"), api.ontologyView("designer"), api.ontologyGroups()])
      .then(([e, r, full, g]) => {
        if (!alive) return;
        const ns = e.entities || [];
        const uris = new Set(ns.map((x) => x.uri));
        setNodes(ns);
        setEdges((r.relationships || []).filter((p) => uris.has(p.domain) && uris.has(p.range)));
        setHier(ns.filter((c) => c.parent && uris.has(c.parent)).map((c) => ({ domain: c.uri, range: c.parent })));
        setDataProps((full.properties || []).filter((p) => p.kind === "data"));
        setGroups(g.groups || []);
        setSel((s) => (s && uris.has(s) ? s : null));   // 패널 작업(속성/관계 편집) 후에도 선택 유지
      })
      .catch(() => { if (alive) { setNodes([]); setEdges([]); setDataProps([]); setGroups([]); setHier([]); } });
    return () => { alive = false; };
  }, [activeId, rk, rev]);

  const allEdges = useMemo(() => edges.concat(hier), [edges, hier]);   // 레이아웃·크기·강조는 관계+계층 모두 반영
  // 계층 앵커 깊이 — 상위 클래스가 0열(맨 왼쪽), 하위가 그 옆, 나머지는 관계 홉 수로 오른쪽 전개.
  // 속성은 호스트 클래스와 같은 열을 목표로 — 링크 장력과 함께 클래스 곁에 머문다.
  const depthMap = useMemo(() => {
    const base = nodes && nodes.length ? hierarchyDepth(nodes, edges, hier) : null;
    if (!base) return null;
    const d = { ...base };
    for (const p of dataProps) if (d[p.domain] != null) d[p.uri] = d[p.domain];
    return d;
  }, [nodes, edges, hier, dataProps]);
  // 클래스별 data 속성 — 육각형 노드 주위 위성 원으로 렌더
  const propsByClass = useMemo(() => {
    const m = {};
    for (const p of dataProps) (m[p.domain] = m[p.domain] || []).push(p);
    return m;
  }, [dataProps]);
  // 속성도 시뮬 노드로 편입 — 클래스에 짧은 링크(kind:"prop")로 부착하고 자리는 물리에 맡긴다(자율 배치·개별 드래그)
  const simNodes = useMemo(() => {
    if (!nodes) return nodes;
    const present = new Set(nodes.map((n) => n.uri));
    return nodes.concat(dataProps.filter((p) => present.has(p.domain)).map((p) => ({ uri: p.uri, label: p.label, isProp: true, r: PR })));
  }, [nodes, dataProps]);
  const simEdges = useMemo(() => {
    const present = new Set((nodes || []).map((n) => n.uri));
    return allEdges.concat(dataProps.filter((p) => present.has(p.domain)).map((p) => ({ domain: p.domain, range: p.uri, kind: "prop" })));
  }, [nodes, allEdges, dataProps]);
  const sim = useGraphSim(simNodes, simEdges, depthMap);   // d3-force — 드래그 시 연결 노드가 따라 움직이는 라이브 물리
  useEffect(() => {   // 새 레이아웃이면 줌 초기화
    if (sim) { const [x, y, w, h] = sim.vb.split(" ").map(Number); setView({ x, y, w, h }); }
  }, [sim]);
  useEffect(() => {   // ⌘/Ctrl+휠·핀치 = 연속 줌(커서 기준, deltaY 비례) — 일반 휠은 페이지 스크롤 유지 (Query 탐색과 동일)
    const svg = svgRef.current;
    if (!svg || !sim) return;
    const fitW = Number(sim.vb.split(" ")[2]);
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM(); if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      const f = Math.exp(Math.max(-24, Math.min(24, e.deltaY)) * 0.006);   // 노치당 ≈±15%, 트랙패드는 미세 연속
      setView((v) => (v ? zoomView(v, p, f, fitW) : v));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [sim]);
  useEffect(() => {   // 스페이스바 홀드 = 팬 모드
    const down = (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(e.target.tagName || "")) { e.preventDefault(); setSpaceDown(true); } };
    const up = (e) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => {   // 선택 클래스가 바뀌면 속성 편집 카드·태그 호버 초기화
    setPropForm(null); setPropErr(null); setPropDelAsk(false); setChipHover(null);
  }, [sel]);

  if (!nodes) return <div style={{ color: "var(--muted)", padding: "40px 4px" }}>불러오는 중…</div>;
  if (nodes.length === 0) return <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>클래스가 없습니다.</div>;

  const { vb, P } = sim;
  const toSvg = (e) => {
    const s = svgRef.current; if (!s) return { x: 0, y: 0 };
    const pt = s.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = s.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const startPan = (e) => { const r = svgRef.current.getBoundingClientRect(); if (view) panRef.current = { cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y, kx: view.w / r.width, ky: view.h / r.height }; };
  // 줌 컨트롤 — Query 탐색과 동일: 중심 기준 스텝 줌 + 화면 맞춤
  const zoomStep = (f) => setView((v) => (v ? zoomView(v, { x: v.x + v.w / 2, y: v.y + v.h / 2 }, f, Number(vb.split(" ")[2])) : v));
  const fitScreen = () => { const [fx, fy, fw, fh] = vb.split(" ").map(Number); setView({ x: fx, y: fy, w: fw, h: fh }); };
  const ctrlBtn = { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #232b41", borderRadius: 8, background: "#0c1222d9", color: "#8b96b4", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: 1 };
  const deg = degreeMap(nodes, allEdges);
  // 원 둘레에 화살표가 닿도록 중심→방향 단위벡터로 반지름만큼 잘라냄
  const clip = (from, to, r) => {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1e-6;
    return { x: to.x - (dx / d) * r, y: to.y - (dy / d) * r };
  };
  // 강조 중심 — 호버(일시)가 우선, 클릭 선택(고정)이 폴백.
  // 노드를 끌고 다니는 중엔 강조를 풀어 전체를 보여준다 — 병합 대상을 고르려면 다른 노드가 보여야 한다.
  const focus = drag ? null : hover || sel;
  const edgeOn = (e) => !focus || e.domain === focus || e.range === focus;
  const nodeDim = (uri) => focus && focus !== uri && !allEdges.some((e) => (e.domain === focus && e.range === uri) || (e.range === focus && e.domain === uri));
  const maxDeg = Math.max(1, ...nodes.map((nn) => deg[nn.uri] || 0));
  const top5 = new Set([...nodes].sort((a, b) => (deg[b.uri] || 0) - (deg[a.uri] || 0)).slice(0, 5).map((nn) => nn.uri));
  // 노드 색 2분 — 클래스(청록) / 핵심(앰버 — 연결 TOP 5). 연결 수는 농도·글로우·테두리로만.
  const nodeColor = (uri) => (top5.has(uri) ? CORE_COLOR : HIER_COLOR);
  // 범례 호버 필터 — 핵심(연결 TOP 5)만 강조
  const tierOn = (uri) => tierHover !== "top" || top5.has(uri);
  // 검색 필터 — 클래스 라벨/URI 또는 소속 data 속성 이름에 검색어가 포함된 클래스만 활성화.
  // 색은 바꾸지 않고 호버와 같은 활성/페이드 방식만 사용한다. 관계 카드 선택기 타이핑(pickQ)도 동일 적용.
  const ql = (pickQ || q).trim().toLowerCase();
  const classMatch = !ql ? null : new Set(nodes.filter((nn) =>
    (nn.label || "").toLowerCase().includes(ql) || nn.uri.toLowerCase().includes(ql)).map((nn) => nn.uri));
  const matchSet = !ql ? null : new Set(nodes.filter((nn) =>
    classMatch.has(nn.uri) ||
    (propsByClass[nn.uri] || []).some((p) => (p.label || "").toLowerCase().includes(ql))
  ).map((nn) => nn.uri));
  const liveOn = (uri) => tierOn(uri) && (!matchSet || matchSet.has(uri));   // 범례 호버 + 검색 모두 통과해야 완전 표시
  const filterOn = tierHover != null || !!matchSet;
  // 엣지 색 = 출발 노드 색
  const eColor = (e) => nodeColor(e.domain);
  const arrColors = [...new Set(edges.map(eColor))];
  // 추가/연결 진행 중 하이라이트(파란색) — 관계 카드(생성)·노드 + 카드·드래그 연결의 대상 노드와 예상 연결선
  const pendRel = relForm?.mode === "create" && relForm.domain && relForm.range ? { domain: relForm.domain, range: relForm.range }
    : nodeForm?.kind === "rel" && nodeForm.uri && nodeForm.range ? { domain: nodeForm.uri, range: nodeForm.range } : null;
  const addMark = (uri) => (pendRel && (pendRel.domain === uri || pendRel.range === uri))
    || (nodeForm?.kind === "merge" ? (nodeForm.uris || []).includes(uri) : nodeForm?.uri === uri)
    || (linkDrag && (linkDrag.from === uri || (linkDrag.moved && hover === uri)));
  // 패널 태그 호버 강조 — 그래프에서 해당 속성/관계만 활성화 (대상이 사라졌으면 무시)
  const chip = chipHover && ((chipHover.kind === "prop" && dataProps.some((p) => p.uri === chipHover.uri))
    || (chipHover.kind === "rel" && edges.some((e2) => e2.uri === chipHover.uri))) ? chipHover : null;
  const chipOnClass = (uri) => !chip ? true : chip.kind === "prop" ? uri === chip.host : uri === chip.domain || uri === chip.range;
  const reduce = prefersReducedMotion();
  const flowOK = !reduce && edges.length <= 160;   // 대형 그래프에선 상시 흐름 애니메이션 생략(성능)
  const totalRel = ontology?.relationships ?? edges.length;
  const hidden = Math.max(0, totalRel - edges.length);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 14 }}>
          <b style={{ color: "var(--navy)" }}>{nodes.length}</b> <span style={{ color: "var(--muted)" }}>classes ·</span> <b style={{ color: "var(--navy)" }}>{edges.length}</b> <span style={{ color: "var(--muted)" }}>relationships</span>
          {hier.length > 0 && <span style={{ color: "var(--muted)" }}> · <b style={{ color: "var(--navy)" }}>{hier.length}</b> 계층</span>}
          {hidden > 0 && <span style={{ color: "var(--faint)", fontSize: 12 }}> (끝점 없는 {hidden}개 미표시)</span>}
          <span style={{ color: "var(--faint)", fontSize: 12 }}> · 호버=이웃 강조 · 클릭=속성·관계 패널 · 배경 드래그=화면 이동 · ⌘/Ctrl+휠=줌 · 노드 ＋=추가(드래그=관계 연결) · 노드를 다른 노드에 겹쳐 놓으면 병합</span>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span title="온톨로지 클래스 — 육각형 노드" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "default" }}>
            <svg width="14" height="14" viewBox="-8.5 -8.5 17 17" style={{ display: "block" }}><path d={hexPath(7)} fill={HIER_COLOR + "55"} stroke={HIER_COLOR} strokeWidth="2" /></svg>클래스
          </span>
          <span title="관계(엣지) 수 상위 5개 클래스 — 앰버 강조" onMouseEnter={() => setTierHover("top")} onMouseLeave={() => setTierHover(null)}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: tierHover === "top" ? "var(--navy)" : "var(--muted)", fontWeight: tierHover === "top" ? 700 : 400, cursor: "default" }}>
            <svg width="14" height="14" viewBox="-8.5 -8.5 17 17" style={{ display: "block" }}><path d={hexPath(7)} fill={CORE_COLOR + "33"} stroke={CORE_COLOR} strokeWidth="2" /></svg>핵심 (연결 TOP 5)
          </span>
          <span title="클래스의 data 속성 — 클래스 주위 위성 원" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
            <i style={{ width: 11, height: 11, borderRadius: 99, background: PROP_COLOR + "24", border: `1.5px solid ${PROP_COLOR}` }} />속성
          </span>
          <span title="채움·글로우·테두리가 진할수록 관계(엣지)가 많은 클래스" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
            <i style={{ width: 30, height: 12, borderRadius: 3, background: "linear-gradient(90deg, #00BEAC18, #00BEAC)" }} />진할수록 관계 많음
          </span>
          {/* 구조 점검은 Generate 마지막 단계로 자동 실행됨(별도 버튼 제거) */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder="클래스·속성 검색" title="클래스 이름·URI·속성 이름 매칭 — 일치 노드만 활성화 (Esc=지우기)"
              style={{ border: "1px solid var(--line2)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontFamily: "var(--sans)", background: "var(--app)", color: "var(--text)", outline: "none", width: 132 }} />
            {q.trim() !== "" && matchSet && <span style={{ fontSize: 11.5, fontWeight: 700, color: matchSet.size ? "var(--muted)" : "#d64545", whiteSpace: "nowrap" }}>{matchSet.size}개 일치</span>}
          </span>
          <button onClick={() => { if (nodeForm) { setNodeForm(null); setNodeErr(null); } else openNodeForm("", "rel"); }}
            title="클래스 신규·관계·속성 추가 또는 클래스 병합 — 클래스는 검색해서 선택"
            style={{ border: "1px solid var(--blue)", background: nodeForm ? "var(--blue)" : "var(--blue-soft)", color: nodeForm ? "#fff" : "var(--blue-d)", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>클래스/관계/속성 편집</button>
          <button onClick={() => window.open(api.ontologyExportTtlUrl(), "_blank")}
            title="승인된 T-Box(클래스·속성·계층) + A-Box(인스턴스·값·관계·출처)를 Turtle 파일로 내려받습니다 — 트리플 스토어 적재용"
            style={{ border: "1px solid #009387", background: "#e0f6f3", color: "#009387", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>⭳ TTL 내보내기</button>
          <button onClick={() => setRk((k) => k + 1)} style={{ border: "1px solid var(--line2)", background: "var(--app)", color: "var(--text)", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>↻ 새로고침</button>
          <button onClick={clearAll} style={{ border: "1px solid #d64545", background: "#fde8e8", color: "#d64545", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>전체 삭제</button>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", margin: "-4px 0 12px", flexShrink: 0 }}>
        범례 안내 — <b>모양</b> = ⬡ 육각형=클래스 · 원=속성(data, 클래스에 위성으로 부착) — <b>색</b> = 청록(클래스) · 앰버(핵심 — 연결 TOP 5) · <b>진하기·글로우</b> = 관계 수 · 배치는 계층 상위가 왼쪽, 관계를 따라 오른쪽으로 전개 · 범례 호버 = 해당 노드만 강조
      </div>
      <JobBanner msg={reviewMsg} onClose={() => setReviewMsg(null)} />
      {relForm && (() => {
        const inp = { border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--app)", outline: "none" };
        const relOk = !!(relForm.label.trim() && relForm.domain && relForm.range);
        return (
          <div style={{ marginBottom: 12, padding: "14px 18px", background: "var(--blue-soft)", border: "1px solid var(--blue-bg)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{relForm.mode === "edit" ? `관계 편집 — ${relForm.label || relForm.uri}` : "관계 추가"}</b>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>출발 → 도착 방향으로 저장됩니다 · 클래스는 검색해서 선택</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <ClassPicker onQuery={setPickQ} nodes={nodes} value={relForm.domain} onChange={(v) => setRelForm((f) => ({ ...f, domain: v }))} placeholder="출발 클래스 검색" />
              <input value={relForm.label} onChange={(e) => setRelForm((f) => ({ ...f, label: e.target.value }))} placeholder="관계명 * (예: 포함)"
                onKeyDown={(e) => e.key === "Enter" && relOk && saveRel()} style={{ ...inp, width: 140 }} autoFocus />
              <button onClick={() => setRelForm((f) => ({ ...f, domain: f.range, range: f.domain }))} title="방향 바꾸기 (출발↔도착)"
                style={{ border: "1px solid var(--line2)", background: "var(--app)", color: "var(--navy)", fontWeight: 700, fontSize: 13, width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}>⇄</button>
              <ClassPicker onQuery={setPickQ} nodes={nodes} value={relForm.range} onChange={(v) => setRelForm((f) => ({ ...f, range: v }))} placeholder="도착 클래스 검색" />
              <input value={relForm.description || ""} onChange={(e) => setRelForm((f) => ({ ...f, description: e.target.value }))} placeholder="설명 (선택)"
                style={{ ...inp, width: 180 }} />
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--line2)", margin: "0 2px" }} />
              <button onClick={saveRel} disabled={!relOk} title={relForm.mode === "edit" ? "수정 저장" : "추가"}
                style={{ border: "none", background: "var(--blue)", color: "#fff", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: relOk ? "pointer" : "default", opacity: relOk ? 1 : 0.45, flexShrink: 0 }}>{IC.check}</button>
              {relForm.mode === "edit" && (delAsk
                ? <button onClick={delRel} title="한 번 더 누르면 삭제됩니다"
                    style={{ border: "none", background: "#d64545", color: "#fff", fontWeight: 700, fontSize: 12, padding: "0 12px", height: 30, borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>삭제 확인</button>
                : iconBtn(IC.trash, "삭제", delRel, "#d64545"))}
              {iconBtn(IC.x, "취소", () => { setRelForm(null); setRelErr(null); setDelAsk(false); }, "var(--muted)")}
              {relErr && <span style={{ color: "#d64545", fontSize: 12.5, fontWeight: 600 }}>{relErr}</span>}
            </div>
          </div>
        );
      })()}
      {nodeForm && (() => {
        const inp = { border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--app)", outline: "none" };
        const isMerge = nodeForm.kind === "merge";
        const isCls = nodeForm.kind === "class";   // 클래스 신규 — 시작 클래스가 필요 없는 유일한 탭
        const clsL = (u) => nodes.find((x) => x.uri === u)?.label || u;
        const srcLabel = nodeForm.uri ? clsL(nodeForm.uri) : null;
        const tabBtn = (kind, txt) => (
          <button onClick={() => { setNodeErr(null); setNodeForm((f) => {
              const nf = { ...f, kind };
              // 병합 탭 진입 — 시작 노드를 병합 목록에 승계, 이름은 첫 항목 라벨로 시드. 이탈 시 이름 초기화
              if (kind === "merge") { nf.uris = f.uris?.length ? f.uris : (f.uri ? [f.uri] : []); nf.label = nf.uris.length ? clsL(nf.uris[0]) : ""; }
              else if (f.kind === "merge") nf.label = "";
              return nf; }); }}
            style={{ border: `1px solid ${nodeForm.kind === kind ? ADD_COLOR : "var(--line2)"}`, background: nodeForm.kind === kind ? ADD_COLOR : "var(--app)", color: nodeForm.kind === kind ? "#fff" : "var(--text)", fontWeight: 700, fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>{txt}</button>
        );
        return (
          <div style={{ marginBottom: 12, padding: "14px 18px", background: ADD_COLOR + "12", border: `1px solid ${ADD_COLOR}55`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <b style={{ fontSize: 13.5, color: "var(--navy)" }}>{isMerge ? "클래스 병합" : isCls ? "클래스 추가" : srcLabel ? `${srcLabel} 에 추가` : "클래스/관계/속성 편집"}</b>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{isMerge ? "합칠 클래스를 2개 이상 검색·선택 — 속성·관계는 중복 없이 승계됩니다" : isCls ? "추출이 놓친 개념을 보충합니다 — 추가 후 Auto-Map 을 다시 돌리면 같은 이름의 테이블이 붙습니다" : nodeForm.kind === "rel" ? "출발 → 도착 방향으로 저장됩니다" : "data 속성이 위성 노드로 연결됩니다"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {tabBtn("class", "클래스")}
              {tabBtn("rel", "관계")}
              {tabBtn("prop", "속성")}
              {tabBtn("merge", "병합")}
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--line2)", margin: "0 2px" }} />
              {!isMerge && !isCls && (srcLabel
                ? <span style={{ fontSize: 12.5, fontWeight: 700, color: ADD_COLOR, background: ADD_COLOR + "1a", border: `1px solid ${ADD_COLOR}55`, borderRadius: 99, padding: "5px 12px" }}>{srcLabel}</span>
                : <ClassPicker onQuery={setPickQ} nodes={nodes} value={nodeForm.uri} onChange={(v) => setNodeForm((f) => ({ ...f, uri: v, range: f.range === v ? "" : f.range }))}
                    placeholder={nodeForm.kind === "rel" ? "출발 클래스 검색" : "클래스 검색"} />)}
              {isMerge ? (
                <>
                  {(nodeForm.uris || []).map((u) => (
                    <span key={u} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: ADD_COLOR, background: ADD_COLOR + "1a", border: `1px solid ${ADD_COLOR}55`, borderRadius: 99, padding: "4px 7px 4px 12px" }}>
                      {clsL(u)}
                      <button onClick={() => setNodeForm((f) => ({ ...f, uris: (f.uris || []).filter((x) => x !== u) }))} title="병합 대상에서 제외"
                        style={{ border: "none", background: "transparent", color: ADD_COLOR, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                    </span>
                  ))}
                  <ClassPicker onQuery={setPickQ} nodes={nodes.filter((x) => !(nodeForm.uris || []).includes(x.uri))} value=""
                    onChange={(v) => setNodeForm((f) => { const uris = [...(f.uris || []), v]; return { ...f, uris, label: f.label.trim() ? f.label : clsL(uris[0]) }; })}
                    placeholder="합칠 클래스 검색·추가" />
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>⇒</span>
                  <input value={nodeForm.label} onChange={(e) => setNodeForm((f) => ({ ...f, label: e.target.value }))} placeholder="병합 후 클래스명 *"
                    onKeyDown={(e) => e.key === "Enter" && saveNodeForm()} style={{ ...inp, width: 150 }} />
                </>
              ) : isCls ? (
                <>
                  <input value={nodeForm.label} onChange={(e) => setNodeForm((f) => ({ ...f, label: e.target.value }))} placeholder="클래스명 * (예: 계약특약)"
                    onKeyDown={(e) => e.key === "Enter" && nodeForm.label.trim() && saveNodeForm()} style={{ ...inp, width: 160 }} autoFocus />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>상위</span>
                  <ClassPicker onQuery={setPickQ} nodes={nodes} value={nodeForm.parent || ""}
                    onChange={(v) => setNodeForm((f) => ({ ...f, parent: f.parent === v ? "" : v }))} placeholder="상위 클래스 (선택)" />
                </>
              ) : nodeForm.kind === "rel" ? (
                <>
                  <input value={nodeForm.label} onChange={(e) => setNodeForm((f) => ({ ...f, label: e.target.value }))} placeholder="관계명 * (예: 포함)"
                    onKeyDown={(e) => e.key === "Enter" && saveNodeForm()} style={{ ...inp, width: 140 }} autoFocus />
                  <span style={{ color: "var(--muted)", fontWeight: 700 }}>→</span>
                  <ClassPicker onQuery={setPickQ} nodes={nodes} value={nodeForm.range} exclude={nodeForm.uri}
                    onChange={(v) => setNodeForm((f) => ({ ...f, range: v }))} placeholder="도착 클래스 검색" />
                </>
              ) : (
                <>
                  <input value={nodeForm.label} onChange={(e) => setNodeForm((f) => ({ ...f, label: e.target.value }))} placeholder="속성명 * (예: 보험료)"
                    onKeyDown={(e) => e.key === "Enter" && nodeForm.label.trim() && saveNodeForm()} style={{ ...inp, width: 140 }} autoFocus />
                  <select value={nodeForm.ptype} onChange={(e) => setNodeForm((f) => ({ ...f, ptype: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                    {PTYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </>
              )}
              {!isMerge && <input value={nodeForm.description || ""} onChange={(e) => setNodeForm((f) => ({ ...f, description: e.target.value }))} placeholder="설명 (선택)" style={{ ...inp, width: 180 }} />}
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--line2)", margin: "0 2px" }} />
              {(() => { const ok = isMerge
                  ? !!(nodeForm.label.trim() && (nodeForm.uris || []).length >= 2)
                  : isCls ? !!nodeForm.label.trim()
                  : !!(nodeForm.label.trim() && nodeForm.uri && (nodeForm.kind !== "rel" || nodeForm.range)); return (
                <button onClick={saveNodeForm} disabled={!ok}
                  title={isMerge ? ((nodeForm.uris || []).length < 2 ? "합칠 클래스를 2개 이상 선택하세요" : !nodeForm.label.trim() ? "병합 후 클래스명을 입력하세요" : "병합 실행") : isCls ? (!nodeForm.label.trim() ? "클래스명을 입력하세요" : "추가") : !nodeForm.uri ? "클래스를 선택하세요" : nodeForm.kind === "rel" && !nodeForm.range ? "도착 클래스를 선택하세요" : "추가"}
                  style={{ border: "none", background: ADD_COLOR, color: "#fff", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.45, flexShrink: 0 }}>{IC.check}</button>
              ); })()}
              {iconBtn(IC.x, "취소", () => { setNodeForm(null); setNodeErr(null); }, "var(--muted)")}
              {nodeErr && <span style={{ color: "#d64545", fontSize: 12.5, fontWeight: 600 }}>{nodeErr}</span>}
            </div>
            {/* 병합 미리보기 — 승계될 속성·관계와 정리(중복·내부 관계) 내역을 승인 전에 보여준다 */}
            {isMerge && (nodeForm.uris || []).length > 0 && (() => {
              const mset = new Set(nodeForm.uris);
              const chipBase = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, padding: "3px 10px", whiteSpace: "nowrap", borderRadius: 99 };
              const pvProp = { ...chipBase, background: PROP_COLOR + "26", color: "#54618a", border: `1px solid ${PROP_COLOR}66` };
              const pvRel = { ...chipBase, background: HIER_COLOR + "1a", color: "#00857a", border: `1px solid ${HIER_COLOR}44` };
              const pvGone = { ...chipBase, background: "var(--main)", color: "var(--faint)", border: "1px solid var(--line2)", textDecoration: "line-through" };
              const seenP = new Set(); const mProps = []; let dupP = 0;
              dataProps.filter((p) => mset.has(p.domain)).forEach((p) => {
                const k = (p.label || "").trim();
                if (seenP.has(k)) dupP += 1; else { seenP.add(k); mProps.push(p); }
              });
              const inRel = edges.filter((e) => mset.has(e.domain) || mset.has(e.range));
              const internal = inRel.filter((e) => mset.has(e.domain) && mset.has(e.range));
              const seenR = new Set(); const mRels = [];
              inRel.filter((e) => !(mset.has(e.domain) && mset.has(e.range))).forEach((e) => {
                const out = mset.has(e.domain);
                const k = `${out ? ">" : "<"}|${e.label}|${out ? e.range : e.domain}`;
                if (!seenR.has(k)) { seenR.add(k); mRels.push({ ...e, out }); }
              });
              const dupR = inRel.length - internal.length - mRels.length;
              const cut = [dupP > 0 && `중복 속성 ${dupP}`, dupR > 0 && `중복 관계 ${dupR}`, internal.length > 0 && `내부 관계 ${internal.length}`].filter(Boolean);
              return (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${ADD_COLOR}44` }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 7 }}>
                    병합 후 미리보기 — 속성 {mProps.length} · 관계 {mRels.length}
                    {cut.length > 0 && <span style={{ fontWeight: 500 }}> · 정리됨: {cut.join(" · ")}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>속성</span>
                    {mProps.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>없음</span>}
                    {mProps.map((p) => (
                      <span key={p.uri} className="mono" style={pvProp}>{p.label}{p.range ? ` : ${String(p.range).split(":").pop()}` : ""}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>관계</span>
                    {mRels.length === 0 && internal.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>없음</span>}
                    {mRels.map((e2, i2) => (
                      <span key={i2} className="mono" style={pvRel}>
                        <span style={{ fontWeight: 800 }}>{e2.out ? "→" : "←"}</span>{e2.label} · {clsL(e2.out ? e2.range : e2.domain)}
                      </span>
                    ))}
                    {internal.map((e2, i2) => (
                      <span key={`in-${i2}`} className="mono" title="병합으로 같은 클래스가 되어 제거됩니다" style={pvGone}>{e2.label}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}
      {propForm && (() => {   // 속성 편집 카드 — 패널 속성 태그 클릭으로 오픈
        const inp = { border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "var(--sans)", background: "var(--app)", outline: "none" };
        const ok = !!propForm.label.trim();
        return (
          <div style={{ marginBottom: 12, padding: "14px 18px", background: PROP_COLOR + "14", border: `1px solid ${PROP_COLOR}66`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <b style={{ fontSize: 13.5, color: "var(--navy)" }}>속성 편집 — {nodes.find((x) => x.uri === propForm.domain)?.label || propForm.domain}</b>
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>이름·타입 수정 또는 삭제</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input value={propForm.label} onChange={(e) => setPropForm((f) => ({ ...f, label: e.target.value }))} placeholder="속성명 *"
                onKeyDown={(e) => e.key === "Enter" && ok && savePropForm()} style={{ ...inp, width: 150 }} autoFocus />
              <select value={propForm.ptype} onChange={(e) => setPropForm((f) => ({ ...f, ptype: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                {PTYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                {!PTYPES.some(([v]) => v === propForm.ptype) && <option value={propForm.ptype}>{String(propForm.ptype).split(":").pop()}</option>}
              </select>
              <span style={{ width: 1, alignSelf: "stretch", background: "var(--line2)", margin: "0 2px" }} />
              <button onClick={savePropForm} disabled={!ok} title="수정 저장"
                style={{ border: "none", background: "var(--blue)", color: "#fff", width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.45, flexShrink: 0 }}>{IC.check}</button>
              {propDelAsk
                ? <button onClick={delPropForm} title="한 번 더 누르면 삭제됩니다"
                    style={{ border: "none", background: "#d64545", color: "#fff", fontWeight: 700, fontSize: 12, padding: "0 12px", height: 30, borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>삭제 확인</button>
                : iconBtn(IC.trash, "삭제", delPropForm, "#d64545")}
              {iconBtn(IC.x, "취소", () => { setPropForm(null); setPropErr(null); setPropDelAsk(false); }, "var(--muted)")}
              {propErr && <span style={{ color: "#d64545", fontSize: 12.5, fontWeight: 600 }}>{propErr}</span>}
            </div>
          </div>
        );
      })()}
      {sel && (() => {   // 클래스 패널 — 태그 클릭=상단 편집 카드 · 태그 호버=그래프에서 해당 요소만 활성화
        const selNode = nodes.find((x) => x.uri === sel);
        const dps = dataProps.filter((p) => p.domain === sel);
        const rels = edges.filter((e) => e.domain === sel || e.range === sel);
        const clsLabel = (u) => nodes.find((x) => x.uri === u)?.label || u;
        const chipBase = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "4px 12px", whiteSpace: "nowrap", borderRadius: 99, cursor: "pointer" };
        const propChip = { ...chipBase, background: PROP_COLOR + "26", color: "#54618a", border: `1px solid ${PROP_COLOR}66` };   // 속성 = 회청
        const relChipS = { ...chipBase, background: HIER_COLOR + "1a", color: "#00857a", border: `1px solid ${HIER_COLOR}44` };  // 관계 = 청록
        const addChip = (kind, title) => (
          <button onClick={() => openNodeForm(sel, kind)} title={title}
            style={{ ...chipBase, background: "var(--blue-soft)", color: "var(--blue-d)", border: "1px solid var(--blue-bg)", fontWeight: 800 }}>＋</button>
        );
        return (
          <div style={{ marginBottom: 12, padding: "12px 16px", background: "var(--app)", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ color: "var(--navy)", fontSize: 13.5 }}>{selNode?.label || sel}</b>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>속성 {dps.length} · 관계 {rels.length}</span>
              <span style={{ fontSize: 11.5, color: "var(--faint)" }}>태그 클릭=편집 카드 · 호버=그래프 강조</span>
              <span style={{ flex: 1 }} />
              {iconBtn(IC.x, "닫기", () => setSel(null), "var(--muted)")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>속성</span>
              {dps.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>없음</span>}
              {dps.map((p) => (
                <span key={p.uri} className="mono" title={`${p.uri} — 클릭=편집 카드`} style={propChip}
                  onClick={() => openProp(p)}
                  onMouseEnter={() => setChipHover({ kind: "prop", uri: p.uri, host: p.domain })}
                  onMouseLeave={() => setChipHover(null)}>
                  {p.label}{p.range ? ` : ${String(p.range).split(":").pop()}` : ""}
                </span>
              ))}
              {addChip("prop", "이 클래스에 속성 추가")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>관계</span>
              {rels.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>없음</span>}
              {rels.map((e) => {
                const out = e.domain === sel;
                return (
                  <span key={e.uri} className="mono" title={`${clsLabel(e.domain)} → ${e.label} → ${clsLabel(e.range)} — 클릭=편집 카드`} style={relChipS}
                    onClick={() => openEdge(e)}
                    onMouseEnter={() => setChipHover({ kind: "rel", uri: e.uri, domain: e.domain, range: e.range })}
                    onMouseLeave={() => setChipHover(null)}>
                    <span style={{ fontWeight: 800 }}>{out ? "→" : "←"}</span>
                    {e.label} · {clsLabel(out ? e.range : e.domain)}
                  </span>
                );
              })}
              {addChip("rel", "이 클래스에서 출발하는 관계 추가")}
            </div>
          </div>
        );
      })()}
      <div className="og-canvas" style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 }}>
          <button style={ctrlBtn} title="확대" onClick={() => zoomStep(0.8)}>＋</button>
          <button style={ctrlBtn} title="축소" onClick={() => zoomStep(1.25)}>−</button>
          <button style={{ ...ctrlBtn, fontSize: 12 }} title="화면 맞춤" onClick={fitScreen}>⛶</button>
        </div>
        <svg ref={svgRef} viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : vb} width="100%" height="100%"
          style={{ display: "block", minWidth: 560, cursor: drag ? "grabbing" : linkDrag ? "crosshair" : "grab" }}
          onClick={() => { if (spaceDown || movedRef.current) { movedRef.current = false; return; } setSel(null); }}
          onMouseDown={(e) => startPan(e)}
          onMouseMove={(e) => {
            if (linkDrag) { movedRef.current = true; const pt = toSvg(e); setLinkDrag((ld) => ld && { ...ld, x: pt.x, y: pt.y, moved: ld.moved || Math.hypot(pt.x - ld.sx, pt.y - ld.sy) > 8 }); }
            else if (panRef.current) { movedRef.current = true; const d = panRef.current; setView((v) => ({ ...v, x: d.vx - (e.clientX - d.cx) * d.kx, y: d.vy - (e.clientY - d.cy) * d.ky })); }
            else if (drag) {
              movedRef.current = true;
              const pt = toSvg(e);
              sim.dragMove(drag, pt);
              if (nodes.some((n) => n.uri === drag)) {   // 클래스 드래그 — 겹쳐진 다른 클래스를 병합 후보로 표시
                let best = null, bd = Infinity;
                for (const nn of nodes) {
                  if (nn.uri === drag) continue;
                  const qp = P(nn.uri); if (!qp) continue;
                  const dd = Math.hypot(qp.x - pt.x, qp.y - pt.y);
                  if (dd < bd) { bd = dd; best = nn.uri; }
                }
                // 히스테리시스 — 이미 잡힌 후보는 해제 반경(2.4r)까지 유지, 새 후보는 진입 반경(1.5r)에서만
                let mc = mergeCand;
                if (mc) { const qp = P(mc); mc = qp && Math.hypot(qp.x - pt.x, qp.y - pt.y) < nodeR() * 2.4 ? mc : null; }
                if (!mc && bd < nodeR() * 1.5) mc = best;
                setMergeCand(mc);
                // 접근(바깥 반경 2.8r) 시 끌던 노드 유령화 + 대상 고정 — 조준 중 상대가 밀려나지 않게
                const aimT = mc || (bd < nodeR() * 2.8 ? best : null);
                sim.aim(aimT ? drag : null, aimT);
              }
            }
          }}
          onMouseUp={() => {
            if (linkDrag) {   // + 버튼 클릭=카드 열기 · 드래그 후 노드 위에서 놓기=관계 연결 카드(승인 대기)
              if (!linkDrag.moved) openNodeForm(linkDrag.from);
              else if (hover && hover !== linkDrag.from) { setRelErr(null); setNodeForm(null); setRelForm({ mode: "create", domain: linkDrag.from, range: hover, label: "", description: "" }); }
              setLinkDrag(null);
            }
            if (drag) {
              if (mergeCand && nodes.some((n) => n.uri === drag)) openMergeForm(mergeCand, drag);   // 겹쳐 놓으면 병합 카드(승인 대기)
              sim.aim(null, null); sim.dragEnd();
            }
            setDrag(null); setMergeCand(null); panRef.current = null;
          }}
          onMouseLeave={() => { if (drag) { sim.aim(null, null); sim.dragEnd(); } setDrag(null); setLinkDrag(null); setMergeCand(null); panRef.current = null; }}>
          <defs>
            {arrColors.map((c) => (
              <marker key={c} id={`od-arr-${c.replace("#", "")}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={c} /></marker>
            ))}
            <marker id="od-arr-edit" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#c26a12" /></marker>
            <marker id="od-arr-add" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={ADD_COLOR} /></marker>
          </defs>
          {edges.map((e, i) => {
            const s = P(e.domain), t = P(e.range);
            if (!s || !t) return null;
            const sc = clip(t, s, nodeR(deg[e.domain])), tc = clip(s, t, nodeR(deg[e.range]) + 3);
            const editing = relForm?.mode === "edit" && relForm.uri === e.uri;
            const on = edgeOn(e), show = (!!focus && on) || editing || chip?.uri === e.uri;
            const col = editing ? "#c26a12" : eColor(e);
            const { d, mx, my } = edgeGeom(sc, tc);
            const lw = (e.label || "").length * 11 + 14;
            const durP = 2.2 + (i % 5) * 0.4;   // 파티클 주기 — 엣지마다 달리해 유기적 흐름
            const nP = show ? 3 : 0;            // 글로우 파티클은 호버·선택·편집된 엣지에만 — 평상시 시야 정돈
            return (
              <g key={i} className="og-edge" opacity={editing ? 1 : chip ? (chip.kind === "rel" && e.uri === chip.uri ? 1 : 0.05) : focus ? (on ? 1 : 0.06) : filterOn ? (liveOn(e.domain) || liveOn(e.range) ? 0.9 : 0.06) : 0.85}>
                <title>{e.label}{e.description ? ` — ${e.description}` : ""}</title>
                <path d={d} fill="none" stroke={col} strokeOpacity={show ? 0.3 : 0.1} strokeWidth={show ? 7 : 4.5} strokeLinecap="round" style={{ pointerEvents: "none" }} />
                <path d={d} fill="none" stroke={col} strokeOpacity={show ? 0.95 : 0.3} strokeWidth={editing ? 2.4 : show ? 2.2 : 1.3}
                  markerEnd={editing ? "url(#od-arr-edit)" : show ? `url(#od-arr-${col.replace("#", "")})` : undefined} />
                {flowOK && (
                  <path className="og-flowdash" d={d} fill="none" stroke={col} strokeWidth={show ? 2.6 : 2}
                    strokeDasharray="7 45" strokeLinecap="round" strokeOpacity={show ? 1 : 0.35} style={{ pointerEvents: "none" }} />
                )}
                {flowOK && [...Array(nP)].map((_, k2) => (
                  <circle key={k2} r={show ? 3 : 2.3} fill={col} opacity={show ? 1 : 0.9}
                    style={{ filter: `drop-shadow(0 0 5px ${col}) drop-shadow(0 0 10px ${col})`, pointerEvents: "none" }}>
                    <animateMotion dur={`${durP}s`} begin={`${-(k2 * durP) / nP - (i % 7) * 0.37}s`} repeatCount="indefinite" path={d} />
                  </circle>
                ))}
                {show && (
                  <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                    <rect x={mx - lw / 2} y={my - 9} width={lw} height={18} rx={9} fill="#0c1222" fillOpacity="0.92" stroke={col} strokeOpacity="0.55" strokeWidth="1" />
                    <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={col}>{e.label}</text>
                  </motion.g>
                )}
              </g>
            );
          })}
          {/* 속성 노드 — 물리로 클래스 곁에 붙는 자율 위성. 개별 드래그 가능, 호버 시 호스트 이웃 강조 */}
          {dataProps.map((pp) => {
            const p = P(pp.uri), hp = P(pp.domain);
            if (!p || !hp) return null;
            const chipFoc = chip?.kind === "prop" && chip.uri === pp.uri;   // 패널 속성 태그 호버 — 이 속성만 활성
            const hostFoc = focus === pp.domain || chipFoc;
            const dim = nodeDim(pp.domain) || !liveOn(pp.domain);
            // 검색 시 활성 조건 — 속성 자신이 매칭됐거나, 클래스 이름이 매칭된 경우 그 소속 속성 전체
            const pMatch = !!ql && (pp.label || "").toLowerCase().includes(ql);
            const pOn = !ql || pMatch || classMatch.has(pp.domain);
            return (
              <g key={pp.uri} className="og-node" opacity={chip ? (chipFoc ? 1 : 0.08) : dim || !pOn ? 0.12 : 1}
                style={{ cursor: drag === pp.uri ? "grabbing" : "grab" }}
                onMouseEnter={() => setHover(pp.domain)} onMouseLeave={() => setHover(null)}
                onMouseDown={(ev) => { ev.stopPropagation(); if (spaceDown) { startPan(ev); return; } movedRef.current = false; setDrag(pp.uri); sim.dragStart(pp.uri); }}
                onClick={(ev) => { ev.stopPropagation(); if (movedRef.current) { movedRef.current = false; return; } setSel(pp.domain); }}>
                <title>{`${pp.label}${pp.range ? ` : ${String(pp.range).split(":").pop()}` : ""} — ${nodes.find((x) => x.uri === pp.domain)?.label || pp.domain}의 data 속성 (클릭=클래스 패널)`}</title>
                <line x1={hp.x} y1={hp.y} x2={p.x} y2={p.y} stroke={PROP_COLOR} strokeOpacity={hostFoc ? 0.6 : 0.3} strokeWidth={1.1} />
                <circle cx={p.x} cy={p.y} r={PR} fill={PROP_COLOR + "24"} stroke={PROP_COLOR}
                  strokeOpacity={hostFoc ? 0.95 : 0.6} strokeWidth={1.2}
                  style={hostFoc ? { filter: `drop-shadow(0 0 8px ${PROP_COLOR}88)` } : undefined} />
                <text x={p.x} y={p.y + PR + 11} textAnchor="middle" fontSize="9" fontWeight="700"
                  fill="#c6d0e8" opacity={hostFoc ? 1 : 0.85} style={{ pointerEvents: "none" }}>{dispLabel(pp.label)}</text>
              </g>
            );
          })}
          {nodes.map((nn, i) => {
            const p = P(nn.uri); if (!p) return null;
            const t = Math.sqrt((deg[nn.uri] || 0) / maxDeg);   // degree 정규화(sqrt — 중간 연결도도 구분되게) — 계열 내 농도·글로우 세기
            const [bg, fg] = shades(nodeColor(nn.uri), t);
            const r = nodeR(), isSel = sel === nn.uri, isFoc = isSel || hover === nn.uri;
            // 모양 = 클래스는 전부 육각형(구분 없음) · 속성은 위성 원
            const fs = Math.max(9.5, Math.round(r * 0.34 * 10) / 10);   // 라벨 폰트 — 노드가 작아져도 가독 하한 유지
            const glowA = isFoc ? "cc" : Math.round(0x2e + t * 0x80).toString(16).padStart(2, "0");
            const coreStyle = { filter: `drop-shadow(0 0 ${isFoc ? 16 : 4 + Math.round(t * 14)}px ${fg}${glowA})` };
            const coreProps = { className: "og-core", stroke: fg, strokeOpacity: isFoc ? 1 : 0.55 + t * 0.45, strokeWidth: isFoc ? 2.8 : 1.2 + t * 2, style: coreStyle };
            return (
              <g key={nn.uri} className="og-node" transform={`translate(${p.x} ${p.y})`}
                style={{ cursor: drag === nn.uri ? "grabbing" : "grab" }}
                opacity={!chipOnClass(nn.uri) ? 0.12 : nodeDim(nn.uri) ? 0.16 : liveOn(nn.uri) ? 1 : 0.15}
                onMouseEnter={() => setHover(nn.uri)} onMouseLeave={() => setHover(null)}
                onMouseDown={(ev) => { ev.stopPropagation(); if (spaceDown) { startPan(ev); return; } movedRef.current = false; setDrag(nn.uri); sim.dragStart(nn.uri); }}
                onClick={(ev) => { ev.stopPropagation(); if (spaceDown || movedRef.current) { movedRef.current = false; return; } setSel(isSel ? null : nn.uri); }}>
                <title>{`${nn.label || nn.uri} · 관계 ${deg[nn.uri] || 0}개${top5.has(nn.uri) ? " · 핵심(연결 TOP 5)" : ""}`}</title>
                <motion.g {...nodePop(i, reduce)}>
                  {isSel && !reduce && (
                    <path d={hexPath(r)} fill="none" stroke={fg} strokeWidth={1.5}>
                      <animateTransform attributeName="transform" type="scale" values="1;1.55" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0" dur="1.5s" repeatCount="indefinite" />
                    </path>
                  )}
                  <path className="og-halo" d={hexPath(r + 7)} fill="none" stroke={fg}
                    strokeOpacity={isFoc ? 0.6 : 0.08 + t * 0.5} strokeWidth={1 + t * 1.2} style={{ animationDelay: `${(i % 7) * 0.45}s` }} />
                  {/* 클래스 = 육각형 + 채운 이너 코어(전 클래스 동일) */}
                  <path {...coreProps} d={hexPath(r)} fill={bg} />
                  <path d={hexPath(r * 0.46)} fill={fg} fillOpacity={0.5 + t * 0.4} style={{ pointerEvents: "none" }} />
                  {addMark(nn.uri) && (   /* 추가/연결 진행 중 — 파란 점선 링으로 대상 표시 */
                    <path d={hexPath(r + 11)} fill="none" stroke={ADD_COLOR} strokeWidth={2.2} strokeDasharray="6 4"
                      style={{ pointerEvents: "none", filter: `drop-shadow(0 0 8px ${ADD_COLOR}aa)` }} />
                  )}
                  {mergeCand === nn.uri && (   /* 노드 드래그로 겹쳐진 병합 대상 — 놓으면 병합 카드 */
                    <g style={{ pointerEvents: "none" }}>
                      <path d={hexPath(r + 11)} fill={ADD_COLOR + "22"} stroke={ADD_COLOR} strokeWidth={2.6} strokeDasharray="6 4"
                        style={{ filter: `drop-shadow(0 0 14px ${ADD_COLOR}cc)` }} />
                      <text y={-r - 18} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={ADD_COLOR}
                        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>여기에 놓아 병합</text>
                    </g>
                  )}
                  <text className="og-label" y={r + fs + 8} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#e9eef9">{dispLabel(nn.label || nn.uri)}</text>
                  {hover === nn.uri && !drag && !spaceDown && !linkDrag && (   /* 호버 시 우측 상단 + — 클릭=추가 카드 · 드래그=관계 연결 */
                    <g transform={`translate(${r * 0.95} ${-r * 0.95})`} style={{ cursor: "crosshair" }}
                      onMouseDown={(ev) => { ev.stopPropagation(); movedRef.current = false; const pt = toSvg(ev); setLinkDrag({ from: nn.uri, sx: pt.x, sy: pt.y, x: pt.x, y: pt.y, moved: false }); }}
                      onClick={(ev) => { ev.stopPropagation(); movedRef.current = false; }}>
                      <title>클릭=관계·속성 추가 카드 · 드래그=다른 노드로 관계 연결</title>
                      <circle r={10} fill={ADD_COLOR} stroke="#fff" strokeWidth={1.4} style={{ filter: `drop-shadow(0 0 6px ${ADD_COLOR}aa)` }} />
                      <path d="M -4.5 0 H 4.5 M 0 -4.5 V 4.5" stroke="#fff" strokeWidth={2} strokeLinecap="round" style={{ pointerEvents: "none" }} />
                    </g>
                  )}
                </motion.g>
              </g>
            );
          })}
          {/* 추가/연결 미리보기 — 카드에서 고른 출발→도착 예상 연결선(파란 점선) */}
          {pendRel && pendRel.domain !== pendRel.range && (() => {
            const s = P(pendRel.domain), t = P(pendRel.range);
            if (!s || !t) return null;
            const sc = clip(t, s, nodeR()), tc = clip(s, t, nodeR() + 8);
            const { d } = edgeGeom(sc, tc);
            return <path d={d} fill="none" stroke={ADD_COLOR} strokeWidth={2.4} strokeDasharray="7 5" markerEnd="url(#od-arr-add)" opacity={0.95} style={{ pointerEvents: "none" }} />;
          })()}
          {/* + 버튼 드래그 중 — 커서(또는 스냅된 대상 노드)까지 파란 연결선 */}
          {linkDrag && linkDrag.moved && (() => {
            const s = P(linkDrag.from);
            if (!s) return null;
            const tgt = hover && hover !== linkDrag.from ? P(hover) : null;
            const end = tgt ? clip(s, tgt, nodeR() + 8) : { x: linkDrag.x, y: linkDrag.y };
            const sc = clip(end, s, nodeR());
            return <path d={`M ${sc.x} ${sc.y} L ${end.x} ${end.y}`} fill="none" stroke={ADD_COLOR} strokeWidth={2.4} strokeDasharray="7 5" markerEnd="url(#od-arr-add)" style={{ pointerEvents: "none" }} />;
          })()}
        </svg>
      </div>
    </div>
  );
}

// Groups — 그룹을 만들고 클래스를 배정(배타적). 클래스의 group 필드는 멤버십에서 파생됨.
function GroupsPanel() {
  const { reload } = useDesign();
  const [groups, setGroups] = useState(null);
  const [classes, setClasses] = useState([]);
  const [rk, setRk] = useState(0);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2f6fd0");
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(null);   // 펼쳐서 클래스 고르는 그룹 id
  const [editing, setEditing] = useState(null);      // 이름 편집 중인 그룹 id
  const [editName, setEditName] = useState("");
  const [pickQ, setPickQ] = useState("");            // 클래스 선택기 검색어
  const openPicker = (gid) => { setExpanded(gid); setPickQ(""); };   // 펼칠 때 검색 초기화

  useEffect(() => {
    let alive = true;
    Promise.all([api.ontologyGroups(), api.ontologyView("entities")])
      .then(([g, e]) => { if (!alive) return; setGroups(g.groups || []); setClasses(e.entities || []); })
      .catch(() => { if (alive) { setGroups([]); setClasses([]); } });
    return () => { alive = false; };
  }, [rk]);

  const refresh = () => { setRk((k) => k + 1); reload(); };
  const create = () => {
    if (!newName.trim()) return;
    api.ontologyCreateGroup(newName.trim(), newColor).then((r) => {
      if (r.error) setErr(r.error); else { setNewName(""); setErr(null); refresh(); }
    });
  };
  const del = (g) => { if (window.confirm(`'${g.label}' 그룹을 삭제할까요? 소속 클래스는 미지정으로 돌아갑니다.`)) api.ontologyDeleteGroup(g.id).then(refresh); };
  const rename = (g) => { const nm = editName.trim(); setEditing(null); if (nm && nm !== g.label) api.ontologyUpdateGroup(g.id, nm).then(refresh); };
  const assign = (uri, gid) => api.ontologyAssignGroup(uri, gid).then(refresh);

  if (!groups) return <div style={{ color: "var(--muted)" }}>불러오는 중…</div>;
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const labelOf = (uri) => classes.find((c) => c.uri === uri)?.label || uri;
  const ungrouped = classes.filter((c) => (c.group || "default") === "default");
  const inp = { border: "1px solid var(--line2)", borderRadius: 8, padding: "8px 11px", fontSize: 13.5, fontFamily: "var(--sans)", background: "var(--app)", outline: "none" };
  const chip = (bg, bd) => ({ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: bg, border: `1px solid ${bd}`, borderRadius: 99, padding: "4px 6px 4px 11px" });

  // 그룹 카드에 펼쳐지는 클래스 선택기 — 검색으로 좁혀 상위 N개만 렌더(대량 클래스 대비).
  const PICK_CAP = 80;
  const classPicker = (g) => {
    const members = new Set(g.members || []);
    if (classes.length === 0) return <span style={{ fontSize: 12.5, color: "var(--muted)" }}>클래스가 없습니다.</span>;
    const q = pickQ.trim().toLowerCase();
    const matches = q
      ? classes.filter((c) => (c.label || "").toLowerCase().includes(q) || (c.uri || "").toLowerCase().includes(q))
      : classes;
    const shown = matches.slice(0, PICK_CAP);
    return (
      <div>
        <input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder={`클래스 검색… (총 ${classes.length}개)`}
          style={{ ...inp, width: "100%", maxWidth: 320, marginBottom: 10, boxSizing: "border-box" }} autoFocus />
        {matches.length === 0
          ? <div style={{ fontSize: 12.5, color: "var(--muted)" }}>“{pickQ}” 와 일치하는 클래스가 없습니다.</div>
          : (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 260, overflowY: "auto", padding: 2 }}>
              {shown.map((c) => {
                const inThis = members.has(c.uri);
                const otherId = c.group && c.group !== "default" && c.group !== g.id ? c.group : null;
                const otherG = otherId ? groupById[otherId] : null;
                return (
                  <button key={c.uri} onClick={() => assign(c.uri, inThis ? null : g.id)}
                    title={otherG ? `현재 '${otherG.label}' 그룹 · 클릭 시 이 그룹으로 이동` : inThis ? "클릭해 제외" : "클릭해 추가"}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                      whiteSpace: "nowrap", borderRadius: 99, padding: "6px 13px", height: "fit-content",
                      border: inThis ? `1.5px solid ${g.color}` : "1px solid var(--line2)",
                      background: inThis ? g.color + "22" : "var(--app)", color: inThis ? g.color : "var(--text)" }}>
                    {inThis && <span style={{ fontSize: 11 }}>✓</span>}
                    {c.label || c.uri}
                    {otherG && <span style={{ fontSize: 10.5, color: "var(--faint)", fontWeight: 500 }}>· {otherG.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        {matches.length > PICK_CAP && (
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>{matches.length}개 중 {PICK_CAP}개 표시 — 검색으로 좁혀주세요.</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 새 그룹 만들기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "var(--app)", border: "1px solid var(--line)", borderRadius: 12, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13.5, color: "var(--navy)" }}>새 그룹</b>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} title="그룹 색상"
          style={{ width: 34, height: 34, border: "1px solid var(--line2)", borderRadius: 8, background: "var(--app)", cursor: "pointer", padding: 2 }} />
        <input value={newName} onChange={(e) => { setNewName(e.target.value); setErr(null); }} placeholder="그룹 이름 (예: 계약)"
          onKeyDown={(e) => e.key === "Enter" && create()} style={{ ...inp, width: 240 }} />
        <button onClick={create} disabled={!newName.trim()}
          style={{ border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 18px", borderRadius: 9, cursor: "pointer", opacity: newName.trim() ? 1 : 0.5 }}>+ 만들기</button>
        {err && <span style={{ color: "#d64545", fontSize: 12.5, fontWeight: 600 }}>{err}</span>}
      </div>

      {/* 그룹별 멤버 관리 */}
      {groups.length === 0
        ? <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 12, padding: "28px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>아직 그룹이 없습니다. 위에서 그룹을 만들어 클래스를 담아보세요.</div>
        : groups.map((g) => {
          const members = g.members || [];
          const open = expanded === g.id, isEd = editing === g.id;
          return (
            <div key={g.id} style={{ background: "var(--app)", border: `1px solid ${open ? g.color : "var(--line)"}`, borderRadius: 12, padding: "12px 16px", transition: "border-color .12s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input type="color" value={g.color || "#5b6478"} onChange={(e) => api.ontologyUpdateGroup(g.id, null, e.target.value).then(refresh)} title="그룹 색상 변경"
                  style={{ width: 28, height: 28, border: "1px solid var(--line2)", borderRadius: 7, background: "var(--app)", cursor: "pointer", padding: 2, flexShrink: 0 }} />
                {isEd ? (
                  <input value={editName} autoFocus onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") rename(g); if (e.key === "Escape") setEditing(null); }}
                    onBlur={() => rename(g)} style={{ ...inp, width: 180, padding: "6px 10px" }} />
                ) : (
                  <div onClick={() => (open ? setExpanded(null) : openPicker(g.id))} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flex: 1, minWidth: 0 }}>
                    <span style={{ color: "var(--faint)", fontSize: 11, transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▶</span>
                    <b style={{ fontSize: 14.5, color: "var(--navy)" }}>{g.label}</b>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{members.length} classes</span>
                  </div>
                )}
                <span style={{ flex: isEd ? 1 : 0 }} />
                {iconBtn(IC.edit, "이름 수정", () => { setEditing(g.id); setEditName(g.label); setExpanded(null); }, "var(--blue-d)")}
                {iconBtn(IC.trash, "그룹 삭제", () => del(g), "#d64545")}
              </div>

              {/* 소속 클래스 요약(칩) — 많으면 상한만 표시 */}
              {members.length > 0 && (
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  {members.slice(0, 40).map((uri) => (
                    <span key={uri} style={chip(g.color + "22", g.color)}>
                      {labelOf(uri)}
                      <button onClick={() => assign(uri, null)} title="그룹에서 빼기"
                        style={{ border: "none", background: "transparent", color: g.color, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>×</button>
                    </span>
                  ))}
                  {members.length > 40 && <span onClick={() => openPicker(g.id)} style={{ fontSize: 12, color: "var(--blue-d)", cursor: "pointer", fontWeight: 600 }}>+{members.length - 40}개 더 · 펼쳐서 관리</span>}
                </div>
              )}

              {/* 펼치면 전체 클래스 선택기 */}
              {open && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 9 }}>클래스를 클릭해 이 그룹에 담거나 빼세요 (한 클래스는 한 그룹만).</div>
                  {classPicker(g)}
                </div>
              )}
              {members.length === 0 && !open && (
                <div onClick={() => openPicker(g.id)} style={{ marginTop: 8, fontSize: 12.5, color: "var(--blue-d)", cursor: "pointer", fontWeight: 600 }}>+ 클릭해 클래스 담기</div>
              )}
            </div>
          );
        })}

      {/* 미지정(default) 클래스 */}
      <div style={{ background: "var(--app)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: ungrouped.length ? 12 : 0 }}>
          <i style={{ width: 14, height: 14, borderRadius: 4, background: "#eef0f8", border: "2px solid #5b6478" }} />
          <b style={{ fontSize: 14, color: "var(--navy)" }}>미지정</b>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{ungrouped.length} classes</span>
        </div>
        {ungrouped.length === 0
          ? <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{classes.length === 0 ? "클래스가 없습니다." : "모든 클래스가 그룹에 배정되었습니다."}</span>
          : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxHeight: 300, overflowY: "auto" }}>
              {ungrouped.slice(0, 60).map((c) => (
                <span key={c.uri} style={chip("var(--main)", "var(--line2)")}>
                  {c.label || c.uri}
                  {groups.length > 0 && (
                    <select value="" onChange={(e) => e.target.value && assign(c.uri, e.target.value)} title="그룹에 배정"
                      style={{ border: "none", background: "transparent", color: "var(--blue-d)", cursor: "pointer", fontSize: 12, fontWeight: 700, outline: "none" }}>
                      <option value="">→ 그룹…</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  )}
                </span>
              ))}
              {ungrouped.length > 60 && <span style={{ fontSize: 12, color: "var(--faint)" }}>+{ungrouped.length - 60}개 더 — 그룹을 펼쳐 검색으로 배정하세요.</span>}
            </div>
          )}
      </div>
    </div>
  );
}

// Information 화면용 래퍼 — reload 를 붙여 IMPORT 직후 사이드바 badge·요약이 즉시 갱신된다.
function ProjectTransferSection() {
  const { reload } = useDesign();
  return <ProjectTransfer onDone={() => reload()} />;
}


export default function OntologyDesign({ screen, go }) {
  const tab = TABS[screen] || "Information";
  const listCfg = LIST_VIEWS[screen];

  if (tab === "Generate") return <GenPanel />;   // 고정 헤더 + 내부 스크롤 자체 레이아웃

  // Designer 만 그래프를 하단까지 채우는 flex 레이아웃(+하단 패딩 블리드). 나머지는 일반 스크롤.
  const isDesigner = tab === "Graph Design";
  const wrapStyle = isDesigner
    ? { padding: "28px 34px", overflowY: "auto", height: "calc(100% + 30px)", marginBottom: -30, display: "flex", flexDirection: "column" }
    : { padding: "28px 34px", overflowY: "auto", height: "100%" };

  return (
    <div style={wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: 0 }}>{tab === "Query" ? "Query" : `Ontology · ${tab}`}</h1>
      </div>
      <p style={{ color: "var(--text)", fontSize: 14, marginBottom: 24, flexShrink: 0 }}>{tab === "Query" ? "정형DB + 비정형 문서 통합 검증 — 파이프라인의 최종 단계" : `프로젝트별 온톨로지(T-Box) 설계 · ${tab}`}</p>

      {tab === "Information" ? (
        <>
          <PipelineNav go={go} />
          {/* 매핑 현황 — 엔티티/속성/관계별 소스 매핑 커버리지(정형 매핑 + 문서 실체화) */}
          <div style={{ margin: "24px 0 10px", fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>매핑 현황</div>
          <MappingCharts />
          {/* 환경 간 이전 — 로컬에서 만든 프로젝트를 다른 배포(ACA)에 그대로 올린다 */}
          <div style={{ margin: "26px 0 10px", fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>PROJECT EXPORT / IMPORT</div>
          <ProjectTransferSection />
        </>
      ) : tab === "Import" ? (
        <ImportPanel />
      ) : tab === "Graph Design" ? (
        <DesignerPanel />
      ) : tab === "Groups" ? (
        <GroupsPanel />
      ) : tab === "Query" ? (
        <QueryPanel />
      ) : listCfg ? (
        <ListTable cfg={listCfg} />
      ) : (
        <div style={{ background: "var(--app)", border: "1px dashed var(--line2)", borderRadius: 16, padding: "52px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{tab}</div>
          이 화면은 준비 중입니다 — 다음 슬라이스에서 구현됩니다.
        </div>
      )}
    </div>
  );
}
