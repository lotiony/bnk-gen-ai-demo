interface Props {
  title: string;
  icon?: string;
  children: React.ReactNode;
}

/** 우측 사이드바 카드 (결재선 진행 / 결재 이력 / 진행률 / 섹션 네비 등) */
export default function SidebarCard({ title, icon, children }: Props) {
  return (
    <div className="card px-4 py-3.5 mb-3 last:mb-0">
      <div className="text-[11.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2.5">
        {icon && <span className="mr-1.5">{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}
