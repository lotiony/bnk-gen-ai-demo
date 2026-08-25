import { useEffect, useMemo, useRef, useState } from "react";
import ChunkLoadingSpinner from "./ChunkLoadingSpinner";
import PdfSpreadPreview from "./PdfSpreadPreview";

export default function TermsRunResults({
  data,
  loading,
  hasMore,
  onLoadMore,
  query,
  onQuery,
  selectedOrdinal,
  onSelect,
  detail,
  detailLoading,
  pdfUrl,
  loadDetail,
}) {
  const [renderPage, setRenderPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pageDetails, setPageDetails] = useState({});
  const requestedDetails = useRef(new Set());
  const detailScope = useRef("");
  const selectingFromPdf = useRef(false);
  const renderListRef = useRef(null);
  const items = data?.items || [];
  const needle = query.trim().toLocaleLowerCase();
  const visibleItems = needle ? items.filter((item) => [
    item.article_no,
    item.article_title,
    item.special_clause_no,
    item.special_clause_title,
    item.heading,
    item.preview,
  ].join(" ").toLocaleLowerCase().includes(needle)) : items;
  const pages = items.flatMap((item) => Array.isArray(item.pages)
    ? item.pages
    : [item.page_start, item.page_end]).map(Number).filter(Number.isFinite);
  const lengths = items.map((item) => Number(item.char_count) || 0).sort((a, b) => a - b);
  const pick = (ratio) => lengths[
    Math.min(lengths.length - 1, Math.floor(lengths.length * ratio))
  ] || 0;
  const selectedMeta = detail?.meta || {};
  const selectedItem = items.find((item) => item.ordinal === selectedOrdinal);
  const selectedNumber = selectedItem
    ? items.indexOf(selectedItem) + 1
    : Number(selectedOrdinal) + 1;
  const selectedTitle = [
    detail?.article_no || selectedMeta.article_no,
    detail?.article_title || selectedMeta.article_title,
  ].filter(Boolean).join(" ") || detail?.heading || selectedMeta.heading || "조문";
  const hierarchy = selectedMeta.hierarchy || detail?.hierarchy || {};
  const parentPath = selectedMeta.parent_path || detail?.parent_path || Object.values(hierarchy);
  const documentScope = items[0]?.document_id || "";
  const spreadPages = useMemo(
    () => [renderPage, renderPage + 1].filter((value) => !pdfPageCount || value <= pdfPageCount),
    [pdfPageCount, renderPage],
  );
  const pageItems = useMemo(() => items.filter((item) => {
    const start = Number(item.page_start ?? item.page_number);
    const end = Number(item.page_end ?? start);
    return spreadPages.some((value) => start <= value && end >= value);
  }), [items, spreadPages]);

  useEffect(() => {
    detailScope.current = documentScope;
    requestedDetails.current.clear();
    setPageDetails({});
  }, [documentScope]);

  useEffect(() => {
    if (
      !detail
      || selectedOrdinal === null
      || Number(detail.ordinal) !== Number(selectedOrdinal)
    ) return;
    setPageDetails((current) => ({ ...current, [selectedOrdinal]: detail }));
    if (selectingFromPdf.current) {
      selectingFromPdf.current = false;
      return;
    }
    const firstPage = Number(detail.page_start ?? detail.page_number ?? detail.meta?.page_start);
    if (Number.isFinite(firstPage)) {
      setRenderPage((current) => (
        [current, current + 1].includes(firstPage) ? current : firstPage
      ));
    }
  }, [detail, selectedOrdinal]);

  useEffect(() => {
    const requestScope = documentScope;
    const missing = pageItems.filter((item) => (
      !pageDetails[item.ordinal] && !requestedDetails.current.has(item.ordinal)
    ));
    missing.forEach((item) => requestedDetails.current.add(item.ordinal));
    if (missing.length) {
      Promise.all(missing.map(async (item) => [item.ordinal, await loadDetail(item.ordinal)]))
        .then((rows) => {
          if (detailScope.current === requestScope) {
            setPageDetails((current) => ({ ...current, ...Object.fromEntries(rows) }));
          }
        })
        .catch(() => {});
    }
  }, [documentScope, loadDetail, pageDetails, pageItems]);

  const renderedDetails = pageItems.map((item) => pageDetails[item.ordinal]).filter(Boolean);
  const highlightsByPage = Object.fromEntries(spreadPages.map((pageNumber) => [
    pageNumber,
    renderedDetails.flatMap((item) => (item.page_bboxes || [])
      .filter((bbox) => Number(bbox.page_number) === pageNumber && Array.isArray(bbox.display_bbox))
      .map((bbox) => ({
        id: String(item.ordinal),
        display_label: item.heading || item.article_title || `Terms ${item.ordinal + 1}`,
        display_bbox: bbox.display_bbox,
        active: item.ordinal === selectedOrdinal,
      }))),
  ]));
  const selectFromPdf = (ordinal) => {
    selectingFromPdf.current = true;
    onSelect(Number(ordinal));
    window.requestAnimationFrame(() => {
      const list = renderListRef.current;
      const card = renderListRef.current?.querySelector(`[data-term-ordinal="${ordinal}"]`);
      if (!list || !card) return;
      list.scrollTop += card.getBoundingClientRect().top
        - list.getBoundingClientRect().top;
    });
  };

  return (
    <section className="rag-terms-shell">
      <div className="rag-terms-head">
        <div><b>약관 Chunk 결과</b><p>업로드된 문서에서 생성한 조문 단위 파싱 결과입니다.</p></div>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="조문, 제목, 본문 검색"
          aria-label="Terms chunk 검색"
        />
      </div>
      <div className="rag-terms-stats">
        <div><span>Chunks</span><b>{(data?.page?.total ?? items.length).toLocaleString()}</b><em>조문 단위 출력 개수</em></div>
        <div><span>Pages</span><b>{pages.length ? `${Math.min(...pages)}-${Math.max(...pages)}` : "—"}</b><em>{new Set(pages).size} unique pages</em></div>
        <div><span>Text</span><b>{lengths.reduce((sum, value) => sum + value, 0).toLocaleString()}</b><em>median {pick(.5).toLocaleString()} chars</em></div>
        <div><span>Max Chunk</span><b>{(lengths.at(-1) || 0).toLocaleString()}</b><em>p95 {pick(.95).toLocaleString()} chars</em></div>
      </div>
      <div className="rag-terms-workspace">
        <div>
          <div className="rag-terms-list-head"><b>Chunks</b><span>{visibleItems.length}개</span></div>
          <div
            className="rag-terms-list"
            onScroll={(event) => {
              const list = event.currentTarget;
              if (hasMore && !loading
                  && list.scrollHeight - list.scrollTop - list.clientHeight < 160) {
                onLoadMore?.();
              }
            }}
          >
            {loading && !items.length && <ChunkLoadingSpinner />}
            {visibleItems.map((item) => {
              const active = item.ordinal === selectedOrdinal;
              const title = [item.article_no, item.article_title].filter(Boolean).join(" ")
                || item.heading || item.special_clause_title || "조문";
              const pageStart = item.page_start ?? item.page_number ?? "?";
              const pageEnd = item.page_end ?? pageStart;
              return (
                <article key={item.ordinal} className={active ? "active" : ""}>
                  <button
                    type="button"
                    className="rag-terms-card"
                    aria-pressed={active}
                    onClick={() => onSelect(item.ordinal)}
                  >
                    <div><b>#{items.indexOf(item) + 1} {title}</b><span>p.{pageStart}-{pageEnd}</span></div>
                    <p>{item.preview}{item.truncated ? "…" : ""}</p>
                  </button>
                </article>
              );
            })}
            {!loading && !visibleItems.length && (
              <div className="rag-analysis-state">표시할 Chunk가 없습니다.</div>
            )}
            {loading && items.length > 0 && <ChunkLoadingSpinner />}
          </div>
        </div>
        <div className="rag-terms-detail">
          <div className="rag-terms-list-head"><b>선택한 Chunk</b></div>
          {detailLoading && <ChunkLoadingSpinner />}
          {!detailLoading && detail && (
            <>
              <h3>#{selectedNumber} {selectedTitle}</h3>
              <div className="rag-terms-chips">
                {Object.entries(hierarchy).map(([key, value]) => (
                  <span key={key}>{key}: {value}</span>
                ))}
              </div>
              <div className="rag-terms-detail-stats">
                <div><span>page_start</span><b>{detail.page_start ?? selectedMeta.page_start ?? "—"}</b></div>
                <div><span>page_end</span><b>{detail.page_end ?? selectedMeta.page_end ?? "—"}</b></div>
                <div><span>chars</span><b>{Number(detail.char_count || 0).toLocaleString()}</b></div>
              </div>
              <p className="rag-terms-path">{parentPath.filter(Boolean).join(" › ")}</p>
              <h4>본문</h4>
              <div className="rag-terms-body">{detail.preview}{detail.truncated ? "…" : ""}</div>
              <h4>Raw Meta</h4>
              <pre className="rag-terms-raw">{JSON.stringify(selectedMeta, null, 2)}</pre>
            </>
          )}
        </div>
      </div>
      <div className="rag-terms-render-head"><b>Terms PDF Render</b><span>선택한 조문의 normalized bbox를 원문 PDF에 표시합니다.</span></div>
      <div className="rag-workspace rag-terms-render-workspace">
        <div className="rag-panel rag-preview-panel">
          <div className="rag-panel-head"><div><b>Inline Render</b><span>p.{spreadPages.join("-")}</span></div><em>{spreadPages.reduce((sum, value) => sum + (highlightsByPage[value]?.length || 0), 0)} bbox</em></div>
          <PdfSpreadPreview
            url={pdfUrl}
            page={renderPage}
            pageCount={pdfPageCount}
            onPage={setRenderPage}
            onPageCount={setPdfPageCount}
            highlightsByPage={highlightsByPage}
            loadingByPage={{}}
            tone="var(--teal)"
            onHighlightSelect={selectFromPdf}
          />
        </div>
        <div className="rag-panel">
          <div className="rag-panel-head"><div><b>Terms BBox 결과</b><span>p.{spreadPages.join("-")} · {renderedDetails.length} chunks</span></div></div>
          <div key={spreadPages.join("-")} ref={renderListRef} className="rag-chunks" style={{ "--tone": "var(--teal)" }}>
            {renderedDetails.map((item) => (
              <button key={item.ordinal} type="button" data-term-ordinal={item.ordinal} className={item.ordinal === selectedOrdinal ? "active" : ""} onClick={() => onSelect(item.ordinal)}>
                <em>TERM-{String(item.ordinal + 1).padStart(4, "0")}</em>
                <b>{item.heading || item.article_title || "조문"}</b>
                <span>p.{item.page_start ?? item.meta?.page_start ?? "?"}-{item.page_end ?? item.meta?.page_end ?? "?"} · {Number(item.char_count || 0).toLocaleString()} chars</span>
                <p>{item.preview}</p>
              </button>
            ))}
            {!renderedDetails.length && <div className="rag-analysis-state">p.{spreadPages.join("-")}의 Terms bbox를 불러오는 중입니다.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
