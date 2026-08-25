import assert from "node:assert/strict";
import test from "node:test";

import {
  activeChunkIdForPage,
  adaptiveSpreadPages,
  buildCandidatePageHighlights,
  candidatePageErrorMessage,
  candidatePageCacheKey,
  chunkDisplayLabel,
  getOrCreateCandidatePageRequest,
  mergeCandidatePageItems,
  scrollCardToListTop,
  setBoundedCandidatePageCache,
  uniqueCandidatePageItems,
} from "./ragRunPage.js";

test("adaptive pages advance as two-page spreads", () => {
  assert.deepEqual(adaptiveSpreadPages(1, 100), [1, 2]);
  assert.deepEqual(adaptiveSpreadPages(3, 100), [3, 4]);
  assert.deepEqual(adaptiveSpreadPages(5, 5), [5]);
});

test("page-index-less runs ask for a new execution without a legacy fallback", () => {
  assert.equal(candidatePageErrorMessage({
    body: { code: "candidate_page_index_required" },
    message: "HTTP 409",
  }), "이 결과는 새 페이지 인덱스가 없어 표시할 수 없습니다. 문서를 다시 실행해 주세요.");
  assert.equal(candidatePageErrorMessage({ message: "network failed" }), "network failed");
});

test("candidate page cache is scoped by both candidate and page", () => {
  assert.notEqual(candidatePageCacheKey("A", 1), candidatePageCacheKey("A", 2));
  assert.notEqual(candidatePageCacheKey("A", 1), candidatePageCacheKey("B", 1));
  assert.notEqual(
    candidatePageCacheKey("A", 1, "run-1/doc-1/ref-1"),
    candidatePageCacheKey("A", 1, "run-2/doc-1/ref-1"),
  );
  assert.equal(candidatePageCacheKey("A", 1), candidatePageCacheKey("A", 1));
});

test("candidate page request is created once for the same cache key", () => {
  const cache = new Map();
  let calls = 0;
  const load = () => {
    calls += 1;
    return Promise.resolve({ items: [] });
  };
  const first = getOrCreateCandidatePageRequest(cache, "A:1", load);
  const second = getOrCreateCandidatePageRequest(cache, "A:1", load);

  assert.equal(calls, 1);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.entry.promise, second.entry.promise);
});

test("two candidate pages are requested once each", () => {
  const cache = new Map();
  const calls = [];
  adaptiveSpreadPages(1, 10).forEach((page) => {
    const key = candidatePageCacheKey("A", page);
    getOrCreateCandidatePageRequest(cache, key, () => calls.push(page));
    getOrCreateCandidatePageRequest(cache, key, () => calls.push(page));
  });
  assert.deepEqual(calls, [1, 2]);
});

test("candidate spread merges pages by chunk id", () => {
  assert.deepEqual(mergeCandidatePageItems([
    { items: [{ id: "A", preview: "one", truncated: false }, { id: "B", preview: "same", truncated: false }] },
    { items: [{ id: "B", preview: "same", truncated: false }, { id: "C", preview: "same", truncated: false }] },
  ]).map((item) => item.id), ["A", "B", "C"]);
});

test("selected chunk scrolls to the list top", () => {
  let options;
  const list = {
    scrollTop: 40,
    getBoundingClientRect: () => ({ top: 30 }),
    scrollTo: (value) => { options = value; },
  };
  scrollCardToListTop(list, { getBoundingClientRect: () => ({ top: 130 }) });
  assert.deepEqual(options, { top: 140, behavior: "smooth" });
});

test("candidate page cache evicts the oldest page instead of growing forever", () => {
  const cache = new Map();
  for (let page = 1; page <= 9; page += 1) {
    setBoundedCandidatePageCache(cache, `A:${page}`, { status: "ready", page });
  }
  assert.equal(cache.size, 8);
  assert.equal(cache.has("A:1"), false);
  assert.equal(cache.get("A:9").page, 9);
});

test("page selection retains a visible chunk or selects the first chunk", () => {
  assert.equal(activeChunkIdForPage("chunk-2", ["chunk-1", "chunk-2"]), "chunk-2");
  assert.equal(activeChunkIdForPage("old", ["chunk-1", "chunk-2"]), "chunk-1");
  assert.equal(activeChunkIdForPage("old", []), null);
});

test("chunk labels preserve the API ordinal and fall back to page order", () => {
  assert.equal(chunkDisplayLabel({ ordinal: 4 }, 0), "Chunk 5");
  assert.equal(chunkDisplayLabel({ chunk_index: 2 }, 8), "Chunk 3");
  assert.equal(chunkDisplayLabel({}, 6), "Chunk 7");
});

test("candidate page keeps only the first complete duplicate chunk", () => {
  const items = [
    { id: "first", preview: "same body", truncated: false },
    { id: "second", preview: "same body", truncated: false },
    { id: "third", preview: "different body", truncated: false },
    { id: "third", preview: "different response for a duplicate id", truncated: false },
  ];
  assert.deepEqual(
    uniqueCandidatePageItems(items).map((item) => item.id),
    ["first", "third"],
  );
});

test("candidate page does not merge truncated chunks with an equal prefix", () => {
  const items = [
    { id: "first", preview: "shared prefix", truncated: true },
    { id: "second", preview: "shared prefix", truncated: true },
  ];
  assert.equal(uniqueCandidatePageItems(items).length, 2);
});

test("every chunk remains a separate highlight even with identical coordinates", () => {
  const bbox = [0.1, 0.2, 0.5, 0.4];
  const items = [
    { id: "chunk-1", preview: "one", display_bbox: bbox, source_spans: [] },
    { id: "chunk-2", preview: "two", display_bbox: bbox, source_spans: [] },
  ];
  const firstActive = buildCandidatePageHighlights(items, "chunk-1");
  const secondActive = buildCandidatePageHighlights(items, "chunk-2");

  assert.equal(firstActive.length, 2);
  assert.deepEqual(firstActive.map((item) => item.display_bbox), [bbox, bbox]);
  assert.deepEqual(firstActive.map((item) => item.active), [true, false]);
  assert.deepEqual(firstActive.map((item) => item.display_label), ["Chunk 1", "Chunk 2"]);
  assert.deepEqual(secondActive.map((item) => item.active), [false, true]);
  assert.deepEqual(
    firstActive.map(({ active, ...item }) => item),
    secondActive.map(({ active, ...item }) => item),
  );
});
