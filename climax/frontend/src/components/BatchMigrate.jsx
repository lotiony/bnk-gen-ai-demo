import { useEffect, useState } from "react";
import { api } from "../api";
import { finishJob, JOB_SOURCE, setJob } from "../jobStore";
import ConversionMonitor from "./ConversionMonitor";
import { CATS, cat, blank, toResource } from "../lib/manifestRows.jsx";

// 카테고리 안내 호버 — 마우스오버 시 사용방법 툴팁 표시
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ width: 15, height: 15, borderRadius: "50%", border: "1px solid var(--line2)", color: "var(--muted)", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", cursor: "help", fontFamily: "var(--mono)" }}>i</span>
      {show && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 230, background: "var(--navy)", color: "#fff", fontSize: 11.5, lineHeight: 1.55, fontWeight: 500, padding: "10px 12px", borderRadius: 10, boxShadow: "0 12px 30px rgba(20,28,60,.38)", zIndex: 5 }}>{text}</span>
      )}
    </span>
  );
}

export default function BatchMigrate({ project, onClose, onComplete }) {
  const [rows, setRows] = useState([]);   // 등록된 리소스(카테고리 +추가로 채움)
  const [jobId, setJobId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Esc 로 팝업 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (type) => setRows((rs) => [...rs, blank(type)]);
  const delRow = (i) => setRows((rs) => rs.filter((_, j) => j !== i));

  const apply = async () => {
    const named = rows.filter((r) => r.name.trim());
    if (!named.length) return setErr("카테고리에서 리소스를 1개 이상 등록하세요");
    setBusy(true); setErr("");
    try {
      const manifest = { project: project.name, resources: named.map(toResource) };
      const d = await api.manifestApply(manifest, project.id);
      setJob(project.id, d.jobId, JOB_SOURCE.MIGRATION);   // 카드 진행링 유지용 등록
      setJobId(d.jobId);
    } catch (e) { setErr(String(e.message)); } finally { setBusy(false); }
  };

  if (jobId) return <ConversionMonitor jobId={jobId} projectName={project.name}
    onClose={() => { onClose(); onComplete?.(); }}
    onDone={(result) => {
      finishJob(project.id, jobId, result?.missing ? "missing" : result?.status);
      onComplete?.();
    }} />;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,28,60,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99, padding: 24 }}>
      <div style={{ width: 660, maxWidth: "100%", maxHeight: "90vh", background: "var(--card)", borderRadius: 22, boxShadow: "0 34px 80px rgba(28,38,90,.32)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "popIn .22s ease-out" }}>
        {/* 헤더 — 기능 타이틀만 (프로젝트명 미표기) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ flex: 1 }}><b style={{ fontSize: 16, fontWeight: 800 }}>리소스 일괄 변환</b>
            <small style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 2 }}>레거시 리소스를 MCP/VectorDB로 한번에 마이그레이션</small></div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 9, background: "var(--main)", border: "none", cursor: "pointer", color: "var(--muted)" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 안내 박스 */}
          <div style={{ display: "flex", gap: 10, background: "var(--blue-bg)", border: "1px solid #bce9e4", borderRadius: 13, padding: "12px 14px" }}>
            <span style={{ color: "var(--blue-d)", flexShrink: 0, marginTop: 1 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
            </span>
            <div style={{ fontSize: 12.5, color: "var(--navy)", lineHeight: 1.55 }}>
              변환할 리소스 종류를 아래 카테고리에서 고르세요. <b>＋추가</b>를 누르면 해당 리소스의 정보를 입력하는 칸이 생깁니다.
              여러 종류를 함께 등록한 뒤 <b>일괄 변환 실행</b>으로 한번에 마이그레이션합니다. 각 카테고리의 <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>ⓘ</span>에 마우스를 올리면 사용 방법을 볼 수 있습니다.
            </div>
          </div>

          {/* 카테고리 팔레트 — 변환 가능한 종류 미리보기 + 카테고리별 +추가 */}
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>변환 카테고리</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {CATS.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line2)", borderRadius: 13, padding: "11px 12px", background: "var(--card)" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.label}</b>
                      <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: c.target === "vectordb" ? "var(--amber)" : "var(--blue)", background: c.target === "vectordb" ? "var(--amber-bg)" : "var(--blue-bg)", padding: "2px 6px", borderRadius: 6 }}>{c.tLabel}</span>
                      <InfoTip text={c.hint} />
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.desc}</div>
                  </div>
                  <button onClick={() => addRow(c.id)} style={{ flexShrink: 0, border: "none", borderRadius: 9, padding: "7px 12px", background: c.color, color: "#fff", fontWeight: 800, fontSize: 11.5, cursor: "pointer", boxShadow: "0 4px 10px " + c.bg }}>＋ 추가</button>
                </div>
              ))}
            </div>
          </div>

          {/* 등록된 리소스 */}
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>등록된 리소스 {rows.length > 0 && `· ${rows.length}`}</div>
            {rows.length === 0 ? (
              <div style={{ border: "1.5px dashed var(--line2)", borderRadius: 13, padding: "22px 14px", textAlign: "center", fontSize: 12.5, color: "var(--muted)" }}>
                위 카테고리에서 <b>＋추가</b>를 눌러 변환할 리소스를 등록하세요.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rows.map((r, i) => {
                  const c = cat(r.type);
                  return (
                    <div key={i} style={{ border: "1px solid var(--line2)", borderRadius: 14, padding: "14px 15px", background: "var(--main)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 7, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.icon}</span>
                        <b style={{ fontSize: 12.5, color: "var(--navy)" }}>{c.label}</b>
                        <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: r.target === "vectordb" ? "var(--amber)" : "var(--blue)", background: r.target === "vectordb" ? "var(--amber-bg)" : "var(--blue-bg)", padding: "2px 6px", borderRadius: 6 }}>→ {c.tLabel}</span>
                        <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="리소스 이름 (예: tools-server)" style={{ ...inp, flex: 1, marginLeft: 4 }} />
                        <button onClick={() => delRow(i)} style={delBtn}>✕</button>
                      </div>
                      {r.type === "openapi" && <>
                        <input value={r.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="http://svc/openapi.json" style={inp} />
                        <input value={r.auth_value} onChange={(e) => set(i, { auth_value: e.target.value })} placeholder="Authorization (선택, 예: Bearer ${env:TOK})" style={{ ...inp, marginTop: 8 }} /></>}
                      {r.type === "db" && <div style={{ display: "flex", gap: 8 }}>
                        <select value={r.driver} onChange={(e) => set(i, { driver: e.target.value })} style={{ ...sel, width: 130 }}>{["postgres", "mysql", "oracle", "mongo"].map((d) => <option key={d}>{d}</option>)}</select>
                        <input value={r.dsn} onChange={(e) => set(i, { dsn: e.target.value })} placeholder="dsn (예: ${vault:db#dsn})" style={{ ...inp, flex: 1 }} /></div>}
                      {r.type === "document" && <input value={r.path} onChange={(e) => set(i, { path: e.target.value })} placeholder="/srv/docs/**/*.pdf (glob)" style={inp} />}
                      {r.type === "system" && <div style={{ display: "flex", gap: 8 }}>
                        <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value })} style={{ ...sel, width: 140 }}>{["sap-odata", "sap-rfc", "rest"].map((k) => <option key={k}>{k}</option>)}</select>
                        <input value={r.endpoint} onChange={(e) => set(i, { endpoint: e.target.value })} placeholder="https://sap.corp/odata" style={{ ...inp, flex: 1 }} /></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {err && <div style={{ color: "var(--red)", fontSize: 12 }}>⚠ {err}</div>}
        </div>

        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ padding: "10px 17px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--line2)", background: "var(--card)", color: "var(--text)" }}>취소</button>
          <button onClick={apply} disabled={busy} style={{ padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer", border: "none", background: "var(--amber)", color: "#fff", boxShadow: "0 8px 18px rgba(232,132,30,.25)", display: "inline-flex", alignItems: "center", gap: 7 }}>
            {!busy && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>}
            {busy ? "시작 중…" : "일괄 변환 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = { width: "100%", border: "1px solid var(--line2)", borderRadius: 10, padding: "9px 12px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--navy)", outline: "none", background: "var(--card)" };
const sel = { ...inp, width: 220, cursor: "pointer" };
const delBtn = { width: 30, height: 30, flexShrink: 0, border: "1px solid var(--line2)", borderRadius: 9, background: "var(--card)", color: "var(--muted)", cursor: "pointer" };
