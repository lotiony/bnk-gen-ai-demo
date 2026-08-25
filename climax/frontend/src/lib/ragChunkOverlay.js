const roundRect = (value) => +Number(value).toFixed(4);

const normalizeRect = (rect) => {
  const page = Number(rect?.page);
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const w = Number(rect?.w);
  const h = Number(rect?.h);
  if (![page, x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { page, x, y, w, h };
};

const gap = (a0, a1, b0, b1) => Math.max(0, Math.max(a0, b0) - Math.min(a1, b1));
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

const shouldJoin = (a, b) => {
  if (a.page !== b.page) return false;
  const aRight = a.x + a.w;
  const bRight = b.x + b.w;
  const aBottom = a.y + a.h;
  const bBottom = b.y + b.h;
  const xGap = gap(a.x, aRight, b.x, bRight);
  const yGap = gap(a.y, aBottom, b.y, bBottom);
  const xOverlap = overlap(a.x, aRight, b.x, bRight);
  const yOverlap = overlap(a.y, aBottom, b.y, bBottom);
  const yOverlapRatio = yOverlap / Math.max(.001, Math.min(a.h, b.h));
  const xOverlapRatio = xOverlap / Math.max(.001, Math.min(a.w, b.w));
  const sameLine = yOverlapRatio >= .6
    || Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) <= Math.max(.35, Math.max(a.h, b.h) * .45);

  if (sameLine) {
    return xGap <= 1;
  }

  const leftAligned = Math.abs(a.x - b.x) <= 1;
  return yGap <= 1.1 && (xOverlapRatio >= .25 || leftAligned);
};

const union = (rects) => {
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));
  return {
    page: rects[0].page,
    x: roundRect(x),
    y: roundRect(y),
    w: roundRect(right - x),
    h: roundRect(bottom - y),
  };
};

export function mergeContiguousChunkRects(rects = []) {
  const normalized = rects.map(normalizeRect).filter(Boolean);
  if (normalized.length < 2) return normalized;

  const parents = normalized.map((_, index) => index);
  const find = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const connect = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      if (shouldJoin(normalized[left], normalized[right])) connect(left, right);
    }
  }

  const groups = new Map();
  normalized.forEach((rect, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(rect);
  });
  return [...groups.values()]
    .map(union)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

const normalizeChunkText = (chunk) => String(chunk?.text || chunk?.title || "")
  .normalize("NFKC")
  .replace(/[\s\u200b-\u200d\ufeff]+/g, "");

const rectOverlapRatio = (left, right) => {
  const width = overlap(left.x, left.x + left.w, right.x, right.x + right.w);
  const height = overlap(left.y, left.y + left.h, right.y, right.y + right.h);
  const smallerArea = Math.min(left.w * left.h, right.w * right.h);
  return smallerArea > 0 ? (width * height) / smallerArea : 0;
};

const sameRectSet = (leftRects, rightRects) => {
  if (!leftRects.length || leftRects.length !== rightRects.length) return false;
  const matched = new Set();
  return leftRects.every((left) => {
    const index = rightRects.findIndex((right, rightIndex) => (
      !matched.has(rightIndex)
      && left.page === right.page
      && rectOverlapRatio(left, right) >= .8
    ));
    if (index < 0) return false;
    matched.add(index);
    return true;
  });
};

const trailingOrdinal = (value) => {
  const match = String(value || "").match(/(?:^|[_-])(\d+)$/);
  return match ? Number(match[1]) : null;
};

const areSequentialSourceChunks = (left, right) => {
  const leftSource = trailingOrdinal(left?.source_id);
  const rightSource = trailingOrdinal(right?.source_id);
  if (leftSource !== null && rightSource !== null) return rightSource === leftSource + 1;

  const leftId = trailingOrdinal(left?.id);
  const rightId = trailingOrdinal(right?.id);
  return leftId !== null && rightId !== null && rightId === leftId + 1;
};

export function groupOverlappingChunkRows(chunks = [], pageNumber) {
  const page = Number(pageNumber);
  const groups = [];

  chunks.forEach((chunk) => {
    const textKey = normalizeChunkText(chunk);
    const rects = mergeContiguousChunkRects(
      (chunk.rects || []).filter((rect) => Number(rect.page) === page),
    );
    const spatialGroup = textKey && rects.length
      ? groups.find((group) => group.textKey === textKey && sameRectSet(group.rects, rects))
      : null;
    const previousGroup = groups.at(-1);
    const sequentialRectlessGroup = textKey && !rects.length
      && previousGroup?.textKey === textKey
      && !previousGroup.rects.length
      && areSequentialSourceChunks(previousGroup.lastChunk, chunk)
      ? previousGroup
      : null;
    const matchingGroup = spatialGroup || sequentialRectlessGroup;

    if (matchingGroup) {
      matchingGroup.chunkIds.push(chunk.id);
      matchingGroup.lastChunk = chunk;
      return;
    }

    groups.push({ chunk, chunkIds: [chunk.id], rects, textKey, lastChunk: chunk });
  });

  return groups.map(({ chunk, chunkIds }) => ({ chunk, chunkIds }));
}
