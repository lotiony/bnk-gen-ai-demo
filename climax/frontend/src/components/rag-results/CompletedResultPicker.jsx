import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { includeCurrentResult, profileLabel } from "./resultUtils";

export default function CompletedResultPicker({ currentReferenceId, currentResult, onSelectResult }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const loadingRef = useRef(false);
  const requestVersionRef = useRef(0);
  const requestedCursorsRef = useRef(new Set());

  const loadPage = useCallback(async (cursor = null) => {
    if (loadingRef.current) return;
    if (cursor && requestedCursorsRef.current.has(cursor)) {
      setNextCursor(null);
      return;
    }
    const requestVersion = requestVersionRef.current;
    if (cursor) requestedCursorsRef.current.add(cursor);
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await api.ragPipelineResultDocuments({ cursor, limit: 50 });
      if (requestVersionRef.current !== requestVersion) return;
      const incoming = result?.items || [];
      setItems((current) => {
        if (!cursor) return incoming;
        const seen = new Set(current.map((item) => item.reference_id));
        return [...current, ...incoming.filter((item) => !seen.has(item.reference_id))];
      });
      const following = result?.next_cursor || null;
      setNextCursor(following && following !== cursor ? following : null);
    } catch (reason) {
      if (requestVersionRef.current === requestVersion) {
        if (cursor) requestedCursorsRef.current.delete(cursor);
        setError(reason.message || "완료된 파일 결과를 불러오지 못했습니다.");
      }
    } finally {
      if (requestVersionRef.current === requestVersion) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    requestVersionRef.current += 1;
    loadingRef.current = false;
    requestedCursorsRef.current.clear();
    setItems([]);
    setNextCursor(null);
    loadPage();
    return () => {
      requestVersionRef.current += 1;
      loadingRef.current = false;
    };
  }, [loadPage]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const displayItems = includeCurrentResult(items, currentResult, currentReferenceId);
  const current = displayItems.find((item) => item.reference_id === currentReferenceId);
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle ? displayItems.filter((item) => [
    item.filename,
    item.project_name,
    item.execution_display_name,
    profileLabel(item),
  ].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle)) : displayItems;
  const loadNextPage = () => nextCursor && loadPage(nextCursor);
  const handleListScroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 48) {
      loadNextPage();
    }
  };

  return (
    <div ref={rootRef} className="rag-result-picker">
      <button
        type="button"
        className="rag-result-picker-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>{current?.filename || "완료된 파일 결과 선택"}</span>
        <small>{current ? profileLabel(current) : "모든 실행"}</small>
        <b>⌄</b>
      </button>
      {open && (
        <div className="rag-result-picker-menu">
          <div className="rag-result-picker-search">
            <b>완료된 파일 결과</b>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="파일명·프로젝트 검색"
              autoFocus
            />
          </div>
          <div className="rag-result-picker-list" onScroll={handleListScroll} aria-busy={loading}>
            {visible.map((item) => (
              <button
                key={item.reference_id}
                type="button"
                className={item.reference_id === currentReferenceId ? "active" : ""}
                onClick={() => { onSelectResult?.(item); setOpen(false); }}
              >
                <span>{item.filename}</span>
                <small>
                  {[item.project_name || item.project_id, item.execution_display_name, profileLabel(item)].filter(Boolean).join(" · ")}
                </small>
              </button>
            ))}
            {!loading && !visible.length && <p>선택할 완료 결과가 없습니다.</p>}
            {loading && <p>완료 결과를 불러오는 중…</p>}
            {error && (
              <p className="error">
                {error}
                <button type="button" onClick={() => loadPage(nextCursor)}>다시 시도</button>
              </p>
            )}
            {!loading && !error && nextCursor && (
              <button type="button" className="rag-result-picker-more" onClick={loadNextPage}>
                더 불러오기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
