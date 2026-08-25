import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import KpiCard from '@/components/ui/KpiCard';
import { cn } from '@/lib/utils';
import { findAgentTask, BUILDER_LABEL, type AgentTask } from '@/data/mockAgentTasks';
import { ToolModal, JenkinsMock, ArgocdMock } from '@/components/devenv/ToolMocks';
import {
  getAgentVersions,
  getTestSets,
  getEvalRuns,
  getLangfuseProject,
  getRunLangfuseUrl,
  type EvalRun,
} from '@/data/mockAgentEvals';
import {
  getDeployData,
  getPreflight,
  getDiff,
  getServingDeployData,
  getApiKey,
  getLoadTestRuns,
  SCENARIO_LABEL,
  type GitTag,
  type ServingStatus,
  type ApiKey,
  type ApiKeyEnv,
  type LoadTestRun,
  type LoadTestScenario,
  type LoadTestStatus,
} from '@/data/mockAgentDeploys';
import {
  getRedTeamOperator,
  getRedTeamDatasets,
  getRedTeamRuns,
  getRedTeamRequests,
  type RedTeamRun,
  type RequestStatus,
} from '@/data/mockAgentRedTeam';
import {
  getPiiItems,
  getPiiEvents,
  getPiiChangeRequests,
  type PiiItem,
  type PiiChangeAction,
  type PiiChangeStatus,
} from '@/data/mockAgentGovernance';

type TabId = 'develop' | 'deploy' | 'ops' | 'eval';

const STATE_TONE: Record<string, string> = {
  '운영 중': 'bg-ok-bg text-ok border-ok-border',
  '실행 중': 'bg-info-bg text-info border-info-border',
  계획: 'bg-warn-bg text-warn border-warn-border',
  보류: 'bg-surface-soft text-ink-mid border-line-soft',
};

/**
 * 에이전트 과제 상세 — 헤더 + 3개 탭(개요 · 학습계 배포 · 평가).
 */
export default function AgentTaskDetailPage() {
  const { projectId, agentId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const task = agentId ? findAgentTask(agentId) : undefined;
  const [tab, setTab] = useState<TabId>('develop');
  /** 배포 탭 환경 토글. */
  const [deployEnv, setDeployEnv] = useState<'train' | 'serv'>('train');
  /** 평가 탭 모드 토글 (성능 / 거버넌스·레드팀). */
  const [evalMode, setEvalMode] = useState<'perf' | 'redteam'>('perf');
  /** 평가 탭 버전 필터 — 배포 탭에서 "평가 보기" 클릭 시 set 후 탭 전환. */
  const [evalVersionFilter, setEvalVersionFilter] = useState<string>('all');

  if (!task) {
    return <Navigate to={`/projects/${pid}`} replace />;
  }

  const stateTone = STATE_TONE[task.state] ?? STATE_TONE['보류'];
  // 운영 중 또는 실행 중 과제만 KPI 실측치 표시 (계획 단계는 0)
  const hasRuns = task.state !== '계획' && task.state !== '보류';

  return (
    <div className="max-w-[1280px] mx-auto px-8 pt-3.5 pb-14">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: `/projects/${pid}` },
          { label: task.name },
        ]}
      />

      {/* Header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-start justify-between gap-6 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
              <span className="text-ink-light text-[10px]">·</span>
              <span className="text-[11px] text-ink-mid">최근 활동 {task.updatedAt}</span>
              <span className="text-ink-light text-[10px] ml-1">·</span>
              <span className={cn('pill border', stateTone)}>
                <span className="mr-1">●</span>
                {task.state}
              </span>
            </div>
            <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.4px] truncate">{task.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11.5px] text-ink-mid">
              <span className="pill bg-info-bg text-info border border-info-border">{BUILDER_LABEL[task.builder]}</span>
              <span className="text-ink-light">|</span>
              <span>
                담당 <b className="text-ink-dark">{task.ownerName}</b>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost">📎 첨부 보기</Button>
            <Button>▶ 테스트 호출</Button>
            <Button variant="primary">＋ 결재 기안</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex items-center border-b border-line pb-0 mb-3.5 sticky top-[98px] z-20 bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]">
        <TabBtn active={tab === 'develop'} onClick={() => setTab('develop')}>
          개발
        </TabBtn>
        <TabBtn active={tab === 'deploy'} onClick={() => setTab('deploy')}>
          배포
        </TabBtn>
        <TabBtn active={tab === 'ops'} onClick={() => setTab('ops')}>
          운영
        </TabBtn>
        <TabBtn active={tab === 'eval'} onClick={() => setTab('eval')}>
          평가
        </TabBtn>
      </nav>

      {/* 개발 — GitLab · CI/CD */}
      {tab === 'develop' && <DevelopTab task={task} />}

      {/* 배포 — 학습계/서빙계 + 결재 */}
      {tab === 'deploy' && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">환경</span>
            <div className="inline-flex rounded-lg border border-line overflow-hidden">
              {([
                { k: 'train', label: '학습계', sub: 'dev' },
                { k: 'serv', label: '서빙계', sub: 'prod' },
              ] as const).map((e) => (
                <button
                  key={e.k}
                  onClick={() => setDeployEnv(e.k)}
                  className={cn(
                    'h-7 px-3 text-[11.5px] font-extrabold inline-flex items-center gap-1',
                    deployEnv === e.k
                      ? e.k === 'train'
                        ? 'bg-info-bg text-info'
                        : 'bg-ok-bg text-ok'
                      : 'bg-white text-ink-mid hover:bg-surface',
                  )}
                >
                  {e.label}
                  <span className="text-[9px] font-bold opacity-70">{e.sub}</span>
                </button>
              ))}
            </div>
          </div>
          {deployEnv === 'train' ? <DeployTab agentId={task.id} /> : <ServingDeployTab agentId={task.id} />}
        </section>
      )}

      {/* 운영 — 사용량 모니터링 대시보드 */}
      {tab === 'ops' && <OpsTab task={task} hasRuns={hasRuns} />}

      {/* 평가 — 성능 / 거버넌스(레드팀) */}
      {tab === 'eval' && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-ink-mid uppercase tracking-[0.3px]">평가 유형</span>
            <div className="inline-flex rounded-lg border border-line overflow-hidden">
              {([
                { k: 'perf', label: '성능 평가' },
                { k: 'redteam', label: '거버넌스 · 레드팀' },
              ] as const).map((m) => (
                <button
                  key={m.k}
                  onClick={() => setEvalMode(m.k)}
                  className={cn(
                    'h-7 px-3 text-[11.5px] font-extrabold',
                    evalMode === m.k ? 'bg-brand-tint text-ink' : 'bg-white text-ink-mid hover:bg-surface',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {evalMode === 'perf' ? (
            <EvalTab agentId={task.id} versionFilter={evalVersionFilter} onVersionFilterChange={setEvalVersionFilter} />
          ) : (
            <RedTeamTab agentId={task.id} />
          )}
        </section>
      )}

      <div className="mt-3.5">
        <Link to={`/projects/${pid}`}>
          <Button>← 과제 목록으로</Button>
        </Link>
      </div>
    </div>
  );
}

/* ---------------- 개발 (GitLab · CI/CD) ---------------- */

function DevelopTab({ task }: { task: AgentTask }) {
  const [open, setOpen] = useState<'jenkins' | 'argocd' | null>(null);
  const repo = `git.aip.group.local/pb-agent/agents/${task.id.toLowerCase()}`;
  const tools = [
    { k: 'jenkins' as const, icon: '⚙️', name: 'Jenkins', desc: '빌드 · 테스트 파이프라인', tone: 'text-accent-purple' },
    { k: 'argocd' as const, icon: '🚀', name: 'ArgoCD', desc: 'GitOps 배포 동기화', tone: 'text-ok' },
  ];
  return (
    <section className="space-y-3.5">
      {/* GitLab 저장소 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink flex items-center gap-2">
            <span aria-hidden>🦊</span> GitLab 저장소
          </h2>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface inline-flex items-center"
          >
            저장소 열기 ↗
          </a>
        </div>
        <Kv label="Repository" value={<code className="text-[11.5px] font-mono text-ink-dark break-all">{repo}</code>} />
        <Kv label="브랜치" value={<code className="text-[11.5px] font-mono text-ink-dark">main</code>} />
        <Kv label="빌더" value={BUILDER_LABEL[task.builder]} last />
      </div>

      {/* CI/CD 도구 */}
      <div className="card px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">CI/CD 도구</h2>
        <div className="grid grid-cols-2 gap-3">
          {tools.map((t) => (
            <div key={t.k} className="border border-line-soft rounded-lg p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{t.icon}</span>
                <span className={cn('text-[13px] font-extrabold', t.tone)}>{t.name}</span>
              </div>
              <p className="text-[11px] text-ink-mid font-semibold flex-1">{t.desc}</p>
              <button
                onClick={() => setOpen(t.k)}
                className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface self-start"
              >
                열기 →
              </button>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <ToolModal onClose={() => setOpen(null)}>
          {open === 'jenkins' && <JenkinsMock />}
          {open === 'argocd' && <ArgocdMock />}
        </ToolModal>
      )}
    </section>
  );
}

/* ---------------- 운영 (사용량 모니터링 대시보드) ---------------- */

function OpsTab({ task, hasRuns }: { task: AgentTask; hasRuns: boolean }) {
  // 최근 7일 호출량 (mock)
  const daily = [212, 240, 198, 305, 288, 331, 224];
  const maxV = Math.max(...daily);
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const topScenarios = [
    { name: '상품 안내', share: 42 },
    { name: '자산 진단 요약', share: 28 },
    { name: '시장 동향', share: 18 },
    { name: '규정 확인', share: 12 },
  ];
  const errors = [
    { at: '2026-08-06 09:12', code: 'TOOL_TIMEOUT', msg: '지식 검색 API 응답 지연 (3.4s)' },
    { at: '2026-08-05 21:40', code: 'GUARDRAIL_BLOCK', msg: '정책 위반 프롬프트 차단' },
  ];

  if (!hasRuns) {
    return (
      <section className="card px-5 py-14 text-center">
        <div className="text-[26px] mb-2">📊</div>
        <div className="text-[13px] font-extrabold text-ink mb-1">운영 데이터가 아직 없습니다</div>
        <div className="text-[11.5px] text-ink-mid">서빙계 배포 후 호출이 발생하면 사용량·성능 지표가 표시됩니다.</div>
      </section>
    );
  }

  return (
    <section className="space-y-3.5">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="호출 수 (7일)" value="1.8K" delta={{ text: '▲ +12.4% 전주 대비', tone: 'up' }} sub="일평균 257건" tone="ok" />
        <KpiCard label="P95 응답" value="2.1" unit="s" delta={{ text: '▼ -0.2s', tone: 'up' }} sub="목표 ≤ 3.0s" tone="ok" />
        <KpiCard label="성공률 (7일)" value="98.6" unit="%" delta={{ text: '▲ +0.4%p', tone: 'up' }} sub="실패 24건 / 1,798건" tone="ok" />
        <KpiCard label="가드레일 차단" value="7" unit="건" delta={{ text: '▲ +2건', tone: 'down' }} sub="PII 마스킹 218 · 정책 0" tone="warn" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
        {/* 호출량 추이 */}
        <div className="card px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-ink mb-3">최근 7일 호출량</h2>
          <div className="flex items-end gap-2 h-[140px]">
            {daily.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end" style={{ height: '110px' }}>
                  <div
                    className="w-full rounded-t bg-brand-dark/80"
                    style={{ height: `${(v / maxV) * 100}%` }}
                    title={`${v}건`}
                  />
                </div>
                <span className="text-[10px] text-ink-mid font-semibold">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 상위 시나리오 */}
        <div className="card px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-ink mb-3">상위 시나리오</h2>
          <div className="flex flex-col gap-2.5">
            {topScenarios.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-[11.5px] mb-1">
                  <span className="font-bold text-ink-dark">{s.name}</span>
                  <span className="text-ink-mid font-semibold">{s.share}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-soft overflow-hidden">
                  <div className="h-full rounded-full bg-info" style={{ width: `${s.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 최근 오류 */}
      <div className="card px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">최근 오류 · 이벤트</h2>
        <div className="border border-line-soft rounded-lg overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">시각</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">코드</th>
                <th className="text-left py-2 px-3 font-bold">내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {errors.map((e, i) => (
                <tr key={i} className="hover:bg-surface">
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{e.at}</td>
                  <td className="py-2 px-3 font-mono font-bold text-bad whitespace-nowrap">{e.code}</td>
                  <td className="py-2 px-3 text-ink-dark">{e.msg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-ink-mid font-semibold mt-2">
          에이전트 <b className="text-ink-dark">{task.name}</b> · {BUILDER_LABEL[task.builder]} · 담당 {task.ownerName}
        </div>
      </div>
    </section>
  );
}

function TabBtn({
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
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-extrabold border-b-2 -mb-px transition-colors',
        active
          ? 'text-ink border-brand-dark bg-brand-tint'
          : 'text-ink-mid border-transparent hover:text-ink-dark hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}

function Kv({
  label,
  value,
  last,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneCls = tone === 'ok'
    ? 'text-ok'
    : tone === 'bad'
    ? 'text-bad'
    : tone === 'warn'
    ? 'text-warn'
    : 'text-ink-dark';
  return (
    <div
      className={cn(
        'flex justify-between gap-3 py-2 text-[12.5px]',
        !last && 'border-b border-line-soft',
      )}
    >
      <span className="text-ink-mid font-semibold">{label}</span>
      <span className={cn('font-extrabold text-right', toneCls)}>{value}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-7 text-center text-xs text-ink-light font-semibold bg-surface-soft border border-dashed border-line-soft rounded">
      {label}
    </div>
  );
}

/* ---------- Evaluation tab ---------- */

function EvalTab({
  agentId,
  versionFilter,
  onVersionFilterChange,
}: {
  agentId: string;
  versionFilter: string;
  onVersionFilterChange: (v: string) => void;
}) {
  const versions = getAgentVersions(agentId);
  const testSets = getTestSets(agentId);
  const runs = getEvalRuns(agentId);
  const langfuse = getLangfuseProject(agentId);

  const setVersionFilter = onVersionFilterChange;
  const [testSetFilter, setTestSetFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return runs.filter(
      (r) =>
        (versionFilter === 'all' || r.version === versionFilter) &&
        (testSetFilter === 'all' || r.testSetId === testSetFilter),
    );
  }, [runs, versionFilter, testSetFilter]);

  if (runs.length === 0) {
    return (
      <section className="space-y-3.5">
        {langfuse && <LangfuseCard project={langfuse} />}
        <div className="card px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-extrabold text-ink">평가 이력</h2>
            {langfuse && (
              <a
                href={langfuse.runUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-info-bg border border-info-border rounded text-[12px] font-bold text-info hover:bg-info hover:text-white"
                title="Langfuse experiments에서 자세히 보거나 새 평가를 시작합니다"
              >
                🔭 Langfuse에서 자세히 ↗
              </a>
            )}
          </div>
          <Empty label="아직 등록된 평가 이력이 없습니다 · Langfuse에서 평가를 시작하세요" />
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Langfuse 연결 카드 */}
      {langfuse && (
        <div className="mb-3.5">
          <LangfuseCard project={langfuse} />
        </div>
      )}

      {/* 테스트셋 카드 */}
      <div className="card px-5 py-4 mb-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold text-ink">테스트셋</h3>
          {langfuse && (
            <a
              href={`${langfuse.url}/datasets`}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] font-bold text-info hover:underline"
            >
              ＋ Langfuse에서 데이터셋 관리 ↗
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {testSets.map((ts) => (
            <div key={ts.id} className="p-3 rounded border border-line-soft bg-surface-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12.5px] font-extrabold text-ink truncate flex-1">{ts.name}</div>
                {ts.langfuseDatasetUrl && (
                  <a
                    href={ts.langfuseDatasetUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Langfuse 데이터셋 열기"
                    className="text-[10.5px] font-bold text-info hover:underline flex-shrink-0"
                  >
                    dataset ↗
                  </a>
                )}
              </div>
              <div className="text-[10.5px] text-ink-mid font-semibold mt-1">
                <span className="tabular-nums">{ts.caseCount}</span> 케이스 · {ts.owner} · {ts.updatedAt}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 평가 이력 테이블 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">평가 이력</h2>
            <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
              버전 × 테스트셋 조합으로 누적된 회귀 평가 결과 · 자동 평가 + 사람 검수
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-ink-mid font-bold">버전</label>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="h-7 px-2 border border-line rounded text-[11.5px] bg-white"
            >
              <option value="all">전체</option>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version}
                  {v.isCurrent ? ' (현재)' : ''}
                </option>
              ))}
            </select>
            <label className="text-[11px] text-ink-mid font-bold ml-2">테스트셋</label>
            <select
              value={testSetFilter}
              onChange={(e) => setTestSetFilter(e.target.value)}
              className="h-7 px-2 border border-line rounded text-[11.5px] bg-white"
            >
              <option value="all">전체</option>
              {testSets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {langfuse && (
              <a
                href={langfuse.runUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-8 px-3 bg-info-bg border border-info-border rounded text-[12px] font-bold text-info hover:bg-info hover:text-white"
                title="Langfuse experiments에서 자세히 보거나 새 평가를 시작합니다"
              >
                🔭 Langfuse에서 자세히 ↗
              </a>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty label="선택한 조건에 해당하는 평가 이력이 없습니다" />
        ) : (
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">버전</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">테스트셋</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">실행 시각</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">실행자</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">통과율</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">실패</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">Judge</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">콜당 비용</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">상태</th>
                <th className="w-[110px] text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">케이스별</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const ts = testSets.find((t) => t.id === r.testSetId);
                const ver = versions.find((v) => v.version === r.version);
                return (
                  <tr key={r.id} className="hover:bg-[#F3F9F8]">
                    <td className="py-2 px-2.5 border-b border-line-soft">
                      <span
                        className={cn(
                          'pill border',
                          ver?.isCurrent
                            ? 'bg-brand-tint text-ink border-brand-dark'
                            : 'bg-surface-soft text-ink-mid border-line-soft',
                        )}
                      >
                        {r.version}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-ink-dark font-semibold">
                      {ts?.name ?? r.testSetId}
                      <span className="text-ink-mid font-medium ml-1">· {r.totalCases}건</span>
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px] tabular-nums">
                      {r.ranAt}
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-ink-dark text-[11.5px]">
                      {r.ranBy}
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums">
                      <div className="inline-flex items-baseline gap-1">
                        <b className="text-ink-dark">{r.passRate.toFixed(1)}</b>
                        <span className="text-ink-mid text-[10.5px]">%</span>
                      </div>
                      {typeof r.deltaVsPrev === 'number' && r.deltaVsPrev !== 0 && (
                        <DeltaPill delta={r.deltaVsPrev} />
                      )}
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums">
                      <span className={cn('font-bold', r.failedCases > 0 ? 'text-bad' : 'text-ink-mid')}>
                        {r.failedCases}건
                      </span>
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft">
                      <JudgeBadge judge={r.judge} />
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums text-ink-dark">
                      ₩{r.avgCostKrw.toFixed(1)}
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft">
                      <EvalStatusPill status={r.status} />
                    </td>
                    <td className="py-2 px-2.5 border-b border-line-soft text-right">
                      {langfuse ? (
                        <a
                          href={getRunLangfuseUrl(agentId, r.id) ?? langfuse.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-info hover:underline"
                          title="Langfuse에서 케이스별 결과 보기"
                        >
                          🔭 trace ↗
                        </a>
                      ) : (
                        <span className="text-ink-light text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const up = delta > 0;
  const cls = up ? 'text-ok' : 'text-bad';
  return (
    <div className={cn('text-[10px] font-bold tabular-nums', cls)}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%p
    </div>
  );
}

function JudgeBadge({ judge }: { judge: EvalRun['judge'] }) {
  const isLlm = judge.kind === 'llm';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10.5px] font-bold py-[2px] px-1.5 rounded border font-mono',
        isLlm
          ? 'bg-accent-purple-bg text-accent-purple border-accent-purple-bg'
          : 'bg-surface-soft text-ink-mid border-line-soft',
      )}
      title={isLlm ? 'LLM-as-judge' : 'Rule-based judge'}
    >
      <span className="not-italic">{isLlm ? '🧠' : '⚖️'}</span>
      {judge.name}
    </span>
  );
}

function EvalStatusPill({ status }: { status: EvalRun['status'] }) {
  if (status === 'pass') return <span className="pill bg-ok-bg text-ok border border-ok-border">통과</span>;
  if (status === 'partial')
    return <span className="pill bg-warn-bg text-warn border border-warn-border">부분 통과</span>;
  return <span className="pill bg-bad-bg text-bad border border-bad-border">실패</span>;
}

function LangfuseCard({ project }: { project: NonNullable<ReturnType<typeof getLangfuseProject>> }) {
  return (
    <div className="card px-5 py-3.5 flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-info-bg border border-info-border text-base flex-shrink-0">
        🔭
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">Langfuse 프로젝트</span>
          <span className="pill bg-info-bg text-info border border-info-border">{project.name}</span>
        </div>
        <div className="text-[11.5px] text-ink-mid font-semibold truncate">
          <code className="font-mono text-ink-dark">{project.url}</code>
          <span className="mx-2 text-line">·</span>
          trace <b className="text-ink-dark tabular-nums">{project.traceCount.toLocaleString()}</b>건
          <span className="mx-2 text-line">·</span>
          마지막 동기화 <b className="text-ink-dark">{project.lastSyncedAt}</b>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface">
          ↻ 동기화
        </button>
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="h-7 px-3 bg-info-bg border border-info-border rounded text-[11.5px] font-bold text-info hover:bg-info hover:text-white inline-flex items-center"
        >
          Langfuse에서 열기 ↗
        </a>
      </div>
    </div>
  );
}

/* ---------- Deploy (학습계) tab ---------- */

function DeployTab({ agentId }: { agentId: string }) {
  const data = getDeployData(agentId);
  const [search, setSearch] = useState('');
  const [selectedTagName, setSelectedTagName] = useState<string | null>(
    data?.tags[0]?.name ?? null,
  );

  if (!data) {
    return (
      <section className="card px-5 py-4">
        <Empty label="GitLab 레포가 연결되지 않았습니다 · 에이전트 정보에서 레포를 연결하세요" />
      </section>
    );
  }

  const { repo, tags, history, currentTagName } = data;
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedTag = tags.find((t) => t.name === selectedTagName) ?? null;
  const preflight = selectedTag ? getPreflight(selectedTag) : null;
  const diff = selectedTag ? getDiff(currentTagName, selectedTag.name) : null;

  const allPreflightPass =
    preflight !== null &&
    preflight.ci === 'pass' &&
    preflight.eval.status === 'pass' &&
    preflight.security === 'pass' &&
    preflight.secrets.status === 'pass';

  return (
    <section className="space-y-3.5">
      {/* 레포 카드 + 현재 배포 */}
      <div className="card px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🦊</span>
            <code className="text-[13px] font-extrabold text-ink font-mono truncate">{repo.url}</code>
            <span className="pill bg-info-bg text-info border border-info-border">branch {repo.branch}</span>
          </div>
          <div className="text-[11.5px] text-ink-mid font-semibold">
            마지막 fetch · <b className="text-ink-dark">{repo.lastFetchedAt}</b>
            <span className="mx-2 text-line">·</span>
            태그 <b className="text-ink-dark">{tags.length}</b>개
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <button className="h-7 px-2.5 bg-white border border-line rounded text-[11.5px] font-semibold text-ink-dark hover:bg-surface">
            ↻ 새로고침
          </button>
          <a className="text-[11px] text-info font-bold hover:underline cursor-pointer">GitLab에서 열기 ↗</a>
        </div>
      </div>

      <div className="card px-5 py-3.5 flex items-center gap-3 bg-ok-bg/40 border-ok-border">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-ok-bg border border-ok-border text-ok text-base">
          ●
        </span>
        <div className="flex-1">
          <div className="text-[11px] text-ink-mid font-bold uppercase tracking-[0.3px]">학습계 현재 배포</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-[16px] font-extrabold text-ink">{currentTagName}</span>
            <span className="text-[11.5px] text-ink-mid">
              · {history[0]?.deployedAt} · {history[0]?.deployedBy}
            </span>
          </div>
        </div>
      </div>

      {/* 학습계 API 키 */}
      <ApiKeyPanel agentId={agentId} env="train" />

      {/* 태그 — 통합 목록 (행에서 바로 배포 기안) */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">태그</h2>
          <span className="text-[11px] text-ink-mid">{filteredTags.length} / {tags.length}</span>
        </div>
        <div className="relative mb-3">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="태그명 검색 (예: v4)"
            className="w-full h-8 py-0 pl-7 pr-2.5 border border-line rounded text-xs focus:outline-none focus:border-brand-dark"
          />
        </div>
        <ul className="divide-y divide-line-soft border border-line-soft rounded-lg overflow-hidden">
          {filteredTags.map((tag) => {
            const isCurrent = tag.name === currentTagName;
            const isOld = !isCurrent && history.some((h) => h.tagName === tag.name);
            return (
              <li
                key={tag.name}
                className={cn('flex items-center gap-3 px-3.5 py-2.5', isCurrent ? 'bg-ok-bg/30' : 'bg-white hover:bg-surface')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[12.5px] font-extrabold text-ink font-mono">{tag.name}</span>
                    {isCurrent && <span className="pill bg-ok-bg text-ok border border-ok-border">현재 배포</span>}
                    {isOld && <span className="pill bg-surface-soft text-ink-mid border border-line-soft">이전</span>}
                  </div>
                  <div className="text-[11.5px] text-ink-dark font-semibold truncate">{tag.commitMessage}</div>
                  <div className="text-[10.5px] text-ink-mid font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <code className="font-mono">{tag.commitSha}</code>
                    <span>·</span>
                    <span>{tag.author}</span>
                    <span>·</span>
                    <span>{tag.authoredAt}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-ok-border bg-ok-bg text-ok text-[10.5px] font-extrabold whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-ok" /> 배포 중
                    </span>
                  ) : (
                    <button
                      disabled={!allPreflightPass}
                      title={!allPreflightPass ? '사전 점검 미통과 항목이 있으면 기안할 수 없습니다' : '학습계 배포 기안'}
                      className="h-7 px-2.5 bg-brand border border-brand-dark rounded text-[11px] font-extrabold text-ink hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      배포 기안 →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {!allPreflightPass && (
          <div className="text-[11px] text-warn font-semibold mt-2">사전 점검 미통과 항목이 있으면 기안할 수 없습니다.</div>
        )}
      </div>

      {/* 배포 이력 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">학습계 배포 이력</h2>
          <span className="text-[11.5px] text-ink-mid">최근 {history.length}건</span>
        </div>
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-surface-soft text-ink-dark">
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">버전</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">배포 시각</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">배포자</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">결재 처리</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">상태</th>
              <th className="w-[100px] py-2 px-2.5 border-b border-line-soft"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-[#F3F9F8]">
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <code className="font-mono text-ink-dark font-bold">{h.tagName}</code>
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px] tabular-nums">
                  {h.deployedAt}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-dark text-[11.5px]">{h.deployedBy}</td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px]">{h.approvedBy ?? '—'}</td>
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <DeployStatusPill status={h.status} />
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-right">
                  {h.status === 'active' ? (
                    <button className="text-[11px] font-bold text-bad hover:underline">↶ 롤백</button>
                  ) : (
                    <span className="text-ink-light text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CiBadge({ ci }: { ci: GitTag['ci'] }) {
  if (ci === 'success')
    return <span className="pill bg-ok-bg text-ok border border-ok-border">CI ✓</span>;
  if (ci === 'failed') return <span className="pill bg-bad-bg text-bad border border-bad-border">CI ✗</span>;
  return <span className="pill bg-warn-bg text-warn border border-warn-border">CI ⏵</span>;
}

function DiffRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-mid font-semibold w-[88px] flex-shrink-0">{label}</span>
      <span className="text-ink-dark font-bold">{value}</span>
    </div>
  );
}

function DeployStatusPill({ status }: { status: 'active' | 'replaced' | 'rolled-back' }) {
  if (status === 'active')
    return <span className="pill bg-ok-bg text-ok border border-ok-border">활성</span>;
  if (status === 'replaced')
    return <span className="pill bg-surface-soft text-ink-mid border border-line-soft">교체됨</span>;
  return <span className="pill bg-bad-bg text-bad border border-bad-border">롤백됨</span>;
}

/* ---------- Serving (서빙계) deploy tab ---------- */

/** Blue/Green 컷오버 전 워밍업 시간(분) 옵션. */
const WARMUP_MINUTES = [5, 10, 15, 30] as const;

function ServingDeployTab({ agentId }: { agentId: string }) {
  const data = getServingDeployData(agentId);
  const [selectedTag, setSelectedTag] = useState<string | null>(
    data?.candidates.find((c) => c.status === 'recommended')?.tagName ??
      data?.candidates[0]?.tagName ??
      null,
  );
  const [cutoverMode, setCutoverMode] = useState<'warmup' | 'instant'>('warmup');
  const [warmupMinutes, setWarmupMinutes] = useState<number>(10);

  if (!data) {
    return (
      <section className="card px-5 py-4">
        <Empty label="서빙계 배포 데이터가 없습니다 · 학습계 배포 + 평가 완료된 버전이 있어야 결재 기안이 가능합니다" />
      </section>
    );
  }

  const candidate = data.candidates.find((c) => c.tagName === selectedTag) ?? null;
  const isCurrentInServing = candidate?.tagName === data.currentTagName;

  /** 긴급 롤백 대상 — 이력에서 현재 활성을 제외한 가장 최근 'replaced' 기록. */
  const rollbackTarget = data.history.find(
    (h) => h.tagName !== data.currentTagName && h.status === 'replaced',
  );
  const allReady =
    candidate !== null &&
    candidate.status !== 'blocked' &&
    candidate.status !== 'caution' &&
    !isCurrentInServing;

  return (
    <section className="space-y-3.5">
      {/* 현재 서빙계 배포 */}
      <div className="card px-5 py-3.5 flex items-center gap-3 bg-ok-bg/40 border-ok-border">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-ok-bg border border-ok-border text-ok text-base">
          ●
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-ink-mid font-bold uppercase tracking-[0.3px]">
            서빙계 현재 배포
            {data.externalFacing && (
              <span className="ml-2 pill bg-warn-bg text-warn border border-warn-border">대고객</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-[16px] font-extrabold text-ink font-mono">{data.currentTagName}</span>
            <span className="text-[11.5px] text-ink-mid">
              · 트래픽 <b className="text-ink-dark tabular-nums">{data.currentTrafficPct}%</b>
              <span className="mx-1.5 text-line">·</span>
              {data.history[0]?.promotedAt} · {data.history[0]?.promotedBy}
            </span>
          </div>
        </div>
        {rollbackTarget ? (
          <button
            onClick={() => {
              const msg =
                `긴급 롤백을 실행합니다.\n\n` +
                `현재: ${data.currentTagName} (${data.history[0]?.promotedAt})\n` +
                `→ 복귀: ${rollbackTarget.tagName} (${rollbackTarget.promotedAt} · ${rollbackTarget.promotedBy})\n\n` +
                `트래픽이 즉시 ${rollbackTarget.tagName}로 100% 전환되며 감사 원장에 기록됩니다. 계속하시겠습니까?`;
              if (window.confirm(msg)) {
                window.alert(`${rollbackTarget.tagName}로 롤백 진행 (목업)`);
              }
            }}
            title={`긴급 롤백 대상: ${rollbackTarget.tagName}`}
            className="flex items-center gap-2.5 py-1.5 px-2.5 bg-white border border-bad-border rounded hover:bg-bad-bg group transition-colors"
          >
            <span className="flex flex-col items-end leading-tight">
              <span className="text-[9.5px] font-bold text-bad uppercase tracking-[0.3px]">
                긴급 롤백 대상
              </span>
              <span className="text-[12px] font-extrabold text-ink-dark font-mono">
                {rollbackTarget.tagName}
              </span>
              <span className="text-[9.5px] text-ink-mid font-semibold">
                {rollbackTarget.promotedAt.slice(0, 10)} · {rollbackTarget.promotedBy}
              </span>
            </span>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-bad-bg border border-bad-border text-bad text-base group-hover:bg-bad group-hover:text-white">
              ↶
            </span>
          </button>
        ) : (
          <button
            disabled
            className="h-7 px-2.5 bg-surface-soft border border-line-soft rounded text-[11.5px] font-bold text-ink-light cursor-not-allowed"
            title="롤백할 이전 버전이 없습니다"
          >
            ↶ 롤백 불가
          </button>
        )}
      </div>

      {/* 서빙계 API 키 */}
      <ApiKeyPanel agentId={agentId} env="serv" />

      {/* 배포 후보 + 액션 (단일 카드) */}
      <div className="card px-5 py-4">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-[15px] font-extrabold text-ink">배포 후보</h2>
          <span className="text-[11px] text-ink-mid">
            <b className="text-ink-dark">학습계 배포 + 평가 완료</b>된 버전만 결재 기안 가능
          </span>
        </div>

        {/* 후보 카드 3장 */}
        <div className="grid grid-cols-3 gap-2.5 mt-3">
          {data.candidates.map((c) => {
            const isSel = c.tagName === selectedTag;
            const isCurrent = c.tagName === data.currentTagName;
            const isBlocked = c.status === 'blocked';
            return (
              <button
                key={c.tagName}
                type="button"
                onClick={() => setSelectedTag(c.tagName)}
                className={cn(
                  'text-left p-3 rounded border transition-all',
                  isSel
                    ? 'bg-brand-tint border-brand-dark shadow-sm'
                    : isBlocked
                    ? 'bg-surface-soft/50 border-line-soft hover:border-line opacity-75'
                    : 'bg-white border-line-soft hover:border-info',
                )}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[14px] font-extrabold text-ink font-mono">{c.tagName}</span>
                  {isCurrent && (
                    <span className="pill bg-ok-bg text-ok border border-ok-border">서빙계 현재</span>
                  )}
                </div>
                <div className="space-y-1 text-[11.5px]">
                  <CandidateMetaRow
                    label="평가"
                    value={
                      c.evalPassRate != null ? (
                        <span className="text-ok font-bold">✓ {c.evalPassRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-bad font-bold">미완</span>
                      )
                    }
                  />
                  <CandidateMetaRow
                    label="레드팀"
                    value={
                      c.redteamPassed === true ? (
                        <span className="text-ok font-bold">✓ 통과</span>
                      ) : c.redteamPassed === false ? (
                        <span className="text-bad font-bold">미통과</span>
                      ) : (
                        <span className="text-ink-mid">—</span>
                      )
                    }
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* 선택된 후보 액션 영역 — 카드 내부 구분선 아래 */}
        {candidate && (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">
                선택
              </span>
              <span className="text-[15px] font-extrabold text-ink font-mono">{candidate.tagName}</span>
              <span className="text-[11.5px] text-ink-mid ml-2">
                학습계 배포 {candidate.trainDeployedAt}
                <span className="mx-1.5 text-line">·</span>
                {candidate.trainDuration}
              </span>
            </div>

            {isCurrentInServing ? (
              <div className="bg-info-bg border border-info-border rounded p-2.5 text-[12px] text-info font-bold">
                이 버전은 이미 서빙계에서 운영 중입니다.
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                {/* Blue/Green 컷오버 */}
                <div>
                  <h3 className="text-[12px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mb-2">
                    Blue/Green 컷오버
                  </h3>
                  <div className="flex items-center gap-2 mb-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded border border-info-border bg-info-bg text-info font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-info" />
                      Blue · 활성 {data.currentTagName}
                    </span>
                    <span className="text-ink-light">→</span>
                    <span className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded border border-ok-border bg-ok-bg text-ok font-extrabold">
                      <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                      Green · 신규 {candidate.tagName}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <RadioMini
                      checked={cutoverMode === 'warmup'}
                      onChange={() => setCutoverMode('warmup')}
                      label="워밍업 후 컷오버"
                    />
                    <RadioMini
                      checked={cutoverMode === 'instant'}
                      onChange={() => setCutoverMode('instant')}
                      label="즉시 컷오버"
                    />
                  </div>
                  {cutoverMode === 'warmup' && (
                    <div className="flex items-center gap-2 py-1.5 px-2.5 bg-surface-soft border border-line-soft rounded">
                      <span className="text-[11px] text-ink-mid font-bold">워밍업</span>
                      {WARMUP_MINUTES.map((min) => (
                        <button
                          key={min}
                          type="button"
                          onClick={() => setWarmupMinutes(min)}
                          className={cn(
                            'h-6 px-2 rounded text-[11px] font-extrabold tabular-nums border',
                            warmupMinutes === min
                              ? 'bg-brand-tint border-brand-dark text-ink'
                              : 'bg-white border-line text-ink-dark hover:border-brand-dark',
                          )}
                        >
                          {min}분
                        </button>
                      ))}
                      <span className="text-[10.5px] text-ink-mid font-semibold ml-1.5">
                        → Green 스모크 정상이면 100% 컷오버
                      </span>
                    </div>
                  )}
                  {cutoverMode === 'instant' && (
                    <div className="bg-warn-bg border border-warn-border rounded py-1.5 px-2.5 text-[11px] text-warn">
                      <b>즉시 컷오버</b>는 Green 워밍업·스모크 없이 Blue→Green 즉시 전환. 이전 Blue 슬롯은 1시간 보존되며 SLO 위반 시 한 번에 롤백됩니다.
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2">
                  {!allReady && (
                    <span className="text-[11px] text-warn font-semibold max-w-[180px]">
                      사전 점검 미통과 — 기안 불가
                    </span>
                  )}
                  <Button variant="ghost">↻ 사전 점검</Button>
                  <Button variant="primary" disabled={!allReady}>
                    배포 결재 기안 →
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 부하 테스트 */}
      <LoadTestPanel
        agentId={agentId}
        defaultTarget={candidate?.tagName ?? data.currentTagName}
        candidates={data.candidates.map((c) => c.tagName)}
        currentTagName={data.currentTagName}
      />

      {/* 서빙계 배포 이력 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">서빙계 배포 이력</h2>
          <span className="text-[11.5px] text-ink-mid">최근 {data.history.length}건</span>
        </div>
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-surface-soft text-ink-dark">
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">버전</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">프로모션 시각</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">기안자</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">최종 결재</th>
              <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">트래픽</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">상태</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((h) => (
              <tr key={h.id} className="hover:bg-[#F3F9F8]">
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <code className="font-mono text-ink-dark font-bold">{h.tagName}</code>
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px] tabular-nums">
                  {h.promotedAt}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-dark text-[11.5px]">
                  {h.promotedBy}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px]">
                  {h.approvedBy ?? '—'}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums font-bold text-ink-dark">
                  {h.trafficPct}%
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <ServingStatusPill status={h.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CandidateMetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] text-ink-mid font-bold uppercase tracking-[0.3px] w-[42px] flex-shrink-0">
        {label}
      </span>
      <span className="text-ink-dark">{value}</span>
    </div>
  );
}

function ServingStatusPill({ status }: { status: ServingStatus }) {
  if (status === 'active')
    return <span className="pill bg-ok-bg text-ok border border-ok-border">활성</span>;
  if (status === 'standby')
    return <span className="pill bg-info-bg text-info border border-info-border">스탠바이</span>;
  if (status === 'replaced')
    return <span className="pill bg-surface-soft text-ink-mid border border-line-soft">교체됨</span>;
  return <span className="pill bg-bad-bg text-bad border border-bad-border">롤백됨</span>;
}

function RadioMini({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'inline-flex items-center gap-2 py-1.5 px-3 rounded border text-[11.5px] font-bold',
        checked
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-white border-line text-ink-dark hover:border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-3 h-3 rounded-full border-2 inline-block',
          checked ? 'border-brand-dark bg-brand' : 'border-line',
        )}
      />
      {label}
    </button>
  );
}

/* ---------- Governance tab ---------- */

function GovernanceTab({ task }: { task: AgentTask }) {
  return (
    <section className="space-y-3.5">
      {/* 정책·민감도 요약 카드 */}
      <div className="card px-5 py-4">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">정책·법규 요약</h2>
        <div className="grid grid-cols-4 gap-3">
          <SummaryItem label="서비스 대상" value="대고객" tone="warn" />
          <SummaryItem label="데이터 민감도" value="4등급 (기밀)" tone="bad" />
          <SummaryItem
            label="보안 영향도"
            value={task.stage === '서빙계' ? '2등급' : '1등급'}
            tone="warn"
          />
          <SummaryItem label="개인정보·신용정보" value="포함" tone="bad" />
        </div>
      </div>

      {/* ★ PII 필터링 대시보드 (전반적 → 상세) */}
      <PiiFilterDashboard agentId="AGT-204" />

      {/* ★ PII 마스킹 항목 관리 (기본 + 사용자 + 결재) */}
      <PiiItemsManagement agentId="AGT-204" />
    </section>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const stripe =
    tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : tone === 'ok' ? 'bg-ok' : 'bg-line';
  return (
    <div className="relative overflow-hidden px-3.5 py-2.5 rounded border border-line-soft bg-white">
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', stripe)} />
      <div className="text-[10.5px] font-extrabold tracking-[0.3px] uppercase text-ink-mid">{label}</div>
      <div className="text-[14px] font-extrabold text-ink mt-0.5">{value}</div>
    </div>
  );
}

/* ---------- Red team tab ---------- */

function RedTeamTab({ agentId }: { agentId: string }) {
  const operator = getRedTeamOperator();
  const datasets = getRedTeamDatasets(agentId);
  const runs = getRedTeamRuns(agentId);
  const requests = getRedTeamRequests(agentId);

  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [datasetFilter, setDatasetFilter] = useState<string>('all');
  /** 접힌 버전 그룹들. 기본은 모두 펼쳐진 상태. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleVersion = (version: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const versionsInRuns = Array.from(new Set(runs.map((r) => r.version)));

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (versionFilter === 'all' || r.version === versionFilter) &&
          (datasetFilter === 'all' || r.datasetCode === datasetFilter),
      ),
    [runs, versionFilter, datasetFilter],
  );

  return (
    <section className="space-y-3.5">
      {/* 운영 안내 + 신청 버튼 */}
      <div className="card px-5 py-3.5 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-bad-bg border border-bad-border text-lg flex-shrink-0">
          🛡
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">
            레드팀 운영
          </span>
          <div className="text-[13px] font-extrabold text-ink">{operator.team}</div>
        </div>
        <button className="h-9 px-3.5 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-ink hover:bg-brand-dark inline-flex items-center">
          ＋ 레드팀 평가 신청
        </button>
      </div>

      {/* 신청 현황 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">신청 현황</h2>
          <span className="text-[11.5px] text-ink-mid">최근 {requests.length}건</span>
        </div>
        <ul className="space-y-1.5">
          {requests.map((req) => (
            <li
              key={req.id}
              className="grid grid-cols-[110px_180px_1fr_auto_140px] gap-3 items-center py-2.5 px-3 border border-line-soft rounded bg-white"
            >
              <code className="font-mono text-[11.5px] font-extrabold text-ink-dark">{req.id}</code>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-ink-mid font-bold uppercase tracking-[0.3px]">학습계</span>
                <code className="font-mono text-[12px] font-extrabold text-ink-dark">{req.targetVersion}</code>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-ink truncate">{req.reason ?? '레드팀 평가'}</div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
                  신청 {req.requestedAt} · {req.requestedBy}
                  <span className="mx-1.5 text-line">·</span>
                  대상 셋 {req.scope.join(' · ')}
                </div>
              </div>
              <RequestStatusPill status={req.status} />
              <span className="text-[10.5px] text-ink-mid text-right tabular-nums">
                {req.status === 'done'
                  ? `완료 ${req.completedAt}`
                  : req.status === 'in-progress'
                  ? `완료 예상 ${req.estimatedAt}`
                  : req.status === 'pending'
                  ? '대기 중'
                  : '반려'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 평가 이력 */}
      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">레드팀 평가 이력</h2>
            <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
              버전 × 시나리오 셋 조합 · 차단율 / 검수자 결과
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-ink-mid font-bold">버전</label>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="h-7 px-2 border border-line rounded text-[11.5px] bg-white"
            >
              <option value="all">전체</option>
              {versionsInRuns.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <label className="text-[11px] text-ink-mid font-bold ml-2">시나리오 셋</label>
            <select
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value)}
              className="h-7 px-2 border border-line rounded text-[11.5px] bg-white"
            >
              <option value="all">전체</option>
              {datasets.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Empty label="선택한 조건에 해당하는 레드팀 평가 이력이 없습니다" />
        ) : (
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">버전</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">시나리오 셋</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">실행 시각</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">차단율</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">검수자</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">상태</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // 같은 버전끼리 연속으로 묶기 — 첫 행에만 버전 셀 표시 (rowSpan).
                const groups: { version: string; runs: typeof filtered }[] = [];
                filtered.forEach((r) => {
                  const last = groups[groups.length - 1];
                  if (last && last.version === r.version) last.runs.push(r);
                  else groups.push({ version: r.version, runs: [r] });
                });
                return groups.flatMap((g, gi) => {
                  const isCollapsed = collapsed.has(g.version);
                  const passCount = g.runs.filter((r) => r.status === 'pass').length;
                  const failCount = g.runs.length - passCount;
                  const groupBorderTop = gi > 0 ? 'border-t border-line' : '';

                  // 접힌 상태: 한 줄만 노출 (요약).
                  if (isCollapsed) {
                    return (
                      <tr
                        key={`${g.version}-collapsed`}
                        className="hover:bg-[#F3F9F8] cursor-pointer"
                        onClick={() => toggleVersion(g.version)}
                      >
                        <td
                          className={cn(
                            'py-2 px-2.5 border-b border-line-soft bg-surface-soft/40',
                            groupBorderTop,
                          )}
                        >
                          <VersionToggle version={g.version} runs={g.runs.length} collapsed />
                        </td>
                        <td
                          colSpan={5}
                          className={cn(
                            'py-2 px-2.5 border-b border-line-soft text-[11.5px] text-ink-mid font-semibold',
                            groupBorderTop,
                          )}
                        >
                          {g.runs.length}회 평가
                          <span className="mx-1.5 text-line">·</span>
                          <b className="text-ok">통과 {passCount}</b>
                          {failCount > 0 && (
                            <>
                              <span className="mx-1.5 text-line">/</span>
                              <b className="text-bad">실패 {failCount}</b>
                            </>
                          )}
                          <span className="text-ink-light ml-2">— 클릭하여 펼치기</span>
                        </td>
                      </tr>
                    );
                  }

                  // 펼친 상태: rowSpan + 자식 행들.
                  return g.runs.map((r, i) => {
                    const ds = datasets.find((d) => d.code === r.datasetCode);
                    const isFirstInGroup = i === 0;
                    const isLastInGroup = i === g.runs.length - 1;
                    const cellBorder = cn(
                      isLastInGroup ? 'border-b border-line-soft' : 'border-b border-line-soft/40',
                      isFirstInGroup && groupBorderTop,
                    );
                    return (
                      <tr key={r.id} className="hover:bg-[#F3F9F8]">
                        {isFirstInGroup && (
                          <td
                            rowSpan={g.runs.length}
                            className={cn(
                              'py-2 px-2.5 border-b border-line-soft align-top bg-surface-soft/40 cursor-pointer hover:bg-surface-soft',
                              groupBorderTop,
                            )}
                            onClick={() => toggleVersion(g.version)}
                          >
                            <VersionToggle version={g.version} runs={g.runs.length} />
                          </td>
                        )}
                        <td className={cn('py-2 px-2.5 text-ink-dark font-semibold', cellBorder)}>
                          <code className="font-mono text-ink-mid mr-1">{r.datasetCode}</code>
                          {ds?.name ?? r.datasetCode}
                        </td>
                        <td className={cn('py-2 px-2.5 text-ink-mid text-[11px] tabular-nums', cellBorder)}>
                          {r.ranAt}
                        </td>
                        <td className={cn('py-2 px-2.5 text-right tabular-nums', cellBorder)}>
                          <b className={cn(r.status === 'pass' ? 'text-ok' : 'text-bad')}>
                            {r.blockRate.toFixed(1)}
                          </b>
                          <span className="text-ink-mid text-[10.5px] ml-0.5">%</span>
                        </td>
                        <td className={cn('py-2 px-2.5', cellBorder)}>
                          <ReviewerChip name={r.reviewer} />
                        </td>
                        <td className={cn('py-2 px-2.5', cellBorder)}>
                          <RTStatusPill status={r.status} />
                        </td>
                      </tr>
                    );
                  });
                });
              })()}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RequestStatusPill({ status }: { status: RequestStatus }) {
  if (status === 'done')
    return <span className="pill bg-ok-bg text-ok border border-ok-border">완료</span>;
  if (status === 'in-progress')
    return <span className="pill bg-info-bg text-info border border-info-border">진행 중</span>;
  if (status === 'pending')
    return <span className="pill bg-warn-bg text-warn border border-warn-border">대기</span>;
  return <span className="pill bg-bad-bg text-bad border border-bad-border">반려</span>;
}

function RTStatusPill({ status }: { status: RedTeamRun['status'] }) {
  if (status === 'pass') return <span className="pill bg-ok-bg text-ok border border-ok-border">통과</span>;
  return <span className="pill bg-bad-bg text-bad border border-bad-border">실패</span>;
}

function VersionToggle({
  version,
  runs,
  collapsed,
}: {
  version: string;
  runs: number;
  collapsed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] text-ink-mid transition-transform',
          !collapsed && 'rotate-90',
        )}
        aria-label={collapsed ? '펼치기' : '접기'}
      >
        ▶
      </span>
      <span className="pill bg-white text-ink-dark border border-line-soft">{version}</span>
      <span className="text-[10.5px] text-ink-mid font-semibold tabular-nums">{runs}회</span>
    </div>
  );
}

function ReviewerChip({ name }: { name: string }) {
  const initial = name.slice(-2);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-dark">
      <span className="w-5 h-5 rounded-full bg-info-bg text-info text-[10px] font-extrabold inline-flex items-center justify-center border border-info-border">
        {initial.charAt(0)}
      </span>
      {name}
      <span className="text-[10px] text-ink-mid font-medium">· 금융보안센터</span>
    </span>
  );
}

/* ---------- API key panel ---------- */

function ApiKeyPanel({ agentId, env }: { agentId: string; env: ApiKeyEnv }) {
  const initial = getApiKey(agentId, env);
  const [key, setKey] = useState<ApiKey | undefined>(initial);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!key) {
    return (
      <div className="card px-5 py-4 flex items-center gap-3 bg-surface-soft">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-surface-soft border border-line-soft text-lg flex-shrink-0">
          🔑
        </span>
        <div className="flex-1">
          <div className="text-[12.5px] font-extrabold text-ink">
            {env === 'train' ? '학습계' : '서빙계'} API 키 미발급
          </div>
          <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
            발급 후 엔드포인트 호출이 가능합니다.
          </div>
        </div>
        <button
          onClick={() => {
            const newKey: ApiKey = {
              env,
              fullKey: `sk-${env === 'train' ? 'train' : 'live'}-${Math.random().toString(36).slice(2, 18)}${Math.random().toString(36).slice(2, 18)}`.slice(0, env === 'train' ? 41 : 40),
              lastFour: Math.random().toString(36).slice(2, 6),
              issuedAt: new Date().toLocaleString('ko-KR', { hour12: false }).replace(/\./g, '-').slice(0, 16),
              issuedBy: '김플랫',
              callCount: 0,
              endpoint: `https://api${env === 'train' ? '-train' : ''}.aip.group.local/agents/${agentId}`,
            };
            setKey(newKey);
            setRevealed(true);
          }}
          className="h-8 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-brand-dark"
        >
          ＋ 키 발급
        </button>
      </div>
    );
  }

  const isProduction = env === 'serv';
  const displayKey = revealed
    ? key.fullKey
    : `sk-${env === 'train' ? 'train' : 'live'}-${'•'.repeat(28)}${key.lastFour}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key.fullKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('복사 실패 — 보안 컨텍스트가 필요합니다');
    }
  };

  const handleReissue = () => {
    const envLabel = env === 'train' ? '학습계' : '서빙계';
    const msg =
      `${envLabel} API 키를 재발급합니다.\n\n` +
      `현재 키: ${key.fullKey.slice(0, 12)}…${key.lastFour}\n` +
      `발급일: ${key.issuedAt}\n` +
      `누적 호출: ${key.callCount.toLocaleString()}건\n\n` +
      `재발급 시 기존 키는 즉시 무효화되며, 이 키를 사용하는 모든 클라이언트에 즉시 새 키를 배포해야 합니다.${
        isProduction ? '\n\n⚠ 서빙계 키 재발급은 운영 트래픽에 영향이 갑니다.' : ''
      }\n\n계속하시겠습니까?`;
    if (!window.confirm(msg)) return;
    const newKey: ApiKey = {
      ...key,
      fullKey: `sk-${env === 'train' ? 'train' : 'live'}-${Math.random().toString(36).slice(2, 18)}${Math.random().toString(36).slice(2, 18)}`.slice(0, env === 'train' ? 41 : 40),
      lastFour: Math.random().toString(36).slice(2, 6),
      issuedAt: new Date().toLocaleString('ko-KR', { hour12: false }).replace(/\./g, '-').slice(0, 16),
      issuedBy: '김플랫',
      callCount: 0,
      lastUsedAt: undefined,
    };
    setKey(newKey);
    setRevealed(true);
  };

  return (
    <div
      className={cn(
        'card px-5 py-3.5',
        isProduction ? 'border-bad-border/40' : 'border-info-border/40',
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className={cn(
            'inline-flex items-center justify-center w-9 h-9 rounded-md text-lg flex-shrink-0 border',
            isProduction ? 'bg-bad-bg border-bad-border' : 'bg-info-bg border-info-border',
          )}
        >
          🔑
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-mid uppercase tracking-[0.3px]">
              {env === 'train' ? '학습계' : '서빙계'} API 키
            </span>
            {isProduction && (
              <span className="pill bg-bad-bg text-bad border border-bad-border">운영</span>
            )}
          </div>
          <code className="text-[11px] text-ink-mid font-mono truncate block mt-0.5">
            {key.endpoint}
          </code>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setRevealed((v) => !v)}
            className="h-7 px-2 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface"
            title={revealed ? '키 숨기기' : '키 보기'}
          >
            {revealed ? '🙈 숨기기' : '👁 보기'}
          </button>
          <button
            onClick={handleCopy}
            className={cn(
              'h-7 px-2 bg-white border border-line rounded text-[11px] font-bold hover:bg-surface',
              copied ? 'text-ok border-ok-border bg-ok-bg' : 'text-ink-dark',
            )}
          >
            {copied ? '✓ 복사됨' : '📋 복사'}
          </button>
          <button
            onClick={handleReissue}
            className={cn(
              'h-7 px-2 rounded text-[11px] font-bold border',
              isProduction
                ? 'bg-white border-bad-border text-bad hover:bg-bad-bg'
                : 'bg-white border-line text-ink-dark hover:bg-surface',
            )}
          >
            ↻ 재발급
          </button>
        </div>
      </div>

      <div
        className={cn(
          'font-mono text-[12.5px] py-2 px-3 rounded border tabular-nums tracking-wide break-all',
          revealed
            ? 'bg-surface-soft border-line text-ink-dark'
            : 'bg-surface-soft/60 border-line-soft text-ink-mid',
        )}
      >
        {displayKey}
      </div>

      <div className="flex items-center gap-2 text-[10.5px] text-ink-mid font-semibold mt-2 flex-wrap">
        <span>
          발급 <b className="text-ink-dark">{key.issuedAt}</b> · {key.issuedBy}
        </span>
        <span className="text-line">·</span>
        <span>
          누적 호출 <b className="text-ink-dark tabular-nums">{key.callCount.toLocaleString()}</b>건
        </span>
        {key.lastUsedAt && (
          <>
            <span className="text-line">·</span>
            <span>
              마지막 호출 <b className="text-ink-dark">{key.lastUsedAt}</b>
            </span>
          </>
        )}
        {isProduction && (
          <span className="ml-auto text-warn font-bold">
            ⚠ 재발급 시 기존 키 즉시 무효화 — 클라이언트 동기화 필요
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- PII 필터링 대시보드 (전반적 → 상세) ---------- */

const CATEGORY_COLOR: Record<PiiItem['category'], string> = {
  식별번호: 'bg-bad',
  금융: 'bg-warn',
  연락처: 'bg-info',
  내부코드: 'bg-accent-purple',
  기타: 'bg-line',
};

const CATEGORY_TEXT: Record<PiiItem['category'], string> = {
  식별번호: 'text-bad',
  금융: 'text-warn',
  연락처: 'text-info',
  내부코드: 'text-accent-purple',
  기타: 'text-ink-mid',
};

function PiiFilterDashboard({ agentId }: { agentId: string }) {
  const items = getPiiItems(agentId);
  const events = getPiiEvents(agentId);

  const totalHits = items.reduce((s, i) => s + i.hits7d, 0);
  const activeItems = items.filter((i) => i.active).length;
  const pendingRequests = getPiiChangeRequests(agentId).filter((r) => r.status === 'pending').length;

  const byCategory = (() => {
    const map = new Map<PiiItem['category'], number>();
    items.forEach((i) => {
      map.set(i.category, (map.get(i.category) ?? 0) + i.hits7d);
    });
    return [...map.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  })();

  const topItems = [...items]
    .filter((i) => i.hits7d > 0)
    .sort((a, b) => b.hits7d - a.hits7d)
    .slice(0, 5);

  return (
    <div className="card px-5 py-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold text-ink">PII 필터링 대시보드 (7일)</h2>
        <span className="text-[11px] text-ink-mid">실시간 · 가드레일 정책 v2.1 적용</span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="누적 마스킹"
          value={totalHits.toLocaleString()}
          unit="건"
          sub="지난 7일 누적"
          tone="ok"
        />
        <KpiCard
          label="활성 항목"
          value={activeItems.toString()}
          unit="개"
          sub={`기본 ${items.filter((i) => i.source === 'platform' && i.active).length} · 사용자 ${items.filter((i) => i.source === 'custom' && i.active).length}`}
          tone="ok"
        />
        <KpiCard
          label="Top 카테고리"
          value={byCategory[0]?.[0] ?? '—'}
          sub={byCategory[0] ? `${byCategory[0][1]}건 (${Math.round((byCategory[0][1] / totalHits) * 100)}%)` : '—'}
          tone="warn"
        />
        <KpiCard
          label="결재 대기 변경"
          value={pendingRequests.toString()}
          unit="건"
          sub={pendingRequests > 0 ? '검토 필요' : '없음'}
          tone={pendingRequests > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3.5">
        <div className="p-3.5 rounded border border-line-soft bg-surface-soft/30">
          <div className="text-[11px] text-ink-mid font-bold uppercase tracking-[0.3px] mb-2">
            카테고리별 분포
          </div>
          <div className="flex h-2.5 rounded overflow-hidden mb-2.5 bg-surface-soft">
            {byCategory.map(([cat, n]) => (
              <div
                key={cat}
                className={cn('h-full', CATEGORY_COLOR[cat])}
                style={{ width: `${(n / totalHits) * 100}%` }}
                title={`${cat} ${n}건`}
              />
            ))}
          </div>
          <ul className="space-y-1">
            {byCategory.map(([cat, n]) => (
              <li key={cat} className="flex items-center gap-2 text-[11.5px]">
                <span className={cn('w-2 h-2 rounded-sm', CATEGORY_COLOR[cat])} />
                <span className={cn('font-bold', CATEGORY_TEXT[cat])}>{cat}</span>
                <span className="text-ink-mid ml-auto tabular-nums">
                  <b className="text-ink-dark">{n}</b>건
                  <span className="ml-1">({Math.round((n / totalHits) * 100)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3.5 rounded border border-line-soft bg-surface-soft/30">
          <div className="text-[11px] text-ink-mid font-bold uppercase tracking-[0.3px] mb-2">
            매칭 Top 5 항목
          </div>
          <ul className="space-y-1.5">
            {topItems.map((it) => {
              const pct = topItems[0].hits7d > 0 ? (it.hits7d / topItems[0].hits7d) * 100 : 0;
              return (
                <li key={it.id} className="text-[11.5px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-extrabold text-ink truncate flex-1">{it.name}</span>
                    <span className="text-ink-mid tabular-nums">
                      <b className="text-ink-dark">{it.hits7d}</b>건
                    </span>
                  </div>
                  <div className="h-1 bg-surface-soft rounded overflow-hidden">
                    <div
                      className={cn('h-full', CATEGORY_COLOR[it.category])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[12.5px] font-extrabold text-ink">최근 마스킹 이벤트 (상세)</h3>
          <a className="text-[11px] text-info font-bold hover:underline cursor-pointer">전체 이력 →</a>
        </div>
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-surface-soft text-ink-dark">
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[130px]">시각</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[150px]">항목</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[64px]">위치</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">컨텍스트 (마스킹 후)</th>
              <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[100px]">호출</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-[#F3F9F8]">
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px] tabular-nums">
                  {e.ts}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <div className="text-[11.5px] font-extrabold text-ink truncate">{e.itemName}</div>
                  <code className="text-[10px] text-ink-mid font-mono">{e.itemCode}</code>
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <span
                    className={cn(
                      'pill border text-[10px]',
                      e.direction === 'input'
                        ? 'bg-info-bg text-info border-info-border'
                        : 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
                    )}
                  >
                    {e.direction === 'input' ? '입력' : '출력'}
                  </span>
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft text-ink-dark text-[11.5px] font-mono truncate">
                  {e.contextSnippet}
                </td>
                <td className="py-2 px-2.5 border-b border-line-soft">
                  <code className="text-[10.5px] text-ink-mid font-mono">{e.source}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- PII 마스킹 항목 관리 (기본 + 사용자 + 결재) ---------- */

function PiiItemsManagement({ agentId }: { agentId: string }) {
  const items = getPiiItems(agentId);
  const requests = getPiiChangeRequests(agentId);

  const platformItems = items.filter((i) => i.source === 'platform');
  const customItems = items.filter((i) => i.source === 'custom');
  const pendingChanges = requests.filter((r) => r.status === 'pending');

  const handleAdd = () => {
    window.alert(
      '항목 추가 결재 신청 모달 (목업)\n\n이름·정규식·마스킹 템플릿 입력 후 결재 그룹 지정 → 기안',
    );
  };

  return (
    <div className="card px-5 py-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold text-ink">마스킹 항목 관리</h2>
        <span className="text-[11px] text-ink-mid">
          모든 변경 사항은 <b className="text-warn">결재 승인 후 적용</b>됩니다
        </span>
      </div>

      {pendingChanges.length > 0 && (
        <div className="bg-warn-bg/40 border border-warn-border rounded p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-bold text-warn uppercase tracking-[0.3px]">
              결재 진행 중 변경
            </span>
            <span className="pill bg-warn-bg text-warn border border-warn-border">
              {pendingChanges.length}건
            </span>
          </div>
          <ul className="space-y-1.5">
            {pendingChanges.map((req) => (
              <li
                key={req.id}
                className="grid grid-cols-[100px_70px_1fr_auto_140px] gap-3 items-center py-1.5 px-2.5 bg-white border border-line-soft rounded"
              >
                <code className="font-mono text-[11px] font-extrabold text-ink-dark">{req.id}</code>
                <ActionPill action={req.action} />
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-ink truncate">
                    {req.itemName}
                    {req.pattern && (
                      <code className="ml-2 text-[10.5px] text-ink-mid font-mono">{req.pattern}</code>
                    )}
                  </div>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                    {req.reason}
                  </div>
                </div>
                <span className="text-[10.5px] text-ink-mid">
                  {req.requestedAt} · {req.requestedBy}
                </span>
                <span className="text-[10.5px] text-warn font-semibold text-right">
                  {req.stage ?? '결재 진행 중'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="text-[12.5px] font-extrabold text-ink">플랫폼 제공 기본 항목</h3>
          <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
            🔒 잠금 · 활성 토글만 결재로 가능
          </span>
          <span className="text-[10.5px] text-ink-mid ml-auto">{platformItems.length}종</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {platformItems.map((it) => (
            <PiiItemCard key={it.id} item={it} />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="text-[12.5px] font-extrabold text-ink">사용자 추가 항목</h3>
          <span className="text-[10.5px] text-ink-mid">
            정규표현식 기반 — 추가·수정·삭제 모두 결재 필요
          </span>
          <button
            onClick={handleAdd}
            className="ml-auto h-7 px-2.5 bg-brand border border-brand-dark rounded text-[11px] font-extrabold text-ink hover:bg-brand-dark"
          >
            ＋ 항목 추가 (결재)
          </button>
        </div>
        {customItems.length === 0 ? (
          <Empty label="사용자 추가 항목이 없습니다 — 위 + 버튼으로 결재 신청하세요" />
        ) : (
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">이름</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">정규식</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[140px]">마스킹</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[80px]">7일 매칭</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[80px]">상태</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft w-[180px]">액션 (결재)</th>
              </tr>
            </thead>
            <tbody>
              {customItems.map((it) => (
                <tr key={it.id} className="hover:bg-[#F3F9F8]">
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <div className="text-[12.5px] font-extrabold text-ink">{it.name}</div>
                    <code className="text-[10px] text-ink-mid font-mono">{it.code}</code>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <code className="text-[11px] text-ink-dark font-mono bg-surface-soft border border-line-soft rounded px-1.5 py-0.5">
                      {it.pattern}
                    </code>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <code className="text-[11px] text-ink-mid font-mono">{it.maskTemplate}</code>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums">
                    <b className="text-ink-dark">{it.hits7d}</b>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    {it.active ? (
                      <span className="pill bg-ok-bg text-ok border border-ok-border">활성</span>
                    ) : (
                      <span className="pill bg-surface-soft text-ink-mid border border-line-soft">비활성</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() =>
                          window.alert(`${it.name} ${it.active ? '비활성화' : '활성화'} 결재 신청 (목업)`)
                        }
                        className="h-6 px-2 text-[10.5px] font-bold text-info hover:underline"
                      >
                        {it.active ? '비활성' : '활성'}
                      </button>
                      <button
                        onClick={() => window.alert(`${it.name} 정규식 수정 결재 신청 (목업)`)}
                        className="h-6 px-2 text-[10.5px] font-bold text-info hover:underline"
                      >
                        ✎ 수정
                      </button>
                      <button
                        onClick={() => window.alert(`${it.name} 삭제 결재 신청 (목업)`)}
                        className="h-6 px-2 text-[10.5px] font-bold text-bad hover:underline"
                      >
                        ✕ 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PiiItemCard({ item }: { item: PiiItem }) {
  return (
    <div
      className={cn(
        'p-2.5 rounded border bg-white',
        item.active ? 'border-line-soft' : 'border-line-soft bg-surface-soft/50 opacity-75',
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[12px] font-extrabold text-ink truncate flex-1">{item.name}</span>
        {item.locked && <span className="text-[10px] text-ink-mid" title="잠금 — 정규식 수정 불가">🔒</span>}
      </div>
      <code className="text-[9.5px] text-ink-mid font-mono block truncate">{item.code}</code>
      <div className="flex items-center justify-between mt-1.5 text-[10.5px]">
        <span className="text-ink-mid">
          <b className="text-ink-dark">{item.hits7d}</b>건 (7일)
        </span>
        {item.active ? (
          <span className="text-ok font-bold">●</span>
        ) : (
          <span className="text-ink-light">○</span>
        )}
      </div>
    </div>
  );
}

function ActionPill({ action }: { action: PiiChangeAction }) {
  const cfg: Record<PiiChangeAction, { label: string; cls: string }> = {
    add: { label: '추가', cls: 'bg-ok-bg text-ok border-ok-border' },
    modify: { label: '수정', cls: 'bg-info-bg text-info border-info-border' },
    remove: { label: '삭제', cls: 'bg-bad-bg text-bad border-bad-border' },
    toggle: { label: '활성 변경', cls: 'bg-warn-bg text-warn border-warn-border' },
  };
  const c = cfg[action];
  return <span className={cn('pill border', c.cls)}>{c.label}</span>;
}

// PiiChangeStatus 타입은 mock 데이터 호환을 위해 import 유지
type _UnusedPiiChangeStatus = PiiChangeStatus;

/* ---------- 부하 테스트 패널 ---------- */

const CONCURRENT_OPTIONS = [50, 100, 200, 500] as const;
const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: '5분' },
  { value: 15, label: '15분' },
  { value: 60, label: '1시간' },
];
const RAMP_OPTIONS: { value: number; label: string }[] = [
  { value: 0.5, label: '30초' },
  { value: 1, label: '1분' },
  { value: 5, label: '5분' },
];

function LoadTestPanel({
  agentId,
  defaultTarget,
  candidates,
  currentTagName,
}: {
  agentId: string;
  defaultTarget: string;
  candidates: string[];
  currentTagName: string;
}) {
  const runs = getLoadTestRuns(agentId);
  // 후보 + 현재 배포를 합쳐 unique 옵션으로
  const targetOptions = Array.from(new Set([currentTagName, ...candidates]));

  const [target, setTarget] = useState(defaultTarget);
  const [concurrent, setConcurrent] = useState<number>(100);
  const [duration, setDuration] = useState<number>(15);
  const [ramp, setRamp] = useState<number>(1);
  const [scenario, setScenario] = useState<LoadTestScenario>('eval-dataset');

  const handleStart = () => {
    const msg =
      `부하 테스트를 시작합니다.\n\n` +
      `대상: ${target}\n` +
      `동시 사용자: ${concurrent}명 · 램프업: ${RAMP_OPTIONS.find((r) => r.value === ramp)?.label} · 지속: ${duration}분\n` +
      `시나리오: ${SCENARIO_LABEL[scenario]}\n\n` +
      `테스트는 서빙계 환경에서 실행되며, 서비스 트래픽에 영향이 갈 수 있습니다. 계속하시겠습니까?`;
    if (window.confirm(msg)) {
      window.alert(`부하 테스트 실행 (목업)`);
    }
  };

  return (
    <div className="card px-5 py-4 space-y-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold text-ink">부하 테스트</h2>
        <span className="text-[11px] text-ink-mid">
          업로드된 버전의 최종 QA — 실제 트래픽 부하로 안정성·응답 시간 검증
        </span>
      </div>

      {/* 설정 */}
      <div className="grid grid-cols-[140px_1fr] gap-3 items-center text-[11.5px]">
        <span className="text-ink-mid font-bold">대상 버전</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-8 px-2 border border-line rounded text-[12px] bg-white max-w-[260px] font-mono"
        >
          {targetOptions.map((t) => (
            <option key={t} value={t}>
              {t}
              {t === currentTagName ? ' (서빙계 현재)' : ''}
            </option>
          ))}
        </select>

        <span className="text-ink-mid font-bold">동시 사용자</span>
        <div className="flex gap-1.5">
          {CONCURRENT_OPTIONS.map((n) => (
            <ChipButton
              key={n}
              active={concurrent === n}
              onClick={() => setConcurrent(n)}
            >
              {n}
            </ChipButton>
          ))}
        </div>

        <span className="text-ink-mid font-bold">램프업</span>
        <div className="flex gap-1.5">
          {RAMP_OPTIONS.map((r) => (
            <ChipButton key={r.value} active={ramp === r.value} onClick={() => setRamp(r.value)}>
              {r.label}
            </ChipButton>
          ))}
        </div>

        <span className="text-ink-mid font-bold">지속 시간</span>
        <div className="flex gap-1.5">
          {DURATION_OPTIONS.map((d) => (
            <ChipButton
              key={d.value}
              active={duration === d.value}
              onClick={() => setDuration(d.value)}
            >
              {d.label}
            </ChipButton>
          ))}
        </div>

        <span className="text-ink-mid font-bold">요청 시나리오</span>
        <div className="flex gap-1.5">
          {(['eval-dataset', 'prod-sample', 'custom'] as LoadTestScenario[]).map((s) => (
            <ChipButton key={s} active={scenario === s} onClick={() => setScenario(s)}>
              {SCENARIO_LABEL[s]}
            </ChipButton>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-line-soft">
        <Button variant="primary" onClick={handleStart}>
          ▶ 부하 테스트 시작
        </Button>
        <span className="text-[11px] text-warn font-semibold">
          ⚠ 서빙계 인프라를 사용하므로 운영 트래픽에 영향이 갈 수 있습니다
        </span>
      </div>

      {/* 최근 결과 */}
      <div className="pt-3 border-t border-line-soft">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[12.5px] font-extrabold text-ink">최근 결과</h3>
          <span className="text-[11px] text-ink-mid">최근 {runs.length}건</span>
        </div>
        {runs.length === 0 ? (
          <Empty label="아직 부하 테스트 이력이 없습니다" />
        ) : (
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-surface-soft text-ink-dark">
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">버전</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">실행 시각</th>
                <th className="text-left py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">조건</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">RPS</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">P50</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">P95</th>
                <th className="text-right py-2 px-2.5 font-extrabold text-[11px] border-b border-line-soft">P99</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-[#F3F9F8]">
                  <td className="py-2 px-2.5 border-b border-line-soft">
                    <code className="font-mono text-ink-dark font-bold text-[11.5px]">{r.version}</code>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-ink-mid text-[11px] tabular-nums">
                    {r.ranAt}
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-[11px] text-ink-dark">
                    {r.concurrentUsers}명 · {r.durationMin}분
                    <span className="text-ink-mid ml-1.5">· {SCENARIO_LABEL[r.scenario]}</span>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums">
                    <b className="text-ink-dark">{r.rps.toFixed(1)}</b>
                    <span className="text-ink-mid text-[10.5px] ml-0.5">/s</span>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums text-ink-dark">
                    {r.p50Ms.toLocaleString()}ms
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums">
                    <span className={cn('font-bold', r.p95Ms > 3000 ? 'text-bad' : 'text-ink-dark')}>
                      {r.p95Ms.toLocaleString()}ms
                    </span>
                  </td>
                  <td className="py-2 px-2.5 border-b border-line-soft text-right tabular-nums text-ink-mid">
                    {r.p99Ms.toLocaleString()}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ChipButton({
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

// 사용하지 않는 import 호환 (mock 데이터 필드 유지용)
type _UnusedLoadTestRun = LoadTestRun;
type _UnusedLoadTestStatus = LoadTestStatus;


