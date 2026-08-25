import { forwardRef, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FileRow, FolderRow } from './storageData';
import type { FileRunStatus } from './parseRunData';
import {
  EMBED_MODELS,
  buildIndexMock,
  deriveFileEmbedStatus,
  getEmbedModel,
  type EmbedFileState,
  type EmbedModelId,
  type EmbedRecord,
  type IndexInfo,
  type IndexKind,
} from './embedData';

interface Props {
  files: FileRow[];
  folders: FolderRow[];
  runs: FileRunStatus[];
  onRefresh: () => void;
  /** 데이터셋 단위 임베딩 실행 기록. */
  records?: EmbedRecord[];
}

const STATE_PILL: Record<EmbedFileState, string> = {
  embedded: 'bg-ok-bg text-ok border-ok-border',
  embedding: 'bg-info-bg text-info border-info-border',
  pending: 'bg-surface-soft text-ink-mid border-line',
  needsParse: 'bg-surface-soft text-ink-light border-line',
  failed: 'bg-bad-bg text-bad border-bad-border',
};
const STATE_LABEL: Record<EmbedFileState, string> = {
  embedded: '임베딩 완료',
  embedding: '임베딩 중',
  pending: '임베딩 대기',
  needsParse: '파싱 필요',
  failed: '실패',
};

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-kb-yellow-tint border-kb-yellow-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

const INDEX_KIND_LABEL: Record<IndexKind, string> = {
  hybrid: '하이브리드 (벡터 + BM25)',
  vector: '벡터 전용',
  bm25: 'BM25 전용',
};

/** 임베딩 탭 — 폴더·파일을 선택해 일괄 임베딩. */
const EmbedSection = forwardRef<HTMLElement, Props>(function EmbedSection(
  { files, folders, runs, onRefresh, records = [] },
  ref,
) {
  const [index, setIndex] = useState<IndexInfo>(() => buildIndexMock());
  const [selectedModelId, setSelectedModelId] = useState<EmbedModelId>(index.modelId);
  // 그룹별 펼침 (저장소·파싱 청킹과 같은 패턴)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ g1: true, g2: true });
  // 체크된 항목 — 파일 id 또는 폴더명
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [checkedFolders, setCheckedFolders] = useState<Set<string>>(new Set());
  // 임베딩 진행 시뮬레이션
  const [embeddingIds, setEmbeddingIds] = useState<Set<string>>(new Set());

  const statuses = useMemo(() => deriveFileEmbedStatus(files, runs), [files, runs]);
  const statusByFile = useMemo(() => {
    const m = new Map<string, ReturnType<typeof deriveFileEmbedStatus>[number]>();
    statuses.forEach((s) => m.set(s.fileId, s));
    return m;
  }, [statuses]);

  // 체크 가능한 파일 — 파싱 필요 상태는 제외 (먼저 파싱 청킹 필요)
  const checkableFileIds = useMemo(
    () => statuses.filter((s) => s.state !== 'needsParse').map((s) => s.fileId),
    [statuses],
  );

  const toggleFile = (id: string) =>
    setCheckedFiles((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleFolder = (name: string) =>
    setCheckedFolders((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const toggleGroup = (g: string) => setOpenGroups((s) => ({ ...s, [g]: !s[g] }));

  // 선택 통계
  const selectedFileChunks = useMemo(() => {
    let chunks = 0;
    checkedFiles.forEach((id) => {
      const s = statusByFile.get(id);
      if (s) chunks += s.chunks;
    });
    return chunks;
  }, [checkedFiles, statusByFile]);

  const selectionCount = checkedFiles.size + checkedFolders.size;

  // 통계 (전체)
  const totals = useMemo(() => {
    const embedded = statuses.filter((s) => s.state === 'embedded').length;
    const pending = statuses.filter((s) => s.state === 'pending').length;
    const needsParse = statuses.filter((s) => s.state === 'needsParse').length;
    const failed = statuses.filter((s) => s.state === 'failed').length;
    return { embedded, pending, needsParse, failed };
  }, [statuses]);

  const model = getEmbedModel(selectedModelId);

  // 임베딩 시작 — 실제 진행 시뮬레이션
  const handleEmbedStart = () => {
    const targets = new Set(checkedFiles);
    setEmbeddingIds(targets);
    setTimeout(() => {
      setEmbeddingIds(new Set());
      setCheckedFiles(new Set());
      setCheckedFolders(new Set());
      setIndex((idx) => ({
        ...idx,
        dev: {
          ...idx.dev,
          state: 'built',
          vectors: idx.dev.vectors + selectedFileChunks,
          sizeMB: +((idx.dev.vectors + selectedFileChunks) * 0.0027).toFixed(1),
          builtAt: new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      }));
    }, 1800);
  };

  const clearSelection = () => {
    setCheckedFiles(new Set());
    setCheckedFolders(new Set());
  };

  // 그룹/단독 파일 분류
  const visibleFiles = files.filter(
    (r) => r.isGroupHead || !r.parentGroup || openGroups[r.parentGroup],
  );

  return (
    <section ref={ref} className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          상품·시장 안내 매뉴얼
          <span className="text-[11px] text-ink-mid font-semibold ml-0.5">
            임베딩
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
        >
          <span className="text-[12px]">↻</span> 새로고침
        </button>
      </div>

      {/* 통계 3개 */}
      <div className="grid grid-cols-3 gap-2 p-[18px] pb-3">
        <Stat label="임베딩 완료" value={`${totals.embedded}`} tone="ok" />
        <Stat label="임베딩 대기" value={`${totals.pending}`} tone="neutral" />
        <Stat label="파싱 필요" value={`${totals.needsParse}`} tone="neutral" />
      </div>

      {/* 임베딩 기록 — 데이터셋 단위 실행 이력 */}
      {records.length > 0 && (
        <div className="px-[18px] pb-3.5">
          <div className="border border-line-soft rounded overflow-hidden bg-white">
            <div className="flex items-center gap-2 py-2 px-3 bg-surface-soft border-b border-line-soft">
              <span className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">임베딩 기록</span>
              <span className="text-[10.5px] text-ink-mid font-semibold">{records.length}건</span>
            </div>
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2.5 py-2.5 px-3 border-b border-line-soft last:border-b-0 text-[12px] hover:bg-[#FFFCF3]"
              >
                <span className="inline-flex items-center justify-center w-7 h-8 rounded border bg-kb-yellow-tint border-kb-yellow-dark text-[13px] flex-shrink-0">
                  📦
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink truncate">{r.datasetName}</div>
                  <div className="text-[10.5px] text-ink-mid font-semibold flex items-center gap-1.5 flex-wrap">
                    문서 <b className="text-ink-dark">{r.docCount}</b>
                    <span className="text-ink-light">·</span>
                    청크 <b className="text-ink-dark">{r.chunks.toLocaleString('ko-KR')}</b>
                    <span className="text-ink-light">·</span>
                    모델 <b className="text-ink-dark">{r.model}</b>
                    {r.kind && (
                      <>
                        <span className="text-ink-light">·</span>
                        {r.kind}
                      </>
                    )}
                    {r.indexName && (
                      <>
                        <span className="text-ink-light">·</span>
                        인덱스 <b className="text-ink-dark">{r.indexName}</b>
                      </>
                    )}
                    <span className="text-ink-light">·</span>
                    {r.createdAt}
                  </div>
                </div>
                {r.state === 'embedding' && (
                  <div className="h-[3px] w-[80px] bg-info-bg rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-info animate-parse-progress" />
                  </div>
                )}
                <span
                  className={cn(
                    'inline-flex items-center text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border',
                    r.state === 'done' ? STATE_PILL.embedded : STATE_PILL.embedding,
                  )}
                >
                  {r.state === 'done' ? '임베딩 완료' : '임베딩 중'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 모델 카드 — 단독 */}
      <div className="px-[18px] pb-3.5">
        <div className="border border-line-soft rounded p-3.5 bg-white">
          <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-2">
            임베딩 모델
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[13px] font-extrabold text-ink">{model.name}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span
                className={cn(
                  'inline-flex items-center py-[2px] px-2 rounded-full border font-bold',
                  model.source === 'on-prem'
                    ? 'bg-ok-bg text-ok border-ok-border'
                    : 'bg-bad-bg text-bad border-bad-border',
                )}
              >
                {model.source === 'on-prem' ? 'on-prem' : 'CSP'}
              </span>
              <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-line-soft bg-surface-soft text-ink-dark font-bold">
                {model.dimension.toLocaleString('ko-KR')}차원
              </span>
              <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-line-soft bg-surface-soft text-ink-dark font-bold">
                {model.version}
              </span>
              {model.costPerKWon > 0 && (
                <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn font-bold">
                  ₩{model.costPerKWon}/1k tok
                </span>
              )}
            </div>
            <span className="flex-1" />
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value as EmbedModelId)}
              className="h-8 px-2.5 border border-line rounded text-[12px] font-semibold text-ink-dark bg-white min-w-[260px]"
            >
              {EMBED_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.short} ({m.source === 'on-prem' ? 'on-prem' : 'CSP'} · {m.dimension}d)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 선택 액션 바 (체크된 항목 있을 때만) */}
      {selectionCount > 0 && (
        <div className="mx-[18px] mb-2.5 py-2 px-3 bg-kb-yellow-tint border border-kb-yellow-dark rounded flex items-center gap-2.5">
          <span className="text-[12px] font-extrabold text-ink">
            선택 {selectionCount}개
          </span>
          {selectedFileChunks > 0 && (
            <>
              <span className="text-ink-light">·</span>
              <span className="text-[11.5px] text-ink-dark font-semibold">
                총 청크 <b>{selectedFileChunks.toLocaleString('ko-KR')}</b>
              </span>
            </>
          )}
          <span className="flex-1" />
          <button
            onClick={clearSelection}
            className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface"
          >
            선택 해제
          </button>
          <button
            onClick={() => handleEmbedStart()}
            disabled={selectionCount === 0 || embeddingIds.size > 0}
            className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ 선택 임베딩
          </button>
        </div>
      )}

      {/* 폴더 + 파일 트리 */}
      <div className="px-[18px] pb-[18px]">
        <div className="border border-line-soft rounded overflow-hidden bg-white">
          {/* 폴더 행 */}
          {folders.map((folder) => {
            const checked = checkedFolders.has(folder.name);
            return (
              <div
                key={folder.name}
                className="flex items-center gap-2.5 py-2.5 px-3 border-b border-line-soft text-[12px] hover:bg-[#FFFCF3]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleFolder(folder.name)}
                  className="w-3.5 h-3.5 cursor-pointer accent-kb-yellow-dark"
                />
                <span className="w-4 flex-shrink-0" />
                <span className="inline-flex items-center justify-center w-7 h-8 rounded border bg-kb-yellow-tint border-kb-yellow-dark text-ink-dark text-[14px] flex-shrink-0">
                  📁
                </span>
                <span className="font-bold text-ink flex-1 min-w-0">
                  {folder.name}
                  {folder.childCount && (
                    <span className="text-ink-mid font-semibold text-[10.5px] ml-1.5">{folder.childCount}개</span>
                  )}
                </span>
                <span className="text-[10.5px] text-ink-mid font-semibold">{folder.updatedBy}</span>
              </div>
            );
          })}

          {/* 파일 행 (그룹 트리) */}
          {visibleFiles.map((f) => {
            const status = statusByFile.get(f.id);
            if (!status) return null;
            const isChild = !!f.parentGroup && !f.isGroupHead;
            const isEmbedding = embeddingIds.has(f.id);
            const effState: EmbedFileState = isEmbedding ? 'embedding' : status.state;
            const isCheckable = checkableFileIds.includes(f.id);
            const isChecked = checkedFiles.has(f.id);
            const groupOpen = f.isGroupHead && f.parentGroup ? !!openGroups[f.parentGroup] : false;
            return (
              <div
                key={f.id}
                className={cn(
                  'flex items-center gap-2.5 py-2.5 px-3 border-b border-line-soft last:border-b-0 text-[12px]',
                  isChild && 'bg-surface-soft pl-9',
                  !isChild && 'hover:bg-[#FFFCF3]',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!isCheckable}
                  onChange={() => toggleFile(f.id)}
                  className={cn(
                    'w-3.5 h-3.5 accent-kb-yellow-dark',
                    isCheckable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                  )}
                />
                {/* 그룹 disclosure */}
                {f.isGroupHead && f.parentGroup && f.priorCount && f.priorCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => f.parentGroup && toggleGroup(f.parentGroup)}
                    className={cn(
                      'inline-flex items-center justify-center w-4 h-4 text-ink-mid text-[10px] transition-transform flex-shrink-0',
                      groupOpen && 'rotate-90',
                    )}
                    title={groupOpen ? '이전 버전 접기' : '이전 버전 펼치기'}
                  >
                    ▶
                  </button>
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-8 rounded border text-[9.5px] font-extrabold flex-shrink-0',
                    EXT_BADGE[f.ext],
                  )}
                >
                  {f.ext}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-ink truncate flex items-center gap-1.5">
                    <span className="truncate">{f.name}</span>
                    {f.isNew && (
                      <span className="inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded-full bg-ok-bg text-ok border border-ok-border flex-shrink-0">
                        NEW
                      </span>
                    )}
                    {f.isGroupHead && f.priorCount && f.priorCount > 0 && (
                      <span
                        className={cn(
                          'inline-flex items-center text-[10px] font-bold py-[1px] px-1.5 rounded-full border',
                          groupOpen
                            ? 'bg-info-bg text-info border-info-border'
                            : 'bg-surface-soft text-ink-mid border-line',
                        )}
                      >
                        ＋ 이전 {f.priorCount}
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold flex items-center gap-1.5 flex-wrap">
                    {status.chunks > 0 ? (
                      <span>
                        청크 <b className="text-ink-dark">{status.chunks.toLocaleString('ko-KR')}</b>
                        {status.vectors > 0 && (
                          <>
                            <span className="text-ink-light mx-1">·</span>
                            벡터 <b className="text-ink-dark">{status.vectors.toLocaleString('ko-KR')}</b>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-light">청크 없음</span>
                    )}
                    {status.modelId && (
                      <>
                        <span className="text-ink-light">·</span>
                        <span>
                          모델 <b className="text-ink-dark">{getEmbedModel(status.modelId).short}</b>
                        </span>
                      </>
                    )}
                    {status.embeddedAt && (
                      <>
                        <span className="text-ink-light">·</span>
                        <span>{status.embeddedAt}</span>
                      </>
                    )}
                    {status.note && (
                      <>
                        <span className="text-ink-light">·</span>
                        <span className="text-warn">{status.note}</span>
                      </>
                    )}
                  </div>
                </div>
                {isEmbedding && (
                  <div className="h-[3px] w-[80px] bg-info-bg rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-info animate-parse-progress" />
                  </div>
                )}
                <span
                  className={cn(
                    'inline-flex items-center text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border',
                    STATE_PILL[effState],
                  )}
                >
                  {STATE_LABEL[effState]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
});

export default EmbedSection;

/* ---------------- Stat ---------------- */

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'info' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClass = {
    ok: 'text-ok',
    info: 'text-info',
    warn: 'text-warn',
    bad: 'text-bad',
    neutral: 'text-ink',
  };
  return (
    <div className="bg-surface-soft border border-line-soft rounded p-2.5">
      <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-1">{label}</div>
      <div className={cn('text-base font-extrabold tabular-nums leading-tight', toneClass[tone])}>{value}</div>
    </div>
  );
}
