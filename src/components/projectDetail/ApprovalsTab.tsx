import { Link } from 'react-router-dom';
import StatusPill from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { getProjectApprovals } from '@/lib/personaView';

const APPR_CHIP: Record<string, { cls: string; label: string }> = {
  register: { cls: 'bg-brand text-ink border-brand-dark', label: '프로젝트 생성' },
  train: { cls: 'bg-info-bg text-info border-info-border', label: '학습계' },
  serv: { cls: 'bg-ok-bg text-ok border-ok-border', label: '서빙계 배포' },
  discard: { cls: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border', label: '폐기' },
  policy: { cls: 'bg-warn-bg text-warn border-warn-border', label: '정책' },
  table: { cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border', label: '테이블 생성' },
  account: { cls: 'bg-bad-bg text-bad border-bad-border', label: '계정 생성' },
  redteam: { cls: 'bg-warn-bg text-bad border-bad-border', label: '레드팀 신청' },
};

interface Props {
  /** 참여자 판정용. */
  projectId: string;
  /** 이 프로젝트에 속한 결재만 노출하기 위한 키. */
  projectName: string;
}

/** 결재 탭 — 해당 프로젝트의 결재 건만 상태별로 묶어 보여준다. */
export default function ApprovalsTab({ projectId, projectName }: Props) {
  const approvals = getProjectApprovals(useCurrentPersona(), projectId, projectName);

  const pending = approvals.filter((a) => a.state === 'pending');
  const done = approvals.filter((a) => a.state === 'done');
  const rejected = approvals.filter((a) => a.state === 'rejected');

  return (
    <section className="card px-5 py-4">
      <div className="flex items-baseline gap-2.5 mb-3">
        <h3 className="text-base font-extrabold text-ink">결재</h3>
        <span className="text-[11.5px] text-ink-mid font-semibold">
          진행 중 {pending.length} · 완료 {done.length} · 반려 {rejected.length}
        </span>
        <Link
          to="/approvals"
          className="ml-auto text-[11.5px] font-bold text-info hover:underline"
        >
          전역 결재함 →
        </Link>
      </div>

      {approvals.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-[28px] mb-1.5">🗂</div>
          <p className="text-xs text-ink-mid font-semibold">
            이 프로젝트의 결재 건이 없습니다
          </p>
        </div>
      ) : (
        <>
          <Section title="진행 중" items={pending} />
          <Section title="완료" items={done} muted />
          <Section title="반려" items={rejected} muted />
        </>
      )}
    </section>
  );
}

function Section({
  title,
  items,
  muted,
}: {
  title: string;
  items: ReturnType<typeof getProjectApprovals>;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3.5 last:mb-0">
      <h4 className="text-2xs font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-1.5">
        {title} ({items.length})
      </h4>
      <div className="flex flex-col gap-1.5">
        {items.map((a) => {
          const chip = APPR_CHIP[a.category];
          return (
            <Link
              key={a.id}
              to={`/approvals/${a.id}`}
              className={cn(
                'grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center py-2.5 px-3 bg-surface-soft border border-line-soft rounded hover:border-brand-dark',
                muted && 'opacity-80',
              )}
            >
              <span
                className={cn(
                  'pill border min-w-[88px] text-center whitespace-nowrap',
                  chip.cls,
                )}
              >
                {chip.label}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-ink truncate">{a.title}</div>
                <div className="text-2xs text-ink-mid font-semibold mt-0.5">
                  {a.id} · 기안 {a.draftedBy} · {a.draftedAt}
                </div>
              </div>
              <span className="text-2xs text-ink-mid font-bold text-right leading-tight">
                <b className="text-ink-dark">
                  {a.stage.current}/{a.stage.total} 단계
                </b>
                <br />
                {a.stage.label}
              </span>
              <StatusPill
                tone={a.state === 'pending' ? 'warn' : a.state === 'done' ? 'ok' : 'bad'}
              >
                {a.state === 'pending' ? '진행 중' : a.state === 'done' ? '완료' : '반려'}
              </StatusPill>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
