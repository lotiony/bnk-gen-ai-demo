/**
 * 테넌트(Namespace) 정의 — 이 데모의 단일 진실 공급원.
 *
 * RFP 인프라 요건: **11개 Namespace = 계열사 10개 + 그룹 공통 포털 1개.**
 * 화면 1(그룹 공통 랜딩)이 이 구조를 시각적으로 각인시키는 것이 목표이므로
 * 계열사와 그룹 공통을 `kind` 로 구분해 둔다.
 *
 * ⚠️ 계열사명은 공개 정보 기준의 표기이며 실제 조직도와 대조 확인이 필요하다.
 *    (핸드오프 §5 "계열사명 표기 방식 미결정" 항목 — 가이드 §3 M1 지시에 따라 실명 표기를 택했다)
 *    수정은 이 파일 한 곳만 고치면 전 화면에 반영된다.
 */

export type Tenant =
  | '부산은행'
  | '경남은행'
  | 'BNK캐피탈'
  | 'BNK투자증권'
  | 'BNK저축은행'
  | 'BNK자산운용'
  | 'BNK벤처투자'
  | 'BNK시스템'
  | 'BNK신용정보'
  | 'BNK엘앤에스'
  | '그룹 공통';

export type TenantKind = 'affiliate' | 'group';

export interface TenantMeta {
  name: Tenant;
  /** 좁은 폭(스위처 칩·표 셀)에서 쓰는 짧은 표기. */
  short: string;
  kind: TenantKind;
  /** K8s Namespace 식별자 — 화면 1·12에서 노출. */
  namespace: string;
}

export const TENANTS: TenantMeta[] = [
  { name: '부산은행', short: '부산은행', kind: 'affiliate', namespace: 'ns-bank-bs' },
  { name: '경남은행', short: '경남은행', kind: 'affiliate', namespace: 'ns-bank-kn' },
  { name: 'BNK캐피탈', short: '캐피탈', kind: 'affiliate', namespace: 'ns-capital' },
  { name: 'BNK투자증권', short: '투자증권', kind: 'affiliate', namespace: 'ns-securities' },
  { name: 'BNK저축은행', short: '저축은행', kind: 'affiliate', namespace: 'ns-savings' },
  { name: 'BNK자산운용', short: '자산운용', kind: 'affiliate', namespace: 'ns-am' },
  { name: 'BNK벤처투자', short: '벤처투자', kind: 'affiliate', namespace: 'ns-vc' },
  { name: 'BNK시스템', short: '시스템', kind: 'affiliate', namespace: 'ns-system' },
  { name: 'BNK신용정보', short: '신용정보', kind: 'affiliate', namespace: 'ns-ci' },
  { name: 'BNK엘앤에스', short: '엘앤에스', kind: 'affiliate', namespace: 'ns-lns' },
  { name: '그룹 공통', short: '그룹 공통', kind: 'group', namespace: 'ns-group-common' },
];

export const TENANT_LIST: Tenant[] = TENANTS.map((t) => t.name);

export const TENANT_SHORT: Record<Tenant, string> = TENANTS.reduce(
  (acc, t) => ({ ...acc, [t.name]: t.short }),
  {} as Record<Tenant, string>,
);

/** 계열사만 (그룹 공통 제외) — 계열사별 정산·쿼터 화면에서 사용. */
export const AFFILIATES: TenantMeta[] = TENANTS.filter((t) => t.kind === 'affiliate');

/** 기본 진입 테넌트. */
export const DEFAULT_TENANT: Tenant = '부산은행';
