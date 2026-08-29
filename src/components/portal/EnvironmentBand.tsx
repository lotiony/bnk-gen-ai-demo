/**
 * 공통 포털 랜딩 하단의 시연 환경 밴드.
 *
 * RFP: Ⅱ.3.나(3) 11개 Namespace(계열사 10 + 공통 포털 웹 1) · SEC-001 · ONM-001
 *
 * ── 왜 이렇게 줄였나 ───────────────────────────────────────────────
 * 처음에는 옛 계열사 랜딩을 통째로 여기에 붙였다(그룹 공통 대형 카드 + 계열사
 * 10장 그리드 + 격리 원칙 4단). 구조는 다 들어갔지만 랜딩의 주인공인 **포털
 * 카드가 묻혔고**, 화면이 두 번 스크롤됐다.
 *
 * 그래서 남길 것만 남겼다 —
 *   · 11칸 클러스터 스트립 : 한 줄이면서 "한 덩어리 안에 나뉘어 있다" 를
 *                            가장 빠르게 보여 준다. RFP 인프라 요건의 그림 근거.
 *   · 사실 4칸             : Namespace 수 · IdP 종류 · 격리 방식 · 요건 건수.
 *
 * 걷어낸 것(계열사별 이용자·에이전트 수, 격리 원칙 서술 4단)은 관리 콘솔과
 * 마켓플레이스가 이미 더 정확하게 말하고 있다. 랜딩에서 같은 말을 두 번 하면서
 * 포털 선택을 가릴 이유가 없다.
 *
 * ⚠️ 계열사 **전환**은 상단바 `TenantSwitcher` 가 담당한다. 여기 스트립은
 *    읽기 전용 그림이다 — 눌러서 바뀌는 것처럼 보이면 SEC-001 잠금 규칙이
 *    두 벌이 된다.
 */
import { cn } from '@/lib/utils';
import { useTenant } from '@/lib/tenantStore';
import { TENANTS } from '@/data/tenants';

const AFFILIATES = TENANTS.filter((t) => t.kind === 'affiliate');
/** 계열사마다 연동 방식이 달라 어댑터가 필요하다는 것이 이 수치의 논점이다(ONM-001). */
const IDP_KINDS = new Set(AFFILIATES.map((t) => t.idp)).size;

export default function EnvironmentBand() {
  const active = useTenant();

  return (
    <section className="card px-6 py-4">
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.5px]">
          Demo Environment
        </span>
        <h2 className="text-[13px] font-extrabold text-ink">공동존 시연 환경</h2>
        <span className="ml-auto text-[11px] text-ink-mid font-semibold">
          100% On-Premise 가정 · 계열사 내부망과 네트워크 격리
        </span>
      </div>

      {/* 한 덩어리 안에 11칸이 나뉘어 있는 그림 — 폭은 균등하다(사용량이 아니라 구조) */}
      <div className="flex gap-[3px]">
        {TENANTS.map((t) => (
          <div
            key={t.name}
            className={cn(
              'flex-1 min-w-0 rounded-sm px-2 py-1.5 border text-center',
              t.kind === 'group'
                ? 'bg-ink/[0.04] border-ink/25 text-ink'
                : t.name === active
                  ? 'bg-brand-tint border-brand text-brand'
                  : 'bg-surface-soft border-line-soft text-ink-mid',
            )}
          >
            <div className="text-[10.5px] font-extrabold truncate">{t.short}</div>
            <div className="text-[8.5px] font-mono text-ink-light truncate mt-[1px]">
              {t.namespace}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-6 mt-3.5 pt-3 border-t border-line-soft">
        <Fact k="Namespace" v={`${TENANTS.length}개`} d={`계열사 ${AFFILIATES.length} + 공통 포털 웹 1`} />
        <Fact k="통합인증" v={`${IDP_KINDS}종 IdP`} d="계열사별 AD 연동 어댑터 (ONM-001)" />
        <Fact k="격리" v="NetworkPolicy" v2="기본 차단" d="Namespace 별 전용 볼륨 분리 (SEC-001)" />
        <Fact k="기술요건" v="62건" d="필수 46 · 권고 16" />
      </div>
    </section>
  );
}

function Fact({ k, v, v2, d }: { k: string; v: string; v2?: string; d: string }) {
  return (
    <div className="border-l-2 border-line-soft pl-3">
      <div className="text-[9px] text-ink-light font-extrabold uppercase tracking-[0.4px]">{k}</div>
      <div className="text-[14px] font-extrabold text-ink leading-tight mt-0.5">
        {v}
        {v2 && <span className="text-[11px] font-bold text-ink-mid ml-1">{v2}</span>}
      </div>
      <div className="text-[10px] text-ink-mid font-semibold mt-0.5 leading-snug">{d}</div>
    </div>
  );
}
