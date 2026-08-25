import { useEffect, useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import type { FileRow } from './storageData';
import {
  PARSERS,
  compatFor,
  getParser,
  recommendedParser,
  type Compat,
  type ParserId,
} from './parsers';

export interface ParseStartGroup {
  /** 그룹에 적용할 파서 — 여러 개 선택 가능 (병렬 실행). */
  parserIds: ParserId[];
  files: FileRow[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  targets: FileRow[];
  onStart?: (groups: ParseStartGroup[]) => void;
}

type Option = {
  id: string;
  name: string;
  desc: string;
  defaultOn?: boolean;
};

const OPTIONS: Option[] = [
  { id: 'table', name: '표 → 마크다운', desc: '셀 병합 보존 · 헤더 자동 추론', defaultOn: true },
  { id: 'pii', name: 'PII 사전 마스킹', desc: '민감도 규칙을 파싱 직후 적용 (4등급 필수)', defaultOn: true },
  { id: 'metaTag', name: '메타데이터 자동 태깅', desc: '파일명·폴더 경로에서 분기·부서·문서유형 추론', defaultOn: true },
];

type RadioChoice = { id: string; name: string; desc: string };
type RadioGroup = { id: string; label: string; hint?: string; default: string; choices: RadioChoice[] };

const RADIOS: RadioGroup[] = [
  {
    id: 'chunking',
    label: '청킹 전략',
    hint: '검색 품질에 가장 큰 영향',
    default: 'semantic',
    choices: [
      { id: 'length', name: '길이 기반', desc: '800자 / 오버랩 100 — 가장 단순' },
      { id: 'semantic', name: '의미 경계', desc: '제목·문단 단위 분할 — 일반 문서 권장' },
      { id: 'tableIsolated', name: '표 단독', desc: '본문은 의미 경계, 표는 별도 청크로 분리' },
    ],
  },
  {
    id: 'image',
    label: '이미지 처리',
    default: 'caption',
    choices: [
      { id: 'skip', name: '무시', desc: '이미지는 인덱스에서 제외' },
      { id: 'caption', name: 'Vision 캡션', desc: '이미지 → 텍스트 캡션 생성 (+0.5초/장)' },
      { id: 'keep', name: '원본 유지', desc: '이미지 자체를 그대로 보존' },
    ],
  },
];

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

const COMPAT_BADGE: Record<Compat, { className: string; label: string }> = {
  best: { className: 'bg-brand text-white border-brand-dark', label: '✨ 추천' },
  ok: { className: 'bg-surface-soft text-ink-mid border-line', label: '호환' },
  no: { className: 'bg-bad-bg text-bad border-bad-border', label: '비호환' },
};

/** 확장자별 그룹으로 묶기. */
function groupByExt(targets: FileRow[]): { ext: FileRow['ext']; files: FileRow[] }[] {
  const m = new Map<FileRow['ext'], FileRow[]>();
  for (const t of targets) {
    const arr = m.get(t.ext) ?? [];
    arr.push(t);
    m.set(t.ext, arr);
  }
  return [...m.entries()].map(([ext, files]) => ({ ext, files }));
}

/** 파일 파싱 모달 — 확장자별 그룹 + 그룹별 파서 선택. */
export default function ParseModal({ open, onClose, targets, onStart }: Props) {
  const groups = useMemo(() => groupByExt(targets), [targets]);

  // 그룹(ext)별 선택된 파서들 — 그룹의 첫 파일 기준 추천을 기본값으로 (다중 선택)
  const [groupParsers, setGroupParsers] = useState<Record<string, ParserId[]>>({});
  const [opts, setOpts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(OPTIONS.map((o) => [o.id, !!o.defaultOn])),
  );
  const [radio, setRadio] = useState<Record<string, string>>(() =>
    Object.fromEntries(RADIOS.map((r) => [r.id, r.default])),
  );

  // 모달 열릴 때 그룹별 추천 파서를 기본 선택으로 리셋
  useEffect(() => {
    if (!open) return;
    const next: Record<string, ParserId[]> = {};
    for (const g of groups) {
      next[g.ext] = [recommendedParser(g.files[0])];
    }
    setGroupParsers(next);
    setOpts(Object.fromEntries(OPTIONS.map((o) => [o.id, !!o.defaultOn])));
    setRadio(Object.fromEntries(RADIOS.map((r) => [r.id, r.default])));
  }, [open, groups]);

  const totalMB = targets.reduce((s, r) => s + r.sizeMB, 0);

  const toggle = (id: string) => setOpts((s) => ({ ...s, [id]: !s[id] }));

  /** 그룹에 파서 토글 — 마지막 1개는 해제 불가 (최소 1개 유지) */
  const toggleParser = (ext: string, pid: ParserId) => {
    setGroupParsers((s) => {
      const cur = s[ext] ?? [];
      if (cur.includes(pid)) {
        const next = cur.filter((x) => x !== pid);
        return { ...s, [ext]: next.length === 0 ? cur : next };
      }
      return { ...s, [ext]: [...cur, pid] };
    });
  };

  // 모든 그룹이 적어도 한 개의 호환 파서를 선택했는지
  const canStart =
    targets.length > 0 &&
    groups.every((g) => {
      const pids = groupParsers[g.ext] ?? [];
      if (pids.length === 0) return false;
      return pids.every((pid) => g.files.every((f) => compatFor(f, pid) !== 'no'));
    });

  const subtitle =
    targets.length === 1 ? (
      <>
        <b className="text-ink font-extrabold">{targets[0].name}</b> · 텍스트·표·이미지를 구조화된 블록으로 추출합니다
      </>
    ) : (
      <>
        <b className="text-ink font-extrabold">{targets.length}</b>개 파일 ·{' '}
        {groups.length === 1
          ? '동일 형식'
          : `${groups.length}개 형식(${groups.map((g) => g.ext).join('·')})`}{' '}
        · 형식별로 적합한 파서를 선택하세요
      </>
    );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="파일 파싱"
      subtitle={subtitle}
      footer={
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onClose}
            className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
          >
            취소
          </button>
          <button
            disabled={!canStart}
            onClick={() => {
              const out: ParseStartGroup[] = groups.map((g) => ({
                parserIds: groupParsers[g.ext] ?? [recommendedParser(g.files[0])],
                files: g.files,
              }));
              onStart?.(out);
              onClose();
            }}
            className="py-2 px-3.5 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ 파싱 시작
          </button>
        </div>
      }
    >
      {/* 확장자별 그룹 */}
      {groups.map((g) => {
        const selectedParsers = groupParsers[g.ext] ?? [recommendedParser(g.files[0])];
        return (
          <div key={g.ext} className="border border-line-soft rounded mb-3 overflow-hidden">
            {/* 그룹 헤더 */}
            <div className="flex items-center justify-between gap-2 py-2 px-3 bg-surface-soft border-b border-line-soft">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-8 rounded border text-[9.5px] font-extrabold flex-shrink-0',
                    EXT_BADGE[g.ext],
                  )}
                >
                  {g.ext}
                </span>
                <span className="text-[12.5px] font-extrabold text-ink">{g.ext} 그룹</span>
                <span className="text-[11px] text-ink-mid font-semibold">
                  {g.files.length}개 · {g.files.reduce((s, f) => s + f.sizeMB, 0).toFixed(1)} MB
                </span>
              </div>
              <span className="text-[10.5px] text-ink-mid font-semibold">
                파서{' '}
                <b className="text-ink-dark">
                  {selectedParsers.length === 0
                    ? '미선택'
                    : selectedParsers.length === 1
                    ? getParser(selectedParsers[0]).short
                    : `${getParser(selectedParsers[0]).short} 외 ${selectedParsers.length - 1}`}
                </b>
              </span>
            </div>

            {/* 파일 리스트 */}
            <ul className="divide-y divide-line-soft">
              {g.files.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 py-1.5 px-3 text-[12px] text-ink-dark"
                >
                  <span className="text-ink-mid text-[10px] font-bold">·</span>
                  <span className="truncate flex-1">{r.name}</span>
                  {r.isScanned && (
                    <span className="inline-flex items-center text-[9.5px] font-extrabold py-[1px] px-1.5 rounded-full bg-warn-bg text-warn border border-warn-border">
                      스캔 감지
                    </span>
                  )}
                  <span className="text-ink-mid text-[10.5px] font-semibold">
                    {r.sizeMB.toFixed(1)} MB{r.pages ? ` · ${r.pages}p` : ''}
                  </span>
                </li>
              ))}
            </ul>

            {/* 파서 선택 — 다중 선택 (체크박스) · 비호환은 비활성 */}
            <div className="py-2 px-3 bg-white border-t border-line-soft">
              <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-1.5">
                파서 <span className="text-ink-mid font-medium normal-case tracking-normal">· 여러 개 선택 가능</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PARSERS.map((p) => {
                  // 그룹의 모든 파일에 호환되는 경우만 활성
                  let groupCompat: Compat = 'best';
                  for (const f of g.files) {
                    const c = compatFor(f, p.id);
                    if (c === 'no') {
                      groupCompat = 'no';
                      break;
                    }
                    if (c === 'ok') groupCompat = 'ok';
                  }
                  const isOn = selectedParsers.includes(p.id);
                  const disabled = groupCompat === 'no';
                  return (
                    <button
                      key={p.id}
                      onClick={() => !disabled && toggleParser(g.ext, p.id)}
                      disabled={disabled}
                      className={cn(
                        'inline-flex items-center gap-1.5 py-1.5 px-2.5 border rounded text-left transition-colors',
                        isOn
                          ? 'border-brand-dark bg-brand-tint shadow-sm'
                          : disabled
                          ? 'border-line bg-surface-soft opacity-40 cursor-not-allowed'
                          : 'border-line bg-white hover:border-brand-dark hover:bg-brand-tint',
                      )}
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center',
                          isOn ? 'border-brand-dark bg-brand' : 'border-line bg-white',
                        )}
                      >
                        {isOn && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-ink" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[11.5px] font-extrabold text-ink">{p.short}</span>
                      <span
                        className={cn(
                          'inline-flex items-center text-[9px] font-extrabold py-[1px] px-1.5 rounded-full border',
                          COMPAT_BADGE[groupCompat].className,
                        )}
                      >
                        {COMPAT_BADGE[groupCompat].label}
                      </span>
                      <span className="text-[9.5px] text-ink-light font-bold tabular-nums">
                        {p.secPerPage}s/p
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div className="text-[10.5px] text-ink-mid font-semibold mb-3.5 flex items-center gap-1">
        <span className="text-info">ⓘ</span>
        {targets.length} 파일 · {totalMB.toFixed(1)} MB · 형식별로 분리된 파이프라인이 병렬 실행됩니다
      </div>

      {/* 라디오 그룹들 — 공통 옵션 */}
      {RADIOS.map((g) => (
        <div key={g.id} className="mb-3.5">
          <div className="text-xs font-bold text-ink-dark mb-2 flex items-center gap-1.5">
            <span>{g.label}</span>
            {g.hint && <span className="text-[10.5px] text-ink-mid font-medium">{g.hint}</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {g.choices.map((c) => {
              const on = radio[g.id] === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setRadio((s) => ({ ...s, [g.id]: c.id }))}
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
                    <span className="block text-[12px] font-extrabold text-ink">{c.name}</span>
                    <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-snug">{c.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 토글 옵션 */}
      <div className="text-xs font-bold text-ink-dark mb-2">
        추가 옵션 <span className="text-[10.5px] text-ink-mid font-medium ml-0.5">기본값 권장</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const on = !!opts[o.id];
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={cn(
                'flex items-start gap-2.5 py-2.5 px-3 border rounded text-left transition-colors',
                on
                  ? 'border-brand-dark bg-[#FDF6F4]'
                  : 'border-line bg-white hover:border-brand-dark hover:bg-brand-tint',
              )}
            >
              <span
                className={cn(
                  'relative w-[26px] h-4 rounded-lg transition-colors flex-shrink-0 mt-0.5',
                  on ? 'bg-ok' : 'bg-line',
                )}
              >
                <span
                  className={cn(
                    'absolute top-[2px] w-3 h-3 bg-white rounded-full transition-all',
                    on ? 'left-3' : 'left-[2px]',
                  )}
                />
              </span>
              <span className="flex-1">
                <span className="block text-[12.5px] font-extrabold text-ink">{o.name}</span>
                <span className="block text-[10.5px] text-ink-mid mt-0.5 leading-relaxed">{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
