import { useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import type { IndexKind } from './embedData';

interface Props {
  open: boolean;
  onClose: () => void;
  indexName: string;
  /** 현재 버전 유형 — 'vector'면 동의어 미적용. */
  kind: IndexKind;
  rules: string[];
  onChange: (rules: string[]) => void;
}

/** 규칙이 명시 매핑('=>')인지 동등인지. */
const isExplicit = (r: string) => r.includes('=>');

/** 동의어 맵 관리 모달 — Azure AI Search Synonym Map(쿼리 확장). 키워드/하이브리드에만 적용. */
export default function SynonymModal({ open, onClose, indexName, kind, rules, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const applies = kind !== 'vector';

  const add = () => {
    const r = draft.trim();
    if (!r) return;
    onChange([...rules, r]);
    setDraft('');
  };
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      title="동의어 맵"
      subtitle={
        <>
          <b className="text-ink">{indexName}</b> · 쿼리 시점 확장(재빌드 불필요) · Azure AI Search Synonym Map
        </>
      }
      footer={
        <>
          <span className="text-[11.5px] text-ink-mid">
            총 <b className="text-ink-dark">{rules.length}</b>개 규칙
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
          >
            완료
          </button>
        </>
      }
    >
      {/* 적용 안내 */}
      {applies ? (
        <div className="text-[11px] font-semibold text-info bg-info-bg border border-info-border rounded px-2.5 py-1.5 mb-3">
          현재 검색 유형({kind === 'hybrid' ? '하이브리드' : 'BM25'})의 키워드 매칭에 적용됩니다. 벡터 유사도에는 적용되지 않습니다.
        </div>
      ) : (
        <div className="text-[11px] font-semibold text-warn bg-warn-bg border border-warn-border rounded px-2.5 py-1.5 mb-3">
          ⚠ 이 인덱스는 <b>벡터 전용</b>이라 동의어가 적용되지 않습니다. 하이브리드·BM25로 빌드하면 적용됩니다. (규칙은 미리 등록해 둘 수 있습니다.)
        </div>
      )}

      {/* 규칙 추가 */}
      <div className="border border-line-soft rounded-lg bg-surface-soft p-3 mb-3">
        <div className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-2">규칙 추가</div>
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="동등: 적금, 정기적금, 예적금   ·   명시: ISA => 개인종합자산관리계좌"
            className="flex-1 h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="h-8 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            ＋ 추가
          </button>
        </div>
        <div className="text-[10.5px] text-ink-light font-semibold mt-1.5">
          <b>동등</b>: 쉼표로 나열한 용어들이 서로 치환 · <b>명시(=&gt;)</b>: 좌측 용어를 우측으로 치환
        </div>
      </div>

      {/* 규칙 목록 */}
      <div className="border border-line-soft rounded-lg overflow-hidden">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
              <th className="text-left py-2 px-3 font-bold w-10">#</th>
              <th className="text-center py-2 px-3 font-bold w-16">유형</th>
              <th className="text-left py-2 px-3 font-bold">규칙</th>
              <th className="text-center py-2 px-3 font-bold w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[11.5px] text-ink-light">
                  등록된 동의어 규칙이 없습니다.
                </td>
              </tr>
            ) : (
              rules.map((r, i) => (
                <tr key={i} className="hover:bg-surface">
                  <td className="py-2 px-3 text-ink-light tabular-nums">{i + 1}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-bold',
                        isExplicit(r)
                          ? 'bg-accent-purple-bg text-accent-purple border-accent-purple-border'
                          : 'bg-info-bg text-info border-info-border',
                      )}
                    >
                      {isExplicit(r) ? '명시' : '동등'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-ink-dark font-semibold font-mono">{r}</td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => remove(i)}
                      title="삭제"
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-mid hover:bg-bad-bg hover:text-bad"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
