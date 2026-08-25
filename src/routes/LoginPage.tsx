import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PERSONAS, setStoredPersona } from '@/lib/persona';
import type { PersonaGroup, PersonaId } from '@/data/mockPersonas';

const GROUPS: PersonaGroup[] = ['관리자', '개발자', '사용자'];

/**
 * SSO 계정 선택 스타일 로그인 페이지.
 * 실제로는 KB Digital Identity SSO 로 자동 로그인되지만,
 * 데모 편의를 위해 계정 목록을 노출하고 클릭 시 즉시 로그인 처리.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<PersonaId | null>(null);

  const handleSelect = (id: PersonaId) => {
    setLoadingId(id);
    setStoredPersona(id);
    setTimeout(() => navigate('/', { replace: true }), 250);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[460px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5">
            <span className="bg-kb-yellow px-3 py-1.5 rounded-md text-ink font-black text-lg leading-none">
              KB
            </span>
            <span className="text-[18px] font-extrabold text-ink tracking-tight">
              GenAI Portal 2.0
            </span>
          </div>
          <div className="text-[11.5px] text-ink-mid font-semibold mt-2">
            KB금융그룹 AI Agent 운영 플랫폼
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-line-soft rounded-lg shadow-sm">
          <div className="px-6 pt-6 pb-4 border-b border-line-soft">
            <h1 className="text-[18px] font-extrabold text-ink tracking-tight">
              SSO 로그인
            </h1>
            <p className="text-[12px] text-ink-mid font-semibold mt-1">
              계속할 계정을 선택하세요
            </p>
          </div>

          <div className="py-1">
            {GROUPS.map((g, gi) => {
              const list = PERSONAS.filter((p) => p.group === g);
              return (
                <div key={g}>
                  {gi > 0 && <div className="mx-6 border-t border-line-soft" />}
                  <div className="px-6 pt-3 pb-1 text-[9.5px] font-extrabold tracking-[0.4px] uppercase text-ink-light">
                    {g}
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
                          'w-full grid grid-cols-[36px_1fr_auto] items-center gap-3 px-6 py-2.5 text-left transition-colors',
                          loading
                            ? 'bg-kb-yellow-bg'
                            : 'hover:bg-surface-soft',
                          loadingId !== null && !loading && 'opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'w-9 h-9 rounded-full inline-flex items-center justify-center text-[13px] font-extrabold border',
                            loading
                              ? 'bg-kb-yellow-dark text-white border-kb-yellow-dark'
                              : 'bg-kb-yellow text-ink border-kb-yellow-dark',
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

          <div className="px-6 py-3 border-t border-line-soft flex items-center justify-between text-[10.5px] text-ink-mid font-semibold">
            <span>🔒 KB Digital Identity SSO</span>
            <a href="#" className="hover:text-ink-dark">
              다른 계정 사용
            </a>
          </div>
        </div>

        <div className="text-center text-[10.5px] text-ink-light font-semibold mt-5">
          © 2026 KB Financial Group · Internal Use Only
        </div>
      </div>
    </div>
  );
}
