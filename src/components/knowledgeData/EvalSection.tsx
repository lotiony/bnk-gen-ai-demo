import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { useDeployApprovals, type SearchConfig } from '@/lib/deployApprovalStore';
import EvalSetModal, { type GoldenItem, type EvalSet } from './EvalSetModal';
import ModalShell from './ModalShell';

/** 검색 구성 요약 문자열. */
const QUERY_LABEL: Record<SearchConfig['queryType'], string> = {
  keyword: '키워드',
  vector: '벡터',
  hybrid: '하이브리드',
};
const searchSummary = (s: SearchConfig) =>
  [
    `쿼리 ${QUERY_LABEL[s.queryType]}`,
    `시맨틱 랭커 ${s.semanticRanker ? 'ON' : 'OFF'}`,
    `벡터 ${s.vectorAlgo.toUpperCase()}`,
    `Top ${s.topK}`,
    `캡션 ${s.captions ? 'ON' : 'OFF'}`,
  ].join(' · ');

/** 검색 평가 지표 — 정답 문서 라벨 기반(LLM 미사용). 모두 0~1. */
interface MetricMeta {
  key: string;
  label: string;
  desc: string;
}

const METRICS: MetricMeta[] = [
  {
    key: 'recall5',
    label: 'Recall@5',
    desc: '정답 근거 구절이 담긴 청크가 검색 상위 5건 안에 포함된 질의 비율',
  },
  {
    key: 'mrr',
    label: 'MRR',
    desc: '정답 근거 구절 청크가 나온 첫 순위의 역수 평균 (1등 1.0, 2등 0.5, 3등 0.33…)',
  },
  {
    key: 'ndcg',
    label: 'nDCG@10',
    desc: '상위 10건에서 정답 근거 구절 청크의 순위 가중 누적 이득을 이상적 순서로 정규화한 값',
  },
];

type Values = Record<string, number>;

interface Run {
  id: string;
  at: string;
  /** 평가 대상 = 그 시점 배포된 학습계 버전(배포 일시). */
  deployAt: string;
  /** 평가 대상 학습계 배포 버전 라벨 (#2 등). */
  deployVer: string;
  by: string;
  values: Values;
}

const compositeOf = (v: Values) =>
  Math.round((METRICS.reduce((s, m) => s + (v[m.key] ?? 0), 0) / METRICS.length) * 100) / 100;

/** 초기 이력 (최신순). */
const SEED_RUNS: Run[] = [
  {
    id: 'ev-4',
    at: '2026-01-08 10:40',
    deployAt: '2026-01-08 10:30',
    deployVer: '#2',
    by: '정오너',
    values: { recall5: 0.92, mrr: 0.81, ndcg: 0.87 },
  },
  {
    id: 'ev-3',
    at: '2026-01-08 10:12',
    deployAt: '2026-01-08 10:30',
    deployVer: '#2',
    by: '정오너',
    values: { recall5: 0.88, mrr: 0.74, ndcg: 0.82 },
  },
  {
    id: 'ev-2',
    at: '2025-11-15 14:30',
    deployAt: '2025-11-15 14:02',
    deployVer: '#1',
    by: '박서연',
    values: { recall5: 0.83, mrr: 0.68, ndcg: 0.77 },
  },
];

/** 평가셋(골든셋) 초기 목록 — 여러 세트를 전환하며 관리. */
const SEED_SETS: EvalSet[] = [
  {
    id: 'set-pb',
    name: 'PB 상담 골든셋',
    items: [
      { id: 'g1', q: 'ISA 계좌 연간 납입한도는?', gold: 'ISA_상품설명서.xlsx', passage: 'ISA 연간 납입한도는 2,000만원이며 5년간 최대 1억원까지 납입할 수 있다.' },
      { id: 'g2', q: '중개형 ISA에서 해외주식 매매가 되나요?', gold: '상품안내_매뉴얼.pdf', passage: '중개형 ISA는 국내 상장주식·ETF 매매가 가능하며 해외주식 직접 매매는 불가하다.' },
      { id: 'g3', q: 'ISA 의무가입기간과 재가입 조건은?', gold: 'ISA_약관.pdf', passage: '의무가입기간은 3년이며 만기 후 재가입이 가능하다.' },
      { id: 'g4', q: '펀드 환매수수료 부과 기준은?', gold: '펀드_상품설명서.pdf', passage: '가입 후 90일 이내 환매 시 이익금의 일정 비율을 환매수수료로 부과한다.' },
      { id: 'g5', q: '비과세 한도 초과분 세율은?', gold: 'ISA_약관.pdf', passage: '비과세 한도 초과분은 9.9%로 분리과세된다.' },
      { id: 'g6', q: '연금저축 세액공제 한도는?', gold: '연금저축_상품설명서.pptx', passage: '연금저축 납입액은 연 600만원까지 세액공제 대상이다.' },
      { id: 'g7', q: '예금자보호 한도는 얼마인가요?', gold: '예금_상품설명서.docx', passage: '예금자보호 한도는 원리금 합산 1인당 5,000만원이다.' },
      { id: 'g8', q: '적금 중도해지 시 이율은 어떻게 되나요?', gold: '적금_상품설명서.hwpx', passage: '중도해지 시 약정이율이 아닌 중도해지이율이 적용된다.' },
    ],
  },
  {
    id: 'set-isa',
    name: 'ISA 집중 세트',
    items: [
      { id: 'i1', q: 'ISA 계좌 연간 납입한도는?', gold: 'ISA_상품설명서.xlsx', passage: 'ISA 연간 납입한도는 2,000만원이며 5년간 최대 1억원까지 납입할 수 있다.' },
      { id: 'i2', q: 'ISA 의무가입기간은?', gold: 'ISA_약관.pdf', passage: '의무가입기간은 3년이며 만기 후 재가입이 가능하다.' },
      { id: 'i3', q: 'ISA 비과세 한도 초과분 세율은?', gold: 'ISA_약관.pdf', passage: '비과세 한도 초과분은 9.9%로 분리과세된다.' },
    ],
  },
  {
    id: 'set-faq',
    name: '신상품 FAQ 세트',
    items: [
      { id: 'f1', q: '연금저축 세액공제 한도는?', gold: '연금저축_상품설명서.pptx', passage: '연금저축 납입액은 연 600만원까지 세액공제 대상이다.' },
      { id: 'f2', q: '예금자보호 한도는?', gold: '예금_상품설명서.docx', passage: '예금자보호 한도는 원리금 합산 1인당 5,000만원이다.' },
    ],
  },
];

/** 문자열 해시 (문항별 순위를 결정적으로 산출하는 데 사용). */
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

interface RowResult {
  q: string;
  gold: string;
  passage: string;
  rank: number;
}

/**
 * 평가셋 전체 문항에 대한 검색 결과 행 — 정답 근거 구절이 담긴 청크가 몇 위에 나왔는지(rank).
 * 실행(run)과 문항 id로 결정적으로 산출해, 같은 실행은 항상 같은 순위를 보인다.
 */
const rowsFor = (golden: GoldenItem[], run: Run): RowResult[] => {
  const seed = Math.round((run.values.recall5 ?? 0.85) * 100);
  return golden.map((g) => ({
    q: g.q,
    gold: g.gold,
    passage: g.passage,
    rank: 1 + ((hash(g.id) + seed) % 8), // 1~8위
  }));
};

/** 과거 실행 대비 델타 계산용. */

/** YYYY-MM-DD HH:mm 포맷. */
const fmt = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 최신 실행 값에 소폭 변동을 준 새 실행 값 생성. */
const jitter = (base: Values): Values => {
  const out: Values = {};
  for (const m of METRICS) {
    const delta = (Math.random() - 0.45) * 0.06;
    out[m.key] = Math.max(0, Math.min(1, Math.round((base[m.key] + delta) * 100) / 100));
  }
  return out;
};

/** 평가 큐 작업 — 공용 평가 클러스터에서 대기·실행되는 잡. */
interface QueueJob {
  id: string;
  setName: string;
  deployAt: string;
  by: string;
  status: 'queued' | 'running';
  requestedAt: string;
  /** 진행률 0~100. 실행 중이면 매 틱 증가하다 100에서 완료. */
  progress: number;
  /** 내가 실행한 잡 여부 — 완료 시 해당 실행을 선택 표시. */
  mine?: boolean;
}

/** 초기 큐 — 비어 있음(유휴). 평가 실행 시 내 잡이 큐에 올라가 진행된다. */
const SEED_QUEUE: QueueJob[] = [];

/**
 * 평가 탭 — 현재 배포된 학습계 검색 API를 정답 라벨 기준으로 평가.
 * Recall@5 · MRR · nDCG@10 (LLM 미사용, 결정적). 실행할 때마다 이력이 누적된다.
 */
export default function EvalSection() {
  const persona = useCurrentPersona();
  const deploys = useDeployApprovals();
  // 평가는 현재 배포된(승인 완료) 학습계 API를 대상으로 한다. 목록은 최신순.
  const deployed = deploys.find((d) => d.state === 'done');
  const deployedIndex = deployed
    ? deployed.sources.map((s) => `${s.name} · ${s.version}`).join(', ')
    : 'PB_상담_지식인덱스 · v4';

  const [runs, setRuns] = useState<Run[]>(SEED_RUNS);
  const [running, setRunning] = useState(false);
  const [showRows, setShowRows] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedId, setSelectedId] = useState(SEED_RUNS[0].id);
  const [sets, setSets] = useState<EvalSet[]>(SEED_SETS);
  const [activeSetId, setActiveSetId] = useState(SEED_SETS[0].id);
  const activeSet = sets.find((s) => s.id === activeSetId) ?? sets[0];
  const golden: GoldenItem[] = activeSet.items;
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rowsPage, setRowsPage] = useState(0);
  const [queue, setQueue] = useState<QueueJob[]>(SEED_QUEUE);
  const [historyView, setHistoryView] = useState<'deploy' | 'runs'>('deploy');
  // 큐/워커 헬스 (목업 — 실제로는 평가 클러스터 메트릭). 백로그는 「새로고침」 시 드레인.
  const [queueBacklog, setQueueBacklog] = useState(0);

  const detailRun = runs.find((r) => r.id === detailId) ?? null;
  const detailPrev = detailRun ? runs[runs.findIndex((r) => r.id === detailRun.id) + 1] : undefined;

  const latest = runs[0];
  const selected = runs.find((r) => r.id === selectedId) ?? latest;
  const selectedIdx = runs.findIndex((r) => r.id === selected.id);
  const prev = runs[selectedIdx + 1];
  const composite = compositeOf(selected.values);
  const delta = prev ? Math.round((composite - compositeOf(prev.values)) * 100) / 100 : null;

  const PAGE_SIZE = 10;
  const allRows = rowsFor(golden, selected);
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const page = Math.min(rowsPage, totalPages - 1);
  const pageRows = allRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const runningCount = queue.filter((j) => j.status === 'running').length;
  const queuedCount = queue.filter((j) => j.status === 'queued').length;

  // 학습계 배포 버전(#N)별 그룹 — 이력 최신순 유지.
  const deployGroups: { ver: string; items: Run[] }[] = [];
  runs.forEach((r) => {
    const g = deployGroups.find((x) => x.ver === r.deployVer);
    if (g) g.items.push(r);
    else deployGroups.push({ ver: r.deployVer, items: [r] });
  });
  const selectedGroup = deployGroups.find((g) => g.ver === selected.deployVer) ?? deployGroups[0];
  const WORKERS = 4;
  const THROUGHPUT = 12; // 평가/분
  const etaSec = Math.round(queueBacklog / (THROUGHPUT / 60));
  const mmss = (s: number) => `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;

  const runEval = () => {
    setRunning(true);
    setShowHistory(true);
    const start = new Date();
    const jobId = `q-${start.getTime()}`;
    const deployAt = deployed?.decidedAt ?? deployed?.draftedAt ?? fmt(start);
    const by = persona?.name ?? '정오너';
    // 큐에 내 잡을 실행 중(진행률 0)으로 등록. 완료는 라이브 틱이 처리.
    setQueue((cur) => [
      { id: jobId, setName: activeSet.name, deployAt, by, status: 'running', requestedAt: fmt(start), progress: 0, mine: true },
      ...cur,
    ]);
  };

  // 현재 배포된 학습계 버전 라벨 (#N).
  const deployedVer = `#${(deployed?.version ?? 'd1').replace(/\D/g, '')}`;

  // ── 라이브 큐 틱 — 실행 중 잡의 진행률을 올리고, 100%에서 완료→이력 이동, 대기 잡은 워커가 비면 실행 시작.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const latestRef = useRef(latest);
  latestRef.current = latest;
  // 내가 실행한 잡(mine)만 진행·완료. 시드 큐(다른 사용자 잡)는 스냅샷으로 고정 —
  // 탭 진입만으로 평가가 자동 실행되지 않는다.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const mineJob = queueRef.current.find((j) => j.mine && j.status === 'running');
      if (!mineJob) {
        setRunning(false);
        return;
      }
      const nextProg = Math.min(100, mineJob.progress + 14);
      if (nextProg < 100) {
        setQueue((cur) => cur.map((j) => (j.id === mineJob.id ? { ...j, progress: nextProg } : j)));
        return;
      }
      // 완료 → 이력 기록 후 큐에서 제거.
      const now = new Date();
      const newRun: Run = {
        id: `ev-${now.getTime()}`,
        at: fmt(now),
        deployAt: mineJob.deployAt,
        deployVer: deployedVer,
        by: mineJob.by,
        values: jitter(latestRef.current.values),
      };
      setRuns((cur) => [newRun, ...cur]);
      setSelectedId(newRun.id);
      setQueue((cur) => cur.filter((j) => j.id !== mineJob.id));
      setRunning(false);
    }, 600);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <section className="card shadow-sm mb-3.5 scroll-mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
          평가
          <span className="text-[11px] text-ink-mid font-semibold">
            실행 <b className="text-ink-dark">{runs.length}</b>회
          </span>
        </div>
      </div>

      <div className="px-[18px] py-[18px]">
        {/* 평가 큐 상태창 — 맨 위 */}
        <div className="border border-line-soft rounded-lg overflow-hidden mb-3">
          <div className="flex items-center justify-between py-2 px-3.5 border-b border-line-soft bg-surface-soft">
            <div className="flex items-center gap-2 text-[12px] font-extrabold text-ink">
              평가 큐
              <span className="text-[10.5px] font-semibold text-ink-mid">
                실행 중 <b className="text-info">{runningCount}</b> · 대기 <b className="text-ink-dark">{queuedCount}</b>
              </span>
            </div>
            {running && <span className="text-[10.5px] text-info font-bold animate-pulse">내 평가 실행 중…</span>}
          </div>

          {/* 큐/워커 헬스 */}
          <div className="border-b border-line-soft bg-surface-soft/60 p-3">
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <span className="w-2 h-2 rounded-full bg-ok animate-pulse" />
                <b className="text-[12px] text-ink">큐 처리 상황</b>
                <span className="text-[11px] text-ink-mid font-semibold tabular-nums">
                  큐 잔여 <b className="text-ink-dark">{queueBacklog}</b> · 처리 중 {runningCount} · 워커 {WORKERS}/{WORKERS} 활성 · 처리량 {THROUGHPUT}/분 · 예상 {mmss(etaSec)}
                </span>
              </div>
              <button
                onClick={() => setQueueBacklog((b) => Math.max(0, b - THROUGHPUT))}
                title="큐 상태만 새로고침"
                className="flex-shrink-0 h-6 px-1.5 bg-white border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
              >
                <span className="text-[11px]">↻</span> 새로고침
              </button>
            </div>
            <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden bg-surface border border-line-soft">
              <span className="bg-info" style={{ width: `${(runningCount / (queue.length || 1)) * 100}%` }} />
              <span className="bg-line" style={{ width: `${(queuedCount / (queue.length || 1)) * 100}%` }} />
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="py-6 text-center text-[11.5px] text-ink-light">대기 중인 평가가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {queue.map((job) => (
                <li key={job.id} className="flex items-center gap-2.5 py-2 px-3.5 text-[11.5px]">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 py-[2px] px-2 rounded-full border text-[10px] font-extrabold whitespace-nowrap',
                      job.status === 'running'
                        ? 'bg-info-bg text-info border-info-border'
                        : 'bg-surface-soft text-ink-mid border-line',
                    )}
                  >
                    {job.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-info" />}
                    {job.status === 'running' ? '실행 중' : '대기'}
                  </span>
                  <span className="text-ink-dark font-bold truncate">{job.setName}</span>
                  <span className="text-ink-light hidden sm:inline">·</span>
                  <span className="text-ink-mid font-semibold hidden sm:inline">학습계 배포 {job.deployAt}</span>
                  <span className="text-ink-light hidden md:inline">·</span>
                  <span className="text-ink-mid font-semibold hidden md:inline">{job.by}</span>
                  <span className="flex-1" />
                  {job.status === 'running' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[4px] w-[80px] bg-info-bg rounded-full overflow-hidden">
                        <span className="block h-full bg-info transition-all duration-500" style={{ width: `${job.progress}%` }} />
                      </span>
                      <span className="text-[10px] text-info font-bold tabular-nums w-8 text-right">{job.progress}%</span>
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-ink-light font-semibold">대기 중</span>
                  )}
                  <span className="text-[10.5px] text-ink-light font-semibold whitespace-nowrap tabular-nums">
                    {job.requestedAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 평가 대상 (현재 배포된 학습계 API) · 평가셋 */}
        <div className="border border-line-soft rounded-lg bg-white overflow-hidden mb-3">
          <div className="flex items-center gap-2.5 flex-wrap py-2.5 px-3.5 text-[12px] border-b border-line-soft">
            <span className="text-ink-mid font-semibold">대상</span>
            <span className="font-extrabold text-ink">{deployed?.apiName ?? '지식 검색 API'}</span>
            <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold">
              학습계
            </span>
            {deployed ? (
              <>
                <span className="text-ink-light">·</span>
                <span className="text-ink-mid font-semibold">학습계 버전</span>
                <span className="inline-flex items-center justify-center text-[10.5px] font-extrabold py-[1px] px-2 rounded-full border bg-kb-yellow-tint text-ink border-kb-yellow-dark">
                  {deployedVer}
                </span>
              </>
            ) : (
              <span className="text-[11px] font-bold text-warn">배포된 학습계 API 없음</span>
            )}
          </div>
          <div className="py-2.5 px-3.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">평가셋</span>
              <span className="flex-1" />
              <button
                onClick={() => setSetModalOpen(true)}
                className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface inline-flex items-center gap-1"
              >
                <span className="text-[12px]">⚙</span> 평가셋 관리
              </button>
              <button
                onClick={runEval}
                disabled={running || !deployed}
                title={!deployed ? '배포된 학습계 API가 없습니다' : '선택한 평가셋으로 현재 배포된 학습계 API 평가 실행'}
                className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {running ? '평가 중…' : '▶ 평가 실행'}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {sets.map((s) => {
                const on = s.id === activeSet.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSetId(s.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12px] font-bold transition-colors',
                      on
                        ? 'bg-kb-yellow-tint border-kb-yellow-dark text-ink'
                        : 'bg-white border-line text-ink-mid hover:border-kb-yellow-dark hover:bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'w-3.5 h-3.5 rounded-full border-2 inline-flex items-center justify-center flex-shrink-0',
                        on ? 'border-kb-yellow-dark bg-kb-yellow' : 'border-line',
                      )}
                    >
                      {on && <span className="w-1.5 h-1.5 rounded-full bg-ink" />}
                    </span>
                    <span className={cn(on ? 'font-extrabold text-ink' : 'font-bold')}>{s.name}</span>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center text-[10.5px] font-extrabold py-[1px] px-1.5 rounded-full',
                        on ? 'bg-white text-ink border border-kb-yellow-dark' : 'bg-surface-soft text-ink-mid border border-line-soft',
                      )}
                    >
                      {s.items.length}문항
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(
          <>
            {/* 학습계 버전별 성능 비교 표 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">
                학습계 버전별 성능
              </span>
              <span className="text-[10px] text-ink-light font-semibold">
                · 버전을 클릭하면 아래에 상세가 표시됩니다 · 종합은 각 버전 최신 평가 기준
              </span>
            </div>
            <div className="border border-line-soft rounded-lg overflow-x-auto mb-4">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                    <th className="text-left py-2 px-3 font-bold whitespace-nowrap">학습계 버전</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">평가</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">종합</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Recall@5</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">MRR</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">nDCG@10</th>
                    <th className="text-center py-2 px-3 font-bold whitespace-nowrap">최근 평가</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {deployGroups.map((g, gi) => {
                    const rep = g.items[0]; // 최신 평가
                    const cmp = compositeOf(rep.values);
                    const on = selected.deployVer === g.ver;
                    return (
                      <tr
                        key={g.ver}
                        onClick={() => setSelectedId(rep.id)}
                        className={cn('cursor-pointer hover:bg-surface', on && 'bg-kb-yellow-tint')}
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-ink-mid font-semibold">학습계</span>
                            <span className="inline-flex items-center justify-center text-[10.5px] font-extrabold py-[1px] px-2 rounded-full border bg-kb-yellow-tint text-ink border-kb-yellow-dark">
                              {g.ver}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-ink-mid tabular-nums">{g.items.length}회</td>
                        <td className="py-2 px-3 text-center tabular-nums font-extrabold text-ink">{cmp.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center tabular-nums text-ink-dark">{rep.values.recall5.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center tabular-nums text-ink-dark">{rep.values.mrr.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center tabular-nums text-ink-dark">{rep.values.ndcg.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center text-ink-mid whitespace-nowrap">{rep.at}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailId(rep.id);
                            }}
                            className="h-6 px-2 rounded border border-line bg-white text-[10.5px] font-bold text-info hover:bg-info-bg hover:border-info-border whitespace-nowrap"
                          >
                            상세 →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 선택 버전 상세 */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">선택 버전 상세</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-ink">
                <span className="text-ink-mid font-semibold">학습계</span>
                <span className="inline-flex items-center justify-center text-[10px] font-extrabold py-[1px] px-1.5 rounded-full border bg-kb-yellow-tint text-ink border-kb-yellow-dark">
                  {selected.deployVer}
                </span>
              </span>
              <span className="text-[10px] text-ink-light font-semibold">· 평가셋 {activeSet.name}</span>
            </div>

            {/* 종합 점수 배너 */}
            <div className="flex items-center gap-3 border border-kb-yellow-dark bg-kb-yellow-tint rounded-lg px-4 py-3 mb-3">
              <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">종합 점수</span>
              <span className="text-[26px] font-extrabold text-ink leading-none">{composite.toFixed(2)}</span>
            </div>

            {/* 검색 평가 (정답 라벨 기준) */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">
                검색 평가 (Retrieval)
              </span>
              <span className="text-[10px] text-ink-light font-semibold">
                · 정답 근거 구절(청크) 기반, 결정적·저비용 (LLM 미사용)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {METRICS.map((m) => (
                <MetricCard key={m.key} m={m} value={selected.values[m.key]} />
              ))}
            </div>

            {/* 문항별 결과 — 접기 (평가셋 전체) */}
            <div className="border border-line-soft rounded-lg overflow-hidden mb-2">
              <button
                onClick={() => setShowRows((s) => !s)}
                className="w-full flex items-center justify-between py-2 px-3.5 text-[11.5px] font-bold text-ink-dark hover:bg-surface"
              >
                <span>📄 문항별 결과 ({golden.length}문항 전체) · 근거 구절 청크 순위</span>
                <span className={cn('text-[10px] transition-transform', showRows && 'rotate-180')}>▾</span>
              </button>
              {showRows && (
                <div className="border-t border-line-soft">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                          <th className="text-left py-2 px-3 font-bold">질문</th>
                          <th className="text-left py-2 px-3 font-bold">정답 근거 구절</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">청크 순위</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">1/순위 (RR)</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Top-5</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {pageRows.map((r, i) => {
                          const hit = r.rank <= 5;
                          return (
                            <tr key={i} className="hover:bg-surface">
                              <td className="py-2 px-3 text-ink-dark font-semibold whitespace-nowrap">{r.q}</td>
                              <td className="py-2 px-3 text-ink-mid max-w-[260px] truncate" title={`${r.passage} · ${r.gold}`}>
                                {r.passage}
                              </td>
                              <td className="py-2 px-3 text-center tabular-nums">
                                <span className={cn('font-bold', r.rank <= 3 ? 'text-ink-dark' : 'text-warn')}>#{r.rank}</span>
                              </td>
                              <td className="py-2 px-3 text-center tabular-nums text-ink-dark">{(1 / r.rank).toFixed(2)}</td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={cn(
                                    'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold',
                                    hit ? 'bg-ok-bg text-ok border-ok-border' : 'bg-bad-bg text-bad border-bad-border',
                                  )}
                                >
                                  {hit ? '포함' : '미포함'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pager page={page} total={totalPages} onPage={setRowsPage} />
                </div>
              )}
            </div>

            {/* 이 버전의 평가 이력 — 접기 */}
            <div className="border border-line-soft rounded-lg overflow-hidden">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="w-full flex items-center justify-between py-2 px-3.5 text-[11.5px] font-bold text-ink-dark hover:bg-surface"
              >
                <span>📈 학습계 {selected.deployVer} 평가 이력 {selectedGroup.items.length}회</span>
                <span className={cn('text-[10px] transition-transform', showHistory && 'rotate-180')}>▾</span>
              </button>
              {showHistory && (
                <ul className="divide-y divide-line-soft border-t border-line-soft">
                  {selectedGroup.items.map((r, i) => (
                    <RunRow
                      key={r.id}
                      run={r}
                      composite={compositeOf(r.values)}
                      delta={selectedGroup.items[i + 1] ? Math.round((compositeOf(r.values) - compositeOf(selectedGroup.items[i + 1].values)) * 100) / 100 : null}
                      latest={r.id === latest.id}
                      selected={r.id === selected.id}
                      onSelect={() => setSelectedId(r.id)}
                      onDetail={() => setDetailId(r.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <EvalSetModal
        open={setModalOpen}
        onClose={() => setSetModalOpen(false)}
        sets={sets}
        activeId={activeSet.id}
        onChangeSets={setSets}
        onSelectActive={setActiveSetId}
      />

      {detailRun && (
        <RunDetailModal
          run={detailRun}
          prev={detailPrev}
          golden={golden}
          setName={activeSet.name}
          onClose={() => setDetailId(null)}
        />
      )}
    </section>
  );
}

/* ---------------- 평가 상세 모달 ---------------- */

function RunDetailModal({
  run,
  prev,
  golden,
  setName,
  onClose,
}: {
  run: Run;
  prev?: Run;
  golden: GoldenItem[];
  setName: string;
  onClose: () => void;
}) {
  const composite = compositeOf(run.values);
  const delta = prev ? Math.round((composite - compositeOf(prev.values)) * 100) / 100 : null;
  const rows = rowsFor(golden, run);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <ModalShell open onClose={onClose} size="lg" title="평가 상세" subtitle={`실행 ${run.at}`}>
      {/* 실행 정보 */}
      <div className="border border-line-soft rounded-lg overflow-hidden mb-3">
        <InfoRow k="실행 일시" v={run.at} />
        <InfoRow k="실행자" v={run.by} />
        <InfoRow k="대상 학습계 버전" v={`${run.deployVer} · 배포 ${run.deployAt}`} />
        <InfoRow k="평가셋" v={`${setName} · ${golden.length} 문항`} />
        <InfoRow k="채점 방식" v="정답 근거 구절(청크) 기준 · Recall@5 · MRR · nDCG@10 (LLM 미사용)" last />
      </div>

      {/* 종합 점수 */}
      <div className="flex items-center gap-4 border border-kb-yellow-dark bg-kb-yellow-tint rounded-lg px-4 py-3 mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">종합 점수</span>
          <span className="text-[26px] font-extrabold text-ink leading-none mt-0.5">{composite.toFixed(2)}</span>
        </div>
        {delta !== null && (
          <>
            <div className="h-9 w-px bg-kb-yellow-dark/40" />
            <div className="text-[11.5px] text-ink-dark font-semibold">
              직전 실행 대비{' '}
              <b className={delta >= 0 ? 'text-ok' : 'text-bad'}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(2)}
              </b>
              {prev && (
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                  이전 {compositeOf(prev.values).toFixed(2)} → {composite.toFixed(2)} (학습계 {prev.deployVer})
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 지표 */}
      <div className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-1.5">검색 평가 (Retrieval)</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {METRICS.map((m) => (
          <MetricCard key={m.key} m={m} value={run.values[m.key]} />
        ))}
      </div>

      {/* 문항별 결과 (평가셋 전체) */}
      <div className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-1.5">
        문항별 결과 ({rows.length}문항 전체)
      </div>
      <div className="border border-line-soft rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold">질문</th>
                <th className="text-left py-2 px-3 font-bold">정답 근거 구절</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">청크 순위</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">1/순위 (RR)</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">Top-5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {pageRows.map((r, i) => {
                const hit = r.rank <= 5;
                return (
                  <tr key={i} className="hover:bg-surface">
                    <td className="py-2 px-3 text-ink-dark font-semibold whitespace-nowrap">{r.q}</td>
                    <td className="py-2 px-3 text-ink-mid max-w-[300px] truncate" title={`${r.passage} · ${r.gold}`}>
                      {r.passage}
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums">
                      <span className={cn('font-bold', r.rank <= 3 ? 'text-ink-dark' : 'text-warn')}>#{r.rank}</span>
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums text-ink-dark">{(1 / r.rank).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold',
                          hit ? 'bg-ok-bg text-ok border-ok-border' : 'bg-bad-bg text-bad border-bad-border',
                        )}
                      >
                        {hit ? '포함' : '미포함'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={safePage} total={totalPages} onPage={setPage} />
      </div>
    </ModalShell>
  );
}

function RunRow({
  run,
  composite,
  delta,
  latest,
  selected,
  showDeploy,
  version,
  onSelect,
  onDetail,
}: {
  run: Run;
  composite: number;
  delta: number | null;
  latest: boolean;
  selected: boolean;
  showDeploy?: boolean;
  version?: string;
  onSelect: () => void;
  onDetail: () => void;
}) {
  return (
    <li className={cn('flex items-center', selected && 'bg-kb-yellow-tint')}>
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-3 py-2 pl-3.5 pr-2 text-[11.5px] text-left hover:bg-surface"
      >
        <span className="font-bold text-ink-dark whitespace-nowrap">{run.at}</span>
        {showDeploy && version && (
          <>
            <span className="text-ink-light">·</span>
            <span className="text-ink-mid font-semibold">학습계</span>
            <span className="font-extrabold text-ink">{version}</span>
          </>
        )}
        <span className="text-ink-light hidden sm:inline">·</span>
        <span className="text-ink-mid font-semibold hidden sm:inline">{run.by}</span>
        <span className="flex-1" />
        {delta !== null && (
          <span className={cn('text-[10.5px] font-bold tabular-nums', delta >= 0 ? 'text-ok' : 'text-bad')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
          </span>
        )}
        <span className="text-ink-mid font-semibold">종합</span>
        <span className="font-extrabold text-ink tabular-nums w-9 text-right">{composite.toFixed(2)}</span>
      </button>
      <button
        onClick={onDetail}
        className="mr-2 h-6 px-2 rounded border border-line bg-white text-[10.5px] font-bold text-info hover:bg-info-bg hover:border-info-border whitespace-nowrap"
      >
        상세 →
      </button>
    </li>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total <= 1) return null;
  const btn = 'h-6 px-2 rounded border text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center justify-center gap-3 py-2 border-t border-line-soft">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className={cn(btn, 'border-line bg-white text-ink-dark hover:bg-surface')}
      >
        ‹ 이전
      </button>
      <span className="text-[11px] text-ink-mid font-semibold tabular-nums">
        {page + 1} / {total}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= total - 1}
        className={cn(btn, 'border-line bg-white text-ink-dark hover:bg-surface')}
      >
        다음 ›
      </button>
    </div>
  );
}

function InfoRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 py-2 px-3.5 text-[12px]', !last && 'border-b border-line-soft')}>
      <span className="text-ink-mid font-semibold w-[110px] flex-shrink-0">{k}</span>
      <span className="text-ink-dark font-bold">{v}</span>
    </div>
  );
}

/* ---------------- Metric card ---------------- */

function MetricCard({ m, value }: { m: MetricMeta; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="border border-line-soft rounded-lg bg-white px-3 py-2.5" title={m.desc}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-ink-dark truncate">{m.label}</span>
        <span className="text-[15px] font-extrabold tabular-nums text-ink">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-surface-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-kb-yellow-dark" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
