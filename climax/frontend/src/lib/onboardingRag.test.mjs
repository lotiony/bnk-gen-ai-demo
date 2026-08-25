import assert from "node:assert/strict";
import test from "node:test";
import {
  createOnboardingRagExecution,
  onboardingDocumentFile,
  onboardingPipelineProfile,
} from "./onboardingRag.js";

test("maps each onboarding route to one durable pipeline profile", () => {
  assert.deepEqual(onboardingPipelineProfile("rag-ai-search"), { projection: "adaptive", target: "ai_search" });
  assert.deepEqual(onboardingPipelineProfile("rag-graphrag"), { projection: "adaptive", target: "graphrag" });
  assert.deepEqual(onboardingPipelineProfile("terms-ai-search"), { projection: "terms", target: "ai_search" });
  assert.deepEqual(onboardingPipelineProfile("terms-graphrag"), { projection: "terms", target: "graphrag" });
  assert.throws(() => onboardingPipelineProfile("unknown"), /지원하지 않는/);
});

test("materializes the selected directory document as an uploadable File", async () => {
  const file = await onboardingDocumentFile(
    { name: "policy.pdf", blob_url: "/pdf/policy.pdf" },
    { fetcher: async (url) => {
      assert.equal(url, "/pdf/policy.pdf");
      return new Response(new Blob(["%PDF-1.7 test"], { type: "application/pdf" }), { status: 200 });
    } },
  );
  assert.equal(file.name, "policy.pdf");
  assert.equal(file.type, "application/pdf");
  assert.equal(await file.text(), "%PDF-1.7 test");
});

test("uses a locally selected File without fetching a mock URL", async () => {
  const selected = new File(["%PDF local"], "local.pdf", { type: "application/pdf" });
  const file = await onboardingDocumentFile(
    { name: selected.name, file: selected },
    { fetcher: async () => { throw new Error("fetch must not run"); } },
  );
  assert.equal(file, selected);
});

test("uploads every document and creates one profile per document", async () => {
  const uploads = [];
  let executionRequest;
  const apiClient = {
    uploadRagDocument: async (projectId, file, options) => {
      uploads.push({ projectId, name: file.name, target: options.target });
      return {
        document_id: `doc-${uploads.length}`,
        document_revision: 1,
        filename: file.name,
        upload_id: `rsu-${String(uploads.length).padStart(32, "0")}`,
      };
    },
    createRagPipelineExecution: async (projectId, payload) => {
      executionRequest = { projectId, payload };
      return { id: "rpe-test" };
    },
  };
  const result = await createOnboardingRagExecution({
    apiClient,
    projectId: "proj-test",
    projectName: "신규 프로젝트",
    documents: [
      { name: "one.pdf", blob_url: "/one.pdf" },
      { name: "two.pdf", blob_url: "/two.pdf" },
    ],
    pipeline: { id: "terms-ai-search" },
    fileOptions: {
      fetcher: async (url) => new Response(new Blob([`%PDF ${url}`], { type: "application/pdf" }), { status: 200 }),
    },
  });

  assert.deepEqual(result, { id: "rpe-test" });
  assert.deepEqual(uploads, [
    { projectId: "proj-test", name: "one.pdf", target: "ai_search" },
    { projectId: "proj-test", name: "two.pdf", target: "ai_search" },
  ]);
  assert.equal(executionRequest.projectId, "proj-test");
  assert.equal(executionRequest.payload.display_name, "신규 프로젝트 문서 지식화");
  assert.deepEqual(
    executionRequest.payload.documents.map((document) => document.profile),
    [
      { projection: "terms", target: "ai_search" },
      { projection: "terms", target: "ai_search" },
    ],
  );
});

test("uses the route selected for each onboarding document", async () => {
  let executionRequest;
  const uploadTargets = [];
  const apiClient = {
    uploadRagDocument: async (_projectId, file, options) => {
      uploadTargets.push(options.target);
      return {
        document_id: `doc-${file.name}`,
        document_revision: 1,
        filename: file.name,
        upload_id: `rsu-${file.name.padEnd(32, "0").slice(0, 32)}`,
      };
    },
    createRagPipelineExecution: async (_projectId, payload) => {
      executionRequest = payload;
      return { id: "rpe-routes" };
    },
  };

  await createOnboardingRagExecution({
    apiClient,
    projectId: "proj-routes",
    documents: [
      { name: "adaptive.pdf", blob_url: "/adaptive.pdf", pipelineId: "rag-graphrag" },
      { name: "terms.pdf", blob_url: "/terms.pdf", pipelineId: "terms-ai-search" },
    ],
    fileOptions: {
      fetcher: async () => new Response(new Blob(["%PDF"], { type: "application/pdf" }), { status: 200 }),
    },
  });

  assert.deepEqual(
    executionRequest.documents.map((document) => document.profile),
    [
      { projection: "adaptive", target: "graphrag" },
      { projection: "terms", target: "ai_search" },
    ],
  );
  assert.deepEqual(uploadTargets, ["graphrag", "ai_search"]);
});

test("rejects directory entries that have no retrievable source", async () => {
  await assert.rejects(
    onboardingDocumentFile({ name: "missing.pdf", path: "/mnt/legacy/docs/missing.pdf" }),
    /원본 파일 URL이 없습니다/,
  );
});
