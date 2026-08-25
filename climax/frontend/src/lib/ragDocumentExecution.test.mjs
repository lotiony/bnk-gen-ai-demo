import assert from "node:assert/strict";
import test from "node:test";
import { createRagDocumentExecution } from "./ragDocumentExecution.js";

test("creates a current-project execution from local files and per-file routes", async () => {
  const uploads = [];
  let executionRequest;
  const apiClient = {
    uploadRagDocument: async (projectId, file, options) => {
      uploads.push({ projectId, filename: file.name, target: options.target });
      return {
        document_id: `doc-${uploads.length}`,
        document_revision: 1,
        filename: file.name,
        upload_id: `rsu-${String(uploads.length).padStart(32, "0")}`,
      };
    },
    createRagPipelineExecution: async (projectId, payload) => {
      executionRequest = { projectId, payload };
      return { id: "rpe-current-project" };
    },
  };

  const result = await createRagDocumentExecution({
    apiClient,
    projectId: "rag-aisearch",
    projectName: "RAG AI Search",
    displayName: "보험약관 외 1개 지식화",
    documents: [
      { name: "policy.pdf", file: new File(["%PDF-1.7"], "policy.pdf", { type: "application/pdf" }), pipelineId: "rag-ai-search" },
      { name: "guide.docx", file: new File(["office"], "guide.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), pipelineId: "terms-graphrag" },
    ],
  });

  assert.deepEqual(result, { id: "rpe-current-project" });
  assert.deepEqual(uploads, [
    { projectId: "rag-aisearch", filename: "policy.pdf", target: "ai_search" },
    { projectId: "rag-aisearch", filename: "guide.docx", target: "graphrag" },
  ]);
  assert.equal(executionRequest.payload.display_name, "보험약관 외 1개 지식화");
  assert.deepEqual(executionRequest.payload.documents.map((item) => item.profile), [
    { projection: "adaptive", target: "ai_search" },
    { projection: "terms", target: "graphrag" },
  ]);
});

test("attaches successful uploads to a partial execution when a later upload fails", async () => {
  const uploads = [];
  let executionRequest;
  const apiClient = {
    uploadRagDocument: async (_projectId, file) => {
      uploads.push(file.name);
      if (file.name === "broken.pdf") throw new Error("upstream unavailable");
      return {
        document_id: "doc-good",
        document_revision: 1,
        filename: file.name,
        upload_id: "rsu-00000000000000000000000000000001",
      };
    },
    createRagPipelineExecution: async (projectId, payload) => {
      executionRequest = { projectId, payload };
      return { id: "rpe-partial", project_id: projectId };
    },
  };

  const result = await createRagDocumentExecution({
    apiClient,
    projectId: "project-a",
    documents: [
      { name: "good.pdf", file: new File(["%PDF-1.7"], "good.pdf"), pipelineId: "rag-ai-search" },
      { name: "broken.pdf", file: new File(["%PDF-1.7"], "broken.pdf"), pipelineId: "rag-ai-search" },
      { name: "not-tried.pdf", file: new File(["%PDF-1.7"], "not-tried.pdf"), pipelineId: "rag-ai-search" },
    ],
    createPartialExecutionOnUploadFailure: true,
  });

  assert.deepEqual(uploads, ["good.pdf", "broken.pdf"]);
  assert.equal(executionRequest.payload.documents.length, 1);
  assert.equal(executionRequest.payload.documents[0].filename, "good.pdf");
  assert.equal(executionRequest.payload.display_name, "good 지식화");
  assert.deepEqual(result.ingestion_summary, {
    requested_document_count: 3,
    accepted_document_count: 1,
    skipped_document_count: 2,
    failed_filename: "broken.pdf",
    failure_message: "upstream unavailable",
  });
  assert.match(result.ingestion_warning, /1개 문서는 처리를 시작/);
  assert.match(result.ingestion_warning, /나머지 2개 문서/);
});

test("does not create an empty execution when the first upload fails", async () => {
  let createCalled = false;
  const apiClient = {
    uploadRagDocument: async () => { throw new Error("first upload failed"); },
    createRagPipelineExecution: async () => { createCalled = true; },
  };

  await assert.rejects(() => createRagDocumentExecution({
    apiClient,
    projectId: "project-a",
    documents: [
      { name: "broken.pdf", file: new File(["%PDF-1.7"], "broken.pdf"), pipelineId: "rag-ai-search" },
    ],
  }), /first upload failed/);
  assert.equal(createCalled, false);
});

test("keeps existing callers all-or-error unless partial execution is enabled", async () => {
  let uploadCount = 0;
  let createCalled = false;
  const apiClient = {
    uploadRagDocument: async (_projectId, file) => {
      uploadCount += 1;
      if (file.name === "broken.pdf") throw new Error("later upload failed");
      return {
        document_id: "doc-good",
        document_revision: 1,
        filename: file.name,
        upload_id: "rsu-00000000000000000000000000000001",
      };
    },
    createRagPipelineExecution: async () => { createCalled = true; },
  };

  await assert.rejects(() => createRagDocumentExecution({
    apiClient,
    projectId: "project-a",
    documents: [
      { name: "good.pdf", file: new File(["%PDF-1.7"], "good.pdf"), pipelineId: "rag-ai-search" },
      { name: "broken.pdf", file: new File(["%PDF-1.7"], "broken.pdf"), pipelineId: "rag-ai-search" },
    ],
  }), /later upload failed/);
  assert.equal(uploadCount, 2);
  assert.equal(createCalled, false);
});
