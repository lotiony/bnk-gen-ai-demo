/**
 * MCP Tool 자동 등록 mock — 핸드오프 §2 화면 8.
 *
 * RFP: AGB-004
 *
 * 화면 7(워크플로우 빌더)의 `authority.lookup` 노드가 **여기서 등록된 Tool**이다.
 * 두 화면이 같은 Tool 을 가리켜야 "스펙을 붙여넣으면 워크플로우에서 바로 쓸 수
 * 있다"는 말이 성립한다.
 *
 * ⚠️ 전부 가상 API 다. 실제 BNK 내부 API 스펙이 아니다.
 */

/** 붙여넣기 시연용 OpenAPI 3.0 스펙 — 전결규정 조회 API(가상). */
export const OPENAPI_SAMPLE = `openapi: 3.0.3
info:
  title: 전결규정 조회 API
  version: 1.4.0
  description: 여신 금액·구분에 따른 전결권자와 근거 조항을 반환한다.
servers:
  - url: https://api.aip.group.local/authority/v1
paths:
  /authority/lookup:
    get:
      operationId: lookupAuthority
      summary: 전결권자 조회
      parameters:
        - name: amount
          in: query
          required: true
          schema: { type: integer, format: int64 }
          description: 여신 총액(원)
        - name: creditExposure
          in: query
          required: false
          schema: { type: boolean, default: false }
          description: 신용공여 포함 여부
        - name: productCode
          in: query
          required: false
          schema: { type: string }
          description: 여신상품 코드
      responses:
        '200':
          description: 전결권자와 근거 조항
  /authority/clauses/{clauseNo}:
    get:
      operationId: getClause
      summary: 전결규정 조항 원문 조회
      parameters:
        - name: clauseNo
          in: path
          required: true
          schema: { type: string }
          description: 조항 번호 (예: 5-1)
      responses:
        '200':
          description: 조항 원문
  /authority/delegations:
    post:
      operationId: createDelegation
      summary: 전결 위임 등록
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [fromPosition, toPosition, validUntil]
              properties:
                fromPosition: { type: string }
                toPosition:   { type: string }
                validUntil:   { type: string, format: date }
      responses:
        '201':
          description: 등록됨
`;

export type ParamIn = 'query' | 'path' | 'body';
export type HttpMethod = 'GET' | 'POST';

export interface McpParam {
  name: string;
  type: string;
  where: ParamIn;
  required: boolean;
  desc: string;
}

export interface McpTool {
  /** MCP 도구 이름 — operationId 를 snake 로 옮긴 값. */
  name: string;
  operationId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  params: McpParam[];
  /**
   * 쓰기 동작 여부. 조회(GET)와 달리 상태를 바꾸므로 **승인 없이는 못 켠다.**
   * 스펙만 보고 자동으로 열어 주면 그게 사고다.
   */
  mutating: boolean;
  /** 자동 등록 결과 상태. */
  status: 'ready' | 'approval';
}

export const PARSED_TOOLS: McpTool[] = [
  {
    name: 'authority.lookup',
    operationId: 'lookupAuthority',
    method: 'GET',
    path: '/authority/lookup',
    summary: '전결권자 조회',
    mutating: false,
    status: 'ready',
    params: [
      { name: 'amount', type: 'integer', where: 'query', required: true, desc: '여신 총액(원)' },
      { name: 'creditExposure', type: 'boolean', where: 'query', required: false, desc: '신용공여 포함 여부' },
      { name: 'productCode', type: 'string', where: 'query', required: false, desc: '여신상품 코드' },
    ],
  },
  {
    name: 'authority.get_clause',
    operationId: 'getClause',
    method: 'GET',
    path: '/authority/clauses/{clauseNo}',
    summary: '전결규정 조항 원문 조회',
    mutating: false,
    status: 'ready',
    params: [{ name: 'clauseNo', type: 'string', where: 'path', required: true, desc: '조항 번호 (예: 5-1)' }],
  },
  {
    name: 'authority.create_delegation',
    operationId: 'createDelegation',
    method: 'POST',
    path: '/authority/delegations',
    summary: '전결 위임 등록',
    mutating: true,
    status: 'approval',
    params: [
      { name: 'fromPosition', type: 'string', where: 'body', required: true, desc: '위임 전 직책' },
      { name: 'toPosition', type: 'string', where: 'body', required: true, desc: '위임 후 직책' },
      { name: 'validUntil', type: 'date', where: 'body', required: true, desc: '유효 기한' },
    ],
  },
];

export interface ConvertStep {
  label: string;
  detail: string;
  ms: number;
}

export const CONVERT_STEPS: ConvertStep[] = [
  { label: '스펙 파싱', detail: 'OpenAPI 3.0.3 · 3개 operation 발견', ms: 420 },
  { label: '도구 이름 생성', detail: 'operationId → MCP tool name 변환 (충돌 검사 포함)', ms: 360 },
  { label: '파라미터 스키마 변환', detail: 'query·path·requestBody → JSON Schema 입력 스키마', ms: 480 },
  { label: '부작용 판정', detail: 'GET 2건은 조회, POST 1건은 쓰기 — 쓰기 도구는 승인 대상으로 분류', ms: 400 },
  { label: '인증·감사 결합', detail: '서비스 계정 바인딩 · 호출 감사 로그 활성화', ms: 380 },
  { label: 'MCP 서버 등록', detail: '조회 도구 2건 즉시 사용 가능 · 쓰기 도구 1건 결재 대기', ms: 440 },
];

export const MCP_SERVER = {
  name: 'bnk-authority-mcp',
  namespace: 'ns-group-common',
  endpoint: 'mcp://authority.aip.group.local',
  transport: 'stdio · 사내 게이트웨이 경유',
  auth: '서비스 계정 (SA-AUTH-01) · 호출 단위 감사',
};

/** 이미 등록되어 운영 중인 MCP 서버 — 화면 상단 목록. */
export const REGISTERED_SERVERS: { name: string; tools: number; ns: string; status: string }[] = [
  { name: 'bnk-knowledge-mcp', tools: 5, ns: 'ns-group-common', status: '운영 중' },
  { name: 'bnk-crm-mcp', tools: 8, ns: 'ns-bank-bs', status: '운영 중' },
  { name: 'bnk-hr-mcp', tools: 3, ns: 'ns-group-common', status: '운영 중' },
];

/** 자동 등록이 하지 않는 것 — 화면에 그대로 적는다. 안 적으면 확약이 넓어진다. */
export const NOT_AUTOMATED: string[] = [
  '쓰기(POST·PUT·DELETE) 도구의 활성화 — 승인권자 결재를 거친다',
  '스펙에 없는 인증 정보 — 서비스 계정은 별도 신청·발급한다',
  '외부망 API — 공동존은 계열사 내부망과 격리되어 있어 연동 대상이 아니다',
];
