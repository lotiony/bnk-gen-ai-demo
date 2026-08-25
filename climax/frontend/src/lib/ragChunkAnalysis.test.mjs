import assert from "node:assert/strict";
import { buildChunkAnalysis, fixtureUrlForSha, METRICS, normalizeChunkAnalysis } from "./ragChunkAnalysis.js";
import { groupOverlappingChunkRows, mergeContiguousChunkRects } from "./ragChunkOverlay.js";

const block = (id, text, y, extra = {}) => ({ id, page: 1, text, x: 8, y, w: 84, h: 4, heading: false, tableLike: false, ...extra });
const result = buildChunkAnalysis([{ page: 1, blocks: [
  block("1:0", "제1조 가입대상", 8, { heading: true }),
  block("1:1", "보험 가입 대상과 기준을 설명합니다.", 14),
  block("1:2", "구분 보험개시시기", 24, { tableLike: true }),
  block("1:3", "신규 가입 보험기간 첫날", 30, { tableLike: true }),
] }], { name: "actual.pdf" });

assert.equal(result.document.name, "actual.pdf");
assert.equal(result.candidates.length, 3);
assert.ok(result.candidates.every((candidate) => candidate.chunks.length && candidate.overall > 0));
assert.ok(result.candidates.flatMap((candidate) => candidate.chunks).every((chunk) => chunk.rects.every((rect) => rect.page === 1)));
assert.ok(result.candidates.some((candidate) => candidate.id === result.best.strategy_id));
assert.deepEqual(METRICS, ["Size Compliance", "Intrachunk Cohesion", "Contextual Coherence", "Block Integrity"]);
assert.ok(result.candidates.every((candidate) => Object.keys(candidate.scores).length === 4));
assert.ok(result.candidates.every((candidate) => !("Reference Consistency" in candidate.scores)));
const table = result.candidates.find((candidate) => candidate.id === "table");
assert.equal(table.overall, 75.82);
assert.ok(table.chunks.some((chunk) => chunk.block_ids.includes("1:2") && chunk.block_ids.includes("1:3")));

const pipeline = normalizeChunkAnalysis({
  best: { strategy_id: "semantic" },
  candidates: [{
    id: "semantic",
    overall: 96,
    scores: [95, 96, 97, 96],
    chunks: [{ id: "S-01", text: "실제 파이프라인 청크", page: 2, bboxes: [{ page: 2, left: 10, top: 20, width: 70, height: 8 }] }],
  }],
}, { name: "blob.pdf", sha256: "abc" });
assert.equal(result.source, "evaluation");
assert.equal(pipeline.source, "evaluation");
assert.equal(pipeline.best.strategy_id, "semantic");
assert.deepEqual(pipeline.candidates[0].chunks[0].rects[0], { page: 2, x: 10, y: 20, w: 70, h: 8 });

const actualMetrics = normalizeChunkAnalysis({
  metrics: [
    { id: "sc", label: "Size Compliance" },
    { id: "icc", label: "Intrachunk Cohesion" },
    { id: "dcc", label: "Contextual Coherence" },
    { id: "bi", label: "Block Integrity" },
  ],
  selected_chunker: "ParentChildSplitter",
  best: { strategy_id: "ParentChildSplitter" },
  candidates: [{
    id: "ParentChildSplitter",
    overall: 64.557317,
    scores: { "Size Compliance": 40.512334, "Intrachunk Cohesion": 71.522417, "Contextual Coherence": 50.900219, "Block Integrity": 98.640297 },
    chunks: [{ id: "PC-C-0001", text: "실제 child", page_start: 1, rects: [] }],
  }],
});
assert.deepEqual(actualMetrics.metrics, ["Size Compliance", "Intrachunk Cohesion", "Contextual Coherence", "Block Integrity"]);
assert.equal(actualMetrics.candidates[0].overall, 64.56);
assert.equal(actualMetrics.candidates[0].scores["Size Compliance"], 40.51);

const fixtureSha = "4078c35341414a3b9b86adb6e61f112828a6490d832dfdb4c729f7191fc7de5c";
assert.match(fixtureUrlForSha(fixtureSha), /rag-fixtures\/4078c353/);
assert.equal(fixtureUrlForSha(fixtureSha.toUpperCase()), fixtureUrlForSha(fixtureSha));
assert.equal(fixtureUrlForSha(fixtureSha.slice(0, -1) + "0"), null);
assert.equal(fixtureUrlForSha(""), null);

assert.deepEqual(mergeContiguousChunkRects([
  { page: 2, x: 10, y: 10, w: 20, h: 1 },
  { page: 2, x: 30.3, y: 10, w: 9.7, h: 1 },
  { page: 2, x: 10, y: 11.35, w: 26, h: 1 },
]), [{ page: 2, x: 10, y: 10, w: 30, h: 2.35 }]);

assert.equal(mergeContiguousChunkRects([
  { page: 2, x: 10, y: 10, w: 25, h: 1 },
  { page: 2, x: 10, y: 16, w: 25, h: 1 },
]).length, 2);

assert.equal(mergeContiguousChunkRects([
  { page: 2, x: 5, y: 20, w: 25, h: 1 },
  { page: 2, x: 60, y: 20, w: 25, h: 1 },
]).length, 2);

assert.equal(mergeContiguousChunkRects([
  { page: 2, x: 5, y: 20, w: 43, h: 1 },
  { page: 2, x: 52, y: 20, w: 43, h: 1 },
]).length, 2);

assert.equal(mergeContiguousChunkRects([
  { page: 2, x: 10, y: 20, w: 25, h: 2 },
  { page: 2, x: 10, y: 23.4, w: 25, h: 2 },
]).length, 2);

assert.deepEqual(mergeContiguousChunkRects([
  { page: 2, x: 3.6741, y: 20.506, w: 42.0915, h: 1.0026 },
  { page: 2, x: 3.6741, y: 21.8425, w: 40.765, h: 1.0026 },
  { page: 2, x: 3.6741, y: 23.179, w: 41.2483, h: 1.0026 },
  { page: 2, x: 3.6741, y: 24.5155, w: 3.9022, h: 1.0026 },
  { page: 2, x: 7.5563, y: 24.5155, w: 37.2899, h: 1.0026 },
  { page: 2, x: 3.6741, y: 25.852, w: 16.2216, h: 1.0026 },
]), [{ page: 2, x: 3.6741, y: 20.506, w: 42.0915, h: 6.3486 }]);

const groupedRows = groupOverlappingChunkRows([
  { id: "PC-C-0001", text: "개인용(공동물건)자동차보험", rects: [{ page: 1, x: 20, y: 10, w: 50, h: 8 }] },
  { id: "PC-C-0002", text: "개인용(공동물건)\u200b 자동차보험", rects: [{ page: 1, x: 20.2, y: 10.1, w: 49.8, h: 7.9 }] },
  { id: "PC-C-0003", text: "개인용(공동물건)자동차보험", rects: [{ page: 1, x: 20, y: 40, w: 50, h: 8 }] },
  { id: "PC-C-0004", text: "개인용(공동물건)자동차보험", rects: [] },
], 1);
assert.deepEqual(groupedRows.map((group) => group.chunkIds), [
  ["PC-C-0001", "PC-C-0002"],
  ["PC-C-0003"],
  ["PC-C-0004"],
]);

assert.equal(groupOverlappingChunkRows([
  { id: "A", text: "같은 문구", rects: [{ page: 1, x: 10, y: 10, w: 20, h: 4 }, { page: 1, x: 60, y: 40, w: 20, h: 4 }] },
  { id: "B", text: "같은 문구", rects: [{ page: 1, x: 10.1, y: 10.1, w: 20, h: 4 }] },
], 1).length, 2);

const rectlessGroups = groupOverlappingChunkRows([
  { id: "T-0014", source_id: "candidate_13", text: "한화손해보험주식회사", rects: [] },
  { id: "T-0015", source_id: "candidate_14", text: "한화손해보험주식회사", rects: [] },
  { id: "T-0016", source_id: "candidate_15", text: "한화손해보험주식회사", rects: [] },
  { id: "T-0017", source_id: "candidate_16", text: "한화손해보험주식회사", rects: [] },
  { id: "T-0018", source_id: "candidate_17", text: "다른 문구", rects: [] },
  { id: "T-0019", source_id: "candidate_18", text: "한화손해보험주식회사", rects: [] },
  { id: "T-0020", source_id: "candidate_20", text: "한화손해보험주식회사", rects: [] },
], 1);
assert.deepEqual(rectlessGroups.map((group) => group.chunkIds), [
  ["T-0014", "T-0015", "T-0016", "T-0017"],
  ["T-0018"],
  ["T-0019"],
  ["T-0020"],
]);
