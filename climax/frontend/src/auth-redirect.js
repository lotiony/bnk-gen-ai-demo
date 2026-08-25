// MSAL redirect URI 전용 엔트리 — 앱(main.jsx)과 완전히 분리된 경량 페이지.
//
// MSAL v5 부터 팝업 응답 전달 방식이 바뀌었다. v2/v3 는 부모 창이 팝업의 URL 을
// 폴링해 #code=... 를 직접 읽었기 때문에 redirect 페이지가 진짜 빈 페이지여도 됐지만,
// v5 는 폴링을 하지 않고 BroadcastChannel 응답만 기다린다.
//   PopupClient.waitForPopupResponse() → BrowserUtils.waitForBridgeResponse()
//     → new BroadcastChannel(libraryState.id) 후 대기
// 그 채널로 payload 를 보내는 유일한 함수가 broadcastResponseToMainFrame 이며,
// 전송 직후 팝업을 스스로 닫는다. 이 호출이 없으면 부모 창은 popupBridgeTimeout 까지
// 기다리다 timed_out 으로 실패한다(이슈 #73 / #81 이 모두 이 원인).
//
// 리다이렉트 플로우로 들어온 경우엔 broadcast 대신 원래 페이지로 되돌려 보내므로,
// main.jsx 의 handleRedirectPromise() 가 이어서 응답을 처리한다.
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

broadcastResponseToMainFrame().catch((e) => {
  // 실패 시 팝업이 빈 화면으로 남으면 원인을 알 수 없으므로 최소한 화면에 남긴다.
  // 부모 창은 별도로 timed_out 처리되므로 여기서 추가 조치는 하지 않는다.
  const el = document.getElementById("msg");
  if (el) el.textContent = `로그인 응답 처리 실패: ${e?.errorCode || e?.message || e}`;
  console.error("[auth-redirect] broadcastResponseToMainFrame 실패", e);
});
