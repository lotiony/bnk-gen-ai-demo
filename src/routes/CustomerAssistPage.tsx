/**
 * 고객 상담 워크스페이스 — 시나리오 1 (1-3 ~ 1-8)
 *
 * RFP: AGB-006 ⑤ 고객/민원 분석 및 마케팅 · SEC-007 동의 권원 · EDA-001 가상 뷰(zero-copy) · ONM-004 감사
 *
 * 왜 대화 화면이 아니라 전용 화면인가 — 이 흐름은 질의응답이 아니라
 * 폼 → 확인 → 진행 → 결과 → 추천 → 요약이다. 대화 화면(Graph RAG 클라이맥스)에
 * 끼워 넣으면 양쪽이 다 흐려진다. 6단계가 시나리오 장면과 1:1 로 대응한다.
 *
 * 행원이 손대는 건 고객명 입력 + 클릭 다섯 번이다. 나머지는 화면이 넘어간다.
 * 상태는 메모리뿐이라 새로고침하면 처음으로 돌아간다(CLAUDE.md 규칙).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import ModalShell from '@/components/knowledgeData/ModalShell';
import { Button } from '@/components/ui/Button';
import Crumb from '@/components/ui/Crumb';
import type { Tenant } from '@/data/tenants';
import {
  AFFILIATE_OPTIONS,
  ASSETS,
  CONSENT,
  CONSULT_AGENT,
  CONSULT_STEPS,
  CUSTOMER_DEFAULT,
  EVIDENCE_SOURCE,
  INTEREST,
  LOOKUP_SOURCE,
  LOOKUP_STEPS,
  PRODUCTS,
  PROFILE,
  SUMMARY,
  TENDENCY,
  type ConsultStepId,
} from '@/data/mockCustomerConsult';

const STEP_INDEX: Record<ConsultStepId, number> = Object.fromEntries(
  CONSULT_STEPS.map((s, i) => [s.id, i]),
) as Record<ConsultStepId, number>;

export default function CustomerAssistPage() {
  const persona = useCurrentPersona();
  const [step, setStep] = useState<ConsultStepId>('profile');
  const idx = STEP_INDEX[step];

  // ① 폼
  const [name, setName] = useState(CUSTOMER_DEFAULT.name);
  const [phone, setPhone] = useState(CUSTOMER_DEFAULT.phone);
  const [background, setBackground] = useState(CUSTOMER_DEFAULT.background);
  const [affiliates, setAffiliates] = useState<Record<Tenant, boolean>>(
    () => Object.fromEntries(AFFILIATE_OPTIONS.map((o) => [o.tenant, o.defaultOn])) as Record<Tenant, boolean>,
  );
  const formOk = name.trim().length >= 2;

  // ③ 조회 진행 — 완료된 항목 수
  const [lookupDone, setLookupDone] = useState(0);
  // ⑤ 저장
  const [saved, setSaved] = useState(false);

  /* ③ 자동 재생 — 항목 하나씩 완료로 넘기고, 끝나면 ④로 간다. */
  useEffect(() => {
    if (step !== 'lookup') return;
    if (lookupDone >= LOOKUP_STEPS.length) {
      const t = setTimeout(() => setStep('analysis'), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLookupDone((n) => n + 1), LOOKUP_STEPS[lookupDone].ms);
    return () => clearTimeout(t);
  }, [step, lookupDone]);

  const goTo = (id: ConsultStepId) => {
    // 완료한 단계로만 되돌아간다. 조회 단계로 돌아가면 다시 재생한다.
    if (STEP_INDEX[id] > idx) return;
    if (id === 'lookup') setLookupDone(0);
    setStep(id);
  };

  const startProfile = () => {
    if (!formOk) return;
    setStep('consent');
  };
  const confirmConsent = () => {
    toast('동의 권원 확인', `${CONSENT.ref} · ${CONSENT.status} · 통합 감사 원장에 기록되었습니다`, 'ok');
    setLookupDone(0);
    setStep('lookup');
  };

  const checkedAffiliates = useMemo(
    () => AFFILIATE_OPTIONS.filter((o) => affiliates[o.tenant]),
    [affiliates],
  );

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6">
      <Crumb items={[{ label: '마켓플레이스', to: '/catalog' }, { label: CONSULT_AGENT.name }]} trailing={CONSULT_AGENT.id} />

      {/* ── 헤더 + 스텝퍼 ── */}
      <div className="card px-6 py-4 mb-3.5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="pill bg-ok-bg text-ok border border-ok-border">{CONSULT_AGENT.state}</span>
          <span className="text-[19px] font-extrabold text-ink tracking-[-0.3px]">{CONSULT_AGENT.name}</span>
          <span className="text-[11.5px] text-ink-mid font-semibold">
            필수 Use Case ⑤ {CONSULT_AGENT.useCase} · {CONSULT_AGENT.tenant} · <span className="font-mono">{CONSULT_AGENT.model}</span>
          </span>
          <span className="ml-auto text-[11.5px] text-ink-mid font-semibold">
            상담 담당 <b className="text-ink-dark">{persona?.name ?? '행원'}</b> ({persona?.tenant ?? '부산은행'})
          </span>
        </div>
        <ol className="mt-3.5 grid grid-cols-6 gap-1.5">
          {CONSULT_STEPS.map((s, i) => {
            const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  disabled={state === 'upcoming'}
                  className={cn(
                    'w-full text-left rounded border px-3 py-2 transition-colors',
                    state === 'current' && 'bg-brand text-white border-brand-dark',
                    state === 'done' && 'bg-ok-bg text-ok border-ok-border hover:border-ok',
                    state === 'upcoming' && 'bg-surface text-ink-light border-line-soft cursor-default',
                  )}
                >
                  <div className="text-[10px] font-bold opacity-80">
                    {state === 'done' ? '✓' : i + 1} · {s.scene}
                  </div>
                  <div className="text-[12px] font-extrabold leading-tight">{s.label}</div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── 본문 ── */}
      {step === 'profile' && (
        <ProfileForm
          name={name}
          phone={phone}
          background={background}
          affiliates={affiliates}
          onName={setName}
          onPhone={setPhone}
          onBackground={setBackground}
          onToggle={(t) => setAffiliates((m) => ({ ...m, [t]: !m[t] }))}
          ok={formOk}
          onSubmit={startProfile}
        />
      )}

      {step === 'consent' && (
        <>
          {/* 팝업 뒤에 ① 폼을 그대로 깔아 둔다 — 어디서 왔는지 끊기지 않게 */}
          <ProfileForm
            name={name}
            phone={phone}
            background={background}
            affiliates={affiliates}
            onName={setName}
            onPhone={setPhone}
            onBackground={setBackground}
            onToggle={() => {}}
            ok={formOk}
            onSubmit={() => {}}
            dim
          />
          <ConsentModal
            customer={name}
            affiliates={checkedAffiliates.map((o) => o.tenant)}
            onCancel={() => setStep('profile')}
            onConfirm={confirmConsent}
          />
        </>
      )}

      {step === 'lookup' && <LookupProgress done={lookupDone} />}

      {step === 'analysis' && (
        <AnalysisResult customer={name} affiliates={checkedAffiliates.map((o) => `${o.tenant}${o.hint ? ` (${o.hint})` : ''}`)} onNext={() => setStep('products')} />
      )}

      {step === 'products' && (
        <ProductRecommend
          saved={saved}
          onSave={() => {
            setSaved(true);
            toast('고객 상담 자료로 저장', `${name} · 추천 상품 3건 · 내 문서 > 상담 자료에 저장되었습니다`, 'ok');
          }}
          onNext={() => setStep('summary')}
        />
      )}

      {step === 'summary' && <ConsultSummary customer={name} />}

      <div className="mt-3 text-[10.5px] text-ink-light font-semibold">
        조회·동의 확인·저장 이력은 통합 감사 원장에 기록됩니다 (ONM-004) · 조회는 {LOOKUP_SOURCE}
      </div>
    </div>
  );
}

/* ═══════════════════════ ① 프로필 등록 ═══════════════════════ */

function ProfileForm({
  name, phone, background, affiliates, onName, onPhone, onBackground, onToggle, ok, onSubmit, dim,
}: {
  name: string; phone: string; background: string;
  affiliates: Record<Tenant, boolean>;
  onName: (v: string) => void; onPhone: (v: string) => void; onBackground: (v: string) => void;
  onToggle: (t: Tenant) => void;
  ok: boolean; onSubmit: () => void; dim?: boolean;
}) {
  return (
    <div className={cn('grid grid-cols-[1fr_340px] gap-3.5', dim && 'opacity-60 pointer-events-none')}>
      <section className="card px-6 py-5">
        <h2 className="text-[15px] font-extrabold text-ink">고객 프로필 등록</h2>
        <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5 mb-4">
          상담 대상 고객을 등록합니다. 기본 정보는 시스템이 조회해 채웁니다 — 행원이 입력하는 것은 고객명과 상담 배경뿐입니다.
        </p>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
          <Field label="고객명" required>
            <input value={name} onChange={(e) => onName(e.target.value)} className={inputCls} placeholder="고객 성명" />
          </Field>
          <Field label="연락처">
            <input value={phone} onChange={(e) => onPhone(e.target.value)} className={inputCls} />
          </Field>
          <Field label="나이 · 직업" hint="시스템 조회로 채워집니다">
            <div className={cn(inputCls, 'bg-surface text-ink-light flex items-center')}>🔒 가상 뷰 조회 후 표시</div>
          </Field>
          <Field label="주거래 · 거래 기간" hint="시스템 조회로 채워집니다">
            <div className={cn(inputCls, 'bg-surface text-ink-light flex items-center')}>🔒 가상 뷰 조회 후 표시</div>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="계열사 거래 여부" hint="행원이 아는 범위에서 체크 · 잔액은 묻지 않습니다">
            <div className="flex flex-wrap gap-2">
              {AFFILIATE_OPTIONS.map((o) => (
                <label
                  key={o.tenant}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 h-8 rounded border text-[12px] font-bold cursor-pointer',
                    affiliates[o.tenant] ? 'bg-brand-tint border-brand text-brand' : 'bg-white border-line text-ink-mid',
                  )}
                >
                  <input type="checkbox" checked={!!affiliates[o.tenant]} onChange={() => onToggle(o.tenant)} className="accent-brand" />
                  {o.tenant}
                  {o.hint && <span className="text-[10.5px] font-semibold opacity-80">· {o.hint}</span>}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="상담 요청 배경" required>
            <textarea value={background} onChange={(e) => onBackground(e.target.value)} rows={3} className={cn(inputCls, 'h-auto py-2 leading-relaxed resize-y')} />
          </Field>
        </div>

        <div className="mt-4 rounded border border-info-border bg-info-bg px-3.5 py-3 text-[11.5px] text-ink-dark font-semibold leading-relaxed">
          ⓘ 고객 정보는 <b>고객 DB 가상 뷰(RLS/CLS)</b>에서 자동으로 가져옵니다 — 데이터를 복제하지 않습니다.
          <br />
          계열사 간 조회에는 <b>제3자 정보 활용 동의</b> 확인이 먼저 필요합니다 (SEC-007).
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="primary" onClick={onSubmit} disabled={!ok}>
            프로필 생성 →
          </Button>
        </div>
      </section>

      <aside className="space-y-3">
        <SideCard title="이 에이전트가 하는 일">
          <ul className="space-y-1 text-[11.5px] text-ink-dark font-medium leading-snug">
            <li>· 고객 정보(직업·나이·거래) 기반 프로필 생성</li>
            <li>· 자산 운용 · 포트폴리오 제안 및 상품 추천</li>
            <li>· 고객 상담 내용 분석 및 요약</li>
          </ul>
        </SideCard>
        <SideCard title="연계 자산">
          <ul className="space-y-1 text-[11.5px] text-ink-dark font-medium leading-snug">
            <li>· 고객 DB 가상 뷰 (RLS/CLS)</li>
            <li>· 동의 권원 확인 (SEC-007)</li>
            <li>· 상품 인덱스</li>
          </ul>
        </SideCard>
      </aside>
    </div>
  );
}

/* ═══════════════════════ ② 동의 확인 팝업 ═══════════════════════ */

function ConsentModal({
  customer, affiliates, onCancel, onConfirm,
}: { customer: string; affiliates: Tenant[]; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell
      open
      onClose={onCancel}
      title="제3자 정보 활용 동의 확인 필요"
      subtitle={`${customer} 고객 · 계열사 간 정보 조회 전 동의 권원을 확인합니다`}
      footer={
        <>
          <span className="text-[11px] text-ink-mid font-semibold">{CONSENT.gate} · 화면 9 데이터 접근 라우팅과 같은 게이트</span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>취소</Button>
            <Button variant="primary" onClick={onConfirm}>확인 · 진행</Button>
          </span>
        </>
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="pill bg-ok-bg text-ok border border-ok-border text-[12px]">✓ {CONSENT.status}</span>
        <span className="text-[11.5px] text-ink-mid font-semibold">사전 확보된 동의 이력을 자동 조회했습니다</span>
      </div>
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[12.5px]">
        <dt className="text-ink-mid font-semibold">동의 목적</dt><dd className="text-ink-dark font-bold">{CONSENT.purpose}</dd>
        <dt className="text-ink-mid font-semibold">획득 시점</dt><dd className="text-ink-dark font-bold">{CONSENT.obtainedAt}</dd>
        <dt className="text-ink-mid font-semibold">획득 채널</dt><dd className="text-ink-dark font-bold">{CONSENT.channel}</dd>
        <dt className="text-ink-mid font-semibold">유효 기간</dt><dd className="text-ink-dark font-bold">{CONSENT.validUntil} 까지</dd>
        <dt className="text-ink-mid font-semibold">조회 대상 계열사</dt>
        <dd className="text-ink-dark font-bold">{affiliates.length ? affiliates.join(' · ') : '없음 (부산은행 내부만)'}</dd>
        <dt className="text-ink-mid font-semibold">근거 원권 문서</dt>
        <dd>
          <button
            type="button"
            onClick={() => toast('근거 원권 문서', `${CONSENT.ref} · 동의서 원본 (스캔)`, 'info')}
            className="text-[12.5px] font-extrabold text-info hover:underline font-mono"
          >
            {CONSENT.ref}
          </button>
        </dd>
      </dl>
      <div className="mt-3 rounded border border-line-soft bg-surface-soft px-3 py-2 text-[11px] text-ink-mid font-semibold leading-relaxed">
        동의가 확인되어야 계열사 거래 플래그를 조회합니다. 타 계열사 잔액·거래 내역은 이 화면에서 조회하지 않습니다 — 계열사 간 데이터 격리(SEC-001).
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════ ③ 데이터 조회 진행 ═══════════════════════ */

function LookupProgress({ done }: { done: number }) {
  const all = done >= LOOKUP_STEPS.length;
  return (
    <div className="grid grid-cols-[1fr_400px] gap-3.5">
      <section className="card px-6 py-5">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-extrabold text-ink">프로필 생성 · 부산은행 데이터 조회</h2>
          {!all && (
            <span className="inline-flex items-center gap-1 ml-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand" style={{ animation: 'ogDot 1.1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          )}
          <span className="ml-auto text-[11px] text-ink-mid font-semibold">{done} / {LOOKUP_STEPS.length} 완료</span>
        </div>
        <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5 mb-4">{LOOKUP_SOURCE}</p>

        <ol className="space-y-2">
          {LOOKUP_STEPS.map((s, i) => {
            const st = i < done ? 'done' : i === done ? 'running' : 'wait';
            return (
              <li key={s.id} className={cn('flex items-center gap-3 rounded border px-3.5 py-2.5', st === 'running' ? 'border-brand bg-brand-tint' : 'border-line-soft bg-white')}>
                <span className={cn('pill border text-[11px] w-[64px] justify-center', st === 'done' && 'bg-ok-bg text-ok border-ok-border', st === 'running' && 'bg-brand text-white border-brand-dark', st === 'wait' && 'bg-surface text-ink-light border-line-soft')}>
                  {st === 'done' ? '완료' : st === 'running' ? '조회 중' : '대기'}
                </span>
                <span className="text-[12.5px] font-extrabold text-ink-dark">{s.label}</span>
                <span className="ml-auto text-[10.5px] font-mono text-ink-light">{s.source}</span>
              </li>
            );
          })}
        </ol>
        {all && <div className="mt-4 text-[11.5px] text-ok font-extrabold">✓ 조회 완료 — 분석 결과로 넘어갑니다</div>}
      </section>

      <aside>
        <SideCard title="조회된 데이터 요약">
          {done === 0 ? (
            <div className="text-[11.5px] text-ink-light font-semibold">조회가 끝난 항목부터 여기에 쌓입니다</div>
          ) : (
            <ul className="space-y-2">
              {LOOKUP_STEPS.slice(0, done).map((s) => (
                <li key={s.id} className="og-step">
                  <div className="text-[10.5px] text-ink-mid font-bold">{s.label.split(' — ')[0]}</div>
                  <div className="text-[12px] text-ink-dark font-semibold leading-snug">{s.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </SideCard>
      </aside>
    </div>
  );
}

/* ═══════════════════════ ④ 분석 결과 ═══════════════════════ */

function AnalysisResult({ customer, affiliates, onNext }: { customer: string; affiliates: string[]; onNext: () => void }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-[15px] font-extrabold text-ink">고객 종합 분석 결과</h2>
        <span className="text-[11.5px] text-ink-mid font-semibold">AI 추론 · 근거는 카드마다 명시</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <section className="card px-5 py-4">
          <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-wide mb-2">프로필 요약</div>
          <div className="text-[17px] font-extrabold text-ink">{customer} <span className="pill bg-brand-tint text-brand border border-brand-tint ml-1">{PROFILE.grade}</span></div>
          <dl className="mt-2 grid grid-cols-[76px_1fr] gap-y-1 text-[12px]">
            <dt className="text-ink-mid font-semibold">나이 · 직업</dt><dd className="text-ink-dark font-bold">{PROFILE.age}세 · {PROFILE.job}</dd>
            <dt className="text-ink-mid font-semibold">주거래</dt><dd className="text-ink-dark font-bold">{PROFILE.mainBank} · {PROFILE.since}부터 {PROFILE.years}년</dd>
            <dt className="text-ink-mid font-semibold">계열사 거래</dt><dd className="text-ink-dark font-bold">{affiliates.length ? affiliates.join(' · ') : '없음'}</dd>
          </dl>
        </section>

        <section className="card px-5 py-4">
          <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-wide mb-2">자산 요약 (부산은행)</div>
          <ul className="space-y-2">
            {ASSETS.map((a) => (
              <li key={a.k}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] text-ink-mid font-semibold">{a.k}</span>
                  <span className="ml-auto text-[15px] font-extrabold text-ink tabular-nums">{a.v}</span>
                </div>
                <div className="text-[10.5px] text-ink-light font-semibold">{a.sub}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card px-5 py-4 border-brand">
          <div className="text-[10.5px] font-extrabold text-brand uppercase tracking-wide mb-2">성향 판단</div>
          <div className="flex h-2.5 rounded overflow-hidden mb-2">
            <div className="bg-brand" style={{ width: `${TENDENCY.fixedPct}%` }} title="정기성" />
            <div className="bg-info" style={{ width: `${TENDENCY.liquidPct}%` }} title="유동성" />
          </div>
          <ul className="space-y-1">
            {TENDENCY.lines.map((l) => (
              <li key={l} className="text-[12.5px] font-extrabold text-ink-dark">· {l}</li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line-soft pt-2">
            <div className="text-[10px] text-ink-mid font-bold mb-1">근거 데이터</div>
            <ul className="space-y-0.5">
              {TENDENCY.evidence.map((e) => (
                <li key={e.ref}>
                  <button type="button" onClick={() => toast(e.label, e.ref, 'info')} className="text-[11px] font-bold text-info hover:underline">
                    {e.label} <span className="font-mono text-ink-light">{e.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onNext}>맞춤 상품 추천 보기 →</Button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ⑤ 상품 추천 ═══════════════════════ */

function ProductRecommend({ saved, onSave, onNext }: { saved: boolean; onSave: () => void; onNext: () => void }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-[15px] font-extrabold text-ink">맞춤 상품 추천</h2>
        <span className="text-[11.5px] text-ink-mid font-semibold">{TENDENCY.type} 성향 기준 · 근거: {EVIDENCE_SOURCE}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {PRODUCTS.map((p) => (
          <section key={p.id} className={cn('card px-5 py-4', p.recommended && 'border-brand')}>
            <div className="flex items-center gap-2">
              {p.recommended && <span className="pill bg-brand text-white border border-brand-dark">추천</span>}
              <span className="text-[10.5px] font-mono text-ink-light">{p.id}</span>
            </div>
            <div className="text-[15px] font-extrabold text-ink mt-1.5">{p.name}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-extrabold text-brand tabular-nums">{p.rate}</span>
              <span className="text-[12px] text-ink-mid font-semibold">{p.term}</span>
            </div>
            <div className="mt-2.5 text-[11.5px] text-ink-dark font-semibold leading-snug">{p.fit}</div>
            <div className="mt-2 border-t border-line-soft pt-2">
              <div className="text-[10px] text-ink-mid font-bold">추천 근거</div>
              <div className="text-[11.5px] text-ink-dark font-semibold leading-snug">{p.evidence}</div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 mt-3 items-start">
        <section className="card px-5 py-4">
          <div className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-wide mb-1.5">예상 이자 — 규칙 계산</div>
          <div className="text-[12px] text-ink-mid font-semibold">{INTEREST.principal}</div>
          <div className="mt-1 font-mono text-[12.5px] text-ink-dark">{INTEREST.formula} = <b>{INTEREST.gross}</b></div>
          <div className="text-[11.5px] text-ink-mid font-semibold mt-1">이자소득세 {INTEREST.tax} → 세후 <b className="text-ink-dark">{INTEREST.net}</b></div>
        </section>
        <div className="flex flex-col gap-2">
          <Button onClick={onSave} disabled={saved}>{saved ? '✓ 상담 자료로 저장됨' : '고객 상담 자료로 저장'}</Button>
          <Button variant="primary" onClick={onNext}>상담 내용 요약 →</Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ ⑥ 상담 요약 · 후속 조치 ═══════════════════════ */

function ConsultSummary({ customer }: { customer: string }) {
  const f = SUMMARY.followUp;
  return (
    <div className="grid grid-cols-[1fr_400px] gap-3.5">
      <section className="card px-6 py-5">
        <h2 className="text-[15px] font-extrabold text-ink">상담 요약</h2>
        <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5 mb-4">{customer} 고객 · 상담 내용을 자동 요약했습니다</p>
        <dl className="grid grid-cols-[90px_1fr] gap-y-2.5 text-[12.5px]">
          <dt className="text-ink-mid font-semibold">고객 니즈</dt>
          <dd>
            <ul className="space-y-0.5">{SUMMARY.needs.map((n) => <li key={n} className="text-ink-dark font-bold">· {n}</li>)}</ul>
          </dd>
          <dt className="text-ink-mid font-semibold">성향</dt><dd className="text-ink-dark font-bold">{SUMMARY.tendency}</dd>
          <dt className="text-ink-mid font-semibold">추천 상품</dt><dd className="text-ink-dark font-bold">{SUMMARY.recommended}</dd>
          <dt className="text-ink-mid font-semibold">대안</dt><dd className="text-ink-dark font-bold">{SUMMARY.alt}</dd>
        </dl>
      </section>

      <aside>
        <section className="rounded border border-warn-border bg-warn-bg px-4 py-3.5">
          <div className="text-[10.5px] font-extrabold text-warn uppercase tracking-wide mb-1">후속 조치</div>
          <div className="text-[13px] font-extrabold text-ink leading-snug">{f.title}</div>
          <p className="text-[11.5px] text-ink-dark font-semibold mt-1.5 leading-relaxed">{f.body}</p>
          <Link
            to={`/catalog?q=${encodeURIComponent(f.query)}`}
            className="mt-3 inline-flex items-center justify-center w-full h-9 rounded bg-brand border border-brand-dark text-white text-[12.5px] font-extrabold hover:bg-brand-dark"
          >
            {f.cta} →
          </Link>
        </section>
      </aside>
    </div>
  );
}

/* ═══════════════════════ 조각 ═══════════════════════ */

const inputCls = 'w-full h-9 px-3 rounded border border-line bg-white text-[12.5px] text-ink-dark font-semibold focus:outline-none focus:border-brand-dark';

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[12px] font-extrabold text-ink">{label}{required && <span className="text-bad ml-0.5">*</span>}</span>
        {hint && <span className="text-[10.5px] text-ink-light">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card px-4 py-3.5">
      <div className="text-[11px] font-extrabold text-ink-mid mb-2">{title}</div>
      {children}
    </section>
  );
}
