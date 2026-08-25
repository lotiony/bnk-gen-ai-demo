import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import { NodeBorderProgram } from "@sigma/node-border";
import EdgeCurveProgram from "@sigma/edge-curve";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import circlepack from "graphology-layout/circlepack";
import {
  buildGraphRagGraph,
  graphRagChunksForSource,
  graphRagUrl,
  GRAPH_TYPE_COLORS,
  GRAPH_TYPE_LABELS,
} from "../lib/graphragGraph";

const TOOL_ICONS = {
  layout: "⠿",
  refresh: "↻",
  fit: "⌗",
  zoomIn: "+",
  zoomOut: "−",
  fullscreen: "⛶",
  legend: "▤",
};

function startForceAtlas(graph, onComplete) {
  const layout = new FA2Layout(graph, { settings: forceAtlas2.inferSettings(graph.order) });
  let active = true;
  const finish = () => {
    if (!active) return;
    active = false;
    layout.stop();
    layout.kill();
    onComplete();
  };
  layout.start();
  const timer = window.setTimeout(finish, Math.min(1500 + graph.order / 10, 10000));
  return () => {
    if (!active) return;
    active = false;
    window.clearTimeout(timer);
    layout.stop();
    layout.kill();
  };
}

function ToolButton({ icon, label, active = false, onClick }) {
  return <button type="button" className={active ? "active" : ""} aria-label={label} title={label} onClick={onClick}>{icon}</button>;
}

export default function GraphRagViewer({
  data = null,
  embedded = false,
  initialSelected = null,
  loadDefault = true,
  loading: externalLoading = false,
  errorMessage = "",
  onRetry = null,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const rendererRef = useRef(null);
  const graphRef = useRef(null);
  const layoutStopRef = useRef(null);
  const queryRef = useRef("");
  const activeNodeRef = useRef(null);
  const [graph, setGraph] = useState(null);
  const [raw, setRaw] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [legend, setLegend] = useState(true);
  const [loading, setLoading] = useState(true);
  const [layingOut, setLayingOut] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (data) {
      const next = buildGraphRagGraph(data);
      if (next.order) circlepack.assign(next);
      setSelected(initialSelected && next.hasNode(initialSelected) ? initialSelected : null);
      setHovered(null);
      setRaw(data);
      setGraph(next);
      setLoading(false);
      setError("");
      return undefined;
    }
    if (!loadDefault || externalLoading || errorMessage) {
      setRaw(null);
      setGraph(null);
      setLoading(externalLoading);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(graphRagUrl(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Graph API HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const next = buildGraphRagGraph(data);
        circlepack.assign(next);
        setRaw(data);
        setGraph(next);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "그래프를 불러오지 못했습니다.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [data, errorMessage, externalLoading, initialSelected, loadDefault, reload]);

  useEffect(() => {
    if (!graph || !canvasRef.current) return undefined;
    graphRef.current = graph;
    const renderer = new Sigma(graph, canvasRef.current, {
      allowInvalidContainer: true,
      defaultNodeType: "border",
      nodeProgramClasses: { border: NodeBorderProgram },
      defaultEdgeType: "curved",
      edgeProgramClasses: { curved: EdgeCurveProgram },
      defaultEdgeColor: "#d3d3d3",
      labelColor: { color: "#111827" },
      labelGridCellSize: 60,
      labelRenderedSizeThreshold: 12,
      labelSize: 12,
      renderEdgeLabels: false,
      hideEdgesOnMove: !embedded,
      nodeReducer: (node, attributes) => {
        const result = { ...attributes };
        const needle = queryRef.current.trim().toLowerCase();
        const active = activeNodeRef.current;
        if (embedded) {
          result.forceLabel = true;
          result.size = Math.max(8, result.size);
        }
        if (needle && !String(attributes.label || "").toLowerCase().includes(needle)) {
          result.color = "#d7dce4";
          result.borderColor = "#ffffff";
          result.label = "";
          result.size = Math.max(2, attributes.size * 0.35);
        }
        if (active) {
          const related = node === active || graph.hasEdge(node, active);
          if (!related) {
            result.color = "#e1e5eb";
            result.label = "";
          } else {
            result.highlighted = true;
            result.forceLabel = true;
          }
          if (node === active) {
            result.borderColor = "#f57f17";
            result.forceLabel = true;
            result.zIndex = 1;
          }
        }
        return result;
      },
      edgeReducer: (edge, attributes) => {
        const active = activeNodeRef.current;
        if (!active) return attributes;
        const [source, target] = graph.extremities(edge);
        return source === active || target === active
          ? { ...attributes, color: "#7d8795", size: Math.max(1.5, attributes.size) }
          : { ...attributes, hidden: true };
      },
    });
    rendererRef.current = renderer;

    let dragged = null;
    renderer.on("clickNode", ({ node }) => setSelected(node));
    renderer.on("clickStage", () => { setSelected(null); setHovered(null); });
    renderer.on("enterNode", ({ node }) => {
      canvasRef.current.style.cursor = "pointer";
      setHovered(node);
    });
    renderer.on("leaveNode", ({ node }) => {
      canvasRef.current.style.cursor = "default";
      setHovered((current) => current === node ? null : current);
    });
    renderer.on("downNode", ({ node, event }) => {
      dragged = node;
      graph.setNodeAttribute(node, "highlighted", true);
      event.preventSigmaDefault();
    });
    renderer.on("moveBody", ({ event }) => {
      if (!dragged) return;
      const position = renderer.viewportToGraph(event);
      graph.mergeNodeAttributes(dragged, position);
      event.preventSigmaDefault();
      event.original.preventDefault();
    });
    const stopDragging = () => {
      if (!dragged) return;
      graph.removeNodeAttribute(dragged, "highlighted");
      dragged = null;
    };
    renderer.on("upNode", stopDragging);
    renderer.on("upStage", stopDragging);
    renderer.getCamera().animatedReset({ duration: 300 });

    return () => {
      layoutStopRef.current?.();
      layoutStopRef.current = null;
      renderer.kill();
      rendererRef.current = null;
      graphRef.current = null;
    };
  }, [embedded, graph]);

  useEffect(() => {
    queryRef.current = query;
    rendererRef.current?.refresh();
  }, [query]);

  const activeNode = selected || hovered;

  useEffect(() => {
    activeNodeRef.current = activeNode;
    rendererRef.current?.refresh();
  }, [activeNode]);

  const typeCounts = useMemo(() => {
    if (!graph) return [];
    const counts = new Map();
    graph.forEachNode((_, attributes) => counts.set(attributes.entityType, (counts.get(attributes.entityType) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const activeData = activeNode && graph?.hasNode(activeNode) ? graph.getNodeAttributes(activeNode) : null;
  const activeChunks = useMemo(() => graphRagChunksForSource(raw?.chunks, activeData?.properties?.source_id), [activeData, raw]);
  const relations = useMemo(() => {
    if (!graph || !activeNode || !graph.hasNode(activeNode)) return [];
    return graph.neighbors(activeNode)
      .map((node) => ({ id: node, label: graph.getNodeAttribute(node, "label") || node }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [graph, activeNode]);
  const runLayout = useCallback(() => {
    if (!graphRef.current || layingOut) return;
    layoutStopRef.current?.();
    setLayingOut(true);
    layoutStopRef.current = startForceAtlas(graphRef.current, () => {
      layoutStopRef.current = null;
      rendererRef.current?.refresh();
      rendererRef.current?.getCamera().animatedReset({ duration: 350 });
      setLayingOut(false);
    });
  }, [layingOut]);

  const camera = () => rendererRef.current?.getCamera();
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frameRef.current?.requestFullscreen();
  };

  const visibleError = errorMessage || error;
  const visibleLoading = externalLoading || loading;

  return (
    <div ref={frameRef} className={`rag-graphrag-frame${embedded ? " embedded" : ""}`}>
      {!embedded && <div className="rag-graphrag-topbar">
        <button type="button" aria-label="그래프 새로고침" title="그래프 새로고침" onClick={() => setReload((value) => value + 1)}>↻</button>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes in page..." aria-label="그래프 노드 검색" />
      </div>}

      <div ref={canvasRef} className="rag-graphrag-canvas" />

      <div className="rag-graphrag-tools">
        <ToolButton icon={TOOL_ICONS.layout} label={layingOut ? "레이아웃 계산 중" : "ForceAtlas 레이아웃"} active={layingOut} onClick={runLayout} />
        <ToolButton icon={TOOL_ICONS.refresh} label="레이아웃 초기화" onClick={runLayout} />
        <ToolButton icon={TOOL_ICONS.fit} label="그래프 맞춤" onClick={() => camera()?.animatedReset({ duration: 250 })} />
        <ToolButton icon={TOOL_ICONS.zoomIn} label="확대" onClick={() => camera()?.animatedZoom({ duration: 180 })} />
        <ToolButton icon={TOOL_ICONS.zoomOut} label="축소" onClick={() => camera()?.animatedUnzoom({ duration: 180 })} />
        <ToolButton icon={TOOL_ICONS.fullscreen} label="전체 화면" onClick={toggleFullscreen} />
        <ToolButton icon={TOOL_ICONS.legend} label="범례" active={legend} onClick={() => setLegend((value) => !value)} />
      </div>

      {legend && (
        <aside className="rag-graphrag-legend">
          <b>Legend</b>
          {typeCounts.map(([type, count]) => (
            <div key={type}><i style={{ background: GRAPH_TYPE_COLORS[type] }} /><span>{GRAPH_TYPE_LABELS[type] || type}</span><em>{count}</em></div>
          ))}
        </aside>
      )}

      {activeData && (
        <aside className="rag-graphrag-properties">
          <header><b>Node</b><button type="button" aria-label="선택 패널 닫기" onClick={() => { setSelected(null); setHovered(null); }}>×</button></header>
          <dl className="rag-graphrag-node-summary">
            <div><dt>ID</dt><dd>{activeNode}</dd></div>
            <div><dt>Labels</dt><dd>{activeData.label}</dd></div>
            <div><dt>Degree</dt><dd>{graph.degree(activeNode)}</dd></div>
          </dl>
          <h4 className="properties-title">Properties</h4>
          <div className="rag-graphrag-property-list">
            {[
              ["description", "Description"],
              ["entity_id", "Name"],
              ["entity_type", "Type"],
              ["file_path", "File"],
              ["source_id", "C-ID"],
            ].map(([key, label]) => activeData.properties[key] != null && (
              <div key={key}><b>{label}</b><span>{String(activeData.properties[key]).replaceAll("<SEP>", "\n")}</span></div>
            ))}
          </div>
          {activeChunks.length > 0 && <>
            <h4 className="chunks-title">Source chunks ({activeChunks.length})</h4>
            <div className="rag-graphrag-chunks">
              {activeChunks.map((chunk) => (
                <details key={chunk.chunk_id}>
                  <summary>[{chunk.reference_id}] {chunk.file_path}</summary>
                  <p>{chunk.content}</p>
                </details>
              ))}
            </div>
          </>}
          <h4 className="relations-title">Relations (within subgraph)</h4>
          <div className="rag-graphrag-relations">
            {relations.map((relation) => <div key={relation.id}><b>Neigh</b><span>{relation.label}</span></div>)}
          </div>
        </aside>
      )}

      <div className="rag-graphrag-status">D: 3&nbsp;&nbsp; node: {graph?.order || 0}&nbsp;&nbsp; edge: {graph?.size || 0}</div>
      <div className="rag-graphrag-connection"><i />Connected</div>
      {(visibleLoading || visibleError) && (
        <div className={`rag-graphrag-message ${visibleError ? "error" : ""}`}>
          {visibleError || "climax_ko 그래프를 불러오는 중…"}
          {visibleError && onRetry && (
            <button type="button" onClick={onRetry}>다시 시도</button>
          )}
        </div>
      )}
      {!visibleLoading && !visibleError && graph?.order === 0 && <div className="rag-graphrag-message">답변에서 일치하는 엔티티를 찾지 못했습니다.</div>}
    </div>
  );
}
