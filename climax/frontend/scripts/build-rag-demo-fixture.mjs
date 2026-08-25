import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const [sourcePath, pdfPath, outputPath] = process.argv.slice(2);
if (!sourcePath || !pdfPath || !outputPath) {
  throw new Error("usage: node scripts/build-rag-demo-fixture.mjs <chunkers.json> <document.pdf> <output.json>");
}

const normalizeText = (value) => String(value || "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\u200b-\u200d\ufeff]+/gu, "");

const validPercentRect = (rect) => {
  const values = [rect?.x, rect?.y, rect?.w, rect?.h].map(Number);
  return values.every(Number.isFinite)
    && values[0] >= 0 && values[1] >= 0
    && values[2] > 0 && values[3] > 0
    && values[0] + values[2] <= 100.01
    && values[1] + values[3] <= 100.01;
};

const saneFallbackRect = (rect, text) => {
  if (!validPercentRect(rect)) return false;
  const length = normalizeText(text).length;
  if (length >= 6 && rect.w / rect.h < .55) return false;
  if (length >= 6 && (rect.x <= .01 || rect.y <= .01 || rect.x + rect.w >= 99.99 || rect.y + rect.h >= 99.99)) return false;
  return !(rect.h > 20 && rect.w < 8);
};

const leafRects = (items, width, height, page) => {
  const seen = new Set();
  return items.flatMap(({ rect }) => {
    const normalized = {
      page,
      x: +(100 * rect.x / width).toFixed(4),
      y: +(100 * rect.y / height).toFixed(4),
      w: +(100 * rect.w / width).toFixed(4),
      h: +(100 * rect.h / height).toFixed(4),
    };
    const key = [normalized.page, normalized.x, normalized.y, normalized.w, normalized.h].join(":");
    if (!validPercentRect(normalized) || seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
};

const buildPageSearch = async (pdf, pageNumber) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  let haystack = "";
  for (const item of content.items) {
    const normalized = normalizeText(item.str);
    if (!normalized) continue;
    const [a, b, c, d] = item.transform;
    const horizontal = Math.abs(b) <= Math.max(.01, Math.abs(a) * .08)
      && Math.abs(c) <= Math.max(.01, Math.abs(d) * .08);
    if (!horizontal) continue;
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const height = Math.max(Math.hypot(transform[2], transform[3]), Number(item.height) || 1);
    const width = Math.max(Number(item.width) || 1, 1);
    const record = {
      start: haystack.length,
      end: haystack.length + normalized.length,
      normalized,
      rect: { x: transform[4], y: transform[5] - height, w: width, h: height },
    };
    haystack += normalized;
    items.push(record);
  }
  page.cleanup();
  return { page: pageNumber, width: viewport.width, height: viewport.height, haystack, items };
};

const candidateNeedles = (text, title) => {
  const target = normalizeText(text);
  const titleTarget = normalizeText(title);
  const values = [target, titleTarget];
  for (const size of [96, 72, 48, 32, 20, 12]) {
    if (target.length > size) values.push(target.slice(0, size));
  }
  return [...new Set(values.filter((value) => value.length >= 4))];
};

const matchNativeRect = (pageSearch, text, title) => {
  const target = normalizeText(text);
  const targetLength = Math.max(1, target.length);
  for (const needle of candidateNeedles(text, title)) {
    const positions = [];
    let cursor = 0;
    while (cursor <= pageSearch.haystack.length - needle.length) {
      const position = pageSearch.haystack.indexOf(needle, cursor);
      if (position < 0) break;
      positions.push(position);
      cursor = position + Math.max(1, needle.length);
    }
    if (!positions.length) continue;
    const position = positions[0];
    const end = position + needle.length;
    const matchedItems = pageSearch.items.filter((item) => item.end > position && item.start < end);
    if (!matchedItems.length) continue;
    const coverage = needle.length / targetLength;
    if (targetLength > 20 && coverage < .15) continue;
    return {
      rects: leafRects(matchedItems, pageSearch.width, pageSearch.height, pageSearch.page),
      coverage,
      method: needle === target ? "native_exact" : "native_prefix",
      occurrenceCount: positions.length,
    };
  }
  return null;
};

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await fs.readFile(pdfPath)) });
const pdf = await loadingTask.promise;
const pageSearches = new Map();
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  pageSearches.set(pageNumber, await buildPageSearch(pdf, pageNumber));
}

const diagnostics = { native: 0, sidecar: 0, hybrid: 0, direct: 0, dropped: 0 };
const correctChunk = (chunk) => {
  const pages = [...new Set((chunk.rects || []).map((rect) => Number(rect.page)).filter((page) => pageSearches.has(page)))];
  if (!pages.length && pageSearches.has(Number(chunk.page_start))) pages.push(Number(chunk.page_start));
  const nativeMatches = pages.filter((page) => page <= 2)
    .map((page) => matchNativeRect(pageSearches.get(page), chunk.text, chunk.title))
    .filter(Boolean);
  const nativeRects = nativeMatches.flatMap((match) => match.rects);
  const sidecarRects = (chunk.rects || [])
    .filter((rect) => Number(rect.page) > 2 && saneFallbackRect(rect, chunk.text));
  let rects = [...nativeRects, ...sidecarRects];
  let matchMethod;
  let confidence;
  if (nativeRects.length && sidecarRects.length) {
    matchMethod = "native_sidecar_hybrid";
    confidence = "high";
    diagnostics.hybrid += 1;
  } else if (nativeRects.length) {
    matchMethod = nativeMatches.every((match) => match.method === "native_exact") ? "native_exact" : "native_prefix";
    confidence = matchMethod === "native_exact" ? "high" : "medium";
    diagnostics.native += 1;
  } else if (sidecarRects.length) {
    matchMethod = "sidecar_verified";
    confidence = "ocr_only";
    diagnostics.sidecar += 1;
  } else {
    // Recover only an unambiguous full-text native occurrence. Prefix matches
    // are unsafe for repeated headers/footers when there is no source anchor.
    const directMatch = pages.filter((page) => page > 2)
      .map((page) => matchNativeRect(pageSearches.get(page), chunk.text, chunk.title))
      .filter(Boolean)
      .find((match) => match.method === "native_exact" && match.occurrenceCount === 1);
    rects = directMatch?.rects || [];
    matchMethod = rects.length ? "native_exact_unique" : "unmapped";
    confidence = rects.length ? "high" : "none";
    if (rects.length) diagnostics.direct += 1;
    else diagnostics.dropped += 1;
  }
  const {
    source_spans: _sourceSpans,
    ...compact
  } = chunk;
  return {
    ...compact,
    rects,
    location_status: rects.length ? "mapped" : "unmapped",
    location_match: {
      method: matchMethod,
      confidence,
      native_coverage: nativeMatches.length
        ? +Math.max(...nativeMatches.map((match) => match.coverage)).toFixed(4)
        : 0,
    },
  };
};

const candidates = source.candidates.map((candidate) => {
  const chunks = candidate.chunks.map(correctChunk);
  const mapped = chunks.filter((chunk) => chunk.rects.length).length;
  return {
    ...candidate,
    chunks,
    mapped_chunk_count: mapped,
    unmapped_chunk_count: chunks.length - mapped,
  };
});

const parents = (source.hierarchy?.parents || []).map(correctChunk);
const displayed = candidates.reduce((sum, candidate) => sum + candidate.chunks.length, 0);
const mapped = candidates.reduce((sum, candidate) => sum + candidate.mapped_chunk_count, 0);
const output = {
  ...source,
  candidates,
  hierarchy: source.hierarchy ? { ...source.hierarchy, parents } : undefined,
  location_summary: {
    displayed_chunk_count: displayed,
    mapped_chunk_count: mapped,
    unmapped_chunk_count: displayed - mapped,
    policy: "page 1-2 PDF-native leaf rects; verified page 3+ sidecar rects; only unique exact native direct recovery; invalid/ghost anchors omitted",
  },
  visualization_bbox: {
    version: 3,
    method: "pdfjs-native-leaf-hybrid",
    diagnostics,
  },
};

await loadingTask.destroy();
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(output) + "\n", "utf8");
console.log(JSON.stringify({ output: path.resolve(outputPath), bytes: (await fs.stat(outputPath)).size, diagnostics }, null, 2));
