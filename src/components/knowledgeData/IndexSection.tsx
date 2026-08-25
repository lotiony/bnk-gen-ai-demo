import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  getEmbedModel,
  type IndexKind,
  type IndexVersion,
  type IndexWithVersions,
} from './embedData';
import SynonymModal from './SynonymModal';

interface Props {
  onRefresh: () => void;
  /** 인덱스 목록 (임베딩하면 대상 인덱스에 새 버전으로 쌓임). */
  indexes: IndexWithVersions[];
  /** 인덱스 이름 변경. */
  onRename: (id: string, name: string) => void;
  /** 동의어 맵 규칙 변경. */
  onEditSynonyms: (id: string, synonyms: string[]) => void;
}

const INDEX_KIND_LABEL: Record<IndexKind, string> = {
  hybrid: '하이브리드',
  vector: '벡터 전용',
  bm25: 'BM25',
};

const STATE_PILL: Record<IndexVersion['state'], { className: string; label: string }> = {
  built: { className: 'bg-ok-bg text-ok border-ok-border', label: '빌드 완료' },
  building: { className: 'bg-info-bg text-info border-info-border', label: '빌드 중' },
  stale: { className: 'bg-warn-bg text-warn border-warn-border', label: '재빌드 필요' },
};

/** 인덱스 탭 — 인덱스별 카드. 현재 버전 요약을 크게, 이전 버전 이력은 접어서 표시. */
const IndexSection = forwardRef<HTMLElement, Props>(function IndexSection(
  { onRefresh, indexes, onRename, onEditSynonyms },
  ref,
) {
  return (
    <section ref={ref} className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          인덱스
          <span className="text-[11px] text-ink-mid font-semibold">
            <b className="text-ink-dark">{indexes.length}</b>개
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
        >
          <span className="text-[12px]">↻</span> 새로고침
        </button>
      </div>

      {/* 인덱스 카드 리스트 */}
      <div className="px-[18px] py-[18px] flex flex-col gap-2">
        {indexes.map((idx) => (
          <IndexCard
            key={idx.indexId}
            idx={idx}
            onRename={(name) => onRename(idx.indexId, name)}
            onEditSynonyms={(syns) => onEditSynonyms(idx.indexId, syns)}
          />
        ))}
      </div>
    </section>
  );
});

export default IndexSection;

/* ---------------- Index card ---------------- */

function IndexCard({
  idx,
  onRename,
  onEditSynonyms,
}: {
  idx: IndexWithVersions;
  onRename: (name: string) => void;
  onEditSynonyms: (synonyms: string[]) => void;
}) {
  const current = idx.versions[0];
  const past = idx.versions.slice(1);
  const cState = STATE_PILL[current.state];
  const model = getEmbedModel(current.modelId);
  const isBuilding = current.state === 'building';
  const [synOpen, setSynOpen] = useState(false);
  const synApplies = current.kind !== 'vector';

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(idx.indexName);
  const [showHistory, setShowHistory] = useState(false);

  const startEdit = () => {
    setDraftName(idx.indexName);
    setEditing(true);
  };
  const commitEdit = () => {
    const next = draftName.trim();
    if (next.length > 0 && next !== idx.indexName) onRename(next);
    setEditing(false);
  };

  return (
    <div className="border border-line-soft rounded-lg overflow-hidden bg-white">
      {/* 헤더 — 인덱스 이름·ID·현재 상태 */}
      <div className="flex items-center gap-2.5 py-2.5 px-3.5 border-b border-line-soft">
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          {editing ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="text-[13.5px] font-extrabold text-ink bg-white border border-brand-dark rounded px-1.5 py-0.5 focus:outline-none min-w-[260px]"
            />
          ) : (
            <button
              type="button"
              onClick={startEdit}
              title="이름 변경"
              className="text-[13.5px] font-extrabold text-ink truncate hover:bg-surface rounded px-1 -mx-1 inline-flex items-center gap-1.5"
            >
              {idx.indexName}
              <span className="text-ink-light text-[11px] opacity-60">✎</span>
            </button>
          )}
          <span className="text-[10.5px] text-ink-mid font-mono ml-1">{idx.indexId}</span>
        </div>
        {idx.pendingChunks > 0 && (
          <span className="inline-flex items-center text-[10px] font-extrabold py-[2px] px-2 rounded-full border bg-warn-bg text-warn border-warn-border">
            ＋{idx.pendingChunks}
          </span>
        )}
        <span
          className={cn(
            'inline-flex items-center text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border',
            cState.className,
          )}
        >
          {cState.label}
        </span>
      </div>

      {/* 현재 버전 요약 — 크게 */}
      <div className="py-3 px-3.5 bg-brand-tint">
        <div className="flex items-center gap-2.5 flex-wrap text-[12.5px]">
          <span className="inline-flex items-center justify-center text-[11px] font-extrabold py-[2px] px-2 rounded-full border bg-brand text-ink border-brand-dark min-w-[42px]">
            {current.version}
          </span>
          <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">현재</span>
          <span>
            모델 <b className="text-ink-dark">{model.short}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            유형 <b className="text-ink-dark">{INDEX_KIND_LABEL[current.kind]}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            벡터 <b className="text-ink-dark">{current.vectors.toLocaleString('ko-KR')}</b>
          </span>
          <span className="text-ink-light">·</span>
          <span>
            문서 <b className="text-ink-dark">{current.fileIds.length}</b>건
          </span>
          <span className="text-ink-light">·</span>
          <span className="text-ink-mid font-semibold">{current.createdAt}</span>
          {isBuilding && (
            <span className="inline-flex items-center gap-1.5 ml-1">
              <span className="h-[3px] w-[70px] bg-info-bg rounded-full overflow-hidden">
                <span className="block h-full w-1/3 bg-info animate-parse-progress" />
              </span>
              <span className="text-info font-bold text-[10.5px]">빌드 중</span>
            </span>
          )}
        </div>
        {current.changeNote && (
          <div className="text-[10.5px] text-ink-mid font-semibold mt-1">{current.changeNote}</div>
        )}
      </div>

      {/* 동의어 맵 */}
      <div className="border-t border-line-soft flex items-center gap-2 py-2 px-3.5 text-[11.5px] flex-wrap">
        <span className="text-ink-mid font-semibold">🔤 동의어 맵</span>
        <span className="text-ink-dark font-bold">{idx.synonyms.length}개 규칙</span>
        {synApplies ? (
          idx.synonyms.length > 0 && (
            <span className="flex items-center gap-1 flex-wrap min-w-0">
              <span className="text-ink-light">·</span>
              {idx.synonyms.slice(0, 3).map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center py-[1px] px-1.5 rounded border border-line-soft bg-white text-ink-mid font-mono text-[10px] max-w-[180px] truncate"
                  title={r}
                >
                  {r}
                </span>
              ))}
              {idx.synonyms.length > 3 && <span className="text-ink-light text-[10px]">+{idx.synonyms.length - 3}</span>}
            </span>
          )
        ) : (
          <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-bold">
            벡터 전용 — 미적용
          </span>
        )}
        <span className="flex-1" />
        <button
          onClick={() => setSynOpen(true)}
          className="h-6 px-2 bg-white border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface whitespace-nowrap"
        >
          관리
        </button>
      </div>

      {/* 이전 버전 이력 — 접기 (기본 접힘) */}
      {past.length > 0 && (
        <div className="border-t border-line-soft">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="w-full flex items-center justify-between py-2 px-3.5 text-[11px] font-bold text-ink-mid hover:bg-surface"
          >
            <span>이전 버전 이력 {past.length}건</span>
            <span className={cn('text-[10px] transition-transform', showHistory && 'rotate-180')}>▾</span>
          </button>
          {showHistory && (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {past.map((v) => {
                const m = getEmbedModel(v.modelId);
                return (
                  <li key={v.version} className="flex items-center gap-3 py-2 px-3.5 text-[12px]">
                    <span className="inline-flex items-center justify-center text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border bg-surface-soft text-ink-dark border-line min-w-[42px]">
                      {v.version}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap text-[11.5px]">
                        <span className="text-ink-dark font-bold">{v.createdAt}</span>
                        <span className="text-ink-light">·</span>
                        <span className="text-ink-mid font-semibold">by {v.createdBy}</span>
                        <span className="text-ink-light">·</span>
                        <span><b className="text-ink-dark">{m.short}</b></span>
                        <span className="text-ink-light">·</span>
                        <span><b className="text-ink-dark">{INDEX_KIND_LABEL[v.kind]}</b></span>
                        <span className="text-ink-light">·</span>
                        <span>벡터 <b className="text-ink-dark">{v.vectors.toLocaleString('ko-KR')}</b></span>
                        <span className="text-ink-light">·</span>
                        <span>문서 <b className="text-ink-dark">{v.fileIds.length}</b>건</span>
                      </div>
                      {v.changeNote && (
                        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                          {v.changeNote}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center text-[10px] font-extrabold py-[2px] px-2 rounded-full border whitespace-nowrap',
                        STATE_PILL[v.state].className,
                      )}
                    >
                      {STATE_PILL[v.state].label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <SynonymModal
        open={synOpen}
        onClose={() => setSynOpen(false)}
        indexName={idx.indexName}
        kind={current.kind}
        rules={idx.synonyms}
        onChange={onEditSynonyms}
      />
    </div>
  );
}
