import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphRagGraph, graphRagAnswerGraph, graphRagChunksForSource, graphRagCitationEntities, graphRagContextFlow, graphRagReferenceFiles, graphRagReferenceLine, graphRagUrl, GRAPH_TYPE_COLORS } from "./graphragGraph.js";

test("builds the LightRAG graphology model and skips duplicate pairs", () => {
  const graph = buildGraphRagGraph({
    nodes: [
      { id: "a", labels: ["A"], properties: { entity_type: "concept" } },
      { id: "b", labels: ["B"], properties: { entity_type: "person" } },
    ],
    edges: [
      { id: "e1", source: "a", target: "b", properties: { weight: 2, keywords: "관계" } },
      { id: "e2", source: "b", target: "a", properties: {} },
      { id: "e3", source: "a", target: "missing", properties: {} },
    ],
  });

  assert.equal(graph.order, 2);
  assert.equal(graph.size, 1);
  assert.equal(graph.getNodeAttribute("a", "color"), GRAPH_TYPE_COLORS.concept);
  assert.equal(graph.getEdgeAttribute("e1", "label"), "관계");
});

test("requests only the climax_ko workspace", () => {
  const url = new URL(graphRagUrl(), "http://localhost");
  assert.equal(url.searchParams.get("workspace"), "climax_ko");
  assert.equal(url.searchParams.get("label"), "*");
  assert.equal(url.searchParams.get("max_nodes"), "1000");
});

test("orders context entities and finds the relationship path to the next entity", () => {
  const flow = graphRagContextFlow({
    entities: [
      { entity_name: "보험상품", entity_type: "concept", description: "보험 상품" },
      { entity_name: "보험료", entity_type: "concept", description: "납입 금액" },
    ],
    relationships: [
      { src_id: "보험상품", tgt_id: "보험계약", keywords: "가입", weight: 2 },
      { src_id: "보험계약", tgt_id: "보험료", keywords: "납입" },
    ],
  });

  assert.equal(flow[0].order, 1);
  assert.deepEqual(flow[0].pathToNext.nodes, ["보험상품", "보험계약", "보험료"]);
  assert.equal(flow[0].pathToNext.relations[1].keywords, "납입");
  assert.equal(flow[1].pathToNext, null);
});

test("keeps only answer entities from the clicked reference", () => {
  const graph = graphRagAnswerGraph({
    entities: [
      { entity_name: "보험증권", entity_type: "content", file_path: "자동차보험.pdf" },
      { entity_name: "운전 가능 범위", entity_type: "concept", file_path: "자동차보험.pdf" },
      { entity_name: "보험료", entity_type: "concept", file_path: "다른문서.pdf" },
    ],
    relationships: [
      { src_id: "보험증권", tgt_id: "운전 가능 범위", file_path: "자동차보험.pdf" },
      { src_id: "운전 가능 범위", tgt_id: "보험료", file_path: "다른문서.pdf" },
    ],
  }, "보험증권의 운전 가능 범위를 확인합니다. 보험료는 별도입니다.", "자동차보험.pdf");

  assert.deepEqual(graph.nodes.map((node) => node.id), ["보험증권", "운전 가능 범위"]);
  assert.equal(graph.edges.length, 1);
});

test("falls back to reference entities when answer and graph languages differ", () => {
  const graph = graphRagAnswerGraph({
    entities: [
      { entity_name: "Insurance Company", file_path: "자동차보험.pdf" },
      { entity_name: "Insurance Proceeds", file_path: "자동차보험.pdf" },
      { entity_name: "Other", file_path: "다른문서.pdf" },
    ],
    relationships: [
      { src_id: "Insurance Company", tgt_id: "Insurance Proceeds", file_path: "자동차보험.pdf" },
    ],
  }, "보험금 지급 방법입니다.", "자동차보험.pdf");

  assert.deepEqual(graph.nodes.map((node) => node.id), [
    "Insurance Company", "Insurance Proceeds",
  ]);
  assert.equal(graph.edges.length, 1);
});

test("maps each inline reference to entities used by its preceding claim", () => {
  const data = {
    entities: [
      { entity_name: "보험금", file_path: "자동차보험.pdf", source_id: "chunk-a" },
      { entity_name: "피보험자", file_path: "자동차보험.pdf", source_id: "chunk-missing" },
      { entity_name: "보험료", file_path: "다른문서.pdf", source_id: "chunk-b" },
    ],
    chunks: [{ chunk_id: "chunk-a" }, { chunk_id: "chunk-b" }],
  };
  const line = "보험금은 피보험자에게 지급됩니다. [1] 보험료는 별도입니다. [2]";

  assert.deepEqual(graphRagCitationEntities(data, line, line.indexOf("[1]"), "자동차보험.pdf"), ["보험금"]);
  assert.deepEqual(graphRagCitationEntities(data, line, line.indexOf("[2]"), "다른문서.pdf"), ["보험료"]);
});

test("normalizes plain, Markdown, and response-metadata file references", () => {
  assert.deepEqual(graphRagReferenceLine("↗ [1] 자동차보험.pdf"), { number: "1", fileName: "자동차보험.pdf" });
  assert.deepEqual(graphRagReferenceLine("[2] [약관.pdf](https://example.com/terms.pdf)"), { number: "2", fileName: "약관.pdf" });
  assert.deepEqual([...graphRagReferenceFiles("[1] 자동차보험.pdf", [
    { reference_id: 2, file_path: "/docs/약관.pdf" },
  ])], [["2", "약관.pdf"], ["1", "자동차보험.pdf"]]);
});

test("finds retrieved source chunks linked to an entity", () => {
  const chunks = [
    { chunk_id: "chunk-a", content: "첫 원문" },
    { chunk_id: "chunk-b", content: "둘째 원문" },
    { chunk_id: "chunk-c", content: "다른 원문" },
  ];
  assert.deepEqual(graphRagChunksForSource(chunks, "chunk-a<SEP>chunk-b").map((chunk) => chunk.content), ["첫 원문", "둘째 원문"]);
});
