import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    open: '/examples/index.html',
    port: 3000,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.ts'),
      },
      output: {
        format: 'es',
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
  },
  worker: {
    format: 'es',
  },
});
