import { useState, useEffect } from "react";
import { useProjects } from "../ProjectContext";
import { api } from "../api";
import { finishJob, useJobs } from "../jobStore";
import { useDrafts, dropDraft } from "../onboardingDrafts";
import { STEPS } from "./OnboardingV2";
import Modal from "../components/Modal";
import BatchMigrate from "../components/BatchMigrate";
import ConversionMonitor from "../components/ConversionMonitor";

/** 프로젝트 이름 첫 글자 반환 */
function abbr(name) {
  if (!name) return "P";
  return [...name][0] || "P";
}

/** 색상 팔레트 — 프로젝트 순번으로 순환 */
const PALETTE = ["#00b5a6", "#e8841e", "#6b8cff", "#AA50FF"];

/** 생성/수정 모달 입력 항목 — 필수는 프로젝트명만 */
function projectFields(t, p) {
  return [
    { key: "name", label: t.fName, type: "text", required: true, placeholder: t.fNamePh, default: p.name || "" },
    { key: "description", label: t.fDesc, type: "textarea", placeholder: t.fDescPh, default: p.description || "" },
    { key: "owner", label: t.fOwner, type: "text", placeholder: t.fOwnerPh, default: p.owner || "" },
    { key: "status", label: t.fStatus, type: "select", default: p.status || "active", options: [
      { value: "active", label: t.stActive }, { value: "draft", label: t.stDraft }, { value: "archived", label: t.stArchived },
    ] },
    { key: "color", label: t.fColor, type: "color", default: p.color || PALETTE[0] },
  ];
}

/** 카테고리 메타 — 색/배경/아이콘/라벨 */
const ICON = {
  mcp: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="3" width="7" height="7" rx="1.5" /><path d="M10 21V8a2 2 0 0 0-2-2H3v15h15v-5a2 2 0 0 0-2-2Z" /></svg>,
  rag: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>,
  doc: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></svg>,
  system: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>,
};
const CAT_META = {
  mcp: { ko: "MCP tool", en: "MCP tool", c: "var(--blue-d)", bg: "var(--blue-bg)" },
  rag: { ko: "RAG / 지식", en: "RAG / Knowledge", c: "var(--purple)", bg: "var(--purple-bg)" },
  doc: { ko: "문서", en: "Document", c: "var(--amber)", bg: "var(--amber-bg)" },
  system: { ko: "시스템", en: "System", c: "var(--text)", bg: "var(--main)" },
};

/** 완료/경고/실패 세그먼트 바 */
function HealthBar({ conv, warn, fail, total, h = 7 }) {
  const t = total || 1;
  const seg = (v, c) => v ? <i style={{ width: `${(v / t) * 100}%`, height: "100%", display: "block", background: c }} /> : null;
  return (
    <div style={{ height: h, borderRadius: 5, background: "var(--line)", overflow: "hidden", display: "flex" }}>
      {seg(conv, "var(--green)")}{seg(warn, "var(--amber)")}{seg(fail, "var(--red)")}
    </div>
  );
}

/** 카드/행 상태 판정 — 목록에서 "완료 / 진행중 / 손볼 것"을 색 하나로 구분한다.
 *  카드마다 숫자를 읽어야 상태를 알 수 있던 걸, 한눈에 보이는 뱃지로 승격. */
function projStatus(p, running, ko) {
  const total = p.resource_count || 0;
  const conv = p.converted || 0, warn = p.warning || 0, fail = p.failed || 0;
  if (running) return { key: "run", label: ko ? "변환 진행중" : "Converting", c: "var(--blue-d)", bg: "var(--blue-bg)", live: true };
  if (!total) return { key: "empty", label: ko ? "리소스 없음" : "Empty", c: "var(--muted)", bg: "var(--main)" };
  if (fail) return { key: "fail", label: ko ? `실패 ${fail}건` : `${fail} failed`, c: "var(--red)", bg: "var(--red-bg)" };
  if (conv >= total) return { key: "done", label: ko ? "변환 완료" : "Completed", c: "var(--green)", bg: "var(--green-bg)" };
  if (warn) return { key: "warn", label: ko ? `경고 ${warn}건` : `${warn} warnings`, c: "var(--amber)", bg: "var(--amber-bg)" };
  return { key: "part", label: ko ? `미변환 ${total - conv}건` : `${total - conv} pending`, c: "var(--amber)", bg: "var(--amber-bg)" };
}

/** 상태 뱃지 — 점 + 라벨. live 면 점이 맥동해 "지금 돌고 있음"을 정지 카드와 구분한다. */
function StatusPill({ s, sm }) {
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
      background: s.bg, color: s.c, border: `1px solid color-mix(in srgb,${s.c} 22%,transparent)`,
      borderRadius: 999, padding: sm ? "2px 7px" : "3px 9px", fontSize: sm ? 9.5 : 10.5,
      fontWeight: 800, letterSpacing: ".01em", whiteSpace: "nowrap",
    }}>
      <i className={s.live ? "pj-live" : undefined}
        style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

/** 온보딩 중단 카드 — 서버엔 아직 없는 프로젝트(위자드 4스텝에서야 생성된다).
 *
 *  앰버는 "진행중"이라는 뜻이라 유지하되 면적을 줄였다. 예전엔 점선 테두리·아바타·칩·
 *  도트·버튼이 전부 진한 주황이라 카드가 경고처럼 보였고, 가운데가 비어 옆의 정식
 *  카드보다 허전했다. 지금은 진한 앰버를 진행률 링과 CTA 두 곳에만 쓰고, 빈 공간은
 *  단계 체크리스트로 채운다(어디까지 왔는지 = 재개 판단에 필요한 정보). */
function DraftCard({ d, ko, onResume, onDiscard }) {
  const st = Math.min(d.step ?? 0, STEPS.length - 1);
  const pct = Math.round((st / (STEPS.length - 1)) * 100);
  return (
    <div
      onClick={onResume}
      className="pj-draft"
      style={{
        background: "var(--card)",
        border: "1px solid color-mix(in srgb,var(--amber) 26%,var(--line2))",
        borderRadius: 18, padding: "20px 20px 18px", cursor: "pointer", position: "relative", overflow: "hidden",
        transition: "transform .12s, box-shadow .12s, border-color .12s",
        display: "flex", flexDirection: "column", minHeight: 184,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 18px 40px rgba(232,132,30,.16)";
        e.currentTarget.style.borderColor = "color-mix(in srgb,var(--amber) 55%,var(--line2))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "color-mix(in srgb,var(--amber) 26%,var(--line2))";
      }}
    >
      {/* 상단 진행 바 — 카드 자체가 얼마나 찼는지를 테두리 대신 여기서 말한다 */}
      <i style={{ position: "absolute", top: 0, left: 0, height: 3, width: `${pct}%`,
        background: "linear-gradient(90deg,color-mix(in srgb,var(--amber) 55%,transparent),var(--amber))" }} />

      <button onClick={onDiscard} title={ko ? "임시저장 삭제" : "Discard draft"}
        style={{ position: "absolute", top: 13, right: 13, border: "none", background: "transparent",
          color: "var(--faint)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 6 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--faint)"; }}>×</button>

      {/* 진행률 링 + 이름 — 링은 정식 카드의 마이그레이션 진행링과 같은 어휘(conic-gradient) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
          background: `conic-gradient(var(--amber) ${pct}%, color-mix(in srgb,var(--amber) 16%,var(--line)) 0)` }}>
          <span className="mono" style={{ width: 31, height: 31, borderRadius: "50%", background: "var(--card)",
            display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 800, color: "var(--amber)" }}>
            {pct}%
          </span>
        </span>
        <div style={{ minWidth: 0 }}>
          {/* 이름 없이 나간 경우(0스텝 이탈)가 있어 플레이스홀더를 둔다 */}
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            color: d.name ? "var(--navy)" : "var(--muted)" }}>
            {d.name || (ko ? "이름 미정 프로젝트" : "Untitled project")}
          </h3>
          <div style={{ marginTop: 4 }}>
            <StatusPill sm s={{ label: ko ? `온보딩 진행중 · ${st + 1}/${STEPS.length}` : `Onboarding · ${st + 1}/${STEPS.length}`,
              c: "var(--amber)", bg: "var(--amber-bg)", live: true }} />
          </div>
        </div>
      </div>

      {/* 단계 체크리스트 — 지난 단계 / 지금 여기 / 남은 단계.
          "이어서 진행"을 누르기 전에 무엇이 남았는지 보이게 한다. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {STEPS.map((s, i) => {
          const done = i < st, here = i === st;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 2px",
              fontSize: 12, fontWeight: here ? 700 : 500,
              color: here ? "var(--navy)" : done ? "var(--text)" : "var(--faint)" }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                fontSize: 8.5, fontWeight: 800, color: done ? "var(--amber)" : "transparent",
                background: done ? "var(--amber-bg)" : "transparent",
                border: here ? "none" : done ? "none" : "1.5px solid var(--line2)" }}>
                {done ? "✓" : here ? (
                  <i className="pj-live" style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--amber)" }} />
                ) : null}
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              {here && <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, color: "var(--amber)", flexShrink: 0 }}>
                {ko ? "여기부터" : "HERE"}
              </span>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <div style={{
          width: "100%", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 12.5, padding: "11px",
          background: "linear-gradient(90deg,var(--amber),color-mix(in srgb,var(--amber) 78%,#ff6b3d))",
          boxShadow: "0 8px 20px rgba(232,132,30,.26)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {ko ? "이어서 진행" : "Resume"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** 프로젝트 카드 변환현황 — 헬스바 + 카테고리별 행 */
function StatusSection({ p, ko, running }) {
  const total = p.resource_count || 0;
  const conv = p.converted || 0, warn = p.warning || 0, fail = p.failed || 0;
  const rate = total ? Math.round((conv / total) * 100) : 0;
  const cats = p.categories || [];
  const rateColor = fail ? "var(--red)" : warn ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div><span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.02em" }}>{total}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginLeft: 4 }}>{ko ? "리소스" : "resources"}</span></div>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: running ? "var(--amber)" : rateColor }}>
          {running ? (ko ? "변환중 …" : "converting …") : `${ko ? "변환" : "converted"} ${rate}%`}
        </span>
      </div>
      <HealthBar conv={conv} warn={warn} fail={fail} total={total} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 11 }}>
        {cats.map((c) => {
          const m = CAT_META[c.key] || CAT_META.mcp;
          const parts = [];
          if (c.converted) parts.push(`${ko ? "완료" : "done"} ${c.converted}`);
          if (c.warning) parts.push(`${ko ? "경고" : "warn"} ${c.warning}`);
          if (c.failed) parts.push(`${ko ? "실패" : "fail"} ${c.failed}`);
          return (
            <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 7px", borderRadius: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: m.bg, color: m.c, display: "flex", alignItems: "center", justifyContent: "center" }}>{ICON[c.key]}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>{ko ? m.ko : m.en}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{parts.join(" · ") || "—"}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 50 }}><HealthBar conv={c.converted} warn={c.warning} fail={c.failed} total={c.total} h={5} /></div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: "right" }}>{c.total}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** color 값으로 아바타 스타일 생성 */
function avatarStyle(color, size = 40) {
  const base = {
    width: size, height: size, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 800, fontSize: size * 0.375, flexShrink: 0,
  };
  if (!color) return { ...base, background: "linear-gradient(135deg,#00b5a6,#6b8cff)" };
  return { ...base, background: color };
}

/** 진행중 일괄변환 jobStatus 폴링 훅 — 끝나면 onFinished */
function useJobProgress(jobId, onFinished) {
  const [st, setSt] = useState({ pct: 0, done: 0, total: 0 });
  useEffect(() => {
    let alive = true, timer, retryMs = 1500;
    const tick = async () => {
      try {
        const d = await api.jobStatus(jobId);
        if (!alive) return;
        const rs = d.resources || [];
        setSt({ pct: d.pct, done: rs.filter((r) => ["done", "warn", "fail"].includes(r.state)).length, total: rs.length });
        if (d.status !== "running") return onFinished(d.status);
        retryMs = 1500;
      } catch (error) {
        if (!alive) return;
        if (error?.status === 404) return onFinished("missing");
        retryMs = Math.min(retryMs * 2, 12000);
      }
      timer = setTimeout(tick, retryMs);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId]);
  return st;
}

/** 리스트 행용 컴팩트 진행링 — pct 칩, 클릭 시 재오픈 */
function MigrationChip({ jobId, onOpen, onFinished }) {
  const st = useJobProgress(jobId, onFinished);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      title="마이그레이션 진행중 · 클릭하면 모니터 열기"
      style={{
        display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--blue-bg)",
        background: "var(--blue-soft)", borderRadius: 9, padding: "4px 8px 4px 4px", cursor: "pointer",
      }}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        background: `conic-gradient(var(--blue) ${st.pct}%, var(--line2) 0)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--card)" }} />
      </span>
      <span className="mono" style={{ fontSize: 10.5, fontWeight: 800, color: "var(--blue-d)" }}>{st.pct}%</span>
    </button>
  );
}

/** 진행중 일괄변환 카드 패널 — 클릭 시 모니터 재오픈 */
function MigrationRing({ jobId, onOpen, onFinished }) {
  const st = useJobProgress(jobId, onFinished);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, textAlign: "left",
        background: "var(--blue-soft)", border: "1px solid var(--blue-bg)", borderRadius: 14, padding: "12px 14px", cursor: "pointer",
      }}
    >
      <span style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: `conic-gradient(var(--blue) ${st.pct}%, var(--line2) 0)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span className="mono" style={{
          width: 24, height: 24, borderRadius: "50%", background: "var(--card)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "var(--blue)",
        }}>{st.pct}%</span>
      </span>
      <span>
        <b style={{ fontSize: 13, color: "var(--blue-d)" }}>마이그레이션 진행중</b>
        <small style={{ display: "block", color: "var(--muted)", fontSize: 11, marginTop: 1 }}>
          {st.done}/{st.total} 완료 · 클릭하면 모니터 열기
        </small>
      </span>
    </button>
  );
}

export default function Projects({ t, lang, go }) {
  const { projects, switchTo, refresh } = useProjects();
  const ko = lang === "ko";
  const jobs = useJobs();                           // projectId→jobId (진행중)
  // 온보딩을 중간에 닫아 서버엔 아직 없는 진행분 — 최근 수정 순으로 목록 맨 앞에 세운다.
  const drafts = useDrafts();
  const draftList = Object.entries(drafts).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  // modal = null | { kind: "create"|"rename"|"delete"|"discardDraft", project?, draftId? }
  const [modal, setModal] = useState(null);
  const [migrate, setMigrate] = useState(null);   // 일괄 변환 대상 프로젝트
  const [monitor, setMonitor] = useState(null);   // 진행링 재오픈 { jobId, project }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("card");   // "card" | "list" — 기본 카드

  /** 카드 클릭 → 프로젝트 전환 후 대시보드 이동 */
  const handleSelect = (id) => {
    switchTo(id);
    go("dashboard");
  };

  const openCreate = () => { setErr(""); setModal({ kind: "create" }); };
  const openRename = (e, p) => { e.stopPropagation(); setErr(""); setModal({ kind: "rename", project: p }); };
  const openDelete = (e, p) => { e.stopPropagation(); setErr(""); setModal({ kind: "delete", project: p }); };
  const closeModal = () => { if (!busy) { setModal(null); setErr(""); } };

  /** 모달 확인 — kind 별 처리. values = 폼 객체(create/rename) | undefined(delete) */
  const handleConfirm = async (values) => {
    // draft 삭제는 브라우저 로컬 정리 — 서버 호출/목록 갱신이 필요 없다.
    if (modal.kind === "discardDraft") { dropDraft(modal.draftId); setModal(null); return; }
    setBusy(true); setErr("");
    try {
      if (modal.kind === "create") {
        await api.createProject(values);
      } else if (modal.kind === "rename") {
        await api.updateProject(modal.project.id, values);
      } else if (modal.kind === "delete") {
        await api.deleteProject(modal.project.id);
      }
      await refresh();
      setModal(null);
    } catch (e) {
      setErr(e.message || (ko ? "처리 실패" : "Request failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <style>{`
        @keyframes pjLive{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.82)}}
        .pj-live{animation:pjLive 1.5s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.pj-live{animation:none}}
      `}</style>

      {/* 헤딩 */}
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>
        {t.navProjects}
      </h1>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text)" }}>
        프로젝트마다 MCP를 독립적으로 구성하며, 특정 MCP는 여러 프로젝트가 공유할 수 있습니다.
      </p>

      {/* 카운트 + 보기 토글 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "24px 2px 12px" }}>
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".13em", textTransform: "uppercase", color: "var(--muted)", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => go("onboarding")}
            style={{ border: "none", borderRadius: 10, cursor: "pointer", padding: "8px 14px",
              background: "var(--blue)", color: "#fff", fontFamily: "var(--sans)", fontSize: 13,
              fontWeight: 700, letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 6px 14px rgba(0,181,166,.24)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--blue-d)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--blue)"; }}>
            ＋ {t.newProject}
          </button>
          {t.projAllProjects} {projects.length}
          {/* 진행중 개수는 따로 센다 — 서버 프로젝트 수(projects.length)에 섞으면 숫자가 어긋난다 */}
          {draftList.length > 0 && (
            <span style={{ color: "var(--amber)", background: "var(--amber-bg)", borderRadius: 999, padding: "2px 8px", letterSpacing: ".02em", fontWeight: 800, textTransform: "none" }}>
              {ko ? `온보딩 진행중 ${draftList.length}` : `${draftList.length} in progress`}
            </span>
          )}
        </span>
        <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 11, padding: 3 }}>
          {[["card", <svg key="c" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>],
            ["list", <svg key="l" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>]].map(([m, ic]) => (
            <button key={m} onClick={() => setView(m)} title={m}
              style={{ border: "none", cursor: "pointer", padding: "5px 10px", borderRadius: 8, display: "flex", alignItems: "center",
                background: view === m ? "var(--blue)" : "transparent", color: view === m ? "#fff" : "var(--muted)" }}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* 프로젝트가 없을 때 — 온보딩 진입 유도 (empty-set)
          진행중 draft 가 있으면 목록이 비어있지 않으므로 빈 화면을 띄우지 않는다 */}
      {projects.length === 0 && draftList.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "64px 32px", textAlign: "center",
          background: "var(--card)", border: "1px solid var(--line2)",
          borderRadius: 24, marginTop: 8,
        }}>
          {/* 라인 아이콘 — 폴더+스파크 조합 */}
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ marginBottom: 24, opacity: 0.55 }}>
            <rect x="6" y="18" width="44" height="30" rx="6" stroke="var(--navy)" strokeWidth="2.2" />
            <path d="M6 26h44" stroke="var(--navy)" strokeWidth="2" />
            <path d="M6 24l10-8h8l3 8" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="38" cy="38" r="10" fill="var(--blue)" />
            <path d="M38 33v5l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>
            아직 프로젝트가 없습니다
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 14, color: "var(--muted)", lineHeight: 1.65, maxWidth: 360 }}>
            프로젝트를 생성하면 MCP 서버·RAG 지식베이스를 독립적으로 구성하고<br />
            팀과 안전하게 공유할 수 있습니다.
          </p>

          {/* 온보딩 진입 — 주요 CTA */}
          <button
            onClick={() => go("onboarding")}
            style={{
              border: "none", borderRadius: 14, cursor: "pointer",
              background: "var(--blue)", color: "#fff",
              fontWeight: 800, fontSize: 15, padding: "14px 36px",
              boxShadow: "0 10px 28px rgba(0,181,166,.32)",
              transition: "opacity .14s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            프로젝트 생성 · 온보딩 시작
          </button>

          {/* 바로 생성 — 보조 링크 */}
          <button
            onClick={openCreate}
            style={{
              marginTop: 14, border: "none", background: "transparent",
              color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 3,
            }}
          >
            바로 빈 프로젝트 생성
          </button>
        </div>
      )}

      {/* 카드 그리드 — 프로젝트나 진행중 draft 가 있을 때 표시 */}
      {(projects.length > 0 || draftList.length > 0) && view === "card" && (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}>
        {/* 진행중 온보딩 — 맨 앞. 마무리해야 할 일이 목록 위쪽에 오도록. */}
        {draftList.map(([id, d]) => (
          <DraftCard key={id} d={d} ko={ko}
            onResume={() => go("onboarding", id)}
            onDiscard={(e) => { e.stopPropagation(); setErr(""); setModal({ kind: "discardDraft", draftId: id, name: d.name }); }} />
        ))}

        {projects.map((p, idx) => {
          const color = p.color || PALETTE[idx % PALETTE.length];
          const projId = p.id ? `PROJ-${String(p.id).toUpperCase()}` : "PROJ";
          const resourceCount = p.resource_count ?? 0;
          const canDelete = !p.is_default && projects.length > 1;
          const jobId = jobs[p.id];   // 진행중 일괄변환 잡
          const st = projStatus(p, !!jobId, ko);

          return (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id)}
              style={{
                background: "var(--card)", border: "1px solid var(--line2)",
                borderRadius: 18, padding: 20, cursor: "pointer",
                transition: "transform .12s, box-shadow .12s",
                position: "relative",
                display: "flex", flexDirection: "column", minHeight: 184,   // 변환 버튼 하단 고정
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 18px 40px rgba(54,64,120,.14)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* 우상단 액션 — 이름변경(항상) + 삭제(기본/마지막 제외) */}
              <div style={{ position: "absolute", top: 13, right: 13, display: "flex", gap: 2 }}>
                <button
                  onClick={(e) => openRename(e, p)}
                  style={{
                    border: "none", background: "transparent", color: "var(--muted)",
                    cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "3px 5px", borderRadius: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--blue)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
                  title={t.renameProject}
                >
                  ✎
                </button>
                {canDelete && (
                  <button
                    onClick={(e) => openDelete(e, p)}
                    style={{
                      border: "none", background: "transparent", color: "var(--muted)",
                      cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 6,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
                    title="프로젝트 삭제"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* 아바타 + 이름 영역 */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                <div style={avatarStyle(color, 40)}>
                  {abbr(p.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</h3>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {projId}
                  </div>
                </div>
              </div>

              {/* 상태 뱃지 — 숫자를 읽지 않아도 완료/진행중/손볼 것이 구분되도록 */}
              <StatusPill s={st} />

              {/* 변환현황 — 헬스바 + 카테고리별 */}
              <StatusSection p={p} ko={ko} running={!!jobId} />

              {/* 리소스 일괄 변환 — 카드 하단 고정(marginTop:auto). 진행중이면 진행링, 아니면 시작 버튼 */}
              <div style={{ marginTop: "auto", paddingTop: 16 }}>
              {jobId ? (
                <MigrationRing
                  jobId={jobId}
                  onOpen={() => setMonitor({ jobId, project: p })}
                  onFinished={(status) => { finishJob(p.id, jobId, status); refresh(); }}
                />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setMigrate(p); }}
                  style={{
                    width: "100%", border: "none", borderRadius: 12,
                    background: "var(--blue-soft)", color: "var(--blue-d)", fontWeight: 700,
                    fontSize: 12.5, padding: "10px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--blue-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--blue-soft)"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  {ko ? "리소스 일괄 변환" : "Batch convert"}
                </button>
              )}
              </div>
            </div>
          );
        })}

      </div>
      )}

      {/* 리스트 보기 — 프로젝트나 진행중 draft 가 있을 때 표시 */}
      {(projects.length > 0 || draftList.length > 0) && view === "list" && (
        <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16, overflow: "hidden" }}>
          {/* 진행중 온보딩 — 카드 뷰와 같이 맨 앞 */}
          {draftList.map(([id, d], i) => {
            const st = Math.min(d.step ?? 0, STEPS.length - 1);
            return (
              <div key={id} onClick={() => go("onboarding", id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", cursor: "pointer",
                  background: "color-mix(in srgb,var(--amber) 5%,transparent)",
                  borderTop: i ? "1px solid var(--line)" : "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--amber-bg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb,var(--amber) 5%,transparent)"; }}>
                <span className="pj-live" style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--amber)", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  color: d.name ? "var(--navy)" : "var(--muted)" }}>
                  {d.name || (ko ? "이름 미정 프로젝트" : "Untitled project")}
                </span>
                <StatusPill sm s={{ label: ko ? "온보딩 진행중" : "Onboarding", c: "var(--amber)", bg: "var(--amber-bg)", live: true }} />
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{STEPS[st].label}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: "var(--amber)", minWidth: 34, textAlign: "right" }}>{st + 1}/{STEPS.length}</span>
                <button onClick={(e) => { e.stopPropagation(); setModal({ kind: "discardDraft", draftId: id, name: d.name }); }} title={ko ? "임시저장 삭제" : "Discard draft"}
                  style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 16, padding: "2px 4px", borderRadius: 6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}>×</button>
              </div>
            );
          })}
          {projects.map((p, idx) => {
            const color = p.color || PALETTE[idx % PALETTE.length];
            const canDelete = !p.is_default && projects.length > 1;
            const jobId = jobs[p.id];
            const st = projStatus(p, !!jobId, ko);
            return (
              <div key={p.id} onClick={() => handleSelect(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", cursor: "pointer",
                  /* 위에 draft 행이 있으면 첫 프로젝트 행에도 구분선이 필요하다 */
                  borderTop: (idx || draftList.length) ? "1px solid var(--line)" : "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--main)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                {p.is_default && <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: "var(--blue-d)", background: "var(--blue-bg)", padding: "2px 7px", borderRadius: 7 }}>DEFAULT</span>}
                <StatusPill sm s={st} />
                <span style={{ flex: 1 }} />
                {p.owner && <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.owner}</span>}
                {/* 카테고리 점 + 미니 헬스바 */}
                <span style={{ display: "flex", gap: 4 }}>
                  {(p.categories || []).map((c) => <span key={c.key} title={CAT_META[c.key] ? (ko ? CAT_META[c.key].ko : CAT_META[c.key].en) : c.key}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: (CAT_META[c.key] || CAT_META.mcp).c }} />)}
                </span>
                <span style={{ width: 56 }}><HealthBar conv={p.converted} warn={p.warning} fail={p.failed} total={p.resource_count} h={5} /></span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text)", minWidth: 58, textAlign: "right" }}>{p.resource_count ?? 0} {t.mcpUnit}</span>
                {jobId ? (
                  <MigrationChip jobId={jobId} onOpen={() => setMonitor({ jobId, project: p })}
                    onFinished={(status) => { finishJob(p.id, jobId, status); refresh(); }} />
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setMigrate(p); }} title={ko ? "리소스 일괄 변환" : "Batch convert"}
                    style={{ border: "1px solid var(--blue-bg)", background: "var(--blue-soft)", color: "var(--blue-d)", cursor: "pointer", padding: "5px 9px", borderRadius: 8, display: "flex", alignItems: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--blue-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--blue-soft)"; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                    </svg>
                  </button>
                )}
                <button onClick={(e) => openRename(e, p)} title={t.renameProject}
                  style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--blue)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}>✎</button>
                <button onClick={(e) => openDelete(e, p)} disabled={!canDelete} title="삭제"
                  style={{ border: "none", background: "transparent", color: canDelete ? "var(--muted)" : "var(--faint)", cursor: canDelete ? "pointer" : "not-allowed", fontSize: 16, padding: "2px 4px", borderRadius: 6 }}
                  onMouseEnter={(e) => { if (canDelete) e.currentTarget.style.color = "var(--red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = canDelete ? "var(--muted)" : "var(--faint)"; }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* 리소스 일괄 변환 (manifest 빌더 → apply → 모니터) */}
      {migrate && <BatchMigrate project={migrate} onClose={() => setMigrate(null)} onComplete={refresh} />}

      {/* 진행링에서 재오픈한 모니터 — 닫아도 잡은 서버서 계속, 링은 유지 */}
      {monitor && (
        <ConversionMonitor
          jobId={monitor.jobId}
          projectName={monitor.project.name}
          onClose={() => setMonitor(null)}
          onDone={(result) => {
            finishJob(monitor.project.id, monitor.jobId, result?.missing ? "missing" : result?.status);
            refresh();
          }}
        />
      )}

      {/* 디자인 시스템 모달 — 생성/수정/삭제 (시스템 팝업 대체) */}
      <Modal
        open={modal?.kind === "create"}
        title={t.newProject}
        fields={projectFields(t, {})}
        confirmLabel={busy ? "…" : t.create}
        cancelLabel={t.cancel}
        error={modal?.kind === "create" ? err : ""}
        onConfirm={handleConfirm}
        onCancel={closeModal}
      />
      <Modal
        open={modal?.kind === "rename"}
        title={t.editProject}
        fields={projectFields(t, modal?.project || {})}
        confirmLabel={busy ? "…" : t.save}
        cancelLabel={t.cancel}
        error={modal?.kind === "rename" ? err : ""}
        onConfirm={handleConfirm}
        onCancel={closeModal}
      />
      {/* 임시저장 폐기 — 로컬에만 있는 진행분이라 지우면 복구 불가. 확인 한 번 받는다. */}
      <Modal
        open={modal?.kind === "discardDraft"}
        title={ko ? "온보딩 임시저장 삭제" : "Discard draft"}
        message={ko
          ? `'${modal?.name || "이름 미정 프로젝트"}' 의 온보딩 진행분을 삭제합니다. 입력한 내용은 복구할 수 없습니다.`
          : `Discard the onboarding progress of '${modal?.name || "Untitled project"}'. This cannot be undone.`}
        confirmLabel={ko ? "삭제" : "Discard"}
        cancelLabel={ko ? "취소" : "Cancel"}
        danger
        onConfirm={handleConfirm}
        onCancel={closeModal}
      />
      <Modal
        open={modal?.kind === "delete"}
        title={ko ? "프로젝트 삭제" : "Delete project"}
        message={ko
          ? `'${modal?.project?.name}' 프로젝트를 삭제합니다. 이 프로젝트의 링크만 제거되고 공유 리소스·다른 프로젝트는 보존됩니다.`
          : `Delete '${modal?.project?.name}'. Only this project's links are removed; shared resources and other projects are preserved.`}
        confirmLabel={busy ? "…" : (ko ? "삭제" : "Delete")}
        cancelLabel={ko ? "취소" : "Cancel"}
        danger
        error={modal?.kind === "delete" ? err : ""}
        onConfirm={handleConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}
