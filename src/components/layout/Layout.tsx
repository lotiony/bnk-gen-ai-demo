import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import GNB from './GNB';
import { Toaster } from '@/lib/toast';
import PresenterNav from '@/lib/presenter';

/** 관리 콘솔 진입 시 상단바에 노출하는 환경 배지. */
const ADMIN_ENV_BADGE = 'MFA 인증됨';

/*
 * 거버넌스 배지("AI 거버넌스 포탈 · 별도 포탈")는 뺐다 — GNB 좌측 포털 칩이
 * 같은 말을 더 크게 하고 있어서, 상단바에 한 번 더 적으면 캡처에 같은 문구가
 * 두 번 찍힌다. MFA 배지는 성격이 다른 정보라 남긴다.
 */
function envBadgeFor(pathname: string): string | undefined {
  if (pathname.startsWith('/admin')) return ADMIN_ENV_BADGE;
  return undefined;
}

/**
 * 모든 라우트를 감싸는 기본 레이아웃 — Topbar + GNB + Outlet.
 *
 * 공통 포털 랜딩(`/portal`)에서는 GNB 를 그리지 않는다. GNB 는 **어느 포털 안에
 * 있는지**를 말하는 줄인데, 랜딩은 포털을 아직 고르지 않은 자리다. 거기에
 * 포털 메뉴를 띄우면 "고르세요" 라고 해 놓고 이미 들어가 있는 화면이 된다.
 */
export default function Layout() {
  const { pathname } = useLocation();
  const isLanding = pathname.startsWith('/portal');

  return (
    <>
      <Topbar envBadge={envBadgeFor(pathname)} />
      {!isLanding && <GNB />}
      <Outlet />
      <Toaster />
      <PresenterNav />
    </>
  );
}
