import { Link } from 'react-router-dom';
import { approvals } from '@/data/mockApprovals';
import StatusPill from '@/components/ui/StatusPill';
import Crumb from '@/components/ui/Crumb';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { getVisibleApprovals } from '@/lib/personaView';
import { useDeployApprovals } from '@/lib/deployApprovalStore';

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

export default function ApprovalInboxPage() {
  useDeployApprovals(); // 배포 결재 스토어 변경 구독 (목록 갱신)
  const visible = getVisibleApprovals(useCurrentPersona());
  const mine = visible.filter((a) => a.mine);
  const others = visible.filter((a) => !a.mine && a.state === 'pending');
  const approved = visible.filter((a) => a.state === 'done');
  const rejected = visible.filter((a) => a.state === 'rejected');

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <Crumb items={[{ label: '홈', to: '/' }, { label: '결재함' }]} />

      <div className="card px-6 py-5 mb-3.5">
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">결재함</h1>
        <p className="text-xs text-ink-mid font-semibold mt-1">
          내 차례 {mine.length}건 · 진행 중 {others.length}건 · 완료 {approved.length}건 · 반려{' '}
          {rejected.length}건
        </p>
      </div>

      <Section title={`내 차례 (${mine.length})`} items={mine} />
      <Section title={`진행 중 (${others.length})`} items={others} />
      <Section title={`완료 (${approved.length})`} items={approved} muted />
      <Section title={`반려 (${rejected.length})`} items={rejected} muted />
    </div>
  );
}

function Section({
  title,
  items,
  muted,
}: {
  title: string;
  items: typeof approvals;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <h3 className="text-xs font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">
        {items.map((a) => {
          const chip = APPR_CHIP[a.category];
          return (
            <Link
              key={a.id}
              to={`/approvals/${a.id}`}
              className={cn(
                'grid grid-cols-[auto_auto_1fr_auto_auto] gap-2.5 items-center py-3 px-3.5 bg-white border border-line-soft rounded hover:border-brand-dark',
                muted && 'opacity-80',
              )}
            >
              <span className={cn('pill border min-w-[60px] text-center', chip.cls)}>
                {chip.label}
              </span>
              {a.urgent && <StatusPill tone="bad">🚨 긴급</StatusPill>}
              <div className="min-w-0">
                <div className="text-xs font-bold text-ink">{a.title}</div>
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
