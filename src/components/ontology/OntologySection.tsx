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
import { cn } from '@/lib/utils';
import OntologyGraph from './OntologyGraph';
import {
  CLASSES,
  RELATIONS,
  CLASS_COUNT,
  ATTR_COUNT,
  RELATION_COUNT,
  HUB_CLASSES,
  classByName,
} from '@/data/ontology';
import {
  COVERAGE,
  MAPPING_ROWS,
  INSTANCE_COUNT,
  SOURCE_LABEL,
  SOURCE_TONE,
  type MappingKind,
} from '@/data/ontologyMapping';
import { SCENARIOS, EXTRA_QUESTIONS, type QueryScenario, type StepKind } from '@/data/ontologyQueries';

type SubTab = 'graph' | 'mapping' | 'query';

export default function OntologySection() {
  const [sub, setSub] = useState<SubTab>('query');

  return (
    <div className="card">
      {/* 구축 단계 — 파이프라인 요약 */}
      <BuildStages />

      {/* 하위 탭 */}
      <div className="px-5 pt-1 border-b border-line-soft flex items-center gap-1">
        <SubTabBtn on={sub === 'graph'} onClick={() => setSub('graph')}>
          그래프 설계
        </SubTabBtn>
        <SubTabBtn on={sub === 'mapping'} onClick={() => setSub('mapping')}>
          데이터 매핑
        </SubTabBtn>
        <SubTabBtn on={sub === 'query'} onClick={() => setSub('query')}>
          Query
        </SubTabBtn>
      </div>

      {sub === 'graph' && <GraphDesign />}
      {sub === 'mapping' && <MappingView />}
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

function BuildStages() {
  const stages = [
    { n: `${CLASS_COUNT}`, unit: '클래스', sub: `${ATTR_COUNT} 속성`, label: '온톨로지 생성' },
    { n: `${RELATION_COUNT}`, unit: '관계', sub: '구조 점검', label: '관계 정의' },
    { n: `${MAPPING_ROWS.filter((r) => r.status !== 'none').length}`, unit: '매핑', sub: 'DB·문서 매핑', label: '데이터 연결' },
    { n: `${INSTANCE_COUNT}`, unit: '인스턴스', sub: '실체화', label: 'A-Box 생성' },
  ];
  return (
    <div className="px-5 py-4 border-b border-line-soft">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[11px] font-extrabold text-ink">구축 단계</span>
        <span className="text-[10.5px] text-ink-mid font-semibold">
          여신심사 + 전결권 도메인 · 정형DB는 가상 뷰(zero-copy), 규정은 문서 실체화
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div className="flex-1 border border-brand-tint bg-brand-bg rounded px-3 py-2.5">
              <div className="flex items-baseline gap-1">
                <span className="text-[19px] font-extrabold text-ink tabular-nums">{s.n}</span>
                <span className="text-[10.5px] font-bold text-ink-mid">{s.unit}</span>
              </div>
              <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{s.sub}</div>
            </div>
            {i < stages.length - 1 && <span className="text-ink-light text-[13px]">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ 그래프 설계 ══════════════════════ */

function GraphDesign() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showAttrs, setShowAttrs] = useState(true);
  const cls = selected ? classByName(selected) : null;

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="text-[11.5px] text-ink-mid font-semibold">
          <b className="text-ink">{CLASS_COUNT}</b> classes · <b className="text-ink">{RELATION_COUNT}</b> relationships
          <span className="mx-1.5 text-ink-light">·</span>
          육각형=클래스 · 원=속성 · 채움=허브(연결 TOP {HUB_CLASSES.length}) · 클릭=상세
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-dark cursor-pointer">
          <input type="checkbox" checked={showAttrs} onChange={(e) => setShowAttrs(e.target.checked)} />
          속성 표시
        </label>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-3">
        <div className="border border-line-soft rounded bg-surface-soft h-[560px] overflow-hidden">
          <OntologyGraph showAttrs={showAttrs} onSelect={setSelected} selected={selected} />
        </div>

        <div className="border border-line-soft rounded p-3.5 bg-white overflow-y-auto h-[560px]">
          {!cls ? (
            <div className="text-[11.5px] text-ink-mid font-semibold text-center pt-16 leading-relaxed">
              그래프에서 클래스를 클릭하면
              <br />
              속성·관계 명세가 표시됩니다
            </div>
          ) : (
            <>
              <div className="text-[14px] font-extrabold text-ink">{cls.name}</div>
              <div className="text-[10.5px] font-mono text-ink-mid mt-0.5">{cls.uri}</div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="pill bg-surface text-ink-mid border border-line-soft">
                  {cls.axis === 'credit' ? '여신 축' : '규정 축'}
                </span>
                {cls.parent && (
                  <span className="pill bg-info-bg text-info border border-info-border">상위 {cls.parent}</span>
                )}
                {HUB_CLASSES.includes(cls.name) && (
                  <span className="pill bg-brand-tint text-brand border border-brand-tint">허브</span>
                )}
              </div>

              <div className="mt-3 text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">
                속성 {cls.attrs.length}
              </div>
              <ul className="mt-1 space-y-0.5">
                {cls.attrs.map((a) => (
                  <li key={a} className="text-[11.5px] text-ink-dark font-semibold">
                    · {a}
                  </li>
                ))}
              </ul>

              <div className="mt-3 text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">관계</div>
              <ul className="mt-1 space-y-1">
                {RELATIONS.filter((r) => r.domain === cls.name || r.range === cls.name).map((r) => (
                  <li key={r.uri} className="text-[11px] text-ink-dark font-semibold">
                    {r.domain === cls.name ? (
                      <>
                        <b className="text-brand">{r.name}</b> → {r.range}
                      </>
                    ) : (
                      <>
                        {r.domain} → <b className="text-brand">{r.name}</b>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
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
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-surface-soft sticky top-0">
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

  const run = useCallback(() => {
    clearTimers();
    setShown(0);
    setRunning(true);
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

  // hop = 그 클래스가 처음 점등된 스텝 순서. 순회 모드의 컬럼이 된다.
  const hopOf = useMemo(() => {
    const m: Record<string, number> = {};
    let hop = 0;
    for (const st of lit) {
      const fresh = (st.lightClasses ?? []).filter((c) => !(c in m));
      if (!fresh.length) continue;
      fresh.forEach((c) => (m[c] = hop));
      hop += 1;
    }
    return m;
  }, [shown, scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchorClass = scenario.steps.find((st) => st.kind === 'anchor')?.lightClasses?.[0] ?? null;

  return (
    <div className="p-5">
      {/* 질의 입력 줄 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 border border-brand rounded px-3 py-2 bg-white">
          <span className="text-ink-mid text-[13px]">🔍</span>
          <span className="text-[12.5px] font-semibold text-ink truncate">{scenario.question}</span>
        </div>
        <select
          className="h-[38px] border border-line rounded px-2 text-[11.5px] font-semibold text-ink-dark bg-white max-w-[220px]"
          value={scenario.id}
          onChange={(e) => {
            const s = SCENARIOS.find((x) => x.id === e.target.value);
            if (s) reset(s);
          }}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.tag}] {s.question.slice(0, 22)}…
            </option>
          ))}
          {EXTRA_QUESTIONS.map((q) => (
            <option key={q} value={q} disabled>
              {q.slice(0, 26)}… (준비 중)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="h-[38px] px-4 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {running ? '실행 중…' : '▶ 실행'}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-3">
        {/* 좌: 그래프 순회 */}
        <div>
          <div className="text-[10.5px] text-ink-mid font-semibold mb-1.5 flex items-center gap-2">
            <span>온톨로지 순회 — 앵커부터 관계를 타고 hop 순서로 펼쳐집니다</span>
            {shown > 0 && (
              <span className="pill bg-brand-tint text-brand border border-brand-tint">
                {Object.keys(hopOf).length} 클래스 · {activeRelations.length} 관계 · {Math.max(0, ...Object.values(hopOf)) + (shown ? 1 : 0)} hop
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
          <div className="border border-line-soft rounded bg-surface-soft h-[600px] overflow-hidden">
            <OntologyGraph
              activeClasses={activeClasses}
              activeRelations={activeRelations}
              hopOf={hopOf}
              anchor={anchorClass}
              running={running}
              showAttrs={false}
            />
          </div>
        </div>

        {/* 우: 추론 과정 */}
        <div className="border border-line-soft rounded bg-white h-[624px] overflow-y-auto">
          <div className="px-3.5 py-2.5 border-b border-line-soft bg-brand-bg sticky top-0">
            <div className="text-[11.5px] font-extrabold text-ink">추론 과정</div>
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
                        <code className="block mt-1.5 px-2 py-1.5 bg-surface border border-line-soft rounded text-[10.5px] font-mono text-ink break-all">
                          {s.query}
                        </code>
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
