import { Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DemoFooter from './components/layout/DemoFooter';
import AreaGuard, { ReadOnlyOntologyPage } from './components/layout/AreaGuard';
import { canViewOntologyReadOnly } from './lib/personaView';
import LoginPage from './routes/LoginPage';
import HomePage from './routes/HomePage';
import ChatPage from './routes/ChatPage';
import CustomerAssistPage from './routes/CustomerAssistPage';
import PersonalDocsPage from './routes/PersonalDocsPage';
import PortalLandingPage from './routes/PortalLandingPage';
import { useCurrentPersona } from './lib/persona';
import ProjectsListPage from './routes/ProjectsListPage';
import ProjectDetailPage from './routes/ProjectDetailPage';
import ProjectRegisterPage from './routes/ProjectRegisterPage';
import ApprovalInboxPage from './routes/ApprovalInboxPage';
import ApprovalDetailPage from './routes/ApprovalDetailPage';
import KnowledgeDataTaskPage from './routes/KnowledgeDataTaskPage';
import DatabaseTaskPage from './routes/DatabaseTaskPage';
import ComponentTaskPage from './routes/ComponentTaskPage';
import KnowledgeTaskRegisterPage from './routes/KnowledgeTaskRegisterPage';
import SearchPipelineTaskPage from './routes/SearchPipelineTaskPage';
import SearchPipelineDetailPage from './routes/SearchPipelineDetailPage';
import CatalogPage from './routes/CatalogPage';
import AgentTaskRegisterPage from './routes/AgentTaskRegisterPage';
import AgentTaskDetailPage from './routes/AgentTaskDetailPage';
import DevenvTaskDetailPage from './routes/DevenvTaskDetailPage';
import ModelTaskDetailPage from './routes/ModelTaskDetailPage';
import OntologyTaskPage from './routes/OntologyTaskPage';
import DataRoutingTaskPage from './routes/DataRoutingTaskPage';
import WorkflowBuilderPage from './routes/WorkflowBuilderPage';
import McpRegisterPage from './routes/McpRegisterPage';
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboardPage from './routes/AdminDashboardPage';
import AdminAnomalyPage from './routes/AdminAnomalyPage';
import AdminAssetSpreadPage from './routes/AdminAssetSpreadPage';
import StudioLayout from './components/layout/StudioLayout';
import KnowledgeLayout from './components/layout/KnowledgeLayout';
import StudioTasksPage from './routes/StudioTasksPage';
import PromptLibraryPage from './routes/PromptLibraryPage';
import KnowledgeListPage from './routes/KnowledgeListPage';
import PlaygroundPage from './routes/PlaygroundPage';
import DevenvListPage from './routes/DevenvListPage';
import MetadataApprovalPage from './routes/MetadataApprovalPage';
import Nl2SqlPage from './routes/Nl2SqlPage';
import ReindexPage from './routes/ReindexPage';
import GovernanceLayout from './components/layout/GovernanceLayout';
import AiGovernancePage from './routes/AiGovernancePage';
import GovernanceAdminPage from './routes/GovernanceAdminPage';
import MeteringPage from './routes/MeteringPage';
import AdminMembersPage from './routes/AdminMembersPage';
import AdminIntakePage from './routes/AdminIntakePage';
import AdminDrmPage from './routes/AdminDrmPage';
import AdminTasksPage from './routes/AdminTasksPage';
import AdminServicesPage from './routes/AdminServicesPage';
import AdminGuardrailPage from './routes/AdminGuardrailPage';
import AdminSecurityPage from './routes/AdminSecurityPage';
import AdminContentPage from './routes/AdminContentPage';
import AdminFeaturedAgentsPage from './routes/AdminFeaturedAgentsPage';
import AdminGatewayPage from './routes/AdminGatewayPage';
import AdminVectorStorePage from './routes/AdminVectorStorePage';
import AdminModelsPage from './routes/AdminModelsPage';
import AdminPlatformPage from './routes/AdminPlatformPage';

function PersonaGate({ children }: { children: React.ReactNode }) {
  const persona = useCurrentPersona();
  const location = useLocation();

  // 페르소나는 메모리 스토어라 렌더 시점에 즉시 확정된다(로딩 상태 없음).
  if (!persona) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 * 프로젝트 계층(`/projects/…`) 정리
 *
 * GNB 에서 「프로젝트」는 이미 내렸다(GNB.tsx 주석 — RFP 에 사용자 포털의
 * 프로젝트 계층은 없다). 그런데 라우트는 `<Layout />` 직속으로 남아 있어
 * `AreaGuard` 를 타지 않았고, 그 결과 **일반 사용자가 딥링크로 온톨로지
 * 편집기·데이터 라우팅까지 들어갈 수 있었다.** 두 갈래로 정리한다.
 *
 *  ① 현재 IA 에 대응 경로가 있는 과제 화면 → `<Navigate replace>` 로 접는다.
 *     딥링크는 살아 있되 도착지는 하나로 모인다(브레드크럼·되돌아가기도 정상화).
 *
 *  ② 대응 경로가 없어 살려야 하는 화면 → `AreaGuard area="studio"` 로 감싼다.
 *     남기는 근거 —
 *       · `/projects/:projectId`  : 관리자 대시보드가 과제 현황에서 여기로 링크한다
 *                                   (mockAdminDashboard.href, AdminDashboardPage 9곳).
 *       · `tasks/agent/:agentId`  : AI Studio 과제 목록의 에이전트 행 진입점
 *       · `tasks/model/:modelTaskId` : 같은 목록의 모델 행 진입점
 *                                   (둘 다 `src/data/studioTasks.ts` 가 이 경로를 만든다)
 *       · `tasks/component/:componentId` · `tasks/knowledge/create`
 *                                   : 프로젝트 상세 과제 탭에서만 도달하는 화면
 *     'studio' 를 고른 이유는 이 화면들이 전부 제작 워크스페이스의 과제 화면이고,
 *     허용 대상(개발자 그룹 + 관리자 그룹)이 정확히 프로젝트 열람 대상과 같아서다.
 * ─────────────────────────────────────────────────────────────────────────
 */
function ProjectsArea() {
  return (
    <AreaGuard area="studio">
      <Outlet />
    </AreaGuard>
  );
}

/** `/projects/:projectId/tasks/devenv/:taskId` → AI Studio 개발환경 상세. */
function RedirectDevenvTask() {
  const { taskId } = useParams();
  return <Navigate to={`/studio/devenv/${taskId}`} replace />;
}

/** `/projects/:projectId/tasks/pipeline/:pipelineId` → 지식·데이터 검색 파이프라인 상세. */
function RedirectPipelineTask() {
  const { pipelineId } = useParams();
  return <Navigate to={`/knowledge/pipeline/${pipelineId}`} replace />;
}

export default function App() {
  const persona = useCurrentPersona();
  /**
   * 일반 사용자의 근거 그래프 진입(시연 대본 화면 4).
   * 지식·데이터 셸(사이드바) 밖의 읽기 전용 단독 화면으로 뺀다 — 사유는
   * `personaView.canViewOntologyReadOnly` · `ReadOnlyOntologyPage` 주석 참조.
   * 두 라우트는 배타적으로만 등록되므로 경로가 겹치지 않는다.
   */
  const ontologyReadOnly = canViewOntologyReadOnly(persona);

  return (
    <Routes>
      {/* 로그인은 `Layout` 밖이라 푸터를 여기서 직접 붙인다(다른 화면은 Layout). */}
      <Route
        path="/login"
        element={
          <>
            <LoginPage />
            <DemoFooter />
          </>
        }
      />
      <Route
        element={
          <PersonaGate>
            <Layout />
          </PersonaGate>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        {/* AGB-006 ⑤ 고객/민원 분석 — 시나리오 1 고객 상담 워크스페이스 */}
        <Route path="/assist/customer" element={<CustomerAssistPage />} />
        <Route path="/documents" element={<PersonalDocsPage />} />
        {/*
          공통 포털 랜딩 — 로그인 직후 도착지. 포털 선택과 Namespace 구조를 함께 다룬다.
          옛 `/tenants`(계열사 선택 랜딩)를 흡수했으므로 딥링크는 여기로 접는다.
        */}
        <Route path="/portal" element={<PortalLandingPage />} />
        <Route path="/tenants" element={<Navigate to="/portal" replace />} />

        {/* 프로젝트 계층 — AreaGuard 로 감싼다(위 주석 ①②). */}
        <Route element={<ProjectsArea />}>
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/new" element={<ProjectRegisterPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="/projects/:projectId/tasks/knowledge/create"
            element={<KnowledgeTaskRegisterPage />}
          />
          <Route
            path="/projects/:projectId/tasks/component/:componentId"
            element={<ComponentTaskPage />}
          />
          <Route
            path="/projects/:projectId/tasks/agent/:agentId"
            element={<AgentTaskDetailPage />}
          />
          <Route
            path="/projects/:projectId/tasks/model/:modelTaskId"
            element={<ModelTaskDetailPage />}
          />

          {/* ── 현재 IA 로 접는 딥링크 (대응 경로가 이미 있는 화면) ── */}
          <Route
            path="/projects/:projectId/tasks/knowledge/new"
            element={<Navigate to="/knowledge/data" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/database/new"
            element={<Navigate to="/knowledge/db" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/pipeline/new"
            element={<Navigate to="/knowledge/pipeline" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/pipeline/:pipelineId"
            element={<RedirectPipelineTask />}
          />
          <Route
            path="/projects/:projectId/tasks/agent/new"
            element={<Navigate to="/studio/agents" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/devenv/:taskId"
            element={<RedirectDevenvTask />}
          />
          <Route
            path="/projects/:projectId/tasks/ontology"
            element={<Navigate to="/knowledge/ontology" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/routing"
            element={<Navigate to="/knowledge/routing" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/workflow"
            element={<Navigate to="/studio/workflow" replace />}
          />
          <Route
            path="/projects/:projectId/tasks/mcp"
            element={<Navigate to="/studio/tools" replace />}
          />
        </Route>
        {/*
          AI Studio — RFP 기술요건 구분 4(AGB) + 검증 도구(LSM-005 · RAG-009) + 개발환경(ONM-008).
          프로젝트 메뉴를 대체한다. 무거운 빌더는 같은 셸 안에서 전폭으로 렌더된다.
        */}
        <Route path="/studio" element={<StudioLayout />}>
          <Route index element={<StudioTasksPage />} />
          <Route path="agents" element={<AgentTaskRegisterPage />} />
          <Route path="workflow" element={<WorkflowBuilderPage />} />
          <Route path="tools" element={<McpRegisterPage />} />
          <Route path="prompts" element={<PromptLibraryPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="devenv" element={<DevenvListPage />} />
          <Route path="devenv/:taskId" element={<DevenvTaskDetailPage />} />
        </Route>

        {/*
          일반 사용자의 근거 그래프 진입 — 지식·데이터 셸 **밖**의 읽기 전용 단독 화면.
          권한자에게는 등록되지 않으므로 아래 셸 안의 `ontology` 와 겹치지 않는다.
        */}
        {ontologyReadOnly && (
          <Route path="/knowledge/ontology" element={<ReadOnlyOntologyPage />} />
        )}

        {/* 지식 · 데이터 — RFP 구분 2(EDA) · 3(RAG). 온톨로지가 여기로 옮겨 왔다. */}
        <Route path="/knowledge" element={<KnowledgeLayout />}>
          <Route index element={<KnowledgeListPage />} />
          <Route path="data" element={<KnowledgeDataTaskPage />} />
          {!ontologyReadOnly && <Route path="ontology" element={<OntologyTaskPage />} />}
          <Route path="pipeline" element={<SearchPipelineTaskPage />} />
          <Route path="pipeline/:pipelineId" element={<SearchPipelineDetailPage />} />
          <Route path="db" element={<DatabaseTaskPage />} />
          <Route path="routing" element={<DataRoutingTaskPage />} />
          <Route path="metadata" element={<MetadataApprovalPage />} />
          <Route path="nl2sql" element={<Nl2SqlPage />} />
          <Route path="reindex" element={<ReindexPage />} />
        </Route>

        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="anomaly" element={<AdminAnomalyPage />} />
          <Route path="asset-spread" element={<AdminAssetSpreadPage />} />
          {/* 거버넌스는 최상위 /governance 로 분리됐다 — 기존 링크 보존용 리다이렉트 */}
          <Route path="governance" element={<Navigate to="/governance" replace />} />
          <Route path="metering" element={<MeteringPage />} />
          <Route path="tasks" element={<AdminTasksPage />} />
          <Route path="services" element={<AdminServicesPage />} />
          <Route path="intake" element={<AdminIntakePage />} />
          <Route path="guardrails" element={<AdminGuardrailPage />} />
          <Route path="security" element={<AdminSecurityPage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="drm" element={<AdminDrmPage />} />
          <Route path="members" element={<AdminMembersPage />} />
          <Route path="featured-agents" element={<AdminFeaturedAgentsPage />} />
          {/* ONM-002 단일 통로 · LSM-008 테넌트 토큰 쿼터 */}
          <Route path="gateway" element={<AdminGatewayPage />} />
          {/* RAG-005 Vector DB 연동·독립성 */}
          {/* LSM-001 모델 등록·버전·폐기 · LSM-004 외부 서빙 API */}
          <Route path="models" element={<AdminModelsPage />} />
          <Route path="vector-store" element={<AdminVectorStorePage />} />
          <Route path="platform" element={<AdminPlatformPage />} />
        </Route>
        {/* AI 거버넌스 포탈 — RFP 2-3 "AI플랫폼 포탈 내 별도 기능" · 독립 셸 */}
        <Route path="/governance" element={<GovernanceLayout />}>
          <Route index element={<AiGovernancePage />} />
          <Route path="admin" element={<GovernanceAdminPage />} />
        </Route>
        <Route path="/approvals" element={<ApprovalInboxPage />} />
        <Route path="/approvals/:approvalId" element={<ApprovalDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
