import { createContext, useContext, useEffect, useRef, useState } from "react";
import { PROJECT_MISSING_EVENT, api, setActiveProjectId } from "./api";

const Ctx = createContext(null);
export const useProjects = () => useContext(Ctx);

// 선택한 프로젝트를 새로고침 너머로 유지 — 저장하지 않으면 리로드마다 기본 프로젝트로
// 되돌아가, 방금 변환한 프로젝트 대신 시드 데이터가 보인다. lang/theme 과 같은 방식.
const ACTIVE_KEY = "ember_active_project";

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  // 활성 프로젝트가 정해지기 전에는 화면을 그리지 않는다.
  //
  // 화면들은 마운트 즉시 목록을 부르는데, 그때 activeId 가 아직 null 이면 요청에
  // project_id 가 실리지 않는다. 백엔드는 미지정을 기본 프로젝트로 해석하므로,
  // 방금 온보딩으로 만든 프로젝트를 보고 있어도 기본 프로젝트의 목록이 돌아온다
  // ("연결된 레거시 DB가 없습니다" 가 뜨는 이유). 프로젝트 스코프 화면 전부가 같은
  // 조건에 걸리므로 화면마다 막지 않고 여기서 한 번에 끊는다.
  const [ready, setReady] = useState(false);

  // 현재 선택값을 ref 로도 들고 있는다 — refresh 가 최신 값을 읽어야 하는데
  // 클로저에 잡힌 state 는 갱신 전 값일 수 있다.
  const activeRef = useRef(null);

  const refresh = async () => {
    const { projects } = await api.projects();
    // 삭제된 프로젝트가 저장돼 있을 수 있으므로 목록에 있는지 확인 후 채택
    const want = activeRef.current || localStorage.getItem(ACTIVE_KEY);
    const next = want && projects.some((p) => p.id === want)
      ? want : (projects.find((p) => p.is_default) || projects[0])?.id || null;
    // API 클라이언트에 먼저 알린다. setState 업데이터 안에서 부수효과를 일으키면
    // 실행 시점이 렌더 스케줄에 좌우돼, 자식이 먼저 요청을 보내는 순간이 생긴다.
    activeRef.current = next;
    setActiveProjectId(next);
    if (next) localStorage.setItem(ACTIVE_KEY, next);
    setProjects(projects);
    setActiveId(next);
  };
  // 실패해도 ready 로 넘긴다 — 프로젝트가 하나도 없거나 API 가 죽어도 빈 화면에 갇히면 안 된다.
  useEffect(() => { refresh().catch(() => {}).finally(() => setReady(true)); }, []);

  // 활성 프로젝트가 서버에서 사라진 경우 자가복구 — refresh 는 마운트 시 1회뿐이라
  // 이 훅이 없으면 새로고침 전까지 죽은 id 로 폴링이 계속된다(이슈 #274).
  const healedRef = useRef(null);
  useEffect(() => {
    const onMissing = (e) => {
      const gone = e.detail?.projectId;
      // 폴러 3개가 같은 주기에 함께 실패한다 — 프로젝트당 1회만 복구해 refresh 폭주를 막는다.
      if (!gone || healedRef.current === gone) return;
      healedRef.current = gone;
      localStorage.removeItem(ACTIVE_KEY);
      // refresh 는 activeRef 를 먼저 읽는다. 여기서 비워야 사라진 id 를 다시 고르지 않는다.
      activeRef.current = null;
      setActiveProjectId(null);      // 복구 전까지의 요청은 project_id 없이 = 서버 기본 프로젝트
      refresh().catch(() => {});     // 목록을 다시 읽어 유효한 프로젝트를 고른다
    };
    window.addEventListener(PROJECT_MISSING_EVENT, onMissing);
    return () => window.removeEventListener(PROJECT_MISSING_EVENT, onMissing);
  }, []);

  const switchTo = (id) => {
    healedRef.current = null;        // 사용자가 직접 고른 뒤에는 다시 복구 대상이 될 수 있다
    activeRef.current = id;
    setActiveProjectId(id); setActiveId(id); localStorage.setItem(ACTIVE_KEY, id);
  };
  const active = projects.find((p) => p.id === activeId) || null;

  return <Ctx.Provider value={{ projects, active, activeId, switchTo, refresh }}>
    {ready ? children : null}
  </Ctx.Provider>;
}
