import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import KpiCard from '@/components/ui/KpiCard';
import { cn } from '@/lib/utils';
import {
  ADMIN_PROJECT_ROWS,
  getAdminKpis,
  getModelPtuUsage,
  getDailyLabels,
  getDailyCallSeries,
  getModelPtuCost,
  getTotalPtuCost,
  getCostBreakdownByCategory,
  getDailyCostSeries,
  getCostByConglomerate,
  getCostByAgent,
  PTU_CHANGE_EVENTS,
  type PtuChangeEvent,
  type ConglomerateCostRow,
  type AgentCostRow,
  DEPT_USAGE,
  TOP_SPIKES,
  TOP_DROPS,
  ACTIVITY_FEED,
  APPROVAL_ANALYTICS,
  getConglomerateTokenSeries,
  getProjectDauSeries,
  getProjectSafetySeries,
  PII_CATEGORIES,
  AGENT_PII_POLICIES,
  NAMESPACES,
  CATEGORY_COLOR,
  DEPLOYMENTS,
  type ProjectUsageRow,
  type ModelPtuUsage,
  type ActivityItem,
  type ActivityKind,
  type ChangeRow,
  type ConglomerateTokenSeries,
  type ProjectDauSeries,
  type ProjectSafetySeries,
  type PiiAction,
  type NamespaceUsage,
  type NamespaceCategory,
  type Deployment,
  type DeploymentStatus,
} from '@/data/mockAdminDashboard';
import {
  LOCATIONS,
  GPU_NODES,
  MODEL_DEPLOYMENTS,
  getLocationSummaries,
  getLocationUtilSeries,
  type LocationId,
  type GpuNode,
  type GpuCard,
  type GpuStatus,
  type ModelDeployment,
  type LocationSummary,
} from '@/data/mockGpuInfra';

type TabId = 'overview' | 'usage' | 'model' | 'infra' | 'gpu' | 'governance' | 'cost';

/** 관리 대시보드 Grafana 패널 URL — 위젯별 직링크. */
const GRAFANA_BASE = 'https://monitor.aip.group.local';
function grafanaAdminPanel(panel: string): string {
  return `${GRAFANA_BASE}/d/aip-admin-dashboard/admin-dashboard?viewPanel=${encodeURIComponent(panel)}`;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'usage', label: '사용 현황' },
  { id: 'model', label: '모델' },
  { id: 'infra', label: '자원' },
  { id: 'gpu', label: 'GPU·인프라' },
  { id: 'governance', label: '안전·거버넌스' },
  { id: 'cost', label: '비용' },
];

/**
 * 플랫폼 관리자 대시보드 — 계열사(부산은행) 내 모든 프로젝트의 사용 현황을
 * 4개 탭(개요·사용 현황·PTU·자원·안전·거버넌스)으로 분할해 한 레이어 위에서 본다.
 *
 * 비용 모델: 모든 비용은 PTU(Provisioned Throughput Unit) 기반.
 *   월 비용 = 약정 PTU 수 × 모델별 월 단가 (사실상 고정비).
 */
export default function AdminDashboardPage() {
  const [tab, setTab] = useState<TabId>('overview');
  const rows = ADMIN_PROJECT_ROWS;

  return (
    <>
      {/* Header */}
      <div className="card px-6 py-5 mb-3.5 flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] text-ink-mid font-bold tracking-[0.3px] mb-1">
            플랫폼 관리자 대시보드 · 계열사{' '}
            <span className="text-ink-dark">부산은행</span>
          </div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
            사용 현황 대시보드
          </h1>
          <div className="text-[12px] text-ink-mid mt-1.5">
            {rows.length}개 프로젝트의 트래픽·자원·품질·안전 메트릭을 한 화면에서 비교
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <nav className="card px-1 mb-3.5 sticky top-[98px] z-20 flex items-center bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'py-3 px-[18px] text-[12.5px] font-bold border-b-2 -mb-px',
              tab === t.id
                ? 'text-ink border-brand-dark'
                : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab rows={rows} />}
      {tab === 'usage' && <UsageTab rows={rows} />}
      {tab === 'model' && <ResourceTab rows={rows} />}
      {tab === 'infra' && <InfraTab />}
      {tab === 'gpu' && <GpuInfraTab />}
      {tab === 'governance' && <GovernanceTab rows={rows} />}
      {tab === 'cost' && <CostTab rows={rows} />}

      <div className="text-[10.5px] text-ink-mid bg-surface-soft border border-line-soft rounded px-3 py-2 mt-3.5">
        🔒 본 대시보드는 플랫폼 관리자 권한으로만 접근 가능합니다. 진입·열람은 감사 원장에 기록됩니다.
      </div>
    </>
  );
}

/* =====================================================================
 * 1) 개요 탭 — 전반적 큰 그림 (홈 화면 톤)
 * ===================================================================== */

function OverviewTab({ rows }: { rows: ProjectUsageRow[] }) {
  const kpis = useMemo(() => getAdminKpis(rows), [rows]);
  const callSeries = useMemo(() => getDailyCallSeries(rows), [rows]);
  const dayLabels = useMemo(() => getDailyLabels(), []);
  const totalPtus = useMemo(
    () => getModelPtuUsage().reduce((a, m) => a + m.allocatedPtus, 0),
    [],
  );
  const ptuCost = useMemo(() => getTotalPtuCost(), []);
  const avgPtuEfficiency = useMemo(() => {
    const u = getModelPtuUsage();
    return u.reduce((a, m) => a + m.avgUtilizationPct, 0) / u.length;
  }, []);
  const totalMau = useMemo(() => DEPT_USAGE.reduce((a, d) => a + d.dau * 2.5, 0), []);
  const totalDau = useMemo(() => DEPT_USAGE.reduce((a, d) => a + d.dau, 0), []);

  const top5 = useMemo(
    () =>
      [...rows]
        .filter((r) => r.status === '운영 중')
        .sort((a, b) => b.monthCalls - a.monthCalls)
        .slice(0, 5),
    [rows],
  );

  const sloIssues = useMemo(
    () =>
      [...rows]
        .filter((r) => r.status === '운영 중')
        .sort((a, b) => a.sloAttainment - b.sloAttainment)
        .slice(0, 3),
    [rows],
  );
  const safetyIssues = useMemo(
    () =>
      [...rows]
        .filter((r) => r.status === '운영 중')
        .sort(
          (a, b) =>
            b.guardrailBlocks +
            b.policyViolations -
            (a.guardrailBlocks + a.policyViolations),
        )
        .slice(0, 3),
    [rows],
  );

  return (
    <section className="space-y-3.5">
      {/* KPI 6장 */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard
          label="프로젝트"
          value={`${kpis.totalProjects}`}
          unit="건"
          sub={`운영 중 ${kpis.operatingProjects} · 개발 중 ${kpis.planningProjects}`}
          tone="ok"
        />
        <KpiCard
          label="에이전트"
          value={`${kpis.totalServingAgents}`}
          unit="개"
          sub={`서빙계 ${kpis.totalServingAgents} / 총 ${kpis.totalAgents}`}
          tone="ok"
        />
        <KpiCard
          label="월 호출"
          value={fmtCompact(kpis.totalCalls)}
          sub="전체 합산 · 30일"
          tone="ok"
        />
        <KpiCard
          label="활성 사용자"
          value={fmtCompact(Math.round(totalMau))}
          unit="MAU"
          sub={`DAU ${fmtCompact(totalDau)}`}
          tone="ok"
        />
        <KpiCard
          label="월 PTU 비용"
          value={`₩${fmtKRW(ptuCost)}`}
          sub={`${totalPtus} PTU 약정 · 효율 평균 ${avgPtuEfficiency.toFixed(0)}%`}
          tone={ptuCost > kpis.totalBudget * 0.9 ? 'bad' : 'ok'}
        />
        <KpiCard
          label="안전 이벤트 (7일)"
          value={`${kpis.totalSafetyEvents}`}
          unit="건"
          sub={`PII 마스킹 ${fmtCompact(kpis.totalPiiMasked)} · 결재 대기 ${kpis.totalPendingApprovals}`}
          tone={kpis.totalSafetyEvents >= 100 ? 'bad' : 'warn'}
        />
      </div>

      {/* 30일 호출량 추이 */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">30일 호출량 추이</h3>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              전사 합산 · 일별 호출 수
            </div>
          </div>
          <div className="text-[11.5px] text-ink-mid">
            30일 합 <b className="text-ink-dark tabular-nums">{fmtCompact(kpis.totalCalls)}</b>{' '}
            · 일평균{' '}
            <b className="text-ink-dark tabular-nums">
              {fmtCompact(Math.round(kpis.totalCalls / 30))}
            </b>
          </div>
        </div>
        <BigLineChart series={callSeries} days={dayLabels} unit="calls" />
      </div>

      {/* Top 5 프로젝트 미니 카드 */}
      <div>
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="text-[14px] font-extrabold text-ink">호출량 Top 5 프로젝트</h3>
          <span className="text-[11px] text-ink-mid">월 호출 기준 · 사용 현황 탭에서 전체 보기</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {top5.map((r) => (
            <Top5Card key={r.id} row={r} />
          ))}
        </div>
      </div>

      {/* 시그널 위젯 3분할 */}
      <div className="grid grid-cols-3 gap-3.5">
        <SignalCard
          title="결재 대기"
          subtitle="전사 진행 중"
          tone="warn"
          metric={`${kpis.totalPendingApprovals}건`}
        >
          <ul className="text-[11.5px] space-y-0.5">
            {APPROVAL_ANALYTICS.filter((a) => a.pending > 0).map((a) => (
              <li key={a.category} className="flex justify-between">
                <span className="text-ink-mid">{a.category}</span>
                <b className="text-ink-dark tabular-nums">{a.pending}건</b>
              </li>
            ))}
          </ul>
        </SignalCard>

        <SignalCard
          title="SLO 주의"
          subtitle="P95 목표 충족률 낮은 프로젝트"
          tone="warn"
          metric={`${sloIssues.length}건`}
        >
          <ul className="text-[11.5px] space-y-1">
            {sloIssues.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link to={`/projects/${r.id}`} className="flex-1 truncate text-ink-dark hover:text-info font-bold">
                  {r.name}
                </Link>
                <span
                  className={cn(
                    'tabular-nums font-extrabold',
                    r.sloAttainment >= 99 ? 'text-ok' : r.sloAttainment >= 98 ? 'text-warn' : 'text-bad',
                  )}
                >
                  {r.sloAttainment.toFixed(2)}%
                </span>
              </li>
            ))}
          </ul>
        </SignalCard>

        <SignalCard
          title="안전 이벤트 Top"
          subtitle="가드레일 차단 + 정책 위반 (7일)"
          tone="bad"
          metric={`${kpis.totalSafetyEvents}건`}
        >
          <ul className="text-[11.5px] space-y-1">
            {safetyIssues.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Link to={`/projects/${r.id}`} className="flex-1 truncate text-ink-dark hover:text-info font-bold">
                  {r.name}
                </Link>
                <span
                  className={cn(
                    'tabular-nums font-extrabold',
                    r.policyViolations > 0 ? 'text-bad' : 'text-warn',
                  )}
                >
                  {r.guardrailBlocks + r.policyViolations}건
                </span>
              </li>
            ))}
          </ul>
        </SignalCard>
      </div>

      {/* 최근 활동 피드 */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[14px] font-extrabold text-ink">최근 활동</h3>
          <span className="text-[11px] text-ink-mid">신규 등록 · 프로모션 · 정책·인시던트</span>
        </div>
        <ul className="space-y-1.5">
          {ACTIVITY_FEED.map((a) => (
            <ActivityRow key={a.id} item={a} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Top5Card({ row }: { row: ProjectUsageRow }) {
  return (
    <Link
      to={`/projects/${row.id}`}
      className="card px-3.5 py-3 hover:border-brand-dark transition-colors block"
    >
      <div className="text-[10.5px] text-ink-mid font-bold mb-1.5 truncate">
        PM <span className="text-ink-dark">{row.pmName}</span>
      </div>
      <div className="text-[12.5px] font-extrabold text-ink leading-tight mb-2 line-clamp-2 min-h-[32px]">
        {row.name}
      </div>
      <div className="text-[15px] font-extrabold text-ink tabular-nums">
        {fmtCompact(row.monthCalls)}
      </div>
      <div
        className={cn(
          'text-[10.5px] font-bold tabular-nums mt-0.5',
          row.monthCallsDeltaPct >= 0 ? 'text-ok' : 'text-bad',
        )}
      >
        {row.monthCallsDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(row.monthCallsDeltaPct).toFixed(1)}%
      </div>
    </Link>
  );
}

function SignalCard({
  title,
  subtitle,
  tone,
  metric,
  children,
}: {
  title: string;
  subtitle: string;
  tone: 'warn' | 'bad' | 'ok';
  metric: string;
  children: React.ReactNode;
}) {
  const dot = tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-ok';
  const metricTone = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ok';
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-baseline justify-between mb-2.5">
        <h3 className="text-[13px] font-extrabold text-ink flex items-center gap-1.5">
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dot)} />
          {title}
        </h3>
        <span className={cn('text-[15px] font-extrabold tabular-nums', metricTone)}>{metric}</span>
      </div>
      <div className="text-[10.5px] text-ink-mid mb-2">{subtitle}</div>
      {children}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const kindStyle: Record<ActivityKind, { label: string; cls: string }> = {
    project_register: { label: '등록', cls: 'bg-brand-tint text-brand border-brand-tint' },
    train_deploy: { label: '학습계', cls: 'bg-info-bg text-info border-info-border' },
    serv_promotion: { label: '서빙계', cls: 'bg-ok-bg text-ok border-ok-border' },
    policy_violation: { label: '정책', cls: 'bg-warn-bg text-warn border-warn-border' },
    incident: { label: '인시던트', cls: 'bg-bad-bg text-bad border-bad-border' },
    ptu_change: { label: 'PTU', cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border' },
    audit: { label: '감사', cls: 'bg-surface text-ink-mid border-line-soft' },
  };
  const k = kindStyle[item.kind];
  const Wrapper: React.ElementType = item.href ? Link : 'div';
  const wrapperProps = item.href ? { to: item.href } : {};
  return (
    <li>
      <Wrapper
        {...wrapperProps}
        className={cn(
          'grid grid-cols-[60px_1fr_auto] gap-2.5 items-center py-2 px-2 rounded text-[12px]',
          item.href && 'hover:bg-surface-soft',
        )}
      >
        <span className={cn('pill border text-center', k.cls)}>{k.label}</span>
        <div className="min-w-0">
          <div className="font-extrabold text-ink truncate">{item.title}</div>
          <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{item.who}</div>
        </div>
        <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">{item.at}</span>
      </Wrapper>
    </li>
  );
}

/* =====================================================================
 * 2) 사용 현황 탭 — 누가 얼마나 쓰고 있나
 * ===================================================================== */

type SortKey = 'name' | 'calls' | 'slo' | 'safety' | 'resource';

function UsageTab({ rows }: { rows: ProjectUsageRow[] }) {
  const [sort, setSort] = useState<SortKey>('calls');
  const tokenSeries = useMemo(() => getConglomerateTokenSeries(), []);
  const dauSeries = useMemo(() => getProjectDauSeries(rows), [rows]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'slo':
          return a.sloAttainment - b.sloAttainment;
        case 'safety':
          return (
            b.guardrailBlocks +
            b.policyViolations -
            (a.guardrailBlocks + a.policyViolations)
          );
        case 'resource':
          return b.tpmUtilPct - a.tpmUtilPct;
        case 'calls':
        default:
          return b.monthCalls - a.monthCalls;
      }
    });
    return arr;
  }, [rows, sort]);

  const trafficShare = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.monthCalls, 0) || 1;
    return [...rows]
      .filter((r) => r.monthCalls > 0)
      .sort((a, b) => b.monthCalls - a.monthCalls)
      .map((r) => ({ ...r, pct: (r.monthCalls / total) * 100 }));
  }, [rows]);

  return (
    <section className="space-y-3.5">
      {/* 비교 테이블 */}
      <div className="card">
        <div className="px-5 py-3.5 flex items-baseline justify-between border-b border-line-soft gap-3 flex-wrap">
          <h2 className="text-[15px] font-extrabold text-ink">프로젝트별 사용 현황</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-mid font-semibold">정렬</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-7 px-2 border border-line rounded text-[11.5px] outline-none bg-white"
              >
                <option value="calls">호출 많은 순</option>
                <option value="slo">SLO 낮은 순 (주의)</option>
                <option value="safety">안전 이벤트 많은 순</option>
                <option value="resource">자원 압박 큰 순 (TPM)</option>
                <option value="name">이름순</option>
              </select>
            </div>
            <GrafanaLink panel="project-usage" />
          </div>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
              <th className="text-left font-bold py-2.5 px-4">프로젝트 · PM</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">월 호출</th>
              <th className="text-right font-bold py-2.5 px-2 w-[110px]">SLO</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">안전 (7일)</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">자원 (TPM/쿼터)</th>
              <th className="text-right font-bold py-2.5 px-4 w-[120px]">마지막 활동</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <ProjectRow key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 트래픽 분포 + 부서별 DAU */}
      <div className="grid grid-cols-2 gap-3.5">
        <ShareCard
          title="트래픽 분포"
          subtitle="월 호출 기준"
          data={trafficShare}
          unit="calls"
          grafanaPanel="traffic-share"
        />
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">프로젝트별 사용자 추이</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">최근 30일 일별 DAU</div>
            </div>
            <GrafanaLink panel="project-dau-trend" />
          </div>
          <ProjectDauChart series={dauSeries} />
        </div>
      </div>

      {/* 프로젝트별 토큰 사용량 (막대) + Top Spikes / Drops */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-3.5">
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">프로젝트별 토큰 사용량</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-[10.5px] text-ink-mid">30일 합산 · 입력 + 출력</span>
              <GrafanaLink panel="project-token" />
            </div>
          </div>
          <ProjectTokenBarChart rows={rows} />
        </div>
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">전주 대비 변화</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-[10.5px] text-ink-mid">호출량 ▲ 급증 · ▼ 급감</span>
              <GrafanaLink panel="weekly-change" />
            </div>
          </div>
          <div className="text-[10.5px] font-extrabold text-ok mb-1.5">▲ 급증</div>
          <ul className="space-y-1 mb-3">
            {TOP_SPIKES.map((r) => (
              <ChangeRowItem key={r.projectId} row={r} />
            ))}
          </ul>
          <div className="text-[10.5px] font-extrabold text-bad mb-1.5">▼ 급감</div>
          <ul className="space-y-1">
            {TOP_DROPS.map((r) => (
              <ChangeRowItem key={r.projectId} row={r} />
            ))}
          </ul>
        </div>
      </div>

      {/* 계열사별 토큰 사용량 추이 — 30일 라인 */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">계열사별 토큰 사용량 추이</h3>
            <div className="text-[10.5px] text-ink-mid mt-0.5">최근 30일 · 일별 입력+출력 합산</div>
          </div>
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            {tokenSeries.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-ink-dark font-bold">{s.name}</span>
                <span className="text-ink-mid font-semibold tabular-nums">
                  {fmtCompact(s.total)}
                </span>
              </span>
            ))}
            <GrafanaLink panel="conglomerate-token" />
          </div>
        </div>
        <ConglomerateTokenChart series={tokenSeries} />
      </div>
    </section>
  );
}

function ProjectRow({ row }: { row: ProjectUsageRow }) {
  const sloTone =
    row.status !== '운영 중'
      ? 'text-ink-light'
      : row.sloAttainment >= 99
      ? 'text-ok'
      : row.sloAttainment >= 97
      ? 'text-warn'
      : 'text-bad';
  const safetyCount = row.guardrailBlocks + row.policyViolations;
  const safetyTone =
    row.status !== '운영 중'
      ? 'text-ink-light'
      : row.policyViolations > 0
      ? 'text-bad'
      : safetyCount >= 50
      ? 'text-warn'
      : 'text-ink-dark';
  const tpmTone =
    row.status !== '운영 중'
      ? 'text-ink-light'
      : row.tpmUtilPct >= 90
      ? 'text-bad'
      : row.tpmUtilPct >= 75
      ? 'text-warn'
      : 'text-ink-dark';
  return (
    <tr className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
      <td className="py-2.5 px-4">
        <Link to={`/projects/${row.id}`} className="block hover:text-info">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                row.status === '운영 중' ? 'bg-ok' : row.status === '개발 중' ? 'bg-warn' : 'bg-line',
              )}
            />
            <span className="text-[12.5px] font-extrabold text-ink">{row.name}</span>
            {row.status !== '운영 중' && (
              <span className="pill bg-warn-bg text-warn border border-warn-border text-[9.5px]">
                {row.status}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
            PM <b className="text-ink-dark">{row.pmName}</b> · {row.dept}
          </div>
        </Link>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums">
        <div className="font-extrabold text-ink">{fmtCompact(row.monthCalls)}</div>
        {row.status === '운영 중' && (
          <div
            className={cn(
              'text-[10px] font-bold',
              row.monthCallsDeltaPct >= 0 ? 'text-ok' : 'text-bad',
            )}
          >
            {row.monthCallsDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(row.monthCallsDeltaPct).toFixed(1)}%
          </div>
        )}
      </td>
      <td className={cn('py-2.5 px-2 text-right tabular-nums font-extrabold', sloTone)}>
        {row.status === '운영 중' ? `${row.sloAttainment.toFixed(2)}%` : '—'}
        {row.status === '운영 중' && (
          <div className="text-[10px] text-ink-mid font-semibold">
            P95 {(row.p95Ms / 1000).toFixed(2)}s
          </div>
        )}
      </td>
      <td className={cn('py-2.5 px-2 text-right tabular-nums font-extrabold', safetyTone)}>
        {row.status === '운영 중' ? `${safetyCount}건` : '—'}
        {row.status === '운영 중' && (
          <div className="text-[10px] text-ink-mid font-semibold">PII {fmtCompact(row.piiMaskCount)}</div>
        )}
      </td>
      <td className={cn('py-2.5 px-2 text-right tabular-nums font-extrabold', tpmTone)}>
        {row.status === '운영 중' ? `${row.tpmUtilPct.toFixed(0)}%` : '—'}
        {row.status === '운영 중' && (
          <div className="text-[10px] text-ink-mid font-semibold">쿼터 {row.tokenQuotaPct.toFixed(0)}%</div>
        )}
      </td>
      <td className="py-2.5 px-4 text-right text-[10.5px] text-ink-mid font-semibold tabular-nums">
        {row.lastActivity.slice(5)}
      </td>
    </tr>
  );
}

function ShareCard({
  title,
  subtitle,
  data,
  unit,
  grafanaPanel,
}: {
  title: string;
  subtitle: string;
  data: (ProjectUsageRow & { pct: number })[];
  unit: 'calls' | 'cost';
  grafanaPanel?: string;
}) {
  const palette = [
    'bg-brand-dark',
    'bg-info',
    'bg-ok',
    'bg-accent-purple',
    'bg-warn',
    'bg-accent-brown',
  ];
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-[14px] font-extrabold text-ink">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] text-ink-mid">{subtitle}</span>
          {grafanaPanel && <GrafanaLink panel={grafanaPanel} />}
        </div>
      </div>
      <div className="flex h-7 rounded overflow-hidden border border-line-soft mb-2.5">
        {data.map((r, i) => (
          <div
            key={r.id}
            className={cn(palette[i % palette.length])}
            style={{ width: `${r.pct}%` }}
            title={`${r.name} · ${r.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {data.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 text-[11.5px] text-ink-dark">
            <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', palette[i % palette.length])} />
            <span className="flex-1 truncate font-semibold">{r.name}</span>
            <span className="font-extrabold tabular-nums text-ink">
              {unit === 'calls' ? fmtCompact(r.monthCalls) : `₩${fmtKRW(r.monthCost)}`}
            </span>
            <span className="w-[42px] text-right text-ink-mid font-bold tabular-nums">
              {r.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeRowItem({ row }: { row: ChangeRow }) {
  const up = row.deltaPct >= 0;
  return (
    <li>
      <Link
        to={`/projects/${row.projectId}`}
        className="grid grid-cols-[1fr_auto] gap-2 items-center py-1.5 px-2 rounded hover:bg-surface-soft text-[11.5px]"
      >
        <div className="min-w-0">
          <div className="font-extrabold text-ink truncate">{row.name}</div>
          <div className="text-[10.5px] text-ink-mid font-semibold">
            월 호출 {fmtCompact(row.monthCalls)}
          </div>
        </div>
        <span className={cn('font-extrabold tabular-nums', up ? 'text-ok' : 'text-bad')}>
          {up ? '▲' : '▼'} {Math.abs(row.deltaPct).toFixed(1)}%
        </span>
      </Link>
    </li>
  );
}

/** 프로젝트별 토큰 사용량 — 30일 합산 stack 막대(입력/출력). */
function ProjectTokenBarChart({ rows }: { rows: ProjectUsageRow[] }) {
  const data = rows
    .filter((r) => r.monthTokenInput + r.monthTokenOutput > 0)
    .map((r) => ({
      name: r.name,
      shortName: r.name.replace(' 에이전트 프로젝트', '').replace(' 프로젝트', ''),
      input: r.monthTokenInput,
      output: r.monthTokenOutput,
      total: r.monthTokenInput + r.monthTokenOutput,
    }))
    .sort((a, b) => b.total - a.total);

  const max = Math.max(...data.map((d) => d.total), 1) * 1.12;
  const W = 660;
  const H = 220;
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / Math.max(1, data.length);
  const barW = groupW * 0.55;
  const ys = (v: number) => padT + (1 - v / max) * innerH;
  const baseY = padT + innerH;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: H }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const v = max * (1 - p);
          const y = padT + p * innerH;
          return (
            <g key={p}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#999999">
                {fmtCompact(Math.round(v))}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = padL + i * groupW;
          const cx = gx + groupW / 2;
          const bx = cx - barW / 2;
          const inH = baseY - ys(d.input);
          const outH = ys(d.input) - ys(d.input + d.output);
          return (
            <g key={d.name}>
              {/* 입력 (하단) */}
              <rect x={bx} y={ys(d.input)} width={barW} height={inH} fill="#1F5BB8" />
              {/* 출력 (상단) */}
              <rect x={bx} y={ys(d.input + d.output)} width={barW} height={outH} fill="#CB2C10" />
              {/* 총합 라벨 (막대 위) */}
              <text
                x={cx}
                y={ys(d.input + d.output) - 4}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#1A1A1A"
              >
                {fmtCompact(d.total)}
              </text>
              {/* X축 라벨 */}
              <text x={cx} y={H - 20} textAnchor="middle" fontSize="9" fill="#666666" fontWeight="600">
                {d.shortName}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-[10px] text-ink-mid font-semibold mt-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-info" />
          입력 토큰
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-dark" />
          출력 토큰
        </span>
        <span className="ml-auto text-ink-light">
          총합 <b className="text-ink-dark tabular-nums">
            {fmtCompact(data.reduce((a, d) => a + d.total, 0))}
          </b> 토큰
        </span>
      </div>
    </div>
  );
}

/** 계열사별 토큰 사용량 30일 라인 차트. */
function ConglomerateTokenChart({ series }: { series: ConglomerateTokenSeries[] }) {
  const N = series[0]?.daily.length ?? 30;
  const W = 1200;
  const H = 220;
  const padL = 50;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...series.flatMap((s) => s.daily), 1) * 1.08;
  const xs = (i: number) => padL + (i / (N - 1)) * innerW;
  const ys = (v: number) => padT + (1 - v / max) * innerH;
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');

  // 30일 라벨 (오늘 - 29 ~ 오늘)
  const labels: string[] = [];
  const today = new Date('2026-05-24T00:00:00');
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const xLabelIdx = [0, 7, 14, 21, 29];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = padT + p * innerH;
        const v = max * (1 - p);
        return (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#999999">
              {fmtCompact(Math.round(v))}
            </text>
          </g>
        );
      })}
      {series.map((s) => (
        <g key={s.name}>
          <path d={pathOf(s.daily)} fill="none" stroke={s.color} strokeWidth={1.7} />
          <circle cx={xs(s.daily.length - 1)} cy={ys(s.daily[s.daily.length - 1])} r={3} fill={s.color} />
        </g>
      ))}
      {xLabelIdx.map((i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#999999">
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

/** 프로젝트별 사용자(DAU) 30일 추이 라인 차트 — 카드 1/2 사이즈. */
function ProjectDauChart({ series }: { series: ProjectDauSeries[] }) {
  const N = series[0]?.daily.length ?? 30;
  const W = 540;
  const H = 200;
  const padL = 44;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...series.flatMap((s) => s.daily), 1) * 1.1;
  const xs = (i: number) => padL + (i / (N - 1)) * innerW;
  const ys = (v: number) => padT + (1 - v / max) * innerH;
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');

  const labels: string[] = [];
  const today = new Date('2026-05-24T00:00:00');
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const xLabelIdx = [0, 7, 14, 21, 29];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = padT + p * innerH;
          const v = max * (1 - p);
          return (
            <g key={p}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#999999">
                {fmtCompact(Math.round(v))}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <g key={s.projectId}>
            <path d={pathOf(s.daily)} fill="none" stroke={s.color} strokeWidth={1.5} />
            <circle cx={xs(s.daily.length - 1)} cy={ys(s.daily[s.daily.length - 1])} r={2.5} fill={s.color} />
          </g>
        ))}
        {xLabelIdx.map((i) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#999999">
            {labels[i]}
          </text>
        ))}
      </svg>
      {/* 범례 — 최신 DAU 내림차순 */}
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
        {series.map((s) => (
          <li key={s.projectId} className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-ink-dark font-semibold truncate flex-1">{s.name}</span>
            <span className="tabular-nums font-extrabold text-ink">
              {s.daily[s.daily.length - 1].toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 위젯 우상단 Grafana 패널 직링크 (작은 텍스트 링크). */
function GrafanaLink({ panel }: { panel: string }) {
  return (
    <a
      href={grafanaAdminPanel(panel)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10.5px] font-extrabold text-info hover:underline whitespace-nowrap"
      title="Grafana 패널 새 창으로 열기"
    >
      Grafana ↗
    </a>
  );
}

/* =====================================================================
 * 3) PTU·자원 탭
 * ===================================================================== */

const PTU_COLORS = [
  { stroke: '#1F5BB8', dot: 'bg-info' },
  { stroke: '#CB2C10', dot: 'bg-brand-dark' },
  { stroke: '#1B8A4D', dot: 'bg-ok' },
];

function ResourceTab({ rows }: { rows: ProjectUsageRow[] }) {
  const ptuUsage = useMemo(() => getModelPtuUsage(), []);
  const ptuCost = useMemo(() => getModelPtuCost(), []);
  const dayLabels = useMemo(() => getDailyLabels(), []);
  const totalPtuCost = useMemo(() => getTotalPtuCost(), []);

  return (
    <section className="space-y-3.5">
      {/* PTU 사용률 추이 + 할당 현황 */}
      <div className="grid grid-cols-[1.7fr_1fr] gap-3.5">
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">PTU 사용률 추이 · 모델별</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">
                Provisioned Throughput Unit · 할당 한도 대비 실 사용률(%) · 최근 30일
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11.5px]">
              {ptuUsage.map((m, i) => (
                <span key={m.model} className="inline-flex items-center gap-1">
                  <span className={cn('inline-block w-2 h-2 rounded-sm', PTU_COLORS[i % 3].dot)} />
                  <span className="font-mono text-[10.5px] text-ink-dark">{m.model}</span>
                </span>
              ))}
            </div>
          </div>
          <ModelPtuChart series={ptuUsage} days={dayLabels} />
        </div>
        <ModelPtuCard models={ptuUsage} />
      </div>

      {/* 월 PTU 비용 + PTU 효율 */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">월 PTU 비용 · 모델별</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">
                약정 PTU × 모델별 월 단가 · 사실상 고정비
              </div>
            </div>
            <span className="text-[15px] font-extrabold text-ink tabular-nums">
              ₩{fmtKRW(totalPtuCost)}
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line">
                <th className="text-left font-bold py-2">모델</th>
                <th className="text-right font-bold py-2 w-[80px]">PTU</th>
                <th className="text-right font-bold py-2 w-[130px]">PTU 단가</th>
                <th className="text-right font-bold py-2 w-[140px]">월 비용</th>
                <th className="text-right font-bold py-2 w-[90px]">효율</th>
              </tr>
            </thead>
            <tbody>
              {ptuCost.map((m, i) => {
                const tone =
                  m.avgUtilizationPct < 40
                    ? 'text-bad'
                    : m.avgUtilizationPct < 70
                    ? 'text-warn'
                    : 'text-ok';
                const efficiencyLabel =
                  m.avgUtilizationPct < 40
                    ? '낭비'
                    : m.avgUtilizationPct < 70
                    ? '검토'
                    : '적정';
                return (
                  <tr key={m.model} className="border-b border-line-soft last:border-0">
                    <td className="py-2 font-mono text-[11.5px] text-ink-dark">
                      <span
                        className={cn('inline-block w-2.5 h-2.5 rounded-sm mr-1.5', PTU_COLORS[i % 3].dot)}
                      />
                      {m.model}
                    </td>
                    <td className="py-2 text-right tabular-nums font-extrabold text-ink">{m.ptus}</td>
                    <td className="py-2 text-right tabular-nums text-ink-mid">
                      ₩{fmtKRW(m.unitPrice)}
                    </td>
                    <td className="py-2 text-right tabular-nums font-extrabold text-ink">
                      ₩{fmtKRW(m.monthCost)}
                    </td>
                    <td className={cn('py-2 text-right tabular-nums font-extrabold', tone)}>
                      {m.avgUtilizationPct.toFixed(0)}%
                      <div className="text-[10px] font-semibold">{efficiencyLabel}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">모델별 PTU 점유 — 프로젝트</h3>
            <span className="text-[10.5px] text-ink-mid">어느 프로젝트가 어느 모델 PTU를 쓰는지</span>
          </div>
          <PtuByModelList rows={rows} ptuUsage={ptuUsage} />
        </div>
      </div>

    </section>
  );
}

/** 모델별로 그룹핑된 PTU 점유 — 프로젝트가 어느 모델 PTU를 쓰는지 보임. */
function PtuByModelList({
  rows,
  ptuUsage,
}: {
  rows: ProjectUsageRow[];
  ptuUsage: ModelPtuUsage[];
}) {
  const palette = ['#CB2C10', '#1F5BB8', '#1B8A4D', '#6E3BBD', '#C9760F', '#6B4F2A'];
  const groups = ptuUsage.map((m, mi) => {
    const projects = rows
      .filter((r) => r.primaryModel === m.model && r.monthTokenInput + r.monthTokenOutput > 0)
      .map((r, i) => ({
        id: r.id,
        name: r.name,
        tokens: r.monthTokenInput + r.monthTokenOutput,
        color: palette[i % palette.length],
      }))
      .sort((a, b) => b.tokens - a.tokens);
    const totalTokens = projects.reduce((a, p) => a + p.tokens, 0);
    return {
      model: m.model,
      modelIdx: mi,
      allocatedPtus: m.allocatedPtus,
      avgUtil: m.avgUtilizationPct,
      projects: projects.map((p) => ({
        ...p,
        pct: totalTokens === 0 ? 0 : (p.tokens / totalTokens) * 100,
      })),
    };
  });
  return (
    <ul className="space-y-3.5">
      {groups.map((g) => (
        <li key={g.model}>
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className={cn('inline-block w-2 h-2 rounded-sm', PTU_COLORS[g.modelIdx % 3].dot)} />
              <span className="font-mono text-[11.5px] text-ink-dark font-extrabold">{g.model}</span>
            </div>
            <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">
              {g.allocatedPtus} PTU · 평균 효율 {g.avgUtil.toFixed(0)}%
            </span>
          </div>
          {/* 그룹 내 stack bar */}
          {g.projects.length > 0 ? (
            <>
              <div className="flex h-1.5 rounded-full overflow-hidden border border-line-soft mb-1.5">
                {g.projects.map((p) => (
                  <div
                    key={p.id}
                    style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                    title={`${p.name} · ${p.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <ul className="space-y-1">
                {g.projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="flex-1 truncate text-ink-dark font-semibold">{p.name}</span>
                    <span className="tabular-nums font-extrabold text-ink">{fmtCompact(p.tokens)} tok</span>
                    <span className="w-[42px] text-right text-ink-mid font-bold tabular-nums">
                      {p.pct.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-[10.5px] text-ink-light italic">점유 프로젝트 없음</div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ModelPtuChart({ series, days }: { series: ModelPtuUsage[]; days: string[] }) {
  const W = 660;
  const H = 200;
  const padL = 32;
  const padR = 10;
  const padT = 14;
  const padB = 22;
  const N = series[0]?.dailyUtilizationPct.length ?? 30;
  const xs = (i: number) => padL + (i / (N - 1)) * (W - padL - padR);
  const ys = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const yTicks = [0, 25, 50, 75, 100];
  const xLabelIdx = [0, 7, 14, 21, 29];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={ys(t)}
              y2={ys(t)}
              stroke={t === 100 ? '#F4C8D0' : '#EDEDED'}
              strokeWidth={1}
              strokeDasharray={t === 100 ? '4 3' : '2 3'}
            />
            <text x={padL - 6} y={ys(t) + 3} textAnchor="end" fontSize="9" fill="#999999">
              {t}%
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={ys(75)} y2={ys(75)} stroke="#F4D89F" strokeWidth={1} strokeDasharray="4 3" />
        {series.map((m, mi) => (
          <g key={m.model}>
            <path d={pathOf(m.dailyUtilizationPct)} fill="none" stroke={PTU_COLORS[mi % 3].stroke} strokeWidth={1.7} />
            <circle
              cx={xs(m.dailyUtilizationPct.length - 1)}
              cy={ys(m.dailyUtilizationPct[m.dailyUtilizationPct.length - 1])}
              r={2.6}
              fill={PTU_COLORS[mi % 3].stroke}
            />
          </g>
        ))}
        {xLabelIdx.map((i) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#999999">
            {days[i]}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-3 mt-1 text-[10px] text-ink-light font-semibold">
        <span>
          <span className="inline-block w-3 border-t border-dashed border-bad-border mr-1 align-middle" />
          100% 할당 한도
        </span>
        <span>
          <span className="inline-block w-3 border-t border-dashed border-warn-border mr-1 align-middle" />
          75% 권고
        </span>
      </div>
    </div>
  );
}

function ModelPtuCard({ models }: { models: ModelPtuUsage[] }) {
  const totalPtus = models.reduce((a, m) => a + m.allocatedPtus, 0);
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <div>
          <h3 className="text-[14px] font-extrabold text-ink">PTU 할당 현황</h3>
          <div className="text-[10.5px] text-ink-mid mt-0.5">모델별 예약 용량 · 평균 / 피크 사용률</div>
        </div>
        <span className="text-[11px] text-ink-mid">
          총 <b className="text-ink-dark tabular-nums">{totalPtus}</b> PTU
        </span>
      </div>
      <ul className="space-y-2.5">
        {models.map((m, i) => {
          const tone = m.currentUtilizationPct >= 90 ? 'text-bad' : m.currentUtilizationPct >= 75 ? 'text-warn' : 'text-ok';
          return (
            <li key={m.model}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', PTU_COLORS[i % 3].dot)} />
                <span className="font-mono text-[11px] text-ink-dark flex-1 truncate">{m.model}</span>
                <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">{m.allocatedPtus} PTU</span>
              </div>
              <div className="flex items-baseline gap-2 pl-[18px]">
                <span className={cn('text-[16px] font-extrabold tabular-nums', tone)}>
                  {m.currentUtilizationPct.toFixed(0)}%
                </span>
                <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">
                  현재 · 평균 {m.avgUtilizationPct.toFixed(0)}% · 피크 {m.peakUtilizationPct.toFixed(0)}%
                </span>
              </div>
              <div className="pl-[18px] mt-1">
                <div className="h-1 rounded-full bg-line-soft overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      m.currentUtilizationPct >= 90 ? 'bg-bad' : m.currentUtilizationPct >= 75 ? 'bg-warn' : 'bg-ok',
                    )}
                    style={{ width: `${m.currentUtilizationPct}%` }}
                  />
                  <span className="absolute top-0 bottom-0 w-px bg-warn-border" style={{ left: '75%' }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


/* =====================================================================
 * 자원 탭 — K8s 네임스페이스 단위 인프라 모니터링
 * ===================================================================== */

function InfraTab() {
  const namespaces = NAMESPACES;
  return (
    <section className="space-y-3.5">
      {/* Deployment 테이블 — 네임스페이스 그룹핑 */}
      <div className="grid grid-cols-2 gap-3.5">
        <DeploymentTable
          title="시스템 자원 상태 — Deployments"
          subtitle="게이트웨이 · 관제 · 플랫폼 · 시스템 네임스페이스"
          deployments={DEPLOYMENTS.filter((d) =>
            namespaces.some(
              (n) => n.name === d.namespace && n.category !== 'project',
            ),
          )}
          namespaces={namespaces}
          panel="system-deployments"
        />
        <DeploymentTable
          title="프로젝트별 자원 상태 — Deployments"
          subtitle="서빙계 · 학습계 워크로드 (네임스페이스별 그룹)"
          deployments={DEPLOYMENTS.filter((d) =>
            namespaces.some(
              (n) => n.name === d.namespace && n.category === 'project',
            ),
          )}
          namespaces={namespaces}
          panel="project-deployments"
        />
      </div>

      {/* 네임스페이스 테이블 */}
      <div className="card">
        <div className="px-5 py-3.5 flex items-baseline justify-between border-b border-line-soft">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">네임스페이스</h2>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              플랫폼 전사 K8s 네임스페이스 단위 자원 사용 현황
            </div>
          </div>
          <GrafanaLink panel="k8s-namespaces" />
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
              <th className="text-left font-bold py-2.5 px-4">네임스페이스</th>
              <th className="text-left font-bold py-2.5 px-2 w-[210px]">Pods</th>
              <th className="text-right font-bold py-2.5 px-2 w-[150px]">CPU</th>
              <th className="text-right font-bold py-2.5 px-2 w-[150px]">Memory</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">Net (Rx/Tx)</th>
              <th className="text-right font-bold py-2.5 px-2 w-[60px]">SVC</th>
              <th className="text-right font-bold py-2.5 px-4 w-[120px]">마지막 배포</th>
            </tr>
          </thead>
          <tbody>
            {namespaces.map((n) => (
              <NamespaceRow key={n.name} ns={n} />
            ))}
          </tbody>
        </table>
      </div>

    </section>
  );
}

const DEPLOYMENT_STATUS_TONE: Record<DeploymentStatus, string> = {
  Healthy: 'bg-ok-bg text-ok border-ok-border',
  Updating: 'bg-warn-bg text-warn border-warn-border',
  Degraded: 'bg-warn-bg text-warn border-warn-border',
  Failed: 'bg-bad-bg text-bad border-bad-border',
};

/** K8s Deployment 테이블 — 네임스페이스 그룹핑(rowspan). */
function DeploymentTable({
  title,
  subtitle,
  deployments,
  namespaces,
  panel,
}: {
  title: string;
  subtitle: string;
  deployments: Deployment[];
  namespaces: NamespaceUsage[];
  panel: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Deployment[]>();
    for (const d of deployments) {
      const arr = map.get(d.namespace) ?? [];
      arr.push(d);
      map.set(d.namespace, arr);
    }
    const out: { ns: NamespaceUsage; items: Deployment[] }[] = [];
    for (const n of namespaces) {
      const items = map.get(n.name);
      if (items && items.length > 0) out.push({ ns: n, items });
    }
    return out;
  }, [deployments, namespaces]);

  const summary = useMemo(() => {
    const healthy = deployments.filter((d) => d.status === 'Healthy').length;
    const updating = deployments.filter((d) => d.status === 'Updating').length;
    const bad = deployments.filter(
      (d) => d.status === 'Failed' || d.status === 'Degraded',
    ).length;
    const totalReady = deployments.reduce((a, d) => a + d.replicasReady, 0);
    const totalDesired = deployments.reduce((a, d) => a + d.replicasDesired, 0);
    return { healthy, updating, bad, totalReady, totalDesired, total: deployments.length };
  }, [deployments]);

  return (
    <div className="card flex flex-col min-w-0">
      <div className="px-5 py-3 flex items-baseline justify-between border-b border-line-soft gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-extrabold text-ink truncate">{title}</h2>
          <div className="text-[10.5px] text-ink-mid mt-0.5 truncate">{subtitle}</div>
        </div>
        <GrafanaLink panel={panel} />
      </div>
      {/* Summary strip */}
      <div className="px-5 py-2 flex items-center gap-3 border-b border-line-soft bg-surface-soft/40 text-[10.5px] tabular-nums">
        <span className="text-ink-mid font-bold">
          Deployments <b className="text-ink-dark">{summary.total}</b>
        </span>
        <span className="text-ink-light">·</span>
        <span className="text-ink-mid font-bold">
          Replicas{' '}
          <b className="text-ink-dark">
            {summary.totalReady}/{summary.totalDesired}
          </b>
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-ok font-extrabold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ok" />
            {summary.healthy}
            <span className="text-ink-mid font-bold ml-0.5">Healthy</span>
          </span>
          {summary.updating > 0 && (
            <span className="inline-flex items-center gap-1 text-warn font-extrabold">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-warn" />
              {summary.updating}
              <span className="text-ink-mid font-bold ml-0.5">Updating</span>
            </span>
          )}
          {summary.bad > 0 && (
            <span className="inline-flex items-center gap-1 text-bad font-extrabold">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-bad" />
              {summary.bad}
              <span className="text-ink-mid font-bold ml-0.5">Failed</span>
            </span>
          )}
        </span>
      </div>
      <table className="w-full text-[11.5px] table-fixed">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
            <th className="text-left font-bold py-2 px-3 w-[22%]">Namespace</th>
            <th className="text-left font-bold py-2 px-2 w-[26%]">Deployment</th>
            <th className="text-center font-bold py-2 px-1 w-[60px]">Ready</th>
            <th className="text-left font-bold py-2 px-2">Image</th>
            <th className="text-right font-bold py-2 px-1 w-[44px]">Age</th>
            <th className="text-right font-bold py-2 px-3 w-[88px]">Status</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) =>
            g.items.map((d, di) => (
              <tr
                key={d.namespace + '/' + d.name}
                className={cn(
                  'hover:bg-surface-soft/40',
                  di === g.items.length - 1 && gi < groups.length - 1
                    ? 'border-b border-line'
                    : 'border-b border-line-soft last:border-0',
                )}
              >
                {di === 0 && (
                  <td
                    rowSpan={g.items.length}
                    className="py-2 px-3 align-top border-r border-line-soft bg-surface-soft/20"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLOR[g.ns.category] }}
                      />
                      <span className="font-mono text-[11px] text-ink-dark font-extrabold truncate">
                        {g.ns.name}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-ink-mid font-semibold mt-0.5 tabular-nums">
                      {g.items.length} dep
                    </div>
                  </td>
                )}
                <td className="py-2 px-2">
                  <div
                    className="font-mono text-[11.5px] text-ink-dark font-extrabold truncate"
                    title={d.name}
                  >
                    {d.name}
                  </div>
                </td>
                <td className="py-2 px-1 text-center">
                  <ReplicaCell ready={d.replicasReady} desired={d.replicasDesired} />
                </td>
                <td className="py-2 px-2">
                  <div
                    className="font-mono text-[10.5px] truncate"
                    title={`${d.image}:${d.imageTag}`}
                  >
                    <span className="text-ink-mid">{d.image.split('/').pop()}</span>
                    <span className="text-ink-light">:</span>
                    <span className="text-ink-dark font-extrabold">{d.imageTag}</span>
                  </div>
                </td>
                <td className="py-2 px-1 text-right tabular-nums text-[10.5px] text-ink-mid font-semibold">
                  {d.age}
                </td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={cn(
                      'pill border text-[9.5px]',
                      DEPLOYMENT_STATUS_TONE[d.status],
                    )}
                  >
                    <span className="mr-1">●</span>
                    {d.status}
                  </span>
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReplicaCell({ ready, desired }: { ready: number; desired: number }) {
  const tone =
    ready === 0
      ? 'text-bad'
      : ready < desired
      ? 'text-warn'
      : 'text-ok';
  const barTone =
    ready === 0 ? 'bg-bad' : ready < desired ? 'bg-warn' : 'bg-ok';
  const pct = desired === 0 ? 0 : Math.min(100, (ready / desired) * 100);
  return (
    <div className="inline-flex flex-col items-center gap-0.5 min-w-[44px]">
      <div className="inline-flex items-baseline gap-0.5 tabular-nums leading-none">
        <span className={cn('font-extrabold text-[12px]', tone)}>{ready}</span>
        <span className="text-ink-light text-[10px]">/</span>
        <span className="text-ink-dark font-bold text-[11px]">{desired}</span>
      </div>
      <div className="h-1 w-10 rounded-full bg-line-soft overflow-hidden">
        <div className={cn('h-full rounded-full', barTone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PodsBreakdown({
  pods,
}: {
  pods: { running: number; pending: number; failed: number };
}) {
  const total = pods.running + pods.pending + pods.failed || 1;
  return (
    <div>
      {/* stacked bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden border border-line-soft mb-1.5">
        <div className="bg-ok" style={{ width: `${(pods.running / total) * 100}%` }} />
        {pods.pending > 0 && (
          <div className="bg-warn" style={{ width: `${(pods.pending / total) * 100}%` }} />
        )}
        {pods.failed > 0 && (
          <div className="bg-bad" style={{ width: `${(pods.failed / total) * 100}%` }} />
        )}
      </div>
      {/* labels */}
      <div className="flex items-center gap-2 text-[10.5px] tabular-nums font-extrabold">
        <span className="inline-flex items-center gap-1 text-ok">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ok" />
          {pods.running}
          <span className="text-ink-mid font-bold ml-0.5">Active</span>
        </span>
        {pods.pending > 0 && (
          <span className="inline-flex items-center gap-1 text-warn">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-warn" />
            {pods.pending}
            <span className="text-ink-mid font-bold ml-0.5">Pending</span>
          </span>
        )}
        {pods.failed > 0 && (
          <span className="inline-flex items-center gap-1 text-bad">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-bad" />
            {pods.failed}
            <span className="text-ink-mid font-bold ml-0.5">Failed</span>
          </span>
        )}
      </div>
    </div>
  );
}

function NamespaceRow({ ns }: { ns: NamespaceUsage }) {
  const cpuPct = (ns.cpuUsedM / ns.cpuLimitM) * 100;
  const memPct = (ns.memUsedMiB / ns.memLimitMiB) * 100;
  const cpuTone = cpuPct >= 85 ? 'text-bad' : cpuPct >= 70 ? 'text-warn' : 'text-ink-dark';
  const memTone = memPct >= 85 ? 'text-bad' : memPct >= 70 ? 'text-warn' : 'text-ink-dark';
  return (
    <tr className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: CATEGORY_COLOR[ns.category] }}
          />
          <span className="font-mono text-[11.5px] text-ink-dark font-extrabold">{ns.name}</span>
        </div>
        <div className="text-[10px] text-ink-mid font-semibold mt-0.5 truncate" title={ns.description}>
          {ns.description}
        </div>
      </td>
      <td className="py-2.5 px-2">
        <PodsBreakdown pods={ns.pods} />
      </td>
      <td className={cn('py-2.5 px-2 text-right tabular-nums', cpuTone)}>
        <div className="font-extrabold">{cpuPct.toFixed(0)}%</div>
        <div className="text-[10px] text-ink-mid font-semibold tabular-nums">
          {(ns.cpuUsedM / 1000).toFixed(1)} / {(ns.cpuLimitM / 1000).toFixed(0)} cores
        </div>
        <div className="h-1 rounded-full bg-line-soft overflow-hidden mt-1">
          <div
            className={cn(
              'h-full rounded-full',
              cpuPct >= 85 ? 'bg-bad' : cpuPct >= 70 ? 'bg-warn' : 'bg-ok',
            )}
            style={{ width: `${Math.min(100, cpuPct)}%` }}
          />
        </div>
      </td>
      <td className={cn('py-2.5 px-2 text-right tabular-nums', memTone)}>
        <div className="font-extrabold">{memPct.toFixed(0)}%</div>
        <div className="text-[10px] text-ink-mid font-semibold tabular-nums">
          {(ns.memUsedMiB / 1024).toFixed(1)} / {(ns.memLimitMiB / 1024).toFixed(0)} GiB
        </div>
        <div className="h-1 rounded-full bg-line-soft overflow-hidden mt-1">
          <div
            className={cn(
              'h-full rounded-full',
              memPct >= 85 ? 'bg-bad' : memPct >= 70 ? 'bg-warn' : 'bg-ok',
            )}
            style={{ width: `${Math.min(100, memPct)}%` }}
          />
        </div>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums text-ink-dark">
        <div>↓ {ns.netRxMBps.toFixed(0)} MB/s</div>
        <div className="text-[10px] text-ink-mid">↑ {ns.netTxMBps.toFixed(0)} MB/s</div>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums font-bold text-ink-dark">{ns.services}</td>
      <td className="py-2.5 px-4 text-right text-[10.5px] text-ink-mid font-semibold tabular-nums">
        {ns.lastDeploy.slice(5)}
      </td>
    </tr>
  );
}


/* =====================================================================
 * 4) 안전·거버넌스 탭
 * ===================================================================== */

function GovernanceTab({ rows }: { rows: ProjectUsageRow[] }) {
  const safetySeries = useMemo(() => getProjectSafetySeries(rows), [rows]);
  const dayLabels = useMemo(() => getDailyLabels(), []);
  const [trendMode, setTrendMode] = useState<'total' | 'pii' | 'guardrail'>('total');

  const topSafety = useMemo(
    () =>
      [...rows]
        .filter((r) => r.status === '운영 중')
        .sort(
          (a, b) => b.guardrailBlocks + b.piiMaskCount - (a.guardrailBlocks + a.piiMaskCount),
        )
        .slice(0, 5),
    [rows],
  );

  return (
    <section className="space-y-3.5">
      {/* 안전 이벤트 추이(프로젝트별 라인) + Top */}
      <div className="grid grid-cols-[1.7fr_1fr] gap-3.5">
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">안전 이벤트 30일 추이 · 프로젝트별</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">
                PII 마스킹 + 가드레일 차단 — 차단 건수 일별
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {(['total', 'pii', 'guardrail'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTrendMode(m)}
                    className={cn(
                      'h-6 px-2 rounded text-[10.5px] font-extrabold border',
                      trendMode === m
                        ? 'bg-brand-tint border-brand-dark text-ink'
                        : 'bg-white border-line text-ink-dark hover:border-brand-dark',
                    )}
                  >
                    {m === 'total' ? '합산' : m === 'pii' ? 'PII' : '가드레일'}
                  </button>
                ))}
              </div>
              <GrafanaLink panel="safety-trend" />
            </div>
          </div>
          <ProjectSafetyChart series={safetySeries} days={dayLabels} mode={trendMode} />
        </div>

        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">안전 이벤트 Top</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-[10.5px] text-ink-mid">차단 (7일)</span>
              <GrafanaLink panel="safety-top" />
            </div>
          </div>
          <ul className="space-y-2">
            {topSafety.map((r) => {
              const total = r.guardrailBlocks + r.piiMaskCount;
              return (
                <li key={r.id}>
                  <Link
                    to={`/projects/${r.id}`}
                    className="grid grid-cols-[1fr_auto] gap-2 items-center py-1.5 px-2 rounded hover:bg-surface-soft"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-extrabold text-ink truncate">{r.name}</div>
                      <div className="text-[10.5px] text-ink-mid font-semibold truncate">
                        가드레일 {r.guardrailBlocks} · PII {fmtCompact(r.piiMaskCount)}
                      </div>
                    </div>
                    <span className="text-[13px] font-extrabold tabular-nums text-warn">
                      {fmtCompact(total)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* 에이전트별 PII 적용 매트릭스 */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3 gap-2">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">에이전트별 PII 적용 현황</h3>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              각 에이전트가 어떤 PII 카테고리를 차단/마스킹하는지 매트릭스로 비교
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="inline-flex items-center gap-1">
              <span className="pill bg-bad-bg text-bad border border-bad-border text-[9px]">차단</span>
              요청 거부
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="pill bg-warn-bg text-warn border border-warn-border text-[9px]">마스킹</span>
              치환 표시
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="pill bg-surface text-ink-mid border border-line-soft text-[9px]">미적용</span>
            </span>
            <GrafanaLink panel="agent-pii" />
          </div>
        </div>
        <AgentPiiMatrix />
      </div>
    </section>
  );
}

/** 프로젝트별 안전 이벤트 30일 추이 라인 차트. */
function ProjectSafetyChart({
  series,
  days,
  mode,
}: {
  series: ProjectSafetySeries[];
  days: string[];
  mode: 'total' | 'pii' | 'guardrail';
}) {
  const N = series[0]?.totalDaily.length ?? 30;
  const W = 760;
  const H = 220;
  const padL = 50;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const pick = (s: ProjectSafetySeries) =>
    mode === 'pii' ? s.piiDaily : mode === 'guardrail' ? s.guardrailDaily : s.totalDaily;
  const max = Math.max(...series.flatMap((s) => pick(s)), 1) * 1.08;
  const xs = (i: number) => padL + (i / (N - 1)) * innerW;
  const ys = (v: number) => padT + (1 - v / max) * innerH;
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const xLabelIdx = [0, 7, 14, 21, 29];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = padT + p * innerH;
          const v = max * (1 - p);
          return (
            <g key={p}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9.5" fill="#999999">
                {fmtCompact(Math.round(v))}
              </text>
            </g>
          );
        })}
        {series.map((s) => {
          const arr = pick(s);
          return (
            <g key={s.projectId}>
              <path d={pathOf(arr)} fill="none" stroke={s.color} strokeWidth={1.6} />
              <circle cx={xs(arr.length - 1)} cy={ys(arr[arr.length - 1])} r={2.6} fill={s.color} />
            </g>
          );
        })}
        {xLabelIdx.map((i) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#999999">
            {days[i]}
          </text>
        ))}
      </svg>
      <ul className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[10.5px]">
        {series.map((s) => {
          const arr = pick(s);
          return (
            <li key={s.projectId} className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-ink-dark font-semibold truncate flex-1">{s.name}</span>
              <span className="tabular-nums font-extrabold text-ink">{fmtCompact(arr[arr.length - 1])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 에이전트별 PII 적용 매트릭스 — 행: 에이전트, 열: PII 카테고리, 셀: action. */
function AgentPiiMatrix() {
  // 카테고리 합산 카운트 (열 footer용)
  const colCounts = PII_CATEGORIES.map((cat) => {
    const blocked = AGENT_PII_POLICIES.filter((p) => p.items[cat.code] === 'block').length;
    const masked = AGENT_PII_POLICIES.filter((p) => p.items[cat.code] === 'mask').length;
    return { code: cat.code, blocked, masked };
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] min-w-[860px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
            <th className="text-left font-bold py-2.5 px-3 w-[230px]">에이전트</th>
            <th className="text-left font-bold py-2.5 px-2 w-[180px]">소속 프로젝트</th>
            {PII_CATEGORIES.map((cat) => (
              <th key={cat.code} className="text-center font-bold py-2.5 px-1">
                {cat.label}
              </th>
            ))}
            <th className="text-right font-bold py-2.5 px-3 w-[80px]">7일 발생</th>
          </tr>
        </thead>
        <tbody>
          {AGENT_PII_POLICIES.map((p) => (
            <tr key={p.agentId} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
              <td className="py-2.5 px-3">
                <div className="font-mono text-[10.5px] text-ink-mid font-bold">{p.agentId}</div>
                <div className="text-[12px] font-extrabold text-ink truncate">{p.agentName}</div>
              </td>
              <td className="py-2.5 px-2">
                <Link to={`/projects/${p.projectId}`} className="text-[11px] text-ink-dark hover:text-info">
                  {p.projectName}
                </Link>
              </td>
              {PII_CATEGORIES.map((cat) => (
                <td key={cat.code} className="py-2.5 px-1 text-center">
                  <PiiActionPill action={p.items[cat.code]} />
                </td>
              ))}
              <td className="py-2.5 px-3 text-right tabular-nums font-extrabold text-ink">
                {p.count7d === 0 ? <span className="text-ink-light font-bold">—</span> : fmtCompact(p.count7d)}
              </td>
            </tr>
          ))}
          {/* footer 합산 */}
          <tr className="bg-surface-soft/60 text-[10.5px]">
            <td className="py-2 px-3 font-bold text-ink-mid uppercase tracking-[0.3px]">합산</td>
            <td className="py-2 px-2 text-ink-mid">—</td>
            {colCounts.map((c) => (
              <td key={c.code} className="py-2 px-1 text-center text-ink-mid">
                <span className="text-bad font-extrabold tabular-nums">{c.blocked}</span>
                <span className="text-ink-light mx-0.5">/</span>
                <span className="text-warn font-extrabold tabular-nums">{c.masked}</span>
              </td>
            ))}
            <td className="py-2 px-3 text-right tabular-nums font-extrabold text-ink-mid">
              {fmtCompact(AGENT_PII_POLICIES.reduce((a, p) => a + p.count7d, 0))}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-[10px] text-ink-light font-semibold mt-2 tabular-nums">
        합산 행 — <b className="text-bad">차단</b> 적용 / <b className="text-warn">마스킹</b> 적용 에이전트 수
      </div>
    </div>
  );
}

function PiiActionPill({ action }: { action: PiiAction }) {
  if (action === 'block') {
    return (
      <span className="pill bg-bad-bg text-bad border border-bad-border text-[9.5px]" title="요청 차단">
        차단
      </span>
    );
  }
  if (action === 'mask') {
    return (
      <span className="pill bg-warn-bg text-warn border border-warn-border text-[9.5px]" title="마스킹">
        마스킹
      </span>
    );
  }
  return (
    <span className="text-ink-light text-[10px]" title="미적용">
      —
    </span>
  );
}


/* =====================================================================
 * 5) GPU·인프라 탭 — 공동존 4개 클러스터(운영 2 + 개발 2)
 * ===================================================================== */

const LOCATION_COLORS: Record<LocationId, { stroke: string; chip: string; dot: string }> = {
  'prod-cluster1': {
    stroke: '#1F5BB8',
    chip: 'bg-info-bg text-info border-info-border',
    dot: 'bg-info',
  },
  'prod-cluster2': {
    stroke: '#6E3BBD',
    chip: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
    dot: 'bg-accent-purple',
  },
  'dev-cluster1': {
    stroke: '#1B8A4D',
    chip: 'bg-ok-bg text-ok border-ok-border',
    dot: 'bg-ok',
  },
  'dev-cluster2': {
    stroke: '#C9760F',
    chip: 'bg-warn-bg text-warn border-warn-border',
    dot: 'bg-warn',
  },
};

function GpuInfraTab() {
  const summaries = useMemo(() => getLocationSummaries(), []);
  const utilSeries = useMemo(() => getLocationUtilSeries(), []);
  const totalGpus = summaries.reduce((a, s) => a + s.totalGpus, 0);
  const totalNodes = summaries.reduce((a, s) => a + s.nodeCount, 0);
  const prodGpus = summaries.filter((s) => s.kind === 'prod').reduce((a, s) => a + s.totalGpus, 0);
  const prodNodes = summaries.filter((s) => s.kind === 'prod').reduce((a, s) => a + s.nodeCount, 0);
  const devGpus = summaries.filter((s) => s.kind === 'dev').reduce((a, s) => a + s.totalGpus, 0);
  const devNodes = summaries.filter((s) => s.kind === 'dev').reduce((a, s) => a + s.nodeCount, 0);
  const activeGpus = summaries.reduce((a, s) => a + s.activeGpus, 0);
  const faultGpus = summaries.reduce((a, s) => a + s.faultGpus, 0);
  const maintGpus = summaries.reduce((a, s) => a + s.maintenanceGpus, 0);
  const idleGpus = summaries.reduce((a, s) => a + s.idleGpus, 0);
  const avgUtil =
    summaries.reduce((a, s) => a + s.avgUtilization * s.activeGpus, 0) / Math.max(1, activeGpus);
  const activeModels = new Set(MODEL_DEPLOYMENTS.map((d) => d.model)).size;

  const [locFilter, setLocFilter] = useState<LocationId | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const filteredNodes = useMemo(
    () => (locFilter === 'all' ? GPU_NODES : GPU_NODES.filter((n) => n.location === locFilter)),
    [locFilter],
  );

  // 24h x-axis labels
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}시`);

  return (
    <section className="space-y-3.5">
      {/* KPI 5장 */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard
          label="총 GPU"
          value={`${totalGpus}`}
          unit="개"
          sub={`${totalNodes}개 노드 · 장애 ${faultGpus} · 점검 ${maintGpus}`}
          tone={faultGpus > 0 ? 'bad' : 'ok'}
        />
        <KpiCard
          label="운영계 GPU"
          value={`${prodGpus}`}
          unit="개"
          sub={`${prodNodes}개 노드 · cluster1 + cluster2`}
          tone="ok"
        />
        <KpiCard
          label="개발계 GPU"
          value={`${devGpus}`}
          unit="개"
          sub={`${devNodes}개 노드 · cluster1 + cluster2`}
          tone="ok"
        />
        <KpiCard
          label="평균 사용률"
          value={avgUtil.toFixed(1)}
          unit="%"
          sub="활성 GPU 평균"
          tone={avgUtil >= 80 ? 'warn' : 'ok'}
        />
        <KpiCard
          label="활성 모델"
          value={`${activeModels}`}
          unit="종"
          sub={`배포 ${MODEL_DEPLOYMENTS.length}건`}
          tone="ok"
        />
      </div>

      {/* 위치 4분할 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {summaries.map((s) => (
          <LocationCard key={s.id} summary={s} onClick={() => setLocFilter(s.id)} />
        ))}
      </div>

      {/* 도넛 3종 — GPU 종류 · 위치 분포 · 상태 분포 */}
      <div className="grid grid-cols-3 gap-3.5">
        <DonutCard
          title="GPU 종류 분포"
          subtitle="모델별 점유 (GPU 카드 수)"
          slices={(() => {
            const map = new Map<string, number>();
            for (const n of GPU_NODES) map.set(n.gpuModel, (map.get(n.gpuModel) ?? 0) + n.gpuCount);
            const palette = ['#1F5BB8', '#CB2C10', '#1B8A4D', '#6E3BBD'];
            return Array.from(map.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
          })()}
          unit="개"
        />
        <DonutCard
          title="위치 분포"
          subtitle="운영계 vs 개발계"
          slices={summaries.map((s) => ({
            label: s.label,
            value: s.totalGpus,
            color: LOCATION_COLORS[s.id].stroke,
          }))}
          unit="개"
        />
        <DonutCard
          title="상태 분포"
          subtitle="활성 · 유휴 · 장애 · 점검"
          slices={[
            { label: '활성', value: activeGpus, color: '#1B8A4D' },
            { label: '유휴', value: idleGpus, color: '#999999' },
            { label: '장애', value: faultGpus, color: '#D8313D' },
            { label: '점검', value: maintGpus, color: '#C9760F' },
          ].filter((s) => s.value > 0)}
          unit="개"
        />
      </div>

      {/* 모델 × 위치 배포 매트릭스 + 위치별 24h 사용률 */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
        <DeploymentMatrix />
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">위치별 GPU 사용률 24h</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">시간당 평균 사용률(%)</div>
            </div>
            <div className="flex items-center gap-2 text-[10.5px]">
              {LOCATIONS.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1">
                  <span className={cn('inline-block w-2 h-2 rounded-sm', LOCATION_COLORS[l.id].dot)} />
                  <span className="text-ink-dark font-mono text-[10px]">{l.label.split(' · ')[1]}</span>
                </span>
              ))}
            </div>
          </div>
          <LocationUtilChart series={utilSeries} hours={hours} />
        </div>
      </div>

      {/* TTFT 비교 */}
      <TtftCompareCard deployments={MODEL_DEPLOYMENTS} />

      {/* 노드 테이블 */}
      <div className="card">
        <div className="px-5 py-3.5 flex items-baseline justify-between border-b border-line-soft flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">노드 현황</h2>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              물리 노드 (GPU 8장/대) · {filteredNodes.length}대 / 전체{' '}
              {GPU_NODES.length}대
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip active={locFilter === 'all'} onClick={() => setLocFilter('all')}>
              전체
            </FilterChip>
            {LOCATIONS.map((l) => (
              <FilterChip
                key={l.id}
                active={locFilter === l.id}
                onClick={() => setLocFilter(l.id)}
              >
                {l.label.replace(' · ', ' ')}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
                <th className="w-[28px]" />
                <th className="text-left font-bold py-2.5 px-2 w-[140px]">노드</th>
                <th className="text-left font-bold py-2.5 px-2 w-[160px]">위치</th>
                <th className="text-left font-bold py-2.5 px-2 w-[210px]">서버 모델</th>
                <th className="text-left font-bold py-2.5 px-2 w-[120px]">GPU</th>
                <th className="text-center font-bold py-2.5 px-2 w-[80px]">활성</th>
                <th className="text-right font-bold py-2.5 px-2 w-[90px]">평균 사용률</th>
                <th className="text-right font-bold py-2.5 px-2 w-[70px]">온도</th>
                <th className="text-center font-bold py-2.5 px-2 w-[90px]">상태</th>
                <th className="text-left font-bold py-2.5 px-4">호스팅 모델</th>
              </tr>
            </thead>
            <tbody>
              {filteredNodes.map((n) => (
                <GpuRow
                  key={n.id}
                  node={n}
                  expanded={expanded.has(n.id)}
                  onToggle={() => toggleExpand(n.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LocationCard({ summary, onClick }: { summary: LocationSummary; onClick: () => void }) {
  const color = LOCATION_COLORS[summary.id];
  const utilTone =
    summary.avgUtilization >= 85
      ? 'text-bad'
      : summary.avgUtilization >= 70
      ? 'text-warn'
      : 'text-ok';
  return (
    <button
      type="button"
      onClick={onClick}
      className="card px-4 py-3.5 text-left hover:border-brand-dark transition-colors"
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={cn('pill border', color.chip)}>
          {summary.kind === 'prod' ? '운영계' : '개발계'}
        </span>
        <span className="text-[10px] text-ink-light font-semibold">{summary.region}</span>
      </div>
      <div className="text-[13.5px] font-extrabold text-ink truncate mb-1">{summary.label}</div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-[22px] font-extrabold text-ink tabular-nums">{summary.totalGpus}</span>
        <span className="text-[10.5px] text-ink-mid font-semibold">GPU</span>
        <span className={cn('ml-auto text-[14px] font-extrabold tabular-nums', utilTone)}>
          {summary.avgUtilization.toFixed(0)}%
        </span>
      </div>
      <div className="text-[10.5px] text-ink-mid font-semibold tabular-nums mb-1.5">
        활성 {summary.activeGpus} · 유휴 {summary.idleGpus} · 장애 {summary.faultGpus} · 점검{' '}
        {summary.maintenanceGpus}
      </div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {summary.gpuBreakdown.map((g) => (
          <span
            key={g.gpuModel}
            className="pill bg-surface-soft text-ink-dark border border-line-soft text-[9.5px]"
          >
            {g.gpuModel} × {g.count}
          </span>
        ))}
      </div>
      <div className="pt-1.5 border-t border-line-soft text-[10px] text-ink-mid">
        모델{' '}
        <b className="text-ink-dark">{summary.modelsHosted.length}</b> ·{' '}
        <span className="font-mono text-[9.5px] text-ink-mid truncate inline-block max-w-full">
          {summary.modelsHosted.join(', ') || '—'}
        </span>
      </div>
    </button>
  );
}

function DeploymentMatrix() {
  const grouped = useMemo(() => {
    const map = new Map<string, ModelDeployment[]>();
    for (const d of MODEL_DEPLOYMENTS) {
      const arr = map.get(d.model) ?? [];
      arr.push(d);
      map.set(d.model, arr);
    }
    return Array.from(map.entries()).map(([model, deployments]) => ({
      model,
      deployments,
      totalReplicas: deployments.reduce((a, d) => a + d.replicas, 0),
      totalGpus: deployments.reduce((a, d) => a + d.gpuCount, 0),
    }));
  }, []);

  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-extrabold text-ink">모델 × 위치 배포</h3>
        <span className="text-[10.5px] text-ink-mid">replica · GPU · TTFT · TPS · RPS</span>
      </div>
      <ul className="space-y-3.5">
        {grouped.map((g) => (
          <li key={g.model}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="font-mono text-[12px] text-ink-dark font-extrabold">{g.model}</span>
              <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">
                · 합산 replica {g.totalReplicas} · GPU {g.totalGpus}
              </span>
            </div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-[9.5px] uppercase tracking-[0.3px] text-ink-light border-b border-line-soft">
                  <th className="text-left font-bold py-1.5">위치</th>
                  <th className="text-right font-bold py-1.5 w-[60px]">replica</th>
                  <th className="text-right font-bold py-1.5 w-[80px]">GPU</th>
                  <th className="text-right font-bold py-1.5 w-[80px]">TTFT</th>
                  <th className="text-right font-bold py-1.5 w-[80px]">TPS</th>
                  <th className="text-right font-bold py-1.5 w-[60px]">RPS</th>
                  <th className="text-center font-bold py-1.5 w-[70px]">상태</th>
                </tr>
              </thead>
              <tbody>
                {g.deployments.map((d) => (
                  <DeploymentMatrixRow key={`${d.model}-${d.location}`} dep={d} />
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeploymentMatrixRow({ dep }: { dep: ModelDeployment }) {
  const color = LOCATION_COLORS[dep.location];
  const locLabel = LOCATIONS.find((l) => l.id === dep.location)?.label ?? dep.location;
  const ttftTone = dep.ttftMs <= 300 ? 'text-ok' : dep.ttftMs <= 600 ? 'text-ink-dark' : 'text-warn';
  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="py-2 pr-2">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', color.dot)} />
          <span className="text-ink-dark font-mono text-[10.5px]">{locLabel}</span>
        </span>
      </td>
      <td className="py-2 text-right tabular-nums font-extrabold text-ink">{dep.replicas}</td>
      <td className="py-2 text-right tabular-nums text-ink-dark">
        {dep.gpuCount} <span className="text-[9.5px] text-ink-light">{dep.gpuModel}</span>
      </td>
      <td className={cn('py-2 text-right tabular-nums font-extrabold', ttftTone)}>{dep.ttftMs}ms</td>
      <td className="py-2 text-right tabular-nums text-ink-dark">{dep.tps.toFixed(1)}</td>
      <td className="py-2 text-right tabular-nums text-ink-dark">{dep.rps.toFixed(1)}</td>
      <td className="py-2 text-center">
        {dep.health === 'healthy' ? (
          <span className="pill bg-ok-bg text-ok border border-ok-border text-[9.5px]">정상</span>
        ) : dep.health === 'degraded' ? (
          <span className="pill bg-warn-bg text-warn border border-warn-border text-[9.5px]">저하</span>
        ) : (
          <span className="pill bg-bad-bg text-bad border border-bad-border text-[9.5px]">중단</span>
        )}
      </td>
    </tr>
  );
}

function LocationUtilChart({
  series,
  hours,
}: {
  series: Record<LocationId, number[]>;
  hours: string[];
}) {
  const W = 480;
  const H = 200;
  const padL = 30;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const N = hours.length;
  const xs = (i: number) => padL + (i / (N - 1)) * (W - padL - padR);
  const ys = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  const pathOf = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const yTicks = [0, 25, 50, 75, 100];
  const xLabelIdx = [0, 6, 12, 18, 23];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={ys(t)} y2={ys(t)} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
          <text x={padL - 4} y={ys(t) + 3} textAnchor="end" fontSize="9" fill="#999999">
            {t}%
          </text>
        </g>
      ))}
      {LOCATIONS.map((l) => (
        <g key={l.id}>
          <path d={pathOf(series[l.id])} fill="none" stroke={LOCATION_COLORS[l.id].stroke} strokeWidth={1.6} />
          <circle
            cx={xs(series[l.id].length - 1)}
            cy={ys(series[l.id][series[l.id].length - 1])}
            r={2.4}
            fill={LOCATION_COLORS[l.id].stroke}
          />
        </g>
      ))}
      {xLabelIdx.map((i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#999999">
          {hours[i]}
        </text>
      ))}
    </svg>
  );
}

function TtftCompareCard({ deployments }: { deployments: ModelDeployment[] }) {
  const maxTtft = Math.max(...deployments.map((d) => d.ttftMs)) * 1.1;
  const sorted = [...deployments].sort((a, b) => a.ttftMs - b.ttftMs);
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-extrabold text-ink">TTFT 비교 · 모델 × 위치</h3>
          <div className="text-[10.5px] text-ink-mid mt-0.5">
            Time To First Token (ms) · 같은 모델이 여러 위치에 있으면 직접 비교
          </div>
        </div>
        <span className="text-[10.5px] text-ink-mid">짧을수록 좋음</span>
      </div>
      <ul className="space-y-2">
        {sorted.map((d) => {
          const color = LOCATION_COLORS[d.location];
          const locLabel = LOCATIONS.find((l) => l.id === d.location)?.label ?? d.location;
          const pct = (d.ttftMs / maxTtft) * 100;
          const tone =
            d.ttftMs <= 300
              ? 'bg-ok'
              : d.ttftMs <= 600
              ? 'bg-brand-dark'
              : 'bg-warn';
          return (
            <li key={`${d.model}-${d.location}`}>
              <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline mb-1">
                <div className="min-w-0">
                  <span className="font-mono text-[11.5px] text-ink-dark font-extrabold truncate">
                    {d.model}
                  </span>
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-ink-mid">
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full', color.dot)} />
                    {locLabel}
                  </span>
                </div>
                <span className="text-[12.5px] font-extrabold text-ink tabular-nums">{d.ttftMs}ms</span>
              </div>
              <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
                <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


function GpuRow({
  node,
  expanded,
  onToggle,
}: {
  node: GpuNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const color = LOCATION_COLORS[node.location];
  const locLabel = LOCATIONS.find((l) => l.id === node.location)?.label ?? node.location;
  const loc = LOCATIONS.find((l) => l.id === node.location);
  const utilTone =
    node.utilizationPct >= 85 ? 'text-bad' : node.utilizationPct >= 70 ? 'text-warn' : 'text-ink-dark';
  const tempTone =
    node.temperatureC >= 80 ? 'text-bad' : node.temperatureC >= 72 ? 'text-warn' : 'text-ink-dark';
  const totalMem = node.gpuCount * node.memoryGbPerGpu;
  const activeRatio = node.activeCount / node.gpuCount;
  const activeTone =
    activeRatio === 1
      ? 'text-ok'
      : activeRatio >= 0.5
      ? 'text-warn'
      : 'text-bad';
  return (
    <>
      <tr
        className={cn(
          'border-b border-line-soft cursor-pointer hover:bg-surface-soft/40',
          expanded && 'bg-brand-tint/30 hover:bg-brand-tint/40',
        )}
        onClick={onToggle}
      >
        <td className="py-2.5 pl-3 text-center">
          <span
            className={cn(
              'inline-block text-[10.5px] text-ink-mid transition-transform',
              expanded && 'rotate-90',
            )}
          >
            ▶
          </span>
        </td>
        <td className="py-2.5 px-2">
          <div className="font-mono text-[11.5px] text-ink-dark font-extrabold">{node.id}</div>
          <div className="text-[10px] text-ink-mid font-semibold mt-0.5">
            물리 노드
          </div>
        </td>
        <td className="py-2.5 px-2">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', color.dot)} />
            <span className="text-[11.5px] text-ink-dark">{locLabel}</span>
          </span>
        </td>
        <td className="py-2.5 px-2">
          <span className="font-mono text-[10.5px] text-ink-dark">{node.instanceType}</span>
        </td>
        <td className="py-2.5 px-2">
          <div className="font-mono text-[11.5px] text-ink-dark font-extrabold">
            {node.gpuModel} × {node.gpuCount}
          </div>
          <div className="text-[10px] text-ink-mid font-semibold tabular-nums mt-0.5">
            {totalMem}GB 총 메모리
          </div>
        </td>
        <td className="py-2.5 px-2 text-center">
          <ActiveRatioBadge node={node} tone={activeTone} />
        </td>
        <td className={cn('py-2.5 px-2 text-right tabular-nums font-extrabold', utilTone)}>
          {node.status === 'maintenance' || node.activeCount === 0 ? (
            <span className="text-ink-light">—</span>
          ) : (
            `${node.utilizationPct.toFixed(0)}%`
          )}
        </td>
        <td className={cn('py-2.5 px-2 text-right tabular-nums', tempTone)}>
          {node.temperatureC === 0 || node.status === 'maintenance' ? (
            <span className="text-ink-light">—</span>
          ) : (
            `${node.temperatureC}°C`
          )}
        </td>
        <td className="py-2.5 px-2 text-center">
          <GpuStatusPill status={node.status} />
        </td>
        <td className="py-2.5 px-4 font-mono text-[10.5px] text-ink-mid truncate">
          {node.hostedModels.join(', ') || <span className="text-ink-light">—</span>}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface-soft/70">
          <td colSpan={10} className="px-5 py-4 border-b border-line-soft">
            <GpuDetailGrid node={node} />
          </td>
        </tr>
      )}
    </>
  );
}

function ActiveRatioBadge({ node, tone }: { node: GpuNode; tone: string }) {
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className={cn('text-[12.5px] font-extrabold tabular-nums', tone)}>
        {node.activeCount}/{node.gpuCount}
      </span>
      <div className="flex gap-[2px]">
        {node.gpus.map((g) => (
          <span
            key={g.index}
            className={cn(
              'w-[7px] h-[7px] rounded-[1px]',
              g.status === 'active' ? 'bg-ok' : g.status === 'idle' ? 'bg-line' : 'bg-bad',
            )}
            title={`GPU${g.index} ${g.status}`}
          />
        ))}
      </div>
    </div>
  );
}

/** GPU 8장 상세 카드 그리드 — nvidia-smi 정보를 디자인 시스템 톤으로. */
function GpuDetailGrid({ node }: { node: GpuNode }) {
  const activeCount = node.gpus.filter((g) => g.status === 'active').length;
  const idleCount = node.gpus.filter((g) => g.status === 'idle').length;
  const faultCount = node.gpus.filter((g) => g.status === 'fault').length;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="text-[13px] font-extrabold text-ink">GPU 상세 · {node.gpuCount}장</h4>
          <div className="text-[10.5px] text-ink-mid mt-0.5">
            <span className="font-mono">NVIDIA-SMI {node.driverVersion}</span>
            <span className="mx-1.5 text-line">·</span>
            <span className="font-mono">CUDA {node.cudaVersion}</span>
            <span className="mx-1.5 text-line">·</span>
            <span className="tabular-nums">{node.smiTimestamp}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="pill bg-ok-bg text-ok border border-ok-border">활성 {activeCount}</span>
          {idleCount > 0 && (
            <span className="pill bg-surface text-ink-mid border border-line-soft">유휴 {idleCount}</span>
          )}
          {faultCount > 0 && (
            <span className="pill bg-bad-bg text-bad border border-bad-border">장애 {faultCount}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {node.gpus.map((g) => (
          <GpuMiniCard key={g.index} g={g} gpuModel={node.gpuModel} />
        ))}
      </div>
    </div>
  );
}

function GpuMiniCard({ g, gpuModel }: { g: GpuCard; gpuModel: GpuNode['gpuModel'] }) {
  const isActive = g.status === 'active';
  const isFault = g.status === 'fault';
  const isIdle = g.status === 'idle';

  const cardCls = isFault
    ? 'bg-bad-bg/40 border-bad-border'
    : isIdle
    ? 'bg-surface border-line-soft'
    : 'bg-white border-line-soft';

  const utilTone =
    g.utilizationPct >= 85 ? 'bg-bad' : g.utilizationPct >= 70 ? 'bg-brand-dark' : 'bg-ok';
  const utilTextTone =
    g.utilizationPct >= 85 ? 'text-bad' : g.utilizationPct >= 70 ? 'text-warn' : 'text-ok';

  const memPct = g.memTotalMiB ? (g.memUsedMiB / g.memTotalMiB) * 100 : 0;
  const memUsedGB = (g.memUsedMiB / 1024).toFixed(1);
  const memTotalGB = (g.memTotalMiB / 1024).toFixed(0);

  return (
    <div className={cn('rounded border p-2.5 flex flex-col gap-2', cardCls)}>
      {/* 헤더: GPU #N + 상태 dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">
            GPU
          </span>
          <span className="font-mono text-[13.5px] font-extrabold text-ink tabular-nums">
            #{g.index}
          </span>
        </div>
        <GpuMiniStatusPill status={g.status} />
      </div>

      {/* 사용률 (큰 숫자 + bar) */}
      <div>
        {isFault ? (
          <div className="text-[14px] font-extrabold text-bad">ERR</div>
        ) : isIdle ? (
          <div className="text-[14px] font-extrabold text-ink-light tabular-nums">0%</div>
        ) : (
          <div className={cn('text-[18px] font-extrabold tabular-nums leading-none', utilTextTone)}>
            {g.utilizationPct}
            <small className="text-[11px] font-bold ml-0.5">%</small>
          </div>
        )}
        <div className="h-1 rounded-full bg-line-soft overflow-hidden mt-1.5">
          <div
            className={cn('h-full rounded-full', isFault ? 'bg-bad' : isIdle ? 'bg-line' : utilTone)}
            style={{ width: `${isFault ? 100 : isIdle ? 0 : g.utilizationPct}%` }}
          />
        </div>
      </div>

      {/* 메모리 */}
      <div>
        <div className="flex items-baseline justify-between text-[10.5px] mb-0.5">
          <span className="text-ink-mid font-bold">MEM</span>
          <span className="tabular-nums text-ink-dark font-semibold">
            {memUsedGB}<span className="text-ink-light"> / {memTotalGB} GB</span>
          </span>
        </div>
        <div className="h-1 rounded-full bg-line-soft overflow-hidden">
          <div
            className={cn('h-full rounded-full', isFault ? 'bg-bad' : 'bg-info')}
            style={{ width: `${isFault ? 100 : memPct}%` }}
          />
        </div>
      </div>

      {/* 온도 · 전력 */}
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="inline-flex items-center gap-1 text-ink-mid">
          <span aria-hidden>🌡</span>
          <span
            className={cn(
              'tabular-nums font-bold',
              g.temperatureC >= 80 ? 'text-bad' : g.temperatureC >= 72 ? 'text-warn' : 'text-ink-dark',
            )}
          >
            {g.temperatureC === 0 ? <span className="text-ink-light">N/A</span> : `${g.temperatureC}°C`}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-ink-mid">
          <span aria-hidden>⚡</span>
          <span className="tabular-nums font-bold text-ink-dark">
            {isFault ? (
              <span className="text-bad">ERR</span>
            ) : (
              <>
                {g.powerW}
                <small className="text-ink-light font-semibold">/{g.powerCapW}W</small>
              </>
            )}
          </span>
        </span>
      </div>

      {/* 프로세스 / 호스팅 모델 / fault 메시지 */}
      <div className="pt-1.5 mt-auto border-t border-line-soft text-[10px]">
        {isFault ? (
          <div className="text-bad font-bold">ECC 오류 {g.eccErrors ?? 0}건 — 자동 격리</div>
        ) : isIdle ? (
          <div className="text-ink-light font-semibold">프로세스 없음</div>
        ) : (
          <>
            <div className="text-ink-mid font-semibold tabular-nums">
              PID <b className="text-ink-dark">{g.pid}</b>
            </div>
            {g.hostedModel && (
              <div className="font-mono text-[10px] text-ink-dark truncate mt-0.5" title={g.hostedModel}>
                {g.hostedModel}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bus-Id (작게) */}
      <div className="text-[9px] text-ink-light font-mono tabular-nums truncate" title={g.busId}>
        {g.busId}
        <span className="ml-1 text-ink-light">· {gpuModel}</span>
      </div>
    </div>
  );
}

function GpuMiniStatusPill({ status }: { status: GpuCard['status'] }) {
  const map = {
    active: { label: '활성', cls: 'bg-ok-bg text-ok border-ok-border' },
    idle: { label: '유휴', cls: 'bg-surface text-ink-mid border-line-soft' },
    fault: { label: '장애', cls: 'bg-bad-bg text-bad border-bad-border' },
  };
  const m = map[status];
  return <span className={cn('pill border text-[9.5px]', m.cls)}>{m.label}</span>;
}

function GpuStatusPill({ status }: { status: GpuStatus }) {
  const map: Record<GpuStatus, { label: string; cls: string }> = {
    active: { label: '활성', cls: 'bg-ok-bg text-ok border-ok-border' },
    idle: { label: '유휴', cls: 'bg-surface text-ink-mid border-line-soft' },
    degraded: { label: '저하', cls: 'bg-warn-bg text-warn border-warn-border' },
    maintenance: { label: '점검', cls: 'bg-warn-bg text-warn border-warn-border' },
    fault: { label: '장애', cls: 'bg-bad-bg text-bad border-bad-border' },
  };
  const m = map[status];
  return <span className={cn('pill border text-[9.5px]', m.cls)}>{m.label}</span>;
}

/* 도넛 차트 — slices 합 기준 비례 원호. */
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}
function DonutCard({
  title,
  subtitle,
  slices,
  unit,
  grafanaHref,
}: {
  title: string;
  subtitle: string;
  slices: DonutSlice[];
  unit: string;
  grafanaHref?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-[14px] font-extrabold text-ink">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] text-ink-mid">{subtitle}</span>
          {grafanaHref && (
            <a
              href={grafanaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10.5px] font-extrabold text-info hover:underline whitespace-nowrap"
              title="Grafana 패널 새 창으로 열기"
            >
              Grafana ↗
            </a>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
        <Donut slices={slices} total={total} unit={unit} />
        <ul className="space-y-1.5 min-w-0">
          {slices.map((s) => {
            const pct = (s.value / total) * 100;
            return (
              <li key={s.label} className="flex items-center gap-2 text-[11.5px]">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate text-ink-dark font-semibold">{s.label}</span>
                <span className="tabular-nums font-extrabold text-ink">
                  {s.value}
                  <small className="text-[9.5px] text-ink-mid font-bold ml-0.5">{unit}</small>
                </span>
                <span className="w-[42px] text-right text-ink-mid font-bold tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Donut({ slices, total, unit }: { slices: DonutSlice[]; total: number; unit: string }) {
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;
  const stroke = 18;
  // 누적 각도로 원호 생성. SVG 좌표계는 12시가 -π/2.
  let acc = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const angle = (s.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + angle;
    acc = end;
    const sx = cx + r * Math.cos(start);
    const sy = cy + r * Math.sin(start);
    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    // path: M start L ... ; 라인 두께는 stroke로
    const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    return { d, color: s.color };
  });
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDEDED" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[22px] font-extrabold text-ink tabular-nums leading-none">
          {total}
        </span>
        <span className="text-[10px] text-ink-mid font-bold mt-0.5">{unit}</span>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 rounded text-[11px] font-extrabold border tabular-nums',
        active
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
      )}
    >
      {children}
    </button>
  );
}

/* =====================================================================
 * 공통 — Big line chart + util
 * ===================================================================== */

function BigLineChart({
  series,
  days,
  unit,
  height = 180,
}: {
  series: number[];
  days: string[];
  unit: 'calls' | 'pct';
  height?: number;
}) {
  const W = 660;
  const H = height;
  const padL = 38;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const max = unit === 'pct' ? 100 : Math.max(...series, 1) * 1.1;
  const min = 0;
  const xs = (i: number) => padL + (i / (series.length - 1)) * (W - padL - padR);
  const ys = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const d = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const area =
    d +
    ` L ${xs(series.length - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${xs(0).toFixed(1)} ${(
      H - padB
    ).toFixed(1)} Z`;
  const yTicks = [0, 0.33, 0.66, 1].map((t) => ({
    y: padT + t * (H - padT - padB),
    v: min + (max - min) * (1 - t),
  }));
  const xLabelIdx = [0, 7, 14, 21, 29];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
          <text x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="#999999">
            {unit === 'pct' ? `${Math.round(t.v)}%` : fmtCompact(Math.round(t.v))}
          </text>
        </g>
      ))}
      <path d={area} fill="#FBE9E6" opacity={0.7} />
      <path d={d} fill="none" stroke="#CB2C10" strokeWidth={1.7} />
      <circle cx={xs(series.length - 1)} cy={ys(series[series.length - 1])} r={2.6} fill="#1A1A1A" />
      {xLabelIdx.map((i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#999999">
          {days[i]}
        </text>
      ))}
    </svg>
  );
}

/* =====================================================================
 * 7) 비용 탭 — 어디에 얼마, 효율은 어떤지, 무엇이 바뀌었는지
 * ===================================================================== */

function CostTab({ rows }: { rows: ProjectUsageRow[] }) {
  const kpis = useMemo(() => getAdminKpis(rows), [rows]);
  const ptuCost = useMemo(() => getTotalPtuCost(), []);
  const ptuByModel = useMemo(() => getModelPtuCost(), []);
  const categories = useMemo(() => getCostBreakdownByCategory(), []);
  const totalInfraCost = useMemo(
    () => categories.reduce((a, c) => a + c.monthCost, 0),
    [categories],
  );
  const costSeries = useMemo(() => getDailyCostSeries(rows), [rows]);
  const dayLabels = useMemo(() => getDailyLabels(), []);
  const conglomerateCost = useMemo(() => getCostByConglomerate(), []);
  const agentCost = useMemo(() => getCostByAgent(), []);
  const avgUtil = useMemo(
    () => ptuByModel.reduce((a, m) => a + m.avgUtilizationPct, 0) / Math.max(1, ptuByModel.length),
    [ptuByModel],
  );
  const wastedModels = useMemo(
    () => ptuByModel.filter((m) => m.avgUtilizationPct < 40),
    [ptuByModel],
  );

  // 호출당/토큰당 비용 효율 — 운영 중 프로젝트 기준
  const efficiency = useMemo(() => {
    return rows
      .filter((r) => r.status === '운영 중' && r.monthCalls > 0 && r.monthCost > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        monthCost: r.monthCost,
        monthCalls: r.monthCalls,
        costPerCall: r.monthCost / r.monthCalls,
        costPerMTokens:
          (r.monthCost / Math.max(1, r.monthTokenInput + r.monthTokenOutput)) * 1_000_000,
      }));
  }, [rows]);
  const bestEfficiency = useMemo(
    () => [...efficiency].sort((a, b) => a.costPerCall - b.costPerCall).slice(0, 5),
    [efficiency],
  );
  const worstEfficiency = useMemo(
    () => [...efficiency].sort((a, b) => b.costPerCall - a.costPerCall).slice(0, 5),
    [efficiency],
  );

  // 예산 vs 실사용 — 운영 중 + 개발 중
  const budgetRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.budgetCost > 0)
        .sort((a, b) => b.monthCost / Math.max(1, b.budgetCost) - a.monthCost / Math.max(1, a.budgetCost)),
    [rows],
  );

  return (
    <section className="space-y-3.5">
      {/* KPI band */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard
          label="이번 달 비용"
          value={`₩${fmtKRW(kpis.totalCost)}`}
          sub="모델 PTU + 인프라 합산"
          tone={kpis.budgetUsedPct >= 90 ? 'bad' : 'ok'}
        />
        <KpiCard
          label="예산 사용률"
          value={`${kpis.budgetUsedPct.toFixed(0)}`}
          unit="%"
          sub={`예산 ₩${fmtKRW(kpis.totalBudget)}`}
          tone={kpis.budgetUsedPct >= 90 ? 'bad' : kpis.budgetUsedPct >= 75 ? 'warn' : 'ok'}
        />
        <KpiCard
          label="일평균 비용"
          value={`₩${fmtKRW(Math.round(kpis.totalCost / 30))}`}
          sub={`30일 누적 기준`}
          tone="ok"
        />
        <KpiCard
          label="백만 호출당"
          value={`₩${fmtKRW(Math.round((kpis.totalCost / Math.max(1, kpis.totalCalls)) * 1_000_000))}`}
          sub="비용 효율 지표"
          tone="ok"
        />
        <KpiCard
          label="평균 PTU 효율"
          value={`${avgUtil.toFixed(0)}`}
          unit="%"
          sub={`낭비 ${wastedModels.length}건 · 검토 ${ptuByModel.filter((m) => m.avgUtilizationPct >= 40 && m.avgUtilizationPct < 70).length}건`}
          tone={avgUtil < 60 ? 'warn' : 'ok'}
        />
        <KpiCard
          label="PTU 비중"
          value={`${((ptuCost / Math.max(1, totalInfraCost)) * 100).toFixed(0)}`}
          unit="%"
          sub={`인프라 합계 대비`}
          tone="ok"
        />
      </div>

      {/* 30일 비용 추이 */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-extrabold text-ink">30일 일별 비용 추이</h3>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              PTU 고정비 + 사용량 비례 변동비 분리 표시
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-dark" />
              <span className="text-ink-dark font-bold">PTU 고정비</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-info" />
              <span className="text-ink-dark font-bold">변동비</span>
            </span>
            <GrafanaLink panel="daily-cost" />
          </div>
        </div>
        <DailyCostChart series={costSeries} days={dayLabels} />
      </div>

      {/* 계열사별 비용 */}
      <ConglomerateCostCard rows={conglomerateCost} />

      {/* 에이전트별 비용 */}
      <AgentCostCard rows={agentCost} />

      {/* 프로젝트별 예산 vs 실사용 */}
      <div className="card">
        <div className="px-5 py-3 border-b border-line-soft flex items-baseline justify-between">
          <div>
            <h2 className="text-[14px] font-extrabold text-ink">프로젝트별 예산 vs 실사용</h2>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              실사용 비율 내림차순 · 90% 초과는 적색
            </div>
          </div>
          <GrafanaLink panel="project-cost-vs-budget" />
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
              <th className="text-left font-bold py-2.5 px-4">프로젝트 · PM</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">월 비용</th>
              <th className="text-right font-bold py-2.5 px-2 w-[120px]">월 예산</th>
              <th className="text-left font-bold py-2.5 px-4 w-[260px]">사용률</th>
              <th className="text-right font-bold py-2.5 px-4 w-[100px]">잔여</th>
            </tr>
          </thead>
          <tbody>
            {budgetRows.map((r) => {
              const pct = (r.monthCost / Math.max(1, r.budgetCost)) * 100;
              const remain = r.budgetCost - r.monthCost;
              const tone = pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : 'ok';
              const barColor =
                tone === 'bad' ? '#D8313D' : tone === 'warn' ? '#C9760F' : '#1B8A4D';
              return (
                <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
                  <td className="py-2.5 px-4">
                    <Link to={`/projects/${r.id}`} className="block hover:text-info">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            r.status === '운영 중' ? 'bg-ok' : r.status === '개발 중' ? 'bg-warn' : 'bg-line',
                          )}
                        />
                        <span className="text-[12.5px] font-extrabold text-ink">{r.name}</span>
                      </div>
                      <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                        PM <b className="text-ink-dark">{r.pmName}</b> · {r.dept}
                      </div>
                    </Link>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-extrabold text-ink">
                    ₩{fmtKRW(r.monthCost)}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-ink-mid font-semibold">
                    ₩{fmtKRW(r.budgetCost)}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-line-soft overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          'tabular-nums font-extrabold w-[44px] text-right',
                          tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ok',
                        )}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      'py-2.5 px-4 text-right tabular-nums font-extrabold',
                      remain < 0 ? 'text-bad' : 'text-ink-dark',
                    )}
                  >
                    {remain < 0 ? '−' : ''}₩{fmtKRW(Math.abs(remain))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 효율 Top/Bottom + PTU 변경 이력 */}
      <div className="grid grid-cols-[1fr_1fr_1.1fr] gap-3.5">
        <EfficiencyCard
          title="호출당 비용 — 효율 Top"
          subtitle="비용을 가장 적게 쓰는 5개"
          tone="ok"
          rows={bestEfficiency}
        />
        <EfficiencyCard
          title="호출당 비용 — 비효율 Top"
          subtitle="개선·축소 검토 대상"
          tone="bad"
          rows={worstEfficiency}
        />
        <div className="card px-5 py-4">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-extrabold text-ink">PTU 변경 이력</h3>
              <div className="text-[10.5px] text-ink-mid mt-0.5">증설·감설 · 비용 영향</div>
            </div>
            <Link to="/approvals" className="text-[10.5px] font-extrabold text-info hover:underline">
              결재함 →
            </Link>
          </div>
          <ul className="space-y-2">
            {PTU_CHANGE_EVENTS.map((e) => (
              <PtuChangeRow key={e.id} ev={e} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** 일별 비용 추이 — 고정비/변동비 stacked area. */
function DailyCostChart({
  series,
  days,
}: {
  series: { days: string[]; fixed: number[]; variable: number[]; total: number[] };
  days: string[];
}) {
  const N = series.fixed.length;
  const W = 1200;
  const H = 220;
  const padL = 60;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...series.total, 1) * 1.12;
  const xs = (i: number) => padL + (i / (N - 1)) * innerW;
  const ys = (v: number) => padT + (1 - v / max) * innerH;

  // Stack: fixed 아래, variable 위.
  // Fixed area: 0 → fixed[i]
  // Variable area: fixed[i] → fixed[i]+variable[i] = total[i]
  const fixedTop = series.fixed.map((v) => v);
  const varTop = series.total.map((v) => v);

  const baseline = padT + innerH;
  const fixedAreaPath =
    `M ${xs(0).toFixed(1)} ${baseline.toFixed(1)} ` +
    fixedTop.map((v, i) => `L ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ') +
    ` L ${xs(N - 1).toFixed(1)} ${baseline.toFixed(1)} Z`;
  const varAreaPath =
    fixedTop.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ') +
    ' ' +
    varTop
      .slice()
      .reverse()
      .map((v, idx) => {
        const i = N - 1 - idx;
        return `L ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`;
      })
      .join(' ') +
    ' Z';
  const totalLine = varTop.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');

  const xLabelIdx = [0, 7, 14, 21, 29];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block" style={{ height: H }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const y = padT + p * innerH;
        const v = max * (1 - p);
        return (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#EDEDED" strokeWidth={1} strokeDasharray="2 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#999999">
              ₩{fmtKRW(Math.round(v))}
            </text>
          </g>
        );
      })}
      <path d={fixedAreaPath} fill="#FBE9E6" />
      <path d={varAreaPath} fill="#C5D6F6" opacity={0.7} />
      <path d={totalLine} fill="none" stroke="#1F5BB8" strokeWidth={1.7} />
      <circle cx={xs(N - 1)} cy={ys(varTop[N - 1])} r={3} fill="#1F5BB8" />
      {xLabelIdx.map((i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#999999">
          {days[i]}
        </text>
      ))}
    </svg>
  );
}

/** 계열사별 월 비용 — 가로 막대 + 합계 라인. */
function ConglomerateCostCard({ rows }: { rows: ConglomerateCostRow[] }) {
  const total = rows.reduce((a, r) => a + r.monthCost, 0);
  const max = Math.max(...rows.map((r) => r.monthCost), 1);
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <div>
          <h3 className="text-[14px] font-extrabold text-ink">계열사별 월 비용</h3>
          <div className="text-[10.5px] text-ink-mid mt-0.5">
            전사 합계 ₩{fmtKRW(total)} · 토큰 점유율 기반 분배
          </div>
        </div>
        <GrafanaLink panel="cost-by-conglomerate" />
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const w = (r.monthCost / max) * 100;
          return (
            <li key={r.name} className="grid grid-cols-[140px_1fr_120px_80px] items-center gap-3 text-[11.5px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span className="font-extrabold text-ink truncate">{r.name}</span>
                <span className="text-[10px] text-ink-mid font-semibold tabular-nums flex-shrink-0">
                  · 에이전트 {r.agentCount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${w}%`, backgroundColor: r.color }}
                />
              </div>
              <span className="text-right tabular-nums font-extrabold text-ink">
                ₩{fmtKRW(r.monthCost)}
              </span>
              <span className="text-right tabular-nums text-ink-mid font-bold">
                {r.pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 에이전트별 월 비용 — 정렬 가능한 테이블. */
function AgentCostCard({ rows }: { rows: AgentCostRow[] }) {
  const [sort, setSort] = useState<'cost' | 'calls' | 'unit'>('cost');
  const [tenant, setTenant] = useState<string>('all');
  const tenants = useMemo(() => {
    const set = new Set(rows.map((r) => r.tenant));
    return ['all', ...Array.from(set)];
  }, [rows]);
  const filtered = useMemo(() => {
    const arr = tenant === 'all' ? [...rows] : rows.filter((r) => r.tenant === tenant);
    arr.sort((a, b) => {
      if (sort === 'calls') return b.monthCalls - a.monthCalls;
      if (sort === 'unit') return b.costPerCall - a.costPerCall;
      return b.monthCost - a.monthCost;
    });
    return arr;
  }, [rows, sort, tenant]);
  const total = filtered.reduce((a, r) => a + r.monthCost, 0);

  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-line-soft flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[14px] font-extrabold text-ink">에이전트별 월 비용</h2>
          <div className="text-[10.5px] text-ink-mid mt-0.5">
            {tenant === 'all' ? '전 계열사' : tenant} 합계{' '}
            <b className="text-ink-dark">₩{fmtKRW(total)}</b> · {filtered.length}개 에이전트
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            className="h-7 px-2 border border-line rounded text-[11.5px] outline-none bg-white"
          >
            {tenants.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? '계열사 · 전체' : t}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'cost' | 'calls' | 'unit')}
            className="h-7 px-2 border border-line rounded text-[11.5px] outline-none bg-white"
          >
            <option value="cost">월 비용 ↓</option>
            <option value="calls">월 호출 ↓</option>
            <option value="unit">호출 단가 ↓</option>
          </select>
          <GrafanaLink panel="cost-by-agent" />
        </div>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
            <th className="text-left font-bold py-2.5 px-4">에이전트 · 프로젝트</th>
            <th className="text-left font-bold py-2.5 px-2 w-[110px]">계열사</th>
            <th className="text-left font-bold py-2.5 px-2 w-[200px]">주력 모델</th>
            <th className="text-right font-bold py-2.5 px-2 w-[110px]">월 호출</th>
            <th className="text-right font-bold py-2.5 px-2 w-[100px]">호출 단가</th>
            <th className="text-right font-bold py-2.5 px-4 w-[120px]">월 비용</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-ink-light py-10 text-[12px]">
                해당 계열사의 운영·실행 중 에이전트가 없습니다.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        r.state === '운영 중' ? 'bg-ok' : 'bg-warn',
                      )}
                    />
                    <span className="text-[12.5px] font-extrabold text-ink">{r.name}</span>
                    <span className="text-[10px] text-ink-mid font-mono">{r.id}</span>
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                    {r.projectName}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <span className="pill bg-surface text-ink-dark border border-line-soft text-[9.5px] whitespace-nowrap">
                    {r.tenant}
                  </span>
                </td>
                <td className="py-2.5 px-2 font-mono text-[11px] text-ink-dark truncate">
                  {r.mainModel}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums font-extrabold text-ink">
                  {fmtCompact(r.monthCalls)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-ink-dark font-semibold">
                  ₩{r.costPerCall.toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-right tabular-nums font-extrabold text-ink">
                  ₩{fmtKRW(r.monthCost)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EfficiencyCard({
  title,
  subtitle,
  tone,
  rows,
}: {
  title: string;
  subtitle: string;
  tone: 'ok' | 'bad';
  rows: {
    id: string;
    name: string;
    monthCost: number;
    monthCalls: number;
    costPerCall: number;
    costPerMTokens: number;
  }[];
}) {
  const dot = tone === 'bad' ? 'bg-bad' : 'bg-ok';
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="text-[14px] font-extrabold text-ink flex items-center gap-1.5">
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', dot)} />
            {title}
          </h3>
          <div className="text-[10.5px] text-ink-mid mt-0.5">{subtitle}</div>
        </div>
      </div>
      <ul className="space-y-1.5">
        {rows.length === 0 ? (
          <li className="text-[11px] text-ink-light italic">데이터 없음</li>
        ) : (
          rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/projects/${r.id}`}
                className="grid grid-cols-[1fr_auto] gap-2 items-center py-1.5 px-2 rounded hover:bg-surface-soft text-[11.5px]"
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-ink truncate">{r.name}</div>
                  <div className="text-[10.5px] text-ink-mid font-semibold tabular-nums">
                    호출 {fmtCompact(r.monthCalls)} · 비용 ₩{fmtKRW(r.monthCost)}
                  </div>
                </div>
                <span
                  className={cn(
                    'tabular-nums font-extrabold',
                    tone === 'bad' ? 'text-bad' : 'text-ok',
                  )}
                >
                  ₩{Math.round(r.costPerCall).toLocaleString()}/회
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function PtuChangeRow({ ev }: { ev: PtuChangeEvent }) {
  const up = ev.to > ev.from;
  return (
    <li className="grid grid-cols-[64px_1fr_auto] gap-2 items-center py-1.5 px-2 rounded hover:bg-surface-soft text-[11.5px]">
      <span
        className={cn(
          'pill border text-center',
          up
            ? 'bg-bad-bg text-bad border-bad-border'
            : 'bg-ok-bg text-ok border-ok-border',
        )}
      >
        {up ? '증설' : '감설'}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[11px] text-ink-dark font-extrabold truncate">
          {ev.model}
        </div>
        <div className="text-[10.5px] text-ink-mid font-semibold tabular-nums">
          {ev.from} → {ev.to} PTU · {ev.at} · {ev.approver}
        </div>
      </div>
      <span
        className={cn(
          'tabular-nums font-extrabold',
          ev.costDeltaKrw >= 0 ? 'text-bad' : 'text-ok',
        )}
      >
        {ev.costDeltaKrw >= 0 ? '+' : '−'}₩{fmtKRW(Math.abs(ev.costDeltaKrw))}
      </span>
    </li>
  );
}

function fmtCompact(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`;
  if (n >= 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}
