import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import ConversionMonitor from "../components/ConversionMonitor";
import { caps, mono, hairline, panel, term, btn, stCol, Dot } from "../ui/flat";

// Conversion Health — emberlink 개발자 전용 변환 검증 화면.
// 프로젝트 리스트 → 클릭 → [좌: 전체/클라우드/온프렘 탭 + 리소스 목록] [우: 원천→IR→최종 + warnings]
// 스타일: 플랫 패널 + 헤어라인 (v5 목업), 색상 토큰은 앱 공용 CSS 변수.

const TY = { api: ["API", "var(--blue)"], db: ["DB", "var(--amber)"], doc: ["비정형", "#9b8cf6"] };
const ENV_LABEL = { cloud: "CLOUD", onprem: "ON-PREM" };

// 리소스 최악 상태 (classify + smoke)
const worstOf = (r) => {
  if (r.classify.failed || r.smoke.failed || r.apply_state === "fail" || !r.registered) return "fail";
  if (r.classify.warning || r.smoke.warned || r.apply_state === "warn") return "warn";
  return "ok";
};

function Code({ obj, text }) {
  return <pre style={term}>{text ?? JSON.stringify(obj, null, 2)}</pre>;
}

/* ─── 프로젝트 리스트 ─── */
function ProjectList({ projects, healthMap, onOpen }) {
  const grid = { display: "grid", gridTemplateColumns: "minmax(240px,1.1fr) 1.2fr 150px 170px", gap: 20, alignItems: "center", padding: "12px 20px" };
  const envRow = (h, env) => {
    const rs = (h?.resources || []).filter((r) => (r.env ?? null) === env || (env === "onprem" && r.env == null));
    if (!rs.length) return null;
    const byTy = {};
    rs.forEach((r) => { (byTy[r.rtype] ||= { ok: 0, total: 0 }).total += 1; if (r.registered > 0) byTy[r.rtype].ok += 1; });
    return (
      <>
        <span style={{ ...caps, fontSize: 8.5, color: "var(--faint)" }}>{env === "cloud" ? "CLOUD" : "ON-PREM"}</span>
        <span style={{ display: "flex", gap: 14 }}>
          {Object.entries(byTy).map(([ty, c]) => (
            <span key={ty} style={mono({ fontSize: 10.5, fontWeight: 600, color: c.ok < c.total ? "var(--red)" : TY[ty][1] })}>
              {TY[ty][0]} {c.ok}/{c.total}
            </span>
          ))}
        </span>
      </>
    );
  };
  return (
    <div style={panel}>
      <div style={{ ...grid, borderBottom: "1px solid var(--line2)", paddingTop: 13, paddingBottom: 9 }}>
        <span style={caps}>프로젝트</span><span style={caps}>원천 구성 — 환경 · 타입별 변환/총</span>
        <span style={{ ...caps, textAlign: "right" }}>변환 op</span><span style={caps}>호출 검증 (스모크)</span>
      </div>
      {projects.map((p) => {
        const h = healthMap[p.id];
        const smokeFail = (h?.resources || []).reduce((s, r) => s + r.smoke.failed, 0);
        const smokeTotal = (h?.resources || []).reduce((s, r) => s + r.smoke.total, 0);
        return (
          <div key={p.id} style={{ ...grid, borderBottom: hairline, cursor: "pointer" }} onClick={() => onOpen(p.id)}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--main)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <div>
              <b style={{ fontSize: 13, fontWeight: 600 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2.5, background: p.color, display: "inline-block", marginRight: 9, verticalAlign: 1 }} />{p.name}
              </b>
              <small style={mono({ display: "block", fontSize: 9.5, color: "var(--muted)", marginTop: 3 })}>
                {p.owner || "-"} · 리소스 {h ? h.resources.length : "…"}{h?.apply_at ? ` · apply ${h.apply_at.slice(11, 16)}` : ""}
              </small>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "2px 12px", alignItems: "baseline" }}>
              {envRow(h, "cloud")}{envRow(h, "onprem")}
            </div>
            <div style={mono({ fontSize: 11.5, fontWeight: 600, textAlign: "right" })}>
              <span style={{ color: "var(--green)" }}>{p.converted}</span> · <span style={{ color: "var(--amber)" }}>{p.warning}</span> · <span style={{ color: "var(--red)" }}>{p.failed}</span>
              <small style={{ display: "block", fontSize: 9.5, color: "var(--faint)", fontWeight: 400, marginTop: 2 }}>{p.resource_count} op</small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {smokeTotal
                ? <><Dot st={smokeFail ? "fail" : "ok"} /><span style={mono({ fontSize: 10.5, fontWeight: 700, color: smokeFail ? "var(--red)" : "var(--green)" })}>{smokeFail ? `${smokeFail} FAIL` : "ALL PASS"}</span><small style={mono({ fontSize: 9.5, color: "var(--muted)" })}>{smokeTotal - smokeFail}/{smokeTotal}{h?.smoke_at ? ` · ${h.smoke_at.slice(11, 16)}` : ""}</small></>
                : <small style={mono({ fontSize: 9.5, color: "var(--muted)" })}>미실행</small>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 리소스 상세 (우측) ─── */
function ResourceDetail({ pid, r, onJob }) {
  const [opId, setOpId] = useState(null);
  const [desc, setDesc] = useState(null);
  const [descErr, setDescErr] = useState(null);   // null=로딩/성공 구분용 (실패 시 메시지)
  const ops = r.ops || [];
  const sel = opId && ops.some((o) => o.tool_id === opId) ? opId : ops[0]?.tool_id;

  useEffect(() => {
    setDesc(null); setDescErr(null);
    if (!sel) return;
    let alive = true;
    // pid 명시 필수 — 전역 활성 프로젝트가 아니라 이 화면이 보는 프로젝트로 조회
    api.describe(sel, pid)
      .then((d) => { if (alive) setDesc(d); })
      .catch((e) => { if (alive) setDescErr(e.message || "명세를 불러오지 못했습니다"); });
    return () => { alive = false; };
  }, [sel, pid, r.name]);

  const [tyTxt, tyColor] = TY[r.rtype] || TY.api;
  const warns = [
    ...(!r.registered && r.mtype ? [["fail", r.name, r.apply_detail || `${r.mtype} 어댑터 미지원 또는 변환 실패 — 등록된 MCP 없음`]] : []),
    ...ops.flatMap((o) => (o.issues || []).map((i) => [i.level === "fail" ? "fail" : "warn", o.tool_id, i.msg])),
    ...ops.filter((o) => o.smoke && o.smoke.state !== "done").map((o) => [o.smoke.state === "fail" ? "fail" : "warn", o.tool_id, `smoke — ${o.smoke.detail}`]),
  ];
  const cell = { padding: "12px 18px", borderRight: hairline };
  const cellLabel = { ...caps, fontSize: 8.5, color: "var(--faint)", display: "block" };
  const cellVal = (color) => mono({ display: "block", fontSize: 13, fontWeight: 600, marginTop: 5, color: color || "var(--navy)" });
  const smokeSummary = r.smoke.total ? `${r.smoke.passed} PASS · ${r.smoke.warned} WARN · ${r.smoke.failed} FAIL` : "미실행";
  const colH = (no, tt, right) => (
    <h4 style={{ margin: "0 0 10px", display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={mono({ fontSize: 9.5, fontWeight: 700, color: "var(--blue)" })}>{no}</span>
      <span style={caps}>{tt}</span>
      <span style={{ ...mono({ fontSize: 9 }), marginLeft: "auto", color: "var(--faint)" }}>{right}</span>
    </h4>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 22px", borderBottom: "1px solid var(--line2)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.name}
            <span style={mono({ fontSize: 9.5, fontWeight: 700, color: tyColor, marginLeft: 9 })}>{tyTxt}</span>
            <span style={{ ...mono({ fontSize: 9, fontWeight: 700, letterSpacing: ".09em" }), color: "var(--muted)", border: "1px solid var(--line2)", borderRadius: 6, padding: "3px 8px", marginLeft: 8 }}>
              {ENV_LABEL[r.env] || "미분류"}
            </span>
          </h2>
          <div style={mono({ fontSize: 10, color: "var(--muted)", marginTop: 4 })}>
            {r.meta || r.source_kind}{r.mtype ? ` · ${r.mtype} → ${r.target}` : ""}
          </div>
        </div>
        <button style={btn()} onClick={() => api.reapply(pid, r.name).then((d) => onJob(d.jobId, "재변환")).catch((e) => alert(e.message))}>재변환</button>
        <button style={btn(true)} onClick={() => api.smokeRun(pid, r.name).then((d) => onJob(d.jobId, "스모크 검증")).catch((e) => alert(e.message))}>스모크 실행</button>
      </div>

      {/* 단계 스트립 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", borderBottom: "1px solid var(--line2)" }}>
        <div style={cell}><span style={cellLabel}>수집</span><b style={cellVal()}>{r.collected}</b></div>
        <div style={cell}><span style={cellLabel}>변환 (성공·경고·실패)</span>
          <b style={cellVal(r.classify.failed ? "var(--red)" : r.classify.warning ? "var(--amber)" : "var(--navy)")}>
            {r.classify.success} · {r.classify.warning} · {r.classify.failed}</b></div>
        <div style={cell}><span style={cellLabel}>등록 (활성/전체)</span><b style={cellVal(!r.registered ? "var(--red)" : "var(--navy)")}>{r.enabled}/{r.registered}</b></div>
        <div style={cell}><span style={cellLabel}>완료 결과</span><b style={cellVal()}>{r.target === "vectordb" ? "VectorDB" : `MCP ${r.registered} tools`}</b></div>
        <div style={{ ...cell, borderRight: "none" }}><span style={cellLabel}>호출 검증 (smoke)</span>
          <b style={cellVal(r.smoke.failed ? "var(--red)" : r.smoke.warned ? "var(--amber)" : r.smoke.total ? "var(--green)" : "var(--muted)")}>{smokeSummary}</b></div>
      </div>

      {/* 원천 → IR → 최종 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", borderBottom: hairline }}>
        <span style={caps}>대표 OP</span>
        <select value={sel || ""} onChange={(e) => setOpId(e.target.value)}
          style={{ ...mono({ fontSize: 11 }), background: "var(--main)", color: "var(--navy)", border: "1px solid var(--line2)", borderRadius: 8, padding: "6px 10px", maxWidth: 360 }}>
          {ops.map((o) => <option key={o.tool_id} value={o.tool_id}>{o.method} {o.tool_id}</option>)}
        </select>
        {sel && ops.find((o) => o.tool_id === sel)?.smoke &&
          <span style={mono({ fontSize: 10, color: stCol(ops.find((o) => o.tool_id === sel).smoke.state === "done" ? "ok" : ops.find((o) => o.tool_id === sel).smoke.state) })}>
            smoke: {ops.find((o) => o.tool_id === sel).smoke.detail}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.05fr", flex: 1, minHeight: 240 }}>
        <div style={{ padding: "15px 18px", borderRight: hairline, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {colH("01", "원천 형태", r.env === "cloud" ? "cloud" : "on-prem")}
          <Code text={[
            `# manifest 리소스 정의`,
            `name: ${r.name}`,
            r.mtype ? `type: ${r.mtype} → ${r.target}` : `source: ${r.source_kind}`,
            r.meta ? `endpoint: ${r.meta}` : null,
            ``,
            `# 수집 결과 — ${r.collected}건${r.apply_detail ? ` (${r.apply_detail})` : ""}`,
            ...ops.slice(0, 8).map((o) => `${o.method.padEnd(6)} ${o.path}`),
            ops.length > 8 ? `... 외 ${ops.length - 8} ops` : null,
          ].filter((x) => x != null).join("\n")} />
        </div>
        <div style={{ padding: "15px 18px", borderRight: hairline, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {colH("02", "정규화 IR", "공통 중간표현")}
          {desc ? <Code obj={{ operation_id: desc.tool_id, method: desc.method, path: desc.path, summary: desc.summary, parameters: desc.fields, mutating: desc.mutating, source: desc.source }} />
                : <Code text={descErr ? `명세 조회 실패: ${descErr}` : ops.length ? "불러오는 중…" : "등록된 op 없음 — 변환 실패 또는 어댑터 미지원"} />}
        </div>
        <div style={{ padding: "15px 18px", display: "flex", flexDirection: "column", minWidth: 0 }}>
          {colH("03", "최종 형태 · MCP tool", r.target)}
          {desc ? <Code obj={desc.mcp_tool} /> : <Code text={descErr ? `명세 조회 실패: ${descErr}` : ops.length ? "불러오는 중…" : "—"} />}
        </div>
      </div>

      {/* Warnings & Failures */}
      <div style={{ borderTop: "1px solid var(--line2)", padding: "13px 22px 16px" }}>
        <h4 style={{ margin: "0 0 4px", display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={caps}>Warnings &amp; Failures</span>
          {warns.length > 0 && <span style={mono({ fontSize: 10.5, fontWeight: 700, color: warns.some((w) => w[0] === "fail") ? "var(--red)" : "var(--amber)" })}>{warns.length}건</span>}
        </h4>
        {warns.length === 0
          ? <div style={mono({ fontSize: 11, color: "var(--green)", padding: "10px 2px" })}>이슈 없음 — 전체 변환·검증 통과</div>
          : warns.map(([sev, tgt, msg], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 170px 1fr", gap: 14, alignItems: "baseline", padding: "8px 2px", borderBottom: i < warns.length - 1 ? hairline : "none", fontSize: 12 }}>
              <span style={mono({ fontSize: 9.5, fontWeight: 700, color: sev === "fail" ? "var(--red)" : "var(--amber)" })}>{sev.toUpperCase()}</span>
              <span style={mono({ fontSize: 11, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>{tgt}</span>
              <span style={{ color: "var(--text)", lineHeight: 1.5 }}>{msg}</span>
            </div>))}
      </div>
    </div>
  );
}

/* ─── 프로젝트 상세 (좌 사이드바 + 우 상세) ─── */
function ProjectDetail({ pid, project, health, onBack, onReload }) {
  const [tab, setTab] = useState("all");
  const [selName, setSelName] = useState(null);
  const [job, setJob] = useState(null);           // {id, title}
  const [hist, setHist] = useState(null);         // null=닫힘, []=로딩됨

  const resources = health?.resources || [];
  const visible = resources.filter((r) => tab === "all" || (r.env ?? "onprem") === tab);
  const sel = visible.find((r) => r.name === selName) || visible[0];
  const cnt = (env) => resources.filter((r) => env === "all" || (r.env ?? "onprem") === env).length;

  const item = (r) => {
    const [tyTxt, tyColor] = TY[r.rtype] || TY.api;
    const on = sel && r.name === sel.name;
    return (
      <div key={r.name} onClick={() => setSelName(r.name)}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, padding: "9px 11px 9px 14px", cursor: "pointer", marginBottom: 2, background: on ? "var(--card)" : "transparent", boxShadow: on ? "0 0 0 1px var(--line2)" : "none" }}>
        <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2.5, borderRadius: 2, background: tyColor }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ display: "block", fontSize: 12.3, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: on ? "var(--navy)" : "var(--text)" }}>{r.name}</b>
          <small style={mono({ display: "block", fontSize: 9, color: "var(--muted)", marginTop: 2.5 })}>{tyTxt} · {r.registered} tools{r.env == null ? " · 미분류" : ""}</small>
        </span>
        <Dot st={worstOf(r)} />
      </div>
    );
  };
  const grp = (env, label) => {
    const g = visible.filter((r) => (r.env ?? "onprem") === env);
    return g.length ? <><div style={{ ...caps, fontSize: 8.5, color: "var(--faint)", padding: "12px 6px 5px" }}>{label}</div>{g.map(item)}</> : null;
  };
  const openJob = (id, title) => setJob({ id, title });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button style={btn()} onClick={onBack}>← 목록</button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{project?.name || pid}</h1>
        <span style={mono({ fontSize: 10.5, color: "var(--muted)" })}>
          리소스 {resources.length}{health?.smoke_at ? ` · 스모크 ${health.smoke_at.slice(5, 16)}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button style={btn()} onClick={() => hist ? setHist(null) : api.projectJobs(pid).then((d) => setHist(d.history)).catch(() => setHist([]))}>이력</button>
        <button style={btn(true)} onClick={() => api.smokeRun(pid).then((d) => openJob(d.jobId, "스모크 검증")).catch((e) => alert(e.message))}>전체 스모크 실행</button>
      </div>

      {hist && (
        <div style={{ ...panel, marginBottom: 12, padding: "10px 18px" }}>
          {hist.length === 0 ? <small style={mono({ fontSize: 10.5, color: "var(--muted)" })}>이력 없음</small>
            : hist.map((j) => (
              <div key={j.job_id} style={{ display: "grid", gridTemplateColumns: "70px 60px 1fr 130px", gap: 12, padding: "6px 0", borderBottom: hairline, alignItems: "baseline" }}>
                <span style={mono({ fontSize: 10.5, fontWeight: 700, color: "var(--blue)" })}>{j.kind}</span>
                <span style={mono({ fontSize: 10, color: stCol(j.status === "done" ? "ok" : "fail") })}>{j.status}</span>
                <span style={mono({ fontSize: 10, color: "var(--muted)" })}>
                  {j.resources.length}건 · 실패 {j.resources.filter((r) => r.state === "fail").length}</span>
                <span style={mono({ fontSize: 10, color: "var(--muted)", textAlign: "right" })}>{j.ts?.slice(5, 19)}</span>
              </div>))}
        </div>
      )}

      <div style={{ ...panel, display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 620 }}>
        <aside style={{ background: "var(--main)", borderRight: "1px solid var(--line2)", padding: 14, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 9, padding: 3, marginBottom: 12 }}>
            {[["all", "전체"], ["cloud", "클라우드"], ["onprem", "온프렘"]].map(([k, lb]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ flex: 1, border: 0, background: tab === k ? "var(--main)" : "transparent", color: tab === k ? "var(--navy)" : "var(--muted)", borderRadius: 6, padding: "7px 4px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", boxShadow: tab === k ? "0 0 0 1px var(--line2)" : "none" }}>
                {lb}<em style={mono({ fontStyle: "normal", fontSize: 10, opacity: .7, marginLeft: 3 })}>{cnt(k)}</em>
              </button>))}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {tab === "all" ? <>{grp("cloud", "CLOUD · AZURE")}{grp("onprem", "ON-PREMISE · 미분류 포함")}</> : visible.map(item)}
            {visible.length === 0 && <small style={mono({ fontSize: 10.5, color: "var(--muted)", padding: 8, display: "block" })}>리소스 없음</small>}
          </div>
          <div style={{ display: "flex", gap: 14, padding: "12px 6px 2px", borderTop: "1px solid var(--line2)", marginTop: 10 }}>
            {Object.entries(TY).map(([k, [lb, c]]) => <span key={k} style={{ ...caps, color: c }}>— {lb}</span>)}
          </div>
        </aside>
        {sel ? <ResourceDetail pid={pid} r={sel} onJob={openJob} />
             : <div style={{ padding: 40, color: "var(--muted)", fontSize: 13 }}>리소스를 선택하세요.</div>}
      </div>

      {job && <ConversionMonitor jobId={job.id} title={job.title} onClose={() => setJob(null)} onDone={onReload} />}
    </>
  );
}

/* ─── 루트 ─── */
export default function ConversionHealth() {
  const [projects, setProjects] = useState([]);
  const [healthMap, setHealthMap] = useState({});
  const [pid, setPid] = useState(null);

  const reload = () => {
    api.projects().then((d) => {
      setProjects(d.projects);
      d.projects.forEach((p) =>
        api.projectHealth(p.id).then((h) => setHealthMap((m) => ({ ...m, [p.id]: h }))).catch(() => {}));
    }).catch(() => {});
  };
  useEffect(reload, []);

  return (
    <div style={{ animation: "fadeUp .3s ease-out" }}>
      {!pid ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Conversion Health</h1>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>프로젝트별 레거시 → MCP / VectorDB 변환 검증</p>
            <span style={{ ...mono({ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em" }), marginLeft: "auto", color: "var(--red)", border: "1px solid var(--line2)", padding: "4px 10px", borderRadius: 7 }}>DEV ONLY</span>
          </div>
          <ProjectList projects={projects} healthMap={healthMap} onOpen={setPid} />
        </>
      ) : (
        <ProjectDetail pid={pid} project={projects.find((p) => p.id === pid)}
          health={healthMap[pid]} onBack={() => setPid(null)}
          onReload={() => api.projectHealth(pid).then((h) => setHealthMap((m) => ({ ...m, [pid]: h }))).catch(() => {})} />
      )}
    </div>
  );
}
