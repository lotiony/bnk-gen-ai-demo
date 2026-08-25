import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface GnbItem {
  label: string;
  to: string;
  /** 정확 매치가 아니어도 prefix로 active 처리할 경우 */
  matchPrefix?: string;
}

const items: GnbItem[] = [
  { label: '홈', to: '/' },
  { label: '프로젝트', to: '/projects', matchPrefix: '/projects' },
  { label: '공통 카탈로그', to: '/catalog', matchPrefix: '/catalog' },
  { label: '관리', to: '/admin', matchPrefix: '/admin' },
];

/** 모든 페이지 공통 글로벌 네비게이션 */
export default function GNB() {
  const { pathname } = useLocation();

  return (
    <nav className="sticky top-[50px] z-20 bg-white border-b-2 border-brand px-6">
      <div className="max-w-[1760px] mx-auto flex items-center gap-1.5">
        {items.map((item) => {
          const isActive =
            item.to !== '#' &&
            (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.to);
          const className = cn(
            'py-3.5 px-[18px] text-[13px] font-semibold border-b-2 border-transparent',
            isActive
              ? 'text-brand font-extrabold border-brand'
              : 'text-ink-mid hover:text-ink-dark',
          );
          if (item.to === '#') {
            return (
              <span
                key={item.label}
                className={cn(className, 'text-ink-light cursor-not-allowed')}
              >
                {item.label}
              </span>
            );
          }
          return (
            <NavLink key={item.label} to={item.to} className={className}>
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
