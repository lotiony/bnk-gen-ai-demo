import { useEffect, useState } from "react";
import { brandName } from "../brand";

/**
 * 브랜드 요금제 모달 (A-Dark 버전).
 * SaaS / 온프렘 두 트랙 토글. Raycast 다크 팔레트(항상 다크로 표시).
 * ref: https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8
 *
 * kt 컨벤션(inline style)에 맞춤. self-contained 팔레트라 앱 테마와 독립.
 * Max(SaaS) / Enterprise Plus(온프렘) 티어에 MCP Composer 기능 강조.
 */

// ── A-Dark 팔레트 ───────────────────────────
const C = {
  bg: "#040506", card: "#07080a", well: "#111214",
  line: "rgba(255,255,255,.09)",
  text: "#ffffff", ash: "#9c9c9d", smoke: "#6a6b6c",
  coral: "#ff6363", sky: "#63a1ff", green: "#59d499",
};

// 변환 크레딧 — 비정형 문서 파싱·MCP 생성에 드는 LLM 원가를 계량하는 단위.
// 1 크레딧 = 문서 1페이지 = API 엔드포인트 1개 = 코드 파일 1개.
// BYO Key(고객 Azure 키) 연결 시 변환도 고객 계정에서 실행 → 차감 면제.
const SAAS_PLANS = [
  {
    name: "Free", desc: "개발자 무료 — 학습·PoC 시작점",
    price: "₩0", priceSub: "/월 · 1좌석",
    selLabel: "TOOL SELECTOR · MANUAL",
    selDesc: "사용자가 tool call 대상 tool 을 직접 지정·매핑",
    credits: "월 50 크레딧 · BYO Key 필수",
    features: [
      "월 1,000 요청 (BYO LLM Key)", "Tool 3개 · MCP 1개", "기본 벡터 검색 (RAG)",
      "Tracing 3일", "커뮤니티 지원",
      { text: "팀 좌석 추가", off: true },
      { text: "SSO · 감사 로그", off: true },
    ],
    cta: "무료 시작",
  },
  {
    name: "Pro", desc: "실서비스 표준 — 좌석·크레딧으로 연속 확장",
    price: "₩390,000", priceSub: "/월 · 5좌석 포함, 추가 ₩49,000/좌석",
    selLabel: "TOOL SELECTOR · LLM+",
    selDesc: "LLM 자동 선택 + 고급 의도 라우팅·컨텍스트 압축",
    credits: "온보딩 3,000(1회) + 월 1,000 · 초과 ₩150/크레딧 · BYO Key 연결 시 차감 면제",
    features: [
      "월 200,000 요청 + 초과 종량", "Tool 100개 · MCP 20개", "벡터 + Reranker 검색",
      "SSO · 감사 로그", "Tracing 30일 · A/B 평가", "업무시간 지원 · SLA 99.5%",
    ],
    cta: "현재 플랜", current: true,
  },
  {
    name: "Max", desc: "전용 인스턴스 + 최고 정확도 selector",
    price: "맞춤 견적", priceSub: "전용 인스턴스 · 연 계약",
    selLabel: "TOOL SELECTOR · HYBRID",
    selDesc: "Embedding + LLM 하이브리드 — 대규모 tool 셋 고정확도, 한화손보 Agent 검증 기술",
    credits: "크레딧 협의 · 대용량 변환은 별도 프로젝트 견적",
    composer: true,
    features: [
      "Fair-use 무제한 · 모델 라우팅", "Tool · MCP 무제한", "하이브리드 검색 + 도메인 튜닝",
      "Tracing 무제한 + 대시보드", "전용(Single-tenant) 인스턴스",
      "전담 매니저 · SLA 99.9%",
    ],
    cta: "업그레이드", featured: true,
  },
];

const ONPREM_PLANS = [
  {
    name: "Managed Private", desc: "고객 VPC에 당사가 설치·운영",
    price: "₩7,000만~", priceSub: "/연 · 구축비 별도",
    selLabel: "TOOL SELECTOR · LLM (MCP)",
    selDesc: "LLM 기반 자동 선택 — 고객사 Azure OpenAI 연동",
    credits: "변환도 고객 LLM 키로 실행 — 크레딧 차감 없음",
    features: [
      "고객 Azure VNet 내 설치", "당사 원격 운영(Managed)", "고객사 LLM 엔드포인트 연동(BYO)",
      "벡터 + Reranker 검색", "월 정기 업데이트", "원격 기술 지원",
      { text: "HA(이중화) 구성", off: true },
      { text: "MCP Composer", off: true },
    ],
    cta: "도입 문의",
  },
  {
    name: "Enterprise", desc: "금융권 표준 — HA·관측·보안 풀스택",
    price: "맞춤 견적", priceSub: "연 라이선스 + 구축 프로젝트",
    selLabel: "TOOL SELECTOR · HYBRID",
    selDesc: "Embedding + LLM 하이브리드 — 한화손보 Agent 에 실제 구축·검증된 구성",
    credits: "변환도 고객 LLM 키로 실행 — 크레딧 차감 없음",
    features: [
      "HA(이중화) 클러스터 구성", "Self-hosted 관측 스택 (Langfuse)",
      "하이브리드 검색 + 도메인 튜닝", "SSO · AD 연동 · 감사 로그",
      "분기 업데이트 + 보안 패치", "전담 기술 지원",
      { text: "MCP Composer", off: true },
    ],
    cta: "도입 문의", featured: true,
  },
  {
    name: "Enterprise Plus", desc: "폐쇄망·규제 산업 미션 크리티컬",
    price: "맞춤 견적", priceSub: "연 라이선스 + 구축 + 운영",
    selLabel: "TOOL SELECTOR · HYBRID+",
    selDesc: "하이브리드 + 고객 도메인 임베딩 튜닝, 폐쇄망 내 전체 파이프라인 구동",
    credits: "폐쇄망 내 고객 LLM 로 전 과정 실행 — 크레딧 차감 없음",
    composer: true,
    features: [
      "폐쇄망(Air-gapped) 설치", "DR(재해복구) 구성", "커스텀 tool·에이전트 개발 포함",
      "도메인 임베딩 튜닝", "핫픽스 즉시 대응", "상주·전담 엔지니어", "SLA 99.9%",
    ],
    cta: "도입 문의",
  },
];

function ComposerBadge({ accent }) {
  return (
    <div style={{
      margin: "12px 0 0", padding: "11px 12px", borderRadius: 10,
      background: "rgba(255,255,255,.04)", border: `1px dashed ${accent}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: accent, letterSpacing: ".3px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="8.5" y="14" width="7" height="7" rx="1.5" /><path d="M6.5 10v2.5M17.5 10v2.5M12 14v-1.5H6.5M17.5 12.5H12" />
        </svg>
        MCP COMPOSER
      </div>
      <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: C.ash }}>
        여러 MCP 를 조합해 <b style={{ color: C.text }}>새로운 MCP 를 생성</b>하는 에디터.
        기존 tool 을 블록처럼 엮어 복합 워크플로 MCP 를 직접 설계·배포.
      </div>
    </div>
  );
}

function PlanCard({ plan, deploy }) {
  const accent = deploy === "saas" ? C.coral : C.sky;
  const featured = plan.featured;
  return (
    <div style={{
      position: "relative",
      border: featured ? `2px solid ${accent}` : `1px solid ${C.line}`,
      borderRadius: 16, padding: "24px 20px", display: "flex", flexDirection: "column",
      boxShadow: featured ? `0 12px 40px ${deploy === "saas" ? "rgba(255,99,99,.16)" : "rgba(99,161,255,.16)"}` : "none",
      background: featured
        ? `linear-gradient(165deg, ${deploy === "saas" ? "#452324" : "#02193b"} 0%, ${C.card} 52%)`
        : C.card,
    }}>
      {featured && (
        <span style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: accent, color: deploy === "saas" ? "#fff" : "#02193b",
          fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap",
        }}>
          {deploy === "saas" ? "추천" : "한화손보 Agent 구축 모델"}
        </span>
      )}
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{plan.name}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: C.ash, minHeight: 32 }}>{plan.desc}</div>
      <div style={{ margin: "14px 0 2px", fontSize: 24, fontWeight: 800, letterSpacing: "-1px", color: C.text }}>
        {plan.price}
        {plan.priceSub?.startsWith("/") && <small style={{ fontSize: 13, fontWeight: 500, color: C.smoke }}> {plan.priceSub}</small>}
      </div>
      <div style={{ fontSize: 11, color: C.smoke, minHeight: 14 }}>
        {plan.priceSub && !plan.priceSub.startsWith("/") ? plan.priceSub : " "}
      </div>

      <div style={{ margin: "14px 0 8px", padding: "11px 12px", borderRadius: 10, background: C.well, color: C.ash, fontSize: 12, lineHeight: 1.5 }}>
        <b style={{ display: "block", fontSize: 11, marginBottom: 4, letterSpacing: ".5px", color: accent }}>{plan.selLabel}</b>
        {plan.selDesc}
      </div>

      {/* 변환 크레딧 — 문서 파싱·MCP 생성 LLM 원가의 계량 단위(플랜별 상한) */}
      {plan.credits && (
        <div style={{ padding: "11px 12px", borderRadius: 10, background: C.well, border: `1px solid ${C.line}`, color: C.ash, fontSize: 12, lineHeight: 1.5 }}>
          <b style={{ display: "block", fontSize: 11, marginBottom: 4, letterSpacing: ".5px", color: C.green }}>변환 크레딧</b>
          {plan.credits}
        </div>
      )}

      {plan.composer && <ComposerBadge accent={accent} />}

      <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, flex: 1 }}>
        {plan.features.map((f, i) => {
          const off = typeof f === "object" && f.off;
          const text = typeof f === "object" ? f.text : f;
          const isComposer = text === "MCP Composer";
          return (
            <li key={i} style={{
              padding: "7px 0", fontSize: 12.5, display: "flex", gap: 8, alignItems: "flex-start",
              borderBottom: `1px dashed ${C.line}`, color: off ? "#454647" : C.ash,
            }}>
              <span style={{ color: off ? "#2f3031" : C.green, fontWeight: 700 }}>{off ? "—" : "✓"}</span>
              <span style={isComposer && !off ? { color: accent, fontWeight: 700 } : undefined}>{text}</span>
            </li>
          );
        })}
      </ul>

      <button
        disabled={plan.current}
        style={{
          marginTop: 20, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: plan.current ? "default" : "pointer",
          border: featured ? `1px solid ${accent}` : "1px solid rgba(255,255,255,.22)",
          borderStyle: plan.current ? "dashed" : "solid",
          background: featured ? accent : "transparent",
          color: featured ? (deploy === "saas" ? "#fff" : "#02193b") : "#e6e6e6",
          opacity: plan.current ? 0.55 : 1,
        }}
      >
        {plan.cta}
      </button>
    </div>
  );
}

export default function PricingModal({ open, onClose, brand }) {
  const [deploy, setDeploy] = useState("saas");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const plans = deploy === "saas" ? SAAS_PLANS : ONPREM_PLANS;
  const accent = deploy === "saas" ? C.coral : C.sky;

  const toggleBtn = (id, t1, t2) => {
    const on = deploy === id;
    return (
      <button onClick={() => setDeploy(id)} style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "8px 26px", border: "none", borderRadius: 999, cursor: "pointer",
        background: on ? "#e6e6e6" : "transparent", fontFamily: "var(--sans)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: on ? "#1b1c1e" : C.smoke }}>{t1}</span>
        <span style={{ fontSize: 11, marginTop: 2, color: on ? "#454647" : "#454647" }}>{t2}</span>
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 1040, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto",
        background: C.bg, borderRadius: 22, padding: "28px 26px 26px",
        border: "1px solid rgba(255,255,255,.1)", animation: "popIn .16s ease",
        fontFamily: "'Inter', var(--sans)", color: C.text, position: "relative",
      }}>
        {/* 닫기 */}
        <button onClick={onClose} aria-label="닫기" style={{
          position: "absolute", top: 18, right: 18, width: 32, height: 32, borderRadius: 9,
          border: `1px solid ${C.line}`, background: C.well, color: C.ash, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {/* 헤더 */}
        <div style={{ textAlign: "center", padding: "4px 12px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 8 }}>
            <span style={{ color: "#9db4ff" }}>{brandName(brand)}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-.5px", color: C.text }}>구축 방식과 플랜을 선택하세요</h1>
          <p style={{ marginTop: 8, color: C.ash, fontSize: 14 }}>클라우드 구독형(SaaS)과 고객사 인프라 설치형(온프렘)을 제공합니다.</p>

          <div style={{ display: "inline-flex", marginTop: 18, background: C.well, border: `1px solid ${C.line}`, borderRadius: 999, padding: 5, gap: 4 }}>
            {toggleBtn("saas", "SaaS", "월 구독 · 즉시 시작")}
            {toggleBtn("onprem", "온프렘", "연 라이선스 · 자체 인프라")}
          </div>
          <div style={{ marginTop: 12, fontSize: 12.5, color: C.smoke }}>
            {deploy === "saas"
              ? <><b style={{ color: C.coral }}>SaaS</b> — 당사 클라우드에서 운영, 즉시 시작</>
              : <><b style={{ color: C.sky }}>온프렘</b> — 고객사 Azure VNet·데이터센터에 설치, 데이터 외부 반출 없음</>}
          </div>
        </div>

        {/* 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${plans.length}, 1fr)`, gap: 18, padding: "26px 8px 8px" }}>
          {plans.map((p) => <PlanCard key={p.name} plan={p} deploy={deploy} />)}
        </div>

        {/* MCP Composer 안내 (하단) */}
        <div style={{ margin: "10px 8px 0", padding: "14px 16px", borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ash, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.line}` }}>
            <b style={{ color: C.green }}>변환 크레딧</b> 은 비정형 문서 파싱·MCP 생성에 드는 연산량의 계량 단위입니다 —
            <b style={{ color: C.text }}> 1 크레딧 = 문서 1페이지 = API 엔드포인트 1개 = 코드 파일 1개</b>.
            {deploy === "saas"
              ? " 고객사 LLM 키(BYO Key)를 연결하면 변환도 고객 계정에서 실행되어 크레딧이 차감되지 않습니다. 대용량 일괄 변환은 별도 프로젝트로 견적합니다."
              : " 온프렘은 전 과정이 고객사 LLM 엔드포인트에서 실행되므로 크레딧 개념이 적용되지 않습니다."}
          </div>
          <b style={{ color: accent }}>MCP Composer</b> 는 최상위 플랜({deploy === "saas" ? "Max" : "Enterprise Plus"}) 전용 기능입니다 —
          이미 등록된 여러 MCP 를 캔버스에서 블록처럼 조합해 <b style={{ color: C.text }}>새로운 복합 MCP 를 생성</b>하고,
          그 자체를 하나의 tool 로 배포할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
