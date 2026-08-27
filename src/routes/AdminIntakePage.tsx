/**
 * 관리 콘솔 — 모델 · 데이터 반입 승인.
 *
 * RFP 2-1 관리자 포털: "모델·데이터 반입 승인 화면: 반입 요청·검사 결과·승인 처리 현황"
 * 연계 요건: SEC-004(민감정보 유입 사전 차단) · SEC-005(DRM 해제) · AGB-012(편향 검증)
 *
 * 이 화면의 명제는 하나다 — **검사에서 하나라도 차단이 뜨면 승인 버튼이 잠긴다.**
 * 공동존은 10개 계열사가 함께 쓰는 상면이라, 반입 관문이 무르면 한 계열사의
 * 실수가 전 그룹으로 번진다.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import {
  INTAKE_REQUESTS,
  CHECK_TONE,
  INTAKE_STATE_TONE,
  type IntakeRequest,
  type IntakeState,
} from '@/data/mockIntake';

export default function AdminIntakePage() {
  const [decided, setDecided] = useState<Record<string, IntakeState>>({});
  const stateOf = (r: IntakeRequest): IntakeState => decided[r.id] ?? r.state;

  const [selectedId, setSelectedId] = useState<string>(INTAKE_REQUESTS[0].id);
  const selected = INTAKE_REQUESTS.find((r) => r.id === selectedId)!;

  const pending = INTAKE_REQUESTS.filter((r) => stateOf(r) === '승인 대기').length;
  const inspecting = INTAKE_REQUESTS.filter((r) => stateOf(r) === '검사 중').length;

  /** 차단(fail)이 하나라도 있으면 승인이 불가하다 — 관문의 정의다. */
  const blocked = useMemo(
    () => selected.checks.some((c) => c.result === 'fail'),
    [selected],
  );
  const stillRunning = useMemo(
    () => selected.checks.some((c) => c.result === 'running'),
    [selected],
  );
  const st = stateOf(selected);

  const decide = (next: IntakeState) => {
    setDecided((s) => ({ ...s, [selected.id]: next }));
    toast(
      next === '승인'
        ? `${selected.target} 반입 승인 — ${selected.destination} 로 적재를 시작합니다`
        : `${selected.target} 반입 반려 — 공동존에 유입되지 않습니다`,
    );
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">
            모델 · 데이터 반입 승인
          </h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            공동존 바깥에서 들어오는 모델·데이터의 검사 결과를 확인하고 반입을 승인한다 · 검사 중{' '}
            <b className="text-ink-dark">{inspecting}</b>건 · 승인 대기{' '}
            <b className="text-ink-dark">{pending}</b>건
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-1 반입 승인 · SEC-004
        </span>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-3.5">
        {/* ── 좌: 요청 목록 ── */}
        <div className="flex flex-col gap-1.5 self-start sticky top-[110px]">
          {INTAKE_REQUESTS.map((r) => {
            const s = stateOf(r);
            const on = r.id === selectedId;
            const hasFail = r.checks.some((c) => c.result === 'fail');
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'text-left px-3 py-2.5 rounded border transition-colors',
                  on ? 'bg-brand-bg border-brand-dark' : 'bg-white border-line-soft hover:border-brand-dark',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'pill border whitespace-nowrap',
                      r.kind === '모델'
                        ? 'bg-accent-purple-bg text-accent-purple border-accent-purple-border'
                        : 'bg-ok-bg text-ok border-ok-border',
                    )}
                  >
                    {r.kind}
                  </span>
                  <StatusPill tone={INTAKE_STATE_TONE[s]} className="ml-auto">
                    {s}
                  </StatusPill>
                </div>
                <div className="text-[12px] font-extrabold text-ink truncate">{r.target}</div>
                <div className="text-[10px] text-ink-mid font-semibold mt-0.5 truncate">
                  {TENANT_SHORT[r.tenant]} · {r.requestedBy} · {r.requestedAt}
                </div>
                {hasFail && (
                  <div className="text-[9.5px] text-bad font-extrabold mt-1">⛔ 차단 항목 있음</div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── 우: 상세 ── */}
        <div className="card p-4 min-w-0">
          <div className="flex items-start gap-3 pb-3 mb-3 border-b border-line-soft">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-[15px] font-extrabold text-ink font-mono break-all">
                  {selected.target}
                </h2>
                <span className="text-[10px] font-mono font-bold text-ink-light">
                  {selected.id}
                </span>
                <StatusPill tone={INTAKE_STATE_TONE[st]}>{st}</StatusPill>
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-1 mt-2">
                <Row k="반입 출처" v={selected.source} />
                <Row k="적재 위치" v={selected.destination} />
                <Row k="규모" v={selected.size} />
                <Row k="신청" v={`${selected.requestedBy} · ${selected.requestedAt}`} />
              </dl>
              <p className="text-[11px] text-ink-dark font-semibold mt-2 leading-snug">
                <b className="text-ink-mid">사유</b> · {selected.reason}
              </p>
            </div>
            {(st === '승인 대기' || st === '검사 중') && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => decide('반려')}
                  className="py-1.5 px-3 border border-line rounded text-[11.5px] font-extrabold text-ink-dark hover:border-bad hover:text-bad"
                >
                  반려
                </button>
                <button
                  type="button"
                  disabled={blocked || stillRunning}
                  title={
                    blocked
                      ? '차단 항목이 남아 있어 승인할 수 없습니다'
                      : stillRunning
                        ? '검사가 아직 진행 중입니다'
                        : undefined
                  }
                  onClick={() => decide('승인')}
                  className="py-1.5 px-3.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  반입 승인
                </button>
              </div>
            )}
          </div>

          {blocked && (
            <div className="border border-bad-border bg-bad-bg rounded px-3 py-2 mb-3">
              <div className="text-[11.5px] font-extrabold text-bad mb-0.5">
                차단 항목이 있어 승인할 수 없습니다
              </div>
              <p className="text-[11px] text-ink-dark font-semibold leading-snug">
                검사에서 <b>차단</b>이 하나라도 뜨면 승인 버튼이 잠긴다. 공동존은 10개 계열사가
                공유하는 상면이므로, 반입 관문에서 걸러지지 않은 것은 전 그룹으로 번진다.
              </p>
            </div>
          )}

          {selected.note && (
            <div
              className={cn(
                'border rounded px-3 py-2 mb-3 text-[11px] font-semibold text-ink-dark leading-snug',
                st === '승인' ? 'border-ok-border bg-ok-bg' : 'border-bad-border bg-bad-bg',
              )}
            >
              <b className={st === '승인' ? 'text-ok' : 'text-bad'}>
                {selected.decidedBy} · {selected.decidedAt}
              </b>{' '}
              · {selected.note}
            </div>
          )}

          <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
            검사 결과 {selected.checks.length}항목
          </div>
          <div className="flex flex-col gap-1.5">
            {selected.checks.map((c) => {
              const meta = CHECK_TONE[c.result];
              return (
                <div
                  key={c.name}
                  className={cn(
                    'grid grid-cols-[168px_64px_1fr] gap-3 items-start px-3 py-2 rounded border',
                    c.result === 'fail'
                      ? 'border-bad-border bg-bad-bg'
                      : c.result === 'warn'
                        ? 'border-warn-border bg-warn-bg'
                        : 'border-line-soft bg-white',
                  )}
                >
                  <span className="text-[11.5px] font-extrabold text-ink">{c.name}</span>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  <span className="text-[11px] text-ink-dark font-semibold leading-snug">
                    {c.detail}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-ink-mid font-semibold mt-3 pt-2.5 border-t border-line-soft leading-snug">
            🔒 반입 요청 · 검사 결과 · 승인 행위는 모두 감사 원장에 기록된다(SEC-009). 데이터 반입은
            계열사 DRM 해제 결과와 개인정보 스캔 결과를 함께 남긴다(SEC-004 · SEC-005).
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[68px_1fr] gap-2 items-baseline">
      <dt className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">{k}</dt>
      <dd className="text-[11px] text-ink-dark font-semibold">{v}</dd>
    </div>
  );
}
