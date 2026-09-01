import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { setStoredPersona } from '@/lib/persona';
import {
  PERSONA_TENANT_ORDER,
  personasByTenant,
  type PersonaId,
} from '@/data/mockPersonas';
import { TENANTS } from '@/data/tenants';

/**
 * SSO 로그인 게이트웨이.
 *
 * RFP 근거 —
 *  · 2-1 포탈 공통 : "계열사별 SSO 등 통합인증기능 연동 등 권한 기반 화면 구성"
 *  · ONM-001       : "자회사별 Active Directory(AD) 시스템과의 표준 연동 지원"
 *  · 인프라 나-(3) : "공통 포털 웹(각 계열사 접속 전 랜딩 웹페이지 개념)"
 *
 * 그래서 계정을 **역할이 아니라 계열사로 묶어** 보여 준다. 계열사마다 AD 도메인과
 * 연동 방식이 다르다는 것(어댑터가 필요하다는 것)이 이 화면의 논점이다.
 * 실제 운영에서는 IdP 가 계정을 확정하므로 이 목록은 시연용 선택지다.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<PersonaId | null>(null);
  /**
   * "다른 계정 사용" 안내 노출 여부.
   * 로그인 화면은 `Layout` 밖이라 전역 Toaster 가 붙지 않는다 — 안내는 인라인으로 띄운다.
   */
  const [showOtherAccountHint, setShowOtherAccountHint] = useState(false);

  const handleSelect = (id: PersonaId) => {
    setLoadingId(id);
    setStoredPersona(id);
    // 1막은 공통 포털 랜딩(화면 1)에서 시작한다 —
    // 역할에 따라 열리는 워크스페이스(2-1)와 11 Namespace 구조(SEC-001)를 함께 각인시킨다.
    setTimeout(() => navigate('/portal', { replace: true }), 250);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[520px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5">
            <span className="font-black text-brand text-[22px] leading-none tracking-tight">
              BNK
            </span>
            <span className="text-[18px] font-extrabold text-ink tracking-tight">
              그룹 공동 생성형 AI 플랫폼 도입 사업
            </span>
          </div>
          <div className="text-[11.5px] text-ink-mid font-semibold mt-2">
            BNK 그룹 공동 생성형 AI 플랫폼 도입 사업
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-line-soft rounded-lg shadow-sm">
          <div className="px-6 pt-6 pb-4 border-b border-line-soft">
            <h1 className="text-[18px] font-extrabold text-ink tracking-tight">
              SSO 로그인
            </h1>
            <p className="text-[12px] text-ink-mid font-semibold mt-1">
              계열사 AD 계정으로 계속합니다 · 소속 계열사와 역할은 클레임으로 확정됩니다
            </p>
          </div>

          <div className="py-1 max-h-[520px] overflow-auto">
            {PERSONA_TENANT_ORDER.map((t, ti) => {
              const list = personasByTenant(t);
              if (list.length === 0) return null;
              const meta = TENANTS.find((m) => m.name === t);
              return (
                <div key={t}>
                  {ti > 0 && <div className="mx-6 border-t border-line-soft" />}
                  <div className="px-6 pt-3 pb-1.5 flex items-baseline gap-2">
                    <span className="text-[11px] font-extrabold text-ink">{t}</span>
                    <span className="text-[9.5px] font-mono font-semibold text-ink-light">
                      {meta?.adDomain}
                    </span>
                    <span className="ml-auto text-[9.5px] font-semibold text-ink-mid">
                      {meta?.idp}
                    </span>
                  </div>
                  {list.map((p) => {
                    const loading = loadingId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={loadingId !== null}
                        onClick={() => handleSelect(p.id)}
                        className={cn(
                          'w-full grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 px-6 py-2.5 text-left transition-colors',
                          loading ? 'bg-brand-bg' : 'hover:bg-surface-soft',
                          loadingId !== null && !loading && 'opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'w-9 h-9 rounded-full inline-flex items-center justify-center text-[13px] font-extrabold border',
                            loading
                              ? 'bg-brand-dark text-white border-brand-dark'
                              : 'bg-brand-tint text-brand border-brand-tint',
                          )}
                        >
                          {p.initial}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-extrabold text-ink truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-ink-mid font-semibold truncate">
                            {p.role} · {p.dept}
                          </div>
                        </div>
                        {/* 역할 클레임 — 로그인 후 GNB·워크스페이스 노출을 결정한다 */}
                        <span className="pill bg-surface-soft text-ink-mid border border-line-soft whitespace-nowrap">
                          {p.rfpRole}
                        </span>
                        <span
                          className={cn(
                            'text-[16px] font-black transition-transform',
                            loading ? 'text-ink-mid' : 'text-ink-light',
                          )}
                        >
                          {loading ? '…' : '›'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/*
            `href="#"` 는 HashRouter 에서 해시를 비워 홈으로 튕긴다. 갈 곳이 따로 없는
            링크이므로 버튼으로 바꾸고 인라인 안내만 펼친다.
          */}
          <div className="px-6 py-3 border-t border-line-soft flex items-center justify-between text-[10.5px] text-ink-mid font-semibold">
            <span>🔒 그룹 통합 SSO · 자회사별 AD 연동 (ONM-001)</span>
            <button
              type="button"
              onClick={() => setShowOtherAccountHint((v) => !v)}
              className="hover:text-ink-dark underline-offset-2 hover:underline"
            >
              다른 계정 사용
            </button>
          </div>
          {showOtherAccountHint && (
            <div className="px-6 py-2.5 border-t border-line-soft bg-surface-soft/60 text-[10.5px] text-ink-mid font-semibold leading-relaxed">
              계정은 소속 계열사 IdP 가 확정합니다. 실제 운영에서는 계열사 AD 로그인 페이지로
              이동하며, 이 화면의 목록은 <b className="text-ink-dark">시연용 선택지</b>입니다.
              위에서 계정을 선택해 주세요.
            </div>
          )}
        </div>

        <div className="text-center text-[10.5px] text-ink-light font-semibold mt-5">
          © 2026 BNK금융그룹 · 제안 시연용 데모
        </div>
      </div>
    </div>
  );
}
