/**
 * AI Studio — 플레이그라운드.
 *
 * RFP: LSM-005 모델별 플레이그라운드 (필수)
 *      RAG-009 RAG 전용 플레이그라운드 (권고)
 *      RAG-006 하이브리드 서치·리랭킹 (권고) — 리트리버 비교 축으로 함께 증명된다
 *      RAG-007 그래프 RAG (필수) — 리트리버 선택지 중 하나로 노출
 *
 * 두 탭이 한 화면에 있는 이유 — 둘 다 "설정을 바꿔 가며 결과를 비교한다" 는
 * 같은 행위다. 모델 탭은 하이퍼파라미터를, RAG 탭은 리트리버·Top-K·임계값을 바꾼다.
 *
 * 응답은 사전 정의 시나리오다(실동작 백엔드는 범위 밖). 자유 입력에는
 * 그 사실을 정직하게 알린다 — 없는 기능을 있는 것처럼 보이면 확약 리스크가 된다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { MOCK_MODELS } from '@/data/mockModels';
import {
  PLAYGROUND_PRESETS,
  FREEFORM_NOTICE,
  RAG_SCENARIOS,
  RETRIEVER_LABEL,
  type RetrieverMode,
} from '@/data/mockPlayground';

type Tab = 'model' | 'rag';

const RETRIEVERS: RetrieverMode[] = ['bm25', 'dense', 'hybrid', 'graph'];

/** 플레이그라운드에서 고를 수 있는 LLM — 카탈로그의 llm 종류만. */
const LLMS = MOCK_MODELS.filter((m) => m.kind === 'llm').slice(0, 2);

export default function PlaygroundPage() {
  const [tab, setTab] = useState<Tab>('model');

  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">플레이그라운드</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            설정을 실시간으로 바꿔 가며 응답 품질을 비교한다 · 개발 클러스터에서 실행
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          LSM-005 · RAG-009
        </span>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {(
          [
            { k: 'model' as const, label: '모델 시험', req: 'LSM-005 · 필수' },
            { k: 'rag' as const, label: 'RAG 검증', req: 'RAG-009 · 권고' },
          ]
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k
                ? 'text-brand border-brand'
                : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[9px] font-mono font-bold text-ink-light">{t.req}</span>
          </button>
        ))}
      </div>

      {tab === 'model' ? <ModelPlayground /> : <RagPlayground />}
    </div>
  );
}

/* ═══════════════════════ 모델 시험 ═══════════════════════ */

function ModelPlayground() {
  const [model, setModel] = useState(LLMS[0]?.name ?? '');
  const [system, setSystem] = useState(
    '당신은 BNK금융그룹의 여신 업무 어시스턴트입니다. 근거 조항을 함께 인용하고, 확인되지 않은 사실은 단정하지 않습니다.',
  );
  const [temp, setTemp] = useState(0.2);
  const [topP, setTopP] = useState(0.9);
  const [maxTok, setMaxTok] = useState(1024);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [freeform, setFreeform] = useState('');
  const [ran, setRan] = useState(false);

  const preset = useMemo(
    () => PLAYGROUND_PRESETS.find((p) => p.id === presetId) ?? null,
    [presetId],
  );
  const meta = preset?.meta[model];
  const answer = preset?.answers[model];

  const run = () => setRan(true);
  const reset = () => {
    setPresetId(null);
    setFreeform('');
    setRan(false);
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-3.5">
      {/* ── 좌: 하이퍼파라미터 ── */}
      <div className="card p-3.5 self-start sticky top-[110px]">
        <h2 className="text-[12.5px] font-extrabold text-ink mb-2.5">하이퍼파라미터</h2>

        <Field label="모델" hint="등록된 모델별로 개별 시험한다">
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setRan(false);
            }}
            className="w-full py-1.5 px-2 border border-line rounded text-[11.5px] bg-white font-semibold focus:outline-none focus:border-brand-dark"
          >
            {LLMS.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="System Prompt" hint="시스템 역할 — 응답 형식·금칙을 여기서 잡는다">
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={5}
            className="w-full py-1.5 px-2 border border-line rounded text-[11px] bg-white leading-relaxed focus:outline-none focus:border-brand-dark resize-none"
          />
        </Field>

        <Slider
          label="Temperature"
          value={temp}
          min={0}
          max={1}
          step={0.05}
          onChange={setTemp}
          hint={temp <= 0.3 ? '보수적 — 규정 답변에 적합' : temp >= 0.7 ? '창의적 — 사실 오류 위험' : '균형'}
        />
        <Slider
          label="Top-P"
          value={topP}
          min={0.1}
          max={1}
          step={0.05}
          onChange={setTopP}
          hint="누적 확률 상위 토큰만 후보로 둔다"
        />
        <Field label="최대 출력 토큰" hint="게이트웨이 미터링에 그대로 반영된다">
          <input
            type="number"
            value={maxTok}
            step={128}
            min={128}
            max={8192}
            onChange={(e) => setMaxTok(Number(e.target.value))}
            className="w-full py-1.5 px-2 border border-line rounded text-[11.5px] bg-white font-bold tabular-nums focus:outline-none focus:border-brand-dark"
          />
        </Field>

        <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[10px] text-ink-mid font-semibold leading-snug">
          🔒 모든 호출은 LLM 게이트웨이를 통과한다 — 가드레일·PII 마스킹·토큰 미터링이
          플레이그라운드에도 동일하게 적용된다(ONM-002).
        </div>
      </div>

      {/* ── 우: 질의 · 응답 ── */}
      <div className="min-w-0">
        <div className="card p-3.5 mb-3">
          <h2 className="text-[12.5px] font-extrabold text-ink mb-2">예시 질의</h2>
          <div className="flex flex-col gap-1.5 mb-3">
            {PLAYGROUND_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPresetId(p.id);
                  setFreeform('');
                  setRan(false);
                }}
                className={cn(
                  'text-left px-3 py-2 rounded border transition-colors',
                  presetId === p.id
                    ? 'bg-brand-bg border-brand-dark'
                    : 'bg-white border-line-soft hover:border-brand-dark',
                )}
              >
                <div className="text-[12px] font-bold text-ink leading-snug">{p.prompt}</div>
                <div className="text-[10px] text-ink-mid font-semibold mt-0.5">{p.purpose}</div>
              </button>
            ))}
          </div>

          <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
            직접 입력
          </label>
          <textarea
            value={freeform}
            onChange={(e) => {
              setFreeform(e.target.value);
              setPresetId(null);
              setRan(false);
            }}
            rows={2}
            placeholder="질의를 입력하세요"
            className="w-full py-2 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-brand-dark resize-none"
          />

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={run}
              disabled={!presetId && !freeform.trim()}
              className="py-1.5 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▶ 실행
            </button>
            <button
              type="button"
              onClick={reset}
              className="py-1.5 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand-dark"
            >
              초기화
            </button>
            <span className="ml-auto text-[10px] text-ink-mid font-semibold tabular-nums">
              T {temp.toFixed(2)} · P {topP.toFixed(2)} · max {maxTok}
            </span>
          </div>
        </div>

        {/* 결과 */}
        <div className="card p-3.5 min-h-[220px]">
          <h2 className="text-[12.5px] font-extrabold text-ink mb-2">응답</h2>
          {!ran ? (
            <p className="text-[11.5px] text-ink-mid font-semibold">
              질의를 고르고 <b className="text-ink-dark">실행</b>을 누르면 결과가 표시됩니다.
            </p>
          ) : !preset ? (
            <div className="border border-warn-border bg-warn-bg rounded px-3 py-2.5">
              <div className="text-[11.5px] font-extrabold text-warn mb-0.5">
                사전 정의 질의가 아닙니다
              </div>
              <p className="text-[11px] text-ink-dark font-semibold leading-snug">
                {FREEFORM_NOTICE}
              </p>
            </div>
          ) : (
            <>
              <div className="whitespace-pre-wrap text-[12px] text-ink-dark leading-relaxed border border-line-soft bg-surface-soft rounded px-3 py-2.5">
                {answer ?? '이 모델에 대한 사전 정의 응답이 없습니다.'}
              </div>
              {meta && (
                <div className="grid grid-cols-4 gap-2 mt-2.5">
                  <Metric label="TTFT" value={`${meta.ttftMs}ms`} />
                  <Metric label="총 소요" value={`${meta.totalMs.toLocaleString('ko-KR')}ms`} />
                  <Metric label="입력 토큰" value={meta.tokensIn.toLocaleString('ko-KR')} />
                  <Metric label="출력 토큰" value={meta.tokensOut.toLocaleString('ko-KR')} />
                </div>
              )}
              <p className="text-[10px] text-ink-mid font-semibold mt-2.5 leading-snug">
                이 호출의 토큰은 계열사 · 부서 · 사용자 단위로 적산되어 미터링에 반영된다(LSM-010).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ RAG 검증 ═══════════════════════ */

function RagPlayground() {
  const scenario = RAG_SCENARIOS[0];
  const [left, setLeft] = useState<RetrieverMode>('bm25');
  const [right, setRight] = useState<RetrieverMode>('graph');
  const [topK, setTopK] = useState(3);
  const [threshold, setThreshold] = useState(0.7);

  return (
    <div>
      {/* 설정 */}
      <div className="card p-3.5 mb-3">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-[280px] flex-1">
            <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
              검증 질의
            </label>
            <div className="text-[12.5px] font-bold text-ink leading-snug border border-line-soft bg-surface-soft rounded px-3 py-2">
              {scenario.question}
            </div>
          </div>
          <div className="w-[150px]">
            <Slider
              label="Top-K"
              value={topK}
              min={1}
              max={8}
              step={1}
              onChange={setTopK}
              hint="검색 후보 수"
            />
          </div>
          <div className="w-[170px]">
            <Slider
              label="Score Threshold"
              value={threshold}
              min={0.3}
              max={0.95}
              step={0.05}
              onChange={setThreshold}
              hint="이 점수 미만 청크는 버린다"
            />
          </div>
        </div>
      </div>

      {/* 비교 */}
      <div className="grid grid-cols-2 gap-3">
        <RetrieverPane
          side="A"
          mode={left}
          onMode={setLeft}
          topK={topK}
          threshold={threshold}
          scenario={scenario}
        />
        <RetrieverPane
          side="B"
          mode={right}
          onMode={setRight}
          topK={topK}
          threshold={threshold}
          scenario={scenario}
        />
      </div>

      <p className="text-[10.5px] text-ink-mid font-semibold mt-2.5 leading-snug">
        같은 질의·같은 설정에서 리트리버만 바꿔 비교한다. 키워드 검색은 전결 주체와 개정 이력을
        찾지 못하지만, 온톨로지 관계를 타는 Graph RAG 는 <b className="text-ink-dark">규정 → 개정 →
        책무</b> 경로를 따라가 근거를 모은다(RAG-007 · RAG-008).
      </p>
    </div>
  );
}

function RetrieverPane({
  side,
  mode,
  onMode,
  topK,
  threshold,
  scenario,
}: {
  side: 'A' | 'B';
  mode: RetrieverMode;
  onMode: (m: RetrieverMode) => void;
  topK: number;
  threshold: number;
  scenario: (typeof RAG_SCENARIOS)[number];
}) {
  const r = scenario.results[mode];
  const chunks = r.chunks.filter((c) => c.score >= threshold).slice(0, topK);
  const dropped = r.chunks.length - chunks.length;

  return (
    <div className="card p-3.5 min-w-0">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-[18px] h-[18px] rounded-full bg-surface border border-line text-ink-mid inline-flex items-center justify-center text-[9.5px] font-extrabold">
          {side}
        </span>
        <select
          value={mode}
          onChange={(e) => onMode(e.target.value as RetrieverMode)}
          className="py-1 px-2 border border-line rounded text-[11.5px] bg-white font-extrabold focus:outline-none focus:border-brand-dark"
        >
          {RETRIEVERS.map((m) => (
            <option key={m} value={m}>
              {RETRIEVER_LABEL[m]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[10px] text-ink-mid font-bold tabular-nums">
          {r.latencyMs}ms
        </span>
      </div>

      {/* 근거 충실도 */}
      <div className="mb-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
            근거 충실도
          </span>
          <span
            className={cn(
              'text-[12px] font-extrabold tabular-nums',
              r.groundedness >= 80 ? 'text-ok' : r.groundedness >= 55 ? 'text-warn' : 'text-bad',
            )}
          >
            {r.groundedness}%
          </span>
        </div>
        <div className="h-[6px] rounded-full bg-surface overflow-hidden">
          <i
            className={cn(
              'block h-full rounded-full',
              r.groundedness >= 80 ? 'bg-ok' : r.groundedness >= 55 ? 'bg-warn' : 'bg-bad',
            )}
            style={{ width: `${r.groundedness}%` }}
          />
        </div>
      </div>

      {/* 검색된 청크 */}
      <div className="text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
        검색 결과 {chunks.length}건
        {dropped > 0 && (
          <span className="ml-1.5 normal-case tracking-normal text-ink-mid font-semibold">
            · 임계값 미만 {dropped}건 제외
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {chunks.length === 0 && (
          <div className="text-[11px] text-ink-mid font-semibold px-2.5 py-2 border border-line-soft rounded bg-surface-soft">
            임계값 {threshold.toFixed(2)} 이상인 청크가 없다 — 임계값을 낮춰야 한다.
          </div>
        )}
        {chunks.map((c, i) => (
          <div key={i} className="border border-line-soft rounded px-2.5 py-2 bg-white">
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-[11px] font-extrabold text-ink truncate">{c.doc}</span>
              <span className="text-[9.5px] text-ink-mid font-semibold">{c.locator}</span>
              <span className="ml-auto text-[10px] font-bold text-ink-dark tabular-nums">
                {c.score.toFixed(2)}
              </span>
            </div>
            <p className="text-[10.5px] text-ink-dark font-semibold leading-snug">{c.excerpt}</p>
            {c.path && (
              <div className="mt-1 text-[9.5px] font-bold text-brand leading-snug">
                ⇢ {c.path}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 최종 답변 */}
      <div className="text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
        최종 답변
      </div>
      <div className="whitespace-pre-wrap text-[11.5px] text-ink-dark leading-relaxed border border-line-soft bg-surface-soft rounded px-2.5 py-2">
        {r.answer}
      </div>
    </div>
  );
}

/* ═══════════════════════ 공통 소품 ═══════════════════════ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[9.5px] text-ink-mid font-semibold mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="mb-2.5">
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
          {label}
        </label>
        <span className="text-[11px] font-extrabold text-ink tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-dark"
      />
      {hint && <p className="text-[9.5px] text-ink-mid font-semibold mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-soft rounded px-2.5 py-1.5 bg-surface-soft">
      <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
        {label}
      </div>
      <div className="text-[12.5px] font-extrabold text-ink tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
