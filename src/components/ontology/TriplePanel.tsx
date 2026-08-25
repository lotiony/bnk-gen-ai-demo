/**
 * 트리플 편집 패널 — 선택한 클래스의 속성·관계를 태그로 펼쳐 바로 고친다.
 *
 * RFP: RAG-008 온톨로지 플랫폼 연계(권고·가점)
 *
 * 태그 호버는 그래프에서 해당 요소만 살리고(onHighlight), 태그 클릭은 편집,
 * ＋ 는 추가다. 그래프 노드의 ＋ 배지와 같은 동작으로 이어진다.
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { addAttr, removeAttr, addRelation, removeRelation, useOntology } from '@/lib/ontologyStore';
import type { OntologyClass } from '@/data/ontology';

export type Highlight = { kind: 'attr'; cls: string; attr: string } | { kind: 'rel'; uri: string } | null;

/** 그래프 ＋ / 패널 ＋ 가 여는 편집 폼. */
export type TripleDraft =
  | { kind: 'attr'; cls: string }
  | { kind: 'rel'; domain: string; range?: string }
  | null;

const CHIP = 'inline-flex items-center gap-1 h-[24px] px-2 rounded-full border text-[11px] font-bold transition-colors';

export default function TriplePanel({
  selected,
  draft,
  onDraft,
  onHighlight,
  onClose,
  onSelect,
}: {
  selected: string | null;
  draft: TripleDraft;
  onDraft: (d: TripleDraft) => void;
  onHighlight: (h: Highlight) => void;
  onClose: () => void;
  onSelect: (n: string) => void;
}) {
  const { classes, relations } = useOntology();
  const cls: OntologyClass | undefined = classes.find((c) => c.name === selected);

  const [attrName, setAttrName] = useState('');
  const [relLabel, setRelLabel] = useState('');
  const [relRange, setRelRange] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 폼이 열릴 때마다 값 초기화 — 이전 입력이 남아 있으면 오입력이 된다.
  useEffect(() => {
    setErr(null);
    if (draft?.kind === 'attr') {
      setAttrName('');
    } else if (draft?.kind === 'rel') {
      setRelLabel('');
      setRelRange(draft.range ?? '');
    }
    if (draft) requestAnimationFrame(() => inputRef.current?.focus());
  }, [draft]);

  if (!cls) return null;

  const rels = relations.filter((r) => r.domain === cls.name || r.range === cls.name);

  const submitAttr = () => {
    const v = attrName.trim();
    if (!v) return setErr('속성명을 입력하세요.');
    if (cls.attrs.includes(v)) return setErr('이미 있는 속성입니다.');
    addAttr(cls.uri, v);
    onDraft(null);
  };

  const submitRel = () => {
    const label = relLabel.trim();
    const range = relRange.trim();
    if (!label) return setErr('관계명을 입력하세요.');
    if (!range) return setErr('대상 클래스를 고르세요.');
    const domain = draft?.kind === 'rel' ? draft.domain : cls.name;
    const uri = `bnk:${label.replace(/\s+/g, '_')}_${domain}_${range}`;
    if (!addRelation({ name: label, uri, domain, range })) return setErr('같은 관계가 이미 있습니다.');
    onDraft(null);
  };

  return (
    <div className="border border-line rounded bg-white px-3.5 py-3 mb-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-extrabold text-ink">{cls.name}</span>
        <span className="text-[10.5px] text-ink-mid font-semibold">
          속성 {cls.attrs.length} · 관계 {rels.length}
        </span>
        <span className="text-[10.5px] text-ink-light font-semibold border-l border-line-soft pl-2">
          태그 클릭=편집 · 호버=그래프 강조
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto w-6 h-6 flex items-center justify-center rounded border border-line text-ink-mid hover:border-brand hover:text-brand text-[13px] leading-none"
          title="닫기"
        >
          ✕
        </button>
      </div>

      {/* 속성 */}
      <div className="flex items-start gap-2 mt-2.5">
        <span className="text-[11px] font-extrabold text-ink-mid w-[28px] flex-shrink-0 pt-[4px]">속성</span>
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {cls.attrs.map((a) => (
            <span
              key={a}
              className={cn(CHIP, 'bg-surface border-line text-ink-dark hover:border-brand')}
              onMouseEnter={() => onHighlight({ kind: 'attr', cls: cls.name, attr: a })}
              onMouseLeave={() => onHighlight(null)}
            >
              {a}
              <button
                type="button"
                onClick={() => {
                  onHighlight(null);
                  removeAttr(cls.uri, a);
                }}
                className="text-ink-light hover:text-brand text-[12px] leading-none -mr-0.5"
                title={`'${a}' 삭제`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onDraft({ kind: 'attr', cls: cls.name })}
            className={cn(CHIP, 'bg-info-bg border-info-border text-info hover:border-info px-2.5')}
          >
            ＋
          </button>
        </div>
      </div>

      {/* 관계 */}
      <div className="flex items-start gap-2 mt-2">
        <span className="text-[11px] font-extrabold text-ink-mid w-[28px] flex-shrink-0 pt-[4px]">관계</span>
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {rels.map((r) => {
            const out = r.domain === cls.name;
            const other = out ? r.range : r.domain;
            return (
              <span
                key={r.uri}
                className={cn(CHIP, 'bg-brand-bg border-brand-tint text-ink-dark hover:border-brand')}
                onMouseEnter={() => onHighlight({ kind: 'rel', uri: r.uri })}
                onMouseLeave={() => onHighlight(null)}
              >
                <span className="text-brand font-extrabold">{out ? '→' : '←'}</span>
                {r.name}
                <span className="text-ink-light">·</span>
                <button
                  type="button"
                  onClick={() => {
                    onHighlight(null);
                    onSelect(other);
                  }}
                  className="font-extrabold hover:text-brand"
                  title={`'${other}' 로 이동`}
                >
                  {other}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onHighlight(null);
                    removeRelation(r.uri);
                  }}
                  className="text-ink-light hover:text-brand text-[12px] leading-none -mr-0.5"
                  title={`'${r.name}' 삭제`}
                >
                  ✕
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => onDraft({ kind: 'rel', domain: cls.name })}
            className={cn(CHIP, 'bg-info-bg border-info-border text-info hover:border-info px-2.5')}
          >
            ＋
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {draft && (
        <div className="mt-2.5 pt-2.5 border-t border-line-soft flex items-center gap-2 flex-wrap">
          {draft.kind === 'attr' ? (
            <>
              <span className="text-[11px] font-extrabold text-info">속성 추가</span>
              <input
                ref={inputRef}
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitAttr()}
                placeholder="예) 여신한도금액"
                className="h-[28px] w-[180px] border border-line rounded px-2 text-[11.5px] font-semibold focus:border-info outline-none"
              />
              <button type="button" onClick={submitAttr} className="h-[28px] px-3 bg-info border border-info rounded text-[11px] font-extrabold text-white">
                추가
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] font-extrabold text-info">관계 추가</span>
              <span className="text-[11.5px] font-extrabold text-ink-dark">{draft.domain}</span>
              <input
                ref={inputRef}
                value={relLabel}
                onChange={(e) => setRelLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitRel()}
                placeholder="관계명 예) 적용한다"
                className="h-[28px] w-[150px] border border-line rounded px-2 text-[11.5px] font-semibold focus:border-info outline-none"
              />
              <span className="text-info font-extrabold">→</span>
              <select
                value={relRange}
                onChange={(e) => setRelRange(e.target.value)}
                className="h-[28px] w-[150px] border border-line rounded px-1.5 text-[11.5px] font-semibold bg-white"
              >
                <option value="">대상 클래스…</option>
                {classes
                  .filter((c) => c.name !== draft.domain)
                  .map((c) => (
                    <option key={c.uri} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <button type="button" onClick={submitRel} className="h-[28px] px-3 bg-info border border-info rounded text-[11px] font-extrabold text-white">
                추가
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDraft(null)}
            className="h-[28px] px-2.5 border border-line rounded text-[11px] font-extrabold text-ink-mid hover:border-brand hover:text-brand"
          >
            취소
          </button>
          {err && <span className="text-[11px] font-bold text-bad">{err}</span>}
        </div>
      )}
    </div>
  );
}
