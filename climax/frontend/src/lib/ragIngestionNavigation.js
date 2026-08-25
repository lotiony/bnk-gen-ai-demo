export const RAG_EXECUTIONS_FOCUS = "ragExecutions";

export function dashboardNavForRagExecution(execution) {
  const executionId = String(execution?.id || "").trim();
  const ingestionWarning = String(execution?.ingestion_warning || "").trim();
  return {
    focus: RAG_EXECUTIONS_FOCUS,
    ...(executionId ? { executionId } : {}),
    ...(ingestionWarning ? { ingestionWarning } : {}),
  };
}

export function dashboardViewForNav(nav) {
  return nav?.focus === RAG_EXECUTIONS_FOCUS ? "detail" : "deck";
}

export function projectIdForRagExecution(execution, fallbackProjectId) {
  return String(execution?.project_id || fallbackProjectId || "").trim() || null;
}
