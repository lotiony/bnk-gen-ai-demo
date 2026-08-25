import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import {
  activeChunkIdForPage,
  adaptiveSpreadPages,
  buildCandidatePageHighlights,
  candidatePageErrorMessage,
  candidatePageCacheKey,
  chunkDisplayLabel,
  chunkIdentifier,
  getOrCreateCandidatePageRequest,
  mergeCandidatePageItems,
  scrollCardToListTop,
  setBoundedCandidatePageCache,
  uniqueCandidatePageItems,
} from "../lib/ragRunPage";
import GraphRagViewer from "./GraphRagViewer";
import ChunkLoadingSpinner from "./rag-results/ChunkLoadingSpinner";
import CompletedResultPicker from "./rag-results/CompletedResultPicker";
import PdfSpreadPreview from "./rag-results/PdfSpreadPreview";
import TermsRunResults from "./rag-results/TermsRunResults";
import {
  ADAPTIVE_METRICS,
  artifactReference,
  candidateTone,
  graphData,
  percentScore,
} from "./rag-results/resultUtils";

export default function RagRunResults({ executionId, documentExecutionId, referenceId, currentResult, onBack, onSelectResult }) {
  const [root, setRoot] = useState(null);
  const [collection, setCollection] = useState({ items: [], page: {} });
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsQuery, setTermsQuery] = useState("");
  const [selectedTermOrdinal, setSelectedTermOrdinal] = useState(null);
  const [termDetail, setTermDetail] = useState(null);
  const [termDetailLoading, setTermDetailLoading] = useState(false);
  const termsScopeRef = useRef("");
  const [activeCandidateName, setActiveCandidateName] = useState(null);
  const [activeChunkId, setActiveChunkId] = useState(null);
  const chunkListRef = useRef(null);
  const chunkCardRefs = useRef(new Map());
  const candidatePageCacheRef = useRef(new Map());
  const activeCandidatePageKeysRef = useRef(new Set());
  const [candidatePageVersion, setCandidatePageVersion] = useState(0);
  const [graphResult, setGraphResult] = useState(null);
  const [liveGraph, setLiveGraph] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [graphReloadToken, setGraphReloadToken] = useState(0);
  const graphScopeRef = useRef("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [previewArtifactRef, setPreviewArtifactRef] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    graphScopeRef.current = JSON.stringify([executionId, documentExecutionId, referenceId]);
    setRoot(null);
    setCollection({ items: [], page: {} });
    setTermsLoading(false);
    setTermsQuery("");
    setSelectedTermOrdinal(null);
    setTermDetail(null);
    setTermDetailLoading(false);
    setActiveCandidateName(null);
    setActiveChunkId(null);
    setGraphResult(null);
    setLiveGraph(null);
    setGraphLoading(false);
    setGraphError("");
    setGraphReloadToken(0);
    candidatePageCacheRef.current.clear();
    setCandidatePageVersion((value) => value + 1);
    setPdfUrl(null);
    setPreviewArtifactRef(null);
    setPage(1);
    setPageCount(0);
    api.ragVisualization(executionId, documentExecutionId, referenceId)
      .then((value) => {
        if (!alive) return;
        setRoot(value);
        const adaptive = value?.capabilities?.projection_result?.result;
        const selected = adaptive?.selected_chunker || adaptive?.candidates?.find((candidate) => candidate.selected)?.name;
        setActiveCandidateName(selected || null);
        setError("");
      })
      .catch((reason) => { if (alive) setError(reason.message || "결과 상태를 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [documentExecutionId, executionId, referenceId]);

  const projection = root?.profile?.projection;
  const termsScope = JSON.stringify([executionId, documentExecutionId, referenceId]);
  useEffect(() => {
    if (projection !== "terms") return undefined;
    let alive = true;
    termsScopeRef.current = termsScope;
    const load = async () => {
      setTermsLoading(true);
      try {
        const value = await api.ragVisualization(
          executionId, documentExecutionId, referenceId, "/terms", { limit: 100 },
        );
        if (!alive) return;
        const items = value?.items || [];
        setCollection({ items, page: value?.page || {} });
        setSelectedTermOrdinal(items[0]?.ordinal ?? null);
        setError("");
      } catch (reason) {
        if (alive) setError(reason.message || "Terms 결과를 불러오지 못했습니다.");
      } finally {
        if (alive) setTermsLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [documentExecutionId, executionId, projection, referenceId, termsScope]);

  const loadMoreTerms = async () => {
    const cursor = collection?.page?.next_cursor;
    if (projection !== "terms" || !cursor || termsLoading) return;
    const requestScope = termsScope;
    setTermsLoading(true);
    try {
      const value = await api.ragVisualization(
        executionId,
        documentExecutionId,
        referenceId,
        "/terms",
        { cursor, limit: 100 },
      );
      if (termsScopeRef.current !== requestScope) return;
      setCollection((current) => {
        const ordinals = new Set(current.items.map((item) => item.ordinal));
        const nextItems = (value?.items || []).filter((item) => !ordinals.has(item.ordinal));
        return { items: [...current.items, ...nextItems], page: value?.page || {} };
      });
      setError("");
    } catch (reason) {
      if (termsScopeRef.current === requestScope) {
        setError(reason.message || "Terms 결과를 더 불러오지 못했습니다.");
      }
    } finally {
      if (termsScopeRef.current === requestScope) setTermsLoading(false);
    }
  };

  useEffect(() => {
    if (projection !== "terms" || selectedTermOrdinal === null) return undefined;
    let alive = true;
    setTermDetailLoading(true);
    setTermDetail(null);
    api.ragTermDetail(
      executionId, documentExecutionId, referenceId, selectedTermOrdinal,
    ).then((value) => {
      if (!alive) return;
      setTermDetail(value);
      setError("");
    }).catch((reason) => {
      if (alive) setError(reason.message || "선택한 Terms Chunk를 불러오지 못했습니다.");
    }).finally(() => {
      if (alive) setTermDetailLoading(false);
    });
    return () => { alive = false; };
  }, [documentExecutionId, executionId, projection, referenceId, selectedTermOrdinal]);

  const candidatePageScope = JSON.stringify([
    executionId,
    documentExecutionId,
    referenceId,
  ]);
  const spreadPages = useMemo(
    () => adaptiveSpreadPages(page, pageCount),
    [page, pageCount],
  );
  const candidatePageKeys = spreadPages.map((pageNumber) => candidatePageCacheKey(
    activeCandidateName, pageNumber, candidatePageScope,
  ));
  const candidatePageKeysKey = candidatePageKeys.join("\u0000");
  activeCandidatePageKeysRef.current = new Set(candidatePageKeys);
  const candidatePageEntries = candidatePageKeys.map((key) => candidatePageCacheRef.current.get(key));
  const candidatePageData = candidatePageEntries.find((entry) => entry?.status === "ready")?.data;
  const candidatePageError = candidatePageEntries.find((entry) => entry?.status === "error");
  const candidatePageLoading = projection === "adaptive"
    && Boolean(activeCandidateName)
    && candidatePageEntries.some((entry) => !entry || entry.status === "loading");
  const pageChunks = useMemo(
    () => mergeCandidatePageItems(candidatePageKeys.map((key) => (
      candidatePageCacheRef.current.get(key)?.data
    ))),
    [candidatePageKeysKey, candidatePageVersion],
  );
  const pageChunkIds = useMemo(
    () => pageChunks.map((item, index) => chunkIdentifier(item, `chunk-${index + 1}`)),
    [pageChunks],
  );
  const pageChunkIdsKey = pageChunkIds.join("\u0000");

  useEffect(() => {
    if (projection !== "adaptive" || !activeCandidateName) return;
    let createdRequest = false;
    spreadPages.forEach((pageNumber) => {
      const key = candidatePageCacheKey(activeCandidateName, pageNumber, candidatePageScope);
      const { entry, created } = getOrCreateCandidatePageRequest(
        candidatePageCacheRef.current,
        key,
        () => api.ragCandidatePageChunks(
          executionId, documentExecutionId, referenceId, activeCandidateName, pageNumber,
        ),
      );
      if (!created) return;
      createdRequest = true;
      const { promise } = entry;
      promise.then((data) => {
        if (candidatePageCacheRef.current.get(key)?.promise !== promise) return;
        setBoundedCandidatePageCache(
          candidatePageCacheRef.current,
          key,
          { status: "ready", data },
        );
        if (!activeCandidatePageKeysRef.current.has(key)) return;
        const artifactRef = data?.rendition?.artifact_ref || null;
        if (artifactRef) setPreviewArtifactRef(artifactRef);
        setCandidatePageVersion((value) => value + 1);
      }).catch((reason) => {
        if (candidatePageCacheRef.current.get(key)?.promise !== promise) return;
        setBoundedCandidatePageCache(candidatePageCacheRef.current, key, {
          status: "error",
          error: candidatePageErrorMessage(reason),
        });
        if (activeCandidatePageKeysRef.current.has(key)) {
          setCandidatePageVersion((value) => value + 1);
        }
      });
    });
    if (createdRequest) setCandidatePageVersion((value) => value + 1);
  }, [activeCandidateName, candidatePageKeysKey, candidatePageScope, candidatePageVersion, documentExecutionId, executionId, projection, referenceId]);

  useEffect(() => {
    if (projection !== "adaptive") return;
    setActiveChunkId((current) => activeChunkIdForPage(current, pageChunkIds));
  }, [pageChunkIdsKey, projection]);

  const retryCandidatePage = () => {
    candidatePageKeys.forEach((key) => {
      if (candidatePageCacheRef.current.get(key)?.status === "error") {
        candidatePageCacheRef.current.delete(key);
      }
    });
    setCandidatePageVersion((value) => value + 1);
  };

  useEffect(() => {
    if (root?.profile?.target !== "graphrag") return undefined;
    let alive = true;
    const requestScope = JSON.stringify([executionId, documentExecutionId, referenceId]);
    graphScopeRef.current = requestScope;
    setGraphResult(null);
    setGraphLoading(true);
    setGraphError("");
    const loadLiveGraph = async () => {
      const execution = await api.ragPipelineExecution(executionId);
      const nextGraph = await api.ragLiveGraph(execution.workspace);
      if (!alive || graphScopeRef.current !== requestScope) return;
      setLiveGraph(nextGraph);
    };
    const load = async () => {
      try {
        const runtime = await api.runtime();
        if (
          runtime?.app_mode === "local"
          && root?.capabilities?.graph_result?.readiness !== "ready"
        ) {
          await loadLiveGraph();
          return;
        }
        const graph = await api.ragVisualization(
          executionId, documentExecutionId, referenceId, "/graph",
        );
        if (!alive || graphScopeRef.current !== requestScope) return;
        setGraphResult(graph);
      } catch (reason) {
        if (reason?.status === 404) {
          try {
            const runtime = await api.runtime();
            if (runtime?.app_mode === "local") {
              await loadLiveGraph();
              return;
            }
          } catch (fallbackReason) {
            reason = fallbackReason;
          }
        }
        if (alive && graphScopeRef.current === requestScope) {
          setGraphError(reason.message || "GraphRAG 결과를 불러오지 못했습니다.");
        }
      } finally {
        if (alive && graphScopeRef.current === requestScope) setGraphLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [documentExecutionId, executionId, graphReloadToken, referenceId, root?.capabilities?.graph_result?.readiness, root?.profile?.target]);

  useEffect(() => {
    if (
      projection === "adaptive"
      || root?.capabilities?.document_preview?.readiness !== "ready"
    ) return undefined;
    let alive = true;
    api.ragVisualization(executionId, documentExecutionId, referenceId, `/pages/${page}/annotations`)
      .then((value) => {
        if (!alive) return;
        const artifactRef = value?.rendition?.artifact_ref || null;
        if (artifactRef) setPreviewArtifactRef(artifactRef);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [documentExecutionId, executionId, page, projection, referenceId, root?.capabilities?.document_preview?.readiness]);

  useEffect(() => {
    if (!previewArtifactRef) return;
    setPdfUrl(api.ragArtifactContentUrl(
      executionId,
      documentExecutionId,
      referenceId,
      previewArtifactRef,
      currentResult?.project_id,
    ));
  }, [currentResult?.project_id, documentExecutionId, executionId, previewArtifactRef, referenceId]);

  const graph = useMemo(
    () => liveGraph || (graphResult
      ? graphData(graphResult.entities, graphResult.relations)
      : null),
    [graphResult, liveGraph],
  );
  const projectionSummary = root?.capabilities?.projection_result;
  const previewReference = artifactReference(root?.capabilities?.document_preview) || previewArtifactRef;
  const adaptiveResult = projectionSummary?.result || {};
  const adaptiveCandidates = Array.isArray(adaptiveResult.candidates) ? adaptiveResult.candidates : [];
  const selectedCandidate = adaptiveCandidates.find((candidate) => candidate.selected)
    || adaptiveCandidates.find((candidate) => candidate.name === adaptiveResult.selected_chunker)
    || adaptiveCandidates[0];
  const activeCandidate = adaptiveCandidates.find((candidate) => candidate.name === activeCandidateName) || selectedCandidate;
  const activeCandidateIndex = Math.max(0, adaptiveCandidates.findIndex((candidate) => candidate.name === activeCandidate?.name));
  const activeTone = candidateTone(activeCandidate, activeCandidateIndex);
  const highlightsByPage = Object.fromEntries(spreadPages.map((pageNumber, index) => [
    pageNumber,
    buildCandidatePageHighlights(
      uniqueCandidatePageItems(candidatePageEntries[index]?.data?.items || []),
      activeChunkId,
      candidatePageKeys[index],
    ),
  ]));
  const loadingByPage = Object.fromEntries(spreadPages.map((pageNumber, index) => [
    pageNumber,
    !candidatePageEntries[index] || candidatePageEntries[index].status === "loading",
  ]));
  const equivalentCandidates = adaptiveCandidates.filter((candidate) => {
    if (!activeCandidate || Number(candidate.score) !== Number(activeCandidate.score)) return false;
    return JSON.stringify(candidate.metrics || {}) === JSON.stringify(activeCandidate.metrics || {});
  });
  const openPdf = () => previewReference && setPdfUrl(api.ragArtifactContentUrl(
    executionId,
    documentExecutionId,
    referenceId,
    previewReference,
    currentResult?.project_id,
  ));
  const selectCandidate = (name) => {
    if (!name || name === activeCandidateName) return;
    setActiveCandidateName(name);
    setActiveChunkId(null);
  };
  const selectChunk = (id, reveal = false) => {
    setActiveChunkId(id);
    if (!reveal) return;
    window.requestAnimationFrame(() => {
      scrollCardToListTop(chunkListRef.current, chunkCardRefs.current.get(id));
    });
  };

  if (error && !root) return <div style={{ border: "1px solid var(--red)", borderRadius: 12, padding: 20, color: "var(--red)" }}>{error}<button onClick={onBack} style={{ marginLeft: 12 }}>돌아가기</button></div>;
  if (!root) return <div style={{ padding: 30, color: "var(--muted)" }}>결과를 확인하는 중…</div>;

  return (
    <div className="rag-page rag-page-fluid" style={{ gap: 12 }}>
      <div className="rag-head">
        <div className="rag-titlemark" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="7" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="m7.8 8.1 2.7 8M16.2 7.3l-3 8.8M8 7.1l8-.2" /></svg></div>
        <div><h1>RAG Vector DB</h1><p>어떤 문서든 업로드하면 RAG DB와 Knowledge Graph로 변환하고 MCP로 즉시 연결합니다.</p></div>
      </div>
      <div className="rag-run-result-head">
        {onBack && <button type="button" onClick={onBack} className="rag-run-back" aria-label="RAG Vector DB 홈으로 돌아가기" title="RAG Vector DB 홈으로 돌아가기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>}
        <div><span className="mono">RUN-SCOPED RESULT</span><h2>{projection === "terms" ? "Terms" : "Adaptive"} → {root.profile?.target === "graphrag" ? "GraphRAG" : "AI Search"}</h2></div>
        <CompletedResultPicker
          currentReferenceId={referenceId}
          currentResult={currentResult}
          onSelectResult={onSelectResult}
        />
      </div>

      {projection === "adaptive" ? <div>
        <div className="rag-step-label">RAG Parsing</div>
        <section className="rag-workspace">
          <div className="rag-panel rag-preview-panel">
            <div className="rag-panel-head">
              <div><b>Inline Renderer</b><span>{root.document_id} · rev {root.document_revision}</span></div>
              <em>Best · {adaptiveResult.selected_chunker || selectedCandidate?.name || "확인 중"}</em>
            </div>
            <div className="rag-strategies">
              {adaptiveCandidates.map((candidate, index) => {
                const tone = candidateTone(candidate, index);
                return <button key={candidate.name} type="button" className={candidate.name === activeCandidate?.name ? "active" : ""} style={{ "--tone": tone }} onClick={() => selectCandidate(candidate.name)}>
                  {candidate.name} · {percentScore(candidate.score).toFixed(2)}
                </button>;
              })}
              {selectedCandidate && <button type="button" className={activeCandidate?.name === selectedCandidate.name ? "active" : ""} style={{ "--tone": "var(--green)" }} onClick={() => selectCandidate(selectedCandidate.name)}>Best · {percentScore(selectedCandidate.score).toFixed(2)}</button>}
            </div>
            <div className="rag-document">
              {pdfUrl ? <PdfSpreadPreview
                url={pdfUrl}
                page={page}
                pageCount={pageCount}
                onPage={setPage}
                onPageCount={setPageCount}
                highlightsByPage={highlightsByPage}
                loadingByPage={loadingByPage}
                tone={activeTone}
                onHighlightSelect={(id) => selectChunk(id, true)}
              /> : (
                <div className="rag-analysis-state">원문 PDF와 파싱 좌표를 불러오는 중입니다.{previewReference && <button type="button" onClick={openPdf} style={{ marginLeft: 10 }}>다시 불러오기</button>}</div>
              )}
            </div>
          </div>

          <div className="rag-panel">
            <div className="rag-panel-head">
              <div><b>Chunk 결과</b><span>평가 점수 {percentScore(activeCandidate?.score).toFixed(2)} · 전체 {candidatePageData?.candidate_total ?? pageChunks.length} / p.{spreadPages.join("-")} {pageChunks.length} chunks</span></div>
            </div>
            <div className="rag-strategy-desc" style={{ "--tone": activeTone }}>
              <b>{activeCandidate?.name || "선택한 chunker"}</b>의 실제 청크 본문과 원문 좌표를 표시합니다.
              {equivalentCandidates.length > 1 && <span> {equivalentCandidates.map((candidate) => candidate.name).join(" · ")}는 이 문서에서 동일한 평가 입력을 생성해 실제 점수가 같습니다.</span>}
            </div>
            <div ref={chunkListRef} className="rag-chunks">
              {candidatePageLoading ? <ChunkLoadingSpinner /> : pageChunks.map((item, index) => {
                const id = chunkIdentifier(item, `chunk-${index + 1}`);
                const preview = item.preview;
                return <button key={id} ref={(node) => { if (node) chunkCardRefs.current.set(id, node); else chunkCardRefs.current.delete(id); }} type="button" onClick={() => selectChunk(id)} className={activeChunkId === id ? "active" : ""} style={{ "--tone": activeTone }}>
                  <em>{id}</em>
                  <b>{item.heading || item.title || chunkDisplayLabel(item, index)}</b>
                  <span>p.{item.page_number || "?"} · {Number(item.char_count ?? String(preview || "").length).toLocaleString()} chars</span>
                  {preview && <p>{preview}{item.truncated ? "…" : ""}</p>}
                </button>;
              })}
              {!pageChunks.length && candidatePageError && <div className="rag-analysis-state error">{candidatePageError.error}<button type="button" onClick={retryCandidatePage} style={{ marginLeft: 10 }}>다시 불러오기</button></div>}
              {!pageChunks.length && !candidatePageLoading && !candidatePageError && <div className="rag-analysis-state">p.{spreadPages.join("-")}에 표시할 chunk가 없습니다.</div>}
            </div>
            <div className="rag-scores">
              {ADAPTIVE_METRICS.map(([key, label]) => {
                const score = percentScore(activeCandidate?.metrics?.[key]);
                return <div key={key}><span>{label}</span><b>{score.toFixed(2)}</b><i><u style={{ width: `${score}%`, background: activeTone }} /></i></div>;
              })}
            </div>
          </div>
        </section>
      </div> : <TermsRunResults
        data={collection}
        loading={termsLoading}
        hasMore={Boolean(collection?.page?.next_cursor)}
        onLoadMore={loadMoreTerms}
        query={termsQuery}
        onQuery={setTermsQuery}
        selectedOrdinal={selectedTermOrdinal}
        onSelect={setSelectedTermOrdinal}
        detail={termDetail}
        detailLoading={termDetailLoading}
        pdfUrl={pdfUrl}
        loadDetail={(ordinal) => api.ragTermDetail(
          executionId, documentExecutionId, referenceId, ordinal,
        )}
      />}

      {root.profile?.target === "graphrag" && <>
        <section className="rag-graphrag-shell">
          <div className="rag-step-label">Graph RAG</div>
          <p>문서에서 추출한 엔티티와 관계를 Knowledge Graph로 확인합니다.</p>
          <GraphRagViewer
            data={graph}
            loadDefault={false}
            loading={graphLoading}
            errorMessage={graphError}
            onRetry={() => setGraphReloadToken((value) => value + 1)}
          />
        </section>
      </>}
      {error && <div style={{ color: "var(--red)", fontSize: 11 }}>{error}</div>}
    </div>
  );
}
