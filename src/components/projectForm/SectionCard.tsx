import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  letter: string;
  name: string;
  summary?: string;
  defaultOpen?: boolean;
  /** "MVP" / "Phase 2" 같은 우측 작은 라벨 */
  tag?: string;
  id?: string;
  children: React.ReactNode;
}

/** A/B/C... 글자 chip + 이름 + 요약 + 펼침 화살. body는 자식 그대로 렌더 */
export default function SectionCard({
  letter,
  name,
  summary,
  defaultOpen = false,
  tag,
  id,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // 네비게이션 앵커용 id — 명시값 없으면 letter로 자동 부여.
  const anchorId = id ?? `sec-${letter}`;

  // 해시가 이 섹션을 가리키면 펼친다 (섹션 네비 클릭 시 접힌 섹션도 열림).
  useEffect(() => {
    const openIfTargeted = () => {
      if (window.location.hash === `#${anchorId}`) setOpen(true);
    };
    openIfTargeted();
    window.addEventListener('hashchange', openIfTargeted);
    return () => window.removeEventListener('hashchange', openIfTargeted);
  }, [anchorId]);

  return (
    <section
      id={anchorId}
      className="card mb-3 scroll-mt-[120px]"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-tint text-ink font-extrabold text-[12.5px] border border-brand-dark">
          {letter}
        </span>
        <span className="text-[14px] font-extrabold text-ink">{name}</span>
        {summary && (
          <span className="text-[11.5px] text-ink-mid font-semibold truncate">{summary}</span>
        )}
        {tag && (
          <span className="ml-auto pill bg-info-bg text-info border border-info-border">{tag}</span>
        )}
        <span
          className={cn(
            'text-ink-mid text-[10px] transition-transform',
            tag ? 'ml-2' : 'ml-auto',
            open && 'rotate-180',
          )}
        >
          ▼
        </span>
      </button>
      {open && <div className="border-t border-line-soft px-5 py-4">{children}</div>}
    </section>
  );
}
