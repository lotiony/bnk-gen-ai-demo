/* ---------- PII 마스킹 항목 + 필터링 대시보드 ---------- */

export type PiiSource = 'platform' | 'custom';

export interface PiiItem {
  id: string;
  /** 한글 표시 이름. */
  name: string;
  /** 식별 코드 (RRN-13, CUSTOM-VIP-001 등). */
  code: string;
  /** 정규표현식 문자열 (사용자 정의는 사용자가 입력). */
  pattern: string;
  /** 마스킹 대체 템플릿 (예: 'XXXXXX-XXXXXXX'). */
  maskTemplate: string;
  source: PiiSource;
  /** 활성 여부 (기본 항목은 일부 끄기 불가). */
  active: boolean;
  /** 기본 항목은 잠금 — 수정·삭제 불가, 활성 토글만 결재로. */
  locked: boolean;
  /** 7일 누적 매칭 건수. */
  hits7d: number;
  /** 마지막 매칭 시각. */
  lastMatchAt?: string;
  /** 카테고리 (대시보드 그룹핑용). */
  category: '식별번호' | '연락처' | '금융' | '내부코드' | '기타';
}

export interface PiiFilterEvent {
  id: string;
  ts: string;
  itemCode: string;
  itemName: string;
  /** 마스킹된 컨텍스트 샘플 (앞뒤 일부 + 마스킹 부분). */
  contextSnippet: string;
  /** 호출 출처 (run id 등). */
  source: string;
  /** 위치 — 입력 vs 출력. */
  direction: 'input' | 'output';
}

export type PiiChangeAction = 'add' | 'modify' | 'remove' | 'toggle';
export type PiiChangeStatus = 'pending' | 'approved' | 'rejected';

export interface PiiChangeRequest {
  id: string;
  action: PiiChangeAction;
  itemName: string;
  /** 사용자가 작성한 변경 요청 사유. */
  reason: string;
  /** 변경하려는 정규식 (add/modify 시). */
  pattern?: string;
  requestedBy: string;
  requestedAt: string;
  status: PiiChangeStatus;
  /** 다단계 결재 단계. */
  stage?: string;
}

/* ---------- AGT-204 시드 ---------- */

const PII_ITEMS: Record<string, PiiItem[]> = {
  'AGT-204': [
    // 플랫폼 기본 (잠금)
    {
      id: 'pii-rrn',
      name: '주민등록번호',
      code: 'RRN-13',
      pattern: '\\d{6}[-\\s]?[1-4]\\d{6}',
      maskTemplate: 'XXXXXX-XXXXXXX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 142,
      lastMatchAt: '2026-05-23 18:14',
      category: '식별번호',
    },
    {
      id: 'pii-passport',
      name: '여권번호',
      code: 'KOR-PASSPORT',
      pattern: '[MS]\\d{8}',
      maskTemplate: 'X********',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 4,
      lastMatchAt: '2026-05-22 14:08',
      category: '식별번호',
    },
    {
      id: 'pii-driver',
      name: '운전면허번호',
      code: 'DRV-LIC',
      pattern: '\\d{2}-\\d{2}-\\d{6}-\\d{2}',
      maskTemplate: 'XX-XX-XXXXXX-XX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 2,
      category: '식별번호',
    },
    {
      id: 'pii-foreigner',
      name: '외국인등록번호',
      code: 'ARN-13',
      pattern: '\\d{6}[-\\s]?[5-8]\\d{6}',
      maskTemplate: 'XXXXXX-XXXXXXX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 0,
      category: '식별번호',
    },
    {
      id: 'pii-card',
      name: '신용카드번호',
      code: 'CARD-16',
      pattern: '\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}',
      maskTemplate: 'XXXX-XXXX-XXXX-XXXX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 18,
      lastMatchAt: '2026-05-23 11:42',
      category: '금융',
    },
    {
      id: 'pii-account',
      name: '계좌번호',
      code: 'ACCT-KR',
      pattern: '\\d{3}-\\d{2,6}-\\d{2,8}',
      maskTemplate: 'XXX-XX-XXXXXX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 47,
      lastMatchAt: '2026-05-23 17:22',
      category: '금융',
    },
    {
      id: 'pii-phone',
      name: '휴대전화번호',
      code: 'PHONE-MOBILE',
      pattern: '01[0-9][-\\s]?\\d{3,4}[-\\s]?\\d{4}',
      maskTemplate: '010-XXXX-XXXX',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 12,
      lastMatchAt: '2026-05-23 09:58',
      category: '연락처',
    },
    {
      id: 'pii-email',
      name: '이메일 주소',
      code: 'EMAIL',
      pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
      maskTemplate: 'x***@***.com',
      source: 'platform',
      active: true,
      locked: true,
      hits7d: 8,
      lastMatchAt: '2026-05-23 16:30',
      category: '연락처',
    },
    // 사용자 추가 (정규식)
    {
      id: 'pii-vip',
      name: 'PB VIP 등급 코드',
      code: 'CUSTOM-VIP-001',
      pattern: '^VIP-[A-Z]{2}-\\d{4}$',
      maskTemplate: 'VIP-**-****',
      source: 'custom',
      active: true,
      locked: false,
      hits7d: 3,
      lastMatchAt: '2026-05-22 10:11',
      category: '내부코드',
    },
    {
      id: 'pii-emp',
      name: '내부 임직원 ID',
      code: 'CUSTOM-EMP-001',
      pattern: '^M-\\d{5}$',
      maskTemplate: 'M-XXXXX',
      source: 'custom',
      active: true,
      locked: false,
      hits7d: 0,
      category: '내부코드',
    },
  ],
};

const EVENTS: Record<string, PiiFilterEvent[]> = {
  'AGT-204': [
    {
      id: 'pe-9c3a',
      ts: '2026-05-23 18:14',
      itemCode: 'RRN-13',
      itemName: '주민등록번호',
      contextSnippet: '고객님 본인 확인 위해 [XXXXXX-XXXXXXX] 알려주시면…',
      source: 'run-9c3a',
      direction: 'input',
    },
    {
      id: 'pe-9c39',
      ts: '2026-05-23 17:22',
      itemCode: 'ACCT-KR',
      itemName: '계좌번호',
      contextSnippet: '국민은행 [XXX-XX-XXXXXX]로 이체 부탁드립니다',
      source: 'run-9c39',
      direction: 'input',
    },
    {
      id: 'pe-9c38',
      ts: '2026-05-23 16:30',
      itemCode: 'EMAIL',
      itemName: '이메일 주소',
      contextSnippet: '안내문은 [x***@***.com]으로 발송됩니다',
      source: 'run-9c38',
      direction: 'output',
    },
    {
      id: 'pe-9c37',
      ts: '2026-05-23 11:42',
      itemCode: 'CARD-16',
      itemName: '신용카드번호',
      contextSnippet: '현재 등록된 카드 [XXXX-XXXX-XXXX-XXXX]의 한도는…',
      source: 'run-9c37',
      direction: 'output',
    },
    {
      id: 'pe-9c36',
      ts: '2026-05-23 09:58',
      itemCode: 'PHONE-MOBILE',
      itemName: '휴대전화번호',
      contextSnippet: '본인 명의 [010-XXXX-XXXX]로 OTP 전송 예정',
      source: 'run-9c36',
      direction: 'input',
    },
    {
      id: 'pe-9c30',
      ts: '2026-05-22 10:11',
      itemCode: 'CUSTOM-VIP-001',
      itemName: 'PB VIP 등급 코드',
      contextSnippet: '[VIP-**-****] 등급 고객님께 적용되는 혜택은…',
      source: 'run-9c30',
      direction: 'output',
    },
  ],
};

const CHANGE_REQUESTS: Record<string, PiiChangeRequest[]> = {
  'AGT-204': [
    {
      id: 'PII-CHG-04',
      action: 'add',
      itemName: '카카오톡 ID',
      reason: '대화 로그에서 카톡 ID 노출 우려 — 마스킹 추가 요청',
      pattern: '^[a-z0-9_.-]{4,20}$',
      requestedBy: '박서연',
      requestedAt: '2026-05-23 14:20',
      status: 'pending',
      stage: '프로젝트 오너 그룹 → 정보보호부',
    },
    {
      id: 'PII-CHG-03',
      action: 'modify',
      itemName: 'PB VIP 등급 코드',
      reason: '신규 등급 체계 도입에 따른 패턴 보강',
      pattern: '^VIP-[A-Z]{2}-\\d{4,6}$',
      requestedBy: '박서연',
      requestedAt: '2026-05-19 16:42',
      status: 'approved',
    },
    {
      id: 'PII-CHG-02',
      action: 'add',
      itemName: '내부 임직원 ID',
      reason: '임직원 ID 노출 시 내부 통제 우회 위험',
      pattern: '^M-\\d{5}$',
      requestedBy: '박서연',
      requestedAt: '2026-04-30 10:00',
      status: 'approved',
    },
  ],
};

export function getPiiItems(agentId: string): PiiItem[] {
  return PII_ITEMS[agentId] ?? [];
}

export function getPiiEvents(agentId: string): PiiFilterEvent[] {
  return EVENTS[agentId] ?? [];
}

export function getPiiChangeRequests(agentId: string): PiiChangeRequest[] {
  return CHANGE_REQUESTS[agentId] ?? [];
}
