import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' يجعل الموقع يعمل من أي مسار أو استضافة ثابتة (GitHub Pages, Netlify, خادم محلي)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: ['es2019', 'safari13'], assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
});
