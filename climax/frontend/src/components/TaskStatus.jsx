import { useEffect, useRef, useState } from "react";
import { api, JOB_EVENT } from "../api";
import { executionProgress } from "../lib/ragPipeline";
import { useProjects } from "../ProjectContext";

// 앱 최상단 글로벌 작업 상태 — 아이콘 + 드롭다운(작업 목록).
// 추적 잡: 온톨로지 생성(gen_job, 구조 점검을 마지막 단계로 포함) · 자동 매핑 · 인스턴스 추출.
// 실행 중이면 아이콘에 스피너, 완료면 초록 뱃지. 실행 중 3초 / 유휴 30초 적응형 폴링.
const ACTIVE_MS = 3000;
const IDLE_MS = 30000;

const hourglass = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12M6 21h12M8 3v3.5a4 4 0 0 0 1.5 3.1L12 12l2.5-2.4A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.5-3.1L12 12l2.5 2.4A4 4 0 0 1 16 17.5V21" />
  </svg>
);

export default function TaskStatus({ onOpen }) {
  const { activeId } = useProjects();
  const [gen, setGen] = useState(null);   // 생성 잡 {status, count, review_added, ...} — 구조 점검 포함
  const [ins, setIns] = useState(null);   // 인스턴스 추출 잡 {status, added, chunks, ...}
  const [am, setAm] = useState(null);     // 자동 매핑 잡 {status, auto, pending, ...}
  const [ragExecutions, setRagExecutions] = useState([]);
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);   // 완료/실패 작업 확인 처리(뱃지+목록에서 숨김)
  const timerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const tick = () => Promise.all([
      api.genStatus().catch(() => null),
      api.instantiateStatus().catch(() => null),
      api.automapStatus().catch(() => null),
      api.recentRagPipelineExecutions(4).catch(() => ({ items: [] })),
    ])
      .then(([g, i, a, rag]) => {
        if (!alive) return;
        const executions = rag?.items || [];
        setGen(g); setIns(i); setAm(a); setRagExecutions(executions);
        schedule(
          [g, i, a].some((x) => x?.status === "running")
            || executions.some((x) => ["pending", "running"].includes(x.status))
            ? ACTIVE_MS : IDLE_MS,
        );
      });
    const schedule = (ms) => { clearTimeout(timerRef.current); timerRef.current = setTimeout(tick, ms); };
    tick();
    // 잡 시작 이벤트 → 다음 폴링 주기(유휴 30초)를 기다리지 않고 즉시 상태 반영
    window.addEventListener(JOB_EVENT, tick);
    return () => { alive = false; clearTimeout(timerRef.current); window.removeEventListener(JOB_EVENT, tick); };
  }, [activeId]);

  // 잡 → 표시용 행으로 정규화 (취소된 작업도 이력으로 남김 — 휴지통으로 지울 때까지)
  const STATUS_LABEL = { done: "완료", error: "실패", cancelled: "취소됨" };
  const jobs = [];
  if (gen?.status && gen.status !== "idle") {
    const running = gen.status === "running";
    jobs.push({
      id: "gen", title: "온톨로지 생성", status: gen.status, running,
      label: running ? (gen.step ? `진행 중 ${gen.step}/${gen.total}` : "진행 중") : STATUS_LABEL[gen.status] || gen.status,
      detail: running ? (gen.cancelling ? "취소 중…" : (gen.message || "LLM 추출 진행 중"))
        : gen.status === "done" ? `후보 ${gen.count ?? "?"}개 생성${gen.review_added ? ` · 구조 점검 관계·계층 ${gen.review_added}건 제안` : ""} 완료`
          : gen.status === "cancelled" ? `사용자가 취소함 — 부분 결과 ${gen.count ?? 0}건 저장됨`
            : (gen.error || "생성 실패"),
      started: gen.started_at, finished: gen.finished_at,
      cancel: running && !gen.cancelling ? () => api.genCancel().catch(() => {}) : null,
    });
  }
  if (am?.status && am.status !== "idle") {
    const running = am.status === "running";
    jobs.push({
      id: "automap", title: "자동 매핑", status: am.status, running,
      label: running ? (am.total ? `진행 중 ${am.step ?? 0}/${am.total}` : "진행 중") : STATUS_LABEL[am.status] || am.status,
      detail: running ? (am.message || "스키마 ↔ 온톨로지 자동 매핑 중 (점수 + LLM 배치 판정)…")
        : am.status === "done" ? `자동 승인 ${am.auto ?? 0}건 · 사람 승인 대기 ${am.pending ?? 0}건 — Auto-Map에서 확인`
          : am.status === "cancelled" ? "사용자가 취소함 — 취소 전까지 판정된 배치는 반영됨"
            : (am.error || "실행 실패"),
      started: am.started_at, finished: am.finished_at,
      // 즉시 취소 — 남은 배치만 중단, 판정분은 유지
      cancel: running ? () => api.automapCancel().then(() => api.automapStatus().then(setAm)).catch(() => {}) : null,
    });
  }
  if (ins?.status && ins.status !== "idle") {
    const running = ins.status === "running";
    jobs.push({
      id: "instantiate", title: "인스턴스 추출", status: ins.status, running,
      label: running ? (ins.total ? `진행 중 ${ins.step ?? 0}/${ins.total}` : "진행 중") : STATUS_LABEL[ins.status] || ins.status,
      detail: running ? (ins.message || "문서 청크에서 인스턴스·값·관계 추출 중…")
        : ins.status === "done" ? `인스턴스 ${ins.added ?? 0} · 값 ${ins.added_vals ?? 0} · 관계 ${ins.added_links ?? 0} 적재 (청크 ${ins.chunks ?? 0}개${ins.failed ? ` · ${ins.failed}건 실패` : ""})`
          : ins.status === "cancelled" ? `사용자가 취소함 — 취소 전까지 ${ins.added ?? 0}건 적재됨`
            : (ins.error || "추출 실패"),
      started: ins.started_at, finished: ins.finished_at,
      cancel: running ? () => api.instantiateCancel().then(() => api.instantiateStatus().then(setIns)).catch(() => {}) : null,
    });
  }
  ragExecutions.forEach((execution) => {
    const counts = execution.document_counts || {};
    const running = ["pending", "running"].includes(execution.status);
    const progress = executionProgress(execution);
    jobs.push({
      id: execution.id,
      title: execution.display_name || execution.id,
      status: execution.status,
      running,
      label: `${execution.terminal_documents}/${execution.total_documents} 문서`,
      detail: `완료 ${counts.completed || 0} · 실행 ${counts.running || 0} · 대기 ${counts.pending || 0} · 실패 ${counts.failed || 0}`,
      started: execution.started_at || execution.requested_at,
      finished: execution.finished_at,
      ragExecution: true,
      execution,
      counts,
      progress,
    });
  });

  const anyRunning = jobs.some((j) => j.running);
  // 새 실행이 시작되면 이전 clear 해제 → 다음 완료 작업이 다시 뜨도록
  useEffect(() => { if (anyRunning) setCleared(false); }, [anyRunning]);

  // 진행 중은 항상 표시, 완료/실패/취소는 clear 하면 숨김.
  // 정렬은 시작 시각이 아니라 '파이프라인 단계 순서'로 고정 — 생성(구조 점검 포함) → 매핑 → 인스턴스 추출.
  const STAGE_ORDER = { gen: 0, automap: 1, instantiate: 2 };
  const visible = jobs.filter((j) => j.running || !cleared)
    .sort((a, b) => (STAGE_ORDER[a.id] ?? 99) - (STAGE_ORDER[b.id] ?? 99));
  const badge = !anyRunning && visible.length
    ? (visible.some((j) => ["error", "failed"].includes(j.status)) ? "#d64545"
      : visible.some((j) => ["done", "completed"].includes(j.status)) ? "#1faf6b" : "#8a93ab") : null;
  const tone = (j) => (j.running ? "#2f6fd0"
    : ["done", "completed"].includes(j.status) ? "#0f7d4d"
      : ["degraded", "partial"].includes(j.status) ? "#b7791f"
        : j.status === "cancelled" ? "#8a93ab" : "#c0392b");

  const iconWrap = { position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--card)", border: `1px solid ${open ? "var(--blue)" : "var(--line2)"}`, borderRadius: 11, color: "var(--text)", cursor: "pointer" };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} title="작업 상태" style={iconWrap}>
        {hourglass}
        {anyRunning && (
          <span style={{ position: "absolute", top: -4, right: -4, width: 13, height: 13, borderRadius: "50%", background: "var(--app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 10, height: 10, border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          </span>
        )}
        {!anyRunning && badge && <span style={{ position: "absolute", top: -3, right: -3, width: 11, height: 11, borderRadius: "50%", background: badge, border: "2px solid var(--app)" }} />}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 350, maxWidth: "92vw", background: "var(--app)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 20px 50px rgba(27,36,64,.20)", zIndex: 61, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ color: "var(--navy)" }}>{hourglass}</span>
              <b style={{ fontSize: 15, color: "var(--navy)", flex: 1 }}>작업</b>
              {visible.some((j) => !j.running) && (
                <button onClick={() => { setCleared(true); setOpen(false); }} title="완료된 작업 숨기기"
                  style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>진행 중이거나 완료된 작업이 없습니다.</div>
            ) : <div style={{ maxHeight: 430, overflowY: "auto" }}>{visible.map((j, i) => (
              <div key={j.id} role="button" tabIndex={0} aria-label={`${j.title} ${j.label}`}
                onClick={() => { setOpen(false); onOpen?.(j.ragExecution ? j.execution : null); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setOpen(false);
                  onOpen?.(j.ragExecution ? j.execution : null);
                }}
                style={{ padding: "14px 16px", cursor: "pointer", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--main)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {j.running
                    ? <span style={{ width: 12, height: 12, border: "2px solid var(--blue)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
                    : <span style={{ width: 9, height: 9, borderRadius: "50%", background: tone(j), flexShrink: 0 }} />}
                  <b style={{ fontSize: 13.5, color: "var(--navy)", flex: 1 }}>{j.title}</b>
                  <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: tone(j), background: `${tone(j)}18`, padding: "2px 9px", whiteSpace: "nowrap", borderRadius: 99 }}>{j.label}</span>
                  {j.cancel && (
                    <button onClick={(e) => { e.stopPropagation(); j.cancel(); }} title="취소"
                      style={{ border: "none", background: "var(--main)", color: "var(--muted)", width: 18, height: 18, borderRadius: "50%", cursor: "pointer", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 6, paddingLeft: 20 }}>{j.detail}</div>
                {j.ragExecution && (
                  <div className="task-rag-progress">
                    <div className="task-rag-progress-label"><span>파이프라인 진행률</span><b>{j.progress.percent}%</b></div>
                    <div className="task-rag-progress-track" role="progressbar" aria-label={`${j.title} 파이프라인 진행률`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={j.progress.percent}>
                      <span className={`task-rag-progress-fill${j.running ? " is-running" : ""}`} style={{ width: `${j.progress.percent}%`, "--task-progress-tone": tone(j) }} />
                    </div>
                  </div>
                )}
                <div className="mono" style={{ fontSize: 11, color: "var(--faint)", paddingLeft: 20 }}>
                  시작 {j.started || "—"}{j.finished ? ` · 종료 ${j.finished}` : ""}
                </div>
              </div>
            ))}</div>}
          </div>
        </>
      )}
    </div>
  );
}
