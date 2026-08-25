import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

/**
 * 발표장 네트워크를 신뢰할 수 없으므로(RFP Ⅲ.13 — 발표자료 각사 자체 준비)
 * 빌드 산출물은 **오프라인 자립형 단일 HTML** 이어야 한다.
 *
 * · viteSingleFile — JS·CSS 를 index.html 에 인라인해 dist/index.html 한 개만 남긴다.
 *   에셋 경로 문제(file:// 에서 /assets/… 를 파일시스템 루트에서 찾는 문제)가 원천 소멸한다.
 * · base: './'  — singlefile 이 처리하지 못하는 잔여 상대경로 대비.
 *
 * 라우팅은 HashRouter 를 쓴다(main.tsx). file:// 에서는 History API 가
 * 동작하지 않아 BrowserRouter 로는 화면 이동이 전부 깨진다.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
});
