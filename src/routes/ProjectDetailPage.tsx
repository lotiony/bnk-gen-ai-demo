import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { pbAgentProject } from '@/data/mockProjects';
import Crumb from '@/components/ui/Crumb';
import StatusPill from '@/components/ui/StatusPill';
import MetaTag from '@/components/ui/MetaTag';
import Button from '@/components/ui/Button';
import TabNav, { TabId } from '@/components/projectDetail/TabNav';
import OverviewTab from '@/components/projectDetail/OverviewTab';
import TasksTab from '@/components/projectDetail/TasksTab';
import ApprovalsTab from '@/components/projectDetail/ApprovalsTab';
import TrafficTab from '@/components/projectDetail/TrafficTab';
import ConversationsTab from '@/components/projectDetail/ConversationsTab';
import MembersTab from '@/components/projectDetail/MembersTab';
import { useCurrentPersona } from '@/lib/persona';
import { canViewProject } from '@/lib/personaView';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'tasks', label: '과제' },
  { id: 'approvals', label: '결재' },
  { id: 'traffic', label: '모니터링' },
  { id: 'conversations', label: '대화 분석' },
  { id: 'members', label: '멤버' },
];

export default function ProjectDetailPage() {
  // 현재는 단일 mock 프로젝트만 지원. 추후 projectId로 분기.
  const { projectId } = useParams();
  const project = pbAgentProject; // TODO: lookupProject(projectId)
  const persona = useCurrentPersona();

  const [tab, setTab] = useState<TabId>('overview');

  const totalMembers = project.members.reduce((s, g) => s + g.members.length, 0);
  const approvalGroupCount =
    project.members.find((g) => g.title === '프로젝트 오너 그룹')?.members.length ?? 0;

  // 프로젝트는 참여자만 열람 가능. 목록에서 걸러진 건 URL로도 못 들어온다.
  if (persona && !canViewProject(persona, projectId ?? project.id)) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        <Crumb items={[{ label: '프로젝트', to: '/projects' }, { label: '열람 권한 없음' }]} />
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">🔒</div>
          <h1 className="text-lg font-extrabold text-ink mb-1.5">
            열람 권한이 없는 프로젝트입니다
          </h1>
          <p className="text-xs text-ink-mid font-semibold">
            프로젝트 참여자만 접근할 수 있습니다.
          </p>
          <Link
            to="/projects"
            className="inline-block mt-4 text-[12px] font-bold text-info hover:underline"
          >
            프로젝트 목록으로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 pt-[18px] pb-[60px]">
      {/* Breadcrumb */}
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: project.name },
        ]}
        trailing={projectId ?? project.id}
      />

      {/* Page header */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-start gap-3.5 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-ink-mid font-bold tracking-[0.3px] mb-1">
              <span className="inline-block w-2 h-2 bg-ok rounded-full mr-1.5 align-middle" />
              {project.id} · 최근 활동 {project.recentActivity}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
              <StatusPill tone="ok">● {project.status}</StatusPill>
              <span className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
                {project.name}
              </span>
              <MetaTag tone="target">{project.target}</MetaTag>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button>📎 첨부 보기</Button>
            <Button>✎ 정보 수정</Button>
            <Link to="/approvals">
              <Button variant="primary">＋ 결재 기안</Button>
            </Link>
            <Button variant="ghost" title="더보기">
              ⋯
            </Button>
          </div>
        </div>

        {/* 메타 — 카드 전체 폭을 써서 한 줄 유지 */}
        <div className="flex items-center gap-3.5 mt-2.5 text-[11.5px] text-ink-mid font-semibold whitespace-nowrap overflow-x-auto">
          <span>
            소속 <b className="text-ink-dark">{project.dept}</b>
          </span>
          <span className="text-line">|</span>
          <span>
            프로젝트 오너 <b className="text-ink-dark">{project.pmName}</b>
          </span>
          <span className="text-line">|</span>
          <span>
            기간{' '}
            <b className="text-ink-dark">
              {project.startDate} ~ {project.endDate}
            </b>
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <TabNav
        tabs={TABS}
        active={tab}
        onChange={setTab}
        right={
          <>
            <span>
              진행 중 과제 <span className="pill bg-surface border border-line-soft text-info">3</span>
            </span>
            <span>
              결재 대기 <span className="pill bg-surface border border-line-soft text-ink-dark">2건</span>
            </span>
          </>
        }
      />

      {/* Active panel */}
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks' && <TasksTab />}
      {tab === 'approvals' && (
        <ApprovalsTab projectId={projectId ?? project.id} projectName={project.name} />
      )}
      {tab === 'traffic' && <TrafficTab projectId={projectId ?? project.id} />}
      {tab === 'conversations' && <ConversationsTab />}
      {tab === 'members' && (
        <MembersTab
          groups={project.members}
          totalCount={totalMembers}
          approvalGroupCount={approvalGroupCount}
        />
      )}
    </div>
  );
}
