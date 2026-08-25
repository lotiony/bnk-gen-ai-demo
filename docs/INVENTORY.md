---
type: inventory
dept: delivery
title: 코드베이스 인벤토리 — KB GenAI 포털 mockup → BNK 데모 재사용 판정
created: 2026-08-25
updated: 2026-08-25
source: 킥오프 프롬프트 (BNK_DEMO_CLAUDE_CODE_GUIDE.md §1-3)
tags: [inventory, bnk, demo, m0]
---

# 코드베이스 인벤토리 (M0)

## 0. 조사 범위 — 확정

가이드 §1-1의 KB 코드 복사가 완료되어(2026-08-25 18:25) **이 리포 안의 코드를 직접 조사한 결과다.**

원본은 **KBAgentOps Frontend — GenAI Portal 2.0** (`package.json` name: `kbagentops-frontend`, "KB금융그룹 AI Agent 운영 플랫폼 프론트엔드 프로토타입"). 복사본이 원본과 일치함을 확인했다 — `diff -rq src` 차이 0건, 설정 6개 파일(`package.json`·`index.html`·`vite.config.ts`·`tailwind.config.js`·`tsconfig.json`·`postcss.config.js`) 바이트 일치, `src/` 96파일 동수.

> 아래 파일:라인은 전부 **이 리포 기준**이며 그대로 열어 확인할 수 있다.
> 커밋 주의: 코드가 아직 `git add` 되지 않은 untracked 상태다. 가이드 §1-1의 `seed:` 커밋이 남아 있다.

### 빌드 검증 (실측)

`npm install` 후 실제로 돌려 확인했다.

| 검사 | 결과 |
|---|---|
| `npm run typecheck` (`tsc -b --noEmit`) | ✅ 통과 (에러 0) |
| `npm run build` | ✅ 성공 · 121 모듈 · 3.3초 |
| 산출물 크기 | `index.js` 900 KB (gzip 236 KB) / `index.css` 45 KB (gzip 8.6 KB) / `index.html` 0.4 KB |
| 청크 경고 | 500 KB 초과 경고 1건 — 단일 파일 데모에는 무해 |

**즉 스택은 지금 그대로 살아 있고 빌드된다.** 아래 화면별 "완성도"는 코드 규모·기능 깊이 기반 판단이며(전 화면을 브라우저로 순회하지는 않았다), 빌드 가능 여부는 위와 같이 실측이다.

---

## 1. 스택

| 항목 | 값 | BNK 데모 적합성 |
|---|---|---|
| 빌드 | **Vite 5.3** + `@vitejs/plugin-react` | ✅ `vite-plugin-singlefile` 적용 가능 (가이드 §0 권장 경로) |
| 언어 | TypeScript 5.5 (`strict: true`) | ✅ |
| UI | React 18.3 | ✅ |
| 라우팅 | **react-router-dom 6.26 / `BrowserRouter`** | ⚠️ **`file://` 에서 동작 불가 — HashRouter 교체 필수 (§5-1)** |
| 스타일 | **Tailwind 3.4** + PostCSS, 커스텀 토큰 | ⚠️ `kb-*` 컬러 토큰이 브랜드 전체를 지배 (§4-1) |
| 상태 | ①`useState` 로컬 ②`useSyncExternalStore` 모듈 스토어(`deployApprovalStore.ts`) ③**`localStorage`(3개소)** | ⚠️ ③은 BNK 규칙 위반 — 메모리 전환 필요 (§5-4) |
| 데이터 | `src/data/` mock 모듈 20개 + 컴포넌트 내부 mock 일부 | ✅ 중앙화 대체로 준수 (일부 예외 §5-6) |
| 별칭 | `@/` → `src/` | ✅ |
| 스크립트 | `dev` / `build`(=`tsc -b && vite build`) / `preview` / `typecheck` | ✅ **빌드·타입체크 실측 통과 (§0)** |
| 의존성 | **런타임 3개(react, react-dom, react-router-dom)뿐** | ✅ 번들 가벼움, 오프라인 유리 |

**규모: `src/` 96파일 / 35,260 LOC.** 백엔드·API 호출 0건의 순수 프론트 mockup.

### 컴포넌트 구조
```
src/
├─ App.tsx (113)          라우트 정의 + PersonaGate(로그인 가드)
├─ routes/                페이지 21개
├─ components/
│  ├─ layout/             Topbar · GNB · AdminLayout · PersonaSwitcher · TenantSwitcher
│  ├─ ui/                 Button · KpiCard · StatusPill · Crumb · MetaTag  (5개, 얇음)
│  ├─ knowledgeData/      파싱·임베딩·색인·평가·배포 섹션 + 모달 (18파일, 최대 덩어리)
│  ├─ projectDetail/      Overview·Tasks·Models·Members·Approvals·Traffic·Conversations 탭
│  ├─ projectForm/        폼 프리미티브
│  └─ devenv/             개발환경 도구 목업(Jupyter·Jenkins·ArgoCD 화면 흉내)
├─ data/                  mock 20개
├─ lib/                   persona · personaView(페르소나별 화면 분기) · deployApprovalStore · utils
└─ types/
```

**성격 주의**: 이것은 **AgentOps(과제·프로젝트 관리) 플랫폼**이지 사용자용 Chat 포털이 아니다. 핸드오프 3막 중 **2막(개발자·승인권자)·3막(운영자)은 자산이 두껍고, 1막(일반 사용자)은 거의 비어 있다.** 이것이 재사용 판정의 큰 축이다.

---

## 2. 현재 구현된 화면 21개

완성도: ●●● 시연 가능 / ●●○ 골격+주요 인터랙션 / ●○○ 뼈대만

| # | 라우트 | 파일 (LOC) | 내용 | 완성도 |
|---|---|---|---|---|
| 1 | `/login` | LoginPage (126) | SSO 계정선택형 로그인, 페르소나 9종 목록 | ●●● |
| 2 | `/` | HomePage (168) | 개인 워크스페이스 — KPI 2종·대표 에이전트·결재 대기 | ●●● |
| 3 | `/projects` | ProjectsListPage (130) | 프로젝트 목록 | ●●○ |
| 4 | `/projects/new` | ProjectRegisterPage (719) | 프로젝트 등록 폼 + 결재선 표시 | ●●● |
| 5 | `/projects/:id` | ProjectDetailPage (156) + 탭 7종 | 개요·과제·모델·멤버·결재·**트래픽**·**대화분석** | ●●● |
| 6 | `…/tasks/knowledge/new` | KnowledgeDataTaskPage (1336) + 섹션 18파일 | 파싱→임베딩→색인→평가→배포 풀 파이프라인 | ●●● |
| 7 | `…/tasks/knowledge/create` | KnowledgeTaskRegisterPage (300) | 지식과제 등록 | ●●○ |
| 8 | `…/tasks/database/new` | DatabaseTaskPage (2005) | DB 테이블·계정 신청, **학습계(dev)/서빙계(prod) 권한 분리 + 3단계 결재** | ●●● |
| 9 | `…/tasks/pipeline/new` | SearchPipelineTaskPage (1178) | 검색 파이프라인 과제 등록 | ●●● |
| 10 | `…/tasks/pipeline/:id` | SearchPipelineDetailPage (1520) | 리트리버 가공·평가·서빙계 프로모션 | ●●● |
| 11 | `…/tasks/agent/new` | AgentTaskRegisterPage (413) | 에이전트 등록 (프롬프트·모델·도구·지식) | ●●● |
| 12 | `…/tasks/agent/:id` | AgentTaskDetailPage (2494) | 에이전트 상세 — 학습계/서빙계 토글, 성능평가, **거버넌스·레드팀**, **PII 정책** | ●●● |
| 13 | `…/tasks/component/:id` | ComponentTaskPage (408) | 공통 컴포넌트 과제 | ●●○ |
| 14 | `…/tasks/devenv/:id` | DevenvTaskDetailPage (249) | 개발환경(Jupyter·Jenkins·ArgoCD) 목업 | ●●○ |
| 15 | `…/tasks/model/:id` | ModelTaskDetailPage (361) | 모델 과제 — PTU 할당 vs 실사용 | ●●○ |
| 16 | `/catalog` | CatalogPage (311) | **공통 카탈로그** — 계열사·빌더·호스팅 필터, 검색, 공유신청 | ●●● |
| 17 | `/approvals` | ApprovalInboxPage (104) | 결재함 | ●●○ |
| 18 | `/approvals/:id` | ApprovalDetailPage (745) | 결재 상세 + 단계 스텝퍼 | ●●● |
| 19 | `/admin/dashboard` | AdminDashboardPage (3595) | **관리자 통합 대시보드 7탭** — 개요·사용현황·모델·자원·**GPU·인프라**·**안전·거버넌스**·**비용** | ●●● |
| 20 | `/admin/members` | AdminMembersPage (236) | 멤버 관리 | ●●○ |
| 21 | `/admin/featured-agents` | AdminFeaturedAgentsPage (295) | 홈 대표 에이전트 큐레이션 | ●●● |

부가: `public/KNW-301_search_pipeline_register.html` — 라우팅에 연결되지 않은 정적 HTML 시안 잔재. **삭제 대상.**

---

## 3. 재사용 매핑 — 핸드오프 §2의 3막 14화면

판정 요약: **그대로 0 / 개조 9 / 신규 5.** 신규 5개 중 3개가 P0(★)다 — 즉 **승부처는 전부 새로 만들어야 한다.** 재사용의 값어치는 P0가 아니라 P1·P2를 싸게 채워 3막 전체를 완성해주는 데 있다.

### 1막 — 일반 사용자 (자산 가장 얇음)

| # | 화면 | 판정 | 근거 · 재사용 자산 |
|---|---|---|---|
| 1 | 그룹 공통 랜딩 (계열사 선택) | **개조 재사용** | `TenantSwitcher.tsx`(151)에 계열사 드롭다운 전환이 이미 있다. 다만 **KB 7개사 → BNK 10개사 + 그룹 공통 = 11 Namespace**로 교체하고, "상단바 스위처"를 **전체화면 랜딩 그리드**로 승격해야 한다. `LoginPage`의 카드 그리드 레이아웃을 가져다 쓰면 빠르다. |
| 2 | 사용자 포털 Chat | **신규 제작** (부분 재사용) | **채팅 UI가 없다.** `ConversationsTab`(647)은 운영자용 *사후 대화 분석 인박스*(읽기 전용)다. 입력창·전송·스트리밍이 없다. 재사용 가능한 것: turn 버블 렌더러(`ConversationsTab.tsx:419~`)와 PII 마스킹 칩(`:449`), `mockConversations.ts`(614)의 대화 데이터 형식. 모델·에이전트 드롭다운은 `AgentTaskRegisterPage` 셀렉터 재활용. |
| 3 | 규정/책무 어시스턴트 질의 | **신규 제작** | 화면 2와 한 몸. 질의→답변→근거 링크 흐름이 존재하지 않는다. |
| 4 | **Graph RAG 근거 그래프 ★** | **신규 제작 (100%)** | **노드-엣지 그래프 시각화 코드가 0건이다.** 그래프 라이브러리 의존성도 없고(`d3`/`cytoscape`/`reactflow` 전무), 온톨로지·지식그래프 관련 mock도 없다. 인라인 SVG를 쓴 파일이 6개 있으나 전부 스파크라인·아이콘 수준. **가장 큰 신규 개발이자 데모의 클라이맥스 — 여기에 시간을 몰아야 한다.** |
| 5 | PII 실시간 차단 | **개조 재사용** | `mockAgentGovernance.ts`(300)에 `PiiItem`(정규식·마스크템플릿·카테고리·7일 매칭수) / `PiiFilterEvent`(input·output 방향 구분) / `PiiChangeRequest`(결재) 가 완비. `AgentTaskDetailPage` 안에 정책·이력 UI도 있다. 신규 필요분은 **"프롬프트 입력 중 즉시 차단"이라는 실시간 연출**뿐. |

### 2막 — 에이전트 개발자 / 승인권자 (자산 두꺼움)

| # | 화면 | 판정 | 근거 · 재사용 자산 |
|---|---|---|---|
| 6 | 마켓플레이스 | **개조 재사용** | `CatalogPage.tsx`(311) + `mockCatalogAgents.ts`(241) — 계열사·빌더·호스팅 필터, 통합검색, 공유신청 결재 연동까지 있다. 추가 필요: **프롬프트·MCP 카탈로그 축**, 사용량·평가 랭킹, **5단계 공유범위(개인/부서/본부/계열사/그룹)**. 현재는 "같은 계열사만 공유 가능"으로 하드 제약(`CatalogPage.tsx:259`)이라 BNK의 그룹 공유 서사와 반대 — 반드시 뒤집어야 한다. |
| 7 | 노코드 워크플로우 빌더 | **신규 제작** | **캔버스·드래그앤드롭 코드가 0건.** `UploadModal`의 파일 DnD가 전부다. `mockAgentTasks.ts`에 빌더 종류 `studio│pro-code│graph(LangGraph)` 라벨만 존재하고 실제 빌더 화면은 없다. 실행 Trace 패널도 없음. |
| 8 | MCP Tool 자동 등록 | **신규 제작** | **`MCP`/`OpenAPI`/`Swagger`/`WSDL` 문자열 0건.** |
| 9 | **승인 기반 배포 + DB 동적 라우팅 ★** | **개조 재사용 (가장 이득 큰 지점)** | 두 축이 이미 있다. ① `lib/deployApprovalStore.ts`(161) — **메모리 기반**(`useSyncExternalStore`) 결재 스토어에 `category: 'train'│'serv'`(학습계/서빙계), 다단계 `stage{current,total}`, 승인/반려 액션이 구현됨. **BNK의 localStorage 금지 규칙을 이미 만족**한다. ② `DatabaseTaskPage.tsx:113~135` — dev/prod 계정 권한 분기 + **기안 → 정보보호 그룹(개인정보) → DBA·플랫폼 관리 그룹 3단계 결재 스텝퍼**. ③ `RagApiSection`/`DeploySection`은 상태에 따라 dev 엔드포인트 ↔ prod 엔드포인트를 실제로 바꿔 보여준다. **신규 필요분은 "익명화 값 ↔ 복호화 원본"의 좌우 대비 레이아웃과 동의 권원 확인 단계뿐.** |

### 3막 — 운영자 / 거버넌스 (자산 가장 두꺼움)

| # | 화면 | 판정 | 근거 · 재사용 자산 |
|---|---|---|---|
| 10 | 관리자 통합 대시보드 | **개조 재사용 (거의 그대로)** | `AdminDashboardPage.tsx`(3595) + `mockAdminDashboard.ts`(1423). 7탭(개요·사용현황·모델·자원·GPU·인프라·안전거버넌스·비용), 프로젝트별 호출·DAU·스파크라인·인시던트·감사 이벤트까지. **리브랜딩만 하면 즉시 시연 가능.** |
| 11 | 계열사별 미터링·Chargeback | **개조 재사용** | `mockAdminDashboard.ts:1292~1380` — `ConglomerateTokenSeries`(계열사별 30일 토큰 시계열)와 `getCostByConglomerate()`(계열사별 월 토큰·비용·비중 정산)가 이미 있다. 계열사 5개 → 10개 교체 + **Input/Output 토큰 분리 표기**만 추가하면 된다. |
| 12 | GPU 자원 관리 | **개조 재사용** | `mockGpuInfra.ts`(603) — 노드별 GPU 종류·사용률·온도·상태, 모델×위치 배포 매트릭스, 24h 추이, 인프라 이벤트. ⚠️ **위치 4종 중 `csp-azure`·`csp-aws`는 삭제 필수** — BNK는 On-Premise 전용이라 CSP가 화면에 보이면 요건 위반으로 읽힌다. 테넌트별 토큰 쿼터 상한은 `tokenQuotaPct`로 존재. |
| 13 | 가드레일 정책·탐지 이력 | **개조 재사용** | §1막 5번과 같은 자산(`mockAgentGovernance.ts`) + `mockAgentRedTeam.ts`(217, 탈옥·우회 시나리오 레드팀 실행 이력) + Admin 대시보드 `governance` 탭. |
| 14 | **AI 거버넌스 포탈 ★** | **신규 제작** | **`AI기본법`·`위험등급`·`고위험`·`고영향`·`영향평가` 문자열 0건.** "거버넌스"는 결재선 역할명으로만 등장한다. 재사용 가능한 부품: `ApprovalDetailPage.tsx:298`의 `ApprovalStep` 스텝퍼, `ProjectRegisterPage.tsx:526`의 `ApprLineStep` 결재선, `KpiCard`. Flow Diagram·위험등급 대시보드·모니터링 기일 관리는 신규. |

### 작업량 재배분 제안

가이드 §3은 M2(P0 3종)에 3~4일을 잡았지만, 위 판정상 **P0 3종 중 2종(화면 4·14)이 완전 신규이고 1종(화면 9)만 개조**다. 반면 **M3·M4(P1·P2 10화면)는 대부분 리브랜딩+데이터 교체로 끝난다.** 따라서:

- M1(디브랜딩)을 마치면 **화면 10·11·12·13·6이 사실상 동시에 완성**된다 → M4를 M2보다 먼저 끝낼 수 있다.
- 절약된 시간을 **화면 4(Graph RAG)** 에 재투자하는 것이 맞다. 가상 규정 데이터셋(핸드오프가 지목한 병목)까지 포함해 **화면 4에만 3일 이상** 배정할 것을 권한다.
- 화면 2·3·7·8은 자산이 없어 순수 신규다. 시간이 부족하면 **화면 7·8을 P2로 강등**하는 것을 검토할 것(현재 핸드오프는 7이 P1).

---

## 4. KB 흔적 전수 목록

총 **559건** (대소문자 무시 `kb`·`국민`·`kookmin` 매칭, `src/` + 설정 + `index.html`). 성격별로 4종이고, **①이 574건 중 대부분**이라 토큰 이름만 바꾸면 한 번에 사라진다.

### 4-1. 브랜드 컬러 토큰 — 574건 (최다, 그러나 가장 쉬움)

정의 1곳: `tailwind.config.js:36-41`
```js
kb: { yellow:'#FFD200', 'yellow-dark':'#E5BD00', 'yellow-tint':'#FFF7CC', 'yellow-bg':'#FFFBEE' }
```
**`#FFD200`은 KB국민은행 고유 브랜드 옐로우다. 색상값과 토큰명 둘 다 교체해야 한다.**

사용 분포 (클래스 접두사별):
| 클래스 | 건수 |
|---|---|
| `border-kb-yellow-dark` | 279 |
| `bg-kb-yellow-tint` | 105 |
| `bg-kb-yellow` | 88 |
| `bg-kb-yellow-dark` | 79 |
| `bg-kb-yellow-bg` | 10 |
| `text-kb-yellow-dark` | 3 |
| `accent-` / `from-` / `to-` / `outline-kb-yellow-dark` | 9 |

> **처리법**: `tailwind.config.js`에서 `kb:` → `brand:` 로 키를 바꾸고 색상값을 BNK 중립 팔레트로 교체한 뒤, `sed`로 `kb-yellow` → `brand-*` 일괄 치환. 574건이지만 기계적이다. 그 외 하드코딩 색상: `mockAdminDashboard.ts:1305`의 `color:'#E5BD00'`(계열사 차트 색)도 같이 교체.

기타 1건: `src/index.css:23` 주석 `/* KB design helpers */`

### 4-2. 계열사명 — KB 7개사 (BNK 10개사로 전면 교체)

| 파일:라인 | 내용 |
|---|---|
| `src/data/mockCatalogAgents.ts:9-15` | `Tenant` 유니온 타입 — KB국민은행·KB증권·KB손해보험·KB라이프·KB국민카드·KB캐피탈·KB자산운용 |
| `src/data/mockCatalogAgents.ts:234-240` | `TENANT_LIST` 배열 (동일 7개) |
| `src/data/mockCatalogAgents.ts:54,76,98,119,141,162,183,204` | 에이전트별 `tenant:` 값 |
| `src/components/layout/TenantSwitcher.tsx:9-15` | `TENANT_SHORT` 짧은 표기 맵 |
| `src/components/layout/TenantSwitcher.tsx:19,22,32` | 기본값 `'KB국민은행'` 3곳 |
| `src/routes/CatalogPage.tsx:11-12` | `MY_TENANT = 'KB국민은행'` + 주석 |
| `src/routes/AdminDashboardPage.tsx:98` | 화면에 `KB국민은행` 직접 출력 |
| `src/routes/AdminDashboardPage.tsx:81` | 주석 |
| `src/data/mockAdminDashboard.ts:1305-1309` | 차트 계열사 5종(KB국민은행·KB카드·KB증권·KB라이프·KB저축은행) + 색상 |
| `src/data/mockAdminDashboard.ts:1368-1372` | `agentCountByTenant` 5종 |
| `src/data/mockAdminDashboard.ts:4` | 주석 |

> **BNK는 10개 계열사 + 그룹 공통 = 11 Namespace**다. 타입·리스트·색상 배열의 **원소 수가 7 → 11로 늘어나므로** 단순 문자열 치환이 아니라 데이터 구조 확장이 필요하다.

### 4-3. 브랜드 문자열·인명

| 파일:라인 | 내용 | 조치 |
|---|---|---|
| `src/routes/LoginPage.tsx:30-32` | **`bg-kb-yellow` 칩에 `KB` 텍스트 워드마크** | 이미지가 아니라 텍스트 — 교체 쉬움 |
| `src/routes/LoginPage.tsx:38` | `KB금융그룹 AI Agent 운영 플랫폼` | → `BNK금융그룹 공동 생성형 AI 플랫폼` |
| `src/routes/LoginPage.tsx` 주석 | `KB Digital Identity SSO` | 주석 |
| `index.html:5` / `Topbar.tsx:26` | 제목 `GenAI Portal 2.0` | KB 문자열은 아니나 KB 사업 고유명 — 교체 권장 |
| **`김국민`** — 15곳 | `mockPersonas.ts:45`, `mockAdminMembers.ts:50`, `mockAgentTasks.ts:100-101`, `mockAgentDeploys.ts:191,199,207`, `mockApprovals.ts:86,99,107,126`, `mockAdminDashboard.ts:94,665,712,722,742,845,852,941`, `AdminLayout.tsx:26`, `HomePage.tsx:28`, `CatalogPage.tsx:11`, `AgentTaskRegisterPage.tsx:113`, `AgentTaskDetailPage.tsx:1734,1780`, `SearchPipelineDetailPage.tsx:705`, `ApprovalDetailPage.tsx:259` | 페르소나 기본 이름. `이사업`·`박거버` 등 다른 페르소나와 같은 작명 규칙의 가명이지만 **`국민`이 들어가므로 전량 교체** |
| `src/data/mockAgentTasks.ts:58` | 시스템 프롬프트 본문에 `KB국민은행의 PB 자산진단 어시스턴트` | 전면 재작성 |
| `src/data/mockAgentGovernance.ts:211` | PII 예시문 `국민은행 [XXX-XX-XXXXXX]로 이체` | 문구 교체 |
| `src/data/mockPersonas.ts` 부서명 | `금융AI1센터`·`금융AI2센터`·`DT추진부` | KB 조직 실명일 가능성 — BNK 가상 조직명으로 교체 |

> 인명·부서는 mock 주석에 "이름·부서는 mock"이라 명시되어 있어 **실데이터로 보이지는 않는다.** 다만 §4-4의 인프라 호스트명은 실제 KB 내부 명명규칙일 개연성이 있다.

### 4-4. 실데이터로 보이는 것 — 내부 호스트명·엔드포인트 ⚠️

**`kbfg.com`은 KB금융그룹 실제 도메인이다.** 아래는 전량 화면 표시용 mock 문자열이지만(§5-2에서 확인: 네트워크 호출 없음), **KB 내부 시스템 명명규칙이 그대로 노출되어 있어 BNK 제안 화면에 남으면 사고다. 전량 삭제·교체 필수.**

| 호스트 | 건수 | 파일:라인 |
|---|---|---|
| `kb-genai.search.windows.net` / `kb-genai-dev.…` (Azure AI Search) | 8 | `DeploySection.tsx:19,20`, `RagApiSection.tsx:94,160`, `ServingApiSection.tsx:13`, `deployApprovalStore.ts:63,83,103` |
| `langfuse.kbfg.com` | 5 | `mockAgentEvals.ts:44,74,82,89,94` |
| `search-evals.kbagentops.kbfg.com` | 6 | `mockPipelineTasks.ts:316,331,346,351,354,355` |
| `search-dev.kbagentops.kbfg.com` | 2 | `mockPipelineTasks.ts:376,422` |
| `api.kbfg.com` / `api-train.kbfg.com` | 2 | `mockAgentDeploys.ts:350,360` |
| `pb-consult-db.kb-internal.local:5432` / `-dev` | 2 | `DatabaseTaskPage.tsx` (DB 접속 정보 형태) |
| `gitlab.kb-internal.local` · `github.kb.local` | 4+2 | `DevenvTaskDetailPage.tsx:236` 외 |
| `jenkins.kbagentops.local` · `argocd.kbops.local` · `grafana.kbops.local` · `coder.kbops.local` · `langfuse.kbops.local` | 12 | `DevenvTaskDetailPage.tsx:153,213,218,241`, `TrafficTab.tsx:18`, `AdminDashboardPage.tsx:65`, `ConversationsTab.tsx:287` |

추가로 **API 키 형태 문자열** `kb-rag-sk-…`, 프로젝트 슬러그 `kb-pb-advisor`·`kb-embed-finance`, 모니터링 리소스명 `kbagentops-mon`(7)·`kbagentops-gateway`(7)·`kbops-agent-monitoring`·`kbops-admin-dashboard` 가 있다. 원본 README는 이들을 "UI 표현용 가짜 값"이라 명시하지만, **명명규칙 자체가 KB 자산 정보**이므로 남기지 않는다.

> ⚠️ **Azure 종속 서사 주의**: 엔드포인트가 `search.windows.net`(Azure AI Search)이고 GPU mock에 `csp-azure`/`csp-aws`가 있다. **BNK는 On-Premise 전용**이라 클라우드 흔적은 브랜드 문제를 넘어 **요건 위반으로 읽힌다.** §3 화면 12와 함께 처리할 것.

### 4-5. 기타
- `package.json:2` — `"name": "kbagentops-frontend"`
- `src/lib/persona.ts:8` — `'kbops:current-persona'` / `TenantSwitcher.tsx:5` — `'kbops:current-tenant'` (§5-4에서 어차피 제거)
- `src/App.tsx:36` — 같은 키 직접 참조
- `mockPipelineTasks.ts:376,422` — 경로가 `/v1/search/regulation-compliance` (규정 준수 검색) → **BNK 규정/책무 도메인과 겹쳐 오히려 재활용 가치 있음**

**M1 완료 판정 기준**: `grep -rniE 'kb|국민|kookmin|kbfg' src index.html tailwind.config.js package.json` 결과 **0건**. (영문 단어 내부 우연 일치 — 예: `feedback`, `breakdown` — 는 없음을 확인했다. `kb`는 전부 브랜드 유래다.)

---

## 5. 오프라인 리스크

### 좋은 소식 — 근본 리스크는 낮다

| 검사 | 결과 |
|---|---|
| `fetch` / `axios` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon` | **0건** ✅ |
| `@font-face` / `@import` / `<link rel>` / CDN(`googleapis`·`unpkg`·`jsdelivr`·`cdn.`) | **0건** ✅ |
| `<img>` / `background-image` / 이미지 파일 import | **0건** ✅ (아이콘은 인라인 SVG 6파일 + 이모지) |
| 런타임 의존성 | 3개(react·react-dom·react-router-dom) — 전부 번들 포함 ✅ |

**즉 페이지 로드 시 외부로 나가는 요청이 원천적으로 없다.** 아래는 그럼에도 반드시 처리할 5건이다.

### 5-1. ~~`BrowserRouter`가 `file://`에서 동작하지 않는다~~ — ✅ M1에서 해소 (HashRouter 교체)

`src/main.tsx:9` — `<BrowserRouter>`. `file://` 로 열면 최초 렌더는 되지만 **모든 라우트 이동이 깨진다**(History API가 `file://` origin에서 동작하지 않음). 새로고침도 불가.

**조치**: `HashRouter`(또는 `MemoryRouter`)로 교체. `vite.config.ts`에 `base: './'` 추가.
→ 가이드 §0의 `vite-plugin-singlefile` 경로를 택하더라도 **라우터 교체는 별개로 필수**다. 단일 HTML이어도 `file://` origin 제약은 동일하다.
→ **M1에서 즉시 처리하고 그 시점에 `file://` 열기 리허설을 1회 해 둘 것.** M5까지 미루면 늦다.

### 5-2. 외부 링크 `href` 22개소 — 시연 중 클릭하면 이탈한다

소스의 `http(s)://` 문자열 34건 자체는 대부분 **화면 표시용**이라 페이지 로드 시 요청이 발생하지 않는다. 문제는 그중 상당수가 **실제 `<a href>` 로 연결되어 있다**는 점이다. 변수·템플릿 리터럴로 조립되는 경우가 많아 리터럴 grep으로는 잡히지 않는다.

**외부 링크 22개소 / 7개 파일** (내부 라우팅 `to=`·페이지 내 앵커 `#` 제외):

| 파일 | 라인 | 대상 |
|---|---|---|
| `routes/DevenvTaskDetailPage.tsx` | 153, 213, 218, 236, 241 | coder·jenkins×2·github·argocd (**리터럴 URL 직접 기입**) |
| `routes/AgentTaskDetailPage.tsx` | 487, 518, 534, 591, 675, 757 | Langfuse 실행·데이터셋·프로젝트 |
| `routes/SearchPipelineDetailPage.tsx` | 992, 1009, 1056, 1155, 1298 | 평가 콘솔 데이터셋·실행 |
| `components/projectDetail/TrafficTab.tsx` | 71, 349, 396 | Grafana 대시보드·패널 |
| `routes/AdminDashboardPage.tsx` | 1016, 2820 | Grafana 관리 패널 |
| `components/projectDetail/ConversationsTab.tsx` | 325 | Langfuse 트레이스 |

URL 생성기도 함께 제거 대상이다 — `TrafficTab.tsx:18` `GRAFANA_BASE` + `grafanaDashUrl()`/`grafanaPanelUrl()`, `AdminDashboardPage.tsx:65` `GRAFANA_BASE` + `grafanaAdminPanel()`, `ConversationsTab.tsx:287` `langfuseUrl`.

**왜 위험한가**: `DevenvTaskDetailPage.tsx:198`의 공용 링크 컴포넌트가 `target="_blank" rel="noopener noreferrer"` 를 붙인다. **시연 중 잘못 클릭하면 새 탭이 열리고 오프라인 오류 페이지가 뜬다** — 발표 흐름이 끊기고, 화면에 KB 내부 호스트명이 주소창에 그대로 노출된다.

**조치**: `href` 를 제거하고 비활성 표시(툴팁 "외부 모니터링 연동 — 데모 범위 밖")로 바꾼다. 3막 화면(10·11·12·13)을 개조할 때 함께 처리할 것.

> `public/KNW-301_…html` 의 `http://www.w3.org/2000/svg` 3건은 **XML 네임스페이스 식별자로 네트워크 요청이 아니다.** 해당 파일 자체가 라우팅 미연결 잔재이므로 삭제(§5-5 ③).

### 5-3. 웹폰트 — 로드는 없으나 렌더가 환경에 좌우된다

`tailwind.config.js:8-19` — `fontFamily.sans` 첫 항목이 **`Pretendard`**. 이 폰트를 **어디서도 로드하지 않는다**(외부 요청 0건은 이 때문). 발표 노트북에 Pretendard가 설치되어 있으면 그것으로, 없으면 `Apple SD Gothic Neo` → `Noto Sans KR` → 시스템 폰트로 폴백한다.

**리스크**: 개발 맥과 발표 노트북(Windows/Edge 가능성)의 폰트가 달라 **자간·줄바꿈이 달라지고 1280×720 레이아웃이 깨질 수 있다.**
**조치 택1** — ⓐ Pretendard를 `.woff2` → base64로 번들에 인라인(권장, 결정론적) ⓑ 폴백 체인을 발표 환경 기준으로 고정. **M5가 아니라 M1에서 정할 것** — 폰트가 바뀌면 이후 만든 화면의 레이아웃 검증이 전부 무효가 된다.

### 5-4. ~~`localStorage` 3개소 — BNK 규칙 위반~~ — ✅ M1에서 해소 (메모리 스토어 전환)

| 파일:라인 | 키 |
|---|---|
| `src/lib/persona.ts:13,20,28` | `kbops:current-persona` |
| `src/App.tsx:36` | 같은 키 직접 조회 (`PersonaGate`) |
| `src/components/layout/TenantSwitcher.tsx:20,54` | `kbops:current-tenant` |

핸드오프 §3·가이드 §2 모두 금지. **`deployApprovalStore.ts`의 `useSyncExternalStore` 모듈 스토어 패턴이 이미 리포 안에 있으므로 그대로 따라 만들면 된다.**
> 부수 효과 — 시연 중 상태가 초기화되지 않아 리허설과 본 시연이 달라지는 사고를 막아준다. 오히려 데모에 유리하다.

### 5-5. ~~빌드 산출물 실측 — 외부 URL 31건, `file://` 에셋 경로 깨짐~~ — ✅ M1에서 해소

> **해소 결과(2026-08-25)**: `vite-plugin-singlefile` 적용으로 `dist/index.html` 단일 파일(980 KB)만 남고 에셋 경로 문제 소멸. KB 호스트 30건은 소스 교체로 제거. 헤드리스 Chrome으로 `file://` 직접 로드를 실측해 **React 실행·로그인 화면 렌더·CORS 에러 0건**을 확인했다. 남은 외부 URL은 `reactjs.org`(React 내장) 1건과 가상 사내 도메인 `*.aip.group.local` 뿐이다.
>
> 아래는 해소 전 기록이다.

`npm run build` 후 `dist/`를 직접 검사한 결과다(가이드 §5 DoD 항목의 사전 측정).

**① `dist/index.html` 의 에셋 경로가 절대경로다:**
```html
<script type="module" crossorigin src="/assets/index-BMph9p4h.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DZw5jhbE.css">
```
`file://` 로 열면 `/assets/…` 를 **파일시스템 루트**에서 찾아 JS·CSS 로드가 실패한다 → 흰 화면.
**조치**: `vite.config.ts`에 `base: './'` 추가, 또는 `vite-plugin-singlefile` 적용(에셋을 HTML에 인라인하므로 경로 문제 자체가 사라진다 — 권장).
> `crossorigin` 속성도 `file://` 에서 문제를 일으킬 수 있다. singlefile 경로를 택하면 함께 해소된다.

**② 번들에 외부 URL 문자열 31건이 그대로 실려 있다** (w3.org SVG 네임스페이스 제외):

| 도메인 | 건수 |
|---|---|
| `kb-genai(-dev).search.windows.net` | 7 |
| `search-evals.kbagentops.kbfg.com` | 6 |
| `*.kbops.local` (grafana·langfuse·coder·argocd) | 5 |
| `langfuse.kbfg.com` | 4 |
| `jenkins.kbagentops.local` | 2 |
| `search-dev.kbagentops.kbfg.com` | 2 |
| `api(-train).kbfg.com` | 2 |
| `github.kb.local` | 1 |
| `reactjs.org/docs/error-decoder.html` | 1 |

앞의 30건은 §4-4의 KB 내부 호스트명이 소스에 남아 있어서 번들된 것이다 — **M1에서 소스를 고치면 자동으로 사라진다.**
마지막 `reactjs.org` 1건은 **React 프로덕션 빌드가 내장하는 에러 디코더 URL**이라 소스 수정으로 제거되지 않는다. 네트워크 요청은 발생하지 않지만, **DoD의 "외부 URL grep 0건"을 문자 그대로 적용하면 이 1건 때문에 통과하지 못한다.** 판정 기준을 "KB/외부 서비스 호스트 0건"으로 정정할 것.

**③ 삭제 대상 배포 설정**: `public/staticwebapp.config.json` — Azure Static Web Apps 배포 설정. 오프라인 데모에 무의미하고 KB 인프라 흔적이다. `public/KNW-301_search_pipeline_register.html`(라우팅 미연결 정적 시안 잔재)도 함께 삭제.

**④ `vite-plugin-singlefile` 미적용** — 가이드 §0 권장 경로를 쓰려면 추가 필요. 현재 번들 900 KB는 인라인해도 단일 HTML로 무리 없는 크기다.

**⑤ 타입 안전망 주의**: `build`는 `tsc -b`를 먼저 돌리고 `strict: true`다. **타입 에러 1건이면 빌드가 실패한다.** 현재는 깨끗하지만, M1에서 `Tenant` 유니온(7개 → 11개)을 건드리면 `TENANT_SHORT`·`agentCountByTenant` 등 `Record<Tenant, …>` 매핑이 연쇄로 깨진다 — **오히려 누락 방지 장치로 쓸 것.** 리브랜딩 직후 `npm run typecheck`로 확인.

### 5-6. mock 중앙화가 완전하지 않다

가이드 §2는 "모든 mock은 `src/mock/` 아래 중앙화, 컴포넌트 하드코딩 금지"를 요구하지만 원본은 **`src/data/`** 이고, 일부는 라우트 파일 안에 있다:
- `DatabaseTaskPage.tsx:110-135` — `/* ---------------- Mock ---------------- */` 블록 (계정 권한·결재선)
- `components/knowledgeData/parseRunData.ts`(520)·`embedData.ts`(331)·`storageData.ts`(164) — 컴포넌트 폴더 안의 데이터
- `lib/deployApprovalStore.ts:51-112` — 스토어 초기값

**시연 직전 문구 수정 병목이 될 지점이다.** 디렉터리를 `src/mock/`으로 옮길지, `src/data/` 유지하고 CLAUDE.md 규칙을 원본에 맞춰 고칠지 M1에서 결정할 것. (**후자를 권함** — 96파일의 import 경로를 흔드는 것보다 규칙 한 줄을 고치는 편이 안전하다.)

---

## 6. 결론 — 남은 결정

M0(인벤토리)·M1(디브랜딩)·오프라인 개통이 끝났다. 남은 것은 아래 2건이다.

1. **폰트 정책 (§5-3, 미해소)** — 현재 `Pretendard` 를 지정만 하고 로드하지 않아 발표 노트북 환경에 따라 자간·줄바꿈이 달라진다. ⓐ `pretendard` npm 패키지를 번들에 인라인(결정론적, 단일 HTML 크기 +α) ⓑ 폴백 체인을 발표 환경 기준으로 고정(크기 유지, 환경 의존 잔존). **화면을 더 만들기 전에 정해야** 레이아웃 검증이 유효하다.
2. **작업 순서 (§3 말미)** — 리브랜딩이 끝나 화면 10·11·12·13·6이 사실상 시연 가능해졌다. 가이드 §3 순서(M2 P0 → M3 P1 → M4 P2)를 그대로 갈지, **M4를 앞당기고 확보한 시간을 화면 4(Graph RAG)에 투입**할지.

### 완료 판정 실측 (2026-08-25, M1 시점)

| 항목 | 결과 |
|---|---|
| KB 문자열 (`kb`·국민·kookmin·kbfg, 영단어 내부 제외) | **0건** |
| KB 옐로우 hex (`#FFD200`·`#E5BD00`·`#FFF7CC` 등) | **0건** |
| `localStorage`/`sessionStorage`/`indexedDB` | **0건** |
| `npm run typecheck` | 통과 |
| `npm run build` | 성공 · `dist/index.html` 단일 980 KB |
| `dist` 내 KB·외부 서비스 호스트 | **0건** (`reactjs.org` 1건은 React 내장) |
| `file://` 직접 로드 (헤드리스 실측) | 렌더 성공 · CORS/로드 에러 0건 |
| 미검증 | 전 화면 클릭 순회 · Edge · 1280×720 프로젝터 실물 |
