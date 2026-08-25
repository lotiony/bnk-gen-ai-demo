import { Link } from 'react-router-dom';
import StatusPill from '@/components/ui/StatusPill';
import MetaTag from '@/components/ui/MetaTag';
import { useCurrentPersona } from '@/lib/persona';
import { getVisibleProjects } from '@/lib/personaView';

export default function ProjectsListPage() {
  const persona = useCurrentPersona();
  const projectsList = getVisibleProjects(persona);

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6">
      {/* Page header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
            프로젝트 목록
          </span>
          <span className="text-sm text-ink-mid font-semibold">{projectsList.length}건</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-[640px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="프로젝트명"
                className="w-full py-2 pl-8 pr-3 border border-line rounded text-[12.5px] bg-white focus:outline-none focus:border-brand-dark"
              />
            </div>
            <Link
              to="/projects/new"
              className="py-2 px-[18px] bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark inline-flex items-center gap-1.5"
            >
              + 새 프로젝트 등록
            </Link>
          </div>
        </div>
      </div>

      {projectsList.length === 0 && (
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">📁</div>
          <h2 className="text-base font-extrabold text-ink mb-1.5">참여 중인 프로젝트가 없습니다</h2>
          <p className="text-xs text-ink-mid font-semibold">
            프로젝트는 개발자 그룹의 작업 공간입니다.
            {persona?.group === '관리자' && ' 전사 프로젝트 현황은 관리 콘솔에서 확인하세요.'}
          </p>
          {persona?.group === '관리자' && (
            <Link
              to="/admin"
              className="inline-block mt-4 text-[12px] font-bold text-info hover:underline"
            >
              관리 콘솔로 →
            </Link>
          )}
        </div>
      )}

      {/* Project rows */}
      <div className="flex flex-col gap-2.5">
        {projectsList.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="grid grid-cols-[4px_1fr_auto] bg-white border border-line-soft rounded overflow-hidden hover:border-brand-dark hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors text-ink-dark"
          >
            <div className="bg-ok self-stretch" />
            <div className="px-5 py-4 flex flex-col gap-2.5 min-w-0">
              {/* row head */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusPill tone="ok">● {p.status}</StatusPill>
                <span className="text-base font-extrabold text-ink tracking-[-0.2px]">
                  {p.name}
                </span>
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <MetaTag tone={p.target === '대고객' ? 'target' : 'default'}>
                    {p.target}
                  </MetaTag>
                </div>
              </div>
              {/* row sub */}
              <div className="text-[11.5px] text-ink-mid font-semibold">
                {p.dept} · PM <b className="text-ink-dark font-bold">{p.pmName}</b> · 시작{' '}
                <b className="text-ink-dark font-bold">{p.startMonth}</b> · 최근 활동{' '}
                {p.lastActivity}
              </div>
              {/* stats */}
              <div className="flex items-center gap-3.5 flex-wrap bg-surface-soft rounded p-2.5 px-3.5">
                <Stat label="호출/월" value={p.callsMonthly} />
                <span className="stat-divider" />
                <Stat label="비용/월" value={p.costMonthly} />
                <span className="stat-divider" />
                <Stat label="과제" value={`${p.taskCount}건`} />
                <span className="stat-divider" />
                <Stat label="참여" value={`${p.memberCount}명`} />
                <span className="stat-divider" />
                <TaskMini ico="📁" label="지식 데이터" num={p.counts.knowledge} />
                <TaskMini ico="🔗" label="파이프라인" num={p.counts.pipeline} />
                <TaskMini ico="🤖" label="에이전트" num={p.counts.agent} />
                <TaskMini ico="🛠" label="개발환경" num={p.counts.env} />
              </div>
            </div>
            <div className="flex items-center px-5 bg-surface-soft text-[12.5px] font-extrabold text-ink-mid whitespace-nowrap group-hover:bg-brand-tint group-hover:text-ink">
              프로젝트 열기 →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-ink-mid font-bold tracking-[0.3px] mb-0.5">{label}</span>
      <span className="text-sm font-extrabold text-ink tracking-[-0.2px]">{value}</span>
    </div>
  );
}

function TaskMini({ ico, label, num }: { ico: string; label: string; num: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-dark py-1 px-2.5 rounded-full bg-white border border-line-soft">
      <span className="text-xs">{ico}</span>
      {label} <span className="font-extrabold text-ink">{num}</span>
    </span>
  );
}
