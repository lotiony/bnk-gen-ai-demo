/**
 * 고객 상담 카드 — 대화 답변 버블 안에 들어가는 조각들 (시나리오 1-3 ~ 1-8).
 *
 * RFP: AGB-006 ⑤ · SEC-007 · EDA-001 · ONM-004
 *
 * 완료된 카드는 한 줄로 접힌다. 대화가 길어져도 촬영 컷에 직전 카드가 끼어들지 않게.
 * 데이터는 전부 mockCustomerConsult.ts 에서 온다 — 여기엔 문구를 두지 않는다.
 */
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import type { Tenant } from '@/data/tenants';
import {
  AFFILIATE_OPTIONS,
  ASSETS,
  CONSENT,
  EVIDENCE_SOURCE,
  INTEREST,
  LOOKUP_SOURCE,
  LOOKUP_STEPS,
  PRODUCTS,
  PROFILE,
  SUMMARY,
  TENDENCY,
} from '@/data/mockCustomerConsult';
import type { ConsultCardKind } from '@/data/mockConsultChat';

export interface ConsultState {
  name: string;
  phone: string;
  background: string;
  affiliates: Record<string, boolean>;
  saved: boolean;
}

export interface ConsultHandlers {
  onName: (v: string) => void;
  onBackground: (v: string) => void;
  onToggle: (t: Tenant) => void;
  onProfileSubmit: () => void;
  onConsentConfirm: () => void;
  onSave: () => void;
}

const CARD_TITLE: Record<ConsultCardKind, string> = {
  profile: '고객 프로필 등록',
  consent: '제3자 정보 활용 동의 확인',
  analysis: '고객 종합 분석 결과',
  products: '맞춤 상품 추천',
  summary: '상담 요약 · 후속 조치',
};

/**
 * 답변 한 턴 — AI 문장 + 카드. `latest` 가 아니면 접힌다.
 * `done` 은 이 카드의 버튼이 이미 눌렸는지 — 눌린 버튼은 다시 못 누른다.
 */
export function ConsultTurn({
  kind,
  text,
  latest,
  done,
  state,
  handlers,
}: {
  kind: ConsultCardKind;
  text: string;
  latest: boolean;
  done: boolean;
  state: ConsultState;
  handlers: ConsultHandlers;
}) {
  const [open, setOpen] = useState(latest);
  useEffect(() => {
    if (!latest) setOpen(false);
  }, [latest]);

  return (
    <div className="og-answer mb-4 border border-line-soft rounded bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-start gap-2 border-b border-line-soft bg-surface-soft">
        <span className="pill bg-brand-tint text-brand border border-brand-tint shrink-0">고객 상담</span>
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
          {kind === 'profile' && <ProfileCard state={state} handlers={handlers} done={done} />}
          {kind === 'consent' && <ConsentCard state={state} onConfirm={handlers.onConsentConfirm} done={done} />}
          {kind === 'analysis' && <AnalysisCard state={state} />}
          {kind === 'products' && <ProductsCard saved={state.saved} onSave={handlers.onSave} />}
          {kind === 'summary' && <SummaryCard name={state.name} />}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ 1-3 프로필 등록 ═══════════════ */

const inputCls =
  'w-full h-9 px-3 rounded border border-line bg-white text-[12.5px] text-ink-dark font-semibold focus:outline-none focus:border-brand-dark disabled:bg-surface disabled:text-ink-mid';

function ProfileCard({ state, handlers, done }: { state: ConsultState; handlers: ConsultHandlers; done: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="고객명" required>
          <input value={state.name} onChange={(e) => handlers.onName(e.target.value)} className={inputCls} disabled={done} />
        </Field>
        <Field label="연락처">
          <input value={state.phone} readOnly className={inputCls} disabled={done} />
        </Field>
        <Field label="나이 · 직업" hint="시스템 조회로 채워집니다">
          <div className={cn(inputCls, 'bg-surface text-ink-light flex items-center')}>🔒 가상 뷰 조회 후 표시</div>
        </Field>
        <Field label="주거래 · 거래 기간" hint="시스템 조회로 채워집니다">
          <div className={cn(inputCls, 'bg-surface text-ink-light flex items-center')}>🔒 가상 뷰 조회 후 표시</div>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="계열사 거래 여부" hint="행원이 아는 범위에서 체크 · 잔액은 묻지 않습니다">
          <div className="flex flex-wrap gap-2">
            {AFFILIATE_OPTIONS.map((o) => (
              <label
                key={o.tenant}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 h-8 rounded border text-[12px] font-bold',
                  done ? 'cursor-default' : 'cursor-pointer',
                  state.affiliates[o.tenant] ? 'bg-brand-tint border-brand text-brand' : 'bg-white border-line text-ink-mid',
                )}
              >
                <input
                  type="checkbox"
                  checked={!!state.affiliates[o.tenant]}
                  onChange={() => handlers.onToggle(o.tenant)}
                  disabled={done}
                  className="accent-brand"
                />
                {o.tenant}
                {o.hint && <span className="text-[10.5px] font-semibold opacity-80">· {o.hint}</span>}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="상담 요청 배경">
          <textarea
            value={state.background}
            onChange={(e) => handlers.onBackground(e.target.value)}
            rows={2}
            disabled={done}
            className={cn(inputCls, 'h-auto py-2 leading-relaxed resize-y')}
          />
        </Field>
      </div>
      <div className="mt-3 rounded border border-info-border bg-info-bg px-3 py-2 text-[11.5px] text-ink-dark font-semibold leading-relaxed">
        ⓘ 고객 정보는 <b>고객 DB 가상 뷰(RLS/CLS)</b>에서 자동으로 가져옵니다 — 데이터를 복제하지 않습니다. 계열사 간 조회에는 <b>제3자 정보 활용 동의</b> 확인이 먼저 필요합니다 (SEC-007).
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={handlers.onProfileSubmit} disabled={done || state.name.trim().length < 2}>
          {done ? '✓ 프로필 생성됨' : '프로필 생성 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 1-4 동의 확인 ═══════════════ */

function ConsentCard({ state, onConfirm, done }: { state: ConsultState; onConfirm: () => void; done: boolean }) {
  const affiliates = AFFILIATE_OPTIONS.filter((o) => state.affiliates[o.tenant]).map((o) => o.tenant);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="pill bg-ok-bg text-ok border border-ok-border text-[12px]">✓ {CONSENT.status}</span>
        <span className="text-[11.5px] text-ink-mid font-semibold">{state.name} 고객 · 사전 확보된 동의 이력을 자동 조회했습니다</span>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[12px]">
        <dt className="text-ink-mid font-semibold">동의 목적</dt><dd className="text-ink-dark font-bold">{CONSENT.purpose}</dd>
        <dt className="text-ink-mid font-semibold">획득 시점 · 채널</dt><dd className="text-ink-dark font-bold">{CONSENT.obtainedAt} · {CONSENT.channel}</dd>
        <dt className="text-ink-mid font-semibold">유효 기간</dt><dd className="text-ink-dark font-bold">{CONSENT.validUntil} 까지</dd>
        <dt className="text-ink-mid font-semibold">조회 대상 계열사</dt>
        <dd className="text-ink-dark font-bold">{affiliates.length ? affiliates.join(' · ') : '없음 (부산은행 내부만)'}</dd>
        <dt className="text-ink-mid font-semibold">근거 원권 문서</dt>
        <dd>
          <button
            type="button"
            onClick={() => toast('근거 원권 문서', `${CONSENT.ref} · 동의서 원본 (스캔)`, 'info')}
            className="text-[12px] font-extrabold text-info hover:underline font-mono"
          >
            {CONSENT.ref}
          </button>
        </dd>
      </dl>
      <div className="mt-2.5 rounded border border-line-soft bg-surface-soft px-3 py-2 text-[11px] text-ink-mid font-semibold leading-relaxed">
        {CONSENT.gate} · 화면 9 데이터 접근 라우팅과 같은 게이트. 타 계열사 잔액·거래 내역은 조회하지 않습니다 — 계열사 간 데이터 격리(SEC-001).
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={onConfirm} disabled={done}>
          {done ? '✓ 확인 · 조회 진행됨' : '확인 · 진행 →'}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════ 1-5·1-6 분석 결과 ═══════════════ */

function AnalysisCard({ state }: { state: ConsultState }) {
  const affiliates = AFFILIATE_OPTIONS.filter((o) => state.affiliates[o.tenant]).map((o) => `${o.tenant}${o.hint ? ` (${o.hint})` : ''}`);
  return (
    <div>
      {/* 1-5 조회 요약 — 무엇을 조회했는지 명시 */}
      <div className="rounded border border-line-soft bg-surface-soft px-3 py-2 mb-3">
        <div className="text-[10px] text-ink-mid font-bold mb-1">조회 완료 · {LOOKUP_SOURCE}</div>
        <ul className="space-y-1">
          {LOOKUP_STEPS.map((s) => (
            <li key={s.id} className="flex items-baseline gap-2 text-[11.5px]">
              <span className="text-ink-mid font-bold shrink-0 w-[64px]">✓ {s.label.split(' — ')[0]}</span>
              <span className="text-ink-dark font-semibold leading-snug">{s.summary}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* 1-6 — 대화 컬럼(≈550px)에 맞춰 프로필·자산은 2단, 성향은 전폭 */}
      <div className="grid grid-cols-2 gap-3">
        <section className="rounded border border-line-soft px-4 py-3">
          <div className="text-[10px] font-extrabold text-ink-mid uppercase tracking-wide mb-1.5">프로필 요약</div>
          <div className="text-[15px] font-extrabold text-ink">{state.name} <span className="pill bg-brand-tint text-brand border border-brand-tint ml-1">{PROFILE.grade}</span></div>
          <dl className="mt-1.5 grid grid-cols-[70px_1fr] gap-y-1 text-[11.5px]">
            <dt className="text-ink-mid font-semibold">나이 · 직업</dt><dd className="text-ink-dark font-bold">{PROFILE.age}세 · {PROFILE.job}</dd>
            <dt className="text-ink-mid font-semibold">주거래</dt><dd className="text-ink-dark font-bold">{PROFILE.mainBank} · {PROFILE.years}년</dd>
            <dt className="text-ink-mid font-semibold">계열사</dt><dd className="text-ink-dark font-bold">{affiliates.length ? affiliates.join(' · ') : '없음'}</dd>
          </dl>
        </section>
        <section className="rounded border border-line-soft px-4 py-3">
          <div className="text-[10px] font-extrabold text-ink-mid uppercase tracking-wide mb-1.5">자산 요약 (부산은행)</div>
          <ul className="space-y-1.5">
            {ASSETS.map((a) => (
              <li key={a.k}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] text-ink-mid font-semibold">{a.k}</span>
                  <span className="ml-auto text-[14px] font-extrabold text-ink tabular-nums">{a.v}</span>
                </div>
                <div className="text-[10px] text-ink-light font-semibold">{a.sub}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="col-span-2 rounded border border-brand px-4 py-3 grid grid-cols-[1fr_auto] gap-x-5">
          <div>
            <div className="text-[10px] font-extrabold text-brand uppercase tracking-wide mb-1.5">성향 판단</div>
            <div className="flex h-2 rounded overflow-hidden mb-1.5">
              <div className="bg-brand" style={{ width: `${TENDENCY.fixedPct}%` }} />
              <div className="bg-info" style={{ width: `${TENDENCY.liquidPct}%` }} />
            </div>
            <ul className="space-y-0.5">
              {TENDENCY.lines.map((l) => <li key={l} className="text-[12px] font-extrabold text-ink-dark">· {l}</li>)}
            </ul>
          </div>
          <div className="border-l border-line-soft pl-4 self-stretch">
            <div className="text-[9.5px] text-ink-mid font-bold mb-0.5">근거 데이터</div>
            {TENDENCY.evidence.map((e) => (
              <button key={e.ref} type="button" onClick={() => toast(e.label, e.ref, 'info')} className="block text-[10.5px] font-bold text-info hover:underline text-left whitespace-nowrap">
                {e.label} <span className="font-mono text-ink-light">{e.ref}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════ 1-7 상품 추천 ═══════════════ */

function ProductsCard({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <div>
      <div className="text-[10.5px] text-ink-mid font-semibold mb-2">{TENDENCY.type} 성향 기준 · 근거: {EVIDENCE_SOURCE}</div>
      <div className="grid grid-cols-3 gap-3">
        {PRODUCTS.map((p) => (
          <section key={p.id} className={cn('rounded border px-4 py-3', p.recommended ? 'border-brand' : 'border-line-soft')}>
            <div className="flex items-center gap-2">
              {p.recommended && <span className="pill bg-brand text-white border border-brand-dark">추천</span>}
              <span className="text-[10px] font-mono text-ink-light">{p.id}</span>
            </div>
            <div className="text-[14px] font-extrabold text-ink mt-1">{p.name}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[18px] font-extrabold text-brand tabular-nums">{p.rate}</span>
              <span className="text-[11.5px] text-ink-mid font-semibold">{p.term}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-ink-dark font-semibold leading-snug">{p.fit}</div>
            <div className="mt-1.5 border-t border-line-soft pt-1.5">
              <div className="text-[9.5px] text-ink-mid font-bold">추천 근거</div>
              <div className="text-[11px] text-ink-dark font-semibold leading-snug">{p.evidence}</div>
            </div>
          </section>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1 rounded border border-line-soft bg-surface-soft px-3.5 py-2.5">
          <div className="text-[10px] font-extrabold text-ink-mid uppercase tracking-wide mb-1">예상 이자 — 규칙 계산</div>
          <div className="text-[11.5px] text-ink-mid font-semibold">{INTEREST.principal}</div>
          <div className="font-mono text-[12px] text-ink-dark">{INTEREST.formula} = <b>{INTEREST.gross}</b></div>
          <div className="text-[11px] text-ink-mid font-semibold">이자소득세 {INTEREST.tax} → 세후 <b className="text-ink-dark">{INTEREST.net}</b></div>
        </div>
        <Button onClick={onSave} disabled={saved}>{saved ? '✓ 상담 자료로 저장됨' : '고객 상담 자료로 저장'}</Button>
      </div>
    </div>
  );
}

/* ═══════════════ 1-8 상담 요약 · 후속 조치 ═══════════════ */

function SummaryCard({ name }: { name: string }) {
  const f = SUMMARY.followUp;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[80px_1fr] gap-y-1.5 text-[12px]">
        <dt className="text-ink-mid font-semibold">고객</dt><dd className="text-ink-dark font-bold">{name}</dd>
        <dt className="text-ink-mid font-semibold">고객 니즈</dt>
        <dd><ul className="space-y-0.5">{SUMMARY.needs.map((n) => <li key={n} className="text-ink-dark font-bold">· {n}</li>)}</ul></dd>
        <dt className="text-ink-mid font-semibold">성향</dt><dd className="text-ink-dark font-bold">{SUMMARY.tendency}</dd>
        <dt className="text-ink-mid font-semibold">추천 상품</dt><dd className="text-ink-dark font-bold">{SUMMARY.recommended}</dd>
        <dt className="text-ink-mid font-semibold">대안</dt><dd className="text-ink-dark font-bold">{SUMMARY.alt}</dd>
      </dl>
      <section className="rounded border border-warn-border bg-warn-bg px-4 py-3">
        <div className="text-[10px] font-extrabold text-warn uppercase tracking-wide mb-1">후속 조치</div>
        <div className="text-[12.5px] font-extrabold text-ink leading-snug">{f.title}</div>
        <p className="text-[11px] text-ink-dark font-semibold mt-1 leading-relaxed">{f.body}</p>
      </section>
    </div>
  );
}

/* ═══════════════ 조각 ═══════════════ */

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[11.5px] font-extrabold text-ink">{label}{required && <span className="text-bad ml-0.5">*</span>}</span>
        {hint && <span className="text-[10px] text-ink-light">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
