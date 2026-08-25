import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MOCK_KNOWLEDGE_TASKS, type KnowledgeTask } from '@/data/mockKnowledgeTasks';
import { MOCK_AGENT_TASKS, BUILDER_LABEL, type AgentTask } from '@/data/mockAgentTasks';
import { MOCK_PIPELINE_TASKS, type PipelineTask } from '@/data/mockPipelineTasks';
import { CUSTOM_COMPONENTS, COMP_KIND_TONE, type CustomComponent } from '@/data/mockComponents';
import { MOCK_DEVENV_TASKS, type DevenvTask } from '@/data/mockDevenvTasks';
import {
  MOCK_MODEL_TASKS,
  MODEL_TASK_STATE_TONE,
  type ModelTask,
} from '@/data/mockModelTasks';
import { ToolModal, VSCodeMock, JenkinsMock, ArgocdMock } from '@/components/devenv/ToolMocks';

export type CategoryId =
  | 'knowledge'
  | 'database'
  | 'component'
  | 'tool'
  | 'agent'
  | 'storage'
  | 'develop';

type Category = {
  id: CategoryId;
  icon: string;
  /** 좌측 네비 라벨. */
  title: string;
  /** 우측 헤더 부제. */
  desc: string;
};

const CATEGORIES: Category[] = [
  { id: 'knowledge', icon: '📁', title: 'Knowledge', desc: '문서·지식 데이터' },
  { id: 'database', icon: '🗄', title: 'Database', desc: 'DB 커넥터·테이블' },
  { id: 'component', icon: '🔗', title: 'Component', desc: '커스텀 파서 · 청커 · 파이프라인' },
  { id: 'tool', icon: '🧰', title: 'Tool', desc: '모델·API 커넥터' },
  { id: 'agent', icon: '🤖', title: 'Agent', desc: '에이전트 빌드·배포' },
  { id: 'storage', icon: '💾', title: 'Storage', desc: '오브젝트·파일 저장소' },
  { id: 'develop', icon: '🛠', title: 'Develop', desc: '개발환경·CI/CD' },
];

const ICON_TONE: Record<CategoryId, string> = {
  knowledge: 'bg-info-bg text-info',
  database: 'bg-accent-purple-bg text-accent-purple',
  component: 'bg-accent-brown-bg text-accent-brown',
  tool: 'bg-warn-bg text-warn',
  agent: 'bg-kb-yellow-tint text-ink',
  storage: 'bg-surface-soft text-ink-mid',
  develop: 'bg-ok-bg text-ok',
};

/** 과제 탭 — 4개 카테고리 그룹. */
/** 카테고리별 과제 수 — 좌측 네비 뱃지와 우측 헤더가 같은 값을 쓴다. */
function countOf(id: CategoryId): number {
  switch (id) {
    case 'knowledge':
      return MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === '지식 데이터').length;
    case 'database':
      return MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === 'DB 커넥터').length;
    case 'component':
      return CUSTOM_COMPONENTS.length;
    case 'tool':
      return (
        MOCK_MODEL_TASKS.length +
        MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === 'API 커넥터').length
      );
    case 'agent':
      return MOCK_AGENT_TASKS.length;
    case 'storage':
      return 0;
    case 'develop':
      return MOCK_DEVENV_TASKS.length;
  }
}

export default function TasksTab() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const [openDevenv, setOpenDevenv] = useState<DevenvTask | null>(null);
  const [active, setActive] = useState<CategoryId>('knowledge');

  const cat = CATEGORIES.find((c) => c.id === active)!;
  const count = countOf(active);

  const ADD_LINK: Partial<Record<CategoryId, string>> = {
    knowledge: `/projects/${pid}/tasks/knowledge/create`,
    database: `/projects/${pid}/tasks/database/new`,
    component: `/projects/${pid}/tasks/pipeline/new`,
    tool: `/projects/${pid}/tasks/model/new`,
    agent: `/projects/${pid}/tasks/agent/new`,
  };
  const addLink = ADD_LINK[active];
  const AddBtn = (
    <button className="text-[11.5px] font-bold text-info py-1.5 px-2.5 rounded border border-line-soft bg-white hover:bg-info-bg hover:border-info-border">
      ＋ 과제 추가
    </button>
  );

  return (
    <div className="grid grid-cols-[196px_1fr] gap-3.5 items-start mb-3.5">
      {/* 좌측 — 카테고리 네비 */}
      <nav className="card p-2 sticky top-[150px]">
        <div className="text-[11px] font-extrabold text-ink-mid tracking-[0.3px] px-2 pt-1 pb-2">
          과제 카테고리
        </div>
        {CATEGORIES.map((c) => {
          const n = countOf(c.id);
          const on = c.id === active;
          return (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                'w-full flex items-center gap-2 py-2 px-2 rounded text-left mb-0.5 last:mb-0 transition-colors',
                on ? 'bg-kb-yellow-tint' : 'hover:bg-surface-soft',
              )}
            >
              <span
                className={cn(
                  'w-[22px] h-[22px] rounded inline-flex items-center justify-center text-[12px] flex-shrink-0',
                  ICON_TONE[c.id],
                )}
              >
                {c.icon}
              </span>
              <span
                className={cn(
                  'text-[12.5px] tracking-tight flex-1 min-w-0 truncate',
                  on ? 'font-extrabold text-ink' : 'font-bold text-ink-dark',
                )}
              >
                {c.title}
              </span>
              <span
                className={cn(
                  'text-[10.5px] font-extrabold min-w-[18px] text-center py-0.5 px-1.5 rounded-lg border',
                  n === 0
                    ? 'text-ink-light bg-surface-soft border-line-soft'
                    : 'text-ink-dark bg-white border-line-soft',
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 우측 — 선택된 카테고리의 과제 목록 */}
      <section className="card px-5 py-4 min-h-[320px]">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className={cn(
              'w-[26px] h-[26px] rounded inline-flex items-center justify-center text-sm flex-shrink-0',
              ICON_TONE[cat.id],
            )}
          >
            {cat.icon}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-ink tracking-tight leading-tight">
              {cat.title}
              <span className="ml-1.5 text-[11px] text-ink-mid font-bold">{count}건</span>
            </div>
            <div className="text-[10.5px] text-ink-mid font-semibold">{cat.desc}</div>
          </div>
          <div className="ml-auto">{addLink ? <Link to={addLink}>{AddBtn}</Link> : AddBtn}</div>
        </div>

        {count === 0 ? (
          <div className="py-14 text-center bg-surface-soft border border-dashed border-line-soft rounded">
            <div className="text-[26px] mb-1.5">{cat.icon}</div>
            <p className="text-xs text-ink-light font-semibold">
              아직 등록된 {cat.title} 과제가 없습니다
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {active === 'knowledge' &&
              MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === '지식 데이터').map((t) => (
                <KnowledgeTaskCard key={t.id} task={t} projectId={pid} />
              ))}
            {active === 'database' &&
              MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === 'DB 커넥터').map((t) => (
                <DatabaseTaskCard key={t.id} task={t} projectId={pid} />
              ))}
            {active === 'tool' && (
              <>
                {MOCK_MODEL_TASKS.map((t) => (
                  <ModelTaskCard key={t.id} task={t} projectId={pid} />
                ))}
                {MOCK_KNOWLEDGE_TASKS.filter((t) => t.assetKind === 'API 커넥터').map((t) => (
                  <KnowledgeTaskCard key={t.id} task={t} projectId={pid} />
                ))}
              </>
            )}
            {active === 'component' &&
              CUSTOM_COMPONENTS.map((c) => <ComponentCard key={c.id} comp={c} projectId={pid} />)}
            {active === 'agent' &&
              MOCK_AGENT_TASKS.map((t) => (
                <AgentTaskCard key={t.id} task={t} projectId={pid} />
              ))}
            {active === 'develop' &&
              MOCK_DEVENV_TASKS.map((t) => (
                <DevenvTaskCard key={t.id} task={t} onOpen={() => setOpenDevenv(t)} />
              ))}
          </div>
        )}
      </section>

      {openDevenv && (
        <ToolModal onClose={() => setOpenDevenv(null)}>
          {openDevenv.kind === 'coder' && <VSCodeMock />}
          {openDevenv.kind === 'jenkins' && <JenkinsMock />}
          {openDevenv.kind === 'argocd' && <ArgocdMock />}
        </ToolModal>
      )}
    </div>
  );
}

function AgentTaskCard({ task, projectId }: { task: AgentTask; projectId: string }) {
  return (
    <Link
      to={`/projects/${projectId}/tasks/agent/${task.id}`}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-info hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-info">{BUILDER_LABEL[task.builder]}</span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{task.name}</div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="pill bg-info-bg text-info border border-info-border">{task.state}</span>
      </div>
    </Link>
  );
}

function ComponentCard({ comp, projectId }: { comp: CustomComponent; projectId: string }) {
  return (
    <Link
      to={`/projects/${projectId}/tasks/component/${comp.id}`}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-accent-purple hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{comp.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className={cn('text-[10px] font-bold', COMP_KIND_TONE[comp.kind])}>{comp.kind}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-ink-mid">{comp.lang}</span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{comp.name}</div>
        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">{comp.desc}</div>
      </div>
    </Link>
  );
}

function PipelineTaskCard({ task, projectId }: { task: PipelineTask; projectId: string }) {
  const to = `/projects/${projectId}/tasks/pipeline/${task.id}`;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-accent-purple hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-accent-purple">{task.retrieval}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-ink-mid">
            인덱스 {task.indexes.length} · 소비 {task.consumers.length}
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{task.name}</div>
      </div>

    </Link>
  );
}

function DevenvTaskCard({ task, onOpen }: { task: DevenvTask; onOpen: () => void }) {
  const kindStyle = {
    coder: { icon: '💻', tone: 'text-info', label: 'Coder' },
    jenkins: { icon: '⚙️', tone: 'text-accent-purple', label: 'Jenkins' },
    argocd: { icon: '🚀', tone: 'text-ok', label: 'ArgoCD' },
  }[task.kind];
  const stateTone =
    task.state === '실행 중'
      ? 'bg-ok-bg text-ok border-ok-border'
      : task.state === '오류'
      ? 'bg-bad-bg text-bad border-bad-border'
      : task.state === '동기화 대기'
      ? 'bg-warn-bg text-warn border-warn-border'
      : 'bg-surface-soft text-ink-mid border-line-soft';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-ok hover:shadow-sm transition-all w-full text-left"
    >
      <span className="w-9 h-9 rounded-md bg-surface-soft border border-line-soft inline-flex items-center justify-center text-lg flex-shrink-0">
        {kindStyle.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className={cn('text-[10px] font-bold', kindStyle.tone)}>{kindStyle.label}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-ink-mid">
            {task.scope === 'user' ? '개인' : '프로젝트'}
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{task.name}</div>
        <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">{task.meta}</div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {task.kind === 'coder' && (
          <span className={cn('pill border font-extrabold', stateTone)}>{task.state}</span>
        )}
      </div>
    </button>
  );
}

function DatabaseTaskCard({ task, projectId }: { task: KnowledgeTask; projectId: string }) {
  return (
    <Link
      to={`/projects/${projectId}/tasks/database/new`}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-accent-purple hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-accent-purple">{task.assetKind}</span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{task.name}</div>
      </div>
    </Link>
  );
}

function KnowledgeTaskCard({ task, projectId }: { task: KnowledgeTask; projectId: string }) {
  const to = `/projects/${projectId}/tasks/knowledge/new?task=${task.id}`;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-info hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[10px] font-bold text-info">{task.assetKind}</span>
        </div>
        <div className="text-[13px] font-extrabold text-ink tracking-tight truncate">{task.name}</div>
      </div>

    </Link>
  );
}

function ModelTaskCard({ task, projectId }: { task: ModelTask; projectId: string }) {
  const tone = MODEL_TASK_STATE_TONE[task.state];
  const hostShort =
    task.modelHost.startsWith('on-prem') ? 'on-prem' :
    task.modelHost.startsWith('CSP') ? task.modelHost.replace('CSP · ', '') : task.modelHost;
  const costLabel =
    task.estimatedMonthCost >= 100_000_000
      ? `₩${(task.estimatedMonthCost / 100_000_000).toFixed(2)}억`
      : `₩${(task.estimatedMonthCost / 1_000_000).toFixed(0)}M`;

  return (
    <Link
      to={`/projects/${projectId}/tasks/model/${task.id}`}
      className="flex items-center gap-3 bg-white border border-line-soft rounded p-3 hover:border-accent-brown hover:shadow-sm transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className="text-[10px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
          <span className="text-ink-light text-[10px]">·</span>
          <span className="text-[12.5px] font-extrabold text-ink font-mono tracking-tight">
            {task.modelName}
          </span>
          {task.innovDesignationRequired && (
            <span className="pill bg-warn-bg text-warn border border-warn-border text-[9.5px]">
              혁신금융 지정
            </span>
          )}
        </div>
        <div className="text-[10.5px] text-ink-mid font-semibold">
          {hostShort} · {task.env} ·{' '}
          <b className="text-ink-dark">{costLabel}</b>/월
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={cn('pill border font-extrabold inline-flex items-center gap-1', tone.cls)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', tone.dot)} />
          {task.state}
        </span>
      </div>
    </Link>
  );
}
