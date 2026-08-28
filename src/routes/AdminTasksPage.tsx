/**
 * 관리 콘솔 — 과제 관리.
 *
 * RFP 2-1 관리자 포털: "과제 관리 화면: 계열사별 과제 등록·검토·결재·이행 모니터링,
 * 과제별 자원·비용 현황"
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT, TENANTS } from '@/data/tenants';
import { ADMIN_TASKS, STAGE_TONE, type AdminTask, type AdminTaskStage } from '@/data/mockAdminTasks';

const STAGES: AdminTaskStage[] = ['등록', '검토', '결재', '이행 중', '완료', '반려'];

export default function AdminTasksPage() {
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<AdminTaskStage | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>(ADMIN_TASKS[0].id);
  /**
   * RFP 2-1 은 이 화면에 "등록·검토·**결재**·이행 모니터링" 을 요구한다.
   * 예전에는 승인·반려가 토스트만 띄우고 단계가 그대로여서 요건의 한가운데인
   * 결재가 동작하지 않았다. 원장(mock)은 불변으로 두고 세션 메모리 위에
   * 결재 진행분만 얹는다 — 브라우저 스토리지 금지 규칙에 맞는 방식이다.
   */
  const [tasks, setTasks] = useState<AdminTask[]>(ADMIN_TASKS);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (tenantFilter === 'all' || t.tenant === tenantFilter) &&
          (stageFilter === 'all' || t.stage === stageFilter),
      ),
    [tasks, tenantFilter, stageFilter],
  );
  const selected = tasks.find((t) => t.id === selectedId) ?? filtered[0];

  const totals = useMemo(() => {
    const budget = tasks.reduce((a, t) => a + t.budget, 0);
    const spent = tasks.reduce((a, t) => a + t.spent, 0);
    const active = tasks.filter((t) => t.stage === '이행 중').length;
    const pending = tasks.filter((t) => t.stage === '검토' || t.stage === '결재').length;
    return { budget, spent, active, pending };
  }, [tasks]);

  /**
   * 승인 — 진행 중인 결재 한 단계를 완료 처리하고 다음 단계를 '진행'으로 올린다.
   * 검토 단계에서 1차가 끝나면 stage 가 `결재` 로, 마지막 단계가 끝나면
   * `이행 중` 으로 넘어간다.
   */
  const approve = (id: string) => {
    setTasks((arr) =>
      arr.map((t) => {
        if (t.id !== id) return t;
        const running = t.approvals.findIndex((a) => a.status === '진행');
        const cur = running >= 0 ? running : t.approvals.findIndex((a) => a.status === '대기');
        if (cur < 0) return t;

        const approvals = t.approvals.map((a, i) =>
          i === cur
            ? { ...a, status: '완료' as const }
            : i === cur + 1
              ? { ...a, status: '진행' as const }
              : a,
        );
        const done = approvals.every((a) => a.status === '완료');
        const stage: AdminTaskStage = done ? '이행 중' : t.stage === '검토' ? '결재' : t.stage;
        toast(
          done
            ? `${t.name} 결재 완료 — 이행 단계로 전환했습니다`
            : `${t.name} · ${t.approvals[cur].role} 승인 — 다음 단계로 넘어갑니다`,
        );
        return { ...t, approvals, stage };
      }),
    );
  };

  /** 반려 — 진행 중 단계를 대기로 되돌리고 과제를 `반려` 로 내린다. */
  const reject = (id: string) => {
    setTasks((arr) =>
      arr.map((t) => {
        if (t.id !== id) return t;
        toast(`${t.name} 반려 — 기안 부서로 반송했습니다 · 감사 원장에 기록됩니다`);
        return {
          ...t,
          stage: '반려' as AdminTaskStage,
          approvals: t.approvals.map((a) =>
            a.status === '진행' ? { ...a, status: '대기' as const } : a,
          ),
        };
      }),
    );
  };

  const fmt = (n: number) => `₩${(n / 100_000_000).toFixed(1)}억`;

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">과제 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            계열사별 과제 등록부터 결재·이행까지 한 화면에서 추적한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          2-1 과제 관리
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard label="전체 배정 예산" value={fmt(totals.budget)} tone="ok" />
        <KpiCard label="집행액" value={fmt(totals.spent)} sub={`집행률 ${((totals.spent/totals.budget)*100).toFixed(0)}%`} tone="ok" />
        <KpiCard label="이행 중" value={String(totals.active)} unit="건" tone="ok" />
        <KpiCard label="검토·결재 대기" value={String(totals.pending)} unit="건" tone="warn" />
      </div>

      <div className="card px-4 py-2.5 mb-3 flex items-center gap-3 flex-wrap">
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="py-1.5 px-2 border border-line rounded text-[12px] bg-white font-semibold"
        >
          <option value="all">전체 계열사</option>
          {TENANTS.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {(['all', ...STAGES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStageFilter(s as AdminTaskStage | 'all')}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[11px] font-extrabold',
                stageFilter === s
                  ? 'bg-brand-dark border-brand-dark text-white'
                  : 'bg-white border-line text-ink-dark hover:border-brand-dark',
              )}
            >
              {s === 'all' ? '전체' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <div className="flex flex-col gap-1.5">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={cn(
                'text-left grid grid-cols-[100px_1fr_90px_auto] gap-3 items-center px-4 py-3 bg-white border rounded transition-colors',
                selected?.id === t.id ? 'border-brand-dark bg-brand-bg' : 'border-line-soft hover:border-brand-dark',
              )}
            >
              <span className="text-[10px] font-mono font-bold text-ink-mid">{t.id}</span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-extrabold text-ink truncate">{t.name}</div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                  {TENANT_SHORT[t.tenant]} · {t.dept} · {t.requestedBy}
                </div>
              </div>
              <span className="text-[10.5px] font-bold text-ink-dark tabular-nums text-right">
                {fmt(t.spent)}/{fmt(t.budget)}
              </span>
              <StatusPill tone={STAGE_TONE[t.stage]}>{t.stage}</StatusPill>
            </button>
          ))}
        </div>

        {selected && (
          <div className="card p-4 self-start sticky top-[110px]">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[13.5px] font-extrabold text-ink">{selected.name}</span>
              <StatusPill tone={STAGE_TONE[selected.stage]}>{selected.stage}</StatusPill>
            </div>
            <div className="text-[10.5px] text-ink-mid font-semibold mb-2">
              {selected.id} · {TENANT_SHORT[selected.tenant]} · {selected.dept}
            </div>
            <p className="text-[11px] text-ink-dark font-semibold leading-snug mb-3">{selected.summary}</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="border border-line-soft rounded px-2.5 py-2">
                <div className="text-[9.5px] text-ink-light font-extrabold uppercase">예산</div>
                <div className="text-[12.5px] font-extrabold text-ink tabular-nums">{fmt(selected.budget)}</div>
              </div>
              <div className="border border-line-soft rounded px-2.5 py-2">
                <div className="text-[9.5px] text-ink-light font-extrabold uppercase">집행</div>
                <div className="text-[12.5px] font-extrabold text-ink tabular-nums">{fmt(selected.spent)}</div>
              </div>
            </div>
            <div className="text-[10.5px] text-ink-dark font-semibold mb-1">
              자원 · {selected.resource}
            </div>
            {/* 산출물 — 대시보드의 호출·토큰·비용이 이 목록에서 파생된다. */}
            <div className="text-[10.5px] text-ink-dark font-semibold mb-3">
              산출물 ·{' '}
              {selected.agentIds.length + selected.pendingAgentIds.length === 0 ? (
                <span className="text-ink-mid">미배정</span>
              ) : (
                <span className="font-mono">
                  {selected.agentIds.join(' · ')}
                  {selected.pendingAgentIds.length > 0 && (
                    <span className="text-ink-mid">
                      {selected.agentIds.length > 0 ? ' · ' : ''}
                      {selected.pendingAgentIds.join(' · ')} (계측 전)
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">
              결재선
            </div>
            <ol className="space-y-1.5 mb-3">
              {selected.approvals.map((a) => (
                <li key={a.seq} className="flex items-center gap-2">
                  <span className={cn(
                    'w-[16px] h-[16px] rounded-full inline-flex items-center justify-center text-[9px] font-extrabold flex-shrink-0',
                    a.status === '완료' ? 'bg-ok text-white' : a.status === '진행' ? 'bg-warn text-white' : 'bg-surface border border-line text-ink-mid',
                  )}>{a.status === '완료' ? '✓' : a.seq}</span>
                  <span className="text-[11px] font-bold text-ink-dark">{a.role}</span>
                  <span className="ml-auto text-[10px] text-ink-mid font-semibold">{a.status}</span>
                </li>
              ))}
            </ol>

            {(selected.stage === '검토' || selected.stage === '결재') && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => reject(selected.id)}
                  className="flex-1 py-1.5 border border-line rounded text-[11.5px] font-extrabold text-ink-dark hover:border-bad hover:text-bad"
                >반려</button>
                <button
                  type="button"
                  onClick={() => approve(selected.id)}
                  className="flex-1 py-1.5 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
                >승인</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
