import { cn } from '@/lib/utils';

interface Props {
  primary?: boolean;
  role?: string;
  /** Fallback 표시 등 우측 small 텍스트 추가 색 */
  roleVariant?: 'primary' | 'fallback';
  children: React.ReactNode;
}

/** 결재 상세 등 read-only 칩 (선택된 PM·모델 표시) */
export default function ChipReadonly({ primary, role, roleVariant = 'primary', children }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-bold py-1 px-2.5 rounded-full border mr-1.5 mb-1.5',
        primary
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-surface-soft border-line-soft text-ink-dark',
      )}
    >
      {children}
      {role && (
        <span
          className={cn(
            'text-[9.5px] font-extrabold px-1.5 py-px rounded-md tracking-[0.2px]',
            roleVariant === 'primary'
              ? 'bg-brand text-ink'
              : 'bg-info-bg text-info border border-info-border',
          )}
        >
          {role}
        </span>
      )}
    </span>
  );
}
