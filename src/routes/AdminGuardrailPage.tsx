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
  type GuardPolicy,
} from '@/data/mockGuardrailPolicy';

type Tab = 'policy' | 'exception' | 'history';

const ACTION_TONE: Record<GuardAction, 'bad' | 'warn' | 'info'> = {
  차단: 'bad',
  마스킹: 'warn',
  경고: 'info',
};

const ACTIONS: GuardAction[] = ['차단', '마스킹', '경고'];
/** 강도 순서 — 계열사는 그룹 베이스라인보다 완화할 수 없다(강화만 가능). */
const STRENGTH: Record<GuardAction, number> = { 경고: 1, 마스킹: 2, 차단: 3 };

export default function AdminGuardrailPage() {
  const [tab, setTab] = useState<Tab>('policy');
  /**
   * RFP 2-1 [42] "그룹ᆞ계열사별 AI가드레일 정책의 **적용범위 및 세부기준 설정** 기능".
   * 예전에는 정책행 '수정'이 전 행 토스트만이라 정책 탭이 통째로 no-op 이었다.
   * 여기서는 모달로 조치(차단·마스킹·경고)와 세부기준을 실제로 바꾼다.
   * mock 원본은 불변으로 두고 세션 메모리에만 얹는다(브라우저 스토리지 금지).
   */
  const [baseline, setBaseline] = useState<GuardPolicy[]>(GROUP_BASELINE);
  const [overrides, setOverrides] = useState<GuardPolicy[]>(TENANT_OVERRIDES);
  const [editing, setEditing] = useState<{ layer: 'group' | 'tenant'; index: number } | null>(null);

  const editingPolicy =
    editing === null ? null : editing.layer === 'group' ? baseline[editing.index] : overrides[editing.index];

  const savePolicy = (next: GuardPolicy) => {
    if (!editing) return;
    if (editing.layer === 'group') {
      setBaseline((arr) => arr.map((p, i) => (i === editing.index ? next : p)));
      // 그룹 기준이 올라가면 그보다 약한 계열사 정책은 자동으로 끌어올린다(완화 금지).
      setOverrides((arr) =>
        arr.map((p) =>
          p.category === next.category && STRENGTH[p.action] < STRENGTH[next.action]
            ? { ...p, action: next.action, threshold: `${next.threshold} (그룹 기준 상향 반영)` }
            : p,
        ),
      );
      toast(`${next.category} 그룹 베이스라인을 변경했습니다 — 전 계열사에 즉시 반영됩니다`);
    } else {
      setOverrides((arr) => arr.map((p, i) => (i === editing.index ? next : p)));
      toast(`${next.scope} · ${next.category} 강화 정책을 변경했습니다 — 감사 원장에 기록됩니다`);
    }
    setEditing(null);
  };

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
              {baseline.map((p, i) => (
                <div key={p.category} className="grid grid-cols-[120px_70px_1fr_auto] gap-3 items-center px-3 py-2 border border-line-soft rounded bg-white">
                  <span className="text-[11.5px] font-extrabold text-ink">{p.category}</span>
                  <StatusPill tone={ACTION_TONE[p.action]}>{p.action}</StatusPill>
                  <span className="text-[10.5px] text-ink-mid font-semibold">{p.threshold}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ layer: 'group', index: i })}
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
              {overrides.map((p, i) => (
                <div key={`${p.scope}-${p.category}`} className="grid grid-cols-[90px_120px_70px_1fr_auto] gap-3 items-center px-3 py-2 border border-line-soft rounded bg-white">
                  <span className="text-[11px] font-extrabold text-ink-dark">{p.scope}</span>
                  <span className="text-[11.5px] font-bold text-ink">{p.category}</span>
                  <StatusPill tone={ACTION_TONE[p.action]}>{p.action}</StatusPill>
                  <span className="text-[10.5px] text-ink-mid font-semibold">{p.threshold}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ layer: 'tenant', index: i })}
                    className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand"
                  >수정</button>
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

      {editingPolicy && editing && (
        <PolicyEditModal
          policy={editingPolicy}
          layer={editing.layer}
          /* 계열사 정책은 그룹 베이스라인보다 약해질 수 없다 — 하한을 넘겨 준다. */
          minAction={
            editing.layer === 'tenant'
              ? baseline.find((b) => b.category === editingPolicy.category)?.action
              : undefined
          }
          onCancel={() => setEditing(null)}
          onSave={savePolicy}
        />
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

/**
 * 정책 편집 모달 — 조치(차단·마스킹·경고)와 세부기준을 바꾼다.
 * 계열사 계층에서는 그룹 베이스라인보다 약한 조치를 고를 수 없다(완화 금지).
 */
function PolicyEditModal({
  policy,
  layer,
  minAction,
  onCancel,
  onSave,
}: {
  policy: GuardPolicy;
  layer: 'group' | 'tenant';
  minAction?: GuardAction;
  onCancel: () => void;
  onSave: (next: GuardPolicy) => void;
}) {
  const [action, setAction] = useState<GuardAction>(policy.action);
  const [threshold, setThreshold] = useState(policy.threshold);
  const floor = minAction ? STRENGTH[minAction] : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
      <div className="w-[520px] max-w-full bg-white border border-line rounded shadow-lg">
        <div className="px-5 py-3.5 border-b border-line-soft">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">가드레일 정책 수정</h3>
            <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
              {layer === 'group' ? '그룹 베이스라인' : `${policy.scope} 강화 정책`}
            </span>
            <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              2-1 [42]
            </span>
          </div>
          <div className="text-[11px] text-ink-mid font-semibold mt-1">
            {policy.category} · 적용 범위{' '}
            {layer === 'group' ? '10개 계열사 + 그룹 공통 전체' : `${policy.scope} Namespace 한정`}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div>
            <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
              조치
            </div>
            <div className="flex items-center gap-1.5">
              {ACTIONS.map((a) => {
                const blocked = STRENGTH[a] < floor;
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={blocked}
                    onClick={() => setAction(a)}
                    title={blocked ? '그룹 베이스라인보다 완화할 수 없습니다' : undefined}
                    className={cn(
                      'px-3 py-1.5 rounded border text-[11.5px] font-extrabold',
                      blocked
                        ? 'bg-surface border-line text-ink-light cursor-not-allowed'
                        : action === a
                          ? 'bg-brand-bg border-brand-dark text-ink'
                          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
                    )}
                  >{a}</button>
                );
              })}
            </div>
            {minAction && (
              <div className="text-[10px] text-ink-mid font-semibold mt-1.5">
                그룹 기준 <b className="text-ink-dark">{minAction}</b> 이상만 선택할 수 있다 —
                계열사는 강화만 얹을 수 있다
              </div>
            )}
          </div>

          <div>
            <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
              세부 기준
            </div>
            <textarea
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-line rounded text-[11.5px] outline-none focus:border-brand-dark resize-none"
            />
          </div>

          <div className="text-[10.5px] text-ink-mid bg-surface-soft border border-line-soft rounded px-3 py-2 leading-snug">
            저장하면 게이트웨이 가드레일 엔진에 즉시 반영되고, 변경 이력은 감사 원장
            (보안·거버넌스 관리 &gt; 통합 감사 원장)에 적산된다.
            {layer === 'group' && ' 그룹 기준을 올리면 그보다 약한 계열사 정책도 함께 상향된다.'}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line-soft flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="py-1.5 px-3 border border-line rounded text-[11.5px] font-extrabold text-ink-dark hover:border-brand-dark"
          >취소</button>
          <button
            type="button"
            onClick={() => onSave({ ...policy, action, threshold: threshold.trim() || policy.threshold })}
            className="flex-1 py-1.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
          >저장 · 즉시 반영</button>
        </div>
      </div>
    </div>
  );
}
