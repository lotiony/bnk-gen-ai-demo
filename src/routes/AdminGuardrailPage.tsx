/**
 * 관리 콘솔 — 가드레일 정책.
 *
 * RFP 2-1 관리자 포털: 42 정책 적용범위·세부기준 / 43 서비스별 예외 설정 / 44 이력 조회
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import {
  GROUP_BASELINE,
  TENANT_OVERRIDES,
  GUARD_EXCEPTIONS,
  VIOLATION_LOGS,
  type GuardAction,
} from '@/data/mockGuardrailPolicy';

type Tab = 'policy' | 'exception' | 'history';

const ACTION_TONE: Record<GuardAction, 'bad' | 'warn' | 'info'> = {
  차단: 'bad',
  마스킹: 'warn',
  경고: 'info',
};

export default function AdminGuardrailPage() {
  const [tab, setTab] = useState<Tab>('policy');

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">가드레일 정책</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            그룹 베이스라인 위에 계열사가 강화만 얹을 수 있다 · 서비스별 완화는 예외 승인이 있어야 유효하다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-1 가드레일
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {([
          { k: 'policy' as const, label: '정책 설정', req: '42' },
          { k: 'exception' as const, label: '서비스별 예외', req: '43' },
          { k: 'history' as const, label: '위반 이력', req: '44' },
        ]).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k ? 'text-brand border-brand' : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[9px] font-mono font-bold text-ink-light">{t.req}</span>
          </button>
        ))}
      </div>

      {tab === 'policy' && (
        <div className="space-y-3.5">
          <section className="card p-4">
            <h2 className="text-[13px] font-extrabold text-ink mb-2.5">그룹 베이스라인</h2>
            <div className="flex flex-col gap-1.5">
              {GROUP_BASELINE.map((p) => (
                <div key={p.category} className="grid grid-cols-[120px_70px_1fr_auto] gap-3 items-center px-3 py-2 border border-line-soft rounded bg-white">
                  <span className="text-[11.5px] font-extrabold text-ink">{p.category}</span>
                  <StatusPill tone={ACTION_TONE[p.action]}>{p.action}</StatusPill>
                  <span className="text-[10.5px] text-ink-mid font-semibold">{p.threshold}</span>
                  <button
                    type="button"
                    onClick={() => toast(`${p.category} 그룹 정책 수정 — 전 계열사에 즉시 반영됩니다`)}
                    className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand"
                  >수정</button>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="text-[13px] font-extrabold text-ink mb-1">계열사 강화 정책</h2>
            <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5">그룹 기준보다 완화할 수는 없다 — 강화만 얹을 수 있다</p>
            <div className="flex flex-col gap-1.5">
              {TENANT_OVERRIDES.map((p, i) => (
                <div key={i} className="grid grid-cols-[90px_120px_70px_1fr] gap-3 items-center px-3 py-2 border border-line-soft rounded bg-white">
                  <span className="text-[11px] font-extrabold text-ink-dark">{p.scope}</span>
                  <span className="text-[11.5px] font-bold text-ink">{p.category}</span>
                  <StatusPill tone={ACTION_TONE[p.action]}>{p.action}</StatusPill>
                  <span className="text-[10.5px] text-ink-mid font-semibold">{p.threshold}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'exception' && (
        <div className="flex flex-col gap-1.5">
          {GUARD_EXCEPTIONS.map((e) => (
            <div key={e.id} className="card p-3.5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12.5px] font-extrabold text-ink">{e.serviceName}</span>
                <span className="text-[10px] font-mono font-bold text-ink-light">{e.serviceId}</span>
                <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{TENANT_SHORT[e.tenant]}</span>
                <span className="pill bg-warn-bg text-warn border border-warn-border">{e.category} 예외</span>
                <span className="ml-auto text-[10px] text-ink-mid font-semibold">만료 {e.expiresAt}</span>
              </div>
              <p className="text-[11px] text-ink-dark font-semibold leading-snug">{e.reason}</p>
              <div className="text-[10px] text-ink-mid font-semibold mt-1">
                승인 {e.approvedBy} · {e.approvedAt}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-1.5">
          {VIOLATION_LOGS.map((l, i) => (
            <div key={i} className="grid grid-cols-[150px_1fr_110px_70px_1fr] gap-3 items-center px-3.5 py-2.5 bg-white border border-line-soft rounded">
              <span className="text-[10px] font-mono font-semibold text-ink-mid tabular-nums">{l.at}</span>
              <span className="text-[11.5px] font-extrabold text-ink">{l.serviceName}</span>
              <span className="text-[10.5px] text-ink-mid font-semibold">{TENANT_SHORT[l.tenant]} · {l.category}</span>
              <StatusPill tone={ACTION_TONE[l.action]}>{l.action}</StatusPill>
              <span className="text-[10.5px] text-ink-dark font-semibold">{l.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
