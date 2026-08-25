// 브랜드 단일 소스 — 화이트라벨 토글(ember ⇄ kt) 표시 이름을 여기서만 정의.
// brand 값 자체는 App 의 localStorage "ember_brand"; 로고 더블클릭으로 전환된다.
// 새 화면에서 브랜드명을 노출할 땐 문자열 하드코딩 대신 brandName(brand) 를 쓴다.
// (App 사이드바·Login 은 각자 워드마크/SVG 로고 chrome 을 그리지만 이름 규칙은 동일하다.)
// ponytail: 이름 문자열 한 곳. 로고 이미지까지 통합은 필요할 때.
export const brandName = (brand) => (brand === "kt" ? "Ontology Platform" : "Ember Link");
