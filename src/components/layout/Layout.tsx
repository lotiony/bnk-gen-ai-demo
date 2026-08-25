import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import GNB from './GNB';

const contextMap: Record<string, { label: string; env?: string }> = {
  '/': { label: '홈' },
  '/projects': { label: '프로젝트 목록' },
  '/projects/new': { label: '새 프로젝트 등록' },
  '/approvals': { label: '결재함' },
  '/admin': { label: '플랫폼 관리', env: 'MFA 인증됨' },
};

/** 모든 라우트를 감싸는 기본 레이아웃 — Topbar + GNB + Outlet */
export default function Layout() {
  const { pathname } = useLocation();
  let ctx = contextMap[pathname];
  if (!ctx) {
    if (pathname.startsWith('/projects/')) ctx = { label: '프로젝트 상세' };
    else if (pathname.startsWith('/approvals/')) ctx = { label: '결재 상세' };
    else if (pathname.startsWith('/admin')) ctx = { label: '플랫폼 관리', env: 'MFA 인증됨' };
  }

  return (
    <>
      <Topbar context={ctx?.label} envBadge={ctx?.env} />
      <GNB />
      <Outlet />
    </>
  );
}
