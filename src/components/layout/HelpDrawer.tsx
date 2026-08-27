import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { ONBOARDING, HELP_TOPICS, USAGE_EXAMPLES } from '@/data/mockOnboarding';
import { toast } from '@/lib/toast';

/**
 * 도움말 · 온보딩 드로어 — 상단바 ❔ 로 연다.
 *
 * RFP 2-1 포탈 구축 공통:
 *   "튜토리얼·가이드 제공: 일반 사용자도 쉽게 사용 가능한 **온보딩 가이드,
 *    기능별 도움말, 활용 예시** 제공"
 *
 * 세 가지를 각각 탭으로 나눴다. 온보딩은 **역할별로 다른 3단계**를 보여 준다 —
 * 일반 사용자와 데이터 담당자의 첫 화면이 같을 수 없다.
 */
export default function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'start' | 'help' | 'example'>('start');
  const persona = useCurrentPersona();
  const steps = persona ? ONBOARDING[persona.rfpRole] : [];

  // ESC 로 닫기 — 시연 중 마우스로 X 를 찾게 만들지 않는다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="도움말 · 온보딩 가이드"
        aria-label="도움말"
        className="cursor-pointer text-ink-dark hover:text-brand"
      >
        ❔
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-ink/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="relative w-[420px] max-w-full h-full bg-white border-l border-line shadow-xl flex flex-col">
            {/* 헤더 */}
            <div className="px-5 pt-4 pb-3 border-b border-line-soft">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-extrabold text-ink">도움말</h2>
                  <p className="text-[11px] text-ink-mid font-semibold mt-0.5">
                    {persona ? (
                      <>
                        <b className="text-ink-dark">{persona.rfpRole}</b> 기준 가이드 ·{' '}
                        {persona.tenant}
                      </>
                    ) : (
                      '로그인 후 역할별 가이드가 표시됩니다'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[16px] font-black text-ink-light hover:text-ink-dark leading-none"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-1 mt-3 -mb-3">
                {(
                  [
                    { k: 'start' as const, label: '온보딩 가이드' },
                    { k: 'help' as const, label: '기능별 도움말' },
                    { k: 'example' as const, label: '활용 예시' },
                  ]
                ).map((t) => (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => setTab(t.k)}
                    className={cn(
                      'px-2.5 py-2 text-[11.5px] font-extrabold border-b-2',
                      tab === t.k
                        ? 'text-brand border-brand'
                        : 'text-ink-mid border-transparent hover:text-ink-dark',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'start' && (
                <ol className="space-y-2.5">
                  {steps.map((s, i) => (
                    <li key={s.title} className="border border-line-soft rounded px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-[18px] h-[18px] rounded-full bg-brand-dark text-white inline-flex items-center justify-center text-[10px] font-extrabold">
                          {i + 1}
                        </span>
                        <span className="text-[12.5px] font-extrabold text-ink">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-ink-dark font-semibold leading-relaxed">
                        {s.desc}
                      </p>
                      {s.to && (
                        <Link
                          to={s.to}
                          onClick={() => setOpen(false)}
                          className="inline-block mt-1.5 text-[11px] font-extrabold text-info hover:underline"
                        >
                          바로 열기 →
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {tab === 'help' && (
                <div className="space-y-2">
                  {HELP_TOPICS.map((t) => (
                    <details
                      key={t.q}
                      className="border border-line-soft rounded px-3 py-2.5 [&[open]]:bg-surface-soft"
                    >
                      <summary className="text-[12px] font-extrabold text-ink cursor-pointer list-none flex items-center gap-2">
                        <span className="flex-1">{t.q}</span>
                        {t.req && (
                          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip text-[9px]">
                            {t.req}
                          </span>
                        )}
                      </summary>
                      <p className="text-[11px] text-ink-dark font-semibold leading-relaxed mt-1.5">
                        {t.a}
                      </p>
                    </details>
                  ))}
                </div>
              )}

              {tab === 'example' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-ink-mid font-semibold leading-snug mb-2.5">
                    그대로 복사해 대화창에 붙여 넣어 볼 수 있는 예시다.
                  </p>
                  {USAGE_EXAMPLES.map((e) => (
                    <div key={e.prompt} className="border border-line-soft rounded px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="pill bg-brand-tint text-brand border border-brand-tint">
                          {e.category}
                        </span>
                        <button
                          type="button"
                          onClick={() => toast('예시 프롬프트를 복사했습니다')}
                          className="ml-auto text-[10.5px] font-extrabold text-ink-mid hover:text-brand"
                        >
                          복사
                        </button>
                      </div>
                      <p className="text-[11.5px] text-ink font-semibold leading-relaxed">
                        {e.prompt}
                      </p>
                      <p className="text-[10.5px] text-ink-mid font-semibold mt-1">
                        → {e.expect}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-line-soft text-[10px] text-ink-mid font-semibold">
              화면마다 우측 상단 <b className="text-ink-dark">❔</b> 로 언제든 열 수 있습니다 · ESC
              로 닫기
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
