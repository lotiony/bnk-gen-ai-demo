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
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { useTenant } from '@/lib/tenantStore';
import { usePersonalization } from '@/lib/personalization';
import { DEMO_TODAY } from '@/data/demoClock';
import { PERSONAL_DOCS } from '@/data/mockPersonalDocs';
import {
  ATTACH_SAMPLES,
  ATTACH_STEPS,
  ATTACH_VERDICT_TONE,
  ATTACH_VERDICT_LABEL,
  ATTACH_RETENTION_NOTE,
  type AttachFile,
  type AttachAction,
} from '@/data/mockChatAttach';
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
  seedHistory,
  chatAgentsFor,
  suggestedQuestions,
  matchDocAnswer,
  type ChatAgentOption,
  type DocAnswer,
} from '@/data/mockChat';
import {
  CONSULT_AGENT_ID,
  CONSULT_STEPS_LOOKUP,
  CONSULT_TEXT,
  consultSuggestions,
  matchConsultTurn,
  stageIndex,
  type ConsultCardKind,
  type ConsultStage,
} from '@/data/mockConsultChat';
import { AFFILIATE_OPTIONS, CUSTOMER_DEFAULT } from '@/data/mockCustomerConsult';
import { ConsultTurn, type ConsultState } from '@/components/consult/ConsultCards';
import {
  FX_AGENT_ID,
  FX_STEPS_EVIDENCE,
  FX_STEPS_REVIEW,
  FX_STEPS_WRAPUP,
  FX_TEXT,
  fxStageIndex,
  fxSuggestions,
  matchFxTurn,
  type FxCardKind,
  type FxStage,
} from '@/data/mockFxChat';
import {
  FX_CUSTOMER_QUESTION,
  FX_FEEDBACK,
  FX_IMPROVEMENT_CHECKS,
  FX_IMPROVEMENT_ELEMENTS,
  FX_IMPROVED_VERSION,
  FX_INSTRUCTION,
  FX_TASK_CARDS,
} from '@/data/mockFxAssist';
import { FxTurn, type FxState } from '@/components/fx/FxCards';
import { submitImprovement } from '@/data/mockApprovals';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  /** 확정 답변의 원천 시나리오. 없으면 근거 미연결 답변이다. */
  sc?: QueryScenario;
  /** 문서 RAG 계열 일반 답변 — 이력 복원용. 근거 그래프 없이 본문만 보여 준다. */
  plain?: boolean;
  /** 이 턴에 함께 올린 첨부(2-1 대화중 파일 업로드). */
  att?: AttachFile;
  /** 고객 상담 카드(GRP-005) — 있으면 답변 블록 대신 카드로 그린다. */
  card?: ConsultCardKind;
  /**
   * 외환업무 카드(GRP-009). 상담 카드와 **필드를 나눠 둔다** — 에이전트를 바꿔도
   * 이전 대화는 지워지지 않으므로, 한 필드에 두 종류를 담으면 직전 시나리오의
   * 카드가 다른 컴포넌트로 그려진다.
   */
  fx?: FxCardKind;
}

/** 고객 상담 대화의 진행 상태 — 카드 입력값 + 단계. 메모리뿐이라 새로고침하면 처음이다. */
const INITIAL_CONSULT: ConsultState & { stage: ConsultStage } = {
  stage: 'idle',
  name: CUSTOMER_DEFAULT.name,
  phone: CUSTOMER_DEFAULT.phone,
  background: CUSTOMER_DEFAULT.background,
  affiliates: Object.fromEntries(AFFILIATE_OPTIONS.map((o) => [o.tenant, o.defaultOn])),
  saved: false,
};

/** 외환업무 대화의 진행 상태 — 카드 입력값 + 단계. 상담과 같은 규약이다. */
const INITIAL_FX: FxState & { stage: FxStage } = {
  stage: 'idle',
  instruction: FX_INSTRUCTION,
  feedback: FX_FEEDBACK.quote,
  submitted: false,
};

export default function ChatPage() {
  const persona = useCurrentPersona();
  const tenant = useTenant();
  /*
   * RFP 2-1 개인화: "개인화 설정(기본 모델, 기본 에이전트 등)".
   * 홈 개인화 모달에서 고른 기본값이 여기 초기 선택으로 반영된다 —
   * 설정이 화면과 안 이어지면 개인화가 거짓말이 된다.
   */
  const prefs = usePersonalization();
  /*
   * SEC-001 — 선택 가능한 에이전트는 그룹 공통 + 자기 계열사 것뿐이다.
   * 예전에는 전체 목록을 그대로 그려서 타 계열사 전용 에이전트가 드롭다운에 보였다.
   */
  const agentOptions = useMemo(() => chatAgentsFor(tenant), [tenant]);
  /*
   * AGB-006 — 마켓플레이스의 그룹 공동 사용 에이전트 카드에서 `?agent=GRP-00N` 으로
   * 넘어온다. 카드가 정보만 보여 주고 대화로 이어지지 않으면 요건을 절반만 채운다.
   */
  const [params] = useSearchParams();
  const [agent, setAgent] = useState<ChatAgentOption>(() => {
    const wanted = params.get('agent');
    return (
      (wanted ? agentOptions.find((a) => a.id === wanted) : undefined) ??
      agentOptions.find((a) => a.name === prefs.defaultAgent) ??
      agentOptions[0]
    );
  });
  /** 전체 프롬프트 보기 — 해당 에이전트 관리자에게만 열린다(2-1). */
  const [showPrompt, setShowPrompt] = useState(false);
  const [model, setModel] = useState(
    () => CHAT_MODELS.find((m) => m.name === prefs.defaultModel) ?? CHAT_MODELS[0],
  );
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<{
    q: string;
    sc: QueryScenario | null;
    doc: DocAnswer | null;
    /** 첨부 턴이면 실행 단계가 반입 검사부터 시작한다. */
    att: AttachFile | null;
    /** 첨부에서 나온 답변 — 있으면 인덱스를 타지 않고 이 문장을 커밋한다. */
    ans: string | null;
    /** 고객 상담 턴 — 단계 목록과 커밋할 카드를 직접 지정한다. */
    steps?: typeof RUN_STEPS;
    card?: ConsultCardKind;
    fxCard?: FxCardKind;
  } | null>(null);
  /*
   * RFP 2-1 — "대화중 파일 업로드 기능(문서/이미지), 업로드 파일 기반 응답·요약·번역".
   * 첨부는 개인 문서 저장소와 달리 **이 세션에서만** 쓰인다(인덱스 미적재).
   */
  const [attached, setAttached] = useState<AttachFile | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  /* ── 고객 상담(GRP-005) 상태 — 에이전트를 바꾸면 처음으로 ── */
  const [consult, setConsult] = useState(INITIAL_CONSULT);
  useEffect(() => {
    setConsult(INITIAL_CONSULT);
  }, [agent.id]);
  const isConsult = agent.id === CONSULT_AGENT_ID;

  /* ── 외환업무(GRP-009) 상태 — 에이전트를 바꾸면 처음으로 ── */
  const [fx, setFx] = useState(INITIAL_FX);
  useEffect(() => {
    setFx(INITIAL_FX);
  }, [agent.id]);
  const isFx = agent.id === FX_AGENT_ID;
  /*
   * 개선판을 쓰는 계열사인가.
   *
   * 부산은행이 개선하고 관리자가 승인한 응답 형식을 경남은행이 그대로 받는다
   * (외환 시나리오 08·09). 그래서 경남은행 직원은 6단계를 밟지 않고 결론·필요
   * 서류·고객 안내를 한 장으로 받는다 — 개선이 무엇을 바꿨는지가 이 차이로 드러난다.
   */
  const fxImproved = isFx && tenant === '경남은행';

  const [stepIdx, setStepIdx] = useState(-1);
  const [activeRef, setActiveRef] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const piiHits = useMemo(() => detectPii(input), [input]);
  const blocked = piiHits.length > 0;

  /** 근거를 잇지 못하면 앵커링에서 멈춘다 — 단계를 끝까지 돌리지 않는다. */
  const steps =
    pending?.steps ??
    (pending?.att ? ATTACH_STEPS : pending?.sc || pending?.doc ? RUN_STEPS : RUN_STEPS.slice(0, 2));

  /* 재생 — 단계 하나씩 진행 후 답변을 커밋한다. */
  useEffect(() => {
    if (!pending) return;
    if (stepIdx >= steps.length) {
      const sc = pending.sc;
      const doc = pending.doc;
      const ans = pending.ans;
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          // 첨부 답변이 있으면 그것이 우선한다 — 첨부 턴은 인덱스를 타지 않는다.
          // 없으면 온톨로지 에이전트는 확정 판정을, 문서 RAG 에이전트는 인용 요약을 낸다.
          // 셋 다 못 잡으면 그때만 "근거를 잇지 못했다"로 떨어진다.
          text: ans ?? (sc ? sc.verdict : (doc?.a ?? UNGROUNDED_ANSWER.head)),
          sc: ans ? undefined : (sc ?? undefined),
          plain: !!ans || (!sc && !!doc),
          card: pending.card,
          fx: pending.fxCard,
        },
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

  /**
   * 첨부에 붙은 작업(요약·번역·추출)을 자유 입력에서도 잡는다.
   *
   * 작업 버튼으로만 첨부를 쓰게 하면, 파일을 올린 사람이 "요약해줘" 라고 타이핑했을 때
   * 첨부를 무시한 답이 나온다 — 시연에서 가장 나기 쉬운 사고라 키워드로 이어 준다.
   */
  const matchAttachAction = (q: string): AttachAction | null => {
    if (!attached || attached.verdict === 'blocked') return null;
    return attached.actions.find((a) => q.includes(a.kind)) ?? null;
  };

  const send = (raw?: string, act?: AttachAction) => {
    const q = (act?.q ?? raw ?? input).trim();
    if (!q || pending) return;
    if (detectPii(q).length > 0) return; // 차단 상태에서는 전송 자체가 일어나지 않는다
    // 고객 상담 에이전트 — 현재 단계에서 입력을 해석해 카드 턴으로 간다.
    if (isConsult) {
      const turn = matchConsultTurn(consult.stage, q);
      if (turn) {
        setMsgs((m) => [...m, { role: 'user', text: q }]);
        setInput('');
        setConsult((c) => ({ ...c, stage: turn.next, name: turn.name ?? c.name }));
        setPending({ q, sc: null, doc: null, att: null, ans: turn.text, steps: turn.steps, card: turn.card });
        setStepIdx(0);
        return;
      }
    }
    // 외환업무 에이전트 — 첫 입력을 문의 접수(또는 개선판 한 장)로 받는다.
    if (isFx) {
      const turn = matchFxTurn(fx.stage, q, fxImproved);
      if (turn) {
        setMsgs((m) => [...m, { role: 'user', text: q }]);
        setInput('');
        setFx((c) => ({ ...c, stage: turn.next }));
        setPending({ q, sc: null, doc: null, att: null, ans: turn.text, steps: turn.steps, fxCard: turn.card });
        setStepIdx(0);
        return;
      }
    }
    const action = act ?? matchAttachAction(q);
    const att = action ? attached : null;
    setMsgs((m) => [...m, { role: 'user', text: q, att: att ?? undefined }]);
    setInput('');
    setPending({
      q,
      sc: action ? null : agent.ontology ? matchScenario(q) : null,
      doc: action ? null : agent.ontology ? null : matchDocAnswer(agent.id, q),
      att,
      ans: action?.a ?? null,
    });
    setStepIdx(0);
  };

  /* 카드 버튼이 일으키는 전이 — 행원의 타이핑 없이 다음 카드로 간다. */
  const consultHandlers = {
    onName: (v: string) => setConsult((c) => ({ ...c, name: v })),
    onBackground: (v: string) => setConsult((c) => ({ ...c, background: v })),
    onToggle: (t: string) => setConsult((c) => ({ ...c, affiliates: { ...c.affiliates, [t]: !c.affiliates[t] } })),
    onProfileSubmit: () => {
      setConsult((c) => ({ ...c, stage: 'consent' }));
      setMsgs((m) => [...m, { role: 'assistant', text: CONSULT_TEXT.consent, plain: true, card: 'consent' }]);
    },
    onConsentConfirm: () => {
      toast('동의 권원 확인', '사전 동의 이력 확인 · 통합 감사 원장에 기록되었습니다', 'ok');
      setConsult((c) => ({ ...c, stage: 'analysis' }));
      setPending({ q: '조회', sc: null, doc: null, att: null, ans: CONSULT_TEXT.analysis, steps: CONSULT_STEPS_LOOKUP, card: 'analysis' });
      setStepIdx(0);
    },
    onSave: () => {
      setConsult((c) => ({ ...c, saved: true }));
      toast('고객 상담 자료로 저장', `${consult.name} · 추천 상품 3건 · 내 문서 > 상담 자료에 저장되었습니다`, 'ok');
    },
  };
  const lastCardIdx = msgs.reduce((acc, m, i) => (m.card ? i : acc), -1);

  /* 외환 카드 버튼이 일으키는 전이 — 직원의 타이핑 없이 다음 카드로 간다. */
  const fxStep = (card: FxCardKind, steps: typeof RUN_STEPS) => {
    setFx((c) => ({ ...c, stage: card }));
    setPending({ q: card, sc: null, doc: null, att: null, ans: FX_TEXT[card], steps, fxCard: card });
    setStepIdx(0);
  };
  const fxHandlers = {
    onInstruction: (v: string) => setFx((c) => ({ ...c, instruction: v })),
    onFeedbackText: (v: string) => setFx((c) => ({ ...c, feedback: v })),
    // 서류를 올리는 화면은 실행 단계가 없다 — 아직 아무것도 읽지 않았다.
    onIntakeNext: () => {
      setFx((c) => ({ ...c, stage: 'upload' }));
      setMsgs((m) => [...m, { role: 'assistant', text: FX_TEXT.upload, plain: true, fx: 'upload' }]);
    },
    onReviewRequest: () => fxStep('result', FX_STEPS_REVIEW),
    onShowEvidence: () => fxStep('evidence', FX_STEPS_EVIDENCE),
    onWrapup: () => fxStep('wrapup', FX_STEPS_WRAPUP),
    /*
     * LSM-012 — 수집으로 끝내지 않는다. 현장 의견이 **결재 건**이 되어
     * 계열사 관리자에게 넘어간다(외환 시나리오 06 → 07 전환점).
     */
    onSubmitFeedback: () => {
      const item = submitImprovement({
        agentId: agent.id,
        agentName: agent.name,
        version: FX_IMPROVED_VERSION,
        ownerTenant: '부산은행',
        requestedBy: persona?.name ?? '서사용',
        requesterRole: persona?.role ?? '일반 사용자',
        requesterDept: persona?.dept ?? FX_FEEDBACK.by,
        feedback: fx.feedback.trim(),
        elements: FX_IMPROVEMENT_ELEMENTS,
        checks: FX_IMPROVEMENT_CHECKS,
      });
      setFx((c) => ({ ...c, submitted: true, approvalId: item.id }));
      toast(
        '개선 의견을 등록했습니다',
        `${item.id} · ${item.stage.label} — 개발자와 다른 승인자가 검토합니다`,
        'ok',
      );
    },
  };
  const lastFxIdx = msgs.reduce((acc, m, i) => (m.fx ? i : acc), -1);

  const reset = () => {
    setConsult(INITIAL_CONSULT);
    setFx(INITIAL_FX);
    setMsgs([]);
    setInput('');
    setPending(null);
    setStepIdx(-1);
    setActiveRef(null);
    setActiveHistory(null);
    setAttached(null);
    setAttachOpen(false);
  };

  /** 이어하기(2-1) — 이력 항목을 클릭하면 그 대화를 복원하고 이어서 질문할 수 있다. */
  const [activeHistory, setActiveHistory] = useState<string | null>(null);

  /*
   * 계열사가 바뀌면 대화를 비운다.
   *
   * 좌측 사이드바가 "대화는 계열사 Namespace 안에서만 보관됩니다" 라고 적어 두고
   * 실제로는 부산은행 대화가 경남은행 화면에 그대로 남아 있으면, 그 화면이
   * SEC-001 격리 서사를 스스로 반증한다. 시연에서 페르소나를 바꾸는 순간
   * (프리젠터 이동 포함) 바로 드러나는 종류라 여기서 끊는다.
   *
   * 첫 렌더에도 한 번 돌지만 그때는 이미 비어 있어 아무 일도 하지 않는다.
   */
  useEffect(() => {
    setMsgs([]);
    setInput('');
    setPending(null);
    setStepIdx(-1);
    setActiveRef(null);
    setActiveHistory(null);
    setAttached(null);
    setAttachOpen(false);
    setConsult(INITIAL_CONSULT);
    setFx(INITIAL_FX);
  }, [tenant]);
  const openHistory = (id: string) => {
    const seed = seedHistory(id);
    if (!seed || pending) return;
    setAgent(seed.agent);
    setMsgs(seed.msgs.map((m) => ({ role: m.role, text: m.text, sc: m.sc, plain: m.plain })));
    setInput('');
    setPending(null);
    setStepIdx(-1);
    setActiveRef(null);
    setActiveHistory(id);
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
                      <button
                        type="button"
                        onClick={() => openHistory(h.id)}
                        className={cn(
                          'w-full text-left rounded px-2 py-1.5 transition-colors',
                          activeHistory === h.id
                            ? 'bg-brand-tint border border-brand-tint'
                            : 'hover:bg-surface-soft border border-transparent',
                        )}
                      >
                        <div className="text-[11.5px] font-bold text-ink-dark truncate">{h.title}</div>
                        <div className="text-[10px] text-ink-light font-semibold mt-0.5">
                          {h.agent} · {h.at}
                        </div>
                      </button>
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
              options={agentOptions.map((a) => ({ k: a.id, label: a.name, hint: a.desc }))}
              onPick={(k) => {
                const a = agentOptions.find((x) => x.id === k)!;
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
            {msgs.length === 0 && !pending && (
              isConsult ? (
                /* 상담 에이전트의 빈 화면 — 규정 질의 알약이 아니라 상담 시작 안내를 준다. */
                <div className="og-answer mb-4 border border-line-soft rounded px-5 py-5 bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="pill bg-brand-tint text-brand border border-brand-tint">고객 상담</span>
                    <span className="text-[13px] font-extrabold text-ink">상담 대상 고객과 배경을 알려주세요</span>
                  </div>
                  <p className="text-[12px] text-ink-dark font-semibold leading-relaxed">
                    고객 정보는 고객 DB 가상 뷰에서 조회해 채웁니다. 프로필 등록 → 동의 확인 → 데이터 조회 → 분석 → 상품 추천 → 상담 요약 순서로 이어집니다.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {consultSuggestions('idle').map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isFx ? (
                <FxStart
                  persona={persona?.name}
                  tenant={tenant}
                  improved={fxImproved}
                  onPickTask={(id) => {
                    const a = agentOptions.find((x) => x.id === id);
                    if (a) setAgent(a);
                  }}
                  onStart={() =>
                    send(fxImproved ? fxSuggestions('idle', true)[0] : FX_CUSTOMER_QUESTION)
                  }
                />
              ) : (
                <EmptyState onPick={send} persona={persona?.name} />
              )
            )}

            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <UserBubble key={i} text={m.text} att={m.att} />
              ) : m.fx ? (
                <FxTurn
                  key={i}
                  kind={m.fx}
                  text={m.text}
                  latest={i === lastFxIdx}
                  done={fxStageIndex(fx.stage) > fxStageIndex(m.fx)}
                  state={fx}
                  handlers={fxHandlers}
                />
              ) : m.card ? (
                <ConsultTurn
                  key={i}
                  kind={m.card}
                  text={m.text}
                  latest={i === lastCardIdx}
                  done={stageIndex(consult.stage) > stageIndex(m.card)}
                  state={consult}
                  handlers={consultHandlers}
                />
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

            {/* 첨부 상태 — 반입 검사 결과와 가능한 작업을 입력창 바로 위에 붙인다. */}
            {attached && (
              <AttachBar
                att={attached}
                disabled={!!pending}
                onRemove={() => setAttached(null)}
                onAct={(a) => send(undefined, a)}
              />
            )}

            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
                추천 질의
              </span>
              {/* 에이전트마다 답할 수 있는 질의가 다르다 — 온톨로지 계열은 규정 판정,
                  문서 RAG 계열은 자기 지식 인덱스 범위. 목록을 고정하면 고른 에이전트가
                  답하지 못하는 질의를 추천하게 된다. */}
              {(isConsult
                ? consultSuggestions(consult.stage)
                : isFx
                ? fxSuggestions(fx.stage, fxImproved)
                : suggestedQuestions(agent.id)
              ).map((q) => (
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
                'relative flex items-end gap-2 border rounded px-3 py-2 bg-white transition-colors',
                blocked ? 'border-bad ring-1 ring-bad/30' : 'border-line focus-within:border-brand-dark',
              )}
            >
              {/* RFP 2-1 — 대화중 파일 업로드(문서/이미지). */}
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                className={cn(
                  'text-[15px] leading-none pb-1 transition-colors',
                  attachOpen || attached ? 'text-brand' : 'text-ink-light hover:text-ink-mid',
                )}
                title="파일 첨부"
              >
                📎
              </button>
              {attachOpen && (
                <AttachPicker
                  onPick={(f) => {
                    setAttached(f);
                    setAttachOpen(false);
                  }}
                  onClose={() => setAttachOpen(false)}
                />
              )}
              <textarea
                data-demo-chat-input="true"
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
            {/* SEC-008 — 사후 학습·재활용 목적 저장 시 원본 식별 불가 처리 */}
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-light font-semibold">
              <span>생성형 AI 산출물입니다 · 확정 근거가 표시되지 않은 내용은 업무 판단의 최종 근거로 쓰지 마십시오</span>
              <span className="ml-auto flex-shrink-0" title="SEC-008 — 재활용 목적 저장 시 원본 식별이 불가능하도록 자동 비식별화">
                🔒 대화·첨부는 저장 시 자동 비식별화
              </span>
            </div>
          </div>
        </section>

        {/* ── 우: 근거 ── */}
        <aside className="card flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
            <h2 className="text-[13px] font-extrabold text-ink">근거</h2>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
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

          {/*
            개인 문서 저장소(19) — 대화창 첨부(18)와는 다른 축이다. 여기 쌓인
            문서는 개인별 격리 인덱스에 들어가 에이전트 개발·대화에 계속
            활용되고, 첨부는 그 턴에서만 쓰이는 일회성이다.
          */}
          <div className="border-t border-line-soft px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <h3 className="text-[11.5px] font-extrabold text-ink">개인 문서 저장소</h3>
              <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
                2-1 개인문서 RAG
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {PERSONAL_DOCS.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="text-ink-light flex-shrink-0">📄</span>
                  <span className="font-bold text-ink-dark truncate flex-1">{d.name}</span>
                  <span
                    className={cn(
                      'text-[9px] font-extrabold flex-shrink-0',
                      d.state === '적재 완료' ? 'text-ok' : d.state === '실패' ? 'text-bad' : 'text-info',
                    )}
                  >
                    {d.state}
                  </span>
                </div>
              ))}
            </div>
            <Link
              to="/documents"
              className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-extrabold text-info hover:underline"
            >
              + 문서 등록 →
            </Link>
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

/**
 * 외환업무 에이전트의 빈 화면 — 외환 시나리오 화면 01 「업무 시작」.
 *
 * 원안은 포털에 별도의 업무 선택 화면을 두지만, 이 데모에는 이미 마켓플레이스와
 * 홈이 진입 경로를 맡고 있다. 같은 일을 하는 화면을 하나 더 만들면 IA 가 갈라지므로
 * **에이전트를 고른 직후의 빈 대화 화면**이 그 역할을 한다.
 *
 * 세 카드는 장식이 아니라 **실제 에이전트로 전환**한다. 누를 수는 있는데 아무
 * 일도 일어나지 않는 카드를 시연 화면에 두지 않는다.
 */
function FxStart({
  persona,
  tenant,
  improved,
  onPickTask,
  onStart,
}: {
  persona?: string;
  tenant: string;
  improved: boolean;
  onPickTask: (agentId: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="og-answer mb-4 border border-line-soft rounded px-5 py-5 bg-white">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="pill bg-brand-tint text-brand border border-brand-tint">외환업무</span>
        <span className="text-[11px] text-ink-mid font-semibold">
          BNK AI 포털 · {tenant} / {persona ?? '직원'}
        </span>
        {improved && (
          <span className="pill bg-ok-bg text-ok border border-ok-border">개선 버전 적용됨</span>
        )}
      </div>
      <h2 className="text-[17px] font-extrabold text-ink tracking-[-0.3px]">
        오늘 어떤 업무를 도와드릴까요?
      </h2>
      <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
        필요한 업무를 고르고, 평소 쓰는 말로 질문하십시오.
      </p>

      <div className="grid grid-cols-3 gap-2.5 mt-4">
        {FX_TASK_CARDS.map((c) => {
          const active = c.agentId === FX_AGENT_ID;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !active && onPickTask(c.agentId)}
              className={cn(
                'text-left rounded border-2 px-3.5 py-3 transition-colors',
                active
                  ? 'border-brand bg-brand-bg cursor-default'
                  : 'border-line-soft bg-white hover:border-line-warm',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[13px] font-extrabold', active ? 'text-brand' : 'text-ink')}>
                  {c.label}
                </span>
                {active && <span className="text-[11px] text-brand font-extrabold">✓</span>}
              </div>
              <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-snug">{c.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-[10.5px] text-ink-light font-semibold flex-1 leading-snug">
          {improved
            ? '부산은행에서 개선하고 검증한 응답 형식이 적용되어 있습니다.'
            : '고객 문의를 그대로 옮겨 적어도 됩니다 — 확인 포인트로 정리해 드립니다.'}
        </span>
        <Button variant="primary" onClick={onStart}>
          외환업무 시작 →
        </Button>
      </div>
    </div>
  );
}

function UserBubble({ text, att }: { text: string; att?: AttachFile }) {
  return (
    <div className="flex justify-end mb-3.5">
      <div className="max-w-[76%] flex flex-col items-end gap-1">
        {/* 2-1 — 어떤 파일을 붙여 물었는지가 답변 이력에 남아야 한다. */}
        {att && (
          <div className="inline-flex items-center gap-1.5 bg-white border border-line rounded px-2 py-1">
            <span className="text-[11px]">📄</span>
            <span className="text-[10.5px] font-extrabold text-ink-dark">{att.name}</span>
            <span className={cn('pill text-[9px]', ATTACH_VERDICT_TONE[att.verdict])}>
              {ATTACH_VERDICT_LABEL[att.verdict]}
            </span>
          </div>
        )}
        <div className="bg-brand-tint border border-brand-tint rounded px-3.5 py-2.5">
          <span className="text-[12.5px] font-bold text-ink leading-relaxed">{text}</span>
        </div>
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

  /* 문서 RAG 일반 답변 — 이력 복원용. 근거 그래프가 없는 에이전트의 답변이다. */
  if (msg.plain) {
    return (
      <div className="og-answer mb-4 border border-line-soft rounded px-4 py-3.5 bg-white">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="pill bg-surface text-ink-mid border border-line-soft">문서 RAG</span>
          <span className="text-[10px] text-ink-light font-semibold">지식 인덱스 근거 · 확정 판정 아님</span>
        </div>
        <p className="text-[12.5px] text-ink-dark font-semibold leading-relaxed">{msg.text}</p>
        <AnswerActions answerId="ANS-DOCRAG" title="문서 RAG 답변" body={msg.text} />
      </div>
    );
  }

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

      <AnswerActions
        answerId={sc.id}
        title={sc.question}
        body={sc.verdict}
        basis={sc.ruleBasis}
        caveat={sc.caveat}
      />
    </div>
  );
}

/**
 * 답변 피드백(17) · 문서 출력(23).
 *
 * RFP 2-1: "답변 피드백(rating, 좋아요/싫어요, 의견) 제공(**사용자**) 및 조회(관리자)"
 *          "문서 출력 기능 제공"
 *
 * 조회(관리자) 쪽은 ConversationsTab 에 이미 있었다 — 여기는 그 짝인 "제공(사용자)" 다.
 *
 * 문서 출력은 토스트만 띄우던 자리였다. 그러면 요건 문장("문서 출력 기능 제공")에
 * 대응하는 화면이 없는 것과 같아서, **무엇이 어떤 형태로 나가는지**를 미리보기로
 * 보여 주도록 바꿨다. 출력물에도 비식별 상태와 면책 문구가 따라간다는 것이
 * 이 모달의 요지다(SEC-008).
 */
function AnswerActions({
  answerId,
  title,
  body,
  basis,
  caveat,
}: {
  answerId: string;
  title: string;
  body: string;
  basis?: { clause: string; body: string }[];
  caveat?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [picked, setPicked] = useState<'up' | 'down' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  const pick = (v: 'up' | 'down') => {
    setPicked(v);
    if (v === 'down') {
      setShowComment(true);
    } else {
      toast('피드백을 남겼습니다 — 감사합니다');
      setSent(true);
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-line-soft">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-ink-light font-semibold">이 답변이 도움이 됐나요?</span>
        <button
          type="button"
          onClick={() => pick('up')}
          className={cn(
            'w-[22px] h-[22px] rounded inline-flex items-center justify-center text-[12px] border',
            picked === 'up' ? 'bg-ok-bg border-ok-border' : 'border-line-soft hover:border-line',
          )}
        >👍</button>
        <button
          type="button"
          onClick={() => pick('down')}
          className={cn(
            'w-[22px] h-[22px] rounded inline-flex items-center justify-center text-[12px] border',
            picked === 'down' ? 'bg-bad-bg border-bad-border' : 'border-line-soft hover:border-line',
          )}
        >👎</button>
        <button
          type="button"
          onClick={() => setExporting(true)}
          className="ml-auto text-[10.5px] font-extrabold text-ink-mid hover:text-brand"
        >⇩ 문서로 출력</button>
      </div>

      {exporting && (
        <DocExportModal
          answerId={answerId}
          title={title}
          body={body}
          basis={basis}
          caveat={caveat}
          onClose={() => setExporting(false)}
        />
      )}

      {showComment && !sent && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="어떤 점이 아쉬웠나요? (선택)"
            className="flex-1 py-1 px-2 border border-line rounded text-[11px] bg-white"
          />
          <button
            type="button"
            onClick={() => { toast('의견을 남겼습니다 — 개선요청으로 접수됩니다'); setSent(true); }}
            className="py-1 px-2.5 bg-brand border border-brand-dark rounded text-[10.5px] font-extrabold text-white hover:bg-brand-dark"
          >제출</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ 첨부 ═══════════════════════ */

/**
 * 첨부 파일 선택 — 로컬 파일 선택과 개인 문서 저장소 두 경로를 둔다.
 *
 * 시연에서는 파일 탐색기를 열 수 없으므로 표본 파일을 목록으로 제공한다.
 * 표본은 판정별로 하나씩이라 어느 것을 골라도 다른 장면이 나온다 —
 * 정상 / 자동 비식별 / 번역 / DRM 차단.
 */
function AttachPicker({
  onPick,
  onClose,
}: {
  onPick: (f: AttachFile) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* 바깥 클릭으로 닫기 */}
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[420px] card shadow-lg p-0 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-line-soft flex items-center gap-2">
          <h3 className="text-[12px] font-extrabold text-ink">파일 첨부</h3>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
            2-1 파일 업로드
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[11px] text-ink-light hover:text-ink-dark font-extrabold"
          >
            ✕
          </button>
        </div>

        <div className="px-3.5 py-2.5 border-b border-line-soft">
          <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] mb-1.5">
            내 PC에서 선택
          </div>
          <div className="flex flex-col gap-1">
            {ATTACH_SAMPLES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPick(f)}
                className="flex items-center gap-2 text-left border border-line-soft rounded px-2.5 py-1.5 hover:border-brand-dark hover:bg-brand-bg transition-colors"
              >
                <span className="text-[12px] flex-shrink-0">📄</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-bold text-ink-dark truncate">{f.name}</span>
                  <span className="block text-[9.5px] text-ink-light font-semibold">
                    {f.ext} · {f.sizeMB}MB · {f.kind}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3.5 py-2.5">
          <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] mb-1.5">
            개인 문서 저장소에서 선택
          </div>
          <div className="flex flex-col gap-0.5">
            {PERSONAL_DOCS.filter((d) => d.state === '적재 완료').map((d) => (
              <div key={d.id} className="flex items-center gap-1.5 text-[10.5px] px-1">
                <span className="text-ink-light">📄</span>
                <span className="font-bold text-ink-dark truncate flex-1">{d.name}</span>
                <span className="text-[9.5px] text-ok font-extrabold flex-shrink-0">
                  인덱스 적재됨
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9.5px] text-ink-light font-semibold leading-snug">
            저장소 문서는 이미 개인 격리 인덱스에 있어 첨부 없이도 대화에서 검색됩니다.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * 첨부 상태 표시줄 — 반입 검사 결과와 그 결과로 할 수 있는 일을 함께 보여 준다.
 *
 * 검사 결과를 감추고 작업 버튼만 두면 SEC-004·SEC-008 을 화면으로 증명할 수 없다.
 * 차단(DRM)일 때는 작업 버튼 대신 사유와 다음 절차를 그 자리에 놓는다.
 */
function AttachBar({
  att,
  disabled,
  onRemove,
  onAct,
}: {
  att: AttachFile;
  disabled: boolean;
  onRemove: () => void;
  onAct: (a: AttachAction) => void;
}) {
  const blocked = att.verdict === 'blocked';
  return (
    <div
      className={cn(
        'mb-2 border rounded px-3 py-2.5',
        blocked ? 'border-bad-border bg-bad-bg' : 'border-line bg-surface-soft',
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px]">📄</span>
        <span className="text-[11.5px] font-extrabold text-ink-dark">{att.name}</span>
        <span className="text-[10px] text-ink-light font-semibold">
          {att.ext} · {att.sizeMB}MB
          {att.pages ? ` · ${att.pages}쪽` : ''}
          {att.chunks ? ` · 청크 ${att.chunks}` : ''}
        </span>
        <span className={cn('pill text-[9.5px]', ATTACH_VERDICT_TONE[att.verdict])}>
          {ATTACH_VERDICT_LABEL[att.verdict]}
        </span>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
          {blocked ? 'SEC-005' : att.verdict === 'masked' ? 'SEC-008' : '2-1'}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-[10.5px] font-extrabold text-ink-light hover:text-bad"
        >
          첨부 제거
        </button>
      </div>

      <div className="mt-1.5 text-[10.5px] font-semibold text-ink-mid">
        {att.scan}
        {att.maskedItems && (
          <span className="text-warn"> — {att.maskedItems.join(' · ')}</span>
        )}
      </div>

      {blocked ? (
        <div className="mt-2 pt-2 border-t border-bad-border">
          <p className="text-[11px] font-bold text-bad leading-relaxed">{att.blockReason}</p>
          <p className="mt-1 text-[10.5px] text-ink-mid font-semibold leading-relaxed">
            {att.blockNext}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
            이 파일로
          </span>
          {att.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={disabled}
              onClick={() => onAct(a)}
              className="pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          <span className="ml-auto text-[9.5px] text-ink-light font-semibold">
            {ATTACH_RETENTION_NOTE}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 문서 출력 — RFP 2-1 사용자 포털 "문서 출력 기능 제공".
 *
 * 실제 파일 생성은 데모 범위 밖이라 **출력물의 형태**를 미리보기로 확정해 보여 준다.
 * 형식·포함 항목을 고르면 미리보기가 즉시 바뀌므로, 무엇이 문서로 나가는지가
 * 클릭 한 번에 드러난다. 근거 조항을 뺄 수 있게 둔 것은 대외 공유용과 내부 검토용의
 * 출력물이 달라야 하기 때문이다.
 */
function DocExportModal({
  answerId,
  title,
  body,
  basis,
  caveat,
  onClose,
}: {
  answerId: string;
  title: string;
  body: string;
  basis?: { clause: string; body: string }[];
  caveat?: string;
  onClose: () => void;
}) {
  const persona = useCurrentPersona();
  const [fmt, setFmt] = useState<'DOCX' | 'PDF' | 'HWP'>('DOCX');
  const [withBasis, setWithBasis] = useState(true);
  const [withCaveat, setWithCaveat] = useState(true);

  const FORMATS: ('DOCX' | 'PDF' | 'HWP')[] = ['DOCX', 'PDF', 'HWP'];

  /*
   * ⚠️ `document.body` 로 포털한다.
   *   답변 말풍선(`.og-answer`)에 등장 애니메이션용 `transform` 이 걸려 있어서,
   *   그 안에 두면 `position: fixed` 의 기준이 뷰포트가 아니라 말풍선이 된다 —
   *   모달이 말풍선 안에 갇혀 헤더와 버튼이 잘린다.
   */
  return createPortal(
    <div className="fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-8" onClick={onClose}>
      <div
        className="card w-[720px] max-h-[86vh] flex flex-col p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2">
          <h3 className="text-[13px] font-extrabold text-ink">문서 출력</h3>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
            2-1 문서 출력
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[12px] text-ink-light hover:text-ink-dark font-extrabold"
          >
            ✕
          </button>
        </div>

        {/* 옵션 */}
        <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2 flex-wrap">
          <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">형식</span>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFmt(f)}
              className={cn(
                'pill border font-mono tracking-normal',
                fmt === f
                  ? 'bg-brand text-white border-brand-dark'
                  : 'bg-white text-ink-mid border-line hover:border-brand',
              )}
            >
              {f}
            </button>
          ))}
          <span className="ml-3 text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
            포함
          </span>
          <button
            type="button"
            onClick={() => setWithBasis((v) => !v)}
            className={cn(
              'pill border',
              withBasis ? 'bg-ok-bg text-ok border-ok-border' : 'bg-white text-ink-light border-line',
            )}
          >
            {withBasis ? '☑' : '☐'} 근거 조항
          </button>
          <button
            type="button"
            onClick={() => setWithCaveat((v) => !v)}
            className={cn(
              'pill border',
              withCaveat ? 'bg-ok-bg text-ok border-ok-border' : 'bg-white text-ink-light border-line',
            )}
          >
            {withCaveat ? '☑' : '☐'} 미확정 사항
          </button>
        </div>

        {/* 미리보기 — 종이 한 장 */}
        <div className="flex-1 overflow-y-auto bg-surface-soft px-6 py-5 min-h-0">
          <div className="bg-white border border-line rounded shadow-sm px-8 py-7 mx-auto max-w-[560px]">
            <div className="text-[9px] font-extrabold text-ink-light uppercase tracking-[0.5px] pb-2 border-b border-line-soft">
              BNK 그룹 공동 생성형 AI 플랫폼 · 대외 배포 금지
            </div>
            <h4 className="mt-3.5 text-[15px] font-extrabold text-ink leading-snug">{title}</h4>
            <div className="mt-1 text-[10px] text-ink-light font-semibold">
              생성일 {DEMO_TODAY} · 요청자 {persona?.name ?? '—'} · 출력 ID {answerId}
            </div>

            <p className="mt-4 text-[11.5px] text-ink-dark font-semibold leading-relaxed whitespace-pre-line">
              {body}
            </p>

            {withBasis && basis && basis.length > 0 && (
              <div className="mt-4 pt-3 border-t border-line-soft">
                <div className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px] mb-1.5">
                  근거 조항
                </div>
                <ul className="flex flex-col gap-1.5">
                  {basis.map((b) => (
                    <li key={b.clause} className="text-[10.5px] leading-relaxed">
                      <b className="text-ink-dark">{b.clause}</b>
                      <span className="text-ink-mid"> — {b.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {withCaveat && caveat && (
              <div className="mt-3.5 border border-warn-border bg-warn-bg rounded px-3 py-2">
                <div className="text-[9.5px] font-extrabold text-warn uppercase tracking-[0.4px]">
                  확정하지 못한 부분
                </div>
                <p className="mt-0.5 text-[10.5px] text-ink-dark font-semibold leading-relaxed">{caveat}</p>
              </div>
            )}

            <div className="mt-4 pt-2.5 border-t border-line-soft text-[9px] text-ink-light font-semibold leading-relaxed">
              본 문서는 생성형 AI 산출물이며 업무 판단의 최종 근거로 사용할 수 없습니다. 출력 시점에
              민감정보는 비식별 처리된 상태로 유지됩니다(SEC-008). 출력 행위는 감사 원장에 기록됩니다.
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-line-soft flex items-center gap-2">
          <span className="text-[10.5px] text-ink-light font-semibold">
            {fmt} · 근거 조항 {withBasis ? '포함' : '제외'} · 미확정 사항 {withCaveat ? '포함' : '제외'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-8 px-3 rounded border border-line bg-white text-[11.5px] font-extrabold text-ink-mid hover:border-ink-light"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              toast(`${fmt} 문서를 생성했습니다`, `출력 ID ${answerId} · 감사 원장 기록됨`, 'ok');
              onClose();
            }}
            className="h-8 px-4 rounded bg-brand border border-brand-dark text-white text-[11.5px] font-extrabold hover:bg-brand-dark"
          >
            ⇩ {fmt}로 출력
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
        to="/knowledge/ontology"
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
        <span className="ml-auto pill bg-white text-bad border border-bad-border font-mono tracking-normal rfp-chip">
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
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
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
