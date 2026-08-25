import { useEffect, useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import type { FileRow, FolderRow } from './storageData';
import {
  EMBED_MODELS,
  buildIndexListMock,
  type EmbedModelId,
  type IndexKind,
  type IndexWithVersions,
  getEmbedModel,
} from './embedData';

const NEW_INDEX = '__new__';

export interface EmbedStartPayload {
  modelId: EmbedModelId;
  kind: IndexKind;
  indexName: string;
  files: FileRow[];
  folders: FolderRow[];
  /** 추가 옵션 토글 */
  options: {
    /** 새 인덱스 버전을 만들 것인지 (false = 기존 인덱스에 추가) */
    newVersion: boolean;
    /** 빈 청크 제외 */
    excludeEmpty: boolean;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  targets: FileRow[];
  folders?: FolderRow[];
  /** 선택 가능한 기존 인덱스 목록. 없으면 mock 사용. */
  indexes?: IndexWithVersions[];
  onStart?: (payload: EmbedStartPayload) => void;
}

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

const KIND_OPTS: { id: IndexKind; name: string; desc: string }[] = [
  { id: 'hybrid', name: '하이브리드', desc: '벡터 + BM25 · 권장 기본값' },
  { id: 'vector', name: '벡터 전용', desc: '의미 기반 검색' },
  { id: 'bm25', name: 'BM25', desc: '키워드 기반 검색' },
];

/** 확장자별로 묶기. */
function groupByExt(targets: FileRow[]): { ext: FileRow['ext']; files: FileRow[] }[] {
  const m = new Map<FileRow['ext'], FileRow[]>();
  for (const t of targets) {
    const arr = m.get(t.ext) ?? [];
    arr.push(t);
    m.set(t.ext, arr);
  }
  return [...m.entries()].map(([ext, files]) => ({ ext, files }));
}

/** 다중 파일 임베딩 모달 — 확장자별 그룹 + 모델·유형·옵션 선택 후 시작. */
export default function EmbedModal({ open, onClose, targets, folders = [], indexes, onStart }: Props) {
  const groups = useMemo(() => groupByExt(targets), [targets]);

  // 내가 만든 인덱스 목록 (부모가 전달하면 그것을, 없으면 mock).
  const fallback = useMemo(() => buildIndexListMock(), []);
  const myIndexes = indexes ?? fallback;
  const [modelId, setModelId] = useState<EmbedModelId>('bge-m3-ko');
  const [kind, setKind] = useState<IndexKind>('hybrid');
  // 선택된 인덱스 id (기존) 또는 새 인덱스 생성.
  const [selectedIndexId, setSelectedIndexId] = useState<string>(myIndexes[0]?.indexId ?? NEW_INDEX);
  const [newIndexName, setNewIndexName] = useState('');
  const [opts, setOpts] = useState({ newVersion: false, excludeEmpty: true });

  // 모달 열릴 때 기본값으로 리셋
  useEffect(() => {
    if (!open) return;
    setModelId('bge-m3-ko');
    setKind('hybrid');
    setSelectedIndexId(myIndexes[0]?.indexId ?? NEW_INDEX);
    setNewIndexName('');
    setOpts({ newVersion: false, excludeEmpty: true });
  }, [open, myIndexes]);

  const isNewIndex = selectedIndexId === NEW_INDEX;
  const resolvedIndexName = isNewIndex
    ? newIndexName.trim()
    : myIndexes.find((i) => i.indexId === selectedIndexId)?.indexName ?? '';

  const model = getEmbedModel(modelId);
  const totalMB = targets.reduce((s, t) => s + t.sizeMB, 0);
  const totalPages = targets.reduce((s, t) => s + (t.pages ?? 0), 0);

  const totalCount = targets.length + folders.length;
  const subtitle = (
    <>
      {targets.length > 0 && (
        <>
          <b className="text-ink font-extrabold">{targets.length}</b>개 파일
        </>
      )}
      {folders.length > 0 && (
        <>
          {targets.length > 0 && <span className="text-ink-light mx-1">·</span>}
          <b className="text-ink font-extrabold">{folders.length}</b>개 폴더
        </>
      )}
      <span className="text-ink-light mx-1">·</span>
      벡터로 변환해 인덱스에 추가합니다
    </>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="파일 임베딩"
      subtitle={subtitle}
      size="lg"
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onClose}
            className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
          >
            취소
          </button>
          <button
            disabled={totalCount === 0 || !resolvedIndexName}
            onClick={() => {
              onStart?.({
                modelId,
                kind,
                indexName: resolvedIndexName,
                files: targets,
                folders,
                options: opts,
              });
              onClose();
            }}
            className="py-2 px-3.5 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ 임베딩 시작
          </button>
        </div>
      }
    >
      {/* 대상 요약 (파일 그룹 목록은 생략) */}
      <div className="text-[10.5px] text-ink-mid font-semibold mb-3.5 flex items-center gap-1">
        <span className="text-info">ⓘ</span>
        {targets.length} 파일
        {folders.length > 0 && <> · {folders.length} 폴더</>}
        {targets.length > 0 && (
          <> · {totalMB.toFixed(1)} MB · {totalPages.toLocaleString('ko-KR')}페이지</>
        )}
        {' · 모든 대상에 동일 모델/유형 적용'}
      </div>

      {/* 임베딩 모델 */}
      <div className="mb-3.5">
        <div className="text-xs font-bold text-ink-dark mb-2 flex items-center gap-1.5">
          <span>임베딩 모델</span>
          <span className="text-[10.5px] text-ink-mid font-medium">
            {model.short} · {model.dimension.toLocaleString('ko-KR')}차원 · {model.source === 'on-prem' ? 'on-prem' : 'CSP'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMBED_MODELS.map((m) => {
            const isOn = modelId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setModelId(m.id)}
                className={cn(
                  'flex items-start gap-2 py-2 px-2.5 border rounded text-left transition-colors flex-1 min-w-[200px]',
                  isOn
                    ? 'border-brand-dark bg-brand-tint shadow-sm'
                    : 'border-line bg-white hover:border-brand-dark hover:bg-brand-tint',
                )}
              >
                <span
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5',
                    isOn ? 'border-brand-dark' : 'border-line',
                  )}
                >
                  {isOn && <span className="w-1.5 h-1.5 rounded-full bg-brand-dark" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-extrabold text-ink truncate">{m.short}</span>
                  <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-snug">{m.desc}</span>
                  <span className="inline-flex items-center gap-1 mt-1 text-[9.5px] font-bold">
                    <span
                      className={cn(
                        'inline-block py-[1px] px-1.5 rounded-full border',
                        m.source === 'on-prem'
                          ? 'bg-ok-bg text-ok border-ok-border'
                          : 'bg-bad-bg text-bad border-bad-border',
                      )}
                    >
                      on-prem
                    </span>
                    <span className="text-ink-mid">·</span>
                    <span className="text-ink-dark">{m.dimension}d</span>
                    {m.costPerKWon > 0 && (
                      <>
                        <span className="text-ink-mid">·</span>
                        <span className="text-warn">₩{m.costPerKWon}/1k</span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 인덱스 유형 */}
      <div className="mb-3.5">
        <div className="text-xs font-bold text-ink-dark mb-2 flex items-center gap-1.5">
          <span>인덱스 유형</span>
          <span className="text-[10.5px] text-ink-mid font-medium">검색 방식 결정</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KIND_OPTS.map((o) => {
            const on = kind === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setKind(o.id)}
                className={cn(
                  'flex items-start gap-2 py-2 px-2.5 border rounded text-left transition-colors',
                  on
                    ? 'border-brand-dark bg-brand-tint shadow-sm'
                    : 'border-line bg-white hover:border-brand-dark hover:bg-brand-tint',
                )}
              >
                <span
                  className={cn(
                    'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5',
                    on ? 'border-brand-dark' : 'border-line',
                  )}
                >
                  {on && <span className="w-1.5 h-1.5 rounded-full bg-brand-dark" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-extrabold text-ink">{o.name}</span>
                  <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-snug">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 대상 인덱스 — 내가 만든 인덱스에서 선택 또는 새로 생성 */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-ink-dark mb-2 block">
          대상 인덱스 <span className="text-[10.5px] text-ink-mid font-medium ml-0.5">내가 만든 인덱스에서 선택하거나 새로 생성</span>
        </label>
        <select
          value={selectedIndexId}
          onChange={(e) => setSelectedIndexId(e.target.value)}
          className="w-full h-9 px-3 border border-line rounded text-[12.5px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
        >
          <optgroup label="내가 만든 인덱스">
            {myIndexes.map((idx) => {
              const latest = idx.versions[0];
              return (
                <option key={idx.indexId} value={idx.indexId}>
                  {idx.indexName}
                  {latest ? ` · ${latest.version} · ${latest.vectors.toLocaleString('ko-KR')} 벡터` : ''}
                </option>
              );
            })}
          </optgroup>
          <optgroup label="새로 만들기">
            <option value={NEW_INDEX}>＋ 새 인덱스 생성…</option>
          </optgroup>
        </select>
        {isNewIndex ? (
          <input
            type="text"
            value={newIndexName}
            onChange={(e) => setNewIndexName(e.target.value)}
            placeholder="새 인덱스 이름 입력"
            autoFocus
            className="w-full h-9 px-3 mt-2 border border-brand-dark rounded text-[12.5px] font-semibold text-ink-dark bg-white focus:outline-none"
          />
        ) : (
          <div className="text-[10.5px] text-ink-mid font-semibold mt-1.5">
            이 인덱스에 추가 임베딩됩니다.
          </div>
        )}
      </div>
    </ModalShell>
  );
}
