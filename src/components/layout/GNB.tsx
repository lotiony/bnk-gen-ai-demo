import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { canAccessArea, type NavArea } from '@/lib/personaView';

interface GnbItem {
  label: string;
  to: string;
  /** 권한 판정 키 — 권한 밖이면 렌더 자체를 하지 않는다(RFP 2-1). */
  area: NavArea;
  /** 정확 매치가 아니어도 prefix로 active 처리할 경우 */
  matchPrefix?: string;
}

/*
 * GNB 구성 근거 —
 *  · 「프로젝트」를 내렸다. RFP 에 사용자 포털의 프로젝트 계층은 없고, `과제` 는
 *    관리자 포털(2-1 「과제 관리 화면」)과 커뮤니티(「과제 산출물」)에만 나온다.
 *    제작자 화면은 「AI Studio」가 과제를 직접 나열한다.
 *  · 「AI 거버넌스」도 내렸다. RFP 2-3 이 "포탈 내 **별도 기능**" 으로 규정하므로
 *    최상위 독립 포탈(/governance)로 분리하고 홈의 진입 타일로만 노출한다.
 *  · 「지식 · 데이터」를 새로 세웠다. EDA·RAG 요건군이 한 메뉴로 묶이고,
 *    온톨로지(RAG-007·008)가 여기로 옮겨 왔다.
 */
const items: GnbItem[] = [
  { label: '홈', to: '/', area: 'home' },
  { label: 'AI 어시스턴트', to: '/chat', area: 'chat', matchPrefix: '/chat' },
  { label: 'AI Studio', to: '/studio', area: 'studio', matchPrefix: '/studio' },
  { label: '지식 · 데이터', to: '/knowledge', area: 'knowledge', matchPrefix: '/knowledge' },
  { label: '공통 카탈로그', to: '/catalog', area: 'catalog', matchPrefix: '/catalog' },
  { label: '관리', to: '/admin', area: 'admin', matchPrefix: '/admin' },
];

/** 모든 페이지 공통 글로벌 네비게이션 */
export default function GNB() {
  const { pathname } = useLocation();
  const persona = useCurrentPersona();
  const visible = items.filter((item) => canAccessArea(persona, item.area));

  return (
    <nav className="sticky top-[50px] z-20 bg-white border-b-2 border-brand px-6">
      <div className="max-w-[1360px] mx-auto flex items-center gap-1.5">
        {visible.map((item) => {
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
