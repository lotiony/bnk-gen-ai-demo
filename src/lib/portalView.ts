/**
 * 포털 단위 접근 판정 — GNB · 포털 스위처 · 공통 랜딩이 공유하는 단일 진입점.
 *
 * RFP 2-1: "로그인 후 사용자 권한에 따라 **접근 가능한 워크스페이스·메뉴·기능만 노출**".
 * 요건이 말하는 "워크스페이스" 가 여기서 말하는 포털이다.
 *
 * ⚠️ 판정을 새로 만들지 않는다. `personaView.canAccessArea` / `canAccessGovernance`
 *    가 이미 메뉴 단위 판정의 정본이고, 포털 판정은 **그 결과의 합집합**이다 —
 *    "메뉴가 하나라도 열리면 그 포털이 보인다". 이렇게 묶어 두면 역할 규칙을
 *    personaView 한 곳에서만 고쳐도 랜딩 카드·GNB·딥링크 가드가 함께 움직인다.
 *    포털 판정을 따로 적으면 그 순간 두 벌이 되고, 랜딩에는 카드가 있는데
 *    들어가면 차단 화면이 뜨는 종류의 불일치가 난다.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PORTALS,
  PORTAL_BY_ID,
  portalOfPath,
  type PortalDef,
  type PortalId,
  type PortalNavItem,
} from '@/data/portals';
import { canAccessArea, canAccessGovernance, type PersonaLike } from '@/lib/personaView';
import { useCurrentPersona } from '@/lib/persona';
import { setLastPortal, useLastPortal } from '@/lib/portalStore';

/** 메뉴 한 칸의 접근 판정 — `governance` 만 NavArea 밖이라 따로 받는다. */
export function canAccessNavItem(persona: PersonaLike, item: PortalNavItem): boolean {
  return item.area === 'governance'
    ? canAccessGovernance(persona)
    : canAccessArea(persona, item.area);
}

/** 이 포털에서 이 계정에게 보여야 할 메뉴. 권한 밖은 렌더하지 않는다. */
export function visibleNav(persona: PersonaLike, portal: PortalDef): PortalNavItem[] {
  return portal.nav.filter((n) => canAccessNavItem(persona, n));
}

/** 포털이 열리는가 — 그 안의 메뉴가 하나라도 열리면 열린다. */
export function canAccessPortal(persona: PersonaLike, portal: PortalDef): boolean {
  return visibleNav(persona, portal).length > 0;
}

/** 이 계정에게 노출할 포털 목록 (랜딩 카드 · 스위처 공용). */
export function visiblePortals(persona: PersonaLike): PortalDef[] {
  return PORTALS.filter((p) => canAccessPortal(persona, p));
}

/**
 * 현재 포털.
 *
 * 경로가 포털에 매이면 그 포털을 쓰고 스토어에 기록한다. 매이지 않는 경로
 * (`/approvals` · `/portal`)에서는 마지막으로 머문 포털을 그대로 쓴다.
 *
 * 권한 밖 포털이 해석되는 경우는 딥링크뿐인데(예: 일반 사용자가 `/admin` 을 친다),
 * 그때는 `AreaGuard` 가 본문을 차단한다. GNB 까지 그 포털의 메뉴를 그리면
 * "못 여는 메뉴를 보여 주는" 상태가 되므로, 접근 불가 포털이면 **열리는 포털로
 * 되돌린다**.
 */
export function usePortal(): PortalDef {
  const { pathname } = useLocation();
  const persona = useCurrentPersona();
  const last = useLastPortal();

  const matched = portalOfPath(pathname);
  const candidate: PortalId = matched ?? last;
  const portal = PORTAL_BY_ID[candidate];
  const allowed = canAccessPortal(persona, portal);
  const resolved = allowed ? portal : (visiblePortals(persona)[0] ?? PORTAL_BY_ID.work);

  // 렌더 중 스토어를 건드리면 다른 구독자가 같은 커밋에서 어긋난다 — 커밋 후에 기록한다.
  useEffect(() => {
    if (matched && allowed) setLastPortal(matched);
  }, [matched, allowed]);

  return resolved;
}
