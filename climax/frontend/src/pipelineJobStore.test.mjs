import assert from "node:assert/strict";
import test from "node:test";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("keeps every document route without creating timer-backed jobs", async (t) => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  t.after(() => {
    globalThis.localStorage = originalStorage;
  });

  const store = await import(`./pipelineJobStore.js?test=all-assignments-${Date.now()}`);
  const assignments = Array.from({ length: 13 }, (_, i) => ({
    documentName: `document-${i + 1}.pdf`,
    documentPath: `/docs/document-${i + 1}.pdf`,
    pipelineId: i % 2 ? "rag-graphrag" : "rag-ai-search",
  }));

  store.startPipelineJobs("project-1", "Project 1", assignments);

  const routes = JSON.parse(localStorage.getItem("ktel.project-pipeline-routes"));
  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0].assignments, assignments);
  assert.equal(localStorage.getItem("ktel.pipeline-jobs"), null);
});
