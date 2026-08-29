import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import PersonaSwitcher from './PersonaSwitcher';
import HelpDrawer from './HelpDrawer';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { getApprovalBadgeCount } from '@/lib/personaView';
import { useRfpChips, toggleRfpChips } from '@/lib/rfpChips';

interface TopbarProps {
  /** 환경 배지. 비워두면 표시 안 함 */
  envBadge?: string;
}

/** 모든 페이지 공통 상단바 — 계열사 스위처 + 브랜드 + 유저 칩 */
export default function Topbar({ envBadge }: TopbarProps) {
  const approvalCount = getApprovalBadgeCount(useCurrentPersona());

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line px-6 py-3">
      <div className="max-w-[1360px] mx-auto flex items-center gap-3.5">
        <TenantSwitcher />
        {/* 브랜드는 그룹 단위 식별자다 — 포털 홈이 아니라 공통 포털 랜딩으로 보낸다. */}
        <Link
          to="/portal"
          title="공통 포털 랜딩 — 워크스페이스 선택 · Namespace 구조"
          className="flex items-center gap-2.5 text-sm font-extrabold text-ink pl-1 -ml-1.5"
        >
          공동 생성형 AI 플랫폼
        </Link>
        {envBadge && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-dark bg-surface px-2 py-1 rounded-sm border border-line-soft font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            {envBadge}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3.5 text-xs text-ink-mid">
          <RfpToggle />
          <Link
            to="/approvals"
            title="결재함"
            className="relative inline-flex cursor-pointer text-ink-dark"
          >
            📥
            <CountBadge count={approvalCount} />
          </Link>
          <HelpDrawer />
          <PersonaSwitcher />
        </div>
      </div>
    </header>
  );
}

/**
 * RFP 요건 칩 토글 — 구버전 프로토타입 #rfpTgl 규약.
 * 기본 OFF(칩 숨김) — 시연 중엔 꺼두고 "어느 요건입니까?" 질문이 나오면 켠다.
 * body 클래스 한 줄로 44곳의 칩을 한 번에 제어한다.
 */
function RfpToggle() {
  const on = useRfpChips();

  useEffect(() => {
    document.body.classList.toggle('rfp-hide', !on);
    return () => document.body.classList.remove('rfp-hide');
  }, [on]);

  return (
    <button
      type="button"
      onClick={toggleRfpChips}
      title={on ? 'RFP 요건 번호 숨기기' : 'RFP 요건 번호 표시'}
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-extrabold tracking-[0.3px] transition-colors',
        on
          ? 'bg-brand-tint text-brand border-brand-dark'
          : 'bg-white text-ink-light border-line hover:text-ink-mid hover:border-ink-light',
      )}
    >
      RFP
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          on ? 'bg-brand' : 'bg-line',
        )}
      />
    </button>
  );
}

/** 상단바 아이콘 우측 상단 카운트 배지. 0건이면 표시하지 않는다. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2 bg-bad text-white rounded-lg min-w-[14px] h-[14px] text-[9.5px] font-extrabold px-1 inline-flex items-center justify-center leading-none">
      {count}
    </span>
  );
}
