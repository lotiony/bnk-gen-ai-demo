/**
 * 페르소나 전환용 mock 데이터.
 *
 * GenAI Portal 2.0는 다양한 역할(관리·개발·사용)이 한 플랫폼을 공유한다.
 * 데모/발표에서 페르소나별로 보이는 화면·권한 뉘앙스를 빠르게 전환하기 위해
 * 우상단 사용자 칩을 통해 스위칭.
 *
 * 이름·부서는 mock. 사용자가 원하는 대로 수정 가능.
 */

export type PersonaId =
  | 'platform_admin'
  | 'business_admin'
  | 'governance_admin'
  | 'security_admin'
  | 'project_owner'
  | 'agent_dev'
  | 'data_dev'
  | 'project_member'
  | 'service_user';

export type PersonaGroup = '관리자' | '개발자' | '사용자';

export interface Persona {
  id: PersonaId;
  /** 화면 라벨. */
  role: string;
  /** 사용자 이름. */
  name: string;
  /** 아바타에 표시할 한글 이니셜(1자). */
  initial: string;
  /** 소속 부서. */
  dept: string;
  /** 그룹 분류 (드롭다운 섹션 분리용). */
  group: PersonaGroup;
  /** 페르소나 요약 — 드롭다운 hover/부제. */
  hint: string;
}

export const PERSONAS: Persona[] = [
  // ─── 관리자 ───
  {
    id: 'platform_admin',
    role: '플랫폼 관리자',
    name: '김국민',
    initial: '김',
    dept: '금융AI2센터',
    group: '관리자',
    hint: '전체 콘솔·모델·PTU·감사 원장 접근',
  },
  {
    id: 'business_admin',
    role: '사업 관리자',
    name: '이사업',
    initial: '이',
    dept: '금융AI1센터',
    group: '관리자',
    hint: '비용·예산·계열사 사용 현황 총괄',
  },
  {
    id: 'governance_admin',
    role: '거버넌스 관리자',
    name: '박거버',
    initial: '박',
    dept: 'DT추진부',
    group: '관리자',
    hint: '정책·결재·감사 원장·SoD 검토',
  },
  {
    id: 'security_admin',
    role: '정보보호 관리자',
    name: '임정보',
    initial: '임',
    dept: '정보보호부',
    group: '관리자',
    hint: 'PII·가드레일·접근 통제·인증',
  },

  // ─── 개발자 ───
  {
    id: 'project_owner',
    role: '프로젝트 오너',
    name: '정오너',
    initial: '정',
    dept: '금융AI2센터',
    group: '개발자',
    hint: '프로젝트 오너 그룹 · 프로젝트 전권',
  },
  {
    id: 'agent_dev',
    role: '에이전트 개발자',
    name: '강개발',
    initial: '강',
    dept: '금융AI2센터',
    group: '개발자',
    hint: '에이전트 코드·프롬프트·배포',
  },
  {
    id: 'data_dev',
    role: '데이터 개발자',
    name: '조디비',
    initial: '조',
    dept: '고객컨택혁신부',
    group: '개발자',
    hint: '지식데이터·파이프라인·인덱스',
  },
  {
    id: 'project_member',
    role: '프로젝트 참여자',
    name: '윤참여',
    initial: '윤',
    dept: '고객컨택혁신부',
    group: '개발자',
    hint: '지정 프로젝트 조회·기안',
  },

  // ─── 사용자 ───
  {
    id: 'service_user',
    role: '서비스 사용자',
    name: '서사용',
    initial: '서',
    dept: '영업그룹',
    group: '사용자',
    hint: '카탈로그 에이전트 사용',
  },
];

export const DEFAULT_PERSONA_ID: PersonaId = 'platform_admin';

export function findPersona(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
