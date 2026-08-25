// 온톨로지 엔진 버전 — vite.config.js 의 define 이 빌드 시점에 인라인한다.
// 도출 규칙은 scripts/ontology-version.mjs 참고. 못 뽑으면 빈 문자열이고, 그때는 배지를 그리지 않는다.
export const ONTOLOGY_VERSION = __ONTOLOGY_VERSION__;
