const CANDIDATE_TONES = ["var(--blue)", "var(--purple)", "var(--amber)", "var(--red)"];

export const candidateTone = (candidate, index) => candidate?.selected
  ? "var(--green)"
  : CANDIDATE_TONES[Math.max(0, index) % CANDIDATE_TONES.length];

export function artifactReference(value) {
  if (!value || typeof value !== "object") return null;
  if (value.artifact_ref) return value.artifact_ref;
  if (Array.isArray(value)) return value.map(artifactReference).find(Boolean) || null;
  return Object.values(value).map(artifactReference).find(Boolean) || null;
}

export function normalizedRect(item) {
  const box = item?.locator?.bbox || item?.normalized_bbox || item?.bbox;
  if (!box) return null;
  if (Array.isArray(box) && box.length >= 4) {
    const [left, top, right, bottom] = box.map(Number);
    if (![left, top, right, bottom].every(Number.isFinite)) return null;
    if (Math.max(left, top, right, bottom) > 1.0001) return null;
    return {
      x: left * 100,
      y: top * 100,
      width: Math.max(0, right - left) * 100,
      height: Math.max(0, bottom - top) * 100,
    };
  }
  const x = Number(box.x ?? box.left);
  const y = Number(box.y ?? box.top);
  const width = Number(box.w ?? box.width ?? (Number(box.right) - x));
  const height = Number(box.h ?? box.height ?? (Number(box.bottom) - y));
  if (![x, y, width, height].every(Number.isFinite)
      || Math.max(x, y, width, height) > 1.0001) return null;
  return {
    x: x * 100,
    y: y * 100,
    width: Math.max(0, width) * 100,
    height: Math.max(0, height) * 100,
  };
}

export const ADAPTIVE_METRICS = [
  ["sc", "Size Compliance"],
  ["icc", "Intrachunk Cohesion"],
  ["dcc", "Contextual Coherence"],
  ["bi", "Block Integrity"],
];

export const percentScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
};

export const profileLabel = (item) => (
  `${item?.projection === "terms" ? "Terms" : "Adaptive"} → ${item?.target === "graphrag" ? "GraphRAG" : "AI Search"}`
);

export function includeCurrentResult(items, currentResult, currentReferenceId) {
  const values = Array.isArray(items) ? items : [];
  if (values.some((item) => item.reference_id === currentReferenceId)) return values;
  if (!currentResult || currentResult.reference_id !== currentReferenceId) return values;
  return [currentResult, ...values];
}

const graphEntityKey = (entity) => String(
  entity?.id || entity?.entity_id || entity?.name || entity?.label || JSON.stringify(entity),
);

export function graphData(entities, relations) {
  const nodes = (entities || []).map((entity, index) => {
    const id = graphEntityKey(entity) || `entity-${index}`;
    return {
      id,
      labels: [entity.name || entity.label || id],
      properties: {
        ...entity,
        entity_type: entity.type || entity.entity_type || "unknown",
        source_id: (entity.source_chunk_ids || []).join("<SEP>"),
      },
    };
  });
  const known = new Set(nodes.map((node) => node.id));
  const edges = (relations || []).map((relation, index) => ({
    id: String(relation.id || relation.relation_id || `relation-${index}`),
    source: String(relation.source || relation.src_id || ""),
    target: String(relation.target || relation.tgt_id || ""),
    properties: relation,
  })).filter((edge) => (
    known.has(edge.source) && known.has(edge.target) && edge.source !== edge.target
  ));
  return { nodes, edges, chunks: [] };
}
