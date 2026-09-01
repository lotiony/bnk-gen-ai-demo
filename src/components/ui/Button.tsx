import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'link';
export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  default: 'border border-line bg-white text-ink-dark hover:border-line-warm hover:bg-surface',
  primary:
    'border border-brand-dark bg-brand text-white hover:bg-brand-dark active:bg-brand-dark',
  secondary: 'border border-line-warm bg-warm text-ink-dark hover:bg-line-soft',
  outline: 'border border-line-strong bg-transparent text-ink-dark hover:bg-surface',
  ghost:
    'border border-transparent bg-transparent text-ink-mid hover:bg-surface hover:text-ink-dark',
  danger: 'border border-bad-border bg-white text-bad hover:bg-bad-bg',
  destructive: 'border border-bad bg-bad text-white hover:bg-[#B82934]',
  link: 'border border-transparent bg-transparent px-0 text-brand underline-offset-4 hover:underline',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px]',
  default: 'h-9 px-3.5 text-[12.5px]',
  lg: 'h-10 px-5 text-[13px]',
  icon: 'h-9 w-9 p-0',
};

/**
 * BNK 공통 버튼.
 *
 * 기존 화면의 variant API를 유지하면서 ref, size, loading과 키보드 포커스 상태를
 * 제공한다. 아이콘 전용 버튼은 접근 가능한 이름(aria-label)을 함께 전달해야 한다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'default',
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded font-bold',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

export default Button;
