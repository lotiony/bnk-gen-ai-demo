import assert from "node:assert/strict";
import test from "node:test";
import {
  pipelineNavigation,
  projectPipelineNavigations,
  projectRagNavigation,
  projectTargetNavigation,
  updateProjectPipelineRoutes,
} from "./projectPipelineRoutes.js";

test("maps all onboarding paths without treating Terms as RAG", () => {
  const assignment = { documentName: "fixture.pdf", documentPath: "/docs/fixture.pdf", pipelineId: "rag-ai-search" };
  assert.deepEqual(pipelineNavigation(assignment, "p1"), {
    pipelineId: "rag-ai-search", pipelineMode: "rag", sourceMode: "rag", projectId: "p1", documentName: "fixture.pdf", documentPath: "/docs/fixture.pdf",
  });
  assert.equal(pipelineNavigation({ ...assignment, pipelineId: "rag-graphrag" }, "p1").sourceMode, "rag");
  assert.equal(pipelineNavigation({ ...assignment, pipelineId: "terms-ai-search" }, "p1").sourceMode, "terms");
  assert.equal(pipelineNavigation({ ...assignment, pipelineId: "terms-graphrag" }, "p1").sourceMode, "terms");
});

test("restores the selected document for each pipeline assignment", () => {
  const routes = updateProjectPipelineRoutes([], {
    projectId: "rag-project",
    assignments: [
      { documentName: "rag.pdf", documentPath: "/docs/rag.pdf", pipelineId: "rag-graphrag" },
      { documentName: "terms.pdf", documentPath: "/docs/terms.pdf", pipelineId: "terms-ai-search" },
    ],
    updatedAt: 10,
  });
  const ragNav = projectRagNavigation(routes, "rag-project");
  assert.equal(ragNav.pipelineId, "rag-graphrag");
  assert.equal(ragNav.sourceMode, "rag");
  assert.equal(ragNav.documentName, "rag.pdf");
  assert.equal(ragNav.documentPath, "/docs/rag.pdf");

  const termsOnly = updateProjectPipelineRoutes([], {
    projectId: "terms-project",
    assignments: [{ documentName: "terms.pdf", documentPath: "/docs/terms.pdf", pipelineId: "terms-ai-search" }],
  });
  assert.equal(projectRagNavigation(termsOnly, "terms-project"), null);
});

test("prefers the RAG source when RAG and Terms share a target", () => {
  const routes = updateProjectPipelineRoutes([], {
    projectId: "mixed",
    assignments: [
      { documentName: "terms-search.pdf", documentPath: "/docs/terms-search.pdf", pipelineId: "terms-ai-search" },
      { documentName: "rag-search.pdf", documentPath: "/docs/rag-search.pdf", pipelineId: "rag-ai-search" },
      { documentName: "terms-graph.pdf", documentPath: "/docs/terms-graph.pdf", pipelineId: "terms-graphrag" },
      { documentName: "rag-graph.pdf", documentPath: "/docs/rag-graph.pdf", pipelineId: "rag-graphrag" },
    ],
  });
  assert.deepEqual(projectTargetNavigation(routes, "mixed", "rag"), {
    pipelineId: "rag-ai-search", pipelineMode: "rag", sourceMode: "rag", projectId: "mixed", documentName: "rag-search.pdf", documentPath: "/docs/rag-search.pdf",
  });
  assert.deepEqual(projectTargetNavigation(routes, "mixed", "graphrag"), {
    pipelineId: "rag-graphrag", pipelineMode: "graphrag", sourceMode: "rag", projectId: "mixed", documentName: "rag-graph.pdf", documentPath: "/docs/rag-graph.pdf",
  });
});

test("keeps duplicate filenames distinct by their assigned paths", () => {
  const routes = updateProjectPipelineRoutes([], {
    projectId: "p1",
    assignments: [
      { documentName: "guide.pdf", documentPath: "/legal/guide.pdf", pipelineId: "rag-ai-search" },
      { documentName: "guide.pdf", documentPath: "/product/guide.pdf", pipelineId: "rag-ai-search" },
    ],
  });
  assert.deepEqual(routes[0].assignments, [
    { documentName: "guide.pdf", documentPath: "/legal/guide.pdf", pipelineId: "rag-ai-search" },
    { documentName: "guide.pdf", documentPath: "/product/guide.pdf", pipelineId: "rag-ai-search" },
  ]);
  assert.deepEqual(projectPipelineNavigations(routes, "p1").map(({ documentName, documentPath }) => ({ documentName, documentPath })), [
    { documentName: "guide.pdf", documentPath: "/legal/guide.pdf" },
    { documentName: "guide.pdf", documentPath: "/product/guide.pdf" },
  ]);
});
