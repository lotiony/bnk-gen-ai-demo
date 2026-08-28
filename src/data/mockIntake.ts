/**
 * 모델 · 데이터 반입 승인 mock.
 *
 * RFP 2-1 관리자 포털:
 *   "**모델·데이터 반입 승인 화면**: 반입 요청·검사 결과·승인 처리 현황"
 *
 * 배포 승인(LSM-009)과 다른 화면이다. 배포 승인은 "만든 것을 운영에 올릴까"를 묻고,
 * 반입 승인은 **"바깥 것을 공동존 안으로 들일까"** 를 묻는다. 공동존은 10개 계열사가
 * 공유하는 상면이라 반입 통제가 곧 SEC-004(민감정보 유입 사전 차단)의 관문이다.
 *
 * 검사 항목은 대상 종류에 따라 다르다 —
 *   · 모델 : 라이선스 · 취약점(직렬화 포맷) · 벤치마크 · 편향 검증
 *   · 데이터: 개인정보 스캔 · 권원(동의·계약) · DRM 해제 가능 여부 · 포맷 파싱
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type IntakeKind = '모델' | '데이터';
export type IntakeState = '검사 중' | '승인 대기' | '승인' | '반려';
export type CheckResult = 'pass' | 'warn' | 'fail' | 'running';

export interface IntakeCheck {
  name: string;
  result: CheckResult;
  /** 검사 요약 — 왜 이 결과가 나왔는가. */
  detail: string;
}

export interface IntakeRequest {
  id: string;
  kind: IntakeKind;
  /** 반입 대상 이름. */
  target: string;
  /** 어디서 들어오는가. */
  source: string;
  tenant: Tenant;
  requestedBy: string;
  requestedAt: string;
  /** 반입 사유. */
  reason: string;
  /** 반입 후 놓일 자리. */
  destination: string;
  /** 용량 — 데이터는 GB, 모델은 파라미터 규모. */
  size: string;
  state: IntakeState;
  checks: IntakeCheck[];
  /** 승인·반려 처리자와 코멘트. */
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export const INTAKE_REQUESTS: IntakeRequest[] = [
  {
    id: 'IN-2043',
    kind: '모델',
    target: 'onprem/bge-reranker-ko-v3',
    source: '외부 반입 매체 (오프라인 · 해시 검증)',
    tenant: '그룹 공통',
    requestedBy: '민모델',
    requestedAt: '2026-06-02 09:24',
    reason: '한국어 재순위 품질 개선 — 규정 인덱스 Top-K 정확도 보강',
    destination: '모델 카탈로그 · 리랭커 풀',
    size: '0.6B · 2.4GB (safetensors)',
    state: '승인 대기',
    checks: [
      { name: '라이선스 검토', result: 'pass', detail: 'Apache-2.0 · 상업적 이용 허용' },
      {
        name: '직렬화 포맷 취약점',
        result: 'pass',
        detail: 'safetensors 포맷 — pickle 역직렬화 임의코드 실행 위험 없음',
      },
      { name: '무결성 해시', result: 'pass', detail: 'SHA-256 일치 · 반입 매체 서명 검증 통과' },
      {
        name: '벤치마크',
        result: 'running',
        detail: '규정 인덱스 재순위 정확도 측정 진행 중 (58%)',
      },
    ],
  },
  {
    id: 'IN-2041',
    kind: '모델',
    target: 'kakao/kanana-flag-32.5B-it',
    source: '외부 반입 매체 (오프라인 · 해시 검증)',
    tenant: '그룹 공통',
    requestedBy: '민모델',
    requestedAt: '2026-05-21 10:12',
    reason: '한국어 금융 도메인 응답 품질 비교 후보 · 현행 대비 요약 정확도 개선 기대',
    destination: '모델 카탈로그 · 학습계 서빙',
    size: '32.5B · 65GB (safetensors)',
    /*
     * 게시판 공지(`mockContent` NTC-039 「kanana-flag-32.5B 반입 완료 안내」,
     * 2026-05-28 게시)가 이미 "반입 완료" 를 알리고 있다. 이 건이 '승인 대기' 로
     * 남아 있으면 같은 사실을 두 화면이 다르게 말한다. 공지보다 하루 앞선
     * 05-27 에 **조건부 승인** 으로 닫는다 — 편향 셋이 기준 미달(warn)이라
     * 학습계 한정으로만 열었고, 그 조건이 `mockModels` 의 화이트리스트 표기와
     * 이어진다.
     */
    state: '승인',
    decidedBy: '임정보',
    decidedAt: '2026-05-27 16:40',
    note: '학습계 한정 조건부 승인 — 편향 셋 기준 미달로 대고객 서빙계 승격은 별도 결재 필요',
    checks: [
      {
        name: '라이선스 검토',
        result: 'pass',
        detail: '상업적 이용 허용 · 재배포 조건 없음 · 법무 검토 완료',
      },
      {
        name: '직렬화 포맷 취약점',
        result: 'pass',
        detail: 'safetensors 포맷 — pickle 역직렬화 임의코드 실행 위험 없음',
      },
      {
        name: '무결성 해시',
        result: 'pass',
        detail: 'SHA-256 일치 · 반입 매체 서명 검증 통과',
      },
      {
        name: '편향 · 유해표현 사전 검증',
        result: 'warn',
        detail: 'RT-D 편향 셋 차단율 91.2% — 기준(95%) 미달. 시스템 프롬프트 보강 후 재측정 필요',
      },
      {
        name: '벤치마크',
        result: 'pass',
        detail: '내부 금융 QA 셋 기준 현행 대비 +4.1%p',
      },
    ],
  },
  {
    id: 'IN-2039',
    kind: '데이터',
    target: '여신 상담 녹취 전사본 2025H2',
    source: '부산은행 콜센터 NAS',
    tenant: '부산은행',
    requestedBy: '조디비',
    requestedAt: '2026-05-31 16:40',
    reason: '민원 분류 에이전트 학습·평가셋 보강',
    destination: 'ns-bank-bs · Object Storage → 지식 인덱스',
    size: '41,200건 · 18.4GB',
    state: '검사 중',
    checks: [
      {
        name: '개인정보 스캔',
        result: 'fail',
        detail:
          '주민등록번호 패턴 312건 · 계좌번호 1,847건 검출 — 비식별 처리 전에는 공동존 유입 불가(SEC-004)',
      },
      {
        name: '권원 확인',
        result: 'pass',
        detail: '녹취 활용 동의 취득 건만 추출 · 동의 이력 ID 매핑 완료',
      },
      { name: 'DRM 해제 가능 여부', result: 'pass', detail: '부산은행 DRM 연동 모듈로 복호화 가능' },
      { name: '포맷 파싱', result: 'running', detail: '전사본 JSON 스키마 검증 진행 중 (72%)' },
    ],
  },
  {
    id: 'IN-2036',
    kind: '데이터',
    target: '상품 매뉴얼 2026 개정판',
    source: '경남은행 KMS',
    tenant: '경남은행',
    requestedBy: '남데이터',
    requestedAt: '2026-05-30 09:05',
    reason: '지식/상품 어시스턴트(GRP-007) 인덱스 구축',
    destination: 'ns-bank-kn · 지식 인덱스',
    size: '1,240건 · 3.1GB (HWP·PDF)',
    state: '승인',
    decidedBy: '임정보',
    decidedAt: '2026-05-30 14:22',
    note: '개인정보 미검출 · DRM 해제 확인 · 인덱스 반영 승인',
    checks: [
      { name: '개인정보 스캔', result: 'pass', detail: '검출 0건' },
      { name: '권원 확인', result: 'pass', detail: '내부 자산 · 별도 권원 불요' },
      {
        name: 'DRM 해제 가능 여부',
        result: 'pass',
        detail: '경남은행 DRM(제품 B) 연동 모듈로 1,240건 전량 복호화 성공',
      },
      { name: '포맷 파싱', result: 'pass', detail: 'HWP 812건 · PDF 428건 · 파싱 실패 0건' },
    ],
  },
  {
    id: 'IN-2030',
    kind: '모델',
    target: 'external/finance-embed-v2',
    source: '인터넷망 다운로드 요청',
    tenant: '그룹 공통',
    requestedBy: '민모델',
    requestedAt: '2026-05-23 11:30',
    reason: '금융 특화 임베딩 모델 도입 검토',
    destination: '모델 카탈로그 · 임베딩',
    size: '1.2B · 4.6GB (pytorch_model.bin)',
    state: '반려',
    decidedBy: '임정보',
    decidedAt: '2026-05-24 09:14',
    note: 'pickle 기반 직렬화로 임의코드 실행 위험 · safetensors 변환본으로 재요청할 것',
    checks: [
      { name: '라이선스 검토', result: 'pass', detail: 'Apache-2.0' },
      {
        name: '직렬화 포맷 취약점',
        result: 'fail',
        detail: 'pytorch_model.bin (pickle) — 역직렬화 시 임의코드 실행 가능. 공동존 반입 불가',
      },
      { name: '무결성 해시', result: 'pass', detail: 'SHA-256 일치' },
      { name: '벤치마크', result: 'warn', detail: '내부 검색 셋 기준 현행 대비 -0.8%p' },
    ],
  },
];

export const CHECK_TONE: Record<CheckResult, { tone: 'ok' | 'warn' | 'bad' | 'info'; label: string }> =
  {
    pass: { tone: 'ok', label: '통과' },
    warn: { tone: 'warn', label: '주의' },
    fail: { tone: 'bad', label: '차단' },
    running: { tone: 'info', label: '진행 중' },
  };

export const INTAKE_STATE_TONE: Record<IntakeState, 'ok' | 'warn' | 'bad' | 'info'> = {
  '검사 중': 'info',
  '승인 대기': 'warn',
  승인: 'ok',
  반려: 'bad',
};
