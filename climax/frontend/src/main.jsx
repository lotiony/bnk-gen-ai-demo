import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProjectProvider } from "./ProjectContext";
import { DesignProvider } from "./DesignContext";
import { handleAuthRedirect } from "./lib/azureAuth";
import { legacyRedirect } from "./routes";
import "./styles.css";

// MSAL 로그인 팝업/리다이렉트 응답 처리 — 앱 로드 시 1회. 팝업 컨텍스트면 여기서 닫힌다.
handleAuthRedirect();

// 예전 딥링크(?screen=…)는 라우터가 보기 전에 새 주소로 갈아끼운다 — 대시보드가
// 한 프레임 비쳤다가 바뀌는 깜빡임 없이, 처음부터 목적 화면으로 뜬다.
const legacy = legacyRedirect(window.location.search);
if (legacy) window.history.replaceState(null, "", legacy);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ProjectProvider>
          <DesignProvider>
            <App />
          </DesignProvider>
        </ProjectProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
