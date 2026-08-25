const TARGET_CHARS = 800;

export const METRICS = [
  "Size Compliance",
  "Intrachunk Cohesion",
  "Contextual Coherence",
  "Block Integrity",
];

export const ACTUAL_RAG_FIXTURES = Object.freeze({
  "4078c35341414a3b9b86adb6e61f112828a6490d832dfdb4c729f7191fc7de5c":
    "/api/rag-data/rag-fixtures/4078c35341414a3b9b86adb6e61f112828a6490d832dfdb4c729f7191fc7de5c/chunkers.json",
});

export const fixtureUrlForSha = (sha256, fixtures = ACTUAL_RAG_FIXTURES) =>
  fixtures[String(sha256 || "").trim().toLowerCase()] || null;

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundPipeline = (value) => Math.round(clamp(Number(value) || 0) * 100) / 100;
const clean = (text = "") => text.replace(/\s+/g, " ").trim();
const isHeading = (text) => text.length < 90 && (/^(제\s*\d+\s*조|\d+(?:\.\d+)*[.)]\s*[^.!?]{0,55}$|<[^>]{1,40}>$|[가-힣A-Z]{2,24}$)/.test(text));

function unionRects(blocks) {
  const byPage = new Map();
  blocks.forEach((block) => {
    const rect = byPage.get(block.page) || { page: block.page, x: 100, y: 100, right: 0, bottom: 0 };
    rect.x = Math.min(rect.x, block.x);
    rect.y = Math.min(rect.y, block.y);
    rect.right = Math.max(rect.right, block.x + block.w);
    rect.bottom = Math.max(rect.bottom, block.y + block.h);
    byPage.set(block.page, rect);
  });
  return [...byPage.values()].map(({ page, x, y, right, bottom }) => ({
    page,
    x: +x.toFixed(2),
    y: +y.toFixed(2),
    w: +(right - x).toFixed(2),
    h: +(bottom - y).toFixed(2),
  }));
}

function chunkFromBlocks(blocks, prefix, index) {
  const text = clean(blocks.map((block) => block.text).join("\n"));
  const first = blocks[0];
  const last = blocks.at(-1);
  return {
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    title: clean(first?.text || "Chunk").slice(0, 54),
    text,
    chars: text.length,
    page_start: first?.page || 1,
    page_end: last?.page || first?.page || 1,
    block_ids: blocks.map((block) => block.id),
    rects: unionRects(blocks),
  };
}

function groupTableBlocks(blocks) {
  const tableBlockIds = new Set();
  const byPage = Map.groupBy(blocks, (block) => block.page);
  byPage.forEach((pageBlocks) => {
    const indexes = pageBlocks.map((block, index) => block.tableLike ? index : -1).filter((index) => index >= 0);
    let cluster = [];
    const protect = () => {
      if (cluster.length < 2) return;
      for (let index = Math.max(0, cluster[0] - 1); index <= Math.min(pageBlocks.length - 1, cluster.at(-1) + 1); index += 1) tableBlockIds.add(pageBlocks[index].id);
    };
    indexes.forEach((index) => {
      if (cluster.length && index - cluster.at(-1) > 4) { protect(); cluster = []; }
      cluster.push(index);
    });
    protect();
  });

  const groups = [];
  let current = [];
  const flush = () => { if (current.length) groups.push(current); current = []; };
  blocks.forEach((block) => {
    const previous = current.at(-1);
    const protectedTable = tableBlockIds.has(block.id);
    const currentTable = current.some((item) => tableBlockIds.has(item.id));
    const chars = current.reduce((sum, item) => sum + item.text.length + 1, 0);
    if (current.length && (previous.page !== block.page || protectedTable !== currentTable || chars + block.text.length > (protectedTable ? 1800 : 950))) flush();
    current.push(block);
  });
  flush();
  return groups;
}

function groupBlocks(blocks, strategy) {
  if (strategy === "table") return groupTableBlocks(blocks);
  const groups = [];
  let current = [];
  let chars = 0;
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
    chars = 0;
  };

  blocks.forEach((block) => {
    const previous = current.at(-1);
    const nextChars = chars + block.text.length + 1;
    const pageBreak = previous && previous.page !== block.page;
    const semanticBreak = strategy === "semantic" && current.length && block.heading;
    const limit = strategy === "recursive" ? TARGET_CHARS : 950;
    if (pageBreak || semanticBreak || (current.length && nextChars > limit)) flush();
    current.push(block);
    chars += block.text.length + 1;
  });
  flush();
  return groups;
}

function tableIntegrity(chunks, blocks) {
  const tableBlocks = blocks.filter((block) => block.tableLike);
  if (!tableBlocks.length) return 100;
  const chunkByBlock = new Map();
  chunks.forEach((chunk, index) => chunk.block_ids.forEach((id) => chunkByBlock.set(id, index)));
  let intact = 0;
  for (let i = 0; i < tableBlocks.length; i += 1) {
    const previous = tableBlocks[i - 1];
    if (!previous || previous.page !== tableBlocks[i].page || chunkByBlock.get(previous.id) === chunkByBlock.get(tableBlocks[i].id)) intact += 1;
  }
  return (100 * intact) / tableBlocks.length;
}

function scoreCandidate(chunks, blocks) {
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const size = average(chunks.map((chunk) => 100 - (Math.abs(chunk.chars - TARGET_CHARS) / TARGET_CHARS) * 70));
  const cohesion = average(chunks.map((chunk) => {
    const source = chunk.block_ids.map((id) => blockById.get(id)).filter(Boolean);
    if (source.length < 2) return 92;
    const local = source.slice(1).filter((block, index) => block.page === source[index].page && block.y - (source[index].y + source[index].h) < 8).length;
    return 58 + (34 * local) / (source.length - 1);
  }));
  const coherence = average(chunks.map((chunk) => {
    const first = blocks.find((block) => block.id === chunk.block_ids[0]);
    const startsClean = first?.heading || first?.y < 12;
    const endsClean = /[.!?。]|다[.]?$/.test(chunk.text);
    return 58 + (startsClean ? 22 : 0) + (endsClean ? 20 : 0);
  }));
  const integrity = tableIntegrity(chunks, blocks);
  const scores = {
    "Size Compliance": roundPipeline(size),
    "Intrachunk Cohesion": roundPipeline(cohesion),
    "Contextual Coherence": roundPipeline(coherence),
    "Block Integrity": roundPipeline(integrity),
  };
  return { scores, overall: roundPipeline(average(Object.values(scores))) };
}

const DEFINITIONS = {
  table: {
    label: "Table chunk",
    tone: "var(--blue)",
    description: "PDF 좌표에서 열 간격이 반복되는 표 영역을 묶고, 일반 본문은 레이아웃 블록 경계로 보존합니다.",
    descriptionEn: "Keeps table-like rows together from PDF coordinates and preserves layout block boundaries for prose.",
    prefix: "T",
  },
  semantic: {
    label: "Semantic chunk",
    tone: "var(--purple)",
    description: "제목·조항·문장 경계를 감지해 의미 단위로 묶습니다.",
    descriptionEn: "Groups content by detected headings, clauses, and sentence boundaries.",
    prefix: "S",
  },
  recursive: {
    label: "RecursiveCharacter",
    tone: "var(--navy)",
    description: `페이지와 텍스트 블록을 유지하면서 ${TARGET_CHARS}자 목표로 재귀 분할합니다.`,
    descriptionEn: `Splits toward ${TARGET_CHARS} characters while preserving page and text-block boundaries.`,
    prefix: "R",
  },
};

export function buildChunkAnalysis(pages, document = {}) {
  const blocks = pages.flatMap((page) => page.blocks || []).filter((block) => clean(block.text));
  if (!blocks.length) throw new Error("PDF에서 분석 가능한 텍스트를 찾지 못했습니다. OCR PDF가 필요합니다.");

  const candidates = Object.entries(DEFINITIONS).map(([id, definition]) => {
    const chunks = groupBlocks(blocks, id).map((group, index) => chunkFromBlocks(group, definition.prefix, index));
    return { id, ...definition, chunks, ...scoreCandidate(chunks, blocks) };
  });
  const best = [...candidates].sort((a, b) => b.overall - a.overall)[0];
  return {
    version: 1,
    source: "evaluation",
    document: { ...document, page_count: pages.length, block_count: blocks.length },
    metrics: METRICS,
    candidates,
    best: { strategy_id: best.id, label: best.label, score: best.overall },
  };
}

export function normalizeChunkAnalysis(payload, document = {}) {
  const rawMetricDefinitions = Array.isArray(payload?.metrics) && payload.metrics.length ? payload.metrics : METRICS;
  const metricDefinitions = rawMetricDefinitions.map((metric) => {
    if (typeof metric === "string") return { id: metric.toLowerCase().replaceAll(" ", "_"), label: metric };
    const id = metric?.id || metric?.key || metric?.label;
    return { ...metric, id, label: metric?.label || id };
  }).filter((metric) => metric.id && metric.label);
  const metricLabels = metricDefinitions.map((metric) => metric.label);
  const rawCandidates = Array.isArray(payload?.candidates)
    ? payload.candidates
    : Object.entries(payload?.strategies || {}).map(([id, candidate]) => ({ id, ...candidate }));
  if (!rawCandidates.length) throw new Error("chunker JSON에 candidates가 없습니다.");
  const candidates = rawCandidates.map((candidate, candidateIndex) => {
    const id = candidate.id || candidate.strategy || `candidate-${candidateIndex + 1}`;
    const definition = DEFINITIONS[id] || {};
    const rawScores = candidate.scores || candidate.metrics || {};
    const scoreScale = candidate.score_scale || payload.score_scale;
    const normalizedScore = (value) => roundPipeline(scoreScale === "ratio" ? Number(value) * 100 : value);
    const scores = Array.isArray(rawScores)
      ? Object.fromEntries(metricDefinitions.map((metric, index) => [metric.label, normalizedScore(rawScores[index] || 0)]))
      : Object.fromEntries(metricDefinitions.map((metric) => {
        const snakeLabel = metric.label.toLowerCase().replaceAll(" ", "_");
        return [metric.label, normalizedScore(rawScores[metric.label] ?? rawScores[metric.id] ?? rawScores[snakeLabel] ?? 0)];
      }));
    const overall = normalizedScore(candidate.overall ?? candidate.score
      ?? Object.values(scores).reduce((sum, score) => sum + score, 0) / Math.max(1, metricDefinitions.length));
    const chunks = (candidate.chunks || []).map((chunk, chunkIndex) => {
      const text = clean(chunk.text || chunk.content || "");
      const pageStart = chunk.page_start || chunk.page || chunk.metadata?.page || 1;
      return {
        ...chunk,
        id: chunk.id || `${definition.prefix || "C"}-${String(chunkIndex + 1).padStart(2, "0")}`,
        title: chunk.title || text.slice(0, 54) || `Chunk ${chunkIndex + 1}`,
        text,
        chars: chunk.chars ?? text.length,
        page_start: pageStart,
        page_end: chunk.page_end || pageStart,
        rects: (chunk.rects || chunk.bboxes || []).map((rect) => ({
          page: rect.page || pageStart,
          x: rect.x ?? rect.left ?? 0,
          y: rect.y ?? rect.top ?? 0,
          w: rect.w ?? rect.width ?? 0,
          h: rect.h ?? rect.height ?? 0,
        })),
      };
    });
    return {
      id,
      label: candidate.label || definition.label || id,
      tone: definition.tone || candidate.tone || "var(--blue)",
      description: candidate.description || definition.description || "파이프라인 chunker JSON 결과입니다.",
      descriptionEn: candidate.descriptionEn || definition.descriptionEn || "Chunker result loaded from the pipeline JSON.",
      chunks,
      scores,
      overall,
    };
  });
  const requestedBest = typeof payload.best === "string" ? payload.best : payload.best?.strategy_id || payload.best_strategy;
  const best = candidates.find((candidate) => candidate.id === requestedBest) || [...candidates].sort((a, b) => b.overall - a.overall)[0];
  return {
    version: payload.version || 1,
    source: "evaluation",
    document: { ...(payload.document || {}), ...document },
    metrics: metricLabels,
    metricDefinitions,
    candidates,
    best: { strategy_id: best.id, label: best.label, score: best.overall },
  };
}

export async function hashBlob(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function textItemsToBlocks(items, pageNumber, viewport, pdfjsLib) {
  const positioned = items.filter((item) => clean(item.str)).map((item, index) => {
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const height = Math.max(Math.hypot(transform[2], transform[3]), item.height || 1);
    const width = Math.max((item.width || 1) * viewport.scale, 1);
    return { id: `${pageNumber}:${index}`, text: clean(item.str), left: transform[4], top: transform[5] - height, width, height };
  }).sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];
  positioned.forEach((item) => {
    const line = lines.findLast((candidate) => Math.abs(candidate.top - item.top) <= Math.max(2, item.height * .55));
    if (line) line.items.push(item);
    else lines.push({ top: item.top, items: [item] });
  });

  return lines.map((line, index) => {
    const row = line.items.sort((a, b) => a.left - b.left);
    const left = Math.min(...row.map((item) => item.left));
    const right = Math.max(...row.map((item) => item.left + item.width));
    const top = Math.min(...row.map((item) => item.top));
    const bottom = Math.max(...row.map((item) => item.top + item.height));
    const gaps = row.slice(1).filter((item, itemIndex) => item.left - (row[itemIndex].left + row[itemIndex].width) > Math.max(18, item.height * 2.2)).length;
    const text = clean(row.reduce((merged, item, itemIndex) => {
      if (!itemIndex) return item.text;
      let overlap = Math.min(merged.length, item.text.length);
      while (overlap && !merged.endsWith(item.text.slice(0, overlap))) overlap -= 1;
      const previous = row[itemIndex - 1];
      const gap = item.left - (previous.left + previous.width);
      return merged + (overlap ? item.text.slice(overlap) : `${gap > 1.5 ? " " : ""}${item.text}`);
    }, ""));
    return {
      id: `${pageNumber}:${index}`,
      page: pageNumber,
      text,
      x: clamp((100 * left) / viewport.width),
      y: clamp((100 * top) / viewport.height),
      w: clamp((100 * (right - left)) / viewport.width),
      h: clamp((100 * (bottom - top)) / viewport.height),
      heading: isHeading(text),
      tableLike: gaps >= 1,
    };
  });
}

export async function analyzePdfBlob(blob, name, pdfjsLib, knownSha256 = null) {
  const bytes = await blob.arrayBuffer();
  const digest = knownSha256 ? null : await crypto.subtle.digest("SHA-256", bytes.slice(0));
  const sha256 = knownSha256 || [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pages.push({ page: pageNumber, blocks: textItemsToBlocks(content.items, pageNumber, viewport, pdfjsLib) });
      page.cleanup();
    }
    return buildChunkAnalysis(pages, { name, sha256, size: blob.size, type: blob.type || "application/pdf" });
  } finally {
    await loadingTask.destroy();
  }
}
