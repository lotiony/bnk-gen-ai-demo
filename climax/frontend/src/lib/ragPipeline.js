export function semanticStagesForPhase(snapshot = {}, phaseId) {
  const definition = snapshot.pipeline_definition || {};
  const phase = (definition.phases || []).find((value) => value.id === phaseId);
  if (!phase) return [];
  const definitions = new Map((definition.stages || []).map((value) => [value.id, value]));
  const stages = new Map((snapshot.stages || []).map((value) => [value.id, value]));
  return (phase.stage_ids || []).map((id) => ({
    definition: definitions.get(id) || { id },
    stage: stages.get(id) || { id, status: "pending" },
  }));
}

export function semanticProgress(stage = {}) {
  const progress = stage.progress || {};
  const determinate = progress.total != null && Number(progress.total) > 0;
  return {
    completed: Number(progress.completed || 0),
    total: progress.total == null ? null : Number(progress.total),
    unit: progress.unit || "items",
    determinate,
    percent: determinate
      ? Math.min(100, Math.round((Number(progress.completed || 0) / Number(progress.total)) * 100))
      : null,
  };
}

const PIPELINE_PHASE_ORDER = [
  "source_preparation",
  "knowledge_structuring",
  "quality_selection",
  "target_materialization",
  "publication",
];

export function preferredSemanticPhase(snapshot = {}, runStatus = "") {
  const defined = snapshot.pipeline_definition?.phases || [];
  const phases = snapshot.phases || [];
  const states = new Map(phases.map((phase) => [phase.id, phase]));
  const ordered = defined.length
    ? defined.map((phase) => states.get(phase.id) || phase)
    : phases;
  const latestWithStatus = (status) => [...ordered]
    .reverse()
    .find((phase) => phase.status === status);
  const terminalFailed = runStatus === "failed" || snapshot.lifecycle_status === "failed";
  if (terminalFailed) {
    const failed = latestWithStatus("failed");
    if (failed?.id) return failed.id;
  }
  const running = latestWithStatus("running");
  if (running?.id) return running.id;
  const latestProgressed = [...ordered]
    .reverse()
    .find((phase) => ["completed", "degraded", "skipped"].includes(phase.status));
  return latestProgressed?.id || ordered[0]?.id || null;
}

export function semanticStageError(stage = {}) {
  const error = stage.error;
  if (!error) return null;
  if (typeof error === "string") return { code: "—", message: error, retryable: null };
  return {
    code: error.code || "—",
    message: error.message || error.code || "알 수 없는 오류",
    retryable: typeof error.retryable === "boolean" ? error.retryable : null,
  };
}

export function stageAttemptLabel(stage = {}) {
  const attempt = Number(stage.attempt || 0);
  if (stage.status === "failed" && attempt === 0) return "시작 전 실패";
  return String(attempt);
}

export function executionProgress(execution = {}) {
  const total = Math.max(0, Number(execution.total_documents || 0));
  if (!total) return { completed: 0, total: 0, percent: 0 };

  const counts = execution.document_counts || {};
  const terminalFallback = ["completed", "degraded", "partial", "failed", "cancelled"]
    .reduce((sum, status) => sum + Number(counts[status] || 0), 0);
  const terminal = Math.min(total, Number(execution.terminal_documents ?? terminalFallback));
  const activePhases = execution.active_phase_counts || {};
  let activeDocuments = 0;
  let weightedActive = 0;
  PIPELINE_PHASE_ORDER.forEach((phase, index) => {
    const count = Number(activePhases[phase] || 0);
    activeDocuments += count;
    // Summary API에는 stage 단위 진행률이 없으므로 현재 Phase의 중간 지점을 사용한다.
    weightedActive += count * ((index + 0.5) / PIPELINE_PHASE_ORDER.length);
  });
  const runningWithoutPhase = Math.max(0, Number(counts.running || 0) - activeDocuments);
  const weighted = terminal + weightedActive + (runningWithoutPhase * 0.05);
  return {
    completed: terminal,
    total,
    percent: Math.max(0, Math.min(100, Math.round((weighted / total) * 100))),
  };
}

export function monotonicExecutionProgress(execution = {}, previousPercent = 0) {
  const progress = executionProgress(execution);
  const floor = Math.max(0, Math.min(100, Number(previousPercent) || 0));
  return {
    ...progress,
    percent: Math.max(floor, progress.percent),
  };
}

export function isRagStale(execution, now = Date.now(), thresholdMs = 10_000) {
  if (!execution || !["pending", "running"].includes(execution.status)) return false;
  // 첫 성공 전에는 last_synced_at이 없으므로 요청 시각부터 freshness를 잰다.
  // 실패한 poll의 attempt 시각을 쓰면 장애가 반복될 때 STALE이 영원히 숨는다.
  const freshnessAt = execution.last_synced_at || execution.requested_at;
  if (!freshnessAt) return false;
  const timestamp = new Date(freshnessAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp > thresholdMs;
}

export function nextCursorPage(current, history = [], nextCursor) {
  if (!nextCursor) return { cursor: current, history };
  return { cursor: nextCursor, history: [...history, current] };
}

export function previousCursorPage(history = []) {
  if (!history.length) return { cursor: null, history: [] };
  const next = [...history];
  return { cursor: next.pop() || null, history: next };
}
