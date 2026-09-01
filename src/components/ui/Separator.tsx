import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', decorative = true, className, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        'shrink-0 bg-line-soft',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full min-h-4 w-px',
        className,
      )}
      {...props}
    />
  ),
);

Separator.displayName = 'Separator';

export default Separator;
