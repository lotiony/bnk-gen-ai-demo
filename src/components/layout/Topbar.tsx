import { Link } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import PersonaSwitcher from './PersonaSwitcher';
import { useCurrentPersona } from '@/lib/persona';
import { getApprovalBadgeCount } from '@/lib/personaView';

interface TopbarProps {
  /** 우측 컨텍스트 배지 텍스트. 예: "프로젝트 상세" */
  context?: string;
  /** 환경 배지. 비워두면 표시 안 함 */
  envBadge?: string;
}

/** 모든 페이지 공통 상단바 — 계열사 스위처 + 브랜드 + 컨텍스트 + 유저 칩 */
export default function Topbar({ context, envBadge }: TopbarProps) {
  const approvalCount = getApprovalBadgeCount(useCurrentPersona());

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line px-6 py-3">
      <div className="max-w-[1440px] mx-auto flex items-center gap-3.5">
        <TenantSwitcher />
        <Link
          to="/"
          className="flex items-center gap-2.5 text-sm font-extrabold text-ink pl-1 -ml-1.5"
        >
          GenAI Portal 2.0
          {context && (
            <span className="text-[11.5px] font-semibold text-ink-mid ml-1.5 border-l border-line-soft pl-2.5">
              {context}
            </span>
          )}
        </Link>
        {envBadge && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-dark bg-surface px-2 py-1 rounded-sm border border-line-soft font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            {envBadge}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3.5 text-xs text-ink-mid">
          <Link
            to="/approvals"
            title="결재함"
            className="relative inline-flex cursor-pointer text-ink-dark"
          >
            📥
            <CountBadge count={approvalCount} />
          </Link>
          <span className="cursor-pointer">❔</span>
          <PersonaSwitcher />
        </div>
      </div>
    </header>
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
