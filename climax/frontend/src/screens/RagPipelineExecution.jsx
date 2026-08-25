import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  isRagStale,
  monotonicExecutionProgress,
  preferredSemanticPhase,
  semanticProgress,
  semanticStageError,
  semanticStagesForPhase,
  stageAttemptLabel,
} from "../lib/ragPipeline";
import { useProjects } from "../ProjectContext";

const PHASES = [
  ["source_preparation", "Source Preparation"],
  ["knowledge_structuring", "Knowledge Structuring"],
  ["quality_selection", "Quality Selection"],
  ["target_materialization", "Target Materialization"],
  ["publication", "Publication"],
];
const STATUS = {
  pending: ["대기", "#8a93ab"], running: ["실행 중", "#2f6fd0"],
  completed: ["완료", "#0f9f67"], degraded: ["저하", "#d49b28"],
  partial: ["부분 완료", "#d49b28"], failed: ["실패", "#d64545"],
  cancelled: ["취소", "#8a93ab"], skipped: ["건너뜀", "#8a93ab"],
};
const PHASE_LABELS = {
  source_preparation: "문서 준비",
  knowledge_structuring: "지식 구조화",
  quality_selection: "품질 평가·확정",
  target_materialization: "서빙 데이터 생성",
  publication: "저장소 반영",
};
const STAGE_LABELS = {
  document_parse: "문서 파싱",
  ocr_normalize: "OCR 정규화",
  chunk_candidate_generation: "청크 후보 생성",
  candidate_evaluation: "후보 품질 평가",
  chunker_selection: "최적 청커 확정",
  terms_extract: "용어 추출",
  terms_structure_review: "용어 구조 검토",
  terms_semantic_review: "용어 의미 검토",
  terms_quality_evaluation: "용어 품질 평가",
  terms_repair: "용어 보정",
  terms_finalize: "용어 집합 확정",
  record_build: "검색 레코드 생성",
  embedding_batches: "임베딩 배치 생성",
  search_preflight: "검색 인덱스 사전 점검",
  search_upload: "검색 레코드 적재",
  search_activation: "검색 리비전 활성화",
  entity_relation_extract: "엔티티·관계 추출",
  graph_quality_evaluation: "그래프 품질 평가",
  graph_repair: "그래프 보정",
  graph_merge: "지식 그래프 병합",
  graph_embedding: "그래프 임베딩",
  graph_package: "그래프 패키지 생성",
  graph_commit: "GraphRAG 반영",
};

const fmt = (value) => value ? new Date(value).toLocaleString() : "—";
const duration = (value) => {
  if (value == null) return "—";
  const seconds = Math.round(Number(value) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
const statusTone = (status) => STATUS[status] || [status || "대기", "#8a93ab"];

function StatusBadge({ status }) {
  const [label, color] = statusTone(status);
  return <span className="mono" style={{ color, background: `${color}18`, border: `1px solid ${color}33`, padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800 }}>{label}</span>;
}

function ExecutionProgressBar({ execution }) {
  const counts = execution?.document_counts || {};
  const executionKey = execution?.id || execution?.execution_id || "unknown";
  const highWaterRef = useRef({ executionKey: null, percent: 0 });
  const previousPercent = highWaterRef.current.executionKey === executionKey
    ? highWaterRef.current.percent
    : 0;
  const progress = monotonicExecutionProgress(execution, previousPercent);
  highWaterRef.current = { executionKey, percent: progress.percent };
  const active = ["pending", "running"].includes(execution?.status);
  const [, tone] = statusTone(execution?.status);
  const segments = [["completed", "#10a66a"], ["degraded", "#d49b28"], ["running", "#3b82f6"], ["failed", "#e05656"], ["cancelled", "#7b849b"], ["pending", "#303a55"]];
  return (
    <div>
      <div className="task-rag-progress-label"><span>전체 진행률</span><b>{progress.percent}%</b></div>
      <div className="task-rag-progress-track" role="progressbar" aria-label={`${execution?.display_name || execution?.id || "Pipeline Execution"} 전체 진행률`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percent} style={{ height: 10 }}>
        <span className={`task-rag-progress-fill${active ? " is-running" : ""}`} style={{ width: `${progress.percent}%`, "--task-progress-tone": tone }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 9, color: "var(--muted)", fontSize: 11 }}>
        {segments.map(([key, color]) => <span key={key}><i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 4 }} />{statusTone(key)[0]} {counts[key] || 0}</span>)}
      </div>
    </div>
  );
}

function stageLabel(stage, definition) {
  const id = stage?.id || definition?.id;
  return STAGE_LABELS[id] || stage?.label || definition?.label || id;
}

function stageProgress(stage, definition) {
  const progress = semanticProgress(stage);
  if (stage?.status === "skipped") return "건너뜀";
  return `${progress.completed} / ${progress.determinate ? progress.total : "?"} ${progress.unit || definition?.progress_unit || "items"}`;
}

function stageOutput(stage) {
  const error = stage?.error;
  const warning = stage?.warning || stage?.warnings?.[0];
  const skipped = stage?.skipped_reason || stage?.skip_reason;
  if (error) return typeof error === "string" ? error : error.message || error.code;
  if (warning) return typeof warning === "string" ? warning : warning.message || warning.code;
  if (skipped) return `건너뜀 · ${typeof skipped === "string" ? skipped : skipped.code}`;
  if (stage?.artifact_kinds?.length) return `산출물 · ${stage.artifact_kinds.join(" · ")}`;
  return "처리 결과가 아직 materialize되지 않았습니다.";
}

function StageInspector({ stage, definition }) {
  if (!stage && !definition) return null;
  const error = semanticStageError(stage);
  return (
    <div className="rag-stage-inspector-stack">
      <div className="rag-stage-inspector">
        <div className="rag-stage-inspector-copy">
          <code>{stage?.id || definition?.id}</code>
          <b>{stageOutput(stage)}</b>
        </div>
        <div className="rag-stage-stat"><span>상태</span><StatusBadge status={stage?.status || "pending"} /></div>
        <div className="rag-stage-stat"><span>처리량</span><b>{stageProgress(stage, definition)}</b></div>
        <div className="rag-stage-stat"><span>소요</span><b>{duration(stage?.duration_ms)}</b></div>
        <div className="rag-stage-stat"><span>시도</span><b>{stageAttemptLabel(stage)}</b></div>
      </div>
      {error && (
        <div className="rag-stage-error" role="alert">
          <div><span>error.code</span><code>{error.code}</code></div>
          <div><span>message</span><b>{error.message}</b></div>
          <div><span>retryable</span><code>{error.retryable == null ? "—" : String(error.retryable)}</code></div>
        </div>
      )}
    </div>
  );
}

function RunStages({ run, phase, onPhase }) {
  const [selectedStageId, setSelectedStageId] = useState(null);
  const snapshot = run?.snapshot || {};
  const definition = snapshot.pipeline_definition || {};
  const definedPhases = definition.phases || [];
  const phaseRows = definedPhases.length ? definedPhases : PHASES.map(([id, label]) => ({ id, label, stage_ids: [] }));
  const selected = phaseRows.find((value) => value.id === phase) || phaseRows[0];
  const selectedStages = semanticStagesForPhase(snapshot, selected?.id);
  const preferredStage = selectedStages.find(({ stage }) => stage.status === "failed")
    || selectedStages.find(({ stage }) => stage.status === "running")
    || selectedStages[0];
  const selectedStage = selectedStages.find(({ definition: value }) => value.id === selectedStageId) || preferredStage;
  const selectedPhaseState = (snapshot.phases || []).find((value) => value.id === selected?.id);
  const selectedStageKey = selectedStages.map(({ definition: value }) => value.id).join("|");
  const completedStages = selectedStages.filter(({ stage }) => stage.status === "completed").length;
  const skippedStages = selectedStages.filter(({ stage }) => stage.status === "skipped").length;
  const failedStages = selectedStages.filter(({ stage }) => stage.status === "failed").length;

  useEffect(() => {
    if (selectedStage && selectedStage.definition.id !== selectedStageId) setSelectedStageId(selectedStage.definition.id);
  }, [selectedStage, selectedStageId, selectedStageKey]);

  if (!run) return <div style={{ color: "var(--faint)", padding: 24 }}>run을 선택하세요.</div>;
  if (!run.snapshot) {
    return <div style={{ border: "1px dashed var(--line2)", borderRadius: 12, padding: 24, color: "var(--muted)", textAlign: "center" }}>상태 snapshot materialization을 기다리고 있습니다.</div>;
  }
  return (
    <div className="rag-run-graph">
      <nav className="rag-phase-rail" aria-label="Pipeline Phase 선택">
        {phaseRows.map((value, index) => {
          const phaseState = (snapshot.phases || []).find((candidate) => candidate.id === value.id);
          const progress = semanticProgress(phaseState);
          const active = value.id === selected?.id;
          return (
            <button key={value.id} type="button" aria-pressed={active} onClick={() => onPhase(value.id)}
              className={`rag-phase-node is-${phaseState?.status || "pending"}${active ? " is-selected" : ""}`}>
              <span className={`rag-phase-circle${progress.determinate ? " has-progress" : ""}`}
                style={progress.determinate ? { "--rag-node-progress": `${progress.percent}%` } : undefined}>0{index + 1}</span>
              <b>{PHASE_LABELS[value.id] || value.label || value.id}</b>
              <small>{value.stage_ids?.length || 0} stages</small>
            </button>
          );
        })}
      </nav>
      <section className={`rag-semantic-shell is-${selectedPhaseState?.status || "pending"}`}>
        <div className="rag-semantic-head">
          <div><span>SELECTED PIPELINE PHASE</span><h3>{PHASE_LABELS[selected?.id] || selected?.label || selected?.id}</h3></div>
          <div className={`rag-semantic-summary${failedStages ? " is-failed" : ""}`}>
            {selectedStages.length} Semantic Stages · {completedStages} 완료
            {skippedStages ? ` · ${skippedStages} 건너뜀` : ""}
            {failedStages ? ` · ${failedStages} 실패` : ""}
          </div>
        </div>
        <div className="rag-stage-viewport">
          <div className="rag-stage-group" data-label={`${PHASE_LABELS[selected?.id] || selected?.id} · ${selected?.id}`}>
            {selectedStages.map(({ stage, definition: stageDefinition }, index) => {
              const progress = semanticProgress(stage);
              const active = selectedStage?.definition.id === stageDefinition.id;
              return (
                <button key={stageDefinition.id} type="button" aria-pressed={active}
                  onClick={() => setSelectedStageId(stageDefinition.id)}
                  className={`rag-stage-node is-${stage.status || "pending"}${active ? " is-selected" : ""}`}>
                  <span className={`rag-stage-circle${progress.determinate ? " has-progress" : ""}`}
                    style={progress.determinate ? { "--rag-node-progress": `${progress.percent}%` } : undefined}>0{index + 1}</span>
                  <b>{stageLabel(stage, stageDefinition)}</b>
                  <small>{stageProgress(stage, stageDefinition)}</small>
                </button>
              );
            })}
            {!selectedStages.length && <div style={{ color: "var(--faint)", padding: 18 }}>이 Phase에 정의된 Semantic Stage가 없습니다.</div>}
          </div>
        </div>
        {selectedStage && <StageInspector stage={selectedStage.stage} definition={selectedStage.definition} />}
      </section>
    </div>
  );
}

export default function RagPipelineExecution({ go, nav }) {
  const executionId = nav?.executionId;
  const { switchTo } = useProjects();
  const [execution, setExecution] = useState(null);
  const [documents, setDocuments] = useState({ items: [], next_cursor: null });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [filter, setFilter] = useState({ filename: "", status: "", phase: "" });
  const [cursor, setCursor] = useState(null);
  const [cursorHistory, setCursorHistory] = useState([]);
  const [error, setError] = useState("");
  const phaseSelectionRef = useRef({ runKey: null, status: null, manual: false });

  useEffect(() => {
    if (!executionId) return undefined;
    let alive = true;
    let timer;
    const load = async () => {
      try {
        const [nextExecution, nextDocuments] = await Promise.all([
          api.ragPipelineExecution(executionId),
          api.ragPipelineDocuments(executionId, { ...filter, cursor, limit: 50 }),
        ]);
        if (!alive) return;
        setExecution(nextExecution);
        setDocuments(nextDocuments);
        setError("");
        const currentId = selectedDocument?.id;
        const first = nextDocuments.items?.find((item) => item.id === currentId) || nextDocuments.items?.[0];
        if (first && (!selectedDocument || selectedDocument.id !== first.id)) {
          const detail = await api.ragPipelineDocument(executionId, first.id);
          if (alive) setSelectedDocument(detail);
        } else if (selectedDocument) {
          const detail = await api.ragPipelineDocument(executionId, selectedDocument.id);
          if (alive) setSelectedDocument(detail);
        }
        timer = setTimeout(load, ["pending", "running"].includes(nextExecution.status) ? 4000 : 12000);
      } catch (reason) {
        if (alive) { setError(reason.message || "PipelineExecution을 불러오지 못했습니다."); timer = setTimeout(load, 12000); }
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [cursor, executionId, filter, selectedDocument?.id]);

  useEffect(() => {
    if (execution?.project_id) switchTo(execution.project_id);
  }, [execution?.project_id, switchTo]);

  const selectedRun = selectedDocument?.runs?.[0] || null;
  useEffect(() => {
    if (!selectedRun) {
      phaseSelectionRef.current = { runKey: null, status: null, manual: false };
      setSelectedPhase(null);
      return;
    }
    const snapshot = selectedRun.snapshot || {};
    const runKey = selectedRun.id || selectedRun.run_id;
    const runStatus = selectedRun.status || snapshot.lifecycle_status;
    const previous = phaseSelectionRef.current;
    const runChanged = previous.runKey !== runKey;
    const becameFailed = runStatus === "failed" && previous.status !== "failed";
    const valid = (snapshot.pipeline_definition?.phases || []).some((phase) => phase.id === selectedPhase);
    const manual = runChanged ? false : previous.manual;
    if (runChanged || becameFailed || !valid || !manual) {
      setSelectedPhase(preferredSemanticPhase(snapshot, runStatus) || PHASES[0][0]);
    }
    phaseSelectionRef.current = { runKey, status: runStatus, manual };
  }, [selectedPhase, selectedRun]);

  const stale = isRagStale(execution);
  const updateFilter = (patch) => { setFilter((value) => ({ ...value, ...patch })); setCursor(null); setCursorHistory([]); };
  const selectPhase = (phaseId) => {
    phaseSelectionRef.current = { ...phaseSelectionRef.current, manual: true };
    setSelectedPhase(phaseId);
  };
  const counts = execution?.document_counts || {};

  if (!executionId) return <div style={{ color: "var(--red)" }}>execution_id가 없습니다.</div>;
  if (!execution && !error) return <div style={{ color: "var(--muted)", padding: 30 }}>PipelineExecution을 불러오는 중…</div>;
  if (!execution) return <div style={{ color: "var(--red)", padding: 30 }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1480 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => go("dashboard")} className="rag-run-back" aria-label="대시보드로 돌아가기" title="대시보드로 돌아가기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div><span className="mono" style={{ color: "var(--blue)", fontSize: 10 }}>PIPELINE EXECUTION</span><h1 style={{ margin: "3px 0 0", color: "var(--navy)", fontSize: 22 }}>{execution.display_name}</h1></div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}><StatusBadge status={execution.status} />{stale && <span className="mono" style={{ color: "var(--amber)", fontSize: 10, fontWeight: 800 }}>STALE · {fmt(execution.last_synced_at)}</span>}</div>
      </div>

      <section style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(4,minmax(110px,.7fr))", gap: 15, alignItems: "center" }}>
          <div><ExecutionProgressBar execution={execution} /></div>
          <div><span style={{ color: "var(--faint)", fontSize: 10 }}>DOCUMENTS</span><b style={{ display: "block", color: "var(--navy)", fontSize: 22 }}>{execution.terminal_documents}/{execution.total_documents}</b></div>
          <div><span style={{ color: "var(--faint)", fontSize: 10 }}>RUNNING / PENDING</span><b style={{ display: "block", color: "var(--navy)", fontSize: 22 }}>{counts.running || 0} / {counts.pending || 0}</b></div>
          <div><span style={{ color: "var(--faint)", fontSize: 10 }}>STARTED</span><b style={{ display: "block", color: "var(--text)", fontSize: 12, marginTop: 5 }}>{fmt(execution.started_at || execution.requested_at)}</b></div>
          <div><span style={{ color: "var(--faint)", fontSize: 10 }}>LAST SYNC</span><b style={{ display: "block", color: "var(--text)", fontSize: 12, marginTop: 5 }}>{fmt(execution.last_synced_at)}</b></div>
        </div>
      </section>

      <div className="rag-execution-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(300px,.78fr) minmax(0,1.9fr)", gap: 12 }}>
        <section style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: 13, borderBottom: "1px solid var(--line)" }}>
            <b style={{ color: "var(--navy)", fontSize: 13 }}>문서</b>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 6, marginTop: 9 }}>
              <input value={filter.filename} onChange={(event) => updateFilter({ filename: event.target.value })} placeholder="파일명 검색" style={{ border: "1px solid var(--line2)", borderRadius: 8, padding: "7px 8px", background: "var(--main)", color: "var(--text)", fontSize: 11 }} />
              <select value={filter.status} onChange={(event) => updateFilter({ status: event.target.value })} style={{ border: "1px solid var(--line2)", borderRadius: 8, background: "var(--main)", color: "var(--text)", fontSize: 11 }}><option value="">전체 상태</option>{["pending", "running", "completed", "degraded", "failed", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select>
            </div>
            <select value={filter.phase} onChange={(event) => updateFilter({ phase: event.target.value })} style={{ width: "100%", marginTop: 6, border: "1px solid var(--line2)", borderRadius: 8, padding: 7, background: "var(--main)", color: "var(--text)", fontSize: 11 }}><option value="">전체 active Phase</option>{PHASES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          </div>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            {(documents.items || []).map((document) => <button key={document.id} type="button" onClick={() => api.ragPipelineDocument(executionId, document.id).then(setSelectedDocument)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, borderBottom: "1px solid var(--line)", borderLeft: `3px solid ${selectedDocument?.id === document.id ? "var(--blue)" : "transparent"}`, background: selectedDocument?.id === document.id ? "var(--blue-soft)" : "transparent", padding: "12px 13px", textAlign: "left", cursor: "pointer" }}><b style={{ minWidth: 0, flex: 1, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{document.filename}</b><StatusBadge status={document.status} /></button>)}
            {!documents.items?.length && <div style={{ padding: 28, color: "var(--faint)", textAlign: "center", fontSize: 12 }}>조건에 맞는 문서가 없습니다.</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: 10 }}><button disabled={!cursorHistory.length} onClick={() => { const next = [...cursorHistory]; setCursor(next.pop() || null); setCursorHistory(next); }} style={{ border: "1px solid var(--line2)", borderRadius: 7, background: "var(--main)", color: "var(--muted)", padding: "6px 9px" }}>이전</button><button disabled={!documents.next_cursor} onClick={() => { setCursorHistory((values) => [...values, cursor]); setCursor(documents.next_cursor); }} style={{ border: "1px solid var(--line2)", borderRadius: 7, background: "var(--main)", color: "var(--muted)", padding: "6px 9px" }}>다음</button></div>
        </section>

        <section style={{ background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 14, padding: 15, minWidth: 0 }}>
          {!selectedDocument ? <div style={{ padding: 40, textAlign: "center", color: "var(--faint)" }}>문서를 선택하세요.</div> : <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}><span className="mono" style={{ color: "var(--faint)", fontSize: 9 }}>{selectedDocument.id} · {selectedDocument.document_id} rev {selectedDocument.document_revision}</span><h2 style={{ margin: "4px 0 0", color: "var(--navy)", fontSize: 17, overflow: "hidden", textOverflow: "ellipsis" }}>{selectedDocument.filename}</h2></div>
              <StatusBadge status={selectedDocument.status} />
              <button type="button" disabled={!selectedRun?.run_id} onClick={() => go("rag", { executionId, documentExecutionId: selectedDocument.id, referenceId: selectedRun.id, runId: selectedRun.run_id, sourceMode: selectedRun.projection === "terms" ? "terms" : "rag", pipelineMode: selectedRun.target === "graphrag" ? "graphrag" : "rag", documentName: selectedDocument.filename })} style={{ marginLeft: "auto", border: 0, borderRadius: 9, background: selectedRun?.run_id ? "var(--blue)" : "var(--line2)", color: "white", padding: "8px 11px", fontSize: 11, fontWeight: 800, cursor: selectedRun?.run_id ? "pointer" : "not-allowed" }}>결과 보기 →</button>
            </div>
            {selectedRun?.sync_error && <div style={{ border: "1px solid var(--red)", borderRadius: 9, background: "var(--red-bg)", color: "var(--red)", padding: 9, marginBottom: 10, fontSize: 11 }}>{selectedRun.sync_error.code} · {selectedRun.sync_error.message}</div>}
            <RunStages run={selectedRun} phase={selectedPhase} onPhase={selectPhase} />
          </>}
        </section>
      </div>
      {error && <div style={{ color: "var(--red)", fontSize: 11 }}>{error}</div>}
    </div>
  );
}
