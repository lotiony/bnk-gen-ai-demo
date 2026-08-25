import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { isRagStale, monotonicExecutionProgress } from "../../lib/ragPipeline";
import { PanelHead, Spinner, fmtTime, sx } from "./bits";

const STATUS = {
  pending: { ko: "대기", en: "PENDING", tone: "var(--faint)" },
  running: { ko: "실행 중", en: "RUNNING", tone: "var(--blue)" },
  completed: { ko: "완료", en: "COMPLETED", tone: "var(--green)" },
  degraded: { ko: "저하", en: "DEGRADED", tone: "var(--amber)" },
  partial: { ko: "부분 완료", en: "PARTIAL", tone: "var(--amber)" },
  failed: { ko: "실패", en: "FAILED", tone: "var(--red)" },
  cancelled: { ko: "취소", en: "CANCELLED", tone: "var(--faint)" },
};

const PHASE = {
  source_preparation: "Source",
  knowledge_structuring: "Structure",
  quality_selection: "Quality",
  target_materialization: "Target",
  publication: "Publish",
};

const COPY = {
  ko: {
    cap: "RAG KNOWLEDGE PIPELINE",
    title: "Pipeline Executions",
    sub: "현재 프로젝트의 문서 지식화 진행 상태와 실행 이력",
    running: "실행 중", documents: "처리 문서", completed: "완료", failed: "실패",
    filename: "파일명 검색", allStatus: "전체 상태", active: "진행 중", partial: "부분 완료",
    allPhase: "전체 Phase", execution: "EXECUTION", task: "작업명", progress: "파일 진행률",
    phase: "ACTIVE PHASE", state: "상태", sync: "시간 / 동기화", noPhase: "active phase 없음",
    progressLabel: "진행률", doneCount: "완료", runningCount: "실행", failedCount: "실패",
    empty: "조건에 맞는 RAG PipelineExecution이 없습니다.", previous: "이전", next: "다음",
    loadError: "PipelineExecution 이력을 새로고침하지 못했습니다. 기존 결과를 표시합니다.",
  },
  en: {
    cap: "RAG KNOWLEDGE PIPELINE",
    title: "Pipeline Executions",
    sub: "Document knowledge pipeline status and run history for the active project",
    running: "Running", documents: "Documents", completed: "Completed", failed: "Failed",
    filename: "Search filename", allStatus: "All statuses", active: "In progress", partial: "Partial",
    allPhase: "All phases", execution: "EXECUTION", task: "JOB", progress: "FILE PROGRESS",
    phase: "ACTIVE PHASE", state: "STATUS", sync: "ELAPSED / SYNC", noPhase: "no active phase",
    progressLabel: "Progress", doneCount: "done", runningCount: "running", failedCount: "failed",
    empty: "No RAG PipelineExecution matches these filters.", previous: "Previous", next: "Next",
    loadError: "PipelineExecution history could not be refreshed. Showing the last result.",
  },
};

function elapsed(start, finish) {
  if (!start) return "—";
  const ms = Math.max(0, new Date(finish || Date.now()).getTime() - new Date(start).getTime());
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function SummaryMetric({ label, value, tone = "var(--navy)" }) {
  return (
    <div className="rag-dashboard-metric">
      <span>{label}</span>
      <b className="mono" style={{ color: tone }}>{Number(value || 0).toLocaleString()}</b>
    </div>
  );
}

export default function RagExecutionsPanel({ activeId, lang, onOpen, focusedExecutionId }) {
  const ko = lang === "ko";
  const c = COPY[ko ? "ko" : "en"];
  const [data, setData] = useState({ items: [], next_cursor: null, summary: {} });
  const [filter, setFilter] = useState({ status: "", phase: "", filename: "" });
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const progressHighWaterRef = useRef(new Map());

  const activeCount = (data.items || []).filter((item) => ["pending", "running"].includes(item.status)).length;
  useEffect(() => {
    progressHighWaterRef.current.clear();
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      setData({ items: [], next_cursor: null, summary: {} });
      setLoading(false);
      return undefined;
    }
    let alive = true;
    const load = () => api.ragPipelineExecutions(activeId, { ...filter, cursor, limit: 20 })
      .then((value) => {
        if (!alive) return;
        setData(value);
        setLoadError(false);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoadError(true);
        setLoading(false);
      });
    load();
    const timer = setInterval(load, activeCount ? 4000 : 12000);
    return () => { alive = false; clearInterval(timer); };
  }, [activeId, activeCount, cursor, filter]);

  const changeFilter = (patch) => {
    setFilter((current) => ({ ...current, ...patch }));
    setCursor(null);
    setCursorHistory([]);
    setLoading(true);
  };

  const items = data.items || [];
  const summary = data.summary || {};

  return (
    <div className="rag-dashboard-block">
      <div className="hud-colcap">{c.cap}</div>
      <section className="hud-panel rag-dashboard-panel" style={{ ...sx.panel, padding: 0 }}>
        <div className="rag-dashboard-head">
          <PanelHead title={c.title} sub={c.sub} />
          <div className="rag-dashboard-controls">
            <input aria-label={c.filename} value={filter.filename}
              onChange={(event) => changeFilter({ filename: event.target.value })} placeholder={c.filename} />
            <select aria-label={c.allStatus} value={filter.status}
              onChange={(event) => changeFilter({ status: event.target.value })}>
              <option value="">{c.allStatus}</option>
              <option value="pending,running">{c.active}</option>
              <option value="completed">{c.completed}</option>
              <option value="degraded,partial">{c.partial}</option>
              <option value="failed">{c.failed}</option>
            </select>
            <select aria-label={c.allPhase} value={filter.phase}
              onChange={(event) => changeFilter({ phase: event.target.value })}>
              <option value="">{c.allPhase}</option>
              {Object.entries(PHASE).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        </div>

        <div className="rag-dashboard-summary">
          <SummaryMetric label={c.running} value={summary.running_executions} tone="var(--blue)" />
          <SummaryMetric label={c.documents} value={summary.documents} />
          <SummaryMetric label={c.completed} value={summary.completed_documents} tone="var(--green)" />
          <SummaryMetric label={c.failed} value={summary.failed_documents} tone="var(--red)" />
        </div>

        {loadError && <div className="rag-dashboard-error">{c.loadError}</div>}

        <div className={`rag-dashboard-table-wrap${items.length > 5 ? " is-scrollable" : ""}`}>
          <div className="rag-dashboard-grid rag-dashboard-columns">
            <span>{c.execution}</span><span>{c.task}</span><span>{c.progress}</span>
            <span>{c.phase}</span><span>{c.state}</span><span>{c.sync}</span>
          </div>
          {loading && !items.length && (
            <div className="rag-dashboard-empty"><Spinner size={14} color="var(--blue)" /></div>
          )}
          {!loading && !items.length && <div className="rag-dashboard-empty">{c.empty}</div>}
          {items.map((execution) => {
            const counts = execution.document_counts || {};
            const status = STATUS[execution.status] || { ko: execution.status, en: execution.status, tone: "var(--faint)" };
            const previousPercent = progressHighWaterRef.current.get(execution.id) || 0;
            const progress = monotonicExecutionProgress(execution, previousPercent);
            progressHighWaterRef.current.set(execution.id, progress.percent);
            const stale = isRagStale(execution);
            const activePhases = Object.entries(execution.active_phase_counts || {});
            return (
              <button key={execution.id} type="button"
                className={`rag-dashboard-grid rag-dashboard-row${execution.id === focusedExecutionId ? " is-focused" : ""}`}
                aria-current={execution.id === focusedExecutionId ? "true" : undefined}
                onClick={() => onOpen(execution)}>
                <span className="mono rag-dashboard-id">{execution.id}</span>
                <span className="rag-dashboard-name">
                  <b>{execution.display_name || execution.id}</b>
                  <small>{execution.total_documents || 0} {ko ? "문서" : "documents"}</small>
                </span>
                <span className="rag-dashboard-progress">
                  <span className="task-rag-progress-track" role="progressbar"
                    aria-label={`${execution.display_name || execution.id} ${c.progress}`}
                    aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percent}>
                    <i className={`task-rag-progress-fill${["pending", "running"].includes(execution.status) ? " is-running" : ""}`}
                      style={{ width: `${progress.percent}%`, "--task-progress-tone": status.tone }} />
                  </span>
                  <small>{c.progressLabel} {progress.percent}% · {c.doneCount} {counts.completed || 0} · {c.runningCount} {counts.running || 0} · {c.failedCount} {counts.failed || 0}</small>
                </span>
                <span className="rag-dashboard-phases">
                  {activePhases.map(([phase, count]) => <small key={phase} className="mono">{PHASE[phase] || phase} {count}</small>)}
                  {!activePhases.length && <small className="is-empty">{c.noPhase}</small>}
                </span>
                <span className="mono rag-dashboard-status" style={{ color: status.tone }}>
                  {["pending", "running"].includes(execution.status) && <Spinner size={10} color={status.tone} />}
                  {status[ko ? "ko" : "en"]}
                </span>
                <span className="rag-dashboard-time">
                  <b className="mono">{elapsed(execution.started_at || execution.requested_at, execution.finished_at)}</b>
                  <small>{fmtTime(execution.last_synced_at)}{stale && <em> · STALE</em>}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="rag-dashboard-pagination">
          <button type="button" disabled={!cursorHistory.length} onClick={() => {
            const previous = [...cursorHistory];
            setCursor(previous.pop() || null);
            setCursorHistory(previous);
          }}>{c.previous}</button>
          <button type="button" disabled={!data.next_cursor} onClick={() => {
            if (!data.next_cursor) return;
            setCursorHistory((values) => [...values, cursor]);
            setCursor(data.next_cursor);
          }}>{c.next}</button>
        </div>
      </section>
    </div>
  );
}
