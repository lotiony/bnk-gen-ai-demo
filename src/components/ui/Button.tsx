import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  default: 'bg-white border border-line text-ink-dark hover:bg-surface',
  primary:
    'bg-brand border border-brand-dark text-ink font-extrabold hover:bg-brand-dark',
  ghost: 'bg-transparent border border-transparent text-ink-mid hover:bg-surface hover:text-ink-dark',
  danger: 'bg-white border border-bad-border text-bad hover:bg-bad-bg',
};

/** 표준 버튼 — 4 variant */
export default function Button({ variant = 'default', className, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center gap-1.5 py-2 px-3.5 rounded text-[12.5px] font-bold',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
