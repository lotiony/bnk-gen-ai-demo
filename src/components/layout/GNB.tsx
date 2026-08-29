import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { useTenant } from '@/lib/tenantStore';
import { TENANTS } from '@/data/tenants';
import { usePortal, visibleNav } from '@/lib/portalView';
import PortalSwitcher from './PortalSwitcher';

/*
 * 포털 스코프 GNB —
 *
 *   [포털 칩 ▾] │ 이 포털의 섹션들 ......... 이 포털이 도는 Namespace
 *
 * 예전에는 `홈 · AI 어시스턴트 · AI Studio · 지식·데이터 · 마켓플레이스 · 관리` 를
 * 한 줄에 평면으로 늘어놓았다. 그러면 성격이 다른 네 포털이 하나의 메뉴 바처럼
 * 보이고, 공통 랜딩에서 "포털을 고르세요" 라고 해 놓고 들어가는 순간 그 개념이
 * 사라진다. RFP 2-1 이 노출 통제 단위로 지목한 것은 메뉴가 아니라
 * **워크스페이스**이므로, 한 번에 한 포털의 메뉴만 그린다.
 *   · 포털 구성·판정은 `data/portals.ts` · `lib/portalView.ts` 가 정본이다.
 *   · 권한 밖 메뉴는 여전히 **미렌더**다(회색 처리 아님).
 *
 * 우측 Namespace 표기는 장식이 아니다 — 전 화면 상단에 "지금 어느 Namespace
 * 맥락에서 보고 있는가" 를 붙여 두는 것이 SEC-001 서술의 반복 근거가 된다.
 * 계열사 스코프 포털은 현재 테넌트를, 공통 스코프 포털은 공통 포털 웹
 * Namespace 를 가리킨다.
 */

const COMMON_NS = TENANTS.find((t) => t.kind === 'group')!;

/** 모든 페이지 공통 글로벌 네비게이션 — 현재 포털의 섹션만 그린다. */
export default function GNB() {
  const { pathname } = useLocation();
  const persona = useCurrentPersona();
  const portal = usePortal();
  const tenant = useTenant();

  const items = visibleNav(persona, portal);
  const tenantMeta = TENANTS.find((t) => t.name === tenant);
  const ns = portal.nsScope === 'common' ? COMMON_NS.namespace : tenantMeta?.namespace;

  return (
    <nav className="sticky top-[50px] z-20 bg-white border-b-2 border-brand px-6">
      <div className="max-w-[1360px] mx-auto flex items-center gap-2">
        <PortalSwitcher />

        <span className="w-px h-5 bg-line-soft mx-1" aria-hidden />

        {items.map((item) => {
          const isActive = item.matchPrefix
            ? pathname.startsWith(item.matchPrefix)
            : pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'py-3.5 px-[15px] text-[13px] font-semibold border-b-2 border-transparent -mb-[2px]',
                isActive
                  ? 'text-brand font-extrabold border-brand'
                  : 'text-ink-mid hover:text-ink-dark',
              )}
            >
              {item.label}
            </NavLink>
          );
        })}

        <div className="ml-auto flex items-center gap-2 pl-4">
          <span className="text-[9.5px] font-mono font-semibold text-ink-light">{ns}</span>
          <span className="text-[10.5px] text-ink-mid font-semibold hidden xl:inline">
            {portal.nsNote}
          </span>
        </div>
      </div>
    </nav>
  );
}
