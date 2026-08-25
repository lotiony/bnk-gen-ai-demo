import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../../api";
import { createRetainedResourceCache } from "../../lib/retainedResourceCache";
import { profileLabel } from "./resultUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const resultTime = (value) => (value ? new Date(value).toLocaleString() : "—");
const resultThumbnails = createRetainedResourceCache({
  maxInactive: 24,
  dispose: (thumbnail) => URL.revokeObjectURL(thumbnail.src),
});

const canvasBlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("thumbnail image is unavailable"));
  }, "image/webp", 0.82);
});

async function renderResultThumbnail(url) {
  const task = pdfjsLib.getDocument({
    url,
    disableRange: false,
    disableStream: true,
    disableAutoFetch: true,
  });
  let pdfDocument;
  try {
    pdfDocument = await task.promise;
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 0.28 });
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width * pixelRatio);
    canvas.height = Math.ceil(viewport.height * pixelRatio);
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
    }).promise;
    const blob = await canvasBlob(canvas);
    return {
      src: URL.createObjectURL(blob),
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
    };
  } finally {
    try {
      if (pdfDocument) await pdfDocument.destroy?.();
      else await task.destroy?.();
    } catch {
      // The raster thumbnail is independent from the released PDF worker.
    }
  }
}

function FileIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

function ResultPdfThumbnail({ item }) {
  const [state, setState] = useState("loading");
  const [thumbnail, setThumbnail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setThumbnail(null);
    setState("loading");
    if (!item.preview_url) {
      setState("unavailable");
      return undefined;
    }
    const lease = resultThumbnails.acquire(
      item.preview_url,
      () => renderResultThumbnail(item.preview_url),
    );
    lease.promise.then((value) => {
      if (cancelled) return;
      setThumbnail(value);
      setState("ready");
    }).catch(() => {
      if (!cancelled) setState("unavailable");
    });
    return () => {
      cancelled = true;
      lease.release();
    };
  }, [item.preview_url]);

  return (
    <div className={`rag-result-thumbnail is-${state}`} aria-label={`${item.filename} 첫 페이지 미리보기`}>
      {thumbnail && (
        <img
          src={thumbnail.src}
          width={thumbnail.width}
          height={thumbnail.height}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      )}
      {state !== "ready" && (
        <div>
          <FileIcon />
          <span>{state === "loading" ? "미리보기 준비 중" : "미리보기를 사용할 수 없습니다"}</span>
        </div>
      )}
    </div>
  );
}

export default function RagResultIndex({ projectId, onOpen }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const projectScopeRef = useRef(projectId);
  projectScopeRef.current = projectId;

  const load = useCallback(async (nextCursor = null) => {
    const requestProjectId = projectId;
    if (!requestProjectId) {
      setItems([]);
      setCursor(null);
      setLoading(false);
      return;
    }
    if (nextCursor) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const result = await api.ragPipelineResultDocuments({
        projectId: requestProjectId,
        cursor: nextCursor,
        limit: 12,
      });
      if (projectScopeRef.current !== requestProjectId) return;
      setItems((current) => (
        nextCursor ? [...current, ...(result?.items || [])] : (result?.items || [])
      ));
      setCursor(result?.next_cursor || null);
    } catch (reason) {
      if (projectScopeRef.current === requestProjectId) {
        setError(reason.message || "완료된 문서 결과를 불러오지 못했습니다.");
      }
    } finally {
      if (projectScopeRef.current === requestProjectId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setLoadingMore(false);
    setError("");
    load();
  }, [load, projectId]);

  return (
    <section className="rag-result-index" aria-labelledby="rag-result-index-title">
      <div className="rag-result-index-head">
        <div>
          <span>COMPLETED DOCUMENT RESULTS</span>
          <h2 id="rag-result-index-title">완료된 문서 결과</h2>
          <p>현재 프로젝트에서 완료된 파일을 선택해 파싱·청킹 결과를 확인하세요.</p>
        </div>
        <b>{items.length.toLocaleString()}개 표시</b>
      </div>
      {loading && <div className="rag-result-index-state">완료된 문서 결과를 불러오는 중…</div>}
      {error && (
        <div className="rag-result-index-state error" role="alert">
          {error}<button type="button" onClick={() => load()}>다시 시도</button>
        </div>
      )}
      {!loading && !error && !items.length && (
        <div className="rag-result-index-state">
          아직 열 수 있는 완료 결과가 없습니다. 대시보드에서 문서 지식화를 시작하면 여기에 표시됩니다.
        </div>
      )}
      {!!items.length && (
        <div className="rag-result-card-list">
          {items.map((item) => (
            <button
              key={item.reference_id}
              type="button"
              className="rag-result-card"
              onClick={() => onOpen(item)}
            >
              <ResultPdfThumbnail item={item} />
              <div className="rag-result-card-copy">
                <div className="rag-result-card-top">
                  <span>{item.run_status === "degraded" ? "부분 완료" : "완료"}</span>
                  <em>{profileLabel(item)}</em>
                </div>
                <h3>{item.filename}</h3>
                <p>{item.project_name || item.project_id} · {item.execution_display_name}</p>
                <div className="rag-result-card-meta"><span>{resultTime(item.completed_at)}</span></div>
                <strong>결과 열기 <i>→</i></strong>
              </div>
            </button>
          ))}
        </div>
      )}
      {cursor && (
        <div className="rag-result-index-more">
          <button type="button" disabled={loadingMore} onClick={() => load(cursor)}>
            {loadingMore ? "불러오는 중…" : "완료된 결과 더 보기"}
          </button>
        </div>
      )}
    </section>
  );
}
