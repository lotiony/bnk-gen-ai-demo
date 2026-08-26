import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import GNB from './GNB';
import { Toaster } from '@/lib/toast';
import PresenterNav from '@/lib/presenter';

/** 관리 콘솔 진입 시 상단바에 노출하는 환경 배지. */
const ADMIN_ENV_BADGE = 'MFA 인증됨';
/** AI 거버넌스 포탈은 별도 포탈이라는 것을 상단바에서 한 번 더 알린다(RFP 2-3). */
const GOV_ENV_BADGE = 'AI 거버넌스 포탈 · 별도 포탈';

function envBadgeFor(pathname: string): string | undefined {
  if (pathname.startsWith('/governance')) return GOV_ENV_BADGE;
  if (pathname.startsWith('/admin')) return ADMIN_ENV_BADGE;
  return undefined;
}

/** 모든 라우트를 감싸는 기본 레이아웃 — Topbar + GNB + Outlet */
export default function Layout() {
  const { pathname } = useLocation();

  return (
    <>
      <Topbar envBadge={envBadgeFor(pathname)} />
      <GNB />
      <Outlet />
      <Toaster />
      <PresenterNav />
    </>
  );
}
