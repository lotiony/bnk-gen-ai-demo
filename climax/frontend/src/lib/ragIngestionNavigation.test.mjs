import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardNavForRagExecution,
  dashboardViewForNav,
  projectIdForRagExecution,
  RAG_EXECUTIONS_FOCUS,
} from "./ragIngestionNavigation.js";

test("routes a newly created execution to the dashboard detail view", () => {
  const nav = dashboardNavForRagExecution({ id: "rpe-new" });
  assert.deepEqual(nav, { focus: RAG_EXECUTIONS_FOCUS, executionId: "rpe-new" });
  assert.equal(dashboardViewForNav(nav), "detail");
});

test("keeps the normal dashboard entry on the command deck", () => {
  assert.equal(dashboardViewForNav(null), "deck");
  assert.deepEqual(dashboardNavForRagExecution(null), { focus: RAG_EXECUTIONS_FOCUS });
});

test("carries a partial-ingestion warning to the focused execution", () => {
  assert.deepEqual(dashboardNavForRagExecution({
    id: "rpe-partial",
    ingestion_warning: "2개 문서는 다시 업로드해주세요.",
  }), {
    focus: RAG_EXECUTIONS_FOCUS,
    executionId: "rpe-partial",
    ingestionWarning: "2개 문서는 다시 업로드해주세요.",
  });
});

test("keeps dashboard navigation on the execution owner project", () => {
  assert.equal(projectIdForRagExecution({ project_id: "project-a" }, "project-b"), "project-a");
  assert.equal(projectIdForRagExecution({ id: "legacy-response" }, "project-b"), "project-b");
  assert.equal(projectIdForRagExecution(null, null), null);
});
