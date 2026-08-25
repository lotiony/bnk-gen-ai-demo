import { useState } from "react";
import { api, JOB_EVENT } from "../../api";
import { createRagDocumentExecution } from "../../lib/ragDocumentExecution";

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_DOCUMENTS = 1000;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "xlsx"]);
const ACCEPT = ".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PIPELINES = [
  { id: "rag-ai-search", label: "Adaptive → AI Search" },
  { id: "rag-graphrag", label: "Adaptive → GraphRAG" },
  { id: "terms-ai-search", label: "Terms → AI Search" },
  { id: "terms-graphrag", label: "Terms → GraphRAG" },
];

const fileExtension = (file) => String(file?.name || "").split(".").pop()?.toLowerCase() || "";
const fileKey = (file) => [file?.name, file?.size, file?.lastModified].join(":");
const formatBytes = (value) => {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
};

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

export default function RagDocumentUploadPanel({ projectId, projectName, onClose, onStarted }) {
  const [rows, setRows] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const addFiles = (picked) => {
    const existing = new Set(rows.map((row) => fileKey(row.file)));
    const accepted = [];
    let unsupported = 0;
    let oversized = 0;
    let empty = 0;
    let duplicate = 0;
    let overLimit = 0;

    Array.from(picked || []).forEach((file) => {
      if (!ACCEPTED_EXTENSIONS.has(fileExtension(file))) { unsupported += 1; return; }
      if (!file.size) { empty += 1; return; }
      if (file.size > MAX_FILE_BYTES) { oversized += 1; return; }
      if (existing.has(fileKey(file))) { duplicate += 1; return; }
      if (rows.length + accepted.length >= MAX_DOCUMENTS) { overLimit += 1; return; }
      existing.add(fileKey(file));
      accepted.push({ file, pipelineId: "rag-ai-search" });
    });

    setRows((current) => [...current, ...accepted]);
    const rejected = [
      unsupported && `지원하지 않는 형식 ${unsupported}개`,
      oversized && `32 MB 초과 ${oversized}개`,
      empty && `빈 파일 ${empty}개`,
      duplicate && `중복 파일 ${duplicate}개`,
      overLimit && `최대 ${MAX_DOCUMENTS.toLocaleString()}개 초과 ${overLimit}개`,
    ].filter(Boolean);
    setError(rejected.length ? `${rejected.join(" · ")}를 제외했습니다.` : "");
  };

  const updatePipeline = (index, pipelineId) => {
    setRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, pipelineId } : row
    )));
  };

  const removeFile = (index) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setError("");
  };

  const start = async () => {
    if (!projectId || !rows.length || busy) return;
    setBusy(true);
    setError("");
    const firstName = rows[0].file.name.replace(/\.[^.]+$/, "");
    const displayName = rows.length > 1
      ? `${firstName} 외 ${rows.length - 1}개 지식화`
      : `${firstName} 지식화`;
    try {
      const execution = await createRagDocumentExecution({
        apiClient: api,
        projectId,
        projectName,
        displayName,
        documents: rows.map((row) => ({
          name: row.file.name,
          file: row.file,
          pipelineId: row.pipelineId,
        })),
        createPartialExecutionOnUploadFailure: true,
      });
      window.dispatchEvent(new Event(JOB_EVENT));
      onStarted?.(execution);
    } catch (reason) {
      setError(reason.message || "RAG Pipeline Execution을 시작하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <section className="rag-ingest-composer" aria-labelledby="rag-ingest-title">
      <div className="rag-ingest-head">
        <div>
          <span>NEW DOCUMENT · {projectName || projectId}</span>
          <h2 id="rag-ingest-title">새 문서 처리</h2>
          <p>문서를 담고 파일마다 활용 경로 하나를 선택하세요.</p>
        </div>
        <button type="button" className="rag-ingest-close" onClick={onClose} disabled={busy} aria-label="새 문서 처리 닫기">×</button>
      </div>

      <div className="rag-ingest-body">
        <label
          className={`rag-ingest-drop${dragging ? " is-drag" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <input
            type="file"
            multiple
            accept={ACCEPT}
            disabled={busy}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <i><FileIcon /></i>
          <b>문서를 끌어다 놓거나 클릭</b>
          <small>PDF · DOCX · XLSX · 파일당 최대 32 MB</small>
        </label>

        <div className="rag-ingest-queue">
          <div className="rag-ingest-queue-head"><b>담은 문서</b><span>{rows.length.toLocaleString()}개</span></div>
          {!rows.length && <div className="rag-ingest-empty">처리할 문서를 담아주세요.</div>}
          {!!rows.length && (
            <div className="rag-ingest-rows">
              {rows.map((row, index) => (
                <div className="rag-ingest-row" key={fileKey(row.file)}>
                  <span className="rag-ingest-type">{fileExtension(row.file).toUpperCase()}</span>
                  <span className="rag-ingest-file"><b>{row.file.name}</b><small>{formatBytes(row.file.size)} · 준비됨</small></span>
                  <select value={row.pipelineId} onChange={(event) => updatePipeline(index, event.target.value)} disabled={busy} aria-label={`${row.file.name} 활용 경로`}>
                    {PIPELINES.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeFile(index)} disabled={busy} aria-label={`${row.file.name} 제외`}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="rag-ingest-error" role="alert">{error}</div>}
      <div className="rag-ingest-foot">
        <p><b>{rows.length.toLocaleString()}개 문서</b>를 하나의 Pipeline Execution으로 시작<br />업로드 후 처리 대상은 바꿀 수 없습니다.</p>
        <button type="button" className="rag-ingest-start" disabled={!projectId || !rows.length || busy} onClick={start}>
          <span aria-hidden="true">▷</span>{busy ? "업로드 및 실행 생성 중…" : `${rows.length.toLocaleString()}개 문서 처리 시작`}
        </button>
      </div>
    </section>
  );
}
