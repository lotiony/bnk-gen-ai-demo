import { createContext, useContext, useEffect, useState } from "react";
import { api, ONTOLOGY_EVENT } from "./api";
import { useProjects } from "./ProjectContext";

// 활성 프로젝트별 온톨로지·매핑 데이터를 받아와 보관한다.
// 프로젝트가 바뀌면 해당 프로젝트 것으로 자동 재조회 → 온톨로지/매핑이 프로젝트별로 달라진다.
const Ctx = createContext(null);
export const useDesign = () => useContext(Ctx);

export function DesignProvider({ children }) {
  const { activeId } = useProjects();
  const [ontology, setOntology] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = async (id = activeId) => {
    if (!id) { setOntology(null); setMapping(null); return; }
    setLoading(true);
    try {
      // 백엔드 준비 전에는 null 폴백 (사이드바가 죽지 않게)
      const [o, m] = await Promise.all([
        api.ontology().catch(() => null),
        api.mapping().catch(() => null),
      ]);
      setOntology(o);
      setMapping(m);
    } finally {
      setLoading(false);
    }
  };

  // 활성 프로젝트가 바뀔 때마다 그 프로젝트의 온톨로지·매핑을 다시 받아온다
  useEffect(() => { reload(activeId); }, [activeId]);

  // 에이전트 챗이 온톨로지를 바꾸면(클래스 추가·매핑·Auto-Map 등) 화면이 옛 상태로 남지 않게 다시 읽는다.
  // rev 를 함께 올려, 자체 fetch 를 도는 화면(Designer 그래프·Mapping 표)도 이 값을 보고 갱신할 수 있다.
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const onChanged = () => { setRev((v) => v + 1); reload(activeId); };
    window.addEventListener(ONTOLOGY_EVENT, onChanged);
    return () => window.removeEventListener(ONTOLOGY_EVENT, onChanged);
  }, [activeId]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{ ontology, mapping, loading, reload, activeId, rev }}>
      {children}
    </Ctx.Provider>
  );
}
