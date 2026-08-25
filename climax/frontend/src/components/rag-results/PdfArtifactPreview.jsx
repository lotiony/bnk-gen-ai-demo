import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createRetainedResourceCache } from "../../lib/retainedResourceCache";
import ChunkLoadingSpinner from "./ChunkLoadingSpinner";
import { normalizedRect } from "./resultUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const pdfDocuments = createRetainedResourceCache({
  maxInactive: 10,
  dispose: (document) => document.destroy?.(),
});

function loadPdfDocument(url) {
  return pdfDocuments.acquire(url, () => {
    const task = pdfjsLib.getDocument({
      url,
      disableRange: false,
      disableStream: true,
      disableAutoFetch: true,
      rangeChunkSize: 65_536,
    });
    return task.promise.catch(async (error) => {
      await task.destroy?.();
      throw error;
    });
  });
}

export default function PdfArtifactPreview({
  url,
  highlights,
  tone,
  page,
  onPage,
  pageCount,
  onPageCount,
  chunksLoading,
  onHighlightSelect,
  scale = 1.15,
  showPager = true,
  fitWidth = false,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const [renderedPage, setRenderedPage] = useState(0);
  const [loadState, setLoadState] = useState("loading");
  const [retryToken, setRetryToken] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const highlightsGeometryKey = (highlights || []).map((highlight) => [
    highlight.scope,
    highlight.id,
    (highlight.display_bbox || []).join(","),
  ].join(":"))
    .join("|");
  const activeHighlightIds = new Set(
    (highlights || []).filter((highlight) => highlight.active).map((highlight) => highlight.id),
  );

  useEffect(() => {
    if (!fitWidth || !containerRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitWidth]);

  useEffect(() => {
    setPdfDocument(null);
    setRenderedPage(0);
    setLoadState(url ? "loading" : "error");
    if (!url) return undefined;
    let cancelled = false;
    const lease = loadPdfDocument(url);
    lease.promise.then((document) => {
      if (cancelled) return;
      setPdfDocument(document);
      onPageCount?.(document.numPages);
    }).catch(() => {
      if (!cancelled) setLoadState("error");
    });
    return () => {
      cancelled = true;
      lease.release();
    };
  }, [onPageCount, retryToken, url]);

  useEffect(() => {
    if (!pdfDocument || (fitWidth && !containerWidth)) return undefined;
    let cancelled = false;
    let renderTask;
    setRenderedPage(0);
    setLoadState("loading");
    const render = async () => {
      const pdfPage = await pdfDocument.getPage(Math.min(page, pdfDocument.numPages));
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: fitWidth && containerWidth
        ? Math.min(scale, containerWidth / baseViewport.width)
        : scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setStage({ width: viewport.width, height: viewport.height });
      renderTask = pdfPage.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
      if (!cancelled) {
        setRenderedPage(page);
        setLoadState("ready");
      }
    };
    render().catch((reason) => {
      if (!cancelled && reason?.name !== "RenderingCancelledException") {
        setLoadState("error");
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [containerWidth, fitWidth, page, pdfDocument, scale]);

  const overlayRects = useMemo(() => {
    if (renderedPage !== page) return [];
    return (highlights || []).map((highlight) => {
      const canonical = normalizedRect({ bbox: highlight.display_bbox });
      return canonical ? {
        rect: canonical,
        label: highlight.id,
        displayLabel: highlight.display_label,
        tone: highlight.tone,
      } : null;
    }).filter(Boolean);
  }, [highlightsGeometryKey, page, renderedPage]);

  return (
    <div ref={containerRef} className="rag-run-pdf">
      {showPager && <div className="rag-pdf-pager">
        <button disabled={!pageCount || page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        <span>{page} / {pageCount || "?"}</span>
        <button disabled={!pageCount || page >= pageCount} onClick={() => onPage(page + 1)}>›</button>
      </div>}
      <div className="rag-run-pdf-scroll">
        <div
          className={`rag-pdf-stage${pdfDocument ? "" : " is-placeholder"}`}
          style={pdfDocument
            ? { width: stage.width, height: stage.height }
            : { width: "100%", height: 320 }}
          aria-busy={loadState === "loading"}
        >
          <canvas ref={canvasRef} />
          <div className="rag-run-bboxes" style={{ "--tone": tone }}>
            {overlayRects.map(({ rect, label, displayLabel, tone: highlightTone }, index) => {
              const active = activeHighlightIds.has(label);
              const zIndex = Math.max(1, 10000 - Math.round(rect.width * rect.height));
              return (
                <button
                  key={`chunk-overlay-${label}-${index}`}
                  type="button"
                  data-chunk-id={label}
                  className={active ? "active" : ""}
                  title={displayLabel}
                  aria-label={`${displayLabel} 선택`}
                  onClick={() => onHighlightSelect?.(label)}
                  style={{
                    "--tone": highlightTone || tone,
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
                    zIndex,
                  }}
                >
                  {active && <small>{displayLabel}</small>}
                </button>
              );
            })}
          </div>
          {(loadState === "loading" || chunksLoading) && (
            <ChunkLoadingSpinner
              overlay
              label={loadState === "loading" ? "원문 PDF 불러오는 중" : "청크 불러오는 중"}
            />
          )}
          {loadState === "error" && (
            <div className="rag-pdf-load-error" role="alert">
              <b>원문 PDF를 불러오지 못했습니다.</b>
              <span>잠시 후 다시 시도해 주세요.</span>
              <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
                다시 불러오기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
