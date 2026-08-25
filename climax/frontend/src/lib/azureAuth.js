// Azure Entra ID SSO — MSAL.js (Auth Code + PKCE, public client).
// App Registration 값은 env 로 주입 (VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID).
// 미설정 시 로그인 시도하면 안내 에러 — 배포/로컬에서 값만 넣으면 실제 계정으로 동작.
// 토큰은 sessionStorage(탭 한정) — 서버 미저장. 관리평면 조회는 사용자 권한 그대로.
import { PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "organizations";
const ARM_SCOPE = "https://management.azure.com/user_impersonation";

const msal = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    // 팝업 전용 경량 redirect 페이지(auth-blank.html) — MSAL v5 는 부모 창이 팝업 URL 을
    // 폴링하지 않고 이 페이지가 broadcastResponseToMainFrame() 으로 보내주는 응답을
    // BroadcastChannel 로 받는다. origin(SPA 루트)으로 두면 팝업이 앱 전체를 로드해
    // 플랫폼 화면으로 이동하고 토큰도 팝업 탭에 갇혀, 부모 창은 timed_out 이 된다.
    redirectUri: `${window.location.origin}/auth-blank.html`,
  },
  cache: { cacheLocation: "sessionStorage" },
});

let inited = false;
async function ensure() {
  if (!CLIENT_ID) throw new Error("Azure App Registration 미설정 — VITE_AZURE_CLIENT_ID/TENANT_ID 를 넣어주세요.");
  if (!inited) { await msal.initialize(); inited = true; }
}

// MSAL 은 팝업/리다이렉트 로그인을 시작할 때 "상호작용 진행 중" 플래그를 세션 캐시에
// 세우고 완료 시 지운다. 팝업 진행 중 브라우저가 죽으면 이 플래그가 안 지워지고,
// 크롬 세션 복원이 sessionStorage 를 되살려 플래그가 부활한다. 그러면 다음 loginPopup 이
// interaction_in_progress 로 거부되고, 탭을 완전히 닫기 전까지 로그인이 불가능하다(이슈 #99).
// MSAL 은 이 플래그를 지우는 공개 API 를 주지 않아 캐시 키를 직접 청소한다.
// 키 포맷(msal.<...>.interaction.status)이 바뀔 가능성에 대비해 접미사로 넓게 매칭한다.
export function clearStaleInteraction() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("msal.") && k.endsWith("interaction.status")) sessionStorage.removeItem(k);
    }
  } catch { /* 스토리지 접근 불가 — 무시 */ }
}

// 앱 진입 시 1회 — 리다이렉트 플로우 응답을 마무리한다.
// 팝업 플로우는 auth-blank.html 의 redirect bridge 가 처리하므로 여기로 오지 않는다.
// 리다이렉트 플로우에서는 bridge 가 원래 페이지로 되돌려 보낸 뒤 이 호출이 응답을 처리한다.
// handleRedirectPromise 는 진행 중이던 리다이렉트 상호작용을 정리하지만, 팝업이
// 중단돼 남은 플래그까지는 못 지우므로 진입 시 한 번 더 청소한다.
export async function handleAuthRedirect() {
  if (!CLIENT_ID) return;
  try { await ensure(); await msal.handleRedirectPromise(); } catch { /* 무시 */ }
  clearStaleInteraction();
}

// 로그인 취소 — 진행 중이던 상호작용 플래그를 지워 다음 시도가 막히지 않게 한다.
// (MSAL 은 loginPopup 을 프로그래밍적으로 중단하는 API 가 없어, 팝업 창은 사용자가 닫고
//  여기서는 다음 로그인을 위한 상태 정리만 한다.)
export function cancelAzureLogin() {
  clearStaleInteraction();
}

export function azureConfigured() {
  return !!CLIENT_ID;
}

export async function azureLogin() {
  await ensure();
  const doLogin = async () => {
    // loginPopup 에 ARM 스코프를 포함시켜, 응답의 accessToken 을 그대로 쓴다.
    // 직후 getArmToken 이 또 팝업을 띄우면 block_nested_popups 로 막히므로 토큰을 함께 반환.
    const res = await msal.loginPopup({ scopes: [ARM_SCOPE, "User.Read"] });
    return {
      name: res.account?.name, username: res.account?.username, tenantId: res.account?.tenantId,
      armToken: res.accessToken, idToken: res.idToken,
    };
  };
  try {
    return await doLogin();
  } catch (e) {
    // 이전 팝업이 중단돼 남은 플래그로 막힌 경우 — 정리하고 딱 1회 재시도.
    // 재시도까지 실패하면 진짜 문제이므로 그대로 던진다.
    if (e?.errorCode === "interaction_in_progress") {
      clearStaleInteraction();
      return await doLogin();
    }
    throw e;
  }
}

// 관리평면(ARM) access token — silent 만(중첩 팝업 금지). 캐시 미스 시 예외 → 재로그인 유도.
export async function getArmToken() {
  await ensure();
  const account = msal.getAllAccounts()[0];
  if (!account) throw new Error("로그인이 필요합니다.");
  const r = await msal.acquireTokenSilent({ account, scopes: [ARM_SCOPE] });
  return r.accessToken;
}

export function azureLogout() {
  const account = msal.getAllAccounts()[0];
  if (account) msal.logoutPopup({ account });
}
