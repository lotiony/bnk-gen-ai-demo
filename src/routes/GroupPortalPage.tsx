/**
 * 그룹 공통 포털 — 로그인 후 모든 사용자가 가장 먼저 만나는 권한 기반 런처.
 *
 * RFP 1.1.1~1.1.4 / 인프라 나-(3): 계열사 SSO Claim을 확인하고 사용자 권한에
 * 따라 접근 가능한 4개 포털만 노출한다. Namespace 인프라 화면과 분리된 실제
 * 업무 랜딩이며, 포털 카드·바로가기 모두 동일한 RBAC 판정을 사용한다.
 */
import { Link } from 'react-router-dom';
import { PORTALS, canAccessPortal, portalEntryFor, type PortalDefinition } from '@/data/portalCatalog';
import { useCurrentPersona } from '@/lib/persona';
import { useAuthSession } from '@/lib/authSession';
import { useTenant } from '@/lib/tenantStore';
import { getApprovalBadgeCount } from '@/lib/personaView';
import { cn } from '@/lib/utils';

const accentClass: Record<PortalDefinition['accent'], string> = {
  red: 'border-t-brand',
  charcoal: 'border-t-ink',
  blue: 'border-t-info',
  gold: 'border-t-warn',
};

const accentText: Record<PortalDefinition['accent'], string> = {
  red: 'text-brand',
  charcoal: 'text-ink',
  blue: 'text-info',
  gold: 'text-warn',
};

export default function GroupPortalPage() {
  const persona = useCurrentPersona();
  const session = useAuthSession();
  const activeTenant = useTenant();
  const visiblePortals = PORTALS.filter((portal) => canAccessPortal(persona, portal.id));
  const approvalCount = getApprovalBadgeCount(persona);

  return (
    <main className="min-h-[calc(100vh-51px)] bg-surface">
      <section className="bg-white border-b border-line-soft">
        <div className="max-w-[1360px] mx-auto px-6 py-8 lg:py-10 grid lg:grid-cols-[1fr_430px] gap-8 items-end">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-[3px] bg-brand" />
              <span className="text-[10.5px] font-extrabold tracking-[1.4px] text-ink-mid">
                BNK FINANCIAL GROUP · COMMON PORTAL
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[34px] font-black tracking-[-1.2px] text-ink leading-tight">
              BNK 그룹 공동 생성형 AI 플랫폼 도입 사업
            </h1>
            <p className="mt-3 text-[13px] sm:text-[14px] font-semibold text-ink-mid leading-relaxed max-w-[720px]">
              계열사 인증과 역할 Claim을 기준으로 업무 포털을 연결합니다. 현재 계정에 허용된
              메뉴와 데이터만 표시되며 모든 주요 작업은 감사 이력으로 남습니다.
            </p>
          </div>

          <div className="border border-line bg-surface-soft px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold tracking-[.8px] text-ink-light">AUTHENTICATED CONTEXT</div>
                <div className="mt-1 text-[14px] font-extrabold text-ink">
                  {session?.loginCompany ?? persona?.tenant} · {persona?.role}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-ink-mid">
                  {session?.mode === 'sso' ? '그룹 통합 SSO' : '데모 페르소나'} · {session?.mfa ?? '시연 세션'}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 border border-ok-border bg-ok-bg px-2 py-1 text-[10px] font-extrabold text-ok">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                인증 완료
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-line-soft grid grid-cols-3 gap-3">
              <ContextMetric label="작업 Namespace" value={activeTenant} />
              <ContextMetric label="허용 포털" value={`${visiblePortals.length}개`} />
              <ContextMetric label="결재 대기" value={`${approvalCount}건`} />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1360px] mx-auto px-6 py-7 lg:py-9">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-[18px] font-black text-ink tracking-[-.3px]">접근 가능한 업무 포털</h2>
            <p className="mt-1 text-[11.5px] text-ink-mid font-semibold">
              권한이 없는 포털은 표시되지 않습니다. 특권 역할은 별도 승인 후 반영됩니다.
            </p>
          </div>
          <span className="text-[10.5px] font-bold text-ink-light">RBAC · SSO Claim · SoD</span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {visiblePortals.map((portal, index) => (
            <PortalCard key={portal.id} portal={portal} index={index + 1} entry={portalEntryFor(persona, portal)} />
          ))}
        </div>

        <div className="mt-5 grid lg:grid-cols-[1fr_1fr_1fr] border border-line-soft bg-white divide-y lg:divide-y-0 lg:divide-x divide-line-soft">
          <CommonCapability
            title="통합 인증"
            description="계열사 선택 후 표준 SAML·OIDC·LDAP Adapter를 통해 IdP로 연결하고 Claim을 표준화합니다."
            tag="ONM-001"
          />
          <CommonCapability
            title="권한 기반 노출"
            description="신원·역할·소속·작업 Namespace를 함께 판정해 포털, 메뉴와 기능 단위로 접근을 제어합니다."
            tag="RBAC · SoD"
          />
          <CommonCapability
            title="계열사 데이터 격리"
            description="1개 공통 + 10개 계열사 Namespace와 저장소 경계로 비인가 교차 접근을 방지합니다."
            tag="SEC-001"
          />
        </div>
      </section>
    </main>
  );
}

function PortalCard({ portal, entry, index }: { portal: PortalDefinition; entry: string; index: number }) {
  return (
    <article className={cn('group bg-white border border-line-soft border-t-[3px] min-h-[250px] p-5 sm:p-6 transition-shadow hover:shadow-md', accentClass[portal.accent])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={cn('text-[9.5px] font-black tracking-[1.2px]', accentText[portal.accent])}>{portal.eyebrow}</div>
          <h3 className="mt-1.5 text-[20px] font-black text-ink tracking-[-.4px]">{portal.title}</h3>
        </div>
        <span className="text-[28px] leading-none font-black text-line tabular-nums">0{index}</span>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed font-semibold text-ink-mid">{portal.description}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {portal.capabilities.map((item) => (
          <li key={item} className="border border-line bg-surface-soft px-2 py-1 text-[10.5px] font-bold text-ink-dark">{item}</li>
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-line-soft flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to={entry} className="inline-flex items-center gap-2 text-[12px] font-extrabold text-ink group-hover:text-brand">
          포털 시작하기
          <span aria-hidden className="text-[15px]">›</span>
        </Link>
        {portal.secondary?.map((item) => (
          <Link key={item.to} to={item.to} className="text-[10.5px] font-bold text-ink-mid hover:text-ink underline-offset-4 hover:underline">
            {item.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] text-ink-light font-bold">{label}</div>
      <div className="mt-0.5 text-[11.5px] font-extrabold text-ink-dark truncate">{value}</div>
    </div>
  );
}

function CommonCapability({ title, description, tag }: { title: string; description: string; tag: string }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12.5px] font-extrabold text-ink">{title}</h3>
        <span className="text-[9.5px] font-black text-brand">{tag}</span>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-mid font-semibold">{description}</p>
    </div>
  );
}
