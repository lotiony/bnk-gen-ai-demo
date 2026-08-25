import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { findDevenvTask, DEVENV_LABEL, type DevenvTask } from '@/data/mockDevenvTasks';
import { ToolModal, VSCodeMock, JenkinsMock, ArgocdMock } from '@/components/devenv/ToolMocks';

const STATE_TONE: Record<string, string> = {
  '실행 중': 'bg-ok-bg text-ok border-ok-border',
  정지: 'bg-surface-soft text-ink-mid border-line-soft',
  오류: 'bg-bad-bg text-bad border-bad-border',
  '동기화 대기': 'bg-warn-bg text-warn border-warn-border',
};

const KIND_ICON: Record<DevenvTask['kind'], string> = {
  coder: '💻',
  jenkins: '⚙️',
  argocd: '🚀',
};

/** 개발환경 과제 상세 — Coder / Jenkins / ArgoCD 도구별 다른 본문. */
export default function DevenvTaskDetailPage() {
  const { projectId, taskId } = useParams();
  const pid = projectId ?? 'PRJ-101';
  const task = taskId ? findDevenvTask(taskId) : undefined;
  const [modalOpen, setModalOpen] = useState(false);

  if (!task) {
    return <Navigate to={`/projects/${pid}`} replace />;
  }

  const stateTone = STATE_TONE[task.state] ?? STATE_TONE['정지'];
  const isCoderRunning = task.kind === 'coder' && task.state === '실행 중';
  const open = () => setModalOpen(true);

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
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="w-12 h-12 rounded-md bg-surface-soft border border-line-soft inline-flex items-center justify-center text-[26px] flex-shrink-0">
              {KIND_ICON[task.kind]}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-bold text-ink-mid tracking-[0.3px]">{task.id}</span>
                <span className="text-ink-light text-[10px]">·</span>
                <span className="text-[11px] font-bold text-info">{DEVENV_LABEL[task.kind]}</span>
                <span className="text-ink-light text-[10px]">·</span>
                <span className="text-[11px] text-ink-mid">최근 활동 {task.lastActivity}</span>
                <span className={cn('pill border ml-1.5', stateTone)}>
                  <span className="mr-1">●</span>
                  {task.state}
                </span>
              </div>
              <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.4px] truncate">
                {task.name}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11.5px] text-ink-mid">
                <span className="pill bg-brand-tint text-ink border border-brand-dark">
                  {task.scope === 'user' ? '개인 워크스페이스' : '프로젝트 도구'}
                </span>
                <span className="text-ink-light">|</span>
                <span>
                  담당 <b className="text-ink-dark">{task.ownerName}</b>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.kind === 'coder' && (
              <Button variant="primary" onClick={isCoderRunning ? open : undefined}>
                ▶ 워크스페이스 열기
              </Button>
            )}
            {task.kind === 'jenkins' && (
              <Button variant="primary" onClick={open}>
                ▶ Jenkins 콘솔
              </Button>
            )}
            {task.kind === 'argocd' && (
              <Button variant="primary" onClick={open}>
                ▶ ArgoCD UI
              </Button>
            )}
            <Button>📎 로그</Button>
          </div>
        </div>
      </div>

      {task.kind === 'coder' && <CoderBody task={task} onOpenIde={open} />}
      {task.kind === 'jenkins' && <JenkinsBody task={task} onOpenConsole={open} />}
      {task.kind === 'argocd' && <ArgocdBody task={task} onOpenUi={open} />}

      <div className="mt-3.5">
        <Link to={`/projects/${pid}`}>
          <Button>← 프로젝트로</Button>
        </Link>
      </div>

      {modalOpen && (
        <ToolModal onClose={() => setModalOpen(false)}>
          {task.kind === 'coder' && <VSCodeMock />}
          {task.kind === 'jenkins' && <JenkinsMock />}
          {task.kind === 'argocd' && <ArgocdMock />}
        </ToolModal>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Coder — 개인 IDE 워크스페이스
 * ────────────────────────────────────────────────────────────── */

function CoderBody({ task, onOpenIde }: { task: DevenvTask; onOpenIde: () => void }) {
  const isRunning = task.state === '실행 중';

  if (!isRunning) {
    return (
      <section className="card px-6 py-16 text-center">
        <div className="text-[36px] mb-3">⏸</div>
        <div className="text-[15px] font-extrabold text-ink mb-1.5">워크스페이스가 정지 상태입니다</div>
        <div className="text-[12px] text-ink-mid mb-5">
          마지막 활동 {task.lastActivity} · idle 30분 후 자동 정지됨
        </div>
        <button className="inline-flex items-center gap-2 h-10 px-5 rounded bg-brand text-ink font-extrabold text-[13px] border border-brand-dark hover:bg-brand-dark">
          ▶ 워크스페이스 시작
        </button>
      </section>
    );
  }

  // 실행 중: 바로가기 카드만 표시 (VSCode UI는 버튼 클릭 시 모달로)
  return (
    <section className="card px-5 py-4 flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] text-ink-mid font-bold">바로가기</span>
      <CoderLinkBtn icon="🪟" label="VS Code (web)" onClick={onOpenIde} primary />
      <CoderLinkBtn
        icon="📓"
        label="Jupyter"
        href="https://ide.aip.group.local/@박서연/workspace/apps/jupyter/"
      />
      <div className="ml-auto text-[10.5px] text-ink-mid font-semibold tabular-nums">
        ide.aip.group.local/@박서연/workspace
      </div>
    </section>
  );
}

function CoderLinkBtn({
  icon,
  label,
  href,
  onClick,
  primary,
}: {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 h-8 px-3 rounded border text-[11.5px] font-extrabold',
    primary
      ? 'bg-ink text-white border-ink hover:bg-ink-dark'
      : 'bg-white text-ink-dark border-line hover:border-brand-dark',
  );
  const content = (
    <>
      <span aria-hidden>{icon}</span>
      {label}
      <span aria-hidden className="text-[9px] opacity-70">
        ↗
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}

function JenkinsBody({ task, onOpenConsole }: { task: DevenvTask; onOpenConsole: () => void }) {
  void task;
  return (
    <section className="card px-5 py-4 flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] text-ink-mid font-bold">바로가기</span>
      <CoderLinkBtn icon="⚙️" label="Jenkins 콘솔" onClick={onOpenConsole} primary />
      <CoderLinkBtn
        icon="📊"
        label="Blue Ocean"
        href="https://ci.aip.group.local/blue/organizations/jenkins/"
      />
      <CoderLinkBtn
        icon="🔌"
        label="Webhook 설정"
        href="https://ci.aip.group.local/configure"
      />
      <div className="ml-auto text-[10.5px] text-ink-mid font-semibold tabular-nums">
        ci.aip.group.local
      </div>
    </section>
  );
}

function ArgocdBody({ task, onOpenUi }: { task: DevenvTask; onOpenUi: () => void }) {
  void task;
  return (
    <section className="card px-5 py-4 flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] text-ink-mid font-bold">바로가기</span>
      <CoderLinkBtn icon="🚀" label="ArgoCD UI" onClick={onOpenUi} primary />
      <CoderLinkBtn
        icon="📦"
        label="Git 저장소"
        href="https://git.aip.group.local/aip/pb-agent-deploy"
      />
      <CoderLinkBtn
        icon="🔁"
        label="Webhook"
        href="https://cd.aip.group.local/settings/repos"
      />
      <div className="ml-auto text-[10.5px] text-ink-mid font-semibold tabular-nums">
        cd.aip.group.local
      </div>
    </section>
  );
}

