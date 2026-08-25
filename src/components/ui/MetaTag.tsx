import { cn } from '@/lib/utils';

export type MetaTagTone = 'default' | 'target' | 'sens' | 'pii';

interface Props {
  tone?: MetaTagTone;
  children: React.ReactNode;
}

const TONE: Record<MetaTagTone, string> = {
  default: 'bg-surface-soft text-ink-mid border-line-soft',
  target: 'bg-kb-yellow-tint text-ink border-kb-yellow-dark font-extrabold',
  sens: 'bg-bad-bg text-bad border-bad-border font-extrabold',
  pii: 'bg-warn-bg text-warn border-warn-border',
};

/** 프로젝트 메타 태그 (대고객/민감도/PII 등) */
export default function MetaTag({ tone = 'default', children }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-2xs font-bold px-2 py-[2px] rounded-[9px] border',
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}
