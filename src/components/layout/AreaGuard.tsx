import { Link } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import OntologySection from '@/components/ontology/OntologySection';
import { useCurrentPersona } from '@/lib/persona';
import { canAccessArea, canAccessGovernance, type NavArea } from '@/lib/personaView';

/*
 * 이 파일은 접근 통제의 **화면 쪽 짝**을 모아 둔다 —
 *   ① AreaGuard          : 권한 밖 영역 차단
 *   ② ReadOnlyOntologyPage: 영역 권한 없이 한 화면만 읽기 전용으로 여는 예외
 * 둘은 같은 판정(personaView)을 반대편에서 쓰므로 한 파일에 둔다.
 */

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

/* ═══════════════ 읽기 전용 예외 진입 — 근거 그래프 ═══════════════ */

/**
 * 편집 하위 탭을 감추는 스코프 CSS.
 *
 * `OntologySection` 은 첫 번째 자식으로 하위 탭 바(개요 / 그래프 설계 / 데이터 매핑 /
 * Auto-Map / Materialize / 진단 / Query)를 그리고, 기본 탭이 Query 다. 탭 바를
 * 렌더하지 않으면 **조회 뷰 밖으로 나갈 수 없다** — 클래스 병합·삭제 같은 편집
 * 컨트롤은 전부 다른 탭 안에 있기 때문이다.
 *
 * ⚠️ `OntologySection` 은 이 데모의 다른 작업 범위라 컴포넌트에 readOnly 플래그를
 *    넣지 않고 셸에서 잘라 냈다. 하위 탭 바의 위치(카드의 첫 자식)에 의존하므로,
 *    `OntologySection` 의 최상위 구조를 바꿀 때는 이 선택자도 함께 봐야 한다.
 */
const READONLY_ONTOLOGY_CSS = `.ro-onto > .card > div:first-child { display: none !important; }`;

/**
 * 근거 그래프 읽기 전용 화면 — 시연 대본 화면 4 (P0 ★).
 *
 * RFP: RAG-007 Graph RAG(필수) · RAG-008 온톨로지 플랫폼 연계(권고)
 *      2-1 포탈 공통 "접근 가능한 워크스페이스·메뉴·기능만 노출"
 *
 * 일반 사용자는 지식·데이터 워크스페이스 권한이 없다(GNB 에도 안 뜬다).
 * 그런데 챗 답변의 근거를 확인하는 동선은 열려 있어야 한다. 그래서
 * **워크스페이스 셸(사이드바) 밖의 단독 화면**으로, 조회 뷰만 연다.
 *
 * 셸 밖으로 뺀 이유 — 셸 사이드바는 지식 데이터·DB·라우팅·메타데이터 승인처럼
 * 이 계정이 열 수 없는 메뉴를 8개 나열한다. 전부 차단 화면으로 떨어질 링크를
 * 보여 주는 것은 RFP 2-1 의 "권한 기반 화면 구성" 과 정면으로 어긋난다.
 */
export function ReadOnlyOntologyPage() {
  const persona = useCurrentPersona();

  return (
    <div className="max-w-[1360px] mx-auto px-6 pt-[18px] pb-14">
      <style>{READONLY_ONTOLOGY_CSS}</style>

      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: 'AI 어시스턴트', to: '/chat' },
          { label: '근거 그래프' },
        ]}
      />

      <div className="flex items-start gap-3 mt-2 mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px]">답변 근거 그래프</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="pill bg-warn-bg text-warn border border-warn-border">
              🔒 조회 전용
            </span>
            <span className="pill bg-info-bg text-info border border-info-border">
              인프라 🏢 <b>공동존 On-Prem</b>
            </span>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              RAG-007
            </span>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              RAG-008
            </span>
          </div>
        </div>
      </div>

      {/* 왜 조회만 되는지 화면에 적어 둔다 — 시연 중 질문이 나오는 지점이다 */}
      <div className="card px-4 py-3 mb-3 flex items-start gap-2.5">
        <span className="text-[15px] leading-none mt-[1px]" aria-hidden>
          🔒
        </span>
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold text-ink">
            조회 전용으로 열렸습니다 — 답변의 근거를 확인하는 용도입니다
          </div>
          <div className="text-[11px] text-ink-mid font-semibold leading-relaxed mt-0.5">
            현재 계정 <b className="text-ink-dark">{persona?.name ?? '-'}</b>(
            {persona?.rfpRole ?? '-'}) 은 지식·데이터 워크스페이스 권한이 없어 온톨로지
            <b className="text-ink-dark"> 편집(클래스 병합·삭제 · 매핑 · 실체화)</b> 화면은 열리지
            않습니다. 온톨로지 편집은 데이터 담당자·모델러 역할 클레임이 필요하며, 역할 변경은 관리
            콘솔에서 결재를 거칩니다. 이 진입은 감사 원장에 기록됩니다.
          </div>
        </div>
      </div>

      <div className="ro-onto">
        <OntologySection />
      </div>

      <div className="mt-4">
        <Link
          to="/chat"
          className="inline-flex items-center h-8 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >
          ← 대화로 돌아가기
        </Link>
      </div>
    </div>
  );
}
