import { useEffect, useState } from "react";
import { api } from "../api";

// 변환 잡 SSE 구독 훅 — ConversionMonitor의 EventSource + 404 폴백 패턴을 훅으로 추출.
// (ConversionMonitor 자체는 회귀 위험을 피해 그대로 둔다.)
//
// 잡의 성패는 오직 서버 응답으로만 판정한다. SSE 단절은 프록시 idle 타임아웃 등
// 전송 계층 사고일 뿐 잡의 실패가 아니라서, 끊기면 jobStatus 폴링으로 이어받고
// 서버가 running 을 보고하는 동안에는 계속 running 으로 둔다.
// 잡 자체가 없으면(서버 재시작 등) status="missing".
const IDLE = { status: null, pct: 0, resources: [], log: [] };
const POLL_MS = 2500;
const MAX_POLL_MS = 20000;

export function useJobStream(jobId) {
  const [s, setS] = useState(IDLE);
  useEffect(() => {
    if (!jobId) { setS(IDLE); return; }
    let closed = false;      // 종료 확정 또는 언마운트 — 이후 갱신·재폴링 금지
    let timer = null;
    let retryMs = POLL_MS;
    setS({ status: "running", pct: 0, resources: [], log: [] });

    // SSE 단절 후 인계 — 종료 상태를 받을 때까지 주기적으로 잡을 확인한다.
    const poll = () => {
      api.jobStatus(jobId)
        .then((d) => {
          if (closed) return;
          setS({ status: d.status, pct: d.pct, resources: d.resources || [], log: d.log || [] });
          if (d.status === "running") {
            retryMs = POLL_MS;
            timer = setTimeout(poll, retryMs);
          }
          else closed = true;
        })
        .catch((error) => {
          if (closed) return;
          if (error?.status === 404) {
            closed = true;
            setS((prev) => ({ ...prev, status: "missing" }));
            return;
          }
          // 네트워크·인증·5xx는 잡의 종료 근거가 아니다. running을 유지하고 백오프로 재시도한다.
          setS((prev) => ({ ...prev, status: "running" }));
          retryMs = Math.min(retryMs * 2, MAX_POLL_MS);
          timer = setTimeout(poll, retryMs);
        });
    };

    const es = new EventSource(api.jobStreamUrl(jobId));
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setS((prev) => ({
        status: d.status, pct: d.pct, resources: d.resources || [],
        log: d.log?.length ? [...prev.log, ...d.log] : prev.log,
      }));
      if (d.status !== "running") { closed = true; es.close(); }
    };
    es.onerror = () => { es.close(); if (!closed) poll(); };

    return () => { closed = true; clearTimeout(timer); es.close(); };
  }, [jobId]);
  return s;
}
