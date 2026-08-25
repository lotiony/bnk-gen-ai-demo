import { useEffect, useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import { getParser, parsersFor, type ParserId } from './parsers';
import type { FileRow } from './storageData';
import type { ChunkingStrategy, ExtractedBlock, FileRunStatus, ImageHandling } from './parseRunData';

export interface ReparseOpts {
  parserId: ParserId;
  chunking: ChunkingStrategy;
}

interface Props {
  file: FileRunStatus | null;
  onClose: () => void;
  /** 옵션을 바꿔 재파싱 — 부모가 해당 문서의 파싱을 다시 시작한다. */
  onReparse?: (file: FileRunStatus, opts: ReparseOpts) => void;
}

/** 재파싱 청커 선택지 (표 단독 제외 — 파싱 청킹 화면과 동일). */
const REPARSE_CHUNKERS: ChunkingStrategy[] = ['length', 'semantic', 'custom'];

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

const CHUNKING_LABEL: Record<ChunkingStrategy, string> = {
  length: '길이 기반',
  semantic: '의미 경계',
  tableIsolated: '표 단독',
  custom: '커스텀 청커',
};
const IMAGE_LABEL: Record<ImageHandling, string> = {
  skip: '이미지 무시',
  caption: 'Vision 캡션',
  keep: '원본 유지',
};

const KIND_OPTS = ['H1', 'H2', 'H3', 'P', '표', '리스트', '이미지', 'Q', 'A', '수식', '시트', '셀'];

/** 파싱 결과 검토·편집 모달 — 좌측 원본 페이지, 우측 추출 블록 (편집 가능). */
export default function ParseResultModal({ file, onClose, onReparse }: Props) {
  // 편집 중인 블록들
  const [editedBlocks, setEditedBlocks] = useState<ExtractedBlock[]>([]);
  // 현재 보고 있는 페이지
  const [currentPage, setCurrentPage] = useState<number>(1);
  // 편집 중인 블록 id (편집 모드 토글)
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  // 재파싱 옵션 (파서·청커) — 결과에 쓰인 값으로 초기화.
  const [rpParser, setRpParser] = useState<ParserId>('basic');
  const [rpChunk, setRpChunk] = useState<ChunkingStrategy>('semantic');

  // 파일이 바뀌면 블록 초기화
  useEffect(() => {
    if (!file) return;
    setEditedBlocks(file.blocks.map((b) => ({ ...b })));
    setCurrentPage(file.blocks[0]?.page ?? 1);
    setEditingIdx(null);
    setDirty(false);
    setRpParser(file.parserId);
    setRpChunk(file.settings.chunking);
  }, [file]);

  // 페이지 목록 (블록이 있는 페이지들)
  const pages = useMemo(() => {
    const set = new Set(editedBlocks.map((b) => b.page));
    return [...set].sort((a, b) => a - b);
  }, [editedBlocks]);

  // 현재 페이지의 블록들 (편집 가능)
  const currentPageBlocks = useMemo(() => {
    const list: { block: ExtractedBlock; idx: number }[] = [];
    editedBlocks.forEach((b, idx) => {
      if (b.page === currentPage) list.push({ block: b, idx });
    });
    return list;
  }, [editedBlocks, currentPage]);

  if (!file) return null;

  const isFail = file.state === 'fail';
  const isDone = file.state === 'done';

  // 재파싱 — 이 문서 형식에 맞는 파서 후보 + 옵션 변경 여부.
  const docFileRow: FileRow = {
    id: file.id.split('__')[0],
    name: file.name,
    ext: file.ext,
    sizeMB: file.sizeMB,
    pages: file.pages,
    updatedBy: '',
    updatedAt: '',
  };
  const parserChoices = parsersFor(docFileRow);
  const reparseChanged = rpParser !== file.parserId || rpChunk !== file.settings.chunking;
  const doReparse = () => {
    onReparse?.(file, { parserId: rpParser, chunking: rpChunk });
    onClose();
  };

  const updateBlock = (idx: number, patch: Partial<ExtractedBlock>) => {
    setEditedBlocks((arr) => arr.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
    setDirty(true);
  };
  const removeBlock = (idx: number) => {
    setEditedBlocks((arr) => arr.filter((_, i) => i !== idx));
    setEditingIdx(null);
    setDirty(true);
  };

  const pageIdx = pages.indexOf(currentPage);
  const canPrev = pageIdx > 0;
  const canNext = pageIdx < pages.length - 1;
  const goPrev = () => canPrev && setCurrentPage(pages[pageIdx - 1]);
  const goNext = () => canNext && setCurrentPage(pages[pageIdx + 1]);

  return (
    <ModalShell
      open={file != null}
      onClose={onClose}
      title="파싱 결과 · 원본 비교"
      subtitle={
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="text-ink-dark font-bold">{file.name}</span>
          <span
            className={cn(
              'inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded-full border',
              isDone
                ? 'bg-ok-bg text-ok border-ok-border'
                : isFail
                ? 'bg-bad-bg text-bad border-bad-border'
                : 'bg-info-bg text-info border-info-border',
            )}
          >
            {isDone ? '완료' : isFail ? '실패' : file.state}
          </span>
          {dirty && (
            <span className="inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded-full border bg-warn-bg text-warn border-warn-border">
              ● 수정됨
            </span>
          )}
        </span>
      }
      size="lg"
      bodyClassName="p-0"
      footer={
        <>
          <span className="text-[11.5px] text-ink-mid">
            파서 <b className="text-ink-dark">{getParser(file.parserId).name}</b>
            <span className="text-ink-light mx-1.5">·</span>
            {file.ext} · {file.pages}p · {file.sizeMB.toFixed(1)} MB
            <span className="text-ink-light mx-1.5">·</span>
            블록 <b className="text-ink-dark">{editedBlocks.length}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
            >
              {dirty ? '취소' : '닫기'}
            </button>
            <button
              disabled={!dirty}
              onClick={() => {
                window.alert(`${editedBlocks.length}개 블록을 저장합니다 (목업).`);
                setDirty(false);
              }}
              className="py-2 px-3.5 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              저장
            </button>
          </div>
        </>
      }
    >
      {/* 사용된 옵션 + 통계 — 상단 단일 행 */}
      <div className="px-4 pt-3.5 pb-2 border-b border-line-soft">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] mb-2">
          <OptChip label="파서" value={getParser(file.parserId).short} tone="brand" />
          <OptChip label="청킹" value={CHUNKING_LABEL[file.settings.chunking]} />
          <OptChip label="이미지" value={IMAGE_LABEL[file.settings.image]} />
          {file.settings.tableToMd && <OptChip value="표→마크다운" />}
          {file.settings.pii && <OptChip value="PII 마스킹" tone="warn" />}
          {file.settings.metaTag && <OptChip value="메타 태깅" />}
          {file.finishedAt && (
            <span className="text-ink-mid font-semibold ml-auto">{file.finishedAt}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>
            추출 블록 <b className="text-ink-dark">{editedBlocks.length}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            청크 <b className="text-ink-dark">{file.chunks.toLocaleString('ko-KR')}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            경고 <b className={file.warnings.length > 0 ? 'text-warn' : 'text-ink-dark'}>{file.warnings.length}</b>
          </span>
          <span className="flex-1" />
          {/* 페이지 네비 */}
          {pages.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                className="h-7 px-2 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <span className="text-[11.5px] font-semibold tabular-nums">
                p<b className="text-ink-dark">{currentPage}</b> / p{Math.max(...pages, file.pages)}
              </span>
              <button
                onClick={goNext}
                disabled={!canNext}
                className="h-7 px-2 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="h-7 px-2 border border-line rounded text-[11px] font-bold text-ink-dark bg-white"
              >
                {pages.map((p) => (
                  <option key={p} value={p}>
                    p{p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 재파싱 — 옵션(파서·청커)을 바꿔 다시 파싱 */}
      {onReparse && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b border-line-soft bg-surface-soft">
          <span className="text-[11px] font-extrabold text-ink-mid">옵션 변경 후 재파싱</span>
          <label className="inline-flex items-center gap-1 text-[10.5px] text-ink-mid font-semibold">
            파서
            <select
              value={rpParser}
              onChange={(e) => setRpParser(e.target.value as ParserId)}
              className="h-7 px-1.5 border border-line rounded text-[11px] font-bold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
            >
              {parserChoices.map((p) => (
                <option key={p.id} value={p.id}>{p.short}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1 text-[10.5px] text-ink-mid font-semibold">
            청커
            <select
              value={rpChunk}
              onChange={(e) => setRpChunk(e.target.value as ChunkingStrategy)}
              className="h-7 px-1.5 border border-line rounded text-[11px] font-bold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
            >
              {REPARSE_CHUNKERS.map((c) => (
                <option key={c} value={c}>{CHUNKING_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <span className="flex-1" />
          {reparseChanged && (
            <span className="text-[10.5px] text-warn font-bold">옵션 변경됨</span>
          )}
          <button
            onClick={doReparse}
            title="변경한 옵션으로 이 문서를 다시 파싱합니다"
            className="h-7 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark inline-flex items-center gap-1"
          >
            ↻ 재파싱
          </button>
        </div>
      )}

      {/* 본문 2-col: 좌측 원본 페이지 / 우측 추출 블록 편집 */}
      <div className="grid grid-cols-2 divide-x divide-line-soft" style={{ height: '500px' }}>
        {/* 좌측 — 원본 페이지 (placeholder) */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between py-1.5 px-3 bg-surface-soft border-b border-line-soft">
            <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">
              원본 · 페이지 {currentPage}
            </div>
            <span
              className={cn(
                'inline-flex items-center justify-center text-[9px] font-extrabold py-[1px] px-1.5 rounded border',
                EXT_BADGE[file.ext],
              )}
            >
              {file.ext}
            </span>
          </div>
          <div className="flex-1 overflow-auto bg-[#2A2A2A] p-4 flex justify-center items-start">
            {/* PDF 페이지 placeholder */}
            <div
              className="bg-white shadow-lg w-full max-w-[420px] p-8 text-[11.5px] leading-[1.7] text-ink-dark"
              style={{ minHeight: '560px' }}
            >
              <div className="text-[9.5px] text-ink-mid text-center mb-3 font-semibold">
                — page {currentPage} —
              </div>
              {currentPageBlocks.length === 0 ? (
                <div className="text-center text-ink-light py-12 text-[11px]">
                  이 페이지에 추출된 블록이 없습니다
                </div>
              ) : (
                currentPageBlocks.map(({ block }, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    {block.kind === 'H1' && (
                      <div className="text-[15px] font-extrabold text-black mb-1.5">{block.text}</div>
                    )}
                    {block.kind === 'H2' && (
                      <div className="text-[13px] font-extrabold text-black mb-1">{block.text}</div>
                    )}
                    {block.kind === 'H3' && (
                      <div className="text-[12px] font-bold text-black mb-0.5">{block.text}</div>
                    )}
                    {block.kind === 'P' && <p className="m-0">{block.text}</p>}
                    {block.kind === '리스트' && (
                      <pre className="m-0 font-sans whitespace-pre-wrap text-[11px]">{block.text}</pre>
                    )}
                    {block.kind === '표' && (
                      <div className="border border-line bg-surface-soft p-2 text-[10.5px] text-ink-mid italic">
                        [표] {block.text}
                      </div>
                    )}
                    {block.kind === '이미지' && (
                      <div className="border-dashed border border-line bg-surface-soft p-3 text-center text-[10.5px] text-ink-mid">
                        🖼 {block.text}
                      </div>
                    )}
                    {!['H1', 'H2', 'H3', 'P', '리스트', '표', '이미지'].includes(block.kind) && (
                      <div className="text-[11px] text-ink-dark">{block.text}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 우측 — 추출 블록 편집 */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between py-1.5 px-3 bg-surface-soft border-b border-line-soft">
            <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">
              추출 블록 · 페이지 {currentPage}
            </div>
            <span className="text-[10.5px] text-ink-mid font-semibold">
              {currentPageBlocks.length}건
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            {currentPageBlocks.length === 0 ? (
              <div className="py-16 text-center text-[12px] text-ink-light font-semibold">
                이 페이지에 추출된 블록이 없습니다
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {currentPageBlocks.map(({ block, idx }) => {
                  const isEditing = editingIdx === idx;
                  return (
                    <li
                      key={idx}
                      className={cn(
                        'py-2 px-3 hover:bg-[#FDF6F4] transition-colors',
                        isEditing && 'bg-brand-tint',
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[9.5px] font-extrabold tracking-[0.3px] text-ink-mid">
                          p{block.page}
                        </span>
                        {isEditing ? (
                          <select
                            value={block.kind}
                            onChange={(e) => updateBlock(idx, { kind: e.target.value })}
                            className="h-5 px-1.5 border border-brand-dark rounded text-[10px] font-extrabold text-ink-dark bg-white"
                          >
                            {KIND_OPTS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded border border-line bg-white text-ink-dark">
                            {block.kind}
                          </span>
                        )}
                        <span className="text-[9.5px] text-ink-light font-bold tabular-nums">
                          {block.text.length}자
                        </span>
                        <span className="flex-1" />
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => setEditingIdx(null)}
                              className="h-6 px-2 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-white hover:bg-brand-dark"
                            >
                              완료
                            </button>
                            <button
                              onClick={() => removeBlock(idx)}
                              className="h-6 px-2 bg-white border border-bad-border text-bad rounded text-[10.5px] font-bold hover:bg-bad-bg"
                              title="블록 삭제"
                            >
                              ✕ 삭제
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingIdx(idx)}
                            className="h-6 px-2 bg-white border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface"
                          >
                            ✎ 편집
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <textarea
                          value={block.text}
                          onChange={(e) => updateBlock(idx, { text: e.target.value })}
                          rows={Math.max(2, Math.min(8, Math.ceil(block.text.length / 60)))}
                          className="w-full text-[12px] text-ink-dark leading-[1.6] border border-brand-dark rounded p-2 bg-white resize-y focus:outline-none"
                        />
                      ) : (
                        <div className="text-[12px] text-ink-dark leading-[1.6] whitespace-pre-wrap">
                          {block.text}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 경고 — 본문 하단 */}
      {file.warnings.length > 0 && (
        <div className="border-t border-line-soft">
          <div className="py-2 px-3 text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold bg-surface-soft border-b border-line-soft">
            경고 ({file.warnings.length})
          </div>
          <ul className="divide-y divide-line-soft max-h-[140px] overflow-auto">
            {file.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 py-2 px-3">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-extrabold flex-shrink-0 mt-0.5',
                    w.severity === 'fail' ? 'bg-bad text-white' : 'bg-warn text-white',
                  )}
                >
                  {w.severity === 'fail' ? '!' : '⚠'}
                </span>
                <div className="flex-1 min-w-0">
                  {w.page != null && (
                    <button
                      onClick={() => w.page && setCurrentPage(w.page)}
                      className="text-[10.5px] text-info font-bold mr-1.5 hover:underline"
                    >
                      p{w.page}
                    </button>
                  )}
                  <span className="text-[11.5px] text-ink-dark leading-relaxed">{w.message}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ModalShell>
  );
}

function OptChip({
  label,
  value,
  tone = 'neutral',
}: {
  label?: string;
  value: string;
  tone?: 'neutral' | 'brand' | 'warn';
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: 'bg-white border-line-soft text-ink-dark',
    brand: 'bg-brand-tint border-brand-dark text-ink',
    warn: 'bg-warn-bg border-warn-border text-warn',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 py-[2px] px-2 rounded-full border text-[10.5px] font-bold',
        toneClass[tone],
      )}
    >
      {label && <span className="text-ink-mid font-semibold">{label}</span>}
      <b className="font-extrabold">{value}</b>
    </span>
  );
}
