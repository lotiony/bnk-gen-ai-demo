import { forwardRef, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FileRunStatus, FileState, RunSettings } from './parseRunData';
import type { FileRow } from './storageData';
import { parsersFor, recommendedParser, type ParserId } from './parsers';

export interface ParseRowSettings {
  parserIds: ParserId[];
  chunking: RunSettings['chunking'];
  image: RunSettings['image'];
  options: { tableToMd: boolean; pii: boolean; metaTag: boolean };
}

/** 파싱 작업 목록에 담긴 문서 — 저장소 파일 + 출처 경로. */
export type StagedDoc = FileRow & { sourcePath: string };

interface Props {
  title?: string;
  staged: StagedDoc[];
  runs: FileRunStatus[];
  startedAt?: string;
  onRefresh: () => void;
  onShowResult: (run: FileRunStatus) => void;
  onStartFile: (file: FileRow, settings: ParseRowSettings) => void;
  onRemoveStaged: (id: string) => void;
  onGotoStorage: () => void;
  /** 모든 문서 파싱 완료 시 활성화 — 데이터셋 임베딩 시작. */
  onEmbed?: () => void;
}

const EXT_BADGE: Record<string, string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

const CHUNKING_NAME: Record<RunSettings['chunking'], string> = {
  length: '길이 기반',
  semantic: '의미 경계',
  tableIsolated: '표 단독',
  custom: '커스텀 청커',
};

const PIPELINES = [
  { id: 'default', name: '기본 파이프라인', kind: 'builtin' as const },
  { id: 'rag', name: '커스텀 파이프라인 1', kind: 'custom' as const },
  { id: 'reg', name: '커스텀 파이프라인 2', kind: 'custom' as const },
];
const DEFAULT_PIPELINE = 'default';
const STAGES = ['텍스트 추출', '청킹', '후처리'];

/** 큐 신호로 환산한 표시 상태. */
type DispState = 'queued' | 'running' | 'stalled' | 'done' | 'failed';
const STDEF: Record<DispState, { l: string; c: string }> = {
  queued: { l: '대기', c: 'bg-surface-soft text-ink-mid border-line' },
  running: { l: '진행', c: 'bg-info-bg text-info border-info-border' },
  stalled: { l: '지연', c: 'bg-warn-bg text-warn border-warn-border' },
  done: { l: '완료', c: 'bg-ok-bg text-ok border-ok-border' },
  failed: { l: '실패', c: 'bg-bad-bg text-bad border-bad-border' },
};

function defaultSettings(file: FileRow): ParseRowSettings {
  return {
    parserIds: [recommendedParser(file)],
    chunking: 'semantic',
    image: 'caption',
    options: { tableToMd: true, pii: true, metaTag: true },
  };
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

/** 파싱 탭 — 큐/워커 신호 기반 진행 상태. 하트비트·단계·시도·내 앞 대기 수로 가시화. */
const ParseSection = forwardRef<HTMLElement, Props>(function ParseSection(
  { title = '상품·시장 안내 매뉴얼', staged, runs, startedAt, onRefresh, onShowResult, onStartFile, onRemoveStaged, onGotoStorage, onEmbed },
  ref,
) {
  const [pipelineMap, setPipelineMap] = useState<Record<string, string>>({});
  // 기본 파이프라인일 때 문서별로 고르는 파서·청커.
  const [parserMap, setParserMap] = useState<Record<string, ParserId>>({});
  const [chunkerMap, setChunkerMap] = useState<Record<string, RunSettings['chunking']>>({});
  const [filter, setFilter] = useState<'attn' | 'all' | 'queued' | 'running' | 'stalled' | 'done' | 'failed'>('attn');
  // 문서 목록 페이징 (10/20/50개씩).
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  // 라이브 틱 — 진행 중 문서의 하트비트·경과 표시용 (큐 지표는 여기에 물리지 않음).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  // 큐 잔여 — 정적. 매초 자동 변동 없이, 「새로고침」을 눌렀을 때만 재폴링(드레인)된다.
  const [queueBacklog, setQueueBacklog] = useState(116);

  const latestRunByFile = useMemo(() => {
    const m = new Map<string, FileRunStatus>();
    for (const r of runs) {
      const fileId = r.id.split('__')[0];
      const exist = m.get(fileId);
      const score = (s: FileState) => (s === 'run' ? 3 : s === 'fail' ? 2 : s === 'done' ? 1 : 0);
      if (!exist || score(r.state) > score(exist.state)) m.set(fileId, r);
    }
    return m;
  }, [runs]);

  // run 상태 → 큐 신호 표시 상태. 진행 중 첫 문서는 데모용으로 '지연' 판정.
  const runningIds = staged
    .filter((d) => (latestRunByFile.get(d.id)?.state ?? 'wait') === 'run')
    .map((d) => d.id);
  // 데모: 동시에 2건 이상 진행 중이면 첫 건을 '지연'으로 표시(하트비트 초과 상황 시연). 단건 진행은 정상.
  const stalledId = runningIds.length >= 2 ? runningIds[0] : undefined;
  const dispStateOf = (d: StagedDoc): DispState => {
    const st = latestRunByFile.get(d.id)?.state ?? 'wait';
    if (st === 'done') return 'done';
    if (st === 'fail') return 'failed';
    if (st === 'run') return d.id === stalledId ? 'stalled' : 'running';
    return 'queued';
  };

  // 큐 위치(내 앞 N개) — 대기 문서의 순번.
  const queuedIds = staged.filter((d) => dispStateOf(d) === 'queued').map((d) => d.id);

  const counts = useMemo(() => {
    const c: Record<DispState, number> = { queued: 0, running: 0, stalled: 0, done: 0, failed: 0 };
    staged.forEach((d) => c[dispStateOf(d)]++);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, latestRunByFile, stalledId]);

  // 큐/워커 헬스 (목업 수치 — 실제로는 큐 메트릭). 백로그가 드레인되는 모습.
  const backlog = queueBacklog;
  const etaSec = Math.round(backlog / (42 / 60));
  const health = { backlog, processing: counts.running + counts.stalled, workers: 8, throughput: 42, etaSec, stalled: counts.stalled };

  const matches = (d: StagedDoc) => {
    const s = dispStateOf(d);
    if (filter === 'all') return true;
    if (filter === 'attn') return s !== 'done';
    return s === filter;
  };
  const rows = staged.filter(matches);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((curPage - 1) * pageSize, curPage * pageSize);

  const CHIPS: { k: typeof filter; l: string; n: number; dot?: string }[] = [
    { k: 'attn', l: '처리 필요', n: counts.queued + counts.running + counts.stalled + counts.failed },
    { k: 'all', l: '전체', n: staged.length },
    { k: 'queued', l: '대기', n: counts.queued, dot: 'bg-ink-light' },
    { k: 'running', l: '진행', n: counts.running, dot: 'bg-info' },
    { k: 'stalled', l: '지연', n: counts.stalled, dot: 'bg-warn' },
    { k: 'failed', l: '실패', n: counts.failed, dot: 'bg-bad' },
    { k: 'done', l: '완료', n: counts.done, dot: 'bg-ok' },
  ];

  // 진행/지연 문서의 라이브 표시값 (틱 기반).
  const jobView = (d: StagedDoc, s: DispState) => {
    const idx = runningIds.indexOf(d.id);
    const elapsed = 30 + tick + Math.max(0, idx) * 8;
    if (s === 'stalled') return { elapsed, beat: 45 + tick, stage: 0, attempt: 1 };
    return { elapsed, beat: (tick % 2), stage: idx % 2, attempt: 1 };
  };

  // 문서별 파서·청커(선택값 없으면 추천값)로 파싱 설정 구성.
  const settingsFor = (d: StagedDoc): ParseRowSettings => ({
    parserIds: [parserMap[d.id] ?? recommendedParser(d)],
    chunking: chunkerMap[d.id] ?? 'semantic',
    image: 'caption',
    options: { tableToMd: true, pii: true, metaTag: true },
  });
  // 일괄 파싱 — 아직 완료·진행 중이 아닌 문서(대기/지연/실패)를 한 번에 시작.
  const startablesForBulk = staged.filter((d) => {
    const s = dispStateOf(d);
    return s === 'queued' || s === 'stalled' || s === 'failed';
  });
  const startAll = () => startablesForBulk.forEach((d) => onStartFile(d, settingsFor(d)));
  // 모든 문서가 파싱 완료되면 임베딩 버튼 활성화.
  const allParsed = staged.length > 0 && staged.every((d) => dispStateOf(d) === 'done');

  return (
    <section ref={ref} className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          {title}
          <span className="text-[11px] text-ink-mid font-semibold ml-0.5">
            파싱 작업 목록
            <span className="text-ink-light mx-1.5">·</span>
            {staged.length}개 문서
            {startedAt && (
              <>
                <span className="text-ink-light mx-1.5">·</span>
                {startedAt} 시작
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startAll}
            disabled={startablesForBulk.length === 0}
            title={startablesForBulk.length === 0 ? '파싱할 대기 문서가 없습니다' : `대기 문서 ${startablesForBulk.length}건 일괄 파싱`}
            className="h-7 px-2.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            ▶ 일괄 파싱{startablesForBulk.length > 0 ? ` ${startablesForBulk.length}` : ''}
          </button>
          {onEmbed && (
            <button
              onClick={onEmbed}
              disabled={!allParsed}
              title={allParsed ? '모든 문서 파싱 완료 — 임베딩 시작' : '모든 문서가 파싱되면 활성화됩니다'}
              className={cn(
                'h-7 px-2.5 rounded text-[11.5px] font-extrabold border inline-flex items-center gap-1',
                allParsed
                  ? 'bg-ok text-white border-ok hover:opacity-90'
                  : 'bg-white text-ink-light border-line opacity-60 cursor-not-allowed',
              )}
            >
              ▶ 임베딩
            </button>
          )}
          <button
            onClick={onGotoStorage}
            className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface"
          >
            ＋ 저장소에서 담기
          </button>
          <button
            onClick={onRefresh}
            title="상태 새로고침"
            className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
          >
            <span className="text-[12px]">↻</span> 새로고침
          </button>
        </div>
      </div>

      {staged.length === 0 ? (
        <div className="py-14 px-[18px] text-center">
          <div className="text-[28px] mb-2">🗂️</div>
          <div className="text-[13px] font-extrabold text-ink mb-1">파싱할 문서가 없습니다</div>
          <div className="text-[11.5px] text-ink-mid mb-3.5">저장소에서 문서를 선택해 「데이터셋에 담기」 하세요.</div>
          <button
            onClick={onGotoStorage}
            className="h-8 px-3.5 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-ink hover:bg-brand-dark"
          >
            저장소로 이동
          </button>
        </div>
      ) : (
        <>
          {/* 큐/워커 헬스 */}
          <div className="mx-[18px] mt-3 border border-line-soft rounded-lg bg-surface-soft p-3">
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
                <b className="text-[12.5px] text-ink">큐 처리 상황</b>
                <span className="text-[11px] text-ink-mid font-semibold tabular-nums">
                  큐 잔여 <b className="text-ink-dark">{health.backlog}</b> · 처리 중 {health.processing} · 워커 {health.workers}/{health.workers} 활성 · 처리량 {health.throughput}/분 · 예상 {mmss(health.etaSec)} · 지연 {health.stalled}
                </span>
              </div>
              <button
                onClick={() => setQueueBacklog((b) => Math.max(0, b - 42))}
                title="큐 상태만 새로고침"
                className="flex-shrink-0 h-6 px-1.5 bg-white border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
              >
                <span className="text-[11px]">↻</span> 새로고침
              </button>
            </div>
            {/* 상태별 스택 바 */}
            <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden bg-surface border border-line-soft">
              <span className="bg-ok" style={{ width: `${(counts.done / staged.length) * 100}%` }} />
              <span className="bg-info" style={{ width: `${(counts.running / staged.length) * 100}%` }} />
              <span className="bg-warn" style={{ width: `${(counts.stalled / staged.length) * 100}%` }} />
              <span className="bg-line" style={{ width: `${(counts.queued / staged.length) * 100}%` }} />
              <span className="bg-bad" style={{ width: `${(counts.failed / staged.length) * 100}%` }} />
            </div>
          </div>

          {/* 필터 칩 */}
          <div className="flex items-center gap-1.5 flex-wrap px-[18px] pt-3 pb-2">
            {CHIPS.map((c) => {
              const on = filter === c.k;
              return (
                <button
                  key={c.k}
                  onClick={() => {
                    setFilter(c.k);
                    setPage(1);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-full border text-[11.5px] font-extrabold transition-colors',
                    on
                      ? c.k === 'stalled'
                        ? 'bg-warn text-white border-warn'
                        : c.k === 'failed'
                        ? 'bg-bad text-white border-bad'
                        : 'bg-ink text-white border-ink'
                      : 'bg-white text-ink-mid border-line hover:bg-surface',
                  )}
                >
                  {c.dot && <span className={cn('w-1.5 h-1.5 rounded-full', on ? 'bg-white' : c.dot)} />}
                  {c.l} <span className="text-[10px] opacity-80 tabular-nums">{c.n}</span>
                </button>
              );
            })}
          </div>

          {/* 컬럼 헤더 */}
          <div className="hidden md:flex items-center gap-2 px-[18px] pb-1 text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">
            <span className="w-7 flex-shrink-0" />
            <span className="flex-1 min-w-0">문서</span>
            <span className="w-[136px] flex-shrink-0">파이프라인</span>
            <span className="w-[176px] flex-shrink-0">상태 · 진행</span>
            <span className="w-[84px] flex-shrink-0" />
          </div>

          {/* 행 */}
          <div className="px-[18px] pb-[18px] flex flex-col">
            {rows.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-ink-light">해당 상태의 문서가 없습니다</div>
            ) : (
              pagedRows.map((d) => {
                const s = dispStateOf(d);
                const run = latestRunByFile.get(d.id);
                const pipelineId = pipelineMap[d.id] ?? DEFAULT_PIPELINE;
                const isCustom = pipelineId !== DEFAULT_PIPELINE;
                const parserId = parserMap[d.id] ?? recommendedParser(d);
                const chunker = chunkerMap[d.id] ?? 'semantic';
                const rowSettings = settingsFor(d);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 py-2 border-b border-line-soft last:border-b-0"
                  >
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-7 h-8 rounded border text-[9px] font-extrabold flex-shrink-0',
                        EXT_BADGE[d.ext] ?? 'bg-white border-line-soft text-ink-mid',
                      )}
                    >
                      {d.ext}
                    </span>

                    {/* 문서 + 출처 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-bold text-ink truncate flex items-center gap-1.5">
                        <span className="truncate">{d.name}</span>
                        {d.isNew && (
                          <span className="inline-flex items-center text-[9px] font-extrabold py-[1px] px-1 rounded-full bg-ok-bg text-ok border border-ok-border flex-shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-ink-mid font-semibold truncate">
                        <span className="text-ink-light">{d.sourcePath} ›</span> {d.pages ? `${d.pages}p · ` : ''}
                        {d.sizeMB.toFixed(1)} MB
                      </div>
                    </div>

                    {/* 파이프라인 */}
                    <div className="w-[136px] flex-shrink-0">
                      <select
                        value={pipelineId}
                        onChange={(e) => setPipelineMap((m) => ({ ...m, [d.id]: e.target.value }))}
                        className="w-full h-7 px-1.5 border border-line rounded text-[11px] font-bold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                        title="파이프라인"
                      >
                        <optgroup label="기본 제공">
                          {PIPELINES.filter((p) => p.kind === 'builtin').map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="커스텀">
                          {PIPELINES.filter((p) => p.kind === 'custom').map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      {isCustom ? (
                        <div className="text-[10px] text-ink-mid mt-1 truncate">커스텀 · 문서→청크</div>
                      ) : (
                        /* 기본 파이프라인 — 파서·청커 직접 선택 */
                        <div className="mt-1 flex flex-col gap-1">
                          <select
                            value={parserId}
                            onChange={(e) => setParserMap((m) => ({ ...m, [d.id]: e.target.value as ParserId }))}
                            className="w-full h-6 px-1 border border-line rounded text-[10.5px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                            title="파서"
                          >
                            {parsersFor(d).map((p) => (
                              <option key={p.id} value={p.id}>{p.short}</option>
                            ))}
                          </select>
                          <select
                            value={chunker}
                            onChange={(e) =>
                              setChunkerMap((m) => ({ ...m, [d.id]: e.target.value as RunSettings['chunking'] }))
                            }
                            className="w-full h-6 px-1 border border-line rounded text-[10.5px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                            title="청커"
                          >
                            {(['length', 'semantic', 'custom'] as RunSettings['chunking'][]).map((c) => (
                              <option key={c} value={c}>{CHUNKING_NAME[c]}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* 상태 · 진행 */}
                    <div className="w-[176px] flex-shrink-0">
                      <StateCell doc={d} state={s} view={jobView(d, s)} queuePos={queuedIds.indexOf(d.id) + 1} />
                    </div>

                    {/* 액션 */}
                    <div className="w-[84px] flex-shrink-0 flex items-center justify-end gap-1">
                      {s === 'done' && (
                        <button
                          onClick={() => run && onShowResult(run)}
                          className="h-7 px-2 border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface"
                        >
                          결과
                        </button>
                      )}
                      {s === 'failed' && (
                        <button
                          onClick={() => onStartFile(d, rowSettings)}
                          className="h-7 px-2 border border-bad-border text-bad rounded text-[10.5px] font-bold hover:bg-bad-bg"
                        >
                          재시도
                        </button>
                      )}
                      {s === 'stalled' && (
                        <button
                          onClick={() => onStartFile(d, rowSettings)}
                          className="h-7 px-2 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-ink hover:bg-brand-dark"
                        >
                          재시도
                        </button>
                      )}
                      {s === 'queued' && (
                        <button
                          onClick={() => onStartFile(d, rowSettings)}
                          className="h-7 px-2 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-ink hover:bg-brand-dark"
                        >
                          파싱
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveStaged(d.id)}
                        title="작업 목록에서 빼기"
                        className="w-6 h-7 inline-flex items-center justify-center rounded text-ink-light hover:text-bad hover:bg-bad-bg text-[13px]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 페이지네이션 */}
          {rows.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-[18px] pb-[18px] text-[11px] text-ink-mid">
              <span className="flex items-center gap-2">
                <span>
                  {rows.length}개 중 {(curPage - 1) * pageSize + 1}–{Math.min(curPage * pageSize, rows.length)} 표시
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-[26px] px-1.5 border border-line rounded text-[11px] font-semibold text-ink-dark bg-white focus:outline-none focus:border-brand-dark"
                  title="페이지당 표시 개수"
                >
                  <option value={10}>10개씩</option>
                  <option value={20}>20개씩</option>
                  <option value={50}>50개씩</option>
                </select>
              </span>
              {totalPages > 1 && (
                <div className="flex gap-[3px] items-center">
                  <button
                    disabled={curPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-semibold text-ink-mid disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹ 이전
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const n = i + 1;
                    const on = n === curPage;
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={cn(
                          'h-[26px] min-w-[26px] px-1.5 border rounded text-[11px] font-bold tabular-nums',
                          on
                            ? 'border-brand-dark bg-brand-tint text-ink font-extrabold'
                            : 'border-line bg-white text-ink-dark hover:bg-surface',
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button
                    disabled={curPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-[26px] px-2 border border-line bg-white rounded text-[11px] font-bold text-ink-dark hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    다음 ›
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
});

export default ParseSection;

/* ---------------- State cell ---------------- */

function StateCell({
  doc,
  state,
  view,
  queuePos,
}: {
  doc: StagedDoc;
  state: DispState;
  view: { elapsed: number; beat: number; stage: number; attempt: number };
  queuePos: number;
}) {
  const pill = (
    <span className={cn('inline-flex items-center gap-1.5 text-[10.5px] font-extrabold py-[2px] px-2 rounded-full border', STDEF[state].c)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STDEF[state].l}
    </span>
  );

  if (state === 'running') {
    return (
      <div className="flex flex-col items-start gap-1">
        {pill}
        <div className="text-[10px] text-ink-mid font-semibold whitespace-nowrap flex items-center gap-1.5">
          경과 {mmss(view.elapsed)}
          <span className="inline-flex items-center gap-1 text-ok font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
            {view.beat <= 1 ? '방금 갱신' : `${view.beat}초 전`}
          </span>
          · {STAGES[view.stage]} · 시도 {view.attempt}/3
        </div>
      </div>
    );
  }
  if (state === 'stalled') {
    return (
      <div className="flex flex-col items-start gap-1">
        {pill}
        <div className="text-[10px] text-warn font-bold whitespace-nowrap flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-warn" />
          마지막 갱신 {mmss(view.beat)} 전 · {STAGES[view.stage]}에서 멈춤
        </div>
      </div>
    );
  }
  if (state === 'queued') {
    const pos = Math.max(1, queuePos);
    return (
      <div className="flex flex-col items-start gap-1">
        {pill}
        <div className="text-[10px] text-ink-mid font-semibold whitespace-nowrap">
          내 앞 <b className="text-ink-dark">{pos}</b>개 · 예상 ~{mmss(pos * 3)}
        </div>
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div className="flex flex-col items-start gap-1">
        {pill}
        <div className="text-[10px] text-warn font-semibold truncate max-w-[220px]">파서 타임아웃 · 시도 3/3 (데드레터)</div>
      </div>
    );
  }
  // done
  return (
    <div className="flex items-center gap-1.5">
      {pill}
      {doc.pages ? <span className="text-[10px] text-ink-light">{doc.pages}p 처리 완료</span> : null}
    </div>
  );
}
