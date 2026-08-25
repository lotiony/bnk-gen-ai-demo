import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import { useProjects } from "../ProjectContext";
import { api } from "../api";
import { analyzePdfBlob, fixtureUrlForSha, hashBlob, METRICS, normalizeChunkAnalysis } from "../lib/ragChunkAnalysis";
import { groupOverlappingChunkRows, mergeContiguousChunkRects } from "../lib/ragChunkOverlay";
import GraphRagViewer from "../components/GraphRagViewer";
import RagRunResults from "../components/RagRunResults";
import PdfArtifactPreview from "../components/rag-results/PdfArtifactPreview";
import RagDocumentUploadPanel from "../components/rag-results/RagDocumentUploadPanel";
import RagResultIndex from "../components/rag-results/RagResultIndex";
import {
  dashboardNavForRagExecution,
  projectIdForRagExecution,
} from "../lib/ragIngestionNavigation";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const projectPdfUrl = (doc = {}) => doc.blob_url || doc.artifacts?.pdf_url || doc.url
  || (/^https?:\/\/|^\/[^/]/.test(doc.meta || "") && !String(doc.meta).startsWith("/mnt/") ? doc.meta : null);
const projectChunkersUrl = (doc = {}) => doc.chunkers_url || doc.artifacts?.chunkers_url || null;

const TEXT = {
  ko: {
    subtitle: "어떤 문서든 업로드하면 RAG DB와 Knowledge Graph로 변환하고 MCP로 즉시 연결합니다.",
    banner: "문서 파싱, OCR, 청킹 평가, 지식그래프 생성을 한 흐름으로 묶어 AI Agent가 바로 쓸 수 있는 지식 인프라를 만듭니다.",
    upload: "문서 업로드",
    drop: "문서를 끌어다 놓거나 클릭",
    source: "선택한 PDF Blob의 실제 텍스트와 좌표를 분석합니다.",
    convert: "RAG/지식그래프 변환",
    converting: "지식화 중...",
    pipeline: "처리 파이프라인",
    inlineTip: "inline view로 보기",
    inlineTitle: "Inline PDF Viewer",
    close: "닫기",
    chunkResult: "Chunk 결과",
    chunkSub: "전략별 설명과 클릭 가능한 chunk 목록",
    graphSub: "PDF에서 추출한 entity/relation · 노드는 드래그 가능",
    storage: "저장 구조 preview",
    storageSub: "pageN.json 폭증 대신 blocks.jsonl 중심",
    storagePoints: ["manifest.json: Readycar 약관 page 137 메타데이터", "blocks.jsonl: PDF.js textContent item + bbox 기반 block", "tables.jsonl: 보험개시시기 표 구조", "chunks/*.jsonl: 전략별 RAG chunk 결과"],
    mcp: "MCP 변환",
    engineLog: "변환 엔진 로그",
    mcpDone: "MCP 변환 완료",
    mcpDoneSub: "3개 MCP tool 등록 · RAG DB + Knowledge Graph 연결 · registry 총 24개",
    mcpExplore: "MCP 탐색으로",
    mcpStart: "MCP 변환하기",
    mcpRunning: "MCP 변환 중...",
    steps: ["자동 파싱", "OCR 자동 적용", "레이아웃 기반 병합", "청킹 전략 적용", "청킹 품질 평가", "최적 청킹 선택", "Azure AI Search 인덱스 생성", "HorizonDB 지식그래프 생성", "MCP 연결 준비"],
  },
  en: {
    subtitle: "Upload any document, convert it into a RAG DB and Knowledge Graph, then expose it through MCP.",
    banner: "Parse, OCR, chunk, score, and graph documents in one flow so AI agents can use internal knowledge immediately.",
    upload: "Document Upload",
    drop: "Drop documents here or click",
    source: "Analyzes text and coordinates from the selected PDF Blob.",
    convert: "Convert to RAG / Knowledge Graph",
    converting: "Processing...",
    pipeline: "Processing Pipeline",
    inlineTip: "Open inline view",
    inlineTitle: "Inline PDF Viewer",
    close: "Close",
    chunkResult: "Chunk Result",
    chunkSub: "Strategy description and clickable chunks",
    graphSub: "Entities and relations extracted from the PDF · nodes are draggable",
    storage: "Storage Preview",
    storageSub: "blocks.jsonl first, instead of exploding pageN.json files",
    storagePoints: ["manifest.json: Readycar page 137 metadata", "blocks.jsonl: PDF.js textContent item + bbox blocks", "tables.jsonl: insurance start-date table structure", "chunks/*.jsonl: RAG chunk output by strategy"],
    mcp: "MCP Conversion",
    engineLog: "Conversion Engine Log",
    mcpDone: "MCP Conversion Complete",
    mcpDoneSub: "3 MCP tools registered · RAG DB + Knowledge Graph connected · 24 total registry entries",
    mcpExplore: "Open MCP Explorer",
    mcpStart: "Convert to MCP",
    mcpRunning: "Converting...",
    steps: ["Auto parsing", "Auto OCR", "Layout merge", "Apply chunking", "Score chunks", "Select best chunks", "Create Azure AI Search index", "Create HorizonDB graph", "Prepare MCP connection"],
  },
};

const CHUNK_COLORS = ["var(--blue)", "var(--purple)", "var(--amber)", "var(--red)", "var(--green)"];

const INITIAL_NODES = [
  { id: "clause", name: "고령자 교통안전교육 특약", type: "특별약관", x: 50, y: 48, chunk: "B-01", rel: ["가입대상 정의", "증빙 요구", "보험료 할인", "보험기간 산정"] },
  { id: "insured", name: "피보험자", type: "적용 주체", x: 18, y: 34, chunk: "B-02", rel: ["도로교통공단 교육필증 보유", "인지지각검사 결과 기준 적용"] },
  { id: "age65", name: "만 65세 이상", type: "연령 조건", x: 30, y: 18, chunk: "B-01", rel: ["주민등록상 생년월일 기준", "특약 가입일 현재 판단"] },
  { id: "license", name: "교육필증", type: "증빙 서류", x: 58, y: 18, chunk: "B-02", rel: ["도로교통공단 발급", "회사 제출 대상"] },
  { id: "cognitive", name: "인지지각검사 결과일", type: "기준일", x: 80, y: 30, chunk: "B-02", rel: ["보험기간 첫날과 비교", "3년 이내 조건"] },
  { id: "threeYears", name: "3년 이내", type: "가입 가능 기간", x: 76, y: 52, chunk: "B-02", rel: ["결과일부터 보험기간 첫날까지", "가입 가능 판단"] },
  { id: "submit", name: "회사 제출", type: "가입방법", x: 24, y: 58, chunk: "B-02", rel: ["제1조(3) 사실 입증", "교통안전교육 교육필증 등"] },
  { id: "discount", name: "보험증권 할인율", type: "보험료 할인", x: 48, y: 70, chunk: "B-03", rel: ["가입기간 동안 적용", "해당 보험료 할인"] },
  { id: "startNormal", name: "보통약관 보험기간 첫날", type: "개시 기준", x: 21, y: 80, chunk: "B-03", rel: ["결과일이 첫날 이전인 경우", "한정운전 가입 여부 확인"] },
  { id: "startEval", name: "인지지각검사일부터", type: "개시 기준", x: 59, y: 84, chunk: "B-03", rel: ["결과일이 첫날 이후인 경우", "평가일 당일 기준"] },
  { id: "driverLimit", name: "부부/기명 1인 한정운전", type: "운전자 범위 조건", x: 84, y: 74, chunk: "B-03", rel: ["미가입 시 변경 첫날부터", "다른 운전자 범위 변경 시 종료"] },
  { id: "end", name: "변경 효력 발생 전날 24시", type: "종료시점", x: 38, y: 92, chunk: "B-04", rel: ["보통약관 종료시점과 동일", "범위 변경 시 조기 종료"] },
  { id: "general", name: "보통약관 준용", type: "준용규정", x: 66, y: 61, chunk: "B-04", rel: ["특별약관 미정 사항 처리"] },
  { id: "disabled", name: "장애인 전용 보험 전환 특약", type: "다음 특별약관", x: 82, y: 91, chunk: "B-04", rel: ["적용대상 조건 시작", "특별세액공제 대상 보험료"] },
];

const MCP_STAGES = ["RAG DB", "Knowledge Graph", "MCP Tool", "Registry"];
const formatScore = (value) => Number(value || 0).toFixed(2);
const MCP_LOGS = [
  { tag: "source", text: "load best chunks · graph entities · document metadata" },
  { tag: "rag", text: "publish Azure AI Search index connector" },
  { tag: "graph", text: "publish HorizonDB graph connector" },
  { tag: "tool", text: "register search_readycar_knowledge tool" },
  { tag: "tool", text: "register describe_readycar_chunk tool" },
  { tag: "tool", text: "register traverse_readycar_graph tool" },
  { tag: "schema", text: "emit MCP tool schemas" },
  { tag: "ok", text: "MCP registry updated" },
];

const FileIcon = () => (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

const GraphIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="7" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M7 7.3 10 10M14.5 10.2 17.4 8.2M14.2 14.3l2.4 2.3" />
  </svg>
);

function TermsParsing({ step = 2 }) {
  const [termsChunks, setTermsChunks] = useState([]);
  const [termsError, setTermsError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const renderListRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch("/rag-fixtures/4078c35341414a3b9b86adb6e61f112828a6490d832dfdb4c729f7191fc7de5c/terms-bbox-84-render.json")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error("Terms bbox fixture request failed");
        if (data?.schema_version !== "terms-bbox-render/v1" || !Array.isArray(data.items)) throw new TypeError("Terms bbox response is invalid");
        return data.items;
      })
      .then((data) => {
        if (!alive) return;
        setTermsError("");
        setTermsChunks(data);
        setSelectedChunk(data[0] || null);
        setPage(data[0]?.page_bboxes?.[0]?.page_number || data[0]?.meta?.page_start || 1);
      })
      .catch(() => {
        if (!alive) return;
        setTermsChunks([]);
        setSelectedChunk(null);
        setTermsError("약관 Chunk 데이터를 불러오지 못했습니다. Blob 연결 상태를 확인하세요.");
      });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const lengths = termsChunks.map((chunk) => String(chunk.text || "").length).sort((a, b) => a - b);
    const pages = termsChunks.flatMap((chunk) => chunk.meta?.pages || []);
    const pick = (ratio) => lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * ratio))] || 0;
    return {
      count: termsChunks.length,
      pages: pages.length ? `${Math.min(...pages)}-${Math.max(...pages)}` : "—",
      uniquePages: new Set(pages).size,
      chars: lengths.reduce((sum, length) => sum + length, 0),
      median: pick(.5),
      max: lengths.at(-1) || 0,
      p95: pick(.95),
    };
  }, [termsChunks]);

  const visibleChunks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return termsChunks;
    return termsChunks.filter((chunk) => [chunk.meta?.article_no, chunk.meta?.article_title, chunk.text].join(" ").toLowerCase().includes(needle));
  }, [query, termsChunks]);
  const selectedMeta = selectedChunk?.meta || {};
  const selectedNumber = termsChunks.indexOf(selectedChunk) + 1;
  const spreadPages = useMemo(() => [page, page + 1].filter((value) => !pageCount || value <= pageCount), [page, pageCount]);
  const pageChunks = useMemo(() => termsChunks.filter((chunk) =>
    (chunk.page_bboxes || []).some((item) => spreadPages.includes(Number(item.page_number)))), [spreadPages, termsChunks]);
  const highlightsByPage = useMemo(() => Object.fromEntries(spreadPages.map((pageNumber) => [pageNumber, pageChunks.flatMap((chunk) =>
    (chunk.page_bboxes || []).filter((item) => Number(item.page_number) === pageNumber).map((item) => ({
      id: String(chunk.ordinal),
      display_label: `${chunk.meta?.article_no || "조문"} ${chunk.meta?.article_title || ""}`.trim(),
      display_bbox: item.display_bbox,
      active: selectedChunk?.ordinal === chunk.ordinal,
    })))])), [pageChunks, selectedChunk, spreadPages]);
  const selectChunk = (chunk) => {
    setSelectedChunk(chunk);
    setPage(chunk?.page_bboxes?.[0]?.page_number || chunk?.meta?.page_start || 1);
  };
  const selectChunkFromPdf = (id) => {
    const chunk = termsChunks.find((item) => String(item.ordinal) === String(id));
    if (!chunk) return;
    setSelectedChunk(chunk);
    const list = renderListRef.current;
    const card = list?.querySelector(`[data-term-ordinal="${chunk.ordinal}"]`);
    if (list && card) {
      list.scrollTo({
        top: list.scrollTop + card.getBoundingClientRect().top - list.getBoundingClientRect().top,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="rag-terms-shell">
      <div className="rag-step-label"><span>{step}</span>Terms Parsing</div>
      <div className="rag-terms-head">
        <div><b>약관 Chunk 결과</b><p>업로드된 문서에서 생성한 조문 단위 파싱 결과입니다.</p></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="조문, 제목, 본문 검색" aria-label="Terms chunk 검색" />
      </div>
      {termsError && <div className="rag-terms-error" role="alert">{termsError}</div>}
      <div className="rag-terms-stats">
        <div><span>Chunks</span><b>{stats.count.toLocaleString()}</b><em>조문 단위 출력 개수</em></div>
        <div><span>Pages</span><b>{stats.pages}</b><em>{stats.uniquePages} unique pages</em></div>
        <div><span>Text</span><b>{stats.chars.toLocaleString()}</b><em>median {stats.median.toLocaleString()} chars</em></div>
        <div><span>Max Chunk</span><b>{stats.max.toLocaleString()}</b><em>p95 {stats.p95.toLocaleString()} chars</em></div>
      </div>
      <div className="rag-terms-workspace">
        <div>
          <div className="rag-terms-list-head"><b>Chunks</b><span>{visibleChunks.length}개</span></div>
          <div className="rag-terms-list">
            {visibleChunks.map((chunk, index) => {
              const meta = chunk.meta || {};
              const selected = selectedChunk === chunk;
              return (
                <article key={`${meta.article_no}-${index}`} className={selected ? "active" : ""}>
                  <button type="button" className="rag-terms-card" aria-pressed={selected} onClick={() => selectChunk(chunk)}>
                    <div><b>#{termsChunks.indexOf(chunk) + 1} {meta.article_no || "조문"}{meta.article_title ? ` ${meta.article_title}` : ""}</b><span>p.{meta.page_start || "?"}-{meta.page_end || "?"}</span></div>
                    <p>{chunk.text}</p>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
        <div className="rag-terms-detail">
          <div className="rag-terms-list-head"><b>선택한 Chunk</b></div>
          {selectedChunk && (
            <>
              <h3>#{selectedNumber} {selectedMeta.article_no || "조문"}{selectedMeta.article_title ? ` ${selectedMeta.article_title}` : ""}</h3>
              <div className="rag-terms-chips">
                {Object.entries(selectedMeta.hierarchy || {}).map(([key, value]) => <span key={key}>{key}: {value}</span>)}
              </div>
              <div className="rag-terms-detail-stats">
                <div><span>page_start</span><b>{selectedMeta.page_start ?? "—"}</b></div>
                <div><span>page_end</span><b>{selectedMeta.page_end ?? "—"}</b></div>
                <div><span>chars</span><b>{String(selectedChunk.text || "").length.toLocaleString()}</b></div>
              </div>
              <p className="rag-terms-path">{(selectedMeta.parent_path || Object.values(selectedMeta.hierarchy || {})).join(" › ")}</p>
              <h4>본문</h4>
              <div className="rag-terms-body">{selectedChunk.text}</div>
              <h4>Raw Meta</h4>
              <pre className="rag-terms-raw">{JSON.stringify(selectedMeta, null, 2)}</pre>
            </>
          )}
        </div>
      </div>
      <div className="rag-terms-render-head"><b>Terms PDF Render</b><span>선택한 조문의 normalized bbox를 원문 PDF에 표시합니다.</span></div>
      <div className="rag-workspace rag-terms-render-workspace">
        <div className="rag-panel rag-preview-panel">
          <div className="rag-panel-head"><div><b>Inline Render</b><span>개인용공동물건_자동차보험.pdf · p.{spreadPages.join("-")}</span></div><em>{spreadPages.reduce((sum, value) => sum + (highlightsByPage[value]?.length || 0), 0)} bbox</em></div>
          <div className="rag-pdf-pager rag-terms-spread-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 2))}>‹</button>
            <span>{spreadPages.join("-")} / {pageCount || "?"}</span>
            <button type="button" disabled={!pageCount || page + 1 >= pageCount} onClick={() => setPage(Math.min(pageCount, page + 2))}>›</button>
          </div>
          <div className="rag-terms-pdf-spread">
            {spreadPages.map((pageNumber) => (
              <PdfArtifactPreview
                key={pageNumber}
                url="/api/rag-data/pdf/personal-common-auto-insurance.pdf"
                highlights={highlightsByPage[pageNumber] || []}
                tone="var(--teal)"
                page={pageNumber}
                onPage={setPage}
                pageCount={pageCount}
                onPageCount={setPageCount}
                chunksLoading={false}
                scale={1.15}
                showPager={false}
                fitWidth
                onHighlightSelect={selectChunkFromPdf}
              />
            ))}
          </div>
        </div>
        <div className="rag-panel">
          <div className="rag-panel-head"><div><b>Terms BBox 결과</b><span>p.{spreadPages.join("-")} · {pageChunks.length} chunks</span></div></div>
          <div key={spreadPages.join("-")} ref={renderListRef} className="rag-chunks" style={{ "--tone": "var(--teal)" }}>
            {pageChunks.map((chunk) => (
              <button key={chunk.ordinal} type="button" data-term-ordinal={chunk.ordinal} className={selectedChunk?.ordinal === chunk.ordinal ? "active" : ""} onClick={() => setSelectedChunk(chunk)}>
                <em>TERM-{String(chunk.ordinal + 1).padStart(4, "0")}</em>
                <b>{chunk.meta?.article_no || "조문"}{chunk.meta?.article_title ? ` ${chunk.meta.article_title}` : ""}</b>
                <span>p.{chunk.meta?.page_start || "?"}-{chunk.meta?.page_end || "?"} · {String(chunk.text || "").length.toLocaleString()} chars</span>
                <p>{chunk.text}</p>
              </button>
            ))}
            {!pageChunks.length && <div className="rag-analysis-state">p.{spreadPages.join("-")}에 표시할 Terms bbox가 없습니다.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function PurePdfViewer({ url }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    let pdfDocument;

    const render = async () => {
      globalThis.pdfjsLib = pdfjsLib;
      const { EventBus, PDFLinkService, PDFViewer } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      const container = containerRef.current;
      const viewer = viewerRef.current;
      if (!container || !viewer || cancelled) return;

      viewer.innerHTML = "";
      const eventBus = new EventBus();
      const linkService = new PDFLinkService({ eventBus });
      const pdfViewer = new PDFViewer({ container, viewer, eventBus, linkService });
      linkService.setViewer(pdfViewer);
      eventBus.on("pagesinit", () => {
        pdfViewer.currentScaleValue = "page-width";
      });

      loadingTask = pdfjsLib.getDocument({ url });
      pdfDocument = await loadingTask.promise;
      if (cancelled) {
        await pdfDocument.destroy();
        return;
      }
      pdfViewer.setDocument(pdfDocument);
      linkService.setDocument(pdfDocument, null);
    };

    render().catch((e) => console.error(e));
    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      pdfDocument?.destroy?.();
    };
  }, [url]);

  return (
    <div ref={containerRef} className="rag-pdfjs-viewer">
      <div ref={viewerRef} className="pdfViewer" />
    </div>
  );
}

export default function RagVector({ lang, go, nav }) {
  const ko = lang === "ko";
  const { projects, active, activeId, switchTo } = useProjects();
  const groupRef = useRef(null);
  const analysisSeq = useRef(0);
  const [files, setFiles] = useState([]);
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [strategy, setStrategy] = useState("best");
  const [chunkId, setChunkId] = useState(null);
  const [mcpState, setMcpState] = useState("idle");
  const [mcpPct, setMcpPct] = useState(0);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [projectDocs, setProjectDocs] = useState([]);
  const [projectExecution, setProjectExecution] = useState(null);
  const [projectExecutionLoading, setProjectExecutionLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const mcpTimer = useRef(null);
  const ragChunkListRef = useRef(null);
  const txt = TEXT[ko ? "ko" : "en"];

  useEffect(() => {
    api.runtime().then((value) => setDemoMode(value.rag_demo === true)).catch(() => setDemoMode(false));
  }, []);

  const candidates = analysis?.candidates || [];
  const bestCandidate = candidates.find((candidate) => candidate.id === analysis?.best?.strategy_id) || candidates[0];
  const strategies = bestCandidate ? [...candidates, { ...bestCandidate, id: "best", label: "Best", tone: "var(--green)" }] : [];
  const selectedStrategy = strategies.find((candidate) => candidate.id === strategy) || strategies[0];
  const chunks = selectedStrategy?.chunks || [];
  const pageCount = analysis?.document?.page_count || 0;
  const ragSpreadPages = useMemo(() => [pageNumber, pageNumber + 1].filter((value) => !pageCount || value <= pageCount), [pageCount, pageNumber]);
  const pageChunks = chunks.filter((chunk) => ragSpreadPages.some((value) => Number(chunk.page_start || 1) <= value && Number(chunk.page_end || chunk.page_start || 1) >= value));
  const pageChunkGroups = useMemo(() => {
    const groups = new Map();
    ragSpreadPages.forEach((value) => groupOverlappingChunkRows(
      chunks.filter((chunk) => Number(chunk.page_start || 1) <= value && Number(chunk.page_end || chunk.page_start || 1) >= value),
      value,
    ).forEach((group) => {
      const current = groups.get(group.chunk.id);
      if (current) current.chunkIds = [...new Set([...current.chunkIds, ...group.chunkIds])];
      else groups.set(group.chunk.id, group);
    }));
    return [...groups.values()];
  }, [chunks, ragSpreadPages]);
  const ragHighlightsByPage = useMemo(() => Object.fromEntries(ragSpreadPages.map((value) => {
    const groups = new Map();
    chunks.forEach((chunk, colorIndex) => mergeContiguousChunkRects(
      (chunk.rects || []).filter((rect) => Number(rect.page) === value),
    ).forEach((rect) => {
      const textKey = String(chunk.text || chunk.title || "").normalize("NFKC").replace(/\s+/g, "");
      const rectKey = [rect.x, rect.y, rect.w, rect.h].map((item) => Number(item).toFixed(2)).join(":");
      const key = `${textKey}:${rectKey}`;
      const current = groups.get(key);
      if (current) current.chunkIds.push(chunk.id);
      else groups.set(key, { chunk, chunkIds: [chunk.id], rect, colorIndex });
    }));
    return [value, [...groups.values()].map(({ chunk, chunkIds, rect, colorIndex }) => ({
      id: chunk.id,
      display_label: `${chunkIds.join(", ")} ${chunk.title}`,
      display_bbox: [rect.x / 100, rect.y / 100, (rect.x + rect.w) / 100, (rect.y + rect.h) / 100],
      active: chunkIds.includes(chunkId),
      tone: CHUNK_COLORS[colorIndex % CHUNK_COLORS.length],
    }))];
  })), [chunkId, chunks, ragSpreadPages]);
  const metricLabels = analysis?.metrics || METRICS;
  const activeChunk = chunks.find((c) => c.id === chunkId) || chunks[0];
  const docName = analysis?.document?.name || files[0]?.name || "PDF 미선택";
  const docId = analysis?.document?.sha256 ? `sha256:${analysis.document.sha256.slice(0, 12)}` : "분석 전";
  const done = Boolean(analysis) || (nav?.sourceMode === "terms" && demoMode);
  const modeReady = demoMode !== null;
  const runResultMode = modeReady && !demoMode && Boolean(nav?.executionId && nav?.documentExecutionId && nav?.referenceId);
  const projectMode = modeReady && Boolean(nav?.pipelineMode && !runResultMode);
  const landingMode = modeReady && !runResultMode && !projectMode;
  const resultStepOffset = projectMode && demoMode ? 1 : 0;
  const graphRagSelected = nav?.pipelineMode === "graphrag";
  const projectDocumentName = files[0]?.name || nav?.documentName || projectDocs[0]?.name || "";

  const analyzeDocument = useCallback(async (source) => {
    const seq = ++analysisSeq.current;
    setRunning(true);
    setAnalysisError("");
    setMcpState("idle");
    setMcpPct(0);
    try {
      let blob = source.file;
      if (!blob) {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`PDF Blob 로드 실패 (HTTP ${response.status})`);
        blob = await response.blob();
      }
      if (blob.type && blob.type !== "application/pdf" && !source.name?.toLowerCase().endsWith(".pdf")) throw new Error("PDF 파일만 chunk 시각화할 수 있습니다.");
      const sha256 = await hashBlob(blob);
      if (seq !== analysisSeq.current) return;
      const fixtureUrl = source.chunkersUrl || fixtureUrlForSha(sha256);
      let result;
      if (fixtureUrl && demoMode) {
        const response = await fetch(fixtureUrl);
        if (!response.ok) throw new Error(`검증된 chunker 결과 로드 실패 (HTTP ${response.status})`);
        const fixture = await response.json();
        const fixtureSha = String(fixture?.document?.sha256 || "").toLowerCase();
        if (fixtureSha !== sha256.toLowerCase()) throw new Error("PDF와 검증된 chunker 결과의 SHA-256이 일치하지 않습니다.");
        result = normalizeChunkAnalysis(fixture, {
          name: source.name || "document.pdf",
          sha256,
          size: blob.size,
          type: blob.type || "application/pdf",
        });
      } else if (demoMode) {
        result = await analyzePdfBlob(blob, source.name || "document.pdf", pdfjsLib, sha256);
      } else {
        throw new Error("문서 처리 결과가 아직 준비되지 않았습니다. Pipeline Execution 상세에서 진행 상태를 확인해주세요.");
      }
      if (seq !== analysisSeq.current) return;
      setAnalysis(result);
      setPdfUrl(source.url);
      setStrategy("best");
      const winner = result.candidates.find((candidate) => candidate.id === result.best.strategy_id);
      setChunkId(winner?.chunks[0]?.id || null);
      setPageNumber(winner?.chunks[0]?.page_start || 1);
    } catch (error) {
      if (seq === analysisSeq.current) {
        setAnalysis(null);
        setAnalysisError(error.message || "PDF 분석에 실패했습니다.");
      }
    } finally {
      if (seq === analysisSeq.current) setRunning(false);
    }
  }, [demoMode]);

  const selectProjectDocument = useCallback((doc) => {
    const url = projectPdfUrl(doc);
    if (!url) return;
    const chunkersUrl = projectChunkersUrl(doc);
    setFiles([{ name: doc.name, path: doc.path, type: "application/pdf", url, chunkersUrl }]);
    setAnalysis(null);
    setAnalysisError("");
    if (demoMode) analyzeDocument({ name: doc.name, path: doc.path, type: "application/pdf", url, chunkersUrl });
  }, [analyzeDocument, demoMode]);

  const convertMcp = () => {
    clearInterval(mcpTimer.current);
    setMcpState("running");
    setMcpPct(0);
    let tick = 0;
    mcpTimer.current = setInterval(() => {
      tick += 1;
      const pct = Math.min(100, tick * 6);
      setMcpPct(pct);
      if (pct >= 100) {
        clearInterval(mcpTimer.current);
        setMcpPct(100);
        setMcpState("done");
      }
    }, 90);
  };

  useEffect(() => () => {
    clearInterval(mcpTimer.current);
  }, []);

  useEffect(() => {
    if (!groupOpen) return;
    const close = (event) => { if (!groupRef.current?.contains(event.target)) setGroupOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [groupOpen]);

  useEffect(() => {
    if (!modeReady || !nav?.pipelineMode || !activeId || runResultMode) return setProjectDocs([]);
    let alive = true;
    const requestSeq = ++analysisSeq.current;
    setProjectDocs([]);
    if (nav?.sourceMode !== "terms") {
      setFiles([]);
      setPdfUrl(null);
      setAnalysis(null);
    }
    api.projectHealth(activeId)
      .then((health) => {
        if (!alive) return;
        const docs = (health.resources || []).filter((resource) => resource.source_kind === "document" || resource.mtype === "document" || resource.rtype === "doc");
        setProjectDocs(docs);
        const initialDoc = nav?.documentPath
          ? docs.find((doc) => doc.path === nav.documentPath)
          : docs.find((doc) => doc.name === nav?.documentName) || docs[0];
        if (nav?.sourceMode !== "terms" && initialDoc && requestSeq === analysisSeq.current) {
          const url = projectPdfUrl(initialDoc);
          if (url) selectProjectDocument(initialDoc);
          else setAnalysisError("원본이 없는 문서입니다. manifest에 path 또는 blob_url을 지정해주세요.");
        } else if (nav?.sourceMode !== "terms") {
          setAnalysisError("지정된 문서를 찾을 수 없습니다.");
        }
      })
      .catch((error) => {
        if (!alive) return;
        setProjectDocs([]);
        if (nav?.sourceMode !== "terms") setAnalysisError(error.message || "프로젝트 문서를 불러오지 못했습니다.");
      });
    return () => { alive = false; };
  }, [activeId, modeReady, nav?.documentName, nav?.documentPath, nav?.pipelineMode, nav?.sourceMode, runResultMode, selectProjectDocument]);

  useEffect(() => {
    if (!projectMode || demoMode || !activeId || !projectDocumentName) {
      setProjectExecution(null);
      setProjectExecutionLoading(false);
      return undefined;
    }
    let alive = true;
    setProjectExecution(null);
    setProjectExecutionLoading(true);
    api.ragPipelineExecutions(activeId, { filename: projectDocumentName, limit: 5 })
      .then(async (value) => {
        const executions = value?.items || [];
        const target = graphRagSelected ? "graphrag" : "ai_search";
        const documents = await Promise.all(executions.map((execution) => api.ragPipelineDocuments(execution.id, { filename: projectDocumentName, limit: 1 }).catch(() => ({ items: [] }))));
        const match = executions.find((execution, index) => documents[index]?.items?.some((document) => document.profiles?.some((profile) => profile.target === target)));
        if (alive) setProjectExecution(match || null);
      })
      .catch(() => { if (alive) setProjectExecution(null); })
      .finally(() => { if (alive) setProjectExecutionLoading(false); });
    return () => { alive = false; };
  }, [activeId, demoMode, graphRagSelected, projectDocumentName, projectMode]);

  const executionGuide = useMemo(() => {
    if (projectExecutionLoading) return {
      title: ko ? "문서 처리 내역을 확인하고 있어요." : "Checking document processing history.",
      body: ko ? "잠시만 기다려주세요." : "Please wait a moment.",
      action: null,
      tone: "var(--blue)",
    };
    const status = projectExecution?.status;
    if (["pending", "running"].includes(status)) return {
      title: ko ? "문서 지식화를 진행하고 있어요." : "Document processing is in progress.",
      body: ko ? "Pipeline Execution 상세에서 현재 Phase와 단계별 진행 상황을 확인할 수 있습니다. 완료되면 같은 화면에서 처리 결과를 열 수 있어요." : "Open Pipeline Execution details to follow each phase. Results will be available there after processing completes.",
      action: ko ? "진행 상황 보기" : "View progress",
      tone: "var(--blue)",
    };
    if (["failed", "cancelled"].includes(status)) return {
      title: ko ? "문서 지식화가 완료되지 않았어요." : "Document processing did not complete.",
      body: ko ? "Pipeline Execution 상세에서 실패한 Phase와 오류 원인을 확인하세요." : "Open Pipeline Execution details to inspect the failed phase and error.",
      action: ko ? "실패 원인 보기" : "View error",
      tone: "var(--red)",
    };
    if (projectExecution) return {
      title: ko ? "문서 처리 결과는 실행 상세에서 확인할 수 있어요." : "Document results are available in execution details.",
      body: ko ? "Pipeline Execution 상세에서 문서와 처리 경로를 선택한 뒤 결과 보기를 눌러 청크·그래프 시각화를 확인하세요." : "Select the document and processing path in Pipeline Execution details, then open its chunk or graph visualization.",
      action: ko ? "실행 결과 보기" : "View results",
      tone: "var(--green)",
    };
    return {
      title: ko ? "이 문서의 처리 내역이 아직 없어요." : "No processing history was found for this document.",
      body: ko ? "대시보드의 Pipeline Execution 목록에서 실행 상태를 확인하거나 새 작업을 시작하세요." : "Check Pipeline Executions on the dashboard or start a new job.",
      action: ko ? "Pipeline Execution 목록 보기" : "View Pipeline Executions",
      tone: "var(--blue)",
    };
  }, [ko, projectExecution, projectExecutionLoading]);

  const pickStrategy = (id) => {
    setStrategy(id);
    const candidate = id === "best" ? bestCandidate : candidates.find((item) => item.id === id);
    setChunkId(candidate?.chunks[0]?.id || null);
    setPageNumber(candidate?.chunks[0]?.page_start || 1);
  };

  const pickChunk = (id) => {
    const chunk = chunks.find((item) => item.id === id);
    setChunkId(id);
    const starts = Number(chunk?.page_start);
    const ends = Number(chunk?.page_end || starts);
    if (starts && !ragSpreadPages.some((value) => starts <= value && value <= ends)) setPageNumber(starts);
  };
  const pickChunkFromPdf = (id) => {
    pickChunk(id);
    const list = ragChunkListRef.current;
    const card = [...(list?.querySelectorAll("[data-chunk-ids]") || [])]
      .find((item) => item.dataset.chunkIds.split(" ").includes(String(id)));
    if (list && card) {
      list.scrollTo({
        top: list.scrollTop + card.getBoundingClientRect().top - list.getBoundingClientRect().top,
        behavior: "smooth",
      });
    }
  };

  const downloadJson = () => {
    if (!analysis) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${docName.replace(/\.pdf$/i, "")}-chunkers.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!modeReady) return <div className="rag-page"><div className="rag-analysis-state">실행 모드를 확인하는 중…</div></div>;

  if (runResultMode) {
    return <RagRunResults
      executionId={nav.executionId}
      documentExecutionId={nav.documentExecutionId}
      referenceId={nav.referenceId}
      currentResult={{
        reference_id: nav.referenceId,
        filename: nav.documentName || "현재 문서",
        project_id: activeId,
        project_name: active?.name,
        projection: nav.sourceMode === "terms" ? "terms" : "adaptive",
        target: nav.pipelineMode === "graphrag" ? "graphrag" : "ai_search",
      }}
      onBack={() => go?.("rag", null)}
      onSelectResult={(item) => {
        switchTo(item.project_id);
        go?.("rag", {
          executionId: item.execution_id,
          documentExecutionId: item.document_execution_id,
          referenceId: item.reference_id,
          runId: item.run_id,
          sourceMode: item.projection === "terms" ? "terms" : "adaptive",
          pipelineMode: item.target === "graphrag" ? "graphrag" : "rag",
          documentName: item.filename,
        });
      }}
    />;
  }

  if (landingMode) {
    return (
      <div className="rag-page rag-page-fluid">
        <div className="rag-head">
          <div className="rag-titlemark"><GraphIcon /></div>
          <div>
            <h1>RAG Vector DB</h1>
            <p>{txt.subtitle}</p>
          </div>
          <button type="button" className="rag-new-document" onClick={() => setComposerOpen(true)}>
            <span aria-hidden="true">＋</span>새 문서 처리
          </button>
        </div>
        {composerOpen && (
          <RagDocumentUploadPanel
            projectId={activeId}
            projectName={active?.name}
            onClose={() => setComposerOpen(false)}
            onStarted={(execution) => {
              const executionProjectId = projectIdForRagExecution(execution, activeId);
              if (executionProjectId) switchTo(executionProjectId);
              go?.("dashboard", dashboardNavForRagExecution(execution));
            }}
          />
        )}
        <RagResultIndex projectId={activeId} onOpen={(item) => {
          switchTo(item.project_id);
          go?.("rag", {
            executionId: item.execution_id,
            documentExecutionId: item.document_execution_id,
            referenceId: item.reference_id,
            runId: item.run_id,
            sourceMode: item.projection === "terms" ? "terms" : "adaptive",
            pipelineMode: item.target === "graphrag" ? "graphrag" : "rag",
            documentName: item.filename,
          });
        }} />
      </div>
    );
  }

  return (
    <div className="rag-page">
      <div className="rag-head">
        <div className="rag-titlemark"><GraphIcon /></div>
        <div>
          <h1>RAG Vector DB</h1>
          <p>{txt.subtitle}</p>
        </div>
        {nav?.pipelineMode && (
          <div ref={groupRef} style={{ marginLeft: "auto", position: "relative" }}>
            <button type="button" onClick={() => setGroupOpen((open) => !open)} aria-expanded={groupOpen} style={{ border: "1px solid var(--blue)", borderRadius: 999, padding: "7px 12px", background: "transparent", color: "var(--blue)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {active?.name} · {nav.pipelineMode === "graphrag" ? "GraphRAG" : "RAG"} 그룹 선택됨⌄
            </button>
            {groupOpen && (
              <div style={{ position: "absolute", top: 40, right: 0, width: 260, padding: 6, zIndex: 30, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.24)" }}>
                {projects.map((project) => (
                  <button key={project.id} type="button" onClick={() => { switchTo(project.id); setGroupOpen(false); }} style={{ display: "flex", width: "100%", border: 0, borderRadius: 8, padding: "9px 10px", background: project.id === activeId ? "var(--blue-soft)" : "transparent", color: "var(--navy)", fontSize: 12, fontWeight: project.id === activeId ? 800 : 600, textAlign: "left", cursor: "pointer" }}>
                    {project.id === activeId ? "● " : "○ "}{project.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <section className="rag-banner">
        <div>
          <strong>{txt.banner}</strong>
        </div>
        <div className="rag-banner-metrics">
          <b>9</b><span>pipeline steps</span>
          <b>{analysis?.candidates?.length || 3}</b><span>chunk candidates</span>
          <b>{INITIAL_NODES.length}</b><span>graph entities</span>
        </div>
      </section>

      {projectMode && !demoMode && (
        <section className="rag-upload-shell">
          <div className="rag-step-label"><span>1</span>업로드된 문서</div>
          {projectDocs.length ? (
            <div className="rag-files" style={{ marginTop: 16 }}>
              {projectDocs.map((doc) => {
                const url = projectPdfUrl(doc);
                return (
                  <button key={doc.path || doc.name} type="button" className={doc.path === files[0]?.path ? "active" : ""} disabled={!url} data-tip={url ? "실제 Blob 분석" : "Blob URL 없음"} onClick={() => {
                    if (!url) return;
                    selectProjectDocument(doc);
                  }}>
                    <FileIcon /><span>{doc.name}</span><em>{doc.path === files[0]?.path && analysis ? "분석됨" : "등록됨"}</em>
                  </button>
                );
              })}
            </div>
          ) : <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>이 프로젝트에 업로드된 문서가 없습니다.</div>}
        </section>
      )}

      {(running || analysisError) && nav?.sourceMode !== "terms" && (
        <div className={`rag-analysis-state ${analysisError ? "error" : ""}`}>
          {running ? "PDF를 분석하고 청킹 품질을 평가하는 중…" : analysisError}
        </div>
      )}

      {projectMode && !demoMode && projectDocumentName && (
        <section className="rag-execution-guide" style={{ "--rag-guide-tone": executionGuide.tone }}>
          <span className="rag-execution-guide-icon" aria-hidden="true">{projectExecutionLoading ? "…" : "↗"}</span>
          <div>
            <b>{executionGuide.title}</b>
            <p>{executionGuide.body}</p>
            {projectExecution && <small>{projectExecution.display_name}</small>}
          </div>
          {executionGuide.action && (
            <button type="button" onClick={() => projectExecution ? go?.("ragExecution", { executionId: projectExecution.id }) : go?.("dashboard")}>
              {executionGuide.action}<span aria-hidden="true">→</span>
            </button>
          )}
        </section>
      )}

      {done && (
        <>
          {nav?.sourceMode === "terms" ? (
            <TermsParsing step={2 - resultStepOffset} />
          ) : <div>
            <div className="rag-step-label"><span>{2 - resultStepOffset}</span>RAG Parsing</div>
            <section className="rag-workspace">
            <div className="rag-panel rag-preview-panel">
              <div className="rag-panel-head">
                <div><b>Inline Render</b><span>{docName} · {docId}</span></div>
                <em>{strategy === "best" ? `Best · ${bestCandidate?.label}` : selectedStrategy?.label}</em>
              </div>
              <div className="rag-strategies">
                {strategies.map((s) => (
                  <button key={s.id} onClick={() => pickStrategy(s.id)} className={strategy === s.id ? "active" : ""} style={{ "--tone": s.tone }}>
                    {s.label}{s.id === "best" ? ` · ${formatScore(s.overall)}` : ""}
                  </button>
                ))}
              </div>
              <div className="rag-document">
                <div className="rag-rag-spread-shell">
                  <div className="rag-pdf-pager rag-rag-spread-pager">
                    <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(Math.max(1, pageNumber - 2))}>‹</button>
                    <span>{ragSpreadPages.join("-")} / {pageCount}</span>
                    <button type="button" disabled={!pageCount || pageNumber + 1 >= pageCount} onClick={() => setPageNumber(Math.min(pageCount, pageNumber + 2))}>›</button>
                  </div>
                  <div className="rag-terms-pdf-spread">
                    {ragSpreadPages.map((value) => (
                      <PdfArtifactPreview
                        key={value}
                        url={pdfUrl}
                        highlights={ragHighlightsByPage[value] || []}
                        tone="var(--green)"
                        page={value}
                        onPage={setPageNumber}
                        pageCount={pageCount}
                        chunksLoading={false}
                        scale={1.15}
                        showPager={false}
                        fitWidth
                        onHighlightSelect={pickChunkFromPdf}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rag-panel">
              <div className="rag-panel-head">
                <div><b>{txt.chunkResult}</b><span>{ko ? "평가 점수" : "Evaluation score"} {formatScore(selectedStrategy?.overall)} · 전체 {chunks.length} / p.{ragSpreadPages.join("-")} {pageChunks.length} chunks{pageChunkGroups.length < pageChunks.length ? ` · ${pageChunkGroups.length} ${ko ? "묶음" : "groups"}` : ""}</span></div>
                <button type="button" className="rag-json-download" onClick={downloadJson}>JSON ↓</button>
              </div>
              <div className="rag-strategy-desc" style={{ "--tone": selectedStrategy?.tone }}>{ko ? selectedStrategy?.description : selectedStrategy?.descriptionEn}</div>
              <div key={ragSpreadPages.join("-")} ref={ragChunkListRef} className="rag-chunks">
                {pageChunkGroups.map(({ chunk: c, chunkIds }) => (
                  <button key={c.id} type="button" data-chunk-ids={chunkIds.join(" ")} onClick={() => pickChunk(c.id)} className={chunkIds.includes(activeChunk?.id) ? "active" : ""} style={{ "--tone": selectedStrategy?.tone }} title={chunkIds.length > 1 ? chunkIds.join(", ") : undefined}>
                    <em>{c.id}{chunkIds.length > 1 ? ` +${chunkIds.length - 1}` : ""}</em>
                    <b>{c.title}</b>
                    <span>p.{c.page_start}{c.page_end !== c.page_start ? `-${c.page_end}` : ""} · {c.chars.toLocaleString()} chars<br />{c.text}</span>
                  </button>
                ))}
                {!pageChunks.length && <div className="rag-analysis-state">p.{pageNumber}에 표시할 chunk가 없습니다.</div>}
              </div>
              <div className="rag-scores">
                {metricLabels.map((m) => (
                  <div key={m}>
                    <span>{m}</span>
                    <b>{formatScore(selectedStrategy?.scores[m])}</b>
                    <i><u style={{ width: `${selectedStrategy?.scores[m]}%`, background: selectedStrategy?.tone }} /></i>
                  </div>
                ))}
              </div>
            </div>
            </section>
          </div>}

          {graphRagSelected && (
            <section className="rag-graphrag-shell">
              <div className="rag-step-label"><span>{3 - resultStepOffset}</span>Graph RAG</div>
              <p>climax_ko 그룹의 Knowledge Graph를 LightRAG와 같은 Sigma/graphology 방식으로 탐색합니다.</p>
              <GraphRagViewer />
            </section>
          )}

          <section className="rag-mcp-convert">
            <div className="rag-step-label"><span>{4 - resultStepOffset}</span>{txt.mcp}</div>
            <div className="rag-mcp-stagebar">
              {MCP_STAGES.map((stage, i) => (
                <div key={stage} className={mcpPct >= ((i + 1) / MCP_STAGES.length) * 100 || mcpState === "done" ? "done" : mcpState === "running" && mcpPct >= (i / MCP_STAGES.length) * 100 ? "active" : ""}>
                  <span>{mcpPct >= ((i + 1) / MCP_STAGES.length) * 100 || mcpState === "done" ? "✓" : i + 1}</span>
                  <b>{stage}</b>
                </div>
              ))}
            </div>
            <div className="rag-mcp-grid">
              <div><span>RAG CHUNKS</span><b>{bestCandidate?.chunks.length || 0}</b></div>
              <div><span>GRAPH ENTITIES</span><b>{INITIAL_NODES.length}</b></div>
              <div><span>MCP TOOLS</span><b>3</b></div>
              <div><span>STRATEGY</span><b>{analysis?.best?.strategy_id || "best"}</b></div>
            </div>
            <div className="rag-engine-log">
              <div>
                <span />
                <b>{txt.engineLog}</b>
                <em>{mcpPct}%</em>
              </div>
              <pre>
                {(mcpState === "idle" ? [{ tag: "ready", text: "waiting for MCP conversion" }] : MCP_LOGS.slice(0, Math.max(1, Math.ceil((mcpPct / 100) * MCP_LOGS.length)))).map((row) => `[${row.tag}] ${row.text}`).join("\n")}
              </pre>
            </div>
            {mcpState === "done" ? (
              <div className="rag-mcp-done">
                <div><span>✓</span></div>
                <div>
                  <b>{txt.mcpDone}</b>
                  <p>{txt.mcpDoneSub}</p>
                </div>
                <button type="button" onClick={() => go?.("explorer")}>{txt.mcpExplore} <i>›</i></button>
              </div>
            ) : (
              <div className="rag-mcp-actions">
                <button type="button" onClick={convertMcp} disabled={mcpState === "running"}>
                  {mcpState === "running" ? txt.mcpRunning : txt.mcpStart}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {previewDoc && (
        <div className="rag-preview-backdrop" onClick={() => setPreviewDoc(null)}>
          <aside className="rag-preview-drawer" onClick={(e) => e.stopPropagation()} aria-label={txt.inlineTitle}>
            <div className="rag-preview-head">
              <div><b>{txt.inlineTitle}</b><span>{previewDoc.name}</span></div>
              <button type="button" onClick={() => setPreviewDoc(null)}>{txt.close}</button>
            </div>
            <div className="rag-preview-body">
              <PurePdfViewer url={previewDoc.url} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
