import PdfArtifactPreview from "./PdfArtifactPreview";

export default function PdfSpreadPreview({
  url,
  page,
  pageCount,
  onPage,
  onPageCount,
  highlightsByPage,
  loadingByPage,
  tone,
  onHighlightSelect,
}) {
  const pages = [page, page + 1]
    .filter((value) => !pageCount || value <= pageCount);

  return (
    <div className="rag-pdf-spread-shell">
      <div className="rag-pdf-pager rag-pdf-spread-pager">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 2))}
        >‹</button>
        <span>{pages.join("-")} / {pageCount || "?"}</span>
        <button
          type="button"
          disabled={!pageCount || page + 1 >= pageCount}
          onClick={() => onPage(Math.min(pageCount, page + 2))}
        >›</button>
      </div>
      <div className="rag-pdf-spread">
        {url ? pages.map((pageNumber, index) => (
          <PdfArtifactPreview
            key={`pdf-spread-slot-${index}`}
            url={url}
            page={pageNumber}
            pageCount={pageCount}
            onPageCount={onPageCount}
            highlights={highlightsByPage[pageNumber] || []}
            chunksLoading={Boolean(loadingByPage[pageNumber])}
            tone={tone}
            showPager={false}
            fitWidth
            onHighlightSelect={onHighlightSelect}
          />
        )) : <div className="rag-analysis-state">원문 PDF를 불러오는 중입니다.</div>}
      </div>
    </div>
  );
}
