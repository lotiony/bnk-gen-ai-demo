import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginPage from './routes/LoginPage';
import HomePage from './routes/HomePage';
import ChatPage from './routes/ChatPage';
import PersonalDocsPage from './routes/PersonalDocsPage';
import TenantLandingPage from './routes/TenantLandingPage';
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

function PersonaGate({ children }: { children: React.ReactNode }) {
  const persona = useCurrentPersona();
  const location = useLocation();

  // 페르소나는 메모리 스토어라 렌더 시점에 즉시 확정된다(로딩 상태 없음).
  if (!persona) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <PersonaGate>
            <Layout />
          </PersonaGate>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/documents" element={<PersonalDocsPage />} />
        <Route path="/tenants" element={<TenantLandingPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/new" element={<ProjectRegisterPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route
          path="/projects/:projectId/tasks/knowledge/create"
          element={<KnowledgeTaskRegisterPage />}
        />
        <Route
          path="/projects/:projectId/tasks/knowledge/new"
          element={<KnowledgeDataTaskPage />}
        />
        <Route
          path="/projects/:projectId/tasks/database/new"
          element={<DatabaseTaskPage />}
        />
        <Route
          path="/projects/:projectId/tasks/component/:componentId"
          element={<ComponentTaskPage />}
        />
        <Route
          path="/projects/:projectId/tasks/pipeline/new"
          element={<SearchPipelineTaskPage />}
        />
        <Route
          path="/projects/:projectId/tasks/pipeline/:pipelineId"
          element={<SearchPipelineDetailPage />}
        />
        <Route
          path="/projects/:projectId/tasks/agent/new"
          element={<AgentTaskRegisterPage />}
        />
        <Route
          path="/projects/:projectId/tasks/agent/:agentId"
          element={<AgentTaskDetailPage />}
        />
        <Route
          path="/projects/:projectId/tasks/devenv/:taskId"
          element={<DevenvTaskDetailPage />}
        />
        <Route
          path="/projects/:projectId/tasks/model/:modelTaskId"
          element={<ModelTaskDetailPage />}
        />
        <Route path="/projects/:projectId/tasks/ontology" element={<OntologyTaskPage />} />
        <Route path="/projects/:projectId/tasks/routing" element={<DataRoutingTaskPage />} />
        <Route path="/projects/:projectId/tasks/workflow" element={<WorkflowBuilderPage />} />
        <Route path="/projects/:projectId/tasks/mcp" element={<McpRegisterPage />} />
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

        {/* 지식 · 데이터 — RFP 구분 2(EDA) · 3(RAG). 온톨로지가 여기로 옮겨 왔다. */}
        <Route path="/knowledge" element={<KnowledgeLayout />}>
          <Route index element={<KnowledgeListPage />} />
          <Route path="data" element={<KnowledgeDataTaskPage />} />
          <Route path="ontology" element={<OntologyTaskPage />} />
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
