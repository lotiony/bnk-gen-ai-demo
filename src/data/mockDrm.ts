/**
 * 계열사별 DRM 자동 암·복호화 연동 mock.
 *
 * RFP SEC-005 (필수)
 *   "프롬프트 입력 및 데이터 파이프라인 상에서 문서(PDF, HWP, DOCX 등) 수집/인덱싱 시,
 *    **각 계열사별 서로 다른 문서보안(DRM) 솔루션을 자동 인지**하여 실시간 복호화 및
 *    보안 암호화를 수행할 수 있는 DRM API/SDK 연동 모듈 개발 반영
 *    DRM 연동비용(DRM업체분)은 제안내용 및 비용에서 제외 할 것"
 *
 * 이 요건의 핵심은 두 가지다.
 *   ① **계열사마다 DRM 제품이 다르다** — 하나의 어댑터로 끝나지 않는다
 *   ② **자동 인지** — 사용자가 "이건 A사 DRM 문서입니다" 라고 알려 주지 않는다.
 *      파일 헤더·확장자·서명에서 판별해 맞는 모듈로 보낸다
 *
 * 그래서 화면은 「계열사 ↔ DRM 제품 ↔ 연동 모듈 상태」 매핑표와,
 * 실제로 자동 판별이 일어난 처리 로그 두 덩어리로 구성한다.
 *
 * DRM 제품명은 **가상 표기**다. 실제 제품명을 적으면 확약이 되므로 A/B/C 로 둔다.
 * 비용은 RFP 지시대로 제안 범위에서 제외한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type DrmStatus = '연동 완료' | '연동 진행' | '미연동';
export type DrmIface = 'API' | 'SDK';

export interface DrmBinding {
  tenant: Tenant;
  /** 계열사가 쓰는 문서보안 제품 — 가상 표기. */
  product: string;
  /** 연동 방식. */
  iface: DrmIface;
  status: DrmStatus;
  /** 자동 판별 근거 — 무엇을 보고 이 제품 문서라고 인지하는가. */
  detection: string;
  /** 지원 포맷. */
  formats: string;
  /** 최근 30일 복호화 건수. */
  decrypted30d: number;
  /** 최근 30일 실패 건수. */
  failed30d: number;
  /** 비고 — 연동 진행/미연동 사유. */
  note?: string;
}

export const DRM_BINDINGS: DrmBinding[] = [
  {
    tenant: '부산은행',
    product: 'DRM 제품 A',
    iface: 'API',
    status: '연동 완료',
    detection: '파일 헤더 매직넘버 + 확장자 `.dsec` + 벤더 서명 블록',
    formats: 'PDF · HWP · DOCX · XLSX · PPTX',
    decrypted30d: 18420,
    failed30d: 12,
  },
  {
    tenant: '경남은행',
    product: 'DRM 제품 B',
    iface: 'API',
    status: '연동 완료',
    detection: '파일 헤더 매직넘버 + 벤더 서명 블록',
    formats: 'PDF · HWP · DOCX',
    decrypted30d: 11380,
    failed30d: 7,
  },
  {
    tenant: 'BNK캐피탈',
    product: 'DRM 제품 A',
    iface: 'API',
    status: '연동 완료',
    detection: '파일 헤더 매직넘버 + 확장자 `.dsec`',
    formats: 'PDF · DOCX · XLSX',
    decrypted30d: 3240,
    failed30d: 3,
  },
  {
    tenant: 'BNK투자증권',
    product: 'DRM 제품 C',
    iface: 'SDK',
    status: '연동 진행',
    detection: 'SDK 호출 시 컨테이너 메타 조회',
    formats: 'PDF · DOCX',
    decrypted30d: 0,
    failed30d: 0,
    note: '제품 C 는 API 를 제공하지 않아 SDK 임베드 방식 · 벤더 기술지원 일정 협의 중',
  },
  {
    tenant: 'BNK저축은행',
    product: 'DRM 제품 B',
    iface: 'API',
    status: '연동 완료',
    detection: '파일 헤더 매직넘버',
    formats: 'PDF · HWP',
    decrypted30d: 860,
    failed30d: 1,
  },
  {
    tenant: 'BNK시스템',
    product: '미적용',
    iface: 'API',
    status: '미연동',
    detection: '—',
    formats: '—',
    decrypted30d: 0,
    failed30d: 0,
    note: '문서보안 솔루션 미도입 계열사 · 평문 수집이므로 복호화 단계 없이 개인정보 스캔으로 직행',
  },
  {
    tenant: 'BNK자산운용',
    product: 'DRM 제품 C',
    iface: 'SDK',
    status: '연동 진행',
    detection: 'SDK 호출 시 컨테이너 메타 조회',
    formats: 'PDF',
    decrypted30d: 0,
    failed30d: 0,
    note: '투자증권과 동일 제품 · 모듈 재사용 예정',
  },
  {
    tenant: 'BNK신용정보',
    product: 'DRM 제품 A',
    iface: 'API',
    status: '연동 완료',
    detection: '파일 헤더 매직넘버 + 확장자 `.dsec`',
    formats: 'PDF · DOCX',
    decrypted30d: 1420,
    failed30d: 0,
  },
  {
    tenant: 'BNK벤처투자',
    product: '미적용',
    iface: 'API',
    status: '미연동',
    detection: '—',
    formats: '—',
    decrypted30d: 0,
    failed30d: 0,
    note: '문서보안 솔루션 미도입 계열사',
  },
  {
    tenant: 'BNK엘앤에스',
    product: '미적용',
    iface: 'API',
    status: '미연동',
    detection: '—',
    formats: '—',
    decrypted30d: 0,
    failed30d: 0,
    note: '문서보안 솔루션 미도입 계열사',
  },
];

/* ═══════════════════════ 자동 판별 처리 로그 ═══════════════════════ */

export type DrmFlowResult = '복호화 성공' | '재암호화 완료' | '복호화 실패' | '평문 통과';

export interface DrmFlowLog {
  at: string;
  tenant: Tenant;
  /** 어느 경로로 들어왔나 — 프롬프트 첨부 또는 파이프라인 수집. */
  channel: '프롬프트 첨부' | '파이프라인 수집';
  fileName: string;
  /** 자동 인지 결과. */
  detected: string;
  result: DrmFlowResult;
  detail: string;
}

export const DRM_FLOW_LOGS: DrmFlowLog[] = [
  {
    at: '2026-01-08 09:41:02',
    tenant: '부산은행',
    channel: '프롬프트 첨부',
    fileName: '여신심사_내규발췌.hwp',
    detected: 'DRM 제품 A (헤더 매직넘버 일치)',
    result: '복호화 성공',
    detail: '복호화 후 PII 스캔 → 주민번호 2건 마스킹 → 모델 입력',
  },
  {
    at: '2026-01-08 09:38:55',
    tenant: '경남은행',
    channel: '파이프라인 수집',
    fileName: '상품매뉴얼_2026개정.pdf',
    detected: 'DRM 제품 B (벤더 서명 블록 일치)',
    result: '복호화 성공',
    detail: '복호화 → 파싱 → 청킹 → 임베딩 · 인덱스 반영 대기',
  },
  {
    at: '2026-01-08 09:31:10',
    tenant: '부산은행',
    channel: '파이프라인 수집',
    fileName: '고객상담이력_202512.xlsx',
    detected: 'DRM 제품 A',
    result: '재암호화 완료',
    detail: 'Object Storage 적재 시 플랫폼 키로 재암호화 — 평문 상태로 저장하지 않는다',
  },
  {
    at: '2026-01-08 09:22:47',
    tenant: 'BNK투자증권',
    channel: '프롬프트 첨부',
    fileName: 'IB_딜리뷰_초안.docx',
    detected: 'DRM 제품 C (SDK 미연동)',
    result: '복호화 실패',
    detail: '제품 C 연동 진행 중 — 첨부는 차단되고 사용자에게 사유가 안내됐다',
  },
  {
    at: '2026-01-08 09:14:33',
    tenant: 'BNK시스템',
    channel: '파이프라인 수집',
    fileName: '운영매뉴얼_v3.pdf',
    detected: '보호되지 않은 문서',
    result: '평문 통과',
    detail: 'DRM 미적용 계열사 · 복호화 단계 없이 개인정보 스캔으로 직행',
  },
];

export const DRM_STATUS_TONE: Record<DrmStatus, 'ok' | 'warn' | 'neutral'> = {
  '연동 완료': 'ok',
  '연동 진행': 'warn',
  미연동: 'neutral',
};

export const DRM_RESULT_TONE: Record<DrmFlowResult, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  '복호화 성공': 'ok',
  '재암호화 완료': 'ok',
  '복호화 실패': 'bad',
  '평문 통과': 'neutral',
};

/** 제안 범위 고지 — RFP 가 명시적으로 비용 제외를 지시했다. */
export const DRM_COST_NOTE =
  'DRM 연동비용(DRM 업체분)은 RFP 지시에 따라 본 제안 내용 및 비용에서 제외했다. 제안 범위는 플랫폼 측 연동 모듈 개발과 자동 판별 로직이다.';
