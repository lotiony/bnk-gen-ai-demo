/**
 * DATA RESOURCE › Database — 연결된 레거시 DB를 골라 목적을 설명하면 MCP tool 설계안을 받는다.
 *
 * 흐름: 왼쪽에서 DB 선택 → ① 스키마에서 범위 좁히기 → ② 목적을 말로 설명 → ③ 설계안 검토 후 생성.
 * 설계안은 초안일 뿐이며, 체크 + [생성] 을 눌러야 비로소 MCP 로 등록된다(자동 등록 없음).
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { DB_DRIVERS, composeDsn } from "../lib/manifestRows";
import { useProjects } from "../ProjectContext";
import ResourceWorkbench, { Btn, StepHead, inp, lab, panel, useAsync } from "../components/ResourceWorkbench";

const ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5v13c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8v-13" /><path d="M4 12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8" />
  </svg>
);

const EXAMPLES = ["고객별 계약 조회", "월별 청구 합계", "미납 계약 추출", "상품별 계약 건수"];

export default function DbResource({ lang }) {
  const ko = lang !== "en";
  const { activeId } = useProjects();
  const list = useAsync(() => api.dbSources(), [activeId]);
  const sources = list.data?.sources || [];

  const [sid, setSid] = useState(null);
  const [picked, setPicked] = useState(new Set());     // 범위를 좁힐 테이블
  const [expanded, setExpanded] = useState(new Set()); // 컬럼까지 펼친 테이블
  const [intent, setIntent] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [busy, setBusy] = useState("");                // "design" | "create" | "auto"
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [preview, setPreview] = useState(null);        // {name, rows} dry-run 결과

  // 목록이 오면 첫 소스를 자동 선택 — 대부분 한두 개라 매번 고르게 하는 건 군더더기다.
  useEffect(() => {
    if (!sid && sources.length) setSid(sources[0].id);
  }, [sources, sid]);

  const selected = sources.find((s) => s.id === sid) || null;
  const schema = useAsync(
    () => (sid ? api.dbSchema(sid, [...expanded]) : Promise.resolve(null)),
    [sid, [...expanded].sort().join(",")],
  );
  const tables = schema.data?.tables || [];

  const reset = () => { setPicked(new Set()); setExpanded(new Set()); setDrafts(null); setErr(""); setDone(""); setPreview(null); };
  const toggle = (set, key) => { const n = new Set(set); n.has(key) ? n.delete(key) : n.add(key); return n; };

  const runDesign = async () => {
    setBusy("design"); setErr(""); setDone(""); setDrafts(null);
    try {
      const out = await api.dbDesign(sid, { intent, tables: [...picked] });
      // 유효한 초안만 기본 체크 — 검증 실패한 초안은 사유를 보여주되 고를 수 없게 한다.
      setDrafts((out.drafts || []).map((d) => ({ ...d, checked: !!d.valid })));
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  };

  const runDryRun = async (d) => {
    setErr(""); setPreview(null);
    try {
      const out = await api.dbDryRun(sid, { statement: d.statement, params: {} });
      setPreview({ name: d.name, rows: out.rows, count: out.count });
    } catch (e) { setErr(`${d.name}: ${e.message || e}`); }
  };

  const create = async () => {
    const chosen = (drafts || []).filter((d) => d.checked && d.valid);
    setBusy("create"); setErr("");
    try {
      const out = await api.dbCreateTools(sid, chosen.map(({ name, description, params, statement }) => ({ name, description, params, statement })));
      setDone(ko ? `${out.added.length}개 tool 을 MCP 로 등록했습니다.` : `${out.added.length} tools registered.`);
      setDrafts(null); setIntent("");
      list.reload();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  };

  const autoTools = async () => {
    setBusy("auto"); setErr(""); setDone("");
    try {
      const out = await api.dbAutoTools(sid, [...picked]);
      setDone(ko ? `테이블 ${out.discovered}개에서 ${out.added.length}개 tool 자동생성 완료.`
                 : `${out.added.length} tools from ${out.discovered} tables.`);
      list.reload();
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  };

  const nChecked = (drafts || []).filter((d) => d.checked && d.valid).length;

  return (
    <ResourceWorkbench
      ko={ko} icon={ICON}
      title={ko ? "Database" : "Database"}
      subtitle={ko ? "연결된 레거시 DB를 골라 목적에 맞는 MCP tool 을 설계·생성합니다."
                   : "Pick a legacy database and design MCP tools for your purpose."}
      count={ko ? `연결된 DB ${sources.length}` : `${sources.length} databases`}
      sources={sources} loading={list.loading} error={list.error}
      selectedId={sid} onSelect={(id) => { setSid(id); reset(); }}
      onDelete={async (s) => {
        if (!window.confirm(ko ? `${s.name} 연결을 목록에서 제거할까요? (이미 변환된 MCP 는 남습니다)` : `Remove ${s.name}?`)) return;
        await api.deleteDbSource(s.id);
        if (s.id === sid) { setSid(null); reset(); }
        list.reload();
      }}
      meta={(s) => [s.config?.driver || s.config?.dialect, s.config?.dsn].filter(Boolean).join(" · ")}
      addLabel={ko ? "DB 연결 추가" : "Add database"}
      addForm={(close) => <AddDbForm ko={ko} onDone={() => { close(); list.reload(); }} onCancel={close} />}
      emptyTitle={ko ? "연결된 레거시 DB가 없습니다" : "No database connected"}
      emptyHint={ko ? "온보딩에서 등록한 DB가 여기 나타납니다. 지금 바로 붙이려면 왼쪽의 [DB 연결 추가] 를 사용하세요."
                    : "Databases registered during onboarding appear here."}
    >
      {/* ① 스키마 */}
      <div style={panel}>
        <StepHead n="1" title={ko ? "스키마" : "Schema"}
          hint={ko ? "범위를 좁히려면 체크 (비우면 전체에서 고릅니다)" : "Check to narrow the scope"}
          right={<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {schema.loading ? (ko ? "읽는 중…" : "loading…") : `${tables.length} tables`}
          </span>} />
        {schema.error && <div style={{ fontSize: 12, color: "var(--red)" }}>{schema.error}</div>}
        <div style={{ maxHeight: 230, overflowY: "auto", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.9 }}>
          {tables.map((t) => (
            <div key={t.name}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={picked.has(t.name)} onChange={() => setPicked((p) => toggle(p, t.name))} />
                <span style={{ color: "var(--violet, #7a5cff)", fontWeight: 700 }}>{t.name}</span>
                {t.comment && <span style={{ color: "var(--muted)" }}>— {t.comment}</span>}
                <span onClick={(e) => { e.preventDefault(); setExpanded((x) => toggle(x, t.name)); }}
                  style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", textDecoration: "underline" }}>
                  {expanded.has(t.name) ? (ko ? "접기" : "hide") : (ko ? "컬럼" : "columns")}
                </span>
              </label>
              {expanded.has(t.name) && (
                <div style={{ paddingLeft: 22, color: "var(--muted)", fontSize: 10.5, lineHeight: 1.75 }}>
                  {(t.columns || []).map((c) => (
                    <span key={c.name} style={{ marginRight: 10 }}>
                      {c.name}:{c.type}
                      {(t.pk || []).includes(c.name) && <b style={{ color: "var(--amber)" }}> PK</b>}
                      {c.fk && <b style={{ color: "var(--blue)" }}> →{c.fk}</b>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ② 의도 */}
      <div style={panel}>
        <StepHead n="2" title={ko ? "어떤 MCP를 만들까요?" : "What should the tool do?"} />
        <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3}
          placeholder={ko ? "예: 고객 등급별로 계약 현황을 보고 싶어. 특정 고객의 계약 목록과 상품별 건수 집계가 필요해."
                          : "e.g. I want contract status by customer grade…"}
          style={{ ...inp, fontFamily: "var(--sans)", fontSize: 13, resize: "vertical", lineHeight: 1.6 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {EXAMPLES.map((x) => (
            <span key={x} onClick={() => setIntent((v) => (v ? `${v} ${x}` : x))}
              style={{ fontSize: 10.5, background: "var(--main)", color: "var(--muted)", padding: "3px 10px", borderRadius: 20, cursor: "pointer" }}>{x}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Btn tone="pri" onClick={runDesign} disabled={!intent.trim() || !!busy}>
            {busy === "design" ? (ko ? "설계 중…" : "Designing…") : (ko ? "설계안 생성 →" : "Design →")}
          </Btn>
          <Btn onClick={autoTools} disabled={!!busy}
            title={ko ? "의도 없이 테이블마다 목록/단건 조회 tool 을 기계적으로 만듭니다" : "Generate list/get tools per table"}>
            {busy === "auto" ? (ko ? "생성 중…" : "Working…") : (ko ? "테이블 기본 tool 자동생성 (list/get)" : "Auto list/get tools")}
          </Btn>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12, color: "var(--red)", lineHeight: 1.6 }}>⚠ {err}</div>}
        {done && <div style={{ marginTop: 10, fontSize: 12, color: "var(--green)", fontWeight: 700 }}>✓ {done}</div>}
      </div>

      {/* ③ 설계안 */}
      {drafts && (
        <div style={panel}>
          <StepHead n="3" title={ko ? "AI 설계안" : "Drafts"}
            hint={ko ? "등록은 사람이 승인해야 진행됩니다" : "Nothing is registered until you approve"}
            right={<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{drafts.length} draft</span>} />
          {drafts.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{ko ? "설계안을 만들지 못했습니다. 목적을 조금 더 구체적으로 적어보세요." : "No draft produced."}</div>}
          {drafts.map((d, i) => (
            <DraftCard key={d.name + i} d={d} ko={ko}
              onToggle={() => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
              onEdit={(statement) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, statement } : x)))}
              onDryRun={() => runDryRun(d)}
              preview={preview?.name === d.name ? preview : null} />
          ))}
          {drafts.length > 0 && (
            <Btn tone="pri" onClick={create} disabled={!nChecked || !!busy}
              style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "12px" }}>
              {busy === "create" ? (ko ? "등록 중…" : "Registering…")
                : nChecked ? (ko ? `선택한 ${nChecked}개 tool 생성 → MCP 등록` : `Create ${nChecked} tools`)
                  : (ko ? "생성할 tool 을 선택하세요" : "Select tools to create")}
            </Btn>
          )}
        </div>
      )}
    </ResourceWorkbench>
  );
}

function DraftCard({ d, ko, onToggle, onEdit, onDryRun, preview }) {
  const [editing, setEditing] = useState(false);
  const bad = !d.valid;
  return (
    <div style={{ border: `1px solid ${bad ? "#f0c7c3" : "var(--line2)"}`, background: bad ? "var(--red-bg)" : "var(--card)",
      borderRadius: 12, padding: "11px 13px", marginBottom: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={!!d.checked} disabled={bad} onChange={onToggle} />
        <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: bad ? "var(--red)" : "var(--navy)" }}>{d.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
          color: bad ? "var(--red)" : "var(--green)", background: bad ? "#fbe3e1" : "var(--green-bg)" }}>
          {bad ? (ko ? "검증 실패" : "INVALID") : "READ-ONLY"}
        </span>
      </div>
      {d.description && <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "5px 0 7px" }}>{d.description}</div>}
      {bad && (
        <ul style={{ margin: "4px 0 8px", paddingLeft: 18, fontSize: 11.5, color: "var(--red)" }}>
          {d.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {editing ? (
        <textarea value={d.statement} onChange={(e) => onEdit(e.target.value)} rows={5}
          style={{ ...inp, fontSize: 11, lineHeight: 1.6, resize: "vertical" }} />
      ) : (
        <pre style={{ margin: 0, background: "var(--code)", color: "var(--code-text)", borderRadius: 9,
          padding: "9px 11px", fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.65, overflowX: "auto" }}>{d.statement}</pre>
      )}
      {d.rationale && <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>근거 · {d.rationale}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <Btn onClick={() => setEditing((v) => !v)} style={{ padding: "5px 10px", fontSize: 10.5 }}>
          {editing ? (ko ? "편집 완료" : "Done") : (ko ? "SQL 편집" : "Edit SQL")}
        </Btn>
        <Btn onClick={onDryRun} style={{ padding: "5px 10px", fontSize: 10.5 }}>{ko ? "미리 실행 (5행)" : "Dry-run"}</Btn>
      </div>
      {preview && (
        <div style={{ marginTop: 8, background: "var(--main)", borderRadius: 9, padding: "8px 10px", overflowX: "auto" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{preview.count} rows</div>
          <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: 1.6, color: "var(--text)" }}>
            {JSON.stringify(preview.rows, null, 1)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * 개별 DB 추가 — 온보딩(대량 이관)과 달리 탐색이 없다. 주소와 계정을 아는 사람이 빠뜨린
 * 한 건을 끼워 넣는 폼이라, 대신 "그 자리에서 연결됐는지" 를 즉시 알려주는 데 집중한다.
 * DSN 합성 규칙은 온보딩과 같은 composeDsn 을 쓴다(규칙이 갈리면 재변환 교체가 깨진다).
 */
function AddDbForm({ ko, onDone, onCancel }) {
  const [f, setF] = useState({
    name: "", driver: "postgres", mode: "simple",
    hostDb: "", user: "", secret: "", dsn: "", tables: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checked, setChecked] = useState(null);   // {tables, dialect, sample}

  const set = (patch) => { setF((v) => ({ ...v, ...patch })); setChecked(null); setErr(""); };
  const dsn = f.mode === "simple" ? composeDsn(f.driver, f.hostDb, f.user, f.secret) : f.dsn.trim();
  const tables = f.tables.split(",").map((s) => s.trim()).filter(Boolean);
  const ready = f.mode === "simple" ? !!f.hostDb.trim() : !!f.dsn.trim();

  const run = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); } };
  const check = () => run(async () => setChecked(await api.checkDbSource({ ...f, dsn, tables })));
  const submit = () => run(async () => {
    await api.createDbSource({ name: f.name.trim(), driver: f.driver, dsn, tables, convert: false });
    onDone();
  });

  return (
    <div>
      <label className="mono" style={lab}>{ko ? "이름 (tool 접두어)" : "name"}</label>
      <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="hanwha" style={inp} />

      <label className="mono" style={{ ...lab, marginTop: 9 }}>{ko ? "엔진" : "Engine"}</label>
      <select value={f.driver} onChange={(e) => set({ driver: e.target.value })} style={inp}>
        {DB_DRIVERS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>

      <div style={{ display: "flex", gap: 4, marginTop: 10, marginBottom: 8 }}>
        {[["simple", ko ? "간편 입력" : "Simple"], ["dsn", ko ? "DSN 직접" : "Raw DSN"]].map(([m, label]) => (
          <button key={m} onClick={() => set({ mode: m })}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "var(--sans)",
              border: `1px solid ${f.mode === m ? "var(--blue)" : "var(--line2)"}`,
              background: f.mode === m ? "var(--blue-bg)" : "var(--card)",
              color: f.mode === m ? "var(--blue)" : "var(--muted)" }}>{label}</button>
        ))}
      </div>

      {f.mode === "simple" ? (
        <>
          <label className="mono" style={lab}>{ko ? "호스트 / DB" : "host / db"}</label>
          <input value={f.hostDb} onChange={(e) => set({ hostDb: e.target.value })}
            placeholder="10.60.1.22:5432/policy_db" style={inp} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="mono" style={lab}>{ko ? "읽기전용 계정" : "user"}</label>
              <input value={f.user} onChange={(e) => set({ user: e.target.value })} placeholder="ro_user" style={inp} />
            </div>
            <div style={{ flex: 1.3 }}>
              <label className="mono" style={lab}>{ko ? "비밀번호 참조" : "secret ref"}</label>
              <input value={f.secret} onChange={(e) => set({ secret: e.target.value })}
                placeholder="${vault:db#password}" style={inp} />
            </div>
          </div>
        </>
      ) : (
        <>
          <label className="mono" style={lab}>DSN</label>
          <input value={f.dsn} onChange={(e) => set({ dsn: e.target.value })}
            placeholder="${env:HANWHA_DB_DSN}" style={inp} />
        </>
      )}

      <label className="mono" style={{ ...lab, marginTop: 9 }}>
        {ko ? "테이블 필터 (선택 · 비우면 전체)" : "tables (optional)"}
      </label>
      <input value={f.tables} onChange={(e) => set({ tables: e.target.value })}
        placeholder="customers, contracts" style={inp} />

      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
        {ko ? "비밀번호는 ${env:...} · ${vault:...} 참조로만 저장됩니다. 평문을 넣으면 등록이 거부됩니다."
            : "Secrets must be ${env:...} / ${vault:...} references — plaintext is rejected."}
      </div>

      {checked && (
        <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 8, lineHeight: 1.6 }}>
          ✓ {ko ? `연결됨 · ${checked.dialect} · 테이블 ${checked.tables}개` : `${checked.tables} tables`}
          {checked.sample?.length ? <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{checked.sample.join(", ")}…</div> : null}
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 8, lineHeight: 1.5 }}>⚠ {err}</div>}

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <Btn onClick={check} disabled={busy || !ready}>
          {busy ? (ko ? "확인 중…" : "…") : (ko ? "연결 확인" : "Check")}
        </Btn>
        <Btn tone="pri" onClick={submit} disabled={busy || !ready || !f.name.trim()}>
          {ko ? "추가" : "Add"}
        </Btn>
        <Btn onClick={onCancel}>{ko ? "취소" : "Cancel"}</Btn>
      </div>
    </div>
  );
}
