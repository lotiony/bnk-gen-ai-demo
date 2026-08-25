import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

interface Props {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}

const TONE: Record<StatusTone, string> = {
  ok: 'bg-ok-bg text-ok border-ok-border',
  warn: 'bg-warn-bg text-warn border-warn-border',
  bad: 'bg-bad-bg text-bad border-bad-border',
  info: 'bg-info-bg text-info border-info-border',
  neutral: 'bg-surface-soft text-ink-mid border-line-soft',
};

/** 상태 표시 pill — 운영중/경고/장애/info 등에 공통 사용 */
export default function StatusPill({ tone = 'ok', children, className }: Props) {
  return (
    <span
      className={cn(
        'pill border font-extrabold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
