import { cn } from '@/lib/utils';

export type TabId =
  | 'overview'
  | 'tasks'
  | 'approvals'
  | 'traffic'
  | 'conversations'
  | 'members';

interface Tab {
  id: TabId;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: TabId;
  onChange: (id: TabId) => void;
  right?: React.ReactNode;
}

/** 프로젝트 상세 페이지 탭 네비게이션 (sticky) */
export default function TabNav({ tabs, active, onChange, right }: Props) {
  return (
    <nav className="card px-1 mb-3.5 sticky top-[98px] z-20 bg-white shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)] flex items-center">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'py-3 px-[18px] text-[12.5px] font-bold border-b-2 -mb-px',
            active === tab.id
              ? 'text-ink border-brand-dark'
              : 'text-ink-mid border-transparent hover:text-ink-dark',
          )}
        >
          {tab.label}
        </button>
      ))}
      {right && (
        <div className="ml-auto flex items-center gap-2 px-3 text-[11.5px] text-ink-mid">
          {right}
        </div>
      )}
    </nav>
  );
}
