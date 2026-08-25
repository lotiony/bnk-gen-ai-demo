import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import LoginPage from './routes/LoginPage';
import HomePage from './routes/HomePage';
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
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboardPage from './routes/AdminDashboardPage';
import AdminMembersPage from './routes/AdminMembersPage';
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
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="members" element={<AdminMembersPage />} />
          <Route path="featured-agents" element={<AdminFeaturedAgentsPage />} />
        </Route>
        <Route path="/approvals" element={<ApprovalInboxPage />} />
        <Route path="/approvals/:approvalId" element={<ApprovalDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
