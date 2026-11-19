import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/HSI-Visual-Cognitivo/',
  build: { outDir: 'dist', sourcemap: false, target: ['chrome87', 'edge88', 'firefox78', 'safari14'] },
});