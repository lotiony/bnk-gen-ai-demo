// Entra ID(구 Azure AD) SSO — 운영 연동 자리(seam).
// 데모 모드(VITE_MSAL_CLIENT_ID 미설정)에선 호출되지 않는다. Login.jsx 가 이메일로 화이트리스트만 검사.
//
// 운영 전환 절차:
//   1) npm i @azure/msal-browser
//   2) 아래 주석 해제 후 tenant/client 를 env 로 주입
//   3) loginWithMsal() 이 반환한 id_token 을 api.login({id_token}) 로 보내면 백엔드가 JWKS 검증.
export async function loginWithMsal() {
  const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
  const tenant = import.meta.env.VITE_MSAL_TENANT_ID;
  if (!clientId || !tenant) throw new Error("VITE_MSAL_CLIENT_ID / VITE_MSAL_TENANT_ID 가 필요합니다.");

  // const { PublicClientApplication } = await import("@azure/msal-browser");
  // const pca = new PublicClientApplication({
  //   auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}`, redirectUri: window.location.origin },
  //   cache: { cacheLocation: "sessionStorage" },
  // });
  // await pca.initialize();
  // const { idToken } = await pca.loginPopup({ scopes: ["openid", "email", "profile"] });
  // return idToken;

  throw new Error("MSAL 미설치 — @azure/msal-browser 설치 후 src/auth/msal.js 주석을 해제하세요.");
}
