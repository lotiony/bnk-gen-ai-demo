import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT: Record<BadgeVariant, string> = {
  default: 'border-brand-dark bg-brand text-white',
  secondary: 'border-line bg-surface text-ink-mid',
  outline: 'border-line-warm bg-white text-ink-dark',
  success: 'border-ok-border bg-ok-bg text-ok',
  warning: 'border-warn-border bg-warn-bg text-warn',
  danger: 'border-bad-border bg-bad-bg text-bad',
  info: 'border-info-border bg-info-bg text-info',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex min-h-5 items-center border px-2 py-0.5 text-[10.5px] font-bold leading-none',
        'rounded-sm whitespace-nowrap',
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = 'Badge';

export default Badge;
