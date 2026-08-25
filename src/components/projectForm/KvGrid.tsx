import { cn } from '@/lib/utils';

interface KvRowProps {
  k: string;
  v: React.ReactNode;
  tone?: 'default' | 'strong' | 'red';
}

/** k(라벨) / v(값) 2열 그리드 행. 결재 상세에서 자주 사용 */
export function KvRow({ k, v, tone = 'default' }: KvRowProps) {
  return (
    <>
      <div className="text-[11.5px] text-ink-mid font-semibold py-2 border-b border-dashed border-line-soft">
        {k}
      </div>
      <div
        className={cn(
          'text-[12.5px] py-2 border-b border-dashed border-line-soft',
          tone === 'strong' && 'text-ink font-extrabold',
          tone === 'red' && 'text-bad font-bold',
          tone === 'default' && 'text-ink-dark',
        )}
      >
        {v}
      </div>
    </>
  );
}

export function KvGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-4 [&>div:nth-last-child(1)]:border-0 [&>div:nth-last-child(2)]:border-0">
      {children}
    </div>
  );
}
