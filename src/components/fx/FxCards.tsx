/**
 * 외환업무 카드 — 대화 답변 버블 안에 들어가는 조각들 (외환 시나리오 02 ~ 06 · 10).
 *
 * RFP: AGB-006 ⑨ · 2-1 대화중 파일 업로드 · LSM-012 사용자 피드백 · SEC-004 · SEC-008
 *
 * 고객 상담 카드(`consult/ConsultCards`)와 같은 규약을 따른다 —
 * 완료된 카드는 한 줄로 접히고, 데이터는 전부 `mockFxAssist` 에서 온다.
 * 여기엔 문구를 두지 않는다(시연 직전 수정은 mock 한 곳만 본다).
 *
 * ⚠️ 레이아웃 주의 — 대화 컬럼은 1280×720 에서 **약 590px** 까지 좁아진다
 *    (1920 에서는 약 1070px). 그래서 원문 인용 카드는 원안의 좌우 2단이 아니라
 *    **전폭 세로 배치**로 바꿨다. 좁은 폭에서 좌우로 쪼개면 이 시나리오의
 *    클라이맥스인 "For spare-parts kits only" 가 두 글자씩 줄바꿈되어 죽는다.
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  FX_ATTACH_SCAN,
  FX_CHECK_POINTS,
  FX_CUSTOMER,
  FX_CUSTOMER_DRAFT,
  FX_CUSTOMER_QUESTION,
  FX_EVIDENCE,
  FX_FEEDBACK,
  FX_FOLLOWUP,
  FX_IMPROVED_NOTE,
  FX_IMPROVED_ROWS,
  FX_INSTRUCTION,
  FX_ITEM_VERDICTS,
  FX_ORIGIN_CLAUSE,
  FX_RESULT,
  FX_RETENTION_NOTE,
  FX_UPLOAD_SLOTS,
  FX_WRAPUP_TAGS,
} from '@/data/mockFxAssist';
import type { FxCardKind } from '@/data/mockFxChat';

export interface FxState {
  /** 직원이 적는 검토 지시 — 평문 그대로 결과 카드의 확인 범위가 된다. */
  instruction: string;
  /** 개선 의견 본문. 화면 07 결재의 기안 내용이 된다. */
  feedback: string;
  /** 개선 의견을 상신했는가. */
  submitted: boolean;
  /** 상신으로 만들어진 결재 번호 — 카드에서 결재함으로 이어 준다. */
  approvalId?: string;
}

export interface FxHandlers {
  onInstruction: (v: string) => void;
  onFeedbackText: (v: string) => void;
  /** 02 → 03 */
  onIntakeNext: () => void;
  /** 03 → 04 */
  onReviewRequest: () => void;
  /** 04 → 05 */
  onShowEvidence: () => void;
  /** 05 → 06 */
  onWrapup: () => void;
  /** 06 → 화면 07 결재 생성 */
  onSubmitFeedback: () => void;
}

const CARD_TITLE: Record<FxCardKind, string> = {
  intake: '확인 포인트',
  upload: '서류 검토 요청',
  result: '검사서 검토 결과',
  evidence: '변경 전문의 근거',
  wrapup: '업무 마무리 · 고객 안내',
  improved: '검토 결과 (개선 버전)',
};

/**
 * 답변 한 턴 — AI 문장 + 카드. `latest` 가 아니면 접힌다.
 * `done` 은 이 카드의 버튼이 이미 눌렸는지 — 눌린 버튼은 다시 못 누른다.
 */
export function FxTurn({
  kind,
  text,
  latest,
  done,
  state,
  handlers,
}: {
  kind: FxCardKind;
  text: string;
  latest: boolean;
  done: boolean;
  state: FxState;
  handlers: FxHandlers;
}) {
  const [open, setOpen] = useState(latest);
  useEffect(() => {
    if (!latest) setOpen(false);
  }, [latest]);

  return (
    <div className="og-answer mb-4 border border-line-soft rounded bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-start gap-2 border-b border-line-soft bg-surface-soft">
        <span className="pill bg-brand-tint text-brand border border-brand-tint shrink-0">외환업무</span>
        <p className="text-[12.5px] text-ink-dark font-semibold leading-relaxed min-w-0">{text}</p>
        {!latest && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto shrink-0 text-[11px] font-bold text-ink-mid hover:text-ink"
          >
            {open ? '접기 ▴' : `${CARD_TITLE[kind]} 펼치기 ▾`}
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 py-3.5">
          {kind === 'intake' && <IntakeCard onNext={handlers.onIntakeNext} done={done} />}
          {kind === 'upload' && <UploadCard state={state} handlers={handlers} done={done} />}
          {kind === 'result' && <ResultCard onEvidence={handlers.onShowEvidence} done={done} />}
          {kind === 'evidence' && <EvidenceCard onWrapup={handlers.onWrapup} done={done} />}
          {kind === 'wrapup' && <WrapupCard state={state} handlers={handlers} />}
          {kind === 'improved' && <ImprovedCard />}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ 02 고객 질문 접수 ═══════════════ */

function IntakeCard({ onNext, done }: { onNext: () => void; done: boolean }) {
  return (
    <div>
      {/* 고객의 말 그대로 — 인용이 이 화면의 출발점이다 */}
      <blockquote className="border-l-[3px] border-brand pl-3 py-0.5 mb-3">
        <p className="text-[15px] font-extrabold text-ink leading-snug tracking-[-0.2px]">
          “{FX_CUSTOMER_QUESTION}”
        </p>
        <p className="text-[11px] text-ink-mid font-semibold mt-1">
          {FX_CUSTOMER.where} <b className="text-ink-dark">{FX_CUSTOMER.name}</b>(가상) ·{' '}
          {FX_CUSTOMER.what} · {FX_CUSTOMER.branch}
        </p>
      </blockquote>

      <div className="text-[11.5px] font-extrabold text-ink mb-1.5">직원이 함께 확인해야 할 세 가지</div>
      <div className="grid grid-cols-3 gap-2">
        {FX_CHECK_POINTS.map((p) => (
          <section key={p.no} className="rounded border border-line-soft px-3 py-2.5">
            <div className="text-[10px] font-mono font-extrabold text-brand">{p.no}</div>
            <div className="text-[12.5px] font-extrabold text-ink mt-0.5 leading-tight">{p.title}</div>
            <div className="text-[10.5px] text-ink-mid font-semibold mt-1 leading-snug">{p.desc}</div>
            <div className="mt-1.5 pt-1.5 border-t border-line-soft text-[10px] text-ink-light font-semibold leading-snug">
              {p.doc}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-dark font-semibold leading-relaxed">
        여러 서류를 맞춰 보고, 고객에게 <b>다음 행동</b>을 알려 주어야 합니다.
      </p>

      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onNext} disabled={done}>
          {done ? '✓ 서류 올리기로 진행됨' : '서류 올려 검토 요청 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 03 서류 검토 요청 ═══════════════ */

function UploadCard({
  state,
  handlers,
  done,
}: {
  state: FxState;
  handlers: FxHandlers;
  done: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[12.5px] font-extrabold text-ink">서류는 여러 장, 질문은 하나입니다</span>
        <span className="text-[10.5px] text-ink-mid font-semibold">
          처음 조건과 바뀐 조건, 받은 서류를 함께 올립니다
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FX_UPLOAD_SLOTS.map((s) => (
          <section key={s.id} className="rounded border border-line-soft bg-surface-soft px-3 py-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[12px] font-extrabold text-ink">{s.label}</span>
              <span className="text-[10.5px] text-ink-mid font-semibold">· {s.sub}</span>
              <span className="ml-auto text-[15px] leading-none text-ok">✓</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[11px] leading-none">📄</span>
              <span className="text-[10.5px] font-mono font-bold text-ink-dark truncate" title={s.file}>
                {s.file}
              </span>
              <span className="text-[9.5px] text-ink-light font-semibold shrink-0">{s.pages}쪽</span>
            </div>
          </section>
        ))}
      </div>

      {/* 반입 검사 — 첨부 축과 같은 규칙을 받는다는 표시 */}
      <div className="mt-2 flex items-center gap-2 text-[10.5px]">
        <span className="pill bg-ok-bg text-ok border border-ok-border">반입 승인</span>
        <span className="text-ink-mid font-semibold">{FX_ATTACH_SCAN}</span>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-extrabold text-ink mb-1">검토 지시</div>
        <textarea
          value={state.instruction}
          onChange={(e) => handlers.onInstruction(e.target.value)}
          rows={2}
          disabled={done}
          placeholder={FX_INSTRUCTION}
          className="w-full px-3 py-2 rounded border border-line bg-white text-[12.5px] text-ink-dark font-semibold leading-relaxed resize-y focus:outline-none focus:border-brand-dark disabled:bg-surface disabled:text-ink-mid"
        />
        <p className="mt-1 text-[10.5px] text-ink-light font-semibold">
          전문 용어가 아니라 평소 쓰는 말로 요청합니다 — 각각의 요약을 넘어 서류 사이의 차이를 확인합니다.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-[10px] text-ink-light font-semibold leading-snug flex-1">
          {FX_RETENTION_NOTE}
        </span>
        <Button
          variant="primary"
          onClick={handlers.onReviewRequest}
          disabled={done || state.instruction.trim().length < 5}
        >
          {done ? '✓ 검토 요청됨' : '검토 요청 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 04 검토 결과 ═══════════════ */

function ResultCard({ onEvidence, done }: { onEvidence: () => void; done: boolean }) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold text-ink leading-snug tracking-[-0.2px]">
            {FX_RESULT.headline}
          </div>
          <div className="text-[11px] text-ink-mid font-semibold mt-0.5">{FX_RESULT.sub}</div>
        </div>
        {/* AI 가 결론을 내리지 않는다는 표시 — 항상 함께 나간다 */}
        <span className="ml-auto shrink-0 pill bg-bad-bg text-bad border border-bad-border">
          {FX_RESULT.badge}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {FX_ITEM_VERDICTS.map((v) => (
          <section
            key={v.id}
            className={cn(
              'rounded border-2 px-3.5 py-3',
              v.satisfied ? 'border-ok-border bg-ok-bg' : 'border-bad-border bg-bad-bg',
            )}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-[12.5px] font-extrabold text-ink leading-tight">{v.item}</span>
              <span className="ml-auto text-[10.5px] font-bold text-ink-mid shrink-0">{v.qty}</span>
            </div>
            <div
              className={cn(
                'mt-2 text-[13px] font-extrabold leading-snug',
                v.satisfied ? 'text-ok' : 'text-bad',
              )}
            >
              {v.need}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-white/70">
              <span
                className={cn(
                  'pill border',
                  v.satisfied
                    ? 'bg-white text-ok border-ok-border'
                    : 'bg-white text-bad border-bad-border',
                )}
              >
                {v.verdict}
              </span>
              <p className="text-[10.5px] text-ink-dark font-semibold mt-1.5 leading-snug">{v.basis}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-2.5 rounded border border-line-soft bg-surface-soft px-3 py-2">
        <div className="text-[10.5px] text-ink-mid font-bold">{FX_RESULT.coverage}</div>
        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 leading-snug">
          {FX_RESULT.note}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onEvidence} disabled={done}>
          {done ? '✓ 근거 확인함' : '근거 원문 보기 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 05 근거 확인 ═══════════════ */

function EvidenceCard({ onWrapup, done }: { onWrapup: () => void; done: boolean }) {
  return (
    <div>
      <div className="text-[12.5px] font-extrabold text-ink mb-2">
        왜 그런지, 원문에서 바로 확인합니다
      </div>

      {/* 변경 전문 — 판정을 가른 구절을 원문 안에서 강조한다 */}
      <section className="rounded border border-line px-3.5 py-3">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[11px] font-extrabold text-ink">{FX_EVIDENCE.docName}</span>
          <span className="text-[9.5px] font-mono text-ink-light">{FX_EVIDENCE.docRef}</span>
        </div>
        <p className="font-mono text-[12.5px] leading-relaxed text-ink-mid">
          <span className="bg-bad-bg text-bad font-bold px-1 py-0.5 border-b-2 border-bad">
            {FX_EVIDENCE.highlight}
          </span>
          {FX_EVIDENCE.after}
        </p>
        <p className="text-[11px] text-ink-dark font-semibold mt-1.5">
          뜻: <b>{FX_EVIDENCE.meaning}</b>
        </p>
        <div className="mt-2 pt-2 border-t border-line-soft">
          <p className="font-mono text-[11.5px] leading-relaxed text-ink-mid">{FX_EVIDENCE.tail}</p>
          <p className="text-[11px] text-ink-mid font-semibold mt-1">뜻: {FX_EVIDENCE.tailMeaning}</p>
        </div>
      </section>

      {/* 원 신용장 조항 — 주장비 요건이 어디서 왔는지 */}
      <section className="mt-2 rounded border border-line-soft bg-surface-soft px-3.5 py-2.5">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[11px] font-extrabold text-ink">{FX_ORIGIN_CLAUSE.docName}</span>
          <span className="text-[9.5px] font-mono text-ink-light">{FX_ORIGIN_CLAUSE.docRef}</span>
        </div>
        <p className="font-mono text-[11.5px] leading-relaxed text-ink-mid">{FX_ORIGIN_CLAUSE.text}</p>
        <p className="text-[11px] text-ink-mid font-semibold mt-1">뜻: {FX_ORIGIN_CLAUSE.meaning}</p>
      </section>

      {/* 직원의 추가 질문 — 같은 서류의 근거로 답한다 */}
      <section className="mt-2.5 rounded border border-brand-tint bg-brand-bg px-3.5 py-3">
        <p className="text-[12px] font-extrabold text-ink leading-snug">“{FX_FOLLOWUP.q}”</p>
        <p className="text-[13px] font-extrabold text-brand mt-1.5 leading-snug">{FX_FOLLOWUP.a}</p>
        <p className="text-[11px] text-ink-dark font-semibold mt-1.5 leading-relaxed">
          {FX_FOLLOWUP.detail}
        </p>
      </section>

      <p className="mt-2.5 text-[11px] text-ink-mid font-semibold">
        담당자는 <b className="text-ink-dark">결론과 근거를 함께 보고</b> 판단할 수 있습니다.
      </p>

      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onWrapup} disabled={done}>
          {done ? '✓ 보완 서류 확인됨' : '보완 서류 확인 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 06 업무 마무리 ═══════════════ */

function WrapupCard({ state, handlers }: { state: FxState; handlers: FxHandlers }) {
  return (
    <div>
      <div className="text-[12.5px] font-extrabold text-ink mb-2">
        보완 서류가 오면, 고객 안내까지 이어집니다
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {FX_WRAPUP_TAGS.map((t) => (
          <span key={t.k} className="pill bg-ok-bg text-ok border border-ok-border">
            ✓ {t.k} · {t.v}
          </span>
        ))}
      </div>

      <section className="rounded border border-line px-3.5 py-3">
        <div className="text-[10px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-1">
          {FX_CUSTOMER_DRAFT.title}
        </div>
        <p className="text-[12.5px] text-ink-dark font-semibold leading-relaxed">
          {FX_CUSTOMER_DRAFT.body}
        </p>
        <p className="text-[10.5px] text-warn font-bold mt-1.5">⚠ {FX_CUSTOMER_DRAFT.note}</p>
      </section>

      {/* LSM-012 — 현장의 개선 의견을 즉시 등록한다 */}
      <section className="mt-3 rounded border border-brand-tint bg-brand-bg px-3.5 py-3">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-[11px] font-extrabold text-ink">개선 의견</span>
          <span className="text-[10px] text-ink-mid font-semibold">
            {FX_FEEDBACK.by} · 관리자 검토 후 다음 업무에 반영됩니다
          </span>
        </div>
        <textarea
          value={state.feedback}
          onChange={(e) => handlers.onFeedbackText(e.target.value)}
          rows={2}
          disabled={state.submitted}
          className="w-full px-3 py-2 rounded border border-line bg-white text-[12.5px] text-ink-dark font-semibold leading-relaxed resize-y focus:outline-none focus:border-brand-dark disabled:bg-surface disabled:text-ink-mid"
        />
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10.5px] text-ink-mid font-semibold flex-1 leading-snug">
            {state.submitted && state.approvalId
              ? `상신 완료 · ${state.approvalId} — 부산은행 관리자 승인 대기`
              : '의견은 개선안 결재로 올라가고, 개발자와 다른 승인자가 검토합니다 (ONM-003)'}
          </span>
          <Button
            variant="primary"
            onClick={handlers.onSubmitFeedback}
            disabled={state.submitted || state.feedback.trim().length < 5}
          >
            {state.submitted ? '✓ 개선 의견 등록됨' : '개선 의견 남기기'}
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════ 10 개선판 사용 ═══════════════ */

function ImprovedCard() {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[12.5px] font-extrabold text-ink">다음 직원은, 더 나은 방식으로 시작합니다</span>
        <span className="ml-auto pill bg-bad-bg text-bad border border-bad-border shrink-0">
          {FX_RESULT.badge}
        </span>
      </div>

      <div className="border border-ok-border rounded overflow-hidden">
        {FX_IMPROVED_ROWS.map((r, i) => (
          <div
            key={r.k}
            className={cn(
              'grid grid-cols-[86px_1fr] gap-3 px-3.5 py-2.5',
              i > 0 && 'border-t border-ok-border',
              i % 2 === 0 ? 'bg-ok-bg' : 'bg-white',
            )}
          >
            <span className="text-[11.5px] font-extrabold text-ok">{r.k}</span>
            <span className="text-[12.5px] text-ink-dark font-semibold leading-relaxed">{r.v}</span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[10.5px] text-ink-mid font-semibold leading-snug">{FX_IMPROVED_NOTE}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-dark font-semibold">
        한 직원의 해법이, <b>BNK 의 공통 업무 역량</b>으로 쌓입니다.
      </p>
    </div>
  );
}
