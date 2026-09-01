import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'destructive';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const VARIANT: Record<AlertVariant, string> = {
  default: 'border-line bg-surface-soft text-ink-dark',
  info: 'border-info-border bg-info-bg text-info',
  success: 'border-ok-border bg-ok-bg text-ok',
  warning: 'border-warn-border bg-warn-bg text-[#815012]',
  destructive: 'border-bad-border bg-bad-bg text-bad',
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'default', role = 'alert', className, ...props }, ref) => (
    <div
      ref={ref}
      role={role}
      className={cn('relative w-full rounded-md border px-4 py-3', VARIANT[variant], className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 text-[12.5px] font-extrabold leading-none', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-[12px] leading-relaxed opacity-90', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export default Alert;
