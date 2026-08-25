import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ontologyVersion } from "./scripts/ontology-version.mjs";

// public/ 하위 폴더의 index.html 을 디렉터리 경로로도 열리게 한다(dev 전용).
//
// 배포에서는 백엔드가 StaticFiles(html=True) 로 서빙해 "/foo/" → "foo/index.html" 이
// 되지만, vite dev 는 디렉터리 요청을 정적 파일로 못 찾고 SPA 폴백으로 넘겨 앱
// index.html 을 돌려준다. 그래서 dev 에서만 덱이 안 뜨고 대시보드가 뜨는 차이가 생겼다.
// public/<경로>/index.html 이 실제로 있을 때만 재작성하므로 앱의 클라이언트 라우트는
// 건드리지 않는다.
const publicDirIndex = () => ({
  name: "public-dir-index",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url || "";
      const [path, query = ""] = url.split(/(?=\?)/, 2);
      if (path.endsWith("/") && path !== "/") {
        const file = fileURLToPath(new URL(`./public${path}index.html`, import.meta.url));
        if (fs.existsSync(file)) req.url = `${path}index.html${query}`;
      }
      next();
    });
  },
});

// /api 와 /mock 은 apimcp 백엔드(8080) 로 프록시
export default defineConfig({
  plugins: [react(), publicDirIndex()],
  define: {
    // 온톨로지 버전은 브랜치에서 자동 도출한다(수동 관리 없음).
    // 도커 빌드 스테이지엔 .git 이 없어(.dockerignore) 거기선 못 뽑으므로,
    // CI 가 계산해 --build-arg 로 넘긴 VITE_ONTOLOGY_VERSION 을 우선 쓴다.
    __ONTOLOGY_VERSION__: JSON.stringify(process.env.VITE_ONTOLOGY_VERSION || ontologyVersion()),
  },
  build: {
    rollupOptions: {
      // 엔트리 2개. auth-blank 는 MSAL redirect 전용 경량 페이지로, 앱 번들과
      // 분리해야 팝업이 SPA 전체를 로드하고 플랫폼 화면으로 이동해버리지 않는다.
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        authBlank: fileURLToPath(new URL("./auth-blank.html", import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY || "http://127.0.0.1:8080",
      "/mock": process.env.VITE_API_PROXY || "http://127.0.0.1:8080",
    },
  },
});
