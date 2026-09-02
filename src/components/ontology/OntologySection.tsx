/**
 * 온톨로지 탭 — 지식 데이터 과제 상세.
 *
 * RFP: RAG-007 Graph RAG(필수) · RAG-008 온톨로지 플랫폼 연계(권고·가점)
 *      EDA-001 물리적 데이터 이동 없이 (정형=zero-copy 가상 뷰 매핑)
 *
 * 하위 3탭 — 그래프 설계 / 데이터 매핑 / Query.
 * Query 가 시연의 클라이맥스다(핸드오프 화면 4).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import OntologyGraph from './OntologyGraph';
import OntologyEditor from './OntologyEditor';
import TriplePanel, { type Highlight, type TripleDraft } from './TriplePanel';
import { AutoMapPane, MaterializePane, DiagnosticsPane } from './MappingTools';
import { useOntology, mergeClasses } from '@/lib/ontologyStore';
import {
  CLASSES,
  RELATIONS,
  CLASS_COUNT,
  ATTR_COUNT,
  RELATION_COUNT,
  HUB_CLASSES,
  classByName,
} from '@/data/ontology';
import { COVERAGE, MAPPING_ROWS, SOURCE_LABEL, SOURCE_TONE, type MappingKind, type MappingSource } from '@/data/ontologyMapping';
import { SCENARIOS, EXTRA_QUESTIONS, type QueryScenario, type StepKind } from '@/data/ontologyQueries';
import { INSTANCE_COUNT as ABOX_COUNT, instById, type Instance } from '@/data/ontologyInstances';

type SubTab = 'overview' | 'graph' | 'mapping' | 'automap' | 'materialize' | 'diag' | 'query';

export default function OntologySection() {
  const [sub, setSub] = useState<SubTab>('query');

  return (
    <div className="card">
      {/* 하위 탭 */}
      <div className="px-5 pt-1 border-b border-line-soft flex items-center gap-1">
        <SubTabBtn on={sub === 'overview'} onClick={() => setSub('overview')}>
          개요
        </SubTabBtn>
        <SubTabBtn on={sub === 'graph'} onClick={() => setSub('graph')}>
          그래프 설계
        </SubTabBtn>
        <SubTabBtn on={sub === 'mapping'} onClick={() => setSub('mapping')}>
          데이터 매핑
        </SubTabBtn>
        <SubTabBtn on={sub === 'automap'} onClick={() => setSub('automap')}>
          Auto-Map
        </SubTabBtn>
        <SubTabBtn on={sub === 'materialize'} onClick={() => setSub('materialize')}>
          Materialize
        </SubTabBtn>
        <SubTabBtn on={sub === 'diag'} onClick={() => setSub('diag')}>
          진단
        </SubTabBtn>
        <SubTabBtn on={sub === 'query'} onClick={() => setSub('query')}>
          Query
        </SubTabBtn>
      </div>

      {sub === 'overview' && <OverviewPane onGo={setSub} />}
      {sub === 'graph' && <GraphDesign />}
      {sub === 'mapping' && <MappingView />}
      {sub === 'automap' && <AutoMapPane />}
      {sub === 'materialize' && <MaterializePane />}
      {sub === 'diag' && <DiagnosticsPane />}
      {sub === 'query' && <QueryView />}
    </div>
  );
}

function SubTabBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-[12.5px] border-b-2 -mb-px transition-colors',
        on
          ? 'border-brand text-brand font-extrabold'
          : 'border-transparent text-ink-mid font-semibold hover:text-ink-dark',
      )}
    >
      {children}
    </button>
  );
}

/* ══════════════════════ 구축 단계 ══════════════════════ */

/** 단계 아이콘 — 이모지 대신 단색 글리프. 발표 화면에서 톤이 흐트러지지 않는다. */
function StageIcon({ kind }: { kind: 'onto' | 'rel' | 'map' | 'inst' }) {
  const c = 'currentColor';
  return (
    <svg width="18" height="18" viewBox="-11 -11 22 22" fill="none" className="text-brand flex-shrink-0">
      {kind === 'onto' && <path d="M0,-8.5 L7.4,-4.25 L7.4,4.25 L0,8.5 L-7.4,4.25 L-7.4,-4.25 Z" fill={c} fillOpacity={0.16} stroke={c} strokeWidth={1.5} />}
      {kind === 'rel' && (
        <g stroke={c} strokeWidth={1.4}>
          <path d="M-6,-5 L5,1 M-6,-5 L-2,7 M5,1 L-2,7" />
          <circle cx={-6} cy={-5} r={2.6} fill={c} fillOpacity={0.2} />
          <circle cx={5} cy={1} r={2.6} fill={c} fillOpacity={0.2} />
          <circle cx={-2} cy={7} r={2.6} fill={c} fillOpacity={0.2} />
        </g>
      )}
      {kind === 'map' && (
        <g stroke={c} strokeWidth={1.6} strokeLinecap="round">
          <path d="M-1.5,-3.5 L-5,0 a3.6,3.6 0 0 0 5,5 L1.5,3" />
          <path d="M1.5,3.5 L5,0 a3.6,3.6 0 0 0 -5,-5 L-1.5,-3" />
        </g>
      )}
      {kind === 'inst' && (
        <g stroke={c} strokeWidth={1.4} strokeLinejoin="round">
          <path d="M0,-8 L7.5,-4 L7.5,4 L0,8 L-7.5,4 L-7.5,-4 Z" fill={c} fillOpacity={0.14} />
          <path d="M-7.5,-4 L0,0 L7.5,-4 M0,0 L0,8" />
        </g>
      )}
    </svg>
  );
}

function BuildStages({ onGo }: { onGo: (t: SubTab) => void }) {
  const { classes, relations } = useOntology();
  const attrs = classes.reduce((a, c) => a + c.attrs.length, 0);
  const stages = [
    { icon: 'onto' as const, n: `${classes.length}`, unit: '클래스', extra: `${attrs} 속성`, sub: '온톨로지 생성', go: 'graph' as SubTab },
    { icon: 'rel' as const, n: `${relations.length}`, unit: '관계', sub: '구조 점검', go: 'graph' as SubTab },
    { icon: 'map' as const, n: `${MAPPING_ROWS.filter((r) => r.status !== 'none').length}`, unit: '매핑', sub: 'DB·문서 매핑', go: 'mapping' as SubTab },
    { icon: 'inst' as const, n: `${ABOX_COUNT}`, unit: '인스턴스', sub: '실체화', go: 'materialize' as SubTab },
  ];
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12.5px] font-extrabold text-ink">구축 단계</span>
        <span className="text-[10.5px] text-ink-light font-semibold">클릭하면 해당 화면으로 이동</span>
        <span className="text-[10.5px] text-ink-mid font-semibold ml-1.5 pl-1.5 border-l border-line-soft">
          여신심사 + 전결권 도메인 · 정형DB는 가상 뷰(zero-copy), 규정은 문서 실체화
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        {stages.map((s, i) => (
          <div key={s.sub} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onGo(s.go)}
              className="flex-1 min-w-0 flex items-center gap-2.5 border border-brand-tint bg-brand-bg rounded px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-tint"
            >
              <StageIcon kind={s.icon} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-[19px] font-extrabold text-ink tabular-nums leading-none">{s.n}</span>
                  <span className="text-[10.5px] font-bold text-ink-mid">{s.unit}</span>
                  {s.extra && (
                    <>
                      <span className="text-[10.5px] text-ink-light">·</span>
                      <span className="text-[13px] font-extrabold text-ink-dark tabular-nums leading-none">{s.extra.split(' ')[0]}</span>
                      <span className="text-[10.5px] font-bold text-ink-mid">속성</span>
                    </>
                  )}
                </span>
                <span className="block text-[10.5px] text-ink-mid font-semibold mt-1">{s.sub}</span>
              </span>
              {/* 완료 배지 — 4단계 모두 산출물이 있는 상태다 */}
              <svg width="17" height="17" viewBox="0 0 17 17" className="flex-shrink-0 text-ok">
                <circle cx="8.5" cy="8.5" r="8.5" fill="currentColor" />
                <path d="M4.7 8.7 L7.3 11.2 L12.2 5.9" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {i < stages.length - 1 && <span className="text-ink-light text-[13px] flex-shrink-0">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ 개요 ══════════════════════ */
// RFP: RAG-008 온톨로지 연계(권고·가점) · EDA-001 물리적 데이터 이동 없이
// 매핑 커버리지를 있는 그대로 보여준다. 100%가 아닌 것이 핵심 —
// 미매핑分을 감추면 데모가 곧 확약이 되는 RFP Ⅳ.6.7 리스크로 돌아온다.

const SRC_HEX: Record<MappingSource, string> = {
  auto: '#1B8A4D',
  manual: '#1F5BB8',
  document: '#6E3BBD',
  none: '#E0E0E1',
};
/** 도넛 안에서는 '문서 실체화'가 길어 잘린다 — 짧은 표기를 따로 둔다. */
const SRC_SHORT: Record<MappingSource, string> = { auto: '자동', manual: '수동', document: '문서', none: '미매핑' };

function Donut({ pct }: { pct: number }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[108px] h-[108px] flex-shrink-0">
      <svg viewBox="-54 -54 108 108" className="w-full h-full -rotate-90">
        <circle r={R} fill="none" stroke="#EFEFEF" strokeWidth={11} />
        <motion.circle
          r={R}
          fill="none"
          stroke="#CB2C10"
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[21px] font-extrabold text-ink tabular-nums">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

function OverviewPane({ onGo }: { onGo: (t: SubTab) => void }) {
  const totalMapped = COVERAGE.reduce((a, c) => a + c.mapped, 0);
  const totalAll = COVERAGE.reduce((a, c) => a + c.total, 0);
  // 커버리지가 가장 낮은 축을 데이터에서 뽑는다. 문장에 박아두면
  // mock 을 손볼 때마다 화면이 거짓말을 하게 된다.
  const worst = [...COVERAGE].sort((a, b) => a.mapped / a.total - b.mapped / b.total)[0];
  const worstNone = worst.breakdown.find((b) => b.status === 'none')?.count ?? 0;

  return (
    <div className="p-5 space-y-4">
      {/* 구축 단계 — 파이프라인 요약. 카드를 누르면 해당 화면으로 간다. */}
      <BuildStages onGo={onGo} />

      {/* 매핑 현황 */}
      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[12.5px] font-extrabold text-ink">매핑 현황</span>
          <span className="text-[10.5px] text-ink-mid font-semibold">
            전체 {totalAll}개 중 <b className="text-brand">{totalMapped}개</b> 매핑 · 미매핑分은 감추지 않고 그대로 노출한다
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {COVERAGE.map((c) => (
            <div key={c.label} className="border border-line-soft rounded bg-white p-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-extrabold text-ink">{c.label}</span>
                <span className="text-[10px] font-bold text-ink-light tracking-wide">{c.sub}</span>
              </div>
              <div className="flex items-center gap-3.5 mt-3">
                <Donut pct={c.total ? c.mapped / c.total : 0} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[24px] font-extrabold text-ink tabular-nums leading-none">{c.mapped}</span>
                    <span className="text-[15px] font-extrabold text-ink-light tabular-nums leading-none">/ {c.total}</span>
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-1.5 leading-relaxed">
                    전체 {c.total}개 중
                    <br />
                    {c.mapped}개 매핑됨
                  </div>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-line-soft space-y-2">
                {c.breakdown.map((b) => (
                  <div key={b.status} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SRC_HEX[b.status] }} />
                    <span className="text-[10.5px] font-bold text-ink-dark w-[30px] flex-shrink-0">{SRC_SHORT[b.status]}</span>
                    <span className="flex-1 h-[7px] rounded-full bg-surface overflow-hidden">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ background: SRC_HEX[b.status] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.total ? (b.count / c.total) * 100 : 0}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </span>
                    <span className="text-[11px] font-extrabold text-ink tabular-nums w-[26px] text-right flex-shrink-0">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 매핑 승인 구성 */}
      <div className="border border-line-soft rounded bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12.5px] font-extrabold text-ink">매핑 승인 구성</span>
          <div className="flex items-center gap-3">
            {(['auto', 'manual', 'document', 'none'] as MappingSource[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-ink-mid">
                <span className="w-2 h-2 rounded-sm" style={{ background: SRC_HEX[k], border: k === 'none' ? '1px solid #C9C9CA' : undefined }} />
                {SOURCE_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2.5">
          {COVERAGE.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5">
              <span className="text-[11px] font-extrabold text-ink-dark w-[38px] flex-shrink-0">{c.label}</span>
              <span className="flex-1 flex h-[22px] rounded overflow-hidden bg-surface">
                {c.breakdown.map((b) =>
                  b.count ? (
                    <motion.span
                      key={b.status}
                      className="flex items-center justify-center text-[10px] font-extrabold tabular-nums"
                      style={{ background: SRC_HEX[b.status], color: b.status === 'none' ? '#999999' : '#fff' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(b.count / c.total) * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      title={`${SOURCE_LABEL[b.status]} ${b.count}개`}
                    >
                      {b.count / c.total > 0.05 ? b.count : ''}
                    </motion.span>
                  ) : null,
                )}
              </span>
              <span className="text-[10.5px] font-semibold text-ink-mid tabular-nums w-[78px] text-right flex-shrink-0 whitespace-nowrap">
                {c.mapped} / {c.total} 매핑
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2">
          <span className="text-[10.5px] text-ink-mid font-semibold flex-1">
            커버리지가 가장 낮은 축은 <b className="text-ink-dark">{worst.label}({worst.sub})</b>로, 미매핑 {worstNone}건이 남아 있다 —
            Auto-Map 이 임계값 아래로 판단해 자동 승인하지 않은 항목이며 수동 승인 대상이다.
          </span>
          <button
            type="button"
            onClick={() => onGo('automap')}
            className="h-7 px-2.5 flex-shrink-0 border border-line rounded text-[11px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
          >
            Auto-Map 보기 →
          </button>
          <button
            type="button"
            onClick={() => onGo('diag')}
            className="h-7 px-2.5 flex-shrink-0 border border-line rounded text-[11px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
          >
            진단 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ 그래프 설계 ══════════════════════ */

function GraphDesign() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showAttrs, setShowAttrs] = useState(true);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [draft, setDraft] = useState<TripleDraft>(null);
  const { classes, relations } = useOntology();

  const askMerge = (src: string, dst: string) => {
    if (window.confirm(`'${src}' 를 '${dst}' 에 병합할까요?\n속성이 합쳐지고 관계 끝점이 옮겨집니다.`)) {
      mergeClasses(src, dst);
      if (selected === src) setSelected(dst);
    }
  };

  // 그래프 노드 ＋ 클릭 — 그 클래스를 열고 속성 추가 폼을 편다.
  const addFrom = (cls: string) => {
    setSelected(cls);
    setDraft({ kind: 'attr', cls });
  };
  // ＋ 를 다른 노드로 끌어다 놓음 — 출발·도착이 채워진 관계 폼을 편다.
  const linkTo = (domain: string, range: string) => {
    setSelected(domain);
    setDraft({ kind: 'rel', domain, range });
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="text-[11.5px] text-ink-mid font-semibold">
          <b className="text-ink">{classes.length}</b> classes · <b className="text-ink">{relations.length}</b> relationships
          <span className="mx-1.5 text-ink-light">·</span>
          호버=관계 강조 · 클릭=속성·관계 패널 · 노드 <b className="text-ink-dark">＋</b>=추가(드래그=관계 연결) ·
          <b className="text-ink-dark"> 겹쳐 놓으면 병합</b> · Space+드래그=화면 이동 · ⌘/Ctrl+휠=줌
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-dark cursor-pointer">
          <input type="checkbox" checked={showAttrs} onChange={(e) => setShowAttrs(e.target.checked)} />
          속성 표시
        </label>
      </div>

      {selected && (
        <TriplePanel
          selected={selected}
          draft={draft}
          onDraft={setDraft}
          onHighlight={setHighlight}
          onClose={() => {
            setSelected(null);
            setDraft(null);
            setHighlight(null);
          }}
          onSelect={setSelected}
        />
      )}

      <div className="grid grid-cols-[1fr_300px] gap-3">
        <div className="border border-line-soft rounded bg-surface-soft h-[440px] overflow-hidden">
          <OntologyGraph
            showAttrs={showAttrs}
            onSelectClass={setSelected}
            selectedClass={selected}
            onMergeAsk={askMerge}
            onAddFrom={addFrom}
            onLinkTo={linkTo}
            highlight={highlight}
          />
        </div>
        <OntologyEditor selected={selected} onSelect={setSelected} />
      </div>
    </div>
  );
}

/* ══════════════════════ 데이터 매핑 ══════════════════════ */

function MappingView() {
  const [kind, setKind] = useState<MappingKind | 'all'>('all');
  const rows = MAPPING_ROWS.filter((r) => kind === 'all' || r.kind === kind);
  const mapped = MAPPING_ROWS.filter((r) => r.status !== 'none').length;

  return (
    <div className="p-5">
      {/* 커버리지 3종 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {COVERAGE.map((c) => {
          const pct = Math.round((c.mapped / c.total) * 100);
          return (
            <div key={c.label} className="border border-line-soft rounded p-3.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[12.5px] font-extrabold text-ink">{c.label}</span>
                <span className="text-[9.5px] font-bold text-ink-light uppercase tracking-[0.3px]">{c.sub}</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[24px] font-extrabold text-ink tabular-nums">{pct}%</span>
                <span className="text-[11.5px] font-bold text-ink-mid tabular-nums">
                  {c.mapped} / {c.total}
                </span>
              </div>
              <div className="h-1.5 bg-line-soft rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 space-y-0.5">
                {c.breakdown
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <div key={b.status} className="flex items-center justify-between text-[10.5px]">
                      <span className="text-ink-mid font-semibold">{SOURCE_LABEL[b.status]}</span>
                      <span className="text-ink-dark font-extrabold tabular-nums">{b.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11.5px] font-bold text-ink-dark">
          {mapped} / {MAPPING_ROWS.length} 커버됨
        </span>
        <span className="text-[10.5px] text-ink-mid font-semibold">
          — 정형은 데이터 가상화 뷰로 연결(물리 이동 없음), 규정은 문서에서 실체화
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(['all', '클래스', '속성', '관계'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-extrabold border',
                kind === k
                  ? 'bg-brand text-white border-brand-dark'
                  : 'bg-white text-ink-mid border-line hover:border-brand-dark',
              )}
            >
              {k === 'all' ? '전체' : k}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line-soft rounded overflow-hidden">
        <div className="max-h-[230px] overflow-y-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-surface-soft sticky top-0 z-10">
              <tr className="text-ink-mid">
                <th className="text-left font-bold py-2 px-3 w-[70px]">종류</th>
                <th className="text-left font-bold py-2 px-3">온톨로지 대상</th>
                <th className="text-left font-bold py-2 px-3 w-[300px]">소스 매핑</th>
                <th className="text-left font-bold py-2 px-3 w-[120px]">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.uri} className="border-t border-line-soft">
                  <td className="py-1.5 px-3">
                    <span className="pill bg-surface text-ink-mid border border-line-soft">{r.kind}</span>
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="font-extrabold text-ink">{r.target}</div>
                    <div className="text-[10px] font-mono text-ink-light">{r.uri}</div>
                  </td>
                  <td className="py-1.5 px-3 font-mono text-[10.5px] text-ink-dark">
                    {r.source ?? <span className="text-ink-light">— 매핑 없음 —</span>}
                  </td>
                  <td className="py-1.5 px-3">
                    <span className={cn('pill border', SOURCE_TONE[r.status])}>
                      {SOURCE_LABEL[r.status]}
                      {r.confidence != null && ` · ${r.confidence.toFixed(2)}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ Query ══════════════════════ */

const STEP_TONE: Record<StepKind, { label: string; cls: string }> = {
  plan: { label: '계획', cls: 'bg-surface text-ink-mid border-line-soft' },
  anchor: { label: '앵커링', cls: 'bg-brand-tint text-brand border-brand-tint' },
  traverse: { label: '그래프 순회', cls: 'bg-info-bg text-info border-info-border' },
  sql: { label: 'SQL 투사', cls: 'bg-ok-bg text-ok border-ok-border' },
  doc: { label: '문서 조항', cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border' },
  compute: { label: '규칙 계산', cls: 'bg-warn-bg text-warn border-warn-border' },
};

function QueryView() {
  const [scenario, setScenario] = useState<QueryScenario>(SCENARIOS[0]);
  const [shown, setShown] = useState(0); // 표시된 스텝 수
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /**
   * 우측 「추론 과정」 패널 접기.
   * 그래프를 크게 보고 싶을 때 접는다. 실행하면 다시 편다 — 추론이 흐르는데
   * 패널이 접혀 있으면 "확정 결과" 서사가 화면에 없다.
   */
  const [traceOpen, setTraceOpen] = useState(true);

  const run = useCallback(() => {
    clearTimers();
    setShown(0);
    setRunning(true);
    setTraceOpen(true);
    scenario.steps.forEach((_, i) => {
      const t = window.setTimeout(() => {
        setShown(i + 1);
        if (i === scenario.steps.length - 1) setRunning(false);
      }, 700 * (i + 1));
      timers.current.push(t);
    });
  }, [scenario, clearTimers]);

  const reset = (s: QueryScenario) => {
    clearTimers();
    setScenario(s);
    setShown(0);
    setRunning(false);
  };

  // 현재까지 점등된 클래스·관계 누적
  const lit = scenario.steps.slice(0, shown);
  const activeClasses = [...new Set(lit.flatMap((s) => s.lightClasses ?? []))];
  const activeRelations = [...new Set(lit.flatMap((s) => s.lightRelations ?? []))];
  const done = shown >= scenario.steps.length;

  // 시나리오 전체 스텝 — 실행 전에도 이 레이아웃으로 컬럼이 미리 선다.
  const allSteps = useMemo(
    () => scenario.steps.map((s) => s.lightInstances ?? []).filter((a) => a.length),
    [scenario],
  );
  // 지금까지 점등된 컬럼 수 — allSteps 기준으로 환산
  const litCount = useMemo(() => {
    let n = 0;
    for (const st of scenario.steps.slice(0, shown)) if ((st.lightInstances ?? []).length) n += 1;
    return n;
  }, [shown, scenario]);
  const activeInstances = useMemo(() => allSteps.slice(0, litCount).flat(), [allSteps, litCount]);
  // 시나리오 드롭다운 — 네이티브 select 는 OS 스타일이라 톤을 못 입힌다.
  const [qOpen, setQOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!qOpen) return;
    const away = (e: MouseEvent) => {
      if (!ddRef.current?.contains(e.target as Node)) setQOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setQOpen(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [qOpen]);

  const [picked, setPicked] = useState<Instance | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(null);
  useEffect(() => {
    setPicked(null);
    setOpenStep(null);
  }, [scenario]);

  return (
    <div className="p-5">
      {/* 질의 입력 줄 — 아래 본문 그리드와 같은 컬럼(1fr / 400px)이라
           시나리오 선택 묶음이 '추론 과정' 패널과 정확히 폭을 맞춘다. */}
      <div className="grid grid-cols-[1fr_400px] gap-3 mb-3">
        <div className="flex items-center gap-2 border border-brand rounded px-3 h-[38px] bg-white">
          <span className="text-ink-mid text-[13px]">🔍</span>
          <span className="text-[12.5px] font-semibold text-ink truncate">{scenario.question}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0" ref={ddRef}>
            <button
              type="button"
              onClick={() => setQOpen((o) => !o)}
              className={cn(
                'w-full h-[38px] flex items-center gap-2 border rounded pl-2 pr-2.5 bg-white text-left transition-colors',
                qOpen ? 'border-brand' : 'border-line hover:border-brand',
              )}
            >
              <span className="pill bg-brand-tint text-brand border border-brand-tint flex-shrink-0">{scenario.tag}</span>
              <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-ink-dark">{scenario.question}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" className={cn('flex-shrink-0 transition-transform', qOpen && 'rotate-180')}>
                <path d="M1 3.2 L5 7 L9 3.2" fill="none" stroke="#666666" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {qOpen && (
              <div className="absolute right-0 top-[42px] z-30 w-[600px] bg-white border border-line rounded shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-line-soft bg-surface text-[10px] font-extrabold text-ink-mid">
                  시연 시나리오 <span className="text-brand">{SCENARIOS.length}</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto py-1">
                  {SCENARIOS.map((sc) => {
                    const cur = sc.id === scenario.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          setQOpen(false);
                          if (!cur) reset(sc);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-left',
                          cur ? 'bg-brand-bg' : 'hover:bg-surface',
                        )}
                      >
                        <span className="pill bg-brand-tint text-brand border border-brand-tint flex-shrink-0">{sc.tag}</span>
                        <span className={cn('flex-1 min-w-0 text-[11.5px] whitespace-nowrap truncate', cur ? 'font-extrabold text-ink' : 'font-semibold text-ink-dark')}>
                          {sc.question}
                        </span>
                        {cur && <span className="text-brand text-[11px] font-extrabold flex-shrink-0">✓</span>}
                      </button>
                    );
                  })}

                  <div className="mt-1 pt-1.5 border-t border-line-soft px-3 pb-1 text-[9.5px] font-extrabold text-ink-light">
                    준비 중 · 동일 온톨로지로 확장 가능한 질의
                  </div>
                  {EXTRA_QUESTIONS.map((q) => (
                    <div key={q} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-ink-light font-semibold">
                      <span className="w-1 h-1 rounded-full bg-line flex-shrink-0" />
                      <span className="flex-1 min-w-0 whitespace-nowrap truncate">{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={run}
            disabled={running}
            className="h-[38px] px-4 flex-shrink-0 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {running ? '실행 중…' : '▶ 실행'}
          </button>
        </div>
      </div>

      <div className={traceOpen ? 'grid grid-cols-[1fr_400px] gap-3' : 'grid grid-cols-[1fr_44px] gap-3'}>
        {/* 좌: 그래프 순회 */}
        <div>
          <div className="text-[10.5px] text-ink-mid font-semibold mb-1.5 flex items-center gap-2">
            <span>온톨로지 순회 — 앵커부터 관계를 타고 hop 순서로 펼쳐집니다</span>
            {shown > 0 && (
              <span className="pill bg-brand-tint text-brand border border-brand-tint">
                {activeClasses.length} 클래스 · {activeInstances.length} 개체 · {activeRelations.length} 관계
              </span>
            )}
            {running && (
              <span className="inline-flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-brand"
                    style={{ animation: 'ogDot 1.1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
          </div>
          <div className="relative border border-line-soft rounded bg-surface-soft h-[470px] overflow-hidden">
            {picked && (
              <div className="og-answer absolute left-2 top-2 z-10 w-[260px] bg-white border border-brand rounded shadow-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-extrabold text-ink truncate">{picked.label}</div>
                    <div className="text-[10px] font-semibold text-brand mt-0.5">{picked.cls}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="text-ink-light hover:text-ink text-[13px] leading-none"
                    title="닫기"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 border-t border-line-soft pt-2 space-y-1 max-h-[230px] overflow-y-auto">
                  {Object.entries(picked.props).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 text-[10.5px]">
                      <span className="text-ink-mid font-semibold w-[74px] flex-shrink-0">{k}</span>
                      <span className="text-ink-dark font-extrabold min-w-0 break-words">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-line-soft pt-1.5">
                  <div className="text-[9.5px] text-ink-mid font-semibold">출처</div>
                  <div className="text-[10px] font-mono text-ink-dark break-all">{picked.origin}</div>
                </div>
              </div>
            )}
            <OntologyGraph
              activeClasses={activeClasses}
              activeRelations={activeRelations}
              allSteps={allSteps}
              litCount={litCount}
              travEdges={scenario.travEdges}
              anchorInst={scenario.anchorInst}
              running={running}
              showAttrs
              onSelectInstance={setPicked}
              selectedInstance={picked?.id ?? null}
            />
          </div>
        </div>

        {/* 우: 추론 과정 */}
        {!traceOpen ? (
          <button
            type="button"
            onClick={() => setTraceOpen(true)}
            title="추론 과정 펼치기"
            className="border border-line-soft rounded bg-brand-bg h-[494px] flex flex-col items-center gap-2 pt-3 hover:bg-brand-tint"
          >
            <span className="text-[12px] font-extrabold text-ink">◀</span>
            <span
              className="text-[11px] font-extrabold text-ink tracking-wider"
              style={{ writingMode: 'vertical-rl' }}
            >
              추론 과정{shown > 0 ? ` · ${shown}단계` : ''}
            </span>
          </button>
        ) : (
        <div className="border border-line-soft rounded bg-white h-[494px] overflow-y-auto">
          {/* z-20 — 스텝 뱃지·필이 뒤따르는 형제라 z 없으면 헤더 위로 올라온다 */}
          <div className="px-3.5 py-2.5 border-b border-line-soft bg-brand-bg sticky top-0 z-20">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11.5px] font-extrabold text-ink">추론 과정</div>
              <button
                type="button"
                onClick={() => setTraceOpen(false)}
                title="추론 과정 접기 — 그래프를 넓게 봅니다"
                className="text-[11px] font-bold text-ink-mid hover:text-ink px-1.5 py-0.5 rounded hover:bg-white"
              >
                접기 ▶
              </button>
            </div>
            <div className="text-[10.5px] text-ink-dark font-semibold mt-0.5 leading-relaxed">
              🔒 LLM은 <b>질의문만</b> 작성합니다. 값·판정은 <b>그래프에서 실행한 확정 결과</b>입니다.
            </div>
          </div>

          {shown === 0 ? (
            <div className="text-[11.5px] text-ink-mid font-semibold text-center pt-20 leading-relaxed">
              질문을 실행하면
              <br />
              추론 과정과 답변이
              <br />
              여기에 표시됩니다
            </div>
          ) : (
            <div className="p-3.5 space-y-3">
              {lit.map((s, i) => {
                const tone = STEP_TONE[s.kind];
                const open = openStep === i;
                return (
                  <div key={i} className="flex gap-2.5 og-step">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="w-5 h-5 rounded-full bg-brand text-white text-[9.5px] font-extrabold inline-flex items-center justify-center">
                        {i + 1}
                      </span>
                      {i < lit.length - 1 && <span className="w-px flex-1 bg-line-soft mt-1" />}
                    </div>
                    <div className="min-w-0 pb-1">
                      <span className={cn('pill border', tone.cls)}>{tone.label}</span>
                      <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed mt-1">{s.text}</p>
                      {s.query && (
                        <button
                          type="button"
                          onClick={() => setOpenStep(open ? null : i)}
                          className="w-full text-left mt-1.5 px-2 py-1.5 bg-surface border border-line-soft rounded text-[10.5px] font-mono text-ink break-all hover:border-brand"
                          title={s.sparql ? '클릭하면 실제 질의문이 열립니다' : undefined}
                        >
                          {s.query}
                          {s.sparql && <span className="ml-1.5 text-brand font-sans font-extrabold">{open ? '▲ 닫기' : '▼ 질의문'}</span>}
                        </button>
                      )}
                      {open && s.sparql && (
                        <div className="og-answer mt-1.5 border border-brand-tint rounded overflow-hidden">
                          <div className="flex items-center justify-between px-2 py-1 bg-brand-bg">
                            <span className="text-[9.5px] font-extrabold text-brand">
                              {s.sparql.trimStart().startsWith('--') ? 'SQL — 소스 DB 투사' : 'SPARQL — 그래프 실행'}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(s.sparql!)}
                              className="text-[9.5px] font-bold text-ink-mid hover:text-brand"
                            >
                              복사
                            </button>
                          </div>
                          <pre className="px-2 py-1.5 text-[9.5px] font-mono leading-relaxed text-ink-dark overflow-x-auto whitespace-pre bg-white">
                            {s.sparql}
                          </pre>
                        </div>
                      )}
                      {s.resultBadge && (
                        <div className="mt-1.5">
                          <span className="pill bg-ok-bg text-ok border border-ok-border">📊 {s.resultBadge}</span>
                        </div>
                      )}
                      {s.basis && (
                        <div className="text-[10px] text-ink-mid font-semibold italic mt-1">확정 근거: {s.basis}</div>
                      )}
                    </div>
                  </div>
                );
              })}

              {running && (
                <div className="flex gap-2.5">
                  <div className="w-5 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    {[92, 78, 64].map((w, i) => (
                      <div key={i} className="og-skel h-[11px]" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {done && <AnswerCard s={scenario} />}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function AnswerCard({ s }: { s: QueryScenario }) {
  return (
    <div className="og-answer mt-1 border border-brand-tint bg-brand-bg rounded p-3.5">
      <div className="text-[11px] font-extrabold text-ink uppercase tracking-[0.3px] mb-2">답변</div>

      <ul className="space-y-1 mb-2.5">
        {s.facts.map((f) => (
          <li key={f.label} className="text-[11.5px] flex items-start gap-1.5">
            <span className="text-ink-mid font-semibold flex-shrink-0">{f.label}</span>
            <span className="text-ink-dark font-extrabold">{f.value}</span>
            {f.confirmed && <span className="pill bg-ok-bg text-ok border border-ok-border ml-auto">확정</span>}
          </li>
        ))}
      </ul>

      <div className="text-[12px] font-extrabold text-ink border-t border-brand-tint pt-2.5">{s.verdict}</div>

      <div className="mt-2.5 space-y-2">
        {s.ruleBasis.map((r) => (
          <div key={r.clause} className="bg-white border border-line-soft rounded px-2.5 py-2">
            <div className="text-[10.5px] font-extrabold text-brand">{r.clause}</div>
            <p className="text-[11px] text-ink-dark font-semibold leading-relaxed mt-0.5">{r.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-2.5">
        <div className="text-[11px] font-extrabold text-ink mb-1">결론</div>
        <ul className="space-y-0.5">
          {s.conclusion.map((c) => (
            <li key={c} className="text-[11.5px] text-ink-dark font-semibold">
              · {c}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-ink-mid font-semibold leading-relaxed mt-2.5 border-t border-brand-tint pt-2">
        {s.caveat}
      </p>

      <div className="mt-2">
        <span className="pill bg-warn-bg text-warn border border-warn-border">
          ⚠ 일부 추정 — 규정(비정형 문서) 해석이 포함된 답변입니다. 정형DB·규칙 계산 부분은 확정입니다.
        </span>
      </div>
    </div>
  );
}
