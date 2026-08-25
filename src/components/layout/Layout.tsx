import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import GNB from './GNB';

/** 관리 콘솔 진입 시 상단바에 노출하는 환경 배지. */
const ADMIN_ENV_BADGE = 'MFA 인증됨';

/** 모든 라우트를 감싸는 기본 레이아웃 — Topbar + GNB + Outlet */
export default function Layout() {
  const { pathname } = useLocation();

  return (
    <>
      <Topbar envBadge={pathname.startsWith('/admin') ? ADMIN_ENV_BADGE : undefined} />
      <GNB />
      <Outlet />
    </>
  );
}
