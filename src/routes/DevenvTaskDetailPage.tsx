/**
 * 개발환경 과제 상세 — RFP: ONM-008 개발 환경(Coder · CI · CD) 제공.
 *
 * 진입 경로는 AI Studio 「개발환경」(`/studio/devenv/:taskId`) 하나다. 옛 프로젝트
 * 딥링크(`/projects/:projectId/tasks/devenv/:taskId`)는 App 라우트에서 이 경로로
 * 접었으므로, 브레드크럼도 프로젝트가 아니라 AI Studio 계층을 쓴다.
 *
 * ⚠️ 외부 도구 버튼에 실제 `href` 를 달지 않는다. 시연장은 폐쇄망이라
 *    `*.aip.group.local` 로 이동하면 DNS 실패 화면이 뜨고 데모가 끊긴다.
 *    어느 도구·주소로 연결되는지는 화면에 그대로 적되, 이동은 하지 않는다.
 */
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useWorkCrumb } from '@/lib/crumbs';
import { findDevenvTask, DEVENV_LABEL, type DevenvTask } from '@/data/mockDevenvTasks';
import { ToolModal, VSCodeMock, JenkinsMock, ArgocdMock } from '@/components/devenv/ToolMocks';

/** AI Studio 개발환경 목록 — 되돌아가기·과제 미존재 처리의 공통 목적지. */
const DEVENV_LIST_PATH = '/studio/devenv';

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

  /**
   * 상위 계층은 경로 기반 조립기(`crumbs.ts`)를 따르고, 그 아래에 개발환경 목록과
   * 과제명을 얹는다. `/studio/…` 에서는 `홈 › AI Studio › 개발환경 › 과제`가 된다.
   * 훅이므로 아래 조기 반환보다 먼저 호출한다.
   */
  const crumbBase = useWorkCrumb('개발환경', pid);
  const crumbItems = [
    ...crumbBase.slice(0, -1),
    { label: '개발환경', to: DEVENV_LIST_PATH },
    { label: task?.name ?? '과제를 찾을 수 없음' },
  ];

  if (!task) {
    return <Navigate to={DEVENV_LIST_PATH} replace />;
  }

  const stateTone = STATE_TONE[task.state] ?? STATE_TONE['정지'];
  const isCoderRunning = task.kind === 'coder' && task.state === '실행 중';
  const open = () => setModalOpen(true);

  return (
    <div className="max-w-[1360px] mx-auto px-8 pt-3.5 pb-14">
      <Crumb items={crumbItems} />

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
        <Link to={DEVENV_LIST_PATH}>
          <Button>← 개발환경 목록으로</Button>
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
        <button className="inline-flex items-center gap-2 h-10 px-5 rounded bg-brand text-white font-extrabold text-[13px] border border-brand-dark hover:bg-brand-dark">
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
        url="https://ide.aip.group.local/@박서연/workspace/apps/jupyter/"
      />
      <div className="ml-auto text-[10.5px] text-ink-mid font-semibold tabular-nums">
        ide.aip.group.local/@박서연/workspace
      </div>
    </section>
  );
}

/**
 * 도구 바로가기 버튼.
 *
 * `url` 은 **표시용**이다 — 앵커로 걸지 않는다. 폐쇄망 시연장에서 실제로 이동하면
 * DNS 실패 화면으로 떨어져 데모가 끊긴다. 대신 어느 주소로 연결되는지를
 * 툴팁·토스트로 그대로 보여 준다(RFP ONM-008 개발 환경 연동 표기는 유지).
 */
function CoderLinkBtn({
  icon,
  label,
  url,
  onClick,
  primary,
}: {
  icon: string;
  label: string;
  /** 연동 대상 주소 — 표시 전용. */
  url?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const className = cn(
    'inline-flex items-center gap-1.5 h-8 px-3 rounded border text-[11.5px] font-extrabold',
    primary
      ? 'bg-ink text-white border-ink hover:bg-ink-dark'
      : 'bg-white text-ink-dark border-line hover:border-brand-dark',
  );

  const handleClick =
    onClick ??
    (() =>
      toast(
        `${label} 로 연결됩니다`,
        `${url ?? '-'}\n` +
          '시연 환경(폐쇄망)에서는 외부 창으로 이동하지 않고 플랫폼 화면 안에서만 확인합니다.',
        'info',
      ));

  return (
    <button
      type="button"
      onClick={handleClick}
      title={url}
      className={className}
    >
      <span aria-hidden>{icon}</span>
      {label}
      <span aria-hidden className="text-[9px] opacity-70">
        ↗
      </span>
    </button>
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
        url="https://ci.aip.group.local/blue/organizations/jenkins/"
      />
      <CoderLinkBtn
        icon="🔌"
        label="Webhook 설정"
        url="https://ci.aip.group.local/configure"
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
        url="https://git.aip.group.local/aip/pb-agent-deploy"
      />
      <CoderLinkBtn
        icon="🔁"
        label="Webhook"
        url="https://cd.aip.group.local/settings/repos"
      />
      <div className="ml-auto text-[10.5px] text-ink-mid font-semibold tabular-nums">
        cd.aip.group.local
      </div>
    </section>
  );
}

