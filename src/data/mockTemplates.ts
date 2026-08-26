/**
 * 재사용 자산 템플릿 mock.
 *
 * RFP 2-1 마켓플레이스: "에이전트/워크플로우/프롬프트의 **템플릿화** 및 조직 내
 * 재사용 자산 관리"
 *
 * 검증된 과제를 템플릿으로 저장해 두면 다른 팀이 처음부터 만들지 않고 복제해서
 * 시작할 수 있다. 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export type TemplateKind = '에이전트' | '워크플로우' | '프롬프트';

export interface TemplateItem {
  id: string;
  kind: TemplateKind;
  name: string;
  desc: string;
  usedCount: number;
  savedBy: string;
}

export const TEMPLATES: TemplateItem[] = [
  { id: 'TPL-01', kind: '에이전트', name: '민원 분류·회신 초안 템플릿', desc: '민원 텍스트 분류 + 표준 회신 초안 생성 구조를 그대로 복제', usedCount: 6, savedBy: '이서준' },
  { id: 'TPL-02', kind: '워크플로우', name: '승인 기반 심사 워크플로우 템플릿', desc: '접수→규정검색→조건분기→심사→전결조회 5단계 골격', usedCount: 4, savedBy: '박서연' },
  { id: 'TPL-03', kind: '프롬프트', name: '규정 요약 3줄 템플릿', desc: '조항 원문을 실무자 언어로 요약하는 표준 프롬프트', usedCount: 12, savedBy: '박거버' },
];
