export const chunkIdentifier = (item, fallback = null) => (
  item?.id || item?.chunk_id || item?.term_id || fallback
);

export function chunkDisplayLabel(item, index = 0) {
  const rawIndex = Number(item?.chunk_index ?? item?.ordinal);
  const displayIndex = Number.isFinite(rawIndex) && rawIndex >= 0
    ? Math.trunc(rawIndex) + 1
    : index + 1;
  return `Chunk ${displayIndex}`;
}

export function uniqueCandidatePageItems(items) {
  const seenIds = new Set();
  const seenContent = new Set();
  return (items || []).filter((item, index) => {
    const id = chunkIdentifier(item, `chunk-${index + 1}`);
    if (seenIds.has(id)) return false;
    seenIds.add(id);

    // Only compare content when the API confirms that preview contains the
    // complete chunk. Equal prefixes of truncated chunks are not duplicates.
    if (item?.truncated !== false || typeof item?.preview !== "string") return true;
    if (seenContent.has(item.preview)) return false;
    seenContent.add(item.preview);
    return true;
  });
}

export const candidatePageCacheKey = (candidate, pageNumber, resultScope = "") => (
  JSON.stringify([
    String(resultScope || ""),
    String(candidate || ""),
    Number(pageNumber),
  ])
);

export const adaptiveSpreadPages = (pageNumber, pageCount = 0) => (
  [pageNumber, pageNumber + 1].filter((value) => !pageCount || value <= pageCount)
);

export function mergeCandidatePageItems(pageData) {
  const seen = new Set();
  return (pageData || []).flatMap((data) => data?.items || [])
    .filter((item) => {
      const id = chunkIdentifier(item);
      if (!id || !seen.has(id)) {
        if (id) seen.add(id);
        return true;
      }
      return false;
    });
}

export function scrollCardToListTop(list, card) {
  if (!list || !card) return;
  list.scrollTo({
    top: list.scrollTop + card.getBoundingClientRect().top - list.getBoundingClientRect().top,
    behavior: "smooth",
  });
}

export function setBoundedCandidatePageCache(cache, key, entry, maxEntries = 8) {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > maxEntries) {
    cache.delete(cache.keys().next().value);
  }
  return entry;
}

export function getOrCreateCandidatePageRequest(cache, key, load) {
  const existing = cache.get(key);
  if (existing) return { entry: existing, created: false };
  let promise;
  try {
    promise = Promise.resolve(load());
  } catch (error) {
    promise = Promise.reject(error);
  }
  const entry = { status: "loading", promise };
  setBoundedCandidatePageCache(cache, key, entry);
  return { entry, created: true };
}

export function candidatePageErrorMessage(reason) {
  if (reason?.body?.code === "candidate_page_index_required") {
    return "이 결과는 새 페이지 인덱스가 없어 표시할 수 없습니다. 문서를 다시 실행해 주세요.";
  }
  return reason?.message || "페이지 chunk를 불러오지 못했습니다.";
}

export function activeChunkIdForPage(currentId, chunkIds) {
  if (!chunkIds.length) return null;
  return chunkIds.includes(currentId) ? currentId : chunkIds[0];
}

export function buildCandidatePageHighlights(items, activeId, scope = "") {
  return (items || []).map((item, index) => {
    const id = chunkIdentifier(item, `chunk-${index + 1}`);
    return {
      id,
      scope,
      active: id === activeId,
      display_label: chunkDisplayLabel(item, index),
      display_bbox: item.display_bbox ?? null,
    };
  });
}
