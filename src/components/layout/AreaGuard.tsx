import { Link } from 'react-router-dom';
import { useCurrentPersona } from '@/lib/persona';
import { canAccessArea, canAccessGovernance, type NavArea } from '@/lib/personaView';

/**
 * 권한 밖 영역에 URL 로 직접 들어왔을 때의 차단 화면.
 *
 * RFP 2-1 은 "접근 가능한 워크스페이스·메뉴·기능만 노출" 을 요구한다. 메뉴에서
 * 감추는 것만으로는 부족하다 — 딥링크로 들어오는 경로가 열려 있으면 통제가 아니다.
 * 그래서 셸마다 이 가드를 통과해야 Outlet 이 렌더된다.
 *
 * 차단 사실은 감사 대상이므로 화면에도 그렇게 적는다(SEC-009).
 */
export default function AreaGuard({
  area,
  children,
}: {
  /** 'governance' 는 별도 포탈이라 NavArea 밖에 있다. */
  area: NavArea | 'governance';
  children: React.ReactNode;
}) {
  const persona = useCurrentPersona();
  const allowed =
    area === 'governance' ? canAccessGovernance(persona) : canAccessArea(persona, area);

  if (allowed) return <>{children}</>;

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-16">
      <div className="card px-8 py-12 text-center max-w-[560px] mx-auto">
        <div className="text-[30px] mb-3">🔒</div>
        <h1 className="text-[17px] font-extrabold text-ink mb-2">접근 권한이 없습니다</h1>
        <p className="text-[12px] text-ink-dark font-semibold leading-relaxed">
          현재 계정 <b>{persona?.name ?? '-'}</b>({persona?.rfpRole ?? '-'}) 의 권한으로는 이
          워크스페이스를 열 수 없습니다.
        </p>
        <p className="text-[11px] text-ink-mid font-semibold leading-relaxed mt-2">
          권한은 SSO/AD 역할 클레임을 따르며, 변경은 관리 콘솔의 역할·권한 관리에서 결재를 거쳐
          이뤄집니다. 이 접근 시도는 감사 원장에 기록됩니다.
        </p>
        <Link
          to="/"
          className="inline-block mt-5 py-2 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
