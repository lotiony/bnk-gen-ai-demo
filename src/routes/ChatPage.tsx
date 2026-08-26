/**
 * 사용자 포털 Chat — 핸드오프 §2 화면 2 · 3 · 5 를 한 화면에 담는다.
 *
 * RFP: 사용자 포털 요건 · LSM-002 (화면 2 — 모델·에이전트 선택, 이력, 추천 질의, 첨부)
 *      RAG-007 · AGB-006① (화면 3 — 질의 → 답변 + 근거 그래프 + 원문 출처)
 *      SEC-002 · SEC-003 (화면 5 — 입력 단계 PII 즉시 탐지·차단·이력)
 *
 * 왜 셋을 한 화면에 두는가 — 스펙이 그렇게 쓰여 있다. 화면 3 은 "포털 Chat 에서
 * 질의한다"이고 화면 5 는 "프롬프트에 주민번호를 입력한다"다. 둘 다 입력창이
 * 있어야 성립한다. 화면을 쪼개면 오히려 스펙과 멀어진다.
 *
 * 답변 본문은 여기서 만들지 않는다 — `mockChat` 을 거쳐 `ontologyQueries.SCENARIOS`
 * 를 읽는다. 화면 4(근거 그래프)와 같은 원천이라 두 화면이 어긋날 수 없다.
 *
 * 근거를 잇지 못한 질의에는 **확정 답변을 내지 않는다.** 이게 이 화면의 두 번째
 * 메시지다 — "추측으로 답하면 근거를 제시할 수 없다".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { useTenant } from '@/lib/tenantStore';
import type { QueryScenario } from '@/data/ontologyQueries';
import {
  CHAT_AGENTS,
  CHAT_MODELS,
  CHAT_HISTORY,
  HISTORY_GROUPS,
  GROUNDED_QUESTIONS,
  UNGROUNDED_QUESTIONS,
  UNGROUNDED_ANSWER,
  CONCLUSION_REFS,
  RUN_STEPS,
  RUN_STEP_TONE,
  AXIS_TONE,
  PII_DEMO_PROMPT,
  matchScenario,
  evidencePath,
  detectPii,
  maskPii,
  type ChatAgentOption,
} from '@/data/mockChat';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  /** 확정 답변의 원천 시나리오. 없으면 근거 미연결 답변이다. */
  sc?: QueryScenario;
}

export default function ChatPage() {
  const persona = useCurrentPersona();
  const tenant = useTenant();
  const [agent, setAgent] = useState<ChatAgentOption>(CHAT_AGENTS[0]);
  /** 전체 프롬프트 보기 — 해당 에이전트 관리자에게만 열린다(2-1). */
  const [showPrompt, setShowPrompt] = useState(false);
  const [model, setModel] = useState(CHAT_MODELS[0]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<{ q: string; sc: QueryScenario | null } | null>(null);
  const [stepIdx, setStepIdx] = useState(-1);
  const [activeRef, setActiveRef] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const piiHits = useMemo(() => detectPii(input), [input]);
  const blocked = piiHits.length > 0;

  /** 근거를 잇지 못하면 앵커링에서 멈춘다 — 단계를 끝까지 돌리지 않는다. */
  const steps = pending?.sc ? RUN_STEPS : RUN_STEPS.slice(0, 2);

  /* 재생 — 단계 하나씩 진행 후 답변을 커밋한다. */
  useEffect(() => {
    if (!pending) return;
    if (stepIdx >= steps.length) {
      const sc = pending.sc;
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: sc ? sc.verdict : UNGROUNDED_ANSWER.head, sc: sc ?? undefined },
      ]);
      setActiveRef(null);
      setPending(null);
      setStepIdx(-1);
      return;
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), steps[stepIdx]?.ms ?? 400);
    return () => clearTimeout(t);
  }, [pending, stepIdx, steps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, stepIdx, pending]);

  const send = (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || pending) return;
    if (detectPii(q).length > 0) return; // 차단 상태에서는 전송 자체가 일어나지 않는다
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setPending({ q, sc: agent.ontology ? matchScenario(q) : null });
    setStepIdx(0);
  };

  const reset = () => {
    setMsgs([]);
    setInput('');
    setPending(null);
    setStepIdx(-1);
    setActiveRef(null);
  };

  /** 우측 근거 패널은 **마지막 확정 답변**을 따라간다. */
  const lastGrounded = [...msgs].reverse().find((m) => m.role === 'assistant' && m.sc)?.sc ?? null;

  return (
    <div className="max-w-[1760px] mx-auto px-8 pt-3 pb-4">
      <div className="grid grid-cols-[248px_1fr_352px] gap-3 h-[calc(100vh-124px)] min-h-[620px]">
        {/* ── 좌: 대화 이력 ── */}
        <aside className="card flex flex-col min-h-0">
          <div className="px-3.5 py-3 border-b border-line-soft">
            <button
              onClick={reset}
              className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded bg-brand border border-brand-dark text-white text-[12px] font-extrabold hover:bg-brand-dark"
            >
              ＋ 새 대화
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
            {HISTORY_GROUPS.map((g) => (
              <div key={g} className="mb-2.5 last:mb-0">
                <div className="px-1.5 pb-1 text-[9.5px] font-extrabold tracking-[0.4px] uppercase text-ink-light">
                  {g}
                </div>
                <ul className="space-y-0.5">
                  {CHAT_HISTORY.filter((h) => h.group === g).map((h) => (
                    <li key={h.id}>
                      <div className="rounded px-2 py-1.5 hover:bg-surface-soft cursor-pointer">
                        <div className="text-[11.5px] font-bold text-ink-dark truncate">{h.title}</div>
                        <div className="text-[10px] text-ink-light font-semibold mt-0.5">
                          {h.agent} · {h.at}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="px-3.5 py-2.5 border-t border-line-soft text-[10px] text-ink-light font-semibold leading-snug">
            대화는 계열사 Namespace 안에서만 보관됩니다
            <br />
            <b className="text-ink-mid">{tenant}</b>
          </div>
        </aside>

        {/* ── 중앙: 대화 ── */}
        <section className="card flex flex-col min-h-0">
          {/* 상단 — 에이전트 · 모델 */}
          <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2 flex-wrap">
            <Picker
              label="에이전트"
              value={agent.name}
              hint={agent.grounding}
              options={CHAT_AGENTS.map((a) => ({ k: a.id, label: a.name, hint: a.desc }))}
              onPick={(k) => {
                const a = CHAT_AGENTS.find((x) => x.id === k)!;
                setAgent(a);
              }}
            />
            <Picker
              label="모델"
              value={model.name}
              hint={model.hint}
              mono
              options={CHAT_MODELS.map((m) => ({ k: m.id, label: m.name, hint: m.hint }))}
              onPick={(k) => setModel(CHAT_MODELS.find((x) => x.id === k)!)}
            />
            <span className="ml-auto pill bg-info-bg text-info border border-info-border">
              🏢 공동존 On-Prem
            </span>
            {agent.ontology ? (
              <span className="pill bg-brand-tint text-brand border border-brand-tint">
                근거 그래프 연결됨
              </span>
            ) : (
              <span className="pill bg-surface text-ink-mid border border-line-soft">문서 RAG</span>
            )}
            {/*
              RFP 2-1 사용자 포털: "전체 프롬프트 보기 기능(**해당 AI 에이전트 관리자인 경우**)".
              관리자가 아니면 버튼 자체를 그리지 않는다 — 잠긴 버튼을 보여 주면
              "프롬프트가 저기 있다" 를 알려 주는 셈이다.
            */}
            {persona && agent.admins.includes(persona.id) && (
              <button
                type="button"
                onClick={() => setShowPrompt(true)}
                className="pill bg-white text-ink-dark border border-line font-extrabold hover:border-brand-dark hover:text-brand"
              >
                ⌘ 전체 프롬프트 보기
              </button>
            )}
          </div>

          {showPrompt && (
            <SystemPromptModal agent={agent} onClose={() => setShowPrompt(false)} />
          )}

          {/* 대화 영역 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {msgs.length === 0 && !pending && <EmptyState onPick={send} persona={persona?.name} />}

            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <UserBubble key={i} text={m.text} />
              ) : (
                <AnswerBlock
                  key={i}
                  msg={m}
                  activeRef={activeRef}
                  onRef={setActiveRef}
                  onPick={send}
                />
              ),
            )}

            {pending && <RunningSteps steps={steps} idx={stepIdx} />}
          </div>

          {/* 입력 */}
          <div className="px-4 py-3 border-t border-line-soft">
            {blocked && <PiiBanner hits={piiHits} preview={maskPii(input, piiHits)} />}

            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
                추천 질의
              </span>
              {GROUNDED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={!!pending}
                  className="pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {q.length > 30 ? `${q.slice(0, 30)}…` : q}
                </button>
              ))}
              <button
                onClick={() => setInput(PII_DEMO_PROMPT)}
                className="pill bg-bad-bg text-bad border border-bad-border hover:bg-bad hover:text-white"
              >
                ⚠ PII 포함 프롬프트 (시연)
              </button>
            </div>

            <div
              className={cn(
                'flex items-end gap-2 border rounded px-3 py-2 bg-white transition-colors',
                blocked ? 'border-bad ring-1 ring-bad/30' : 'border-line focus-within:border-brand-dark',
              )}
            >
              <button
                className="text-[15px] leading-none pb-1 text-ink-light hover:text-ink-mid"
                title="파일 첨부 — 데모 범위 밖"
              >
                📎
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="규정·전결·책무에 대해 물어보세요. Enter 로 전송, Shift+Enter 로 줄바꿈"
                className="flex-1 resize-none bg-transparent text-[12.5px] leading-relaxed outline-none py-1 text-ink-dark placeholder:text-ink-light"
              />
              <button
                onClick={() => send()}
                disabled={blocked || !input.trim() || !!pending}
                className={cn(
                  'h-8 px-4 rounded text-[12px] font-extrabold flex-shrink-0',
                  blocked
                    ? 'bg-bad-bg text-bad border border-bad-border cursor-not-allowed'
                    : 'bg-brand text-white border border-brand-dark hover:bg-brand-dark disabled:opacity-45',
                )}
              >
                {blocked ? '차단됨' : '전송'}
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-ink-light font-semibold">
              생성형 AI 산출물입니다 · 확정 근거가 표시되지 않은 내용은 업무 판단의 최종 근거로 쓰지 마십시오
            </div>
          </div>
        </section>

        {/* ── 우: 근거 ── */}
        <aside className="card flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
            <h2 className="text-[13px] font-extrabold text-ink">근거</h2>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
              RAG-007
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {lastGrounded ? (
              <EvidencePanel sc={lastGrounded} activeRef={activeRef} onRef={setActiveRef} />
            ) : (
              <div className="text-[11.5px] text-ink-mid font-semibold leading-relaxed">
                확정 답변이 나오면 이 자리에 <b className="text-ink-dark">근거 경로</b>와{' '}
                <b className="text-ink-dark">규정 원문</b>이 표시됩니다.
                <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[11px] text-ink-light">
                  근거를 잇지 못한 질의에는 확정 답변을 내지 않습니다. 추측으로 답하면 여기에
                  보여줄 것이 없기 때문입니다.
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═══════════════════════ 대화 부품 ═══════════════════════ */

function EmptyState({ onPick, persona }: { onPick: (q: string) => void; persona?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <div className="text-[26px] font-black text-brand tracking-tight leading-none mb-2">BNK</div>
      <h2 className="text-[17px] font-extrabold text-ink tracking-tight">
        {persona ? `${persona} 님, 무엇을 도와드릴까요?` : '무엇을 도와드릴까요?'}
      </h2>
      <p className="text-[11.5px] text-ink-mid font-semibold mt-1.5 max-w-[520px] leading-relaxed">
        규정·전결·책무 질의는 온톨로지 근거 그래프를 순회해 답합니다. 답변에는 항상 확정 근거와
        확정하지 못한 부분이 함께 표시됩니다.
      </p>

      <div className="grid grid-cols-1 gap-1.5 mt-5 w-full max-w-[560px]">
        <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] text-left">
          근거가 연결된 질의
        </div>
        {GROUNDED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left border border-line-soft rounded px-3 py-2 hover:border-brand-dark hover:bg-brand-bg transition-colors"
          >
            <span className="text-[12px] font-bold text-ink-dark">{q}</span>
          </button>
        ))}
        <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] text-left mt-2">
          아직 근거가 연결되지 않은 질의
        </div>
        {UNGROUNDED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left border border-dashed border-line rounded px-3 py-2 hover:border-ink-light transition-colors"
          >
            <span className="text-[12px] font-semibold text-ink-mid">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-3.5">
      <div className="max-w-[76%] bg-brand-tint border border-brand-tint rounded px-3.5 py-2.5">
        <span className="text-[12.5px] font-bold text-ink leading-relaxed">{text}</span>
      </div>
    </div>
  );
}

function RunningSteps({ steps, idx }: { steps: typeof RUN_STEPS; idx: number }) {
  return (
    <div className="mb-3.5 space-y-1.5">
      {steps.slice(0, Math.max(0, idx + 1)).map((s, i) => (
        <div key={s.kind} className="og-step flex items-center gap-2">
          <span className={cn('pill border', RUN_STEP_TONE[s.kind])}>{s.label}</span>
          {i === idx ? (
            <span className="flex items-center gap-[3px]">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1 h-1 rounded-full bg-ink-light"
                  style={{ animation: `ogDot 1.1s ${d * 0.16}s infinite` }}
                />
              ))}
            </span>
          ) : (
            <span className="text-[11px] text-ok font-extrabold">✓</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AnswerBlock({
  msg,
  activeRef,
  onRef,
  onPick,
}: {
  msg: Msg;
  activeRef: number | null;
  onRef: (i: number | null) => void;
  onPick: (q: string) => void;
}) {
  const sc = msg.sc;

  if (!sc) {
    return (
      <div className="og-answer mb-4 border border-line rounded px-4 py-3.5 bg-surface-soft">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="pill bg-warn-bg text-warn border border-warn-border">확정 불가</span>
          <span className="text-[13px] font-extrabold text-ink">{UNGROUNDED_ANSWER.head}</span>
        </div>
        <p className="text-[12px] text-ink-dark font-semibold leading-relaxed">
          {UNGROUNDED_ANSWER.body}
        </p>
        <ul className="mt-2 space-y-1">
          {UNGROUNDED_ANSWER.next.map((n) => (
            <li key={n} className="flex items-start gap-1.5">
              <span className="text-ink-light text-[11px] leading-[1.6]">·</span>
              <span className="text-[11.5px] text-ink-mid font-semibold leading-snug">{n}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {GROUNDED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onPick(q)}
              className="pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand"
            >
              {q.length > 28 ? `${q.slice(0, 28)}…` : q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const refs = CONCLUSION_REFS[sc.id] ?? [];

  return (
    <div className="og-answer mb-4">
      {/* 판정 */}
      <div className="border-l-[3px] border-brand bg-brand-bg rounded-r px-3.5 py-2.5 mb-2.5">
        <div className="text-[9.5px] font-extrabold text-brand uppercase tracking-[0.4px] mb-0.5">
          판정
        </div>
        <div className="text-[13px] font-extrabold text-ink leading-snug">{sc.verdict}</div>
      </div>

      {/* 확정 사실 */}
      <div className="border border-line-soft rounded overflow-hidden mb-2.5">
        <div className="px-3 py-1.5 bg-surface-soft border-b border-line-soft flex items-center gap-1.5">
          <span className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px]">
            그래프에서 확정된 사실
          </span>
          <span className="pill bg-ok-bg text-ok border border-ok-border">
            {sc.facts.filter((f) => f.confirmed).length}건 확정
          </span>
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {sc.facts.map((f) => (
              <tr key={f.label} className="border-b border-line-soft last:border-b-0">
                <td className="px-3 py-[6px] text-[11px] font-bold text-ink-mid w-[168px] align-top">
                  {f.label}
                </td>
                <td className="px-3 py-[6px] text-[11.5px] font-semibold text-ink-dark">{f.value}</td>
                <td className="px-3 py-[6px] w-[62px] text-right">
                  <span
                    className={cn(
                      'pill border',
                      f.confirmed
                        ? 'bg-ok-bg text-ok border-ok-border'
                        : 'bg-warn-bg text-warn border-warn-border',
                    )}
                  >
                    {f.confirmed ? '확정' : '추정'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 결론 + 각주 */}
      <div className="mb-2.5">
        <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-1.5">
          결론
        </div>
        <ul className="space-y-1.5">
          {sc.conclusion.map((c, i) => (
            <li key={c} className="flex items-start gap-2">
              <span className="w-[17px] h-[17px] rounded-full bg-brand-tint text-brand border border-brand-tint inline-flex items-center justify-center text-[9.5px] font-extrabold flex-shrink-0 mt-[2px]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[12px] font-semibold text-ink-dark leading-relaxed">{c}</span>
                {(refs[i] ?? []).map((r) => (
                  <button
                    key={r}
                    onMouseEnter={() => onRef(r)}
                    onMouseLeave={() => onRef(null)}
                    onClick={() => onRef(r)}
                    className={cn(
                      'ml-1 align-middle inline-flex items-center justify-center w-[17px] h-[15px] rounded-sm text-[9.5px] font-extrabold border',
                      activeRef === r
                        ? 'bg-brand text-white border-brand-dark'
                        : 'bg-white text-brand border-brand-tint hover:border-brand',
                    )}
                    title={sc.ruleBasis[r]?.clause}
                  >
                    {r + 1}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 확정하지 못한 부분 */}
      <div className="border border-warn-border bg-warn-bg rounded px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[11px]">⚠</span>
          <span className="text-[10.5px] font-extrabold text-warn uppercase tracking-[0.4px]">
            확정하지 못한 부분
          </span>
        </div>
        <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed">{sc.caveat}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ 근거 패널 ═══════════════════════ */

function EvidencePanel({
  sc,
  activeRef,
  onRef,
}: {
  sc: QueryScenario;
  activeRef: number | null;
  onRef: (i: number | null) => void;
}) {
  const path = evidencePath(sc);

  return (
    <div>
      {/* 근거 경로 */}
      <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2">
        근거 경로 · 그래프 순회
      </div>
      <div className="mb-3">
        {path.map((h, i) => (
          <div key={h.id}>
            {i > 0 && (
              <div className="flex items-center gap-1.5 pl-[9px] py-[1px]">
                <span className="w-px h-3 bg-line" />
                <span className="text-[9.5px] font-bold text-ink-light">{h.rel}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className={cn('pill border flex-shrink-0', AXIS_TONE[h.axis])}>{h.cls}</span>
              <span className="text-[11.5px] font-bold text-ink-dark truncate" title={h.label}>
                {h.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/projects/PRJ-2025-PB-001/tasks/ontology"
        className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded border border-line text-[11.5px] font-extrabold text-ink-dark hover:border-brand hover:text-brand mb-3.5"
      >
        근거 그래프 자세히 보기 →
      </Link>

      {/* 원문 출처 */}
      <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2 pt-3 border-t border-line-soft">
        규정 원문 출처
      </div>
      <div className="space-y-2">
        {sc.ruleBasis.map((r, i) => (
          <div
            key={r.clause}
            onMouseEnter={() => onRef(i)}
            onMouseLeave={() => onRef(null)}
            className={cn(
              'border rounded px-3 py-2 transition-colors',
              activeRef === i ? 'border-brand bg-brand-bg' : 'border-line-soft bg-white',
            )}
          >
            <div className="flex items-start gap-1.5 mb-1">
              <span
                className={cn(
                  'w-[17px] h-[15px] rounded-sm inline-flex items-center justify-center text-[9.5px] font-extrabold border flex-shrink-0 mt-[1px]',
                  activeRef === i
                    ? 'bg-brand text-white border-brand-dark'
                    : 'bg-white text-brand border-brand-tint',
                )}
              >
                {i + 1}
              </span>
              <span className="text-[11.5px] font-extrabold text-ink leading-snug">{r.clause}</span>
            </div>
            <p className="text-[11px] text-ink-mid font-semibold leading-relaxed">{r.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-line-soft text-[10px] text-ink-light font-semibold leading-snug">
        조항 원문은 비정형 문서에서 실체화된 개체다. 정형 DB 값은 가상화 뷰(zero-copy)로 조회한다.
      </div>
    </div>
  );
}

/* ═══════════════════════ PII 차단 배너 (화면 5) ═══════════════════════ */

function PiiBanner({
  hits,
  preview,
}: {
  hits: ReturnType<typeof detectPii>;
  preview: string;
}) {
  const kinds = [...new Set(hits.map((h) => h.item.name))];
  return (
    <div className="mb-2 border border-bad-border bg-bad-bg rounded px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-[17px] h-[17px] rounded-full bg-bad text-white inline-flex items-center justify-center text-[10px] font-extrabold">
          ✕
        </span>
        <span className="text-[12px] font-extrabold text-bad">
          개인정보가 감지되어 전송이 차단되었습니다
        </span>
        <span className="ml-auto pill bg-white text-bad border border-bad-border font-mono tracking-normal">
          SEC-002 · SEC-003
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {kinds.map((k) => {
          const h = hits.find((x) => x.item.name === k)!;
          return (
            <span key={k} className="pill bg-white text-bad border border-bad-border">
              {k} · {h.item.code}
            </span>
          );
        })}
      </div>
      <div className="bg-white border border-bad-border rounded px-2.5 py-1.5">
        <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] mb-0.5">
          마스킹 적용 시
        </div>
        <div className="text-[11.5px] font-mono text-ink-dark break-all">{preview}</div>
      </div>
      <div className="text-[10px] text-ink-mid font-semibold mt-1.5 leading-snug">
        입력 단계에서 차단했으므로 <b className="text-ink-dark">모델·게이트웨이로 전송되지 않습니다.</b>{' '}
        이 시도는 가드레일 탐지 이력에 기록됩니다.
      </div>
    </div>
  );
}

/* ═══════════════════════ 드롭다운 ═══════════════════════ */

function Picker({
  label,
  value,
  hint,
  options,
  onPick,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  options: { k: string; label: string; hint?: string }[];
  onPick: (k: string) => void;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded border border-line bg-white hover:border-brand-dark"
      >
        <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
          {label}
        </span>
        <span className={cn('text-[12px] font-extrabold text-ink', mono && 'font-mono text-[11.5px]')}>
          {value}
        </span>
        <span className="text-[8px] text-ink-light">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-40 w-[320px] card shadow-md py-1">
            {options.map((o) => (
              <button
                key={o.k}
                onClick={() => {
                  onPick(o.k);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-surface-soft',
                  o.label === value && 'bg-brand-bg',
                )}
              >
                <div className={cn('text-[12px] font-extrabold text-ink', mono && 'font-mono')}>
                  {o.label}
                </div>
                {o.hint && (
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{o.hint}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      {hint && (
        <span className="sr-only" aria-hidden={false}>
          {hint}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════ 전체 프롬프트 보기 ═══════════════════════ */

/**
 * RFP 2-1 사용자 포털: "전체 프롬프트 보기 기능(해당 AI 에이전트 관리자인 경우)".
 *
 * 프롬프트는 재사용 자산이므로 아무에게나 열지 않는다. 열람 자체가 감사 대상이라
 * 하단에 그 사실을 적어 둔다(SEC-009).
 */
function SystemPromptModal({
  agent,
  onClose,
}: {
  agent: ChatAgentOption;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[640px] max-h-[80vh] bg-white border border-line rounded-lg shadow-xl flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-line-soft flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[14.5px] font-extrabold text-ink">전체 시스템 프롬프트</h2>
            <p className="text-[11px] text-ink-mid font-semibold mt-0.5">
              {agent.id} · {agent.name}
            </p>
          </div>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
            2-1 사용자 포털
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[16px] font-black text-ink-light hover:text-ink-dark leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <pre className="whitespace-pre-wrap text-[11.5px] text-ink-dark font-mono leading-relaxed border border-line-soft bg-surface-soft rounded px-3 py-3">
            {agent.systemPrompt}
          </pre>
        </div>
        <div className="px-5 py-3 border-t border-line-soft text-[10px] text-ink-mid font-semibold leading-snug">
          🔒 이 에이전트의 관리자에게만 노출됩니다. 프롬프트 열람 행위는 감사 원장에
          기록됩니다(SEC-009).
        </div>
      </div>
    </div>
  );
}
