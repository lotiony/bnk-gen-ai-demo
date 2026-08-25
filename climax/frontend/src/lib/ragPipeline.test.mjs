import assert from "node:assert/strict";
import test from "node:test";
import {
  executionProgress,
  isRagStale,
  monotonicExecutionProgress,
  nextCursorPage,
  preferredSemanticPhase,
  previousCursorPage,
  semanticProgress,
  semanticStageError,
  semanticStagesForPhase,
  stageAttemptLabel,
} from "./ragPipeline.js";

test("renders only definition-declared stages for the selected phase", () => {
  const snapshot = {
    progress_fidelity: "semantic",
    pipeline_definition: {
      phases: [{ id: "source", stage_ids: ["load"] }, { id: "publish", stage_ids: ["commit"] }],
      stages: [{ id: "load", phase: "source" }, { id: "commit", phase: "publish" }],
    },
    stages: [{ id: "load", status: "completed" }, { id: "commit", status: "running" }],
  };
  assert.deepEqual(semanticStagesForPhase(snapshot, "publish").map((value) => value.stage.id), ["commit"]);
});

test("unknown total stays indeterminate instead of inventing a percentage", () => {
  assert.deepEqual(semanticProgress({ progress: { completed: 32, total: null, unit: "records" } }), {
    completed: 32, total: null, unit: "records", determinate: false, percent: null,
  });
  assert.equal(semanticProgress({ progress: { completed: 1, total: 4 } }).percent, 25);
});

test("cursor history uses opaque cursor values without deriving has_more", () => {
  const second = nextCursorPage(null, [], "opaque:2");
  const third = nextCursorPage(second.cursor, second.history, "opaque:3");
  assert.deepEqual(previousCursorPage(third.history), { cursor: "opaque:2", history: [null] });
  assert.deepEqual(nextCursorPage(third.cursor, third.history, null), third);
});

test("stale applies only to active synchronized executions", () => {
  const now = Date.parse("2026-08-05T00:00:20Z");
  assert.equal(isRagStale({ status: "running", last_synced_at: "2026-08-05T00:00:00Z" }, now), true);
  assert.equal(isRagStale({ status: "completed", last_synced_at: "2026-08-05T00:00:00Z" }, now), false);
});

test("stale falls back to requested time before the first successful sync", () => {
  const now = Date.parse("2026-08-05T00:00:20Z");
  assert.equal(isRagStale({
    status: "pending",
    requested_at: "2026-08-05T00:00:00Z",
    last_synced_at: null,
    last_sync_attempt_at: "2026-08-05T00:00:19Z",
  }, now), true);
  assert.equal(isRagStale({
    status: "running",
    requested_at: "2026-08-05T00:00:15Z",
    last_synced_at: null,
  }, now), false);
});

test("terminal failed runs prefer their failed phase", () => {
  const snapshot = {
    lifecycle_status: "failed",
    pipeline_definition: { phases: [{ id: "source" }, { id: "quality" }] },
    phases: [{ id: "source", status: "completed" }, { id: "quality", status: "failed" }],
  };
  assert.equal(preferredSemanticPhase(snapshot, "failed"), "quality");
});

test("active runs prefer the latest running phase in pipeline order", () => {
  const snapshot = {
    lifecycle_status: "running",
    pipeline_definition: {
      phases: [{ id: "source" }, { id: "structure" }, { id: "quality" }],
    },
    phases: [
      { id: "source", status: "running" },
      { id: "structure", status: "running" },
      { id: "quality", status: "pending" },
    ],
  };
  assert.equal(preferredSemanticPhase(snapshot, "running"), "structure");
});

test("runs between active phases keep the latest completed phase selected", () => {
  const snapshot = {
    lifecycle_status: "running",
    pipeline_definition: {
      phases: [{ id: "source" }, { id: "structure" }, { id: "quality" }],
    },
    phases: [
      { id: "source", status: "completed" },
      { id: "structure", status: "completed" },
      { id: "quality", status: "pending" },
    ],
  };
  assert.equal(preferredSemanticPhase(snapshot, "running"), "structure");
});

test("failed stage exposes structured error and pre-start attempt", () => {
  const stage = {
    status: "failed",
    attempt: 0,
    error: { code: "terms_finalize_failed", message: "failed before progress", retryable: false },
  };
  assert.equal(stageAttemptLabel(stage), "시작 전 실패");
  assert.deepEqual(semanticStageError(stage), {
    code: "terms_finalize_failed",
    message: "failed before progress",
    retryable: false,
  });
});

test("execution progress uses active phase instead of document status width", () => {
  assert.equal(executionProgress({
    status: "running",
    total_documents: 1,
    terminal_documents: 0,
    document_counts: { running: 1 },
    active_phase_counts: { knowledge_structuring: 1 },
  }).percent, 30);
  assert.equal(executionProgress({
    status: "failed",
    total_documents: 1,
    terminal_documents: 1,
    document_counts: { failed: 1 },
  }).percent, 100);
  assert.equal(executionProgress({
    status: "running",
    total_documents: 2,
    terminal_documents: 1,
    document_counts: { completed: 1, running: 1 },
    active_phase_counts: { target_materialization: 1 },
  }).percent, 85);
});

test("execution progress does not move backward during a phase transition gap", () => {
  const phaseThree = executionProgress({
    status: "running",
    total_documents: 1,
    terminal_documents: 0,
    document_counts: { running: 1 },
    active_phase_counts: { quality_selection: 1 },
  });
  assert.equal(phaseThree.percent, 50);

  const transitionGap = monotonicExecutionProgress({
    status: "running",
    total_documents: 1,
    terminal_documents: 0,
    document_counts: { running: 1 },
    active_phase_counts: {},
  }, phaseThree.percent);
  assert.equal(transitionGap.percent, 50);

  const phaseFour = monotonicExecutionProgress({
    status: "running",
    total_documents: 1,
    terminal_documents: 0,
    document_counts: { running: 1 },
    active_phase_counts: { target_materialization: 1 },
  }, transitionGap.percent);
  assert.equal(phaseFour.percent, 70);
});
