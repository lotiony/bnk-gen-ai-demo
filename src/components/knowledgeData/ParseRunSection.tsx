import { forwardRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { FileRunStatus, FileState, StageId, StageState } from './parseRunData';
import { STAGE_LABELS } from './parseRunData';
import { getParser } from './parsers';

interface Props {
  files: FileRunStatus[];
  startedAt: string;
  onClear: () => void;
  onShowResult: (file: FileRunStatus) => void;
}

const STAGES: StageId[] = ['extract', 'ocr', 'table', 'pii'];

const FILE_STATE_PILL: Record<FileState, string> = {
  wait: 'bg-surface-soft text-ink-mid border-line',
  run: 'bg-info-bg text-info border-info-border',
  done: 'bg-ok-bg text-ok border-ok-border',
  fail: 'bg-bad-bg text-bad border-bad-border',
};

const FILE_STATE_LABEL: Record<FileState, string> = {
  wait: '대기',
  run: '진행 중',
  done: '완료',
  fail: '실패',
};

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

/** 파싱 진행 섹션 — 매트릭스 + 우측 상세. forwardRef로 부모에서 스크롤 타깃 사용. */
const ParseRunSection = forwardRef<HTMLElement, Props>(function ParseRunSection(
  { files, startedAt, onClear, onShowResult },
  ref,
) {
  // 집계
  const totals = useMemo(() => {
    const done = files.filter((f) => f.state === 'done').length;
    const run = files.filter((f) => f.state === 'run').length;
    const fail = files.filter((f) => f.state === 'fail').length;
    const wait = files.filter((f) => f.state === 'wait').length;
    const chunks = files.reduce((s, f) => s + f.chunks, 0);
    const warns = files.reduce((s, f) => s + f.warnings.filter((w) => w.severity === 'warn').length, 0);
    return { done, run, fail, wait, chunks, warns };
  }, [files]);

  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;
    return Math.round(files.reduce((s, f) => s + f.progress, 0) / files.length);
  }, [files]);

  const failedFiles = files.filter((f) => f.state === 'fail');

  return (
    <section ref={ref} className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          파싱 진행
          <span className="text-[11px] text-ink-mid font-semibold ml-0.5">
            {files.length}개 파일 · {startedAt} 시작
          </span>
        </div>
        <div className="flex items-center gap-2">
          {failedFiles.length > 0 && (
            <button
              onClick={() => window.alert(`실패한 ${failedFiles.length}개 파일을 재시도합니다 (목업).`)}
              className="h-7 px-2.5 bg-white border border-bad-border text-bad rounded text-[11.5px] font-bold hover:bg-bad-bg"
            >
              ↻ 실패만 재시도
            </button>
          )}
          {totals.done > 0 && (
            <button
              onClick={() => window.alert(`완료된 ${totals.done}개 파일을 인덱스로 보냅니다 (목업).`)}
              className="h-7 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
            >
              ▶ 완료분 인덱스로
            </button>
          )}
          <button
            onClick={onClear}
            title="진행 뷰 닫기"
            className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface hover:text-ink-dark text-base"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 전체 통계 스트립 */}
      <div className="grid grid-cols-5 gap-2 p-[18px] pb-3">
        <Stat label="전체 진행률" value={`${overallProgress}%`} tone="info" sub={`${files.length}개 파일`} />
        <Stat label="완료" value={`${totals.done}`} tone="ok" />
        <Stat label="진행 중" value={`${totals.run}`} tone="info" />
        <Stat label="실패" value={`${totals.fail}`} tone={totals.fail > 0 ? 'bad' : 'neutral'} />
        <Stat
          label="추출 청크 · 경고"
          value={`${totals.chunks.toLocaleString('ko-KR')} · ${totals.warns}`}
          tone={totals.warns > 0 ? 'warn' : 'neutral'}
        />
      </div>

      {/* 매트릭스 */}
      <div className="px-[18px] pb-[18px]">
        <div className="border border-line-soft rounded overflow-hidden bg-white">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">파일</th>
                {STAGES.map((s) => (
                  <th
                    key={s}
                    className="w-[44px] text-center py-2 px-1 font-extrabold text-[10.5px] border-b border-line-soft"
                    title={STAGE_LABELS[s].long}
                  >
                    {STAGE_LABELS[s].short}
                  </th>
                ))}
                <th className="w-[110px] text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">진행</th>
                <th className="w-[58px] text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">청크</th>
                <th className="w-[42px] text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">⚠</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => {
                const isLast = i === files.length - 1;
                const isClickable = f.state === 'done' || f.state === 'fail';
                return (
                  <tr
                    key={f.id}
                    onClick={() => isClickable && onShowResult(f)}
                    className={cn(
                      'transition-colors',
                      isClickable ? 'cursor-pointer hover:bg-[#FDF6F4]' : 'cursor-default',
                    )}
                  >
                    <td className={cn('py-2 px-2.5', !isLast && 'border-b border-line-soft')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-7 h-8 rounded border text-[9.5px] font-extrabold flex-shrink-0',
                            EXT_BADGE[f.ext],
                          )}
                        >
                          {f.ext}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-bold text-ink truncate">{f.name}</div>
                          <div className="text-[10.5px] text-ink-mid font-semibold flex items-center gap-1.5">
                            <span>
                              {f.pages}p · {f.sizeMB.toFixed(1)} MB
                            </span>
                            <span className="inline-flex items-center text-[9px] font-extrabold py-[1px] px-1.5 rounded border border-info-border bg-info-bg text-info">
                              {getParser(f.parserId).short}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {STAGES.map((sid) => {
                      const stage = f.stages.find((s) => s.id === sid);
                      return (
                        <td
                          key={sid}
                          className={cn('py-2 px-1 text-center', !isLast && 'border-b border-line-soft')}
                        >
                          <StageCell state={stage?.state ?? 'wait'} hint={stage?.hint} />
                        </td>
                      );
                    })}
                    <td className={cn('py-2 px-2.5', !isLast && 'border-b border-line-soft')}>
                      <span
                        className={cn(
                          'inline-flex items-center text-[10px] font-extrabold py-[2px] px-1.5 rounded-full border',
                          FILE_STATE_PILL[f.state],
                        )}
                      >
                        {FILE_STATE_LABEL[f.state]}
                      </span>
                      {f.state === 'run' && (
                        <div className="h-[3px] mt-1 bg-info-bg rounded-full overflow-hidden">
                          <div className="h-full w-1/3 bg-info rounded-full animate-parse-progress" />
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        'py-2 px-2.5 text-right font-bold text-ink-dark tabular-nums text-[11.5px]',
                        !isLast && 'border-b border-line-soft',
                      )}
                    >
                      {f.chunks > 0 ? f.chunks.toLocaleString('ko-KR') : '—'}
                    </td>
                    <td className={cn('py-2 px-2.5 text-right', !isLast && 'border-b border-line-soft')}>
                      {f.warnings.length > 0 ? (
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold',
                            f.warnings.some((w) => w.severity === 'fail')
                              ? 'bg-bad-bg text-bad'
                              : 'bg-warn-bg text-warn',
                          )}
                        >
                          {f.warnings.length}
                        </span>
                      ) : (
                        <span className="text-ink-light text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});

export default ParseRunSection;

/* ---------------- Stat ---------------- */

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'ok' | 'info' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClass: Record<typeof tone, string> = {
    ok: 'text-ok',
    info: 'text-info',
    warn: 'text-warn',
    bad: 'text-bad',
    neutral: 'text-ink',
  } as const as Record<typeof tone, string>;
  return (
    <div className="bg-surface-soft border border-line-soft rounded p-2.5">
      <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-1">{label}</div>
      <div className={cn('text-base font-extrabold tabular-nums leading-tight', toneClass[tone])}>{value}</div>
      {sub && <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{sub}</div>}
    </div>
  );
}

/* ---------------- StageCell ---------------- */

const STAGE_CELL_STYLE: Record<StageState, string> = {
  wait: 'bg-surface-soft text-ink-light border-line',
  run: 'bg-info-bg text-info border-info-border animate-pulse',
  done: 'bg-ok-bg text-ok border-ok-border',
  skip: 'bg-white text-ink-light border-line-soft',
  fail: 'bg-bad-bg text-bad border-bad-border',
};

const STAGE_CELL_GLYPH: Record<StageState, string> = {
  wait: '·',
  run: '◐',
  done: '✓',
  skip: '−',
  fail: '✕',
};

function StageCell({ state, hint }: { state: StageState; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full border text-[12px] font-extrabold',
          STAGE_CELL_STYLE[state],
        )}
        title={state}
      >
        {STAGE_CELL_GLYPH[state]}
      </span>
      {hint && <span className="text-[9.5px] text-ink-mid font-bold tabular-nums">{hint}</span>}
    </div>
  );
}
