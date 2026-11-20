import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages publica em um subdiretório; Render e desenvolvimento usam a raiz.
// O workflow do GitHub Actions define VITE_BASE_PATH explicitamente.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    rollupOptions: {
      input: {
        public: 'index.html',
        app: 'app.html',
        resetPassword: 'reset-password.html',
      },
    },
  },
});
