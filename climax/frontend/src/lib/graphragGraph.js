import Graph from "graphology";

export const GRAPH_RAG_WORKSPACE = "climax_ko";

export const GRAPH_TYPE_COLORS = {
  person: "#4169E1",
  creature: "#bd7ebe",
  organization: "#00cc00",
  location: "#cf6d17",
  event: "#00bfa0",
  concept: "#e3493b",
  method: "#b71c1c",
  content: "#0f558a",
  data: "#0000ff",
  artifact: "#4421af",
  naturalobject: "#b2e061",
  other: "#f4d371",
  unknown: "#b0b0b0",
};

export const GRAPH_TYPE_LABELS = {
  person: "Person",
  creature: "Creature",
  organization: "Organization",
  location: "Location",
  event: "Event",
  concept: "Concept",
  method: "Method",
  content: "Content",
  data: "Data",
  artifact: "Artifact",
  naturalobject: "Natural Object",
  other: "Other",
  unknown: "Unknown",
};

const positionFor = (id) => {
  const value = String(id);
  let x = 3735928559 ^ value.length;
  let y = 1103547991 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    x = Math.imul(x ^ code, 2654435761);
    y = Math.imul(y ^ code, 1597334677);
  }
  x = Math.imul(x ^ (x >>> 16), 2246822507) ^ Math.imul(y ^ (y >>> 13), 3266489909);
  y = Math.imul(y ^ (y >>> 16), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909);
  return { x: (x >>> 0) / 4294967296, y: (y >>> 0) / 4294967296 };
};

const graphType = (value) => {
  const type = String(value || "unknown").toLowerCase().replace(/[\s_-]+/g, "");
  return GRAPH_TYPE_COLORS[type] ? type : "unknown";
};

export function buildGraphRagGraph(data = {}) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const graph = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  const degree = new Map(nodes.map((node) => [String(node.id), 0]));

  edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) return;
    degree.set(source, (degree.get(source) || 0) + 1);
    degree.set(target, (degree.get(target) || 0) + 1);
  });

  const values = [...degree.values()];
  const minDegree = Math.min(...values, 0);
  const maxDegree = Math.max(...values, 0);
  const range = maxDegree - minDegree;

  nodes.forEach((node) => {
    const id = String(node.id);
    if (graph.hasNode(id)) return;
    const type = graphType(node.properties?.entity_type);
    const nodeDegree = degree.get(id) || 0;
    graph.addNode(id, {
      ...positionFor(id),
      label: Array.isArray(node.labels) ? node.labels.join(", ") : String(node.labels || id),
      size: range ? Math.round(4 + 16 * Math.sqrt((nodeDegree - minDegree) / range)) : 10,
      color: GRAPH_TYPE_COLORS[type],
      borderColor: "#ffffff",
      type: "border",
      entityType: type,
      properties: node.properties || {},
    });
  });

  edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if (source === target || !graph.hasNode(source) || !graph.hasNode(target) || graph.hasEdge(source, target)) return;
    graph.addUndirectedEdgeWithKey(String(edge.id), source, target, {
      label: edge.properties?.keywords || "",
      color: "#d3d3d3",
      size: Math.max(0.5, Number(edge.properties?.weight) || 1),
      properties: edge.properties || {},
    });
  });

  return graph;
}

export function graphRagContextFlow(data = {}) {
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const relationships = Array.isArray(data.relationships) ? data.relationships : [];
  const adjacency = new Map();
  relationships.forEach((relation) => {
    const source = String(relation.src_id);
    const target = String(relation.tgt_id);
    if (!adjacency.has(source)) adjacency.set(source, []);
    if (!adjacency.has(target)) adjacency.set(target, []);
    adjacency.get(source).push({ node: target, relation });
    adjacency.get(target).push({ node: source, relation });
  });

  const pathBetween = (source, target) => {
    const queue = [source];
    const parent = new Map([[source, null]]);
    for (let index = 0; index < queue.length && !parent.has(target); index += 1) {
      for (const edge of adjacency.get(queue[index]) || []) {
        if (parent.has(edge.node)) continue;
        parent.set(edge.node, { node: queue[index], relation: edge.relation });
        queue.push(edge.node);
      }
    }
    if (!parent.has(target)) return null;
    const nodes = [target];
    const relations = [];
    while (nodes[0] !== source) {
      const step = parent.get(nodes[0]);
      relations.unshift(step.relation);
      nodes.unshift(step.node);
    }
    return { nodes, relations };
  };

  return entities.map((entity, index) => ({
    ...entity,
    order: index + 1,
    pathToNext: entities[index + 1]
      ? pathBetween(String(entity.entity_name), String(entities[index + 1].entity_name))
      : null,
  }));
}

export function graphRagReferenceLine(line = "") {
  const match = /^\s*(?:[-*]\s*)?(?:↗\s*)?\[(\d+)\]\s+(?:\[([^\]]+\.pdf)\]\([^)]+\)|(.+?\.pdf))(?:\s+.*)?$/i.exec(String(line));
  return match ? { number: match[1], fileName: match[2] || match[3] } : null;
}

export function graphRagReferenceFiles(answer = "", references = []) {
  const files = new Map();
  (Array.isArray(references) ? references : []).forEach((reference, index) => {
    const value = typeof reference === "string" ? reference
      : reference?.file_path || reference?.file_name || reference?.path || reference?.source || reference?.document_name;
    if (!value) return;
    const id = String(typeof reference === "object" && reference
      ? reference.reference_id ?? reference.id ?? reference.number ?? index + 1
      : index + 1).replace(/\D/g, "") || String(index + 1);
    files.set(id, String(value).split(/[\\/]/).pop().split(/[?#]/)[0]);
  });
  String(answer).split(/\r?\n/).forEach((line) => {
    const reference = graphRagReferenceLine(line);
    if (reference) files.set(reference.number, reference.fileName);
  });
  return files;
}

const graphRagEntityNames = (data = {}, fileName = "") => {
  const names = new Set();
  (Array.isArray(data.entities) ? data.entities : []).forEach((entity) => {
    if (!fileName || String(entity.file_path || "").includes(fileName)) names.add(String(entity.entity_name));
  });
  (Array.isArray(data.relationships) ? data.relationships : []).forEach((relation) => {
    if (fileName && !String(relation.file_path || "").includes(fileName)) return;
    names.add(String(relation.src_id));
    names.add(String(relation.tgt_id));
  });
  names.delete("");
  return names;
};

export function graphRagCitationEntities(data = {}, text = "", markerOffset = String(text).length, fileName = "") {
  const before = String(text).slice(0, markerOffset);
  const previous = [...before.matchAll(/\[\d+\]/g)].at(-1);
  const claim = before.slice(previous ? previous.index + previous[0].length : 0).toLocaleLowerCase();
  const sourced = new Set((Array.isArray(data.entities) ? data.entities : [])
    .filter((entity) => graphRagChunksForSource(data.chunks, entity.source_id).length)
    .map((entity) => String(entity.entity_name)));
  let candidates = graphRagEntityNames(data, fileName);
  if (!candidates.size && fileName) candidates = graphRagEntityNames(data);
  return [...candidates]
    .filter((name) => sourced.has(name) && claim.includes(name.toLocaleLowerCase()))
    .sort((a, b) => claim.indexOf(a.toLocaleLowerCase()) - claim.indexOf(b.toLocaleLowerCase()));
}

export function graphRagChunksForSource(chunks = [], sourceId = "") {
  const sourceIds = new Set(String(sourceId).split("<SEP>").filter(Boolean));
  return (Array.isArray(chunks) ? chunks : []).filter((chunk) => sourceIds.has(String(chunk.chunk_id)));
}

export function graphRagAnswerGraph(data = {}, answer = "", fileName = "") {
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const relationships = Array.isArray(data.relationships) ? data.relationships : [];
  const byName = new Map(entities.map((entity) => [String(entity.entity_name), entity]));
  const candidates = graphRagEntityNames(data);
  const answerText = String(answer).toLocaleLowerCase();
  let used = [...candidates].filter((name) => answerText.includes(name.toLocaleLowerCase()));

  if (fileName) {
    const belongs = graphRagEntityNames(data, fileName);
    const fromFile = used.filter((name) => belongs.has(name));
    if (fromFile.length) used = fromFile;
    else if (!used.length) used = [...belongs];
  }
  if (!used.length) used = [...candidates];

  const usedNames = new Set(used);
  return {
    chunks: Array.isArray(data.chunks) ? data.chunks : [],
    nodes: used.map((name) => ({
      id: name,
      labels: [name],
      properties: { ...(byName.get(name) || {}), entity_id: name },
    })),
    edges: relationships.flatMap((relation, index) => usedNames.has(String(relation.src_id)) && usedNames.has(String(relation.tgt_id))
      ? [{ id: `answer-${index}`, source: String(relation.src_id), target: String(relation.tgt_id), properties: relation }]
      : []),
  };
}

export function graphRagUrl({ label = "*", depth = 3, maxNodes = 1000 } = {}) {
  const params = new URLSearchParams({
    label,
    max_depth: String(depth),
    max_nodes: String(maxNodes),
    workspace: GRAPH_RAG_WORKSPACE,
  });
  return `/api/graphrag/graphs?${params}`;
}
